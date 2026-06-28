<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\MailSettingsRequest;
use App\Support\MailSettings;
use App\Support\MailTester;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
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
        MailSettings::save($request->validated());

        return back()->with('success', 'Email settings saved.');
    }

    public function test(Request $request, MailTester $tester): RedirectResponse
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

        try {
            $tester->send(MailSettings::testConfig($validated), $validated['to']);
        } catch (\Throwable $e) {
            throw ValidationException::withMessages(['mail_test' => $e->getMessage()]);
        }

        return back()->with('success', 'Test email sent to ' . $validated['to'] . '.');
    }
}
