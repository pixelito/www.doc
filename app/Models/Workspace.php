<?php

namespace App\Models;

use App\Models\Concerns\HasSlug;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'description', 'position'])]
class Workspace extends Model
{
    /** @use HasFactory<\Database\Factories\WorkspaceFactory> */
    use HasFactory, HasSlug;

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
}
