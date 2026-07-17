<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkspaceRequest;
use App\Http\Requests\UpdateWorkspaceRequest;
use App\Models\Document;
use App\Models\Workspace;
use App\Models\WorkspaceGroup;
use App\Support\Audit;
use App\Support\BulkReorder;
use App\Support\DocumentTree;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', Workspace::class);

        $workspaces = Workspace::query()
            ->withCount('documents')
            ->orderBy('position')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'position', 'group_id', 'updated_at']);

        // Groups (BookStack-style shelves) in display order; the page composes the
        // grouped view client-side from these + each workspace's group_id.
        $groups = WorkspaceGroup::orderBy('position')->orderBy('name')
            ->get(['id', 'name', 'slug', 'position']);

        $recent = Document::with('workspace')
            ->orderByDesc('updated_at')
            ->limit(6)
            ->get()
            ->map(fn (Document $d) => [
                'id'         => $d->id,
                'title'      => $d->title,
                'updated_at' => $d->updated_at->toIso8601String(),
                'workspace'  => ['name' => $d->workspace->name, 'slug' => $d->workspace->slug],
            ]);

        // Personal quick access (document_user pivot). Trashed pages drop out
        // via Document's soft-delete scope on the relations.
        $user = auth()->user();
        $docRow = fn (Document $d) => [
            'id'        => $d->id,
            'title'     => $d->title,
            'workspace' => ['name' => $d->workspace->name],
        ];

        $starred = $user->starredDocuments()->with('workspace:id,name')
            ->get()->map($docRow)->values();

        // Pivot columns aren't cast: last_viewed_at arrives as a bare
        // "Y-m-d H:i:s" string, which browsers parse as LOCAL time — every
        // row would be off by the viewer's UTC offset. Ship it as ISO 8601
        // with timezone like every other date prop.
        $recentlyViewed = $user->recentlyViewedDocuments()->with('workspace:id,name')
            ->limit(15)->get()
            ->map(fn (Document $d) => $docRow($d) + [
                'viewed_at' => Carbon::parse($d->pivot->last_viewed_at)->toIso8601String(),
            ])
            ->values();

        return Inertia::render('Workspaces/Index', [
            'workspaces'     => $workspaces,
            'groups'         => $groups,
            'recent'         => $recent,
            'starred'        => $starred,
            'recentlyViewed' => $recentlyViewed,
        ]);
    }

    public function show(Workspace $workspace): Response
    {
        $this->authorize('view', $workspace);

        $documents = $workspace->documents()->with('tags')->orderBy('position')->get();

        return Inertia::render('Workspaces/Show', [
            'workspace' => $workspace->loadCount('documents'),
            'tree'      => DocumentTree::build($documents),
            // For the tree rows' star affordance (personal, per-user).
            'starredIds' => DB::table('document_user')
                ->where('user_id', auth()->id())
                ->whereNotNull('starred_at')
                ->whereIn('document_id', $documents->pluck('id'))
                ->pluck('document_id'),
            // For the New page modal's "start from" picker. Viewers can't
            // create pages (and can't view templates), so they get none.
            'templates' => auth()->user()->can('viewAny', \App\Models\Template::class)
                ? \App\Models\Template::orderBy('name')->get(['id', 'name', 'description'])
                : [],
        ]);
    }

    public function reorder(Request $request): RedirectResponse
    {
        $this->authorize('create', Workspace::class);

        // Validate the payload like the document reorder/move endpoints do — an
        // unchecked id list reaching a raw UPDATE is the one gap among the tree
        // ops. The bulk write sets all positions in one statement and leaves
        // updated_at untouched (reordering is structural, not a content edit).
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:workspaces,id'],
        ]);

        BulkReorder::positions('workspaces', $data['ids']);

        return back();
    }

    /**
     * Reorder the top level of the workspaces index, where groups and ungrouped
     * workspaces are interleaved in a SINGLE shared order. The client sends the
     * whole top-level sequence as typed items; we assign each its global index
     * (0..N-1) across both tables, so a group and a loose workspace at adjacent
     * slots sort correctly against each other.
     *
     * This is what lets an ungrouped workspace sit *between* two groups, and it
     * subsumes group reordering (dragging a group is just moving it in this list).
     *
     * `grouped` is the optional companion axis — every group's members in display
     * order — so one "Done" saves the whole arrangement atomically. The two axes
     * touch disjoint workspace sets (ungrouped items vs grouped members), so they
     * never fight over a row's position.
     *
     * Structural + layout-only: raw position writes never touch updated_at, and —
     * like sibling reorders — nothing is audited.
     */
    public function reorderTopLevel(Request $request): RedirectResponse
    {
        $this->authorize('create', Workspace::class);
        $this->authorize('create', WorkspaceGroup::class);

        $data = $request->validate([
            'items'        => ['required', 'array'],
            'items.*.type' => ['required', 'string', 'in:group,workspace'],
            'items.*.id'   => ['required', 'integer'],
            'grouped'      => ['array'],
            'grouped.*'    => ['integer'],
        ]);

        $groupPairs = [];
        $workspacePairs = [];
        foreach (array_values($data['items']) as $position => $item) {
            if ($item['type'] === 'group') {
                $groupPairs[] = [(int) $item['id'], $position];
            } else {
                $workspacePairs[] = [(int) $item['id'], $position];
            }
        }
        $groupedIds = array_map('intval', $data['grouped'] ?? []);

        // Guard the raw writes: every id must exist, top-level workspace items must
        // be ungrouped, and members must be grouped — a workspace carrying both a
        // top-level slot and a member slot would get two conflicting positions.
        $this->assertIdsExist('workspace_groups', array_column($groupPairs, 0));
        $this->assertTopLevelWorkspaces(array_column($workspacePairs, 0));
        $this->assertGroupedWorkspaces($groupedIds);

        BulkReorder::assign('workspace_groups', $groupPairs);
        BulkReorder::assign('workspaces', $workspacePairs);
        BulkReorder::positions('workspaces', $groupedIds);

        return back();
    }

    /** @param array<int, int> $ids */
    private function assertIdsExist(string $table, array $ids): void
    {
        if ($ids && \Illuminate\Support\Facades\DB::table($table)->whereIn('id', $ids)->count() !== count(array_unique($ids))) {
            abort(422, 'Unknown '.$table.' id in reorder payload.');
        }
    }

    /** Every id must be a live, ungrouped workspace. @param array<int, int> $ids */
    private function assertTopLevelWorkspaces(array $ids): void
    {
        if (! $ids) {
            return;
        }

        $valid = Workspace::whereIn('id', $ids)->whereNull('group_id')->count();
        if ($valid !== count(array_unique($ids))) {
            abort(422, 'Reorder payload includes a grouped or unknown workspace.');
        }
    }

    /** Every id must be a live workspace that belongs to a group. @param array<int, int> $ids */
    private function assertGroupedWorkspaces(array $ids): void
    {
        if (! $ids) {
            return;
        }

        $valid = Workspace::whereIn('id', $ids)->whereNotNull('group_id')->count();
        if ($valid !== count(array_unique($ids))) {
            abort(422, 'Reorder payload includes an ungrouped or unknown group member.');
        }
    }

    /**
     * File a workspace into a group (or out to the top level). Mirrors
     * DocumentController@move: changing the container is structural, so it must
     * NOT bump updated_at, and only a real group change (not a position-only
     * tweak) is audited. The client appends to the destination via `position`;
     * within-group ordering is handled by the reorder endpoint.
     */
    public function regroup(Request $request, Workspace $workspace): RedirectResponse
    {
        $this->authorize('update', $workspace);

        $data = $request->validate([
            'group_id' => [
                'nullable', 'integer',
                \Illuminate\Validation\Rule::exists('workspace_groups', 'id'),
            ],
            'position' => ['nullable', 'integer'],
        ]);

        $groupId = $data['group_id'] ?? null;
        $groupChanged = $groupId !== $workspace->group_id;
        $fromGroup = $workspace->group?->name;

        $workspace->group_id = $groupId;
        $workspace->position = $data['position'] ?? $workspace->position;

        // Structural move must not shift updated_at — only content edits should.
        Workspace::withoutTimestamps(fn () => $workspace->save());

        // Re-grouping is audited (parity with document.moved); a position-only
        // change (same group) is layout noise and is not.
        if ($groupChanged) {
            Audit::record('workspace.moved', $workspace, [
                'name'       => $workspace->name,
                'from_group' => $fromGroup,
                'to_group'   => $groupId ? WorkspaceGroup::find($groupId)?->name : null,
            ]);
        }

        return back();
    }

    public function store(StoreWorkspaceRequest $request): RedirectResponse
    {
        $this->authorize('create', Workspace::class);

        $workspace = Workspace::create($request->validated());

        Audit::record('workspace.created', $workspace, ['name' => $workspace->name]);

        return redirect()->route('workspaces.show', $workspace);
    }

    public function update(UpdateWorkspaceRequest $request, Workspace $workspace): RedirectResponse
    {
        $this->authorize('update', $workspace);

        $original = $workspace->only(['name', 'description']);
        $workspace->update($request->validated());

        // One event per save: a rename is the notable action (and carries any
        // description change alongside); a description-only edit is workspace.updated.
        if ($workspace->wasChanged('name')) {
            $context = ['from' => $original['name'], 'to' => $workspace->name];
            if ($workspace->wasChanged('description')) {
                $context['description_from'] = $original['description'];
                $context['description_to']   = $workspace->description;
            }
            Audit::record('workspace.renamed', $workspace, $context);
        } elseif ($workspace->wasChanged('description')) {
            Audit::record('workspace.updated', $workspace, [
                'name' => $workspace->name,
                'from' => $original['description'],
                'to'   => $workspace->description,
            ]);
        }

        return back();
    }

    public function destroy(Workspace $workspace): RedirectResponse
    {
        $this->authorize('delete', $workspace);

        $workspace->trashWithDocuments();

        Audit::record('workspace.trashed', $workspace, ['name' => $workspace->name]);

        return redirect()->route('workspaces.index')
            ->with('success', "Moved \"{$workspace->name}\" to trash.");
    }
}
