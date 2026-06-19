import { useState, useEffect, useMemo } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    IconFolderOpen, IconFolderPlus, IconGripVertical, IconPlus, IconTrash,
} from '@tabler/icons-react';
import {
    DndContext, PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DocsLayout from '@/Layouts/DocsLayout';
import { Button } from '@/components/ui/button';
import NewWorkspaceModal from '@/components/ui/NewWorkspaceModal';

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)      return 'just now';
    if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function SortableRow({ workspace, draggable }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: String(workspace.id) });

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
            className="group grid grid-cols-[1fr_90px_110px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60"
        >
            <div className="flex min-w-0 items-center gap-2 py-3 pl-3 pr-4">
                {draggable ? (
                    <button
                        type="button"
                        {...listeners}
                        {...attributes}
                        tabIndex={-1}
                        aria-label="Drag to reorder"
                        className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing"
                    >
                        <IconGripVertical className="h-3.5 w-3.5" stroke={1.5} />
                    </button>
                ) : (
                    <span className="w-4 shrink-0" />
                )}
                <IconFolderOpen className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                <Link
                    href={`/workspaces/${workspace.id}`}
                    className="min-w-0"
                >
                    <p className="truncate text-sm font-medium text-foreground transition-colors hover:text-sage-600">
                        {workspace.name}
                    </p>
                    {workspace.description && (
                        <p className="truncate text-xs text-text-secondary">{workspace.description}</p>
                    )}
                </Link>
            </div>
            <div className="py-3 pr-4">
                <span className="text-xs text-text-tertiary">
                    {workspace.documents_count} {workspace.documents_count === 1 ? 'page' : 'pages'}
                </span>
            </div>
            <div className="py-3 pr-4">
                <span className="text-xs text-text-tertiary">{timeAgo(workspace.updated_at)}</span>
            </div>
        </li>
    );
}

export default function WorkspacesIndex({ workspaces: initial }) {
    const { auth } = usePage().props;
    const isAdmin = (auth?.user?.roles ?? []).includes('admin');
    const [workspaces, setWorkspaces] = useState(initial);
    const [modalOpen, setModalOpen]   = useState(false);
    const [sortBy, setSortBy]         = useState('arranged'); // 'arranged' | 'updated'

    useEffect(() => { setWorkspaces(initial); }, [initial]);

    const displayed = useMemo(() => {
        if (sortBy === 'updated') {
            return [...workspaces].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        }
        return workspaces; // already in position order from server
    }, [workspaces, sortBy]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    function handleDragEnd({ active, over }) {
        if (!over || active.id === over.id) return;
        const oldIndex = workspaces.findIndex(w => String(w.id) === active.id);
        const newIndex = workspaces.findIndex(w => String(w.id) === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(workspaces, oldIndex, newIndex);
        setWorkspaces(reordered);
        router.patch('/workspaces/reorder', { ids: reordered.map(w => w.id) }, {
            preserveState: true,
            preserveScroll: true,
        });
    }

    return (
        <DocsLayout>
            <Head title="Workspaces" />

            {/* Header */}
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <h1 className="text-[19px] font-semibold text-foreground">Workspaces</h1>
                    <p className="mt-0.5 text-sm text-text-secondary">
                        {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
                        {' · '}
                        {workspaces.reduce((sum, w) => sum + (w.documents_count ?? 0), 0)} pages
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 self-center">
                    {workspaces.length > 1 && (
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="h-[33px] rounded-sm border border-border bg-surface px-2.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                        >
                            <option value="arranged">Default</option>
                            <option value="updated">Last updated</option>
                        </select>
                    )}
                    {isAdmin && (
                        <Button asChild variant="secondary" className="text-text-secondary hover:text-foreground">
                            <Link href="/trash">
                                <IconTrash stroke={1.5} />
                                Trash
                            </Link>
                        </Button>
                    )}
                    <Button onClick={() => setModalOpen(true)}>
                        <IconPlus stroke={1.5} />
                        New workspace
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_90px_110px] border-b border-border bg-surface-hover py-2.5">
                    <span className="pl-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Workspace</span>
                    <span className="pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Pages</span>
                    <span className="pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Updated</span>
                </div>

                {workspaces.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sage-200 bg-sage-50">
                            <IconFolderPlus className="h-6 w-6 text-sage-500" stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">No workspaces yet</p>
                            <p className="mt-0.5 text-xs text-text-tertiary">Create a workspace to start organising your docs.</p>
                        </div>
                        <Button
                            type="button"
                            size="xs"
                            onClick={() => setModalOpen(true)}
                            className="mt-1"
                        >
                            Create workspace
                        </Button>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={sortBy === 'arranged' ? handleDragEnd : undefined}>
                        <SortableContext items={displayed.map(w => String(w.id))} strategy={verticalListSortingStrategy}>
                            <ul>
                                {displayed.map(w => (
                                    <SortableRow key={w.id} workspace={w} draggable={sortBy === 'arranged'} />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                )}

                {/* Footer */}
                {workspaces.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
                    >
                        <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
                        New workspace
                    </button>
                )}
            </div>

            <NewWorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </DocsLayout>
    );
}
