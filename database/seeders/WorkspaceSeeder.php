<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use App\Models\Document;
use App\Models\Tag;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WorkspaceSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Ensure we have an admin/editor user
        $admin = User::first() ?? User::factory()->create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
        ]);

        // 2. Create Tags
        $tags = [
            'guide' => Tag::firstOrCreate(['name' => 'Guide']),
            'style' => Tag::firstOrCreate(['name' => 'Style']),
            'design' => Tag::firstOrCreate(['name' => 'Design']),
            'setup' => Tag::firstOrCreate(['name' => 'Setup']),
        ];

        // 3. Define Workspaces and their hierarchical Pages
        $workspacesData = [
            [
                'name' => 'Engineering Hub',
                'description' => 'Documentation about coding guidelines, dev setup, architecture, and deployment procedures.',
                'position' => 1,
                'pages' => [
                    [
                        'title' => 'Getting Started',
                        'position' => 1,
                        'tags' => ['guide'],
                        'paragraphs' => [
                            'Welcome to the Engineering Hub! Make sure you follow the [[Local Environment Setup]] guide to get your local development server running.',
                            'We also recommend setting up your editor with the recommended [[IDE Settings]]. For coding styles, please refer to the [[PHP & Laravel Style]] and [[React & Tailwind Style]] guides.',
                            'Before launching anything, consult the [[Deployment Guide]] to understand our release pipeline.'
                        ],
                        'children' => [
                            [
                                'title' => 'Local Environment Setup',
                                'position' => 1,
                                'tags' => ['setup'],
                                'paragraphs' => [
                                    'Setting up your local environment is straightforward. First install Docker on your machine, then run `composer install` and `npm install` in the project root.',
                                    'Make sure your `.env` configuration file matches the settings detailed in the [[Getting Started]] root page.',
                                    'Once configured, run `php artisan migrate` to run database migrations, and use `npm run dev` to start Vite. For styling, we use Tailwind, matching our [[React & Tailwind Style]] code style guidelines.'
                                ]
                            ],
                            [
                                'title' => 'IDE Settings',
                                'position' => 2,
                                'tags' => ['setup'],
                                'paragraphs' => [
                                    'We recommend VS Code or PhpStorm for local application development.',
                                    'Please install the Prettier, ESLint, and Laravel Idea plugins. Enable format-on-save for consistent styling, matching our [[PHP & Laravel Style]] rules.'
                                ]
                            ]
                        ]
                    ],
                    [
                        'title' => 'Architecture Overview',
                        'position' => 2,
                        'paragraphs' => [
                            'This section describes the application architecture. Our system utilizes a standard Laravel backend architecture with an Inertia.js React frontend.',
                            'Database schemas and relational designs are detailed in the [[Database Schema & Design]] page.',
                            'Background processes and asynchronous events are managed by the [[Queue Systems]]. Refer back to [[Getting Started]] if you haven\'t set up your environment.'
                        ],
                        'children' => [
                            [
                                'title' => 'Database Schema & Design',
                                'position' => 1,
                                'paragraphs' => [
                                    'We use PostgreSQL for storage. Our schema consists of workspaces, documents (representing pages), document versions, tags, links, and users.',
                                    'The dynamic document body is stored as JSON to support the TipTap editor. Check [[Architecture Overview]] for information on how queues interact with transactions.'
                                ]
                            ],
                            [
                                'title' => 'Queue Systems',
                                'position' => 2,
                                'paragraphs' => [
                                    'We use Redis as our queue connection. Long-running tasks like converting uploaded documents or processing media are dispatched as background jobs.',
                                    'See [[Architecture Overview]] for design details and job dispatching guidelines.'
                                ]
                            ]
                        ]
                    ],
                    [
                        'title' => 'Code Style Guidelines',
                        'position' => 3,
                        'tags' => ['style'],
                        'paragraphs' => [
                            'To keep our codebase clean, readable, and maintainable, we enforce strict guidelines.',
                            'Make sure you read the backend rules in [[PHP & Laravel Style]] and frontend guidelines in [[React & Tailwind Style]]. Your editor should be set up as outlined in [[IDE Settings]].'
                        ],
                        'children' => [
                            [
                                'title' => 'PHP & Laravel Style',
                                'position' => 1,
                                'tags' => ['style'],
                                'paragraphs' => [
                                    'We follow PSR-12 and Laravel\'s Pint defaults. Avoid heavy controller logic; use Service classes or Action classes for complex logic.',
                                    'Read [[Database Schema & Design]] for Eloquent conventions.'
                                ]
                            ],
                            [
                                'title' => 'React & Tailwind Style',
                                'position' => 2,
                                'tags' => ['style'],
                                'paragraphs' => [
                                    'We use React 19 and Tailwind CSS 4.0. Keep components small, functional, and reusable.',
                                    'Avoid inline styling where possible; use Tailwind classes. For consistent design, follow the guidelines in the Product workspace\'s [[Design System]].'
                                ]
                            ]
                        ]
                    ],
                    [
                        'title' => 'Deployment Guide',
                        'position' => 4,
                        'tags' => ['guide'],
                        'paragraphs' => [
                            'Deployments are automated via GitHub Actions. When a PR is merged into main, the build pipeline runs tests, compiles frontend assets (Vite), and deploys to staging.',
                            'If staging is verified, the same release can be promoted to production. Read [[Getting Started]] for information on the local build configuration.'
                        ]
                    ]
                ]
            ],
            [
                'name' => 'Product & Design',
                'description' => 'Product roadmaps, UI/UX guidelines, design systems, and user research.',
                'position' => 2,
                'pages' => [
                    [
                        'title' => 'Product Roadmap 2026',
                        'position' => 1,
                        'paragraphs' => [
                            'Our product vision for 2026 focuses on real-time collaborative editing and robust document importing.',
                            'For design specifications, see the [[Design System]] guidelines. Feedback is collected through the channels described in [[User Research]].'
                        ]
                    ],
                    [
                        'title' => 'Design System',
                        'position' => 2,
                        'tags' => ['design'],
                        'paragraphs' => [
                            'Welcome to our Design System. It defines standard color patterns, spacing, and interaction styles.',
                            'Refer to the [[Color Palette]] and [[Typography]] rules. Ensure all interactive parts follow the [[Component Guidelines]]. Frontend styling should be implemented as detailed in [[React & Tailwind Style]].'
                        ],
                        'children' => [
                            [
                                'title' => 'Color Palette',
                                'position' => 1,
                                'tags' => ['design'],
                                'paragraphs' => [
                                    'We use a sage-green primary theme with refined neutral shades. Focus colors are configured in the tailwind configuration file.',
                                    'Make sure to use these semantic variables for theme consistency. Check the [[Design System]] root page for usage examples.'
                                ]
                            ],
                            [
                                'title' => 'Typography',
                                'position' => 2,
                                'tags' => ['design', 'style'],
                                'paragraphs' => [
                                    'We use Inter as our primary typeface. Heading sizes, line heights, and font weights are strict.',
                                    'See [[Design System]] for the scale layout details.'
                                ]
                            ],
                            [
                                'title' => 'Component Guidelines',
                                'position' => 3,
                                'tags' => ['design'],
                                'paragraphs' => [
                                    'All common UI components (buttons, input fields, modals, cards) are defined in `resources/js/components/ui`.',
                                    'Developers should reuse these rather than writing custom variants. See [[Design System]] for full specifications.'
                                ]
                            ]
                        ]
                    ],
                    [
                        'title' => 'User Research',
                        'position' => 3,
                        'paragraphs' => [
                            'We conduct periodic interviews and usability testing sessions. Synthesis of these results is published here.',
                            'User research drives updates in the [[Product Roadmap 2026]].'
                        ]
                    ]
                ]
            ],
            [
                'name' => 'Operations & HR',
                'description' => 'Company onboarding, policies, benefits, and office handbooks.',
                'position' => 3,
                'pages' => [
                    [
                        'title' => 'Onboarding',
                        'position' => 1,
                        'tags' => ['guide'],
                        'paragraphs' => [
                            'Welcome to the company! Please make sure to complete your [[First Day Checklist]] to set up your accounts and equipment.',
                            'During your first week, you will meet the team (details in [[Meet the Team]]). If you are an engineer, please also refer to the [[Getting Started]] guide in the Engineering Hub.'
                        ],
                        'children' => [
                            [
                                'title' => 'First Day Checklist',
                                'position' => 1,
                                'paragraphs' => [
                                    'Your first day tasks include: 1. Set up your computer. 2. Join our messaging app. 3. Read the [[Company Benefits]] page. 4. Complete safety training. 5. Introduce yourself in the general channel!',
                                    'Reference the [[Onboarding]] root page for assistance.'
                                ]
                            ],
                            [
                                'title' => 'Meet the Team',
                                'position' => 2,
                                'paragraphs' => [
                                    'We are organized into Engineering, Product, and Operations. Get to know everyone! Contact details and roles are listed in the [[Office Operations]] directory.'
                                ]
                            ]
                        ]
                    ],
                    [
                        'title' => 'Company Benefits',
                        'position' => 2,
                        'paragraphs' => [
                            'We offer comprehensive health insurance, flexible paid time off, and learning budgets.',
                            'Details on how to submit claims are listed in [[Office Operations]].'
                        ]
                    ],
                    [
                        'title' => 'Office Operations',
                        'position' => 3,
                        'paragraphs' => [
                            'Guidelines for office visits, hardware requests, and administrative support.',
                            'For remote workers, hardware request instructions are listed on the [[First Day Checklist]].'
                        ]
                    ]
                ]
            ]
        ];

        // 4. Seeding Logic
        foreach ($workspacesData as $wData) {
            $workspace = Workspace::create([
                'name' => $wData['name'],
                'description' => $wData['description'],
                'position' => $wData['position'],
            ]);

            foreach ($wData['pages'] as $pageData) {
                $this->createPage($workspace->id, $pageData, null, $admin->id, $tags);
            }
        }

        // 5. Link resolution: the observer only resolves targets for documents that
        // existed when each page was first saved. Re-resolve any that were created
        // before their target page existed.
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

    protected function createPage(int $workspaceId, array $pageData, ?int $parentId, int $adminId, array $tags): void
    {
        $document = Document::create([
            'workspace_id' => $workspaceId,
            'parent_id' => $parentId,
            'title' => $pageData['title'],
            'position' => $pageData['position'],
            'content' => $this->buildTipTapContent($pageData['paragraphs']),
            'created_by_id' => $adminId,
            'updated_by_id' => $adminId,
        ]);

        if (!empty($pageData['tags'])) {
            foreach ($pageData['tags'] as $tagKey) {
                if (isset($tags[$tagKey])) {
                    $document->tags()->attach($tags[$tagKey]->id);
                }
            }
        }

        if (!empty($pageData['children'])) {
            foreach ($pageData['children'] as $childData) {
                $this->createPage($workspaceId, $childData, $document->id, $adminId, $tags);
            }
        }
    }

    protected function buildTipTapContent(array $paragraphs): array
    {
        $content = [];
        foreach ($paragraphs as $paragraph) {
            $content[] = [
                'type' => 'paragraph',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => $paragraph,
                    ]
                ]
            ];
        }
        return [
            'type' => 'doc',
            'content' => $content,
        ];
    }
}
