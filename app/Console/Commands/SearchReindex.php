<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('search:reindex')]
#[Description('Rebuild the search_vector tsvector for all documents')]
class SearchReindex extends Command
{
    public function handle(): int
    {
        $count = DB::affectingStatement("
            UPDATE documents
            SET search_vector =
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english',
                    regexp_replace(coalesce(content_html, ''), '<[^>]+>', ' ', 'g')
                ), 'B')
        ");

        $this->info("Reindexed {$count} document(s).");

        return self::SUCCESS;
    }
}
