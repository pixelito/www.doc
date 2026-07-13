<?php

use App\Services\Importers\DocxImporter;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;

/** Build a .docx on disk with headings + underline/bold/italic and return its path. */
function makeFormattedDocx(): string
{
    $pw = new PhpWord();
    $pw->addTitleStyle(1, ['size' => 18, 'bold' => true]);
    $pw->addTitleStyle(2, ['size' => 14, 'bold' => true]);

    $section = $pw->addSection();
    $section->addTitle('Main Heading', 1);
    $section->addTitle('Sub Heading', 2);

    $run = $section->addTextRun();
    $run->addText('This is ');
    $run->addText('underlined', ['underline' => 'single']);
    $run->addText(', ');
    $run->addText('bold', ['bold' => true]);
    $run->addText(', and ');
    $run->addText('italic', ['italic' => true]);
    $run->addText(' text.');

    $path = tempnam(sys_get_temp_dir(), 'import') . '.docx';
    IOFactory::createWriter($pw, 'Word2007')->save($path);

    return $path;
}

/** Recursively collect every node of a given type from a TipTap doc. */
function collectNodes(array $node, string $type): array
{
    $found = ($node['type'] ?? null) === $type ? [$node] : [];

    foreach ($node['content'] ?? [] as $child) {
        $found = array_merge($found, collectNodes($child, $type));
    }

    return $found;
}

test('docx import preserves heading levels', function () {
    $path = makeFormattedDocx();

    $result = app(DocxImporter::class)->import($path);
    unlink($path);

    $headings = collectNodes($result['content'], 'heading');

    expect($headings)->toHaveCount(2);
    expect($headings[0]['attrs']['level'])->toBe(1);
    expect($headings[1]['attrs']['level'])->toBe(2);
});

test('docx import recognises numbered headings', function () {
    // A PhpWord heading has no numbering; inject a <w:numPr> to mimic a numbered
    // heading from Word. PhpWord's reader would treat that as a list item and
    // drop the heading level — the importer must strip the numbering first.
    $path = makeFormattedDocx();

    $zip = new \ZipArchive();
    $zip->open($path);
    $xml = $zip->getFromName('word/document.xml');
    $xml = preg_replace(
        '#(<w:pStyle w:val="Heading1"\s*/>)#',
        '$1<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>',
        $xml,
        1
    );
    $zip->addFromString('word/document.xml', $xml);
    $zip->close();

    $result = app(DocxImporter::class)->import($path);
    unlink($path);

    $levels = collect(collectNodes($result['content'], 'heading'))->pluck('attrs.level');
    expect($levels)->toContain(1);
});

test('docx import preserves the underline mark', function () {
    $path = makeFormattedDocx();

    $result = app(DocxImporter::class)->import($path);
    unlink($path);

    $marked = collect(collectNodes($result['content'], 'text'))
        ->mapWithKeys(fn ($n) => [
            $n['text'] => collect($n['marks'] ?? [])->pluck('type')->all(),
        ]);

    // The stray whitespace PhpWord emits (`underline ;`) must not drop the mark.
    expect($marked['underlined'])->toContain('underline');
    expect($marked['bold'])->toContain('bold');
    expect($marked['italic'])->toContain('italic');
});

test('docx import maps bulleted and numbered lists, with nesting', function () {
    $pw = new PhpWord();
    $section = $pw->addSection();
    $section->addText('Intro paragraph.');
    $section->addListItem('Bullet one', 0);
    $section->addListItem('Bullet two', 0);
    $section->addListItem('Nested bullet', 1);
    $section->addListItem('Numbered one', 0, null, ['listType' => \PhpOffice\PhpWord\Style\ListItem::TYPE_NUMBER]);
    $section->addListItem('Numbered two', 0, null, ['listType' => \PhpOffice\PhpWord\Style\ListItem::TYPE_NUMBER]);

    $path = tempnam(sys_get_temp_dir(), 'import') . '.docx';
    IOFactory::createWriter($pw, 'Word2007')->save($path);

    $result = app(DocxImporter::class)->import($path);
    unlink($path);

    $bullets = collectNodes($result['content'], 'bulletList');
    $ordered = collectNodes($result['content'], 'orderedList');

    // One top-level bullet list + the nested one inside its second item.
    expect($bullets)->toHaveCount(2);
    expect($ordered)->toHaveCount(1);

    $topItems = $bullets[0]['content'];
    expect($topItems)->toHaveCount(2);
    // The nested list lives INSIDE the second item, after its paragraph.
    expect(collect($topItems[1]['content'])->pluck('type')->all())
        ->toBe(['paragraph', 'bulletList']);

    $orderedTexts = collect(collectNodes($ordered[0], 'text'))->pluck('text')->all();
    expect($orderedTexts)->toBe(['Numbered one', 'Numbered two']);
});

test('docx import keeps formatted runs together inside one list item', function () {
    $pw = new PhpWord();
    $section = $pw->addSection();
    $run = $section->addListItemRun(0);
    $run->addText('plain then ');
    $run->addText('bold', ['bold' => true]);

    $path = tempnam(sys_get_temp_dir(), 'import') . '.docx';
    IOFactory::createWriter($pw, 'Word2007')->save($path);

    $result = app(DocxImporter::class)->import($path);
    unlink($path);

    $items = collectNodes($result['content'], 'listItem');
    expect($items)->toHaveCount(1);

    // Both runs in ONE item (the HTML writer would otherwise shred each run
    // into its own paragraph), with the bold mark intact.
    $texts = collect(collectNodes($items[0], 'text'));
    expect($texts->pluck('text')->all())->toBe(['plain then ', 'bold']);
    expect(collect($texts[1]['marks'] ?? [])->pluck('type'))->toContain('bold');
});

test('docx import list sentinels never leak into content', function () {
    $pw = new PhpWord();
    $section = $pw->addSection();
    $section->addListItem('An item', 0);
    $section->addText('A paragraph.');

    $path = tempnam(sys_get_temp_dir(), 'import') . '.docx';
    IOFactory::createWriter($pw, 'Word2007')->save($path);

    $result = app(DocxImporter::class)->import($path);
    unlink($path);

    expect(json_encode($result['content']))
        ->not->toContain("\u{E000}")
        ->not->toContain("\u{E001}");
});

/** Render one paragraph per line into a real PDF (Dompdf, like our own exports). */
function makeLinesPdf(array $lines): string
{
    $body = implode('', array_map(
        fn (string $l) => '<p>' . htmlspecialchars($l, ENT_QUOTES, 'UTF-8') . '</p>',
        $lines
    ));

    $pdf = new \Dompdf\Dompdf();
    $pdf->loadHtml('<html><body style="font-family: DejaVu Sans;">' . $body . '</body></html>', 'UTF-8');
    $pdf->render();

    $path = tempnam(sys_get_temp_dir(), 'import') . '.pdf';
    file_put_contents($path, $pdf->output());

    return $path;
}

test('pdf import detects bulleted and numbered lists heuristically', function () {
    $path = makeLinesPdf([
        'Intro line.',
        '• Alpha',
        '• Beta',
        '1. First',
        '2. Second',
        '3. Third',
        'Outro line.',
    ]);

    $result = app(\App\Services\Importers\PdfImporter::class)->import($path);
    unlink($path);

    $bullets = collectNodes($result['content'], 'bulletList');
    $ordered = collectNodes($result['content'], 'orderedList');

    expect($bullets)->toHaveCount(1);
    expect(collect(collectNodes($bullets[0], 'text'))->pluck('text')->all())
        ->toBe(['Alpha', 'Beta']);

    expect($ordered)->toHaveCount(1);
    expect(collect(collectNodes($ordered[0], 'text'))->pluck('text')->all())
        ->toBe(['First', 'Second', 'Third']);
});

test('pdf import does not mistake number-leading prose for a list', function () {
    $path = makeLinesPdf([
        '2026 was a big year for the team.',
        '5. May was the rainiest month.',
        'Normal closing line.',
    ]);

    $result = app(\App\Services\Importers\PdfImporter::class)->import($path);
    unlink($path);

    expect(collectNodes($result['content'], 'orderedList'))->toBeEmpty();
    expect(collectNodes($result['content'], 'bulletList'))->toBeEmpty();

    $texts = collect(collectNodes($result['content'], 'text'))->pluck('text')->all();
    expect($texts)->toContain('2026 was a big year for the team.');
    expect($texts)->toContain('5. May was the rainiest month.');
});

test('a failed import job marks the job failed and trashes the empty placeholder page', function () {
    login();
    $workspace = \App\Models\Workspace::factory()->create();

    $document = \App\Models\Document::factory()->create([
        'workspace_id' => $workspace->id,
        'title'        => 'Importing Broken File',
        'content'      => ['type' => 'doc', 'content' => []],
    ]);

    $job = \App\Models\ConversionJob::create([
        'document_id'   => $document->id,
        'direction'     => 'import',
        'format'        => 'docx',
        'status'        => 'processing',
        'result_path'   => 'imports/docx/missing.docx',
        'created_by_id' => auth()->id(),
    ]);

    // Simulate the queue giving up (timeout / final failure).
    (new \App\Jobs\ImportDocumentJob($job->id))->failed(new \RuntimeException('timed out'));

    expect($job->fresh()->status)->toBe('failed');
    // The empty "Importing …" placeholder is soft-deleted, not left in the tree.
    expect(\App\Models\Document::find($document->id))->toBeNull();
    expect(\App\Models\Document::withTrashed()->find($document->id))->not->toBeNull();
});

// The 50 MB ceiling is a three-layer contract: this max:51200 rule, the
// "max 50 MB" hint on the Import page, and the client_max_body_size exemption
// for the imports route in docker/nginx/default.conf. These pin the app-side
// boundary; tests/e2e/import-limit.spec.js guards the nginx side.
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('import accepts a file at exactly the 50 MB limit', function () {
    \Illuminate\Support\Facades\Storage::fake('local');
    \Illuminate\Support\Facades\Queue::fake();
    login();
    $workspace = \App\Models\Workspace::factory()->create();

    $file = \Illuminate\Http\UploadedFile::fake()->create('big.docx', 51200, DOCX_MIME);

    $this->post(route('imports.store', $workspace), ['file' => $file], ['Accept' => 'application/json'])
        ->assertStatus(202);

    \Illuminate\Support\Facades\Queue::assertPushed(\App\Jobs\ImportDocumentJob::class);
});

test('import rejects a file over the 50 MB limit with a validation error', function () {
    login();
    $workspace = \App\Models\Workspace::factory()->create();

    $file = \Illuminate\Http\UploadedFile::fake()->create('big.docx', 51201, DOCX_MIME);

    $this->post(route('imports.store', $workspace), ['file' => $file], ['Accept' => 'application/json'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('file');

    // No placeholder page is created for a rejected upload.
    expect(\App\Models\Document::count())->toBe(0);
});
