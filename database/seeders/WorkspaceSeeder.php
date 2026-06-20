<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use App\Models\Document;
use App\Models\Tag;
use Illuminate\Database\Seeder;

class WorkspaceSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::first() ?? User::factory()->create([
            'name'     => 'Admin User',
            'email'    => 'admin@example.com',
            'password' => bcrypt('password'),
        ]);

        // ── Tags ──────────────────────────────────────────────────────────────
        $tags = [
            'guide'      => Tag::firstOrCreate(['name' => 'Guide']),
            'style'      => Tag::firstOrCreate(['name' => 'Style']),
            'design'     => Tag::firstOrCreate(['name' => 'Design']),
            'setup'      => Tag::firstOrCreate(['name' => 'Setup']),
            'network'    => Tag::firstOrCreate(['name' => 'Network']),
            'security'   => Tag::firstOrCreate(['name' => 'Security']),
            'ops'        => Tag::firstOrCreate(['name' => 'Ops']),
            'policy'     => Tag::firstOrCreate(['name' => 'Policy']),
            'compliance' => Tag::firstOrCreate(['name' => 'Compliance']),
            'incident'   => Tag::firstOrCreate(['name' => 'Incident']),
            'support'    => Tag::firstOrCreate(['name' => 'Support']),
            'sales'      => Tag::firstOrCreate(['name' => 'Sales']),
            'marketing'  => Tag::firstOrCreate(['name' => 'Marketing']),
            'finance'    => Tag::firstOrCreate(['name' => 'Finance']),
            'legal'      => Tag::firstOrCreate(['name' => 'Legal']),
        ];

        // ── Workspaces ────────────────────────────────────────────────────────
        $workspacesData = [

            // ── 1. Engineering Hub ────────────────────────────────────────────
            [
                'name'        => 'Engineering Hub',
                'description' => 'Coding guidelines, dev setup, architecture and deployment procedures.',
                'position'    => 1,
                'pages'       => [
                    [
                        'title'    => 'Getting Started',
                        'position' => 1,
                        'tags'     => ['guide'],
                        'content'  => [
                            'Welcome to the Engineering Hub. Follow the steps below to get your local environment running and to understand our conventions.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/devsetup/900/420', 'alt' => 'Development environment overview'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Recommended reading order'],
                            ['type' => 'orderedList', 'items' => [
                                '[[Local Environment Setup]] — Docker, dependencies and `.env`',
                                '[[IDE Settings]] — plugins and format-on-save config',
                                '[[PHP & Laravel Style]] and [[React & Tailwind Style]] guides',
                                '[[Deployment Guide]] — CI pipeline and release process',
                            ]],
                            'Once your environment is running, consult the [[Architecture Overview]] to understand how the layers fit together.',
                        ],
                        'children' => [
                            [
                                'title'    => 'Local Environment Setup',
                                'position' => 1,
                                'tags'     => ['setup'],
                                'content'  => [
                                    'Setting up your local environment takes about 15 minutes. You will need Docker, PHP 8.3 and Node 20 installed on your host.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Step-by-step'],
                                    ['type' => 'orderedList', 'items' => [
                                        'Clone the repository: `git clone git@github.com:org/project.git`',
                                        'Copy environment file: `cp .env.example .env`',
                                        'Install PHP dependencies: `composer install`',
                                        'Install JS dependencies: `npm install`',
                                        'Generate app key: `php artisan key:generate`',
                                        'Run migrations and seed: `php artisan migrate --seed`',
                                        'Start Vite: `npm run dev`',
                                    ]],
                                    ['type' => 'codeBlock', 'language' => 'bash', 'code' =>
                                        "git clone git@github.com:org/project.git\ncd project\ncp .env.example .env\ncomposer install && npm install\nphp artisan key:generate\nphp artisan migrate --seed\nnpm run dev",
                                    ],
                                    ['type' => 'blockquote', 'text' => 'Tip: run `php artisan horizon` in a separate terminal to process queued jobs (exports, imports).'],
                                    'Your editor setup is covered in [[IDE Settings]]. Coding conventions live in [[PHP & Laravel Style]] and [[React & Tailwind Style]].',
                                ],
                            ],
                            [
                                'title'    => 'IDE Settings',
                                'position' => 2,
                                'tags'     => ['setup'],
                                'content'  => [
                                    'We recommend VS Code or PhpStorm. Both editors support the full Laravel + React + Tailwind toolchain out of the box.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'VS Code extensions'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Prettier — Opinionated Code Formatter',
                                        'ESLint — JavaScript linting',
                                        'PHP Intelephense — language server',
                                        'Tailwind CSS IntelliSense — class autocomplete',
                                        'Laravel Blade Snippets',
                                    ]],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Recommended settings.json'],
                                    ['type' => 'codeBlock', 'language' => 'json', 'code' =>
                                        "{\n  \"editor.formatOnSave\": true,\n  \"editor.defaultFormatter\": \"esbenp.prettier-vscode\",\n  \"[php]\": { \"editor.defaultFormatter\": \"bmewburn.vscode-intelephense-client\" },\n  \"tailwindCSS.experimental.classRegex\": [[\"cn\\\\(([^)]*)\\\\)\", \"'([^']*)'\"]]  \n}",
                                    ],
                                    'Enable format-on-save for consistent styling, matching our [[PHP & Laravel Style]] rules.',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Architecture Overview',
                        'position' => 2,
                        'content'  => [
                            'Our system is a standard Laravel + Inertia.js + React SPA. The backend owns all data and business logic; the frontend handles rendering and user interaction.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/architecture/900/480', 'alt' => 'High-level architecture diagram'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Request lifecycle'],
                            ['type' => 'orderedList', 'items' => [
                                'Browser sends request → Laravel router',
                                'Controller authorises action via Policy',
                                'Controller fetches data, returns Inertia response',
                                'Inertia serialises props as JSON, React renders page component',
                                'Subsequent navigations are XHR — no full reload',
                            ]],
                            'Database schemas and relational design are described in [[Database Schema & Design]]. Background jobs are covered in [[Queue Systems]].',
                        ],
                        'children' => [
                            [
                                'title'    => 'Database Schema & Design',
                                'position' => 1,
                                'content'  => [
                                    'We use PostgreSQL 16. Key tables are listed below.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Core tables'],
                                    ['type' => 'bulletList', 'items' => [
                                        '`workspaces` — name, slug, description, position',
                                        '`documents` — title, slug, workspace_id, parent_id, position, content (jsonb), content_html (text), search_vector (tsvector)',
                                        '`document_versions` — snapshot of content + title on every save',
                                        '`tags` + `taggables` — polymorphic many-to-many',
                                        '`links` — source_document_id, target_document_id, resolved at save time',
                                        '`assets` — path, disk, mime, size, SHA-256 checksum for deduplication',
                                    ]],
                                    ['type' => 'codeBlock', 'language' => 'sql', 'code' =>
                                        "SELECT d.title, COUNT(dv.id) AS versions\nFROM documents d\nLEFT JOIN document_versions dv ON dv.document_id = d.id\nGROUP BY d.id\nORDER BY versions DESC;",
                                    ],
                                    'See [[Architecture Overview]] for how these tables interact with the queue system.',
                                ],
                            ],
                            [
                                'title'    => 'Queue Systems',
                                'position' => 2,
                                'content'  => [
                                    'We use Redis as our queue driver with Laravel Horizon for monitoring. All long-running work (exports, imports, search-vector reindexing) is dispatched as background jobs.',
                                    ['type' => 'image', 'src' => 'https://picsum.photos/seed/queues/900/380', 'alt' => 'Horizon queue dashboard'],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Queue setup'],
                                    ['type' => 'codeBlock', 'language' => 'bash', 'code' => "php artisan horizon\n# or in production:\nsupervisorctl start horizon"],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Dispatched jobs'],
                                    ['type' => 'bulletList', 'items' => [
                                        '`ProcessDocumentImport` — DOCX/PDF → TipTap JSON',
                                        '`GenerateDocumentExport` — TipTap JSON → PDF/DOCX',
                                        '`UpdateSearchVector` — regenerates tsvector on content change',
                                    ]],
                                    'Job dispatching guidelines are in [[Architecture Overview]].',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Code Style Guidelines',
                        'position' => 3,
                        'tags'     => ['style'],
                        'content'  => [
                            'Consistent code style keeps our codebase readable and review-friendly. We enforce rules at the editor level (auto-format) and CI level (lint/pint).',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Quick reference'],
                            ['type' => 'bulletList', 'items' => [
                                'PHP — [[PHP & Laravel Style]] (PSR-12 + Pint)',
                                'React/JS — [[React & Tailwind Style]] (Prettier + ESLint)',
                                'Editor config — [[IDE Settings]]',
                            ]],
                        ],
                        'children' => [
                            [
                                'title'    => 'PHP & Laravel Style',
                                'position' => 1,
                                'tags'     => ['style'],
                                'content'  => [
                                    'We follow PSR-12 enforced by Laravel Pint. Run `./vendor/bin/pint` before committing.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Key conventions'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Thin controllers — extract logic into Service or Action classes',
                                        'Use Form Requests for all validation',
                                        'Every action must go through a Laravel Policy',
                                        'Avoid raw queries — use Eloquent; raw SQL only for reporting',
                                        'Type-hint everything: parameters, return types, properties',
                                    ]],
                                    ['type' => 'codeBlock', 'language' => 'php', 'code' =>
                                        "// Good\npublic function store(StoreDocumentRequest \$request, Workspace \$workspace): RedirectResponse\n{\n    \$this->authorize('create', [Document::class, \$workspace]);\n    \$document = \$this->documentService->create(\$workspace, \$request->validated(), auth()->user());\n    return redirect()->route('documents.show', \$document);\n}",
                                    ],
                                    'Eloquent conventions are described in [[Database Schema & Design]].',
                                ],
                            ],
                            [
                                'title'    => 'React & Tailwind Style',
                                'position' => 2,
                                'tags'     => ['style'],
                                'content'  => [
                                    'We use React 18 (plain JS, no TypeScript) with Tailwind CSS v4. Run Prettier on save.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Component rules'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Functional components only — no class components',
                                        'Keep components small; extract when a component exceeds ~150 lines',
                                        'Co-locate state as close to where it is used as possible',
                                        'Prefer `cn()` (tailwind-merge) for conditional class names',
                                        'No inline `style={}` except for dynamic values Tailwind cannot express',
                                    ]],
                                    'For consistent design tokens, follow the guidelines in the Product workspace\'s [[Design System]].',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Deployment Guide',
                        'position' => 4,
                        'tags'     => ['guide', 'ops'],
                        'content'  => [
                            'Deployments are fully automated via GitHub Actions. Merging a PR into `main` starts the pipeline.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/deploy/900/380', 'alt' => 'CI/CD pipeline overview'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Pipeline stages'],
                            ['type' => 'orderedList', 'items' => [
                                'Lint — Pint (PHP) + ESLint (JS)',
                                'Test — PHPUnit suite against a fresh SQLite DB',
                                'Build — Vite compiles and fingerprints frontend assets',
                                'Deploy to staging — rsync + `php artisan migrate --force`',
                                'Smoke test — Playwright hits key routes',
                                'Promote to production — manual approval gate in GitHub',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Rollback procedure'],
                            ['type' => 'codeBlock', 'language' => 'bash', 'code' =>
                                "# On the server\nphp artisan down\ngit checkout <previous-tag>\ncomposer install --no-dev\nnpm ci && npm run build\nphp artisan migrate:rollback\nphp artisan up",
                            ],
                            ['type' => 'blockquote', 'text' => 'Never push directly to main. All changes go through a PR and must pass CI before merging.'],
                        ],
                    ],
                ],
            ],

            // ── 2. Product & Design ───────────────────────────────────────────
            [
                'name'        => 'Product & Design',
                'description' => 'Product roadmaps, UI/UX guidelines, design systems, and user research.',
                'position'    => 2,
                'pages'       => [
                    [
                        'title'    => 'Product Roadmap 2026',
                        'position' => 1,
                        'content'  => [
                            'Our 2026 product focus is on collaborative editing, richer importing, and a polished mobile experience.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/roadmap/900/420', 'alt' => 'Product roadmap board'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Q1 — Foundation'],
                            ['type' => 'bulletList', 'items' => [
                                'Real-time presence indicators (avatars on active documents)',
                                'Operational transforms for concurrent editing (Phase 1)',
                                'DOCX import fidelity improvements',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Q2 — Collaboration'],
                            ['type' => 'bulletList', 'items' => [
                                'Inline comments and threads',
                                'Mention @user in pages to notify teammates',
                                'Page permissions (workspace-level and per-page overrides)',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Q3–Q4 — Polish & Scale'],
                            ['type' => 'bulletList', 'items' => [
                                'Mobile-optimised reading experience',
                                'Full-text search improvements (ranking, filters)',
                                'Analytics: page views, edit frequency, stale-page alerts',
                            ]],
                            'Design specifications live in [[Design System]]. Feedback is collected via the channels described in [[User Research]].',
                        ],
                    ],
                    [
                        'title'    => 'Design System',
                        'position' => 2,
                        'tags'     => ['design'],
                        'content'  => [
                            'The Design System defines the visual language of the product: colours, typography, spacing, radii, shadows, and component patterns.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/designsys/900/420', 'alt' => 'Design system overview'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Core tokens'],
                            ['type' => 'bulletList', 'items' => [
                                '[[Color Palette]] — warm-cream foundation + soft sage accent',
                                '[[Typography]] — Lexend typeface, strict scale',
                                '[[Component Guidelines]] — buttons, inputs, modals, badges',
                            ]],
                            ['type' => 'blockquote', 'text' => 'Separation comes from borders, not shadows. Use generous whitespace.'],
                            'Frontend implementation details are in [[React & Tailwind Style]].',
                        ],
                        'children' => [
                            [
                                'title'    => 'Color Palette',
                                'position' => 1,
                                'tags'     => ['design'],
                                'content'  => [
                                    'We use a warm-cream foundation with a soft sage accent. All colours are defined as CSS custom properties and exposed as Tailwind utilities.',
                                    ['type' => 'image', 'src' => 'https://picsum.photos/seed/palette/900/360', 'alt' => 'Color palette swatches'],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Sage ramp'],
                                    ['type' => 'bulletList', 'items' => [
                                        '`sage-50` #EDF2EA — tinted backgrounds, info banners',
                                        '`sage-100` #DAE6D4 — badge fills, soft callouts',
                                        '`sage-200` #BFD2B5 — borders on sage-tinted areas',
                                        '`sage-400` #7E9D72 — PRIMARY buttons, key accents',
                                        '`sage-600` #4B6840 — sage text on light bg (AA-safe)',
                                    ]],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Semantic colours'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Danger — `#B5573E` warm terracotta (never a cold red)',
                                        'Warning — `#C99650` warm amber',
                                        'Info — `#6E8AA7` muted blue',
                                    ]],
                                    ['type' => 'blockquote', 'text' => 'Text accents use sage-600, not sage-400. sage-400 fails WCAG AA on the cream background.'],
                                ],
                            ],
                            [
                                'title'    => 'Typography',
                                'position' => 2,
                                'tags'     => ['design', 'style'],
                                'content'  => [
                                    'We use Lexend (self-hosted woff2) for all UI text. Monospace content uses JetBrains Mono.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Type scale'],
                                    ['type' => 'bulletList', 'items' => [
                                        'h1 — 24 px / 600 — page titles',
                                        'h2 — 19 px / 600 — section headers',
                                        'h3 — 16 px / 600 — card titles',
                                        'body — 14 px / 400 — default',
                                        'body-lg — 15 px / 400 — document reading view',
                                        'small — 12–13 px / 400 — meta, captions',
                                        'label — 11 px / 500–600 — uppercase labels, tag pills',
                                    ]],
                                    'See [[Design System]] for the full specification and [[Color Palette]] for text colour tokens.',
                                ],
                            ],
                            [
                                'title'    => 'Component Guidelines',
                                'position' => 3,
                                'tags'     => ['design'],
                                'content'  => [
                                    'All shared UI components live in `resources/js/components/ui`. Use these; do not write one-off variants.',
                                    ['type' => 'image', 'src' => 'https://picsum.photos/seed/components/900/400', 'alt' => 'Component library overview'],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Buttons'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Primary — `bg-sage-400` / `text-inverse` / hover `sage-500`',
                                        'Outline — `border-border` / `bg-transparent` / hover `surface-hover`',
                                        'Ghost — `transparent` / `text-primary` / hover `surface-hover`',
                                        'Destructive — `bg-danger` / `text-inverse`',
                                        'Sizes: default 36 px · sm 28 px · lg 44 px — radius-sm (8 px) always',
                                    ]],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Inputs'],
                                    ['type' => 'bulletList', 'items' => [
                                        '`bg-surface border-border rounded-sm` at rest',
                                        'Focus: `border-sage-400 ring-[3px] ring-sage-200`',
                                        'Height 36 px default; 32 px in compact contexts',
                                    ]],
                                    'See [[Design System]] for modal, card, badge, and alert patterns.',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'User Research',
                        'position' => 3,
                        'content'  => [
                            'We run periodic usability tests and stakeholder interviews. Findings are synthesised here and feed directly into the [[Product Roadmap 2026]].',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/research/900/380', 'alt' => 'User interview session'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Recurring themes (2025)'],
                            ['type' => 'bulletList', 'items' => [
                                'Users want faster search — full-text isn\'t always surfacing the right page',
                                'Mobile reading experience is poor on long documents',
                                'Tag management is hard to discover; most users rely on the Tags page',
                                'Version history is highly valued by admins',
                            ]],
                            ['type' => 'blockquote', 'text' => 'Next study scheduled for Q1 2026. Reach out to the Product team if you want to observe.'],
                        ],
                    ],
                ],
            ],

            // ── 3. Operations & HR ────────────────────────────────────────────
            [
                'name'        => 'Operations & HR',
                'description' => 'Company onboarding, policies, benefits, and office handbooks.',
                'position'    => 3,
                'pages'       => [
                    [
                        'title'    => 'Onboarding',
                        'position' => 1,
                        'tags'     => ['guide'],
                        'content'  => [
                            'Welcome to the team! This page is your starting point. Work through the checklist below during your first week.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/office/900/420', 'alt' => 'Office overview'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'First week roadmap'],
                            ['type' => 'orderedList', 'items' => [
                                'Complete the [[First Day Checklist]] (accounts, hardware, safety training)',
                                'Read [[Company Benefits]] to understand your entitlements',
                                'Attend the team intro — see [[Meet the Team]] for org chart',
                                'Engineers: follow [[Getting Started]] in the Engineering Hub',
                                'Schedule a 1:1 with your manager by end of week 1',
                            ]],
                        ],
                        'children' => [
                            [
                                'title'    => 'First Day Checklist',
                                'position' => 1,
                                'content'  => [
                                    'Work through these items on your first day. Tick each off as you go — your manager will review progress at your end-of-day check-in.',
                                    ['type' => 'bulletList', 'items' => [
                                        'Set up your laptop (IT will provide the setup guide)',
                                        'Join Slack and introduce yourself in #general',
                                        'Enable 2FA on all company accounts (GitHub, Google Workspace)',
                                        'Read and sign the remote work and data-handling policy',
                                        'Complete the 30-minute online safety training',
                                        'Add your photo and role to the team directory in [[Meet the Team]]',
                                        'Read [[Company Benefits]] — especially the learning budget section',
                                    ]],
                                    ['type' => 'blockquote', 'text' => 'Need help? Ping @hr-team in Slack or refer to [[Onboarding]] for escalation contacts.'],
                                ],
                            ],
                            [
                                'title'    => 'Meet the Team',
                                'position' => 2,
                                'content'  => [
                                    'We are organised into three teams. All contact details and roles are maintained in the [[Office Operations]] directory.',
                                    ['type' => 'image', 'src' => 'https://picsum.photos/seed/team/900/420', 'alt' => 'Team photo'],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Teams'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Engineering — backend, frontend, infrastructure, QA',
                                        'Product & Design — product management, UX, research',
                                        'Operations — HR, finance, admin, IT support',
                                    ]],
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Company Benefits',
                        'position' => 2,
                        'content'  => [
                            'We offer a comprehensive benefits package. Full details and how to claim are summarised below.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Health & wellbeing'],
                            ['type' => 'bulletList', 'items' => [
                                'Private health insurance — covers you and immediate family',
                                'Mental health support — 12 counselling sessions per year via Spill',
                                'Gym membership subsidy — up to €50/month',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Time off'],
                            ['type' => 'bulletList', 'items' => [
                                '25 days annual leave + public holidays',
                                'Flexible remote work — no fixed office days required',
                                'Parental leave — 16 weeks fully paid for primary carers',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Growth'],
                            ['type' => 'bulletList', 'items' => [
                                'Learning budget — €1,500/year for courses, books, conferences',
                                'Internal promotion pathway reviewed every 6 months',
                                'Conference talks and open-source contributions encouraged',
                            ]],
                            'For claims and reimbursements, see [[Office Operations]].',
                        ],
                    ],
                    [
                        'title'    => 'Office Operations',
                        'position' => 3,
                        'content'  => [
                            'Practical information for day-to-day office life, hardware requests, and administrative support.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Hardware requests'],
                            ['type' => 'bulletList', 'items' => [
                                'Submit a request in #it-support with the item, estimated cost, and business justification',
                                'Approved within 3 business days for items under €500',
                                'Items over €500 require manager sign-off',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Expense reimbursement'],
                            ['type' => 'bulletList', 'items' => [
                                'Submit receipts via Expensify by the last Friday of each month',
                                'Reimbursed with the following payroll run',
                                'Learning budget claims are separate — tag them as "Learning"',
                            ]],
                            'New starters: your initial setup is handled on the [[First Day Checklist]].',
                        ],
                    ],
                ],
            ],

            // ── 4. Network & Infrastructure ───────────────────────────────────
            [
                'name'        => 'Network & Infrastructure',
                'description' => 'Network topology, VLAN config, firewall rules, monitoring, and runbooks.',
                'position'    => 4,
                'pages'       => [
                    [
                        'title'    => 'Network Overview',
                        'position' => 1,
                        'tags'     => ['network', 'ops'],
                        'content'  => [
                            'This workspace covers the on-premises and cloud networking infrastructure. All changes to production network config require peer review and a change-management ticket.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/networkmap/900/480', 'alt' => 'Network topology diagram'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Site summary'],
                            ['type' => 'bulletList', 'items' => [
                                'HQ — 192.168.1.0/24 (management), 10.10.0.0/16 (servers)',
                                'Remote workers — WireGuard VPN, assigned 10.99.0.0/24',
                                'Cloud (AWS eu-west-1) — 172.16.0.0/12 VPC',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Key pages'],
                            ['type' => 'bulletList', 'items' => [
                                '[[VLANs & Subnets]] — full addressing scheme and VLAN table',
                                '[[Firewall & Security]] — rule sets and change process',
                                '[[Monitoring & Alerts]] — dashboards, alerting, and on-call runbook',
                                '[[DNS & DHCP]] — zone files, DHCP pools, and TTL policy',
                            ]],
                        ],
                        'children' => [],
                    ],
                    [
                        'title'    => 'VLANs & Subnets',
                        'position' => 2,
                        'tags'     => ['network'],
                        'content'  => [
                            'All VLANs are configured on the core Cisco Catalyst 9300 stack. Changes require a tested rollback plan and a 30-minute maintenance window.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/vlan/900/400', 'alt' => 'VLAN segmentation diagram'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'VLAN table'],
                            ['type' => 'bulletList', 'items' => [
                                'VLAN 10 — Management — 192.168.1.0/24 — switches, APs, OOB',
                                'VLAN 20 — Servers — 10.10.20.0/24 — application + DB hosts',
                                'VLAN 30 — Staff — 10.10.30.0/23 — corporate workstations',
                                'VLAN 40 — IoT — 10.10.40.0/24 — printers, displays, sensors',
                                'VLAN 50 — Guest — 10.10.50.0/24 — internet-only, isolated',
                                'VLAN 99 — Native/Trunk — untagged on uplinks',
                            ]],
                            'Detailed per-VLAN firewall policy is in [[Firewall & Security]]. IP addressing details are in [[IP Addressing Scheme]].',
                        ],
                        'children' => [
                            [
                                'title'    => 'IP Addressing Scheme',
                                'position' => 1,
                                'tags'     => ['network'],
                                'content'  => [
                                    'All static assignments are tracked here. DHCP pools are managed via ISC DHCP and documented in [[DNS & DHCP]].',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Static assignments (VLAN 20)'],
                                    ['type' => 'bulletList', 'items' => [
                                        '10.10.20.1 — Gateway (L3 switch SVI)',
                                        '10.10.20.2 — Primary DNS / DHCP server',
                                        '10.10.20.10 — PostgreSQL primary',
                                        '10.10.20.11 — PostgreSQL replica',
                                        '10.10.20.20 — Redis / Horizon',
                                        '10.10.20.30–39 — Application servers (load-balanced)',
                                        '10.10.20.50 — Monitoring (Prometheus + Grafana)',
                                    ]],
                                    ['type' => 'codeBlock', 'language' => 'bash', 'code' =>
                                        "# Verify connectivity from app server\nping -c4 10.10.20.10     # PostgreSQL primary\nping -c4 10.10.20.20     # Redis\nnmap -p 5432 10.10.20.10 # check DB port",
                                    ],
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Firewall & Security',
                        'position' => 3,
                        'tags'     => ['network', 'security'],
                        'content'  => [
                            'We run a pfSense 2.7 firewall cluster (active/passive HA) at the perimeter, plus per-VLAN ACLs on the Catalyst core switch.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/security/900/420', 'alt' => 'Firewall architecture diagram'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Default inter-VLAN policy'],
                            ['type' => 'bulletList', 'items' => [
                                'Staff → Servers: allow 80, 443, 22 (SSH via bastion only)',
                                'Staff → Management: deny all (sysadmins only)',
                                'IoT → any: deny all except NTP (UDP 123)',
                                'Guest → any internal: deny all',
                                'Servers → Internet: allow 443, 80 (HTTP via Squid proxy)',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Change process'],
                            ['type' => 'orderedList', 'items' => [
                                'Open a change-management ticket describing the rule and business justification',
                                'Get peer review from a second sysadmin',
                                'Test in staging VLAN first',
                                'Apply during maintenance window (weekdays 02:00–04:00 local)',
                                'Monitor alerts for 30 minutes post-change — see [[Monitoring & Alerts]]',
                            ]],
                            ['type' => 'codeBlock', 'language' => 'bash', 'code' =>
                                "# pfSense CLI — show active rules\npfctl -sr | grep -v '^#'\n\n# Check blocked traffic in real time\ntcpdump -i em0 -n 'tcp[tcpflags] & (tcp-rst) != 0'",
                            ],
                            ['type' => 'blockquote', 'text' => 'Never open inbound rules from the Internet without a documented risk assessment and manager sign-off.'],
                        ],
                    ],
                    [
                        'title'    => 'Monitoring & Alerts',
                        'position' => 4,
                        'tags'     => ['ops'],
                        'content'  => [
                            'We use Prometheus + Grafana for metrics and Alertmanager for routing alerts to PagerDuty and Slack.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/monitoring/900/460', 'alt' => 'Grafana dashboard overview'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Alert severity levels'],
                            ['type' => 'bulletList', 'items' => [
                                'P1 — production down or data loss risk → PagerDuty (immediate call)',
                                'P2 — degraded service, one redundant component failed → PagerDuty (15 min ack)',
                                'P3 — non-critical warning → Slack #alerts (next business day)',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Key dashboards'],
                            ['type' => 'bulletList', 'items' => [
                                'Infrastructure — CPU, memory, disk, network per host',
                                'Application — request latency p50/p95/p99, error rate, queue depth',
                                'Database — slow queries, connection pool, replication lag',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Common runbook entries'],
                            ['type' => 'orderedList', 'items' => [
                                'High DB connection count → check for query pile-up: `SELECT count(*) FROM pg_stat_activity WHERE state = \'active\';`',
                                'Redis OOM → check Horizon queue backlog and eviction policy',
                                'Disk full on app server → clear old log files and `/tmp`, alert DevOps',
                            ]],
                            'Network-level issues are covered in [[Network Overview]] and [[Firewall & Security]].',
                        ],
                    ],
                    [
                        'title'    => 'DNS & DHCP',
                        'position' => 5,
                        'tags'     => ['network'],
                        'content'  => [
                            'DNS is served by a primary + secondary BIND9 pair on VLAN 20. DHCP is handled by ISC DHCP on the same hosts. All leases are cross-registered in DNS automatically.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Zone overview'],
                            ['type' => 'bulletList', 'items' => [
                                '`internal.example.com` — all internal hostnames',
                                '`10.10.in-addr.arpa` — reverse zone for 10.10.0.0/16',
                                '`168.192.in-addr.arpa` — reverse zone for management VLAN',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'DHCP pools'],
                            ['type' => 'bulletList', 'items' => [
                                'VLAN 30 (Staff) — 10.10.30.50–10.10.30.254, lease 8 h',
                                'VLAN 40 (IoT) — 10.10.40.10–10.10.40.200, lease 24 h',
                                'VLAN 50 (Guest) — 10.10.50.10–10.10.50.250, lease 1 h',
                            ]],
                            ['type' => 'codeBlock', 'language' => 'bash', 'code' =>
                                "# Force BIND to reload zone files\nrndc reload internal.example.com\n\n# Check current DHCP leases\ncat /var/lib/dhcp/dhcpd.leases | grep 'binding state active' | wc -l",
                            ],
                            'IP addressing for static hosts is in [[IP Addressing Scheme]]. See [[Network Overview]] for the full site summary.',
                        ],
                    ],
                ],
            ],

            // ── 5. Security & Compliance ──────────────────────────────────────
            [
                'name'        => 'Security & Compliance',
                'description' => 'Security policies, incident response, access control, and data protection.',
                'position'    => 5,
                'pages'       => [
                    [
                        'title'    => 'Security Policy Overview',
                        'position' => 1,
                        'tags'     => ['security', 'policy'],
                        'content'  => [
                            'Security is everyone\'s responsibility. This page is the entry point to our policies; all staff must read it during [[Onboarding]].',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/secpolicy/900/420', 'alt' => 'Security policy overview'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Core principles'],
                            ['type' => 'bulletList', 'items' => [
                                'Least privilege — grant the minimum access needed, review quarterly',
                                'Defence in depth — no single control is trusted alone',
                                'Assume breach — log everything, alert on anomalies',
                                'Encrypt in transit and at rest — TLS everywhere, encrypted disks',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Policy index'],
                            ['type' => 'bulletList', 'items' => [
                                '[[Access Control Policy]] — who gets access to what',
                                '[[Password & MFA Policy]] — credential requirements',
                                '[[Data Protection & GDPR]] — handling personal data',
                                '[[Incident Response]] — what to do when something goes wrong',
                            ]],
                            ['type' => 'blockquote', 'text' => 'Report anything suspicious to #security immediately. Better a false alarm than a missed breach.'],
                        ],
                        'children' => [
                            [
                                'title'    => 'Access Control Policy',
                                'position' => 1,
                                'tags'     => ['security', 'policy'],
                                'content'  => [
                                    'Access to systems is granted by role and reviewed every quarter. All access requests go through the IT team and require manager approval.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Access tiers'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Standard — email, chat, docs (this app), shared drives',
                                        'Elevated — production read access, monitoring dashboards',
                                        'Privileged — production write, database, infrastructure (sysadmins only)',
                                    ]],
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Offboarding'],
                                    ['type' => 'orderedList', 'items' => [
                                        'Disable SSO account within 1 hour of departure',
                                        'Revoke all API tokens and SSH keys',
                                        'Rotate any shared secrets the person had access to',
                                        'Reassign owned documents and resources',
                                    ]],
                                    'Credential standards are defined in [[Password & MFA Policy]].',
                                ],
                            ],
                            [
                                'title'    => 'Password & MFA Policy',
                                'position' => 2,
                                'tags'     => ['security', 'policy'],
                                'content'  => [
                                    'Strong, unique credentials with multi-factor authentication are mandatory on every company account.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Requirements'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Minimum 14 characters, generated by a password manager',
                                        'Unique per service — never reuse passwords',
                                        'MFA enabled everywhere it is supported (TOTP or hardware key)',
                                        'Hardware security keys required for privileged access',
                                    ]],
                                    ['type' => 'blockquote', 'text' => 'SMS-based MFA is discouraged — prefer TOTP apps or hardware keys where possible.'],
                                    'Who qualifies for privileged access is covered in [[Access Control Policy]].',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Incident Response',
                        'position' => 2,
                        'tags'     => ['security', 'incident'],
                        'content'  => [
                            'When a security or availability incident occurs, follow this process. Speed and clear communication matter more than perfection.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/incident/900/420', 'alt' => 'Incident response flow'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Severity & response'],
                            ['type' => 'bulletList', 'items' => [
                                'SEV1 — active breach or full outage → page on-call, open war room',
                                'SEV2 — partial outage or contained breach → notify #security, assign lead',
                                'SEV3 — minor, no customer impact → ticket, handle in business hours',
                            ]],
                            'The step-by-step runbook is in [[Incident Runbook]]. After resolution, always complete a [[Post-Mortem Template]]. Infrastructure alerting is described in [[Monitoring & Alerts]].',
                        ],
                        'children' => [
                            [
                                'title'    => 'Incident Runbook',
                                'position' => 1,
                                'tags'     => ['incident', 'ops'],
                                'content'  => [
                                    'Follow these steps for any SEV1 or SEV2. Assign one Incident Lead — they coordinate, others execute.',
                                    ['type' => 'orderedList', 'items' => [
                                        'Declare the incident in #incidents and assign an Incident Lead',
                                        'Contain — isolate affected hosts, revoke compromised credentials',
                                        'Assess scope — what data/systems are affected? See [[Firewall & Security]]',
                                        'Communicate — post status updates every 30 minutes',
                                        'Eradicate & recover — remove the cause, restore from known-good',
                                        'Close — confirm resolution, schedule the post-mortem',
                                    ]],
                                    ['type' => 'codeBlock', 'language' => 'bash', 'code' =>
                                        "# Quickly isolate a compromised host at the firewall\npfctl -t blocklist -T add 10.10.20.34\n\n# Snapshot logs before they rotate\njournalctl --since '1 hour ago' > /var/incident/\$(date +%s).log",
                                    ],
                                    ['type' => 'blockquote', 'text' => 'Preserve evidence before remediating where feasible — snapshot disks and logs first.'],
                                ],
                            ],
                            [
                                'title'    => 'Post-Mortem Template',
                                'position' => 2,
                                'tags'     => ['incident'],
                                'content'  => [
                                    'Every SEV1/SEV2 gets a blameless post-mortem within 5 business days. Focus on systems and process, never individuals.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Sections to fill in'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Summary — what happened, in two sentences',
                                        'Impact — who/what was affected and for how long',
                                        'Timeline — detection → resolution, with timestamps',
                                        'Root cause — the underlying system failure',
                                        'Action items — concrete fixes with owners and due dates',
                                    ]],
                                    'Link the originating alert and the [[Incident Runbook]] steps that were followed.',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Data Protection & GDPR',
                        'position' => 3,
                        'tags'     => ['compliance', 'policy'],
                        'content'  => [
                            'We process personal data lawfully, transparently, and only for clear purposes. This page summarises our obligations under GDPR.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/gdpr/900/400', 'alt' => 'Data protection overview'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Key obligations'],
                            ['type' => 'bulletList', 'items' => [
                                'Lawful basis — document why we hold each category of data',
                                'Data minimisation — collect only what is needed',
                                'Right to erasure — handle deletion requests within 30 days',
                                'Breach notification — report qualifying breaches within 72 hours',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Subject access requests'],
                            ['type' => 'orderedList', 'items' => [
                                'Verify the requester\'s identity',
                                'Locate all personal data held about them',
                                'Provide a copy in a portable format within one month',
                                'Log the request and response for audit',
                            ]],
                            'Breaches involving personal data also trigger [[Incident Response]].',
                        ],
                    ],
                    [
                        'title'    => 'Backup & Disaster Recovery',
                        'position' => 4,
                        'tags'     => ['ops', 'security'],
                        'content'  => [
                            'We follow a 3-2-1 backup strategy and test restores quarterly. An untested backup is not a backup.',
                            ['type' => 'heading', 'level' => 2, 'text' => '3-2-1 strategy'],
                            ['type' => 'bulletList', 'items' => [
                                '3 copies of data — production + two backups',
                                '2 different media — local NAS + cloud object storage',
                                '1 copy off-site — encrypted, in a different region',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Recovery objectives'],
                            ['type' => 'bulletList', 'items' => [
                                'RPO (max data loss) — 1 hour for the primary database',
                                'RTO (max downtime) — 4 hours for full service restoration',
                            ]],
                            ['type' => 'codeBlock', 'language' => 'bash', 'code' =>
                                "# Nightly encrypted Postgres backup\npg_dump -Fc app_production | age -r \$BACKUP_KEY > /backups/app-\$(date +%F).dump.age\n\n# Test restore into a scratch database\nage -d -i key.txt /backups/app-2026-06-20.dump.age | pg_restore -d app_restore_test",
                            ],
                            ['type' => 'blockquote', 'text' => 'Restore drills are run on the first Monday of each quarter. Results are recorded in this workspace.'],
                        ],
                    ],
                ],
            ],

            // ── 6. Customer Support ───────────────────────────────────────────
            [
                'name'        => 'Customer Support',
                'description' => 'Support handbook, ticket triage, escalation paths, and the customer FAQ.',
                'position'    => 6,
                'pages'       => [
                    [
                        'title'    => 'Support Handbook',
                        'position' => 1,
                        'tags'     => ['support', 'guide'],
                        'content'  => [
                            'Our support team is the voice of the customer. Be empathetic, be accurate, and never guess — escalate when unsure.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/support/900/420', 'alt' => 'Support team at work'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Principles'],
                            ['type' => 'bulletList', 'items' => [
                                'Acknowledge fast — a quick "we\'re on it" beats a slow perfect answer',
                                'Reproduce before escalating — gather steps, screenshots, account ID',
                                'Close the loop — confirm the fix worked before resolving',
                                'Write it down — recurring issues belong in [[Common Issues & FAQ]]',
                            ]],
                            'New tickets are handled per [[Ticket Triage]]. When something is beyond first-line, follow the [[Escalation Matrix]].',
                        ],
                        'children' => [
                            [
                                'title'    => 'Ticket Triage',
                                'position' => 1,
                                'tags'     => ['support'],
                                'content'  => [
                                    'Every incoming ticket is triaged within the response targets in [[SLA & Response Times]]. Categorise, prioritise, then assign.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Priority guide'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Urgent — customer cannot work, no workaround → escalate immediately',
                                        'High — major feature broken, workaround exists',
                                        'Normal — minor bug or how-to question',
                                        'Low — feature request or cosmetic issue',
                                    ]],
                                    ['type' => 'blockquote', 'text' => 'When in doubt about a technical root cause, open an [[Incident Response]] check rather than sitting on it.'],
                                ],
                            ],
                            [
                                'title'    => 'Escalation Matrix',
                                'position' => 2,
                                'tags'     => ['support', 'policy'],
                                'content'  => [
                                    'Escalate when an issue exceeds first-line scope or breaches its SLA. Always include reproduction steps and the account ID.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Escalation paths'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Billing question → Finance team (see [[Invoicing Process]])',
                                        'Suspected bug → Engineering on-call via #eng-support',
                                        'Outage / data issue → trigger [[Incident Response]]',
                                        'Security report → #security immediately',
                                    ]],
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Common Issues & FAQ',
                        'position' => 2,
                        'tags'     => ['support'],
                        'content'  => [
                            'A living list of the questions we answer most. Keep it updated — if you answer the same thing twice, add it here.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Account & login'],
                            ['type' => 'bulletList', 'items' => [
                                'Reset password — Settings → Profile → Change password',
                                'Locked out — confirm identity, then IT re-enables the SSO account',
                                'MFA device lost — follow recovery in [[Password & MFA Policy]]',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Documents'],
                            ['type' => 'bulletList', 'items' => [
                                'Restore a deleted page — admins use the Trash view',
                                'See older content — open a page\'s version history',
                                'Export to PDF/DOCX — use the export menu on any document',
                            ]],
                            ['type' => 'blockquote', 'text' => 'Found a gap? Add the question and answer here so the whole team benefits.'],
                        ],
                    ],
                    [
                        'title'    => 'SLA & Response Times',
                        'position' => 3,
                        'tags'     => ['support', 'policy'],
                        'content'  => [
                            'Our service-level targets by priority. These are commitments to customers — protect them.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Targets'],
                            ['type' => 'bulletList', 'items' => [
                                'Urgent — first response 1 h, resolution target 4 h',
                                'High — first response 4 h, resolution target 1 business day',
                                'Normal — first response 1 business day, resolution 3 business days',
                                'Low — first response 2 business days, best-effort resolution',
                            ]],
                            'Triage decisions that affect these timers are described in [[Ticket Triage]].',
                        ],
                    ],
                ],
            ],

            // ── 7. Sales & Marketing ──────────────────────────────────────────
            [
                'name'        => 'Sales & Marketing',
                'description' => 'Sales playbooks, brand guidelines, and the content calendar.',
                'position'    => 7,
                'pages'       => [
                    [
                        'title'    => 'Sales Playbook',
                        'position' => 1,
                        'tags'     => ['sales', 'guide'],
                        'content'  => [
                            'How we sell: consultative, honest, and focused on the customer\'s problem. We win by being genuinely useful, not pushy.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/sales/900/420', 'alt' => 'Sales pipeline board'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Pipeline stages'],
                            ['type' => 'orderedList', 'items' => [
                                'Lead — inbound or outbound contact identified',
                                'Discovery — understand the need (see [[Discovery Calls]])',
                                'Demo — tailored to the problems uncovered',
                                'Proposal — scope and price (see [[Pricing & Quotes]])',
                                'Close — contract signed, handed to onboarding',
                            ]],
                            'All customer-facing material must follow the [[Brand Guidelines]].',
                        ],
                        'children' => [
                            [
                                'title'    => 'Discovery Calls',
                                'position' => 1,
                                'tags'     => ['sales'],
                                'content'  => [
                                    'Discovery is about listening, not pitching. Aim for the customer to talk 70% of the time.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Questions to ask'],
                                    ['type' => 'bulletList', 'items' => [
                                        'What does your current process look like?',
                                        'Where does it break down or cost you time?',
                                        'What happens if you do nothing?',
                                        'Who else is involved in this decision?',
                                    ]],
                                    ['type' => 'blockquote', 'text' => 'Log every answer in the CRM the same day — memory fades fast.'],
                                ],
                            ],
                            [
                                'title'    => 'Pricing & Quotes',
                                'position' => 2,
                                'tags'     => ['sales', 'finance'],
                                'content'  => [
                                    'Pricing is per-seat with volume tiers. Discounts above 15% require sales-lead approval.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Tiers'],
                                    ['type' => 'bulletList', 'items' => [
                                        'Starter — up to 10 seats, monthly billing',
                                        'Team — 11–50 seats, annual billing, priority support',
                                        'Business — 50+ seats, custom terms, dedicated contact',
                                    ]],
                                    'Once signed, billing setup follows the [[Invoicing Process]].',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Brand Guidelines',
                        'position' => 2,
                        'tags'     => ['marketing', 'design'],
                        'content'  => [
                            'Our brand is calm, confident, and human. Warm tones, generous space, no hype.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/brand/900/420', 'alt' => 'Brand mood board'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Voice'],
                            ['type' => 'bulletList', 'items' => [
                                'Plain language — explain, don\'t impress',
                                'Active voice and short sentences',
                                'Confident, never arrogant; helpful, never salesy',
                            ]],
                            'Visual tokens (colour, type) align with the product\'s [[Design System]] and [[Color Palette]].',
                        ],
                    ],
                    [
                        'title'    => 'Content Calendar',
                        'position' => 3,
                        'tags'     => ['marketing'],
                        'content'  => [
                            'We publish consistently rather than sporadically. One substantial piece per week beats five rushed ones.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Cadence'],
                            ['type' => 'bulletList', 'items' => [
                                'Mondays — blog post or changelog',
                                'Wednesdays — social highlights and customer stories',
                                'Fridays — newsletter (every other week)',
                            ]],
                            ['type' => 'blockquote', 'text' => 'Draft in this workspace, get one review, then schedule. Themes tie back to the [[Product Roadmap 2026]].'],
                        ],
                    ],
                ],
            ],

            // ── 8. Finance & Legal ────────────────────────────────────────────
            [
                'name'        => 'Finance & Legal',
                'description' => 'Expenses, procurement, invoicing, contracts, and vendor management.',
                'position'    => 8,
                'pages'       => [
                    [
                        'title'    => 'Expense & Procurement',
                        'position' => 1,
                        'tags'     => ['finance', 'policy'],
                        'content'  => [
                            'How to spend company money responsibly. When unsure whether something is reimbursable, ask before you buy.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'Approval thresholds'],
                            ['type' => 'bulletList', 'items' => [
                                'Under €100 — no pre-approval, just submit the receipt',
                                '€100–€500 — manager approval required',
                                'Over €500 — manager + finance sign-off, raise a PO',
                            ]],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Submitting expenses'],
                            ['type' => 'orderedList', 'items' => [
                                'Photograph the receipt at point of purchase',
                                'Submit via Expensify by the last Friday of the month',
                                'Categorise correctly (travel, software, learning, etc.)',
                                'Reimbursed with the next payroll run',
                            ]],
                            'Hardware requests are also covered operationally in [[Office Operations]].',
                        ],
                    ],
                    [
                        'title'    => 'Invoicing Process',
                        'position' => 2,
                        'tags'     => ['finance'],
                        'content'  => [
                            'How we invoice customers and track payment. Accuracy here protects cash flow and trust.',
                            ['type' => 'image', 'src' => 'https://picsum.photos/seed/invoice/900/380', 'alt' => 'Invoicing workflow'],
                            ['type' => 'heading', 'level' => 2, 'text' => 'Cycle'],
                            ['type' => 'orderedList', 'items' => [
                                'Contract signed → finance creates the customer record',
                                'Invoice raised on the billing date (see [[Pricing & Quotes]])',
                                'Sent automatically with a 14-day due window',
                                'Reconciled against the bank feed weekly',
                            ]],
                            'Payment expectations are detailed in [[Payment Terms]].',
                        ],
                        'children' => [
                            [
                                'title'    => 'Payment Terms',
                                'position' => 1,
                                'tags'     => ['finance', 'legal'],
                                'content'  => [
                                    'Standard terms are net-14. Longer terms require finance approval and must be written into the contract.',
                                    ['type' => 'heading', 'level' => 2, 'text' => 'Dunning process'],
                                    ['type' => 'orderedList', 'items' => [
                                        'Day 0 — invoice sent',
                                        'Day 15 — friendly reminder if unpaid',
                                        'Day 30 — second notice, pause non-critical service',
                                        'Day 45 — escalate to the account owner and legal',
                                    ]],
                                    'Vendor-side agreements are tracked in [[Contracts & Vendor Management]].',
                                ],
                            ],
                        ],
                    ],
                    [
                        'title'    => 'Contracts & Vendor Management',
                        'position' => 3,
                        'tags'     => ['legal'],
                        'content'  => [
                            'A central record of who we have agreements with, key dates, and renewal status. Nothing should auto-renew unnoticed.',
                            ['type' => 'heading', 'level' => 2, 'text' => 'For every contract, track'],
                            ['type' => 'bulletList', 'items' => [
                                'Counterparty and primary contact',
                                'Start date, term, and notice period',
                                'Renewal date and whether it auto-renews',
                                'Annual cost and payment terms',
                                'Where the signed copy is stored',
                            ]],
                            ['type' => 'blockquote', 'text' => 'Set a reminder 60 days before every renewal date so we never miss a notice window.'],
                            'Any vendor handling personal data must meet the standards in [[Data Protection & GDPR]].',
                        ],
                    ],
                ],
            ],
        ];

        // ── Seeding logic ─────────────────────────────────────────────────────
        foreach ($workspacesData as $wData) {
            $workspace = Workspace::create([
                'name'        => $wData['name'],
                'description' => $wData['description'],
                'position'    => $wData['position'],
            ]);

            foreach ($wData['pages'] as $pageData) {
                $this->createPage($workspace->id, $pageData, null, $admin->id, $tags);
            }
        }

        // Re-resolve wiki-links created before their target document existed
        $this->command->info('Syncing wiki-links across seeded pages...');
        \App\Models\Link::whereNull('target_document_id')
            ->get()
            ->each(function ($link) {
                $target = Document::where('title', $link->target_title)->first();
                if ($target) {
                    $link->update(['target_document_id' => $target->id]);
                }
            });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    protected function createPage(int $workspaceId, array $pageData, ?int $parentId, int $adminId, array $tags): void
    {
        $document = Document::create([
            'workspace_id'   => $workspaceId,
            'parent_id'      => $parentId,
            'title'          => $pageData['title'],
            'position'       => $pageData['position'],
            'content'        => $this->buildContent($pageData['content']),
            'created_by_id'  => $adminId,
            'updated_by_id'  => $adminId,
        ]);

        foreach ($pageData['tags'] ?? [] as $tagKey) {
            if (isset($tags[$tagKey])) {
                $document->tags()->attach($tags[$tagKey]->id);
            }
        }

        foreach ($pageData['children'] ?? [] as $childData) {
            $this->createPage($workspaceId, $childData, $document->id, $adminId, $tags);
        }
    }

    protected function buildContent(array $items): array
    {
        $nodes = [];
        foreach ($items as $item) {
            $nodes[] = is_string($item)
                ? $this->paragraph($item)
                : $this->block($item);
        }
        return ['type' => 'doc', 'content' => $nodes];
    }

    protected function block(array $item): array
    {
        return match ($item['type']) {
            'heading'       => $this->heading($item['level'], $item['text']),
            'image'         => $this->image($item['src'], $item['alt'] ?? null),
            'bulletList'    => $this->list('bulletList', $item['items']),
            'orderedList'   => $this->list('orderedList', $item['items']),
            'codeBlock'     => $this->codeBlock($item['language'] ?? null, $item['code']),
            'blockquote'    => $this->blockquote($item['text']),
            'horizontalRule' => ['type' => 'horizontalRule'],
            default         => $this->paragraph((string) ($item['text'] ?? '')),
        };
    }

    protected function paragraph(string $text): array
    {
        return ['type' => 'paragraph', 'content' => $this->inline($text)];
    }

    protected function heading(int $level, string $text): array
    {
        return [
            'type'    => 'heading',
            'attrs'   => ['level' => $level],
            'content' => [['type' => 'text', 'text' => $text]],
        ];
    }

    protected function image(string $src, ?string $alt): array
    {
        return [
            'type'  => 'image',
            'attrs' => ['src' => $src, 'alt' => $alt, 'title' => null, 'width' => null, 'align' => 'left'],
        ];
    }

    protected function list(string $type, array $items): array
    {
        $attrs = $type === 'orderedList' ? ['attrs' => ['start' => 1]] : [];
        return array_merge(
            ['type' => $type],
            $attrs,
            ['content' => array_map(fn ($text) => [
                'type'    => 'listItem',
                'content' => [['type' => 'paragraph', 'content' => $this->inline($text)]],
            ], $items)],
        );
    }

    protected function codeBlock(?string $language, string $code): array
    {
        return [
            'type'    => 'codeBlock',
            'attrs'   => ['language' => $language],
            'content' => [['type' => 'text', 'text' => $code]],
        ];
    }

    protected function blockquote(string $text): array
    {
        return [
            'type'    => 'blockquote',
            'content' => [['type' => 'paragraph', 'content' => $this->inline($text)]],
        ];
    }

    protected function inline(string $text): array
    {
        // Parse [[wiki-links]] and `inline code` within a string
        $parts = preg_split('/(\[\[[^\[\]]+\]\]|`[^`]+`)/', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
        $nodes = [];
        foreach ($parts as $part) {
            if (preg_match('/^\[\[([^\[\]]+)\]\]$/', $part, $m)) {
                $nodes[] = ['type' => 'wikiLink', 'attrs' => ['title' => trim($m[1])]];
            } elseif (preg_match('/^`([^`]+)`$/', $part, $m)) {
                $nodes[] = ['type' => 'text', 'text' => $m[1], 'marks' => [['type' => 'code']]];
            } elseif ($part !== '') {
                $nodes[] = ['type' => 'text', 'text' => $part];
            }
        }
        return $nodes ?: [['type' => 'text', 'text' => '']];
    }
}
