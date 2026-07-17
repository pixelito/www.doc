import { useState, useEffect, useRef } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import {
    IconFileText, IconFolderOpen, IconFolderPlus, IconGripVertical, IconPlus, IconTrash,
    IconArrowsSort, IconCheck, IconChevronRight, IconDots, IconHistory, IconStarFilled,
    IconLibrary, IconLibraryPlus, IconPencil, IconFolderSymlink,
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
    DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
    DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import WorkspaceFormModal from '@/components/ui/WorkspaceFormModal';
import GroupFormModal from '@/components/ui/GroupFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { can } from '@/lib/permissions';
import { timeAgo } from '@/lib/date';

// A top-level slot is either a group (carrying its ordered members) or a lone
// ungrouped workspace. Both live in ONE shared order, so a loose workspace can
// sit between two groups. Sortable ids are namespaced (`g:`/`w:`) so a group and
// a workspace with the same numeric id never collide in a DnD context.
const tokenId = (t) => (t.type === 'group' ? `g:${t.id}` : `w:${t.id}`);

/**
 * Fold the flat workspace list + groups into the interleaved top-level order.
 * Groups and ungrouped workspaces share one `position` space (that's what the
 * server persists), so we merge both and sort by it. `sortBy === 'updated'` is a
 * view-only convenience: it re-sorts each group's members and any run of
 * adjacent loose rows by recency, but never moves groups around.
 */
function buildLayout(workspaces, groups, sortBy) {
    const membersOf = new Map(groups.map((g) => [g.id, []]));
    const ungrouped = [];
    for (const w of workspaces) {
        if (w.group_id != null && membersOf.has(w.group_id)) membersOf.get(w.group_id).push(w);
        else ungrouped.push(w);
    }

    const byPos = (a, b) => (a.position ?? 0) - (b.position ?? 0);
    const byUpdated = (a, b) => new Date(b.updated_at) - new Date(a.updated_at);
    const itemSort = sortBy === 'updated' ? byUpdated : byPos;
    for (const list of membersOf.values()) list.sort(itemSort);

    const tokens = [
        ...groups.map((g) => ({ type: 'group', id: g.id, position: g.position ?? 0, group: g, items: membersOf.get(g.id) })),
        ...ungrouped.map((w) => ({ type: 'workspace', id: w.id, position: w.position ?? 0, workspace: w })),
    ].sort((a, b) => (a.position - b.position)
        // Stable tie-break for pre-reorder data whose group/workspace positions
        // haven't been merged into one sequence yet: groups first, then by id.
        || (a.type === b.type ? a.id - b.id : (a.type === 'group' ? -1 : 1)));

    if (sortBy !== 'updated') return tokens;

    // Recency view: sort each maximal run of consecutive loose rows by updated_at,
    // leaving every group token exactly where its position put it.
    for (let i = 0; i < tokens.length;) {
        if (tokens[i].type !== 'workspace') { i++; continue; }
        let j = i;
        while (j < tokens.length && tokens[j].type === 'workspace') j++;
        const run = tokens.slice(i, j).sort((a, b) => byUpdated(a.workspace, b.workspace));
        tokens.splice(i, j - i, ...run);
        i = j;
    }
    return tokens;
}

function SortableRow({ workspace, draggable, gridClass, groups, onMove, showMenu }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: `w:${workspace.id}` });

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
            className={`group grid ${gridClass} items-center border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover/60`}
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
                    <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent-600" title={workspace.name}>
                        {workspace.name}
                    </p>
                    {workspace.description && (
                        <p className="truncate text-xs text-text-secondary" title={workspace.description}>{workspace.description}</p>
                    )}
                </Link>
            </div>
            <div className="py-3 pr-4">
                <span className="text-xs text-text-tertiary">
                    {workspace.documents_count} {workspace.documents_count === 1 ? 'page' : 'pages'}
                </span>
            </div>
            <div className="py-3 pr-4">
                <span className="text-xs text-text-tertiary">{timeAgo(workspace.updated_at) ?? '—'}</span>
            </div>
            {showMenu && (
                <div className="flex items-center justify-center pr-1.5">
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Workspace actions"
                                className="flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary opacity-0 transition-[opacity,color,background-color] hover:bg-surface-hover hover:text-foreground focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                            >
                                <IconDots className="h-4 w-4" stroke={1.5} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <IconFolderSymlink stroke={1.5} />
                                    Move to group
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuRadioGroup
                                        value={String(workspace.group_id ?? 'none')}
                                        onValueChange={(v) => onMove(workspace, v === 'none' ? null : Number(v))}
                                    >
                                        <DropdownMenuRadioItem value="none">No group</DropdownMenuRadioItem>
                                        {groups.map((g) => (
                                            <DropdownMenuRadioItem key={g.id} value={String(g.id)}>
                                                {g.name}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </li>
    );
}

/**
 * A group as a top-level slot: a draggable block (header + its member rows). The
 * whole block moves as one unit when reordering the top level; its members
 * reorder among themselves via the nested SortableContext. Filing a workspace
 * in/out of a group stays on the row's ⋯ menu — never a cross-block drag.
 */
function SortableGroupSection({
    token, reordering, collapsed, onToggleCollapse, gridClass, groups, perms,
    onMove, onRenameGroup, onDeleteGroup,
}) {
    const group = token.group;
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: `g:${group.id}` });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
            className="border-b border-border last:border-0"
        >
            <div className={`flex items-center bg-surface-hover/50 has-[[data-state=open]]:bg-surface-hover ${reordering ? '' : 'transition-colors hover:bg-surface-hover'}`}>
                {reordering && (
                    <button
                        type="button"
                        {...listeners}
                        {...attributes}
                        tabIndex={-1}
                        aria-label={`Drag to reorder ${group.name}`}
                        className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center pl-1.5 text-text-tertiary active:cursor-grabbing"
                    >
                        <IconGripVertical className="h-3.5 w-3.5" stroke={1.5} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => !reordering && onToggleCollapse(`g:${group.id}`)}
                    aria-expanded={!collapsed}
                    className={`flex min-w-0 flex-1 items-center gap-2 py-2 text-left ${reordering ? 'cursor-default pl-1' : 'pl-3'} pr-2`}
                >
                    <IconChevronRight
                        className={`h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform ${collapsed ? '' : 'rotate-90'} ${reordering ? 'invisible' : ''}`}
                        stroke={1.5}
                    />
                    <IconLibrary className="h-3.5 w-3.5 shrink-0 text-text-tertiary" stroke={1.5} />
                    <span className="truncate text-[13px] font-semibold text-foreground" title={group.name}>
                        {group.name}
                    </span>
                    <span className="shrink-0 text-xs text-text-tertiary">({token.items.length})</span>
                </button>
                {perms.update && !reordering && (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Actions for ${group.name}`}
                                className="mr-1.5 flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:text-foreground data-[state=open]:text-foreground"
                            >
                                <IconDots className="h-4 w-4" stroke={1.5} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onSelect={() => onRenameGroup(group)}>
                                <IconPencil stroke={1.5} />
                                Rename group
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => onDeleteGroup(group)}
                                className="text-danger focus:bg-danger-surface focus:text-danger"
                            >
                                <IconTrash stroke={1.5} />
                                Delete group
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {!collapsed && (
                token.items.length === 0 ? (
                    <p className="px-3 py-3 pl-9 text-xs text-text-tertiary">
                        No workspaces here yet — move some in from their ⋯ menu.
                    </p>
                ) : (
                    <SortableContext items={token.items.map((w) => `w:${w.id}`)} strategy={verticalListSortingStrategy}>
                        <ul>
                            {token.items.map((w) => (
                                <SortableRow
                                    key={w.id}
                                    workspace={w}
                                    draggable={reordering && perms.update}
                                    gridClass={gridClass}
                                    groups={groups}
                                    onMove={onMove}
                                    showMenu={perms.update && !reordering}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                )
            )}
        </div>
    );
}

/**
 * Personal quick-access list (Starred / Recently viewed) above the workspace
 * table. Collapsible; the state is a per-device display preference, so it
 * lives in localStorage like the theme choice — no server round-trip.
 */
function QuickAccess({ id, title, icon: Icon, items, meta }) {
    const storageKey = `wwwdoc:quickaccess:${id}`;
    // Closed by default — the header (with its count) is the quiet resting
    // state; expanding is a deliberate, remembered choice.
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) !== '0');

    function toggle() {
        setCollapsed((wasCollapsed) => {
            localStorage.setItem(storageKey, wasCollapsed ? '0' : '1');
            return !wasCollapsed;
        });
    }

    return (
        <section className="min-w-0">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={!collapsed}
                className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary transition-colors hover:text-text-secondary"
            >
                <IconChevronRight
                    className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                    stroke={1.5}
                />
                <Icon className="h-3.5 w-3.5" stroke={1.5} />
                {title}
                <span className="font-normal">({items.length})</span>
            </button>
            {!collapsed && (
                <div className="ui-scroll max-h-56 overflow-y-auto rounded-md border border-border bg-card">
                    {items.map((doc, idx) => (
                        <Link
                            key={doc.id}
                            href={`/documents/${doc.id}`}
                            className={`group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-hover${idx > 0 ? ' border-t border-border-subtle' : ''}`}
                        >
                            <IconFileText className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-colors group-hover:text-accent-600" stroke={1.5} />
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground transition-colors group-hover:text-accent-600" title={doc.title}>{doc.title}</span>
                            <span className="shrink-0 text-xs text-text-tertiary">
                                {meta ? meta(doc) : doc.workspace.name}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}

const COLLAPSE_KEY = 'wwwdoc:wsgroups:collapsed';

export default function WorkspacesIndex({ workspaces: initial, groups = [], recent = [], starred = [], recentlyViewed = [] }) {
    const { auth } = usePage().props;
    const perms = can(auth);
    const [workspaces, setWorkspaces] = useState(initial);
    const [modalOpen, setModalOpen]   = useState(false);
    const [sortBy, setSortBy]         = useState('arranged'); // 'arranged' | 'updated'

    // Group dialogs: create/rename share GroupFormModal; delete uses ConfirmDialog.
    const [groupModal, setGroupModal]     = useState({ open: false, group: null });
    const [groupToDelete, setGroupToDelete] = useState(null);

    // Explicit reorder mode (like the page tree's): drags only mutate local
    // state, and the new order is saved once on "Done".
    const [reordering, setReordering] = useState(false);
    const reorderDirty = useRef(false);

    // The interleaved top-level order (group blocks + loose rows). Held as state
    // so reorder drags mutate it directly; rebuilt from server data + the sort
    // toggle whenever we're NOT mid-reorder (see effect below).
    const [layout, setLayout] = useState(() => buildLayout(initial, groups, 'arranged'));

    // Which group sections are collapsed (keys are `g:${id}`). Expanded by
    // default (a key is present ONLY when the user has explicitly collapsed it);
    // persisted per-device like the theme choice.
    const [collapsedKeys, setCollapsedKeys] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); }
        catch { return new Set(); }
    });

    function toggleCollapsed(key) {
        setCollapsedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
            return next;
        });
    }
    // Reorder mode force-expands so every row is reachable to drag.
    const isCollapsed = (key) => !reordering && collapsedKeys.has(key);

    // Warn before losing unsaved moves on close/refresh or any in-app navigation
    // (a workspace row, a nav link, "New workspace"); see the discard modal below.
    const { promptOpen, requestLeave, confirmDiscard, dismissPrompt } = useUnsavedChangesGuard({
        active: reordering,
        dirtyRef: reorderDirty,
        // Drags mutate `layout`, not `workspaces`, so discarding has to rebuild the
        // layout from the untouched server order explicitly — otherwise the dragged
        // arrangement would linger on screen after "Discard".
        revert: () => {
            reorderDirty.current = false;
            setReordering(false);
            setLayout(buildLayout(workspaces, groups, sortBy));
        },
    });

    useEffect(() => { setWorkspaces(initial); }, [initial]);

    // Rebuild the interleaved layout from server data + the sort toggle. Keyed on
    // those inputs ONLY (not `reordering`): none of them change during a drag, so
    // in-progress drags are never clobbered, and — crucially — leaving reorder
    // mode does NOT re-run this. That means `layout` keeps the order you dragged
    // until the server reload lands the persisted order, with no flicker back to
    // the pre-drag arrangement in between. `startReorder` seeds a fresh layout.
    useEffect(() => {
        setLayout(buildLayout(workspaces, groups, sortBy));
    }, [workspaces, groups, sortBy]);

    const hasGroups = groups.length > 0;
    const gridClass = hasGroups ? 'grid-cols-[1fr_90px_110px_44px]' : 'grid-cols-[1fr_90px_110px]';

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    // A drag is only ever WITHIN one container — the top level (group blocks +
    // loose rows share it) or a single group's members. Cross-container moves are
    // the row's "Move to group" menu, not a drag.
    function containerOf(id) {
        if (layout.some((t) => tokenId(t) === id)) return 'top';
        for (const t of layout) {
            if (t.type === 'group' && t.items.some((w) => `w:${w.id}` === id)) return `group:${t.id}`;
        }
        return null;
    }

    function handleDragEnd({ active, over }) {
        if (!over || active.id === over.id) return;
        const from = containerOf(active.id);
        const to = containerOf(over.id);
        if (!from || from !== to) return; // ignore drops that left the container

        if (from === 'top') {
            const oldIndex = layout.findIndex((t) => tokenId(t) === active.id);
            const newIndex = layout.findIndex((t) => tokenId(t) === over.id);
            if (oldIndex === -1 || newIndex === -1) return;
            setLayout(arrayMove(layout, oldIndex, newIndex));
        } else {
            const gid = Number(from.slice('group:'.length));
            setLayout(layout.map((t) => {
                if (!(t.type === 'group' && t.id === gid)) return t;
                const oldIndex = t.items.findIndex((w) => `w:${w.id}` === active.id);
                const newIndex = t.items.findIndex((w) => `w:${w.id}` === over.id);
                if (oldIndex === -1 || newIndex === -1) return t;
                return { ...t, items: arrayMove(t.items, oldIndex, newIndex) };
            }));
        }
        reorderDirty.current = true;
    }

    /** Leave reorder mode, saving the whole arrangement once if it changed. */
    function finishReorder() {
        setReordering(false);
        if (!reorderDirty.current) return;
        reorderDirty.current = false;
        // Two disjoint axes in one atomic save: `items` = the interleaved top level
        // (groups + ungrouped workspaces, shared position space); `grouped` = every
        // group's members concatenated in display order (per-group order).
        const items = layout.map((t) => ({ type: t.type, id: t.id }));
        const grouped = layout.flatMap((t) => (t.type === 'group' ? t.items.map((w) => w.id) : []));
        const keepOrderForRetry = () => {
            reorderDirty.current = true;
            setReordering(true);
            toast.error("Couldn't save the new order — it's still here, click Done to retry.");
        };

        router.patch('/workspaces/top-level-order', { items, grouped }, {
            preserveState: true,
            preserveScroll: true,
            onError: keepOrderForRetry,
            onNetworkError: () => { keepOrderForRetry(); return false; },
        });
    }

    /** Enter reorder mode with a fresh position-ordered layout (ignores sort view). */
    function startReorder() {
        reorderDirty.current = false;
        setLayout(buildLayout(workspaces, groups, 'arranged'));
        setReordering(true);
    }

    function moveToGroup(workspace, groupId) {
        if ((workspace.group_id ?? null) === groupId) return; // already there
        // Append to the end of the destination group so the landing spot is
        // predictable (the row jumps to the bottom of its new section).
        const siblings = workspaces.filter((w) => (w.group_id ?? null) === groupId);
        const position = siblings.reduce((max, w) => Math.max(max, w.position ?? 0), -1) + 1;
        const destName = groups.find((g) => g.id === groupId)?.name;
        const done = groupId == null
            ? `Removed “${workspace.name}” from its group.`
            : `Moved “${workspace.name}” to ${destName}.`;

        router.patch(`/workspaces/${workspace.id}/group`, { group_id: groupId, position }, {
            preserveScroll: true,
            onSuccess: () => toast.success(done),
            onError: () => toast.error("Couldn't move the workspace."),
        });
    }

    function deleteGroup() {
        const group = groupToDelete;
        if (!group) return;
        router.delete(`/workspaces/groups/${group.id}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(`Deleted the group “${group.name}”.`),
            onError: () => toast.error("Couldn't delete the group."),
        });
        setGroupToDelete(null);
    }

    const totalPages = workspaces.reduce((sum, w) => sum + (w.documents_count ?? 0), 0);

    return (
        <DocsLayout>
            <Head title="Workspaces" />

            {/* Header */}
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <h1 className="text-[19px] font-semibold text-foreground">Workspaces</h1>
                    <p className="mt-0.5 text-sm text-text-secondary">
                        {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
                        {hasGroups && <> · {groups.length} {groups.length === 1 ? 'group' : 'groups'}</>}
                        {' · '}
                        {totalPages} pages
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 self-center">
                    {workspaces.length > 1 && !reordering && (
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="ui-select h-[33px] rounded-sm border border-border bg-surface px-2.5 text-[13px] text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent-400 focus:ring-[3px] focus:ring-accent-200"
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
                            {(perms.create || (perms.update && workspaces.length > 1) || perms.isAdmin) && (
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
                                        {perms.create && (
                                            <DropdownMenuItem onSelect={() => setGroupModal({ open: true, group: null })}>
                                                <IconLibraryPlus stroke={1.5} />
                                                New group
                                            </DropdownMenuItem>
                                        )}
                                        {perms.update && workspaces.length > 1 && (
                                            <DropdownMenuItem onSelect={startReorder}>
                                                <IconArrowsSort stroke={1.5} />
                                                Reorder
                                            </DropdownMenuItem>
                                        )}
                                        {perms.isAdmin && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem asChild>
                                                    <Link href="/trash">
                                                        <IconTrash stroke={1.5} />
                                                        View Trash
                                                    </Link>
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

            {/* Personal quick access — starred + recently viewed (hidden while reordering) */}
            {!reordering && (starred.length > 0 || recentlyViewed.length > 0) && (
                <div className="mt-5 space-y-3">
                    {starred.length > 0 && (
                        <QuickAccess id="starred" title="Starred" icon={IconStarFilled} items={starred} />
                    )}
                    {recentlyViewed.length > 0 && (
                        <QuickAccess
                            id="recent"
                            title="Recently viewed"
                            icon={IconHistory}
                            items={recentlyViewed}
                            meta={(doc) => timeAgo(doc.viewed_at) ?? '—'}
                        />
                    )}
                </div>
            )}

            {/* Table */}
            <div className="mt-4 overflow-hidden rounded-md border border-border bg-card">
                {/* Column headers */}
                <div className={`grid ${gridClass} border-b border-border bg-surface-hover py-2.5`}>
                    <span className="pl-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Workspace</span>
                    <span className="pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Pages</span>
                    <span className="pr-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">Updated</span>
                    {hasGroups && <span />}
                </div>

                {workspaces.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent-200 bg-accent-50">
                            <IconFolderPlus className="h-6 w-6 text-accent-600" stroke={1.5} />
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
                        {/* One shared top-level order: group blocks and loose rows are
                            sortable against each other, so an ungrouped workspace can sit
                            between two groups. */}
                        <SortableContext items={layout.map(tokenId)} strategy={verticalListSortingStrategy}>
                            {layout.map((token) => (
                                token.type === 'group' ? (
                                    <SortableGroupSection
                                        key={`g:${token.id}`}
                                        token={token}
                                        reordering={reordering}
                                        collapsed={isCollapsed(`g:${token.id}`)}
                                        onToggleCollapse={toggleCollapsed}
                                        gridClass={gridClass}
                                        groups={groups}
                                        perms={perms}
                                        onMove={moveToGroup}
                                        onRenameGroup={(group) => setGroupModal({ open: true, group })}
                                        onDeleteGroup={(group) => setGroupToDelete(group)}
                                    />
                                ) : (
                                    <ul key={`w:${token.id}`} className="border-b border-border last:border-0">
                                        <SortableRow
                                            workspace={token.workspace}
                                            draggable={reordering && perms.update}
                                            gridClass={gridClass}
                                            groups={groups}
                                            onMove={moveToGroup}
                                            showMenu={hasGroups && perms.update && !reordering}
                                        />
                                    </ul>
                                )
                            ))}
                        </SortableContext>
                    </DndContext>
                )}

                {/* Footer. Its top rule is the last section's border-b (which stays
                    on because the footer, not the section, is the last child) —
                    adding one here would stack two 1px lines into a thick seam. */}
                {workspaces.length > 0 && perms.create && (
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-sm text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
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
                                className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover${idx > 0 ? ' border-t border-border-subtle' : ''}`}
                            >
                                <IconFileText className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-accent-600" stroke={1.5} />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent-600" title={doc.title}>
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

            <WorkspaceFormModal open={modalOpen} onClose={() => setModalOpen(false)} />

            <GroupFormModal
                open={groupModal.open}
                group={groupModal.group}
                onClose={() => setGroupModal({ open: false, group: null })}
            />

            <ConfirmDialog
                open={Boolean(groupToDelete)}
                title="Delete group?"
                message={`“${groupToDelete?.name}” will be removed. Its workspaces aren't deleted — they move out of the group.`}
                confirmLabel="Delete group"
                cancelLabel="Cancel"
                variant="danger"
                onConfirm={deleteGroup}
                onCancel={() => setGroupToDelete(null)}
            />

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
