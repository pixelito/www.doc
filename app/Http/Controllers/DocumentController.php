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
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    public function exportDiagram(Request $request)
    {
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
            'versionsCount' => $document->versions()->count(),
            'breadcrumbs'  => $document->ancestors(),
            'backlinks'    => $backlinks,
            'allTags'      => Tag::orderBy('name')->get(),
            'allDocuments' => Document::with('workspace:id,name')->orderBy('title')->get(['id', 'title', 'slug', 'workspace_id']),
            'workspaces'   => Workspace::orderBy('name')->get(['id', 'name']),
        ]);
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

        // Create the bare page first (a blank page snapshots no version), attach
        // tags, THEN write content — so the first version's snapshot captures the
        // tags too. The version observer reads tags off the page at save time.
        $document = Document::create(array_diff_key($validated, ['tags' => '', 'content' => '']));

        if ($request->has('tags')) {
            $document->tags()->sync($request->input('tags'));
        }

        if (array_key_exists('content', $validated) && $validated['content'] !== null) {
            $document->update(['content' => $validated['content']]);
        }

        return redirect()->to(route('documents.show', $document) . '?edit=1');
    }

    public function update(UpdateDocumentRequest $request, Document $document): RedirectResponse
    {
        $this->authorize('update', $document);

        $validated = $request->validated();

        // Sync tags BEFORE the content/title save: the version snapshot the observer
        // takes on that save reads the page's current tags, so a full-revert restore
        // needs the new set already in place.
        $tagsChanged = false;
        if ($request->has('tags')) {
            $changes = $document->tags()->sync($request->input('tags'));
            $tagsChanged = (bool) array_filter($changes);
        }

        $document->update(array_diff_key($validated, ['tags' => '']));

        // When only tags changed, no version was snapshotted and the observer's
        // workspace touch didn't run — touch explicitly so listings refresh.
        if ($tagsChanged && ! $document->wasChanged(['content', 'title'])) {
            $document->workspace?->touch();
        }

        return redirect()->route('documents.show', $document);
    }

    public function destroy(Document $document): RedirectResponse
    {
        $this->authorize('delete', $document);

        $workspace = $document->workspace;
        $document->trashSubtree();

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
            'parent_id' => ['nullable', 'integer', 'exists:documents,id'],
            'workspace_id' => ['nullable', 'integer', 'exists:workspaces,id'],
            'position' => ['nullable', 'integer'],
            // Optional: the destination parent's full child order (page ids) so a
            // re-parent and the sibling reordering happen in one atomic request.
            'order' => ['nullable', 'array'],
            'order.*' => ['integer', 'exists:documents,id'],
        ]);

        $parentId = $data['parent_id'] ?? null;
        $newWorkspaceId = $data['workspace_id'] ?? $document->workspace_id;

        if ($parentId !== null) {
            $parent = Document::find($parentId);
            if ($parent && $parent->workspace_id !== (int) $newWorkspaceId) {
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

        $document->parent_id = $parentId;
        $document->workspace_id = $newWorkspaceId;
        $document->position = $data['position'] ?? $document->position;

        // Structural moves must not shift updated_at — only content edits should.
        Document::withoutTimestamps(fn () => $document->save());

        // A cross-workspace move must carry the whole subtree along.
        if ($workspaceChanged) {
            $document->moveSubtreeToWorkspace($newWorkspaceId);
        }

        // Normalise the destination siblings' positions to the given order.
        // Constrain each update to an actual child of the new parent so a client
        // can't reposition unrelated pages by smuggling their ids into `order`.
        foreach ($data['order'] ?? [] as $position => $id) {
            Document::withoutTimestamps(fn () => Document::whereKey($id)
                ->where('parent_id', $parentId)
                ->update(['position' => $position]));
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
