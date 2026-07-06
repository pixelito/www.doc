# Design: Structured properties for diagram nodes (name + key/value)

Date: 2026-07-06
Status: Approved (pending implementation)
Supersedes: the free-form multi-line label behavior from
`2026-07-06-diagram-multiline-labels-design.md` (unreleased, only on `develop`).

## Problem

The free-form multi-line label (a single `data.label` string with `\n`s) was
disliked on three counts:

1. **Interaction** — editing is a raw `<textarea>` where Enter inserts a newline
   and you commit by clicking away; the commit gesture feels loose.
2. **Look** — every line renders identically (bold), so a hostname and its IP
   have no visual hierarchy.
3. **Model** — free-typed lines are too unstructured for what a network node
   actually is: a device plus a few attributes (IP, role, OS).

## Goal

Model a diagram device node as a **name plus an ordered list of key/value
properties**, rendered as a small device card, edited through a structured panel.
`Server1` with `IP: 10.10.10.10`, `Role: DB` becomes first-class.

## Decisions (settled during brainstorming)

- **Structured, not free-form.** A node has a single-line **name** and a list of
  **properties**. This is the model; it drives both the look (hierarchy) and the
  editing (a form, not a textarea).
- **Editing is a panel**, not inline-on-node: the floating toolbar the node
  already shows when selected gains a Name field and property rows.
- **Keys are free text and optional.** An empty key renders as a value-only
  detail line. Values are single-line.
- **Scope: device nodes (`LabeledNode`) only.** Group/zone labels and edge labels
  stay single-line, unchanged.

## Architecture context

A diagram is a React Flow graph stored as opaque JSON in the `networkDiagram`
TipTap node's `graph` attr. Node text lives at `node.data`. Two renderers consume
it and must stay in sync:

1. **Interactive canvas** — `resources/js/components/editor/DiagramCanvas.jsx`
   (`LabeledNode`): editable React Flow node; the floating editor is a
   `NodeToolbar` already used for the icon and color pickers.
2. **Server-side SVG** — `app/Support/DiagramSvg.php`: the derived render for
   every no-JS consumer (PDF/DOCX export, search indexing, version snapshots,
   read-view fallback). Node box width/height come pre-measured from the canvas
   (`$n['width']`/`$n['height']`), so the SVG lays out within measured dims.

Search text is contributed by
`App\Services\RenderDocument::hiddenLabels()`, which currently collects each
node's `data.label` into hidden text that flows into `content_html` → the FTS
vector.

## Data model

Per node, in `node.data`:

- `label` (string): the node **name**, single line. Field reused, so name-only
  nodes and pre-structured data keep working.
- `props` (array of `{ key: string, value: string }`): ordered rows. Absent or
  `[]` = a plain named node (today's chip look). `key` may be `''`
  (value-only row). `value` is single-line.

### Back-compat / legacy normalization

Diagrams already saved on `develop` may have a multi-line `label`. A single
shared normalizer maps legacy data at read time:

- Split `label` on `\n`.
- First line → the name (`label`).
- Each remaining non-empty line → a value-only prop `{ key: '', value: line }`
  (only when `props` is absent/empty, so it never clobbers real structured data).

The normalizer is implemented once and used by BOTH the canvas (on load) and
`DiagramSvg` (at render), so old diagrams and old version snapshots render
identically without a data migration pass. New saves persist the structured
shape.

## The look (both renderers)

- **Name**: bold, top row, icon to its left (unchanged placement).
- **Property rows**: below the name, smaller (~10–11px vs the 12px name).
  - **Key** in a muted color (the diagram's secondary text color, `#5C625C`),
    **value** in the normal label color (`#1F2520`).
  - Two aligned columns: the value column starts at the widest key's width, so
    values line up. Empty-key rows are value-only and span the row (left-aligned).
  - Each key and value truncates independently to the available width.
- **Alignment mode**:
  - Node **with** properties → the whole block is **left-aligned** (a device
    card).
  - Node **with no** properties → keeps today's **centered** single-line chip
    look (name only), so simple nodes stay visually quiet.
- **Auto-size**: width fits the widest of (name, widest key+gap+value); height
  fits name + one line per prop. React Flow measures and persists the node's
  width/height; `DiagramSvg` reads those measured dims (as today), so both
  renderers agree.

## Editing (panel)

When a `LabeledNode` is selected in the editable canvas, its floating
`NodeToolbar` (already showing icon + color pickers) also shows a compact
properties editor:

- A **Name** text input (bound to `data.label`).
- One row per property: a **key** input, a **value** input, and a **✕** remove
  button.
- A **＋ Add property** button appends an empty `{ key:'', value:'' }` row.
- Edits apply **live** to `node.data` (so the node updates as you type); they
  **persist** when the node is deselected / the canvas blurs (the existing
  `onPersist` path). Double-clicking a node focuses the Name field.
- No atomic revert (structured fields make a wrong entry easy to clear); this
  intentionally replaces the old Esc-reverts-the-textarea behavior.

Removed by this change: the single-line `<input>`/`<textarea>` label editor and
the free-form `whitespace-pre-line` display span in `LabeledNode`.

## Search

`hiddenLabels()` will collect, per node: the name (`label`), and every property's
`key` and `value`. So a node is findable by its name, by a value (e.g. the IP
`10.10.10.10`), or by a key (e.g. `Role`). This relies on the search-tokenizer
fix already on `develop` (dotted tokens like IPs match). No change to how the FTS
vector is built.

## Scope / not touched

- `GroupNode` (zone labels) and edge labels — remain single-line.
- The `networkDiagram` TipTap node and schema parity — unchanged; structure lives
  inside the opaque `graph` JSON.
- `process_svg.js` — still bakes text to Lexend paths; it walks `<text>`/`<tspan>`
  generically, so name + property rows need no Node-side change.
- The paste/HTML parser — diagrams aren't produced by paste.

## Edge cases

- A property with an empty key AND empty value is dropped on persist (no blank
  rows saved).
- A node with `label` empty and no props falls back to `'Node'` (as today).
- Very long keys/values truncate with `…` per cell.
- Legacy multi-line `label` with no `props` → normalized to name + value-only
  rows (see back-compat).

## Testing

- **`tests/Unit/DiagramSvgTest.php`**: a node with `label:'Server1'` and
  `props:[{key:'IP',value:'10.10.10.10'},{key:'Role',value:'DB'}]` renders the
  name plus both rows; assert key text and value text are present and that the
  key uses the muted color / value the normal color. A value-only prop
  (`key:''`) renders full width. A name-only node still renders centered (one
  line, no rows).
- **`tests/Unit/`** (normalizer): legacy `label:"Server1\n10.10.10.10"` with no
  `props` normalizes to name `Server1` + one value-only prop `10.10.10.10`.
- **`tests/Feature/NetworkDiagramTest.php`**: a node with name + `IP` property is
  found by search on the name, on the IP value, and on the key `IP`.
- **`tests/e2e/diagram.spec.js`**: select a node, add a property via the panel
  (key + value), deselect, and assert the property shows on the node and after
  Save in the read view; reload persists it.

## Out of scope / future

- A fixed key vocabulary / dropdown (keys stay free text).
- Multi-line property values.
- Per-property icons, links, or types.
- Structured props on group/zone or edge labels.
