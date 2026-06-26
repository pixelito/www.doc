<?php

use App\Models\Backup;
use App\Models\Document;
use App\Models\Setting;
use App\Models\Workspace;
use App\Services\Backup\BackupService;
use App\Services\Backup\RestoreService;
use Database\Factories\DocumentFactory;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

/** A full, valid settings payload with optional overrides (recursive merge). */
function settingsPayload(array $overrides = []): array
{
    $base = [
        'enabled'   => true,
        'interval'  => 'daily',
        'retention' => 7,
        'driver'    => 'local',
        'smb'  => ['host' => '', 'share' => '', 'path' => '', 'username' => '', 'password' => '', 'domain' => ''],
        'mail' => ['enabled' => false, 'to' => '', 'host' => '', 'port' => 587, 'username' => '', 'password' => '', 'encryption' => 'tls', 'from_address' => '', 'from_name' => ''],
    ];

    return array_replace_recursive($base, $overrides);
}

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
    $this->patch('/admin/backups/settings', settingsPayload())->assertForbidden();
});

test('an admin can save the backup schedule settings', function () {
    login();

    $this->patch('/admin/backups/settings', settingsPayload([
        'interval'  => 'weekly',
        'retention' => 5,
    ]))->assertRedirect();

    expect(Setting::get('backup'))->toMatchArray([
        'enabled'   => true,
        'interval'  => 'weekly',
        'driver'    => 'local',
        'retention' => 5,
    ]);
});

test('saving settings rejects an unknown interval', function () {
    login();

    $this->patch('/admin/backups/settings', settingsPayload([
        'interval' => 'hourly',
    ]))->assertSessionHasErrors('interval');
});

test('choosing the SMB driver requires a host and share', function () {
    login();

    $this->patch('/admin/backups/settings', settingsPayload([
        'driver' => 'smb',
    ]))->assertSessionHasErrors(['smb.host', 'smb.share']);
});

test('SMB and SMTP passwords are stored encrypted and preserved when left blank', function () {
    login();

    // First save: provide both passwords.
    $this->patch('/admin/backups/settings', settingsPayload([
        'driver' => 'smb',
        'smb'    => ['host' => 'host', 'share' => 'share', 'path' => 'docs', 'username' => 'u', 'password' => 's3cret', 'domain' => ''],
        'mail'   => ['enabled' => true, 'to' => 'a@b.com', 'host' => 'smtp', 'port' => 587, 'username' => 'mu', 'password' => 'mailpw', 'encryption' => 'tls', 'from_address' => 'f@b.com', 'from_name' => 'x'],
    ]))->assertRedirect();

    $stored = Setting::get('backup');
    expect($stored['smb']['password'])->not->toBe('s3cret')->not->toBe('');
    expect(\App\Support\BackupSettings::smbPassword())->toBe('s3cret');
    expect(\App\Support\BackupSettings::mailPassword())->toBe('mailpw');

    // Second save with blank passwords keeps the stored ones.
    $this->patch('/admin/backups/settings', settingsPayload([
        'driver' => 'smb',
        'smb'    => ['host' => 'host2', 'share' => 'share', 'path' => 'docs', 'username' => 'u', 'password' => '', 'domain' => ''],
        'mail'   => ['enabled' => true, 'to' => 'a@b.com', 'host' => 'smtp', 'port' => 587, 'username' => 'mu', 'password' => '', 'encryption' => 'tls', 'from_address' => 'f@b.com', 'from_name' => 'x'],
    ]))->assertRedirect();

    expect(\App\Support\BackupSettings::smbPassword())->toBe('s3cret');
    expect(\App\Support\BackupSettings::mailPassword())->toBe('mailpw');
    expect(Setting::get('backup')['smb']['host'])->toBe('host2');
});

test('the local destination can be tested', function () {
    Storage::fake('local');
    login();

    $this->post('/admin/backups/test-destination', ['driver' => 'local'])
        ->assertRedirect()
        ->assertSessionHas('success');
});

test('a test email is sent through the configured mailer', function () {
    Mail::fake();
    login();

    $this->post('/admin/backups/test-email', [
        'mail' => [
            'to' => 'admin@company.com', 'host' => 'smtp.test', 'port' => 587,
            'encryption' => 'tls', 'username' => 'u', 'password' => 'p',
            'from_address' => 'backups@company.com', 'from_name' => 'Backups',
        ],
    ])->assertRedirect()->assertSessionHas('success');

    Mail::assertSent(\App\Mail\BackupReport::class, fn ($m) => $m->hasTo('admin@company.com') && $m->isTest);
});

test('a successful backup emails a report when notifications are on', function () {
    Storage::fake('local');
    Mail::fake();
    login();

    Setting::put('backup', array_replace(\App\Support\BackupSettings::get(), [
        'mail' => [
            'enabled' => true, 'to' => 'admin@company.com', 'host' => 'smtp.test', 'port' => 587,
            'encryption' => 'tls', 'username' => 'u', 'password' => \App\Support\BackupSettings::encrypt('p'),
            'from_address' => 'backups@company.com', 'from_name' => 'Backups',
        ],
    ]));

    Document::factory()->create(['content' => DocumentFactory::tiptap('hi')]);

    $this->post('/admin/backups')->assertRedirect();

    Mail::assertSent(\App\Mail\BackupReport::class, fn ($m) =>
        $m->hasTo('admin@company.com') && $m->backup?->status === 'done');
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

    // The readable layer is PDF-per-page (non-authoritative; not checksummed).
    expect(collect($entries)->contains(
        fn ($e) => str_starts_with($e, 'readable/') && str_ends_with($e, '.pdf')
    ))->toBeTrue();
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
