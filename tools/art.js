#!/usr/bin/env node
'use strict';
/*
 * The game's own graphics for the figures: turns the textures of the official renderer
 * (sources/renderer, github.com/screeps/renderer, ISC) into lib/gameart-assets.js, the data
 * lib/gameart.js draws with. Nothing is installed and nothing is fetched.
 *
 *   node tools/art.js                    writes lib/gameart-assets.js
 *   node tools/art.js --sheet <dir>      also writes <dir>/sheet.html, a contact sheet of every kind
 *                                        lib/gameart.js can draw, and screenshots it to <dir>/sheet.png
 *     --html             write the sheet only, take no screenshot
 *     --tile <px>        size of a tile on the sheet (default 80)
 *     --only <text>      only the cells whose caption holds this text (to look at one kind, larger)
 *     --name <name>      name of the two files (default sheet)
 *     --chrome <path>    the browser, if it is not found (or set CHROME)
 *     --src <dir>        the renderer checkout (default sources/renderer)
 *     --check <file.svg> print the cleaned form of one SVG and stop (for looking at a texture)
 *
 * What cleaning does to an SVG: the XML prolog, comments, metadata and every Inkscape, sodipodi and
 * Illustrator leftover go; <style> rules and style="" become plain attributes; attributes that say
 * what is the default anyway go; groups are dissolved and their translations are worked into the
 * coordinates; numbers are rounded; ids that nothing refers to go, the others (and every url(#..)
 * and href="#..") get the prefix "ga-<asset>__", so many assets can share one document.
 * The viewBox written is the area of the whole texture (an SVG whose width and height do not have
 * the proportions of its viewBox is letterboxed by the browser, and the renderer stretches that
 * letterboxed picture), w and h are the pixel size the renderer loads it at.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const opt = name => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const has = name => argv.includes(name);
const ROOT = path.join(__dirname, '..');
const SRC = path.resolve(opt('--src') || path.join(ROOT, 'sources/renderer'));
const IMAGES = path.join(SRC, 'metadata/images');
const OUT = path.join(ROOT, 'lib/gameart-assets.js');

// The textures lib/gameart.js refers to. Nothing else is copied.
const ASSETS = [
    'tough', 'creep-npc',
    'operator-lvl0', 'operator-lvl1', 'operator-lvl2', 'operator-lvl3', 'operator-lvl4',
    'controller', 'controller-level',
    'extension', 'extension-border50', 'extension-border100', 'extension-border200',
    'tower-base', 'tower-rotatable',
    'storage', 'storage-border',
    'terminal', 'terminal-border', 'terminal-arrows',
    'link', 'link-border', 'link-energy',
    'lab', 'lab-mineral',
    'factory', 'factory-border', 'factory-highlight', 'factory-lvl0', 'factory-lvl1', 'factory-lvl2', 'factory-lvl3', 'factory-lvl4', 'factory-lvl5',
    'nuker', 'nuker-border',
    'extractor', 'rampart', 'constructedWall',
    'tombstone-border', 'tombstone-resource', 'ruin',
    'flag', 'flag-secondary',
    'invaderCore', 'powerBank', 'nuke',
    'deposit-biomass', 'deposit-biomass-fill', 'deposit-metal', 'deposit-metal-fill', 'deposit-mist', 'deposit-mist-fill', 'deposit-silicon', 'deposit-silicon-fill',
];

// ------------------------------------------------------------------ a small XML reader
function decode(s) { return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()] || String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)))); }
function encode(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function parseXml(text, file) {
    text = text.replace(/^﻿/, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, c) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
    const root = { name: '#root', attrs: {}, kids: [] }, stack = [root];
    const re = /<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    let m, at = 0;
    while ((m = re.exec(text))) {
        if (m.index !== at) throw new Error(file + ': cannot read the XML near "' + text.slice(at, at + 40) + '"');
        at = re.lastIndex;
        const top = stack[stack.length - 1];
        if (m[1]) { if (top.name !== m[1]) throw new Error(file + ': </' + m[1] + '> closes <' + top.name + '>'); stack.pop(); }
        else if (m[2]) {
            const node = { name: m[2], attrs: {}, kids: [] }, ar = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
            let a;
            while ((a = ar.exec(m[3]))) node.attrs[a[1]] = decode(a[2] !== undefined ? a[2] : a[3]);
            top.kids.push(node);
            if (!m[4]) stack.push(node);
        } else if (/\S/.test(m[5])) top.kids.push({ text: decode(m[5]) });
    }
    if (at !== text.length || stack.length !== 1) throw new Error(file + ': the XML does not end well');
    return root;
}

// ------------------------------------------------------------------ numbers, colours, matrices, paths
function fmt(n, dec) {
    let s = (+n).toFixed(dec);
    if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace(/^(-?)0\./, '$1.');
}
const NAMED = { black: '#000', white: '#fff', red: '#f00', none: 'none', transparent: 'none', currentcolor: 'currentColor' };
function color(v) {
    const s = String(v).trim().toLowerCase();
    if (NAMED[s]) return NAMED[s];
    let m = /^#([0-9a-f]{3})$/.exec(s);
    if (m) return '#' + m[1];
    m = /^#([0-9a-f]{6})$/.exec(s);
    if (m) { const h = m[1]; return h[0] === h[1] && h[2] === h[3] && h[4] === h[5] ? '#' + h[0] + h[2] + h[4] : '#' + h; }
    m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s);
    if (m) return color('#' + [m[1], m[2], m[3]].map(x => ('0' + (+x).toString(16)).slice(-2)).join(''));
    if (/^url\(/.test(s)) return String(v).trim();
    throw new Error('colour "' + v + '" is not understood');
}
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
function parseTransform(s) {
    let m = [1, 0, 0, 1, 0, 0], t;
    const re = /(\w+)\s*\(([^)]*)\)/g;
    while ((t = re.exec(s || ''))) {
        const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number);
        let k;
        if (t[1] === 'translate') k = [1, 0, 0, 1, a[0], a[1] || 0];
        else if (t[1] === 'scale') k = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
        else if (t[1] === 'matrix') k = a;
        else if (t[1] === 'rotate') { const r = a[0] * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); k = [c, sn, -sn, c, 0, 0]; if (a.length > 2) k = mul(mul([1, 0, 0, 1, a[1], a[2]], k), [1, 0, 0, 1, -a[1], -a[2]]); }
        else throw new Error('transform "' + t[1] + '" is not understood');
        m = mul(m, k);
    }
    return m;
}
const isShift = m => Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[3] - 1) < 1e-9 && Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9;

const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
// path data -> [{c: 'M', a: [absolute numbers]}]
function parsePath(d) {
    const out = [], n = d.length;
    let i = 0, cmd = null, cx = 0, cy = 0, sx = 0, sy = 0;
    const skip = () => { while (i < n && /[\s,]/.test(d[i])) i++; };
    const num = () => { skip(); const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(i, i + 40)); if (!m) throw new Error('path: a number was expected at ' + i + ' in "' + d.slice(0, 60) + '"'); i += m[0].length; return +m[0]; };
    const flag = () => { skip(); const c = d[i]; if (c !== '0' && c !== '1') throw new Error('path: an arc flag was expected'); i++; return +c; };
    for (;;) {
        skip();
        if (i >= n) break;
        if (/[a-zA-Z]/.test(d[i])) { cmd = d[i++]; if (!(cmd.toLowerCase() in ARITY)) throw new Error('path: command "' + cmd + '"'); }
        else if (!cmd) throw new Error('path: starts without a command');
        const lc = cmd.toLowerCase(), rel = cmd === lc, a = [];
        for (let k = 0; k < ARITY[lc]; k++) a.push(lc === 'a' && (k === 3 || k === 4) ? flag() : num());
        const ox = rel ? cx : 0, oy = rel ? cy : 0;
        if (lc === 'z') { cx = sx; cy = sy; }
        else if (lc === 'h') { a[0] += ox; cx = a[0]; }
        else if (lc === 'v') { a[0] += oy; cy = a[0]; }
        else if (lc === 'a') { a[5] += ox; a[6] += oy; cx = a[5]; cy = a[6]; }
        else { for (let k = 0; k < a.length; k += 2) { a[k] += ox; a[k + 1] += oy; } cx = a[a.length - 2]; cy = a[a.length - 1]; }
        if (lc === 'm') { sx = cx; sy = cy; }
        out.push({ c: lc.toUpperCase(), a });
        if (lc === 'm') cmd = rel ? 'l' : 'L';      // more pairs after a moveto are linetos
        if (lc === 'z') cmd = null;
    }
    return out;
}
function scalePath(segs, k) {
    segs.forEach(s => { if (s.c === 'A') { s.a[0] *= k; s.a[1] *= k; s.a[5] *= k; s.a[6] *= k; } else s.a = s.a.map(v => v * k); });
    return segs;
}
function shiftPath(segs, tx, ty) {
    segs.forEach(s => {
        if (s.c === 'H') s.a[0] += tx; else if (s.c === 'V') s.a[0] += ty; else if (s.c === 'A') { s.a[5] += tx; s.a[6] += ty; }
        else for (let k = 0; k < s.a.length; k += 2) { s.a[k] += tx; s.a[k + 1] += ty; }
    });
    return segs;
}
// absolute segments -> the shortest spelling, each segment absolute or relative, whichever is shorter;
// relative numbers are differences of rounded positions, so rounding does not add up along the path
function writePath(segs, dec) {
    const r = v => +(+v).toFixed(dec);
    const join = list => list.reduce((s, v, i) => s + (i && v[0] !== '-' ? ' ' : '') + v, '');
    let out = '', prev = '', cx = 0, cy = 0, sx = 0, sy = 0;
    segs.forEach(s => {
        const abs = [], rel = [];
        let nx = cx, ny = cy, c = s.c;
        if (c === 'L' && r(s.a[0]) === cx) c = 'V'; else if (c === 'L' && r(s.a[1]) === cy) c = 'H';      // a straight lineto is shorter as V or H
        if (c === 'H') { nx = r(s.a[0]); abs.push(nx); rel.push(nx - cx); }
        else if (c === 'V') { ny = r(s.a[s.c === 'L' ? 1 : 0]); abs.push(ny); rel.push(ny - cy); }
        else if (s.c === 'A') { nx = r(s.a[5]); ny = r(s.a[6]); const head = [r(s.a[0]), r(s.a[1]), r(s.a[2]), s.a[3], s.a[4]]; abs.push(...head, nx, ny); rel.push(...head, nx - cx, ny - cy); }
        else if (s.c !== 'Z') { for (let k = 0; k < s.a.length; k += 2) { const x = r(s.a[k]), y = r(s.a[k + 1]); abs.push(x, y); rel.push(x - cx, y - cy); nx = x; ny = y; } }
        const A = join(abs.map(v => fmt(v, dec))), R = join(rel.map(v => fmt(v, dec)));
        let letter = c, body = A;
        if (c === 'Z') { letter = 'z'; body = ''; nx = sx; ny = sy; }
        else if (out && R.length < A.length) { letter = c.toLowerCase(); body = R; }
        const implied = prev === 'M' ? 'L' : prev === 'm' ? 'l' : prev;
        if (letter === implied && letter !== 'z' && letter !== 'M' && letter !== 'm') out += (body[0] === '-' ? '' : ' ') + body;
        else out += letter + body;
        prev = letter; cx = nx; cy = ny;
        if (s.c === 'M') { sx = nx; sy = ny; }
    });
    return out;
}

// ------------------------------------------------------------------ cleaning one SVG
// properties that are inherited, with their initial values, in the order they are written
const INHERIT = { fill: '#000', 'fill-opacity': '1', 'fill-rule': 'nonzero', stroke: 'none', 'stroke-width': '1', 'stroke-opacity': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'stroke-miterlimit': '4', 'stroke-dasharray': 'none', 'stroke-dashoffset': '0', 'paint-order': 'normal' };
const REFS = ['clip-path', 'mask', 'filter'];            // kept on the element that has them
const SHAPES = { path: 1, rect: 1, circle: 1, ellipse: 1, line: 1, polyline: 1, polygon: 1 };
const SKIP = /^(metadata|title|desc|style|script|sodipodi:.*|inkscape:.*|rdf:.*|cc:.*|dc:.*)$/;

function normalise(prop, v) {
    v = String(v).trim().replace(/\s*!important$/, '');
    if (prop === 'fill' || prop === 'stroke' || prop === 'stop-color') return color(v);
    if (prop === 'paint-order') return /^stroke/.test(v) ? 'stroke' : 'normal';
    if (prop === 'stroke-dasharray') return v === 'none' ? v : v.split(/[\s,]+/).map(x => fmt(parseFloat(x), 3)).join(' ');
    if (/opacity$|^stroke-width$|^stroke-miterlimit$|^stroke-dashoffset$/.test(prop)) { const n = parseFloat(v); if (isNaN(n)) throw new Error(prop + ': "' + v + '"'); return fmt(/%$/.test(v) ? n / 100 : n, 3); }
    return v;
}
function declared(node, rules) {
    const p = {}, put = (k, v) => { k = k.trim().toLowerCase(); if (k in INHERIT || k === 'opacity' || k === 'display' || k === 'stop-color' || k === 'stop-opacity' || REFS.includes(k)) p[k] = normalise(k, v); };
    Object.keys(node.attrs).forEach(k => put(k, node.attrs[k]));
    (node.attrs.class || '').split(/\s+/).filter(Boolean).forEach(c => (rules[c] || []).forEach(d => put(d[0], d[1])));
    (node.attrs.style || '').split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) put(d.slice(0, i), d.slice(i + 1)); });
    return p;
}
function cssRules(root, file) {
    const rules = {};
    (function find(n) {
        if (n.name === 'style') {
            const css = n.kids.map(k => k.text || '').join('').replace(/\/\*[\s\S]*?\*\//g, ''), re = /([^{}]+)\{([^}]*)\}/g;
            let m;
            while ((m = re.exec(css))) m[1].split(',').forEach(sel => {
                sel = sel.trim();
                if (!/^\.[\w-]+$/.test(sel)) throw new Error(file + ': the style rule "' + sel + '" is more than a class');
                const list = rules[sel.slice(1)] = rules[sel.slice(1)] || [];
                m[2].split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) list.push([d.slice(0, i), d.slice(i + 1)]); });
            });
        }
        (n.kids || []).forEach(find);
    }(root));
    return rules;
}

function clean(name, text) {
    const file = name + '.svg', doc = parseXml(text, file), svg = doc.kids.find(k => k.name === 'svg');
    if (!svg) throw new Error(file + ': no <svg>');
    const px = v => (v === undefined ? undefined : parseFloat(v));
    const vb = svg.attrs.viewBox ? svg.attrs.viewBox.split(/[\s,]+/).map(Number) : null;      // "viewbox" in lower case is not a viewBox, as in a browser
    const W = px(svg.attrs.width) || (vb ? vb[2] : 0), H = px(svg.attrs.height) || (vb ? vb[3] : 0);
    if (!W || !H) throw new Error(file + ': no size');
    let box = vb || [0, 0, W, H];
    const k = Math.min(W / box[2], H / box[3]), vw = W / k, vh = H / k;                      // xMidYMid meet
    box = [box[0] - (vw - box[2]) / 2, box[1] - (vh - box[3]) / 2, vw, vh];
    const dec = box[2] >= 100 ? 2 : box[2] >= 10 ? 3 : 4, rules = cssRules(svg, file), prefix = 'ga-' + name + '__';

    // ids something refers to
    const used = {};
    (function find(n) {
        Object.keys(n.attrs || {}).forEach(a => {
            const v = n.attrs[a]; let m; const re = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g;
            while ((m = re.exec(v))) used[m[1]] = true;
            if (/(^|:)href$/.test(a) && v[0] === '#') used[v.slice(1)] = true;
        });
        (n.kids || []).forEach(find);
    }(svg));
    const ref = v => String(v).replace(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g, (m, id) => 'url(#' + prefix + id + ')');
    const attr = (k2, v) => (v === undefined || v === null || v === '' ? '' : ' ' + k2 + '="' + encode(v) + '"');
    const idOf = n => (n.attrs.id && used[n.attrs.id] ? attr('id', prefix + n.attrs.id) : '');

    // a shape with everything it inherits resolved, written with what is not the default
    function shape(n, own, inh, m) {
        const p = Object.assign({}, inh, own), a = n.attrs, f = v => fmt(v, dec);
        // a translation, with or without one scale for both axes, is worked into the numbers; a circle also takes a turn or a flip
        const det = m[0] * m[3] - m[1] * m[2], even = Math.abs(m[0] * m[0] + m[1] * m[1] - m[2] * m[2] - m[3] * m[3]) < 1e-6 && Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-6;
        const k = Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9 && Math.abs(m[0] - m[3]) < 1e-9 && m[0] > 0 ? m[0] : n.name === 'circle' && even && det ? Math.sqrt(Math.abs(det)) : 0;
        const flat = k > 0, tx = flat ? m[4] : 0, ty = flat ? m[5] : 0, X = (x, y) => (n.name === 'circle' && flat ? m[0] * x + m[2] * y + m[4] : (flat ? k : 1) * x + tx), Y = (x, y) => (n.name === 'circle' && flat ? m[1] * x + m[3] * y + m[5] : (flat ? k : 1) * y + ty), K = flat ? k : 1;
        if (p['fill-opacity'] === '0') p.fill = 'none';
        if (p['stroke-opacity'] === '0' || p['stroke-width'] === '0') p.stroke = 'none';
        if (flat && K !== 1 && (p.stroke || 'none') !== 'none') {
            p['stroke-width'] = fmt(parseFloat(p['stroke-width'] === undefined ? 1 : p['stroke-width']) * K, 3);
            if (p['stroke-dasharray'] && p['stroke-dasharray'] !== 'none') p['stroke-dasharray'] = p['stroke-dasharray'].split(' ').map(v => fmt(v * K, 3)).join(' ');
        }
        const reach = (p.stroke || 'none') === 'none' ? 0 : parseFloat(p['stroke-width'] === undefined ? 1 : p['stroke-width']) / 2;
        const outside = (x0, y0, x1, y1) => flat && (x1 + reach < box[0] || x0 - reach > box[0] + box[2] || y1 + reach < box[1] || y0 - reach > box[1] + box[3]);
        let tag = n.name, geo = '';
        if (tag === 'path' || tag === 'line' || tag === 'polyline' || tag === 'polygon') {
            let segs;
            if (tag === 'path') segs = parsePath(a.d || '');
            else if (tag === 'line') segs = [{ c: 'M', a: [+a.x1 || 0, +a.y1 || 0] }, { c: 'L', a: [+a.x2 || 0, +a.y2 || 0] }];
            else { const pts = (a.points || '').split(/[\s,]+/).filter(Boolean).map(Number); segs = []; for (let i = 0; i + 1 < pts.length; i += 2) segs.push({ c: i ? 'L' : 'M', a: [pts[i], pts[i + 1]] }); if (tag === 'polygon') segs.push({ c: 'Z', a: [] }); }
            if (!segs.some(s => s.c !== 'M')) return '';                                     // a lone moveto draws nothing
            if (tag === 'line') p.fill = 'none';
            geo = attr('d', writePath(shiftPath(scalePath(segs, K), tx, ty), dec)); tag = 'path';
        } else if (tag === 'rect') {
            const x = X(+a.x || 0, 0), y = Y(0, +a.y || 0), w = px(a.width) * K, h = px(a.height) * K;
            if (outside(x, y, x + w, y + h)) return '';                                      // not on the texture at all
            geo = attr('x', f(x)) + attr('y', f(y)) + attr('width', f(w)) + attr('height', f(h)) + (a.rx ? attr('rx', f(px(a.rx) * K)) : '') + (a.ry ? attr('ry', f(px(a.ry) * K)) : '');
        } else if (tag === 'circle') {
            const x = X(+a.cx || 0, +a.cy || 0), y = Y(+a.cx || 0, +a.cy || 0), r = px(a.r) * K;
            if (outside(x - r, y - r, x + r, y + r)) return '';
            geo = attr('cx', f(x)) + attr('cy', f(y)) + attr('r', f(r));
        } else geo = attr('cx', f(X(+a.cx || 0, 0))) + attr('cy', f(Y(0, +a.cy || 0))) + attr('rx', f(px(a.rx) * K)) + attr('ry', f(px(a.ry) * K));
        geo = geo.replace(/ (x|y|cx|cy)="0"/g, '');
        if (p.fill === 'none' && p.stroke === 'none') return '';
        let s = '<' + tag + idOf(n) + geo;
        Object.keys(INHERIT).forEach(k2 => {
            if (p[k2] === undefined || p[k2] === INHERIT[k2]) return;
            if (/^stroke-|^paint-order$/.test(k2) && p.stroke === 'none') return;
            if (/^fill-/.test(k2) && p.fill === 'none') return;
            s += attr(k2, ref(p[k2]));
        });
        if (own.opacity !== undefined && own.opacity !== '1') s += attr('opacity', own.opacity);
        REFS.forEach(k2 => { if (own[k2] && own[k2] !== 'none') s += attr(k2, ref(own[k2])); });
        if (!flat) s += attr('transform', 'matrix(' + m.map((v, i) => fmt(v, i < 4 ? 5 : dec)).join(' ') + ')');
        return s + '/>';
    }
    // gradients, clip paths and the like: kept as they are, tidied
    function keep(n) {
        if (n.text !== undefined) return encode(n.text.trim());
        if (SKIP.test(n.name)) return '';
        const own = declared(n, rules);
        let s = '<' + n.name + idOf(n);
        Object.keys(n.attrs).forEach(k2 => {
            if (k2 === 'id' || k2 === 'style' || k2 === 'class' || k2 === 'xml:space' || /^(xmlns|inkscape|sodipodi|data-)/.test(k2) || k2 in own) return;
            if (/(^|:)href$/.test(k2)) { s += attr('href', n.attrs[k2][0] === '#' ? '#' + prefix + n.attrs[k2].slice(1) : n.attrs[k2]); return; }
            s += attr(k2, ref(n.attrs[k2]).replace(/\s+/g, ' ').trim());
        });
        Object.keys(own).forEach(k2 => { if (!(/opacity$/.test(k2) && own[k2] === '1')) s += attr(k2, ref(own[k2])); });
        const inner = n.kids.map(keep).join('');
        return s + (inner ? '>' + inner + '</' + n.name + '>' : '/>');
    }
    function walk(n, inh, m) {
        if (n.text !== undefined || SKIP.test(n.name)) return [];
        const own = declared(n, rules);
        if (own.display === 'none') return [];
        const here = mul(m, parseTransform(n.attrs.transform));
        if (SHAPES[n.name]) { const s = shape(n, own, inh, here); return s ? [{ s, own }] : []; }
        if (n.name === 'defs') { const s = n.kids.filter(c => c.attrs && used[c.attrs.id]).map(keep).join(''); return s ? [{ s: '<defs>' + s + '</defs>', own: {} }] : []; }
        if (n.name !== 'g' && n.name !== 'svg' && n.name !== 'a' && n.name !== 'switch') throw new Error(file + ': <' + n.name + '> is not handled');
        const next = Object.assign({}, inh);
        Object.keys(INHERIT).forEach(k2 => { if (own[k2] !== undefined) next[k2] = own[k2]; });
        const refs = REFS.filter(k2 => own[k2] && own[k2] !== 'none'), op = own.opacity !== undefined && own.opacity !== '1' ? own.opacity : null;
        const wrap = refs.length > 0 || !!idOf(n), inner = [].concat(...n.kids.map(c => walk(c, next, wrap ? [1, 0, 0, 1, 0, 0] : here)));
        if (!inner.length) return [];
        if (!wrap && !op) return inner;
        if (!wrap && inner.length === 1 && !/ opacity="/.test(inner[0].s)) return [{ s: inner[0].s.replace(/\/>$/, attr('opacity', op) + '/>'), own: {} }];   // one child: the opacity can sit on it
        let s = '<g' + idOf(n) + (op ? attr('opacity', op) : '');
        refs.forEach(k2 => { s += attr(k2, ref(own[k2])); });
        // a group kept for its clip path, mask, filter or id keeps its transform; one kept only for its opacity has none, its children carry it
        if (wrap && !(isShift(here) && !here[4] && !here[5])) s += attr('transform', 'matrix(' + here.map((v, i) => fmt(v, i < 4 ? 5 : dec)).join(' ') + ')');
        return [{ s: s + '>' + inner.map(x => x.s).join('') + '</g>', own: {} }];
    }
    const body = walk(svg, {}, [1, 0, 0, 1, 0, 0]).map(x => x.s).join('');
    if (!body) throw new Error(file + ': nothing left to draw');
    return { viewBox: box.map(v => fmt(v, dec)).join(' '), w: W, h: H, body };
}

if (opt('--check')) { console.log(JSON.stringify(clean(path.basename(opt('--check'), '.svg'), fs.readFileSync(opt('--check'), 'utf8')), null, 1)); process.exit(0); }

// ------------------------------------------------------------------ the assets module
function commit() {
    try {
        const git = path.join(SRC, '.git'), head = fs.readFileSync(path.join(git, 'HEAD'), 'utf8').trim(), m = /^ref:\s*(.+)$/.exec(head);
        if (!m) return head;
        if (fs.existsSync(path.join(git, m[1]))) return fs.readFileSync(path.join(git, m[1]), 'utf8').trim();
        const line = fs.readFileSync(path.join(git, 'packed-refs'), 'utf8').split('\n').find(l => l.trim().endsWith(' ' + m[1]));
        return line ? line.split(' ')[0] : 'unknown';
    } catch (e) { return 'unknown'; }
}
if (!fs.existsSync(IMAGES)) { console.error('no renderer checkout at ' + SRC + ' (npm run fetch, or pass --src)'); process.exit(1); }
const assets = {};
for (const name of ASSETS) assets[name] = clean(name, fs.readFileSync(path.join(IMAGES, name + '.svg'), 'utf8'));
const licence = fs.readFileSync(path.join(SRC, 'LICENSE.txt'), 'utf8').trim().split(/\r?\n/).map(l => ' * ' + l).join('\n').replace(/ +$/gm, '');
const js = '/*\n * Textures of the game, taken from the official Screeps renderer and cleaned for inline SVG.\n' +
    ' * Source: https://github.com/screeps/renderer (metadata/images), commit ' + commit() + '.\n' +
    ' * Generated by tools/art.js: do not edit, run the tool again. Drawn with lib/gameart.js.\n *\n' +
    ' * The renderer, its code and its images, is under the ISC licence:\n *\n' + licence + '\n */\n' +
    '(function (root, factory) {\n    if (typeof module === \'object\' && module.exports) module.exports = factory();\n    else root.ScreepsGameArtAssets = factory();\n' +
    '}(typeof self !== \'undefined\' ? self : this, function () {\n    \'use strict\';\n    return {\n' +
    Object.keys(assets).map(n => '        ' + JSON.stringify(n) + ': {viewBox: ' + JSON.stringify(assets[n].viewBox) + ', w: ' + assets[n].w + ', h: ' + assets[n].h + ', body: \'' + assets[n].body.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\'}').join(',\n') +
    '\n    };\n}));\n';
fs.writeFileSync(OUT, js);
console.log(path.relative(ROOT, OUT) + ': ' + Object.keys(assets).length + ' textures, ' + (Buffer.byteLength(js) / 1024).toFixed(1) + ' KB');

// ------------------------------------------------------------------ the contact sheet
if (opt('--sheet')) sheet(path.resolve(opt('--sheet')));

// Every kind, and the variants that matter, each on the game's ground with the light on.
function sheet(dir) {
    const A = require('../lib/gameart.js').create(require(OUT));
    const T = +opt('--tile') || 80, only = opt('--only'), name = opt('--name') || 'sheet', PAGE = Math.max(1640, 16 * T);
    const cells = [];
    const show = o => { const s = Object.keys(o).map(k => k + ': ' + JSON.stringify(o[k]).replace(/"/g, '\'')).join(', '); return '{' + s + '}'; };
    const add = (label, things, size, terrain, open) => cells.push({ label, things, size, terrain, open });
    // several of one kind side by side in one cell; the caption names them from left to right
    const row = (kind, list, step, high) => {
        step = step || 2; high = high || 3;
        add(kind + '  ' + list.map(show).join('  '), list.map((o, i) => Object.assign({ is: kind, at: [1 + i * step, (high - 1) / 2] }, o)), [(list.length - 1) * step + 3, high]);
    };
    row('creep', [{ body: ['W', 'W', 'C', 'M'] }, { body: 'WWCM', carry: 0.5 }, { body: 'CCCCMM', carry: 1 }, { body: '5W 1C 3M', angle: 90 }]);
    row('creep', [{ body: 'TTAAMMMM', owner: 'foe' }, { body: 'RRHHMM', owner: 'foe' }, { body: 'LLMM', owner: 'none' }, { owner: 'npc' }]);
    row('creep', [{ body: '5T 10W 5A 5R 5H 2L 18M' }, { body: '25W 25M' }, { body: '50M' }, { body: 'CCMM', carry: 0.7, carryKind: 'power' }, { body: 'CCMM', carry: 1, carryKind: 'O' }]);
    row('powerCreep', [{}, { owner: 'foe' }, { level: 0 }, { level: 7 }, { level: 13, angle: 45 }], 3);
    row('source', [{}, { fill: 0.4 }, { empty: true }], 4);
    row('mineral', ['H', 'O', 'U', 'L', 'K', 'Z', 'X'].map(k => ({ kind: k })), 2);
    row('deposit', ['silicon', 'metal', 'biomass', 'mist'].map(k => ({ kind: k })), 3);
    row('controller', [{ level: 0 }, { level: 1 }, { level: 2 }, { level: 3 }], 3);
    row('controller', [{ level: 4 }, { level: 5 }, { level: 6 }, { level: 7 }], 3);
    row('controller', [{ level: 8 }, { level: 8, owner: 'foe' }, { level: 3, progress: 0.4 }, { level: 2, owner: 'none' }], 3);
    row('spawn', [{}, { fill: 0.5 }, { fill: 0, owner: 'foe' }, { spawning: 0.6, owner: 'none' }]);
    row('extension', [{ size: 50 }, { size: 100 }, { size: 200 }, { size: 200, fill: 0.5 }, { size: 50, fill: 0 }, { size: 100, owner: 'foe' }]);
    row('tower', [{}, { fill: 0.5, angle: 45 }, { fill: 0, owner: 'foe', angle: 180 }]);
    row('storage', [{ fill: 0 }, {}, { fill: 1 }, { fill: 0.3, power: 0.2, other: 0.3, owner: 'foe' }], 3);
    row('terminal', [{ fill: 0 }, {}, { fill: 1 }, { fill: 0.3, power: 0.2, other: 0.3, owner: 'foe' }], 3);
    row('container', [{ fill: 0 }, {}, { fill: 1 }, { fill: 0.3, other: 0.5 }]);
    row('link', [{}, { fill: 0.5 }, { fill: 0, owner: 'foe' }]);
    row('lab', [{ kind: 'UH' }, { kind: 'O', fill: 0.5 }, { empty: true }, { empty: true, energy: 0, owner: 'foe' }], 3);
    row('factory', [{}, { level: 3, fill: 0.5 }, { level: 5, fill: 0.2, other: 0.6, owner: 'foe' }], 3);
    row('nuker', [{}, { fill: 0.5 }, { fill: 0, owner: 'foe' }], 3, 4);
    row('observer', [{}, { owner: 'foe' }]);
    row('powerSpawn', [{}, { fill: 0.5, power: 0.25 }, { fill: 0, owner: 'foe' }], 3);
    add('extractor  {}  {owner: \'foe\'}  and one under a mineral', [{ is: 'extractor', at: [1, 1] }, { is: 'extractor', at: [3, 1], owner: 'foe' }, { is: 'extractor', at: [5, 1] }, { is: 'mineral', at: [5, 1], kind: 'K' }], [7, 3]);
    row('rampart', [{}, { owner: 'foe' }, { 'public': true }, { 'public': true, owner: 'foe' }]);
    add('rampart: joined, over a tower, a creep and a road; a foe\'s line', [{ is: 'road', at: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] }, { is: 'tower', at: [1, 1] }, { is: 'creep', at: [3, 2], body: 'RRMM' },
        { is: 'rampart', at: [[1, 1], [2, 1], [3, 1], [3, 2], [1, 2]] }, { is: 'rampart', at: [[6, 0], [6, 1], [7, 2]], owner: 'foe' }], [9, 4]);
    add('wall: one alone {merged: false}, a joined line, and joined to the terrain', [{ is: 'wall', at: [1, 1], merged: false }, { is: 'wall', at: [[3, 0], [3, 1], [3, 2], [4, 2], [6, 1], [7, 1]] }], [9, 3], ['........#', '........#', '.......##']);
    add('road: a network', [{ is: 'road', at: [[0, 1], [1, 1], [2, 1], [3, 1], [3, 0], [4, 2], [5, 3], [2, 2], [1, 3], [5, 1], [6, 1], [6, 2], [4, 0]] }], [7, 4]);
    row('site', [{}, { progress: 0.3 }, { progress: 0.8 }, { progress: 0.5, owner: 'foe' }]);
    row('energy', [{}, { big: true }, { amount: 100 }]);
    row('resource', [{ kind: 'power' }, { kind: 'O', big: true }, { kind: 'H', amount: 300 }]);
    row('tombstone', [{}, { empty: true }, { owner: 'foe', decay: 0.6 }]);
    row('ruin', [{}, { empty: true }, { owner: 'foe', decay: 0.6 }]);
    row('flag', [{}, { color: 'red' }, { color: 'green', secondary: 'yellow' }, { color: 3, secondary: 7 }]);
    row('portal', [{}]); row('keeperLair', [{}]); row('invaderCore', [{}, { ttl: 0.3 }], 3); row('powerBank', [{}, { fill: 0.3 }], 3);
    add('nuke  {}', [{ is: 'nuke', at: [2, 2] }], [5, 5]);
    const land = ['##xx######', '#........#', '#..~~.....', '#.~~~..#..', '#...~.##..', '####....##'];
    add('terrain: # wall, ~ swamp, x exit (plain); the edge of the grid is the edge of the room', [], [10, 6], land);
    add('terrain {open: true}: the same, rounded at the edge', [], [10, 6], land, true);
    add('a small base: everything together', [
        { is: 'road', at: [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 3], [8, 2], [6, 5], [6, 6], [4, 3], [4, 2]] },
        { is: 'source', at: [1, 4] }, { is: 'creep', at: [2, 3], body: '5W 1C 1M', carry: 0.6, angle: 225 }, { is: 'container', at: [2, 4], fill: 0.7 },
        { is: 'spawn', at: [5, 3] }, { is: 'extension', at: [[5, 1], [6, 1], [6, 2]] }, { is: 'extension', at: [7, 1], fill: 0 }, { is: 'tower', at: [7, 5], angle: 60 },
        { is: 'storage', at: [5, 6], fill: 0.6 }, { is: 'link', at: [4, 6] }, { is: 'controller', at: [9, 1], level: 4, progress: 0.3 }, { is: 'creep', at: [8, 2], body: 'WWWCMM', carry: 0.3, angle: 45 },
        { is: 'creep', at: [4, 4], body: 'CCCCMM', carry: 1, angle: 90 }, { is: 'site', at: [8, 5], progress: 0.4 }, { is: 'rampart', at: [[5, 3], [7, 5]] }, { is: 'wall', at: [[9, 4], [9, 5]] },
        { is: 'creep', at: [10, 5], body: 'TTAAMMMM', owner: 'foe', angle: 270 }, { is: 'energy', at: [3, 5] }, { is: 'tombstone', at: [10, 3], owner: 'foe' }, { is: 'flag', at: [8, 6], color: 'blue' },
        { is: 'mineral', at: [10, 7], kind: 'O' }, { is: 'extractor', at: [10, 7] }, { is: 'lab', at: [3, 7], kind: 'OH' }, { is: 'terminal', at: [1, 6] },
    ], [12, 8], ['############', '#..........x', '#..........x', '#.......~~.#', '#.......~~..', '##........~.', '#...........', '####........']);

    const shown = cells.filter(c => !only || c.label.includes(only));
    if (!shown.length) { console.error('sheet: no cell is called "' + only + '"'); process.exit(1); }
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    // the height of the page, to size the browser window: cells wrap like the flex box does
    let x = 0, high = 0, total = 0;
    const figs = shown.map(c => {
        const w = c.size[0] * T, h = c.size[1] * T, cap = Math.ceil(c.label.length * 6.7 / w) * 15 + 8;
        if (x && x + w > PAGE) { total += high + 14; x = 0; high = 0; }
        x += w + 12; high = Math.max(high, h + cap);
        return '<figure style="width:' + w + 'px"><svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + c.size[0] * 100 + ' ' + c.size[1] * 100 + '">' +
            A.scene({ size: c.size, terrain: c.terrain, things: c.things, open: c.open }) + '</svg><figcaption>' + esc(c.label) + '</figcaption></figure>';
    });
    total += high + 16 + 16 + 40;
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>gameart: contact sheet</title><style>' +
        'body{margin:0;padding:16px;width:' + PAGE + 'px;background:#111;color:#bbb;font:12px/15px Consolas,Menlo,monospace}' +
        'p{margin:0 0 12px;color:#888}.cells{display:flex;flex-wrap:wrap;gap:14px 12px;align-items:flex-start}figure{margin:0}svg{display:block}figcaption{padding-top:4px}' +
        '</style></head><body>' + A.defs() + '<p>lib/gameart.js, every kind on the ground of the game with the lighting layer applied; ' + T + ' px per tile. Renderer commit ' + commit().slice(0, 10) + '.</p>' +
        '<div class="cells">' + figs.join('') + '</div></body></html>';
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name + '.html');
    fs.writeFileSync(file, html);
    console.log(file + ' (' + shown.length + ' cells, ' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB)');
    if (has('--html')) return;

    // the screenshot, taken the way tools/shots.js takes its sheets
    const candidates = [opt('--chrome'), process.env.CHROME,
        'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
    const chrome = candidates.find(c => fs.existsSync(c));
    if (!chrome) { console.error('No Chrome or Edge found; pass --chrome <path>, or open the sheet yourself.'); process.exit(1); }
    const png = path.join(dir, name + '.png');
    if (fs.existsSync(png)) fs.unlinkSync(png);
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + path.join(dir, '.profile'),
        '--window-size=' + (PAGE + 32) + ',' + Math.ceil(total), '--screenshot=' + png, 'file:///' + file.replace(/\\/g, '/')], { encoding: 'utf8', timeout: 120000 });
    if (!fs.existsSync(png)) { console.error('no screenshot (' + (r.stderr || r.error || '').toString().split('\n')[0] + ')'); process.exit(1); }
    console.log(png);
}
