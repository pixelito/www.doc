# Network diagram — manual smoke test

The diagram **capture path** (React Flow canvas → `toPng` → upload → `imageSrc`)
runs only in a real browser: it rasterises a live canvas, so it can't be covered
by Pest (the only test runner here) or by jsdom. Everything *downstream* of
`imageSrc` is automated (`tests/Unit/RenderDocumentTest.php`,
`tests/Feature/NetworkDiagramTest.php`); this checklist covers the part that
isn't.

Run it after touching `NetworkDiagramCanvas.jsx`, `NetworkDiagramNodeView.jsx`,
the `NetworkDiagram` extension, or the asset upload path.

## Setup

```bash
docker compose up                 # app on http://localhost (dev stack)
# log in; open or create a page and enter edit mode
```

## Capture path (the browser-only part)

1. **Insert** — `/network` slash command, or the topology button in the toolbar.
   A 440px React Flow canvas appears with Node / Delete controls.
2. **Add + label** — click **Node** twice; double-click each to rename
   (e.g. `core-router`, `edge-switch`). Drag one node; connect the two by
   dragging from the bottom handle to the other's top handle.
3. **Capture fires** — ~0.8s after the edits settle, a PNG is generated and
   uploaded. Confirm in DevTools → Network: a `POST /assets` returning
   `{ id, url }`. Only **structural** changes (add / move / connect / delete /
   relabel) trigger it — **panning or zooming must NOT** upload.
4. **Persisted** — save the page (or let autosave run). Reload: the diagram
   reopens with the same nodes/edges/labels (graph JSON is the source of truth).

## Downstream (eyeball the derived PNG)

5. **Read view** — leave edit mode. The diagram shows as a static `<img>`, not a
   live canvas. (A brand-new diagram with no capture yet shows the dashed
   placeholder instead — expected.)
6. **Search** — search for a node label (`core-router`). The page is found, even
   though the label only ever existed inside the canvas. (Hidden-label FTS text.)
7. **Export** — export the page to **PDF** and to **DOCX**; the diagram image
   appears in both.

## Edge cases

8. **Empty clears** — delete every node. After the debounce, the `imageSrc`
   clears: the read view falls back to the placeholder.
9. **Failure keeps last good** — the capture is best-effort. If an upload fails
   (e.g. throttle the network and edit), the console logs
   `Network diagram capture failed` and the **previous** image is retained, not
   blanked.
10. **No orphan buildup** — re-saving regenerates the PNG; old ones become
    orphaned assets and are reclaimed by the daily `assets:prune` (which also
    checks `document_versions`, so images referenced by history survive). Verify
    with `docker compose exec app php artisan assets:prune --dry-run`.
