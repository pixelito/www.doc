<?php

namespace App\Services;

use Tiptap\Core\Node;
use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Link;
use Tiptap\Marks\Underline;
use Tiptap\Nodes\Table;
use Tiptap\Nodes\TableCell;
use Tiptap\Nodes\TableHeader;
use Tiptap\Nodes\TableRow;

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
