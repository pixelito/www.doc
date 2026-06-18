import { Head, Link } from '@inertiajs/react';
import { IconChevronRight, IconTag, IconFileText, IconFolder } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';

export default function TagShow({ tag, groups }) {
    const totalDocs = groups.reduce((n, g) => n + g.documents.length, 0);

    return (
        <DocsLayout>
            <Head title={`#${tag.name}`} />

            <nav className="mb-5 flex items-center gap-1.5 text-sm text-text-secondary">
                <Link href="/tags" className="hover:text-foreground">Tags</Link>
                <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
                <span className="text-foreground">#{tag.name}</span>
            </nav>

            <div className="mb-6 flex items-center gap-2">
                <IconTag className="h-5 w-5 text-sage-500" stroke={1.5} />
                <h1 className="text-xl font-semibold text-foreground">#{tag.name}</h1>
                <span className="ml-1 text-sm text-text-tertiary">
                    {totalDocs} {totalDocs === 1 ? 'page' : 'pages'} across {groups.length} {groups.length === 1 ? 'workspace' : 'workspaces'}
                </span>
            </div>

            {groups.length === 0 ? (
                <p className="mt-8 text-center text-sm text-text-tertiary">No pages with this tag yet.</p>
            ) : (
                <div className="space-y-6">
                    {groups.map((group) => (
                        <div key={group.workspace.id}>
                            <div className="mb-2 flex items-center gap-2">
                                <IconFolder className="h-4 w-4 text-text-tertiary" stroke={1.5} />
                                <Link
                                    href={`/workspaces/${group.workspace.id}`}
                                    className="text-sm font-semibold text-foreground hover:text-sage-600"
                                >
                                    {group.workspace.name}
                                </Link>
                                <span className="text-xs text-text-tertiary">({group.documents.length})</span>
                            </div>

                            <div className="overflow-hidden rounded-md border border-border bg-card">
                                <ul>
                                    {group.documents.map((doc) => (
                                        <li key={doc.id}
                                            className="flex items-center gap-3 border-b border-border-subtle px-4 py-2.5 last:border-0 transition-colors hover:bg-surface-hover">
                                            <IconFileText className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                                            <Link
                                                href={`/documents/${doc.id}`}
                                                className="flex-1 truncate text-sm text-foreground hover:text-sage-600"
                                            >
                                                {doc.title}
                                            </Link>
                                            <div className="flex shrink-0 gap-1">
                                                {doc.tags.filter(t => t.id !== tag.id).slice(0, 3).map(t => (
                                                    <Link
                                                        key={t.id}
                                                        href={`/tags/${t.id}`}
                                                        className="rounded-md bg-surface border border-border px-1.5 py-0.5 text-[10px] text-text-secondary hover:text-sage-600 hover:border-sage-300"
                                                    >
                                                        {t.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </DocsLayout>
    );
}
