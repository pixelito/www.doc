<?php

namespace App\Support;

/**
 * Small helpers for reading TipTap (ProseMirror) JSON documents.
 *
 * The canonical content format is structured JSON; everything else (plain text
 * for link extraction now, HTML/search later) is derived from it — never the
 * reverse.
 */
class TipTap
{
    /** Recursively collect the concatenated text of all text nodes. */
    public static function plainText(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        $text = '';

        if (isset($doc['text']) && is_string($doc['text'])) {
            $text .= $doc['text'];
        }

        foreach ($doc['content'] ?? [] as $child) {
            if (is_array($child)) {
                $text .= ' '.self::plainText($child);
            }
        }

        return trim($text);
    }

    /**
     * Extract the titles referenced by [[Wiki-link]] syntax, de-duplicated and
     * order-preserved.
     *
     * Handles two storage formats:
     *  - Legacy: [[Title]] as literal text inside paragraph text nodes.
     *  - Phase 2+: {type: "wikiLink", attrs: {title: "..."}} custom nodes.
     *
     * @return list<string>
     */
    public static function wikiLinkTitles(?array $doc): array
    {
        $titles = [];

        // Collect from wikiLink nodes (Phase 2+ format)
        self::collectWikiLinkNodes($doc, $titles);

        // Collect from [[Title]] text patterns (legacy / plain-text format)
        preg_match_all('/\[\[([^\[\]]+)\]\]/', self::plainText($doc), $matches);
        foreach ($matches[1] ?? [] as $t) {
            $titles[] = trim($t);
        }

        $titles = array_filter($titles, fn (string $t) => $t !== '');

        return array_values(array_unique($titles));
    }

    /**
     * Extract a short context snippet (≤ 200 chars) of plain text surrounding
     * the [[Wiki-link]] with the given title within the document.
     */
    public static function contextAround(?array $doc, string $title): string
    {
        if (! $doc) {
            return '';
        }

        foreach ($doc['content'] ?? [] as $topNode) {
            if (! self::nodeContainsWikiLink($topNode, $title)) {
                continue;
            }

            $blockText = self::plainText($topNode);
            $needle    = "[[{$title}]]";
            $pos       = mb_strpos($blockText, $needle);

            if ($pos === false) {
                return mb_substr($blockText, 0, 200);
            }

            $start   = max(0, $pos - 80);
            $snippet = mb_substr($blockText, $start, 200);

            return ($start > 0 ? '…' : '') . trim($snippet) . (mb_strlen($blockText) > $start + 200 ? '…' : '');
        }

        return '';
    }

    private static function nodeContainsWikiLink(?array $node, string $title): bool
    {
        if (! $node) {
            return false;
        }

        if (($node['type'] ?? '') === 'wikiLink' && trim($node['attrs']['title'] ?? '') === $title) {
            return true;
        }

        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child) && self::nodeContainsWikiLink($child, $title)) {
                return true;
            }
        }

        return false;
    }

    /** Recursively collect titles from wikiLink node atoms. */
    private static function collectWikiLinkNodes(?array $node, array &$titles): void
    {
        if (! $node) {
            return;
        }

        if (($node['type'] ?? '') === 'wikiLink') {
            $title = trim($node['attrs']['title'] ?? '');
            if ($title !== '') {
                $titles[] = $title;
            }
        }

        foreach ($node['content'] ?? [] as $child) {
            if (is_array($child)) {
                self::collectWikiLinkNodes($child, $titles);
            }
        }
    }
}
