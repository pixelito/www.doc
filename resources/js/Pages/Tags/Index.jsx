import { Head, useForm, router } from '@inertiajs/react';
import { Plus, Trash2, Tag as TagIcon } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';

export default function TagsIndex({ tags }) {
    const { data, setData, post, processing, errors, reset } = useForm({ name: '' });

    function submit(e) {
        e.preventDefault();
        post('/tags', { onSuccess: () => reset() });
    }

    function destroyTag(tag) {
        if (confirm(`Delete tag "${tag.name}"?`)) {
            router.delete(`/tags/${tag.id}`);
        }
    }

    return (
        <AppLayout>
            <Head title="Tags" />

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tags</h1>
            <p className="mt-1 text-sm text-text-secondary">Cross-cutting labels that span workspaces.</p>

            <form onSubmit={submit} className="mt-6 flex items-start gap-3 rounded-md border border-border bg-card p-4">
                <div className="flex-1">
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        placeholder="Tag name (e.g. production)"
                        className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                    />
                    {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name}</p>}
                </div>
                <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-sage-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                    Add
                </button>
            </form>

            {tags.length === 0 ? (
                <div className="mt-8 rounded-md border border-dashed border-border bg-surface p-12 text-center">
                    <TagIcon className="mx-auto h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
                    <p className="mt-2 text-sm text-text-tertiary">No tags yet.</p>
                </div>
            ) : (
                <ul className="mt-6 divide-y divide-border-subtle rounded-md border border-border bg-card">
                    {tags.map((tag) => (
                        <li key={tag.id} className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                                <span className="inline-flex items-center rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-600">
                                    {tag.name}
                                </span>
                                <span className="text-xs text-text-tertiary">
                                    {tag.documents_count} {tag.documents_count === 1 ? 'page' : 'pages'}
                                </span>
                            </div>
                            <button
                                onClick={() => destroyTag(tag)}
                                className="text-text-tertiary transition-colors duration-150 hover:text-danger"
                                aria-label={`Delete ${tag.name}`}
                            >
                                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </AppLayout>
    );
}
