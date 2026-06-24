import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    Handle,
    Position,
    MarkerType,
    ConnectionMode,
    NodeToolbar,
    NodeResizer,
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    getViewportForBounds,
    useReactFlow,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import {
    IconPlus, IconTrash, IconCircleDot, IconServer, IconRouter, IconSwitch3,
    IconShieldLock, IconCloud, IconDatabase, IconDeviceDesktop, IconAccessPoint,
    IconLineDashed, IconArrowNarrowRight, IconArrowsHorizontal, IconMinus, IconSquareDashed,
    IconArrowBackUp, IconArrowForwardUp, IconGridDots, IconCopy,
} from '@tabler/icons-react';
import { uploadFile, dataUriToFile } from '@/extensions/ImageUpload';

/**
 * The editable React Flow canvas for a networkDiagram node. Lazy-loaded by
 * NetworkDiagramNodeView so React Flow only enters the bundle when a diagram is
 * actually edited.
 *
 * The node's `graph` attr is the source of truth; this canvas seeds its working
 * state from it once and reports changes back via `onChange` (cleaned of React
 * Flow's transient fields and our render-only callbacks). Refs hold the live
 * state synchronously so persistence after a drag/connect reads final values.
 */

const uid = () =>
    (window.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

// Handlers the custom node needs but that must NOT be persisted — passed via
// context instead of polluting node.data (which is serialized into the graph).
const NodeBehavior = createContext({
    editable: false, onLabelChange: () => {}, onKindChange: () => {},
    onNodeColorChange: () => {}, onPersist: () => {},
});

// Device kinds a node can take. `id` is persisted in node.data.kind; the icon and
// default label are render-only. Generic is the plain box (no icon).
const NODE_KINDS = [
    { id: 'generic',     label: 'Node',        Icon: IconCircleDot },
    { id: 'server',      label: 'Server',      Icon: IconServer },
    { id: 'router',      label: 'Router',      Icon: IconRouter },
    { id: 'switch',      label: 'Switch',      Icon: IconSwitch3 },
    { id: 'firewall',    label: 'Firewall',    Icon: IconShieldLock },
    { id: 'cloud',       label: 'Cloud',       Icon: IconCloud },
    { id: 'database',    label: 'Database',    Icon: IconDatabase },
    { id: 'workstation', label: 'Workstation', Icon: IconDeviceDesktop },
    { id: 'ap',          label: 'Access Point', Icon: IconAccessPoint },
];
const KIND_BY_ID = Object.fromEntries(NODE_KINDS.map((k) => [k.id, k]));
const kindMeta = (kind) => KIND_BY_ID[kind] ?? KIND_BY_ID.generic;

// Node fill colours for grouping by zone / VLAN. `id` is persisted in
// node.data.color; the rest is render-only (light fill + matching border +
// accent for the icon). `swatch` is the palette button colour.
const NODE_COLORS = [
    { id: 'default',    bg: 'var(--surface)', border: 'var(--border)', accent: 'var(--sage-600)', swatch: '#FBFAF5' },
    { id: 'sage',       bg: '#EAF1E5', border: '#BFD2B5', accent: '#4B6840', swatch: '#CDDEC4' },
    { id: 'blue',       bg: '#E9EFF4', border: '#B8CCDD', accent: '#42637E', swatch: '#C4D6E4' },
    { id: 'amber',      bg: '#F6EEDC', border: '#E5CF9F', accent: '#9A6F2E', swatch: '#EBD6A6' },
    { id: 'terracotta', bg: '#F4E5DF', border: '#DDB3A6', accent: '#A04A33', swatch: '#E6C2B5' },
    { id: 'purple',     bg: '#EEE9F4', border: '#CDBDDD', accent: '#6A5286', swatch: '#D6C7E6' },
];
const COLOR_BY_ID = Object.fromEntries(NODE_COLORS.map((c) => [c.id, c]));
const colorMeta = (id) => COLOR_BY_ID[id] ?? COLOR_BY_ID.default;

// A connection point on each side of a node. With ConnectionMode.Loose every
// handle can be both a source and a target, so any node connects to any node.
const HANDLE_SIDES = [
    { id: 'top', position: Position.Top },
    { id: 'right', position: Position.Right },
    { id: 'bottom', position: Position.Bottom },
    { id: 'left', position: Position.Left },
];

function LabeledNode({ id, data, selected }) {
    const { editable, onLabelChange, onKindChange, onNodeColorChange } = useContext(NodeBehavior);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(data.label ?? '');

    useEffect(() => { setValue(data.label ?? ''); }, [data.label]);

    const kind = data.kind ?? 'generic';
    const Icon = kindMeta(kind).Icon;
    const color = colorMeta(data.color ?? 'default');

    const commit = () => {
        setEditing(false);
        onLabelChange(id, value.trim() || 'Node');
    };

    return (
        <div
            onDoubleClick={() => editable && setEditing(true)}
            className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium text-foreground shadow-sm ${
                selected ? 'ring-1 ring-sage-400' : ''
            }`}
            style={{ minWidth: 90, background: color.bg, borderColor: color.border }}
        >
            {/* Type + colour picker — appears above the node while it's selected. */}
            {editable && (
                <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
                    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-1 shadow-md">
                        <div className="flex items-center gap-0.5">
                            {NODE_KINDS.map((k) => (
                                <button
                                    key={k.id}
                                    type="button"
                                    title={k.label}
                                    onClick={() => onKindChange(id, k.id)}
                                    className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
                                        kind === k.id ? 'bg-sage-100 text-sage-700' : 'text-text-secondary hover:bg-surface-hover hover:text-foreground'
                                    }`}
                                >
                                    <k.Icon className="h-3.5 w-3.5" stroke={1.5} />
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1 px-0.5">
                            {NODE_COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    title={`${c.id[0].toUpperCase()}${c.id.slice(1)} fill`}
                                    onClick={() => onNodeColorChange(id, c.id)}
                                    className={`h-4 w-4 rounded-full border ${(data.color ?? 'default') === c.id ? 'border-foreground' : 'border-border'}`}
                                    style={{ background: c.swatch }}
                                />
                            ))}
                        </div>
                    </div>
                </NodeToolbar>
            )}

            {HANDLE_SIDES.map(({ id, position }) => (
                <Handle
                    key={id}
                    id={id}
                    type="source"
                    position={position}
                    isConnectable={editable}
                    className="!h-2 !w-2 !border !border-border !bg-sage-300"
                />
            ))}

            {kind !== 'generic' && <Icon className="h-4 w-4 shrink-0" stroke={1.5} style={{ color: color.accent }} />}

            {editing ? (
                <input
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(); }
                        if (e.key === 'Escape') { setEditing(false); setValue(data.label ?? ''); }
                    }}
                    className="w-full rounded-sm border border-sage-400 bg-canvas px-1 text-center text-xs outline-none"
                />
            ) : (
                <span>{data.label || 'Node'}</span>
            )}
        </div>
    );
}

// A zone / grouping container. Renders behind device nodes; nodes dropped inside
// become its children (handled in onNodeDragStop) and move with it.
function GroupNode({ id, data, selected }) {
    const { editable, onLabelChange, onNodeColorChange, onPersist } = useContext(NodeBehavior);
    const color = colorMeta(data.color ?? 'sage');
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(data.label ?? 'Zone');

    useEffect(() => { setVal(data.label ?? 'Zone'); }, [data.label]);

    const commit = () => { setEditing(false); onLabelChange(id, val.trim() || 'Zone'); };

    return (
        <div
            className="relative h-full w-full rounded-md border-2"
            style={{ background: `color-mix(in srgb, ${color.swatch} 30%, transparent)`, borderColor: color.border }}
        >
            {editable && (
                <NodeResizer
                    minWidth={140}
                    minHeight={90}
                    isVisible={selected}
                    lineClassName="!border-sage-400"
                    handleClassName="!h-2 !w-2 !rounded-sm !border-sage-400 !bg-surface"
                    onResizeEnd={onPersist}
                />
            )}
            {editable && (
                <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
                    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-md">
                        {NODE_COLORS.filter((c) => c.id !== 'default').map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                title={`${c.id[0].toUpperCase()}${c.id.slice(1)} zone`}
                                onClick={() => onNodeColorChange(id, c.id)}
                                className={`h-4 w-4 rounded-full border ${(data.color ?? 'sage') === c.id ? 'border-foreground' : 'border-border'}`}
                                style={{ background: c.swatch }}
                            />
                        ))}
                    </div>
                </NodeToolbar>
            )}
            <div className="absolute left-2 top-1.5 max-w-[85%]" onDoubleClick={() => editable && setEditing(true)}>
                {editing ? (
                    <input
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commit(); }
                            if (e.key === 'Escape') { setEditing(false); setVal(data.label ?? 'Zone'); }
                        }}
                        className="nodrag rounded-sm border border-sage-400 bg-canvas px-1 text-xs outline-none"
                    />
                ) : (
                    <span className="text-xs font-semibold" style={{ color: color.accent }}>{data.label || 'Zone'}</span>
                )}
            </div>
        </div>
    );
}

const nodeTypes = { labeled: LabeledNode, group: GroupNode };

const sortGroupsFirst = (nodes) => {
    const groups = nodes.filter((n) => n.type === 'group');
    const rest = nodes.filter((n) => n.type !== 'group');
    return [...groups, ...rest];
};

// ── Edges ────────────────────────────────────────────────────────────────────

const EDGE_COLORS = ['#8E938E', '#4B6840', '#6E8AA7', '#C99650', '#B5573E']; // gray, sage, blue, amber, terracotta
const ARROW_MODES = ['end', 'both', 'none'];
const ARROW_ICON = { end: IconArrowNarrowRight, both: IconArrowsHorizontal, none: IconMinus };

const edgeData = (e) => ({
    label: '', lineStyle: 'solid', arrows: 'end', color: EDGE_COLORS[0], ...(e.data || {}),
});

// Build React Flow's visual props (type + colored arrow markers) from edge.data,
// which is the persisted source of truth. Re-run whenever an edge's data changes.
const decorateEdge = (e) => {
    const data = edgeData(e);
    const marker = (on) => (on ? { type: MarkerType.ArrowClosed, color: data.color, width: 16, height: 16 } : undefined);
    return {
        ...e,
        type: 'configurable',
        data,
        markerEnd: marker(data.arrows === 'end' || data.arrows === 'both'),
        markerStart: marker(data.arrows === 'both'),
    };
};

function ConfigurableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerStart, markerEnd, data, selected }) {
    const { editable, onEdgeChange, onEdgeDelete } = useContext(NodeBehavior);
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
    const d = edgeData({ data });

    return (
        <>
            <BaseEdge
                id={id}
                path={path}
                markerStart={markerStart}
                markerEnd={markerEnd}
                style={{
                    stroke: d.color,
                    strokeWidth: selected ? 2.5 : 1.5,
                    strokeDasharray: d.lineStyle === 'dashed' ? '6 4' : undefined,
                }}
            />
            <EdgeLabelRenderer>
                {d.label && (
                    <div
                        className="rounded-sm border border-border-subtle bg-surface/95 px-1 py-px text-[10px] font-medium text-text-secondary"
                        style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'none' }}
                    >
                        {d.label}
                    </div>
                )}

                {editable && selected && (
                    <div
                        className="nodrag nopan flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-md"
                        style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 30}px)`, pointerEvents: 'all' }}
                    >
                        <EdgeLabelInput value={d.label} onCommit={(label) => onEdgeChange(id, { label })} />
                        <EdgeIconButton
                            active={d.lineStyle === 'dashed'}
                            title={d.lineStyle === 'dashed' ? 'Dashed line' : 'Solid line'}
                            onClick={() => onEdgeChange(id, { lineStyle: d.lineStyle === 'dashed' ? 'solid' : 'dashed' })}
                        >
                            <IconLineDashed className="h-3.5 w-3.5" stroke={1.5} />
                        </EdgeIconButton>
                        {(() => { const A = ARROW_ICON[d.arrows]; return (
                            <EdgeIconButton
                                title={`Arrows: ${d.arrows}`}
                                onClick={() => onEdgeChange(id, { arrows: ARROW_MODES[(ARROW_MODES.indexOf(d.arrows) + 1) % ARROW_MODES.length] })}
                            >
                                <A className="h-3.5 w-3.5" stroke={1.5} />
                            </EdgeIconButton>
                        ); })()}
                        <span className="mx-0.5 h-4 w-px bg-border" />
                        {EDGE_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                title="Line colour"
                                onClick={() => onEdgeChange(id, { color: c })}
                                className={`h-4 w-4 rounded-full border ${d.color === c ? 'border-foreground' : 'border-border'}`}
                                style={{ background: c }}
                            />
                        ))}
                        <span className="mx-0.5 h-4 w-px bg-border" />
                        <EdgeIconButton title="Delete connection" danger onClick={() => onEdgeDelete(id)}>
                            <IconTrash className="h-3.5 w-3.5" stroke={1.5} />
                        </EdgeIconButton>
                    </div>
                )}
            </EdgeLabelRenderer>
        </>
    );
}

function EdgeLabelInput({ value, onCommit }) {
    const [v, setV] = useState(value ?? '');
    useEffect(() => { setV(value ?? ''); }, [value]);
    return (
        <input
            value={v}
            onChange={(e) => setV(e.target.value)}
            onBlur={() => onCommit(v.trim())}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }}
            placeholder="Label"
            className="h-5 w-20 rounded-sm bg-canvas px-1 text-[11px] text-foreground outline-none placeholder:text-text-tertiary"
        />
    );
}

function EdgeIconButton({ active, danger, title, onClick, children }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`flex h-5 w-5 items-center justify-center rounded-sm transition-colors ${
                active ? 'bg-sage-100 text-sage-700'
                : danger ? 'text-text-secondary hover:bg-danger hover:text-white'
                : 'text-text-secondary hover:bg-surface-hover hover:text-foreground'
            }`}
        >
            {children}
        </button>
    );
}

const edgeTypes = { configurable: ConfigurableEdge };

// Persisted shape — strip React Flow's transient fields and render-only data.
const cleanNodes = (nodes) =>
    nodes.map((n) => {
        if (n.type === 'group') {
            return {
                id: n.id,
                type: 'group',
                position: n.position,
                width: n.width,
                height: n.height,
                data: { label: n.data?.label ?? 'Zone', color: n.data?.color ?? 'sage' },
            };
        }
        const out = {
            id: n.id,
            type: 'labeled',
            position: n.position,
            data: { label: n.data?.label ?? '', kind: n.data?.kind ?? 'generic', color: n.data?.color ?? 'default' },
        };
        if (n.parentId) out.parentId = n.parentId;   // membership in a zone
        return out;
    });
const cleanEdges = (edges) =>
    edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        data: edgeData(e),
    }));

// Inflate a persisted graph back into React Flow's working shape — used both to
// seed the canvas and to restore a snapshot on undo/redo.
const hydrateNodes = (raw) =>
    sortGroupsFirst((raw ?? []).map((n) =>
        n.type === 'group'
            ? { ...n, type: 'group', width: n.width ?? 240, height: n.height ?? 150 }
            : { ...n, type: 'labeled' },
    ));
const hydrateEdges = (raw) =>
    (raw ?? []).map((e) => decorateEdge({
        ...e,
        // Legacy edges (saved before per-side handles) were always bottom→top.
        sourceHandle: e.sourceHandle ?? 'bottom',
        targetHandle: e.targetHandle ?? 'top',
    }));

const HISTORY_LIMIT = 60;

// Snap step for the optional grid — matches the dotted Background gap so nodes
// land on the dots.
const SNAP_GRID = [18, 18];

function Canvas({ graph, editable, onChange, onImage }) {
    const seed = useRef(graph ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    const wrapperRef = useRef(null);
    const rf = useReactFlow();

    // Optional snap-to-grid (editing aid, not persisted): aligns drags to the grid.
    const [snap, setSnap] = useState(false);
    // Whether any node is selected — drives the Duplicate button's enabled state.
    const [hasSel, setHasSel] = useState(false);
    // Internal clipboard for copy/paste/duplicate (not the system clipboard).
    const clipboard = useRef(null);

    const [nodes, setNodesState] = useState(() => hydrateNodes(seed.current.nodes));
    const [edges, setEdgesState] = useState(() => hydrateEdges(seed.current.edges));

    // Synchronous mirrors so persistence reads final values, not lagged state.
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const viewportRef = useRef(seed.current.viewport ?? { x: 0, y: 0, zoom: 1 });
    const selectionRef = useRef({ nodes: [], edges: [] });

    const setNodes = (next) => { nodesRef.current = next; setNodesState(next); };
    const setEdges = (next) => { edgesRef.current = next; setEdgesState(next); };

    const persist = () => {
        if (!editable) return;   // read-only mount renders the graph but never writes back
        onChange?.({
            nodes: cleanNodes(nodesRef.current),
            edges: cleanEdges(edgesRef.current),
            viewport: viewportRef.current,
        });
    };

    // ── Undo / redo ──────────────────────────────────────────────────────────
    // A stack of cleaned graph snapshots. A new entry is pushed whenever a
    // structural change settles (via `commit()`); pure pan/zoom is excluded so
    // history isn't flooded. Undo/redo restore a snapshot and write it back.
    const snapshot = () => ({
        nodes: cleanNodes(nodesRef.current),
        edges: cleanEdges(edgesRef.current),
        viewport: viewportRef.current,
    });
    const history = useRef({ stack: [], index: -1 });
    const [hist, setHist] = useState({ canUndo: false, canRedo: false });
    const syncHist = () => {
        const h = history.current;
        setHist({ canUndo: h.index > 0, canRedo: h.index < h.stack.length - 1 });
    };

    // Seed the history with the initial graph once mounted.
    useEffect(() => {
        if (!editable) return;
        history.current = { stack: [snapshot()], index: 0 };
        syncHist();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pushHistory = () => {
        const h = history.current;
        const stack = h.stack.slice(0, h.index + 1);   // drop any redo tail
        stack.push(snapshot());
        const trimmed = stack.length > HISTORY_LIMIT ? stack.slice(-HISTORY_LIMIT) : stack;
        history.current = { stack: trimmed, index: trimmed.length - 1 };
        syncHist();
    };

    // persist + record an undo step + refresh the derived PNG.
    const commit = () => { persist(); pushHistory(); scheduleCapture(); };

    const restore = (snap) => {
        setNodes(hydrateNodes(snap.nodes));
        setEdges(hydrateEdges(snap.edges));
        viewportRef.current = snap.viewport ?? viewportRef.current;
        rf.setViewport(viewportRef.current);
        persist();          // reflect the restored state into the document
        scheduleCapture();
    };
    const undo = () => {
        flushNudge();   // record a pending arrow-nudge run before stepping back
        const h = history.current;
        if (h.index <= 0) return;
        h.index -= 1;
        restore(h.stack[h.index]);
        syncHist();
    };
    const redo = () => {
        flushNudge();
        const h = history.current;
        if (h.index >= h.stack.length - 1) return;
        h.index += 1;
        restore(h.stack[h.index]);
        syncHist();
    };

    // Undo/redo keyboard shortcuts. React Flow doesn't take focus, so clicking the
    // canvas leaves focus on the host ProseMirror editor — a wrapper listener would
    // never see the keystroke and Cmd/Ctrl+Z would hit the document's undo instead.
    // Instead we track whether this diagram is the "active" one (last pointer-down
    // landed inside it) and intercept the combo on `document` in the CAPTURE phase,
    // which runs before ProseMirror's handler so we can stop it from undoing the doc.
    const activeRef = useRef(false);
    // Latest action closures for the (mount-time) key handler; assigned once the
    // copy/paste helpers below are defined to avoid a temporal-dead-zone error.
    const keyActions = useRef({});
    useEffect(() => {
        if (!editable) return;
        const onPointerDown = (e) => { activeRef.current = !!wrapperRef.current?.contains(e.target); };
        const onKeyDown = (e) => {
            if (!activeRef.current) return;
            // Skip while a canvas label editor (an <input>) is focused so it keeps
            // its own text undo; the host ProseMirror root is also contentEditable
            // but is exactly the focus we want to override, so don't guard on that.
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
            const a = keyActions.current;
            const stop = () => { e.preventDefault(); e.stopPropagation(); };

            // Plain keys (no Ctrl/Cmd): delete selection + arrow nudge. Each only
            // swallows the event when it acts on a selection, so they fall through
            // to the editor otherwise.
            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
                if (e.key === 'Delete' || e.key === 'Backspace') { if (a.deleteSelected()) stop(); return; }
                const step = e.shiftKey ? 10 : 1;
                if (e.key === 'ArrowUp')    { if (a.nudge(0, -step)) stop(); return; }
                if (e.key === 'ArrowDown')  { if (a.nudge(0,  step)) stop(); return; }
                if (e.key === 'ArrowLeft')  { if (a.nudge(-step, 0)) stop(); return; }
                if (e.key === 'ArrowRight') { if (a.nudge( step, 0)) stop(); return; }
                return;
            }

            const k = e.key.toLowerCase();
            if (k === 'z' && !e.shiftKey) { stop(); a.undo(); }
            else if ((k === 'z' && e.shiftKey) || k === 'y') { stop(); a.redo(); }
            // Only swallow copy/paste/duplicate when we actually act on the graph,
            // so an empty selection / clipboard falls through to normal behaviour.
            else if (k === 'c') { if (a.copySelection()) stop(); }
            else if (k === 'v') { if (a.paste()) stop(); }
            else if (k === 'd') { if (a.duplicate()) stop(); }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [editable]);

    // Derive the PNG that read view / PDF / DOCX / search / version snapshots
    // show. Debounced after edits settle; renders all nodes (fit to bounds,
    // independent of current pan/zoom), uploads via the asset API, and reports
    // the URL back. On an empty diagram the image is cleared; failures keep the
    // last good image rather than blanking it.
    const captureTimer = useRef(null);
    const capturing = useRef(false);

    const runCapture = async () => {
        if (capturing.current) { scheduleCapture(); return; }
        const nodes = nodesRef.current;
        if (!nodes.length) { onImage?.(null); return; }

        const viewportEl = wrapperRef.current?.querySelector('.react-flow__viewport');
        if (!viewportEl) return;

        capturing.current = true;
        try {
            // Instance method resolves absolute positions (children of a group
            // store positions relative to it).
            const bounds = rf.getNodesBounds(nodes.map((n) => n.id));
            const width = Math.min(1600, Math.max(320, Math.round(bounds.width) + 96));
            const height = Math.min(1200, Math.max(180, Math.round(bounds.height) + 96));
            const vp = getViewportForBounds(bounds, width, height, 0.4, 2, 0.12);

            const dataUrl = await toPng(viewportEl, {
                backgroundColor: '#FBFAF5',
                width,
                height,
                pixelRatio: 2,   // sharper export PNG (read view uses the live canvas)
                // Don't try to inline @font-face CSS: it can't be read when styles
                // are served from another origin (CDN / split dev host), which only
                // spams the console and wastes a fetch every capture — labels fall
                // back to a system font in the PNG regardless.
                skipFonts: true,
                style: {
                    width: `${width}px`,
                    height: `${height}px`,
                    transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
                },
            });

            const { url } = await uploadFile(dataUriToFile(dataUrl, 'network-diagram.png'));
            onImage?.(url);
        } catch (e) {
            console.warn('Network diagram capture failed', e);
        } finally {
            capturing.current = false;
        }
    };

    const scheduleCapture = () => {
        if (!editable) return;
        clearTimeout(captureTimer.current);
        captureTimer.current = setTimeout(runCapture, 800);
    };

    useEffect(() => () => { clearTimeout(captureTimer.current); clearTimeout(nudgeTimer.current); }, []);

    const onNodesChange = (changes) => setNodes(applyNodeChanges(changes, nodesRef.current));
    const onEdgesChange = (changes) => setEdges(applyEdgeChanges(changes, edgesRef.current));

    const onConnect = (params) => {
        setEdges(addEdge(decorateEdge({ ...params, id: uid() }), edgesRef.current));
        commit();
    };

    const onEdgeChange = (id, patch) => {
        setEdges(edgesRef.current.map((e) => (e.id === id ? decorateEdge({ ...e, data: { ...edgeData(e), ...patch } }) : e)));
        commit();
    };

    const onEdgeDelete = (id) => {
        setEdges(edgesRef.current.filter((e) => e.id !== id));
        commit();
    };

    const onLabelChange = (id, label) => {
        setNodes(nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
        commit();
    };

    const onKindChange = (id, kind) => {
        setNodes(nodesRef.current.map((n) => {
            if (n.id !== id) return n;
            // Refresh the label to the new kind's default only if it was still the
            // old kind's default (i.e. the user never named it).
            const prevDefault = kindMeta(n.data?.kind ?? 'generic').label;
            const label = (!n.data?.label || n.data.label === prevDefault) ? kindMeta(kind).label : n.data.label;
            return { ...n, data: { ...n.data, kind, label } };
        }));
        commit();
    };

    const onNodeColorChange = (id, color) => {
        setNodes(nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n)));
        commit();
    };

    const addNode = () => {
        const n = nodesRef.current.filter((x) => x.type !== 'group').length;
        const node = {
            id: uid(),
            type: 'labeled',
            position: { x: 80 + (n % 4) * 150, y: 60 + Math.floor(n / 4) * 90 },
            data: { label: 'Node' },
        };
        setNodes([...nodesRef.current, node]);
        commit();
    };

    const addZone = () => {
        const zone = {
            id: uid(),
            type: 'group',
            position: { x: 24, y: 24 },
            width: 280,
            height: 180,
            data: { label: 'Zone', color: 'sage' },
        };
        // Groups must precede their children in the array (React Flow requirement).
        setNodes(sortGroupsFirst([zone, ...nodesRef.current]));
        commit();
    };

    // Drop a node into a zone (or out of one): re-parent it and convert its
    // position to be relative to the new parent, so it moves with the zone.
    const reparentOnDragStop = (dragged) => {
        if (dragged.type === 'group') return;
        const abs = rf.getInternalNode(dragged.id)?.internals?.positionAbsolute ?? dragged.position;
        const target = rf.getIntersectingNodes(dragged).find((g) => g.type === 'group');
        const newParent = target ? target.id : undefined;
        if (newParent === (dragged.parentId ?? undefined)) return;

        const gAbs = newParent
            ? (rf.getInternalNode(newParent)?.internals?.positionAbsolute ?? { x: 0, y: 0 })
            : { x: 0, y: 0 };
        const position = { x: abs.x - gAbs.x, y: abs.y - gAbs.y };

        setNodes(sortGroupsFirst(nodesRef.current.map((n) => {
            if (n.id !== dragged.id) return n;
            const next = { ...n, position };
            if (newParent) next.parentId = newParent; else delete next.parentId;
            return next;
        })));
    };

    const deleteSelected = () => {
        const delNodeIds = new Set(selectionRef.current.nodes.map((x) => x.id));
        const delEdgeIds = new Set(selectionRef.current.edges.map((x) => x.id));
        if (!delNodeIds.size && !delEdgeIds.size) return false;

        const next = nodesRef.current
            .filter((x) => !delNodeIds.has(x.id))
            .map((n) => {
                // If a node's parent zone is being deleted, keep it where it sits.
                if (n.parentId && delNodeIds.has(n.parentId)) {
                    const abs = rf.getInternalNode(n.id)?.internals?.positionAbsolute ?? n.position;
                    const { parentId, ...rest } = n;
                    return { ...rest, position: abs };
                }
                return n;
            });
        setNodes(sortGroupsFirst(next));
        setEdges(edgesRef.current.filter(
            (e) => !delEdgeIds.has(e.id) && !delNodeIds.has(e.source) && !delNodeIds.has(e.target),
        ));
        selectionRef.current = { nodes: [], edges: [] };
        setHasSel(false);
        commit();
        return true;
    };

    // Arrow-key nudge. Positions update live on each press, but the undo entry is
    // debounced so holding an arrow collapses the whole run into one step.
    const nudgeTimer = useRef(null);
    const flushNudge = () => {
        if (!nudgeTimer.current) return;
        clearTimeout(nudgeTimer.current);
        nudgeTimer.current = null;
        pushHistory();
    };
    const nudge = (dx, dy) => {
        const ids = new Set((selectionRef.current.nodes ?? []).map((n) => n.id));
        if (!ids.size) return false;
        setNodes(nodesRef.current.map((n) =>
            ids.has(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n));
        persist();
        scheduleCapture();
        clearTimeout(nudgeTimer.current);
        nudgeTimer.current = setTimeout(() => { nudgeTimer.current = null; pushHistory(); }, 350);
        return true;
    };

    // ── Copy / paste / duplicate ─────────────────────────────────────────────
    // Snapshot the current selection (nodes + edges wholly between them) into a
    // portable clip. Absolute positions are stored so paste doesn't depend on a
    // node's parent zone still existing.
    const buildClip = () => {
        const sel = selectionRef.current.nodes ?? [];
        if (!sel.length) return null;
        const selIds = new Set(sel.map((n) => n.id));
        const nodes = sel.map((s) => {
            const n = nodesRef.current.find((x) => x.id === s.id) ?? s;
            const abs = rf.getInternalNode(n.id)?.internals?.positionAbsolute ?? n.position;
            const out = { id: n.id, type: n.type, data: { ...n.data }, abs: { x: abs.x, y: abs.y } };
            if (n.type === 'group') { out.width = n.width; out.height = n.height; }
            if (n.parentId) out.parentId = n.parentId;
            return out;
        });
        const edges = edgesRef.current
            .filter((e) => selIds.has(e.source) && selIds.has(e.target))
            .map((e) => ({
                source: e.source, target: e.target,
                sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null,
                data: edgeData(e),
            }));
        return { nodes, edges };
    };

    // Drop a clip into the graph at an offset: mint fresh ids, remap edges and
    // parent membership, select the new nodes (so paste/duplicate can chain).
    const pasteFrom = (clip, offset = { x: 24, y: 24 }) => {
        if (!clip || !clip.nodes.length) return false;
        const idMap = new Map(clip.nodes.map((n) => [n.id, uid()]));
        const absById = new Map(clip.nodes.map((n) => [n.id, n.abs]));

        const newNodes = clip.nodes.map((n) => {
            const node = { id: idMap.get(n.id), type: n.type, data: { ...n.data }, selected: true };
            if (n.type === 'group') { node.width = n.width; node.height = n.height; }
            if (n.parentId && idMap.has(n.parentId)) {
                // Parent came along: keep the child relative; the whole group shifts.
                node.parentId = idMap.get(n.parentId);
                const pAbs = absById.get(n.parentId);
                node.position = { x: n.abs.x - pAbs.x, y: n.abs.y - pAbs.y };
            } else {
                node.position = { x: n.abs.x + offset.x, y: n.abs.y + offset.y };
            }
            return node;
        });
        const newEdges = clip.edges.map((e) => decorateEdge({
            ...e, id: uid(), source: idMap.get(e.source), target: idMap.get(e.target),
        }));

        const existing = nodesRef.current.map((x) => (x.selected ? { ...x, selected: false } : x));
        setNodes(sortGroupsFirst([...existing, ...newNodes]));
        setEdges([...edgesRef.current, ...newEdges]);
        selectionRef.current = { nodes: newNodes, edges: [] };
        setHasSel(true);
        commit();
        return true;
    };

    const copySelection = () => { const c = buildClip(); if (!c) return false; clipboard.current = c; return true; };
    const paste = () => pasteFrom(clipboard.current);
    const duplicate = () => { const c = buildClip(); return c ? pasteFrom(c) : false; };

    keyActions.current = { undo, redo, copySelection, paste, duplicate, deleteSelected, nudge };

    // In the editor, leave node interactivity to React Flow's defaults (all on) so
    // the Controls lock button can toggle it; the read-only mount pins it all off.
    const interactionProps = editable
        ? {}
        : { nodesDraggable: false, nodesConnectable: false, elementsSelectable: false };

    return (
        <NodeBehavior.Provider value={{ editable, onLabelChange, onKindChange, onNodeColorChange, onEdgeChange, onEdgeDelete, onPersist: commit }}>
            <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionMode={ConnectionMode.Loose}
                    snapToGrid={editable && snap}
                    snapGrid={SNAP_GRID}
                    onNodesChange={editable ? onNodesChange : undefined}
                    onEdgesChange={editable ? onEdgesChange : undefined}
                    onConnect={editable ? onConnect : undefined}
                    onNodeDragStop={editable ? ((_, node) => { reparentOnDragStop(node); commit(); }) : undefined}
                    onMoveEnd={editable ? ((_, vp) => { viewportRef.current = vp; persist(); }) : undefined}
                    onSelectionChange={(sel) => { selectionRef.current = sel; setHasSel((sel.nodes?.length ?? 0) > 0); }}
                    defaultViewport={seed.current.viewport ?? { x: 0, y: 0, zoom: 1 }}
                    {...interactionProps}
                    // Read-only mount is a faithful, non-interactive render of the
                    // graph — no panning/zooming so it doesn't hijack page scroll.
                    panOnDrag={editable}
                    zoomOnScroll={editable}
                    zoomOnPinch={editable}
                    zoomOnDoubleClick={editable}
                    preventScrolling={editable}
                    deleteKeyCode={null}   /* explicit Delete button — avoids clashing with the editor */
                    proOptions={{ hideAttribution: true }}
                    fitView={(seed.current.nodes ?? []).length > 0}
                >
                    <Background color="#DAE6D4" gap={18} />
                    {/* Zoom / fit / lock — the lock toggles node interactivity. */}
                    {editable && <Controls showInteractive />}

                    {editable && (
                        <div className="absolute left-2 top-2 z-10 flex gap-1">
                            <button
                                type="button"
                                onClick={addNode}
                                className="flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <IconPlus className="h-3.5 w-3.5" stroke={1.5} /> Node
                            </button>
                            <span className="mx-px w-px self-stretch bg-border" />
                            <button
                                type="button"
                                onClick={undo}
                                disabled={!hist.canUndo}
                                title="Undo (Ctrl+Z)"
                                className="flex items-center justify-center rounded-sm border border-border bg-card px-1.5 py-1 text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-text-secondary"
                            >
                                <IconArrowBackUp className="h-3.5 w-3.5" stroke={1.5} />
                            </button>
                            <button
                                type="button"
                                onClick={redo}
                                disabled={!hist.canRedo}
                                title="Redo (Ctrl+Shift+Z)"
                                className="flex items-center justify-center rounded-sm border border-border bg-card px-1.5 py-1 text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-text-secondary"
                            >
                                <IconArrowForwardUp className="h-3.5 w-3.5" stroke={1.5} />
                            </button>
                            <span className="mx-px w-px self-stretch bg-border" />
                            <button
                                type="button"
                                onClick={addZone}
                                title="Add a grouping zone"
                                className="flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground"
                            >
                                <IconSquareDashed className="h-3.5 w-3.5" stroke={1.5} /> Zone
                            </button>
                            <button
                                type="button"
                                onClick={() => setSnap((s) => !s)}
                                aria-pressed={snap}
                                title={snap ? 'Snap to grid: on' : 'Snap to grid: off'}
                                className={`flex items-center justify-center rounded-sm border px-1.5 py-1 shadow-sm transition-colors ${
                                    snap
                                        ? 'border-sage-300 bg-sage-100 text-sage-700'
                                        : 'border-border bg-card text-text-secondary hover:bg-surface-hover hover:text-foreground'
                                }`}
                            >
                                <IconGridDots className="h-3.5 w-3.5" stroke={1.5} />
                            </button>
                            <button
                                type="button"
                                onClick={duplicate}
                                disabled={!hasSel}
                                title="Duplicate selection (Ctrl+D)"
                                className="flex items-center justify-center rounded-sm border border-border bg-card px-1.5 py-1 text-text-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card disabled:hover:text-text-secondary"
                            >
                                <IconCopy className="h-3.5 w-3.5" stroke={1.5} />
                            </button>
                            <span className="mx-px w-px self-stretch bg-border" />
                            <button
                                type="button"
                                onClick={deleteSelected}
                                title="Delete selected node or connection (Del)"
                                className="flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-text-secondary shadow-sm transition-colors hover:bg-danger hover:text-white"
                            >
                                <IconTrash className="h-3.5 w-3.5" stroke={1.5} /> Delete
                            </button>
                        </div>
                    )}
                </ReactFlow>
            </div>
        </NodeBehavior.Provider>
    );
}

export default function NetworkDiagramCanvas(props) {
    return (
        <ReactFlowProvider>
            <Canvas {...props} />
        </ReactFlowProvider>
    );
}
