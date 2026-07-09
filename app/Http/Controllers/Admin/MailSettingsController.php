<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\MailSettingsRequest;
use App\Support\MailSettings;
use App\Support\MailTester;
use App\Support\Smtp\TestRun;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin Email (SMTP) settings — the post-setup home for the same global mail
 * config the wizard collects. Drives Laravel's default mailer (see
 * App\Support\MailSettings + AppServiceProvider), so password resets keep
 * working as the operator's mail server changes.
 */
class MailSettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Settings/Mail', [
            'settings' => MailSettings::forDisplay(),
        ]);
    }

    public function update(MailSettingsRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        MailSettings::save($validated);

        // Connection endpoint only — never credentials — in the audit snapshot.
        \App\Support\Audit::record('settings.mail_updated', null, [
            'host' => $validated['host'] ?? null,
            'port' => $validated['port'] ?? null,
        ]);

        return back()->with('success', 'Email settings saved.');
    }

    public function test(Request $request, MailTester $tester, TestRun $test): RedirectResponse
    {
        $validated = $request->validate([
            'host'         => ['required', 'string', 'max:255'],
            'port'         => ['required', 'integer', 'min:1', 'max:65535'],
            'encryption'   => ['required', 'in:tls,ssl,none'],
            'username'     => ['nullable', 'string', 'max:255'],
            'password'     => ['nullable', 'string', 'max:255'],
            'from_address' => ['required', 'email', 'max:255'],
            'from_name'    => ['nullable', 'string', 'max:255'],
            'to'           => ['required', 'email'],
        ]);

        // Staged connection check (DNS → TCP → TLS → send): the report renders
        // as the inline panel under the test button, naming the failing layer
        // instead of one vague hint. The real test send is the final stage.
        $config = MailSettings::testConfig($validated);

        return $test->flash(
            $config,
            fn () => $tester->send($config, $validated['to']),
            'Test email sent to ' . $validated['to'] . '.',
        );
    }
}
