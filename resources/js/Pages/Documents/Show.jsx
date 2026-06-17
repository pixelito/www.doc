import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';

function Pill({ children }) {
    return (
        <span className="inline-flex items-center rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-600">
            {children}
        </span>
    );
}

export default function DocumentShow({ document, versionsCount }) {
    function destroyDocument() {
        if (confirm(`Delete page "${document.title}"?`)) {
            router.delete(`/documents/${document.id}`);
        }
    }

    return (
        <AppLayout>
            <Head title={document.title} />

            <Link
                href={`/workspaces/${document.workspace.id}`}
                className="inline-flex items-center gap-1 text-sm text-text-secondary transition-colors duration-150 hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                {document.workspace.name}
            </Link>

            <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">{document.title}</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        {versionsCount} {versionsCount === 1 ? 'version' : 'versions'}
                        {document.updater ? ` · last edited by ${document.updater.name}` : ''}
                    </p>
                </div>
                <button
                    onClick={destroyDocument}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm text-danger transition-colors duration-150 hover:bg-surface-hover"
                >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    Delete
                </button>
            </div>

            {document.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {document.tags.map((tag) => (
                        <Pill key={tag.id}>{tag.name}</Pill>
                    ))}
                </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
                {/* Canonical JSON (Phase 1 read view — the editor arrives in Phase 2) */}
                <section className="rounded-md border border-border bg-card p-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
                        Content (canonical JSON)
                    </p>
                    <pre className="overflow-x-auto rounded-sm bg-surface-hover p-3 font-mono text-xs leading-relaxed text-text-primary">
                        {JSON.stringify(document.content, null, 2)}
                    </pre>
                </section>

                {/* Backlinks + outgoing links */}
                <aside className="space-y-6">
                    <div className="rounded-md border border-border bg-card p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
                            Backlinks
                        </p>
                        {document.backlinks.length === 0 ? (
                            <p className="text-sm text-text-tertiary">No pages link here yet.</p>
                        ) : (
                            <ul className="space-y-1">
                                {document.backlinks.map((link) => (
                                    <li key={link.id}>
                                        <Link
                                            href={`/documents/${link.source.id}`}
                                            className="text-sm text-sage-600 transition-colors duration-150 hover:underline"
                                        >
                                            {link.source.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="rounded-md border border-border bg-card p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
                            Links out
                        </p>
                        {document.outgoing_links.length === 0 ? (
                            <p className="text-sm text-text-tertiary">This page links nowhere yet.</p>
                        ) : (
                            <ul className="space-y-1">
                                {document.outgoing_links.map((link) => (
                                    <li key={link.id} className="text-sm">
                                        {link.target ? (
                                            <Link
                                                href={`/documents/${link.target.id}`}
                                                className="text-sage-600 transition-colors duration-150 hover:underline"
                                            >
                                                {link.target.title}
                                            </Link>
                                        ) : (
                                            <span className="text-text-tertiary">
                                                {link.target_title}{' '}
                                                <span className="text-[11px]">(unresolved)</span>
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>
            </div>
        </AppLayout>
    );
}
