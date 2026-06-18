import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconSearch, IconFileText, IconFolder, IconTag } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';

const TYPE_LABEL = {
    document:  'Page',
    workspace: 'Workspace',
    tag:       'Tag',
};

function ResultIcon({ type }) {
    const cls = 'mt-[1px] h-[14px] w-[14px] shrink-0 text-text-tertiary';
    if (type === 'workspace') return <IconFolder className={cls} stroke={1.5} />;
    if (type === 'tag')       return <IconTag className={cls} stroke={1.5} />;
    return <IconFileText className={cls} stroke={1.5} />;
}

function ResultRow({ r }) {
    const href = r.type === 'document'  ? `/documents/${r.id}`
               : r.type === 'workspace' ? `/workspaces/${r.id}`
               :                          `/tags/${r.id}`;

    const meta = r.type === 'document'  ? r.workspace_name
               : r.type === 'workspace' ? `${r.documents_count} ${r.documents_count === 1 ? 'page' : 'pages'}`
               :                          `${r.documents_count} ${r.documents_count === 1 ? 'page' : 'pages'}`;

    return (
        <Link
            href={href}
            className="block border-b border-border-subtle px-4 py-3.5 transition-colors last:border-0 hover:bg-surface-hover"
        >
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2">
                <ResultIcon type={r.type} />
                <span className="text-sm font-medium text-foreground">{r.name ?? r.title}</span>
                {meta && (
                    <>
                        <span className="text-[11px] text-text-tertiary">·</span>
                        <span className="text-[11px] text-text-secondary">{meta}</span>
                    </>
                )}
                <span className="rounded border border-sage-200 bg-sage-50 px-1.5 py-px text-[10px] font-semibold text-sage-600">
                    {TYPE_LABEL[r.type]}
                </span>
            </div>

            {/* Snippet */}
            {r.excerpt && (
                <p
                    className="mt-1.5 text-[12.5px] leading-[1.55] text-text-secondary [&_mark]:rounded-sm [&_mark]:bg-sage-100 [&_mark]:px-0.5 [&_mark]:text-sage-700"
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
            )}
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
        <DocsLayout>
            <Head title={q ? `"${q}" — Search` : 'Search'} />

            <div className="mx-auto max-w-2xl">
                {/* Search bar */}
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
                    <p className="text-center text-sm text-text-tertiary">
                        No results for <span className="font-medium text-foreground">"{q}"</span>.
                    </p>
                ) : (
                    <>
                        <p className="mb-3 text-xs text-text-tertiary">
                            {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
                            <span className="font-medium text-sage-600">"{q}"</span>
                        </p>
                        <div className="overflow-hidden rounded-md border border-border bg-card">
                            {results.map((r, i) => (
                                <ResultRow key={`${r.type}-${r.id}-${i}`} r={r} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </DocsLayout>
    );
}
