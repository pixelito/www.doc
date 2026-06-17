<?php

namespace App\Models;

use App\Models\Concerns\HasSlug;
use App\Observers\DocumentObserver;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

#[ObservedBy(DocumentObserver::class)]
#[Fillable(['title', 'slug', 'workspace_id', 'parent_id', 'position', 'content', 'content_html', 'metadata'])]
#[Hidden(['search_vector'])]
class Document extends Model
{
    /** @use HasFactory<\Database\Factories\DocumentFactory> */
    use HasFactory, HasSlug;

    protected function casts(): array
    {
        return [
            'content' => 'array',
            'metadata' => 'array',
        ];
    }

    protected function slugScope(): array
    {
        return ['workspace_id' => $this->workspace_id];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Document::class, 'parent_id')->orderBy('position');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class)->latest();
    }

    public function tags(): MorphToMany
    {
        return $this->morphToMany(Tag::class, 'taggable');
    }

    /** Links this document points at. */
    public function outgoingLinks(): HasMany
    {
        return $this->hasMany(Link::class, 'source_document_id');
    }

    /** Links pointing at this document (backlinks). */
    public function backlinks(): HasMany
    {
        return $this->hasMany(Link::class, 'target_document_id');
    }

    /**
     * Walk up the parent chain and return ancestors ordered root → immediate parent.
     * The tree is shallow so the number of queries is bounded and acceptable.
     *
     * @return list<array{id: int, title: string, slug: string}>
     */
    public function ancestors(): array
    {
        $chain = [];
        $node  = $this;

        while ($node->parent_id !== null) {
            $node = self::select(['id', 'title', 'slug', 'parent_id'])
                ->find($node->parent_id);

            if (! $node) {
                break;
            }

            array_unshift($chain, [
                'id'    => $node->id,
                'title' => $node->title,
                'slug'  => $node->slug,
            ]);
        }

        return $chain;
    }
}
