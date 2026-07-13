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

class ImportController extends Controller
{
    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorize('update', $workspace);

        $data = $request->validate([
            'file'      => ['required', 'file', 'max:51200', 'mimes:docx,pdf'],
            'title'     => ['nullable', 'string', 'max:255'],
            'parent_id' => [
                'nullable', 
                'integer', 
                \Illuminate\Validation\Rule::exists('documents', 'id')->where('workspace_id', $workspace->id)
            ],
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
            // The queue worker runs unauthenticated — carry the importer's id
            // so assets extracted from the file are attributed to them.
            'created_by_id' => Auth::id(),
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

}
