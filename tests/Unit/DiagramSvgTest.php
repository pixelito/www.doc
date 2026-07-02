<?php

use App\Support\DiagramSvg;

test('it renders a basic node to an SVG string', function () {
    $graph = [
        'nodes' => [
            [
                'id' => 'n1',
                'type' => 'labeled',
                'position' => ['x' => 10, 'y' => 10],
                'data' => ['label' => 'Server', 'color' => 'blue']
            ]
        ],
        'edges' => []
    ];

    $result = DiagramSvg::render($graph);

    expect($result)->toBeArray()
        ->and($result)->toHaveKeys(['svg', 'width', 'height'])
        ->and($result['svg'])->toContain('<svg')
        ->and($result['svg'])->toContain('Server') // Label is rendered
        ->and($result['width'])->toBeGreaterThan(0)
        ->and($result['height'])->toBeGreaterThan(0);
});

test('it renders edges with routing', function () {
    $graph = [
        'nodes' => [
            ['id' => 'n1', 'position' => ['x' => 0, 'y' => 0], 'w' => 100, 'h' => 40],
            ['id' => 'n2', 'position' => ['x' => 0, 'y' => 100], 'w' => 100, 'h' => 40]
        ],
        'edges' => [
            [
                'source' => 'n1',
                'target' => 'n2',
                'data' => ['routing' => 'step']
            ]
        ]
    ];

    $result = DiagramSvg::render($graph);

    expect($result)->toBeArray()
        ->and($result['svg'])->toContain('<path d="M');
});

test('it handles empty graphs gracefully', function () {
    expect(DiagramSvg::render(null))->toBeNull();
    expect(DiagramSvg::render([]))->toBeNull();
    expect(DiagramSvg::render(['nodes' => []]))->toBeNull();
});

test('a non-hex edge colour is rejected, not interpolated into the SVG', function () {
    $graph = [
        'nodes' => [
            ['id' => 'n1', 'position' => ['x' => 0, 'y' => 0]],
            ['id' => 'n2', 'position' => ['x' => 0, 'y' => 100]],
        ],
        'edges' => [
            [
                'source' => 'n1',
                'target' => 'n2',
                'data' => ['color' => '"><script>alert(1)</script>'],
            ],
        ],
    ];

    $svg = DiagramSvg::render($graph)['svg'];

    expect($svg)->not->toContain('<script')
        ->and($svg)->toContain('stroke="#8E938E"'); // fell back to the default
});
