/*
 * Figures: small drawings an entry can carry, described as data and drawn as inline SVG or HTML.
 * Used by the page (drawing) and by the build (checking every figure before it is written to the index).
 *
 *   var F = ScreepsFigures.create(constants, art);   // art: ScreepsGameArt.create(assets), the game's own graphics
 *   F.render(figure, {n: 1})   -> HTML of one <figure>
 *   F.check(figure)            -> {errors: [...], warnings: [...]}
 *   F.icon('tower', 20)        -> one thing of the game as a small standalone SVG
 *   F.defs()                   -> the definitions the drawings refer to; put once into the document
 *   F.wire(element)            -> switches on the hover readout of the line charts inside element
 *
 * Figure types: scene, panels, line, cols, bars, timeline, flow, body, map, ladder.
 * The format of each is described in CONTRIBUTING.md.
 * A scene is drawn with the game's graphics and keeps the game's colours; charts, diagrams and the
 * labels of a scene take their colours from the page's stylesheet (classes), so they follow the theme.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ScreepsFigures = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var PART_NAME = { M: 'MOVE', W: 'WORK', C: 'CARRY', A: 'ATTACK', R: 'RANGED_ATTACK', H: 'HEAL', T: 'TOUGH', L: 'CLAIM' };
    var PART_SHORT = { M: 'M', W: 'W', C: 'C', A: 'A', R: 'R', H: 'H', T: 'T', L: 'CL' };
    var PART_BY_NAME = { MOVE: 'M', WORK: 'W', CARRY: 'C', ATTACK: 'A', RANGED_ATTACK: 'R', RANGED: 'R', HEAL: 'H', TOUGH: 'T', CLAIM: 'L', CL: 'L' };
    var TONES = ['ink', 'accent', 'good', 'bad', 'warn', 'energy', 'dim', 'a', 'b', 'c', 'M', 'W', 'C', 'A', 'R', 'H', 'T', 'L'];

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function rich(s) { var inCode = false; return esc(s).replace(/`/g, function () { inCode = !inCode; return inCode ? '<code>' : '</code>'; }) + (inCode ? '</code>' : ''); }
    function plain(s) { return String(s == null ? '' : s).replace(/`/g, ''); }
    function r1(n) { return Math.round(n * 10) / 10; }
    function nf(n) { if (typeof n !== 'number') return String(n); var r = Math.round(n * 1000) / 1000; return Math.abs(r) >= 10000 ? r.toLocaleString('en-US') : String(r); }
    function compact(n) {
        if (typeof n !== 'number') return String(n);
        var a = Math.abs(n), t = function (x) { return String(Math.round(x * 10) / 10); };
        if (a >= 1e9) return t(n / 1e9) + 'B';
        if (a >= 1e6) return t(n / 1e6) + 'M';
        if (a >= 1e4) return t(n / 1e3) + 'K';
        return nf(n);
    }
    function tw(s, size) { return String(s).length * (size || 11) * 0.54; }
    function tone(t, fallback) { return 'tone-' + (TONES.indexOf(t) === -1 ? (fallback || 'ink') : t); }
    function lines(t) { return Array.isArray(t) ? t : String(t).split('\n'); }

    // 'WWCM', '5W 1C 3M', 'WORK WORK CARRY', [['W', 5], ['M', 3]]  ->  ['W', 'W', ...]   (L or CL is CLAIM)
    function parseBody(spec) {
        if (Array.isArray(spec)) spec = spec.map(function (p) { return Array.isArray(p) ? p[1] + String(p[0]) : p; }).join(' ');
        var out = [], re = /(\d*)\s*([A-Za-z_]+)/g, s = String(spec || ''), m;
        var push = function (p, n) { for (var i = 0; i < n; i++) out.push(p); };
        while ((m = re.exec(s))) {
            var n = m[1] ? +m[1] : 1, name = m[2].toUpperCase();
            if (PART_BY_NAME[name]) push(PART_BY_NAME[name], n);
            else if (name.length === 1 && PART_NAME[name]) push(name, n);
            else if (!m[1] && /^[MWCARHTL]+$/.test(name)) name.split('').forEach(function (c) { push(c, 1); });
            else throw new Error('body "' + spec + '": cannot read "' + m[0] + '" (letters M W C A R H T L, or 5W 2M)');
        }
        if (!out.length) throw new Error('body "' + spec + '" is empty');
        return out;
    }
    function runs(parts) {
        var out = [];
        parts.forEach(function (p) { var last = out[out.length - 1]; if (last && last.p === p) last.n++; else out.push({ p: p, n: 1 }); });
        return out;
    }

    // ------------------------------------------------------------------ glyphs
    // Each draws one thing centred on (x, y) in a tile of size T. Own simple shapes, not the game's art.
    function circ(cls, x, y, r, extra) { return '<circle class="' + cls + '" cx="' + r1(x) + '" cy="' + r1(y) + '" r="' + r1(r) + '"' + (extra || '') + '/>'; }
    function box(cls, x, y, w, h, rx, extra) { return '<rect class="' + cls + '" x="' + r1(x - w / 2) + '" y="' + r1(y - h / 2) + '" width="' + r1(w) + '" height="' + r1(h) + '"' + (rx ? ' rx="' + r1(rx) + '"' : '') + (extra || '') + '/>'; }
    function poly(cls, pts) { return '<polygon class="' + cls + '" points="' + pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '"/>'; }
    function ngon(cls, x, y, r, n, rot) { var pts = []; for (var i = 0; i < n; i++) { var a = (rot || 0) + i * 2 * Math.PI / n; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); } return poly(cls, pts); }
    function gtext(x, y, s, cls, size) { return '<text class="gt' + (cls ? ' ' + cls : '') + '" x="' + r1(x) + '" y="' + r1(y + (size || 10) * 0.36) + '" text-anchor="middle"' + (size ? ' font-size="' + size + '"' : '') + '>' + esc(s) + '</text>'; }
    function arc(cls, x, y, r, a0, a1, w) {
        var p0 = [x + r * Math.cos(a0), y + r * Math.sin(a0)], p1 = [x + r * Math.cos(a1), y + r * Math.sin(a1)];
        return '<path class="' + cls + '" fill="none" stroke-width="' + r1(w) + '" d="M' + r1(p0[0]) + ' ' + r1(p0[1]) + 'A' + r1(r) + ' ' + r1(r) + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + r1(p1[0]) + ' ' + r1(p1[1]) + '"/>';
    }
    function fillOf(o, d) { return Math.max(0, Math.min(1, o.fill === undefined ? d : o.fill)); }

    // The things of a scene are drawn by the art module (lib/gameart.js); it is handed in by create().
    var ART = null;
    function kinds() { return ART ? ART.kinds : []; }
    // how far a thing reaches beyond the middle of its tile, in tiles, where that is more than half a tile
    var REACH = { spawn: 0.7, powerSpawn: 0.7, tower: 0.62, keeperLair: 0.6, nuker: 0.75, controller: 0.78, terminal: 0.75, factory: 0.7, powerBank: 0.7, invaderCore: 0.75, storage: 0.85, extractor: 0.9, lab: 0.58 };
    // how much of its tile a smaller thing fills (radius in tiles); things not listed fill half a tile or what REACH says
    var SMALL = { source: 0.32, container: 0.36, link: 0.4, extension: 0.42, site: 0.3, energy: 0.2, resource: 0.2, tombstone: 0.4, ruin: 0.4, mineral: 0.45, portal: 0.45 };
    var NOBODY = { road: 1, rampart: 1, flag: 1, nuke: 1, extractor: 1, wall: 1 };   // flat or see-through: a label may lie on them
    function radius(t) { return (REACH[t.is] || SMALL[t.is] || 0.5) * (t.scale || 1); }
    function icon(name, size, o) {
        if (!ART || kinds().indexOf(name) === -1) return '';
        var d = ART.draw(name, name === 'road' ? { neighbours: { e: 1, w: 1 } } : o || {}), box = REACH[name] ? 200 * REACH[name] + 20 : 116;
        return '<svg class="fig-svg gi" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="' + (-box / 2) + ' ' + (-box / 2) + ' ' + box + ' ' + box + '" aria-hidden="true">' + (d.main || '') + (d.fx || '') + '</svg>';
    }

    // ------------------------------------------------------------------ shared drawing helpers
    // an arrow from p0 to p1 (already shortened), with an optional bend; returns path + head
    function arrowPath(p0, p1, cls, bend, dashed, both) {
        var dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len, d, ex = ux, ey = uy, sx = -ux, sy = -uy, mid;
        if (bend) {
            var cx = (p0[0] + p1[0]) / 2 - uy * bend * len, cy = (p0[1] + p1[1]) / 2 + ux * bend * len, l2;
            d = 'M' + r1(p0[0]) + ' ' + r1(p0[1]) + 'Q' + r1(cx) + ' ' + r1(cy) + ' ' + r1(p1[0]) + ' ' + r1(p1[1]);
            l2 = Math.sqrt(Math.pow(p1[0] - cx, 2) + Math.pow(p1[1] - cy, 2)) || 1; ex = (p1[0] - cx) / l2; ey = (p1[1] - cy) / l2;
            l2 = Math.sqrt(Math.pow(p0[0] - cx, 2) + Math.pow(p0[1] - cy, 2)) || 1; sx = (p0[0] - cx) / l2; sy = (p0[1] - cy) / l2;
            mid = [(p0[0] + 2 * cx + p1[0]) / 4, (p0[1] + 2 * cy + p1[1]) / 4];
        } else {
            d = 'M' + r1(p0[0]) + ' ' + r1(p0[1]) + 'L' + r1(p1[0]) + ' ' + r1(p1[1]);
            mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        }
        var head = function (p, hx, hy) { var h = 6.5, w = 3.4; return poly('ah ' + cls, [[p[0] + hx * 1.5, p[1] + hy * 1.5], [p[0] - hx * h - hy * w, p[1] - hy * h + hx * w], [p[0] - hx * h + hy * w, p[1] - hy * h - hx * w]]); };
        return { svg: '<path class="ar ' + cls + (dashed ? ' dash' : '') + '" fill="none" d="' + d + '"/>' + head(p1, ex, ey) + (both ? head(p0, sx, sy) : ''), mid: mid, ux: ux, uy: uy, len: len };
    }
    function label(l) {
        var ls = lines(l.text), size = l.size || 11;
        return '<text class="lb' + (l.cls ? ' ' + l.cls : '') + '" x="' + r1(l.x) + '" y="' + r1(l.y) + '" text-anchor="' + (l.anchor || 'middle') + '"' + (l.size ? ' style="font-size:' + l.size + 'px"' : '') + '>' +
            (ls.length === 1 ? esc(ls[0]) : ls.map(function (t, i) { return '<tspan x="' + r1(l.x) + '"' + (i ? ' dy="' + r1(size * 1.2) + '"' : '') + '>' + esc(t) + '</tspan>'; }).join('')) + '</text>';
    }
    function labelBox(l) {
        var size = l.size || 11, ls = lines(l.text), w = Math.max.apply(null, ls.map(function (t) { return tw(t, size); }));
        var x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
        return { x0: x0, x1: x0 + w, y0: l.y - size * 0.8, y1: l.y + size * 0.25 + (ls.length - 1) * size * 1.2, text: ls.join(' ') };
    }
    function svgOpen(w, h, cls, alt, extra) {
        return '<svg class="fig-svg ' + cls + '"' + (cls === 'scene' ? ' width="' + Math.round(w) + '" height="' + Math.round(h) + '"' : '') + ' viewBox="0 0 ' + r1(w) + ' ' + r1(h) + '" style="max-width:' + Math.round(w) + 'px;min-width:min(100%,' + Math.round(Math.min(w, Math.max(300, w * 0.72))) + 'px)" role="img" aria-label="' + esc(alt) + '"' + (extra || '') + '>';
    }
    function altOf(fig) { return plain(fig.title) + '. ' + plain(fig.caption); }

    // ------------------------------------------------------------------ scene: things on the tile grid
    function sceneSvg(fig, alt, notes) {
        if (!ART) throw new Error('a scene is drawn with the game art: create(constants, art)');
        var W = fig.size[0], H = fig.size[1], T = fig.tile || 40, vw = W * T, vh = H * T, s = '', labels = [];
        var ter = fig.terrain || [], x, y, rows = [], over = '', pad = Math.round(T * 0.3);
        var cx = function (p) { return (p[0] + 0.5) * T; }, cy = function (p) { return (p[1] + 0.5) * T; };
        for (y = 0; y < H; y++) {
            var row = '';
            for (x = 0; x < W; x++) {
                var ch = (ter[y] || '').charAt(x) || '.';
                row += ch === 'x' ? '.' : ch;
                if (ch === 'x') over += '<rect class="t3" x="' + x * T + '" y="' + y * T + '" width="' + T + '" height="' + T + '"/>';
            }
            rows.push(row);
        }
        for (x = 1; x < W; x++) over += '<line class="gl" x1="' + x * T + '" x2="' + x * T + '" y1="0" y2="' + vh + '"/>';
        for (y = 1; y < H; y++) over += '<line class="gl" x1="0" x2="' + vw + '" y1="' + y * T + '" y2="' + y * T + '"/>';
        (fig.marks || []).forEach(function (m) {
            var sp = m.span || [1, 1];
            s += '<rect class="mk ' + tone(m.tone, 'accent') + '" x="' + (m.at[0] * T + 1.5) + '" y="' + (m.at[1] * T + 1.5) + '" width="' + (sp[0] * T - 3) + '" height="' + (sp[1] * T - 3) + '" rx="3"/>';
            if (m.text !== undefined) labels.push({ x: (m.at[0] + sp[0] / 2) * T, y: (m.at[1] + sp[1] / 2) * T + 4, text: String(m.text), cls: 'mt', free: true });
        });
        (fig.ranges || []).forEach(function (r) {
            var x0 = Math.max(0, r.at[0] - r.r), y0 = Math.max(0, r.at[1] - r.r), x1 = Math.min(W, r.at[0] + r.r + 1), y1 = Math.min(H, r.at[1] + r.r + 1);
            s += '<rect class="rng ' + tone(r.tone, 'accent') + '" x="' + (x0 * T + 2) + '" y="' + (y0 * T + 2) + '" width="' + ((x1 - x0) * T - 4) + '" height="' + ((y1 - y0) * T - 4) + '" rx="5"/>';
            if (r.label) {
                var at = r.labelAt || 'tl', right = at.charAt(1) === 'r', bottom = at.charAt(0) === 'b';
                labels.push({ x: right ? x1 * T - 7 : x0 * T + 7, y: bottom ? y1 * T - 7 : y0 * T + 15, text: r.label, anchor: right ? 'end' : 'start', cls: 'rl ' + tone(r.tone, 'accent') });
            }
        });
        // one entry per tile for things given with a list of tiles
        var things = [];
        (fig.things || []).forEach(function (t) {
            if (kinds().indexOf(t.is) === -1) throw new Error('scene: unknown thing "' + t.is + '"');
            if (Array.isArray(t.at[0])) t.at.forEach(function (p) { var c = {}; for (var k in t) c[k] = t[k]; c.at = p; things.push(c); });
            else things.push(t);
        });
        things.forEach(function (t) {
            if (!t.label) return;
            var at = t.labelAt || 'bottom', px = cx(t.at), py = cy(t.at), n = lines(t.label).length, r = Math.max(0.5, radius(t)) * T, l;
            l = at === 'top' ? { x: px, y: py - r - 4 - (n - 1) * 13, text: t.label } : at === 'right' ? { x: px + r + 3, y: py + 4, text: t.label, anchor: 'start' } :
                at === 'left' ? { x: px - r - 3, y: py + 4, text: t.label, anchor: 'end' } : { x: px, y: py + r + 12, text: t.label };
            l.of = t;
            labels.push(l);
        });
        // ground, walls, swamps, roads, things and their light, drawn the way the game draws them (100 units per tile)
        // The ground goes on for one more tile on every side (walls and swamps continue), of which a margin is shown.
        var wideRows = rows.map(function (r) { return r.charAt(0) + r + r.charAt(W - 1); });
        wideRows = [wideRows[0]].concat(wideRows, [wideRows[H - 1]]);
        var moved = things.map(function (t) { var c = {}; for (var k in t) c[k] = t[k]; c.at = [t.at[0] + 1, t.at[1] + 1]; return c; });
        var base = '<g transform="translate(' + (pad - T) + ' ' + (pad - T) + ') scale(' + T / 100 + ')">' + ART.scene({ terrain: wideRows, size: [W + 2, H + 2], open: fig.open, things: moved }) + '</g>';
        (fig.paths || []).forEach(function (p) {
            var cls = tone(p.tone, 'ink'), pts = p.via.map(function (q) { return [cx(q), cy(q)]; }), n = pts.length;
            if (n < 2) throw new Error('scene: a path needs two tiles or more');
            var last = pts[n - 1], prev = pts[n - 2], dx = last[0] - prev[0], dy = last[1] - prev[1], len = Math.sqrt(dx * dx + dy * dy) || 1, end = [last[0] - dx / len * 0.34 * T, last[1] - dy / len * 0.34 * T];
            var d = pts.slice(0, n - 1).concat([end]).map(function (q, i) { return (i ? 'L' : 'M') + r1(q[0]) + ' ' + r1(q[1]); }).join('');
            s += '<path class="ar pth ' + cls + (p.dashed ? ' dash' : '') + '" fill="none" d="' + d + '"/>' + (p.arrow === false ? '' : arrowPath(prev, end, cls).svg.replace(/<path[^>]*\/>/, ''));
            if (p.label) { var m = pts[Math.floor((n - 1) / 2)], m2 = pts[Math.floor((n - 1) / 2) + 1] || m; labels.push({ x: (m[0] + m2[0]) / 2 + (p.dx || 0), y: (m[1] + m2[1]) / 2 - 8 + (p.dy || 0), text: p.label, cls: cls }); }
        });
        (fig.arrows || []).forEach(function (a) {
            var p0 = [cx(a.from), cy(a.from)], p1 = [cx(a.to), cy(a.to)], dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.sqrt(dx * dx + dy * dy);
            if (!len) throw new Error('scene: an arrow from a tile to itself');
            var gap = a.gap || (len <= 1.5 * T ? [0.33, 0.33] : [0.42, 0.42]), ux = dx / len, uy = dy / len, cls = tone(a.tone, 'ink');
            var q0 = [p0[0] + ux * gap[0] * T, p0[1] + uy * gap[0] * T], q1 = [p1[0] - ux * gap[1] * T, p1[1] - uy * gap[1] * T];
            var ap = arrowPath(q0, q1, cls, a.bend, a.dashed, a.both);
            s += ap.svg;
            if (a.label) {
                var side = a.side === 'below' || a.side === 'right' ? 1 : -1, n = lines(a.label).length, l;
                if (Math.abs(ux) < 0.35) l = { x: ap.mid[0] + (side === 1 ? 8 : -8), y: ap.mid[1] + 4 - (n - 1) * 6.5, text: a.label, anchor: side === 1 ? 'start' : 'end' };   // vertical: beside the line
                else l = { x: ap.mid[0], y: ap.mid[1] + (side === 1 ? 15 : -7 - (n - 1) * 13), text: a.label };
                l.x += a.dx || 0; l.y += a.dy || 0; l.cls = cls;
                labels.push(l);
            }
        });
        (fig.notes || []).forEach(function (n) { labels.push({ x: (n.at[0] + 0.5) * T, y: (n.at[1] + 0.5) * T + 4, text: n.text, anchor: n.anchor, cls: 'nt-l ' + tone(n.tone, 'ink') + (n.strong ? ' strong' : ''), size: n.size }); });
        if (notes) {
            // layout checks: labels inside the drawing and not on top of one another
            var boxes = labels.map(function (l) { var b = labelBox(l); b.free = l.free; b.of = l.of; return b; });
            boxes.forEach(function (b, i) {
                if (!b.free) things.forEach(function (t) {
                    if (t === b.of || NOBODY[t.is] || t.dim) return;
                    var r = radius(t) * T * 0.85, tx = cx(t.at), ty = cy(t.at), nx = Math.max(b.x0, Math.min(tx, b.x1)), ny = Math.max(b.y0, Math.min(ty, b.y1));
                    if ((nx - tx) * (nx - tx) + (ny - ty) * (ny - ty) < r * r) notes.push('label "' + b.text + '" lies on the ' + t.is + ' at [' + t.at + '] (things are drawn as large as in the game; move the label or leave a free tile)');
                });
                if (b.x0 < -pad - 3 || b.x1 > vw + pad + 3 || b.y0 < -pad - 3 || b.y1 > vh + pad + 3) notes.push('label "' + b.text + '" leaves the drawing (move it with labelAt, dx, dy, or add a free row or column)');
                for (var j = i + 1; j < boxes.length; j++) {
                    var c = boxes[j];
                    if (Math.min(b.x1, c.x1) - Math.max(b.x0, c.x0) > 3 && Math.min(b.y1, c.y1) - Math.max(b.y0, c.y0) > 3) notes.push('labels "' + b.text + '" and "' + c.text + '" overlap');
                }
            });
        }
        return svgOpen(vw + 2 * pad, vh + 2 * pad, 'scene', alt) + base + '<g transform="translate(' + pad + ' ' + pad + ')">' + over + s + labels.map(label).join('') + '</g></svg>';
    }
    function scene(fig) { return sceneSvg(fig, altOf(fig)); }

    var TAG_ICON = {
        good: '<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M2.5 7l3 3 5-6.5"/></svg>',
        bad: '<svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M3 3l7 7M10 3l-7 7"/></svg>',
    };
    function panels(fig) {
        return '<div class="panels">' + fig.panels.map(function (p) {
            return '<div class="panel"><p class="ptag ' + tone(p.tone, 'ink') + '">' + (TAG_ICON[p.tone] || '') + rich(p.tag) + '</p><div class="panel-art">' + sceneSvg(p, plain(p.tag) + (p.note ? '. ' + plain(p.note) : '')) + '</div>' + (p.note ? '<p class="pnote">' + rich(p.note) + '</p>' : '') + '</div>';
        }).join('') + '</div>';
    }

    // ------------------------------------------------------------------ charts
    function niceMax(v) {
        if (!(v > 0)) return 1;
        var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10 + 1e-9)), m = v / p, k = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 8 ? 8 : 10;
        return k * p;
    }
    function yTicks(max) {
        var p = Math.pow(10, Math.floor(Math.log(max) / Math.LN10 + 1e-9)), m = Math.round(max / p * 10) / 10, n = m === 2 || m === 4 || m === 8 ? 4 : 5, out = [];
        for (var i = 0; i <= n; i++) out.push(Math.round(max * i / n * 1e6) / 1e6);
        return out;
    }
    var SER = ['s1', 's2', 's3'];
    function legend(series, extra) {
        if (series.length < 2 && !extra) return '';
        return '<div class="legend">' + (series.length > 1 ? series.map(function (sr, i) { return '<span><i class="' + SER[i] + '"></i>' + esc(sr.name) + '</span>'; }).join('') : '') + (extra ? '<span class="lg-note">' + rich(extra) + '</span>' : '') + '</div>';
    }
    function valueAt(sr, x) {
        var p = sr.pts, i;
        if (x <= p[0][0]) return x < p[0][0] ? null : p[0][1];
        if (x > p[p.length - 1][0]) return null;
        for (i = 1; i < p.length; i++) if (x <= p[i][0]) {
            if (x === p[i][0]) return p[i][1];
            return sr.step ? p[i - 1][1] : p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
        }
        return null;
    }
    function lineGeom(fig) {
        var xs = [], ys = [0];
        fig.series.forEach(function (sr) { sr.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
        var x = fig.x || {}, yv = fig.y || {};
        var g = { w: 640, h: 280, l: 52, r: fig.endLabels === false ? 18 : 104, t: 32, b: 40 };
        g.x0 = x.min !== undefined ? x.min : Math.min.apply(null, xs);
        g.x1 = x.max !== undefined ? x.max : Math.max.apply(null, xs);
        g.ymax = yv.max !== undefined ? yv.max : niceMax(Math.max.apply(null, ys));
        return g;
    }
    function line(fig) {
        var g = lineGeom(fig), x = fig.x || {}, yv = fig.y || {}, s = '', notes = '';
        var px = function (v) { return g.l + (g.w - g.l - g.r) * (v - g.x0) / (g.x1 - g.x0); };
        var py = function (v) { return g.h - g.b - (g.h - g.t - g.b) * v / g.ymax; };
        yTicks(g.ymax).forEach(function (v) { s += '<line class="' + (v ? 'grid' : 'axis') + '" x1="' + g.l + '" x2="' + r1(px(g.x1)) + '" y1="' + r1(py(v)) + '" y2="' + r1(py(v)) + '"/><text class="tk" x="' + (g.l - 8) + '" y="' + r1(py(v) + 4) + '" text-anchor="end">' + compact(v) + '</text>'; });
        var xt = x.ticks, i;
        if (!xt) { xt = []; var step = x.step || niceMax((g.x1 - g.x0) / 5); for (i = Math.ceil(g.x0 / step) * step; i <= g.x1 + 1e-9; i += step) xt.push(Math.round(i * 1e6) / 1e6); }
        xt.forEach(function (v) { s += '<text class="tk" x="' + r1(px(v)) + '" y="' + (g.h - g.b + 16) + '" text-anchor="middle">' + compact(v) + '</text>'; });
        if (x.label) s += '<text class="tk" x="' + r1(px((g.x0 + g.x1) / 2)) + '" y="' + (g.h - 4) + '" text-anchor="middle">' + esc(x.label) + '</text>';
        (fig.marks || []).forEach(function (m) {
            if (m.x !== undefined) {
                s += '<line class="guide" x1="' + r1(px(m.x)) + '" x2="' + r1(px(m.x)) + '" y1="' + g.t + '" y2="' + (g.h - g.b) + '"/>';
                if (m.label) notes += '<text class="tk gl" x="' + r1(px(m.x) + (m.anchor === 'end' ? -6 : 6)) + '" y="' + (g.h - g.b - 8 + (m.dy || 0)) + '" text-anchor="' + (m.anchor || 'start') + '">' + esc(m.label) + '</text>';
            } else {
                s += '<line class="guide" x1="' + g.l + '" x2="' + r1(px(g.x1)) + '" y1="' + r1(py(m.y)) + '" y2="' + r1(py(m.y)) + '"/>';
                if (m.label) notes += '<text class="tk gl" x="' + (g.l + 6) + '" y="' + r1(py(m.y) - 5) + '">' + esc(m.label) + '</text>';
            }
        });
        var ends = [];
        fig.series.forEach(function (sr, si) {
            var d = '';
            sr.pts.forEach(function (p, k) { d += (k ? (sr.step ? 'H' + r1(px(p[0])) + 'V' + r1(py(p[1])) : 'L' + r1(px(p[0])) + ' ' + r1(py(p[1]))) : 'M' + r1(px(p[0])) + ' ' + r1(py(p[1]))); });
            var last = sr.pts[sr.pts.length - 1];
            s += '<path class="ln ' + SER[si] + '" d="' + d + '"/>';
            if (sr.dots) sr.pts.forEach(function (p) { s += '<circle class="dot ' + SER[si] + '" cx="' + r1(px(p[0])) + '" cy="' + r1(py(p[1])) + '" r="3.2"/>'; });
            s += '<circle class="dot ' + SER[si] + '" cx="' + r1(px(last[0])) + '" cy="' + r1(py(last[1])) + '" r="4"/>';
            ends.push({ x: px(last[0]) + 9, y: py(last[1]) + 4, text: (fig.series.length > 1 ? sr.name + ' ' : '') + compact(last[1]) });
        });
        if (fig.endLabels !== false) {
            ends.sort(function (a, b) { return a.y - b.y; });
            for (i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
            ends.forEach(function (e) { s += '<text class="end" x="' + r1(e.x) + '" y="' + r1(e.y) + '">' + esc(e.text) + '</text>'; });
        }
        s += notes + (yv.label ? '<text class="tk yt" x="' + (g.l - 44) + '" y="14">' + esc(yv.label) + '</text>' : '');
        s += '<g class="hover" hidden><line class="cross" y1="' + g.t + '" y2="' + (g.h - g.b) + '"/>' + fig.series.map(function (sr, si) { return '<circle class="dot ' + SER[si] + '" r="4"/>'; }).join('') + '</g>';
        var data = { g: g, x: (x.label || '').replace(/\s*\(.*\)$/, ''), series: fig.series.map(function (sr) { return { name: sr.name, pts: sr.pts, step: !!sr.step }; }), snap: x.snap || 0 };
        return '<div class="plotbox">' + (fig.endLabels === false ? legend(fig.series) : '') + '<div class="chart" data-line="' + esc(JSON.stringify(data)) + '">' + svgOpen(g.w, g.h, 'plot', altOf(fig), ' tabindex="0"') + s + '</svg><div class="tip" hidden></div></div></div>';
    }
    function cols(fig) {
        var cats = fig.x.cats, k = fig.series.length, n = cats.length, g = { w: 640, h: 270, l: 52, r: 12, t: 38, b: fig.x.label ? 42 : 26 }, s = '';
        var all = [0]; fig.series.forEach(function (sr) { sr.values.forEach(function (v) { all.push(v); }); });
        var ymax = (fig.y || {}).max !== undefined ? fig.y.max : niceMax(Math.max.apply(null, all));
        var py = function (v) { return g.h - g.b - (g.h - g.t - g.b) * v / ymax; };
        yTicks(ymax).forEach(function (v) { s += '<line class="' + (v ? 'grid' : 'axis') + '" x1="' + g.l + '" x2="' + (g.w - g.r) + '" y1="' + r1(py(v)) + '" y2="' + r1(py(v)) + '"/><text class="tk" x="' + (g.l - 8) + '" y="' + r1(py(v) + 4) + '" text-anchor="end">' + compact(v) + '</text>'; });
        var band = (g.w - g.l - g.r) / n, bw = Math.min(40, band * 0.76 / k), showValues = fig.values !== false && n * k <= 18;
        cats.forEach(function (c, ci) {
            var mid = g.l + band * (ci + 0.5);
            fig.series.forEach(function (sr, si) {
                var v = sr.values[ci], x0 = mid - bw * k / 2 + si * bw, y0 = py(v), h = g.h - g.b - y0;
                if (v > 0) s += '<path class="col ' + SER[si] + '" d="M' + r1(x0 + 1) + ' ' + r1(g.h - g.b) + 'V' + r1(y0 + Math.min(3, h)) + 'Q' + r1(x0 + 1) + ' ' + r1(y0) + ' ' + r1(x0 + 1 + Math.min(3, h)) + ' ' + r1(y0) + 'H' + r1(x0 + bw - 1 - Math.min(3, h)) + 'Q' + r1(x0 + bw - 1) + ' ' + r1(y0) + ' ' + r1(x0 + bw - 1) + ' ' + r1(y0 + Math.min(3, h)) + 'V' + r1(g.h - g.b) + 'Z"><title>' + esc((k > 1 ? sr.name + ', ' : '') + (fig.x.label ? fig.x.label + ' ' : '') + c + ': ' + nf(v)) + '</title></path>';
                if (showValues) s += '<text class="val" x="' + r1(x0 + bw / 2) + '" y="' + r1(y0 - 5) + '" text-anchor="middle">' + (v ? compact(v) : '·') + '</text>';
            });
            s += '<text class="tk" x="' + r1(mid) + '" y="' + (g.h - g.b + 16) + '" text-anchor="middle">' + esc(c) + '</text>';
        });
        if (fig.x.label) s += '<text class="tk" x="' + r1(g.l + (g.w - g.l - g.r) / 2) + '" y="' + (g.h - 4) + '" text-anchor="middle">' + esc(fig.x.label) + '</text>';
        s += (fig.y || {}).label ? '<text class="tk yt" x="' + (g.l - 44) + '" y="14">' + esc(fig.y.label) + '</text>' : '';
        return '<div class="plotbox">' + legend(fig.series) + '<div class="chart">' + svgOpen(g.w, g.h, 'plot', altOf(fig)) + s + '</svg></div></div>';
    }
    function bars(fig) {
        var max = fig.max || Math.max.apply(null, fig.rows.map(function (r) { return r.value; }));
        return '<div class="bars">' + fig.rows.map(function (r) {
            return '<div class="brow"><span class="bl">' + rich(r.label) + (r.sub ? '<small>' + rich(r.sub) + '</small>' : '') + '</span><span class="bt"><i class="' + tone(r.tone, 'a') + '" style="width:' + r1(Math.max(0, Math.min(100, r.value / max * 100))) + '%"></i></span><span class="bv">' + esc(r.text !== undefined ? r.text : nf(r.value) + (fig.unit ? ' ' + fig.unit : '')) + '</span></div>';
        }).join('') + '</div>';
    }

    // ------------------------------------------------------------------ timeline: lanes over ticks
    function timeline(fig) {
        var span = Array.isArray(fig.span) ? fig.span : [0, fig.span], rows = fig.rows, s = '';
        var lw = Math.max(64, Math.min(190, Math.max.apply(null, rows.map(function (r) { return tw(r.label || '', 12); })) + 18));
        var g = { w: 640, l: lw, r: 18, t: 8 }, y = g.t;
        var px = function (v) { return g.l + (g.w - g.l - g.r) * (v - span[0]) / (span[1] - span[0]); };
        var ticks = fig.ticks, i;
        if (!ticks) { ticks = []; var step = niceMax((span[1] - span[0]) / 5); for (i = Math.ceil(span[0] / step) * step; i <= span[1] + 1e-9; i += step) ticks.push(Math.round(i * 1e6) / 1e6); }
        var body = '';
        rows.forEach(function (r) {
            var hasMarkText = (r.marks || []).some(function (m) { return m.text; });
            if (hasMarkText) y += 15;
            var top = y, h = 24;
            body += '<text class="tl-l" x="' + (g.l - 10) + '" y="' + (top + h / 2 + 4) + '" text-anchor="end">' + esc(r.label || '') + '</text>';
            body += '<rect class="tl-track" x="' + g.l + '" y="' + top + '" width="' + (g.w - g.l - g.r) + '" height="' + h + '" rx="5"/>';
            (r.segs || []).forEach(function (sg) {
                var x0 = px(Math.max(span[0], sg.from)), x1 = px(Math.min(span[1], sg.to)), w = Math.max(2, x1 - x0 - 1.5);
                body += '<rect class="tl-seg ' + tone(sg.tone, 'a') + '" x="' + r1(x0 + 0.75) + '" y="' + top + '" width="' + r1(w) + '" height="' + h + '" rx="5"><title>' + esc((sg.text || '') + ' (' + nf(sg.from) + ' to ' + nf(sg.to) + ')') + '</title></rect>';
                if (sg.text && tw(sg.text, 11) + 8 <= w) body += '<text class="tl-t ' + tone(sg.tone, 'a') + '" x="' + r1(x0 + 0.75 + w / 2) + '" y="' + (top + h / 2 + 4) + '" text-anchor="middle">' + esc(sg.text) + '</text>';
            });
            (r.marks || []).forEach(function (m) {
                var x = px(m.at), end = (m.anchor || (x > g.l + (g.w - g.l - g.r) * 0.7 ? 'end' : 'start'));
                body += '<line class="tl-m ' + tone(m.tone, 'ink') + '" x1="' + r1(x) + '" x2="' + r1(x) + '" y1="' + (top - 4) + '" y2="' + (top + h + 3) + '"/>' + circ('tl-d ' + tone(m.tone, 'ink'), x, top - 4, 3);
                if (m.text) body += '<text class="tl-mt" x="' + r1(x + (end === 'end' ? -6 : 6)) + '" y="' + (top - 4) + '" text-anchor="' + end + '">' + esc(m.text) + '</text>';
            });
            y += h + 10;
        });
        var axisY = y + 2, gridTop = g.t;
        ticks.forEach(function (v) { s += '<line class="grid" x1="' + r1(px(v)) + '" x2="' + r1(px(v)) + '" y1="' + gridTop + '" y2="' + axisY + '"/><text class="tk" x="' + r1(px(v)) + '" y="' + (axisY + 14) + '" text-anchor="middle">' + compact(v) + '</text>'; });
        var hh = axisY + 20;
        if (fig.unit) { s += '<text class="tk" x="' + r1(g.l + (g.w - g.l - g.r) / 2) + '" y="' + (axisY + 30) + '" text-anchor="middle">' + esc(fig.unit) + '</text>'; hh += 16; }
        return svgOpen(g.w, hh, 'tl', altOf(fig)) + s + body + '</svg>';
    }

    // ------------------------------------------------------------------ flow: boxes on a grid, labelled arrows
    function flowGeom(fig) {
        var cw = (fig.cell || [])[0] || 150, chh = (fig.cell || [])[1] || 50, byId = {}, maxC = 0, maxR = 0, gx = 44, gy = 30;
        fig.nodes.forEach(function (n) { byId[n.id] = n; maxC = Math.max(maxC, n.at[0] + (n.span || 1) - 1); maxR = Math.max(maxR, n.at[1]); });
        (fig.edges || []).forEach(function (e) {
            var a = byId[e.from], b = byId[e.to];
            if (!a || !b || !e.label) return;
            var w = Math.max.apply(null, lines(e.label).map(function (t) { return tw(t, 11); }));
            if (a.at[1] === b.at[1]) gx = Math.max(gx, w + 18);
            else gy = Math.max(gy, 34 + (lines(e.label).length - 1) * 13);
        });
        return { cw: cw, ch: chh, gx: gx, gy: gy, byId: byId, w: (maxC + 1) * cw + maxC * gx + 2, h: (maxR + 1) * chh + maxR * gy + 2 };
    }
    function flow(fig) {
        var g = flowGeom(fig), s = '', top = '';
        var rect = function (n) { var sp = n.span || 1; return { x: 1 + n.at[0] * (g.cw + g.gx), y: 1 + n.at[1] * (g.ch + g.gy), w: sp * g.cw + (sp - 1) * g.gx, h: g.ch }; };
        var clip = function (r, cx0, cy0, dx, dy) {   // where the ray from the centre leaves the box
            var tx = dx ? (r.w / 2) / Math.abs(dx) : Infinity, ty = dy ? (r.h / 2) / Math.abs(dy) : Infinity, t = Math.min(tx, ty);
            return [cx0 + dx * t, cy0 + dy * t];
        };
        (fig.edges || []).forEach(function (e) {
            var a = rect(g.byId[e.from]), b = rect(g.byId[e.to]), ac = [a.x + a.w / 2, a.y + a.h / 2], bc = [b.x + b.w / 2, b.y + b.h / 2];
            // straight across when the boxes share a row or overlap in a column
            if (g.byId[e.from].at[1] !== g.byId[e.to].at[1] && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 20) { var mx = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2; ac[0] = mx; bc[0] = mx; }
            var dx = bc[0] - ac[0], dy = bc[1] - ac[1], len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
            var p0 = clip({ w: a.w, h: a.h }, ac[0], ac[1], ux, uy), p1 = clip({ w: b.w, h: b.h }, bc[0], bc[1], -ux, -uy);
            p0 = [p0[0] + ux * 3, p0[1] + uy * 3]; p1 = [p1[0] - ux * 4, p1[1] - uy * 4];
            var cls = tone(e.tone, 'ink'), ap = arrowPath(p0, p1, cls, e.bend, e.dashed, e.both);
            s += ap.svg;
            if (e.label) {
                var n = lines(e.label).length, l = Math.abs(ux) < 0.35 ? { x: ap.mid[0] + 7, y: ap.mid[1] + 4 - (n - 1) * 6.5, text: e.label, anchor: 'start' } : { x: ap.mid[0], y: ap.mid[1] - 6 - (n - 1) * 13, text: e.label };
                l.x += e.dx || 0; l.y += e.dy || 0; l.cls = cls;
                top += label(l);
            }
        });
        fig.nodes.forEach(function (n) {
            var r = rect(n), cls = tone(n.tone, 'ink'), cx0 = r.x + r.w / 2, ls = lines(n.text), hasSub = !!n.sub, total = ls.length * 15 + (hasSub ? 14 : 0), y0 = r.y + (r.h - total) / 2 + 11;
            s += '<rect class="fl-box ' + cls + '" x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="8"/>';
            ls.forEach(function (t, i) { s += '<text class="fl-t ' + cls + (n.mono ? ' mono' : '') + '" x="' + r1(cx0) + '" y="' + r1(y0 + i * 15) + '" text-anchor="middle">' + esc(t) + '</text>'; });
            if (hasSub) s += '<text class="fl-s" x="' + r1(cx0) + '" y="' + r1(y0 + ls.length * 15 - 1) + '" text-anchor="middle">' + esc(n.sub) + '</text>';
        });
        return svgOpen(g.w, g.h, 'flow', altOf(fig)) + s + top + '</svg>';
    }

    // ------------------------------------------------------------------ body: the parts of a creep, in order
    function chip(p, cls) { return '<i class="pc p-' + p + (cls ? ' ' + cls : '') + '" title="' + PART_NAME[p] + '">' + PART_SHORT[p] + '</i>'; }
    function bodyStats(parts, C) {
        var cost = 0;
        parts.forEach(function (p) { cost += (C.BODYPART_COST || {})[PART_NAME[p].toLowerCase()] || 0; });
        return { cost: cost, spawn: parts.length * (C.CREEP_SPAWN_TIME || 3), hits: parts.length * 100 };
    }
    function bodyFig(fig, C) {
        return '<div class="bodies">' + fig.rows.map(function (r) {
            var parts = parseBody(r.parts), st = bodyStats(parts, C), dead = r.dead || 0, boost = r.boost || {};
            var meta = fig.stats === false ? '' : '<span class="bstat"><b>' + nf(st.cost) + '</b> energy · <b>' + st.spawn + '</b> ticks to spawn · <b>' + nf(st.hits) + '</b> hits</span>';
            return '<div class="brow2"><div class="bhead"><span class="bname">' + rich(r.label || '') + '</span>' + meta + '</div><div class="pcs">' +
                parts.map(function (p, i) { return chip(p, (i < dead ? 'dead' : '') + (boost[p] ? ' boosted' : '')); }).join('') + '</div>' + (r.note ? '<p class="bnote">' + rich(r.note) + '</p>' : '') + '</div>';
        }).join('') + (fig.order ? '<p class="border"><span>damage arrives here first</span><span>last to be lost</span></p>' : '') + '</div>';
    }

    // ------------------------------------------------------------------ map: a grid of cells by kind, with a key
    function map(fig) {
        var rows = fig.rows, H = rows.length, W = rows[0].length, c = fig.cell || 22, ml = fig.ylabels ? Math.max.apply(null, fig.ylabels.map(function (t) { return tw(t, 10); })) + 8 : 0, mt = fig.xlabels ? 16 : 0, s = '', gap = c >= 14 ? 1 : 0.5;
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var k = fig.key[rows[y].charAt(x)];
            s += '<rect class="mc ' + tone(k && k.tone, 'dim') + (k && k.tone ? '' : ' none') + (k && k.weak ? ' weak' : '') + '" x="' + r1(ml + x * c + gap / 2) + '" y="' + r1(mt + y * c + gap / 2) + '" width="' + r1(c - gap) + '" height="' + r1(c - gap) + '"' + (c >= 14 ? ' rx="2"' : '') + '/>';
        }
        (fig.xlabels || []).forEach(function (t, i) { if (t) s += '<text class="tk" x="' + r1(ml + (i + 0.5) * c) + '" y="11" text-anchor="middle">' + esc(t) + '</text>'; });
        (fig.ylabels || []).forEach(function (t, i) { if (t) s += '<text class="tk" x="' + r1(ml - 6) + '" y="' + r1(mt + (i + 0.5) * c + 3.5) + '" text-anchor="end">' + esc(t) + '</text>'; });
        (fig.marks || []).forEach(function (m) {
            if (m.box) s += '<rect class="mbox ' + tone(m.tone, 'ink') + '" x="' + r1(ml + m.at[0] * c) + '" y="' + r1(mt + m.at[1] * c) + '" width="' + r1(m.box[0] * c) + '" height="' + r1(m.box[1] * c) + '" rx="3"/>';
            if (m.text !== undefined) s += label({ x: ml + (m.at[0] + (m.box ? m.box[0] / 2 : 0.5)) * c, y: mt + (m.at[1] + (m.box ? m.box[1] / 2 : 0.5)) * c + 4, text: String(m.text), anchor: m.anchor, cls: 'strong', size: m.size }).replace('<text', '<text transform="translate(' + (m.dx || 0) + ' ' + (m.dy || 0) + ')"');
        });
        var keyHtml = '<div class="legend key">' + Object.keys(fig.key).filter(function (ch) { return fig.key[ch].label; }).map(function (ch) { return '<span><i class="sw ' + tone(fig.key[ch].tone, 'dim') + (fig.key[ch].tone ? '' : ' none') + (fig.key[ch].weak ? ' weak' : '') + '"></i>' + rich(fig.key[ch].label) + '</span>'; }).join('') + '</div>';
        return svgOpen(ml + W * c, mt + H * c, 'map', altOf(fig)) + s + '</svg>' + keyHtml;
    }

    function ladder(fig) {
        return '<div class="ladder">' + fig.groups.map(function (g) {
            return '<div><p class="lad-t">' + rich(g.title) + '</p>' + (g.note ? '<p class="lad-n">' + rich(g.note) + '</p>' : '') + '<ol class="rungs">' +
                g.items.map(function (it, i) { return '<li>' + (g.ordered ? '<b>' + (i + 1) + '</b>' : '') + esc(it) + '</li>' + (g.ordered && i < g.items.length - 1 ? '<li class="gt-sep" aria-hidden="true">›</li>' : ''); }).join('') + '</ol></div>';
        }).join('') + '</div>';
    }

    // ------------------------------------------------------------------ checks
    function isPos(p) { return Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number'; }
    function checkScene(fig, err, warn, where) {
        if (!Array.isArray(fig.size) || !(fig.size[0] > 0) || !(fig.size[1] > 0)) return err(where + 'size: [tiles wide, tiles high] is required');
        var W = fig.size[0], H = fig.size[1];
        if (W * (fig.tile || 40) > 520) warn(where + 'is ' + W + ' tiles wide; more than 13 tiles of 40 gets small on a phone (use fewer tiles or a smaller tile)');
        var inside = function (p, what, frac) { if (!isPos(p)) return err(where + what + ': a position is [x, y]'); if (p[0] < 0 || p[1] < 0 || p[0] > W - (frac ? 0 : 1) || p[1] > H - (frac ? 0 : 1)) err(where + what + ' at [' + p + '] is outside the ' + W + ' x ' + H + ' grid'); };
        (fig.terrain || []).forEach(function (row, i) { if (row.length !== W || !/^[.#~x]*$/.test(row)) err(where + 'terrain row ' + i + ' must be ' + W + ' characters of . # ~ x'); });
        if (fig.terrain && fig.terrain.length !== H) err(where + 'terrain needs ' + H + ' rows');
        (fig.things || []).forEach(function (t) {
            if (kinds().indexOf(t.is) === -1) return err(where + 'unknown thing "' + t.is + '" (known: ' + kinds().join(', ') + ')');
            (Array.isArray(t.at) && Array.isArray(t.at[0]) ? t.at : [t.at]).forEach(function (p) { inside(p, t.is); });
            if (t.body) try { parseBody(t.body); } catch (x) { err(where + x.message); }
            if (t.labelAt && ['top', 'bottom', 'left', 'right'].indexOf(t.labelAt) === -1) err(where + 'labelAt is top, bottom, left or right');
        });
        (fig.ranges || []).forEach(function (r) { inside(r.at, 'range'); if (typeof r.r !== 'number') err(where + 'a range needs r'); });
        (fig.marks || []).forEach(function (m) { inside(m.at, 'mark'); });
        (fig.arrows || []).forEach(function (a) { inside(a.from, 'arrow start', true); inside(a.to, 'arrow end', true); });
        (fig.paths || []).forEach(function (p) { (p.via || []).forEach(function (q) { inside(q, 'path'); }); });
        (fig.notes || []).forEach(function (n) { if (!isPos(n.at)) err(where + 'a note needs at: [x, y]'); if (n.text === undefined) err(where + 'a note needs text'); });
        ['things', 'ranges', 'marks', 'arrows', 'paths', 'notes'].forEach(function (k) {
            (fig[k] || []).forEach(function (o) { ['tone'].forEach(function (f) { if (o[f] !== undefined && TONES.indexOf(o[f]) === -1) err(where + k + ': unknown tone "' + o[f] + '" (known: ' + TONES.join(', ') + ')'); }); });
        });
    }
    function check(fig) {
        var errors = [], warnings = [];
        var err = function (m) { errors.push(m); }, warn = function (m) { warnings.push(m); };
        if (!fig || typeof fig !== 'object') return { errors: ['a figure must be an object'], warnings: [] };
        if (!TYPES[fig.type]) return { errors: ['unknown figure type "' + fig.type + '" (known: ' + Object.keys(TYPES).join(', ') + ')'], warnings: [] };
        if (!fig.title || typeof fig.title !== 'string') err('title is required');
        else if (fig.title.length > 70) warn('title is ' + fig.title.length + ' characters; keep it under 70');
        if (!fig.caption || typeof fig.caption !== 'string') err('caption is required: one or two sentences that say what the drawing shows');
        try {
            if (fig.type === 'scene') checkScene(fig, err, warn, '');
            if (fig.type === 'panels') {
                if (!Array.isArray(fig.panels) || fig.panels.length < 2 || fig.panels.length > 3) err('panels: two or three panels');
                else fig.panels.forEach(function (p, i) { if (!p.tag) err('panel ' + (i + 1) + ' needs a tag'); checkScene(p, err, warn, 'panel ' + (i + 1) + ': '); });
            }
            if (fig.type === 'line') {
                if (!Array.isArray(fig.series) || !fig.series.length || fig.series.length > 3) err('line: one to three series');
                else fig.series.forEach(function (sr) {
                    if (!sr.name) err('line: every series needs a name');
                    if (!Array.isArray(sr.pts) || sr.pts.length < 2 || !sr.pts.every(isPos)) err('line: series "' + sr.name + '" needs pts: [[x, y], ...] with two points or more');
                    else for (var i = 1; i < sr.pts.length; i++) if (sr.pts[i][0] < sr.pts[i - 1][0]) { err('line: series "' + sr.name + '" must go from left to right'); break; }
                });
                if (!fig.x || !fig.x.label) err('line: x.label is required');
                if (!fig.y || !fig.y.label) err('line: y.label is required (what the numbers are)');
            }
            if (fig.type === 'cols') {
                if (!fig.x || !Array.isArray(fig.x.cats) || !fig.x.cats.length) err('cols: x.cats is required');
                if (!Array.isArray(fig.series) || !fig.series.length || fig.series.length > 3) err('cols: one to three series');
                else fig.series.forEach(function (sr) { if (!Array.isArray(sr.values) || !fig.x || sr.values.length !== (fig.x.cats || []).length || !sr.values.every(function (v) { return typeof v === 'number'; })) err('cols: series "' + sr.name + '" needs one number per category'); if (fig.series.length > 1 && !sr.name) err('cols: every series needs a name'); });
                if (!fig.y || !fig.y.label) err('cols: y.label is required (what the numbers are)');
            }
            if (fig.type === 'bars') {
                if (!Array.isArray(fig.rows) || !fig.rows.length) err('bars: rows are required');
                else fig.rows.forEach(function (r) { if (!r.label || typeof r.value !== 'number') err('bars: every row needs a label and a number as value'); });
            }
            if (fig.type === 'timeline') {
                var span = Array.isArray(fig.span) ? fig.span : [0, fig.span];
                if (!(span[1] > span[0])) err('timeline: span is the last tick, or [from, to]');
                if (!Array.isArray(fig.rows) || !fig.rows.length) err('timeline: rows are required');
                else fig.rows.forEach(function (r) {
                    if ((r.label || '').length > 30) warn('timeline: label "' + r.label + '" is long; 30 characters fit');
                    (r.segs || []).forEach(function (sg) { if (!(sg.to > sg.from)) err('timeline: a segment needs from < to'); if (sg.from < span[0] || sg.to > span[1]) warn('timeline: segment "' + (sg.text || '') + '" leaves the span'); });
                    (r.marks || []).forEach(function (m) { if (typeof m.at !== 'number' || m.at < span[0] || m.at > span[1]) err('timeline: mark "' + (m.text || '') + '" is outside the span'); });
                });
            }
            if (fig.type === 'flow') {
                var ids = {}, cells = {};
                if (!Array.isArray(fig.nodes) || !fig.nodes.length) err('flow: nodes are required');
                else {
                    fig.nodes.forEach(function (n) {
                        if (!n.id || ids[n.id]) err('flow: node ids must be set and unique (' + n.id + ')');
                        ids[n.id] = true;
                        if (!isPos(n.at)) return err('flow: node ' + n.id + ' needs at: [column, row]');
                        for (var i = 0; i < (n.span || 1); i++) { var key = (n.at[0] + i) + ',' + n.at[1]; if (cells[key]) err('flow: nodes ' + cells[key] + ' and ' + n.id + ' share a cell'); cells[key] = n.id; }
                        if (!n.text) err('flow: node ' + n.id + ' needs text');
                    });
                    var g = flowGeom(fig);
                    fig.nodes.forEach(function (n) {
                        if (!n.text || !isPos(n.at)) return;
                        var w = (n.span || 1) * g.cw + ((n.span || 1) - 1) * g.gx - 10;
                        lines(n.text).forEach(function (t) { if (tw(t, 12.5) > w) warn('flow: "' + t + '" is wider than its box (shorten it, split it with \\n, or set cell: [width, height])'); });
                        if (n.sub && tw(n.sub, 11) > w) warn('flow: "' + n.sub + '" is wider than its box');
                        if (lines(n.text).length * 15 + (n.sub ? 14 : 0) > g.ch - 6) warn('flow: node ' + n.id + ' has more lines than its box holds (set cell: [width, height])');
                    });
                    if (g.w > 700) warn('flow: ' + Math.round(g.w) + ' wide; more than 700 gets small (fewer columns, shorter edge labels)');
                    (fig.edges || []).forEach(function (e) { if (!ids[e.from] || !ids[e.to]) err('flow: edge ' + e.from + ' -> ' + e.to + ' names an unknown node'); });
                }
            }
            if (fig.type === 'body') {
                if (!Array.isArray(fig.rows) || !fig.rows.length) err('body: rows are required');
                else fig.rows.forEach(function (r) { try { if (parseBody(r.parts).length > 50) err('body: more than 50 parts'); } catch (x) { err(x.message); } });
            }
            if (fig.type === 'map') {
                if (!Array.isArray(fig.rows) || !fig.rows.length || !fig.key) err('map: rows and key are required');
                else {
                    fig.rows.forEach(function (r, i) { if (r.length !== fig.rows[0].length) err('map: row ' + i + ' has another length than row 0'); });
                    if (fig.rows[0].length * (fig.cell || 22) > 660) warn('map: wider than 660; use a smaller cell');
                }
            }
            if (fig.type === 'ladder') {
                if (!Array.isArray(fig.groups) || !fig.groups.length) err('ladder: groups are required');
                else fig.groups.forEach(function (g) { if (!g.title || !Array.isArray(g.items)) err('ladder: every group needs a title and items'); });
            }
        } catch (x) { err('cannot be checked: ' + x.message); }
        if (!errors.length) {
            try {
                if (fig.type === 'scene') sceneSvg(fig, '', warnings);
                else if (fig.type === 'panels') fig.panels.forEach(function (p, i) { var w = []; sceneSvg(p, '', w); w.forEach(function (m) { warnings.push('panel ' + (i + 1) + ': ' + m); }); });
                else TYPES[fig.type](fig, {});
            } catch (x) { err('cannot be drawn: ' + x.message); }
        }
        return { errors: errors, warnings: warnings };
    }

    var TYPES = { scene: scene, panels: panels, line: line, cols: cols, bars: bars, timeline: timeline, flow: flow, body: null, map: map, ladder: ladder };

    function create(constants, art) {
        var C = constants || {};
        ART = art || null;
        TYPES.body = function (fig) { return bodyFig(fig, C); };

        function render(fig, opts) {
            opts = opts || {};
            var art = TYPES[fig.type](fig, opts);
            var FULL = { line: 1, cols: 1, timeline: 1, flow: 1, ladder: 1, panels: 1 };
            var wide = fig.wide || FULL[fig.type] || (fig.type === 'scene' && fig.size[0] * (fig.tile || 40) > 360) || (fig.type === 'map' && fig.rows[0].length * (fig.cell || 22) > 360);
            return '<figure class="fig fig-' + fig.type + (wide ? ' wide' : ' beside') + '"><div class="fig-art">' + art + '</div><figcaption>' + (opts.n ? '<span class="fig-n">Figure ' + opts.n + '</span>' : '') +
                '<b class="fig-t">' + rich(fig.title) + '</b><span class="fig-c">' + rich(fig.caption) + '</span>' + (opts.more || '') + '</figcaption></figure>';
        }

        // hover readout of the line charts: nearest x, one row per series; drawn with textContent only
        function wire(rootEl) {
            Array.prototype.forEach.call(rootEl.querySelectorAll('[data-line]'), function (boxEl) {
                if (boxEl.__wired) return;
                boxEl.__wired = true;
                var d = JSON.parse(boxEl.getAttribute('data-line')), g = d.g, svg = boxEl.querySelector('svg'), hover = svg.querySelector('.hover'), tip = boxEl.querySelector('.tip'), at = null;
                var xs = [];
                d.series.forEach(function (sr) { sr.pts.forEach(function (p) { if (xs.indexOf(p[0]) === -1) xs.push(p[0]); }); });
                if (d.snap) { xs = []; for (var v = g.x0; v <= g.x1 + 1e-9; v += d.snap) xs.push(Math.round(v * 1e6) / 1e6); }
                xs.sort(function (a, b) { return a - b; });
                var px = function (v) { return g.l + (g.w - g.l - g.r) * (v - g.x0) / (g.x1 - g.x0); };
                var py = function (v) { return g.h - g.b - (g.h - g.t - g.b) * v / g.ymax; };
                function show(i) {
                    i = Math.max(0, Math.min(xs.length - 1, i));
                    if (i === at) return;
                    at = i;
                    var xv = xs[i], x = px(xv);
                    hover.removeAttribute('hidden');
                    hover.querySelector('line').setAttribute('x1', x); hover.querySelector('line').setAttribute('x2', x);
                    tip.textContent = '';
                    var h = document.createElement('h5'); h.textContent = (d.x ? d.x + ' ' : '') + nf(xv); tip.appendChild(h);
                    d.series.forEach(function (sr, si) {
                        var val = valueAt(sr, xv), dot = hover.querySelectorAll('circle')[si];
                        if (val === null) { dot.setAttribute('visibility', 'hidden'); return; }
                        dot.setAttribute('visibility', 'visible'); dot.setAttribute('cx', x); dot.setAttribute('cy', py(val));
                        var row = document.createElement('div'), key = document.createElement('i'), b = document.createElement('b'), name = document.createElement('span');
                        key.className = SER[si]; b.textContent = nf(Math.round(val * 100) / 100); name.textContent = sr.name;
                        row.appendChild(key); row.appendChild(b); row.appendChild(name); tip.appendChild(row);
                    });
                    tip.hidden = false;
                    var frac = x / g.w, wpx = svg.getBoundingClientRect().width;
                    tip.style.left = frac > 0.55 ? '' : (frac * wpx + 12) + 'px';
                    tip.style.right = frac > 0.55 ? ((1 - frac) * wpx + 12 + (boxEl.clientWidth - wpx)) + 'px' : '';
                }
                function hide() { at = null; hover.setAttribute('hidden', ''); tip.hidden = true; }
                function nearest(xv) { var best = 0; xs.forEach(function (v, i) { if (Math.abs(v - xv) < Math.abs(xs[best] - xv)) best = i; }); return best; }
                svg.addEventListener('pointermove', function (ev) {
                    var rect = svg.getBoundingClientRect(), x = (ev.clientX - rect.left) / rect.width * g.w;
                    show(nearest(g.x0 + (x - g.l) / (g.w - g.l - g.r) * (g.x1 - g.x0)));
                });
                svg.addEventListener('pointerleave', hide);
                svg.addEventListener('focus', function () { show(at === null ? xs.length - 1 : at); });
                svg.addEventListener('blur', hide);
                svg.addEventListener('keydown', function (ev) {
                    if (ev.key === 'ArrowLeft') { show((at === null ? 0 : at) - 1); ev.preventDefault(); }
                    if (ev.key === 'ArrowRight') { show((at === null ? 0 : at) + 1); ev.preventDefault(); }
                });
            });
        }

        return {
            render: render, check: check, wire: wire, icon: icon, chip: chip, parseBody: parseBody,
            bodyStats: function (spec) { return bodyStats(parseBody(spec), C); },
            defs: function () { return ART ? ART.defs() : ''; },
            glyphs: kinds(), tones: TONES, types: Object.keys(TYPES),
        };
    }

    return { create: create };
}));
