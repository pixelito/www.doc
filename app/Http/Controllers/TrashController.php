<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class TrashController extends Controller
{
    /**
     * List trashed documents. Only "top-level" trashed items are shown — a
     * trashed page whose parent is also trashed is part of a trashed subtree
     * and is restored together with its parent, so it isn't listed separately.
     */
    public function index(): Response
    {
        abort_unless(auth()->user()->hasRole('admin'), 403);

        $documents = Document::onlyTrashed()
            ->with(['workspace:id,name'])
            ->where(fn ($q) => $q->whereNull('parent_id')->orWhereHas('parent'))
            ->orderByDesc('deleted_at')
            ->get()
            ->map(fn (Document $d) => [
                'id'          => $d->id,
                'title'       => $d->title,
                'workspace'   => $d->workspace ? ['id' => $d->workspace->id, 'name' => $d->workspace->name] : null,
                'deleted_at'  => $d->deleted_at?->toIso8601String(),
                'child_count' => $d->children()->onlyTrashed()->count(),
            ]);

        return Inertia::render('Trash/Index', [
            'documents' => $documents,
        ]);
    }

    public function restore(int $document): RedirectResponse
    {
        $doc = Document::onlyTrashed()->findOrFail($document);
        $this->authorize('restore', $doc);

        $doc->restoreSubtree();

        return back()->with('success', "Restored \"{$doc->title}\".");
    }

    public function forceDelete(int $document): RedirectResponse
    {
        $doc = Document::onlyTrashed()->findOrFail($document);
        $this->authorize('forceDelete', $doc);

        $title = $doc->title;
        $doc->forceDeleteSubtree();

        return back()->with('success', "Permanently deleted \"{$title}\".");
    }
}
