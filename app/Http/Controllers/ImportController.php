<?php

namespace App\Http\Controllers;

use App\Jobs\ImportDocumentJob;
use App\Models\ConversionJob;
use App\Models\Document;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ImportController extends Controller
{
    /**
     * Show the import form for a workspace.
     */
    public function create(Workspace $workspace): Response
    {
        $this->authorize('update', $workspace);

        return Inertia::render('Documents/Import', [
            'workspace' => $workspace->only('id', 'name'),
        ]);
    }

    /**
     * Accept the uploaded file, create a Document stub + ConversionJob, dispatch the job.
     */
    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorize('update', $workspace);

        $data = $request->validate([
            'file'  => ['required', 'file', 'max:51200', 'mimes:docx,pdf'],
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        $file   = $request->file('file');
        $format = strtolower($file->getClientOriginalExtension());

        // Derive a placeholder title from filename if not provided
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') {
            $title = 'Importing ' . Str::title(str_replace('-', ' ', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)));
        }

        // Create a blank document stub (content will be filled by the job)
        $document = Document::create([
            'title'          => $title,
            'workspace_id'   => $workspace->id,
            'content'        => ['type' => 'doc', 'content' => []],
            'created_by_id'  => Auth::id(),
            'updated_by_id'  => Auth::id(),
        ]);

        // Store the upload in local (private) disk so the job can read it
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

    /**
     * Poll the import job status.
     */
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
