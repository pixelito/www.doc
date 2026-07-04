import { useState, useEffect, useMemo, useRef } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    IconFileText, IconFolderOpen, IconFolderPlus, IconGripVertical, IconPlus, IconTrash,
    IconArrowsSort, IconCheck, IconDots,
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
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import NewWorkspaceModal from '@/components/ui/NewWorkspaceModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/date';

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)      return 'just now';
    if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(dateStr);
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

export default function WorkspacesIndex({ workspaces: initial, recent = [] }) {
    const { auth } = usePage().props;
    const perms = can(auth);
    const [workspaces, setWorkspaces] = useState(initial);
    const [modalOpen, setModalOpen]   = useState(false);
    const [sortBy, setSortBy]         = useState('arranged'); // 'arranged' | 'updated'

    // Explicit reorder mode (like the page tree's): drags only mutate local
    // state, and the new order is saved once on "Done".
    const [reordering, setReordering] = useState(false);
    const reorderDirty = useRef(false);

    // Warn before losing unsaved moves on close/refresh or any in-app navigation
    // (a workspace row, a nav link, "New workspace"); see the discard modal below.
    const { promptOpen, requestLeave, confirmDiscard, dismissPrompt } = useUnsavedChangesGuard({
        active: reordering,
        dirtyRef: reorderDirty,
        revert: () => { setWorkspaces(initial); setReordering(false); },
    });

    useEffect(() => { setWorkspaces(initial); }, [initial]);

    const displayed = useMemo(() => {
        // While reordering, always show position order — dragging a list that's
        // sorted by "last updated" would persist a meaningless order.
        if (sortBy === 'updated' && !reordering) {
            return [...workspaces].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        }
        return workspaces; // already in position order from server
    }, [workspaces, sortBy, reordering]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    function handleDragEnd({ active, over }) {
        if (!over || active.id === over.id) return;
        const oldIndex = workspaces.findIndex(w => String(w.id) === active.id);
        const newIndex = workspaces.findIndex(w => String(w.id) === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        // Local only — persisted on "Done".
        setWorkspaces(arrayMove(workspaces, oldIndex, newIndex));
        reorderDirty.current = true;
    }

    /** Leave reorder mode, saving the order once if it changed. */
    function finishReorder() {
        setReordering(false);
        if (!reorderDirty.current) return;
        reorderDirty.current = false;
        router.patch('/workspaces/reorder', { ids: workspaces.map(w => w.id) }, {
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
                    {workspaces.length > 1 && !reordering && (
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="ui-select h-[33px] rounded-sm border border-border bg-surface px-2.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-sage-400 focus:ring-[3px] focus:ring-sage-200"
                        >
                            <option value="arranged">Default</option>
                            <option value="updated">Last updated</option>
                        </select>
                    )}
                    {/* Reorder mode owns the header while active; otherwise ONE
                        primary button + the ⋯ menu for occasional actions. */}
                    {reordering ? (
                        <>
                            <Button variant="outline" onClick={requestLeave}>
                                Cancel
                            </Button>
                            <Button onClick={finishReorder}>
                                <IconCheck stroke={1.5} />
                                Done
                            </Button>
                        </>
                    ) : (
                        <>
                            {perms.create && (
                                <Button onClick={() => setModalOpen(true)}>
                                    <IconPlus stroke={1.5} />
                                    New workspace
                                </Button>
                            )}
                            {((perms.update && workspaces.length > 1) || perms.isAdmin) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="border-border px-2 hover:bg-surface-hover"
                                            title="More actions"
                                            aria-label="More actions"
                                        >
                                            <IconDots stroke={1.5} />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                        {perms.update && workspaces.length > 1 && (
                                            <DropdownMenuItem onSelect={() => { reorderDirty.current = false; setReordering(true); }}>
                                                <IconArrowsSort stroke={1.5} />
                                                Reorder workspaces
                                            </DropdownMenuItem>
                                        )}
                                        {perms.isAdmin && (
                                            <DropdownMenuItem asChild>
                                                <Link href="/trash">
                                                    <IconTrash stroke={1.5} />
                                                    View Trash
                                                </Link>
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </>
                    )}
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
                            <IconFolderPlus className="h-6 w-6 text-sage-600" stroke={1.5} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">No workspaces yet</p>
                            <p className="mt-0.5 text-xs text-text-tertiary">Create a workspace to start organising your docs.</p>
                        </div>
                        {perms.create && (
                            <Button
                                type="button"
                                size="xs"
                                onClick={() => setModalOpen(true)}
                                className="mt-1"
                            >
                                Create workspace
                            </Button>
                        )}
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reordering ? handleDragEnd : undefined}>
                        <SortableContext items={displayed.map(w => String(w.id))} strategy={verticalListSortingStrategy}>
                            <ul>
                                {displayed.map(w => (
                                    <SortableRow key={w.id} workspace={w} draggable={reordering && perms.update} />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                )}

                {/* Footer */}
                {workspaces.length > 0 && perms.create && (
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

            {/* Recently updated */}
            {recent.length > 0 && (
                <section className="mt-8">
                    <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">
                        Recently updated
                    </h2>
                    <div className="overflow-hidden rounded-md border border-border bg-card">
                        {recent.map((doc, idx) => (
                            <Link
                                key={doc.id}
                                href={`/documents/${doc.id}`}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover${idx > 0 ? ' border-t border-border-subtle' : ''}`}
                            >
                                <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                    {doc.title}
                                </span>
                                <span className="shrink-0 text-xs text-text-tertiary">
                                    {doc.workspace.name}
                                </span>
                                <span className="shrink-0 pl-3 text-xs text-text-tertiary">
                                    {timeAgo(doc.updated_at)}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <NewWorkspaceModal open={modalOpen} onClose={() => setModalOpen(false)} />

            <ConfirmDialog
                open={promptOpen}
                title="Discard changes?"
                message="You have unsaved order changes. Leaving reorder mode will discard them permanently."
                confirmLabel="Discard changes"
                cancelLabel="Keep reordering"
                variant="danger"
                onConfirm={confirmDiscard}
                onCancel={dismissPrompt}
            />
        </DocsLayout>
    );
}
