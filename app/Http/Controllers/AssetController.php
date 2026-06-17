<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class AssetController extends Controller
{
    private const DISK = 'public';

    private const ALLOWED_MIMES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    ];

    private const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

    /** Upload a file. Returns {id, url}. Dedupes by SHA-256 checksum. */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Asset::class);

        $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:jpeg,jpg,png,gif,webp,svg'],
        ]);

        $file = $request->file('file');
        $content = file_get_contents($file->getRealPath());
        $checksum = hash('sha256', $content);

        $existing = Asset::where('checksum', $checksum)->first();
        if ($existing) {
            return response()->json([
                'id'  => $existing->id,
                'url' => Storage::disk(self::DISK)->url($existing->path),
            ]);
        }

        $ext  = $file->guessExtension() ?? 'bin';
        $path = "assets/{$checksum}.{$ext}";

        Storage::disk(self::DISK)->put($path, $content);

        $asset = Asset::create([
            'path'           => $path,
            'disk'           => self::DISK,
            'mime'           => $file->getMimeType(),
            'size'           => strlen($content),
            'checksum'       => $checksum,
            'uploaded_by_id' => Auth::id(),
        ]);

        return response()->json([
            'id'  => $asset->id,
            'url' => Storage::disk(self::DISK)->url($path),
        ], 201);
    }

    /**
     * Download an external image URL and re-host it as an Asset.
     * Used by the editor paste pipeline for external <img src> rehosting.
     */
    public function rehost(Request $request): JsonResponse
    {
        $this->authorize('create', Asset::class);

        $url = $request->validate([
            'url' => ['required', 'url', 'max:2048'],
        ])['url'];

        $response = Http::timeout(10)->get($url);

        abort_unless($response->successful(), 422, 'Failed to download image.');

        $mime = strtolower(explode(';', $response->header('Content-Type') ?? '')[0]);
        abort_unless(in_array($mime, self::ALLOWED_MIMES), 422, 'URL does not point to a supported image.');

        $content = $response->body();
        abort_if(strlen($content) > self::MAX_BYTES, 422, 'Image exceeds 10 MB limit.');

        $checksum = hash('sha256', $content);

        $existing = Asset::where('checksum', $checksum)->first();
        if ($existing) {
            return response()->json([
                'id'  => $existing->id,
                'url' => Storage::disk(self::DISK)->url($existing->path),
            ]);
        }

        $ext = match ($mime) {
            'image/jpeg'   => 'jpg',
            'image/png'    => 'png',
            'image/gif'    => 'gif',
            'image/webp'   => 'webp',
            'image/svg+xml' => 'svg',
            default        => 'bin',
        };

        $path = "assets/{$checksum}.{$ext}";
        Storage::disk(self::DISK)->put($path, $content);

        $asset = Asset::create([
            'path'           => $path,
            'disk'           => self::DISK,
            'mime'           => $mime,
            'size'           => strlen($content),
            'checksum'       => $checksum,
            'uploaded_by_id' => Auth::id(),
        ]);

        return response()->json([
            'id'  => $asset->id,
            'url' => Storage::disk(self::DISK)->url($path),
        ], 201);
    }
}
