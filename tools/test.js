#!/usr/bin/env node
'use strict';
/*
 * Runs test/queries.json against data/index.json.
 *   {"q": "...", "first": "id"}                    the entry must be the top result
 *   {"q": "...", "expect": ["id", ...], "top": 5}  every listed entry must be in the top N (default 5)
 * Also checks the index itself: unique ids, cross-links, a summary on every hand-written entry.
 *   node tools/test.js [-v]
 */
const fs = require('fs');
const path = require('path');
const { create } = require('../lib/search.js');

const verbose = process.argv.includes('-v');
const root = path.join(__dirname, '..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/index.json'), 'utf8'));
const queries = JSON.parse(fs.readFileSync(path.join(root, 'test/queries.json'), 'utf8'));
const engine = create(index);

let failed = 0;
const fail = msg => { failed++; console.log('FAIL  ' + msg); };

// ---- index checks
const ids = new Set();
for (const e of index.entries) {
    if (ids.has(e.id)) fail(`duplicate id ${e.id}`);
    ids.add(e.id);
    if (!e.url && e.kind !== 'mechanic' && e.kind !== 'recipe') fail(`${e.id}: no url`);
    if (!e.summary && !e.doc && e.kind !== 'property' && e.kind !== 'method') fail(`${e.id}: no summary`);
}
for (const e of index.entries) {
    for (const s of e.see || []) if (!ids.has(s)) fail(`${e.id}: see -> ${s} does not exist`);
    for (const s of e.steps || []) if (s.call && !ids.has(s.call)) fail(`${e.id}: step -> ${s.call} does not exist`);
}
for (const q of queries) for (const id of [].concat(q.first || [], q.expect || [])) if (!ids.has(id)) fail(`query "${q.q}" expects unknown entry ${id}`);

// ---- queries
let passed = 0;
for (const q of queries) {
    const top = q.top || 5;
    const res = engine.search(q.q, { limit: Math.max(top, 8) }).map(r => r.entry.id);
    const problems = [];
    if (q.first && res[0] !== q.first) problems.push(`first is ${res[0]}, wanted ${q.first}`);
    for (const id of q.expect || []) {
        const rank = res.indexOf(id);
        if (rank === -1 || rank >= top) problems.push(`${id} ${rank === -1 ? 'not found' : 'at rank ' + (rank + 1)}, wanted top ${top}`);
    }
    if (problems.length) fail(`"${q.q}": ${problems.join('; ')}\n        got: ${res.slice(0, 6).join(', ')}`);
    else { passed++; if (verbose) console.log(`ok    "${q.q}" -> ${res.slice(0, 3).join(', ')}`); }
}
console.log(`${passed}/${queries.length} queries pass, ${index.entries.length} entries checked` + (failed ? `, ${failed} failure(s)` : ''));
process.exit(failed ? 1 : 0);
