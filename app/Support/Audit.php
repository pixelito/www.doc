<?php

namespace App\Support;

use App\Models\AuditEvent;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Single entry point for the append-only audit trail. Call from controllers,
 * observers, commands, and jobs — never write AuditEvent rows directly.
 *
 * Event names are dot-namespaced `subject.action` (document.updated,
 * backup.restored, auth.login). Keep the namespace stable: the admin UI
 * filters on the prefix, and future features (ACLs) will add their own.
 */
class Audit
{
    /**
     * @param  Model|null  $subject  What the event is about; captured as a loose
     *                               morph so the row outlives purges.
     * @param  array  $context  Human-readable snapshot (titles, old/new values).
     * @param  int|null  $actorId  Override for queue/console contexts where
     *                             Auth::id() is empty (jobs carry created_by).
     */
    public static function record(string $event, ?Model $subject = null, array $context = [], ?int $actorId = null): AuditEvent
    {
        return AuditEvent::create([
            'user_id'        => $actorId ?? Auth::id(),
            'event'          => $event,
            'auditable_type' => $subject?->getMorphClass(),
            'auditable_id'   => $subject?->getKey(),
            'workspace_id'   => self::workspaceId($subject),
            'context'        => $context ?: null,
            'ip'             => app()->runningInConsole() ? null : request()->ip(),
            'created_at'     => now(),
        ]);
    }

    /** Derive the workspace an event belongs to, for the admin UI's filter. */
    private static function workspaceId(?Model $subject): ?int
    {
        if ($subject instanceof Workspace) {
            return $subject->getKey();
        }

        return $subject?->getAttribute('workspace_id');
    }
}
