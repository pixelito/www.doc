<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWorkspaceRequest;
use App\Http\Requests\UpdateWorkspaceRequest;
use App\Models\Workspace;
use App\Support\DocumentTree;
use Illuminate\Http\RedirectResponse;
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
            ->get();

        return Inertia::render('Workspaces/Index', [
            'workspaces' => $workspaces,
        ]);
    }

    public function show(Workspace $workspace): Response
    {
        $this->authorize('view', $workspace);

        return Inertia::render('Workspaces/Show', [
            'workspace' => $workspace,
            'tree' => DocumentTree::build($workspace->documents),
        ]);
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

        $workspace->delete();

        return redirect()->route('workspaces.index');
    }
}
