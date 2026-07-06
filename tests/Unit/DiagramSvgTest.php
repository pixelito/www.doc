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

test('it renders a multi-line label as separate tspans (icon node)', function () {
    $graph = [
        'nodes' => [
            [
                'id' => 'n1',
                'type' => 'labeled',
                'position' => ['x' => 10, 'y' => 10],
                'width' => 160,
                'height' => 60,
                'data' => ['label' => "Server1\n10.10.10.10", 'color' => 'blue', 'kind' => 'server'],
            ],
        ],
        'edges' => [],
    ];

    $svg = DiagramSvg::render($graph)['svg'];

    // Two lines => two tspans, each carrying one line's text.
    expect(substr_count($svg, '<tspan'))->toBe(2)
        ->and($svg)->toContain('>Server1</tspan>')
        ->and($svg)->toContain('>10.10.10.10</tspan>');
});

test('it renders a multi-line label as separate tspans (generic/iconless node)', function () {
    $graph = [
        'nodes' => [
            [
                'id' => 'n1',
                'type' => 'labeled',
                'position' => ['x' => 0, 'y' => 0],
                'width' => 160,
                'height' => 60,
                'data' => ['label' => "Line A\nLine B", 'color' => 'default', 'kind' => 'generic'],
            ],
        ],
        'edges' => [],
    ];

    $svg = DiagramSvg::render($graph)['svg'];

    expect(substr_count($svg, '<tspan'))->toBe(2)
        ->and($svg)->toContain('text-anchor="middle"') // centered layout preserved
        ->and($svg)->toContain('>Line A</tspan>')
        ->and($svg)->toContain('>Line B</tspan>');
});

test('a single-line label still renders (one tspan) and stays searchable text', function () {
    $graph = [
        'nodes' => [[
            'id' => 'n1', 'type' => 'labeled', 'position' => ['x' => 0, 'y' => 0],
            'width' => 150, 'height' => 40, 'data' => ['label' => 'Solo', 'kind' => 'generic'],
        ]],
        'edges' => [],
    ];

    $svg = DiagramSvg::render($graph)['svg'];

    expect(substr_count($svg, '<tspan'))->toBe(1)
        ->and($svg)->toContain('>Solo</tspan>');
});

test('normalizeNode keeps a plain name and structured props', function () {
    $out = DiagramSvg::normalizeNode([
        'label' => 'Server1',
        'props' => [
            ['key' => 'IP', 'value' => '10.10.10.10'],
            ['key' => 'Role', 'value' => 'DB'],
        ],
    ]);

    expect($out['name'])->toBe('Server1')
        ->and($out['props'])->toBe([
            ['key' => 'IP', 'value' => '10.10.10.10'],
            ['key' => 'Role', 'value' => 'DB'],
        ]);
});

test('normalizeNode drops fully blank prop rows and trims', function () {
    $out = DiagramSvg::normalizeNode([
        'label' => '  Server1 ',
        'props' => [
            ['key' => ' IP ', 'value' => ' 10.0.0.1 '],
            ['key' => '', 'value' => ''],
            ['key' => 'Note', 'value' => ''],
        ],
    ]);

    expect($out['name'])->toBe('Server1')
        ->and($out['props'])->toBe([
            ['key' => 'IP', 'value' => '10.0.0.1'],
            ['key' => 'Note', 'value' => ''],
        ]);
});

test('normalizeNode migrates a legacy multi-line label to value-only props', function () {
    $out = DiagramSvg::normalizeNode(['label' => "Server1\n10.10.10.10\nprod"]);

    expect($out['name'])->toBe('Server1')
        ->and($out['props'])->toBe([
            ['key' => '', 'value' => '10.10.10.10'],
            ['key' => '', 'value' => 'prod'],
        ]);
});

test('normalizeNode does not migrate legacy lines when structured props exist', function () {
    $out = DiagramSvg::normalizeNode([
        'label' => "Server1\nignored-second-line",
        'props' => [['key' => 'IP', 'value' => '10.0.0.1']],
    ]);

    expect($out['name'])->toBe('Server1')
        ->and($out['props'])->toBe([['key' => 'IP', 'value' => '10.0.0.1']]);
});
