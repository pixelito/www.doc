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
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    getNodesBounds,
    getViewportForBounds,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import {
    IconPlus, IconTrash, IconCircleDot, IconServer, IconRouter, IconSwitch3,
    IconShieldLock, IconCloud, IconDatabase, IconDeviceDesktop, IconAccessPoint,
    IconLineDashed, IconArrowNarrowRight, IconArrowsHorizontal, IconMinus,
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
const NodeBehavior = createContext({ editable: false, onLabelChange: () => {}, onKindChange: () => {} });

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

const nodeTypes = { labeled: LabeledNode };

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
    nodes.map((n) => ({
        id: n.id,
        type: 'labeled',
        position: n.position,
        data: { label: n.data?.label ?? '', kind: n.data?.kind ?? 'generic', color: n.data?.color ?? 'default' },
    }));
const cleanEdges = (edges) =>
    edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
        data: edgeData(e),
    }));

function Canvas({ graph, editable, onChange, onImage }) {
    const seed = useRef(graph ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    const wrapperRef = useRef(null);

    const [nodes, setNodesState] = useState(() =>
        (seed.current.nodes ?? []).map((n) => ({ ...n, type: 'labeled' })));
    const [edges, setEdgesState] = useState(() =>
        (seed.current.edges ?? []).map((e) => decorateEdge({
            ...e,
            // Legacy edges (saved before per-side handles) were always bottom→top.
            sourceHandle: e.sourceHandle ?? 'bottom',
            targetHandle: e.targetHandle ?? 'top',
        })));

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
            const bounds = getNodesBounds(nodes);
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

    useEffect(() => () => clearTimeout(captureTimer.current), []);

    const onNodesChange = (changes) => setNodes(applyNodeChanges(changes, nodesRef.current));
    const onEdgesChange = (changes) => setEdges(applyEdgeChanges(changes, edgesRef.current));

    const onConnect = (params) => {
        setEdges(addEdge(decorateEdge({ ...params, id: uid() }), edgesRef.current));
        persist();
        scheduleCapture();
    };

    const onEdgeChange = (id, patch) => {
        setEdges(edgesRef.current.map((e) => (e.id === id ? decorateEdge({ ...e, data: { ...edgeData(e), ...patch } }) : e)));
        persist();
        scheduleCapture();
    };

    const onEdgeDelete = (id) => {
        setEdges(edgesRef.current.filter((e) => e.id !== id));
        persist();
        scheduleCapture();
    };

    const onLabelChange = (id, label) => {
        setNodes(nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
        persist();
        scheduleCapture();
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
        persist();
        scheduleCapture();
    };

    const onNodeColorChange = (id, color) => {
        setNodes(nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n)));
        persist();
        scheduleCapture();
    };

    const addNode = () => {
        const n = nodesRef.current.length;
        const node = {
            id: uid(),
            type: 'labeled',
            position: { x: 80 + (n % 4) * 150, y: 60 + Math.floor(n / 4) * 90 },
            data: { label: 'Node' },
        };
        setNodes([...nodesRef.current, node]);
        persist();
        scheduleCapture();
    };

    const deleteSelected = () => {
        const delNodeIds = new Set(selectionRef.current.nodes.map((x) => x.id));
        const delEdgeIds = new Set(selectionRef.current.edges.map((x) => x.id));
        if (!delNodeIds.size && !delEdgeIds.size) return;

        setNodes(nodesRef.current.filter((x) => !delNodeIds.has(x.id)));
        setEdges(edgesRef.current.filter(
            (e) => !delEdgeIds.has(e.id) && !delNodeIds.has(e.source) && !delNodeIds.has(e.target),
        ));
        selectionRef.current = { nodes: [], edges: [] };
        persist();
        scheduleCapture();
    };

    // In the editor, leave node interactivity to React Flow's defaults (all on) so
    // the Controls lock button can toggle it; the read-only mount pins it all off.
    const interactionProps = editable
        ? {}
        : { nodesDraggable: false, nodesConnectable: false, elementsSelectable: false };

    return (
        <NodeBehavior.Provider value={{ editable, onLabelChange, onKindChange, onNodeColorChange, onEdgeChange, onEdgeDelete }}>
            <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionMode={ConnectionMode.Loose}
                    onNodesChange={editable ? onNodesChange : undefined}
                    onEdgesChange={editable ? onEdgesChange : undefined}
                    onConnect={editable ? onConnect : undefined}
                    onNodeDragStop={editable ? (() => { persist(); scheduleCapture(); }) : undefined}
                    onMoveEnd={editable ? ((_, vp) => { viewportRef.current = vp; persist(); }) : undefined}
                    onSelectionChange={(sel) => { selectionRef.current = sel; }}
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
                            <button
                                type="button"
                                onClick={deleteSelected}
                                title="Delete selected node or connection"
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
