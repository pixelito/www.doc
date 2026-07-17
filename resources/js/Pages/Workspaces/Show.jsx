import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { IconChevronRight, IconDots, IconFileText, IconGripVertical, IconPencil, IconPlus, IconStar, IconStarFilled, IconTrash, IconUpload, IconFileImport, IconArrowsSort, IconCheck, IconCornerDownRight, IconLibrary } from '@tabler/icons-react';
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
import WorkspaceFormModal from '@/components/ui/WorkspaceFormModal';
import ImportDialog from '@/components/ui/ImportDialog';
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
            active ? 'bg-accent-100 text-accent-600' : 'bg-surface border border-border text-text-secondary'
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
    const cls = "flex h-6 w-6 items-center justify-center rounded-sm border border-transparent text-text-tertiary opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:border-border hover:bg-accent-50 hover:border-accent-200 hover:text-accent-600";
    return href
        ? <Link href={href} title={title} onClick={(e) => e.stopPropagation()} className={cls}>{children}</Link>
        : <button type="button" onClick={onClick} title={title} className={cls}>{children}</button>;
}

function RowActions({ node, onAddChild, onImport }) {
    return (
        <div className="flex items-center justify-end gap-1">
            <ActionButton onClick={() => onImport(node.id)} title="Import as subpage">
                <IconFileImport className="h-3.5 w-3.5" stroke={1.5} />
            </ActionButton>
            <ActionButton onClick={() => onAddChild(node.id)} title="Add subpage">
                <IconPlus className="h-3.5 w-3.5" stroke={1.5} />
            </ActionButton>
        </div>
    );
}

/**
 * Per-user star toggle on a tree row. Hover-revealed like the row actions,
 * but a starred page keeps its (filled) star visible — that's the point.
 */
function StarButton({ node, starred }) {
    return (
        <button
            type="button"
            onClick={() => router.post(`/documents/${node.id}/star`, {}, { preserveScroll: true, preserveState: true })}
            title={starred ? 'Unstar' : 'Star'}
            aria-pressed={starred}
            className={`flex h-6 w-6 items-center justify-center rounded-sm border border-transparent transition-all duration-150 group-hover:border-border hover:bg-accent-50 hover:border-accent-200 ${
                starred
                    ? 'text-warning opacity-100'
                    : 'text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-warning'
            }`}
        >
            {starred
                ? <IconStarFilled className="h-3.5 w-3.5" />
                : <IconStar className="h-3.5 w-3.5" stroke={1.5} />}
        </button>
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

function TreeRow({ id, depth, node, activeTagId, onAddChild, onImport, canCreate, canReorder, ghost, dragging, pathLast, isDropParent, starred = false, isReordering = false }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id, disabled: !canReorder });

    const isRoot = depth === 0;
    const hasChildren = (node.children?.length ?? 0) > 0;

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: ghost || isDragging ? 0.4 : 1 }}
            className={`group relative grid grid-cols-[1fr_110px_96px] items-center border-b border-border-subtle last:border-0 transition-colors ${
                isDropParent ? 'bg-accent-50 ring-1 ring-inset ring-accent-300' : 'hover:bg-surface-hover/60'
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
                        className={`truncate text-sm transition-colors group-hover:text-accent-600 ${isRoot ? 'font-medium text-foreground' : 'text-text-secondary'}`}
                        title={node.title}
                    >
                        {node.title}
                    </Link>
                    {node.tags.slice(0, isRoot ? 2 : 1).map((t) => (
                        <TagPill key={t.id} name={t.name} active={activeTagId === t.id} />
                    ))}
                    {isDropParent && (
                        <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium text-accent-700">
                            <IconCornerDownRight className="h-3 w-3" stroke={1.5} />
                            New parent
                        </span>
                    )}
                </div>
            </div>
            <div className="py-2.5 pr-4">
                <span className="text-xs text-text-tertiary">{node.updated_at}</span>
            </div>
            <div className="flex items-center justify-end gap-1 py-2.5 pr-2">
                {/* Star is personal and role-independent — outside canCreate. */}
                {!dragging && !isReordering && <StarButton node={node} starred={starred} />}
                {canCreate && <RowActions node={node} onAddChild={onAddChild} onImport={onImport} />}
            </div>
        </li>
    );
}

/**
 * A top-level "folder" page (a root page that has children) rendered as a
 * collapsible shelf section — the same design as workspace groups on the index,
 * adapted into the page grid. Because it stays a real page, the title links to
 * it (opening its Contents view); the chevron only toggles the section. The
 * chevron sits in the grip gutter so the folder icon lands at the same NODE_X as
 * any depth-0 row, keeping the tree guide that drops to its first child aligned.
 * Only used in the normal reading view; reorder mode shows the plain tree.
 */
function ShelfHeaderRow({ node, collapsed, onToggle, canCreate, onAddChild, onImport, starred, isReordering }) {
    const childCount = node.children?.length ?? 0;

    return (
        <li className="group relative grid grid-cols-[1fr_110px_96px] items-center border-b border-border-subtle last:border-0 bg-surface-hover/50 transition-colors hover:bg-surface-hover">
            {/* Spine dropping to the first child (only when expanded) — same geometry
                as TreeRow's hasChildren guide so children connect under the folder. */}
            {!collapsed && childCount > 0 && (
                <span aria-hidden className="pointer-events-none absolute inset-0">
                    <span className={`absolute border-l ${GUIDE}`} style={{ left: NODE_X, top: 'calc(50% + 8px)', bottom: -GUIDE_BLEED }} />
                </span>
            )}
            <div className="relative flex min-w-0 items-center py-2 pr-4 pl-3">
                {/* Chevron in the reserved grip gutter → folder icon aligns to NODE_X. */}
                <span className={`flex ${GRIP_GUTTER} shrink-0 items-center justify-center`}>
                    <button
                        type="button"
                        onClick={onToggle}
                        aria-expanded={!collapsed}
                        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${node.title}`}
                        className="flex h-5 w-5 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-foreground"
                    >
                        <IconChevronRight className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`} stroke={1.5} />
                    </button>
                </span>
                <div className="flex min-w-0 items-center gap-2">
                    <IconLibrary className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                    <Link
                        href={`/documents/${node.id}`}
                        className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent-600"
                        title={node.title}
                    >
                        {node.title}
                    </Link>
                    <span className="shrink-0 text-xs text-text-tertiary">({childCount})</span>
                </div>
            </div>
            <div className="py-2 pr-4" />
            <div className="flex items-center justify-end gap-1 py-2 pr-2">
                {!isReordering && <StarButton node={node} starred={starred} />}
                {canCreate && <RowActions node={node} onAddChild={onAddChild} onImport={onImport} />}
            </div>
        </li>
    );
}

function FilteredRow({ node }) {
    return (
        <li className="group grid grid-cols-[1fr_110px_96px] items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60">
            <div className="flex min-w-0 items-center gap-2 py-3 pl-4 pr-4">
                <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary" stroke={1.5} />
                <Link href={`/documents/${node.id}`} className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent-600" title={node.title}>
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

export default function WorkspaceShow({ workspace, tree, templates = [], starredIds = [] }) {
    const { auth } = usePage().props;
    const perms = can(auth);
    const starredSet = useMemo(() => new Set(starredIds), [starredIds]);
    const [rootNodes, setRootNodes] = useState(tree);
    const [activeTag, setActiveTag] = useState(null);

    // Collapsed top-level "folder" shelves (root pages that have children), by
    // page id. Per-device, per-workspace — same treatment as the group sections
    // on the Workspaces index.
    const shelfKey = `wwwdoc:wsshelves:${workspace.id}`;
    const [collapsedShelves, setCollapsedShelves] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem(shelfKey) || '[]')); }
        catch { return new Set(); }
    });
    function toggleShelf(id) {
        setCollapsedShelves((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            localStorage.setItem(shelfKey, JSON.stringify([...next]));
            return next;
        });
    }
    const [modalOpen, setModalOpen] = useState(false);
    const [modalParentId, setModalParentId] = useState('');
    const [importOpen, setImportOpen] = useState(false);
    const [importParentId, setImportParentId] = useState('');
    const [importFiles, setImportFiles] = useState(null);
    const [dropActive, setDropActive] = useState(false);
    const [pendingImportJobs, setPendingImportJobs] = useState([]);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

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

    // Normal reading view renders top-level folders as collapsible shelves;
    // reorder and tag-filter views fall back to the plain flat tree.
    const showShelves = !reordering && !activeTag;

    // Hide the descendants of any collapsed shelf (normal view only). Reorder mode
    // ignores collapse entirely, so every row stays reachable to drag.
    const visibleItems = useMemo(() => {
        if (!showShelves || collapsedShelves.size === 0) return flattenedItems;
        const full = flattenForDnd(rootNodes);
        const hidden = new Set();
        for (const id of collapsedShelves) {
            for (const d of getDescendantIds(full, id)) hidden.add(d);
        }
        return flattenedItems.filter((i) => !hidden.has(i.id));
    }, [flattenedItems, rootNodes, collapsedShelves, showShelves]);

    const projected = activeId != null && overId != null
        ? getProjection(flattenedItems, activeId, overId, offsetLeft, INDENT)
        : null;

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    function openModal(parentId = '') {
        setModalParentId(String(parentId));
        setModalOpen(true);
    }

    function openImport(parentId = '') {
        setImportParentId(String(parentId));
        setImportFiles(null);
        setImportOpen(true);
    }

    // Drop OS files anywhere on the page to import them. Only reacts to real
    // file drags (dataTransfer.types has "Files") — the tree's reorder drag is
    // dnd-kit pointer events and never fires these — and stays inert for
    // viewers, during reorder mode, and while the dialog is already open.
    useEffect(() => {
        if (!perms.create || importOpen || reordering) return;

        let depth = 0; // dragenter/leave fire per element; count nesting
        const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

        const onEnter = (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            if (++depth === 1) setDropActive(true);
        };
        const onLeave = (e) => {
            if (!hasFiles(e)) return;
            if (depth > 0 && --depth === 0) setDropActive(false);
        };
        const onOver = (e) => { if (hasFiles(e)) e.preventDefault(); };
        const onDrop = (e) => {
            depth = 0;
            setDropActive(false);
            if (!hasFiles(e)) return;
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length === 0) return;
            setImportParentId('');
            setImportFiles(files);
            setImportOpen(true);
        };

        window.addEventListener('dragenter', onEnter);
        window.addEventListener('dragleave', onLeave);
        window.addEventListener('dragover', onOver);
        window.addEventListener('drop', onDrop);
        return () => {
            window.removeEventListener('dragenter', onEnter);
            window.removeEventListener('dragleave', onLeave);
            window.removeEventListener('dragover', onOver);
            window.removeEventListener('drop', onDrop);
            setDropActive(false);
        };
    }, [perms.create, importOpen, reordering]);

    function refreshTree() {
        router.reload({ only: ['tree', 'workspace'], preserveScroll: true });
    }

    /** Pages created by a batch exist server-side already — pull them into the tree. */
    function closeImport({ sent, pending }) {
        setImportOpen(false);
        if (sent > 0) refreshTree();
        if (pending.length > 0) setPendingImportJobs(pending);
    }

    // Conversions still running after the dialog closed: keep watching them and
    // refresh the tree as they land (a FAILED import trashes its placeholder
    // page, so completions can remove rows too, not just fill them in).
    const pendingPollsRef = useRef(0);
    useEffect(() => {
        if (pendingImportJobs.length === 0) return;
        const timer = setInterval(async () => {
            // Give up after ~2 minutes — same budget as the dialog's own polling.
            if (++pendingPollsRef.current > 48) {
                pendingPollsRef.current = 0;
                setPendingImportJobs([]);
                return;
            }
            const still = [];
            for (const jobId of pendingImportJobs) {
                try {
                    const res = await fetch(`/imports/${jobId}`, { headers: { Accept: 'application/json' } });
                    const data = await res.json();
                    if (!['done', 'failed'].includes(data.status)) still.push(jobId);
                } catch {
                    still.push(jobId); // network hiccup — keep watching
                }
            }
            if (still.length !== pendingImportJobs.length) {
                refreshTree();
                setPendingImportJobs(still);
                if (still.length === 0) pendingPollsRef.current = 0;
            }
        }, 2500);
        return () => clearInterval(timer);
    }, [pendingImportJobs]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // The local tree still holds the new order but the server doesn't —
        // silently snapping back on the next reload would lose the user's
        // arrangement. Re-enter reorder mode so "Done" can retry it.
        // onError only covers validation (422); an offline/unreachable server
        // surfaces as onNetworkError instead — handle both or the failure is silent.
        const keepOrderForRetry = () => {
            reorderDirty.current = true;
            setReordering(true);
            toast.error("Couldn't save the new page order — it's still here, click Done to retry.");
        };

        router.patch(`/workspaces/${workspace.id}/tree`, { nodes }, {
            preserveState: true,
            preserveScroll: true,
            onError: keepOrderForRetry,
            onNetworkError: () => {
                keepOrderForRetry();
                return false; // handled — suppress Inertia's default rejection
            },
        });
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
                                <DropdownMenu modal={false}>
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
                                        {perms.update && (
                                            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                                                <IconPencil stroke={1.5} />
                                                Edit workspace
                                            </DropdownMenuItem>
                                        )}
                                        {perms.update && rootNodes.length > 0 && !activeTag && (
                                            <DropdownMenuItem onSelect={() => { reorderDirty.current = false; setReordering(true); }}>
                                                <IconArrowsSort stroke={1.5} />
                                                Reorder pages
                                            </DropdownMenuItem>
                                        )}
                                        {perms.create && (
                                            <DropdownMenuItem onSelect={() => openImport('')}>
                                                <IconUpload stroke={1.5} />
                                                Import pages…
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
                                    ? 'bg-accent-100 text-accent-600'
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
                <div className="grid grid-cols-[1fr_110px_96px] border-b border-border bg-surface-hover py-2.5">
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
                            <SortableContext items={visibleItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                <ul>
                                    {visibleItems.map((item) => (
                                        showShelves && item.depth === 0 && (item.node.children?.length ?? 0) > 0 ? (
                                            <ShelfHeaderRow
                                                key={item.id}
                                                node={item.node}
                                                collapsed={collapsedShelves.has(item.id)}
                                                onToggle={() => toggleShelf(item.id)}
                                                canCreate={perms.create}
                                                onAddChild={openModal}
                                                onImport={openImport}
                                                starred={starredSet.has(item.node.id)}
                                                isReordering={reordering}
                                            />
                                        ) : (
                                            <TreeRow
                                                key={item.id}
                                                id={item.id}
                                                depth={item.id === activeId && projected ? projected.depth : item.depth}
                                                node={item.node}
                                                activeTagId={activeTag}
                                                onAddChild={openModal}
                                                onImport={openImport}
                                                canCreate={perms.create && !reordering}
                                                canReorder={perms.update && reordering}
                                                ghost={item.id === activeId}
                                                dragging={activeId != null}
                                                pathLast={guideFlags.get(item.id)}
                                                isDropParent={projected?.parentId != null && projected.parentId === item.id && item.id !== activeId}
                                                starred={starredSet.has(item.node.id)}
                                                isReordering={reordering}
                                            />
                                        )
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
                <p className="mt-2 px-1 text-xs text-accent-600">
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

        <WorkspaceFormModal
            open={editOpen}
            onClose={() => setEditOpen(false)}
            workspace={workspace}
        />

        <ImportDialog
            open={importOpen}
            onClose={closeImport}
            onSettled={refreshTree}
            workspaceId={workspace.id}
            parentOptions={options}
            initialParentId={importParentId}
            initialFiles={importFiles}
        />

        {/* Drop-anywhere target; pointer-events-none so the drop reaches the window listeners */}
        {dropActive && (
            <div
                className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-8"
                style={{ background: 'rgba(31, 37, 32, 0.34)' }}
            >
                <div
                    className="flex flex-col items-center gap-2.5 rounded-[14px] border-2 border-dashed border-accent-400 bg-surface px-10 py-8"
                    style={{ boxShadow: 'var(--shadow-lg)' }}
                >
                    <IconUpload className="h-7 w-7 text-accent-600" stroke={1.5} aria-hidden="true" />
                    <p className="text-sm font-medium text-foreground">Drop files to import into {workspace.name}</p>
                    <p className="text-xs text-text-secondary">.docx and .pdf files become pages</p>
                </div>
            </div>
        )}

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
