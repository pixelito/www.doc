<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sweep unreferenced image uploads daily. Both stacks run this via their
// `scheduler` service (`php artisan schedule:work`); it's also safe to run by
// hand: `php artisan assets:prune` (--dry-run to preview).
Schedule::command('assets:prune')->daily();
