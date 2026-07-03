<?php

namespace App\Observers;

use App\Models\Document;
use App\Models\Link;
use App\Services\RenderDocument;
use App\Support\Audit;
use App\Support\SearchVector;
use App\Support\TipTap;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DocumentObserver
{
    /** Stamp authorship before the row is written. */
    public function saving(Document $document): void
    {
        // Keep stored content valid for ProseMirror (no empty text nodes) on
        // every write path — controllers, seeders, import jobs. Only touch it
        // when it actually changed so tree ops (move/reorder) stay no-ops.
        if ($document->isDirty('content') && is_array($document->content)) {
            $document->content = TipTap::normalize($document->content);
        }

        if ($document->isDirty('content')) {
            $document->content_html = RenderDocument::toHtml($document->content ?? []);
        }

        $userId = Auth::id();

        if (! $document->exists && $userId && ! $document->created_by_id) {
            $document->created_by_id = $userId;
        }

        // Only update editor attribution when content or title actually changes —
        // position/parent changes (drag-reorder, move) must not shift the timestamp.
        if ($userId && $document->isDirty(['content', 'title'])) {
            $document->updated_by_id = $userId;
        }

        // Bump the optimistic-locking counter on the same condition (content/title
        // edits only, never structural moves). This is the token the editor checks
        // its `base_version` against, so every real edit invalidates stale bases.
        if ($document->isDirty(['content', 'title'])) {
            $document->version = ($document->version ?? 0) + 1;
        }
    }

    public function saved(Document $document): void
    {
        // Only snapshot/re-link when content or title actually changed —
        // tree ops (move, reorder) touch position only.
        $contentChanged = $document->wasRecentlyCreated
            || $document->wasChanged('content')
            || $document->wasChanged('title');

        if (! $contentChanged) {
            return;
        }

        // Bubble the activity timestamp up to the workspace.
        $document->workspace?->touch();

        $html = (string) $document->content_html;

        $this->syncLinks($document);
        $this->snapshotVersion($document, $html);
        $this->updateSearchVector($document);

        // Observer-level so every edit path is covered (controllers, imports,
        // restores). Structural moves bailed out above, so they never land here —
        // they're audited as document.moved by their controllers instead.
        Audit::record(
            $document->wasRecentlyCreated ? 'document.created' : 'document.updated',
            $document,
            ['title' => $document->title],
            Auth::id() ?? $document->updated_by_id ?? $document->created_by_id,
        );
    }

    public function deleted(Document $document): void
    {
        $document->workspace?->touch();
    }

    /**
     * Permanently purging a page: delete its attachment binaries. The DB foreign
     * key cascade removes the attachment ROWS, but bypasses Eloquent events, so the
     * files would otherwise be orphaned on disk. Fires on every force-delete path
     * (trash purge of a page subtree AND a workspace purge), unlike a soft delete,
     * which leaves the page restorable from Trash with its files intact.
     */
    public function forceDeleting(Document $document): void
    {
        foreach ($document->attachments as $attachment) {
            Storage::disk($attachment->disk)->delete($attachment->path);
        }
    }

    /** Snapshot every save into the version history (never destructive). */
    protected function snapshotVersion(Document $document, string $html): void
    {
        // Skip the blank state a page is in the instant it's created, before any
        // content is written — otherwise the oldest "version" is always empty.
        if ($document->wasRecentlyCreated && TipTap::isEmpty($document->content)) {
            return;
        }

        // Capture the tag set so a restore is a full revert, not content-only.
        // Read fresh (controllers sync tags *before* the snapshotting save) and
        // store names — they outlive tag id churn and rename/delete.
        $tags = $document->tags()->orderBy('name')->pluck('name')->all();

        // The previous snapshot is the baseline for this version's change
        // summary (fetched BEFORE creating the new row). First version → null.
        $previous = $document->versions()->latest('id')->first();

        $document->versions()->create([
            'title'         => $document->title,
            'content'       => $document->content ?? [],
            'content_html'  => $html,
            'tags'          => $tags,
            'summary'       => $previous ? \App\Support\DocumentDiff::summarize(
                ['title' => $previous->title, 'content' => $previous->content, 'tags' => $previous->tags ?? []],
                ['title' => $document->title, 'content' => $document->content ?? [], 'tags' => $tags],
            ) : null,
            'created_by_id' => Auth::id() ?? $document->updated_by_id,
        ]);
    }



    /**
     * Maintain the Postgres tsvector column for full-text search.
     * Title gets weight A, content_html (tags stripped) weight B — so title
     * matches rank higher. Shares its SQL with `search:reindex` via SearchVector
     * so the live and bulk paths index identical text (incl. diagram labels).
     */
    protected function updateSearchVector(Document $document): void
    {
        $lang = config('database.search_language', 'english');

        DB::statement(
            'UPDATE documents SET search_vector = ' . SearchVector::expression() . ' WHERE id = ?',
            [$lang, $lang, $document->getKey()]
        );
    }

    /**
     * Rebuild this document's outgoing links from its [[Wiki-link]] references.
     * Stores a short context snippet alongside each link for the backlinks panel.
     */
    protected function syncLinks(Document $document): void
    {
        $targets = TipTap::wikiLinkTargets($document->content);

        $document->outgoingLinks()->delete();

        foreach ($targets as $targetData) {
            $title = $targetData['title'];
            $targetId = $targetData['target_id'];

            if ($targetId) {
                // We know exactly which document they selected
                $target = Document::query()
                    ->whereKey($targetId)
                    ->first();
            } else {
                // Fallback for typed links without an explicit ID
                $target = Document::query()
                    ->where('title', $title)
                    ->whereKeyNot($document->getKey())
                    ->orderByRaw('(workspace_id = ?) desc', [$document->workspace_id])
                    ->orderBy('created_at', 'asc') // Tie-breaker: oldest (original) page wins
                    ->first();
            }

            Link::create([
                'source_document_id' => $document->getKey(),
                'target_document_id' => $target?->getKey(),
                'target_title'       => $title,
                'context'            => TipTap::contextAround($document->content, $title),
            ]);
        }
    }
}
