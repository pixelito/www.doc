<?php

use App\Support\Modules;
use Inertia\Testing\AssertableInertia as Assert;

test('docs routes are reachable while the module is enabled', function () {
    login();
    config(['modules.docs.enabled' => true]);

    $this->get('/workspaces')->assertOk();
});

test('disabling a module 404s its routes', function () {
    login();
    config(['modules.docs.enabled' => false]);

    // The route still exists; the module middleware makes it genuinely absent.
    $this->get('/workspaces')->assertNotFound();
    $this->get('/tags')->assertNotFound();
    $this->get('/search?q=anything')->assertNotFound();
});

test('shell routes stay available when every app module is off', function () {
    login();
    config(['modules.docs.enabled' => false]);

    // Dashboard, settings and logout live outside any module group.
    $this->get('/dashboard')->assertOk();
    $this->get('/settings/profile')->assertOk();
});

test('the modules helper reflects config', function () {
    config(['modules.docs.enabled' => false]);
    expect(Modules::enabled('docs'))->toBeFalse();

    config(['modules.docs.enabled' => true]);
    expect(Modules::enabled('docs'))->toBeTrue();

    // Unknown modules are off, never an error.
    expect(Modules::enabled('does-not-exist'))->toBeFalse();
});

test('shared module metadata carries the enabled flag and is safe to expose', function () {
    config(['modules.docs.enabled' => true, 'modules.tickets.enabled' => false]);

    $shared = collect(Modules::forSharing())->keyBy('key');

    expect($shared['docs']['enabled'])->toBeTrue();
    expect($shared['tickets']['enabled'])->toBeFalse();
    // forSharing exposes only display metadata — no raw config / secrets.
    expect(array_keys($shared['docs']))->toEqualCanonicalizing(
        ['key', 'name', 'description', 'icon', 'home', 'nav', 'quickLinks', 'enabled']
    );
});

test('the dashboard shares the module registry with the frontend', function () {
    login();
    // Two enabled apps so the launcher actually renders — a single-app install
    // auto-routes past it (covered separately below).
    config([
        'modules.docs.enabled'    => true,
        'modules.tickets.enabled' => true,
        'modules.tickets.home'    => '/tickets',
    ]);

    $this->get('/dashboard')->assertInertia(
        fn (Assert $page) => $page
            ->component('Dashboard')
            ->has('modules')
            ->where('modules.0.key', 'docs')
            ->where('modules.0.enabled', true)
    );
});

test('a single-app install skips the launcher and lands in the app', function () {
    login();
    // Default install: only Docs is enabled (and it has a home).
    config(['modules.docs.enabled' => true, 'modules.tickets.enabled' => false]);

    $this->get('/dashboard')->assertRedirect('/workspaces');
});

test('the launcher reappears once a second app is enabled', function () {
    login();
    config([
        'modules.docs.enabled'    => true,
        'modules.tickets.enabled' => true,
        'modules.tickets.home'    => '/tickets',
    ]);

    $this->get('/dashboard')->assertOk()->assertInertia(
        fn (Assert $page) => $page->component('Dashboard')
    );
});
