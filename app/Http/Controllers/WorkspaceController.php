<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkspaceRequest;
use App\Http\Requests\UpdateWorkspaceRequest;
use App\Models\Document;
use App\Models\Workspace;
use App\Support\DocumentTree;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceController extends Controller
{
    public function index(): Response
    {
        $this->authorize('viewAny', Workspace::class);

        $workspaces = Workspace::query()
            ->withCount('documents')
            ->orderBy('position')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'position', 'updated_at']);

        $recent = Document::with('workspace')
            ->orderByDesc('updated_at')
            ->limit(6)
            ->get()
            ->map(fn (Document $d) => [
                'id'         => $d->id,
                'title'      => $d->title,
                'updated_at' => $d->updated_at->toIso8601String(),
                'workspace'  => ['name' => $d->workspace->name, 'slug' => $d->workspace->slug],
            ]);

        return Inertia::render('Workspaces/Index', [
            'workspaces' => $workspaces,
            'recent'     => $recent,
        ]);
    }

    public function show(Workspace $workspace): Response
    {
        $this->authorize('view', $workspace);

        $documents = $workspace->documents()->with('tags')->orderBy('position')->get();

        return Inertia::render('Workspaces/Show', [
            'workspace' => $workspace->loadCount('documents'),
            'tree'      => DocumentTree::build($documents),
        ]);
    }

    public function reorder(Request $request): RedirectResponse
    {
        $this->authorize('create', Workspace::class);

        // Validate the payload like the document reorder/move endpoints do — an
        // unchecked id list reaching a raw UPDATE is the one gap among the tree
        // ops. A raw DB::table update keeps reordering from bumping updated_at.
        $data = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:workspaces,id'],
        ]);

        foreach ($data['ids'] as $position => $id) {
            DB::table('workspaces')->where('id', $id)->update(['position' => $position]);
        }

        return back();
    }

    public function store(StoreWorkspaceRequest $request): RedirectResponse
    {
        $this->authorize('create', Workspace::class);

        $workspace = Workspace::create($request->validated());

        return redirect()->route('workspaces.show', $workspace);
    }

    public function update(UpdateWorkspaceRequest $request, Workspace $workspace): RedirectResponse
    {
        $this->authorize('update', $workspace);

        $workspace->update($request->validated());

        return back();
    }

    public function destroy(Workspace $workspace): RedirectResponse
    {
        $this->authorize('delete', $workspace);

        $workspace->trashWithDocuments();

        return redirect()->route('workspaces.index')
            ->with('success', "Moved \"{$workspace->name}\" to trash.");
    }
}
