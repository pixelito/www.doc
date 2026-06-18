<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDocumentRequest;
use App\Http\Requests\UpdateDocumentRequest;
use App\Models\Document;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DocumentController extends Controller
{
    public function show(Document $document): Response
    {
        $this->authorize('view', $document);

        $document->load([
            'workspace',
            'tags',
            'creator',
            'updater',
            'outgoingLinks.target:id,title,slug',
        ]);

        // Backlinks with context snippets — select only needed columns
        $document->load(['backlinks' => fn ($q) => $q->select(['id', 'target_document_id', 'source_document_id', 'context'])->with('source:id,title,slug')]);

        return Inertia::render('Documents/Show', [
            'document'     => $document,
            'versionsCount' => $document->versions()->count(),
            'breadcrumbs'  => $document->ancestors(),
            'allTags'      => Tag::orderBy('name')->get(),
            'allDocuments' => Document::orderBy('title')->get(['id', 'title', 'slug']),
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
        $document = Document::create(array_diff_key($validated, ['tags' => '']));

        if ($request->has('tags')) {
            $document->tags()->sync($request->input('tags'));
        }

        return redirect()->route('documents.show', $document);
    }

    public function update(UpdateDocumentRequest $request, Document $document): RedirectResponse
    {
        $this->authorize('update', $document);

        $validated = $request->validated();
        $document->update(array_diff_key($validated, ['tags' => '']));

        if ($request->has('tags')) {
            $document->tags()->sync($request->input('tags'));
        }

        return back();
    }

    public function destroy(Document $document): RedirectResponse
    {
        $this->authorize('delete', $document);

        $workspace = $document->workspace;
        $document->delete();

        return redirect()->route('workspaces.show', $workspace);
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
        ]);

        $parentId = $data['parent_id'] ?? null;

        if ($parentId !== null && $this->wouldCycle($document, (int) $parentId)) {
            throw ValidationException::withMessages([
                'parent_id' => 'A document cannot be moved inside itself or one of its descendants.',
            ]);
        }

        $document->parent_id = $parentId;
        $document->workspace_id = $data['workspace_id'] ?? $document->workspace_id;
        $document->position = $data['position'] ?? $document->position;

        // Structural moves must not shift updated_at — only content edits should.
        Document::withoutTimestamps(fn () => $document->save());

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

        foreach ($data['ids'] as $position => $id) {
            $document = Document::find($id);
            $this->authorize('update', $document);
            Document::withoutTimestamps(fn () => $document->update(['position' => $position]));
        }

        return back();
    }

    /** True if making $parentId the parent of $document would create a cycle. */
    protected function wouldCycle(Document $document, int $parentId): bool
    {
        if ($parentId === $document->getKey()) {
            return true;
        }

        $ancestor = Document::find($parentId);

        while ($ancestor) {
            if ($ancestor->getKey() === $document->getKey()) {
                return true;
            }
            $ancestor = $ancestor->parent_id ? Document::find($ancestor->parent_id) : null;
        }

        return false;
    }
}
