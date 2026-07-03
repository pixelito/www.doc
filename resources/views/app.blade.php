<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title inertia>{{ config('app.name') }}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="icon" href="/favicon.ico" sizes="any">
        {{-- Stamp the theme BEFORE the bundle loads so the first paint is
             already themed (no light flash). Mirrors resources/js/lib/theme.js:
             keep the storage key and the system/light fallback in sync. --}}
        <script>
            (function () {
                var theme = 'light';
                try {
                    var pref = localStorage.getItem('wwwdoc:theme') || 'system';
                    theme = pref === 'system'
                        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                        : pref;
                } catch (e) { /* storage unavailable — keep light */ }
                document.documentElement.setAttribute('data-theme', theme);
            })();
        </script>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.jsx'])
        @inertiaHead
    </head>
    <body class="antialiased">
        @inertia
    </body>
</html>
