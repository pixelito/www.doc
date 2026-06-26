<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\Crypt;

/**
 * Typed access to the `backup` setting blob (schedule + destination + mail).
 * Secrets (SMB / SMTP passwords) are stored ENCRYPTED in the jsonb value and
 * decrypted only here, at point of use. Never expose the raw blob to the UI —
 * use forDisplay(), which strips passwords and replaces them with `*_set` flags.
 */
class BackupSettings
{
    public static function defaults(): array
    {
        $d = config('backup.defaults');

        return [
            'enabled'    => $d['enabled'],
            'interval'   => $d['interval'],
            'retention'  => $d['retention'],
            'driver'     => 'local', // local | smb
            'encryption' => false,   // encrypt archives at rest (needs BACKUP_ENCRYPTION_KEY)
            'smb'  => ['host' => '', 'share' => '', 'path' => '', 'username' => '', 'password' => '', 'domain' => ''],
            'mail' => [
                'enabled'      => false,
                'to'           => '',
                'host'         => '',
                'port'         => 587,
                'username'     => '',
                'password'     => '',
                'encryption'   => 'tls', // tls | ssl | none
                'from_address' => '',
                'from_name'    => config('app.name'),
            ],
        ];
    }

    /** The full settings, merged over defaults (passwords still encrypted). */
    public static function get(): array
    {
        return array_replace_recursive(self::defaults(), Setting::get('backup', []) ?: []);
    }

    public static function smbPassword(): string
    {
        return self::decrypt(self::get()['smb']['password'] ?? '');
    }

    public static function mailPassword(): string
    {
        return self::decrypt(self::get()['mail']['password'] ?? '');
    }

    /** The mail block with its password DECRYPTED, ready to configure a mailer. */
    public static function mailConfig(): array
    {
        $mail = self::get()['mail'];
        $mail['password'] = self::mailPassword();

        return $mail;
    }

    /** Settings safe to hand the frontend: no passwords, just `*_set` booleans. */
    public static function forDisplay(): array
    {
        $s = self::get();

        $smbSet  = (string) ($s['smb']['password'] ?? '') !== '';
        $mailSet = (string) ($s['mail']['password'] ?? '') !== '';

        unset($s['smb']['password'], $s['mail']['password']);
        $s['smb']['password_set']  = $smbSet;
        $s['mail']['password_set'] = $mailSet;

        // Whether a BACKUP_ENCRYPTION_KEY exists at all — the UI disables the
        // encryption toggle (and shows how to set the key) when it doesn't.
        $s['encryption_available'] = \App\Services\Backup\ArchiveCipher::configured();

        return $s;
    }

    public static function encrypt(string $plain): string
    {
        return $plain === '' ? '' : Crypt::encryptString($plain);
    }

    private static function decrypt(string $cipher): string
    {
        if ($cipher === '') {
            return '';
        }

        try {
            return Crypt::decryptString($cipher);
        } catch (\Throwable) {
            return '';
        }
    }
}
