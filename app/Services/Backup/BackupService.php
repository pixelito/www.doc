<?php

namespace App\Services\Backup;

use App\Models\Asset;
use App\Models\Backup;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Link;
use App\Models\Tag;
use App\Models\User;
use App\Models\Workspace;
use App\Services\Backup\Destinations\DestinationFactory;
use App\Services\Exporters\PdfExporter;
use App\Support\BackupSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * Builds a backup archive: ONE `.zip` with two layers.
 *
 *  - canonical/  — the authoritative restore source: a dump of the whole content
 *    model (content jsonb VERBATIM) + every referenced asset binary, described by
 *    manifest.json (format/schema version, counts, per-file sha256). The two
 *    high-volume tables (documents, versions) are streamed as NDJSON — one JSON
 *    object per line — so peak memory stays flat regardless of page count; the
 *    small tables stay as single JSON files.
 *  - readable/   — PDF-per-page foldered by workspace/tree, for humans/auditors.
 *    Explicitly NON-authoritative; RestoreService never reads it. PDF (not DOCX)
 *    because canonical JSON owns restore, so this layer only needs to be read:
 *    PDF is portable, fixed-fidelity and the archival norm auditors expect.
 *
 * Heavy work, so it runs inside RunBackupJob on the queue. Writes to a PRIVATE
 * destination (`local` disk by default, or an SMB share off-host), never `public`.
 */
class BackupService
{
    public function run(Backup $backup): void
    {
        $work = $this->tempDir();

        try {
            File::ensureDirectoryExists("{$work}/canonical");
            File::ensureDirectoryExists("{$work}/assets");
            File::ensureDirectoryExists("{$work}/readable");

            $counts = $this->writeCanonical($work);
            $this->writeAssets($work);
            $this->writeReadable($work);

            $manifest = $this->writeManifest($work, $counts);

            $zipPath = $this->zip($work);
            $stored  = $this->storeArchive($backup, $zipPath);

            $backup->update([
                'status'      => 'done',
                'path'        => $stored['path'],
                'size_bytes'  => $stored['size'],
                'manifest'    => $manifest,
                'finished_at' => now(),
            ]);

            @unlink($zipPath);
            $this->pruneOldBackups($backup);
        } finally {
            File::deleteDirectory($work);
        }
    }

    // ── Canonical layer ───────────────────────────────────────────────────────

    /** @return array<string,int> counts by entity */
    private function writeCanonical(string $work): array
    {
        // Small, bounded tables: dump whole (users.json is a keyed map too).
        // withTrashed: a backup must capture the Trash too, so a restore is a
        // faithful point-in-time copy (soft-deleted rows included).
        $workspaces = Workspace::withTrashed()->orderBy('id')->get()
            ->map(fn (Workspace $w) => $w->makeVisible(['deleted_at'])->toArray());

        $tags  = Tag::orderBy('id')->get()->map->toArray();
        $links = Link::orderBy('id')->get()->map->toArray();

        // id → name/email/role map: enough to re-attribute authorship on restore
        // without dumping password hashes.
        $users = User::orderBy('id')->get()->mapWithKeys(fn (User $u) => [
            $u->id => [
                'name'  => $u->name,
                'email' => $u->email,
                'role'  => $u->getRoleNames()->first(),
            ],
        ]);

        $assets = Asset::orderBy('id')->get()->map->toArray();

        $this->putJson("{$work}/canonical/workspaces.json", $workspaces);
        $this->putJson("{$work}/canonical/tags.json", $tags);
        $this->putJson("{$work}/canonical/links.json", $links);
        $this->putJson("{$work}/canonical/users.json", $users);
        $this->putJson("{$work}/canonical/assets.json", $assets);

        // High-volume tables stream to NDJSON (one JSON object per line) so peak
        // memory stays flat no matter how many pages/versions exist — each row is
        // encoded and flushed individually, never the whole collection at once.
        $documents = $this->putDocumentsNdjson("{$work}/canonical/documents.ndjson");
        $versions  = $this->putNdjson(
            "{$work}/canonical/versions.ndjson",
            DocumentVersion::lazyById(500)->map(fn (DocumentVersion $v) => $v->toArray()),
        );

        return [
            'workspaces' => $workspaces->count(),
            'documents'  => $documents,
            'versions'   => $versions,
            'tags'       => $tags->count(),
            'links'      => $links->count(),
            'users'      => $users->count(),
            'assets'     => $assets->count(),
        ];
    }

    /**
     * Stream the documents table to NDJSON, eager-loading tag ids per chunk
     * (lazyById batches the relation load, so no N+1). Returns the row count.
     */
    private function putDocumentsNdjson(string $path): int
    {
        $handle = fopen($path, 'w');
        $count  = 0;

        try {
            Document::withTrashed()->with('tags:id')->lazyById(500)
                ->each(function (Document $d) use ($handle, &$count) {
                    $row = $d->makeVisible(['deleted_at'])->toArray();
                    // Store tag ids alongside the columns, but drop the eager-loaded
                    // relation blob — `tags` is not a documents column.
                    unset($row['tags']);
                    $row['tag_ids'] = $d->tags->pluck('id')->all();

                    fwrite($handle, $this->ndjsonLine($row));
                    $count++;
                });
        } finally {
            fclose($handle);
        }

        return $count;
    }

    /**
     * Write an iterable of array rows as NDJSON; returns the row count. The
     * iterable is consumed lazily, so a LazyCollection keeps memory flat.
     */
    private function putNdjson(string $path, iterable $rows): int
    {
        $handle = fopen($path, 'w');
        $count  = 0;

        try {
            foreach ($rows as $row) {
                fwrite($handle, $this->ndjsonLine($row));
                $count++;
            }
        } finally {
            fclose($handle);
        }

        return $count;
    }

    private function ndjsonLine(array $row): string
    {
        // One record per line — never pretty-printed, or it wouldn't stream.
        return json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
    }

    /** Copy every referenced asset binary into the archive. */
    private function writeAssets(string $work): void
    {
        foreach (Asset::all() as $asset) {
            $disk = Storage::disk($asset->disk);
            if (! $disk->exists($asset->path)) {
                continue;
            }
            $dest = "{$work}/assets/" . basename($asset->path);
            File::put($dest, $disk->get($asset->path));
        }
    }

    // ── Readable layer (non-authoritative) ─────────────────────────────────────

    private function writeReadable(string $work): void
    {
        Document::with('workspace')->orderBy('id')->get()->each(function (Document $doc) use ($work) {
            try {
                $relDir = "{$work}/readable/" . $this->treeFolder($doc);
                File::ensureDirectoryExists($relDir);

                // The exporter writes to the local disk and returns its path; pull
                // the bytes into the archive, then drop the working copy.
                $path = (new PdfExporter())->export($doc);
                File::put("{$relDir}/{$doc->slug}.pdf", Storage::disk('local')->get($path));
                Storage::disk('local')->delete($path);
            } catch (\Throwable $e) {
                // The readable layer is best-effort; one bad page must not abort
                // the authoritative backup.
                report($e);
            }
        });
    }

    /** Folder path "<workspace>/<ancestor>/<…>" for a document, slugged + safe. */
    private function treeFolder(Document $doc): string
    {
        $parts = [$this->safe($doc->workspace?->slug ?? 'workspace')];
        foreach ($doc->ancestors() as $ancestor) {
            $parts[] = $this->safe($ancestor['slug']);
        }

        return implode('/', $parts);
    }

    // ── Manifest ───────────────────────────────────────────────────────────────

    /** @param array<string,int> $counts */
    private function writeManifest(string $work, array $counts): array
    {
        // Per-file sha256 over canonical/* and assets/* for integrity verification.
        $files = [];
        foreach (File::allFiles($work) as $file) {
            $rel = str_replace($work . '/', '', $file->getPathname());
            if (str_starts_with($rel, 'readable/')) {
                continue; // readable layer is non-authoritative, not checksummed
            }
            $files[$rel] = hash_file('sha256', $file->getPathname());
        }

        $manifest = [
            'format_version' => config('backup.format_version'),
            'schema_version' => $this->schemaVersion(),
            'app'            => config('app.name'),
            'created_at'     => now()->toIso8601String(),
            'counts'         => $counts,
            'files'          => $files,
        ];

        $this->putJson("{$work}/manifest.json", $manifest);

        return $manifest;
    }

    /** The latest applied migration — our stand-in for a schema version. */
    private function schemaVersion(): ?string
    {
        return DB::table('migrations')->orderByDesc('id')->value('migration');
    }

    // ── Zip + store ────────────────────────────────────────────────────────────

    private function zip(string $work): string
    {
        $zipPath = $this->tempDir() . '.zip';

        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Could not create backup archive.');
        }

        foreach (File::allFiles($work) as $file) {
            $zip->addFile($file->getPathname(), str_replace($work . '/', '', $file->getPathname()));
        }
        $zip->close();

        return $zipPath;
    }

    /** @return array{path:string,size:int} */
    private function storeArchive(Backup $backup, string $zipPath): array
    {
        $name = 'backup-' . now()->format('Ymd-His') . "-{$backup->id}.zip";

        // The destination (local disk or SMB share) owns its own pathing; it
        // streams the archive in so an off-host target need not buffer it whole.
        return DestinationFactory::make($backup->disk)->store($zipPath, $name);
    }

    /** Keep only the most-recent N successful backups on this destination. */
    private function pruneOldBackups(Backup $backup): void
    {
        $retention = (int) (BackupSettings::get()['retention'] ?? 7);
        if ($retention < 1) {
            return;
        }

        $destination = DestinationFactory::make($backup->disk);

        Backup::where('status', 'done')
            ->where('disk', $backup->disk)
            ->orderByDesc('id')
            ->skip($retention)
            ->take(PHP_INT_MAX)
            ->get()
            ->each(function (Backup $old) use ($destination) {
                if ($old->path) {
                    $destination->delete($old->path);
                }
                $old->delete();
            });
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private function putJson(string $path, mixed $data): void
    {
        File::put($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function tempDir(): string
    {
        return sys_get_temp_dir() . '/' . uniqid('wwwdoc_backup_');
    }

    private function safe(string $segment): string
    {
        return preg_replace('/[^A-Za-z0-9._-]/', '-', $segment) ?: 'item';
    }
}
