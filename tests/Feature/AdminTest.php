<?php

use App\Models\User;
use App\Support\Modules;
use App\Support\Settings;
use Inertia\Testing\AssertableInertia as Assert;

test('non-admins are forbidden from the admin area', function () {
    login(role: 'editor');

    $this->get('/admin/apps')->assertForbidden();
    $this->get('/admin/users')->assertForbidden();
});

test('admins can view the apps panel', function () {
    login();

    $this->get('/admin/apps')->assertInertia(
        fn (Assert $page) => $page->component('Admin/Apps')->has('modules')
    );
});

test('toggling a module persists an override and gates its routes', function () {
    login();
    expect(Modules::enabled('docs'))->toBeTrue();

    $this->patch('/admin/apps/docs', ['enabled' => false])->assertRedirect();

    expect(Settings::get('module.docs.enabled'))->toBeFalse();
    expect(Modules::enabled('docs'))->toBeFalse();
    // The override actually takes the docs routes offline.
    $this->get('/workspaces')->assertNotFound();

    // Re-enabling brings it back.
    $this->patch('/admin/apps/docs', ['enabled' => true])->assertRedirect();
    expect(Modules::enabled('docs'))->toBeTrue();
});

test('toggling an unknown module 404s', function () {
    login();

    $this->patch('/admin/apps/nope', ['enabled' => false])->assertNotFound();
});

test('an admin can create a user with a role', function () {
    login();

    $this->post('/admin/users', [
        'name' => 'Casey',
        'email' => 'casey@example.com',
        'password' => 'supersecret',
        'password_confirmation' => 'supersecret',
        'role' => 'editor',
    ])->assertRedirect();

    $user = User::firstWhere('email', 'casey@example.com');
    expect($user)->not->toBeNull();
    expect($user->hasRole('editor'))->toBeTrue();
});

test('an admin can change another user\'s role', function () {
    login();
    $other = login(role: 'viewer'); // creates a viewer and acts as them
    login(); // back to an admin actor

    $this->patch("/admin/users/{$other->id}", ['role' => 'editor'])->assertRedirect();

    expect($other->fresh()->hasRole('editor'))->toBeTrue();
    expect($other->fresh()->hasRole('viewer'))->toBeFalse();
});

test('the last admin cannot be demoted', function () {
    $admin = login(); // the only admin in the system

    $this->patch("/admin/users/{$admin->id}", ['role' => 'editor'])
        ->assertSessionHas('error');

    expect($admin->fresh()->hasRole('admin'))->toBeTrue();
});

test('an admin cannot delete their own account', function () {
    $admin = login();

    $this->delete("/admin/users/{$admin->id}")->assertSessionHas('error');

    expect(User::find($admin->id))->not->toBeNull();
});

test('the last admin cannot be deleted', function () {
    $admin = login();
    // A second non-admin user so the table isn't down to one row by accident.
    User::factory()->create();

    $this->delete("/admin/users/{$admin->id}")->assertSessionHas('error');

    expect(User::find($admin->id))->not->toBeNull();
});
