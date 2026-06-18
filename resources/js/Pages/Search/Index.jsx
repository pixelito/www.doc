import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconSearch, IconFileText, IconFolder } from '@tabler/icons-react';
import AppLayout from '@/Layouts/AppLayout';

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
                        placeholder="Search documentation…"
                        className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                    />
                </form>

                {q === '' ? (
                    <p className="text-center text-sm text-text-tertiary">Type to search across all workspaces.</p>
                ) : results.length === 0 ? (
                    <p className="text-center text-sm text-text-tertiary">No results for <strong>{q}</strong>.</p>
                ) : (
                    <div className="space-y-1">
                        <p className="mb-3 text-xs text-text-tertiary">{results.length} result{results.length !== 1 ? 's' : ''}</p>
                        {results.map((r) => (
                            <Link
                                key={r.id}
                                href={`/documents/${r.id}`}
                                className="block rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-sage-300 hover:bg-surface-hover"
                            >
                                <div className="flex items-start gap-3">
                                    <IconFileText className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                                    <div className="min-w-0">
                                        <p className="font-medium text-foreground">{r.title}</p>
                                        <div className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
                                            <IconFolder className="h-3 w-3" stroke={1.5} />
                                            {r.workspace_name}
                                        </div>
                                        {r.excerpt && (
                                            <p
                                                className="mt-2 text-sm text-text-secondary leading-relaxed [&_mark]:bg-yellow-100 [&_mark]:text-yellow-900 [&_mark]:rounded [&_mark]:px-0.5"
                                                dangerouslySetInnerHTML={{ __html: r.excerpt }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
