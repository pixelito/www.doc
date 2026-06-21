<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Instance-level settings, edited from the admin panel. Each row is one setting;
 * the value is jsonb so booleans/strings/structured config all live in one table.
 * These OVERRIDE the config defaults (e.g. config/modules.php) at runtime — env
 * stays the install default, the DB is the live source once an admin changes it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->jsonb('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
