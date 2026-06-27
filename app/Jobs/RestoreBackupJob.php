<?php

namespace App\Jobs;

use App\Models\Backup;
use App\Services\Backup\RestoreService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Rebuilds the content model from a backup's canonical layer. Destructive and
 * heavy, so it runs on the queue. `restored_at` is tracked on the row's status
 * transitions (processing → restored | failed) for the admin UI.
 */
class RestoreBackupJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 600;

    public function __construct(public readonly int $backupId) {}

    public function handle(RestoreService $service): void
    {
        $backup = Backup::findOrFail($this->backupId);

        try {
            $service->restore($backup);
            $backup->update(['restore_status' => 'restored', 'restored_at' => now(), 'restore_error' => null]);
        } catch (Throwable $e) {
            $backup->update(['restore_status' => 'failed', 'restore_error' => $e->getMessage()]);
            report($e);
            throw $e;
        }
    }
}
