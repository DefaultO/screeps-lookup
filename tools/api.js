#!/usr/bin/env node
'use strict';
/*
 * Screeps API lookup for the command line. Offline; reads data/index.json.
 *
 *   node tools/api.js "reserve a controller"       top entries for a task, compact
 *   node tools/api.js --full Creep.transfer        one whole entry (id, or a unique name)
 *   node tools/api.js --const ROAD_DECAY_TIME      value of one or more constants
 *   node tools/api.js --list [kind|Object]         ids of all entries, or of one kind / object
 *
 *   -n <count>     number of detailed results (default 3)
 *   --kind <k,k>   only these kinds: method, property, object, mechanic, recipe, constants, article
 *   --json         machine-readable output
 *   --width <n>    wrap width (default 110)
 */
const fs = require('fs');
const path = require('path');
const { create } = require('../lib/search.js');

const argv = process.argv.slice(2);
function take(flag, hasValue) {
    const i = argv.indexOf(flag);
    if (i === -1) return undefined;
    const v = hasValue ? argv[i + 1] : true;
    argv.splice(i, hasValue ? 2 : 1);
    return v;
}
const optJson = take('--json');
const optN = parseInt(take('-n', true) || '3', 10);
const optKind = take('--kind', true);
const WIDTH = parseInt(take('--width', true) || '110', 10);
const optIndex = take('--index', true) || path.join(__dirname, '..', 'data', 'index.json');
const optFull = take('--full');
const optConst = take('--const');
const optList = take('--list');
const optHelp = take('--help') || take('-h');

function usage() {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(3, 16).map(l => l.replace(/^ \* ?/, '')).join('\n'));
}
if (optHelp || (!argv.length && !optList)) { usage(); process.exit(argv.length || optHelp ? 0 : 1); }
if (!fs.existsSync(optIndex)) { console.error(`no index at ${optIndex}; run: node tools/build.js`); process.exit(1); }
const index = JSON.parse(fs.readFileSync(optIndex, 'utf8'));
const engine = create(index);

// ---------------------------------------------------------------- formatting

function wrap(text, indent, first) {
    const pad = ' '.repeat(indent);
    const out = [];
    let line = first === undefined ? pad : first;
    for (const word of String(text).split(/\s+/)) {
        if (line.trim().length && line.length + 1 + word.length > WIDTH) { out.push(line); line = pad + word; }
        else line += (line.trim().length && !/\s$/.test(line) ? ' ' : '') + word;
    }
    out.push(line);
    return out.join('\n');
}
const bullets = (list, indent) => list.map(x => wrap(x, indent + 2, ' '.repeat(indent) + '- ')).join('\n');

function headline(e) {
    const bits = [e.kind];
    if (e.kind === 'method') bits.push(e.cpu === 'intent' ? 'intent +0.2 CPU' : `${e.cpu} CPU, no intent fee`);
    if (e.kind === 'property' && e.type) bits.push(e.type);
    if (e.range !== undefined) bits.push('range ' + e.range);
    if (e.part) bits.push('needs ' + e.part);
    if (e.deprecated) bits.push('DEPRECATED');
    if (e.basis === 'practice') bits.push('community practice, not a game rule');
    return `${e.title || e.id}  [${bits.join(' · ')}]`;
}

function fmtConst(c) { return c.value === undefined ? c.name : `${c.name}=${c.value}`; }

function table(t, indent) {
    const rows = [t.head].concat(t.rows).map(r => r.map(c => typeof c === 'number' ? fmtNum(c) : String(c)));
    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] || '').length)));
    const pad = ' '.repeat(indent);
    const lines = rows.map(r => pad + r.map((c, i) => i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i])).join('  ').trimEnd());
    return [pad + t.title + ':'].concat(lines, t.foot ? [wrap(t.foot, indent)] : []).join('\n');
}
function fmtNum(n) {
    const r = Math.round(n * 1000) / 1000;
    return Math.abs(r) >= 10000 ? r.toLocaleString('en-US') : String(r);
}

// level: 'long' (top result), 'medium' (other detailed results), 'full' (--full)
function render(e, level, prefix, lines) {
    const I = 3;
    const out = [(prefix || '') + headline(e)];
    const full = level === 'full', long = level !== 'medium';
    if (e.id !== (e.title || e.id)) out.push(' '.repeat(I) + 'id: ' + e.id);
    if (e.signature && e.kind !== 'object') out.push(' '.repeat(I) + e.signature);
    const summary = e.summary || e.doc;
    if (summary) out.push(wrap(summary, I));
    if (full && e.summary && e.doc) out.push(wrap('docs say: ' + e.doc, I));
    if (e.deprecated && e.deprecated !== true) out.push(wrap('deprecated: ' + e.deprecated, I));
    if (e.inherits) out.push(wrap('inherits: ' + e.inherits.join(', '), I));
    if (full && e.members) out.push(wrap('members: ' + e.members.map(m => m.slice(m.lastIndexOf('.') + 1)).join(', '), I));

    if (full && e.args) {
        out.push(' '.repeat(I) + 'arguments:');
        for (const a of e.args) {
            out.push(wrap(`${a.name}${a.optional ? '?' : ''}: ${a.type}${a.desc ? ' — ' + a.desc : ''}`, I + 4, ' '.repeat(I + 2)));
            for (const o of a.options || []) out.push(wrap(`.${o.name}: ${o.type}${o.desc ? ' — ' + o.desc : ''}`, I + 6, ' '.repeat(I + 4)));
        }
    }
    if (e.returns) {
        if (full) {
            out.push(' '.repeat(I) + 'returns:');
            for (const r of e.returns) out.push(wrap(`${r.code} (${r.value})${r.desc ? ' — ' + r.desc : ''}`, I + 4, ' '.repeat(I + 2)));
        } else {
            out.push(wrap('returns: ' + e.returns.map(r => r.code).join(', '), I + 9, ' '.repeat(I)));
        }
    } else if (e.returnsText && long) out.push(wrap('returns: ' + e.returnsText, I + 9, ' '.repeat(I)));

    if (e.steps) {
        out.push(' '.repeat(I) + 'steps:');
        e.steps.forEach((s, i) => out.push(wrap(`${s.call ? s.call + ' — ' : ''}${s.text}`, I + 5, ' '.repeat(I + 2) + (i + 1) + '. ')));
    }
    // the lines that answer the query come first; a secondary result shows only those
    const picked = new Set((lines || []).map(l => l.kind + l.index));
    if (picked.size) out.push(' '.repeat(I) + 'for your question:', lines.map(l => wrap(l.text, I + 4, ' '.repeat(I + 2) + '» ')).join('\n'));
    const block = (kind, key, name, n) => {
        const all = e[key];
        if (!all) return;
        const rest = all.map((t, i) => ({ t, i })).filter(x => !picked.has(kind + x.i));
        if (!rest.length) return;
        const limit = full ? rest.length : long ? (picked.size ? Math.min(rest.length, 3) : rest.length) : (picked.size ? 0 : n);
        if (limit) {
            out.push(' '.repeat(I) + (picked.size ? 'other ' : '') + name + ':');
            for (const x of rest.slice(0, limit)) {
                out.push(wrap(x.t, I + 4, ' '.repeat(I + 2) + '- '));
                // --full names what proves the line
                if (full) for (const s of ((e.src || {})[key] || {})[x.i] || []) out.push(' '.repeat(I + 6) + `source: ${s.label}  ${s.url}`);
            }
        }
        if (rest.length > limit) out.push(' '.repeat(I + 2) + `(+${rest.length - limit} more ${name}: --full ${e.id})`);
    };
    block('fact', 'facts', 'facts', 4);
    block('pitfall', 'pitfalls', 'pitfalls', 3);
    block('note', 'notes', 'notes', 2);
    if (e.tables && long) for (const t of e.tables) out.push(table(t, I));
    if (e.constants && e.kind === 'constants' && full) {
        // a constant group in full: one constant per line with its meaning
        out.push(' '.repeat(I) + 'constants:');
        const w = Math.max(...e.constants.map(c => fmtConst(c).length));
        for (const c of e.constants) out.push(wrap(fmtConst(c).padEnd(Math.min(w, 46)) + (c.note ? '  ' + c.note : ''), I + 6, ' '.repeat(I + 2)));
    } else if (e.constants && (long || e.kind !== 'constants')) {
        const list = e.kind === 'constants' && !full ? e.constants.slice(0, 40) : e.constants;
        out.push(wrap('constants: ' + list.map(fmtConst).join(', ') + (list.length < e.constants.length ? `, … (+${e.constants.length - list.length}: --full ${e.id})` : ''), I + 11, ' '.repeat(I)));
    }
    if (full && e.tasks) out.push(wrap('tasks: ' + e.tasks.join('; '), I + 7, ' '.repeat(I)));
    if (e.see) out.push(wrap('see: ' + e.see.join(', '), I + 5, ' '.repeat(I)));
    if (e.url) out.push(' '.repeat(I) + 'docs: ' + e.url);
    if (e.engine && full) for (const g of e.engine) out.push(' '.repeat(I) + `${g.label}: ${g.url}`);
    else if (e.engine) out.push(' '.repeat(I) + `engine source: ${e.engine.length} line reference${e.engine.length > 1 ? 's' : ''} (--full ${e.id})`);
    return out.join('\n');
}

function oneLine(e) {
    const s = e.summary || e.doc || '';
    const text = `${e.id}${e.kind === 'method' && e.cpu === 'intent' ? ' [intent]' : ''} — ${s}`;
    return '   ' + (text.length > WIDTH - 3 ? text.slice(0, WIDTH - 4) + '…' : text);
}

function showConst(name) {
    const c = engine.constant(name);
    if (!c) return null;
    const v = typeof c.value === 'object' && c.value !== null ? JSON.stringify(c.value) : String(c.value);
    const note = (index.constantNotes || {})[name];
    return `${name} = ${v.length > 600 ? v.slice(0, 600) + ' …' : v}${c.group ? `   (${c.group})` : ''}${note ? '\n    ' + note : ''}`;
}

// ---------------------------------------------------------------- commands

if (optList) {
    const what = argv[0];
    const list = index.entries.filter(e => !what || e.kind === what || e.object === what || e.id === what);
    if (optJson) console.log(JSON.stringify(list.map(e => e.id)));
    else for (const e of list) console.log(`${e.id.padEnd(44)} ${e.kind}`);
    process.exit(0);
}

if (optConst) {
    let missing = 0;
    for (const name of argv) {
        const line = showConst(name);
        if (line) { console.log(line); continue; }
        const near = Object.keys(index.constants).filter(n => n.indexOf(name.toUpperCase()) !== -1).slice(0, 20);
        if (near.length) for (const n of near) console.log(showConst(n));
        else { console.log(`${name}: no such constant`); missing++; }
    }
    process.exit(missing ? 1 : 0);
}

if (optFull) {
    const e = engine.get(argv.join(' '));
    if (!e) {
        const guess = engine.search(argv.join(' '), { limit: 5 });
        console.error(`no entry "${argv.join(' ')}".` + (guess.length ? ' Closest: ' + guess.map(r => r.entry.id).join(', ') : ''));
        process.exit(1);
    }
    console.log(optJson ? JSON.stringify(e, null, 2) : render(e, 'full'));
    process.exit(0);
}

const query = argv.join(' ');
const kinds = optKind ? optKind.split(',') : undefined;
const results = engine.search(query, { limit: optN + 5, kinds });
if (optJson) {
    console.log(JSON.stringify(results.map(r => ({ id: r.entry.id, score: Math.round(r.score * 10) / 10, task: r.task, lines: r.lines.map(l => l.text), entry: r.entry })), null, 1));
    process.exit(0);
}
const consts = (query.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) || []).map(showConst).filter(Boolean);
if (consts.length) console.log(consts.join('\n') + '\n');
if (!results.length) { console.log('nothing found. Try other words, or --list to see what is there.'); process.exit(1); }
results.slice(0, optN).forEach((r, i) => {
    console.log(render(r.entry, i === 0 ? 'long' : 'medium', `${i + 1}. `, r.lines));
    console.log('');
});
if (results.length > optN) {
    console.log('also:');
    for (const r of results.slice(optN)) console.log(oneLine(r.entry));
}
