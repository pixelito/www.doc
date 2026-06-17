<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\TagController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [AuthController::class, 'dashboard'])->name('dashboard');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    // Document tree operations — declared before the resource so 'reorder'
    // isn't swallowed by the documents/{document} update route.
    Route::patch('documents/reorder', [DocumentController::class, 'reorder'])->name('documents.reorder');
    Route::get('documents/{document}/children', [DocumentController::class, 'children'])->name('documents.children');
    Route::patch('documents/{document}/move', [DocumentController::class, 'move'])->name('documents.move');

    Route::resource('workspaces', WorkspaceController::class)->except(['create', 'edit']);
    Route::resource('documents', DocumentController::class)->only(['store', 'show', 'update', 'destroy']);
    Route::resource('tags', TagController::class)->only(['index', 'store', 'update', 'destroy']);
});

Route::get('/', fn () => redirect()->route('dashboard'));
