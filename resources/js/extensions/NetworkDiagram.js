import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import NetworkDiagramNodeView from '@/components/editor/NetworkDiagramNodeView';

const EMPTY_GRAPH = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

/**
 * Block node holding a React Flow network diagram.
 *
 * The diagram's editable data — `graph` ({ nodes, edges, viewport }) — is the
 * canonical source of truth and rides along in the node's attrs (so it's stored
 * in documents.content and versioned with the page). `imageSrc` is a DERIVED
 * PNG (rendered from the graph on save, uploaded as an asset) shown wherever a
 * live canvas can't run: read view, PDF/DOCX export, search, version snapshots.
 *
 * Phase 1: schema only — the node round-trips through the editor and
 * RenderDocument as a static image/placeholder. The editable React Flow
 * NodeView arrives in Phase 2.
 */
export const NetworkDiagram = Node.create({
    name: 'networkDiagram',
    group: 'block',
    atom: true,        // leaf node — the canvas manages its own internals
    draggable: true,
    selectable: true,

    addAttributes() {
        return {
            // Canonical graph. Each attr declares a no-op renderHTML so the
            // object never leaks into a DOM attribute; the node-level renderHTML
            // and the React NodeView own all rendering.
            graph: {
                default: EMPTY_GRAPH,
                renderHTML: () => ({}),
            },
            imageSrc: {
                default: null,
                renderHTML: () => ({}),
            },
            // User-facing diagram name. Rendered by the node-level renderHTML and
            // the NodeView (as a caption), never as a bare DOM attribute.
            name: {
                default: '',
                renderHTML: () => ({}),
            },
            width: {
                default: null,
                renderHTML: () => ({}),
            },
            align: {
                default: 'left',
                renderHTML: () => ({}),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-network-diagram]' }];
    },

    renderHTML({ node }) {
        const src = node.attrs.imageSrc;
        const align = node.attrs.align ?? 'left';
        const name = (node.attrs.name ?? '').trim();
        const alt = name || 'Network diagram';

        if (src) {
            const style =
                'max-width:100%;display:block;' +
                (align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin-left:auto;' : '');
            const img = ['img', { src, alt, class: 'network-diagram', style }];
            const children = name
                ? [img, ['figcaption', { class: 'network-diagram-caption' }, name]]
                : [img];
            return ['figure', { 'data-network-diagram': 'true', class: 'network-diagram-figure' }, ...children];
        }

        // No render yet (e.g. freshly inserted, pre-save) — a labelled placeholder.
        return ['div', { 'data-network-diagram': 'true', class: 'network-diagram-placeholder' }, alt];
    },

    addNodeView() {
        return ReactNodeViewRenderer(NetworkDiagramNodeView);
    },

    addCommands() {
        return {
            insertNetworkDiagram: () => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs: { graph: EMPTY_GRAPH } }),
        };
    },
});
