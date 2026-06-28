<?php

use App\Services\RenderDocument;

/**
 * Schema parity guard.
 *
 * The editor schema lives at TWO ends that must agree: the JS editor
 * (`resources/js/components/editor/TipTapEditor.jsx`) and the PHP renderer
 * (`App\Services\RenderDocument`). A node/mark registered in the editor but
 * NOT in RenderDocument is silently dropped from the read view, every export,
 * and the search vector — it errors nowhere, so review never catches it.
 *
 * This test renders ONE fixture document containing every persisted custom
 * node and mark, then asserts each one's signature survives the JSON -> HTML
 * pass. If you teach the editor a new node/mark, add it to `fixtureDoc()`
 * below and assert it here — and the test fails loudly the day RenderDocument
 * forgets its half. (Editor-only extensions that persist no content —
 * Placeholder, SlashCommands, ImageUpload — have no server counterpart and
 * deliberately aren't covered.)
 *
 * Signatures below were captured from real RenderDocument output, not guessed.
 */

/** Every persisted node/mark in the schema, in a single document. */
function fixtureDoc(): array
{
    return ['type' => 'doc', 'content' => [
        ['type' => 'heading', 'attrs' => ['level' => 2, 'textAlign' => 'center'], 'content' => [
            ['type' => 'text', 'text' => 'Heading Centered'],
        ]],
        ['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'marks' => [['type' => 'bold']], 'text' => 'bold '],
            ['type' => 'text', 'marks' => [['type' => 'italic']], 'text' => 'italic '],
            ['type' => 'text', 'marks' => [['type' => 'strike']], 'text' => 'strike '],
            ['type' => 'text', 'marks' => [['type' => 'code']], 'text' => 'code '],
            ['type' => 'text', 'marks' => [['type' => 'underline']], 'text' => 'under '],
            ['type' => 'text', 'marks' => [['type' => 'textStyle', 'attrs' => ['color' => '#ff0000']]], 'text' => 'red '],
            ['type' => 'text', 'marks' => [['type' => 'highlight', 'attrs' => ['color' => '#ffff00']]], 'text' => 'hl '],
            ['type' => 'text', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'https://example.com']]], 'text' => 'link'],
        ]],
        ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'bullet']]],
        ]]]],
        ['type' => 'orderedList', 'content' => [['type' => 'listItem', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'numbered']]],
        ]]]],
        ['type' => 'blockquote', 'content' => [['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => 'quoted'],
        ]]]],
        ['type' => 'codeBlock', 'content' => [['type' => 'text', 'text' => 'echo 1;']]],
        ['type' => 'horizontalRule'],
        ['type' => 'image', 'attrs' => ['src' => '/storage/assets/x.png', 'alt' => 'pic', 'width' => 200, 'align' => 'center']],
        ['type' => 'wikiLink', 'attrs' => ['title' => 'Other Page', 'target_id' => 7]],
        ['type' => 'table', 'content' => [['type' => 'tableRow', 'content' => [
            ['type' => 'tableHeader', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Head']]]]],
            ['type' => 'tableCell', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Cell']]]]],
        ]]]],
        ['type' => 'networkDiagram', 'attrs' => ['name' => 'My Net', 'graph' => [
            'nodes' => [['id' => 'n1', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'router']]],
            'edges' => [],
        ]]],
    ]];
}

beforeEach(function () {
    $this->html = RenderDocument::toHtml(fixtureDoc());
});

test('StarterKit marks survive rendering', function () {
    expect($this->html)
        ->toContain('<strong>bold')      // bold
        ->toContain('<em>italic')        // italic
        ->toContain('<s>strike')         // strike
        ->toContain('<code>code');       // inline code
});

test('underline mark survives rendering', function () {
    // Underline is subclassed/registered explicitly in RenderDocument.
    expect($this->html)->toContain('<u>under');
});

test('text colour (ColoredTextStyleMark) survives rendering', function () {
    // tiptap-php's base TextStyle has no color attr; the subclass adds it.
    expect($this->html)->toContain('color: #ff0000');
});

test('highlight mark survives rendering', function () {
    expect($this->html)
        ->toContain('<mark')
        ->toContain('background-color: #ffff00');
});

test('link mark survives rendering', function () {
    expect($this->html)->toContain('href="https://example.com"');
});

test('block nodes (lists, quote, code block, rule) survive rendering', function () {
    expect($this->html)
        ->toContain('<ul>')
        ->toContain('<ol>')
        ->toContain('<blockquote>')
        ->toContain('<pre><code>echo 1;')
        ->toContain('<hr>');
});

test('text alignment survives rendering', function () {
    expect($this->html)->toContain('text-align: center');
});

test('resizable image node survives rendering', function () {
    expect($this->html)
        ->toContain('<img')
        ->toContain('src="/storage/assets/x.png"')
        ->toContain('width:200px');
});

test('wiki-link node survives rendering', function () {
    expect($this->html)
        ->toContain('class="wiki-link"')
        ->toContain('data-title="Other Page"')
        ->toContain('data-target-id="7"');
});

test('table nodes (row, header, cell) survive rendering', function () {
    expect($this->html)
        ->toContain('<table>')
        ->toContain('<th>')
        ->toContain('<td>')
        ->toContain('Head')
        ->toContain('Cell');
});

test('network diagram node survives rendering', function () {
    expect($this->html)
        ->toContain('class="network-diagram-figure"')
        ->toContain('class="network-diagram"')
        ->toContain('My Net');            // name as caption
});
