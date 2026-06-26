<?php

namespace App\Jobs;

use App\Models\Backup;
use App\Services\Backup\BackupNotifier;
use App\Services\Backup\BackupService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Builds a backup archive off the web request (mirrors ExportDocumentJob).
 * The `backups` row is the progress record the admin UI polls.
 */
class RunBackupJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 600;

    public function __construct(public readonly int $backupId) {}

    public function handle(BackupService $service, BackupNotifier $notifier): void
    {
        $backup = Backup::findOrFail($this->backupId);
        $backup->update(['status' => 'processing', 'started_at' => now()]);

        try {
            $service->run($backup);
            $notifier->notify($backup->refresh());
        } catch (Throwable $e) {
            $backup->update(['status' => 'failed', 'error' => $e->getMessage(), 'finished_at' => now()]);
            $notifier->notify($backup->refresh());
            throw $e;
        }
    }
}
