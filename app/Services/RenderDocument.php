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

        return ['img', array_merge($HTMLAttributes, [
            'src'   => $src,
            'alt'   => $alt,
            'style' => $style,
        ])];
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

        return ['span', array_merge($HTMLAttributes, [
            'class'          => 'wiki-link',
            'data-wiki-link' => 'true',
            'data-title'     => $title,
        ]), 0];
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
