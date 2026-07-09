<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTagRequest;
use App\Http\Requests\UpdateTagRequest;
use App\Models\Tag;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class TagController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', Tag::class);

        return Inertia::render('Tags/Index', [
            'tags' => Tag::query()->withCount('documents')->orderBy('name')->get(),
        ]);
    }

    public function show(Tag $tag): Response
    {
        $this->authorize('view', $tag);

        $documents = $tag->documents()
            ->with('workspace:id,name', 'tags:id,name')
            ->select(['documents.id', 'documents.title', 'documents.slug', 'documents.workspace_id', 'documents.updated_at'])
            ->orderBy('workspace_id')
            ->orderBy('title')
            ->get()
            ->groupBy('workspace_id')
            ->map(fn ($docs, $wsId) => [
                'workspace' => $docs->first()->workspace->only('id', 'name'),
                'documents' => $docs->values(),
            ])
            ->values();

        return Inertia::render('Tags/Show', [
            'tag'     => $tag->only('id', 'name', 'slug'),
            'groups'  => $documents,
        ]);
    }

    public function store(StoreTagRequest $request): RedirectResponse
    {
        $this->authorize('create', Tag::class);

        $tag = Tag::create($request->validated());

        return back()->with('success', "Tag \"{$tag->name}\" created.");
    }

    public function update(UpdateTagRequest $request, Tag $tag): RedirectResponse
    {
        $this->authorize('update', $tag);

        $tag->update($request->validated());

        return back()->with('success', "Tag \"{$tag->name}\" updated.");
    }

    public function destroy(Tag $tag): RedirectResponse
    {
        $this->authorize('delete', $tag);

        $name = $tag->name;
        $tag->delete();

        return back()->with('success', "Deleted tag \"{$name}\".");
    }
}
