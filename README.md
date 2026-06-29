<p align="center">
  <img src="https://raw.githubusercontent.com/pixelito/www.doc/master/art/logomd.svg" alt="www.doc" width="520">
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

## Install (production)

You don't clone the repo or compile anything — the app runs on pre-built images from
GitHub Container Registry. You need a machine (server, VM, or NAS) with **Docker** and
**Compose v2**, and the two files below. The whole thing is four steps.

**1. Download the two files**

```bash
mkdir www.doc && cd www.doc
curl -O https://raw.githubusercontent.com/pixelito/www.doc/master/docker-compose.prod.yml
curl -o .env https://raw.githubusercontent.com/pixelito/www.doc/master/.env.example
```

**2. Set three values in `.env`**

Open `.env` in any text editor and change just these three — leave everything else as it
is. (You do **not** need to touch `APP_ENV` or `APP_DEBUG`: the compose file already
forces those to production.)

| Variable | Set it to |
|----------|-----------|
| `APP_URL` | The address people will open in the browser, e.g. `https://docs.example.com` or `http://192.168.1.50:8080`. Also used in emails and PDF links. |
| `APP_KEY` | Run `openssl rand -base64 32`, then put `base64:` in front of the result — e.g. `APP_KEY=base64:abc123...`. |
| `DB_PASSWORD` | Any strong password you make up. You won't type it again. |

**3. Start it**

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec app php artisan migrate --force
```

**4. Open `APP_URL` in a browser**

The **Setup Wizard** walks you through creating the admin account, naming the instance,
and SMTP (email) settings. That's it — you're running.

Data lives in named volumes (`pgdata`, `app-storage`), so it survives restarts and
image updates. The `app` container caches config/routes/views on boot.

**Updating to a new version:**

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec app php artisan migrate --force
```

> **Container manager (Komodo, Portainer, Dockge):** paste `docker-compose.prod.yml`
> in and add the `.env` variables in the UI — no edits needed.
>
> **Headless install (skip the wizard):**
> `docker compose -f docker-compose.prod.yml exec app php artisan app:install --email=you@example.com --password='...'`
>
> **Build from source instead of pulling:** see the comments at the top of
> `docker-compose.prod.yml`.

### Reverse Proxy & HTTPS
Put your own reverse proxy (Caddy, Traefik, Nginx) in front of the `web` service (port `8080`) for TLS. See [Caddyfile.example](https://github.com/pixelito/www.doc/blob/master/Caddyfile.example) for a quick configuration.

### Log Rotation
The `docker-compose.prod.yml` enforces JSON file log rotation (`max-size: 10m`, `max-file: 3`) across all containers out-of-the-box, ensuring your server's disk space won't fill up with endless container logs over time.

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

Open-source, self-hosted. See [LICENSE](https://github.com/pixelito/www.doc/blob/master/LICENSE).
