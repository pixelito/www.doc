import { Head, router, usePage } from '@inertiajs/react';
import { IconChevronLeft, IconChevronRight, IconHistory, IconSettings } from '@tabler/icons-react';
import SettingsLayout from '@/Layouts/SettingsLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { avatarStyle, initials } from '@/lib/avatar';

// event namespace → badge tone. Everything content-ish is neutral; destructive
// actions read as danger, auth as info-muted. Colors from the styleguide status table.
const EVENT_TONES = {
    danger:  ['document.purged', 'workspace.purged', 'trash.emptied', 'user.deleted', 'backup.deleted', 'auth.login_failed'],
    warning: ['document.trashed', 'workspace.trashed', 'backup.restore_requested', 'backup.restored', 'user.role_changed'],
    good:    ['document.restored', 'workspace.restored', 'document.version_restored', 'backup.completed', 'user.created'],
};

function eventTone(event) {
    if (EVENT_TONES.danger.includes(event)) return 'bg-danger-surface text-danger';
    if (EVENT_TONES.warning.includes(event)) return 'bg-warning-surface text-warning-text';
    if (EVENT_TONES.good.includes(event)) return 'bg-sage-100 text-sage-600';
    return 'bg-surface-hover text-text-secondary';
}

// A compact, human line out of the context blob — titles and old→new values.
function contextLine(event, context) {
    if (!context) return null;
    if (context.from !== undefined && context.to !== undefined) {
        const fmt = (v) => (typeof v === 'object' && v !== null ? `ws ${v.workspace_id ?? '—'}` : String(v ?? '—'));
        return `${context.title ?? context.name ?? ''} · ${fmt(context.from)} → ${fmt(context.to)}`.trim();
    }
    return context.title ?? context.name ?? context.email ?? context.filename ?? context.path ?? null;
}

function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function FilterSelect({ value, onChange, children }) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="ui-select h-8 rounded-sm border border-border bg-surface px-2 text-sm text-foreground"
        >
            {children}
        </select>
    );
}

export default function Audit() {
    const { events, filters, users, workspaces, eventTypes } = usePage().props;

    function applyFilters(patch) {
        const next = { ...filters, ...patch };
        // Drop empty filters so the URL stays clean; changing filters resets paging.
        const params = Object.fromEntries(Object.entries(next).filter(([, v]) => v != null && v !== ''));
        router.get('/admin/audit', params, { preserveState: true, preserveScroll: true });
    }

    return (
        <SettingsLayout>
            <Head title="Audit — Admin" />

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold text-foreground">Audit trail</CardTitle>
                    <CardDescription>
                        Who changed, restored or deleted content — and when. Events are
                        append-only and pruned after the retention window.
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-0">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                        <FilterSelect value={filters.user} onChange={(v) => applyFilters({ user: v })}>
                            <option value="">All users</option>
                            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </FilterSelect>

                        <FilterSelect value={filters.event} onChange={(v) => applyFilters({ event: v })}>
                            <option value="">All events</option>
                            {eventTypes.map((ns) => <option key={ns} value={ns} className="capitalize">{ns}</option>)}
                        </FilterSelect>

                        <FilterSelect value={filters.workspace} onChange={(v) => applyFilters({ workspace: v })}>
                            <option value="">All workspaces</option>
                            {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </FilterSelect>

                        <div className="ml-auto flex items-center gap-2">
                            <input
                                type="date"
                                value={filters.from ?? ''}
                                onChange={(e) => applyFilters({ from: e.target.value || null })}
                                className="h-8 rounded-sm border border-border bg-surface px-2 text-sm text-foreground"
                            />
                            <span className="text-xs text-text-tertiary">to</span>
                            <input
                                type="date"
                                value={filters.to ?? ''}
                                onChange={(e) => applyFilters({ to: e.target.value || null })}
                                className="h-8 rounded-sm border border-border bg-surface px-2 text-sm text-foreground"
                            />
                        </div>
                    </div>

                    {/* Event rows */}
                    {events.data.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                            <IconHistory className="h-6 w-6 text-text-tertiary" stroke={1.5} />
                            <p className="text-sm text-text-secondary">No audit events match these filters.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {events.data.map((event) => (
                                <div key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <div
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${event.user ? '' : 'bg-surface-hover text-text-tertiary'}`}
                                        style={event.user ? avatarStyle(event.user.avatar_color) : undefined}
                                        title={event.user?.name ?? 'System'}
                                    >
                                        {event.user
                                            ? initials(event.user.name)
                                            : <IconSettings className="h-3.5 w-3.5" stroke={1.5} aria-hidden="true" />}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${eventTone(event.event)}`}>
                                                {event.event}
                                            </span>
                                            <span className="truncate text-sm text-foreground">
                                                {contextLine(event.event, event.context)}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-text-tertiary">
                                            {event.user?.name ?? 'System'} · {formatDate(event.created_at)}
                                            {event.ip ? ` · ${event.ip}` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pager */}
            {(events.prev_page_url || events.next_page_url) && (
                <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-text-tertiary">
                        {events.total} events · page {events.current_page} of {events.last_page}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={!events.prev_page_url}
                            onClick={() => router.get(events.prev_page_url, {}, { preserveState: true, preserveScroll: true })}
                            className="flex h-8 items-center gap-1 rounded-sm border border-border bg-surface px-2.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <IconChevronLeft className="h-4 w-4" stroke={1.5} /> Newer
                        </button>
                        <button
                            type="button"
                            disabled={!events.next_page_url}
                            onClick={() => router.get(events.next_page_url, {}, { preserveState: true, preserveScroll: true })}
                            className="flex h-8 items-center gap-1 rounded-sm border border-border bg-surface px-2.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Older <IconChevronRight className="h-4 w-4" stroke={1.5} />
                        </button>
                    </div>
                </div>
            )}
        </SettingsLayout>
    );
}
