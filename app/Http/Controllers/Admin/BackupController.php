<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RestoreBackupJob;
use App\Jobs\RunBackupJob;
use App\Models\Backup;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Admin-only Backups tab: configure the cadence, run a backup now, and
 * download / restore / delete archives. Heavy work is queued (RunBackupJob /
 * RestoreBackupJob); the page polls `show` for in-flight status.
 */
class BackupController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', Backup::class);

        $backups = Backup::with('creator:id,name')
            ->latest('id')
            ->get()
            ->map(fn (Backup $b) => [
                'id'          => $b->id,
                'status'      => $b->status,
                'trigger'     => $b->trigger,
                'disk'        => $b->disk,
                'size_bytes'  => $b->size_bytes,
                'error'       => $b->error,
                'created_at'  => $b->created_at,
                'finished_at' => $b->finished_at,
                'created_by'  => $b->creator?->name,
                'counts'      => $b->manifest['counts'] ?? null,
            ]);

        return Inertia::render('Settings/Backups', [
            'backups'   => $backups,
            'settings'  => Setting::get('backup', config('backup.defaults')),
            'intervals' => array_keys(config('backup.intervals')),
            'disks'     => config('backup.disks'),
        ]);
    }

    /** Save the backup cadence / destination / retention. */
    public function updateSettings(Request $request): RedirectResponse
    {
        $this->authorize('create', Backup::class);

        $validated = $request->validate([
            'enabled'   => ['required', 'boolean'],
            'interval'  => ['required', Rule::in(array_keys(config('backup.intervals')))],
            'disk'      => ['required', Rule::in(config('backup.disks'))],
            'retention' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        Setting::put('backup', $validated);

        return back()->with('success', 'Backup settings saved.');
    }

    /** Kick off a manual backup now. */
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', Backup::class);

        $settings = Setting::get('backup', config('backup.defaults'));

        $backup = Backup::create([
            'trigger'       => 'manual',
            'disk'          => $settings['disk'] ?? 'local',
            'status'        => 'pending',
            'created_by_id' => $request->user()->id,
        ]);

        RunBackupJob::dispatch($backup->id);

        return back()->with('success', 'Backup started.');
    }

    /** Poll a single backup's status (for the in-progress spinner). */
    public function show(Backup $backup): JsonResponse
    {
        $this->authorize('view', $backup);

        return response()->json([
            'id'     => $backup->id,
            'status' => $backup->status,
            'error'  => $backup->error,
        ]);
    }

    public function download(Backup $backup): StreamedResponse
    {
        $this->authorize('view', $backup);

        abort_unless($backup->status === 'done' && $backup->path, 404);

        return \Illuminate\Support\Facades\Storage::disk($backup->disk)
            ->download($backup->path, basename($backup->path));
    }

    public function restore(Backup $backup): RedirectResponse
    {
        $this->authorize('restore', $backup);

        RestoreBackupJob::dispatch($backup->id);

        return back()->with('success', 'Restore started — the content model is being rebuilt from this backup.');
    }

    public function destroy(Backup $backup): RedirectResponse
    {
        $this->authorize('delete', $backup);

        if ($backup->path) {
            \Illuminate\Support\Facades\Storage::disk($backup->disk)->delete($backup->path);
        }
        $backup->delete();

        return back()->with('success', 'Backup deleted.');
    }
}
