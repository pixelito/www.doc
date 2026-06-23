import { Suspense, lazy, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { IconTopologyStar3, IconTrash } from '@tabler/icons-react';

// React Flow is heavy, so the editable canvas is split out and only fetched
// when a diagram is actually edited (read view / diagram-free pages skip it).
const Canvas = lazy(() => import('./NetworkDiagramCanvas'));

const EMPTY_GRAPH = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

/**
 * NodeView for the networkDiagram block.
 *   editable  → live React Flow canvas (edits write back to the `graph` attr)
 *   read-only → the derived PNG (`imageSrc`); a placeholder until one exists
 *               (the PNG is generated in phase 3).
 */
export default function NetworkDiagramNodeView({ node, updateAttributes, editor, deleteNode }) {
    const editable = editor.isEditable;
    const graph = node.attrs.graph ?? EMPTY_GRAPH;
    const imageSrc = node.attrs.imageSrc;

    const onChange = useCallback((g) => updateAttributes({ graph: g }), [updateAttributes]);

    if (!editable) {
        return (
            <NodeViewWrapper className="network-diagram-block my-4" data-network-diagram="true">
                {imageSrc ? (
                    <img src={imageSrc} alt="Network diagram" className="block max-w-full rounded-md border border-border" />
                ) : (
                    <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-canvas px-4 py-10 text-sm text-text-tertiary">
                        <IconTopologyStar3 className="h-4 w-4" stroke={1.5} />
                        Network diagram
                    </div>
                )}
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper className="network-diagram-block my-4" contentEditable={false} data-network-diagram="true">
            <div className="overflow-hidden rounded-md border border-border bg-canvas">
                <div className="flex items-center justify-between border-b border-border bg-surface px-3 py-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                        <IconTopologyStar3 className="h-3.5 w-3.5" stroke={1.5} /> Network diagram
                    </span>
                    <button
                        type="button"
                        onClick={deleteNode}
                        title="Remove this diagram"
                        className="flex h-6 w-6 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-danger hover:text-white"
                    >
                        <IconTrash className="h-3.5 w-3.5" stroke={1.5} />
                    </button>
                </div>
                <div style={{ height: 440 }}>
                    <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-text-tertiary">Loading diagram…</div>}>
                        <Canvas graph={graph} editable={editable} onChange={onChange} />
                    </Suspense>
                </div>
            </div>
        </NodeViewWrapper>
    );
}
