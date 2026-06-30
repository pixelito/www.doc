<?php

use App\Services\RenderDocument;

/** Build a one-node doc wrapping the given node. */
function docWith(array $node): array
{
    return ['type' => 'doc', 'content' => [$node]];
}

test('a network diagram renders its graph as an inline SVG image', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'graph'    => ['nodes' => [
                ['id' => 'n1', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'core-router']],
            ], 'edges' => [], 'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1]],
            'imageSrc' => '/storage/assets/abc123.png',
            'align'    => 'center',
        ],
    ]));

    // The image is rendered from the canonical graph as an inline SVG data-URI —
    // not the (legacy) client-captured imageSrc PNG, which is ignored here.
    expect($html)
        ->toContain('<img')
        ->toContain('src="data:image/svg+xml;base64,')
        ->toContain('class="network-diagram"')
        ->toContain('margin:0 auto;')
        ->not->toContain('/storage/assets/abc123.png');
});

test('a network diagram with an empty graph falls back to a placeholder', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => ['graph' => ['nodes' => [], 'edges' => [], 'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1]]],
    ]));

    expect($html)
        ->toContain('network-diagram-placeholder')
        ->not->toContain('<img');
});

test('the graph plumbing never leaks into the rendered HTML', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'graph'    => [
                'nodes' => [['id' => 'n1', 'position' => ['x' => 42, 'y' => 99], 'data' => ['label' => 'core-router']]],
                'edges' => [['id' => 'e1', 'source' => 'n1', 'target' => 'n2']],
                'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1],
            ],
            'imageSrc' => '/storage/assets/abc123.png',
        ],
    ]));

    // Structural graph data (ids, coordinates, edges, the attr itself) is for the
    // editor/PNG pipeline, never markup.
    expect($html)
        ->not->toContain('"id"')
        ->not->toContain('viewport')
        ->not->toContain('"x":42')
        ->not->toContain('"source"')
        ->not->toContain('graph');
});

test('node labels are emitted as hidden text so full-text search can index them', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'graph'    => ['nodes' => [
                ['id' => 'n1', 'data' => ['label' => 'core-router']],
                ['id' => 'n2', 'data' => ['label' => 'edge-switch']],
            ], 'edges' => []],
            'imageSrc' => '/storage/assets/abc123.png',
        ],
    ]));

    // Labels are present (searchable) but hidden — they ride alongside the PNG,
    // not in place of it, and don't show in the read view / PDF.
    expect($html)
        ->toContain('network-diagram-labels')
        ->toContain('core-router')
        ->toContain('edge-switch')
        ->toContain('<img');

    // Stripping tags (how the search vector is built) surfaces the label text.
    expect(strip_tags($html))->toContain('core-router')->toContain('edge-switch');
});

test('a named diagram renders the name as a caption and the image alt', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'name'     => 'Office LAN',
            'graph'    => ['nodes' => [
                ['id' => 'n1', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'fw']],
            ], 'edges' => []],
            'imageSrc' => '/storage/assets/abc123.png',
        ],
    ]));

    expect($html)
        ->toContain('<figcaption')
        ->toContain('Office LAN')
        ->toContain('alt="Office LAN"');

    // The caption is visible text, so it lands in the search vector too.
    expect(strip_tags($html))->toContain('Office LAN');
});

test('an unnamed diagram captions and alts as "Untitled diagram"', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'graph'    => ['nodes' => [
                ['id' => 'n1', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'host']],
            ], 'edges' => []],
            'imageSrc' => '/storage/assets/abc123.png',
        ],
    ]));

    expect($html)
        ->toContain('<figcaption')
        ->toContain('Untitled diagram')
        ->toContain('alt="Untitled diagram"');
});

test('a diagram with no labels emits no hidden label span', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'graph'    => ['nodes' => [], 'edges' => []],
            'imageSrc' => '/storage/assets/abc123.png',
        ],
    ]));

    expect($html)->not->toContain('network-diagram-labels');
});

test('a diagram node sitting next to text does not disturb the surrounding content', function () {
    $html = RenderDocument::toHtml([
        'type'    => 'doc',
        'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Topology below.']]],
            ['type' => 'networkDiagram', 'attrs' => [
                'graph'    => ['nodes' => [
                    ['id' => 'n1', 'position' => ['x' => 0, 'y' => 0], 'data' => ['label' => 'core']],
                ], 'edges' => []],
                'imageSrc' => '/storage/assets/abc123.png',
            ]],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Notes above.']]],
        ],
    ]);

    expect($html)
        ->toContain('Topology below.')
        ->toContain('Notes above.')
        ->toContain('class="network-diagram"');
});

test('fromHtml parses HTML into a TipTap JSON structure', function () {
    $html = '<h1>Main Heading</h1><p>This is <strong>bold</strong> and <em>italic</em> text.</p>';
    
    $doc = RenderDocument::fromHtml($html);
    
    expect($doc)->toBeArray()
        ->and($doc['type'])->toBe('doc')
        ->and($doc['content'])->toHaveCount(2)
        ->and($doc['content'][0]['type'])->toBe('heading')
        ->and($doc['content'][0]['attrs']['level'])->toBe(1)
        ->and($doc['content'][1]['type'])->toBe('paragraph');
        
    $textNodes = $doc['content'][1]['content'];
    expect($textNodes)->toHaveCount(5)
        ->and($textNodes[0]['text'])->toBe('This is ')
        ->and($textNodes[1]['marks'][0]['type'])->toBe('bold')
        ->and($textNodes[1]['text'])->toBe('bold');
});
