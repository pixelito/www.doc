<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Tag;
use App\Models\Workspace;
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
            $results = array_merge(
                $this->searchDocuments($q),
                $this->searchWorkspaces($q),
                $this->searchTags($q),
            );

            // Sort: documents by rank desc first, then workspaces, then tags
            usort($results, fn ($a, $b) => ($b['rank'] ?? 0) <=> ($a['rank'] ?? 0));
        }

        return Inertia::render('Search/Index', [
            'q'       => $q,
            'results' => $results,
        ]);
    }

    private function searchDocuments(string $q): array
    {
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';
        $lang = config('database.search_language', 'english');

        // FTS for indexed documents, ILIKE title fallback for unindexed ones.
        // ts_headline runs over the tag-STRIPPED text (the same derivation the
        // search vector indexes — see SearchVector) so highlights can't land
        // inside tag attributes/URLs and the excerpt carries no markup beyond
        // the <mark> tags ts_headline itself inserts.
        $rows = DB::select("
            SELECT
                d.id,
                d.title,
                d.slug,
                d.workspace_id,
                d.updated_at,
                w.name  AS workspace_name,
                u.name  AS updated_by_name,
                (
                    SELECT COALESCE(
                        JSON_AGG(JSON_BUILD_OBJECT('id', t2.id, 'name', t2.name) ORDER BY t2.name),
                        '[]'::json
                    )
                    FROM taggables tg2
                    JOIN tags t2 ON t2.id = tg2.tag_id
                    WHERE tg2.taggable_id = d.id
                      AND tg2.taggable_type = 'App\\Models\\Document'
                ) AS tags,
                CASE
                    WHEN d.search_vector IS NOT NULL
                         AND d.search_vector @@ plainto_tsquery(?, ?)
                    THEN ts_rank(d.search_vector, plainto_tsquery(?, ?))
                    ELSE 0.05
                END AS rank,
                CASE
                    WHEN d.search_vector IS NOT NULL
                         AND d.search_vector @@ plainto_tsquery(?, ?)
                    THEN ts_headline(
                        ?,
                        regexp_replace(COALESCE(d.content_html, ''), '<[^>]+>', ' ', 'g'),
                        plainto_tsquery(?, ?),
                        'MaxWords=30, MinWords=15, StartSel=<mark>, StopSel=</mark>, HighlightAll=false'
                    )
                    ELSE NULL
                END AS excerpt
            FROM documents d
            JOIN workspaces w ON w.id = d.workspace_id
            LEFT JOIN users u ON u.id = d.updated_by_id
            WHERE
                d.deleted_at IS NULL
                AND w.deleted_at IS NULL
                AND (
                    (d.search_vector IS NOT NULL AND d.search_vector @@ plainto_tsquery(?, ?))
                    OR d.title ILIKE ?
                )
            ORDER BY rank DESC
            LIMIT 20
        ", [$lang, $q, $lang, $q, $lang, $q, $lang, $lang, $q, $lang, $q, $like]);

        return array_map(function ($row) {
            $row = (array) $row;
            $row['type'] = 'document';
            $row['tags'] = json_decode($row['tags'] ?? '[]', true) ?? [];
            if ($row['excerpt']) {
                $row['excerpt'] = preg_replace('/<(?!\/?mark[\s>])[^>]+>/i', '', $row['excerpt']);
            }
            return $row;
        }, $rows);
    }

    private function searchWorkspaces(string $q): array
    {
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';

        $rows = Workspace::where('name', 'ILIKE', $like)
            ->orWhere('description', 'ILIKE', $like)
            ->withCount('documents')
            ->limit(5)
            ->get(['id', 'name', 'description', 'slug'])
            ->toArray();

        return array_map(fn ($row) => array_merge($row, [
            'type'           => 'workspace',
            'rank'           => 0.8,
            'excerpt'        => $row['description'] ?? null,
            'workspace_name' => null,
        ]), $rows);
    }

    private function searchTags(string $q): array
    {
        $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $q) . '%';

        $rows = Tag::where('name', 'ILIKE', $like)
            ->withCount('documents')
            ->limit(5)
            ->get(['id', 'name', 'slug'])
            ->toArray();

        return array_map(fn ($row) => array_merge($row, [
            'type'           => 'tag',
            'rank'           => 0.6,
            'excerpt'        => null,
            'workspace_name' => null,
        ]), $rows);
    }
}
