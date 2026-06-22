<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sweep unreferenced image uploads daily. Runs only where a scheduler is active
// (`php artisan schedule:work`, or cron calling `schedule:run`); it's also safe
// to run by hand: `php artisan assets:prune` (add --dry-run to preview).
Schedule::command('assets:prune')->daily();
