<p align="center">
  <img src="https://raw.githubusercontent.com/pixelito/www.doc/master/art/logomd.svg" alt="www.doc" width="520">
</p>

<p align="center">
  A self-hosted, wiki-style internal knowledge base for small &amp; medium companies.
</p>

---

**www.doc** is a documentation app. Paste fidelity from Word/HTML,
screenshot-paste with image re-hosting, wiki-links and versioning, embedded network
diagrams, full-text search, DOCX/PDF import &amp; export, encrypted automated backups,
and an immutable audit trail.

## Features

- **Rich editor** — TipTap/ProseMirror with high-fidelity paste from Word and HTML,
  text colour, multicolor highlight, resizable images.
- **Network Diagrams** — Create visual node-and-edge diagrams directly in the editor. They are searchable, versioned, and export as vector graphics.
- **Screenshot & image paste** — pasted and external images are intercepted and
  re-hosted as local assets (deduplicated by SHA-256).
- **Wiki-links & backlinks** — `[[Page Title]]` links are indexed on save; every page
  shows what references it.
- **Versioning** — every content save snapshots a version you can view and restore;
  restoring is a full revert of content, title and tags.
- **Concurrent-edit protection** — optimistic locking rejects a save whose base is
  stale; a conflict dialog shows both versions and lets you reload theirs or
  overwrite with yours. No more silent last-write-wins.
- **Full-text search** — PostgreSQL FTS across pages, workspaces and tags, with
  highlighted excerpts (diagram node labels are indexed too).
- **Import & export** — DOCX/PDF import and export, run as background jobs.
- **Page attachments** — attach arbitrary files to a page, listed in a per-page
  panel; binaries ride along in backups.
- **Workspaces & nesting** — a small fixed set of top-level workspaces; pages nest
  shallowly and can be re-parented by drag-and-drop.
- **Tags** — cut across workspaces, attached polymorphically.
- **Roles & admin** — admin / editor / viewer roles, a user-management admin area, and
  a Trash with restore/purge.
- **Audit & activity log** — an immutable, append-only trail of who changed, restored
  or deleted what (content, users, settings, backups, logins), browsable in the admin
  area with filters, and included in backups. Complements the NIS2 compliance story.
- **Automated backups** — scheduled and manual full-system snapshots to local disk or
  SMB shares, optional XChaCha20-Poly1305 encryption, email reports, archive import,
  and a pre-restore safety snapshot before every restore.
- **Web Setup Wizard** — smooth first-run configuration of admin account, instance
  name, and SMTP settings right from the browser (the same SMTP config powers
  password-reset emails and can be changed later in the admin area).

## Stack

- **Laravel 13** (PHP 8.3) + **Inertia.js** — server-driven, not a REST API.
- **React 19** (JavaScript) + **shadcn/ui** + **Tailwind v4**.
- **PostgreSQL 16** (`jsonb` content, `tsvector` search) + **Redis** (sessions, cache, queue).
- **Laravel Queues** on Redis for all conversions and heavy work (the `worker` service).
- **TipTap** (ProseMirror) editor; **Pest** (backend) + **Playwright** (browser) test suites.

TipTap JSON is the single source of truth for document content — HTML, DOCX, PDF and the
search vector are all derived from it.

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

The app is then at **http://localhost:8000** (Vite HMR on `5173`). The seeder creates a
set of demo users across all roles, all with the password `password` — log in as
`admin@example.com` for full access. See `database/seeders/UserSeeder.php` for the rest.

Mailpit is included in the development stack to intercept outbound emails. You can access its local web UI at **http://localhost:8025** to view any test emails sent from the app.

A dummy Samba server is also included to allow testing SMB network share backups locally. Configure backups to use the host `samba` (the compose service name), share `backups`, username `smbuser`, and password `smbpassword`.

Common commands:

```bash
docker compose exec app php artisan test           # run the Pest suite
docker compose exec app php artisan migrate:fresh --seed
docker compose exec vite npm install <pkg>         # add a frontend dependency
```

> Database-touching artisan commands must **not** pass `--no-deps` — they need the
> `db`/`redis` links.

## Tests

```bash
docker compose exec app php artisan test                       # full suite
docker compose exec app php artisan test --filter='wiki-links' # a single test
```

Browser-only flows (the live editor, the diagram canvas, the concurrent-edit
conflict dialog, backup import) are covered by Playwright end-to-end tests in
`tests/e2e/`. CI runs them against the freshly built production stack; locally,
run them against the dev stack (the seeder's admin password differs from the
CI default, hence the override):

```bash
E2E_PASSWORD=password APP_URL=http://localhost:8000 npx playwright test
```

CI runs both suites on every push and pull request (see `.github/workflows/ci.yml`).

## Install (production)

You don't clone the repo or compile anything — the app runs on pre-built images from
GitHub Container Registry. You need a machine (server, VM, or NAS) with **Docker** and **Compose v2**.

**[📖 Read the Full Installation Guide](docs/installation.md)**

The guide covers:
- Downloading the deployment files
- Configuring the required environment variables (`APP_URL`, `DB_PASSWORD`)
- Setting up Internal Self-Signed TLS vs External Reverse Proxies
- Updating to new versions
- Deploying via GUI managers like Komodo or Portainer

### Log Rotation
The `docker-compose.prod.yml` enforces JSON file log rotation (`max-size: 10m`, `max-file: 3`) across all containers out-of-the-box, ensuring your server's disk space won't fill up with endless container logs over time.

### Maintenance

The `scheduler` service runs the housekeeping commands automatically; all of them are
also safe to run by hand:

- `php artisan assets:prune` — sweeps unreferenced image uploads (e.g. an image pasted
  then deleted before saving). `--dry-run` to preview, `--hours=N` to tune the grace
  window. Daily.
- `php artisan audit:prune` — drops audit events past the retention window (365 days by
  default; `--days=N` or the `audit.retention_days` setting to change it). This is the
  one sanctioned way audit rows are ever deleted. Daily.
- `php artisan backup:run` — takes a backup if the admin-configured cadence has
  elapsed. Checked hourly; the command itself is the gate, so it's a no-op when
  backups are disabled or not yet due.

## Backups & Encryption

The app features a built-in backup engine that snapshots your Postgres database and all local uploads into a single `.zip` file. You can configure scheduled or manual backups directly from the **Settings > Backups** UI, and route them to the local disk or an external SMB network share.

Each archive holds two layers: a **canonical** layer (the full content model as
JSON/NDJSON plus every asset and attachment binary — the authoritative restore source,
integrity-checked against per-file SHA-256s) and a **readable** layer (a PDF per page,
foldered by tree, for humans and auditors). Restores always rebuild from the canonical
layer, take a safety snapshot of the current state first, and abort if that snapshot
can't be written. The audit trail travels inside every archive and is *merged* on
restore — never wiped — so restoring an old backup can't erase newer audit history.

You can also **import** an archive from file (e.g. from another instance). Encrypted
archives prompt for the key; a wrong or missing key still registers the archive, flagged
as undecryptable. After each unattended run the app emails a success/failure report (or
shows a persistent in-app notice when mail is off or fails).

### Encrypted Backups
If you configure an encryption key, backups are encrypted at-rest using military-grade **XChaCha20-Poly1305** stream encryption (via `libsodium`) before they are written to disk.

1. **Generate a key:** Go to **Settings > Backups** to generate a secure, 32-byte base64 key directly in your browser.
2. **Add to environment:** Place this key in your `.env` file (or GUI environment config) as `BACKUP_ENCRYPTION_KEY=your_base64_string`.
3. **Restart the Stack:** Recreate the container so the variable is injected and cached. In the CLI, run `docker compose up -d`. If using a GUI (Komodo, Portainer), click **Deploy** or **Update** (a simple container restart is usually not enough).
4. **Enable:** Toggle the "Encrypt backups" setting in the UI.

The app will transparently encrypt and decrypt these archives during automated operations (like hitting "Restore" in the UI).

### Manual Decryption
If your server crashes and you need to extract your `.zip.enc` backup file manually without the app running, you cannot use standard base64 decoding tools. You must use the provided emergency CLI tool which properly streams the `libsodium` decryption:

```bash
docker compose exec app php artisan backup:decrypt /path/to/your/backup.zip.enc --key="YOUR_BASE64_KEY"
```
*(If `--key` is omitted, the command automatically uses the key configured in your `.env` file).*

## Project layout

- `app/Services/RenderDocument.php` — the one and only TipTap-JSON ↔ HTML renderer and parser.
- `resources/js/components/editor/TipTapEditor.jsx` — the frontend editor schema (must be kept in sync with `RenderDocument`'s extension list).
- `app/Services/Importers` / `Exporters` — DOCX/PDF conversion (queued jobs).
- `app/Services/Backup` — the backup engine, snapshotting, encryption, import, and restoration logic.
- `app/Support/Audit.php` — the single entry point that writes the append-only audit trail.
- `app/Support/SearchVector.php` — the single SQL definition for PostgreSQL full-text search vectors.
- `app/Support/DiagramSvg.php` & `process_svg.js` — server-side SVG generation and Node-based processing for network diagrams.
- `resources/js/Pages` — Inertia React pages (PascalCase folders).
- `tests/Feature` / `tests/Unit` — the Pest suite; `tests/e2e` — Playwright browser tests.

## License

Open-source, self-hosted. See [LICENSE](https://github.com/pixelito/www.doc/blob/master/LICENSE).
