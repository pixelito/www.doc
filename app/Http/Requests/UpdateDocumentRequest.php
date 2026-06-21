<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDocumentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            // Re-parenting is NOT accepted here — it goes through the move
            // endpoint, the only path with the cycle guard. Allowing parent_id
            // on a plain update would let a client form an A↔B parent cycle.
            'position' => ['nullable', 'integer'],
            'content' => ['sometimes', 'array'],
            'metadata' => ['sometimes', 'array'],
            'tags' => ['sometimes', 'array'],
            'tags.*' => ['integer', 'exists:tags,id'],
        ];
    }
}
