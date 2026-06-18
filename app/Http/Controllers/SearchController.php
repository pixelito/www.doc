<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SearchController extends Controller
{
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', Document::class);

        $q = trim((string) $request->get('q', ''));

        $results = [];

        if ($q !== '') {
            $results = DB::select(
                "SELECT
                    d.id,
                    d.title,
                    d.slug,
                    d.workspace_id,
                    w.name AS workspace_name,
                    ts_rank(d.search_vector, query) AS rank,
                    ts_headline(
                        'english',
                        COALESCE(d.content_html, ''),
                        query,
                        'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>, HighlightAll=false'
                    ) AS excerpt
                 FROM documents d
                 JOIN workspaces w ON w.id = d.workspace_id,
                      plainto_tsquery('english', ?) query
                 WHERE d.search_vector @@ query
                 ORDER BY rank DESC
                 LIMIT 30",
                [$q]
            );

            // Strip tags from excerpts (ts_headline returns HTML-safe fragments;
            // we keep the <mark> tags but strip everything else)
            $results = array_map(function ($row) {
                $row = (array) $row;
                $row['excerpt'] = preg_replace('/<(?!\/?(mark)[\s>])[^>]+>/i', '', $row['excerpt'] ?? '');
                return $row;
            }, $results);
        }

        return Inertia::render('Search/Index', [
            'q'       => $q,
            'results' => $results,
        ]);
    }
}
