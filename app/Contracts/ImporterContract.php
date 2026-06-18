<?php

namespace App\Contracts;

interface ImporterContract
{
    /**
     * Import a file and return a TipTap document array plus detected title.
     *
     * @return array{title: string, content: array}
     */
    public function import(string $filePath): array;
}
