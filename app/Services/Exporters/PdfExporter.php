<?php

namespace App\Services\Exporters;

use App\Contracts\ExporterContract;
use App\Models\Document;
use App\Services\RenderDocument;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class PdfExporter implements ExporterContract
{
    public function export(Document $document): string
    {
        $html = $this->buildHtml($document);

        $options = new Options();
        $options->setIsRemoteEnabled(true);
        $options->setIsHtml5ParserEnabled(true);
        $options->setDefaultFont('Lexend');
        $options->setDpi(96);

        // Dompdf INSTALLS the @font-face fonts (TTF + metrics) into its font
        // dir on first render. The default is inside vendor/, which the prod
        // worker (www-data) cannot write — every prod PDF export died with
        // "Permission denied" on the .ufm. Cache under storage/ instead: it's
        // www-data-owned and the shared app-storage volume, so the metrics
        // are built once and reused across app/worker/scheduler.
        $fontDir = storage_path('fonts/dompdf');
        File::ensureDirectoryExists($fontDir);
        $options->setFontDir($fontDir);
        $options->setFontCache($fontDir);

        $pdf = new Dompdf($options);
        $pdf->loadHtml($html, 'UTF-8');
        $pdf->setPaper('A4', 'portrait');
        $pdf->render();

        // Add right-aligned "Page X of Y" via canvas — counter(pages) is not
        // supported in Dompdf CSS so we use the page_script API instead.
        $canvas      = $pdf->getCanvas();
        $font        = $pdf->getFontMetrics()->getFont('Lexend', 'normal');
        $fontSize    = 8;
        $rightMargin = 18 / 25.4 * 72; // 18 mm → pt

        $canvas->page_script(function (int $pageNum, int $pageCount, $cvs) use ($font, $fontSize, $rightMargin) {
            $text  = "Page {$pageNum} of {$pageCount}";
            $x     = $cvs->get_width() - $rightMargin - $cvs->get_text_width($text, $font, $fontSize);
            $y     = $cvs->get_height() - (6 / 25.4 * 72); // 6 mm from physical bottom
            $cvs->text($x, $y, $text, $font, $fontSize, [0.557, 0.576, 0.557]);
        });

        $slug     = $document->slug;
        $filename = "exports/pdf/{$slug}-" . now()->format('YmdHis') . '.pdf';

        Storage::disk('local')->put($filename, $pdf->output());

        return $filename;
    }

    private function buildHtml(Document $document): string
    {
        // finally-reset: a render exception must not leave the static flag set
        // for the rest of this worker process, or later observer saves would
        // embed data URIs into stored content_html.
        RenderDocument::$embedImages = true;
        try {
            $body = RenderDocument::toHtml($document->content);
        } finally {
            RenderDocument::$embedImages = false;
        }
        $title = e($document->title);
        $date  = now()->format('d M Y');

        $lexendRegular = base64_encode(file_get_contents(base_path('fonts/Lexend-Regular.ttf')));
        $lexendBold = base64_encode(file_get_contents(base_path('fonts/Lexend-Bold.ttf')));

        return <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>{$title}</title>
            <style>
                @font-face {
                    font-family: 'Lexend';
                    font-style: normal;
                    font-weight: 400;
                    src: url(data:font/truetype;charset=utf-8;base64,{$lexendRegular}) format('truetype');
                }
                @font-face {
                    font-family: 'Lexend';
                    font-style: normal;
                    font-weight: 600;
                    src: url(data:font/truetype;charset=utf-8;base64,{$lexendBold}) format('truetype');
                }
                @font-face {
                    font-family: 'Lexend';
                    font-style: normal;
                    font-weight: bold;
                    src: url(data:font/truetype;charset=utf-8;base64,{$lexendBold}) format('truetype');
                }
                
                @page {
                    margin: 20mm 18mm 22mm 18mm;
                }
                body {
                    font-family: "Lexend", sans-serif;
                    font-size: 10pt;
                    line-height: 1.6;
                    color: #1F2520;
                }
                /* Running header */
                .page-header {
                    position: fixed; top: -15mm; left: 0; right: 0;
                    font-size: 8pt; color: #8E938E;
                    border-bottom: 0.5pt solid #E2DFD4;
                    padding-bottom: 2mm;
                    display: flex; justify-content: space-between;
                }
                /* Running footer */
                .page-footer {
                    position: fixed; bottom: -16mm; left: 0; right: 0;
                    font-size: 8pt; color: #8E938E;
                    border-top: 0.5pt solid #E2DFD4;
                    padding-top: 2mm;
                    display: flex; justify-content: space-between;
                }
                h1, h2, h3, h4, h5, h6 {
                    font-weight: 600; line-height: 1.25;
                    margin-top: 1.4em; margin-bottom: 0.4em;
                    color: #1F2520; page-break-after: avoid;
                }
                h1 { font-size: 18pt; margin-top: 0; }
                h2 { font-size: 14pt; border-bottom: 0.5pt solid #E2DFD4; padding-bottom: 2pt; }
                h3 { font-size: 12pt; }
                h4, h5, h6 { font-size: 10pt; }
                p { margin: 0 0 0.7em; }
                ul, ol { padding-left: 1.4em; margin: 0 0 0.7em; }
                li { margin-bottom: 0.25em; }
                blockquote {
                    margin: 0.7em 0; padding: 0.4em 0.8em;
                    border-left: 3pt solid #9FB994; color: #5C625C;
                    background: #EDF2EA;
                }
                pre, code {
                    font-family: "DejaVu Sans Mono", monospace;
                    font-size: 8.5pt;
                }
                pre {
                    background: #F5F4ED; border: 0.5pt solid #E2DFD4;
                    padding: 0.6em 0.8em; border-radius: 4pt;
                    white-space: pre-wrap; word-wrap: break-word;
                    page-break-inside: avoid;
                }
                code { background: #EDF2EA; padding: 0 2pt; border-radius: 2pt; }
                table {
                    border-collapse: collapse; width: 100%;
                    margin: 0.7em 0; page-break-inside: avoid;
                    font-size: 9pt; table-layout: auto;
                }
                th, td {
                    border: 0.5pt solid #E2DFD4;
                    padding: 4pt 6pt; text-align: left;
                    width: auto !important;
                    word-wrap: break-word;
                    word-break: break-word;
                }
                th { background-color: #EDF2EA; font-weight: 600; }
                hr {
                    border: none; border-top: 0.5pt solid #E2DFD4;
                    margin: 1.2em 0;
                }
                /* Task lists: hide the HTML checkbox (Dompdf draws form
                   widgets unreliably) and prefix a glyph instead. DejaVu Sans
                   ships with Dompdf and has U+2610/U+2611. */
                ul[data-type="taskList"] { list-style: none; padding-left: 0.4em; }
                li[data-type="taskItem"] input,
                li[data-type="taskItem"] label span { display: none; }
                li[data-type="taskItem"]::before {
                    content: "\\2610  ";
                    font-family: "DejaVu Sans", sans-serif;
                    color: #5C625C;
                }
                li[data-type="taskItem"][data-checked="true"]::before {
                    content: "\\2611  ";
                    color: #648354;
                }
                li[data-type="taskItem"] div, li[data-type="taskItem"] label { display: inline; }
                li[data-type="taskItem"] div p { display: inline; margin: 0; }
                /* Callouts: light-theme token triads (Dompdf has no CSS vars). */
                .callout {
                    padding: 0.6em 0.8em; margin: 0 0 0.7em;
                    border: 0.5pt solid; border-radius: 4pt;
                    page-break-inside: avoid;
                }
                .callout p { margin: 0 0 0.35em; }
                .callout-info    { background: #EDF2EA; border-color: #BFD2B5; color: #364E2E; }
                .callout-success { background: #DAE6D4; border-color: #BFD2B5; color: #4B6840; }
                .callout-warning { background: #FAF1E2; border-color: #E8C58E; color: #7A5520; }
                .callout-danger  { background: #F3E7E2; border-color: #DDB3A6; color: #B5573E; }
                img { max-width: 100%; height: auto; }
                a { color: #4A6741; text-decoration: none; }
                /* Match the live read view: sage-600 text, sage-300 underline. */
                .wiki-link {
                    color: #4B6840; font-weight: 500;
                    text-decoration: underline;
                    text-decoration-color: #9FB994;
                }
            </style>
        </head>
        <body>
            <div class="page-header">
                <span>{$title}</span>
                <span>{$date}</span>
            </div>
            <div class="page-footer">
                <span>www.doc</span>
            </div>
            <h1>{$title}</h1>
            {$body}
        </body>
        </html>
        HTML;
    }

}
