<?php

namespace App\Policies;

use App\Models\ConversionJob;
use App\Models\User;

class ConversionJobPolicy
{
    public function create(User $user): bool { return true; }
    public function view(User $user, ConversionJob $job): bool { return true; }
}
