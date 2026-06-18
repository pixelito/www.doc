<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        // Create roles (idempotent — skip if already exist)
        foreach (['admin', 'editor', 'viewer'] as $name) {
            Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // Assign admin to every existing user (v1 everyone-admin default)
        User::all()->each(fn (User $u) => $u->syncRoles(['admin']));
    }
}
