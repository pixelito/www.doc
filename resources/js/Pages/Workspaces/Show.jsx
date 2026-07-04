import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { IconChevronRight, IconDots, IconFileText, IconGripVertical, IconPlus, IconTrash, IconUpload, IconFileImport, IconArrowsSort, IconCheck, IconCornerDownRight } from '@tabler/icons-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
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
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import NewPageModal from '@/components/ui/NewPageModal';
import { can } from '@/lib/permissions';

const INDENT = 20; // px of left padding per nesting level

// ── Tree <-> flat-list helpers (for the drag tree) ──────────────────────────

function flattenForDnd(nodes, parentId = null, depth = 0) {
    return nodes.flatMap((node) => [
        { id: node.id, parentId, depth, node },
        ...flattenForDnd(node.children, node.id, depth + 1),
    ]);
}

function getDescendantIds(flat, id) {
    const out = [];
    const stack = [id];
    while (stack.length) {
        const current = stack.pop();
        for (const item of flat) {
            if (item.parentId === current) { out.push(item.id); stack.push(item.id); }
        }
    }
    return out;
}

/** Rebuild the nested tree from a flat list, preserving array order for siblings. */
function buildTree(flat) {
    const builtById = new Map(flat.map((item) => [item.id, { ...item.node, children: [] }]));
    const roots = [];
    for (const item of flat) {
        const built = builtById.get(item.id);
        const parent = item.parentId != null ? builtById.get(item.parentId) : null;
        (parent ? parent.children : roots).push(built);
    }
    return roots;
}

/** Where would the dragged row land — its depth and new parent — given the cursor offset. */
function getProjection(items, activeId, overId, dragOffset, indent) {
    const overIndex = items.findIndex((i) => i.id === overId);
    const activeIndex = items.findIndex((i) => i.id === activeId);
    if (overIndex === -1 || activeIndex === -1) return null;

    const activeItem = items[activeIndex];
    const newItems = arrayMove(items, activeIndex, overIndex);
    const prevItem = newItems[overIndex - 1];
    const nextItem = newItems[overIndex + 1];

    const projectedDepth = activeItem.depth + Math.round(dragOffset / indent);
    const maxDepth = prevItem ? prevItem.depth + 1 : 0;
    const minDepth = nextItem ? nextItem.depth : 0;
    const depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth));

    const parentId = (() => {
        if (depth === 0 || !prevItem) return null;
        if (depth === prevItem.depth) return prevItem.parentId;
        if (depth > prevItem.depth) return prevItem.id;
        return newItems.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null;
    })();

    return { depth, parentId };
}

// ── Static helpers (filtered view, modal options) ───────────────────────────

function collectAllTags(nodes) {
    const map = new Map();
    function walk(n) {
        n.tags.forEach((t) => map.set(t.id, t));
        n.children.forEach(walk);
    }
    nodes.forEach(walk);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function flattenAll(nodes, depth = 0) {
    return nodes.flatMap((n) => [{ ...n, depth }, ...flattenAll(n.children, depth + 1)]);
}

function flattenOptions(nodes, depth = 0, acc = []) {
    for (const node of nodes) {
        acc.push({ id: node.id, label: `${'  '.repeat(depth)}${node.title}` });
        flattenOptions(node.children, depth + 1, acc);
    }
    return acc;
}

// ── Row components ──────────────────────────────────────────────────────────

function TagPill({ name, active }) {
    return (
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
            active ? 'bg-sage-100 text-sage-600' : 'bg-surface border border-border text-text-secondary'
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
            aria-label="Drag to move or nest"
            className="flex h-5 w-4 shrink-0 cursor-grab items-center justify-center text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing"
        >
            <IconGripVertical className="h-3.5 w-3.5" stroke={1.5} />
        </button>
    );
}

function ActionButton({ onClick, href, title, children }) {
    const cls = "flex h-6 w-6 items-center justify-center rounded-sm border border-transparent text-text-tertiary opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:border-border hover:bg-sage-50 hover:border-sage-200 hover:text-sage-600";
    return href
        ? <Link href={href} title={title} onClick={(e) => e.stopPropagation()} className={cls}>{children}</Link>
        : <button type="button" onClick={onClick} title={title} className={cls}>{children}</button>;
}

function RowActions({ node, workspaceId, onAddChild }) {
    return (
        <div className="flex items-center justify-end gap-1">
            <ActionButton href={`/workspaces/${workspaceId}/imports/create?parent_id=${node.id}`} title="Import as subpage">
                <IconFileImport className="h-3.5 w-3.5" stroke={1.5} />
            </ActionButton>
            <ActionButton onClick={() => onAddChild(node.id)} title="Add subpage">
                <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
            </ActionButton>
        </div>
    );
}

// ── Tree guides (see .examples/tree-view-unlimited-nesting.webp) ─────────────
// The drag handle lives in its own fixed gutter at the far left (GRIP_GUTTER wide),
// OUTSIDE the tree indent, so the spines and branches never cross it. Within the
// content, each level's node (icon/dot) sits at NODE_X + depth*INDENT from the row's
// left edge: pl-3 (12) + grip gutter (20) + half node (8) = 40 at depth 0. A level's
// spine drops straight down UNDER its parent's node and branches one INDENT right into
// each child's node, so the whole thing reads as one continuous line with rounded turns.
const GUIDE = 'border-text-tertiary/55';   // line colour: visible on cream, not loud
const GUIDE_R = 7;            // corner radius where the lines turn
const NODE_X = 40;            // x of a depth-0 node (centre) from the row's left edge
const GUIDE_REACH = INDENT - 6; // branch length: spine across to the child icon's left edge
const GRIP_GUTTER = 'w-5';    // fixed drag-handle gutter (20px) — keep in sync with NODE_X
// Rows carry a 1px border; every vertical segment bleeds GUIDE_BLEED past the row edge(s)
// so neighbouring slices overlap across that hairline and read as one continuous line.
const GUIDE_BLEED = 1;

function TreeRow({ id, depth, node, activeTagId, workspaceId, onAddChild, canCreate, canReorder, ghost, dragging, pathLast, isDropParent }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id, disabled: !canReorder });

    const isRoot = depth === 0;
    const hasChildren = (node.children?.length ?? 0) > 0;

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: ghost || isDragging ? 0.4 : 1 }}
            className={`group relative grid grid-cols-[1fr_110px_64px] items-center border-b border-border-subtle last:border-0 transition-colors ${
                isDropParent ? 'bg-sage-50 ring-1 ring-inset ring-sage-300' : 'hover:bg-surface-hover/60'
            }`}
        >
            {/* Tree guides on a full-height layer anchored to the <li> (not the
                vertically-centred content cell, which was the source of the gaps). Each
                level's spine sits UNDER its parent's node: the row's own spine drops from
                the top to its centre and rounds right into its node with a ╰, carrying on
                down only if it isn't the last child. A page with children drops a spine
                straight from under its own node to its first child. Ancestor spines pass
                straight through while that ancestor still has siblings below. Every
                segment bleeds GUIDE_BLEED past the 1px row borders so the per-row slices
                overlap and read as one continuous line. Hidden mid-drag: depths and the
                last-child flags shift while reordering, which would paint stray segments. */}
            {!dragging && (depth > 0 || hasChildren) && (
                <span aria-hidden className="pointer-events-none absolute inset-0">
                    {depth > 0 && Array.from({ length: depth }).map((_, i) => {
                        const x = NODE_X + i * INDENT;   // spine under the depth-(i+1) node
                        const continues = pathLast ? !pathLast[i + 1] : true;
                        if (i === depth - 1) {
                            return (
                                <React.Fragment key={i}>
                                    {/* ╰: spine down to the centre, rounding right into this node */}
                                    <span className={`absolute border-l border-b ${GUIDE} rounded-bl-[7px]`} style={{ left: x, top: -GUIDE_BLEED, height: `calc(50% + ${GUIDE_BLEED}px)`, width: GUIDE_REACH }} />
                                    {/* carry the spine down to the next sibling */}
                                    {continues && <span className={`absolute border-l ${GUIDE}`} style={{ left: x, top: `calc(50% - ${GUIDE_R}px)`, bottom: -GUIDE_BLEED }} />}
                                </React.Fragment>
                            );
                        }
                        return continues ? <span key={i} className={`absolute border-l ${GUIDE}`} style={{ left: x, top: -GUIDE_BLEED, bottom: -GUIDE_BLEED }} /> : null;
                    })}
                    {hasChildren && (
                        /* spine dropping to the first child — starts just below this row's
                           own icon (8px = half the 16px icon) so it doesn't run through it */
                        <span className={`absolute border-l ${GUIDE}`} style={{ left: NODE_X + depth * INDENT, top: 'calc(50% + 8px)', bottom: -GUIDE_BLEED }} />
                    )}
                </span>
            )}
            <div className="relative flex min-w-0 items-center py-2.5 pr-4 pl-3">
                {/* Fixed drag-handle gutter, kept out of the tree indent so the guides
                    never cross it (empty but reserved when not reordering). */}
                <span className={`flex ${GRIP_GUTTER} shrink-0 items-center justify-center`}>
                    {canReorder && <GripHandle listeners={listeners} attributes={attributes} />}
                </span>
                <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${depth * INDENT}px` }}>
                    {/* Every page is a document, so all rows share the file icon; the
                        rounded guide lines carry the hierarchy, and the branch stops at
                        the icon's left edge. */}
                    <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                    <Link
                        href={`/documents/${node.id}`}
                        className={`truncate text-sm transition-colors hover:text-sage-600 ${isRoot ? 'font-medium text-foreground' : 'text-text-secondary'}`}
                    >
                        {node.title}
                    </Link>
                    {node.tags.slice(0, isRoot ? 2 : 1).map((t) => (
                        <TagPill key={t.id} name={t.name} active={activeTagId === t.id} />
                    ))}
                    {isDropParent && (
                        <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-100 px-1.5 py-0.5 text-[10px] font-medium text-sage-700">
                            <IconCornerDownRight className="h-3 w-3" stroke={1.5} />
                            New parent
                        </span>
                    )}
                </div>
            </div>
            <div className="py-2.5 pr-4">
                <span className="text-xs text-text-tertiary">{node.updated_at}</span>
            </div>
            <div className="flex items-center justify-end py-2.5 pr-2">
                {canCreate && <RowActions node={node} workspaceId={workspaceId} onAddChild={onAddChild} />}
            </div>
        </li>
    );
}

function FilteredRow({ node }) {
    return (
        <li className="grid grid-cols-[1fr_110px_64px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60">
            <div className="flex min-w-0 items-center gap-2 py-3 pl-4 pr-4">
                <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                <Link href={`/documents/${node.id}`} className="truncate text-sm font-medium text-foreground transition-colors hover:text-sage-600">
                    {node.title}
                </Link>
                {node.tags.map((t) => <TagPill key={t.id} name={t.name} active={true} />)}
            </div>
            <div className="py-3 pr-4"><span className="text-xs text-text-tertiary">{node.updated_at}</span></div>
            <div />
        </li>
    );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function WorkspaceShow({ workspace, tree, templates = [] }) {
    const { auth } = usePage().props;
    const perms = can(auth);
    const [rootNodes, setRootNodes] = useState(tree);
    const [activeTag, setActiveTag] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalParentId, setModalParentId] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);

    // Reorder is an explicit mode (like edit mode): off by default so a stray
    // drag can't rearrange the tree, toggled on to expose the drag handles.
    // Drags only mutate local state; the tree is persisted once, on "Done".
    const [reordering, setReordering] = useState(false);
    const reorderDirty = useRef(false);

    // Warn before losing unsaved moves on close/refresh or any in-app navigation
    // (a page link, a sidebar action, or "New page"); see the discard modal below.
    const { promptOpen, requestLeave, confirmDiscard, dismissPrompt } = useUnsavedChangesGuard({
        active: reordering,
        dirtyRef: reorderDirty,
        revert: () => { setRootNodes(tree); setReordering(false); },
    });

    // Drag state
    const [activeId, setActiveId] = useState(null);
    const [overId, setOverId] = useState(null);
    const [offsetLeft, setOffsetLeft] = useState(0);

    useEffect(() => { setRootNodes(tree); }, [tree]);

    const allTags = useMemo(() => collectAllTags(rootNodes), [rootNodes]);
    const filteredRows = useMemo(() => {
        if (!activeTag) return null;
        return flattenAll(rootNodes).filter((n) => n.tags.some((t) => t.id === activeTag));
    }, [rootNodes, activeTag]);

    const options = useMemo(() => flattenOptions(rootNodes), [rootNodes]);

    // For each row, the "is last child" flag of every node on its path root→row.
    // The tree guides use it to draw spines that stop at the last child (└) and
    // skip levels whose ancestor was itself a last child.
    const guideFlags = useMemo(() => {
        const flat = flattenForDnd(rootNodes);
        const byId = new Map(flat.map((i) => [i.id, i]));
        const groups = new Map();
        for (const it of flat) {
            const k = it.parentId ?? 'root';
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(it);
        }
        const lastSet = new Set();
        for (const arr of groups.values()) lastSet.add(arr[arr.length - 1].id);
        const map = new Map();
        for (const it of flat) {
            const flags = [];
            for (let cur = it; cur; cur = cur.parentId != null ? byId.get(cur.parentId) : null) {
                flags.unshift(lastSet.has(cur.id));
            }
            map.set(it.id, flags);   // index k = isLast of the path node at depth k
        }
        return map;
    }, [rootNodes]);

    // Flat list for the tree, with the dragged row's descendants hidden while dragging.
    const flattenedItems = useMemo(() => {
        const flat = flattenForDnd(rootNodes);
        if (activeId == null) return flat;
        const descendants = getDescendantIds(flat, activeId);
        return flat.filter((i) => i.id === activeId || !descendants.includes(i.id));
    }, [rootNodes, activeId]);

    const projected = activeId != null && overId != null
        ? getProjection(flattenedItems, activeId, overId, offsetLeft, INDENT)
        : null;

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    function openModal(parentId = '') {
        setModalParentId(String(parentId));
        setModalOpen(true);
    }

    function resetDrag() {
        setActiveId(null);
        setOverId(null);
        setOffsetLeft(0);
    }

    function handleDragEnd({ active, over }) {
        const projection = over && activeId != null
            ? getProjection(flattenedItems, active.id, over.id, offsetLeft, INDENT)
            : null;
        resetDrag();
        if (!over || !projection) return;

        const full = flattenForDnd(rootNodes);
        const activeIndex = full.findIndex((i) => i.id === active.id);
        const overIndex = full.findIndex((i) => i.id === over.id);
        if (activeIndex === -1 || overIndex === -1) return;

        const original = full[activeIndex];
        if (active.id === over.id && original.parentId === projection.parentId && original.depth === projection.depth) {
            return; // dropped in place, no change
        }

        full[activeIndex] = { ...original, depth: projection.depth, parentId: projection.parentId };
        const sorted = arrayMove(full, activeIndex, overIndex);
        setRootNodes(buildTree(sorted));
        // Don't persist per-drop — accumulate locally and save the whole tree on "Done".
        reorderDirty.current = true;
    }

    /** Leave reorder mode, persisting the whole tree once if anything moved. */
    function finishReorder() {
        setReordering(false);
        if (!reorderDirty.current) return;
        reorderDirty.current = false;

        const posByParent = new Map();
        const nodes = flattenForDnd(rootNodes).map((i) => {
            const key = i.parentId ?? 0;
            const position = posByParent.get(key) ?? 0;
            posByParent.set(key, position + 1);
            return { id: i.id, parent_id: i.parentId ?? null, position };
        });

        router.patch(`/workspaces/${workspace.id}/tree`, { nodes },
            { preserveState: true, preserveScroll: true });
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
                                <Button onClick={() => openModal('')}>
                                    <IconPlus stroke={1.5} />
                                    New page
                                </Button>
                            )}
                            {(perms.create || perms.update || perms.delete) && (
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
                                        {perms.update && rootNodes.length > 0 && !activeTag && (
                                            <DropdownMenuItem onSelect={() => { reorderDirty.current = false; setReordering(true); }}>
                                                <IconArrowsSort stroke={1.5} />
                                                Reorder pages
                                            </DropdownMenuItem>
                                        )}
                                        {perms.create && (
                                            <DropdownMenuItem asChild>
                                                <Link href={`/workspaces/${workspace.id}/imports/create`}>
                                                    <IconUpload stroke={1.5} />
                                                    Import pages…
                                                </Link>
                                            </DropdownMenuItem>
                                        )}
                                        {perms.delete && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onSelect={() => setDeleteOpen(true)}
                                                    className="text-danger focus:bg-danger-surface focus:text-danger"
                                                >
                                                    <IconTrash stroke={1.5} />
                                                    Move to Trash
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Tag filter chips */}
            {allTags.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-text-tertiary">Filter:</span>
                    {allTags.map((tag) => (
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
                <div className="grid grid-cols-[1fr_110px_64px] border-b border-border bg-surface-hover py-2.5">
                    <span className="pl-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Page</span>
                    <span className="pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Updated</span>
                    <span />
                </div>

                {filteredRows ? (
                    filteredRows.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-text-tertiary">No pages match this filter.</p>
                    ) : (
                        <ul>{filteredRows.map((node) => <FilteredRow key={node.id} node={node} />)}</ul>
                    )
                ) : (
                    rootNodes.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-text-tertiary">No pages yet.</p>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={({ active }) => { setActiveId(active.id); setOverId(active.id); }}
                            onDragMove={({ delta }) => setOffsetLeft(delta.x)}
                            onDragOver={({ over }) => setOverId(over?.id ?? null)}
                            onDragEnd={perms.update && reordering ? handleDragEnd : resetDrag}
                            onDragCancel={resetDrag}
                        >
                            <SortableContext items={flattenedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                <ul>
                                    {flattenedItems.map((item) => (
                                        <TreeRow
                                            key={item.id}
                                            id={item.id}
                                            depth={item.id === activeId && projected ? projected.depth : item.depth}
                                            node={item.node}
                                            activeTagId={activeTag}
                                            workspaceId={workspace.id}
                                            onAddChild={openModal}
                                            canCreate={perms.create && !reordering}
                                            canReorder={perms.update && reordering}
                                            ghost={item.id === activeId}
                                            dragging={activeId != null}
                                            pathLast={guideFlags.get(item.id)}
                                            isDropParent={projected?.parentId != null && projected.parentId === item.id && item.id !== activeId}
                                        />
                                    ))}
                                </ul>
                            </SortableContext>
                        </DndContext>
                    )
                )}

                {/* New page footer button */}
                {perms.create && !reordering && (
                    <button
                        type="button"
                        onClick={() => openModal('')}
                        className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
                    >
                        <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
                        New page
                    </button>
                )}
            </div>

            {reordering && rootNodes.length > 0 && !filteredRows && (
                <p className="mt-2 px-1 text-xs text-sage-600">
                    Drag a page up or down to reorder, or sideways to nest it under another page. Click “Done” when finished.
                </p>
            )}
        </DocsLayout>

        <NewPageModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            workspaceId={workspace.id}
            parentOptions={options}
            initialParentId={modalParentId}
            templates={templates}
        />

        <ConfirmDialog
            open={deleteOpen}
            title={`Delete "${workspace.name}"?`}
            message={`This workspace and all ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} inside it will be moved to Trash. You can restore them later from there.`}
            confirmLabel="Move to Trash"
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={destroyWorkspace}
            onCancel={() => setDeleteOpen(false)}
        />

        <ConfirmDialog
            open={promptOpen}
            title="Discard changes?"
            message="You have unsaved page-order changes. Leaving reorder mode will discard them permanently."
            confirmLabel="Discard changes"
            cancelLabel="Keep reordering"
            variant="danger"
            onConfirm={confirmDiscard}
            onCancel={dismissPrompt}
        />
        </>
    );
}
