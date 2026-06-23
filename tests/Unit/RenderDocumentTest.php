<?php

use App\Services\RenderDocument;

/** Build a one-node doc wrapping the given node. */
function docWith(array $node): array
{
    return ['type' => 'doc', 'content' => [$node]];
}

test('a network diagram with a rendered image emits that image', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'graph'    => ['nodes' => [], 'edges' => [], 'viewport' => ['x' => 0, 'y' => 0, 'zoom' => 1]],
            'imageSrc' => '/storage/assets/abc123.png',
            'align'    => 'center',
        ],
    ]));

    expect($html)
        ->toContain('<img')
        ->toContain('src="/storage/assets/abc123.png"')
        ->toContain('class="network-diagram"')
        ->toContain('margin:0 auto;');
});

test('a network diagram with no rendered image yet falls back to a placeholder', function () {
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
            ['type' => 'networkDiagram', 'attrs' => ['imageSrc' => '/storage/assets/abc123.png']],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Notes above.']]],
        ],
    ]);

    expect($html)
        ->toContain('Topology below.')
        ->toContain('Notes above.')
        ->toContain('/storage/assets/abc123.png');
});
