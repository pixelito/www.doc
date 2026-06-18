import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconSearch, IconFileText, IconFolder, IconTag } from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';

function ResultIcon({ type }) {
    const cls = 'mt-0.5 h-4 w-4 shrink-0 text-text-tertiary';
    if (type === 'workspace') return <IconFolder className={cls} stroke={1.5} />;
    if (type === 'tag')       return <IconTag className={cls} stroke={1.5} />;
    return <IconFileText className={cls} stroke={1.5} />;
}

function ResultRow({ r }) {
    const href = r.type === 'document'  ? `/documents/${r.id}`
               : r.type === 'workspace' ? `/workspaces/${r.id}`
               :                          `/tags/${r.id}`;

    const label = r.type === 'document'  ? r.workspace_name
                : r.type === 'workspace' ? `${r.documents_count} ${r.documents_count === 1 ? 'page' : 'pages'}`
                : `${r.documents_count} ${r.documents_count === 1 ? 'page' : 'pages'}`;

    const typeBadge = {
        document:  { text: 'Page',      cls: 'bg-sage-50 text-sage-600 border-sage-200' },
        workspace: { text: 'Workspace', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
        tag:       { text: 'Tag',       cls: 'bg-purple-50 text-purple-600 border-purple-200' },
    }[r.type];

    return (
        <Link
            href={href}
            className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-sage-300 hover:bg-surface-hover"
        >
            <ResultIcon type={r.type} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{r.name ?? r.title}</p>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${typeBadge.cls}`}>
                        {typeBadge.text}
                    </span>
                </div>
                {label && (
                    <p className="mt-0.5 text-xs text-text-tertiary">{label}</p>
                )}
                {r.excerpt && (
                    <p
                        className="mt-1.5 text-sm text-text-secondary leading-relaxed [&_mark]:bg-yellow-100 [&_mark]:text-yellow-900 [&_mark]:rounded [&_mark]:px-0.5"
                        dangerouslySetInnerHTML={{ __html: r.excerpt }}
                    />
                )}
            </div>
        </Link>
    );
}

export default function SearchIndex({ q, results }) {
    const [query, setQuery] = useState(q);

    function submit(e) {
        e.preventDefault();
        router.get('/search', { q: query }, { preserveState: true, replace: true });
    }

    return (
        <AppLayout>
            <Head title={q ? `"${q}" — Search` : 'Search'} />

            <div className="mx-auto max-w-2xl">
                <form onSubmit={submit} className="relative mb-6">
                    <IconSearch
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                        stroke={1.5}
                    />
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search pages, workspaces, tags…"
                        className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                    />
                </form>

                {q === '' ? (
                    <p className="text-center text-sm text-text-tertiary">Type to search pages, workspaces and tags.</p>
                ) : results.length === 0 ? (
                    <p className="text-center text-sm text-text-tertiary">No results for <strong>{q}</strong>.</p>
                ) : (
                    <div className="space-y-2">
                        <p className="mb-3 text-xs text-text-tertiary">{results.length} result{results.length !== 1 ? 's' : ''}</p>
                        {results.map((r, i) => (
                            <ResultRow key={`${r.type}-${r.id}-${i}`} r={r} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
