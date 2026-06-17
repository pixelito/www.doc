<?php

namespace App\Observers;

use App\Models\Document;
use App\Models\Link;
use App\Services\RenderDocument;
use App\Support\TipTap;
use Illuminate\Support\Facades\Auth;

class DocumentObserver
{
    /** Stamp authorship before the row is written. */
    public function saving(Document $document): void
    {
        $userId = Auth::id();

        if (! $document->exists && $userId && ! $document->created_by_id) {
            $document->created_by_id = $userId;
        }

        if ($userId) {
            $document->updated_by_id = $userId;
        }
    }

    public function saved(Document $document): void
    {
        // Only snapshot/re-link when the content actually changed — tree
        // operations (move, reorder) touch position only and shouldn't spam
        // the version history or rebuild links.
        $contentChanged = $document->wasRecentlyCreated
            || $document->wasChanged('content')
            || $document->wasChanged('title');

        if (! $contentChanged) {
            return;
        }

        $this->snapshotVersion($document);
        $this->syncLinks($document);
        $this->updateRenderedHtml($document);
    }

    /** Snapshot every save into the version history (never destructive). */
    protected function snapshotVersion(Document $document): void
    {
        $document->versions()->create([
            'title' => $document->title,
            'content' => $document->content ?? [],
            'content_html' => $document->content_html,
            'created_by_id' => Auth::id(),
        ]);
    }

    /** Render content JSON → HTML and cache it on the document row. */
    protected function updateRenderedHtml(Document $document): void
    {
        if (! $document->wasChanged('content') && ! $document->wasRecentlyCreated) {
            return;
        }

        $html = RenderDocument::toHtml($document->content);

        if ($html !== $document->content_html) {
            $document->content_html = $html;
            $document->saveQuietly();
        }
    }

    /**
     * Rebuild this document's outgoing links from its [[Wiki-link]] references.
     * Targets are resolved by title (preferring the same workspace); unresolved
     * links are kept with a null target so backlinks appear once the page exists.
     */
    protected function syncLinks(Document $document): void
    {
        $titles = TipTap::wikiLinkTitles($document->content);

        $document->outgoingLinks()->delete();

        foreach ($titles as $title) {
            $target = Document::query()
                ->where('title', $title)
                ->whereKeyNot($document->getKey())
                ->orderByRaw('(workspace_id = ?) desc', [$document->workspace_id])
                ->first();

            Link::create([
                'source_document_id' => $document->getKey(),
                'target_document_id' => $target?->getKey(),
                'target_title' => $title,
            ]);
        }
    }
}
