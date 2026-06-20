import { Head, Link } from '@inertiajs/react';
import { IconChevronRight, IconHistory, IconClock, IconUser } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';

function timeAgo(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function VersionsIndex({ document, workspace, versions }) {
    return (
        <DocsLayout>
            <Head title={`History — ${document.title}`} />

            <nav className="mb-5 flex items-center gap-1.5 text-sm text-text-secondary">
                <Link href="/workspaces" className="hover:text-foreground">Workspaces</Link>
                <IconChevronRight className="h-3.5 w-3.5 text-text-tertiary" stroke={1.5} />
                <Link href={`/workspaces/${workspace.id}`} className="hover:text-foreground">{workspace.name}</Link>
                <IconChevronRight className="h-3.5 w-3.5 text-text-tertiary" stroke={1.5} />
                <Link href={`/documents/${document.id}`} className="hover:text-foreground">{document.title}</Link>
                <IconChevronRight className="h-3.5 w-3.5 text-text-tertiary" stroke={1.5} />
                <span className="font-medium text-foreground">History</span>
            </nav>

            <div className="mb-4 flex items-center gap-2">
                <IconHistory className="h-5 w-5 text-sage-500" stroke={1.5} />
                <h1 className="text-[19px] font-semibold text-foreground">Version history</h1>
                <span className="ml-1 text-sm text-text-tertiary">({versions.length})</span>
            </div>

            {versions.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-tertiary">No versions saved yet.</p>
            ) : (
                <div className="overflow-hidden rounded-md border border-border bg-card">
                    <div className="grid grid-cols-[1fr_140px_140px] border-b border-border bg-surface-hover px-4 py-2.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Title</span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Author</span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Saved</span>
                    </div>
                    <ul>
                        {versions.map((v, i) => (
                            <li key={v.id}
                                className="grid grid-cols-[1fr_140px_140px] items-center border-b border-border-subtle last:border-0 px-4 py-3 transition-colors hover:bg-surface-hover">
                                <div className="min-w-0">
                                    <Link
                                        href={i === 0
                                            ? `/documents/${document.id}`
                                            : `/documents/${document.id}/versions/${v.id}`}
                                        className="truncate text-sm font-medium text-sage-600 hover:underline"
                                    >
                                        {v.title}
                                    </Link>
                                    {i === 0 && (
                                        <span className="ml-2 rounded bg-sage-100 px-1.5 py-0.5 text-[10px] font-semibold text-sage-600">
                                            current
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                    <IconUser className="h-3.5 w-3.5 text-text-tertiary" stroke={1.5} />
                                    {v.creator?.name ?? '—'}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                                    <IconClock className="h-3.5 w-3.5" stroke={1.5} />
                                    {timeAgo(v.created_at)}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </DocsLayout>
    );
}
