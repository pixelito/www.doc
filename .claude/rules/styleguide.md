---
paths: ["resources/js/**/*.jsx", "resources/css/*.css"]
---

# Sage Docs — Style Guide

A calm, warm-neutral "sage" design system for an internal Docs + Helpdesk app. Optimized for dense, text-heavy admin UIs. Everything below is derived from the reference screens; follow it literally.

---

## 1. Core principles

- **Warm paper, not white.** Backgrounds are off-white/parchment, never `#fff` or pure gray.
- **One green accent.** Sage green carries all primary actions, selection, and "good" status. Don't introduce blue/teal/purple as accents.
- **Quiet by default.** Muted text, hairline borders, tiny soft shadows. Color appears only on accents and status.
- **Flat, low elevation.** Cards sit on a 1px border + a barely-there shadow. Reserve real shadows for overlays (modals, palettes).
- **Dense but breathable.** Small type, generous line-height, consistent 1px dividers between rows.
- No gradients, no emoji, no rounded-corner "alert with left accent bar" tropes.

---

## 2. Color tokens

Use these hex values exactly. Names are for reference only.

### Surfaces
| Token | Hex | Use |
|---|---|---|
| `bg/app` | `#E4E2D8` | Outermost page background (behind cards) |
| `surface/card` | `#F5F4ED` | Primary card / panel background |
| `surface/raised` | `#FBFAF5` | Header bars, inner cards, table bodies, inputs-on-card |
| `surface/sunken` | `#EFEEE6` | Input fills, table header rows |
| `surface/sunken-2` | `#ECEAE0` | Disabled input fill |

### Borders & dividers
| Token | Hex | Use |
|---|---|---|
| `border/default` | `#DAD7CB` | Outer card border |
| `border/soft` | `#E2DFD4` | Inner borders, input borders, header dividers |
| `border/row` | `#ECE9DF` | Hairline dividers between list/table rows |
| `border/hover` | `#C9C5B6` | Chip/border hover |

### Text
| Token | Hex | Use |
|---|---|---|
| `text/primary` | `#1F2520` | Headings, body, strong labels |
| `text/secondary` | `#5C625C` | Supporting copy, table values |
| `text/muted` | `#8E938E` | Meta, captions, placeholders, uppercase labels |
| `text/faint` | `#B6BAB3` | Breadcrumb slashes, disabled glyphs |

### Accent — sage green
| Token | Hex | Use |
|---|---|---|
| `accent/solid` | `#7E9D72` | Primary button bg, toggle-on, focus ring base |
| `accent/solid-hover` | `#6E8C62` | Primary button hover |
| `accent/text` | `#4B6840` | Links, active labels, accent icons, chip text |
| `accent/icon` | `#648354` | Decorative accent icons (info, empty-state) |
| `accent/tint` | `#DAE6D4` | Chip/badge bg, selected nav item, avatar bg |
| `accent/tint-soft` | `#EDF2EA` | Info banner bg, agent reply bubble |
| `accent/tint-border` | `#BFD2B5` | Info banner / dashed accent borders |
| `accent/ink` | `#364E2E` | Text on accent-tint surfaces (banners, highlight marks) |
| `focus/ring` | `rgba(126,157,114,0.18)` | `box-shadow` focus ring on active inputs |

### Status (use sparingly, only for state)
| Meaning | Text | Bg tint | Border | Use |
|---|---|---|---|---|
| Good / Active / Solved | `#4B6840` | `#DAE6D4` | `#BFD2B5` | success chips, "open", info banners |
| Warning / Pending / High | `#8A6D2F` | `#F4EDDD` | `#E8C58E` | pending invites, high priority, amber banners |
| Danger / Urgent / Overdue | `#B5573E` | `#F3E7E2` | `#DDB3A6` | urgent, overdue, danger zone, error banners |
| Neutral / Normal-Low | `#5C625C` | `#EFEEE6` | `#DAD7CB` | normal/low priority chips |
| Info accent (people) | `#4F6580` | `#DCE3EC` | `#B8CCDD` | a *secondary* avatar tint only — not an accent |

Diff view: additions `#3C5A2E` on `#E6EFDF`; deletions `#8A4A38` on `#F6E4DE`.

---

## 3. Typography

- **Family:** **Lexend** for everything — `'Lexend', ui-sans-serif, system-ui, -apple-system, sans-serif`. Load it once: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap" />`. Use `ui-monospace, monospace` for code, IDs (`#2041`), and keycaps.
- Weights in use: 400 / 500 / 600 / 700. Set the family on the root and let inputs inherit (`font-family: inherit`).
- **Never** Inter/Roboto/Arial — use Lexend.
- Letter-spacing: `-0.01em` on headings ≥16px (`-0.02em` on big numbers); `0.05–0.08em` + uppercase on small labels.

| Role | Size | Weight | Color |
|---|---|---|---|
| Page H1 / editor title | 24px | 600 | `text/primary` |
| Section / card H2 | 20px | 600 | `text/primary` |
| Subsection H3 | 14px | 600 | `text/primary` |
| Body | 13–14px | 400 | `text/primary`, 1.65–1.7 line-height |
| Table cell / item title | 13–14px | 500 | `text/primary` |
| Meta / caption | 11–12px | 400 | `text/muted` |
| Uppercase eyebrow | 11px | 600 | `text/muted`, `letter-spacing:.06em`, uppercase |
| Big metric | 26px | 600 | status or `text/primary` |

Minimum readable size in this system is **10px** (only tiny badges); prefer ≥11px.

---

## 4. Spacing, radius, shadow

- **Radius:** cards `14px` · inner cards/panels/inputs/buttons `8px` (inputs & buttons) / `12px` (inner cards) · table containers `12px` · pills/chips/avatars `999px` / `50%` · small keycaps & marks `4px`.
- **Card padding:** `22–24px`. **Header bars:** `12–13px` vertical, `18–20px` horizontal. **Inner card padding:** `16–20px`. **Table rows:** `11–13px` vertical, `16px` horizontal.
- **Gaps:** use fl/grid `gap`, never margins-between-siblings. Common: `6px` (chips), `8–12px` (button rows, cards), `48px` between top-level frames.
- **Shadows:** cards `0 1px 3px rgba(31,37,32,.06)`. Overlays/modals `0 16px 44px rgba(31,37,32,.24)`. Toggle knob `0 1px 2px rgba(31,37,32,.2)`. Nothing in between.
- **Modal scrim:** `rgba(31,37,32,.34–.42)`; blur the page behind `filter:blur(.5px); opacity:.5`.

---

## 5. Component recipes

**App header bar** — `surface/raised` bg, `border/soft` bottom border, 13px/20px padding, `space-between`. Left: 20px accent icon + 15px/600 wordmark. Center: search input (max 320px). Right: primary button + 30px circular avatar (`accent/tint` bg, `accent/text` initials).

**Primary button** — `accent/solid` bg, `#FBFAF5` text, 500 weight, 7px/13px padding, radius 8, `gap:5px` with a 14px leading icon. Hover → `accent/solid-hover`.

**Secondary button** — transparent bg, `border/soft` border, `text/primary`. Hover → `#F1F0E8`.

**Input (resting)** — `surface/sunken` bg, `border/soft` border, radius 8, 8–9px/11–12px padding, 13px text. **Active/focused** — `surface/raised` bg, `accent/solid` border, `box-shadow:0 0 0 3px focus/ring`. Disabled → `surface/sunken-2` bg, `text/muted`.

**Chip / filter** — pill. Selected: `accent/tint` bg + `accent/text`, no border. Unselected: `surface/raised` bg + `border/soft` border + `text/secondary`, hover `border/hover`. Size 11px text, 4px/10–11px padding.

**Status badge** — pill, 10–11px/500, 2px/8–9px padding, from the Status table (§2).

**Card with header** — `surface/raised` outer, `border/soft`, radius 12; header row 12px/16px with 13px/600 title and `border/soft` bottom border; rows divided by `border/row`. Row hover → `#F7F6EF`.

**Table** — header row on `#EFEEE7` with 11px uppercase `text/muted` labels; CSS grid columns; body rows on `surface/raised`, `border/row` dividers, hover `#F7F6EF`.

**Toggle** — 34×20 track, radius 999. On: `accent/solid` + knob right. Off: `#DDD9CC` + knob left. Knob 16px circle `#FBFAF5` with knob shadow.

**Tabs (horizontal)** — row over a `border/soft` bottom border; active tab `accent/text` + 600 + 2px `accent/solid` bottom border (pulled down with `margin-bottom:-1px`); inactive `text/secondary`, hover `text/primary`.

**Sidebar nav item** — 7px/10px, radius 8, 15px leading icon + 12.5px label. Active: `accent/tint` bg + `accent/text` + 500. Inactive: `text/secondary`, hover `#F1F0E8`. Danger item uses danger text + hover `#F3E7E2`.

**Info banner** — `accent/tint-soft` bg, `accent/tint-border` border, radius 10, 12px/14px, `accent/ink` text, leading 16px `accent/icon` info icon.

**Empty state** — dashed `accent/tint-border` border, centered; 48px rounded-square `accent/tint-soft` tile holding a 22px `accent/icon` glyph; 15px/600 title; 13px `text/secondary` copy.

**Modal** — `surface/raised` sheet, radius 14, overlay shadow; header (15px/600 title + close `×`) and footer (`surface/card` bg, right-aligned Cancel + primary) both fenced by `border/row`.

**Avatar** — circle, `accent/tint` bg + `accent/text` initials by default; secondary people may use other muted tints (`#E3E8D4`/`#DCE3EC`) but never the green accent's job.

**Wiki-link** — `accent/text`, `text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2–3px`. Render cross-page refs as `[[Page name]]`.

---

## 6. Icons

- **Tabler Icons** (`ti ti-*`), webfont. Sizes: 14px inline/in-button, 15–16px in nav/toolbars, 20px wordmark, 19–22px feature/empty-state.
- Default icon color `text/muted`; accent icons `accent/text` or `accent/icon`. Always `aria-hidden="true"` on decorative icons.
- Don't hand-draw SVG icons.

---

## 7. Layout & code conventions

- **Inline styles only** in this system's components; lay out rows/grids with `display:flex`/`grid` + `gap` (not bare inline siblings or per-element margins).
- Truncate long single-line text with `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` inside `min-width:0` flex/grid children.
- Tables = CSS grid with fixed + `minmax(0,1fr)` columns so cells truncate cleanly.
- Status dots: tiny `●` glyph (8px) colored by status, not a bordered circle.
- Keep hit targets ≥ the row height; interactive rows get `cursor:pointer` + hover bg `#F7F6EF`.

---

## 8. Quick copy-paste palette

```
--bg-app:#E4E2D8; --card:#F5F4ED; --raised:#FBFAF5; --sunken:#EFEEE6;
--border:#DAD7CB; --border-soft:#E2DFD4; --border-row:#ECE9DF;
--text:#1F2520; --text-2:#5C625C; --muted:#8E938E; --faint:#B6BAB3;
--accent:#7E9D72; --accent-hover:#6E8C62; --accent-text:#4B6840; --accent-icon:#648354;
--tint:#DAE6D4; --tint-soft:#EDF2EA; --tint-border:#BFD2B5; --accent-ink:#364E2E;
--warn-t:#8A6D2F; --warn-bg:#F4EDDD; --danger-t:#B5573E; --danger-bg:#F3E7E2;
--focus:rgba(126,157,114,0.18);
```
