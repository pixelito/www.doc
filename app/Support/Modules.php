<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Lightweight registry for the app modules defined in config/modules.php.
 *
 * Modules are the top-level "apps" (Docs, and future ones like Tickets). This
 * helper is the single source of truth for which are enabled — consulted by the
 * `module:<key>` route middleware, the dashboard, and the nav.
 */
class Modules
{
    /** All configured modules, keyed by slug, each including its 'key'. */
    public static function all(): Collection
    {
        return collect(config('modules', []))
            ->map(fn (array $module, string $key) => ['key' => $key] + $module);
    }

    /** Whether a given module is enabled. */
    public static function enabled(string $key): bool
    {
        return (bool) config("modules.{$key}.enabled", false);
    }

    /**
     * Public metadata shared with the frontend (no secrets here) — drives the
     * dashboard tiles and the registry-sourced nav.
     */
    public static function forSharing(): array
    {
        return self::all()
            ->map(fn (array $m) => [
                'key'         => $m['key'],
                'name'        => $m['name'] ?? $m['key'],
                'description' => $m['description'] ?? '',
                'icon'        => $m['icon'] ?? null,
                'home'        => $m['home'] ?? null,
                'nav'         => array_values($m['nav'] ?? []),
                'quickLinks'  => array_values($m['quickLinks'] ?? []),
                'enabled'     => (bool) ($m['enabled'] ?? false),
            ])
            ->values()
            ->all();
    }
}
