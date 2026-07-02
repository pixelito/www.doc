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
