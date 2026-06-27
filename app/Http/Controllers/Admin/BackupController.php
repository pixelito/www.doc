<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\RestoreBackupJob;
use App\Jobs\RunBackupJob;
use App\Models\Backup;
use App\Models\Setting;
use App\Services\Backup\BackupNotifier;
use App\Services\Backup\Destinations\DestinationFactory;
use App\Support\BackupSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Admin-only Backups tab: configure the cadence + destination (private disk or
 * SMB share) + email notifications, run a backup now, and download / restore /
 * delete archives. Heavy work is queued (RunBackupJob / RestoreBackupJob); the
 * page polls for in-flight status.
 *
 * Secrets (SMB + SMTP passwords) live ENCRYPTED in the `backup` setting blob and
 * are never sent to the frontend — see BackupSettings::forDisplay().
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
                'encrypted'   => $b->manifest['encryption']['enabled'] ?? false,
            ]);

        return Inertia::render('Settings/Backups', [
            'backups'   => $backups,
            'settings'  => BackupSettings::forDisplay(),
            'intervals' => array_keys(config('backup.intervals')),
            'drivers'   => config('backup.drivers'),
        ]);
    }

    /** Save the backup cadence / destination / mail settings (passwords preserved). */
    public function updateSettings(Request $request): RedirectResponse
    {
        $this->authorize('create', Backup::class);

        $validated = $request->validate([
            'enabled'   => ['required', 'boolean'],
            'interval'  => ['required', Rule::in(array_keys(config('backup.intervals')))],
            'retention' => ['required', 'integer', 'min:1', 'max:365'],
            'driver'    => ['required', Rule::in(config('backup.drivers'))],

            // Encrypt archives at rest — only allowed once a key exists in env.
            'encryption' => ['required', 'boolean', function ($attr, $value, $fail) {
                if ($value && ! \App\Services\Backup\ArchiveCipher::configured()) {
                    $fail('Set BACKUP_ENCRYPTION_KEY before enabling archive encryption.');
                }
            }],

            // host + share are required only when SMB is the chosen driver.
            'smb.host'     => [Rule::requiredIf(fn () => $request->input('driver') === 'smb'), 'nullable', 'string', 'max:255'],
            'smb.share'    => [Rule::requiredIf(fn () => $request->input('driver') === 'smb'), 'nullable', 'string', 'max:255'],
            'smb.path'     => ['nullable', 'string', 'max:1024'],
            'smb.username' => ['nullable', 'string', 'max:255'],
            'smb.password' => ['nullable', 'string', 'max:1024'],
            'smb.domain'   => ['nullable', 'string', 'max:255'],

            'mail.enabled'      => ['required', 'boolean'],
            'mail.to'           => ['nullable', 'email', 'max:255'],
            'mail.host'         => ['nullable', 'string', 'max:255'],
            'mail.port'         => ['nullable', 'integer', 'min:1', 'max:65535'],
            'mail.username'     => ['nullable', 'string', 'max:255'],
            'mail.password'     => ['nullable', 'string', 'max:1024'],
            'mail.encryption'   => ['required', Rule::in(['tls', 'ssl', 'none'])],
            'mail.from_address' => ['nullable', 'email', 'max:255'],
            'mail.from_name'    => ['nullable', 'string', 'max:255'],
        ]);

        $this->assertMailAuthPaired($request);

        Setting::put('backup', $this->mergeSettings($validated));

        return back()->with('success', 'Backup settings saved.');
    }

    /** Dismiss a backup's in-app notice banner. */
    public function acknowledge(Backup $backup): RedirectResponse
    {
        $this->authorize('view', $backup);

        $backup->update(['acknowledged_at' => now()]);

        return back();
    }

    /** Kick off a manual backup now. */
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', Backup::class);

        $backup = Backup::create([
            'trigger'       => 'manual',
            'disk'          => BackupSettings::get()['driver'] ?? 'local',
            'status'        => 'pending',
            'created_by_id' => $request->user()->id,
        ]);

        RunBackupJob::dispatch($backup->id);

        // No flash: the in-progress modal signals the start, and the page toasts
        // once on completion. A "started" flash here would double up.
        return back();
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

    public function download(Backup $backup): BinaryFileResponse
    {
        $this->authorize('view', $backup);

        abort_unless($backup->status === 'done' && $backup->path, 404);

        // Pull from wherever it lives (local disk or SMB share) to a temp file
        // and stream that, cleaning it up after send.
        $temp = DestinationFactory::make($backup->disk)->fetch($backup->path);

        return response()->download($temp, basename($backup->path))->deleteFileAfterSend();
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
            DestinationFactory::make($backup->disk)->delete($backup->path);
        }
        $backup->delete();

        return back()->with('success', 'Backup deleted.');
    }

    /** Verify the configured destination is reachable and writable (probe file). */
    public function testDestination(Request $request): RedirectResponse
    {
        $this->authorize('create', Backup::class);

        $driver = $request->input('driver', 'local');

        try {
            if ($driver === 'smb') {
                $smb = $this->resolveSmbForTest($request);
                DestinationFactory::smb($smb)->test();
            } else {
                DestinationFactory::make('local')->test();
            }
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Destination is reachable and writable.');
    }

    /** Send a test email using the (possibly unsaved) mail settings in the request. */
    public function testEmail(Request $request, BackupNotifier $notifier): RedirectResponse
    {
        $this->authorize('create', Backup::class);

        $request->validate([
            'mail.to'         => ['required', 'email'],
            'mail.host'       => ['required', 'string'],
            'mail.port'       => ['required', 'integer', 'min:1', 'max:65535'],
            'mail.encryption' => ['required', Rule::in(['tls', 'ssl', 'none'])],
        ]);

        $this->assertMailAuthPaired($request);

        try {
            $notifier->sendTest($this->resolveMailForTest($request));
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', 'Test email sent to ' . $request->input('mail.to') . '.');
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /**
     * SMTP auth is all-or-nothing: a username needs a password and vice-versa.
     * A password counts as present when typed OR already saved (blank = keep
     * stored), so editing the username on an authenticated account doesn't fail.
     */
    private function assertMailAuthPaired(Request $request): void
    {
        $username    = trim((string) $request->input('mail.username', ''));
        $typedPw     = (string) $request->input('mail.password', '') !== '';
        $savedPw     = ! empty(BackupSettings::get()['mail']['password'] ?? '');
        $passPresent = $typedPw || $savedPw;

        $errors = [];
        if ($username !== '' && ! $passPresent) {
            $errors['mail.password'] = 'Enter a password to go with the username, or clear the username.';
        }
        if ($username === '' && $typedPw) {
            $errors['mail.username'] = 'Enter a username to go with the password.';
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Merge the submitted settings over the stored ones, re-encrypting changed
     * passwords and KEEPING the existing encrypted password when the field comes
     * back blank (the UI never echoes a saved password).
     */
    private function mergeSettings(array $validated): array
    {
        $current = BackupSettings::get();

        $smb = array_merge($current['smb'], array_filter(
            $validated['smb'] ?? [],
            fn ($k) => $k !== 'password',
            ARRAY_FILTER_USE_KEY,
        ));
        $smb['password'] = $this->keepOrEncrypt($validated['smb']['password'] ?? '', $current['smb']['password'] ?? '');

        $mail = array_merge($current['mail'], array_filter(
            $validated['mail'] ?? [],
            fn ($k) => $k !== 'password',
            ARRAY_FILTER_USE_KEY,
        ));
        $mail['password'] = $this->keepOrEncrypt($validated['mail']['password'] ?? '', $current['mail']['password'] ?? '');

        return [
            'enabled'    => (bool) $validated['enabled'],
            'interval'   => $validated['interval'],
            'retention'  => (int) $validated['retention'],
            'driver'     => $validated['driver'],
            'encryption' => (bool) $validated['encryption'],
            'smb'        => $smb,
            'mail'       => $mail,
        ];
    }

    /** Blank submitted password → keep stored cipher; otherwise encrypt the new one. */
    private function keepOrEncrypt(string $submitted, string $storedCipher): string
    {
        return $submitted === '' ? $storedCipher : BackupSettings::encrypt($submitted);
    }

    /** SMB config for a test: use the typed password, or fall back to the saved one. */
    private function resolveSmbForTest(Request $request): array
    {
        $current = BackupSettings::get();
        $smb     = array_merge($current['smb'], $request->input('smb', []));
        $smb['password'] = ($request->input('smb.password') ?: '') !== ''
            ? $request->input('smb.password')
            : BackupSettings::smbPassword();

        return $smb;
    }

    /** Mail config for a test: use the typed password, or fall back to the saved one. */
    private function resolveMailForTest(Request $request): array
    {
        $current = BackupSettings::get();
        $mail    = array_merge($current['mail'], $request->input('mail', []));
        $mail['password'] = ($request->input('mail.password') ?: '') !== ''
            ? $request->input('mail.password')
            : BackupSettings::mailPassword();

        return $mail;
    }
}
