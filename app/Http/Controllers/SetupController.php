<?php

namespace App\Http\Controllers;

use App\Http\Requests\MailSettingsRequest;
use App\Http\Requests\SetupAdminRequest;
use App\Models\Document;
use App\Models\Setting;
use App\Models\User;
use App\Models\Workspace;
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

        // Give the fresh instance a starting point: a Welcome workspace with a
        // page that explains the app. Authored as the now-logged-in admin (the
        // observer stamps Auth::id()). Best-effort — a failure here must not
        // undo the completed setup.
        $this->seedWelcomeContent();

        return redirect()->route('workspaces.index');
    }

    /** Create the Welcome workspace + introductory page for a brand-new instance. */
    private function seedWelcomeContent(): void
    {
        try {
            DB::transaction(function () {
                $workspace = Workspace::create([
                    'name'        => 'Welcome',
                    'description' => 'Start here.',
                    'position'    => 0,
                ]);

                Document::create([
                    'title'        => 'Welcome to ' . config('app.name'),
                    'workspace_id' => $workspace->id,
                    'position'     => 0,
                    'content'      => $this->welcomeContent(),
                ]);
            });
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** The TipTap document for the welcome page (StarterKit nodes only). */
    private function welcomeContent(): array
    {
        $h = fn (string $text) => [
            'type' => 'heading', 'attrs' => ['level' => 2],
            'content' => [['type' => 'text', 'text' => $text]],
        ];
        $p = fn (string $text) => [
            'type' => 'paragraph',
            'content' => [['type' => 'text', 'text' => $text]],
        ];
        $bullets = fn (array $items) => [
            'type' => 'bulletList',
            'content' => array_map(fn (string $t) => [
                'type' => 'listItem',
                'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $t]]]],
            ], $items),
        ];

        $app = config('app.name');

        return [
            'type' => 'doc',
            'content' => [
                $p("{$app} is your team's self-hosted knowledge base — a calm, wiki-style place to write things down and find them again. This page is here to get you started; edit or delete it whenever you like."),

                $h('Getting started'),
                $bullets([
                    'Workspaces are the top-level containers in the sidebar. This "Welcome" one is your first — add more for each area of your work.',
                    'Inside a workspace, create pages. Pages can be nested to build a shallow tree, so related notes live together.',
                    'Turn on edit mode to change a page; every save is kept as a version you can compare and roll back to.',
                ]),

                $h('What you can do'),
                $bullets([
                    'Write with a rich editor — paste from Word or the web and keep the formatting, or paste a screenshot straight in.',
                    'Link pages together by typing [[Page title]]; backlinks show you everything that points to a page.',
                    'Find anything fast with full-text search across every page.',
                    'Embed network diagrams to document your infrastructure, right inside a page.',
                    'Import and export DOCX and PDF when you need to move content in or out.',
                ]),

                $h('For administrators'),
                $bullets([
                    'Invite teammates and set their roles (admin, editor, viewer) under Settings → Users.',
                    'Configure the mail server under Settings → Email so password resets and notifications are delivered.',
                    'Schedule encrypted, off-host backups under Settings → Backups to keep your knowledge base safe.',
                ]),

                $p('That\'s it — create your first real workspace from the sidebar, and start writing.'),
            ],
        ];
    }

    /** Guard the write steps: once set up, the wizard's actions are off-limits. */
    private function abortIfComplete(): void
    {
        abort_if(Setup::isComplete(), 403);
    }
}
