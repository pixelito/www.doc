<?php

return [

    /*
    |--------------------------------------------------------------------------
    | App modules
    |--------------------------------------------------------------------------
    |
    | Each top-level "app" is a module that can be turned on or off via env.
    | Disabling a module 404s its routes and hides it from the dashboard and
    | nav — the code stays in place, dormant. This is the lightweight seam that
    | lets a self-hosted install run only the apps it wants (see the Modules
    | helper and the `module:<key>` route middleware).
    |
    | Keys per module:
    |   enabled     – bool, usually from env so installs can flip it
    |   name        – display name (dashboard tile + nav)
    |   description – one-line summary for the dashboard tile
    |   icon        – string key mapped to a Tabler icon on the frontend
    |   home        – path the tile links to (null while not built yet)
    |   nav         – top-bar links contributed by this module
    |
    */

    'docs' => [
        'enabled'     => (bool) env('MODULE_DOCS', true),
        'name'        => 'Docs',
        'description' => 'Internal knowledge base and documentation hub.',
        'icon'        => 'books',
        'home'        => '/workspaces',
        'nav'         => [
            ['label' => 'Workspaces', 'href' => '/workspaces', 'icon' => 'layout-grid'],
            ['label' => 'Tags',       'href' => '/tags',       'icon' => 'tag'],
        ],
    ],

    'tickets' => [
        'enabled'     => (bool) env('MODULE_TICKETS', false),
        'name'        => 'Tickets',
        'description' => 'Track issues and requests across the team.',
        'icon'        => 'ticket',
        'home'        => null,
        'nav'         => [],
    ],

];
