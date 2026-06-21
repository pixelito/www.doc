<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Runtime instance settings, edited from the admin panel and persisted in the
 * `settings` table. These OVERRIDE config defaults (e.g. config/modules.php) —
 * env is the install default, the DB is the live source once an admin changes it.
 *
 * The whole table is small, so it's cached as one array and busted on every write.
 */
class Settings
{
    protected const CACHE_KEY = 'settings:all';

    /** Read a setting, falling back to $default when it has never been set. */
    public static function get(string $key, mixed $default = null): mixed
    {
        $all = self::all();

        return array_key_exists($key, $all) ? $all[$key] : $default;
    }

    /** Upsert a setting and bust the cache. */
    public static function set(string $key, mixed $value): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => $key],
            ['value' => json_encode($value), 'updated_at' => now()],
        );

        Cache::forget(self::CACHE_KEY);
    }

    /** Drop a setting (reverting it to the config default) and bust the cache. */
    public static function forget(string $key): void
    {
        DB::table('settings')->where('key', $key)->delete();

        Cache::forget(self::CACHE_KEY);
    }

    /** All settings as a decoded key => value map, cached until the next write. */
    public static function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => DB::table('settings')
            ->pluck('value', 'key')
            ->map(fn ($value) => json_decode($value, true))
            ->all());
    }
}
