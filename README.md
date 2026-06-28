<p align="center">
  <img src="art/logomd.svg" alt="www.doc" width="520">
</p>

<p align="center">
  A self-hosted, wiki-style internal knowledge base for small &amp; medium companies.
</p>

---

**www.doc** is a documentation app. Paste fidelity from Word/HTML,
screenshot-paste with image re-hosting, wiki-links and versioning, full-text search, and
DOCX/PDF import &amp; export.

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
- **Full-text search** — PostgreSQL FTS across pages, workspaces and tags, with
  highlighted excerpts.
- **Import & export** — DOCX/PDF import and export, run as background jobs.
- **Workspaces & nesting** — a small fixed set of top-level workspaces; pages nest
  shallowly and can be re-parented by drag-and-drop.
- **Tags** — cut across workspaces, attached polymorphically.
- **Roles & admin** — admin / editor / viewer roles, a user-management admin area, and
  a Trash with restore/purge.
- **Automated backups** — scheduled and manual full-system snapshots to local disk or SMB shares with optional XChaCha20-Poly1305 encryption.
- **Web Setup Wizard** — smooth first-run configuration of admin account, instance name, and SMTP settings right from the browser.

## Stack

- **Laravel 13** (PHP 8.3) + **Inertia.js** — server-driven, not a REST API.
- **React 19** (JavaScript) + **shadcn/ui** + **Tailwind v4**.
- **PostgreSQL 16** (`jsonb` content, `tsvector` search) + **Redis** (sessions, cache, queue).
- **Laravel Queues** on Redis for all conversions and heavy work (the `worker` service).
- **TipTap** (ProseMirror) editor; **Pest** test suite.

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

A dummy Samba server (`docsapp-samba-1`) is also included to allow testing SMB network share backups locally. You can configure backups to use the host `docsapp-samba-1`, share `backups`, username `smbuser`, and password `smbpassword`.

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

CI runs the same suite on every push and pull request (see `.github/workflows/ci.yml`).

The network-diagram capture path runs only in a real browser, so it's covered by
a manual checklist instead — see [`docs/network-diagram-smoke-test.md`](docs/network-diagram-smoke-test.md).

## Production

Production uses a **separate** compose file from development — code is baked into the
images, an Nginx container serves static assets and proxies PHP-FPM, and a reverse proxy
is expected at the edge for TLS.

```bash
cp .env.example .env       # then edit: APP_ENV=production, APP_DEBUG=false,
                           # a strong APP_KEY, real DB_PASSWORD, your APP_URL
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app php artisan migrate --force
```

`migrate --force` creates the schema. Once the containers are running, simply open your `APP_URL` in a browser. You will be greeted by the **Web Setup Wizard**, which will walk you through:
1. Creating your first admin account.
2. Setting the instance name.
3. Configuring SMTP settings for outgoing mail.

*(For unattended or headless installations, you can bypass the wizard using `docker compose -f docker-compose.prod.yml exec app php artisan app:install --email=you@example.com --password='...'`)*

The `app` container caches config/routes/views on boot. Uploaded assets and the database
live in named volumes (`app-storage`, `pgdata`) so they survive rebuilds. Put your own
reverse proxy (Caddy, Traefik, Nginx) in front of the `web` service for TLS — dev and
prod databases are always separate.

### Maintenance

Unreferenced image uploads (e.g. an image pasted then deleted before saving) can be swept
with `php artisan assets:prune` (`--dry-run` to preview, `--hours=N` to tune the grace
window). It's registered on a daily schedule that both stacks run automatically via their
`scheduler` service, and it's safe to run by hand any time.

## Backups & Encryption

The app features a built-in backup engine that snapshots your Postgres database and all local uploads into a single `.zip` file. You can configure scheduled or manual backups directly from the **Settings > Backups** UI, and route them to the local disk or an external SMB network share.

### Encrypted Backups
If you configure an encryption key, backups are encrypted at-rest using military-grade **XChaCha20-Poly1305** stream encryption (via `libsodium`) before they are written to disk.

1. **Generate a key:** Go to **Settings > Backups** to generate a secure, 32-byte base64 key directly in your browser.
2. **Add to environment:** Place this key in your `.env` file as `BACKUP_ENCRYPTION_KEY=your_base64_string`.
3. **Enable:** Toggle the "Encrypt backups" setting in the UI.

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
- `app/Services/Backup` — the backup engine, snapshotting, encryption, and restoration logic.
- `app/Support/SearchVector.php` — the single SQL definition for PostgreSQL full-text search vectors.
- `app/Support/DiagramSvg.php` & `process_svg.js` — server-side SVG generation and Node-based processing for network diagrams.
- `resources/js/Pages` — Inertia React pages (PascalCase folders).

## License

Open-source, self-hosted. See [`LICENSE`](LICENSE).
