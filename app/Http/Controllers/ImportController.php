<?php

namespace App\Http\Controllers;

use App\Jobs\ImportDocumentJob;
use App\Models\ConversionJob;
use App\Models\Document;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ImportController extends Controller
{
    public function create(Workspace $workspace, Request $request): Response
    {
        $this->authorize('update', $workspace);

        return Inertia::render('Documents/Import', [
            'workspace'       => $workspace->only('id', 'name'),
            'pages'           => $this->flatPages($workspace),
            'initialParentId' => $request->query('parent_id'),
        ]);
    }

    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorize('update', $workspace);

        $data = $request->validate([
            'file'      => ['required', 'file', 'max:51200', 'mimes:docx,pdf'],
            'title'     => ['nullable', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:documents,id'],
        ]);

        $file   = $request->file('file');
        $format = strtolower($file->getClientOriginalExtension());

        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') {
            $title = 'Importing ' . Str::title(str_replace('-', ' ', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)));
        }

        $document = Document::create([
            'title'          => $title,
            'workspace_id'   => $workspace->id,
            'parent_id'      => $data['parent_id'] ?? null,
            'content'        => ['type' => 'doc', 'content' => []],
            'created_by_id'  => Auth::id(),
            'updated_by_id'  => Auth::id(),
        ]);

        $uploadPath = $file->store("imports/{$format}", 'local');

        $job = ConversionJob::create([
            'document_id' => $document->id,
            'direction'   => 'import',
            'format'      => $format,
            'status'      => 'pending',
            'result_path' => $uploadPath,
        ]);

        ImportDocumentJob::dispatch($job->id);

        return response()->json([
            'job_id'      => $job->id,
            'document_id' => $document->id,
        ], 202);
    }

    public function show(ConversionJob $job): JsonResponse
    {
        $this->authorize('view', $job);

        return response()->json([
            'status'      => $job->status,
            'error'       => $job->error,
            'document_id' => $job->document_id,
        ]);
    }

    private function flatPages(Workspace $workspace): array
    {
        $all = $workspace->documents()
            ->orderBy('position')
            ->get(['id', 'title', 'parent_id'])
            ->keyBy('id');

        $result = [];
        $this->flattenDocs($all->whereNull('parent_id'), $all, $result, 0);
        return $result;
    }

    private function flattenDocs($nodes, $all, array &$result, int $depth): void
    {
        foreach ($nodes as $node) {
            $result[] = [
                'id'    => $node->id,
                'label' => str_repeat('  ', $depth) . $node->title,
                'depth' => $depth,
            ];
            $this->flattenDocs($all->where('parent_id', $node->id), $all, $result, $depth + 1);
        }
    }
}
