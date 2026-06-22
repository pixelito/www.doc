#!/bin/sh
set -e

# Runs on container boot for both the app (php-fpm) and worker. Migrations are
# NOT run here on purpose — run them once, explicitly, after `up` (see README),
# so app + worker don't race to migrate the same database.

cd /var/www/html

# Link public/storage -> storage/app/public for uploaded assets. Idempotent.
php artisan storage:link 2>/dev/null || true

# Bake the production caches. Safe to re-run on every boot.
php artisan config:cache
php artisan route:cache
php artisan view:cache

exec "$@"
