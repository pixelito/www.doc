<?php

namespace App\Services\Importers;

use App\Contracts\ImporterContract;
use Smalot\PdfParser\Parser;

class PdfImporter implements ImporterContract
{
    public function import(string $filePath, ?int $uploadedById = null): array
    {
        $parser = new Parser();
        $pdf    = $parser->parseFile($filePath);

        // Best-effort title from metadata
        $details = $pdf->getDetails();
        $title   = trim((string) ($details['Title'] ?? ''));

        $pages = $pdf->getPages();
        $nodes = [];

        foreach ($pages as $page) {
            $text = trim($page->getText());
            if ($text === '') {
                continue;
            }

            // Each line becomes a paragraph; blank lines add visual separation
            foreach (explode("\n", $text) as $line) {
                $line = trim($line);
                $nodes[] = [
                    'type'    => 'paragraph',
                    'content' => $line !== ''
                        ? [['type' => 'text', 'text' => $line]]
                        : [],
                ];
            }
        }

        if (empty($nodes)) {
            $nodes = [['type' => 'paragraph', 'content' => []]];
        }

        return [
            'title'   => $title !== '' ? $title : 'Imported PDF',
            'content' => ['type' => 'doc', 'content' => $nodes],
        ];
    }
}
