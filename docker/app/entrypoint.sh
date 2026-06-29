#!/bin/sh
set -e

# Runs on container boot for both the app (php-fpm), worker, and scheduler.
# Database migrations are automatically run in isolated mode to prevent races.

cd /var/www/html

# Auto-generate APP_KEY if missing so the app boots smoothly
if [ -z "$APP_KEY" ]; then
    if [ ! -f storage/app_key.txt ]; then
        echo "base64:$(head -c 32 /dev/urandom | base64)" > storage/app_key.txt
        chown www-data:www-data storage/app_key.txt 2>/dev/null || true
    fi
    export APP_KEY=$(cat storage/app_key.txt)
fi

# Link public/storage -> storage/app/public for uploaded assets. Idempotent.
php artisan storage:link 2>/dev/null || true

# Bake the production caches. Safe to re-run on every boot.
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run database migrations automatically so the user doesn't have to.
# --isolated ensures only one container runs it, avoiding races.
php artisan migrate --force --isolated || true

exec "$@"
