<?php

namespace App\Services\Exporters;

use App\Contracts\ExporterContract;
use App\Models\Document;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Style\Font;

class DocxExporter implements ExporterContract
{
    private PhpWord $word;

    /** @var \PhpOffice\PhpWord\Element\Section */
    private $section;

    /**
     * Context stack so nested lists know their depth + type.
     * Each entry: ['type' => 'bullet'|'ordered', 'depth' => int]
     */
    private array $listStack = [];

    public function export(Document $document): string
    {
        $this->word    = $this->makeWord();
        $this->section = $this->word->addSection([
            'marginTop'    => 1440, // 1 inch in twips
            'marginBottom' => 1440,
            'marginLeft'   => 1440,
            'marginRight'  => 1440,
        ]);

        // Header
        $header = $this->section->addHeader();
        $header->addText($document->title, ['bold' => true, 'size' => 9], ['alignment' => 'left']);

        // Footer with page number
        $footer = $this->section->addFooter();
        $footer->addPreserveText(
            'Page {PAGE} of {NUMPAGES}',
            ['size' => 9, 'color' => '8E938E'],
            ['alignment' => 'center']
        );

        $this->processNodes($document->content['content'] ?? []);

        $slug     = $document->slug;
        $filename = "exports/docx/{$slug}-" . now()->format('YmdHis') . '.docx';
        $tempPath = sys_get_temp_dir() . "/{$slug}.docx";

        $writer = \PhpOffice\PhpWord\IOFactory::createWriter($this->word, 'Word2007');
        $writer->save($tempPath);

        Storage::disk('local')->put($filename, file_get_contents($tempPath));
        @unlink($tempPath);

        return $filename;
    }

    // -------------------------------------------------------------------------

    private function makeWord(): PhpWord
    {
        $w = new PhpWord();
        $w->setDefaultFontName('Calibri');
        $w->setDefaultFontSize(11);

        // Heading styles
        foreach ([1 => 24, 2 => 18, 3 => 14, 4 => 12] as $level => $size) {
            $w->addTitleStyle($level, [
                'bold'  => true,
                'size'  => $size,
                'color' => '1F2520',
            ], [
                'spaceAfter'  => 120,
                'spaceBefore' => $level === 1 ? 0 : 240,
            ]);
        }

        $w->addFontStyle('Code', [
            'name'  => 'Courier New',
            'size'  => 9,
            'color' => '364E2E',
        ]);

        return $w;
    }

    // -------------------------------------------------------------------------

    private function processNodes(array $nodes): void
    {
        foreach ($nodes as $node) {
            $this->processNode($node);
        }
    }

    private function processNode(array $node): void
    {
        $type = $node['type'] ?? '';

        match ($type) {
            'heading'      => $this->addHeading($node),
            'paragraph'    => $this->addParagraph($node),
            'bulletList'   => $this->addList($node, 'bullet'),
            'orderedList'  => $this->addList($node, 'ordered'),
            'blockquote'   => $this->addBlockquote($node),
            'codeBlock'    => $this->addCodeBlock($node),
            'table'        => $this->addTable($node),
            'horizontalRule' => $this->addHr(),
            'image'        => $this->addImage($node),
            'networkDiagram' => $this->addNetworkDiagram($node),
            default        => null,
        };
    }

    private function addHeading(array $node): void
    {
        $level = $node['attrs']['level'] ?? 1;
        $level = min(max($level, 1), 4);
        $text  = $this->extractText($node);
        $this->section->addTitle($text, $level);
    }

    private function addParagraph(array $node): void
    {
        $children = $node['content'] ?? [];
        if (empty($children)) {
            $this->section->addTextBreak(1);
            return;
        }

        $textRun = $this->section->addTextRun(['spaceAfter' => 100]);
        foreach ($children as $inline) {
            $this->addInline($textRun, $inline);
        }
    }

    private function addList(array $node, string $type): void
    {
        $depth = count($this->listStack);
        $this->listStack[] = ['type' => $type, 'depth' => $depth];

        foreach ($node['content'] ?? [] as $item) {
            $this->addListItem($item, $type, $depth);
        }

        array_pop($this->listStack);
    }

    private function addListItem(array $node, string $type, int $depth): void
    {
        foreach ($node['content'] ?? [] as $child) {
            $childType = $child['type'] ?? '';
            if ($childType === 'bulletList') {
                $this->addList($child, 'bullet');
            } elseif ($childType === 'orderedList') {
                $this->addList($child, 'ordered');
            } else {
                $text   = $this->extractText($child);
                $style  = $type === 'ordered' ? 'List Number' : 'List Bullet';
                $this->section->addListItem($text, $depth, null, ['listType' => $type === 'ordered' ? 3 : 1]);
            }
        }
    }

    private function addBlockquote(array $node): void
    {
        foreach ($node['content'] ?? [] as $child) {
            $text    = $this->extractText($child);
            $para    = $this->section->addText(
                $text,
                ['italic' => true, 'color' => '5C625C', 'size' => 10],
                ['indentation' => ['left' => 720], 'spaceAfter' => 100]
            );
        }
    }

    private function addCodeBlock(array $node): void
    {
        $text = $this->extractText($node);

        // Split lines so each line is a separate text in a shaded table cell
        $table = $this->section->addTable(['borderColor' => 'E2DFD4', 'borderSize' => 6]);
        $row   = $table->addRow();
        $cell  = $row->addCell(null, ['bgColor' => 'F5F4ED']);

        foreach (explode("\n", $text) as $line) {
            $cell->addText(
                htmlspecialchars($line !== '' ? $line : ' '),
                ['name' => 'Courier New', 'size' => 9, 'color' => '364E2E']
            );
        }

        $this->section->addTextBreak(1);
    }

    private function addTable(array $node): void
    {
        $table = $this->section->addTable([
            'borderColor' => 'E2DFD4',
            'borderSize'  => 6,
            'cellMargin'  => 80,
        ]);

        foreach ($node['content'] ?? [] as $rowNode) {
            $row = $table->addRow();
            foreach ($rowNode['content'] ?? [] as $cellNode) {
                $isHeader = ($cellNode['type'] ?? '') === 'tableHeader';
                $cell     = $row->addCell(null, $isHeader ? ['bgColor' => 'EDF2EA'] : []);
                $text     = $this->extractText($cellNode);
                $cell->addText($text, $isHeader ? ['bold' => true, 'size' => 10] : ['size' => 10]);
            }
        }

        $this->section->addTextBreak(1);
    }

    private function addHr(): void
    {
        $this->section->addText('', [], ['borderBottomColor' => 'E2DFD4', 'borderBottomSize' => 6]);
    }

    private function addImage(array $node): void
    {
        $this->embedStorageImage($node['attrs']['src'] ?? '', ['width' => 400, 'height' => 300, 'ratio' => true]);
    }

    private function addNetworkDiagram(array $node): void
    {
        // The diagram's derived PNG (`imageSrc`) is what every static consumer
        // shows; the graph JSON is editor-only. Nothing renders until a capture
        // exists (a just-inserted, never-edited diagram has no image).
        $this->embedStorageImage($node['attrs']['imageSrc'] ?? '', ['width' => 450, 'ratio' => true]);
    }

    /** Embed an image only if it is served from our own storage; skip external URLs. */
    private function embedStorageImage(string $src, array $style): void
    {
        if (!$src || !str_starts_with($src, '/storage/')) return;

        $relativePath = substr($src, strlen('/storage/'));
        $localPath    = storage_path("app/public/{$relativePath}");
        if (file_exists($localPath)) {
            $this->section->addImage($localPath, $style);
        }
    }

    // -------------------------------------------------------------------------
    // Inline content helpers

    /**
     * @param \PhpOffice\PhpWord\Element\TextRun $run
     */
    private function addInline(mixed $run, array $node): void
    {
        $type = $node['type'] ?? '';

        if ($type === 'text') {
            $marks = $node['marks'] ?? [];
            $style = $this->marksToFontStyle($marks);
            $text  = $node['text'] ?? '';
            $run->addText(htmlspecialchars($text), $style);
            return;
        }

        if ($type === 'hardBreak') {
            $run->addTextBreak();
            return;
        }

        if ($type === 'wikiLink') {
            $title = $node['attrs']['title'] ?? '';
            $run->addText("[[{$title}]]", ['color' => '5C625C']);
            return;
        }

        // Recurse into any other inline nodes
        foreach ($node['content'] ?? [] as $child) {
            $this->addInline($run, $child);
        }
    }

    private function marksToFontStyle(array $marks): array
    {
        $style = [];
        foreach ($marks as $mark) {
            match ($mark['type'] ?? '') {
                'bold'      => $style['bold'] = true,
                'italic'    => $style['italic'] = true,
                'underline' => $style['underline'] = true,
                'strike'    => $style['strikethrough'] = true,
                'code'      => $style['name'] = 'Courier New',
                default     => null,
            };
        }
        return $style;
    }

    private function extractText(?array $node): string
    {
        if (!$node) return '';
        if (($node['type'] ?? '') === 'text') return $node['text'] ?? '';
        return implode('', array_map([$this, 'extractText'], $node['content'] ?? []));
    }
}
