<?php

namespace App\Policies;

use App\Models\Tag;
use App\Models\User;

/**
 * v1 everyone-admin — see {@see WorkspacePolicy} for the rationale.
 */
class TagPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Tag $tag): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Tag $tag): bool
    {
        return true;
    }

    public function delete(User $user, Tag $tag): bool
    {
        return true;
    }
}
