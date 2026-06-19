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

        // Normalise inline styles + rehost embedded base64 images in one DOM pass
        $html = $this->normalizeHtml($html, auth()->id() ?? 1);

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

    /**
     * Single DOM pass over PhpWord's HTML that (1) normalises inline-style
     * whitespace and (2) rehosts embedded base64 images.
     *
     * PhpWord emits underline as `text-decoration: underline ;` — the stray
     * space before the semicolon means tiptap-php captures the value as
     * "underline " (trailing space) and its exact match against "underline"
     * fails, silently dropping the underline mark. Trimming each declaration's
     * value fixes that for every style-based mark, not just underline.
     */
    private function normalizeHtml(string $html, int $uploadedById): string
    {
        $dom = new DOMDocument();
        // Suppress malformed HTML warnings from PhpWord output
        @$dom->loadHTML($html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR);

        $xpath = new \DOMXPath($dom);

        foreach ($xpath->query('//*[@style]') as $el) {
            $el->setAttribute('style', $this->normalizeStyle($el->getAttribute('style')));
        }

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

    /** Trim whitespace around each `prop: value` declaration in a style string. */
    private function normalizeStyle(string $style): string
    {
        $declarations = [];

        foreach (explode(';', $style) as $declaration) {
            if (! str_contains($declaration, ':')) {
                continue;
            }

            [$prop, $value] = explode(':', $declaration, 2);
            $prop  = trim($prop);
            $value = trim($value);

            if ($prop !== '' && $value !== '') {
                $declarations[] = "{$prop}: {$value}";
            }
        }

        return implode('; ', $declarations);
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
