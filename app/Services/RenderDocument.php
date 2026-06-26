<?php

namespace App\Services;

use Tiptap\Core\Node;
use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Highlight;
use Tiptap\Marks\Link;
use Tiptap\Marks\TextStyle;
use Tiptap\Marks\Underline;
use Tiptap\Nodes\Table;
use Tiptap\Nodes\TableCell;
use Tiptap\Nodes\TableHeader;
use Tiptap\Nodes\TableRow;
use Tiptap\Utils\InlineStyle;
use Tiptap\Extensions\TextAlign;

class RenderDocument
{
    public static bool $embedImages = false;

    /** Convert TipTap JSON to HTML — single canonical path for all consumers. */
    public static function toHtml(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        return (new Editor([
            'extensions' => [
                new StarterKit,
                new Underline,
                new Link,
                new ColoredTextStyleMark,
                new Highlight(['multicolor' => true]),
                new ResizableImageNode,
                new NetworkDiagramNode,
                new Table,
                new TableRow,
                new TableHeader,
                new TableCell,
                new WikiLinkNode,
                new TextAlign(['types' => ['heading', 'paragraph']]),
            ],
        ]))->setContent($doc)->getHTML();
    }

    public static function resolveImageToDataUri(string $src): string
    {
        if (str_starts_with($src, 'data:')) {
            return $src;
        }

        try {
            $content = null;
            $mime = 'image/jpeg';

            if (str_starts_with($src, '/storage/')) {
                $relativePath = substr($src, strlen('/storage/'));
                $path = storage_path("app/public/{$relativePath}");
                if (file_exists($path)) {
                    $content = file_get_contents($path);
                    $mime = mime_content_type($path) ?: 'image/jpeg';
                }
            } elseif (filter_var($src, FILTER_VALIDATE_URL)) {
                $ctx = stream_context_create(['http' => ['timeout' => 5]]);
                $content = @file_get_contents($src, false, $ctx);
                
                if ($content) {
                    $finfo = new \finfo(FILEINFO_MIME_TYPE);
                    $mime = $finfo->buffer($content) ?: 'image/jpeg';
                }
            }

            if ($content) {
                return 'data:' . $mime . ';base64,' . base64_encode($content);
            }
        } catch (\Exception $e) {
            // Silently fallback to original src
        }

        return $src;
    }
}

/**
 * Renders image nodes with width and alignment preserved in exports.
 * Applies inline styles so PDF/DOCX pipelines see the correct layout.
 */
class ResizableImageNode extends Node
{
    public static $name = 'image';

    public function renderHTML($node, $HTMLAttributes = [])
    {
        $attrs = $node->attrs ?? (object) [];
        $src   = $attrs->src   ?? '';
        
        if (\App\Services\RenderDocument::$embedImages) {
            $src = \App\Services\RenderDocument::resolveImageToDataUri($src);
        }

        $alt   = $attrs->alt   ?? '';
        $width = $attrs->width ?? null;
        $align = $attrs->align ?? 'left';

        $style = 'max-width:100%;display:block;';
        if ($width)              $style .= "width:{$width}px;";
        if ($align === 'center') $style .= 'margin:0 auto;';
        elseif ($align === 'right') $style .= 'margin-left:auto;';
        $fallback = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23FBFAF5%22 stroke=%22%23E2DFD4%22 stroke-width=%222%22 stroke-dasharray=%228%22 rx=%228%22 /%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-family=%22system-ui, sans-serif%22 font-size=%2214%22 font-weight=%22500%22 fill=%22%238E938E%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22%3EImage Unavailable%3C/text%3E%3C/svg%3E";

        return ['img', array_merge($HTMLAttributes, [
            'src'     => $src,
            'alt'     => $alt,
            'style'   => $style,
            'onerror' => "if(this.src!=='{$fallback}')this.src='{$fallback}';",
        ])];
    }
}

/**
 * Renders the networkDiagram node for every server-side (no-JS) consumer —
 * read view, PDF/DOCX export, search indexing, version snapshots — none of
 * which can run React Flow. The canonical graph lives in the node's `graph`
 * attr; here we emit only the DERIVED PNG (`imageSrc`). A freshly inserted
 * diagram with no render yet falls back to a labelled placeholder.
 */
class NetworkDiagramNode extends Node
{
    public static $name = 'networkDiagram';

    public function parseHTML()
    {
        return [['tag' => 'div[data-network-diagram]']];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        $attrs = $node->attrs ?? (object) [];
        $src   = $attrs->imageSrc ?? null;
        $align = $attrs->align ?? 'left';
        $name  = trim((string) ($attrs->name ?? ''));
        $label = $name !== '' ? $name : 'Untitled diagram';

        // The canonical graph is editor-only, but its node labels are the only
        // searchable text a diagram contributes. Emit them as visually-hidden
        // text so they flow into content_html → the FTS vector (built by both
        // DocumentObserver and search:reindex from the rendered HTML). Hidden so
        // they never show in the read view / PDF, which display the PNG.
        $hidden = static::hiddenLabels($attrs->graph ?? null);

        // The diagram name shows as a caption (and is searchable as visible text);
        // unnamed diagrams caption as "Untitled diagram".
        $caption = '<figcaption class="network-diagram-caption" style="text-align:center;font-size:0.85em;color:#5C625C;margin-top:4px;">'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</figcaption>';

        $style = 'max-width:100%;display:block;';
        if ($align === 'center')    $style .= 'margin:0 auto;';
        elseif ($align === 'right') $style .= 'margin-left:auto;';

        // Prefer a vector render straight from the canonical graph: it always
        // exists, so PDF/export no longer go blank when the client never captured
        // an `imageSrc` PNG. Inlined as a data-URI SVG (Dompdf renders it via
        // php-svg-lib; arrowheads are <polygon>, not <marker>, for that reason).
        $svg = \App\Support\DiagramSvg::render(
            json_decode(json_encode($attrs->graph ?? null), true)
        );
        if ($svg) {
            $src = 'data:image/svg+xml;base64,' . base64_encode($svg['svg']);
            
            if (\App\Services\RenderDocument::$embedImages) {
                // PDF export: Dompdf's php-svg-lib draws our SVG's icons, transforms
                // and geometry correctly but IGNORES the embedded @font-face, so
                // diagram text would fall back to a serif default. process_svg.js
                // bakes the text into Lexend vector PATHS (and strips the
                // unsupported <style>/<defs>/filters), giving an SVG that stays
                // crisp at any zoom — unlike a rasterised PNG. We keep embedding
                // it as SVG (vector), not PNG, and only fall back to the raw inline
                // SVG if the Node pass is unavailable.
                $scriptPath = base_path('process_svg.js');
                if (file_exists($scriptPath)) {
                    $svgFileIn  = sys_get_temp_dir() . '/' . uniqid('pdf_svg_in_') . '.svg';
                    $svgFileOut = sys_get_temp_dir() . '/' . uniqid('pdf_svg_out_') . '.svg';

                    file_put_contents($svgFileIn, $svg['svg']);
                    shell_exec('node ' . escapeshellarg($scriptPath) . ' ' . escapeshellarg($svgFileIn) . ' ' . escapeshellarg($svgFileOut));

                    if (is_file($svgFileOut) && filesize($svgFileOut) > 0) {
                        $src = 'data:image/svg+xml;base64,' . base64_encode(file_get_contents($svgFileOut));
                        @unlink($svgFileOut);
                    }
                    @unlink($svgFileIn);
                }
            }

            $img = '<img'
                . ' src="' . $src . '"'
                . ' alt="' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '" class="network-diagram"'
                . ' style="' . $style . 'width:' . $svg['width'] . 'px;" />';

            return ['content' => '<figure class="network-diagram-figure" style="margin:0;">' . $img . $caption . $hidden . '</figure>'];
        }

        return ['content' => '<div data-network-diagram="true" class="network-diagram-placeholder"></div>' . $caption . $hidden];
    }

    /** Visually-hidden span carrying the diagram's node labels for full-text search. */
    private static function hiddenLabels($graph): string
    {
        $nodes  = (is_object($graph) ? ($graph->nodes ?? []) : []);
        $labels = [];
        foreach ($nodes as $n) {
            $label = is_object($n) ? ($n->data->label ?? null) : null;
            if (is_string($label) && trim($label) !== '') {
                $labels[] = trim($label);
            }
        }

        if (! $labels) {
            return '';
        }

        return '<span class="network-diagram-labels"'
            . ' style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;">'
            . htmlspecialchars(implode(' ', $labels), ENT_QUOTES, 'UTF-8')
            . '</span>';
    }
}

/**
 * tiptap-php extension for the custom wikiLink node.
 * Renders as a styled span (href resolution is a browser-side concern).
 */
class WikiLinkNode extends Node
{
    public static $name = 'wikiLink';

    public function parseHTML()
    {
        return [['tag' => 'span[data-wiki-link]']];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        $title = $node->attrs->title ?? '';
        $target_id = $node->attrs->target_id ?? null;

        $attrs = array_merge($HTMLAttributes, [
            'class'          => 'wiki-link',
            'data-wiki-link' => 'true',
            'data-title'     => $title,
        ]);
        
        if ($target_id) {
            $attrs['data-target-id'] = $target_id;
        }

        return ['span', $attrs, 0];
    }

    public function renderText($node): string
    {
        $title = $node->attrs->title ?? '';

        return htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    }
}

/**
 * tiptap-php's base TextStyle mark carries no attributes; the JS editor's
 * Color extension stores a `color` attr on it. Mirror that here so text colour
 * renders as an inline style in the read view and every exporter.
 */
class ColoredTextStyleMark extends TextStyle
{
    public function addAttributes()
    {
        return [
            'color' => [
                'parseHTML' => fn ($DOMNode) => InlineStyle::getAttribute($DOMNode, 'color') ?: null,
                'renderHTML' => function ($attributes) {
                    if (! ($attributes->color ?? null)) {
                        return null;
                    }

                    return ['style' => "color: {$attributes->color}"];
                },
            ],
        ];
    }
}
