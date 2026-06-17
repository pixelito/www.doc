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
     * @return list<string>
     */
    public static function wikiLinkTitles(?array $doc): array
    {
        preg_match_all('/\[\[([^\[\]]+)\]\]/', self::plainText($doc), $matches);

        $titles = array_map('trim', $matches[1] ?? []);
        $titles = array_filter($titles, fn (string $t) => $t !== '');

        return array_values(array_unique($titles));
    }
}
