<?php

namespace App\Jobs;

use App\Models\ConversionJob;
use App\Services\Importers\DocxImporter;
use App\Services\Importers\PdfImporter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ImportDocumentJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 180;

    public function __construct(public readonly int $conversionJobId) {}

    public function handle(DocxImporter $docx, PdfImporter $pdf): void
    {
        $job = ConversionJob::with('document')->findOrFail($this->conversionJobId);
        $job->update(['status' => 'processing']);

        try {
            $path = $job->result_path; // stores the temp upload path

            $result = match ($job->format) {
                'docx' => $docx->import(Storage::disk('local')->path($path), $job->created_by_id),
                'pdf'  => $pdf->import(Storage::disk('local')->path($path), $job->created_by_id),
                default => throw new \InvalidArgumentException("Unknown format: {$job->format}"),
            };

            $document = $job->document;

            // Overwrite title only if the document still has the placeholder title
            if (str_starts_with($document->title, 'Importing')) {
                $document->title = $result['title'];
            }

            $document->content = $result['content'];
            $document->save();

            // Clean up the temp upload
            Storage::disk('local')->delete($path);

            $job->update(['status' => 'done', 'result_path' => null]);
        } catch (Throwable $e) {
            $job->update(['status' => 'failed', 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    /**
     * Final-failure hook — also covers deaths the catch above never sees
     * (timeout kills the worker process, lost job payload), which would
     * otherwise leave the row stuck in `processing` with the UI polling
     * forever. Guarded so a failure the catch already recorded isn't redone.
     */
    public function failed(?Throwable $e): void
    {
        $job = ConversionJob::with('document')->find($this->conversionJobId);
        if (! $job) {
            return;
        }

        if (in_array($job->status, ['pending', 'processing'], true)) {
            $job->update([
                'status' => 'failed',
                'error'  => $e?->getMessage() ?? 'The import was interrupted.',
            ]);
        }

        // The placeholder page created at upload never got content — trash it
        // (soft delete, recoverable) so a failed import doesn't leave an empty
        // "Importing …" page in the tree.
        $document = $job->document;
        if ($document && str_starts_with($document->title, 'Importing')
            && \App\Support\TipTap::isEmpty($document->content)) {
            $document->delete();
        }
    }
}
