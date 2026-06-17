<?php

use App\Models\Document;
use App\Models\Tag;
use App\Models\Workspace;

// v1 is everyone-admin, but every route is still gated by auth + policies. The
// boundary that exists today is guest vs. authenticated; Phase 6 will tighten
// the policy bodies without touching controllers.

test('guests cannot reach any resource route', function (string $method, string $uri) {
    $this->call($method, $uri)->assertRedirect('/login');
})->with([
    ['get', '/workspaces'],
    ['post', '/workspaces'],
    ['get', '/tags'],
    ['post', '/documents'],
    ['patch', '/documents/reorder'],
]);

test('an authenticated user passes the policy for each resource', function () {
    login();
    $workspace = Workspace::factory()->create();
    $document = Document::factory()->create(['workspace_id' => $workspace->id]);
    $tag = Tag::factory()->create();

    $this->get('/workspaces')->assertOk();
    $this->get("/workspaces/{$workspace->id}")->assertOk();
    $this->get("/documents/{$document->id}")->assertOk();
    $this->get('/tags')->assertOk();
});
