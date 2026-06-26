<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Archive format version
    |--------------------------------------------------------------------------
    | Written into each backup's manifest. Bump when the canonical layout
    | changes so a future RestoreService can branch on it.
    */
    'format_version' => 1,

    /*
    |--------------------------------------------------------------------------
    | Scheduled cadences
    |--------------------------------------------------------------------------
    | The admin picks one of these in the Backups tab; `backup:run` (scheduled
    | hourly) dispatches a run once this many hours have elapsed since the last
    | successful scheduled backup.
    */
    'intervals' => [
        'daily'  => 24,
        '2days'  => 48,
        'weekly' => 168,
    ],

    /*
    |--------------------------------------------------------------------------
    | Defaults (until an admin saves settings)
    |--------------------------------------------------------------------------
    */
    'defaults' => [
        'enabled'   => false,
        'interval'  => 'daily',
        'disk'      => 'local',
        'retention' => 7, // keep this many most-recent backups, prune older
    ],

    /*
    |--------------------------------------------------------------------------
    | Destination drivers
    |--------------------------------------------------------------------------
    | Where a backup may be written. `local` is the private disk — survives
    | container restarts (when app-storage is mounted) but NOT host loss. `smb`
    | writes to a Windows/SMB network share (e.g. \\192.168.100.100\backup\docs),
    | the off-host resilience milestone. Never `public`.
    */
    'drivers' => ['local', 'smb'],

    /*
    |--------------------------------------------------------------------------
    | Archive encryption (off-host hardening goal — not wired yet)
    |--------------------------------------------------------------------------
    | A base64-encoded 32-byte key. When present, a future BackupService should
    | encrypt the archive at rest. Left unimplemented in this scaffold.
    */
    'encryption_key' => env('BACKUP_ENCRYPTION_KEY'),

];
