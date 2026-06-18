<?php

namespace App\Services;

use Tiptap\Core\Node;
use Tiptap\Editor;
use Tiptap\Extensions\StarterKit;
use Tiptap\Marks\Link;
use Tiptap\Marks\Underline;
use Tiptap\Nodes\Image;
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
                new Image,
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
