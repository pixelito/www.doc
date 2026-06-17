<?php

use App\Models\Document;
use App\Models\Workspace;

test('children endpoint lists immediate children in order', function () {
    login();
    $workspace = Workspace::factory()->create();
    $parent = Document::factory()->create(['workspace_id' => $workspace->id]);
    Document::factory()->create(['workspace_id' => $workspace->id, 'parent_id' => $parent->id, 'position' => 1, 'title' => 'Second']);
    Document::factory()->create(['workspace_id' => $workspace->id, 'parent_id' => $parent->id, 'position' => 0, 'title' => 'First']);

    $this->getJson("/documents/{$parent->id}/children")
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.title', 'First')
        ->assertJsonPath('1.title', 'Second');
});

test('a node can be moved under a new parent', function () {
    login();
    $workspace = Workspace::factory()->create();
    $a = Document::factory()->create(['workspace_id' => $workspace->id]);
    $b = Document::factory()->create(['workspace_id' => $workspace->id]);

    $this->patch("/documents/{$b->id}/move", ['parent_id' => $a->id])->assertRedirect();

    expect($b->fresh()->parent_id)->toBe($a->id);
});

test('a node cannot be moved into its own descendant', function () {
    login();
    $workspace = Workspace::factory()->create();
    $parent = Document::factory()->create(['workspace_id' => $workspace->id]);
    $child = Document::factory()->create(['workspace_id' => $workspace->id, 'parent_id' => $parent->id]);

    $this->patch("/documents/{$parent->id}/move", ['parent_id' => $child->id])
        ->assertSessionHasErrors('parent_id');

    expect($parent->fresh()->parent_id)->toBeNull();
});

test('siblings can be reordered', function () {
    login();
    $workspace = Workspace::factory()->create();
    $first = Document::factory()->create(['workspace_id' => $workspace->id, 'position' => 0]);
    $second = Document::factory()->create(['workspace_id' => $workspace->id, 'position' => 1]);

    $this->patch('/documents/reorder', ['ids' => [$second->id, $first->id]])->assertRedirect();

    expect($second->fresh()->position)->toBe(0);
    expect($first->fresh()->position)->toBe(1);
});
