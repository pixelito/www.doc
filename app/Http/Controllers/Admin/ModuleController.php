<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Modules;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin panel — enable/disable app modules. Writes a DB override that
 * Modules::enabled() reads ahead of the config/env default.
 */
class ModuleController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Apps', [
            'modules' => Modules::forSharing(),
        ]);
    }

    public function update(Request $request, string $module): RedirectResponse
    {
        abort_unless(array_key_exists($module, config('modules', [])), 404);

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        Settings::set("module.{$module}.enabled", $validated['enabled']);

        return back()->with('success', $validated['enabled'] ? 'App enabled.' : 'App disabled.');
    }
}
