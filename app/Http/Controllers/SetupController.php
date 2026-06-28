<?php

namespace App\Http\Controllers;

use App\Http\Requests\MailSettingsRequest;
use App\Http\Requests\SetupAdminRequest;
use App\Models\Setting;
use App\Models\User;
use App\Support\MailSettings;
use App\Support\MailTester;
use App\Support\Setup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

/**
 * The first-run installation wizard. Reachable only while the instance is unset
 * up (see EnsureSetupComplete + Setup::isComplete); finishing it creates the
 * first admin, flips the setup flag and logs that admin in.
 *
 * The admin account is collected at its step (so the email's uniqueness is
 * validated early) but only CREATED at complete() — that keeps the "admin
 * exists" completeness signal false until the very end, so the wizard can't
 * short-circuit itself mid-flow. Instance name and SMTP are persisted as they're
 * entered (they don't affect completeness and are harmless if abandoned).
 */
class SetupController extends Controller
{
    public function show(Request $request): Response|RedirectResponse
    {
        if (Setup::isComplete()) {
            return redirect('/');
        }

        return Inertia::render('Setup/Wizard', [
            'adminConfigured' => (bool) $request->session()->get('setup.admin'),
            'adminName'       => $request->session()->get('setup.admin.name'),
            'instanceName'    => Setup::instanceName(),
            'mail'            => MailSettings::forDisplay(),
        ]);
    }

    /** Step 1 — capture (validate, don't yet create) the first admin account. */
    public function storeAdmin(SetupAdminRequest $request): RedirectResponse
    {
        $this->abortIfComplete();

        // Held in the session until complete(); the password is hashed by the
        // model's cast when the user is finally created.
        $request->session()->put('setup.admin', $request->validated());

        return back();
    }

    /** Step 2 — the instance display name (becomes app.name). */
    public function storeInstance(Request $request): RedirectResponse
    {
        $this->abortIfComplete();

        $validated = $request->validate(['name' => ['required', 'string', 'max:255']]);
        Setting::put('instance', ['name' => $validated['name']]);

        return back();
    }

    /** Step 3 — the global SMTP settings (so password resets deliver). */
    public function storeMail(MailSettingsRequest $request): RedirectResponse
    {
        $this->abortIfComplete();

        MailSettings::save($request->validated());

        return back();
    }

    /** Send a test email through the entered (possibly unsaved) SMTP settings. */
    public function testMail(Request $request, MailTester $tester): RedirectResponse
    {
        $this->abortIfComplete();

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

    /** Finish — create the admin, mark setup complete and sign that admin in. */
    public function complete(Request $request): RedirectResponse
    {
        if (Setup::isComplete()) {
            return redirect('/');
        }

        $admin = $request->session()->get('setup.admin');
        if (! $admin) {
            throw ValidationException::withMessages([
                'admin' => 'Create an administrator account before finishing.',
            ]);
        }

        $user = DB::transaction(function () use ($admin) {
            // A fresh install may not have been seeded, so make sure the role
            // set exists (idempotent — mirrors RoleSeeder) before assigning.
            foreach (['admin', 'editor', 'viewer'] as $role) {
                Role::findOrCreate($role, 'web');
            }

            $user = User::create([
                'name'         => $admin['name'],
                'email'        => $admin['email'],
                'password'     => $admin['password'],
                'avatar_color' => 'sage',
            ]);
            $user->syncRoles('admin');

            return $user;
        });

        Setup::markComplete();

        Auth::login($user);
        $request->session()->forget('setup.admin');
        $request->session()->regenerate();

        return redirect()->route('workspaces.index');
    }

    /** Guard the write steps: once set up, the wizard's actions are off-limits. */
    private function abortIfComplete(): void
    {
        abort_if(Setup::isComplete(), 403);
    }
}
