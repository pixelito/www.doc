# Backups & Encryption Guide

www.doc has a built-in backup engine that snapshots your PostgreSQL database and
all local uploads into a single `.zip` archive. Backups are configured entirely
from the **Settings > Backups** UI — scheduled or manual — and can be written to
the local disk or an external SMB network share.

## What's inside an archive

Each archive holds two layers:

- **Canonical layer** — the full content model as JSON/NDJSON (pages, versions,
  workspaces, tags, links and page templates) plus every asset and attachment
  binary. This is the authoritative restore source, integrity-checked against
  per-file SHA-256s.
- **Readable layer** — a PDF per page, foldered by tree, for humans and
  auditors.

Restores always rebuild from the canonical layer, never the PDFs. The archive's
`manifest.json` records which app version created it.

Per-user navigation state (starred pages, recently-viewed timestamps) is
deliberately **not** part of backups — it's personal ephemera, not content, and
a restore resets it.

The audit trail travels inside every archive (`canonical/audit_events.ndjson`)
and is **merged** on restore — never wiped — so restoring an old backup can't
erase newer audit history.

## Restore & import

- Every restore first takes a **safety snapshot** of the current state, and
  aborts if that snapshot can't be written.
- You can **import** an archive from file (e.g. from another instance).
  Encrypted archives prompt for the key; a wrong or missing key still registers
  the archive, flagged as undecryptable.

## Reports

After each unattended run the app emails a success/failure report (using the
instance's SMTP settings), or shows a persistent in-app notice when mail is off
or fails.

## Encrypted backups

If you configure an encryption key, backups are encrypted at rest with
**XChaCha20-Poly1305** stream encryption (via `libsodium`) before they are
written to disk.

1. **Generate a key:** go to **Settings > Backups** to generate a secure,
   32-byte base64 key directly in your browser.
2. **Add to environment:** place the key in your `.env` file (or GUI
   environment config) as `BACKUP_ENCRYPTION_KEY=your_base64_string`.
3. **Restart the stack:** recreate the container so the variable is injected
   and cached. In the CLI, run `docker compose up -d`. If using a GUI (Komodo,
   Portainer), click **Deploy** or **Update** (a simple container restart is
   usually not enough).
4. **Enable:** toggle the "Encrypt backups" setting in the UI.

The app transparently encrypts and decrypts archives during automated
operations (including hitting "Restore" in the UI).

### Manual decryption (disaster recovery)

If your server crashes and you need to extract a `.zip.enc` backup manually
without the app running, you cannot use standard base64 decoding tools — use
the provided emergency CLI tool, which properly streams the `libsodium`
decryption:

```bash
docker compose exec app php artisan backup:decrypt /path/to/your/backup.zip.enc --key="YOUR_BASE64_KEY"
```

If `--key` is omitted, the command uses the key configured in your `.env` file.

## Scheduling

The `scheduler` service checks hourly whether the admin-configured cadence has
elapsed and runs `php artisan backup:run` when due. The command itself is the
gate, so it's safe to run by hand and is a no-op when backups are disabled or
not yet due.
