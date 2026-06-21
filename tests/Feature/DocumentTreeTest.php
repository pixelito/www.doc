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

test('a move can re-parent and order the destination siblings in one request', function () {
    login();
    $workspace = Workspace::factory()->create();
    $newParent = Document::factory()->create(['workspace_id' => $workspace->id]);
    // Two pages already nested under the destination parent.
    $existingA = Document::factory()->create(['workspace_id' => $workspace->id, 'parent_id' => $newParent->id, 'position' => 0]);
    $existingB = Document::factory()->create(['workspace_id' => $workspace->id, 'parent_id' => $newParent->id, 'position' => 1]);
    // A root page being dragged in to become the middle child.
    $dragged = Document::factory()->create(['workspace_id' => $workspace->id, 'position' => 0]);

    $this->patch("/documents/{$dragged->id}/move", [
        'parent_id' => $newParent->id,
        'order' => [$existingA->id, $dragged->id, $existingB->id],
    ])->assertRedirect();

    expect($dragged->fresh()->parent_id)->toBe($newParent->id);
    // Positions follow the given order exactly.
    expect($existingA->fresh()->position)->toBe(0);
    expect($dragged->fresh()->position)->toBe(1);
    expect($existingB->fresh()->position)->toBe(2);
});

test('moving a page to another workspace carries its subtree along', function () {
    login();
    $from = Workspace::factory()->create();
    $to = Workspace::factory()->create();

    $parent = Document::factory()->create(['workspace_id' => $from->id]);
    $child = Document::factory()->create(['workspace_id' => $from->id, 'parent_id' => $parent->id]);
    $grandchild = Document::factory()->create(['workspace_id' => $from->id, 'parent_id' => $child->id]);

    $this->patch("/documents/{$parent->id}/move", ['workspace_id' => $to->id, 'parent_id' => null])
        ->assertRedirect();

    // The moved page sits at the new workspace root, and the whole subtree follows.
    expect($parent->fresh()->workspace_id)->toBe($to->id);
    expect($parent->fresh()->parent_id)->toBeNull();
    expect($child->fresh()->workspace_id)->toBe($to->id);
    expect($grandchild->fresh()->workspace_id)->toBe($to->id);
    // Nesting within the subtree is preserved.
    expect($child->fresh()->parent_id)->toBe($parent->id);
});

test('the update endpoint will not re-parent a document', function () {
    login();
    $workspace = Workspace::factory()->create();
    $a = Document::factory()->create(['workspace_id' => $workspace->id]);
    $b = Document::factory()->create(['workspace_id' => $workspace->id]);

    // parent_id is silently ignored on a plain update — re-parenting is move()'s
    // job (the only path with a cycle guard). The title still updates.
    $this->patch("/documents/{$b->id}", ['parent_id' => $a->id, 'title' => 'Renamed'])
        ->assertRedirect();

    expect($b->fresh()->parent_id)->toBeNull()
        ->and($b->fresh()->title)->toBe('Renamed');
});

test('ancestors() terminates on cyclic data instead of looping forever', function () {
    login();
    $workspace = Workspace::factory()->create();
    $a = Document::factory()->create(['workspace_id' => $workspace->id]);
    $b = Document::factory()->create(['workspace_id' => $workspace->id]);

    // Force a corrupt A<->B cycle straight in the DB, bypassing the guards.
    Document::withoutTimestamps(function () use ($a, $b) {
        Document::whereKey($a->id)->update(['parent_id' => $b->id]);
        Document::whereKey($b->id)->update(['parent_id' => $a->id]);
    });

    // The visited-set bound means this returns quickly rather than hanging.
    $chain = $a->fresh()->ancestors();

    expect($chain)->toBeArray()
        ->and(count($chain))->toBeLessThanOrEqual(2);
});

test('a move only repositions actual children of the new parent', function () {
    login();
    $workspace = Workspace::factory()->create();
    $parent = Document::factory()->create(['workspace_id' => $workspace->id]);
    $child = Document::factory()->create(['workspace_id' => $workspace->id, 'parent_id' => $parent->id, 'position' => 0]);
    $dragged = Document::factory()->create(['workspace_id' => $workspace->id]);
    // An unrelated root page whose id is smuggled into the order array.
    $unrelated = Document::factory()->create(['workspace_id' => $workspace->id, 'position' => 5]);

    $this->patch("/documents/{$dragged->id}/move", [
        'parent_id' => $parent->id,
        'order' => [$child->id, $dragged->id, $unrelated->id],
    ])->assertRedirect();

    expect($dragged->fresh()->parent_id)->toBe($parent->id);
    expect($child->fresh()->position)->toBe(0);
    expect($dragged->fresh()->position)->toBe(1);
    // The unrelated page is NOT a child of $parent, so its position is untouched.
    expect($unrelated->fresh()->position)->toBe(5);
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
