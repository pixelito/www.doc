<?php

namespace App\Services\Importers;

use App\Contracts\ImporterContract;
use DOMDocument;
use PhpOffice\PhpWord\IOFactory;
use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Link;
use Tiptap\Marks\Underline;
use Tiptap\Nodes\Image;
use Tiptap\Nodes\Table;
use Tiptap\Nodes\TableCell;
use Tiptap\Nodes\TableHeader;
use Tiptap\Nodes\TableRow;

class DocxImporter implements ImporterContract
{
    public function __construct(private readonly AssetStore $assetStore) {}

    public function import(string $filePath): array
    {
        $phpWord = IOFactory::load($filePath, 'Word2007');

        // Extract title from document properties before rendering HTML
        $props = $phpWord->getDocInfo();
        $title = trim((string) $props->getTitle());

        // PhpWord HTML writer → raw HTML string
        $writer = IOFactory::createWriter($phpWord, 'HTML');
        $html   = $writer->getContent();

        // Rehost embedded base64 images → real storage URLs
        $html = $this->rehostDataUriImages($html, auth()->id() ?? 1);

        // Strip the full HTML envelope; tiptap-php only wants the body content
        $body = $this->extractBody($html);

        $doc = (new Editor([
            'extensions' => [
                new StarterKit,
                new Underline,
                new Link,
                new Image,
                new Table,
                new TableRow,
                new TableHeader,
                new TableCell,
            ],
        ]))->setContent($body)->getDocument();

        return [
            'title'   => $title !== '' ? $title : 'Imported document',
            'content' => $doc,
        ];
    }

    private function rehostDataUriImages(string $html, int $uploadedById): string
    {
        $dom = new DOMDocument();
        // Suppress malformed HTML warnings from PhpWord output
        @$dom->loadHTML($html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR);

        foreach ($dom->getElementsByTagName('img') as $img) {
            $src = $img->getAttribute('src');
            if (str_starts_with($src, 'data:image/')) {
                $url = $this->assetStore->storeDataUri($src, $uploadedById);
                if ($url) {
                    $img->setAttribute('src', $url);
                }
            }
        }

        return $dom->saveHTML();
    }

    /** Pull just the body content out of a full HTML document. */
    private function extractBody(string $html): string
    {
        if (preg_match('/<body[^>]*>(.*?)<\/body>/si', $html, $m)) {
            return $m[1];
        }

        return $html;
    }
}
