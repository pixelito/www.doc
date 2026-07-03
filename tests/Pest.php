<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)->in('Unit');

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

/**
 * Create and authenticate a user, returning it. Mirrors the v1 "everyone-admin"
 * default so policy-gated routes are reachable; pass $role to test a narrower
 * role. Roles are created on demand since RefreshDatabase doesn't seed them.
 */
function login(?\App\Models\User $user = null, string $role = 'admin'): \App\Models\User
{
    foreach (['admin', 'editor', 'viewer'] as $name) {
        \Spatie\Permission\Models\Role::findOrCreate($name, 'web');
    }

    $user ??= \App\Models\User::factory()->create();
    $user->assignRole($role);
    test()->actingAs($user);

    return $user;
}

/**
 * Every persisted node/mark in the schema, in a single document. THE canonical
 * schema fixture: SchemaParityTest asserts each piece survives the JSON→HTML
 * render, and DocumentDiffTest asserts the differ understands every node — so
 * a new editor node added here (mandatory per the add-editor-node skill) fails
 * loudly in whichever half was forgotten.
 */
function fixtureDoc(): array
{
    return ['type' => 'doc', 'content' => [
        ['type' => 'heading', 'attrs' => ['level' => 2, 'textAlign' => 'center'], 'content' => [
            ['type' => 'text', 'text' => 'Heading Centered'],
        ]],
        ['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'marks' => [['type' => 'bold']], 'text' => 'bold '],
            ['type' => 'text', 'marks' => [['type' => 'italic']], 'text' => 'italic '],
            ['type' => 'text', 'marks' => [['type' => 'strike']], 'text' => 'strike '],
            ['type' => 'text', 'marks' => [['type' => 'code']], 'text' => 'code '],
            ['type' => 'text', 'marks' => [['type' => 'underline']], 'text' => 'under '],
            ['type' => 'text', 'marks' => [['type' => 'textStyle', 'attrs' => ['color' => '#ff0000']]], 'text' => 'red '],
            ['type' => 'text', 'marks' => [['type' => 'highlight', 'attrs' => ['color' => '#ffff00']]], 'text' => 'hl '],
            ['type' => 'text', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'https://example.com']]], 'text' => 'link'],
        ]],
        ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'bullet']]],
        ]]]],
        ['type' => 'orderedList', 'content' => [['type' => 'listItem', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'numbered']]],
        ]]]],
        ['type' => 'blockquote', 'content' => [['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => 'quoted'],
        ]]]],
        ['type' => 'codeBlock', 'content' => [['type' => 'text', 'text' => 'echo 1;']]],
        ['type' => 'horizontalRule'],
        ['type' => 'image', 'attrs' => ['src' => '/storage/assets/x.png', 'alt' => 'pic', 'width' => 200, 'align' => 'center']],
        ['type' => 'wikiLink', 'attrs' => ['title' => 'Other Page', 'target_id' => 7]],
        ['type' => 'table', 'content' => [['type' => 'tableRow', 'content' => [
            ['type' => 'tableHeader', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Head']]]]],
            ['type' => 'tableCell', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Cell']]]]],
        ]]]],
        ['type' => 'networkDiagram', 'attrs' => ['name' => 'My Net', 'graph' => [
            'nodes' => [['id' => 'n1', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'router']]],
            'edges' => [],
        ]]],
    ]];
}
