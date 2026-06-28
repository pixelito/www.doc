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

    /**
     * Create the Welcome workspace for a brand-new instance: an introductory
     * page (with a live example diagram + wiki-links) and two nested guides.
     *
     * The two guides are created FIRST so the welcome page's [[wiki-links]]
     * resolve to them by title on save; they're then nested under the welcome
     * page (a structural parent_id change — no new version).
     */
    private function seedWelcomeContent(): void
    {
        try {
            DB::transaction(function () {
                $workspace = Workspace::create([
                    'name'        => 'Welcome',
                    'description' => 'Start here.',
                    'position'    => 0,
                ]);

                $ws = $workspace->id;

                $writing = Document::create([
                    'title' => 'Writing & formatting', 'workspace_id' => $ws, 'position' => 0,
                    'content' => $this->writingGuide(),
                ]);
                $organising = Document::create([
                    'title' => 'Organising your knowledge base', 'workspace_id' => $ws, 'position' => 1,
                    'content' => $this->organisingGuide(),
                ]);

                $welcome = Document::create([
                    'title' => 'Welcome to ' . config('app.name'), 'workspace_id' => $ws, 'position' => 0,
                    'content' => $this->welcomeContent(),
                ]);

                // Nest the guides under the welcome page (structural — the
                // observer doesn't re-snapshot a parent_id-only change).
                $writing->update(['parent_id' => $welcome->id]);
                $organising->update(['parent_id' => $welcome->id]);
            });
        } catch (\Throwable $e) {
            report($e);
        }
    }

    // ── Welcome content (StarterKit nodes + wikiLink + networkDiagram) ──────────

    private function h(string $text): array
    {
        return ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => $text]]];
    }

    private function p(string $text): array
    {
        return ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]];
    }

    private function bullets(array $items): array
    {
        return [
            'type' => 'bulletList',
            'content' => array_map(fn (string $t) => [
                'type' => 'listItem',
                'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $t]]]],
            ], $items),
        ];
    }

    private function welcomeContent(): array
    {
        $app = config('app.name');

        return [
            'type' => 'doc',
            'content' => [
                $this->p("{$app} is your team's self-hosted knowledge base — a calm, wiki-style place to write things down and find them again. This page is here to get you started; edit or delete it whenever you like."),

                $this->h('Getting started'),
                $this->bullets([
                    'Workspaces are the top-level containers for your content. This "Welcome" one is your first — add more for each area of your work.',
                    'Open a workspace to see its pages as a tree. Pages can be nested, so related notes live together.',
                    'Turn on edit mode to change a page; every save is kept as a version you can compare and roll back to.',
                ]),

                // Two starter guides, linked the same way you'll link your own pages.
                ['type' => 'paragraph', 'content' => [
                    ['type' => 'text', 'text' => 'Two short guides come with this page: '],
                    ['type' => 'wikiLink', 'attrs' => ['title' => 'Writing & formatting']],
                    ['type' => 'text', 'text' => ' and '],
                    ['type' => 'wikiLink', 'attrs' => ['title' => 'Organising your knowledge base']],
                    ['type' => 'text', 'text' => '. They\'re nested under this page — open this workspace to see the page tree.'],
                ]],

                $this->h('A live example: network diagrams'),
                $this->p('Pages can embed network diagrams, rendered right here in the read view. Here\'s a simple one — open this page in edit mode to change it.'),
                $this->diagramNode(),

                $this->h('For administrators'),
                $this->bullets([
                    'Invite teammates and set their roles (admin, editor, viewer) under Settings → Users.',
                    'Configure the mail server under Settings → Email so password resets and notifications are delivered.',
                    'Schedule encrypted, off-host backups under Settings → Backups to keep your knowledge base safe.',
                ]),

                $this->p('That\'s it — create your first real workspace and start writing.'),
            ],
        ];
    }

    private function writingGuide(): array
    {
        return [
            'type' => 'doc',
            'content' => [
                $this->p('The editor is a rich text editor that stays out of your way. A few things worth knowing:'),
                $this->bullets([
                    'Paste from Word, Google Docs or the web and the formatting comes across cleanly — headings, lists, tables, links and more.',
                    'Paste a screenshot straight from your clipboard and it\'s embedded inline; resize it by dragging.',
                    'Use headings to structure a page; the formatting toolbar covers bold, italic, colours, highlights, code and quotes.',
                    'Need a diagram? Insert a network diagram block and lay out nodes and connections visually.',
                ]),
                $this->p('Every time you save, the previous state is kept as a version — so you can always compare changes or roll back.'),
            ],
        ];
    }

    private function organisingGuide(): array
    {
        return [
            'type' => 'doc',
            'content' => [
                $this->p('A little structure keeps a knowledge base easy to navigate as it grows:'),
                $this->bullets([
                    'Workspaces group big areas of work and don\'t nest — keep the set small and deliberate.',
                    'Nest pages under one another to build a shallow tree of related notes.',
                    'Link related pages by typing [[Page title]]; each page shows its backlinks, so connections work both ways.',
                    'Add tags to cut across workspaces, and use full-text search to jump straight to anything.',
                ]),
                $this->p('When you\'re ready, delete this Welcome workspace and start shaping your own.'),
            ],
        ];
    }

    /**
     * A small example network diagram, in the same graph shape the editor and
     * the server-side SVG renderer expect (mirrors WorkspaceSeeder::diagram).
     */
    private function diagramNode(): array
    {
        $nodes = [
            ['id' => 'net', 'label' => 'Internet',    'kind' => 'cloud',    'color' => 'blue',       'x' => 200, 'y' => 0],
            ['id' => 'fw',  'label' => 'Firewall',    'kind' => 'firewall', 'color' => 'terracotta', 'x' => 200, 'y' => 110],
            ['id' => 'sw',  'label' => 'Core Switch', 'kind' => 'switch',   'color' => 'sage',       'x' => 200, 'y' => 220],
            ['id' => 'srv', 'label' => 'App Server',  'kind' => 'server',   'color' => 'sage',       'x' => 80,  'y' => 330],
            ['id' => 'db',  'label' => 'Database',    'kind' => 'database', 'color' => 'sage',       'x' => 320, 'y' => 330],
        ];
        $edges = [
            ['from' => 'net', 'to' => 'fw'],
            ['from' => 'fw',  'to' => 'sw'],
            ['from' => 'sw',  'to' => 'srv'],
            ['from' => 'sw',  'to' => 'db'],
        ];

        $graphNodes = array_map(fn (array $n) => [
            'id'       => $n['id'],
            'type'     => 'labeled',
            'position' => ['x' => $n['x'], 'y' => $n['y']],
            'data'     => ['label' => $n['label'], 'kind' => $n['kind'], 'color' => $n['color']],
        ], $nodes);

        $graphEdges = array_map(fn (array $e) => [
            'id'           => 'e-' . $e['from'] . '-' . $e['to'],
            'source'       => $e['from'],
            'target'       => $e['to'],
            'sourceHandle' => 'bottom',
            'targetHandle' => 'top',
            'data'         => ['label' => '', 'lineStyle' => 'solid', 'arrows' => 'end', 'routing' => 'step', 'color' => '#8E938E'],
        ], $edges);

        return [
            'type'  => 'networkDiagram',
            'attrs' => [
                'graph'    => [
                    'nodes'    => $graphNodes,
                    'edges'    => $graphEdges,
                    'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
                    'settings' => ['routing' => 'step', 'snap' => false],
                ],
                'name'     => 'Example network',
                'imageSrc' => null,
                'width'    => null,
                'align'    => 'left',
            ],
        ];
    }

    /** Guard the write steps: once set up, the wizard's actions are off-limits. */
    private function abortIfComplete(): void
    {
        abort_if(Setup::isComplete(), 403);
    }
}
