# syntax=docker/dockerfile:1

# ── Stage 1: build the frontend assets ──────────────────────────────────────
FROM node:24-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: PHP runtime (php-fpm), with code + vendor + built assets baked in ─
FROM php:8.3-fpm-bookworm AS app
ENV COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_INTERACTION=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip libpq-dev libzip-dev libicu-dev libonig-dev curl ca-certificates smbclient nodejs npm \
 && docker-php-ext-install pdo pdo_pgsql pgsql zip intl bcmath opcache \
 && pecl install redis && docker-php-ext-enable redis \
 && rm -rf /var/lib/apt/lists/*

# Production opcache + sane PHP defaults.
COPY docker/app/php.prod.ini /usr/local/etc/php/conf.d/zz-prod.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP deps first (better layer caching), without dev packages.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --prefer-dist --no-autoloader

# Application code, then the compiled assets from stage 1.
COPY . .
COPY --from=assets /app/public/build ./public/build

# Install Node dependencies needed at runtime (e.g., for process_svg.js)
RUN npm ci --omit=dev

# storage/ and bootstrap/cache are .dockerignored — recreate the empty skeleton
# Laravel needs at runtime, then optimise the autoloader.
RUN mkdir -p \
      storage/app/public \
      storage/app/private \
      storage/framework/cache/data \
      storage/framework/sessions \
      storage/framework/views \
      storage/logs \
      bootstrap/cache \
 && composer dump-autoload --optimize --no-dev \
 && chown -R www-data:www-data storage bootstrap/cache

COPY docker/app/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

EXPOSE 9000
ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

# ── Stage 3: nginx serving the static assets + proxying php-fpm ──────────────
# Assets are baked in per-deploy (immutable, content-hashed) so a rebuild can
# never serve a stale build/. nginx only needs the static files on disk: the
# build/ assets (from this image) and uploaded /storage/* (the shared volume,
# reached through the public/storage symlink). index.php is passed to php-fpm
# by path, so it doesn't need to live here.
FROM nginx:1.27-alpine AS web
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=assets /app/public/build /var/www/html/public/build
RUN ln -s /var/www/html/storage/app/public /var/www/html/public/storage
EXPOSE 80
