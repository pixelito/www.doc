<?php

namespace App\Models;

use App\Models\Concerns\HasSlug;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'slug', 'description', 'position'])]
class Workspace extends Model
{
    /** @use HasFactory<\Database\Factories\WorkspaceFactory> */
    use HasFactory, HasSlug, SoftDeletes;

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    /** Top-level documents (no parent), in display order. */
    public function rootDocuments(): HasMany
    {
        return $this->hasMany(Document::class)
            ->whereNull('parent_id')
            ->orderBy('position');
    }

    /**
     * Soft-delete this workspace and every live document inside it. The whole
     * forest goes to trash together so nothing is left live-but-orphaned (which
     * would otherwise leak into search and dangling breadcrumbs).
     */
    public function trashWithDocuments(): void
    {
        $this->documents()->get()->each->delete();

        $this->delete();
    }

    /** Restore this workspace and every document that was trashed inside it. */
    public function restoreWithDocuments(): void
    {
        $this->restore();

        $this->documents()->onlyTrashed()->get()->each->restore();
    }

    /** Permanently delete this workspace and all its documents (live or trashed). */
    public function forceDeleteWithDocuments(): void
    {
        $this->documents()->withTrashed()->get()->each->forceDelete();

        $this->forceDelete();
    }
}
