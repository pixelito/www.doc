# Structured Diagram Node Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a diagram device node's free-form multi-line label with a structured **name + key/value properties** model, rendered as a device card and edited through a panel.

**Architecture:** A node's `data` gains `props: [{key,value}]` alongside `label` (now the name). One normalizer per side (PHP `DiagramSvg::normalizeNode`, JS `normalizeNodeData`) yields `{name, props}` and migrates legacy multi-line labels on read. The server SVG renderer and the React canvas both render name + rows; the canvas edits via a properties panel in the existing floating `NodeToolbar`; search indexes name + keys + values.

**Tech Stack:** Laravel 13 / PHP 8.3, Pest 4, React 19 + `@xyflow/react`, Tailwind v4, Playwright e2e.

## Global Constraints

- No TypeScript — React is `.jsx` only. (CLAUDE.md)
- Styling via Tailwind token utilities (`text-text-secondary`, `text-foreground`, `border-sage-400`, `bg-surface`…); never raw hex, never inline `style=` for static styling. Dynamic per-node color keeps its existing inline `style`. (styleguide.md)
- SVG text values stay exact: name = `font-size="12" font-weight="bold" fill=self::LABEL_COLOR` (`#1F2520`); property text = `font-size="10"`, key `fill="#5C625C"` (muted), value `fill=self::LABEL_COLOR`. Font family always `Lexend, sans-serif`.
- JSON (`data`) is the single source of truth; SVG/HTML derived. (CLAUDE.md rule 1)
- Scope: device nodes (`labeled`/`LabeledNode`) only — do NOT change `GroupNode` (zone) or edge labels.
- Data shape: `data.label` = name (single line); `data.props` = ordered `[{key:string, value:string}]`, key optional (`''` = value-only row), value single-line. Absent/empty props = name-only node.
- Legacy normalization: when `props` is empty and `label` contains `\n`, first line → name, each remaining non-empty line → `{key:'', value:line}`.
- Render mode: node WITH props → left-aligned card; node with NO props → centered chip (today's look).
- Run PHP/Pest in the container: `docker compose exec app php artisan test …`. Run e2e: `E2E_PASSWORD=password APP_URL=http://localhost:8000 npx playwright test …`.
- No commits without maintainer OK (CLAUDE.md). Commit steps run on branch `develop`; pause for approval before the first commit if executing autonomously.

---

### Task 1: PHP normalizer `DiagramSvg::normalizeNode()`

The shared foundation: turns a node's raw `data` into `{name, props}`, migrating legacy multi-line labels. Reused by the SVG renderer (Task 2) and search (Task 3).

**Files:**
- Modify: `app/Support/DiagramSvg.php` (add a public static method; place it near the other private helpers, e.g. just after `truncate()`).
- Test: `tests/Unit/DiagramSvgTest.php`

**Interfaces:**
- Produces: `DiagramSvg::normalizeNode(array $data): array` returning `['name' => string, 'props' => array<int, array{key:string, value:string}>]`. Consumed by Task 2 and Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Unit/DiagramSvgTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec app php artisan test --filter=DiagramSvgTest`
Expected: the four `normalizeNode …` tests ERROR/FAIL — the method doesn't exist yet (`Call to undefined method`).

- [ ] **Step 3: Implement the normalizer**

In `app/Support/DiagramSvg.php`, add this public static method (place it right after the `truncate()` method):

```php
    /**
     * A device node's display content: its name plus ordered key/value
     * properties. Shared by the SVG renderer and RenderDocument's search-text
     * extraction so both agree. Legacy free-form labels (a multi-line `label`
     * with no `props`) migrate on read: the first line is the name and each
     * remaining non-empty line becomes a value-only property.
     *
     * @return array{name: string, props: array<int, array{key: string, value: string}>}
     */
    public static function normalizeNode(array $data): array
    {
        $label = trim((string) ($data['label'] ?? ''));

        $props = [];
        foreach ((array) ($data['props'] ?? []) as $p) {
            if (! is_array($p)) {
                continue;
            }
            $key   = trim((string) ($p['key'] ?? ''));
            $value = trim((string) ($p['value'] ?? ''));
            if ($key === '' && $value === '') {
                continue; // no blank rows
            }
            $props[] = ['key' => $key, 'value' => $value];
        }

        $lines = array_values(array_filter(
            array_map('trim', explode("\n", $label)),
            fn ($l) => $l !== ''
        ));
        $name = $lines[0] ?? '';

        // Legacy multi-line label (no structured props): extra lines become
        // value-only properties.
        if ($props === [] && count($lines) > 1) {
            foreach (array_slice($lines, 1) as $line) {
                $props[] = ['key' => '', 'value' => $line];
            }
        }

        return ['name' => $name, 'props' => $props];
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec app php artisan test --filter=DiagramSvgTest`
Expected: PASS — the four normalizer tests green (existing DiagramSvgTest cases still green).

- [ ] **Step 5: Commit**

```bash
git add app/Support/DiagramSvg.php tests/Unit/DiagramSvgTest.php
git commit -m "feat: add DiagramSvg::normalizeNode for structured node name + props"
```

---

### Task 2: SVG renders name + property rows

Replace the free-form multi-line tspan block with the name + property-row layout (card when props exist, centered chip when not).

**Files:**
- Modify: `app/Support/DiagramSvg.php` — carry `props` through node mapping (the `$out[] = [...]` block, ~lines 114–124) and replace the labeled-node render block (~lines 447–488).
- Test: `tests/Unit/DiagramSvgTest.php`

**Interfaces:**
- Consumes: `DiagramSvg::normalizeNode()` (Task 1); existing helpers `truncate($s,$w,$perChar)`, `textWidth($s,$perChar)`, `esc`, `n`, `icon`, `LABEL_COLOR`.
- Produces: labeled nodes with props render a bold name plus one row per property (`<text font-size="10">` per key/value); name-only nodes render one centered/icon line as before.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Unit/DiagramSvgTest.php`:

```php
test('a node with properties renders name plus key/value rows', function () {
    $graph = ['nodes' => [[
        'id' => 'n1', 'type' => 'labeled', 'position' => ['x' => 0, 'y' => 0],
        'width' => 180, 'height' => 80,
        'data' => [
            'label' => 'Server1', 'kind' => 'server',
            'props' => [
                ['key' => 'IP', 'value' => '10.10.10.10'],
                ['key' => 'Role', 'value' => 'DB'],
            ],
        ],
    ]], 'edges' => []];

    $svg = DiagramSvg::render($graph)['svg'];

    expect($svg)->toContain('>Server1</text>')       // name
        ->and($svg)->toContain('>IP</text>')          // key
        ->and($svg)->toContain('>10.10.10.10</text>') // value
        ->and($svg)->toContain('>Role</text>')
        ->and($svg)->toContain('>DB</text>')
        ->and($svg)->toContain('fill="#5C625C"')      // muted key colour used
        ->and($svg)->toContain('font-size="10"');     // property rows
});

test('a value-only property renders without a key', function () {
    $graph = ['nodes' => [[
        'id' => 'n1', 'type' => 'labeled', 'position' => ['x' => 0, 'y' => 0],
        'width' => 160, 'height' => 60,
        'data' => ['label' => 'Server1', 'kind' => 'generic',
                   'props' => [['key' => '', 'value' => '10.10.10.10']]],
    ]], 'edges' => []];

    $svg = DiagramSvg::render($graph)['svg'];

    expect($svg)->toContain('>Server1</text>')
        ->and($svg)->toContain('>10.10.10.10</text>');
});

test('a name-only node still renders one centered line', function () {
    $graph = ['nodes' => [[
        'id' => 'n1', 'type' => 'labeled', 'position' => ['x' => 0, 'y' => 0],
        'width' => 150, 'height' => 40, 'data' => ['label' => 'Solo', 'kind' => 'generic'],
    ]], 'edges' => []];

    $svg = DiagramSvg::render($graph)['svg'];

    expect($svg)->toContain('text-anchor="middle"')
        ->and($svg)->toContain('>Solo</text>');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec app php artisan test --filter=DiagramSvgTest`
Expected: the `properties` and `value-only` tests FAIL — current code renders `label` as `<tspan>` lines and ignores `props`, so `>IP</text>` / `font-size="10"` are absent. (The `name-only` test may already pass.)

- [ ] **Step 3: Carry `props` through node mapping**

In `app/Support/DiagramSvg.php`, in the node-mapping `$out[] = [ ... ]` block (currently ~lines 114–124), add a `props` entry alongside `label`:

```php
            $out[] = [
                'id'       => $n['id'] ?? uniqid('n'),
                'type'     => $type,
                'x'        => (float) $x,
                'y'        => (float) $y,
                'w'        => (float) $w,
                'h'        => (float) $h,
                'label'    => (string) ($data['label'] ?? ''),
                'props'    => $data['props'] ?? null,
                'color'    => $data['color'] ?? null,
                'iconKind' => $data['kind'] ?? null,
            ];
```

- [ ] **Step 4: Replace the labeled-node render block**

Replace the whole labeled-node label block (currently ~lines 447–488, from `$rawLabel = ...` through the closing `}` of the `else` branch, i.e. the entire free-form multi-line tspan section) with:

```php
            ['name' => $name, 'props' => $props] = self::normalizeNode([
                'label' => $n['label'],
                'props' => $n['props'] ?? null,
            ]);
            $name = $name !== '' ? $name : 'Node';

            if ($props === []) {
                // Name-only node: today's single centered/icon line.
                $label = self::truncate($name, $b['w'] - ($hasIcon ? 34 : 16));
                if ($hasIcon) {
                    $tw     = self::textWidth($label);
                    $groupW = 16 + 6 + $tw;
                    $ix     = $cx - $groupW / 2;
                    $parts[] = self::icon($kind, $ix, $cy - 8, $c['accent']);
                    $parts[] = '<text x="' . self::n($ix + 22) . '" y="' . self::n($cy + 4)
                        . '" font-family="Lexend, sans-serif" font-size="12" font-weight="bold" fill="' . self::LABEL_COLOR . '">'
                        . self::esc($label) . '</text>';
                } else {
                    $parts[] = '<text x="' . self::n($cx) . '" y="' . self::n($cy + 4)
                        . '" text-anchor="middle" font-family="Lexend, sans-serif" font-size="12" font-weight="bold" fill="' . self::LABEL_COLOR . '">'
                        . self::esc($label) . '</text>';
                }
            } else {
                // Device card: left-aligned name (bold) + property rows below.
                $pad     = 10.0;
                $nameX   = $b['x'] + $pad + ($hasIcon ? 22 : 0);
                $nameY   = $b['y'] + 18;
                $nameMaxW = $b['w'] - ($nameX - $b['x']) - $pad;

                if ($hasIcon) {
                    $parts[] = self::icon($kind, $b['x'] + $pad, $b['y'] + 9, $c['accent']);
                }
                $parts[] = '<text x="' . self::n($nameX) . '" y="' . self::n($nameY)
                    . '" font-family="Lexend, sans-serif" font-size="12" font-weight="bold" fill="' . self::LABEL_COLOR . '">'
                    . self::esc(self::truncate($name, $nameMaxW)) . '</text>';

                // Value column aligns to the widest key (10px text ≈ 5.2px/char).
                $maxKeyW = 0.0;
                foreach ($props as $p) {
                    if ($p['key'] !== '') {
                        $maxKeyW = max($maxKeyW, self::textWidth($p['key'], 5.2));
                    }
                }
                $keyX = $nameX;
                $valX = $keyX + ($maxKeyW > 0 ? $maxKeyW + 8 : 0);
                $rowY = $nameY + 15;

                foreach ($props as $i => $p) {
                    $y = $rowY + $i * 13;
                    if ($p['key'] !== '') {
                        $parts[] = '<text x="' . self::n($keyX) . '" y="' . self::n($y)
                            . '" font-family="Lexend, sans-serif" font-size="10" fill="#5C625C">'
                            . self::esc(self::truncate($p['key'], $maxKeyW, 5.2)) . '</text>';
                    }
                    $vx     = $p['key'] !== '' ? $valX : $keyX;
                    $vMaxW  = $b['w'] - ($vx - $b['x']) - $pad;
                    $parts[] = '<text x="' . self::n($vx) . '" y="' . self::n($y)
                        . '" font-family="Lexend, sans-serif" font-size="10" fill="' . self::LABEL_COLOR . '">'
                        . self::esc(self::truncate($p['value'], $vMaxW, 5.2)) . '</text>';
                }
            }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec app php artisan test --filter=DiagramSvgTest`
Then the wider render suites:
Run: `docker compose exec app php artisan test --filter=RenderDocumentTest && docker compose exec app php artisan test --filter=DocumentDiffTest`
Expected: PASS (name-only diagrams still emit their label text inside a `<text>`, so those `toContain` assertions hold).

- [ ] **Step 6: Commit**

```bash
git add app/Support/DiagramSvg.php tests/Unit/DiagramSvgTest.php
git commit -m "feat: render diagram nodes as name + key/value property rows in SVG"
```

---

### Task 3: Search indexes name + property keys and values

`hiddenLabels()` must surface the name and every property key/value so nodes are findable by any of them.

**Files:**
- Modify: `app/Services/RenderDocument.php` — `hiddenLabels()` (currently ~lines 267–284).
- Test: `tests/Feature/NetworkDiagramTest.php`

**Interfaces:**
- Consumes: `DiagramSvg::normalizeNode()` (Task 1).
- Produces: no signature change; the hidden-text span now contains name + keys + values.

- [ ] **Step 1: Read the existing search test pattern**

Read the `/search?q=core-router` test in `tests/Feature/NetworkDiagramTest.php` (≈ lines 40–65) and its diagram-building helpers, and mirror that setup/assertion shape.

- [ ] **Step 2: Write the test**

Add to `tests/Feature/NetworkDiagramTest.php`, building a document with a diagram node that has a name and properties (use the file's existing diagram/graph helpers; if a helper hard-codes only `label`, construct the node inline with a `data` that includes `props`). Use unique titles:

```php
test('a diagram node is searchable by name, property value, and property key', function () {
    login();

    // Build a document whose diagram has one labeled node:
    //   data => ['label' => 'AppHost', 'kind' => 'server', 'props' => [
    //       ['key' => 'IP', 'value' => '172.16.9.9'],
    //       ['key' => 'Role', 'value' => 'API'],
    //   ]]
    // following the existing "searchable by node label" test's document +
    // diagramDoc(...) construction, with a UNIQUE workspace/page title.

    $this->get('/search?q=AppHost')->assertInertia(/* page found */);      // name
    $this->get('/search?q=172.16.9.9')->assertInertia(/* page found */);   // value (IP)
    $this->get('/search?q=Role')->assertInertia(/* page found */);         // key
});
```

Fill the `assertInertia` closures and the document construction by copying the neighbouring `/search?q=core-router` test verbatim, changing only the node `data` (add `props`) and the titles. Do NOT leave the comments as placeholders — replace them with the real setup/assertions.

- [ ] **Step 3: Run the test to verify it fails**

Run: `docker compose exec app php artisan test --filter=NetworkDiagramTest`
Expected: the new test FAILS on the `Role`/`172.16.9.9` queries — `hiddenLabels()` currently emits only `data.label`, so property keys/values aren't indexed.

- [ ] **Step 4: Update `hiddenLabels()`**

Replace the body of `hiddenLabels()` in `app/Services/RenderDocument.php` (the loop that collects `$labels`) with one that normalizes each node and collects name + keys + values:

```php
    private static function hiddenLabels($graph): string
    {
        $nodes  = (is_object($graph) ? ($graph->nodes ?? []) : []);
        $labels = [];
        foreach ($nodes as $n) {
            $data = is_object($n)
                ? (array) json_decode(json_encode($n->data ?? new \stdClass), true)
                : [];
            ['name' => $name, 'props' => $props] = \App\Support\DiagramSvg::normalizeNode($data);
            if ($name !== '') {
                $labels[] = $name;
            }
            foreach ($props as $p) {
                if ($p['key'] !== '')   $labels[] = $p['key'];
                if ($p['value'] !== '') $labels[] = $p['value'];
            }
        }

        if (! $labels) {
            return '';
        }

        return '<span class="network-diagram-labels"'
            . ' style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;">'
            . htmlspecialchars(implode(' ', $labels), ENT_QUOTES, 'UTF-8')
            . '</span>';
    }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `docker compose exec app php artisan test --filter=NetworkDiagramTest`
Expected: PASS — name, value, and key queries all find the page. Legacy single-line-label diagrams still index their name (existing `core-router` test stays green).

- [ ] **Step 6: Commit**

```bash
git add app/Services/RenderDocument.php tests/Feature/NetworkDiagramTest.php
git commit -m "feat: index diagram node name + property keys/values for search"
```

---

### Task 4: Canvas — structured display + properties panel editor

Give `LabeledNode` a JS normalizer (legacy migration on load), an `onPropsChange` handler, a structured display (name + rows, card vs chip), and a properties editor in the floating toolbar. Then update the e2e.

**Files:**
- Modify: `resources/js/components/editor/DiagramCanvas.jsx` — add a `normalizeNodeData` helper; call it in `hydrateNodes` (~line 581); add `onPropsChange` (near `onLabelChange` ~line 846 and the context wiring ~lines 1111–1116, plus the default context object ~lines 58–59); replace the `LabeledNode` editing/display block and add the properties editor to its `NodeToolbar`. Do NOT touch `GroupNode`.
- Modify: `tests/e2e/diagram.spec.js`.

**Interfaces:**
- Consumes: existing context handlers (`onLabelChange`, `onNodeColorChange`, `onPersist`, etc.), `data.label`, `data.props`.
- Produces: `onPropsChange(id, props)` in `NodeBehavior`; `LabeledNode` renders `data.label` (name) + `data.props` rows and edits them via the panel.

- [ ] **Step 1: Add the JS normalizer and use it in hydrate**

In `resources/js/components/editor/DiagramCanvas.jsx`, add near `hydrateNodes` (before it):

```jsx
// Mirror of App\Support\DiagramSvg::normalizeNode — turns a node's data into a
// name + ordered {key,value} props, migrating a legacy multi-line label (first
// line = name, remaining lines = value-only props) when no structured props
// exist. Keeps the client and the server SVG in agreement.
const normalizeNodeData = (data = {}) => {
    const rawProps = Array.isArray(data.props) ? data.props : [];
    let props = rawProps
        .map((p) => ({ key: (p?.key ?? '').trim(), value: (p?.value ?? '').trim() }))
        .filter((p) => p.key !== '' || p.value !== '');

    const lines = String(data.label ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '');
    const name = lines[0] ?? '';

    if (props.length === 0 && lines.length > 1) {
        props = lines.slice(1).map((value) => ({ key: '', value }));
    }
    return { name, props };
};
```

Then update `hydrateNodes` (currently ~line 581) so labeled nodes are normalized on load:

```jsx
const hydrateNodes = (raw) =>
    sortGroupsFirst((raw ?? []).map((n) => {
        if (n.type === 'group') {
            return { ...n, type: 'group', width: n.width ?? 240, height: n.height ?? 150 };
        }
        const { name, props } = normalizeNodeData(n.data ?? {});
        return { ...n, type: 'labeled', data: { ...n.data, label: name, props } };
    }));
```

- [ ] **Step 2: Add the `onPropsChange` handler and wire the context**

In the default context object (currently ~lines 58–59), add `onPropsChange: () => {}`:

```jsx
    editable: false, onLabelChange: () => {}, onKindChange: () => {}, onPropsChange: () => {},
    onNodeColorChange: () => {}, onNodeColorLive: () => {}, onPersist: () => {},
```

Add the handler next to `onLabelChange` (currently ~line 846):

```jsx
    const onPropsChange = (id, props) => {
        setNodes(nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, props } } : n)));
    };
```

Add it to `behaviorRef.current` (currently ~line 1111) and the exposed context value (currently ~lines 1114–1116):

```jsx
    behaviorRef.current = { onLabelChange, onKindChange, onPropsChange, onNodeColorChange, onNodeColorLive, onEdgeChange, onEdgeDelete, onPersist: commit };
```
```jsx
        onLabelChange: (...a) => behaviorRef.current.onLabelChange(...a),
        onKindChange: (...a) => behaviorRef.current.onKindChange(...a),
        onPropsChange: (...a) => behaviorRef.current.onPropsChange(...a),
        onNodeColorChange: (...a) => behaviorRef.current.onNodeColorChange(...a),
```

- [ ] **Step 3: Replace the LabeledNode editing/display + add the panel**

In `LabeledNode`, pull `onPropsChange` from context and replace the label state/`commit`/editing/display with structured rendering + the panel. Concretely:

3a. Update the context destructure (currently ~line 192) to include `onPropsChange`, and derive name/props:

```jsx
    const { editable, onLabelChange, onKindChange, onPropsChange, onNodeColorChange, onNodeColorLive, onPersist } = useContext(NodeBehavior);
    const name = (data.label ?? '').trim();
    const props = Array.isArray(data.props) ? data.props : [];
```

Remove the now-unused `editing`/`value` state and the `useEffect` syncing `value`, and the `commit` function, and the `onDoubleClick` that set editing.

3b. Replace the node wrapper's alignment + the editing/display block. The wrapper (currently ~line 222) becomes (align left when it has props, keep centered chip when name-only):

```jsx
        <div
            className={`group flex h-full w-full ${props.length ? 'flex-col items-start justify-start gap-0.5' : 'items-center justify-center'} gap-1.5 rounded-md border px-3 py-2 text-xs text-foreground shadow-md ${
                selected ? 'ring-1 ring-sage-400' : ''
            }`}
            style={{ minWidth: 90, background: color.bg, borderColor: color.border }}
        >
```

3c. Replace the `{kind !== 'generic' && <Icon .../>}` + `{editing ? (...) : (...)}` tail (currently ~lines 297–318) with:

```jsx
            {/* Name row (icon + bold name) */}
            <div className="flex items-center gap-1.5 font-bold">
                {kind !== 'generic' && <Icon className="h-4 w-4 shrink-0" stroke={1.5} style={{ color: color.accent }} />}
                <span className={props.length ? 'text-left' : 'text-center'}>{name || 'Node'}</span>
            </div>

            {/* Property rows */}
            {props.length > 0 && (
                <div className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] font-normal leading-tight">
                    {props.map((p, i) => (
                        <div key={i} className="contents">
                            <span className="text-text-secondary">{p.key}</span>
                            <span className="text-foreground">{p.value}</span>
                        </div>
                    ))}
                </div>
            )}
```

3d. Add the properties editor inside the existing `NodeToolbar` — append it after the `<NodeColorRow .../>` (currently ~line 273), still inside the toolbar's flex-col `<div>`:

```jsx
                        <div className="flex flex-col gap-1 border-t border-border pt-1">
                            <input
                                type="text"
                                value={data.label ?? ''}
                                onChange={(e) => onLabelChange(id, e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                placeholder="Name"
                                aria-label="Node name"
                                className="w-40 rounded-sm border border-border bg-canvas px-1.5 py-0.5 text-xs outline-none focus:border-sage-400"
                            />
                            {props.map((p, i) => (
                                <div key={i} className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={p.key}
                                        onChange={(e) => onPropsChange(id, props.map((q, j) => j === i ? { ...q, key: e.target.value } : q))}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        placeholder="Key"
                                        aria-label="Property key"
                                        className="w-16 rounded-sm border border-border bg-canvas px-1.5 py-0.5 text-xs outline-none focus:border-sage-400"
                                    />
                                    <input
                                        type="text"
                                        value={p.value}
                                        onChange={(e) => onPropsChange(id, props.map((q, j) => j === i ? { ...q, value: e.target.value } : q))}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        placeholder="Value"
                                        aria-label="Property value"
                                        className="w-24 rounded-sm border border-border bg-canvas px-1.5 py-0.5 text-xs outline-none focus:border-sage-400"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onPropsChange(id, props.filter((_, j) => j !== i))}
                                        title="Remove property"
                                        aria-label="Remove property"
                                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-text-tertiary hover:bg-danger hover:text-text-inverse"
                                    >
                                        <IconX className="h-3.5 w-3.5" stroke={1.5} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => onPropsChange(id, [...props, { key: '', value: '' }])}
                                className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-foreground"
                            >
                                <IconPlus className="h-3.5 w-3.5" stroke={1.5} /> Add property
                            </button>
                        </div>
```

Ensure `IconX` and `IconPlus` are imported at the top of the file (add to the existing `@tabler/icons-react` import if missing — `IconPlus` is already imported; add `IconX`).

Note on persistence: `onLabelChange`/`onPropsChange` update React Flow state exactly like `onNodeColorChange`, which already persists to the diagram attr on change — no extra wiring needed.

- [ ] **Step 4: Build the frontend**

Run: `docker compose exec app npm run build` (or rely on the running `vite` dev container's HMR — confirm the component reloaded).
Expected: build succeeds.

- [ ] **Step 5: Update the e2e spec**

In `tests/e2e/diagram.spec.js`, the label-editing section (≈ lines 44–52 — currently drives a `textarea`) becomes: set the node name, then add a property via the panel. Replace it with:

```js
    await firstNode.click(); // select → floating editor appears
    const nameInput = diagram.getByRole('textbox', { name: 'Node name' });
    await expect(nameInput).toBeVisible();
    await nameInput.fill(label);
    await diagram.getByRole('button', { name: 'Add property' }).click();
    await diagram.getByRole('textbox', { name: 'Property key' }).fill('IP');
    await diagram.getByRole('textbox', { name: 'Property value' }).fill('10.10.10.10');
    // Deselect to commit (click empty canvas).
    await diagram.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
    await expect(diagram.getByText(label)).toBeVisible();
    await expect(diagram.getByText('10.10.10.10')).toBeVisible();
```

Then in the read-only assertion block (≈ lines 57–62) add:

```js
    await expect(page.locator('[data-network-diagram]').getByText('10.10.10.10')).toBeVisible();
```

Leave the `/search` assertion for `label` untouched (the name still carries the unique stamp).

- [ ] **Step 6: Run the e2e spec**

Run: `E2E_PASSWORD=password APP_URL=http://localhost:8000 npx playwright test tests/e2e/diagram.spec.js`
Expected: PASS — the node shows its name and the `IP 10.10.10.10` row while editing and after Save; search still finds the page by name.

If the spec is flaky around the floating panel (React Flow re-render/selection timing), do NOT add `if (isVisible())` guards (repo rule). Stabilise with explicit waits (`await expect(nameInput).toBeVisible()` before typing; `await expect(...).toBeVisible()` after each step). If it stays flaky after a genuine attempt, keep the JSX change, leave the spec in a compiling state, and report DONE_WITH_CONCERNS with the e2e status noted as a follow-up — do not land a flaky spec.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/editor/DiagramCanvas.jsx tests/e2e/diagram.spec.js
git commit -m "feat: edit diagram node name + properties via a structured panel"
```

---

## Notes

- (record any e2e follow-up here if Task 4 Step 6 deferred the spec)

## Self-Review

**Spec coverage:**
- Data model `label`=name + `props[]` → Tasks 1 (normalizer), 2 (SVG), 4 (client). ✓
- Legacy multi-line normalization → Task 1 (PHP) + Task 4 Step 1 (JS mirror), used by hydrate/render/search. ✓
- Look: name bold + rows, muted key / normal value, card vs chip, auto-size → Task 2 (SVG) + Task 4 Step 3 (canvas). ✓
- Editing panel (Name field + key/value rows + add/remove, live edit, persist on deselect) → Task 4 Steps 2–3. ✓
- Search indexes name + keys + values → Task 3. ✓
- Scope LabeledNode only → stated in each task's Files. ✓
- Empty-key value-only rows; blank-row drop; name fallback 'Node' → Task 1 (drop/trim), Task 2 (value-only render), Task 4 (fallback). ✓
- Not touched (schema parity, process_svg.js, paste, group/edge) → no tasks, correct. ✓

**Placeholder scan:** Task 3 Step 2 instructs copying the neighbouring test's exact `assertInertia` shape (not reproduced verbatim to avoid drift) with explicit fill-in guidance — not an open placeholder. No "TODO/handle edge cases" remain.

**Type/name consistency:** `normalizeNode` (PHP) / `normalizeNodeData` (JS) both return `{name, props}` with `props` = `[{key,value}]`; `onPropsChange(id, props)` used consistently in the handler, context default, `behaviorRef`, and exposed value; SVG helpers (`truncate`, `textWidth`, `esc`, `n`, `icon`, `LABEL_COLOR`) match `DiagramSvg.php`. Icons `IconX`/`IconPlus` noted for import.
