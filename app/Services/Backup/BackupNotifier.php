<?php

namespace App\Services\Backup;

use App\Mail\BackupReport;
use App\Models\Backup;
use App\Support\BackupSettings;
use Illuminate\Support\Facades\Mail;

/**
 * Sends the post-backup email using the admin-configured SMTP server (NOT the
 * app's default mailer). The mail block — host/port/credentials/encryption/from
 * — comes from the Backups settings, so a deployment with no global mail setup
 * can still notify on backup. Builds a one-off `backup` mailer at runtime.
 */
class BackupNotifier
{
    /** Email the configured recipient about a finished backup (success or failure). */
    public function notify(Backup $backup): void
    {
        $mail = BackupSettings::mailConfig();

        if (! ($mail['enabled'] ?? false) || trim((string) ($mail['to'] ?? '')) === '') {
            return; // notifications off, or no recipient — nothing to do
        }

        try {
            $this->send($mail, new BackupReport(backup: $backup));
        } catch (\Throwable $e) {
            // A failed notification must never fail the backup itself.
            report($e);
        }
    }

    /**
     * Send a test message to confirm the mail settings. Throws on failure so the
     * "Send test email" endpoint can surface the SMTP error to the admin.
     *
     * @param array $mail decrypted mail config (password in clear)
     */
    public function sendTest(array $mail): void
    {
        $this->send($mail, new BackupReport(isTest: true));
    }

    private function send(array $mail, BackupReport $mailable): void
    {
        $this->configureMailer($mail);

        Mail::mailer('backup')->to($mail['to'])->send($mailable);
    }

    /** Point the runtime `backup` mailer + default from-address at the settings. */
    private function configureMailer(array $mail): void
    {
        $encryption = ($mail['encryption'] ?? 'tls') === 'none' ? null : ($mail['encryption'] ?? 'tls');

        config([
            'mail.mailers.backup' => [
                'transport'  => 'smtp',
                'host'       => $mail['host'] ?? '',
                'port'       => (int) ($mail['port'] ?? 587),
                'encryption' => $encryption,
                'username'   => ($mail['username'] ?? '') ?: null,
                'password'   => ($mail['password'] ?? '') ?: null,
                'timeout'    => 15,
            ],
            'mail.from.address' => ($mail['from_address'] ?? '') ?: config('mail.from.address'),
            'mail.from.name'    => ($mail['from_name'] ?? '') ?: config('app.name'),
        ]);
    }
}
