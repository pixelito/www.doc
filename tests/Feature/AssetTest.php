<?php

use App\Models\Asset;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

// 1×1 transparent PNG — no GD required.
function fakePng(string $name = 'photo.png'): UploadedFile
{
    $bytes = base64_decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );
    $tmp = tempnam(sys_get_temp_dir(), 'png_');
    file_put_contents($tmp, $bytes);

    return new UploadedFile($tmp, $name, 'image/png', null, true);
}

beforeEach(function () {
    Storage::fake('public');
});

it('authenticated user can upload an image', function () {
    $user = login();
    $file = fakePng();

    $response = $this->actingAs($user)
        ->postJson('/assets', ['file' => $file]);

    $response->assertStatus(201)
        ->assertJsonStructure(['id', 'url']);

    expect(Asset::count())->toBe(1);
    $asset = Asset::first();
    expect($asset->mime)->toBe('image/png')
        ->and($asset->disk)->toBe('public')
        ->and($asset->checksum)->not->toBeNull();

    Storage::disk('public')->assertExists($asset->path);
});

it('deduplicates uploads by sha-256 checksum', function () {
    $user = login();

    $r1 = $this->actingAs($user)->postJson('/assets', ['file' => fakePng()]);
    $r2 = $this->actingAs($user)->postJson('/assets', ['file' => fakePng()]);

    $r1->assertStatus(201);
    $r2->assertStatus(200);

    expect(Asset::count())->toBe(1)
        ->and($r1->json('id'))->toBe($r2->json('id'));
});

it('rejects non-image uploads', function () {
    $user = login();
    $file = UploadedFile::fake()->create('malware.exe', 10, 'application/octet-stream');

    $this->actingAs($user)
        ->postJson('/assets', ['file' => $file])
        ->assertStatus(422);

    expect(Asset::count())->toBe(0);
});

it('rejects files over 10 MB', function () {
    $user = login();
    $file = UploadedFile::fake()->create('huge.jpg', 11_001, 'image/jpeg'); // 11 MB in KB

    $this->actingAs($user)
        ->postJson('/assets', ['file' => $file])
        ->assertStatus(422);
});

it('guests cannot upload assets', function () {
    $this->postJson('/assets', ['file' => fakePng()])
        ->assertStatus(401);
});
