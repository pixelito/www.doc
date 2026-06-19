import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { IconTrash, IconRestore, IconFileText, IconTrashX } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

function timeAgo(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TrashIndex({ documents = [] }) {
    const [purgeTarget, setPurgeTarget] = useState(null); // document being permanently deleted
    const [busyId, setBusyId]           = useState(null);

    function restore(doc) {
        setBusyId(doc.id);
        router.post(`/trash/${doc.id}/restore`, {}, {
            preserveScroll: true,
            onFinish: () => setBusyId(null),
        });
    }

    function confirmPurge() {
        const doc = purgeTarget;
        setBusyId(doc.id);
        router.delete(`/trash/${doc.id}`, {
            preserveScroll: true,
            onFinish: () => { setBusyId(null); setPurgeTarget(null); },
        });
    }

    return (
        <DocsLayout>
            <Head title="Trash" />

            <div className="mb-4 flex items-center gap-2">
                <IconTrash className="h-5 w-5 text-sage-500" stroke={1.5} />
                <h1 className="text-[19px] font-semibold text-foreground">Trash</h1>
                {documents.length > 0 && (
                    <span className="ml-1 text-sm text-text-tertiary">({documents.length})</span>
                )}
            </div>
            <p className="mb-4 text-sm text-text-secondary">
                Deleted pages are kept here. Restoring a page also restores its subpages.
            </p>

            <div className="overflow-hidden rounded-md border border-border bg-card">
                <div className="grid grid-cols-[1fr_140px_160px] border-b border-border bg-surface-hover px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Page</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Deleted</span>
                    <span className="text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Actions</span>
                </div>

                {documents.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sage-200 bg-sage-50">
                            <IconTrash className="h-6 w-6 text-sage-500" stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">Trash is empty</p>
                            <p className="mt-0.5 text-xs text-text-tertiary">Deleted pages will appear here.</p>
                        </div>
                    </div>
                ) : (
                    <ul>
                        {documents.map(doc => {
                            const busy = busyId === doc.id;
                            return (
                                <li
                                    key={doc.id}
                                    className="grid grid-cols-[1fr_140px_160px] items-center border-b border-border-subtle px-4 py-3 transition-colors last:border-0 hover:bg-surface-hover/60"
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                                        <span className="truncate text-sm font-medium text-foreground">{doc.title}</span>
                                        {doc.workspace && (
                                            <>
                                                <span className="text-[11px] text-text-tertiary">·</span>
                                                <span className="shrink-0 text-[11px] text-text-secondary">{doc.workspace.name}</span>
                                            </>
                                        )}
                                        {doc.child_count > 0 && (
                                            <span className="shrink-0 rounded-full bg-border-subtle px-1.5 py-px text-[10px] font-medium text-text-secondary">
                                                +{doc.child_count} subpage{doc.child_count !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-text-tertiary">{timeAgo(doc.deleted_at)}</span>
                                    <div className="flex items-center justify-end gap-1.5">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => restore(doc)}
                                            className="flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-sage-50 hover:border-sage-200 hover:text-sage-600 disabled:opacity-50"
                                        >
                                            <IconRestore className="h-3.5 w-3.5" stroke={1.5} />
                                            Restore
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => setPurgeTarget(doc)}
                                            title="Delete permanently"
                                            className="flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-surface text-text-tertiary transition-colors hover:bg-danger/10 hover:border-danger/20 hover:text-danger disabled:opacity-50"
                                        >
                                            <IconTrashX className="h-3.5 w-3.5" stroke={1.5} />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <ConfirmDialog
                open={!!purgeTarget}
                title={purgeTarget ? `Permanently delete "${purgeTarget.title}"?` : ''}
                message={
                    purgeTarget?.child_count > 0
                        ? `This will permanently delete this page, its ${purgeTarget.child_count} subpage${purgeTarget.child_count !== 1 ? 's' : ''}, and all version history. This cannot be undone.`
                        : 'This will permanently delete this page and all its version history. This cannot be undone.'
                }
                confirmLabel="Delete permanently"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={confirmPurge}
                onCancel={() => setPurgeTarget(null)}
            />
        </DocsLayout>
    );
}
