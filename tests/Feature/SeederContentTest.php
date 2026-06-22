<?php

use Database\Seeders\WorkspaceSeeder;

/**
 * Guards against re-introducing empty/null text nodes in seeded content.
 * ProseMirror rejects a text node whose `text` isn't a non-empty string, and a
 * single one blanks the whole page in the editor (tiptap-php renders it, so the
 * read view "works" while the editor is blank — a confusing data bug).
 */
it('the inline content builder never emits an empty text node', function () {
    $seeder = new WorkspaceSeeder;
    $inline = (new ReflectionMethod($seeder, 'inline'));
    $inline->setAccessible(true);

    $cases = [
        '[[Only A Link]]',          // a paragraph that is just a link
        'lead text [[Link]]',       // link at the end
        '[[Link]] trailing text',   // link at the start
        '[[A]] and [[B]] guides',   // multiple links
        'plain text only',
        'has `inline code` too',
        '',                         // empty paragraph
    ];

    foreach ($cases as $text) {
        foreach ($inline->invoke($seeder, $text) as $node) {
            if (($node['type'] ?? null) === 'text') {
                expect($node['text'] ?? null)->toBeString()->not->toBe('');
            }
        }
    }
});
