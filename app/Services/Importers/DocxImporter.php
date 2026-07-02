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

    public function import(string $filePath, ?int $uploadedById = null): array
    {
        // PhpWord's reader checks numbering before heading style, so a *numbered*
        // heading (heading style + <w:numPr>, very common in technical docs) is
        // read as a list item and loses its heading level. Strip the numbering
        // from heading paragraphs first so they're recognised as headings.
        $this->unNumberHeadings($filePath);

        $phpWord = IOFactory::load($filePath, 'Word2007');

        // Extract title from document properties before rendering HTML
        $props = $phpWord->getDocInfo();
        $title = trim((string) $props->getTitle());

        // PhpWord HTML writer → raw HTML string
        $writer = IOFactory::createWriter($phpWord, 'HTML');
        $html   = $writer->getContent();

        // Normalise inline styles + rehost embedded base64 images in one DOM pass.
        // The uploader rides the ConversionJob row (queue workers have no auth);
        // a null user stores the assets unattributed rather than pinning them on
        // an arbitrary account.
        $html = $this->normalizeHtml($html, $uploadedById ?? auth()->id());

        // Strip the full HTML envelope; tiptap-php only wants the body content
        $body = $this->extractBody($html);

        // Use the one canonical schema parser so we don't drop formatting (like
        // text alignment or colours) that the main schema supports.
        $doc = \App\Services\RenderDocument::fromHtml($body);

        return [
            'title'   => $title !== '' ? $title : 'Imported document',
            'content' => $doc,
        ];
    }

    /**
     * Remove <w:numPr> from heading-styled paragraphs in word/document.xml, in
     * place. Numbered headings would otherwise be read as list items because
     * PhpWord's reader matches numbering before heading style. The auto-generated
     * number prefix is cosmetic and not part of the heading text, so dropping it
     * is lossless for our purposes. Real lists (no heading style) are untouched.
     */
    private function unNumberHeadings(string $filePath): void
    {
        $zip = new \ZipArchive();
        if ($zip->open($filePath) !== true) {
            return;
        }

        $xml = $zip->getFromName('word/document.xml');
        if ($xml === false) {
            $zip->close();
            return;
        }

        $patched = preg_replace_callback(
            '#<w:pPr\b[^>]*>.*?</w:pPr>#s',
            function (array $m): string {
                $pPr = $m[0];

                if (! preg_match('/<w:pStyle\b[^>]*w:val="Heading\d"/', $pPr)) {
                    return $pPr;
                }

                $pPr = preg_replace('#<w:numPr\b[^>]*>.*?</w:numPr>#s', '', $pPr);

                return preg_replace('#<w:numPr\b[^>]*/>#', '', $pPr);
            },
            $xml
        );

        if (is_string($patched) && $patched !== $xml) {
            $zip->addFromString('word/document.xml', $patched);
        }

        $zip->close();
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
    private function normalizeHtml(string $html, ?int $uploadedById): string
    {
        $dom = new DOMDocument();
        // Suppress malformed HTML warnings from PhpWord output
        @$dom->loadHTML($html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR);

        $xpath = new \DOMXPath($dom);

        foreach ($xpath->query('//*[@style]') as $el) {
            $style = $this->normalizeStyle($el->getAttribute('style'));

            $wrapTags = [];
            if (preg_match('/\bfont-weight:\s*bold\b/i', $style)) {
                $wrapTags[] = 'strong';
                $style = preg_replace('/\bfont-weight:\s*bold\b/i', '', $style);
            }
            if (preg_match('/\bfont-style:\s*italic\b/i', $style)) {
                $wrapTags[] = 'em';
                $style = preg_replace('/\bfont-style:\s*italic\b/i', '', $style);
            }
            if (preg_match('/\btext-decoration:\s*underline\b/i', $style)) {
                $wrapTags[] = 'u';
                $style = preg_replace('/\btext-decoration:\s*underline\b/i', '', $style);
            }
            if (preg_match('/\btext-decoration:\s*line-through\b/i', $style)) {
                $wrapTags[] = 's';
                $style = preg_replace('/\btext-decoration:\s*line-through\b/i', '', $style);
            }

            $style = trim(str_replace(';;', ';', $style), ' ;');

            if ($style === '') {
                $el->removeAttribute('style');
            } else {
                $el->setAttribute('style', $style);
            }

            if ($wrapTags) {
                $current = $el;
                foreach ($wrapTags as $tag) {
                    $wrapper = $dom->createElement($tag);
                    $current->parentNode->insertBefore($wrapper, $current);
                    $wrapper->appendChild($current);
                    $current = $wrapper;
                }
            }
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
        $body = preg_match('/<body[^>]*>(.*?)<\/body>/si', $html, $m) ? $m[1] : $html;

        // PhpWord renders a Title (depth 0) as <h0>, which TipTap doesn't support
        // and would otherwise flatten into a stray top-level text node. Promote it
        // to a level-1 heading.
        return str_ireplace(['<h0>', '</h0>'], ['<h1>', '</h1>'], $body);
    }
}
