import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    Handle,
    Position,
    MarkerType,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { IconPlus, IconTrash } from '@tabler/icons-react';

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
const NodeBehavior = createContext({ editable: false, onLabelChange: () => {} });

function LabeledNode({ id, data, selected }) {
    const { editable, onLabelChange } = useContext(NodeBehavior);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(data.label ?? '');

    useEffect(() => { setValue(data.label ?? ''); }, [data.label]);

    const commit = () => {
        setEditing(false);
        onLabelChange(id, value.trim() || 'Node');
    };

    return (
        <div
            onDoubleClick={() => editable && setEditing(true)}
            className={`rounded-md border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm ${
                selected ? 'border-sage-500 ring-1 ring-sage-400' : 'border-border'
            }`}
            style={{ minWidth: 90, textAlign: 'center' }}
        >
            <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-border !bg-sage-300" />
            {editing ? (
                <input
                    autoFocus
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
            <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-border !bg-sage-300" />
        </div>
    );
}

const nodeTypes = { labeled: LabeledNode };

// Persisted shape — strip React Flow's transient fields and render-only data.
const cleanNodes = (nodes) =>
    nodes.map((n) => ({ id: n.id, type: 'labeled', position: n.position, data: { label: n.data?.label ?? '' } }));
const cleanEdges = (edges) =>
    edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));

const arrow = { markerEnd: { type: MarkerType.ArrowClosed } };

function Canvas({ graph, editable, onChange }) {
    const seed = useRef(graph ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });

    const [nodes, setNodesState] = useState(() =>
        (seed.current.nodes ?? []).map((n) => ({ ...n, type: 'labeled' })));
    const [edges, setEdgesState] = useState(() =>
        (seed.current.edges ?? []).map((e) => ({ ...e, ...arrow })));

    // Synchronous mirrors so persistence reads final values, not lagged state.
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const viewportRef = useRef(seed.current.viewport ?? { x: 0, y: 0, zoom: 1 });
    const selectionRef = useRef({ nodes: [], edges: [] });

    const setNodes = (next) => { nodesRef.current = next; setNodesState(next); };
    const setEdges = (next) => { edgesRef.current = next; setEdgesState(next); };

    const persist = () => onChange({
        nodes: cleanNodes(nodesRef.current),
        edges: cleanEdges(edgesRef.current),
        viewport: viewportRef.current,
    });

    const onNodesChange = (changes) => setNodes(applyNodeChanges(changes, nodesRef.current));
    const onEdgesChange = (changes) => setEdges(applyEdgeChanges(changes, edgesRef.current));

    const onConnect = (params) => {
        setEdges(addEdge({ ...params, id: uid(), ...arrow }, edgesRef.current));
        persist();
    };

    const onLabelChange = (id, label) => {
        setNodes(nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
        persist();
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
    };

    return (
        <NodeBehavior.Provider value={{ editable, onLabelChange }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={editable ? onNodesChange : undefined}
                onEdgesChange={editable ? onEdgesChange : undefined}
                onConnect={editable ? onConnect : undefined}
                onNodeDragStop={persist}
                onMoveEnd={(_, vp) => { viewportRef.current = vp; persist(); }}
                onSelectionChange={(sel) => { selectionRef.current = sel; }}
                defaultViewport={seed.current.viewport ?? { x: 0, y: 0, zoom: 1 }}
                nodesDraggable={editable}
                nodesConnectable={editable}
                elementsSelectable={editable}
                deleteKeyCode={null}   /* explicit Delete button — avoids clashing with the editor */
                proOptions={{ hideAttribution: true }}
                fitView={(seed.current.nodes ?? []).length > 0}
            >
                <Background color="#DAE6D4" gap={18} />
                <Controls showInteractive={false} />

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
