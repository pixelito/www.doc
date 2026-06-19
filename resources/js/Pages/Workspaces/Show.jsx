import React, { useState, useEffect, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { IconChevronRight, IconFileText, IconGripVertical, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    arrayMove,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DocsLayout from '@/Layouts/DocsLayout';
import { Button } from '@/components/ui/button';
import NewPageModal from '@/components/ui/NewPageModal';

function collectAllTags(nodes) {
    const map = new Map();
    function walk(n) {
        n.tags.forEach(t => map.set(t.id, t));
        n.children.forEach(walk);
    }
    nodes.forEach(walk);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function flattenTree(nodes, depth = 0) {
    return nodes.flatMap(n => [
        { ...n, depth },
        ...flattenTree(n.children, depth + 1),
    ]);
}

function flatten(nodes, depth = 0, acc = []) {
    for (const node of nodes) {
        acc.push({ id: node.id, label: `${'  '.repeat(depth)}${node.title}` });
        flatten(node.children, depth + 1, acc);
    }
    return acc;
}

function updateChildren(nodes, parentId, activeId, overId) {
    return nodes.map(node => {
        if (node.id === parentId) {
            const oldIdx = node.children.findIndex(c => String(c.id) === activeId);
            const newIdx = node.children.findIndex(c => String(c.id) === overId);
            if (oldIdx === -1 || newIdx === -1) return node;
            return { ...node, children: arrayMove(node.children, oldIdx, newIdx) };
        }
        if (node.children.length > 0) {
            return { ...node, children: updateChildren(node.children, parentId, activeId, overId) };
        }
        return node;
    });
}

function getChildrenIds(nodes, parentId) {
    for (const node of nodes) {
        if (node.id === parentId) return node.children.map(c => c.id);
        const ids = getChildrenIds(node.children, parentId);
        if (ids) return ids;
    }
    return null;
}

function TagPill({ name, active }) {
    return (
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
            active
                ? 'bg-sage-100 text-sage-600'
                : 'bg-surface border border-border text-text-secondary'
        }`}>
            {name}
        </span>
    );
}

function GripHandle({ listeners, attributes }) {
    return (
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
    );
}

function AddChildButton({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title="Add subpage"
            className="flex h-6 w-6 items-center justify-center rounded-sm border border-transparent text-text-tertiary opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:border-border hover:bg-sage-50 hover:border-sage-200 hover:text-sage-600"
        >
            <IconPlus className="h-3.5 w-3.5" stroke={2} />
        </button>
    );
}

function SortableChildRow({ node, depth, parentId, onAddChild }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: String(node.id), data: { parentId } });

    return (
        <>
            <li
                ref={setNodeRef}
                style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
                className="group grid grid-cols-[1fr_110px_32px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60"
            >
                <div
                    className="flex min-w-0 items-center gap-2 py-2.5 pr-4"
                    style={{ paddingLeft: `${depth * 20 + 12}px` }}
                >
                    <GripHandle listeners={listeners} attributes={attributes} />
                    <IconFileText className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                    <Link
                        href={`/documents/${node.id}`}
                        className="truncate text-sm text-text-secondary transition-colors hover:text-sage-600"
                    >
                        {node.title}
                    </Link>
                    {node.tags.slice(0, 1).map(t => (
                        <TagPill key={t.id} name={t.name} active={false} />
                    ))}
                </div>
                <div className="py-2.5 pr-4">
                    <span className="text-xs text-text-tertiary">{node.updated_at}</span>
                </div>
                <div className="flex items-center justify-center py-2.5 pr-1.5">
                    <AddChildButton onClick={() => onAddChild(node.id)} />
                </div>
            </li>

            {node.children.length > 0 && (
                <SortableContext
                    items={node.children.map(c => String(c.id))}
                    strategy={verticalListSortingStrategy}
                >
                    {node.children.map(child => (
                        <SortableChildRow
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            parentId={node.id}
                            onAddChild={onAddChild}
                        />
                    ))}
                </SortableContext>
            )}
        </>
    );
}

function SortableRow({ node, activeTagId, onAddChild }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: String(node.id), data: { parentId: null } });

    return (
        <>
            <li
                ref={setNodeRef}
                style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
                className="group grid grid-cols-[1fr_110px_32px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60"
            >
                <div className="flex min-w-0 items-center gap-2 py-3 pl-3 pr-4">
                    <GripHandle listeners={listeners} attributes={attributes} />
                    <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                    <Link
                        href={`/documents/${node.id}`}
                        className="truncate text-sm font-medium text-foreground transition-colors hover:text-sage-600"
                    >
                        {node.title}
                    </Link>
                    {node.tags.slice(0, 2).map(t => (
                        <TagPill key={t.id} name={t.name} active={activeTagId === t.id} />
                    ))}
                </div>
                <div className="py-3 pr-4">
                    <span className="text-xs text-text-tertiary">{node.updated_at}</span>
                </div>
                <div className="flex items-center justify-center py-3 pr-1.5">
                    <AddChildButton onClick={() => onAddChild(node.id)} />
                </div>
            </li>

            {node.children.length > 0 && (
                <SortableContext
                    items={node.children.map(c => String(c.id))}
                    strategy={verticalListSortingStrategy}
                >
                    {node.children.map(child => (
                        <SortableChildRow
                            key={child.id}
                            node={child}
                            depth={1}
                            parentId={node.id}
                            onAddChild={onAddChild}
                        />
                    ))}
                </SortableContext>
            )}
        </>
    );
}

function FilteredRow({ node }) {
    return (
        <li className="grid grid-cols-[1fr_110px_32px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60">
            <div className="flex min-w-0 items-center gap-2 py-3 pl-4 pr-4">
                <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                <Link
                    href={`/documents/${node.id}`}
                    className="truncate text-sm font-medium text-foreground transition-colors hover:text-sage-600"
                >
                    {node.title}
                </Link>
                {node.tags.map(t => (
                    <TagPill key={t.id} name={t.name} active={true} />
                ))}
            </div>
            <div className="py-3 pr-4">
                <span className="text-xs text-text-tertiary">{node.updated_at}</span>
            </div>
            <div />
        </li>
    );
}

export default function WorkspaceShow({ workspace, tree }) {
    const [rootNodes, setRootNodes] = useState(tree);
    const [activeTag, setActiveTag] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalParentId, setModalParentId] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);

    useEffect(() => { setRootNodes(tree); }, [tree]);

    const allTags = useMemo(() => collectAllTags(rootNodes), [rootNodes]);
    const filteredRows = useMemo(() => {
        if (!activeTag) return null;
        return flattenTree(rootNodes).filter(n => n.tags.some(t => t.id === activeTag));
    }, [rootNodes, activeTag]);

    const options = useMemo(() => flatten(rootNodes), [rootNodes]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    function openModal(parentId = '') {
        setModalParentId(String(parentId));
        setModalOpen(true);
    }

    function handleDragEnd({ active, over }) {
        if (!over || active.id === over.id) return;

        const activeParent = active.data.current?.parentId ?? null;
        const overParent   = over.data.current?.parentId ?? null;

        if (activeParent !== overParent) return;

        if (activeParent === null) {
            const oldIndex = rootNodes.findIndex(n => String(n.id) === active.id);
            const newIndex = rootNodes.findIndex(n => String(n.id) === over.id);
            if (oldIndex === -1 || newIndex === -1) return;
            const reordered = arrayMove(rootNodes, oldIndex, newIndex);
            setRootNodes(reordered);
            router.patch('/documents/reorder', { ids: reordered.map(n => n.id) }, { preserveState: true, preserveScroll: true });
        } else {
            const updated = updateChildren(rootNodes, activeParent, active.id, over.id);
            setRootNodes(updated);
            const ids = getChildrenIds(updated, activeParent);
            if (ids) router.patch('/documents/reorder', { ids }, { preserveState: true, preserveScroll: true });
        }
    }

    function destroyWorkspace() {
        router.delete(`/workspaces/${workspace.id}`);
    }

    const pageCount = workspace.documents_count ?? rootNodes.length;

    return (
        <>
        <DocsLayout>
            <Head title={workspace.name} />

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Link href="/workspaces" className="transition-colors hover:text-foreground">Workspaces</Link>
                <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                <span className="text-foreground">{workspace.name}</span>
            </nav>

            {/* Header */}
            <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-[19px] font-semibold text-foreground">{workspace.name}</h1>
                    <p className="mt-0.5 text-sm text-text-secondary">
                        {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                        {workspace.description ? ` · ${workspace.description}` : ''}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/workspaces/${workspace.id}/imports/create`}>
                            <IconUpload className="h-3.5 w-3.5" stroke={1.5} />
                            Import
                        </Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-border text-danger hover:bg-danger/10 hover:border-danger/20 hover:text-danger"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <IconTrash className="h-3.5 w-3.5" stroke={1.5} />
                        Delete
                    </Button>
                </div>
            </div>

            {/* Tag filter chips */}
            {allTags.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-text-tertiary">Filter:</span>
                    {allTags.map(tag => (
                        <button
                            key={tag.id}
                            type="button"
                            onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)}
                            className={`rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${
                                activeTag === tag.id
                                    ? 'bg-sage-100 text-sage-600'
                                    : 'border border-border bg-surface text-text-secondary hover:bg-surface-hover'
                            }`}
                        >
                            {tag.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Page table */}
            <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_110px_32px] border-b border-border bg-surface-hover px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Page</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Updated</span>
                    <span />
                </div>

                {filteredRows ? (
                    rootNodes.length === 0 || filteredRows.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-text-tertiary">
                            {filteredRows.length === 0 ? 'No pages match this filter.' : 'No pages yet.'}
                        </p>
                    ) : (
                        <ul>
                            {filteredRows.map(node => (
                                <FilteredRow key={node.id} node={node} />
                            ))}
                        </ul>
                    )
                ) : (
                    rootNodes.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-text-tertiary">No pages yet.</p>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={rootNodes.map(n => String(n.id))} strategy={verticalListSortingStrategy}>
                                <ul>
                                    {rootNodes.map(node => (
                                        <SortableRow
                                            key={node.id}
                                            node={node}
                                            activeTagId={activeTag}
                                            onAddChild={openModal}
                                        />
                                    ))}
                                </ul>
                            </SortableContext>
                        </DndContext>
                    )
                )}

                {/* New page footer button */}
                <button
                    type="button"
                    onClick={() => openModal('')}
                    className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
                >
                    <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
                    New page
                </button>
            </div>
        </DocsLayout>

        <NewPageModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            workspaceId={workspace.id}
            parentOptions={options}
            initialParentId={modalParentId}
        />

        <ConfirmDialog
            open={deleteOpen}
            title={`Delete "${workspace.name}"?`}
            message={`This will permanently delete the workspace and all ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} inside it. This cannot be undone.`}
            confirmLabel="Delete workspace"
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={destroyWorkspace}
            onCancel={() => setDeleteOpen(false)}
        />
        </>
    );
}
