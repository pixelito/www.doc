<?php

namespace App\Observers;

use App\Models\Document;
use App\Models\Link;
use App\Services\RenderDocument;
use App\Support\TipTap;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

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

        $userId = Auth::id();

        if (! $document->exists && $userId && ! $document->created_by_id) {
            $document->created_by_id = $userId;
        }

        // Only update editor attribution when content or title actually changes —
        // position/parent changes (drag-reorder, move) must not shift the timestamp.
        if ($userId && $document->isDirty(['content', 'title'])) {
            $document->updated_by_id = $userId;
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

        // Render the HTML first so the snapshot captures THIS save's content,
        // not the stale html left over from the previous save.
        $this->syncLinks($document);
        $html = $this->updateRenderedHtml($document);
        $this->snapshotVersion($document, $html);
        $this->updateSearchVector($document, $html);
    }

    public function deleted(Document $document): void
    {
        $document->workspace?->touch();
    }

    /** Snapshot every save into the version history (never destructive). */
    protected function snapshotVersion(Document $document, string $html): void
    {
        // Skip the blank state a page is in the instant it's created, before any
        // content is written — otherwise the oldest "version" is always empty.
        if ($document->wasRecentlyCreated && TipTap::isEmpty($document->content)) {
            return;
        }

        $document->versions()->create([
            'title'         => $document->title,
            'content'       => $document->content ?? [],
            'content_html'  => $html,
            // Capture the tag set so a restore is a full revert, not content-only.
            // Read fresh (controllers sync tags *before* the snapshotting save) and
            // store names — they outlive tag id churn and rename/delete.
            'tags'          => $document->tags()->orderBy('name')->pluck('name')->all(),
            'created_by_id' => Auth::id(),
        ]);
    }

    /**
     * Render content JSON → HTML and cache it on the document row.
     * Returns the rendered HTML so updateSearchVector can reuse it.
     */
    protected function updateRenderedHtml(Document $document): string
    {
        if (! $document->wasChanged('content') && ! $document->wasRecentlyCreated) {
            return (string) $document->content_html;
        }

        $html = RenderDocument::toHtml($document->content);

        if ($html !== $document->content_html) {
            $document->content_html = $html;
            $document->saveQuietly();
        }

        return $html;
    }

    /**
     * Maintain the Postgres tsvector column for full-text search.
     * Title gets weight A, body text weight B — so title matches rank higher.
     */
    protected function updateSearchVector(Document $document, string $html): void
    {
        // Replace tags with a space rather than strip_tags(), which concatenates
        // adjacent block text ("...</p><p>..." → "...") and can fuse tokens across
        // element boundaries. Mirrors search:reindex's SQL so both indexing paths
        // produce the same vector.
        $bodyText = preg_replace('/<[^>]+>/', ' ', $html);

        DB::statement(
            "UPDATE documents
             SET search_vector =
                 setweight(to_tsvector('english', ?), 'A') ||
                 setweight(to_tsvector('english', ?), 'B')
             WHERE id = ?",
            [$document->title, $bodyText, $document->getKey()]
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
