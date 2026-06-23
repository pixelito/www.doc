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

class RenderDocument
{
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
            ],
        ]))->setContent($doc)->getHTML();
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

        if ($src) {
            $style = 'max-width:100%;display:block;';
            if ($align === 'center')    $style .= 'margin:0 auto;';
            elseif ($align === 'right') $style .= 'margin-left:auto;';

            $img = '<img'
                . ' src="' . htmlspecialchars($src, ENT_QUOTES, 'UTF-8') . '"'
                . ' alt="' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '" class="network-diagram"'
                . ' style="' . $style . '" />';

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
