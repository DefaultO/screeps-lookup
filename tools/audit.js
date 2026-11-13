#!/usr/bin/env node
'use strict';
/*
 * What is still thin in the index. Run it after a build.
 *
 *   node tools/audit.js [--list] [--index <file>]
 *
 * Reports: API members without own text, lines (pitfalls, notes, facts) without a source,
 * mechanics and recipes without any source, constants without a one-line meaning.
 * --list names every item behind each number.
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = name => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const list = argv.includes('--list');
const index = JSON.parse(fs.readFileSync(opt('--index') || path.join(__dirname, '..', 'data/index.json'), 'utf8'));
const pct = (a, b) => (b ? Math.round(a / b * 100) : 100) + '%';
const show = (title, items) => { if (list && items.length) console.log('    ' + items.join(', ').replace(/(.{1,110})(, |$)/g, '$1$2\n    ').trimEnd()); };

const members = index.entries.filter(e => e.kind === 'method' || e.kind === 'property');
const live = members.filter(e => !e.deprecated);
const noText = live.filter(e => !e.summary);
console.log(`API members with own text:   ${live.length - noText.length} of ${live.length} (${pct(live.length - noText.length, live.length)})` + `   [${members.length - live.length} deprecated ones not counted]`);
const byObject = {};
for (const e of noText) (byObject[e.object] = byObject[e.object] || []).push(e.name);
if (list) for (const o of Object.keys(byObject).sort()) console.log(`    ${o}: ${byObject[o].join(', ')}`);

const methodsNoTask = live.filter(e => e.kind === 'method' && !(e.tasks && e.tasks.length));
console.log(`Methods with task lines:     ${live.filter(e => e.kind === 'method').length - methodsNoTask.length} of ${live.filter(e => e.kind === 'method').length}`);
show('', methodsNoTask.map(e => e.id));

let lines = 0, sourced = 0;
const unsourcedEntries = [];
for (const e of index.entries) {
    let n = 0, s = 0;
    for (const key of ['pitfalls', 'notes', 'facts']) {
        const arr = e[key] || [];
        n += arr.length;
        s += Object.keys((e.src || {})[key] || {}).length;
    }
    lines += n; sourced += s;
    if ((e.kind === 'mechanic' || e.kind === 'recipe') && !s && !(e.engine && e.engine.length)) unsourcedEntries.push(e.id);
}
console.log(`Lines with a source:         ${sourced} of ${lines} (${pct(sourced, lines)})`);
const kinds = k => index.entries.filter(e => e.kind === k);
console.log(`Mechanics: ${kinds('mechanic').length}, recipes: ${kinds('recipe').length}; without any source: ${unsourcedEntries.length}`);
show('', unsourcedEntries);

const names = Object.keys(index.constants);
const notes = index.constantNotes || {};
const plain = n => /^(RESOURCE_|FIND_|LOOK_|COLOR_|STRUCTURE_|EVENT_|PWR_|ERR_|ORDER_|DENSITY_)/.test(n) || ['OK', 'TOP', 'TOP_RIGHT', 'RIGHT', 'BOTTOM_RIGHT', 'BOTTOM', 'BOTTOM_LEFT', 'LEFT', 'TOP_LEFT', 'MOVE', 'WORK', 'CARRY', 'ATTACK', 'RANGED_ATTACK', 'TOUGH', 'HEAL', 'CLAIM'].includes(n);
const need = names.filter(n => !plain(n));
const missing = need.filter(n => !notes[n]);
console.log(`Constants with a meaning:    ${need.length - missing.length} of ${need.length} (${pct(need.length - missing.length, need.length)})   [${names.length - need.length} plain names not counted]`);
if (list) {
    for (const g of kinds('constants')) {
        const m = g.constants.map(c => c.name).filter(n => missing.includes(n));
        if (m.length) console.log(`    ${g.id}: ${m.join(', ')}`);
    }
}
