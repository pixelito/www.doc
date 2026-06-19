import { useState, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconSearch, IconFileText, IconFolder, IconTag } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';

const INITIAL_LIMIT = 6;

function timeAgo(dateStr) {
    if (!dateStr) return null;
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)      return 'just now';
    if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Chip({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-sm px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                active
                    ? 'bg-sage-100 text-sage-600'
                    : 'border border-border bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
        >
            {children}
        </button>
    );
}

function DocRow({ r }) {
    const ago     = timeAgo(r.updated_at);
    const updater = r.updated_by_name;
    const meta    = ago && updater ? `Updated ${ago} by ${updater}` : ago ? `Updated ${ago}` : updater ? `By ${updater}` : null;

    return (
        <Link
            href={`/documents/${r.id}`}
            className="block border-b border-border-subtle px-4 py-3.5 transition-colors last:border-0 hover:bg-surface-hover"
        >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <IconFileText className="mt-px h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                <span className="text-sm font-medium text-foreground">{r.title}</span>
                {r.workspace_name && (
                    <>
                        <span className="text-[11px] text-text-tertiary">·</span>
                        <span className="text-[11px] text-text-secondary">{r.workspace_name}</span>
                    </>
                )}
                {(r.tags ?? []).slice(0, 2).map(t => (
                    <span key={t.id} className="rounded-full bg-sage-100 px-2 py-px text-[10px] font-medium text-sage-600">
                        {t.name}
                    </span>
                ))}
            </div>
            {r.excerpt && (
                <p
                    className="mt-1.5 text-[12.5px] leading-[1.55] text-text-secondary [&_mark]:rounded-sm [&_mark]:bg-sage-100 [&_mark]:px-0.5 [&_mark]:text-sage-700"
                    dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
            )}
            {meta && (
                <p className="mt-1.5 text-[11px] text-text-tertiary">{meta}</p>
            )}
        </Link>
    );
}

function OtherRow({ r }) {
    const href  = r.type === 'workspace' ? `/workspaces/${r.id}` : `/tags/${r.id}`;
    const Icon  = r.type === 'workspace' ? IconFolder : IconTag;
    const count = r.documents_count != null
        ? `${r.documents_count} ${r.documents_count === 1 ? 'page' : 'pages'}`
        : null;

    return (
        <Link
            href={href}
            className="block border-b border-border-subtle px-4 py-3.5 transition-colors last:border-0 hover:bg-surface-hover"
        >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                <span className="text-sm font-medium text-foreground">{r.name}</span>
                {count && (
                    <>
                        <span className="text-[11px] text-text-tertiary">·</span>
                        <span className="text-[11px] text-text-secondary">{count}</span>
                    </>
                )}
                <span className="ml-auto rounded-full border border-sage-200 bg-sage-50 px-2 py-px text-[10px] font-semibold text-sage-600">
                    {r.type === 'workspace' ? 'Workspace' : 'Tag'}
                </span>
            </div>
            {r.excerpt && (
                <p className="mt-1.5 text-[12.5px] leading-[1.55] text-text-secondary">{r.excerpt}</p>
            )}
        </Link>
    );
}

export default function SearchIndex({ q, results }) {
    const [query,           setQuery]           = useState(q);
    const [sortBy,          setSortBy]          = useState('relevance');
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [activeTag,       setActiveTag]       = useState(null);
    const [showAll,         setShowAll]         = useState(false);

    const docResults   = useMemo(() => results.filter(r => r.type === 'document'), [results]);
    const otherResults = useMemo(() => results.filter(r => r.type !== 'document'), [results]);

    const workspaces = useMemo(() =>
        [...new Map(docResults.map(r => [r.workspace_name, r.workspace_name])).values()].sort(),
    [docResults]);

    const allTags = useMemo(() => {
        const map = new Map();
        docResults.forEach(r => (r.tags ?? []).forEach(t => map.set(t.id, t)));
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [docResults]);

    const filteredDocs = useMemo(() => {
        let docs = docResults.filter(r => {
            if (activeWorkspace && r.workspace_name !== activeWorkspace) return false;
            if (activeTag       && !(r.tags ?? []).some(t => t.id === activeTag)) return false;
            return true;
        });
        if (sortBy === 'newest') {
            docs = [...docs].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        }
        return docs;
    }, [docResults, activeWorkspace, activeTag, sortBy]);

    const allVisible  = [...filteredDocs, ...otherResults];
    const displayed   = showAll ? allVisible : allVisible.slice(0, INITIAL_LIMIT);
    const remaining   = allVisible.length - INITIAL_LIMIT;

    const uniqueWorkspaceCount = workspaces.length;

    function submit(e) {
        e.preventDefault();
        router.get('/search', { q: query }, { preserveState: true, replace: true });
    }

    function toggleWorkspace(name) {
        setActiveWorkspace(prev => prev === name ? null : name);
        setShowAll(false);
    }

    function toggleTag(id) {
        setActiveTag(prev => prev === id ? null : id);
        setShowAll(false);
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
                        className="h-9 w-full rounded-sm border border-border bg-canvas pl-10 pr-4 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
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
                        {/* Count + sort */}
                        <div className="mb-3.5 flex items-baseline justify-between gap-4">
                            <div>
                                <h2 className="text-[19px] font-medium text-foreground">
                                    {results.length} result{results.length !== 1 ? 's' : ''} for{' '}
                                    <span className="text-sage-600">"{q}"</span>
                                </h2>
                                {uniqueWorkspaceCount > 0 && (
                                    <p className="mt-0.5 text-xs text-text-tertiary">
                                        Across {uniqueWorkspaceCount} workspace{uniqueWorkspaceCount !== 1 ? 's' : ''} · sorted by {sortBy === 'relevance' ? 'relevance' : 'newest first'}
                                    </p>
                                )}
                            </div>
                            {docResults.length > 1 && (
                                <select
                                    value={sortBy}
                                    onChange={(e) => { setSortBy(e.target.value); setShowAll(false); }}
                                    className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                                >
                                    <option value="relevance">Relevance</option>
                                    <option value="newest">Newest first</option>
                                </select>
                            )}
                        </div>

                        {/* Filter chips */}
                        {(workspaces.length > 1 || allTags.length > 0) && (
                            <div className="mb-4 flex flex-wrap items-center gap-1.5">
                                {workspaces.length > 1 && (
                                    <>
                                        <span className="mr-1 text-[11px] text-text-tertiary">Workspace:</span>
                                        <Chip active={activeWorkspace === null} onClick={() => { setActiveWorkspace(null); setShowAll(false); }}>All</Chip>
                                        {workspaces.map(name => (
                                            <Chip key={name} active={activeWorkspace === name} onClick={() => toggleWorkspace(name)}>
                                                {name}
                                            </Chip>
                                        ))}
                                    </>
                                )}
                                {workspaces.length > 1 && allTags.length > 0 && (
                                    <span className="mx-1 h-3.5 w-px bg-border" />
                                )}
                                {allTags.length > 0 && (
                                    <>
                                        <span className="mr-1 text-[11px] text-text-tertiary">Tag:</span>
                                        {allTags.map(t => (
                                            <Chip key={t.id} active={activeTag === t.id} onClick={() => toggleTag(t.id)}>
                                                {t.name}
                                            </Chip>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Results */}
                        {allVisible.length === 0 ? (
                            <p className="py-8 text-center text-sm text-text-tertiary">No results match this filter.</p>
                        ) : (
                            <>
                                <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
                                    {displayed.map((r, i) =>
                                        r.type === 'document'
                                            ? <DocRow key={`doc-${r.id}`} r={r} />
                                            : <OtherRow key={`${r.type}-${r.id}`} r={r} />
                                    )}
                                </div>

                                {!showAll && remaining > 0 && (
                                    <div className="mt-3.5 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowAll(true)}
                                            className="rounded-sm border border-border bg-transparent px-4 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-hover"
                                        >
                                            Show {remaining} more result{remaining !== 1 ? 's' : ''}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </DocsLayout>
    );
}
