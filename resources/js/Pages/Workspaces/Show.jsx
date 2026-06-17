import { Head, Link, router, useForm } from '@inertiajs/react';
import { ChevronLeft, FileText, Plus, Trash2 } from 'lucide-react';
import AppLayout from '@/Layouts/AppLayout';

function TreeNode({ node, depth = 0 }) {
    return (
        <li>
            <Link
                href={`/documents/${node.id}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                className="flex items-center gap-2 rounded-sm py-1.5 pr-2 text-sm text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
            >
                <FileText className="h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.5} />
                <span className="truncate">{node.title}</span>
            </Link>
            {node.children.length > 0 && (
                <ul>
                    {node.children.map((child) => (
                        <TreeNode key={child.id} node={child} depth={depth + 1} />
                    ))}
                </ul>
            )}
        </li>
    );
}

/** Flatten the tree into <option>s with indentation, for the parent picker. */
function flatten(nodes, depth = 0, acc = []) {
    for (const node of nodes) {
        acc.push({ id: node.id, label: `${'  '.repeat(depth)}${node.title}` });
        flatten(node.children, depth + 1, acc);
    }
    return acc;
}

export default function WorkspaceShow({ workspace, tree }) {
    const options = flatten(tree);

    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        parent_id: '',
        workspace_id: workspace.id,
    });

    function submit(e) {
        e.preventDefault();
        post('/documents', { onSuccess: () => reset('title', 'parent_id') });
    }

    function destroyWorkspace() {
        if (confirm(`Delete workspace "${workspace.name}" and all its pages?`)) {
            router.delete(`/workspaces/${workspace.id}`);
        }
    }

    return (
        <AppLayout>
            <Head title={workspace.name} />

            <Link
                href="/workspaces"
                className="inline-flex items-center gap-1 text-sm text-text-secondary transition-colors duration-150 hover:text-foreground"
            >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                Workspaces
            </Link>

            <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">{workspace.name}</h1>
                    {workspace.description && (
                        <p className="mt-1 text-sm text-text-secondary">{workspace.description}</p>
                    )}
                </div>
                <button
                    onClick={destroyWorkspace}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm text-danger transition-colors duration-150 hover:bg-surface-hover"
                >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    Delete
                </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                {/* Tree sidebar */}
                <aside className="rounded-md border border-border bg-card p-2">
                    <p className="px-2 py-1 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
                        Pages
                    </p>
                    {tree.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-text-tertiary">No pages yet.</p>
                    ) : (
                        <ul className="mt-1">
                            {tree.map((node) => (
                                <TreeNode key={node.id} node={node} />
                            ))}
                        </ul>
                    )}
                </aside>

                {/* New document */}
                <section>
                    <form onSubmit={submit} className="rounded-md border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">New page</h3>
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-foreground">Title</label>
                                <input
                                    type="text"
                                    value={data.title}
                                    onChange={(e) => setData('title', e.target.value)}
                                    placeholder="Page title"
                                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                                />
                                {errors.title && <p className="mt-1.5 text-xs text-danger">{errors.title}</p>}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-foreground">
                                    Parent page <span className="text-text-tertiary">(optional)</span>
                                </label>
                                <select
                                    value={data.parent_id}
                                    onChange={(e) => setData('parent_id', e.target.value)}
                                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-sage-400 focus-visible:ring-[3px] focus-visible:ring-sage-200"
                                >
                                    <option value="">— None (top level) —</option>
                                    {options.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-sage-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" strokeWidth={1.5} />
                                Create page
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </AppLayout>
    );
}
