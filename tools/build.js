#!/usr/bin/env node
'use strict';
/*
 * Builds data/index.json and site/ from:
 *   sources/docs           (screeps/docs: API reference markdown, article titles)
 *   sources/common         (@screeps/common: lib/constants.js)
 *   sources/engine         (screeps/engine: line anchors for behaviour notes)
 *   sources/backend-local  (screeps/backend-local: invader raid generation)
 *   content/*.js           (own text: summaries, tasks, pitfalls, mechanics, recipes, synonyms)
 *
 * Usage: node tools/build.js [--sources <dir>] [--no-doc-text]
 *   --no-doc-text  leave out every sentence taken from the official docs (argument and
 *                  return-code descriptions, first sentences); names, types and codes stay.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i === -1 ? def : argv[i + 1]; };
const SOURCES = path.resolve(opt('--sources', path.join(ROOT, 'sources')));
const NO_DOC_TEXT = argv.includes('--no-doc-text');

const DOCS_API_URL = 'https://docs.screeps.com/api/';
const DOCS_URL = 'https://docs.screeps.com/';
const REPOS = {
    docs: { github: 'screeps/docs', license: 'CC BY 4.0 (stated in the site footer; the repository has no LICENSE file)' },
    common: { github: 'screeps/common', license: 'ISC' },
    engine: { github: 'screeps/engine', license: 'ISC' },
    'backend-local': { github: 'screeps/backend-local', license: 'ISC' },
};

const problems = [];
const warn = msg => problems.push(msg);
function die(msg) { console.error('build failed: ' + msg); process.exit(1); }

// ---------------------------------------------------------------- sources

function gitInfo(dir) {
    const run = a => execFileSync('git', ['-c', 'core.longpaths=true', '-C', dir].concat(a), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    try { return { commit: run(['rev-parse', 'HEAD']), date: run(['log', '-1', '--format=%cs']) }; }
    catch (e) { return { commit: null, date: null }; }
}

function sourceMeta() {
    const meta = {};
    for (const name of Object.keys(REPOS)) {
        const dir = path.join(SOURCES, name);
        if (!fs.existsSync(dir)) die(`missing ${dir} (run: node tools/fetch-sources.js)`);
        const pkgFile = path.join(dir, 'package.json');
        const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : {};
        meta[name] = Object.assign({ repo: 'https://github.com/' + REPOS[name].github, license: REPOS[name].license,
            version: pkg.version && pkg.version !== '0.0.0' ? pkg.version : undefined }, gitInfo(dir));
    }
    return meta;
}

function loadConstants() {
    // constants.js is one Object.assign(exports, {...}) call with no requires; it is evaluated
    // in an empty context so nothing but plain data can come out of it.
    const code = fs.readFileSync(path.join(SOURCES, 'common/lib/constants.js'), 'utf8');
    if (/\brequire\s*\(|\bprocess\b|\bimport\s*\(/.test(code)) die('constants.js is no longer plain data; read it before building');
    const sandbox = { exports: {} };
    vm.runInNewContext(code, sandbox, { timeout: 2000 });
    return JSON.parse(JSON.stringify(sandbox.exports));
}

// ---------------------------------------------------------------- text helpers

function clean(s) {
    return String(s || '')
        .replace(/<a [^>]*>([\s\S]*?)<\/a>/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[(`[^`]+`)\]\([^)]*\)/g, '$1')   // a link whose text is code, which may hold brackets
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<\/?code>/g, '`')
        .replace(/<br\s*\/?>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\s+/g, ' ').trim();
}

// At most the first sentence, so no passage of the docs is carried over.
function brief(s, max) {
    s = clean(s);
    const m = s.match(/^(.*?[.!?])(\s|$)/);
    if (m && m[1].length >= 12) s = m[1];
    if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
    return s;
}

function splitTagArgs(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length) break;
        const q = s[i];
        if (q === "'" || q === '"') {
            let j = i + 1;
            while (j < s.length && !(s[j] === q && (j + 1 >= s.length || /\s/.test(s[j + 1])))) j++;
            out.push(s.slice(i + 1, j));
            i = j + 1;
        } else {
            let j = i;
            while (j < s.length && !/\s/.test(s[j])) j++;
            out.push(s.slice(i, j));
            i = j;
        }
    }
    return out;
}

// ---------------------------------------------------------------- docs: API reference

const CPU_CLASS = {
    A: { cpu: 'intent', cpuText: 'intent: natural cost + 0.2 CPU when it returns OK' },
    0: { cpu: 'insignificant', cpuText: 'insignificant CPU cost' },
    1: { cpu: 'low', cpuText: 'low CPU cost' },
    2: { cpu: 'medium', cpuText: 'medium CPU cost' },
    3: { cpu: 'high', cpuText: 'high CPU cost' },
};

const STATIC_ROOTS = /^(Game|PathFinder|RawMemory|InterShardMemory|Memory)(\.|$)/;
const INSTANCE_NAMES = {
    RoomPosition: 'pos', 'PathFinder.CostMatrix': 'costMatrix', 'Room.Terrain': 'terrain', 'StructureSpawn.Spawning': 'spawn.spawning',
    RoomVisual: 'room.visual', MapVisual: 'Game.map.visual', ConstructionSite: 'site', RoomObject: 'object', OwnedStructure: 'structure',
    StructureWall: 'wall', Store: 'store',
};
function instanceName(object) {
    if (INSTANCE_NAMES[object]) return INSTANCE_NAMES[object];
    const base = object.replace(/^Structure(?=[A-Z])/, '');
    return base[0].toLowerCase() + base.slice(1);
}

function parseParams(block) {
    return block.split(/\n===\n/).map(chunk => {
        chunk = chunk.trim();
        const m = chunk.match(/^(.*?) : (.*?)(\n|$)/);
        if (!m) return null;
        const optional = / \(optional\)/.test(m[1]);
        const rest = chunk.slice(m[0].length);
        const param = { name: m[1].replace(' (optional)', '').trim(), type: clean(m[2]) };
        if (optional) param.optional = true;
        const options = [];
        const liRe = /<div class="api-arg-title">([\s\S]*?)<\/div>\s*<div class="api-arg-type">([\s\S]*?)<\/div>\s*(?:<div class="api-arg-desc">([\s\S]*?)<\/div>)?/g;
        let li;
        while ((li = liRe.exec(rest))) {
            const o = { name: clean(li[1]), type: clean(li[2]) };
            if (!NO_DOC_TEXT && li[3]) o.desc = brief(li[3], 140);
            options.push(o);
        }
        if (options.length) param.options = options;
        if (!NO_DOC_TEXT) {
            const desc = brief(rest.split(/<ul|<table/)[0], 200);
            if (desc) param.desc = desc;
        }
        return param;
    }).filter(Boolean);
}

function parseCodes(block, constants) {
    return block.split('\n').map(line => {
        const i = line.indexOf(' | ');
        if (i === -1) return null;
        const code = line.slice(0, i).trim();
        const entry = { code, value: constants[code] };
        if (!NO_DOC_TEXT) entry.desc = brief(line.slice(i + 3), 200);
        return entry;
    }).filter(Boolean).sort((a, b) => b.value - a.value);
}

function parseBody(body, constants) {
    let b = body.replace(/```[\s\S]*?```/g, '\n');
    let params = [], codes = [];
    b = b.replace(/\{%\s*api_method_params\s*%\}([\s\S]*?)\{%\s*endapi_method_params\s*%\}/g, (_, c) => {
        params = params.concat(parseParams(c));
        return '\n\n@@BLOCK@@\n\n';
    });
    b = b.replace(/\{%\s*api_return_codes[^%]*%\}([\s\S]*?)\{%\s*endapi_return_codes\s*%\}/g, (_, c) => {
        codes = codes.concat(parseCodes(c, constants));
        return '\n\n@@BLOCK@@\n\n';
    });
    b = b.replace(/\{%[\s\S]*?%\}/g, '\n');
    const parts = b.split(/^###\s+Return value\s*$/m);
    const paras = p => p.split(/\n\s*\n/).map(x => x.trim()).filter(x => x && !/^<(img|table)/.test(x));
    const first = p => { const list = paras(p.split('@@BLOCK@@')[0]); return list.length ? list[0] : ''; };
    return { desc: first(parts[0]), ret: parts[1] ? first(parts[1]) : '', params, codes };
}

function parseApiFile(file, constants) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const h1m = text.match(/^#\s+(.+?)\s*$/m);
    if (!h1m) return null;
    const object = h1m[1].trim();
    const tagRe = /\{%\s*api_(method|property)\s+([\s\S]*?)%\}/g;
    const tags = [];
    let m;
    while ((m = tagRe.exec(text))) tags.push({ kind: m[1], args: splitTagArgs(m[2]), start: m.index, end: tagRe.lastIndex });
    const headStart = h1m.index + h1m[0].length;
    const head = text.slice(headStart, tags.length ? tags[0].start : text.length);
    const includes = [];
    const incRe = /\{%\s*page\s+inherited\/([\w.]+)\.md\s*%\}/g;
    while ((m = incRe.exec(text))) includes.push(m[1]);
    const headBody = parseBody(head.replace(/<table[\s\S]*?<\/table>/g, '\n').replace(/<img[^>]*>/g, ''), constants);

    const members = [];
    tags.forEach((tag, idx) => {
        const body = text.slice(tag.end, idx + 1 < tags.length ? tags[idx + 1].start : text.length);
        const a = tag.args.slice();
        let name = a[0];
        if (name.indexOf(':') !== -1) return; // inherited copy, the base object carries it
        const parsed = parseBody(body, constants);
        const qualified = name.startsWith(object + '.') || STATIC_ROOTS.test(name) && name.indexOf('.') !== -1;
        const id = qualified ? name : object + '.' + name;
        const short = id.slice(id.lastIndexOf('.') + 1);
        const entry = { id, kind: tag.kind, object: id.slice(0, id.lastIndexOf('.')), name: short };
        let optsJson;
        if (tag.kind === 'method') {
            let sig = a[1], cls = a[2];
            if (cls === undefined) { cls = sig; sig = ''; }
            if (cls === undefined) cls = '0';
            optsJson = a[3];
            const isStatic = STATIC_ROOTS.test(id);
            const callee = short === 'constructor' ? 'new ' + object : (isStatic ? id : instanceName(entry.object) + '.' + short);
            entry.signature = String(sig).split('|').map(s => `${callee}(${s.trim()})`).join('  |  ');
            Object.assign(entry, CPU_CLASS[cls] || {});
            if (parsed.params.length) entry.args = parsed.params;
            if (parsed.codes.length) entry.returns = parsed.codes;
            if (parsed.ret && !NO_DOC_TEXT) entry.returnsText = brief(parsed.ret, 200);
        } else {
            entry.type = clean(a[1] || '');
            optsJson = a[2];
            const isStatic = STATIC_ROOTS.test(id);
            entry.signature = isStatic ? id : instanceName(entry.object) + '.' + short;
        }
        if (optsJson) {
            try {
                const o = JSON.parse(optsJson);
                if (o.deprecated) entry.deprecated = o.deprecated === true ? true : clean(o.deprecated);
            } catch (e) { warn(`${id}: cannot parse tag options ${optsJson}`); }
        }
        if (parsed.desc && !NO_DOC_TEXT) entry.doc = brief(parsed.desc, 260);
        entry.url = DOCS_API_URL + '#' + id;
        members.push(entry);
    });

    const obj = { id: object, kind: 'object', object, name: object, includes, url: DOCS_API_URL + '#' + object.replace(/\./g, '-') };
    if (headBody.desc && !NO_DOC_TEXT) obj.doc = brief(headBody.desc, 260);
    return { obj, members };
}

function parseApi(constants) {
    const dir = path.join(SOURCES, 'docs/api/source');
    const entries = [];
    const objects = {};
    for (const f of fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.md') || f === 'constants.md') continue;
        const parsed = parseApiFile(path.join(dir, f), constants);
        if (!parsed) { warn(`docs: ${f} has no title`); continue; }
        objects[parsed.obj.id] = parsed.obj;
        entries.push(parsed.obj, ...parsed.members);
    }
    // inheritance chain: a page includes inherited/X.md, which itself includes its own base
    const chain = (name, seen) => {
        const o = objects[name];
        if (!o || seen.has(name)) return [];
        seen.add(name);
        let out = [];
        for (const inc of o.includes) out = out.concat([inc], chain(inc, seen));
        return out;
    };
    for (const o of Object.values(objects)) {
        const inh = [...new Set(chain(o.id, new Set()))];
        if (inh.length) o.inherits = inh;
        o.members = entries.filter(e => e.kind !== 'object' && e.object === o.id).map(e => e.id);
    }
    for (const o of Object.values(objects)) delete o.includes;
    // Game.cpu, Game.map … are listed as a property of Game and have a page of their own: keep the page
    return entries.filter(e => e.kind === 'object' || !objects[e.id]);
}

// ---------------------------------------------------------------- docs: articles (titles and headings only)

function parseArticles() {
    const dir = path.join(SOURCES, 'docs/source');
    const skip = /^(index|tos|privacy-policy|changelog|third-party|commit|community-servers|ptr|auth-tokens)\.md$/;
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
        if (!f.endsWith('.md') || skip.test(f)) continue;
        const text = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
        const title = (text.match(/^title:\s*(.+?)\s*$/m) || [])[1];
        if (!title) continue;
        const headings = [];
        const re = /^#{2,3}\s+(.+?)\s*$/gm;
        let m;
        while ((m = re.exec(text))) headings.push(clean(m[1]));
        const slug = f.replace(/\.md$/, '');
        out.push({ id: 'article:' + slug, kind: 'article', name: title.trim(), title: title.trim(),
            summary: 'Official article.' + (headings.length ? ' Sections: ' + headings.join('; ') + '.' : ''),
            url: DOCS_URL + slug + '.html' });
    }
    return out;
}

// ---------------------------------------------------------------- own content

function fmtNum(n) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n);
    const r = Math.round(n * 1000) / 1000;
    return Math.abs(r) >= 10000 ? r.toLocaleString('en-US') : String(r);
}

// {{EXPR}} in own text is evaluated against the constants, so numbers follow the sources.
function makeFill(constants) {
    const ctx = vm.createContext(Object.assign({ Math }, constants));
    return function fill(s, where) {
        if (typeof s !== 'string') return s;
        return s.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
            let v;
            try { v = vm.runInContext(expr, ctx, { timeout: 500 }); }
            catch (e) { die(`${where}: cannot evaluate {{${expr}}}: ${e.message}`); }
            if (v === undefined || (typeof v === 'number' && isNaN(v))) die(`${where}: {{${expr}}} is ${v}`);
            return typeof v === 'number' ? fmtNum(v) : String(v);
        });
    };
}

function constValue(constants, name) {
    // "BOOSTS.heal.LO.heal" style paths are allowed
    let v = constants;
    for (const part of name.split('.')) {
        if (v == null || !(part in v)) return undefined;
        v = v[part];
    }
    return v;
}

function showValue(v) {
    if (v === null || typeof v !== 'object') return typeof v === 'number' ? v : String(v);
    // per-level tables such as CONTROLLER_STRUCTURES.tower: "0/0/0/1/1/2/2/3/6 (levels 0-8)"
    const keys = Object.keys(v);
    if (!Array.isArray(v) && keys.length > 2 && keys.every((k, i) => /^\d+$/.test(k) && (i === 0 || +k === +keys[i - 1] + 1)) && keys.every(k => typeof v[k] === 'number')) {
        return `${keys.map(k => v[k]).join('/')} (levels ${keys[0]}-${keys[keys.length - 1]})`;
    }
    const s = JSON.stringify(v);
    return s.length <= 160 ? s.replace(/"/g, '').replace(/,/g, ', ').replace(/:/g, ': ') : null;
}

function resolveConstants(list, constants, where) {
    return (list || []).map(name => {
        const v = constValue(constants, name);
        if (v === undefined) die(`${where}: unknown constant ${name}`);
        const value = showValue(v);
        return value === null ? { name } : { name, value };
    });
}

const fileCache = {};
function resolveEngine(refs, meta, where) {
    return (refs || []).map(ref => {
        const repo = ref.repo || 'engine';
        const file = path.join(SOURCES, repo, ref.file);
        if (!fs.existsSync(file)) die(`${where}: ${repo}/${ref.file} does not exist any more; recheck the note that cites it`);
        let line;
        if (ref.find) {
            const lines = fileCache[file] || (fileCache[file] = fs.readFileSync(file, 'utf8').split(/\r?\n/));
            const idx = lines.findIndex(l => l.indexOf(ref.find) !== -1);
            if (idx === -1) die(`${where}: "${ref.find}" not found in ${repo}/${ref.file}; the code changed, recheck the note that cites it`);
            line = idx + 1;
        }
        const sha = meta[repo].commit || 'master';
        return { label: ref.label || `${repo}: ${ref.file}`, url: `https://github.com/${REPOS[repo].github}/blob/${sha}/${ref.file}` + (line ? '#L' + line : '') };
    });
}

function applyContent(entries, constants, meta) {
    const fill = makeFill(constants);
    const fillList = (l, where) => (l || []).map(x => fill(x, where));
    const byId = new Map(entries.map(e => [e.id, e]));
    const api = require(path.join(ROOT, 'content/api.js'));
    const mechanics = require(path.join(ROOT, 'content/mechanics.js'));
    const recipes = require(path.join(ROOT, 'content/recipes.js'));
    const groups = require(path.join(ROOT, 'content/constants.js'));

    // 1. overlays on API entries
    for (const [id, o] of Object.entries(api)) {
        const e = byId.get(id);
        if (!e) { warn(`content/api.js: ${id} is not in the docs (renamed or removed?)`); continue; }
        if (o.summary) e.summary = fill(o.summary, id);
        if (o.tasks) e.tasks = o.tasks;
        if (o.pitfalls) e.pitfalls = fillList(o.pitfalls, id);
        if (o.notes) e.notes = fillList(o.notes, id);
        if (o.constants) e.constants = resolveConstants(o.constants, constants, id);
        if (o.see) e.see = o.see;
        if (o.engine) e.engine = resolveEngine(o.engine, meta, id);
        if (o.range !== undefined) e.range = o.range;
        if (o.part) e.part = o.part;
    }

    // 2. constant groups
    const names = Object.keys(constants);
    const taken = new Set();
    const groupEntries = [];
    for (const g of groups) {
        const members = names.filter(n => !taken.has(n) && ((g.names || []).includes(n) || (g.match || []).some(re => re.test(n))));
        members.forEach(n => taken.add(n));
        for (const n of g.names || []) if (!names.includes(n)) warn(`content/constants.js: ${g.id} lists unknown constant ${n}`);
        if (!members.length) { warn(`content/constants.js: group ${g.id} matches nothing`); continue; }
        const id = 'const:' + g.id;
        const e = { id, kind: 'constants', name: g.title, title: g.title, summary: fill(g.summary || '', id), tasks: g.tasks || [],
            constants: members.map(n => { const value = showValue(constants[n]); return value === null ? { name: n } : { name: n, value }; }),
            url: DOCS_API_URL + '#Constants' };
        if (g.tables) e.tables = g.tables.map(t => t(constants));
        if (g.notes) e.notes = fillList(g.notes, id);
        if (g.see) e.see = g.see;
        groupEntries.push(e);
    }
    const rest = names.filter(n => !taken.has(n));
    if (rest.length) {
        warn(`constants not in any group (listed under "Other constants"): ${rest.join(', ')}`);
        groupEntries.push({ id: 'const:other', kind: 'constants', name: 'Other constants', title: 'Other constants', summary: 'Constants not sorted into a group yet.', tasks: [],
            constants: rest.map(n => { const value = showValue(constants[n]); return value === null ? { name: n } : { name: n, value }; }), url: DOCS_API_URL + '#Constants' });
    }

    // 3. mechanics and recipes
    const mechEntries = mechanics.map(m => {
        const id = 'mechanic:' + m.id;
        const e = { id, kind: 'mechanic', name: m.title, title: m.title, summary: fill(m.summary, id), tasks: m.tasks || [],
            facts: fillList(m.facts, id), url: m.url || undefined };
        if (m.pitfalls) e.pitfalls = fillList(m.pitfalls, id);
        if (m.constants) e.constants = resolveConstants(m.constants, constants, id);
        if (m.tables) e.tables = m.tables.map(t => t(constants));
        if (m.viz) e.viz = m.viz;
        if (m.see) e.see = m.see;
        if (m.engine) e.engine = resolveEngine(m.engine, meta, id);
        return e;
    });
    const recipeEntries = recipes.map(r => {
        const id = 'recipe:' + r.id;
        const e = { id, kind: 'recipe', name: r.title, title: r.title, summary: fill(r.summary, id), tasks: r.tasks || [],
            steps: r.steps.map(s => ({ call: s.call || undefined, text: fill(s.text, id) })), url: r.url || undefined };
        if (r.pitfalls) e.pitfalls = fillList(r.pitfalls, id);
        if (r.constants) e.constants = resolveConstants(r.constants, constants, id);
        if (r.see) e.see = r.see;
        return e;
    });

    const all = recipeEntries.concat(mechEntries, entries, groupEntries);

    // 4. cross-link check
    const ids = new Set(all.map(e => e.id));
    for (const e of all) {
        for (const s of e.see || []) if (!ids.has(s)) die(`${e.id}: "see" points to unknown entry ${s}`);
        for (const s of e.steps || []) if (s.call && !ids.has(s.call)) die(`${e.id}: step calls unknown entry ${s.call}`);
    }
    return all;
}

// ---------------------------------------------------------------- output

function main() {
    const meta = sourceMeta();
    const constants = loadConstants();
    let entries = parseApi(constants).concat(parseArticles());
    entries = applyContent(entries, constants, meta);
    for (const e of entries) {
        if (!e.title) e.title = e.kind === 'method' && e.name === 'constructor' ? 'new ' + e.object : e.id;
        for (const k of Object.keys(e)) if (e[k] === undefined || (Array.isArray(e[k]) && !e[k].length)) delete e[k];
    }
    const synonyms = require(path.join(ROOT, 'content/synonyms.js'));
    // start page: key numbers, each pointing at the entry that explains it
    const fill = makeFill(constants);
    const known = new Set(entries.map(e => e.id));
    const cheats = require(path.join(ROOT, 'content/cheatsheet.js')).map(g => ({
        title: g.title,
        rows: g.rows.map(r => {
            if (!known.has(r.to)) die(`content/cheatsheet.js: "${r.label}" points to unknown entry ${r.to}`);
            return { label: fill(r.label, 'cheatsheet'), value: fill(r.value, 'cheatsheet'), unit: fill(r.unit || '', 'cheatsheet'), to: r.to };
        }),
    }));
    const counts = {};
    for (const e of entries) counts[e.kind] = (counts[e.kind] || 0) + 1;
    const index = {
        meta: {
            name: 'Screeps API lookup',
            docText: !NO_DOC_TEXT,
            attribution: 'Signatures, argument names, return codes' + (NO_DOC_TEXT ? '' : ' and the short descriptions of arguments and return codes') +
                ' come from the Screeps documentation (docs.screeps.com, CC BY 4.0, shortened). Constant values come from @screeps/common, behaviour notes cite screeps/engine and screeps/backend-local (ISC, © Artem Chivchalov). Summaries, tasks, pitfalls, mechanics and recipes are written for this index. Not affiliated with Screeps.',
            sources: meta,
            counts,
        },
        constants,
        synonyms,
        cheats,
        entries,
    };
    const json = JSON.stringify(index);
    fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'data/index.json'), json);

    // site: index.html (page with the search code inlined) + index.js (the index)
    const siteDir = path.join(ROOT, 'site');
    fs.mkdirSync(siteDir, { recursive: true });
    fs.writeFileSync(path.join(siteDir, 'index.js'), 'window.SCREEPS_API_INDEX=' + json + ';\n');
    const tpl = path.join(ROOT, 'site-src/index.html');
    if (fs.existsSync(tpl)) {
        const search = fs.readFileSync(path.join(ROOT, 'lib/search.js'), 'utf8');
        const html = fs.readFileSync(tpl, 'utf8').replace('/*__SEARCH_JS__*/', () => search);
        fs.writeFileSync(path.join(siteDir, 'index.html'), html);
    }

    const total = entries.length;
    console.log(`index: ${total} entries (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}), ${Object.keys(constants).length} constants, ${(json.length / 1024).toFixed(0)} KB`);
    for (const [name, m] of Object.entries(meta)) console.log(`  ${name}: ${m.commit ? m.commit.slice(0, 10) : '?'} ${m.date || ''} ${m.version ? 'v' + m.version : ''}`);
    if (problems.length) {
        console.log(`${problems.length} warning(s):`);
        for (const p of problems) console.log('  - ' + p);
    }
}

main();
