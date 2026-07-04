<p align="center">
  <img src="https://raw.githubusercontent.com/pixelito/www.doc/master/art/logomd.svg" alt="www.doc" width="520">
</p>

<p align="center">
  A self-hosted, wiki-style internal knowledge base for small &amp; medium companies.
</p>

---

## Features

- **Rich editor** — TipTap/ProseMirror with high-fidelity paste from Word and
  HTML, text colour, multicolor highlight, resizable images.
- **Screenshot & image paste** — pasted and external images are intercepted and
  re-hosted as local assets (deduplicated by SHA-256).
- **Wiki-links & backlinks** — `[[Page Title]]` links are indexed on save;
  every page shows what references it.
- **Network diagrams** — visual node-and-edge diagrams created directly in the
  editor; searchable, versioned, and exported as vector graphics.
- **Versioning & compare** — every save snapshots content, title, tags and the
  attachment list; any version can be viewed and fully restored. A Git-style
  diff compares any two versions (or two different pages): word-level text
  changes, title/tag changes, and a visual overlay + changelog for diagrams.
- **Concurrent-edit protection** — optimistic locking rejects a save whose base
  is stale; a conflict dialog shows both versions and lets you reload theirs or
  overwrite with yours.
- **Full-text search** — PostgreSQL FTS across pages, workspaces and tags
  (diagram node labels included), with highlighted excerpts that distinguish
  full-word from prefix matches.
- **Import & export** — DOCX/PDF in both directions, run as background jobs.
- **Page attachments** — attach arbitrary files to a page, listed in a per-page
  panel; binaries ride along in backups.
- **Workspaces, nesting & tags** — a fixed set of top-level workspaces, shallow
  drag-and-drop page nesting, and tags that cut across workspaces.
- **Page templates** — reusable starting points for new pages (Runbook, Meeting
  notes and RFC ship with a fresh install); save any page as a template, manage
  them under Templates, and pick one in the New page dialog. Included in backups.
- **Roles & admin** — admin / editor / viewer roles, a user-management admin
  area, and a Trash with restore/purge.
- **Immutable audit log** — an append-only trail of who changed, restored or
  deleted what (content, users, settings, backups, logins), browsable with
  filters in the admin area and carried inside every backup.
- **Automated encrypted backups** — scheduled or manual snapshots to local disk
  or SMB shares, optional XChaCha20-Poly1305 encryption, email reports, and a
  pre-restore safety snapshot. See the [Backups & Encryption Guide](docs/backups.md).
- **Web setup wizard** — first-run configuration of admin account, instance
  name and SMTP right from the browser (the same SMTP config powers
  password-reset emails and can be changed later in the admin area).

## Stack

- **Laravel 13** (PHP 8.3) + **Inertia.js** — server-driven, not a REST API.
- **React 19** (JavaScript) + **shadcn/ui** + **Tailwind v4**.
- **PostgreSQL 16** (`jsonb` content, `tsvector` search) + **Redis** (sessions, cache, queue).
- **Laravel Queues** on Redis for all conversions and heavy work (the `worker` service).
- **TipTap** (ProseMirror) editor; **Pest** (backend) + **Playwright** (browser) test suites.

TipTap JSON is the single source of truth for document content — HTML, DOCX,
PDF and the search vector are all derived from it.

## Quick start (development)

Everything runs in Docker. You need Docker with Compose v2.

```bash
git clone <your-fork-url> www.doc && cd www.doc
cp .env.example .env

docker compose up --build          # first run builds the images
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed   # schema + demo data
```

The app is then at **http://localhost:8000** (Vite HMR on `5173`). The seeder
creates demo users for every role, all with the password `password` — log in as
`admin@example.com` for full access (see `database/seeders/UserSeeder.php`).

The dev stack also includes **Mailpit** (outbound email viewer at
**http://localhost:8025**) and a dummy **Samba** server for testing SMB backups
(host `samba`, share `backups`, user `smbuser`, password `smbpassword`).

### Common commands & tests

```bash
docker compose exec app php artisan test                        # Pest suite
docker compose exec app php artisan test --filter='wiki-links'  # single test
docker compose exec app php artisan migrate:fresh --seed        # reset DB
docker compose exec vite npm install <pkg>                      # add a frontend dep

E2E_PASSWORD=password APP_URL=http://localhost:8000 npx playwright test  # browser tests
```

Browser-only flows (live editor, diagram canvas, conflict dialog, backup
import) are covered by the Playwright tests in `tests/e2e/`; the env overrides
above adapt them to the dev stack. CI runs both suites on every push and pull
request against a freshly built production stack (`.github/workflows/ci.yml`).

> Database-touching artisan commands must **not** pass `--no-deps` — they need
> the `db`/`redis` links.

## Install (production)

You don't clone the repo or compile anything — the app runs on pre-built images
from GitHub Container Registry. You need a machine (server, VM, or NAS) with
**Docker** and **Compose v2**.

See the **[Installation Guide](docs/installation.md)**. It covers downloading
the deployment files, required environment variables, TLS/reverse-proxy
strategies, updating, and GUI managers (Komodo, Portainer). Container log
rotation is preconfigured in `docker-compose.prod.yml` (`max-size: 10m`,
`max-file: 3`).

### Maintenance

The `scheduler` service runs housekeeping automatically; all commands are also
safe to run by hand:

- `php artisan assets:prune` — sweeps unreferenced image uploads (`--dry-run`
  to preview, `--hours=N` to tune the grace window). Daily.
- `php artisan audit:prune` — drops audit events past the retention window
  (365 days by default; `--days=N` or the `audit.retention_days` setting). The
  one sanctioned way audit rows are ever deleted. Daily.
- `php artisan backup:run` — takes a backup if the admin-configured cadence has
  elapsed; a no-op when backups are disabled or not yet due. Checked hourly.

## Backups & encryption

Backups are configured from **Settings > Backups**: full-system `.zip`
snapshots (a canonical JSON layer plus a PDF-per-page layer) written to local
disk or an SMB share, with optional XChaCha20-Poly1305 encryption, archive
import, and email reports. Restores take a safety snapshot first and merge the
audit trail instead of overwriting it. Setup, key management, and manual
decryption are documented in the [Backups & Encryption Guide](docs/backups.md).

## Project layout

- `app/Services/RenderDocument.php` — the one and only TipTap-JSON ↔ HTML renderer and parser.
- `resources/js/components/editor/TipTapEditor.jsx` — the frontend editor schema (kept in sync with `RenderDocument`'s extension list).
- `app/Services/Importers` / `Exporters` — DOCX/PDF conversion (queued jobs).
- `app/Services/Backup` — the backup engine: snapshotting, encryption, import, restore.
- `app/Support/Audit.php` — the single entry point that writes the append-only audit trail.
- `app/Support/SearchVector.php` — the single SQL definition for the full-text search vectors.
- `app/Support/DiagramSvg.php` & `process_svg.js` — server-side SVG generation for network diagrams.
- `resources/js/Pages` — Inertia React pages (PascalCase folders).
- `tests/Feature` / `tests/Unit` — the Pest suite; `tests/e2e` — Playwright browser tests.

## License

Open-source, self-hosted. See [LICENSE](https://github.com/pixelito/www.doc/blob/master/LICENSE).
