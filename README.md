<p align="center">
  <img src="art/logomd.svg" alt="www.doc" width="520">
</p>

<p align="center">
  A self-hosted, wiki-style internal knowledge base for small &amp; medium companies.
</p>

---

**www.doc** is one focused product: a documentation app. Paste fidelity from Word/HTML,
screenshot-paste with image re-hosting, wiki-links and versioning, full-text search, and
DOCX/PDF import &amp; export — all running on your own infrastructure with Docker.

It is deliberately **not** a platform. No app launcher, no module registry, no
plugin marketplace — just a fast, clean place for a team to write things down.

## Features

- **Rich editor** — TipTap/ProseMirror with high-fidelity paste from Word and HTML,
  text colour, multicolour highlight, resizable images.
- **Screenshot &amp; image paste** — pasted and external images are intercepted and
  re-hosted as local assets (deduplicated by SHA-256).
- **Wiki-links &amp; backlinks** — `[[Page Title]]` links are indexed on save; every page
  shows what references it.
- **Versioning** — every content save snapshots a version you can view and restore;
  restoring is a full revert of content, title and tags.
- **Full-text search** — PostgreSQL FTS across pages, workspaces and tags, with
  highlighted excerpts.
- **Import &amp; export** — DOCX/PDF import and export, run as background jobs.
- **Workspaces &amp; nesting** — a small fixed set of top-level workspaces; pages nest
  shallowly and can be re-parented by drag-and-drop.
- **Tags** — cut across workspaces, attached polymorphically.
- **Roles &amp; admin** — admin / editor / viewer roles, a user-management admin area, and
  a Trash with restore/purge.

## Stack

- **Laravel 13** (PHP 8.3) + **Inertia.js** — server-driven, not a REST API.
- **React 19** (plain JavaScript, not TypeScript) + **shadcn/ui** + **Tailwind v4**.
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

## Production

Production uses a **separate** compose file from development — code is baked into the
images, an Nginx container serves static assets and proxies PHP-FPM, and a reverse proxy
is expected at the edge for TLS.

```bash
cp .env.example .env       # then edit: APP_ENV=production, APP_DEBUG=false,
                           # a strong APP_KEY, real DB_PASSWORD, your APP_URL
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app php artisan migrate --force

# First-run setup: create the roles + your admin account, and a welcome page.
docker compose -f docker-compose.prod.yml exec app \
  php artisan app:install --email=you@example.com --password='a-strong-password' --name='Your Name'
```

`migrate --force` only creates the (empty) schema; `app:install` seeds the
`admin`/`editor`/`viewer` roles and your first admin so you can actually log in.
It's idempotent and also accepts `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` env
vars instead of flags; pass `--no-welcome` to skip the starter page.

The `app` container caches config/routes/views on boot. Uploaded assets and the database
live in named volumes (`app-storage`, `pgdata`) so they survive rebuilds. Put your own
reverse proxy (Caddy, Traefik, Nginx) in front of the `web` service for TLS — dev and
prod databases are always separate.

### Maintenance

Unreferenced image uploads (e.g. an image pasted then deleted before saving) can be swept
with `php artisan assets:prune` (`--dry-run` to preview, `--hours=N` to tune the grace
window). It's registered on a daily schedule and the production stack runs it
automatically via the `scheduler` service. The dev stack has no scheduler, so run it by
hand there when you need it.

## Project layout

- `app/Services/RenderDocument.php` — the one and only TipTap-JSON → HTML renderer.
- `app/Services/Importers` / `Exporters` — DOCX/PDF conversion (queued jobs).
- `resources/js/Pages` — Inertia pages (PascalCase folders).
- `resources/js/components/editor/TipTapEditor.jsx` — the editor schema (mirror of
  `RenderDocument`'s extension list).

## License

Open-source, self-hosted. See [`LICENSE`](LICENSE).
