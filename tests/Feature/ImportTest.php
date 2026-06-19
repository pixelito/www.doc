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
