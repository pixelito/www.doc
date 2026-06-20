<?php

use App\Http\Controllers\AssetController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\TrashController;
use App\Http\Controllers\VersionController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth')->group(function () {
    // ── Shell — always available regardless of which modules are enabled ──
    Route::get('/dashboard', [AuthController::class, 'dashboard'])->name('dashboard');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    // Settings
    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('settings.profile');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('settings.profile.update');
    Route::patch('settings/password', [ProfileController::class, 'updatePassword'])->name('settings.password.update');

    // ── Docs module — 404s entirely when MODULE_DOCS is off ──────────────
    Route::middleware('module:docs')->group(function () {
        // Document tree operations — declared before the resource so 'reorder'
        // isn't swallowed by the documents/{document} update route.
        Route::patch('documents/reorder', [DocumentController::class, 'reorder'])->name('documents.reorder');
        Route::get('documents/{document}/children', [DocumentController::class, 'children'])->name('documents.children');
        Route::patch('documents/{document}/move', [DocumentController::class, 'move'])->name('documents.move');
        Route::get('documents/{document}/preview', [DocumentController::class, 'preview'])->name('documents.preview');

        Route::patch('workspaces/reorder', [WorkspaceController::class, 'reorder'])->name('workspaces.reorder');
        Route::resource('workspaces', WorkspaceController::class)->except(['create', 'edit']);
        Route::resource('documents', DocumentController::class)->only(['store', 'show', 'update', 'destroy']);
        Route::resource('tags', TagController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

        // Asset upload + rehost (must be before any {asset} resource route)
        Route::post('assets/rehost', [AssetController::class, 'rehost'])->name('assets.rehost');
        Route::post('assets', [AssetController::class, 'store'])->name('assets.store');

        // Export pipeline
        Route::post('documents/{document}/exports', [ExportController::class, 'store'])->name('exports.store');
        Route::get('documents/{document}/exports/{job}', [ExportController::class, 'show'])->name('exports.show');

        // Version history
        Route::get('documents/{document}/versions', [VersionController::class, 'index'])->name('versions.index');
        Route::get('documents/{document}/versions/{version}', [VersionController::class, 'show'])->name('versions.show');
        Route::post('documents/{document}/versions/{version}/restore', [VersionController::class, 'restore'])->name('versions.restore');

        // Full-text search
        Route::get('search', [SearchController::class, 'index'])->name('search');

        // Trash — soft-deleted workspaces + documents
        Route::get('trash', [TrashController::class, 'index'])->name('trash.index');
        Route::post('trash/documents/{document}/restore', [TrashController::class, 'restoreDocument'])->name('trash.documents.restore');
        Route::delete('trash/documents/{document}', [TrashController::class, 'forceDeleteDocument'])->name('trash.documents.force-delete');
        Route::post('trash/workspaces/{workspace}/restore', [TrashController::class, 'restoreWorkspace'])->name('trash.workspaces.restore');
        Route::delete('trash/workspaces/{workspace}', [TrashController::class, 'forceDeleteWorkspace'])->name('trash.workspaces.force-delete');
        Route::delete('trash', [TrashController::class, 'empty'])->name('trash.empty');

        // Import pipeline
        Route::get('workspaces/{workspace}/imports/create', [ImportController::class, 'create'])->name('imports.create');
        Route::post('workspaces/{workspace}/imports', [ImportController::class, 'store'])->name('imports.store');
        Route::get('imports/{job}', [ImportController::class, 'show'])->name('imports.show');
    });
});

Route::get('/', fn () => redirect()->route('dashboard'));
