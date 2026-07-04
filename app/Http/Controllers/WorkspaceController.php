<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkspaceRequest;
use App\Http\Requests\UpdateWorkspaceRequest;
use App\Models\Document;
use App\Models\Workspace;
use App\Support\Audit;
use App\Support\BulkReorder;
use App\Support\DocumentTree;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            ->get(['id', 'name', 'slug', 'description', 'position', 'updated_at']);

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

        $recentlyViewed = $user->recentlyViewedDocuments()->with('workspace:id,name')
            ->limit(15)->get()
            ->map(fn (Document $d) => $docRow($d) + ['viewed_at' => $d->pivot->last_viewed_at])
            ->values();

        return Inertia::render('Workspaces/Index', [
            'workspaces'     => $workspaces,
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

        $oldName = $workspace->name;
        $workspace->update($request->validated());

        if ($workspace->wasChanged('name')) {
            Audit::record('workspace.renamed', $workspace, ['from' => $oldName, 'to' => $workspace->name]);
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
