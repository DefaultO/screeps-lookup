#!/usr/bin/env node
'use strict';
/*
 * Draws figures to PNG sheets so an author can look at them without opening the site.
 * Needs Chrome or Edge (headless); nothing is installed.
 *
 *   node tools/shots.js --pack economy              the figures of content/packs/economy/figures.js
 *   node tools/shots.js --base                      the figures of content/figures.js
 *   node tools/shots.js --ids mechanic:tower,Creep.harvest
 *   node tools/shots.js --all
 *     --index <file>   index to read (default data/index.json; use the one of build.js --out)
 *     --theme <name>   dark (default) or light
 *     --height <px>    height of a sheet (default 1700); figures are spread over sheets to fit
 *     --out <dir>      where the sheets go (default sources/_shots)
 *     --html           write the HTML sheets only, take no screenshots
 *     --chrome <path>  the browser, if it is not found (or set CHROME)
 *
 * Prints the path of every sheet. A sheet is 1000 px wide, like the reading column of the site.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const Figures = require('../lib/figures.js');
const GameArt = require('../lib/gameart.js');

const argv = process.argv.slice(2);
const opt = name => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const has = name => argv.includes(name);
const ROOT = path.join(__dirname, '..');
const index = JSON.parse(fs.readFileSync(opt('--index') || path.join(ROOT, 'data/index.json'), 'utf8'));
const theme = opt('--theme') === 'light' ? 'light' : 'dark';
const height = +opt('--height') || 1700;
const out = path.resolve(opt('--out') || path.join(ROOT, 'sources/_shots'));
const F = Figures.create(index.constants, GameArt.create(require('../lib/gameart-assets.js')));

function idsOf(file) {
    if (!fs.existsSync(file)) { console.error('no file ' + file); process.exit(1); }
    const mod = require(file);
    return Object.keys(typeof mod === 'function' ? mod(index.constants, require(path.join(ROOT, 'content/_fig.js'))(index.constants)) : mod);
}
let ids;
if (opt('--ids')) ids = opt('--ids').split(',');
else if (opt('--pack')) ids = [].concat(...opt('--pack').split(',').map(p => idsOf(path.join(ROOT, 'content/packs', p, 'figures.js'))));
else if (has('--base')) ids = idsOf(path.join(ROOT, 'content/figures.js'));
else if (has('--all')) ids = index.entries.filter(e => e.figures).map(e => e.id);
else { console.error('say which figures: --pack <name>, --base, --ids a,b or --all'); process.exit(1); }

const byId = new Map(index.entries.map(e => [e.id, e]));
const figs = [];
for (const id of ids) {
    const e = byId.get(id);
    if (!e || !e.figures) { console.error(`${id}: no figures in this index (build first, with the pack included)`); continue; }
    e.figures.forEach((f, i) => figs.push({ id, n: i + 1, of: e.figures.length, fig: f }));
}
if (!figs.length) { console.error('nothing to draw'); process.exit(1); }

const css = /<style>([\s\S]*?)<\/style>/.exec(fs.readFileSync(path.join(ROOT, 'site-src/index.html'), 'utf8'))[1];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/^sheet-\d+\.(html|png)$/.test(f)) fs.unlinkSync(path.join(out, f));

// rough height of a figure on the sheet, to decide how many fit
const WIDE = ['line', 'cols', 'timeline', 'flow', 'ladder'];
function tall(f) {
    const cap = 50 + Math.ceil(String(f.caption || '').length / 70) * 20;
    switch (f.type) {
        case 'line': return 350 + cap;
        case 'cols': return 320 + cap;
        case 'timeline': return 70 + f.rows.length * 40 + cap;
        case 'flow': return Math.max(...f.nodes.map(n => n.at[1] + 1)) * 96 + 30 + cap;
        case 'ladder': return f.groups.length * 100 + 30 + cap;
        case 'scene': return f.size[1] * (f.tile || 40) + 40 + cap;
        case 'panels': return Math.max(...f.panels.map(p => p.size[1] * (p.tile || 40))) + 110 + cap;
        case 'bars': return f.rows.length * 42 + 30 + cap;
        case 'body': return f.rows.length * 60 + 40 + cap;
        case 'map': return f.rows.length * (f.cell || 22) + 90 + cap;
        default: return 400;
    }
}
const groups = [[]];
let used = 0, half = 0;   // half: height of a narrow figure waiting for its neighbour
for (const p of figs) {
    const wide = WIDE.includes(p.fig.type) || p.fig.wide, h = tall(p.fig);
    let add;
    if (wide) { add = h; half = 0; } else if (half) { add = Math.max(0, h - half); half = 0; } else { add = h; half = h; }
    if (used + add > height - 30 && groups[groups.length - 1].length) { groups.push([]); used = 0; add = h; half = wide ? 0 : h; }
    groups[groups.length - 1].push(p);
    used += add + 14;
}
const sheets = [];
for (const part of groups) {
    const name = 'sheet-' + String(sheets.length + 1).padStart(2, '0');
    const html = `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><title>${name}</title><style>${css}
body { width: 1000px; padding: 14px 16px 30px; } .figs { margin-top: 0; }</style></head><body>${F.defs()}<div class="figs">` +
        part.map(p => F.render(p.fig, { more: `<span class="fig-from mono">${esc(p.id)} [${p.n} of ${p.of}]</span>` })).join('') + '</div></body></html>';
    fs.writeFileSync(path.join(out, name + '.html'), html);
    sheets.push(name);
}

if (has('--html')) { sheets.forEach(s => console.log(path.join(out, s + '.html'))); process.exit(0); }

const candidates = [opt('--chrome'), process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = candidates.find(c => fs.existsSync(c));
if (!chrome) { console.error('No Chrome or Edge found; pass --chrome <path>, or use --html and open the sheets yourself.'); sheets.forEach(s => console.log(path.join(out, s + '.html'))); process.exit(1); }

const profile = path.join(out, '.profile');   // an own profile, so a running browser is left alone
for (const s of sheets) {
    const png = path.join(out, s + '.png');
    const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
        '--window-size=1000,' + height, '--screenshot=' + png, 'file:///' + path.join(out, s + '.html').replace(/\\/g, '/')], { encoding: 'utf8', timeout: 60000 });
    if (!fs.existsSync(png)) { console.error(`${s}: no screenshot (${(r.stderr || r.error || '').toString().split('\n')[0]})`); continue; }
    console.log(png);
}
console.log(`${figs.length} figures on ${sheets.length} sheet(s), ${theme} theme`);
