<?php

use App\Models\Attachment;
use App\Models\Document;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\WorkspaceSeeder;
use Illuminate\Support\Facades\Storage;

/**
 * Guards against re-introducing empty/null text nodes in seeded content.
 * ProseMirror rejects a text node whose `text` isn't a non-empty string, and a
 * single one blanks the whole page in the editor (tiptap-php renders it, so the
 * read view "works" while the editor is blank — a confusing data bug).
 */
it('the inline content builder never emits an empty text node', function () {
    $seeder = new WorkspaceSeeder;
    $inline = (new ReflectionMethod($seeder, 'inline'));
    $inline->setAccessible(true);

    $cases = [
        '[[Only A Link]]',          // a paragraph that is just a link
        'lead text [[Link]]',       // link at the end
        '[[Link]] trailing text',   // link at the start
        '[[A]] and [[B]] guides',   // multiple links
        'plain text only',
        'has `inline code` too',
        '',                         // empty paragraph
    ];

    foreach ($cases as $text) {
        foreach ($inline->invoke($seeder, $text) as $node) {
            if (($node['type'] ?? null) === 'text') {
                expect($node['text'] ?? null)->toBeString()->not->toBe('');
            }
        }
    }
});

it('seeds page attachments with real, openable binaries', function () {
    Storage::fake('local');
    $this->seed(DatabaseSeeder::class);

    expect(Attachment::count())->toBeGreaterThan(0);

    $onboarding = Document::where('title', 'Onboarding')->with('attachments')->first();
    expect($onboarding)->not->toBeNull();
    expect($onboarding->attachments->pluck('original_name')->all())
        ->toContain('New Hire Checklist.pdf')
        ->toContain('Equipment Request Form.csv');

    // The PDF is a genuine PDF (valid header), the CSV is its raw text — both
    // land on the private disk so the download endpoint serves openable files.
    $pdf = $onboarding->attachments->firstWhere('original_name', 'New Hire Checklist.pdf');
    Storage::disk('local')->assertExists($pdf->path);
    expect(Storage::disk('local')->get($pdf->path))->toStartWith('%PDF-1.');
    expect($pdf->mime)->toBe('application/pdf')->and($pdf->size)->toBeGreaterThan(0);

    $csv = $onboarding->attachments->firstWhere('original_name', 'Equipment Request Form.csv');
    expect(Storage::disk('local')->get($csv->path))->toContain('item,model,notes');
});
