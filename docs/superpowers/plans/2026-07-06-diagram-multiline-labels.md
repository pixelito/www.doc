# Multi-line Diagram Node Labels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a network-diagram device node hold free-form multi-line label text (e.g. `Server1` on line 1, `10.10.10.10` on line 2), rendered identically in the interactive canvas and the derived server-side SVG.

**Architecture:** A diagram is a React Flow graph stored as opaque JSON in the `networkDiagram` TipTap node's `graph` attr; node text is `node.data.label`. That one string feeds two renderers that must stay in sync: the editable canvas (`DiagramCanvas.jsx`) and the no-JS server SVG (`DiagramSvg.php`, used by PDF/DOCX/search/snapshots). We make `data.label` a multi-line string: the SVG splits it into `<tspan>` lines; the canvas edits it in a `<textarea>` and displays it with `whitespace-pre-line`. Node box dimensions are canvas-measured and already flow into the SVG, so height grows automatically.

**Tech Stack:** Laravel 13 / PHP 8.3, Pest 4 (unit + feature tests), React 19 + `@xyflow/react` (React Flow), Tailwind v4, Playwright e2e.

## Global Constraints

- No TypeScript — React is `.jsx` only. (CLAUDE.md)
- Styling via Tailwind token utilities (`bg-canvas`, `border-sage-400`, `text-text-tertiary`…); never raw hex, never inline `style=` for static styling. Dynamic per-node color may keep its existing inline `style` (already in the file). (styleguide.md)
- Font is Lexend; SVG text font is `Lexend, sans-serif`, `font-size="12"`, `font-weight="bold"`, `fill=self::LABEL_COLOR` (`#1F2520`). Keep these exact values.
- JSON (`data.label`) is the single source of truth; SVG/HTML are derived. Do not add a second label field. (CLAUDE.md rule 1)
- Scope is device nodes (`LabeledNode`) only — do NOT change `GroupNode` (zone) or edge labels.
- Run PHP/Pest inside the container: `docker compose exec app php artisan test …` (PHP is not installed on the host). Run e2e per CLAUDE.md: `E2E_PASSWORD=password APP_URL=http://localhost:8000 npx playwright test …`.
- No commits without the maintainer's OK (CLAUDE.md "Do not commit, always ask first"). The commit steps below stage + commit locally; if executing autonomously, still pause for approval before the FIRST commit per the repo rule.

---

### Task 1: Server-side SVG renders multi-line labels

**Files:**
- Modify: `app/Support/DiagramSvg.php` (labeled-node block, currently lines 447–460)
- Test: `tests/Unit/DiagramSvgTest.php`

**Interfaces:**
- Consumes: existing private helpers `self::truncate(string $label, float $w): string`, `self::textWidth(string $s): float`, `self::esc(string $s): string`, `self::n(float $v): string`, `self::icon(...)`, and constant `self::LABEL_COLOR`.
- Produces: multi-line labeled nodes render as a single `<text>` element containing one `<tspan x=… y=…>` per `\n`-separated line. Single-line labels still render one `<tspan>` (output still `toContain` the label string). No new public methods.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Unit/DiagramSvgTest.php`:

```php
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `docker compose exec app php artisan test --filter=DiagramSvgTest`
Expected: the three new tests FAIL — current code emits the label directly inside `<text>` with no `<tspan>`, so `substr_count($svg, '<tspan')` is `0`.

- [ ] **Step 3: Implement multi-line rendering**

In `app/Support/DiagramSvg.php`, replace the labeled-node label block (currently lines 447–460, from `$label = self::truncate(...)` through the closing `}` of the `else` branch) with:

```php
            $rawLabel = $n['label'] !== '' ? $n['label'] : 'Node';
            $maxTextW = $b['w'] - ($hasIcon ? 34 : 16);

            // Free-form multi-line labels: one <tspan> per line, block vertically
            // centred on the box. `truncate()` clips each line independently.
            $lines  = array_map(
                fn (string $ln): string => self::truncate($ln, $maxTextW),
                explode("\n", $rawLabel)
            );
            $lineH   = 14.0;
            // Baseline of line 0, shifted up so the block is centred on ($cy + 4)
            // (the same visual baseline the single-line layout used).
            $baseY   = $cy + 4 - ($lineH * (count($lines) - 1) / 2);

            if ($hasIcon) {
                // Icon + text group is centred horizontally on the WIDEST line.
                $tw = 0.0;
                foreach ($lines as $ln) {
                    $tw = max($tw, self::textWidth($ln));
                }
                $groupW = 16 + 6 + $tw;
                $ix     = $cx - $groupW / 2;
                $textX  = $ix + 22;
                $parts[] = self::icon($kind, $ix, $cy - 8, $c['accent']);

                $tspans = '';
                foreach ($lines as $i => $ln) {
                    $tspans .= '<tspan x="' . self::n($textX) . '" y="' . self::n($baseY + $i * $lineH) . '">'
                        . self::esc($ln) . '</tspan>';
                }
                $parts[] = '<text font-family="Lexend, sans-serif" font-size="12" font-weight="bold" fill="'
                    . self::LABEL_COLOR . '">' . $tspans . '</text>';
            } else {
                $tspans = '';
                foreach ($lines as $i => $ln) {
                    $tspans .= '<tspan x="' . self::n($cx) . '" y="' . self::n($baseY + $i * $lineH) . '">'
                        . self::esc($ln) . '</tspan>';
                }
                $parts[] = '<text text-anchor="middle" font-family="Lexend, sans-serif" font-size="12" font-weight="bold" fill="'
                    . self::LABEL_COLOR . '">' . $tspans . '</text>';
            }
```

Note: `x`/`y` are set absolutely on every `<tspan>` (not `dy`) so vertical advance never drifts horizontally. A single-line label yields exactly one `<tspan>` at `$cy + 4`, matching the previous baseline.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `docker compose exec app php artisan test --filter=DiagramSvgTest`
Expected: PASS — all DiagramSvgTest tests green, including the pre-existing `it renders a basic node to an SVG string` (its `toContain('Server')` still holds, now inside a `<tspan>`).

- [ ] **Step 5: Guard against a wider regression**

Run: `docker compose exec app php artisan test --filter=DiagramSvg`
Also run the render/diff suites that assert diagram SVG output:
Run: `docker compose exec app php artisan test --filter=RenderDocumentTest && docker compose exec app php artisan test --filter=DocumentDiffTest`
Expected: PASS (these assert diagram text is present; `toContain` on a label still holds inside a `<tspan>`).

- [ ] **Step 6: Commit**

```bash
git add app/Support/DiagramSvg.php tests/Unit/DiagramSvgTest.php
git commit -m "feat: render multi-line diagram node labels in server-side SVG"
```

---

### Task 2: Regression test — multi-line labels stay searchable

Confirms the "no code change needed" claim for search: `RenderDocument::hiddenLabels()` already keeps internal newlines, and the FTS tokenizer splits on them, so each line is an independent search token. This task adds the guard test; it must pass with NO production change.

**Files:**
- Test: `tests/Feature/NetworkDiagramTest.php`

**Interfaces:**
- Consumes: existing test helpers/patterns in `NetworkDiagramTest.php` (it already searches via `GET /search?q=…` and asserts diagram labels are found through hidden-label text).
- Produces: nothing consumed downstream — a standalone regression guard.

- [ ] **Step 1: Read the existing search test for the exact pattern**

Read `tests/Feature/NetworkDiagramTest.php` around the existing `/search?q=core-router` assertion (≈ lines 40–65) and mirror its document-creation + `assertInertia` search-result shape exactly (same factory/route usage, same auth setup). Reuse that pattern rather than inventing a new one.

- [ ] **Step 2: Write the failing (should-pass) test**

Add a test that creates a document containing a diagram whose node label is `"WebHost\n192.168.5.5"` (a `\n` in the label), following the existing test's construction, then asserts BOTH lines are independently findable:

```php
test('a multi-line node label is searchable line by line', function () {
    // Build the document + diagram exactly like the existing
    // "searchable by node label" test above, but with a two-line label:
    //   'data' => ['label' => "WebHost\n192.168.5.5", ...]
    // (copy that test's setup verbatim, changing only the label value and the
    //  workspace/page titles so it doesn't collide).

    // First line is its own token:
    $this->get('/search?q=WebHost')->assertInertia(/* result contains the page */);

    // Second line is its own token (newline acted as a separator):
    $this->get('/search?q=192.168.5.5')->assertInertia(/* result contains the page */);
});
```

Fill the `assertInertia` closures by copying the shape from the existing `/search?q=core-router` assertion in the same file (same prop path and `where(...)` used there). Do not leave the comments as placeholders — replace them with the real setup and assertions copied from the neighbouring test.

- [ ] **Step 3: Run the test**

Run: `docker compose exec app php artisan test --filter=NetworkDiagramTest`
Expected: PASS with no production change — proving multi-line labels are already searched per line. If it FAILS (e.g. the two tokens are concatenated), STOP: the search path does need work; add a step to `RenderDocument::hiddenLabels()` to `str_replace("\n", ' ', $label)` before imploding, and note it here.

- [ ] **Step 4: Commit**

```bash
git add tests/Feature/NetworkDiagramTest.php
git commit -m "test: cover multi-line diagram labels indexing per line for search"
```

---

### Task 3: Canvas edits and displays multi-line labels

Turn the single-line `<input>` into a `<textarea>` (Enter inserts a newline, Escape reverts, blur commits) and render the label with preserved line breaks. Update the existing e2e spec, which currently drives the label through an `<input>` and commits with Enter.

**Files:**
- Modify: `resources/js/components/editor/DiagramCanvas.jsx` — `LabeledNode`, the `editing ? (...) : (...)` block (currently lines 299–314). Do NOT touch `GroupNode` (the zone label around line 360).
- Modify: `tests/e2e/diagram.spec.js` (label editing + persistence assertions, currently ≈ lines 44–62).

**Interfaces:**
- Consumes: the component's existing `value`/`setValue` state, `editing`/`setEditing` state, `commit()` (`onLabelChange(id, value.trim() || 'Node')`), and `data.label`.
- Produces: while editing, the node label control is a `<textarea>` (locator `firstNode.locator('textarea')`); read state shows the label in a `whitespace-pre-line` `<span>`. Enter inserts a newline; blur commits; Escape reverts.

- [ ] **Step 1: Update the editing + display markup**

In `resources/js/components/editor/DiagramCanvas.jsx`, replace the `LabeledNode` block (currently lines 299–314):

```jsx
            {editing ? (
                <input
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(); }
                        if (e.key === 'Escape') { setEditing(false); setValue(data.label ?? ''); }
                    }}
                    className="w-full rounded-sm border border-sage-400 bg-canvas px-1 text-center text-xs outline-none"
                />
            ) : (
                <span>{data.label || 'Node'}</span>
            )}
```

with:

```jsx
            {editing ? (
                <textarea
                    autoFocus
                    rows={Math.max(1, value.split('\n').length)}
                    onFocus={(e) => e.target.select()}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        // Enter inserts a newline (free-form multi-line labels);
                        // Escape reverts; blur commits. Stop keys reaching React
                        // Flow's canvas shortcuts while typing.
                        e.stopPropagation();
                        if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setValue(data.label ?? ''); }
                    }}
                    className="w-full resize-none rounded-sm border border-sage-400 bg-canvas px-1 text-center text-xs leading-tight outline-none"
                />
            ) : (
                <span className="whitespace-pre-line text-center">{data.label || 'Node'}</span>
            )}
```

Rationale: dropping the `Enter` branch lets the textarea insert a newline; `rows` auto-grows with line count; `whitespace-pre-line` renders the `\n`s as stacked, centred lines. `commit()` is unchanged — `value.trim()` keeps internal newlines and empties fall back to `'Node'`.

- [ ] **Step 2: Build the frontend so the change is live**

Run: `docker compose exec app npm run build` (or rely on the `vite` dev container if hot-reloading).
Expected: build succeeds, no errors.

- [ ] **Step 3: Update the e2e spec to the textarea + multi-line flow**

In `tests/e2e/diagram.spec.js`, the label-editing section (≈ lines 44–52) currently reads:

```js
    await firstNode.dblclick();
    const labelInput = firstNode.locator('input');
    await expect(labelInput).toBeVisible();
    await labelInput.fill(label);
    await labelInput.press('Enter');
    await expect(diagram.getByText(label)).toBeVisible();
```

Replace it with (types line 1, presses Enter to make a real newline, types line 2, commits by blurring):

```js
    await firstNode.dblclick();
    const labelArea = firstNode.locator('textarea');
    await expect(labelArea).toBeVisible();
    await labelArea.pressSequentially(label);   // replaces selected default 'Node'
    await labelArea.press('Enter');             // Enter now inserts a newline
    await labelArea.pressSequentially('10.10.10.10');
    await labelArea.blur();                      // blur commits
    await expect(diagram.getByText(label)).toBeVisible();
    await expect(diagram.getByText('10.10.10.10')).toBeVisible();
```

Then, in the read-only assertion block (≈ lines 57–62), add a second-line check alongside the existing `label` check:

```js
    await expect(page.locator('[data-network-diagram]').getByText('10.10.10.10')).toBeVisible();
```

Leave the existing `/search` assertion for `label` untouched — the first line still carries the unique stamp.

- [ ] **Step 4: Run the e2e spec**

Run: `E2E_PASSWORD=password APP_URL=http://localhost:8000 npx playwright test tests/e2e/diagram.spec.js`
Expected: PASS — the node shows two lines while editing and after save; search still finds the page by the first line.

If the spec is flaky specifically around driving the `<textarea>` (focus/blur timing), do NOT wrap assertions in visibility guards (repo rule). Instead stabilise with explicit waits (`await expect(labelArea).toBeFocused()` before typing). If it stays flaky after a genuine attempt, keep Task 1 + Task 2 coverage, revert the e2e edits to a compiling state, and record the multi-line e2e as a follow-up in the plan's Notes — do not land a flaky spec.

- [ ] **Step 5: Manual smoke (optional but recommended)**

In the app editor: add a diagram, add a node, double-click it, type `Server1`, press Enter, type `10.10.10.10`, click elsewhere. Confirm two centred lines appear, the node grew in height, Save → reopen shows both lines, and exporting the page to PDF shows both lines in the diagram image.

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/editor/DiagramCanvas.jsx tests/e2e/diagram.spec.js
git commit -m "feat: edit and display multi-line labels on diagram nodes"
```

---

## Notes

- (record any e2e follow-up here if Task 3 Step 4 deferred the spec)

## Self-Review

**Spec coverage:**
- Free-form multi-line data model → Tasks 1 & 3 (label keeps `\n`, no new field). ✓
- Editing: Enter=newline, Escape=revert, blur=commit → Task 3 Step 1. ✓
- Display with preserved line breaks → Task 3 Step 1 (`whitespace-pre-line`). ✓
- Server SVG multi-line layout, both icon + iconless, per-line truncation, vertical centering → Task 1. ✓
- Search unchanged, verified per-line → Task 2. ✓
- Scope: `LabeledNode` only, `GroupNode`/edges untouched → Task 3 Files note. ✓
- Not-touched (schema parity, process_svg.js, paste) → no tasks, correct (nothing to change). ✓
- Edge cases (long line truncates, blank interior lines, whitespace-only → 'Node') → Task 1 `truncate` per line + `commit()` `trim() || 'Node'`. ✓

**Placeholder scan:** Task 2 Steps 2 deliberately instruct copying the neighbouring test's exact `assertInertia` shape (that test's internals aren't reproduced here to avoid drift) — the engineer is told precisely which existing test to copy and what to change. No "TODO/handle edge cases" placeholders remain.

**Type/name consistency:** `commit`, `value`, `setValue`, `editing`, `setEditing`, `data.label`, `onLabelChange` used consistently with the current component. SVG helpers (`truncate`, `textWidth`, `esc`, `n`, `icon`, `LABEL_COLOR`) match `DiagramSvg.php`. e2e locator `firstNode.locator('textarea')` matches the markup produced in Task 3 Step 1.
