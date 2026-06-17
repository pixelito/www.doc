<?php

use App\Models\Document;
use App\Models\Workspace;
use Database\Factories\DocumentFactory;
use Inertia\Testing\AssertableInertia as Assert;

test('a document can be created under a workspace', function () {
    login();
    $workspace = Workspace::factory()->create();

    $this->post('/documents', [
        'title' => 'VPN Runbook',
        'workspace_id' => $workspace->id,
        'content' => DocumentFactory::tiptap('Hello world.'),
    ])->assertRedirect();

    $document = Document::firstWhere('title', 'VPN Runbook');
    expect($document)->not->toBeNull();
    expect($document->slug)->toBe('vpn-runbook');
    expect($document->workspace_id)->toBe($workspace->id);
});

test('creating a document records authorship and an initial version', function () {
    $user = login();
    $workspace = Workspace::factory()->create();

    $this->post('/documents', [
        'title' => 'Audited Page',
        'workspace_id' => $workspace->id,
    ]);

    $document = Document::firstWhere('title', 'Audited Page');
    expect($document->created_by_id)->toBe($user->id);
    expect($document->versions()->count())->toBe(1);
});

test('editing content snapshots a new version', function () {
    login();
    $document = Document::factory()->create();

    expect($document->versions()->count())->toBe(1);

    $this->patch("/documents/{$document->id}", [
        'content' => DocumentFactory::tiptap('Revised body.'),
    ])->assertRedirect();

    expect($document->fresh()->versions()->count())->toBe(2);
});

test('changing only position does not snapshot a version', function () {
    login();
    $document = Document::factory()->create();

    $this->patch("/documents/{$document->id}", ['position' => 5])->assertRedirect();

    expect($document->fresh()->position)->toBe(5);
    expect($document->versions()->count())->toBe(1);
});

test('the document show page renders the read view', function () {
    login();
    $document = Document::factory()->create();

    $this->get("/documents/{$document->id}")->assertOk()->assertInertia(
        fn (Assert $page) => $page
            ->component('Documents/Show')
            ->where('document.id', $document->id)
            ->has('versionsCount')
    );
});

test('a document can be deleted', function () {
    login();
    $document = Document::factory()->create();

    $this->delete("/documents/{$document->id}")->assertRedirect();

    $this->assertDatabaseMissing('documents', ['id' => $document->id]);
});

test('document title is required on create', function () {
    login();
    $workspace = Workspace::factory()->create();

    $this->post('/documents', ['workspace_id' => $workspace->id, 'title' => ''])
        ->assertSessionHasErrors('title');
});

test('wiki-links resolve to targets and produce backlinks', function () {
    login();
    $workspace = Workspace::factory()->create();
    $target = Document::factory()->create(['workspace_id' => $workspace->id, 'title' => 'Firewall']);

    $source = Document::factory()->create([
        'workspace_id' => $workspace->id,
        'title' => 'Edge',
        'content' => DocumentFactory::tiptap('Configured per [[Firewall]] and [[Ghost Page]].'),
    ]);

    expect($source->outgoingLinks()->count())->toBe(2);
    expect($target->backlinks()->count())->toBe(1);
    expect($target->backlinks()->first()->source_document_id)->toBe($source->id);

    // The unresolved link is retained with a null target.
    expect($source->outgoingLinks()->whereNull('target_document_id')->count())->toBe(1);
});
