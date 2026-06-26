<?php

namespace App\Services\Backup;

use App\Models\Backup;
use App\Models\Document;
use App\Models\Setting;
use App\Models\User;
use App\Support\SearchVector;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * Rebuilds the content model from a backup's CANONICAL layer. Never reads the
 * readable DOCX layer — that's lossy/derived. The archive's `content` jsonb is
 * restored verbatim, so diagrams, wiki-link marks, colours, code blocks, tags,
 * tree structure and versions round-trip losslessly.
 *
 * Destructive: it replaces the current content model wholesale, inside one
 * transaction (model events muted so the observer doesn't re-snapshot/re-render
 * during the rebuild). Runs in RestoreBackupJob on the queue.
 *
 * NOTE (scaffold): this is the happy-path rebuild. Hardening still to do —
 * pre-restore safety snapshot, schema-version migration, partial/selective
 * restore, and archive decryption.
 */
class RestoreService
{
    public function restore(Backup $backup): void
    {
        $work = sys_get_temp_dir() . '/' . uniqid('wwwdoc_restore_');

        try {
            $this->extract($backup, $work);
            $this->verify($work);

            $canonical = fn (string $name) => json_decode(File::get("{$work}/canonical/{$name}"), true) ?? [];

            DB::transaction(function () use ($canonical, $work) {
                $this->wipe();

                $this->insert('workspaces', $canonical('workspaces.json'));
                $this->insertDocuments($canonical('documents.json'));
                $this->insert('tags', $canonical('tags.json'));
                $this->insertTaggables($canonical('documents.json'));
                $this->insert('document_versions', $canonical('versions.json'));
                $this->insert('links', $canonical('links.json'));
                $this->insert('assets', $canonical('assets.json'));

                $this->resyncSequences();
            });

            $this->restoreAssetBinaries($canonical('assets.json'), $work);
            $this->reindexSearch();
        } finally {
            File::deleteDirectory($work);
        }
    }

    // ── Extract + integrity ────────────────────────────────────────────────────

    private function extract(Backup $backup, string $work): void
    {
        $local = sys_get_temp_dir() . '/' . uniqid('wwwdoc_archive_') . '.zip';
        File::put($local, Storage::disk($backup->disk)->get($backup->path));

        $zip = new ZipArchive();
        if ($zip->open($local) !== true) {
            throw new \RuntimeException('Could not open backup archive.');
        }
        $zip->extractTo($work);
        $zip->close();
        @unlink($local);
    }

    /** Re-check every canonical/asset file against the manifest's sha256. */
    private function verify(string $work): void
    {
        $manifest = json_decode(File::get("{$work}/manifest.json"), true);
        foreach ($manifest['files'] ?? [] as $rel => $expected) {
            $path = "{$work}/{$rel}";
            if (! File::exists($path) || hash_file('sha256', $path) !== $expected) {
                throw new \RuntimeException("Integrity check failed for {$rel}.");
            }
        }
    }

    // ── Rebuild ────────────────────────────────────────────────────────────────

    private function wipe(): void
    {
        // Children before parents. taggables/links/versions reference documents;
        // documents reference workspaces. assets are standalone.
        foreach (['links', 'document_versions', 'taggables', 'documents', 'tags', 'workspaces', 'assets'] as $table) {
            DB::table($table)->delete();
        }
    }

    private function insert(string $table, array $rows): void
    {
        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table($table)->insert(array_map(
                fn (array $row) => $this->encodeJsonColumns($row),
                $chunk,
            ));
        }
    }

    /**
     * Documents carry a self-referential parent_id, so insert in two passes:
     * every row parent-less first, then wire up parents once all ids exist.
     */
    private function insertDocuments(array $documents): void
    {
        $parents = [];
        $rows    = [];
        foreach ($documents as $doc) {
            // Drop anything that isn't a documents column (the tag plumbing).
            unset($doc['tag_ids'], $doc['tags']);
            $parents[$doc['id']] = $doc['parent_id'] ?? null;
            $doc['parent_id']    = null;
            $rows[]              = $this->encodeJsonColumns($doc);
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('documents')->insert($chunk);
        }

        foreach ($parents as $id => $parentId) {
            if ($parentId !== null) {
                DB::table('documents')->where('id', $id)->update(['parent_id' => $parentId]);
            }
        }
    }

    private function insertTaggables(array $documents): void
    {
        $rows = [];
        foreach ($documents as $doc) {
            foreach ($doc['tag_ids'] ?? [] as $tagId) {
                $rows[] = [
                    'tag_id'        => $tagId,
                    'taggable_type' => Document::class,
                    'taggable_id'   => $doc['id'],
                ];
            }
        }
        if ($rows) {
            DB::table('taggables')->insert($rows);
        }
    }

    /** Push Postgres id sequences past the highest restored id on each table. */
    private function resyncSequences(): void
    {
        foreach (['workspaces', 'documents', 'document_versions', 'tags', 'links', 'assets'] as $table) {
            DB::statement(
                "SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM {$table}), 1))",
                [$table],
            );
        }
    }

    private function restoreAssetBinaries(array $assets, string $work): void
    {
        foreach ($assets as $asset) {
            $src = "{$work}/assets/" . basename($asset['path']);
            if (File::exists($src)) {
                Storage::disk($asset['disk'])->put($asset['path'], File::get($src));
            }
        }
    }

    private function reindexSearch(): void
    {
        $lang = config('database.search_language', 'english');
        DB::statement('UPDATE documents SET search_vector = ' . SearchVector::expression(), [$lang, $lang]);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    /** json_encode array-valued columns (content/metadata/tags jsonb) for raw insert. */
    private function encodeJsonColumns(array $row): array
    {
        foreach ($row as $key => $value) {
            if (is_array($value)) {
                $row[$key] = json_encode($value);
            }
        }

        return $row;
    }
}
