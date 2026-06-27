<?php

use App\Http\Controllers\Admin\BackupController as AdminBackupController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\AttachmentController;
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

// Model-bound route params are bigint ids — constrain them to digits so a
// non-numeric URL segment 404s cleanly instead of hitting the DB with an
// invalid bigint (Postgres would otherwise throw a QueryException → 500).
Route::pattern('document', '[0-9]+');
Route::pattern('version', '[0-9]+');
Route::pattern('workspace', '[0-9]+');
Route::pattern('tag', '[0-9]+');
Route::pattern('job', '[0-9]+');
Route::pattern('user', '[0-9]+');
Route::pattern('backup', '[0-9]+');
Route::pattern('attachment', '[0-9]+');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    // Settings
    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('settings.profile');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('settings.profile.update');
    Route::patch('settings/password', [ProfileController::class, 'updatePassword'])->name('settings.password.update');

    // Admin — instance administration (admins only).
    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('users', [AdminUserController::class, 'index'])->name('users.index');
        Route::post('users', [AdminUserController::class, 'store'])->name('users.store');
        Route::patch('users/{user}', [AdminUserController::class, 'update'])->name('users.update');
        Route::delete('users/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');

        // Backups & restore (NIS2). 'settings'/'run' declared before {backup} so
        // they aren't read as ids (the [0-9]+ pattern already prevents that).
        Route::get('backups', [AdminBackupController::class, 'index'])->name('backups.index');
        Route::post('backups', [AdminBackupController::class, 'store'])->name('backups.store');
        Route::patch('backups/settings', [AdminBackupController::class, 'updateSettings'])->name('backups.settings');
        Route::post('backups/test-destination', [AdminBackupController::class, 'testDestination'])->name('backups.test-destination');
        Route::post('backups/test-email', [AdminBackupController::class, 'testEmail'])->name('backups.test-email');
        Route::get('backups/{backup}', [AdminBackupController::class, 'show'])->name('backups.show');
        Route::get('backups/{backup}/download', [AdminBackupController::class, 'download'])->name('backups.download');
        Route::post('backups/{backup}/restore', [AdminBackupController::class, 'restore'])->name('backups.restore');
        Route::post('backups/{backup}/acknowledge', [AdminBackupController::class, 'acknowledge'])->name('backups.acknowledge');
        Route::delete('backups/{backup}', [AdminBackupController::class, 'destroy'])->name('backups.destroy');
    });

    // Document tree operations — declared before the resource so 'reorder'
    // isn't swallowed by the documents/{document} update route.
    Route::patch('documents/reorder', [DocumentController::class, 'reorder'])->name('documents.reorder');
    Route::get('documents/{document}/children', [DocumentController::class, 'children'])->name('documents.children');
    Route::patch('documents/{document}/move', [DocumentController::class, 'move'])->name('documents.move');
    Route::get('documents/{document}/preview', [DocumentController::class, 'preview'])->name('documents.preview');
    Route::post('documents/diagram-export', [DocumentController::class, 'exportDiagram'])->name('documents.diagram.export');

    Route::patch('workspaces/reorder', [WorkspaceController::class, 'reorder'])->name('workspaces.reorder');
    // Bulk save of a workspace's whole page tree — the "Reorder" mode's single
    // write on "Done". Declared before the resource so it isn't read as a show.
    Route::patch('workspaces/{workspace}/tree', [DocumentController::class, 'restructure'])->name('workspaces.tree.update');
    Route::resource('workspaces', WorkspaceController::class)->except(['create', 'edit']);
    Route::resource('documents', DocumentController::class)->only(['store', 'show', 'update', 'destroy']);
    Route::resource('tags', TagController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

    // Asset upload + rehost (must be before any {asset} resource route)
    Route::post('assets/rehost', [AssetController::class, 'rehost'])->name('assets.rehost');
    Route::post('assets', [AssetController::class, 'store'])->name('assets.store');

    // Page attachments — files attached to a document, served as forced downloads.
    Route::post('documents/{document}/attachments', [AttachmentController::class, 'store'])->name('attachments.store');
    Route::get('documents/{document}/attachments/{attachment}', [AttachmentController::class, 'download'])->name('attachments.download');
    Route::delete('documents/{document}/attachments/{attachment}', [AttachmentController::class, 'destroy'])->name('attachments.destroy');

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

// Redirect (not a closure) so the route table stays serialisable for
// `route:cache` in production.
Route::redirect('/', '/workspaces');
