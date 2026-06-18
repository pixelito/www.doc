import { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { IconFolderOpen, IconFolderPlus, IconPlus } from '@tabler/icons-react';
import DocsLayout from '@/Layouts/DocsLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function WorkspacesIndex({ workspaces }) {
    const [showForm, setShowForm] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        description: '',
    });

    function submit(e) {
        e.preventDefault();
        post('/workspaces', {
            onSuccess: () => {
                reset();
                setShowForm(false);
            },
        });
    }

    return (
        <DocsLayout>
            <Head title="Workspaces" />

            {/* Header */}
            <div>
                <h1 className="text-[19px] font-semibold text-foreground">Workspaces</h1>
                <p className="mt-0.5 text-sm text-text-secondary">
                    {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
                </p>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_110px] border-b border-border bg-surface-hover px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Workspace</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">Pages</span>
                </div>

                {/* Rows */}
                {workspaces.length > 0 && (
                    <ul>
                        {workspaces.map((w) => (
                            <li
                                key={w.id}
                                className="grid grid-cols-[1fr_110px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60"
                            >
                                <Link
                                    href={`/workspaces/${w.id}`}
                                    className="flex min-w-0 items-center gap-2.5 py-3 pl-4 pr-4"
                                >
                                    <IconFolderOpen className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{w.name}</p>
                                        {w.description && (
                                            <p className="truncate text-xs text-text-secondary">{w.description}</p>
                                        )}
                                    </div>
                                </Link>
                                <div className="py-3 pr-4">
                                    <span className="text-xs text-text-tertiary">
                                        {w.documents_count} {w.documents_count === 1 ? 'page' : 'pages'}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {workspaces.length === 0 && !showForm && (
                    <div className="flex flex-col items-center gap-3 border-dashed border-border px-6 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-50 border border-sage-200">
                            <IconFolderPlus className="h-6 w-6 text-sage-500" stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">No workspaces yet</p>
                            <p className="mt-0.5 text-xs text-text-tertiary">Create a workspace to start organising your docs.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowForm(true)}
                            className="mt-1 rounded-sm bg-primary px-3.5 py-1.5 text-xs font-medium text-text-inverse transition-opacity hover:opacity-90"
                        >
                            Create workspace
                        </button>
                    </div>
                )}

                {/* New workspace */}
                {showForm ? (
                    <div className="border-t border-border px-4 py-3">
                        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-45">
                                <Input
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="Workspace name (e.g. Network)"
                                    className="h-8"
                                    autoFocus
                                />
                                {errors.name && <p className="mt-1 text-xs text-danger">{errors.name}</p>}
                            </div>
                            <div className="flex-2 min-w-45">
                                <Input
                                    type="text"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    placeholder="Description (optional)"
                                    className="h-8"
                                />
                            </div>
                            <Button type="submit" size="sm" disabled={processing}>Create</Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => { setShowForm(false); reset(); }}
                            >
                                Cancel
                            </Button>
                        </form>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
                    >
                        <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
                        New workspace
                    </button>
                )}
            </div>
        </DocsLayout>
    );
}
