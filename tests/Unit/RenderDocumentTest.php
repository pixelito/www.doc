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

test('the canonical graph attr never leaks into the rendered HTML', function () {
    $html = RenderDocument::toHtml(docWith([
        'type'  => 'networkDiagram',
        'attrs' => [
            'graph'    => ['nodes' => [['id' => 'n1', 'data' => ['label' => 'core-router']]], 'edges' => []],
            'imageSrc' => '/storage/assets/abc123.png',
        ],
    ]));

    // The graph is data for the editor/PNG pipeline, not markup.
    expect($html)->not->toContain('core-router')->not->toContain('graph');
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
