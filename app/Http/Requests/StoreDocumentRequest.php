<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDocumentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'workspace_id' => ['required', 'integer', 'exists:workspaces,id'],
            'parent_id' => ['nullable', 'integer', 'exists:documents,id'],
            'position' => ['nullable', 'integer'],
            'content' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
