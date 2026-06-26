<?php

use App\Models\Backup;
use App\Models\Document;
use App\Models\Setting;
use App\Models\Workspace;
use App\Services\Backup\BackupService;
use App\Services\Backup\RestoreService;
use Database\Factories\DocumentFactory;
use Illuminate\Support\Facades\Storage;

/** Open a backup archive and list its entry names. */
function archiveEntries(Backup $backup): array
{
    $zip = new ZipArchive();
    $zip->open(Storage::disk($backup->disk)->path($backup->path));
    $names = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $names[] = $zip->getNameIndex($i);
    }
    $zip->close();

    return $names;
}

test('non-admins cannot reach the backups area', function () {
    login(role: 'editor');

    $this->get('/admin/backups')->assertForbidden();
    $this->post('/admin/backups')->assertForbidden();
    $this->patch('/admin/backups/settings', [
        'enabled' => true, 'interval' => 'daily', 'disk' => 'local', 'retention' => 7,
    ])->assertForbidden();
});

test('an admin can save the backup schedule settings', function () {
    login();

    $this->patch('/admin/backups/settings', [
        'enabled'   => true,
        'interval'  => 'weekly',
        'disk'      => 'local',
        'retention' => 5,
    ])->assertRedirect();

    expect(Setting::get('backup'))->toMatchArray([
        'enabled'   => true,
        'interval'  => 'weekly',
        'disk'      => 'local',
        'retention' => 5,
    ]);
});

test('saving settings rejects an unknown interval', function () {
    login();

    $this->patch('/admin/backups/settings', [
        'enabled' => true, 'interval' => 'hourly', 'disk' => 'local', 'retention' => 7,
    ])->assertSessionHasErrors('interval');
});

test('a backup produces an archive with the canonical layer and a manifest', function () {
    Storage::fake('local');
    login();

    $ws  = Workspace::factory()->create();
    Document::factory()->for($ws)->create(['content' => DocumentFactory::tiptap('Backup me.')]);

    $backup = Backup::create(['trigger' => 'manual', 'disk' => 'local', 'status' => 'pending']);
    app(BackupService::class)->run($backup->fresh());
    $backup->refresh();

    expect($backup->status)->toBe('done');
    expect(Storage::disk('local')->exists($backup->path))->toBeTrue();

    $entries = archiveEntries($backup);
    expect($entries)
        ->toContain('manifest.json')
        ->toContain('canonical/documents.json')
        ->toContain('canonical/workspaces.json')
        ->toContain('canonical/users.json');

    expect($backup->manifest['counts']['documents'])->toBe(1);
    expect($backup->manifest['files'])->toHaveKey('canonical/documents.json'); // sha256 present
});

test('the manual backup endpoint queues a run and records it', function () {
    Storage::fake('local');
    login();

    Document::factory()->create(['content' => DocumentFactory::tiptap('hi')]);

    $this->post('/admin/backups')->assertRedirect();

    // QUEUE_CONNECTION=sync in tests, so the job has already run.
    $backup = Backup::latest('id')->first();
    expect($backup)->not->toBeNull();
    expect($backup->status)->toBe('done');
    expect($backup->trigger)->toBe('manual');
});

test('a backup restores losslessly, reverting later edits', function () {
    Storage::fake('local');
    login();

    $ws  = Workspace::factory()->create(['name' => 'Original Name']);
    $doc = Document::factory()->for($ws)->create([
        'title'   => 'Original Title',
        'content' => DocumentFactory::tiptap('Original body.'),
    ]);

    $backup = Backup::create(['trigger' => 'manual', 'disk' => 'local', 'status' => 'pending']);
    app(BackupService::class)->run($backup->fresh());

    // Drift after the backup…
    $ws->update(['name' => 'Edited Name']);
    $doc->update(['title' => 'Edited Title']);

    app(RestoreService::class)->restore($backup->fresh());

    expect(Workspace::find($ws->id)->name)->toBe('Original Name');
    expect(Document::find($doc->id)->title)->toBe('Original Title');
});

test('the scheduled command does nothing while backups are disabled', function () {
    Setting::put('backup', ['enabled' => false, 'interval' => 'daily', 'disk' => 'local', 'retention' => 7]);

    $this->artisan('backup:run')->expectsOutputToContain('disabled')->assertSuccessful();

    expect(Backup::count())->toBe(0);
});

test('the scheduled command dispatches a backup when enabled and due', function () {
    Storage::fake('local');
    Setting::put('backup', ['enabled' => true, 'interval' => 'daily', 'disk' => 'local', 'retention' => 7]);

    $this->artisan('backup:run')->assertSuccessful();

    $backup = Backup::latest('id')->first();
    expect($backup?->trigger)->toBe('scheduled');
    expect($backup?->status)->toBe('done'); // ran synchronously
});
