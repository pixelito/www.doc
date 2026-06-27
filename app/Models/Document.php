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
use Illuminate\Database\Eloquent\SoftDeletes;

#[ObservedBy(DocumentObserver::class)]
#[Fillable(['title', 'slug', 'workspace_id', 'parent_id', 'position', 'content', 'content_html', 'metadata'])]
#[Hidden(['search_vector'])]
class Document extends Model
{
    /** @use HasFactory<\Database\Factories\DocumentFactory> */
    use HasFactory, HasSlug, SoftDeletes;

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

    /** Files attached to this page, in display order. Not part of version snapshots. */
    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class)->orderBy('position');
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
        $seen  = [$this->getKey() => true];
        $node  = $this;

        while ($node->parent_id !== null) {
            // Corrupt/cyclic data must not spin this loop forever.
            if (isset($seen[$node->parent_id])) {
                break;
            }
            $seen[$node->parent_id] = true;

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

    /**
     * Soft-delete this document and every live descendant. Cascading keeps the
     * tree consistent — a trashed parent must not leave its children orphaned
     * (visible in the DB but unreachable in the tree).
     */
    public function trashSubtree(): void
    {
        // This node is being trashed directly (a deliberate user action), so it
        // carries no cascade flag. Its live descendants are trashed *as a
        // consequence* and are flagged, so a later restore brings back only the
        // pages this cascade removed — not ones already trashed on their own.
        foreach ($this->children()->get() as $child) {
            $child->cascadeTrashSubtree();
        }

        $this->delete();
    }

    /**
     * Trash this node and its live descendants as part of an ancestor's cascade,
     * flagging each so {@see restoreSubtree()} can tell them apart from pages
     * that were individually trashed before the cascade ran.
     */
    protected function cascadeTrashSubtree(): void
    {
        foreach ($this->children()->get() as $child) {
            $child->cascadeTrashSubtree();
        }

        $this->flagCascadeTrashed();
        $this->delete();
    }

    /**
     * Persist the "trashed by a cascade" marker without shifting timestamps or
     * firing the observer — it's bookkeeping, not a content edit. Public so a
     * Workspace can flag its pages when it cascades them into the trash.
     */
    public function flagCascadeTrashed(): void
    {
        $this->metadata = array_merge($this->metadata ?? [], ['cascade_trashed' => true]);
        self::withoutTimestamps(fn () => $this->saveQuietly());
    }

    /** Whether this page was trashed as a dependent of an ancestor or its workspace. */
    public function wasCascadeTrashed(): bool
    {
        return (bool) ($this->metadata['cascade_trashed'] ?? false);
    }

    /** Drop the cascade marker after a restore so the metadata stays clean. */
    public function clearCascadeFlag(): void
    {
        if (! array_key_exists('cascade_trashed', $this->metadata ?? [])) {
            return;
        }

        $metadata = $this->metadata;
        unset($metadata['cascade_trashed']);
        $this->metadata = $metadata;
        self::withoutTimestamps(fn () => $this->saveQuietly());
    }

    /**
     * Move this document's whole subtree into a workspace. Descendants must
     * follow their ancestor across workspaces or the tree (built per-workspace)
     * would orphan them. Does not touch timestamps — it's a structural move.
     */
    public function moveSubtreeToWorkspace(int $workspaceId): void
    {
        foreach ($this->children()->get() as $child) {
            $child->workspace_id = $workspaceId;
            self::withoutTimestamps(fn () => $child->save());
            $child->moveSubtreeToWorkspace($workspaceId);
        }
    }

    /**
     * Restore this document and the subtree the same cascade trashed. A trashed
     * child is only brought back if it was flagged when *this* unit went to the
     * trash — a page deleted on its own beforehand stays trashed.
     */
    public function restoreSubtree(): void
    {
        $this->restore();
        $this->clearCascadeFlag();

        foreach ($this->children()->onlyTrashed()->get() as $child) {
            if ($child->wasCascadeTrashed()) {
                $child->restoreSubtree();
            }
        }
    }

    /** Permanently delete this document and every trashed descendant. */
    public function forceDeleteSubtree(): void
    {
        foreach ($this->children()->withTrashed()->get() as $child) {
            $child->forceDeleteSubtree();
        }

        // Attachment binaries are cleaned up by DocumentObserver::forceDeleting,
        // which covers this path AND a workspace purge (the FK cascade removes the
        // rows; the observer removes the files).
        $this->forceDelete();
    }
}
