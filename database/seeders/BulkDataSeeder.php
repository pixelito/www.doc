<?php

namespace Database\Seeders;

use App\Models\ConversionJob;
use App\Models\Document;
use App\Models\Tag;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceGroup;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * High-volume dummy data on top of the hand-authored WorkspaceSeeder content.
 *
 * WorkspaceSeeder gives a small, curated, realistic set. This seeder piles on
 * bulk factory data so the UI can be exercised under load: long sidebars, groups
 * with many (and few) workspaces, deep-ish document trees, pages with lots of
 * versions/attachments/tags, and a spread of conversion-job states.
 *
 * Everything is attributed to real seeded authors (admins + editors) so the
 * DocumentObserver stamps created_by/updated_by and version snapshots correctly.
 * Runs AFTER WorkspaceSeeder so it can reuse its groups and tags.
 */
class BulkDataSeeder extends Seeder
{
    public function run(): void
    {
        $authorIds = User::role(['admin', 'editor'])->pluck('id')->all()
            ?: User::pluck('id')->all();

        if (empty($authorIds)) {
            $this->command->warn('BulkDataSeeder: no users found, skipping.');

            return;
        }

        // ── Extra tags (reuse the curated set, add some noise for filtering) ────
        $tags = Tag::all();
        $tags = $tags->merge(Tag::factory()->count(8)->create());

        // ── Extra groups ───────────────────────────────────────────────────────
        // Groups and ungrouped workspaces share ONE top-level position space
        // (that's what makes them interleave), so a single $topPos counter feeds
        // both — continuing past whatever WorkspaceSeeder already placed. "Archive"
        // is left sparse on purpose so a near-empty group state is represented.
        $topPos = max(
            (int) WorkspaceGroup::max('position'),
            (int) Workspace::whereNull('group_id')->max('position'),
        ) + 1;

        $rnd = WorkspaceGroup::create(['name' => 'Research & Development', 'position' => $topPos++]);
        $archive = WorkspaceGroup::create(['name' => 'Archive', 'position' => $topPos++]);

        // Buckets to file bulk workspaces into: every existing group, the two new
        // ones, plus `null` (ungrouped / top level) a couple of times over so a
        // healthy share stay ungrouped and land interleaved among the groups.
        $buckets = WorkspaceGroup::pluck('id')->all();
        $buckets = array_merge($buckets, [null, null, null]);

        $this->command->info('Generating bulk workspaces and documents...');

        // Per-group member position, seeded from each group's current max so bulk
        // members append after WorkspaceSeeder's.
        $memberPos = [];

        // 14 extra workspaces. Archive gets a single lonely workspace; the rest
        // are spread across the buckets round-robin-ish via random pick.
        $count = 14;
        for ($i = 0; $i < $count; $i++) {
            $groupId = $i === 0 ? $archive->id : $buckets[array_rand($buckets)];

            if ($groupId === null) {
                $position = $topPos++;   // shared top-level slot, interleaved with groups
            } else {
                $memberPos[$groupId] ??= (int) Workspace::where('group_id', $groupId)->max('position');
                $position = ++$memberPos[$groupId];
            }

            $workspace = Workspace::factory()->create([
                'group_id' => $groupId,
                'position' => $position,
            ]);

            $this->fillWorkspace($workspace, $authorIds, $tags);
        }

        auth()->logout();

        // ── Stars & recently-viewed volume ─────────────────────────────────────
        // Spread interactions across the whole corpus (not just the first pages)
        // so "Starred" and "Recently viewed" surfaces have realistic depth.
        $this->command->info('Seeding stars and recently-viewed history in bulk...');
        $docIds = Document::pluck('id');
        foreach (User::all() as $user) {
            $starred = $docIds->random(min(rand(3, 8), $docIds->count()));
            foreach ($starred as $docId) {
                DB::table('document_user')->updateOrInsert(
                    ['user_id' => $user->id, 'document_id' => $docId],
                    ['starred_at' => now()->subDays(rand(0, 30))]
                );
            }

            $viewed = $docIds->random(min(rand(8, 20), $docIds->count()));
            foreach ($viewed as $docId) {
                DB::table('document_user')->updateOrInsert(
                    ['user_id' => $user->id, 'document_id' => $docId],
                    ['last_viewed_at' => now()->subMinutes(rand(1, 20160))]
                );
            }
        }

        $this->command->info("BulkDataSeeder: +{$count} workspaces, "
            .Document::count().' documents total.');
    }

    /** Populate a workspace with a spread of root pages, some with children. */
    protected function fillWorkspace(Workspace $workspace, array $authorIds, $tags): void
    {
        $rootCount = rand(4, 10);

        for ($p = 1; $p <= $rootCount; $p++) {
            $root = $this->makeDocument($workspace->id, null, $p, $authorIds, $tags);

            // ~40% of roots get 1-4 children (shallow nesting only).
            if (rand(1, 10) <= 4) {
                $childCount = rand(1, 4);
                for ($c = 1; $c <= $childCount; $c++) {
                    $this->makeDocument($workspace->id, $root->id, $c, $authorIds, $tags);
                }
            }
        }
    }

    /**
     * Create one document, attributed to a random author, then decorate it with
     * tags, extra versions (via edits so the observer snapshots them), the odd
     * attachment, and an occasional conversion job.
     */
    protected function makeDocument(int $workspaceId, ?int $parentId, int $position, array $authorIds, $tags): Document
    {
        $createdBy = $authorIds[array_rand($authorIds)];
        auth()->loginUsingId($createdBy);

        $document = Document::factory()->create([
            'workspace_id' => $workspaceId,
            'parent_id'    => $parentId,
            'position'     => $position,
        ]);

        // Tags: 0-3 from the pool.
        if ($tags->isNotEmpty() && rand(0, 3) > 0) {
            $document->tags()->syncWithoutDetaching(
                $tags->random(min(rand(1, 3), $tags->count()))->pluck('id')->all()
            );
        }

        // Version history: a few pages get several revisions from varied editors.
        if (rand(1, 3) === 1) {
            foreach (range(1, rand(1, 4)) as $rev) {
                auth()->loginUsingId($authorIds[array_rand($authorIds)]);
                $document->update([
                    'content' => \Database\Factories\DocumentFactory::tiptap(fake()->paragraph()),
                ]);
            }
        }

        // Attachments: some pages carry 1-2 dummy files (factory rows only — no
        // bytes on disk; download would 404, but list/counts/UI render fine).
        // Override document_id in make() so the factory's Document::factory()
        // default doesn't spin up a stray parent document.
        if (rand(1, 4) === 1) {
            foreach (range(1, rand(1, 2)) as $n) {
                $document->attachments()->create(
                    \App\Models\Attachment::factory()->make([
                        'document_id'    => $document->id,
                        'uploaded_by_id' => $createdBy,
                        'position'       => $n,
                    ])->getAttributes()
                );
            }
        }

        // Conversion jobs: a handful, across the real status values.
        if (rand(1, 6) === 1) {
            ConversionJob::factory()->create([
                'document_id'   => $document->id,
                'created_by_id' => $createdBy,
                'status'        => fake()->randomElement(['pending', 'processing', 'done', 'failed']),
            ]);
        }

        return $document;
    }
}
