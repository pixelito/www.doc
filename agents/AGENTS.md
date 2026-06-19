# www.doc — Coding Reference

Self-hosted wiki/documentation platform for sysadmin and networking teams. Single-host, small editor count. This file is the authoritative spec for coding — decisions below are **locked**. Don't re-litigate them.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | Laravel 13 (PHP 8.3) | |
| Bridge | Inertia.js v2 | No separate REST API |
| Frontend | React 18 — **plain JavaScript, no TypeScript** | Vite + HMR |
| Database | PostgreSQL 16 | `jsonb` content column; native FTS via `tsvector` |
| Async | Laravel Queues + Horizon on Redis | Export/import jobs |
| Storage | Flysystem — local dev, S3/MinIO prod | Always via Storage facade |
| Editor | TipTap (ProseMirror) | JSON as canonical format |
| PDF export | Dompdf | `page_script()` canvas API for page numbers |
| DOCX export/import | PhpWord | |
| PDF import | smalot/pdfparser + Tesseract | Text best-effort only |
| Auth | Laravel sessions | Inertia handles CSRF |
| Permissions | spatie/laravel-permission | viewer / editor / admin |
| Search | PostgreSQL FTS | `tsvector` GIN index |
| UI components | shadcn/ui base + custom | Modify freely; install if missing |
| Icons | Tabler Icons React | `@tabler/icons-react` |

---

## Architecture rules (locked)

1. **Canonical format = TipTap JSON.** Content lives in a `jsonb` column. HTML, DOCX, PDF, and search text are all *derived*. Never the reverse. Not HTML, not Markdown, as source of truth.
2. **One render path.** `RenderDocument::toHtml()` is the single JSON → HTML service. Used by read-only view, every exporter, and search-vector generation. Two paths must never disagree.
3. **Policies from day one.** Every action goes through a Laravel policy. Roles = editing policy bodies, not hunting for scattered conditionals.
4. **Custom TipTap nodes** are the extension seam for new content types. No storage/render scaffolding changes needed for a new node.
5. **Never run conversions inline.** All export/import jobs go through the queue.

---

## What's live

| Feature | Notes |
|---|---|
| Workspaces + document tree | Full CRUD, drag reorder, breadcrumbs |
| TipTap editor | Headings, bold/italic/underline/strike, lists, tables (resizable cols), code block, blockquote, inline code, links, HR, slash commands |
| Image handling | Upload via toolbar (file picker or URL), paste, drag-drop; blob preview → async upload → permanent URL |
| Resizable images | Drag corner handle to resize; left/center/right alignment stored as `align` attribute |
| Text alignment | Left/center/right via `@tiptap/extension-text-align` |
| Wiki-links | `[[Page Title]]` inline nodes; hover preview card; broken link amber indicator |
| Backlinks | "Referenced by" collapsible strip at page bottom |
| Tags | Polymorphic many-to-many; tag landing pages with filtered doc list |
| Full-text search | Postgres `tsvector`; ranked results with highlighted snippets |
| Version history | Snapshot on every save; list view; snapshot read-only view; restore via confirm dialog |
| PDF export | Dompdf; queued job; page numbers via canvas `page_script()` |
| DOCX export | PhpWord; queued |
| DOCX/PDF import | PhpWord (DOCX) + smalot/pdfparser (PDF); asset pipeline reuse |
| Roles | spatie viewer/editor/admin wired to policies |
| Platform dashboard | App hub with Docs tile (stats + quick links) + coming-soon placeholders; Recently Updated strip |
| ConfirmDialog | Custom design-system modal for destructive/confirmation actions |

## What's planned (Phase 7+)

- **Deployment hardening** — multi-stage Dockerfile, Caddy edge proxy, Komodo stack, security pass, backups, Sentry

---

## Data model (key entities)

- **Workspace** — `name`, `slug`, `description`, `position`. Flat — no nesting.
- **Document** — `title`, `slug`, `workspace_id`, `parent_id` (shallow nesting), `position`, `content` (jsonb TipTap doc), `content_html` (cached render), `search_vector` (tsvector GIN), `metadata` (jsonb), `created_by_id`, `updated_by_id`
- **DocumentVersion** — snapshot on every save; never destructive rollback
- **Asset** — `path`, `disk`, `mime`, `size`, `checksum` (SHA-256 dedupe), `uploaded_by_id`
- **Tag** — polymorphic many-to-many (`taggable_type` / `taggable_id`)
- **Link** — `source_document_id`, `target_document_id`, populated by save observer; powers backlinks
- **ConversionJob** — `document_id`, `direction`, `format`, `status`, `result_path`, `error`

The `metadata` jsonb column on Document absorbs arbitrary structured data without migrations.

---

## Layouts

There are **two layout components** — do not conflate them.

| Layout | File | Used by | Has |
|---|---|---|---|
| `AppLayout` | `Layouts/AppLayout.jsx` | Dashboard only | Brand + user avatar + logout |
| `DocsLayout` | `Layouts/DocsLayout.jsx` | All docs pages | Brand + Workspaces/Tags nav + search bar + user avatar + logout |

The dashboard is a **platform hub** — it lists tools (Docs is live, others are coming-soon placeholders). The docs section is self-contained within `DocsLayout`.

---

## Editor architecture

**Save behaviour** — explicit save only (no autosave). Save button exits edit mode and triggers `preserveState: false` for a full prop refresh. The editor tracks content in `editorContentRef` (a ref, not state) to avoid re-renders on every keystroke. Dirty state is tracked via `isDirtyRef`; Cancel shows a `ConfirmDialog` if dirty.

**Custom extensions** (all in `resources/js/extensions/`):

| Extension | Purpose |
|---|---|
| `WikiLink` | `[[Page Title]]` inline node; hover preview via custom DOM events; resolved = sage link, unresolved = amber dashed |
| `ResizableImage` | Extends TipTap Image; adds `width` + `align` attrs; NodeView with drag-resize handle |
| `ImageUpload` | ProseMirror plugin; handles paste (files, data URIs, external URLs) and drag-drop; exports `uploadFile` and `insertFiles` for Toolbar reuse |
| `SlashCommands` | `/` command menu |

**PHP renderer** (`app/Services/RenderDocument.php`) — custom node classes sit in the same file: `ResizableImageNode` (image with width/align inline styles for export), `WikiLinkNode` (styled span, no href — link resolution is browser-side).

---

# UI & Design System

Aesthetic: warm-cream foundation + soft sage accent. Separation comes from **borders, not shadows**. Generous whitespace.

## Palette (single source of truth)

```css
:root {
  /* Surfaces */
  --canvas:        #F5F4ED;  /* page background */
  --surface:       #FBFAF5;  /* cards, panels */
  --surface-hover: #EFEEE7;  /* hover for clickable rows/cards */
  --border:        #E2DFD4;  /* default borders */
  --border-subtle: #ECE9DF;  /* dividers inside cards */

  /* Text */
  --text-primary:   #1F2520;
  --text-secondary: #5C625C;
  --text-tertiary:  #8E938E;
  --text-inverse:   #F5F4ED;  /* on sage-400/500 backgrounds */

  /* Sage ramp */
  --sage-50:  #EDF2EA;  /* info banners, selected rows */
  --sage-100: #DAE6D4;  /* badge fills, soft callouts */
  --sage-200: #BFD2B5;  /* borders on sage-tinted areas */
  --sage-300: #9FB994;
  --sage-400: #7E9D72;  /* PRIMARY — buttons, focus rings */
  --sage-500: #648354;  /* active/pressed */
  --sage-600: #4B6840;  /* sage text on light bg — AA-safe */
  --sage-700: #364E2E;  /* deep accent, headings on sage-50 */

  /* Semantic */
  --info:    #6E8AA7;
  --success: #7E9D72;  /* = sage-400 */
  --warning: #C99650;  /* amber — used for unresolved wiki-links */
  --danger:  #B5573E;  /* terracotta — destructive actions */
}
```

**Rules:**
- Text accents → `sage-600` not `sage-400` (sage-400 fails AA on cream)
- Fills: sage-400 = button, sage-100 = badge, sage-50 = banner
- Borders: `--border` default; `--border-subtle` inside cards; always 1px solid
- Danger is warm terracotta. Never substitute a cold red.
- Shadows only when an element lifts (modals, dropdowns). Always warm-tinted alpha.

## Typography

```
Font: Lexend (self-hosted woff2) → system-ui fallback
Mono: ui-monospace → JetBrains Mono → Menlo → Consolas
```

| Role | Size | Weight | Use |
|---|---|---|---|
| h1 | 24px | 600 | Page titles |
| h2 | 19px | 600 | Section headers |
| h3 | 16px | 600 | Card titles, sub-sections |
| body | 14px | 400 | Default |
| body-lg | 15px | 400 | Document reading view (TipTap) |
| small | 12–13px | 400 | Meta, captions |
| label | 11px | 500–600 | Uppercase labels, tag pills (`letter-spacing: 0.05em`) |
| mono | 12–13px | 400 | Code |

## Spacing

4px base scale. Anything not on this grid is wrong.

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px`

Layout widths: app chrome `max-w-7xl`; document prose `~68ch`; forms `max-w-md`.

## Radii

| Token | px | Use |
|---|---|---|
| radius-sm | 8 | Inputs, buttons, toolbar items |
| radius-md | 12 | Cards, panels, popovers |
| radius-lg | 16 | Modal panels |
| 14px | — | Dialog/modal cards specifically (matches HTML examples) |
| radius-full | 9999 | Avatars only |

## Shadows

```css
--shadow-sm: 0 1px 2px rgba(31, 37, 32, 0.04);
--shadow-md: 0 4px 12px rgba(31, 37, 32, 0.06);
--shadow-lg: 0 16px 32px rgba(31, 37, 32, 0.10);
```

## Icons

Tabler Icons React. `stroke` prop (not `strokeWidth`):
- **1.5** — UI icons (nav, cards, metadata)
- **2** — toolbar buttons

Sizes: 14px inline with small text · 16px default · 20px toolbar/prominent · 24px empty states.

---

## Component patterns

### Nav header

**AppLayout** (platform/dashboard only):
```
h-12 · bg-card · border-b border-border
Left: IconBook2 (sage-600, h-5) + brand "www.doc" → /dashboard
Right: initials avatar (30px, rounded-full, bg-sage-100, text-sage-600) + Settings icon + Logout icon
```

**DocsLayout** (all docs pages):
```
Same shell + adds:
Center-left: nav links (Workspaces, Tags) — active = `bg-sage-100 text-sage-600` (= bg-accent text-accent-foreground)
Center: search input (bg-canvas, rounded-sm, max-w-xs, IconSearch inset)
```

### Breadcrumbs

`flex items-center gap-1.5 text-sm text-text-secondary`. Separator: `IconChevronRight` (`h-3.5 w-3.5 shrink-0 text-text-tertiary`, stroke 1.5). Ancestors: `hover:text-foreground`. Current page: `text-foreground font-medium`.

### Page table (workspace doc list)

Card with `rounded-md border border-border overflow-hidden`:
- Header row: `bg-surface-hover border-b` · 11px uppercase labels · `tracking-[0.05em]`
- Rows: `grid grid-cols-[1fr_110px]` · icon + title + tag pills + timestamp
- Row dividers: `border-b border-border-subtle`
- Footer: "New page" inline form row · `border-t border-border`
- Tag filter chips above: active = `bg-sage-100 text-sage-600` · inactive = `bg-surface border border-border text-text-secondary`

### Cards

Flat: `bg-card border border-border rounded-md`. No shadow. Padding 16px or 24px — pick one per context. Internal hierarchy via `border-border-subtle` dividers, not nested cards.

### Buttons

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Primary | sage-400 | text-inverse | none | sage-500 |
| Secondary / Outline | surface | text-primary | border | surface-hover |
| Ghost | transparent | text-primary | none | surface-hover |
| Destructive | danger | text-inverse | none | opacity 0.9 |

Sizing: default 36px tall · small 28px · large 44px. Radius: **radius-sm (8px)** always.

### Inputs

Default: `bg-surface border border-border rounded-sm`
Focus: `border-sage-400 ring-[3px] ring-sage-200`
Label above, helper text below. Required asterisk in label.

### Badges / pills

| Variant | Background | Text | Use |
|---|---|---|---|
| Soft | sage-100 | sage-600 | Active filter chips, tag pills |
| Outline | surface + border | text-secondary | Inactive filter chips |
| Subtle | border-subtle | text-secondary | Neutral metadata counts |

### Alerts / callouts

All: `rounded-md border` · left icon · no shadow.
- Info: `bg-sage-50 border-sage-200 text-sage-700`
- Warning: `bg-[#FAF1E2] border-[#E8C58E] text-[#7A5520]`
- Danger: `bg-[#F7E5DE] border-[#DDA292] text-[#5E2719]`

### Modal / ConfirmDialog

Component: `resources/js/components/ui/ConfirmDialog.jsx`

```
Backdrop:  fixed inset-0 z-50 · background: rgba(31, 37, 32, 0.42)
Container: bg-surface · rounded-[14px] · max-w-md
           box-shadow: 0 16px 40px rgba(31, 37, 32, 0.18)
Header:    px-5 py-4 · border-b border-border-subtle · title (15px/500) + × button
Body:      px-5 py-4 · text-sm text-text-secondary
Footer:    px-5 py-3.5 · bg-canvas · border-t border-border-subtle
           flex justify-end gap-2
           Cancel: border border-border rounded-lg
           Confirm: rounded-lg · variant danger = bg-danger | variant primary = bg-primary
```

Closes on Escape and on backdrop click. Use for all confirmation and destructive prompts — never `window.confirm()`.

### Search results

Result card rows inside `bg-surface border border-border rounded-md overflow-hidden`:
- Each result: `padding: 14px 16px border-b border-border-subtle`
- Title row: `IconFileText` (text-tertiary) + page title (14px/500) + workspace dot separator + tag pills
- Snippet: 12.5px · text-secondary · `line-height: 1.55`
- `<mark>` highlights: `bg-sage-100 text-sage-700 px-0.5 rounded-sm`
- Meta footer: 11px · text-tertiary · "Updated X ago by Y"

### Empty states

Used when a list/table has no rows yet. Pattern:
```
<div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-50 border border-sage-200">
        <IconXxx className="h-6 w-6 text-sage-500" stroke={1.5} />
    </div>
    <div>
        <p className="text-sm font-medium text-foreground">Nothing here yet</p>
        <p className="mt-0.5 text-xs text-text-tertiary">One-line description of what to do.</p>
    </div>
    {/* optional primary CTA */}
    <button className="mt-1 rounded-sm bg-primary px-3.5 py-1.5 text-xs font-medium text-text-inverse ...">
        Create first item
    </button>
</div>
```
Icon container: `rounded-xl bg-sage-50 border border-sage-200`, icon `text-sage-500`. Always place the empty state inside the table/list card so borders and padding align.

### Toolbar buttons

Height `h-7 w-7` · `rounded` · active = `bg-sage-100 text-sage-600` · inactive = `text-text-secondary hover:bg-surface-hover hover:text-foreground`. Divider: `w-px h-5 bg-border mx-1`. Inline pickers (link URL, table size, image mode) appear in-line in the toolbar bar itself.

### Interaction states

Focus ring (`:focus-visible` only): `outline: none; box-shadow: 0 0 0 3px rgba(126, 157, 114, 0.35)`

Transitions: 150ms state changes · 200ms entrances · ease-out entries · ease-in-out in-place. Animate `background-color / border-color / opacity / transform` only — never `width/height`.

Loading: buttons → disable + inline spinner (same width). Cards/lists → skeleton pulse. Page-level → Inertia progress bar.
