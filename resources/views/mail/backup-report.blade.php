@extends('mail.layout')

@section('content')
    @php
        $count = fn ($k) => $backup?->manifest['counts'][$k] ?? null;
        $bytes = function ($b) {
            if (! $b) return '—';
            $u = ['B', 'KB', 'MB', 'GB']; $i = 0;
            while ($b >= 1024 && $i < count($u) - 1) { $b /= 1024; $i++; }
            return round($b, $i ? 1 : 0) . ' ' . $u[$i];
        };
    @endphp

    @if ($isTest)
        <h1 style="margin:0 0 12px;font-size:18px;color:#2C2C2C;">Backup email test</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#5A5A5A;">
            This is a test message confirming your backup notification settings are working.
            Scheduled and manual backups will email this address from now on.
        </p>
    @elseif ($backup && $backup->status === 'done')
        <h1 style="margin:0 0 12px;font-size:18px;color:#2C2C2C;">Backup completed successfully</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5A5A5A;">
            A new backup of your knowledge base finished without errors.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:#5A5A5A;">
            <tr><td style="padding:2px 16px 2px 0;color:#8E938E;">Finished</td><td>{{ optional($backup->finished_at)->toDayDateTimeString() }}</td></tr>
            <tr><td style="padding:2px 16px 2px 0;color:#8E938E;">Size</td><td>{{ $bytes($backup->size_bytes) }}</td></tr>
            @if ($count('documents') !== null)
                <tr><td style="padding:2px 16px 2px 0;color:#8E938E;">Documents</td><td>{{ $count('documents') }}</td></tr>
            @endif
            @if ($count('assets') !== null)
                <tr><td style="padding:2px 16px 2px 0;color:#8E938E;">Assets</td><td>{{ $count('assets') }}</td></tr>
            @endif
            <tr><td style="padding:2px 16px 2px 0;color:#8E938E;">Destination</td><td style="text-transform:uppercase;">{{ $backup->disk }}</td></tr>
        </table>
    @else
        <h1 style="margin:0 0 12px;font-size:18px;color:#2C2C2C;">Backup failed</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#5A5A5A;">
            The most recent backup did not complete. Please check the Backups settings and try again.
        </p>
        @if ($backup?->error)
            <p style="margin:0;padding:12px 14px;background:#FBEEEA;border:1px solid #E8C9BF;border-radius:6px;font-size:13px;color:#B5573E;">
                {{ $backup->error }}
            </p>
        @endif
    @endif
@endsection

@section('footer', 'automated backup notification')
