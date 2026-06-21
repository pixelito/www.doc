<?php

use App\Models\Document;
use App\Models\Workspace;
use App\Services\RenderDocument;
use Database\Factories\DocumentFactory;

/**
 * Guards the version-snapshot bug we fixed: each snapshot must store the HTML of
 * its OWN content, rendered before the snapshot is taken — never the stale html
 * left over from the previous save (which made the oldest version come out empty).
 */
test("each version's content_html matches its own content", function () {
    login();
    $workspace = Workspace::factory()->create();

    $this->post('/documents', [
        'title' => 'Runbook',
        'workspace_id' => $workspace->id,
        'content' => DocumentFactory::tiptap('Alpha body.'),
    ]);
    $document = Document::firstWhere('title', 'Runbook');

    $this->patch("/documents/{$document->id}", [
        'content' => DocumentFactory::tiptap('Bravo body.'),
    ]);

    $versions = $document->fresh()->versions()->orderBy('id')->get();
    expect($versions)->toHaveCount(2);

    // Every snapshot's cached html is a faithful render of that snapshot's content.
    foreach ($versions as $version) {
        expect($version->content_html)->toBe(RenderDocument::toHtml($version->content));
    }

    // And the oldest snapshot is its own content, not the next save bleeding back in.
    expect($versions->first()->content_html)
        ->toContain('Alpha body.')
        ->not->toContain('Bravo body.');
    expect($versions->last()->content_html)->toContain('Bravo body.');
});

test('the first snapshot is not empty when a page is created with content', function () {
    login();
    $workspace = Workspace::factory()->create();

    $this->post('/documents', [
        'title' => 'Has Content',
        'workspace_id' => $workspace->id,
        'content' => DocumentFactory::tiptap('Real content from the start.'),
    ]);

    $first = Document::firstWhere('title', 'Has Content')->versions()->orderBy('id')->first();

    expect($first)->not->toBeNull();
    expect($first->content_html)->toContain('Real content from the start.');
});
