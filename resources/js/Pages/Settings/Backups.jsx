import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    IconLoader2, IconDownload, IconTrash, IconRestore, IconCheck,
    IconAlertTriangle, IconClock, IconDatabaseExport, IconPlugConnected, IconMailFast, IconLock, IconInfoCircle
} from '@tabler/icons-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import SettingsLayout from '@/Layouts/SettingsLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useScrollLock } from '@/hooks/useScrollLock';
import { formatDateTime } from '@/lib/date';

const INTERVAL_LABELS = { daily: 'Every 24 hours', '2days': 'Every 2 days', weekly: 'Weekly' };
const DRIVER_LABELS = { local: 'Local disk (private)', smb: 'Network share (SMB)' };
const TRIGGER_LABELS = { manual: 'Manual', scheduled: 'Scheduled', 'pre-restore': 'Safety snapshot' };

function formatBytes(bytes) {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes, i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function StatusBadge({ status, encrypted }) {
    const map = {
        processing: { cls: 'bg-sage-50 text-sage-600',                         icon: IconLoader2,       label: 'Running', spin: true },
        pending:    { cls: 'bg-surface-hover text-text-secondary',             icon: IconClock,         label: 'Queued' },
        failed:     { cls: 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger', icon: IconAlertTriangle, label: 'Failed' },
    };
    // A done archive carries no badge of its own — the Download/Restore controls
    // already say it's ready — except the one fact those don't show: whether it's
    // encrypted (and so needs the key to restore).
    if (status === 'done') {
        if (!encrypted) return null;
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-sage-600">
                <IconLock className="h-3 w-3" stroke={1.5} />
                Encrypted
            </span>
        );
    }

    const s = map[status] ?? map.pending;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
            <Icon className={`h-3 w-3 ${s.spin ? 'animate-spin' : ''}`} stroke={1.5} />
            {s.label}
        </span>
    );
}

const selectCls =
    'ui-select mt-1 h-9 w-full rounded-sm border border-border bg-surface px-2 text-sm text-foreground disabled:cursor-not-allowed';

export default function Backups() {
    const { backups, settings, intervals, drivers } = usePage().props;
    const [confirm, setConfirm] = useState(null); // { type: 'restore'|'delete', backup }
    const [testing, setTesting] = useState(null);  // 'destination' | 'email' | null
    const [starting, setStarting] = useState(false); // manual "Back up now" in flight
    const [restoring, setRestoring] = useState(false); // restore POST in flight
    const restoringId = useRef(null);                  // which backup we kicked off a restore for

    const [showSnapshots, setShowSnapshots] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const filteredBackups = backups.filter((b) => showSnapshots || b.trigger !== 'pre-restore');
    const totalPages = Math.max(1, Math.ceil(filteredBackups.length / pageSize));
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);
    
    const paginatedBackups = filteredBackups.slice((page - 1) * pageSize, page * pageSize);
    const latestDoneBackup = backups.find((b) => b.status === 'done' && b.trigger !== 'pre-restore');

    const form = useForm({
        enabled:   settings.enabled ?? false,
        // String either way: a preset key ('daily') or a custom interval in hours ('72').
        interval:  String(settings.interval ?? 'daily'),
        retention:  settings.retention ?? 7,
        driver:     settings.driver ?? 'local',
        encryption: settings.encryption ?? false,
        smb: {
            host:     settings.smb?.host ?? '',
            share:    settings.smb?.share ?? '',
            path:     settings.smb?.path ?? '',
            username: settings.smb?.username ?? '',
            password: '', // never echoed back; blank = keep stored
            domain:   settings.smb?.domain ?? '',
        },
        mail: {
            enabled:      settings.mail?.enabled ?? false,
            to:           settings.mail?.to ?? '',
            host:         settings.mail?.host ?? '',
            port:         settings.mail?.port ?? 587,
            username:     settings.mail?.username ?? '',
            password:     '',
            encryption:   settings.mail?.encryption ?? 'tls',
            from_address: settings.mail?.from_address ?? '',
            from_name:    settings.mail?.from_name ?? '',
        },
    });

    // ── Frequency: presets + a custom value in hours/days ───────────────────
    // A custom interval is whatever isn't a preset key — stored as a number of
    // hours; the local amount/unit just drive the inputs.
    const isCustomInterval = !intervals.includes(form.data.interval);
    const initialHours = isCustomInterval ? Math.max(1, Number(form.data.interval) || 24) : 72;
    const [intervalUnit, setIntervalUnit] = useState(
        isCustomInterval && initialHours % 24 === 0 ? 'days' : 'hours'
    );
    const [intervalAmount, setIntervalAmount] = useState(
        String(isCustomInterval && initialHours % 24 === 0 ? initialHours / 24 : initialHours)
    );

    function pushCustomInterval(amount, unit) {
        const n = Math.floor(Number(amount));
        const hours = !n || n < 1 ? 0 : unit === 'days' ? n * 24 : n; // 0 → server rejects, error shows
        form.setData('interval', String(hours));
    }
    function changeFrequency(value) {
        if (value === 'custom') pushCustomInterval(intervalAmount, intervalUnit);
        else form.setData('interval', value);
    }

    // ── Retention: "never delete" maps to retention 0 (BackupService skips prune) ──
    const neverDelete = Number(form.data.retention) === 0;
    const lastRetention = useRef(Number(settings.retention) || 7);
    function toggleNeverDelete(on) {
        if (on) {
            lastRetention.current = Number(form.data.retention) || 7;
            form.setData('retention', 0);
        } else {
            form.setData('retention', lastRetention.current || 7);
        }
    }

    const smbPwSet  = settings.smb?.password_set;
    const mailPwSet = settings.mail?.password_set;
    const isSmb     = form.data.driver === 'smb';
    const mailOn    = form.data.mail.enabled;
    const keyReady  = settings.encryption_available;

    // A test can only succeed with the connection essentials present, so gate the
    // buttons on them (credentials stay optional — open shares / unauthenticated
    // relays are valid). Saved-but-blank password fields don't block a test.
    const filled    = (v) => String(v ?? '').trim() !== '';
    const smbReady  = filled(form.data.smb.host) && filled(form.data.smb.share);

    // SMTP auth is all-or-nothing. A password counts as present when typed OR
    // already saved (blank field = keep the stored one).
    const mailUser      = filled(form.data.mail.username);
    const mailPass      = filled(form.data.mail.password) || mailPwSet;
    const mailAuthPaired = mailUser === mailPass;
    const mailReady = ['to', 'host', 'from_address'].every((f) => filled(form.data.mail[f]))
        && filled(form.data.mail.port) && mailAuthPaired;

    const setNested = (group, field, value) =>
        form.setData(group, { ...form.data[group], [field]: value });

    // Poll while any backup is in flight so status updates without a manual refresh.
    const inFlight = backups.some((b) => b.status === 'pending' || b.status === 'processing');
    const backupRunning = starting || inFlight;
    const restoreInFlight = backups.some((b) => b.restore_status === 'restoring');
    const restoreRunning = restoring || restoreInFlight;
    useScrollLock(backupRunning || restoreRunning); // lock body scroll behind a progress modal
    // Heading reflects the real phase: queued (waiting for the worker) vs running.
    const phaseTitle = backups.some((b) => b.status === 'processing') ? 'Backing up…' : 'Backup queued';
    const timer = useRef(null);
    useEffect(() => {
        if (!inFlight && !restoreInFlight) return;
        timer.current = setInterval(() => router.reload({ only: ['backups'] }), 2500);
        return () => clearInterval(timer.current);
    }, [inFlight, restoreInFlight]);

    // Toast when a real run finishes (the progress modal closes on the same
    // edge). Keyed on inFlight — a server-confirmed run — so a POST that never
    // queues a backup can't fire a false "ready".
    const wasInFlight = useRef(inFlight);
    useEffect(() => {
        if (wasInFlight.current && !inFlight) {
            backups[0]?.status === 'failed'
                ? toast.error('Backup failed. See the archives list for details.')
                : toast.success('Backup ready.');
        }
        wasInFlight.current = inFlight;
    }, [inFlight]); // eslint-disable-line react-hooks/exhaustive-deps

    // Toast the restore outcome when the run we kicked off resolves (the restore
    // modal closes on the same edge). Keyed on the specific backup id.
    useEffect(() => {
        const id = restoringId.current;
        if (!id) return;
        const b = backups.find((x) => x.id === id);
        if (b?.restore_status === 'restored') {
            toast.success('Backup restored — your knowledge base has been rebuilt.');
            restoringId.current = null;
        } else if (b?.restore_status === 'failed') {
            toast.error(`Restore failed${b.restore_error ? ': ' + b.restore_error : '.'}`);
            restoringId.current = null;
        }
    }, [backups]); // eslint-disable-line react-hooks/exhaustive-deps

    // Warn before leaving (in-app nav or browser close) with unsaved settings.
    const dirtyRef = useRef(false);
    dirtyRef.current = form.isDirty;
    const { promptOpen, confirmDiscard, dismissPrompt } = useUnsavedChangesGuard({
        active: true,
        dirtyRef,
        revert: () => form.reset(),
    });

    // While a backup OR restore runs, keep the admin on the page (a reload mid-run
    // is confusing, and a restore is destructive). Same guard as edit mode — a
    // browser close warns natively, in-app nav asks to confirm.
    const opRunning = backupRunning || restoreRunning;
    const runningRef = useRef(false);
    runningRef.current = opRunning;
    const {
        promptOpen:     leaveOpen,
        confirmDiscard: confirmLeave,
        dismissPrompt:  dismissLeave,
    } = useUnsavedChangesGuard({ active: opRunning, dirtyRef: runningRef, revert: () => {} });

    function saveSettings(e) {
        e.preventDefault();
        form.patch('/admin/backups/settings', {
            preserveScroll: true,
            // Saved values become the new baseline, so the form is no longer dirty.
            onSuccess: () => form.setDefaults(),
        });
    }

    // Test connection / email use the values currently typed (incl. any password),
    // posting them straight through without saving. preserveState keeps the form.
    function testDestination() {
        setTesting('destination');
        router.post('/admin/backups/test-destination',
            { driver: form.data.driver, smb: form.data.smb },
            { preserveScroll: true, preserveState: true, onFinish: () => setTesting(null) },
        );
    }

    function testEmail() {
        setTesting('email');
        router.post('/admin/backups/test-email',
            { mail: form.data.mail },
            { preserveScroll: true, preserveState: true, onFinish: () => setTesting(null) },
        );
    }

    function backupNow() {
        setStarting(true);
        router.post('/admin/backups', {}, {
            preserveScroll: true,
            onFinish: () => setStarting(false),
        });
    }

    function restoreBackup(id) {
        restoringId.current = id;
        setRestoring(true);
        router.post(`/admin/backups/${id}/restore`, {}, {
            preserveScroll: true,
            onFinish: () => setRestoring(false),
        });
    }

    return (
        <SettingsLayout>
            <Head title="Backups" />

            {/* ── Schedule + destination + mail settings ─────────────────────── */}
            <form onSubmit={saveSettings} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold">Scheduled backups</CardTitle>
                        <CardDescription>
                            Back up the whole knowledge base on a cadence. Archives are written to a private
                            destination and can be restored from the canonical layer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2.5">
                        <Switch
                            checked={form.data.enabled}
                            onCheckedChange={(v) => form.setData('enabled', v)}
                        />
                        <button
                            type="button"
                            onClick={() => form.setData('enabled', !form.data.enabled)}
                            className="text-sm text-foreground"
                        >
                            Run backups automatically
                        </button>
                    </div>

                    {/* Schedule options are only meaningful when automatic backups
                        are on — disable them while the switch is off. */}
                    <div className={`space-y-4 ${form.data.enabled ? '' : 'opacity-60'}`}>
                        <div>
                            <Label htmlFor="interval">Frequency</Label>
                            <select
                                id="interval"
                                value={isCustomInterval ? 'custom' : form.data.interval}
                                onChange={(e) => changeFrequency(e.target.value)}
                                disabled={!form.data.enabled}
                                className={selectCls}
                            >
                                {intervals.map((i) => <option key={i} value={i}>{INTERVAL_LABELS[i] ?? i}</option>)}
                                <option value="custom">Custom…</option>
                            </select>
                            {isCustomInterval && (
                                <div className="mt-2 flex items-center gap-2.5">
                                    <span className="text-sm text-text-secondary">Every</span>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={intervalAmount}
                                        onChange={(e) => { setIntervalAmount(e.target.value); pushCustomInterval(e.target.value, intervalUnit); }}
                                        disabled={!form.data.enabled}
                                        className="w-20 disabled:opacity-100"
                                        aria-label="Custom interval amount"
                                    />
                                    <select
                                        value={intervalUnit}
                                        onChange={(e) => { setIntervalUnit(e.target.value); pushCustomInterval(intervalAmount, e.target.value); }}
                                        disabled={!form.data.enabled}
                                        className={`${selectCls} mt-0 w-28`}
                                        aria-label="Custom interval unit"
                                    >
                                        <option value="hours">hours</option>
                                        <option value="days">days</option>
                                    </select>
                                </div>
                            )}
                            {form.errors.interval && <p className="mt-1 text-xs text-danger">{form.errors.interval}</p>}
                        </div>
                        <div>
                            <Label htmlFor="retention">Keep last</Label>
                            <div className="mt-1 flex items-center gap-2.5">
                                <Input
                                    id="retention"
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={neverDelete ? '' : form.data.retention}
                                    onChange={(e) => form.setData('retention', e.target.value)}
                                    disabled={!form.data.enabled || neverDelete}
                                    className="w-24 disabled:opacity-100"
                                />
                                <span className="text-sm text-text-secondary">backups</span>
                            </div>
                            <label className="mt-3 flex items-center gap-2.5">
                                <Switch
                                    checked={neverDelete}
                                    onCheckedChange={toggleNeverDelete}
                                    disabled={!form.data.enabled}
                                />
                                <span className="text-sm text-foreground">Never delete — keep every backup</span>
                            </label>
                            {form.errors.retention && <p className="mt-1 text-xs text-danger">{form.errors.retention}</p>}
                        </div>
                    </div>
                    </CardContent>
                </Card>

                {/* ── Destination ───────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold">Destination</CardTitle>
                        <CardDescription>Archives are written to a private destination.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="driver">Destination</Label>
                        <select
                            id="driver"
                            value={form.data.driver}
                            onChange={(e) => form.setData('driver', e.target.value)}
                            className={selectCls}
                        >
                            {drivers.map((d) => <option key={d} value={d}>{DRIVER_LABELS[d] ?? d}</option>)}
                        </select>

                        {!isSmb && (
                            <p className="mt-2 text-xs text-text-tertiary">
                                The <span className="font-medium">local</span> destination survives restarts but not host
                                loss. Use a <span className="font-medium">network share</span> for off-host resilience (NIS2).
                            </p>
                        )}
                    </div>

                    {isSmb && (
                        <div className="space-y-4 rounded-md border border-border bg-surface-hover/40 p-4">
                            <p className="text-xs text-text-tertiary">
                                For <span className="font-mono">\\192.168.100.100\backup\docs</span> use host{' '}
                                <span className="font-mono">192.168.100.100</span>, share{' '}
                                <span className="font-mono">backup</span>, path <span className="font-mono">docs</span>.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="smb-host">Host / IP <span className="text-danger">*</span></Label>
                                    <Input id="smb-host" value={form.data.smb.host}
                                        onChange={(e) => setNested('smb', 'host', e.target.value)}
                                        placeholder="192.168.100.100" className="mt-1" />
                                    {form.errors['smb.host'] && <p className="mt-1 text-xs text-danger">{form.errors['smb.host']}</p>}
                                </div>
                                <div>
                                    <Label htmlFor="smb-share">Share <span className="text-danger">*</span></Label>
                                    <Input id="smb-share" value={form.data.smb.share}
                                        onChange={(e) => setNested('smb', 'share', e.target.value)}
                                        placeholder="backup" className="mt-1" />
                                    {form.errors['smb.share'] && <p className="mt-1 text-xs text-danger">{form.errors['smb.share']}</p>}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="smb-path">Folder within the share</Label>
                                <Input id="smb-path" value={form.data.smb.path}
                                    onChange={(e) => setNested('smb', 'path', e.target.value)}
                                    placeholder="docs" className="mt-1" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="smb-username">Username</Label>
                                    <Input id="smb-username" value={form.data.smb.username}
                                        onChange={(e) => setNested('smb', 'username', e.target.value)}
                                        autoComplete="off" className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="smb-password">Password</Label>
                                    <Input id="smb-password" type="password" value={form.data.smb.password}
                                        onChange={(e) => setNested('smb', 'password', e.target.value)}
                                        autoComplete="new-password"
                                        placeholder={smbPwSet ? '•••••••• (saved)' : ''} className="mt-1" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="smb-domain">Domain / workgroup</Label>
                                <Input id="smb-domain" value={form.data.smb.domain}
                                    onChange={(e) => setNested('smb', 'domain', e.target.value)}
                                    placeholder="WORKGROUP" className="mt-1" />
                            </div>
                            <div className="flex items-center gap-2.5">
                                <Button type="button" variant="outline" onClick={testDestination}
                                    disabled={testing === 'destination' || !smbReady}>
                                    {testing === 'destination'
                                        ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
                                        : <IconPlugConnected className="h-3.5 w-3.5" stroke={1.5} />}
                                    {testing === 'destination' ? 'Testing…' : 'Test connection'}
                                </Button>
                                {!smbReady && (
                                    <span className="text-xs text-text-tertiary">Enter a host and share to test.</span>
                                )}
                            </div>
                        </div>
                    )}
                    </CardContent>
                </Card>

                {/* ── Encryption at rest ────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold">Encryption at rest</CardTitle>
                        <CardDescription>Encrypt archives before they leave the app.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2.5">
                            <Switch
                                checked={form.data.encryption}
                                disabled={!keyReady}
                                onCheckedChange={(v) => form.setData('encryption', v)}
                            />
                            <button
                                type="button"
                                onClick={() => keyReady && form.setData('encryption', !form.data.encryption)}
                                disabled={!keyReady}
                                className="inline-flex items-center gap-1.5 text-sm text-foreground disabled:cursor-not-allowed"
                            >
                                <IconLock className="h-4 w-4 text-sage-600" stroke={1.5} />
                                Encrypt archives at rest
                            </button>
                        </div>
                        {form.errors.encryption && <p className="mt-1 text-xs text-danger">{form.errors.encryption}</p>}
                        <p className="mt-2 text-xs text-text-tertiary">
                            {keyReady ? (
                                <>
                                    Archives are encrypted with XChaCha20-Poly1305 before they leave the app. Keep{' '}
                                    <span className="font-mono">BACKUP_ENCRYPTION_KEY</span> somewhere safe and off this host —
                                    without it an encrypted backup cannot be restored or read.
                                </>
                            ) : (
                                <>
                                    Set <span className="font-mono">BACKUP_ENCRYPTION_KEY</span> in the environment to enable
                                    encryption (a base64 32-byte key).{' '}
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const bytes = new Uint8Array(32);
                                            crypto.getRandomValues(bytes);
                                            let binary = '';
                                            for (let i = 0; i < bytes.byteLength; i++) {
                                                binary += String.fromCharCode(bytes[i]);
                                            }
                                            const base64 = btoa(binary);
                                            navigator.clipboard.writeText(`BACKUP_ENCRYPTION_KEY=${base64}`);
                                            toast.success('Encryption key copied to clipboard');
                                        }}
                                        className="text-sage-600 font-medium hover:underline cursor-pointer"
                                    >
                                        Generate and copy key
                                    </button>.
                                </>
                            )}
                        </p>
                    </CardContent>
                </Card>

                {/* ── Email notifications ───────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold">Email notifications</CardTitle>
                        <CardDescription>Email a report after each backup.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2.5">
                            <Switch checked={mailOn} onCheckedChange={(v) => setNested('mail', 'enabled', v)} />
                            <button type="button" onClick={() => setNested('mail', 'enabled', !mailOn)}
                                className="text-sm text-foreground">
                                Email a report after each backup
                            </button>
                        </div>

                        {mailOn && (
                            <div className="mt-4 space-y-4 rounded-md border border-border bg-surface-hover/40 p-4">
                                <div>
                                    <Label htmlFor="mail-to">Send report to <span className="text-danger">*</span></Label>
                                    <Input id="mail-to" type="email" value={form.data.mail.to}
                                        onChange={(e) => setNested('mail', 'to', e.target.value)}
                                        placeholder="it-admin@company.com" className="mt-1" />
                                    {form.errors['mail.to'] && <p className="mt-1 text-xs text-danger">{form.errors['mail.to']}</p>}
                                </div>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="mail-host">SMTP host <span className="text-danger">*</span></Label>
                                        <Input id="mail-host" value={form.data.mail.host}
                                            onChange={(e) => setNested('mail', 'host', e.target.value)}
                                            placeholder="smtp.company.com" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label htmlFor="mail-port">Port <span className="text-danger">*</span></Label>
                                        <Input id="mail-port" type="number" min={1} max={65535} value={form.data.mail.port}
                                            onChange={(e) => setNested('mail', 'port', e.target.value)} className="mt-1" />
                                    </div>
                                </div>
                                <div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <Label htmlFor="mail-username">SMTP username</Label>
                                            <Input id="mail-username" value={form.data.mail.username}
                                                onChange={(e) => setNested('mail', 'username', e.target.value)}
                                                autoComplete="off" className="mt-1" />
                                            {form.errors['mail.username'] && <p className="mt-1 text-xs text-danger">{form.errors['mail.username']}</p>}
                                        </div>
                                        <div>
                                            <Label htmlFor="mail-password">SMTP password</Label>
                                            <Input id="mail-password" type="password" value={form.data.mail.password}
                                                onChange={(e) => setNested('mail', 'password', e.target.value)}
                                                autoComplete="new-password"
                                                placeholder={mailPwSet ? '•••••••• (saved)' : ''} className="mt-1" />
                                            {form.errors['mail.password'] && <p className="mt-1 text-xs text-danger">{form.errors['mail.password']}</p>}
                                        </div>
                                    </div>
                                    {!mailAuthPaired && (
                                        <p className="mt-2 text-xs text-text-tertiary">
                                            Enter both a username and password, or leave both blank for an unauthenticated relay.
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div>
                                        <Label htmlFor="mail-encryption">Encryption</Label>
                                        <select id="mail-encryption" value={form.data.mail.encryption}
                                            onChange={(e) => setNested('mail', 'encryption', e.target.value)}
                                            className={selectCls}>
                                            <option value="tls">TLS</option>
                                            <option value="ssl">SSL</option>
                                            <option value="none">None</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label htmlFor="mail-from">From address <span className="text-danger">*</span></Label>
                                        <Input id="mail-from" type="email" value={form.data.mail.from_address}
                                            onChange={(e) => setNested('mail', 'from_address', e.target.value)}
                                            placeholder="backups@company.com" className="mt-1" />
                                    </div>
                                    <div>
                                        <Label htmlFor="mail-from-name">From name</Label>
                                        <Input id="mail-from-name" value={form.data.mail.from_name}
                                            onChange={(e) => setNested('mail', 'from_name', e.target.value)} className="mt-1" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Button type="button" variant="outline" onClick={testEmail}
                                        disabled={testing === 'email' || !mailReady}>
                                        {testing === 'email'
                                            ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
                                            : <IconMailFast className="h-3.5 w-3.5" stroke={1.5} />}
                                        {testing === 'email' ? 'Sending…' : 'Send test email'}
                                    </Button>
                                    {!mailReady && (
                                        <span className="text-xs text-text-tertiary">
                                            Fill in the recipient, SMTP host, port and from address.
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" disabled={form.processing || !form.isDirty}>
                        {form.processing
                            ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
                            : form.recentlySuccessful
                            ? <IconCheck className="h-3.5 w-3.5" stroke={1.5} />
                            : null}
                        {form.processing ? 'Saving…' : form.recentlySuccessful ? 'Saved' : 'Save settings'}
                    </Button>
                </div>
            </form>

            {/* ── Backups list ───────────────────────────────────────────────── */}
            <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-semibold text-foreground">Archives</CardTitle>
                        <CardDescription>Run a backup now or restore from a previous one.</CardDescription>
                    </div>
                    {/* Static — the progress modal takes over the moment it's running. */}
                    <Button type="button" variant="outline" onClick={backupNow} disabled={backupRunning}>
                        <IconDatabaseExport className="h-3.5 w-3.5" stroke={1.5} />
                        Back up now
                    </Button>
                </CardHeader>

                <CardContent>
                    <div className="flex items-center justify-end pb-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                                <Label htmlFor="showSnapshots" className="mb-0 text-sm font-normal text-text-secondary cursor-pointer">
                                    Show safety snapshots
                                </Label>
                                <TooltipProvider>
                                    <Tooltip delayDuration={200}>
                                        <TooltipTrigger type="button" className="inline-flex items-center justify-center text-text-tertiary hover:text-text-secondary focus:outline-none cursor-help">
                                            <IconInfoCircle className="h-4 w-4" stroke={1.5} />
                                        </TooltipTrigger>
                                        <TooltipContent 
                                            side="top" 
                                            sideOffset={6} 
                                            className="bg-[#1F2520] text-[#F1F4EE] px-[11px] py-[8px] rounded-lg shadow-[0_8px_22px_rgba(31,37,32,0.22)] border-none max-w-[224px] text-[12px] leading-[1.5]"
                                        >
                                            Safety snapshots are lightweight, canonical-only backups taken automatically before any restore to protect your current data.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Switch 
                                id="showSnapshots" 
                                checked={showSnapshots} 
                                onCheckedChange={(v) => { setShowSnapshots(v); setPage(1); }} 
                                className="ml-1.5"
                            />
                        </div>
                    </div>

                    {filteredBackups.length === 0 ? (
                        <p className="mt-5 text-sm text-text-tertiary">No backups yet.</p>
                    ) : (
                        <div className="mt-4 divide-y divide-border">
                            {paginatedBackups.map((b) => (
                                <div key={b.id} className="flex items-center gap-3 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={b.status} encrypted={b.encrypted} />
                                            {latestDoneBackup?.id === b.id && (
                                                <span className="inline-flex items-center rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-sage-700">
                                                    Latest
                                                </span>
                                            )}
                                        <span className="text-sm font-medium text-foreground">
                                            {formatDateTime(b.created_at)}
                                        </span>
                                        <span className="text-xs text-text-tertiary">· {TRIGGER_LABELS[b.trigger] ?? b.trigger} · {b.disk?.toUpperCase()}</span>
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
                
                {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                        <span className="text-xs text-text-tertiary">
                            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredBackups.length)} of {filteredBackups.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                                Next
                            </Button>
                        </div>
                    </div>
                )}
                </CardContent>
            </Card>

            <ConfirmDialog
                open={confirm?.type === 'restore'}
                onCancel={() => setConfirm(null)}
                title="Restore from this backup?"
                message="This rebuilds the entire knowledge base from the backup's canonical data, replacing all current workspaces, pages, tags and versions. This cannot be undone."
                confirmLabel="Restore"
                variant="danger"
                onConfirm={() => {
                    restoreBackup(confirm.backup.id);
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
            <ConfirmDialog
                open={promptOpen}
                title="Discard changes?"
                message="You have unsaved backup settings. Leaving this page will discard them."
                confirmLabel="Discard changes"
                cancelLabel="Keep editing"
                variant="danger"
                onConfirm={confirmDiscard}
                onCancel={dismissPrompt}
            />

            {/* Blocking progress modal while a backup runs (auto-closes when done). */}
            {backupRunning && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-6"
                    style={{ background: 'rgba(31, 37, 32, 0.42)' }}
                >
                    <div className="w-full max-w-md overflow-hidden rounded-[14px] bg-surface"
                         style={{ boxShadow: '0 16px 40px rgba(31, 37, 32, 0.18)' }}>
                        <div className="flex flex-col items-center px-6 py-7 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-50">
                                <IconLoader2 className="h-5 w-5 animate-spin text-sage-600" stroke={1.5} />
                            </span>
                            <h2 className="mt-4 text-[15px] font-medium text-foreground">{phaseTitle}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                                Your knowledge base is being archived to the configured destination.
                                Please keep this page open — don’t refresh or navigate away until it finishes.
                            </p>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {/* Blocking progress modal while a restore runs (auto-closes when done). */}
            {restoreRunning && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-6"
                    style={{ background: 'rgba(31, 37, 32, 0.42)' }}
                >
                    <div className="w-full max-w-md overflow-hidden rounded-[14px] bg-surface"
                         style={{ boxShadow: '0 16px 40px rgba(31, 37, 32, 0.18)' }}>
                        <div className="flex flex-col items-center px-6 py-7 text-center">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-50">
                                <IconLoader2 className="h-5 w-5 animate-spin text-sage-600" stroke={1.5} />
                            </span>
                            <h2 className="mt-4 text-[15px] font-medium text-foreground">Restoring backup…</h2>
                            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                                Your knowledge base is being rebuilt from this backup (a safety snapshot of
                                the current state is taken first). Please keep this page open — don’t refresh
                                or navigate away until it finishes.
                            </p>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            <ConfirmDialog
                open={leaveOpen}
                title={restoreRunning ? 'Leave during a restore?' : 'Leave during a backup?'}
                message={
                    restoreRunning
                        ? 'A restore is still running. It continues in the background, but you’ll stop seeing its progress here. Leave anyway?'
                        : 'A backup is still running. It continues in the background, but you’ll stop seeing its progress here. Leave anyway?'
                }
                confirmLabel="Leave page"
                cancelLabel="Stay"
                variant="danger"
                onConfirm={confirmLeave}
                onCancel={dismissLeave}
            />
        </SettingsLayout>
    );
}
