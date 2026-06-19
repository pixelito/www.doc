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
