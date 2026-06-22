<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);
        $middleware->alias([
            'admin' => \App\Http\Middleware\EnsureAdmin::class,
        ]);

        $middleware->trimStrings(except: [
            'content',
            'content.*',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Render a branded Inertia page for HTTP errors instead of the bare
        // Symfony page. 403/404 always (nothing to debug); 500/503 only outside
        // local so the debug page stays available in dev. Skipped in tests and
        // for JSON clients so assertions and API responses are unaffected.
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();

            if ($request->expectsJson() || app()->environment('testing')) {
                return $response;
            }

            $styled = in_array($status, [403, 404], true)
                || (in_array($status, [500, 503], true) && ! app()->environment('local'));

            if ($styled) {
                // Routing-level 404s never hit the web middleware, so Inertia's
                // asset version is unset here — render it empty and the next
                // client visit sees a version mismatch and hard-reloads. Set it
                // so navigating away from the error page stays a SPA visit.
                Inertia::version(fn () => (new \App\Http\Middleware\HandleInertiaRequests)->version($request));

                return Inertia::render('Error', ['status' => $status])
                    ->toResponse($request)
                    ->setStatusCode($status);
            }

            return $response;
        });
    })->create();
