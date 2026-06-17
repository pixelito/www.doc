import { Head, Link, useForm } from '@inertiajs/react';
import { FolderOpen, Plus } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';

export default function WorkspacesIndex({ workspaces }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        description: '',
    });

    function submit(e) {
        e.preventDefault();
        post('/workspaces', { onSuccess: () => reset() });
    }

    return (
        <AppLayout>
            <Head title="Workspaces" />

            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workspaces</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Top-level containers for your documentation. Kept few and flat.
                    </p>
                </div>
            </div>

            {/* New workspace */}
            <form
                onSubmit={submit}
                className="mt-6 flex flex-wrap items-start gap-3 rounded-md border border-border bg-card p-4"
            >
                <div className="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        placeholder="Workspace name (e.g. Network)"
                        className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                    />
                    {errors.name && <p className="mt-1.5 text-xs text-danger">{errors.name}</p>}
                </div>
                <div className="flex-[2] min-w-[200px]">
                    <input
                        type="text"
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                    />
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

            {/* Grid */}
            {workspaces.length === 0 ? (
                <div className="mt-8 rounded-md border border-dashed border-border bg-surface p-12 text-center">
                    <FolderOpen className="mx-auto h-6 w-6 text-text-tertiary" strokeWidth={1.5} />
                    <p className="mt-2 text-sm text-text-tertiary">No workspaces yet. Create your first above.</p>
                </div>
            ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {workspaces.map((w) => (
                        <Link
                            key={w.id}
                            href={`/workspaces/${w.id}`}
                            className="group rounded-md border border-border bg-card p-4 transition-colors duration-150 hover:bg-surface-hover"
                        >
                            <h3 className="font-semibold text-foreground">{w.name}</h3>
                            {w.description && (
                                <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{w.description}</p>
                            )}
                            <p className="mt-3 text-xs text-text-tertiary">
                                {w.documents_count} {w.documents_count === 1 ? 'page' : 'pages'}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </AppLayout>
    );
}
