# Design: Free-form multi-line labels for diagram nodes

Date: 2026-07-06
Status: Approved (pending implementation)

## Problem

A network-diagram node can only hold a single line of text (`data.label`). Users
want to put more than one line inside one node — e.g. a server name on the first
line and its IP address underneath:

```
🖥 Server1
   10.10.10.10
```

Today the label is edited with a single-line `<input>` and drawn as one line in
both the interactive canvas and the derived server-side SVG, so there is no way
to express this.

## Goal

Let a device node's label be **free-form multi-line text**. Pressing Enter while
editing inserts a newline; the node renders each line stacked; the multi-line
text survives save/reload, PDF/DOCX export, search indexing, and version
snapshots.

## Decisions (settled during brainstorming)

- **Free-form, not structured.** The label is just multi-line text. There is no
  separate "name" vs "detail" field and no baked-in name/IP hierarchy. Every
  line uses the same font weight and size. A user who wants `Server1` bold over a
  grey IP is out of scope — all lines are styled identically.
- **Enter inserts a newline.** Escape reverts, blur / click-away commits. This
  replaces the current "Enter = commit" gesture on node labels, because with
  free-form multi-line text a newline is the common case.
- **Scope: device nodes only** (`LabeledNode`). Group/zone labels and edge
  labels remain single-line — they are area/relationship captions, not a place
  to list host details.

## Architecture context

A diagram is a React Flow graph stored as opaque JSON in the `networkDiagram`
TipTap node's `graph` attr. Node text lives at `node.data.label`. That single
string is consumed by **two independent renderers that must stay in sync**:

1. **Interactive canvas** — `resources/js/components/editor/DiagramCanvas.jsx`
   (`LabeledNode`): editable React Flow node. Edits write back to the `graph`
   attr.
2. **Server-side SVG** — `app/Support/DiagramSvg.php`: the derived render used by
   every no-JS consumer (PDF/DOCX export, search indexing, version snapshots,
   read view fallback). Node box width/height come **pre-measured from the
   canvas** (`$n['width']` / `$n['height']`, DiagramSvg lines 100–101), so when
   the canvas node auto-grows to fit more lines, the persisted height grows and
   the SVG box follows automatically. The SVG only needs to *lay out* N lines
   within the (already taller) box.

Search text is contributed by `App\Services\RenderDocument::hiddenLabels()`,
which collects each node's `data.label` into visually-hidden text that flows into
`content_html` → the FTS vector.

## Changes

### 1. Editing — `DiagramCanvas.jsx` `LabeledNode` (currently lines 299–311)

Replace the single-line `<input>` with a `<textarea>`:

- Auto-sized to its content (grows with line count), `resize-none`, centered
  text, same styling tokens as the current input.
- **Enter → newline**: remove the current `if (e.key === 'Enter') {
  e.preventDefault(); commit(); }` so the textarea inserts the newline normally.
- **Escape → revert**: `setEditing(false); setValue(data.label ?? '')`
  (unchanged).
- **Blur → commit**: `onLabelChange(id, value.trim() || 'Node')`. `.trim()` only
  strips leading/trailing whitespace, so internal newlines survive; a
  whitespace-only label falls back to `'Node'`.

### 2. Display — `DiagramCanvas.jsx` `LabeledNode` (currently line 313)

Replace `<span>{data.label || 'Node'}</span>` with a `whitespace-pre-line` span
so `\n`s wrap into stacked lines. The flex row's `items-center` keeps the icon
vertically centered against the multi-line text block. The node wrapper already
auto-sizes (`h-full w-full`, `min-width: 90`), so its height grows with line
count and React Flow measures and persists the taller `node.height`.

### 3. Server SVG — `DiagramSvg.php` labeled-node block (currently lines 447–459)

- Split `label` on `\n` into lines.
- Truncate **each line independently** to the box width via the existing
  `truncate()` helper.
- Render the lines inside one `<text>` element as `<tspan x=… dy=…>` per line,
  vertically centering the block within `$b['h']`: first line's baseline offset
  up by `(n − 1) / 2 · lineHeight` from the single-line center, subsequent tspans
  advanced by `lineHeight` (≈14 for the 12px font).
- Preserve both existing layouts: icon-left keeps `text-anchor:start` at
  `ix + 22`; iconless keeps `text-anchor:middle` at `cx`. The per-line `x` is
  re-asserted on each `<tspan>` so `dy` advances vertically without drifting
  horizontally.

### 4. Search — no code change

`hiddenLabels()` already `trim()`s each label while keeping internal `\n`, and
the Postgres FTS tokenizer treats newline as whitespace, so
`Server1\n10.10.10.10` already indexes as the two tokens `Server1` and
`10.10.10.10`. This is asserted by a test rather than changed.

## Explicitly not touched

- **TipTap schema parity** — the `networkDiagram` node type is unchanged;
  multi-line text lives entirely inside the opaque `graph` JSON, so no
  `SchemaParityTest` / editor-PHP parity work is required.
- **`process_svg.js`** — still bakes Lexend; `<tspan>`s inherit the font from the
  parent `<text>`, so PDF vector-path baking needs no change.
- **Paste / HTML → JSON parser** — diagrams are not produced by paste.
- **Group/zone labels, edge labels** — remain single-line.

## Edge cases

- A single very long line still truncates with `…` (per-line, as today).
- Interior blank lines are preserved as typed.
- A label that is only whitespace falls back to `'Node'`.
- Old single-line diagrams render identically (a label with zero `\n` is a
  one-line block — same output as today).

## Testing

- **`tests/Unit/DiagramSvgTest.php`** — render a labeled node with
  `label: "Server1\n10.10.10.10"`; assert two `<tspan>`s are emitted and both
  strings are present (not concatenated into a single run). Add a variant for an
  iconless (`generic`) node to cover the centered layout.
- **`tests/Feature/NetworkDiagramTest.php`** — assert both `Server1` and
  `10.10.10.10` surface in the rendered HTML's hidden labels / search text.
- **`tests/e2e/diagram.spec.js`** — type a two-line label, reload, assert both
  lines persist. Driving a React Flow textarea in Playwright is fiddly; if it
  proves flaky, keep the unit + feature coverage and record the e2e as a
  follow-up rather than land a flaky spec (per the repo's no-silent-guard rule).

## Out of scope / future

- Per-line styling (bold name over a lighter/smaller IP).
- Structured fields (a dedicated name + details model).
- Multi-line group/zone or edge labels.
