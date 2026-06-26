import { useState, useEffect, useRef } from 'react';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import {
    IconLoader2, IconDownload, IconTrash, IconRestore, IconCheck,
    IconAlertTriangle, IconClock, IconDatabaseExport,
} from '@tabler/icons-react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const INTERVAL_LABELS = { daily: 'Every 24 hours', '2days': 'Every 2 days', weekly: 'Weekly' };

function formatBytes(bytes) {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function StatusBadge({ status }) {
    const map = {
        done:       { cls: 'bg-sage-100 text-sage-600',                        icon: IconCheck,         label: 'Ready' },
        processing: { cls: 'bg-sage-50 text-sage-600',                         icon: IconLoader2,       label: 'Running', spin: true },
        pending:    { cls: 'bg-surface-hover text-text-secondary',             icon: IconClock,         label: 'Queued' },
        failed:     { cls: 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger', icon: IconAlertTriangle, label: 'Failed' },
    };
    const s = map[status] ?? map.pending;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
            <Icon className={`h-3 w-3 ${s.spin ? 'animate-spin' : ''}`} stroke={1.5} />
            {s.label}
        </span>
    );
}

export default function Backups() {
    const { backups, settings, intervals, disks } = usePage().props;
    const [confirm, setConfirm] = useState(null); // { type: 'restore'|'delete', backup }

    const form = useForm({
        enabled:   settings.enabled ?? false,
        interval:  settings.interval ?? 'daily',
        disk:      settings.disk ?? 'local',
        retention: settings.retention ?? 7,
    });

    // Poll while any backup is in flight so status updates without a manual refresh.
    const inFlight = backups.some((b) => b.status === 'pending' || b.status === 'processing');
    const timer = useRef(null);
    useEffect(() => {
        if (!inFlight) return;
        timer.current = setInterval(() => router.reload({ only: ['backups'] }), 2500);
        return () => clearInterval(timer.current);
    }, [inFlight]);

    function saveSettings(e) {
        e.preventDefault();
        form.transform((d) => ({ ...d, enabled: !!d.enabled })).patch('/admin/backups/settings', { preserveScroll: true });
    }

    function backupNow() {
        router.post('/admin/backups', {}, { preserveScroll: true });
    }

    return (
        <SettingsLayout>
            <Head title="Backups" />

            {/* ── Schedule settings ──────────────────────────────────────────── */}
            <section className="rounded-lg border border-border bg-surface p-5">
                <h2 className="text-sm font-semibold text-foreground">Scheduled backups</h2>
                <p className="mt-1 text-sm text-text-secondary">
                    Back up the whole knowledge base on a cadence. Archives are written to a private
                    destination and can be restored from the canonical layer.
                </p>

                <form onSubmit={saveSettings} className="mt-4 space-y-4">
                    <label className="flex items-center gap-2.5">
                        <input
                            type="checkbox"
                            checked={form.data.enabled}
                            onChange={(e) => form.setData('enabled', e.target.checked)}
                            className="h-4 w-4 rounded border-border text-sage-400 focus:ring-sage-200"
                        />
                        <span className="text-sm text-foreground">Run backups automatically</span>
                    </label>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="interval">Frequency</Label>
                            <select
                                id="interval"
                                value={form.data.interval}
                                onChange={(e) => form.setData('interval', e.target.value)}
                                className="ui-select mt-1 h-9 w-full rounded-sm border border-border bg-surface px-2 text-sm text-foreground"
                            >
                                {intervals.map((i) => <option key={i} value={i}>{INTERVAL_LABELS[i] ?? i}</option>)}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="disk">Destination</Label>
                            <select
                                id="disk"
                                value={form.data.disk}
                                onChange={(e) => form.setData('disk', e.target.value)}
                                className="ui-select mt-1 h-9 w-full rounded-sm border border-border bg-surface px-2 text-sm uppercase text-foreground"
                            >
                                {disks.map((d) => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="retention">Keep last</Label>
                            <Input
                                id="retention"
                                type="number"
                                min={1}
                                max={365}
                                value={form.data.retention}
                                onChange={(e) => form.setData('retention', e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {form.data.disk === 'local' && (
                        <p className="text-xs text-text-tertiary">
                            The <span className="font-medium">local</span> destination survives restarts but not host loss.
                            Use <span className="font-medium uppercase">s3</span> for off-host resilience (NIS2).
                        </p>
                    )}

                    <Button type="submit" disabled={form.processing}>
                        {form.processing
                            ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
                            : form.recentlySuccessful
                            ? <IconCheck className="h-3.5 w-3.5" stroke={1.5} />
                            : null}
                        {form.processing ? 'Saving…' : form.recentlySuccessful ? 'Saved' : 'Save settings'}
                    </Button>
                </form>
            </section>

            {/* ── Backups list ───────────────────────────────────────────────── */}
            <section className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Archives</h2>
                        <p className="mt-1 text-sm text-text-secondary">Run a backup now or restore from a previous one.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={backupNow}>
                        <IconDatabaseExport className="h-3.5 w-3.5" stroke={1.5} />
                        Back up now
                    </Button>
                </div>

                {backups.length === 0 ? (
                    <p className="mt-5 text-sm text-text-tertiary">No backups yet.</p>
                ) : (
                    <div className="mt-4 divide-y divide-border">
                        {backups.map((b) => (
                            <div key={b.id} className="flex items-center gap-3 py-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={b.status} />
                                        <span className="text-sm font-medium text-foreground">
                                            {new Date(b.created_at).toLocaleString()}
                                        </span>
                                        <span className="text-xs capitalize text-text-tertiary">· {b.trigger} · {b.disk?.toUpperCase()}</span>
                                    </div>
                                    <div className="mt-0.5 text-xs text-text-tertiary">
                                        {formatBytes(b.size_bytes)}
                                        {b.counts && ` · ${b.counts.documents} docs, ${b.counts.assets} assets`}
                                        {b.created_by && ` · by ${b.created_by}`}
                                        {b.status === 'failed' && b.error && <span className="text-danger"> · {b.error}</span>}
                                    </div>
                                </div>

                                {b.status === 'done' && (
                                    <div className="flex items-center gap-1">
                                        <a
                                            href={`/admin/backups/${b.id}/download`}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-foreground"
                                            title="Download"
                                        >
                                            <IconDownload className="h-4 w-4" stroke={1.5} />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => setConfirm({ type: 'restore', backup: b })}
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-foreground"
                                            title="Restore"
                                        >
                                            <IconRestore className="h-4 w-4" stroke={1.5} />
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setConfirm({ type: 'delete', backup: b })}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-danger"
                                    title="Delete"
                                >
                                    <IconTrash className="h-4 w-4" stroke={1.5} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <ConfirmDialog
                open={confirm?.type === 'restore'}
                onCancel={() => setConfirm(null)}
                title="Restore from this backup?"
                message="This rebuilds the entire knowledge base from the backup's canonical data, replacing all current workspaces, pages, tags and versions. This cannot be undone."
                confirmLabel="Restore"
                variant="danger"
                onConfirm={() => {
                    router.post(`/admin/backups/${confirm.backup.id}/restore`, {}, { preserveScroll: true });
                    setConfirm(null);
                }}
            />
            <ConfirmDialog
                open={confirm?.type === 'delete'}
                onCancel={() => setConfirm(null)}
                title="Delete this backup?"
                message="The archive file will be permanently removed."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={() => {
                    router.delete(`/admin/backups/${confirm.backup.id}`, { preserveScroll: true });
                    setConfirm(null);
                }}
            />
        </SettingsLayout>
    );
}
