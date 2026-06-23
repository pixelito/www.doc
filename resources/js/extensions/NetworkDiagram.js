import { Node } from '@tiptap/core';

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
            // object never leaks into a DOM attribute; node-level renderHTML
            // (and the Phase 2 NodeView) own all rendering.
            graph: {
                default: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
                renderHTML: () => ({}),
            },
            imageSrc: {
                default: null,
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

        if (src) {
            const style =
                'max-width:100%;display:block;' +
                (align === 'center' ? 'margin:0 auto;' : align === 'right' ? 'margin-left:auto;' : '');
            return ['img', { 'data-network-diagram': 'true', src, alt: 'Network diagram', class: 'network-diagram', style }];
        }

        // No render yet (e.g. freshly inserted, pre-save) — a labelled placeholder.
        return ['div', { 'data-network-diagram': 'true', class: 'network-diagram-placeholder' }, 'Network diagram'];
    },
});
