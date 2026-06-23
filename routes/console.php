<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sweep unreferenced image uploads daily. The production stack runs this via its
// `scheduler` service (`php artisan schedule:work`); the dev stack has no
// scheduler, so run it by hand there: `php artisan assets:prune` (--dry-run to
// preview).
Schedule::command('assets:prune')->daily();
