<?php

namespace App\Support;

use App\Mail\TestMail;
use Illuminate\Support\Facades\Mail;

/**
 * Sends a one-off test message through SMTP settings the operator is editing —
 * which may be UNSAVED — to confirm they work before relying on them. Builds a
 * transient `smtp-test` mailer at runtime (the global mailer is reserved for the
 * persisted settings), and turns raw transport errors into readable hints.
 *
 * Sibling to the backups feature's BackupNotifier::sendTest; this one is for the
 * global mailer (password resets, app notifications).
 */
class MailTester
{
    /**
     * @param array  $mail decrypted mail config (host/port/encryption/username/password/from_*)
     * @param string $to   recipient address
     *
     * @throws \RuntimeException with an admin-readable message on transport failure
     */
    public function send(array $mail, string $to): void
    {
        $encryption = ($mail['encryption'] ?? 'tls') === 'none' ? null : ($mail['encryption'] ?? 'tls');

        config(['mail.mailers.smtp-test' => [
            'transport'  => 'smtp',
            'host'       => $mail['host'] ?? '',
            'port'       => (int) ($mail['port'] ?? 587),
            'encryption' => $encryption,
            'username'   => ($mail['username'] ?? '') ?: null,
            'password'   => ($mail['password'] ?? '') ?: null,
            'timeout'    => 15,
        ]]);

        $fromAddress = ($mail['from_address'] ?? '') ?: (config('mail.from.address') ?: $to);
        $fromName    = ($mail['from_name'] ?? '') ?: config('app.name');

        try {
            Mail::mailer('smtp-test')->to($to)->send(new TestMail($fromAddress, $fromName));
        } catch (\Throwable $e) {
            throw new \RuntimeException($this->friendly($e), previous: $e);
        }
    }

    /** Turn a raw SMTP/transport failure into an admin-readable hint. */
    private function friendly(\Throwable $e): string
    {
        $msg = $e->getMessage();

        return match (true) {
            str_contains($msg, 'getaddrinfo')
            || str_contains($msg, 'Name or service not known')
            || str_contains($msg, 'name resolution')
                => 'Could not find the SMTP host — check the server address.',

            str_contains($msg, 'Connection refused')
            || str_contains($msg, 'Connection could not be established')
            || str_contains($msg, 'timed out')
            || str_contains($msg, 'timeout')
                => 'Could not reach the SMTP server — check the host, port and that it is online.',

            str_contains($msg, 'Authentication')
            || str_contains($msg, 'authenticate')
            || str_contains($msg, '535')
                => 'Authentication failed — check the username and password.',

            str_contains($msg, 'crypto')
            || str_contains($msg, 'TLS')
            || str_contains($msg, 'SSL')
            || str_contains($msg, 'certificate')
                => 'Secure connection failed — check the encryption setting (TLS/SSL) and port.',

            default => 'Could not send the email: ' . $msg,
        };
    }
}
