<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $admin = User::factory()->create([
            'name'     => 'Admin',
            'email'    => 'admin@example.com',
            'password' => bcrypt('password'),
        ]);

        // Log the admin user in for authorship observation if needed
        auth()->login($admin);

        $this->call([
            RoleSeeder::class,
            WorkspaceSeeder::class,
        ]);
    }
}
