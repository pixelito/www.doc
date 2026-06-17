<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDocumentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:documents,id'],
            'position' => ['nullable', 'integer'],
            'content' => ['sometimes', 'array'],
            'metadata' => ['sometimes', 'array'],
        ];
    }
}
