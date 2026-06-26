<?php

namespace App\Services\Backup\Destinations;

use Icewind\SMB\BasicAuth;
use Icewind\SMB\Exception\AccessDeniedException;
use Icewind\SMB\Exception\AlreadyExistsException;
use Icewind\SMB\Exception\AuthenticationException;
use Icewind\SMB\Exception\ConnectException;
use Icewind\SMB\Exception\DependencyException;
use Icewind\SMB\Exception\ForbiddenException;
use Icewind\SMB\Exception\HostDownException;
use Icewind\SMB\Exception\InvalidHostException;
use Icewind\SMB\Exception\NoRouteToHostException;
use Icewind\SMB\Exception\NotFoundException;
use Icewind\SMB\Exception\TimedOutException;
use Icewind\SMB\IShare;
use Icewind\SMB\ServerFactory;

/**
 * Writes backups to an SMB/Windows network share (e.g. \\192.168.100.100\backup\docs
 * → host=192.168.100.100, share=backup, path=docs). Uses icewind/smb, which needs
 * the `smbclient` binary (or libsmbclient ext) present in the container image.
 *
 * @param array{host:string,share:string,path:string,username:string,password:string,domain:string} cfg
 */
class SmbDestination implements Destination
{
    public function __construct(private readonly array $cfg) {}

    public function store(string $localZipPath, string $name): array
    {
        $share = $this->share();
        $this->ensureDir($share);
        $remote = $this->remotePath($name);
        $share->put($localZipPath, $remote);

        return ['path' => $remote, 'size' => (int) filesize($localZipPath)];
    }

    public function fetch(string $path): string
    {
        $tmp = sys_get_temp_dir() . '/' . uniqid('wwwdoc_fetch_') . '.zip';
        $this->share()->get($path, $tmp);

        return $tmp;
    }

    public function delete(string $path): void
    {
        try {
            $this->share()->del($path);
        } catch (\Throwable) {
            // best-effort (retention pruning) — a missing/locked file must not throw
        }
    }

    public function test(): void
    {
        $local = sys_get_temp_dir() . '/' . uniqid('wwwdoc_probe_');
        file_put_contents($local, 'ok');

        try {
            $share = $this->share();
            $this->ensureDir($share);
            $probe = $this->remotePath('.probe-' . uniqid() . '.txt');
            $share->put($local, $probe);
            $share->stat($probe);   // confirm it landed
            $share->del($probe);
        } catch (\Throwable $e) {
            throw new \RuntimeException($this->friendly($e));
        } finally {
            @unlink($local);
        }
    }

    // ── internals ──────────────────────────────────────────────────────────────

    private function share(): IShare
    {
        $auth   = new BasicAuth($this->cfg['username'], $this->cfg['domain'] ?: 'WORKGROUP', $this->cfg['password']);
        $server = (new ServerFactory())->createServer($this->cfg['host'], $auth);

        return $server->getShare($this->cfg['share']);
    }

    /** The sub-path within the share, normalised to forward slashes. */
    private function dir(): string
    {
        return trim(str_replace('\\', '/', $this->cfg['path']), '/');
    }

    private function remotePath(string $name): string
    {
        $dir = $this->dir();

        return $dir === '' ? $name : "{$dir}/{$name}";
    }

    /** mkdir -p the configured sub-path, tolerating segments that already exist. */
    private function ensureDir(IShare $share): void
    {
        $dir = $this->dir();
        if ($dir === '') {
            return;
        }

        $accum = '';
        foreach (explode('/', $dir) as $segment) {
            $accum = $accum === '' ? $segment : "{$accum}/{$segment}";
            try {
                $share->mkdir($accum);
            } catch (AlreadyExistsException) {
                // fine — directory is already there
            } catch (\Throwable $e) {
                // some servers throw a generic error for existing dirs; only
                // rethrow if the path genuinely isn't there.
                try {
                    $share->stat($accum);
                } catch (\Throwable) {
                    throw $e;
                }
            }
        }
    }

    private function friendly(\Throwable $e): string
    {
        return match (true) {
            $e instanceof DependencyException   => 'The server is missing the smbclient client needed to reach SMB shares. Install `smbclient` in the app image.',
            $e instanceof AuthenticationException => 'Authentication failed — check the username, password and domain.',
            $e instanceof ForbiddenException,
            $e instanceof AccessDeniedException => 'Connected, but the account cannot write to that path.',
            $e instanceof NotFoundException     => 'The share or path was not found on the host.',
            $e instanceof InvalidHostException,
            $e instanceof NoRouteToHostException,
            $e instanceof HostDownException,
            $e instanceof TimedOutException,
            $e instanceof ConnectException     => 'Could not reach the host — check the address and that the share is online.',
            default                            => 'SMB error: ' . $e->getMessage(),
        };
    }
}
