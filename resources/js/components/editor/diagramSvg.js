// Builds a standalone SVG string from a diagram graph (the canonical node/edge
// JSON), independent of the live React Flow DOM. We rasterise THIS to derive the
// export PNG: it's far cheaper than html-to-image's per-element style inlining
// (which hitched editing), and it's pure shapes + text — no external refs — so it
// rasterises to a clean, untainted canvas.
//
// The goal is fidelity to the live canvas: real Tabler node icons, the same
// palette, the same edge geometry (React Flow's bezier / smooth-step / straight),
// line colours, dashes and arrowheads. `App\Support\DiagramSvg` is the PHP twin
// (for PDF); keep the two in sync.
//
// Input nodes are pre-placed (absolute x/y + measured w/h, resolved by the caller
// from React Flow) with shape: { id, type:'group'|'labeled', x, y, w, h, label,
// color, iconKind }. Edges use the persisted shape: { source, target,
// sourceHandle, targetHandle, data:{ routing, arrows, lineStyle, color } }.

import ICON_PATHS from './diagramIcons.json';

// Concrete hex of the node palette (the live canvas uses CSS vars / color-mix,
// which don't resolve in a standalone SVG). Mirrors NODE_COLORS in DiagramCanvas.
const NODE_COLORS = {
    default:    { bg: '#FBFAF5', border: '#E4E2D6', accent: '#4B6840', swatch: '#CDDEC4' },
    sage:       { bg: '#EAF1E5', border: '#BFD2B5', accent: '#4B6840', swatch: '#CDDEC4' },
    blue:       { bg: '#E9EFF4', border: '#B8CCDD', accent: '#42637E', swatch: '#C4D6E4' },
    amber:      { bg: '#F6EEDC', border: '#E5CF9F', accent: '#9A6F2E', swatch: '#EBD6A6' },
    terracotta: { bg: '#F4E5DF', border: '#DDB3A6', accent: '#A04A33', swatch: '#E6C2B5' },
    purple:     { bg: '#EEE9F4', border: '#CDBDDD', accent: '#6A5286', swatch: '#D6C7E6' },
};
const LABEL_COLOR = '#1F2520';   // text-foreground
const CANVAS_BG = '#FBFAF5';

const isHex = (s) => typeof s === 'string' && /^#([0-9a-f]{3,8})$/i.test(s);
const nodeColor = (id) =>
    NODE_COLORS[id] ?? (isHex(id)
        ? { bg: id, bgOpacity: 0.16, border: id, borderOpacity: 0.55, accent: id, swatch: id }
        : NODE_COLORS.default);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ~6.2px per char at the 12px node font / ~5.2px at the 10px edge font.
const textWidth = (s, perChar = 6.2) => String(s ?? '').length * perChar;
const truncate = (label, w, perChar = 6.2) => {
    const max = Math.max(2, Math.floor(w / perChar));
    const s = String(label ?? '');
    return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
};

// A 16px Tabler icon (24-unit source, stroke 1.5) anchored at its top-left.
const icon = (kind, x, y, color) => {
    const body = ICON_PATHS[kind];
    if (!body) return '';
    const scale = 16 / 24;
    return `<g transform="translate(${x},${y}) scale(${scale})" fill="none" stroke="${color}"`
        + ` stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
};

// Handle anchor point + outward normal + side for a node box.
const SIDE = {
    top:    (b) => ({ x: b.x + b.w / 2, y: b.y,            nx: 0,  ny: -1, pos: 'top' }),
    right:  (b) => ({ x: b.x + b.w,     y: b.y + b.h / 2,  nx: 1,  ny: 0,  pos: 'right' }),
    bottom: (b) => ({ x: b.x + b.w / 2, y: b.y + b.h,      nx: 0,  ny: 1,  pos: 'bottom' }),
    left:   (b) => ({ x: b.x,           y: b.y + b.h / 2,  nx: -1, ny: 0,  pos: 'left' }),
};
const handle = (box, side) => (SIDE[side] ?? SIDE.bottom)(box);

// ── Edge geometry: ports of React Flow's path builders, so exported edges trace
//    the same curve the live canvas draws. ───────────────────────────────────────

const ctrlOffset = (d, c = 0.25) => (d >= 0 ? 0.5 * d : c * 25 * Math.sqrt(-d));
const control = (pos, x1, y1, x2, y2) => {
    switch (pos) {
        case 'left':  return [x1 - ctrlOffset(x1 - x2), y1];
        case 'right': return [x1 + ctrlOffset(x2 - x1), y1];
        case 'top':   return [x1, y1 - ctrlOffset(y1 - y2)];
        default:      return [x1, y1 + ctrlOffset(y2 - y1)]; // bottom
    }
};

function bezier(s, t) {
    const [scx, scy] = control(s.pos, s.x, s.y, t.x, t.y);
    const [tcx, tcy] = control(t.pos, t.x, t.y, s.x, s.y);
    return {
        d: `M${s.x},${s.y} C${scx},${scy} ${tcx},${tcy} ${t.x},${t.y}`,
        dx: t.x - tcx, dy: t.y - tcy, sdx: s.x - scx, sdy: s.y - scy,
        lx: s.x * 0.125 + scx * 0.375 + tcx * 0.375 + t.x * 0.125,
        ly: s.y * 0.125 + scy * 0.375 + tcy * 0.375 + t.y * 0.125,
    };
}

function straight(s, t) {
    return {
        d: `M${s.x},${s.y} L${t.x},${t.y}`,
        dx: t.x - s.x, dy: t.y - s.y, sdx: s.x - t.x, sdy: s.y - t.y,
        lx: (s.x + t.x) / 2, ly: (s.y + t.y) / 2,
    };
}

// A polyline drawn with rounded corners of radius r (React Flow's smooth-step
// uses borderRadius 8).
function roundedPath(pts, r) {
    const p = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
    if (p.length < 2) return `M${p[0]?.[0] ?? 0},${p[0]?.[1] ?? 0}`;
    let d = `M${p[0][0]},${p[0][1]}`;
    const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const toward = (from, to, len) => {
        const dd = dist(from, to) || 1;
        return [from[0] + (to[0] - from[0]) / dd * len, from[1] + (to[1] - from[1]) / dd * len];
    };
    for (let i = 1; i < p.length - 1; i++) {
        const prev = p[i - 1], cur = p[i], next = p[i + 1];
        const rr = Math.min(r, dist(prev, cur) / 2, dist(cur, next) / 2);
        const enter = toward(cur, prev, rr), exit = toward(cur, next, rr);
        d += ` L${enter[0]},${enter[1]} Q${cur[0]},${cur[1]} ${exit[0]},${exit[1]}`;
    }
    const last = p[p.length - 1];
    d += ` L${last[0]},${last[1]}`;
    return d;
}

function step(s, t) {
    const midX = (s.x + t.x) / 2, midY = (s.y + t.y) / 2;
    const vertical = s.pos === 'top' || s.pos === 'bottom';
    const pts = vertical
        ? [[s.x, s.y], [s.x, midY], [t.x, midY], [t.x, t.y]]
        : [[s.x, s.y], [midX, s.y], [midX, t.y], [t.x, t.y]];
    const a = pts[pts.length - 2], b = pts[pts.length - 1], a2 = pts[1];
    return {
        d: roundedPath(pts, 8),
        dx: b[0] - a[0], dy: b[1] - a[1], sdx: s.x - a2[0], sdy: s.y - a2[1],
        lx: midX, ly: midY,
    };
}

const edgePath = (s, t, routing) =>
    routing === 'straight' ? straight(s, t)
    : routing === 'step' ? step(s, t)
    : bezier(s, t);

// Filled closed arrowhead at (x,y) pointing along (dx,dy) — a <polygon>, not an
// SVG <marker>, so Dompdf's php-svg-lib (no marker support) still draws it.
function arrowhead(x, y, dx, dy, color) {
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const bx = x - ux * 9, by = y - uy * 9;
    const px = -uy * 4.5, py = ux * 4.5;
    return `<polygon points="${x},${y} ${bx + px},${by + py} ${bx - px},${by - py}" fill="${color}"/>`;
}

export function buildDiagramSvg(nodes, edges) {
    if (!nodes.length) return null;

    const PAD = 28;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    }
    const ox = PAD - minX, oy = PAD - minY;
    const width = Math.round(maxX - minX + PAD * 2);
    const height = Math.round(maxY - minY + PAD * 2);
    const box = (n) => ({ x: n.x + ox, y: n.y + oy, w: n.w, h: n.h });
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const parts = [];

    // Zones first, behind everything: solid 1px border, swatch tint (~30%).
    for (const g of nodes.filter((n) => n.type === 'group')) {
        const b = box(g), c = nodeColor(g.color ?? 'sage');
        parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${c.swatch ?? c.bg}"`
            + ` fill-opacity="0.3" stroke="${c.border}" stroke-opacity="${c.borderOpacity ?? 1}" stroke-width="1"/>`);
        if (g.label) parts.push(`<text x="${b.x + 8}" y="${b.y + 15}" font-family="sans-serif" font-size="12"`
            + ` font-weight="600" fill="${c.accent}">${esc(truncate(g.label, b.w - 14))}</text>`);
    }

    // Edges.
    for (const e of edges) {
        const sN = byId.get(e.source), tN = byId.get(e.target);
        if (!sN || !tN) continue;
        const data = e.data || {};
        const color = data.color || '#8E938E';
        const s = handle(box(sN), e.sourceHandle || 'bottom');
        const t = handle(box(tN), e.targetHandle || 'top');
        const p = edgePath(s, t, data.routing || 'curved');
        const dash = data.lineStyle === 'dashed' ? ' stroke-dasharray="6 4"' : '';
        parts.push(`<path d="${p.d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"${dash}/>`);
        const arrows = data.arrows || 'end';
        if (arrows === 'end' || arrows === 'both') parts.push(arrowhead(t.x, t.y, p.dx, p.dy, color));
        if (arrows === 'both') parts.push(arrowhead(s.x, s.y, p.sdx, p.sdy, color));
        if (data.label) {
            const lw = textWidth(data.label, 5.2) + 8, lh = 15;
            parts.push(`<rect x="${p.lx - lw / 2}" y="${p.ly - lh / 2}" width="${lw}" height="${lh}" rx="2"`
                + ` fill="#FBFAF5" fill-opacity="0.95" stroke="#E9E7DC" stroke-width="1"/>`);
            parts.push(`<text x="${p.lx}" y="${p.ly + 3.5}" text-anchor="middle" font-family="sans-serif"`
                + ` font-size="10" font-weight="500" fill="#5C625C">${esc(data.label)}</text>`);
        }
    }

    // Nodes on top.
    for (const n of nodes.filter((x) => x.type !== 'group')) {
        const b = box(n), c = nodeColor(n.color ?? 'default');
        parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${c.bg}"`
            + ` fill-opacity="${c.bgOpacity ?? 1}" stroke="${c.border}" stroke-opacity="${c.borderOpacity ?? 1}" stroke-width="1"/>`);

        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const hasIcon = n.iconKind && n.iconKind !== 'generic' && ICON_PATHS[n.iconKind];
        const label = truncate(n.label || 'Node', b.w - (hasIcon ? 34 : 16));
        if (hasIcon) {
            const tw = textWidth(label);
            const groupW = 16 + 6 + tw;
            const ix = cx - groupW / 2;
            parts.push(icon(n.iconKind, ix, cy - 8, c.accent));
            parts.push(`<text x="${ix + 22}" y="${cy + 4}" font-family="sans-serif" font-size="12"`
                + ` font-weight="500" fill="${LABEL_COLOR}">${esc(label)}</text>`);
        } else {
            parts.push(`<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="sans-serif"`
                + ` font-size="12" font-weight="500" fill="${LABEL_COLOR}">${esc(label)}</text>`);
        }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
        + `<rect width="${width}" height="${height}" fill="${CANVAS_BG}"/>${parts.join('')}</svg>`;
    return { svg, width, height };
}
