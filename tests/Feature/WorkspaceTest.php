<?php

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

test('a workspace can be deleted', function () {
    login();
    $workspace = Workspace::factory()->create();

    $this->delete("/workspaces/{$workspace->id}")->assertRedirect('/workspaces');

    $this->assertDatabaseMissing('workspaces', ['id' => $workspace->id]);
});

test('the workspace show page returns the document tree', function () {
    login();
    $workspace = Workspace::factory()->create();

    $this->get("/workspaces/{$workspace->id}")->assertOk()->assertInertia(
        fn (Assert $page) => $page->component('Workspaces/Show')->has('tree')
    );
});
