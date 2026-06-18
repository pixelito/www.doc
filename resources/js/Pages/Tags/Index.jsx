import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconPlus, IconTrash, IconTag } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function TagsIndex({ tags }) {
    const [showForm, setShowForm]       = useState(false);
    const [name, setName]               = useState('');
    const [error, setError]             = useState('');
    const [processing, setProcessing]   = useState(false);
    const [tagToDelete, setTagToDelete] = useState(null);

    function submit(e) {
        e.preventDefault();
        if (!name.trim()) { setError('Name is required.'); return; }
        setProcessing(true);
        router.post('/tags', { name: name.trim() }, {
            onSuccess: () => { setName(''); setError(''); setProcessing(false); setShowForm(false); },
            onError: (errs) => { setError(errs.name ?? 'Something went wrong.'); setProcessing(false); },
        });
    }

    function confirmDelete() {
        router.delete(`/tags/${tagToDelete.id}`, {
            onFinish: () => setTagToDelete(null),
        });
    }

    return (
        <>
        <DocsLayout>
            <Head title="Tags" />

            <div>
                <h1 className="text-[19px] font-semibold text-foreground">Tags</h1>
                <p className="mt-0.5 text-sm text-text-secondary">
                    {tags.length} {tags.length === 1 ? 'tag' : 'tags'} · Cross-cutting labels that span workspaces.
                </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_90px_36px] border-b border-border bg-surface-hover px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Tag</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Pages</span>
                    <span />
                </div>

                {/* Empty placeholder */}
                {tags.length === 0 && !showForm && (
                    <p className="px-4 py-8 text-center text-sm text-text-tertiary">No tags yet.</p>
                )}

                {/* Tag rows */}
                {tags.length > 0 && (
                    <ul>
                        {tags.map((tag) => (
                            <li
                                key={tag.id}
                                className="group grid grid-cols-[1fr_90px_36px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60"
                            >
                                <Link
                                    href={`/tags/${tag.id}`}
                                    className="flex min-w-0 items-center gap-2 py-2.5 pl-4 pr-4"
                                >
                                    <span className="inline-flex items-center gap-1.5 rounded-md bg-sage-100 px-2 py-0.5 text-[11px] font-medium text-sage-700 transition-colors hover:bg-sage-200">
                                        <IconTag className="h-2.5 w-2.5 shrink-0" stroke={2} />
                                        {tag.name}
                                    </span>
                                </Link>
                                <div className="py-2.5 pr-4 text-xs text-text-tertiary">
                                    {tag.documents_count} {tag.documents_count === 1 ? 'page' : 'pages'}
                                </div>
                                <div className="flex items-center justify-center py-2.5 pr-1">
                                    <button
                                        type="button"
                                        onClick={() => setTagToDelete(tag)}
                                        title={`Delete ${tag.name}`}
                                        className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger/10 hover:text-danger"
                                    >
                                        <IconTrash className="h-3 w-3" stroke={1.5} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Footer — new tag */}
                {showForm ? (
                    <div className="border-t border-border px-4 py-3">
                        <form onSubmit={submit} className="flex items-center gap-2">
                            <div className="flex-1">
                                <input
                                    autoFocus
                                    type="text"
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); setError(''); }}
                                    placeholder="Tag name (e.g. production)"
                                    className="h-8 w-full rounded-sm border border-border bg-canvas px-3 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                                />
                                {error && <p className="mt-1 text-xs text-danger">{error}</p>}
                            </div>
                            <button
                                type="submit"
                                disabled={processing}
                                className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-text-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setName(''); setError(''); }}
                                className="rounded-sm px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                Cancel
                            </button>
                        </form>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
                    >
                        <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
                        New tag
                    </button>
                )}
            </div>
        </DocsLayout>

        <ConfirmDialog
            open={tagToDelete !== null}
            title={`Delete tag "${tagToDelete?.name}"?`}
            message={`This tag will be removed from all ${tagToDelete?.documents_count ?? 0} page${(tagToDelete?.documents_count ?? 0) !== 1 ? 's' : ''} that use it. This cannot be undone.`}
            confirmLabel="Delete tag"
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={confirmDelete}
            onCancel={() => setTagToDelete(null)}
        />
        </>
    );
}
