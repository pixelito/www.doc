<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Workspace;
use App\Support\Modules;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AuthController extends Controller
{
    public function showLogin()
    {
        return Inertia::render('Login');
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return back()->withErrors(['email' => 'These credentials do not match our records.']);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }

    public function dashboard()
    {
        // Per-module stats for the dashboard tiles. Only computed for enabled
        // modules — a disabled app contributes nothing.
        $stats = [
            'docs' => Modules::enabled('docs') ? [
                'workspaces' => Workspace::count(),
                'documents'  => Document::count(),
            ] : null,
        ];

        return Inertia::render('Dashboard', compact('stats'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
