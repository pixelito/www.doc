<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Persist a reordering in ONE statement instead of an UPDATE per row.
 *
 * Reordering is a structural change, so these writes deliberately do NOT touch
 * `updated_at` — a raw UPDATE leaves timestamps alone (unlike Eloquent saves).
 * Values arrive as bound placeholders (untyped → text in Postgres), so each
 * column is cast back to its real type in the join.
 *
 * `$table` is always a hardcoded literal at the call sites — never user input.
 */
class BulkReorder
{
    /** Assign position = list index to each id, in their given order. */
    public static function positions(string $table, array $idsInOrder): void
    {
        $rows = [];
        $bindings = [];
        foreach (array_values($idsInOrder) as $position => $id) {
            $rows[] = '(?, ?)';
            $bindings[] = $id;
            $bindings[] = $position;
        }

        if (! $rows) {
            return;
        }

        DB::update(
            "UPDATE {$table} AS t SET position = v.position::int "
            .'FROM (VALUES '.implode(',', $rows).') AS v(id, position) '
            .'WHERE t.id = v.id::bigint',
            $bindings,
        );
    }

    /**
     * Set parent_id + position for each node in one statement.
     * Each node is ['id' => int, 'parent_id' => ?int, 'position' => int].
     */
    public static function tree(string $table, array $nodes): void
    {
        $rows = [];
        $bindings = [];
        foreach ($nodes as $node) {
            $rows[] = '(?, ?, ?)';
            $bindings[] = $node['id'];
            $bindings[] = $node['parent_id'] ?? null;
            $bindings[] = $node['position'];
        }

        if (! $rows) {
            return;
        }

        DB::update(
            "UPDATE {$table} AS t SET parent_id = v.parent_id::bigint, position = v.position::int "
            .'FROM (VALUES '.implode(',', $rows).') AS v(id, parent_id, position) '
            .'WHERE t.id = v.id::bigint',
            $bindings,
        );
    }
}
