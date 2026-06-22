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
            'parent_id' => [
                'nullable', 
                'integer', 
                \Illuminate\Validation\Rule::exists('documents', 'id')->where('workspace_id', $this->input('workspace_id'))
            ],
            'position' => ['nullable', 'integer'],
            'content' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['integer', 'exists:tags,id'],
        ];
    }
}
