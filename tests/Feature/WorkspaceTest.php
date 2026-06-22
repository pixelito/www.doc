<?php

use App\Models\Document;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected away from workspaces', function () {
    $this->get('/workspaces')->assertRedirect('/login');
});

test('the workspaces index renders for an authenticated user', function () {
    login();
    Workspace::factory()->count(2)->create();

    $this->get('/workspaces')->assertOk()->assertInertia(
        fn (Assert $page) => $page
            ->component('Workspaces/Index')
            ->has('workspaces', 2)
    );
});

test('a workspace can be created and gets a slug', function () {
    login();

    $this->post('/workspaces', [
        'name' => 'Network Ops',
        'description' => 'Everything networking.',
    ])->assertRedirect();

    $workspace = Workspace::firstWhere('name', 'Network Ops');
    expect($workspace)->not->toBeNull();
    expect($workspace->slug)->toBe('network-ops');
});

test('workspace name is required', function () {
    login();

    $this->post('/workspaces', ['name' => ''])->assertSessionHasErrors('name');
});

test('a workspace can be updated', function () {
    login();
    $workspace = Workspace::factory()->create(['name' => 'Old']);

    $this->patch("/workspaces/{$workspace->id}", ['name' => 'New'])->assertRedirect();

    expect($workspace->fresh()->name)->toBe('New');
});

test('deleting a workspace soft-deletes it and its documents', function () {
    login();
    $workspace = Workspace::factory()->create();
    $document  = Document::factory()->create(['workspace_id' => $workspace->id]);

    $this->delete("/workspaces/{$workspace->id}")->assertRedirect('/workspaces');

    $this->assertSoftDeleted('workspaces', ['id' => $workspace->id]);
    $this->assertSoftDeleted('documents', ['id' => $document->id]);
});

test('a trashed workspace can be restored with its documents', function () {
    login();
    $workspace = Workspace::factory()->create();
    $document  = Document::factory()->create(['workspace_id' => $workspace->id]);
    $workspace->trashWithDocuments();

    $this->post("/trash/workspaces/{$workspace->id}/restore")->assertRedirect();

    expect(Workspace::find($workspace->id))->not->toBeNull();
    expect(Document::find($document->id))->not->toBeNull();
});

test('restoring a workspace leaves individually-trashed pages in the trash', function () {
    login();
    $workspace = Workspace::factory()->create();
    $kept      = Document::factory()->create(['workspace_id' => $workspace->id]);
    $alreadyGone = Document::factory()->create(['workspace_id' => $workspace->id]);

    // A page the user trashed on its own, before the whole workspace went away.
    $alreadyGone->trashSubtree();
    $workspace->trashWithDocuments();

    $this->post("/trash/workspaces/{$workspace->id}/restore")->assertRedirect();

    expect(Document::find($kept->id))->not->toBeNull();
    $this->assertSoftDeleted('documents', ['id' => $alreadyGone->id]);
});

test('force-deleting a trashed workspace destroys it and its documents', function () {
    login();
    $workspace = Workspace::factory()->create();
    $document  = Document::factory()->create(['workspace_id' => $workspace->id]);
    $workspace->trashWithDocuments();

    $this->delete("/trash/workspaces/{$workspace->id}")->assertRedirect();

    $this->assertDatabaseMissing('workspaces', ['id' => $workspace->id]);
    $this->assertDatabaseMissing('documents', ['id' => $document->id]);
});

test('the workspace show page returns the document tree', function () {
    login();
    $workspace = Workspace::factory()->create();

    $this->get("/workspaces/{$workspace->id}")->assertOk()->assertInertia(
        fn (Assert $page) => $page->component('Workspaces/Show')->has('tree')
    );
});
