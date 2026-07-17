<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDocumentRequest;
use App\Http\Requests\UpdateDocumentRequest;
use App\Models\Document;
use App\Models\Tag;
use App\Models\Workspace;
use App\Support\BulkReorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    public function exportDiagram(Request $request)
    {
        // Server-side render of a caller-supplied graph — viewer-level access,
        // matching the app's convention that every action authorizes.
        $this->authorize('viewAny', Document::class);

        $validated = $request->validate([
            'graph' => 'required|array',
            'name'  => 'nullable|string',
        ]);

        $rendered = \App\Support\DiagramSvg::render($validated['graph']);
        $svg = $rendered['svg'];
        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower(trim($validated['name'] ?? 'network-diagram')));
        $slug = trim($slug, '-');
        if (!$slug) {
            $slug = 'network-diagram';
        }

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml;charset=utf-8',
            'Content-Disposition' => 'attachment; filename="' . $slug . '.svg"',
        ]);
    }

    public function show(Document $document): Response
    {
        $this->authorize('view', $document);

        $this->recordView($document);

        $document->load([
            'workspace',
            'tags',
            'creator',
            'updater',
            'attachments.uploader:id,name',
            'outgoingLinks.target:id,title,slug',
        ]);

        // Pages that link here (backlinks). One entry per referencing page —
        // a page that links several times shows once, with its first snippet.
        // Soft-deleted sources drop out via the relation's default scope.
        $backlinks = $document->backlinks()
            ->with('source:id,title,slug')
            ->get()
            ->filter(fn ($link) => $link->source !== null)
            ->unique('source_document_id')
            ->map(fn ($link) => [
                'id'      => $link->source->id,
                'title'   => $link->source->title,
                'context' => $link->context,
            ])
            ->values();

        return Inertia::render('Documents/Show', [
            'document'     => $document,
            'isStarred'    => DB::table('document_user')
                ->where('user_id', Auth::id())
                ->where('document_id', $document->id)
                ->whereNotNull('starred_at')
                ->exists(),
            'versionsCount' => $document->versions()->count(),
            // Direct children for the "Contents" folder view. children_count lets
            // the list mark a child that is itself a folder. Ordered by position.
            'children'     => $document->children()
                ->withCount('children')
                ->get(['id', 'title', 'slug', 'parent_id', 'position', 'updated_at']),
            'breadcrumbs'  => $document->ancestors(),
            'backlinks'    => $backlinks,
            'allTags'      => Tag::orderBy('name')->get(),
            'allDocuments' => Document::with('workspace:id,name')->orderBy('title')->get(['id', 'title', 'slug', 'workspace_id']),
            'workspaces'   => Workspace::orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Toggle the current user's star on a page. Personal navigation state, so
     * any role that can VIEW the page may star it, and — like the view stamp
     * below — it is deliberately not audited (see .claude/rules/audit.md).
     */
    public function star(Document $document): RedirectResponse
    {
        $this->authorize('view', $document);

        $starred = DB::table('document_user')
            ->where('user_id', Auth::id())
            ->where('document_id', $document->id)
            ->value('starred_at');

        $affected = DB::table('document_user')
            ->where('user_id', Auth::id())
            ->where('document_id', $document->id)
            ->update(['starred_at' => $starred ? null : now()]);

        if (! $affected) {
            // No pivot row yet; insertOrIgnore so a concurrent first write
            // can't trip the unique(user, document) constraint.
            DB::table('document_user')->insertOrIgnore([
                'user_id'     => Auth::id(),
                'document_id' => $document->id,
                'starred_at'  => now(),
            ]);
        }

        return back();
    }

    /**
     * Stamp the current user's "recently viewed" timestamp for a page.
     * Query-builder only — an Eloquent save on the shared document row would
     * bump updated_at and contend with the optimistic-lock counter on every
     * page VIEW. Throttled: a stamp fresher than 5 minutes is left alone so
     * ordinary navigation doesn't turn every view into a write.
     */
    protected function recordView(Document $document): void
    {
        $updated = DB::table('document_user')
            ->where('user_id', Auth::id())
            ->where('document_id', $document->id)
            ->where(fn ($q) => $q->whereNull('last_viewed_at')
                ->orWhere('last_viewed_at', '<', now()->subMinutes(5)))
            ->update(['last_viewed_at' => now()]);

        if (! $updated && ! DB::table('document_user')
                ->where('user_id', Auth::id())
                ->where('document_id', $document->id)
                ->exists()) {
            DB::table('document_user')->insertOrIgnore([
                'user_id'        => Auth::id(),
                'document_id'    => $document->id,
                'last_viewed_at' => now(),
            ]);
        }
    }

    public function preview(Document $document): JsonResponse
    {
        $this->authorize('view', $document);

        $plain = \App\Support\TipTap::plainText($document->content);

        return response()->json([
            'id'      => $document->id,
            'title'   => $document->title,
            'excerpt' => mb_strimwidth(trim($plain), 0, 220, '…'),
        ]);
    }

    public function store(StoreDocumentRequest $request): RedirectResponse
    {
        $this->authorize('create', Document::class);

        $validated = $request->validated();

        $template = isset($validated['template_id'])
            ? \App\Models\Template::findOrFail($validated['template_id'])
            : null;

        // Create the bare page first (a blank page snapshots no version), attach
        // tags, THEN write content — so the first version's snapshot captures the
        // tags too. The version observer reads tags off the page at save time.
        $document = new Document(array_diff_key($validated, ['tags' => '', 'content' => '', 'template_id' => '']));
        $document->sourceTemplateName = $template?->name; // surfaces in the document.created audit context
        $document->save();

        if ($request->has('tags')) {
            $document->tags()->sync($request->input('tags'));
        }

        // A template supplies the starting content when the request carries none.
        // Copied verbatim (no token substitution) — the observer then parses
        // wiki-links and snapshots v1 exactly as for hand-written content.
        $content = $validated['content'] ?? $template?->content;
        if ($content !== null) {
            $document->update(['content' => $content]);
        }

        return redirect()->to(route('documents.show', $document) . '?edit=1');
    }

    public function update(UpdateDocumentRequest $request, Document $document): RedirectResponse
    {
        $this->authorize('update', $document);

        $validated = $request->validated();

        // Optimistic locking: reject a content/title save whose base is stale — the
        // page was edited by someone else since this editor loaded it. The client
        // then resolves the conflict (reload theirs / overwrite with mine, which
        // re-submits with force). Structural/metadata- or tags-only saves carry no
        // base_version and skip this. Bail BEFORE mutating anything (incl. tags).
        $editingContent = array_key_exists('content', $validated) || array_key_exists('title', $validated);
        $baseVersion = $validated['base_version'] ?? null;

        if ($editingContent && $baseVersion !== null && ! ($validated['force'] ?? false)
            && (int) $baseVersion !== (int) $document->version) {
            $document->loadMissing('updater');

            return back()->with('saveConflict', [
                'title'      => $document->title,
                'content'    => $document->content,
                'version'    => $document->version,
                'updated_at' => $document->updated_at,
                'updated_by' => $document->updater?->name,
            ]);
        }

        // Sync tags BEFORE the content/title save: the version snapshot the observer
        // takes on that save reads the page's current tags, so a full-revert restore
        // needs the new set already in place.
        $tagsChanged = false;
        $oldTags = [];
        if ($request->has('tags')) {
            $oldTags = $document->tags()->orderBy('name')->pluck('name')->all();
            $changes = $document->tags()->sync($request->input('tags'));
            $tagsChanged = (bool) array_filter($changes);
        }

        $document->update(array_diff_key($validated, ['tags' => '', 'base_version' => '', 'force' => '']));

        // When only tags changed, no version was snapshotted and the observer's
        // workspace touch didn't run — touch explicitly so listings refresh.
        // The observer's document.updated didn't fire either (no content/title
        // change), so record the action here; a combined save stays ONE event.
        if ($tagsChanged && ! $document->wasChanged(['content', 'title'])) {
            $document->workspace?->touch();

            \App\Support\Audit::record('document.tags_changed', $document, [
                'title' => $document->title,
                'from'  => implode(', ', $oldTags) ?: null,
                'to'    => implode(', ', $document->tags()->orderBy('name')->pluck('name')->all()) ?: null,
            ]);
        }

        return redirect()->route('documents.show', $document);
    }

    public function destroy(Document $document): RedirectResponse
    {
        $this->authorize('delete', $document);

        $workspace = $document->workspace;
        $document->trashSubtree();

        // One event per user action — not one per cascaded subtree page.
        \App\Support\Audit::record('document.trashed', $document, ['title' => $document->title]);

        return redirect()->route('workspaces.show', $workspace)
            ->with('success', "Moved \"{$document->title}\" to trash.");
    }

    /** Immediate children of a document, in display order. */
    public function children(Document $document): JsonResponse
    {
        $this->authorize('view', $document);

        return response()->json(
            $document->children()->get(['id', 'title', 'slug', 'parent_id', 'position'])
        );
    }

    /** Move a node to a new parent (and optionally a new workspace). */
    public function move(Request $request, Document $document): RedirectResponse
    {
        $this->authorize('update', $document);

        $data = $request->validate([
            // whereNull: `exists` alone counts soft-deleted rows, so a trashed
            // parent would pass here and then Document::find() below (trashed
            // excluded) would silently skip the workspace + cycle checks —
            // leaving the page a live child of a trashed parent, invisible in
            // every tree view.
            'parent_id' => [
                'nullable', 'integer',
                \Illuminate\Validation\Rule::exists('documents', 'id')->whereNull('deleted_at'),
            ],
            // Same soft-delete trap as parent_id: a trashed destination would
            // pass a plain `exists` and swallow the subtree invisibly.
            'workspace_id' => [
                'nullable', 'integer',
                \Illuminate\Validation\Rule::exists('workspaces', 'id')->whereNull('deleted_at'),
            ],
            'position' => ['nullable', 'integer'],
            // Optional: the destination parent's full child order (page ids) so a
            // re-parent and the sibling reordering happen in one atomic request.
            'order' => ['nullable', 'array'],
            'order.*' => ['integer', 'exists:documents,id'],
        ]);

        $parentId = $data['parent_id'] ?? null;
        $newWorkspaceId = $data['workspace_id'] ?? $document->workspace_id;

        if ($parentId !== null) {
            // Fail rather than skip if the parent vanished between validation
            // and here — proceeding would bypass the workspace/cycle checks.
            $parent = Document::find($parentId);
            if (! $parent) {
                throw ValidationException::withMessages([
                    'parent_id' => 'The parent document no longer exists.',
                ]);
            }
            if ($parent->workspace_id !== (int) $newWorkspaceId) {
                throw ValidationException::withMessages([
                    'parent_id' => 'The parent document must belong to the destination workspace.',
                ]);
            }

            if ($this->wouldCycle($document, (int) $parentId)) {
                throw ValidationException::withMessages([
                    'parent_id' => 'A document cannot be moved inside itself or one of its descendants.',
                ]);
            }
        }
        $workspaceChanged = $newWorkspaceId !== $document->workspace_id;
        $parentChanged = $parentId !== $document->parent_id;
        $movedFrom = ['workspace_id' => $document->workspace_id, 'parent_id' => $document->parent_id];

        $document->parent_id = $parentId;
        $document->workspace_id = $newWorkspaceId;
        $document->position = $data['position'] ?? $document->position;

        // A move carries the slug over unchanged; re-slug if it now collides with
        // a page already in the destination workspace (slugs are unique per ws).
        if ($workspaceChanged) {
            $document->reslugForWorkspace();
        }

        // Structural moves must not shift updated_at — only content edits should.
        Document::withoutTimestamps(fn () => $document->save());

        // A cross-workspace move must carry the whole subtree along.
        if ($workspaceChanged) {
            $document->moveSubtreeToWorkspace($newWorkspaceId);
        }

        // Re-parenting and cross-workspace moves are audited; pure sibling
        // reordering (position only) is layout noise and is not.
        if ($workspaceChanged || $parentChanged) {
            \App\Support\Audit::record('document.moved', $document, [
                'title' => $document->title,
                'from'  => $movedFrom,
                'to'    => ['workspace_id' => (int) $newWorkspaceId, 'parent_id' => $parentId],
            ]);
        }

        // Normalise the destination siblings' positions to the given order.
        // Constrain each update to an actual child of the new parent so a client
        // can't reposition unrelated pages by smuggling their ids into `order`.
        foreach ($data['order'] ?? [] as $position => $id) {
            Document::withoutTimestamps(fn () => Document::whereKey($id)
                ->where('parent_id', $parentId)
                ->update(['position' => $position]));
        }

        // A cross-workspace move gets a confirmation like trash/restore do;
        // re-parents and sibling reorders stay silent (layout, not a "result").
        // Nullsafe: the destination could be trashed between validation and here.
        if ($workspaceChanged && ($destination = Workspace::find((int) $newWorkspaceId))) {
            return back()->with('success', "Moved \"{$document->title}\" to \"{$destination->name}\".");
        }

        return back();
    }

    /**
     * Persist a whole workspace's page tree in one shot — parent + position for
     * every node. The "Reorder" mode batches all drags locally and saves once on
     * "Done", instead of a request per drop, so the tree lands in one atomic write.
     */
    public function restructure(Request $request, Workspace $workspace): RedirectResponse
    {
        $this->authorize('update', $workspace);

        $data = $request->validate([
            'nodes'             => ['required', 'array'],
            'nodes.*.id'        => ['required', 'integer', 'distinct'],
            'nodes.*.parent_id' => ['nullable', 'integer'],
            'nodes.*.position'  => ['required', 'integer'],
        ]);

        $nodes = $data['nodes'];
        $ids   = array_column($nodes, 'id');

        // Every node must be a live page in THIS workspace — no smuggling ids
        // from another workspace into the batch.
        if ($workspace->documents()->whereIn('id', $ids)->count() !== count($ids)) {
            throw ValidationException::withMessages(['nodes' => 'Every page must belong to this workspace.']);
        }

        // Each parent must be inside the batch (or null), and the result acyclic —
        // a hostile client could otherwise send a cycle that hangs tree walks.
        $idSet    = array_flip($ids);
        $parentOf = [];
        foreach ($nodes as $node) {
            $parentId = $node['parent_id'] ?? null;
            if ($parentId !== null && ! isset($idSet[$parentId])) {
                throw ValidationException::withMessages(['nodes' => 'A parent must be one of the reordered pages.']);
            }
            $parentOf[$node['id']] = $parentId;
        }
        foreach ($parentOf as $id => $parentId) {
            $seen = [];
            while ($parentId !== null) {
                if ($parentId === $id || isset($seen[$parentId])) {
                    throw ValidationException::withMessages(['nodes' => 'A page cannot be nested inside itself.']);
                }
                $seen[$parentId] = true;
                $parentId = $parentOf[$parentId] ?? null;
            }
        }

        // Structural change only — one statement, and don't bump updated_at.
        BulkReorder::tree('documents', $nodes);

        \App\Support\Audit::record('workspace.restructured', $workspace, [
            'name'       => $workspace->name,
            'page_count' => count($nodes),
        ]);

        return back();
    }

    /** Reorder siblings by assigning positions from the given id order. */
    public function reorder(Request $request): RedirectResponse
    {
        $this->authorize('viewAny', Document::class);

        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:documents,id'],
        ]);

        // Authorize every page up front (one query), then write all positions in
        // a single statement instead of a find + update per id.
        foreach (Document::findMany($data['ids']) as $document) {
            $this->authorize('update', $document);
        }

        BulkReorder::positions('documents', $data['ids']);

        return back();
    }

    /** True if making $parentId the parent of $document would create a cycle. */
    protected function wouldCycle(Document $document, int $parentId): bool
    {
        if ($parentId === $document->getKey()) {
            return true;
        }

        $seen = [];
        $ancestor = Document::find($parentId);

        while ($ancestor) {
            // Stop if pre-existing corrupt data already loops, instead of hanging.
            if (isset($seen[$ancestor->getKey()])) {
                break;
            }
            $seen[$ancestor->getKey()] = true;

            if ($ancestor->getKey() === $document->getKey()) {
                return true;
            }
            $ancestor = $ancestor->parent_id ? Document::find($ancestor->parent_id) : null;
        }

        return false;
    }
}
