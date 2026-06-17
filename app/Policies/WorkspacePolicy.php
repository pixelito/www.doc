<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Workspace;

/**
 * v1 is everyone-admin: any authenticated user may do anything. Every action
 * still flows through this policy so Phase 6 role rules are an edit here, not a
 * hunt for scattered checks.
 */
class WorkspacePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Workspace $workspace): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Workspace $workspace): bool
    {
        return true;
    }

    public function delete(User $user, Workspace $workspace): bool
    {
        return true;
    }
}
