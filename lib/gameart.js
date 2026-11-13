/*
 * The game's own graphics as inline SVG: a port of the official Screeps renderer
 * (https://github.com/screeps/renderer, ISC licence, (c) 2016 Artem Chivchalov) to static markup.
 * Every object is put together the way metadata/src/objects/<type>.metadata.js describes it, with the
 * same textures, radii, colours, order and alpha; the textures themselves come from lib/gameart-assets.js
 * (made by tools/art.js from metadata/images). Animations are left at rest, names and badge images are left out.
 *
 *   var A = ScreepsGameArt.create(ScreepsGameArtAssets);
 *   A.defs()                 -> one hidden <svg> with every definition; put it ONCE in the HTML document
 *                               (A.defs(true): only the <defs> element, to put inside an <svg> of your own)
 *   A.draw(kind, opts)       -> {main, light, fx, z}: markup of one object centred on (0, 0)
 *   A.road(neighbours)       -> markup of one road tile centred on (0, 0)
 *   A.terrain(rows)          -> ground, swamps and walls of a grid of tiles, origin at the top left of tile [0, 0]
 *   A.terrainLight(rows)     -> what the walls of that grid add to the lighting layer
 *   A.ramparts(tiles, opts)  -> ramparts that are not public, joined into one shape as the game does (an fx)
 *   A.lit(w, h, lights)      -> the lighting layer around the `light` markup of a drawing w by h units
 *   A.scene(spec)            -> a whole drawing: terrain, roads, objects, lighting and effects in the right order
 *   A.colors, A.kinds, A.partColors
 *
 * Units are the renderer's: one tile is 100 by 100. The markup holds no ids and uses no CSS classes, so an
 * object can be drawn any number of times; it refers to the definitions of A.defs() (<use href="#ga-NAME">,
 * url(#ga-glow...)). It relies on nothing from the page, but it does inherit: do not put it inside an element
 * that sets fill, stroke or stroke-width (the <svg> of A.scene sets them back itself).
 *
 * LAYERS, AND HOW THE LIGHT IS PUT ON
 * The renderer stacks four layers: terrain, objects, lighting, effects (metadata/src/index.js). The lighting
 * layer is drawn on its own: a rectangle of ambient grey 0x808080 first, then every light on top of it with
 * blend mode SCREEN; the finished layer is then MULTIPLIED over terrain and objects. So without a light
 * everything is shown at half of its colour (the ground 0x555555 comes out as #2b2b2b), under a glow it comes
 * back to its full colour, and a coloured glow tints what is under it. Effects are drawn last and are not lit.
 * In SVG, for a drawing w by h units:
 *
 *   <svg x="0" y="0" width="w" height="h" style="isolation:isolate">     a nested <svg>: it clips (glows are large)
 *                                                                        and keeps the blending inside the drawing
 *     A.terrain(rows)
 *     roads, then the `main` of every object, lowest z first             <g transform="translate(cx cy)">main</g>
 *     <g style="mix-blend-mode:multiply">                                this <g> is what A.lit(w, h, lights) returns
 *       <rect width="w" height="h" fill="#808080"/>
 *       A.terrainLight(rows)
 *       the `light` of every object, moved to its tile like `main`       each light carries mix-blend-mode:screen itself
 *     </g>
 *     the `fx` of every object (ramparts, construction sites, flags, nukes)
 *   </svg>
 *
 * A.scene does exactly this. `light` and `fx` may be ''. Blend modes used: multiply, screen, plus-lighter
 * (the renderer's ADD); a browser without one of them shows that part with normal blending.
 *
 * KINDS AND OPTIONS (all options are optional)
 *   owner: 'me' | 'foe' | 'none' wherever the renderer colours by player; {foe: true} and {neutral: true} are read too.
 *     The colours are the renderer's own for its userOwnerColor mode: 0x8fbb93, 0xFF7777, 0xBBBBBB.
 *   fill, carry, progress, power ...: 0..1.   angle: degrees, clockwise, 0 is up.
 *   creep {body: ['W','W','C','M'] or 'WWCM' or '5W 1C 3M' (M W C A R H T, L or CL is CLAIM), carry, carryKind: 'energy'|'power'|other,
 *          owner (also 'npc': the invader / source keeper sprite), angle}
 *   powerCreep {owner, level 0..25 (default 25), angle}        source {empty, fill}
 *   mineral {kind: 'H','O','U','L','K','Z','X'}                 deposit {kind: 'silicon','metal','biomass','mist', harvested 0..1}
 *   controller {level 0..8, owner, progress}                    spawn {fill, owner, spawning}
 *   extension {fill, size: 50|100|200, owner}                   tower {fill, owner, angle (where the barrel points)}
 *   storage, terminal, container, factory {fill (energy), power, other, owner; factory also level 0..5}
 *   link {fill, owner}       lab {kind (only says there is a mineral: the game shows every mineral white), empty, fill, energy, owner}
 *   nuker {fill, g, owner}   observer {owner}   powerSpawn {fill, power, owner}   extractor {owner}
 *   rampart {owner, public}  wall {merged: true when the tile is already a '#' of A.terrain}   road {neighbours}
 *   site {progress, owner}   energy {big, amount}   resource {kind, big, amount}
 *   tombstone, ruin {owner, empty, decay}   flag {color, secondary: 1..10, a COLOR_* name such as 'red', or '#rrggbb'}
 *   portal   keeperLair   invaderCore {ttl}   powerBank {fill}   nuke
 * z is the zIndex of the object's metadata: the order inside the objects layer (roads are -1).
 *
 * WHERE THIS IS NOT THE RENDERER
 *   - Badges. The game shows the image of the player's badge on creeps, spawns, controllers, power spawns and power
 *     creeps. Here that place is a disc in the owner's colour (a controller nobody owns keeps the renderer's 0x222222).
 *   - Textures that are photographs of noise: the floor, the walls and the swamp are one flat colour each, the average
 *     of what the renderer shows (see A.terrain). glow.png and creep-mask.png are radial gradients fitted to the files.
 *   - Things that move are shown at one moment: the eye of the observer on the first of its four places, portal and
 *     keeper lair one second into their pulse, the level arcs of a factory lit, a tower's barrel where `angle` says
 *     (the game turns it all the time), a nuke without the ring that closes in and without the blur of its second cross.
 *   - The letter of a mineral is text in Roboto if the page has it, else Arial or the next sans-serif.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ScreepsGameArt = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ------------------------------------------------------------------ numbers of the renderer
    var OWNER = { me: 0x8fbb93, foe: 0xff7777, none: 0xbbbbbb };          // _all.metadata.js, playerColor with userOwnerColor
    var ENERGY = 0xffe56d, POWER = 0xf41f33, WHITE = 0xffffff;
    var AMBIENT = 0x808080;                                               // index.js, lighting layer
    var GROUND = 0x555555;                                                // terrain.js, floor with lighting 'normal'
    var ROAD = 0xaaaaaa;                                                  // road.js
    // terrain.js draws textures over flat colours; these are the averages of what comes out (see terrain())
    var WALL = 0x2b2b2b, SWAMP = 0x5a6a3f, SWAMP_EDGE = 0x51533f;
    // creepBuildBody.js: colour of a part and whether it sits at the back
    var PARTS = { M: { color: 0xaab7c5, back: true }, W: { color: 0xfde574 }, A: { color: 0xf72e41 }, R: { color: 0x7fa7e5 }, H: { color: 0x56cf5e }, L: { color: 0xb99cfb } };
    var PART_KEY = { M: 'M', W: 'W', C: 'C', A: 'A', R: 'R', H: 'H', T: 'T', L: 'L', MOVE: 'M', WORK: 'W', CARRY: 'C', ATTACK: 'A', RANGED_ATTACK: 'R', RANGED: 'R', HEAL: 'H', TOUGH: 'T', CLAIM: 'L', CL: 'L' };
    var PART_ANGLE = Math.PI / 50;                                        // (2 * PI) / maxParts / 2, per part and per side
    var MINERALS = {                                                      // mineral.metadata.js
        L: [0x89f4a5, 0x3f6147], U: [0x88d6f7, 0x1b617f], K: [0x9370ff, 0x331a80], Z: [0xf2d28b, 0x594d33],
        X: [0xff7a7a, 0x4f2626], O: [0xcccccc, 0x4d4d4d], H: [0xcccccc, 0x4d4d4d]
    };
    var DEPOSITS = { biomass: 0x84b012, metal: 0x956f5c, mist: 0xda6bf5, silicon: 0x4ca7e5 };   // deposit.metadata.js
    var FLAGS = { 1: 0xf44336, 2: 0x9c27b0, 3: 0x2196f3, 4: 0x00bcd4, 5: 0x4caf50, 6: 0xffeb3b, 7: 0xff9800, 8: 0x795548, 9: 0x9e9e9e, 10: 0xffffff };   // flag.metadata.js
    var FLAG_NAMES = { red: 1, purple: 2, blue: 3, cyan: 4, green: 5, yellow: 6, orange: 7, brown: 8, grey: 9, gray: 9, white: 10 };
    // textures the renderer tints: their symbols are written so that the colour of the <use> multiplies them
    var TINTED = ['operator-lvl0', 'operator-lvl1', 'operator-lvl2', 'operator-lvl3', 'operator-lvl4', 'controller', 'extension-border50', 'extension-border100', 'extension-border200',
        'tower-base', 'storage-border', 'terminal-border', 'link-border', 'lab', 'lab-mineral', 'factory-border', 'nuker-border', 'extractor', 'rampart', 'tombstone-resource',
        'flag', 'flag-secondary', 'deposit-biomass', 'deposit-biomass-fill', 'deposit-metal', 'deposit-metal-fill', 'deposit-mist', 'deposit-mist-fill', 'deposit-silicon', 'deposit-silicon-fill'];
    // every tint the metadata gives to the 'glow' texture on the lighting layer
    var GLOWS = [0xffff50, 0xff5555, 0x89f4a5, 0x88d6f7, 0x9370ff, 0xf2d28b, 0xff7a7a, 0xcccccc, 0x84b012, 0x956f5c, 0xda6bf5, 0x4ca7e5, 0x9999ff, 0x7777ff, 0xff0000, 0xff8080, 0xff4444];
    var KINDS = ['creep', 'powerCreep', 'source', 'mineral', 'deposit', 'controller', 'spawn', 'extension', 'tower', 'storage', 'terminal', 'container', 'link', 'lab', 'factory',
        'nuker', 'observer', 'powerSpawn', 'extractor', 'rampart', 'wall', 'road', 'site', 'energy', 'resource', 'tombstone', 'ruin', 'flag', 'portal', 'keeperLair', 'invaderCore', 'powerBank', 'nuke'];
    var SCREEN = ' style="mix-blend-mode:screen"', ADD = ' style="mix-blend-mode:plus-lighter"';

    // ------------------------------------------------------------------ small helpers
    function num(v) { var s = String(Math.round(v * 100) / 100); return s === '-0' ? '0' : s; }
    function hex6(c) { return ('00000' + (c & 0xffffff).toString(16)).slice(-6); }
    function hex(c) { var s = hex6(c); return '#' + (s.charAt(0) === s.charAt(1) && s.charAt(2) === s.charAt(3) && s.charAt(4) === s.charAt(5) ? s.charAt(0) + s.charAt(2) + s.charAt(4) : s); }
    // PIXI's tint: every channel of the texture times the channel of the tint
    function mulc(a, b) { return (Math.round((a >> 16 & 255) * (b >> 16 & 255) / 255) << 16) | (Math.round((a >> 8 & 255) * (b >> 8 & 255) / 255) << 8) | Math.round((a & 255) * (b & 255) / 255); }
    function frac(v, d) { v = v === undefined || v === null ? d : +v; return v > 1 ? 1 : v > 0 ? v : 0; }
    function op(a) { return a < 1 ? ' opacity="' + num(a) + '"' : ''; }
    function disc(r, color, extra) { return r > 0 ? '<circle r="' + num(r) + '" fill="' + hex(color) + '"' + (extra || '') + '/>' : ''; }
    function rect(x, y, w, h, color, extra) { return w > 0 && h > 0 ? '<rect x="' + num(x) + '" y="' + num(y) + '" width="' + num(w) + '" height="' + num(h) + '" fill="' + hex(color) + '"' + (extra || '') + '/>' : ''; }
    function spin(angle, s) { return angle && s ? '<g transform="rotate(' + num(angle) + ')">' + s + '</g>' : s; }
    // an arc as PIXI's Graphics.arc draws it: angles in radians, 0 to the right, clockwise on screen
    function arc(r, a0, a1, color, width) {
        if (a1 - a0 >= 2 * Math.PI - 1e-6) return '<circle r="' + num(r) + '" fill="none" stroke="' + hex(color) + '" stroke-width="' + num(width) + '"/>';
        if (a1 - a0 < 1e-6) return '';
        return '<path d="M' + num(r * Math.cos(a0)) + ' ' + num(r * Math.sin(a0)) + 'A' + num(r) + ' ' + num(r) + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + num(r * Math.cos(a1)) + ' ' + num(r * Math.sin(a1)) +
            '" fill="none" stroke="' + hex(color) + '" stroke-width="' + num(width) + '"/>';
    }
    // siteProgress.js: a pie from the top, clockwise
    function pie(r, part, color, extra) {
        if (part <= 0) return '';
        if (part >= 1) return disc(r, color, extra);
        var a = 2 * Math.PI * part - Math.PI / 2;
        return '<path d="M0 0V' + num(-r) + 'A' + num(r) + ' ' + num(r) + ' 0 ' + (part > 0.5 ? 1 : 0) + ' 1 ' + num(r * Math.cos(a)) + ' ' + num(r * Math.sin(a)) + 'z" fill="' + hex(color) + '"' + (extra || '') + '/>';
    }
    function ownerOf(o, fallback) {
        var who = o.owner || (o.foe ? 'foe' : o.neutral || o.mine === false ? 'none' : fallback || 'me');
        if (!OWNER.hasOwnProperty(who)) throw new Error('gameart: owner "' + who + '" (me, foe or none)');
        return who;
    }
    function bodyOf(spec) {
        var out = [];
        (Array.isArray(spec) ? spec : String(spec).match(/\d*\s*[A-Za-z_]+/g) || []).forEach(function (t) {
            var m = /^(\d*)\s*([A-Za-z_]+)$/.exec(String(t).trim()), n, name, i;
            if (!m) throw new Error('gameart: body part "' + t + '"');
            n = m[1] ? +m[1] : 1; name = m[2].toUpperCase();
            if (PART_KEY[name]) for (i = 0; i < n; i++) out.push(PART_KEY[name]);
            else if (!m[1] && /^[MWCARHTL]+$/.test(name)) name.split('').forEach(function (c) { out.push(c); });
            else throw new Error('gameart: body part "' + t + '" (letters M W C A R H T L, or 5W 2M)');
        });
        return out;
    }
    function flagColor(v, fallback) {
        if (v === undefined || v === null) return fallback;
        if (FLAGS[v]) return FLAGS[v];
        if (FLAG_NAMES[String(v).toLowerCase()]) return FLAGS[FLAG_NAMES[String(v).toLowerCase()]];
        var m = /^#?([0-9a-f]{6})$/i.exec(String(v));
        if (!m) throw new Error('gameart: flag colour "' + v + '" (1..10, a colour name or #rrggbb)');
        return parseInt(m[1], 16);
    }

    // Port of engine/src/lib/pathHelper.js. One path around the marked tiles of a w by h grid; a corner is round
    // where the group of tiles ends and square where it goes on or meets the edge of the grid (the room, there).
    // pad: tiles of free space around the grid, so that nothing meets an edge. Tile [x, y] spans x*100..x*100+100.
    function outline(W, H, has, pad) {
        pad = pad || 0;
        var w = W + 2 * pad, h = H + 2 * pad, path = '', visited = {}, x, y, horizontal, vertical;
        function a(x, y) { return x >= 0 && y >= 0 && x < w && y < h && !!has(x - pad, y - pad); }
        function topLeftDownR(x, y) { path += x > 0 && y > 0 && !a(x - 1, y) ? 'a 50 50 0 0 0 -50 -50 h 50 ' : 'v -50 '; }
        function topLeftUpR(x, y) { path += y > 0 && x > 0 && !a(x, y - 1) ? 'v -50 a 50 50 0 0 0 50 50 ' : 'h 50 '; }
        function topLeftR(x, y) { path += x === 0 || a(x - 1, y) || y === 0 || a(x, y - 1) ? 'v -50 h 50 ' : 'a 50 50 0 0 1 50 -50 '; }
        function topRightUpR(x, y) { path += y > 0 && x < w - 1 && !a(x, y - 1) ? 'a 50 50 0 0 0 50 -50 v 50 ' : 'h 50 '; }
        function topRightDownR(x, y) { path += x < w - 1 && y > 0 && !a(x + 1, y) ? 'h 50 a 50 50 0 0 0 -50 50 ' : 'v 50 '; }
        function topRightR(x, y) { path += x === w - 1 || a(x + 1, y) || y === 0 || a(x, y - 1) ? 'h 50 v 50 ' : 'a 50 50 0 0 1 50 50 '; }
        function bottomRightR(x, y) { path += x === w - 1 || a(x + 1, y) || y === h - 1 || a(x, y + 1) ? 'v 50 h -50 ' : 'a 50 50 0 0 1 -50 50 '; }
        function bottomLeftR(x, y) { path += x === 0 || a(x - 1, y) || y === h - 1 || a(x, y + 1) ? 'h -50 v -50 ' : 'a 50 50 0 0 1 -50 -50 '; }
        // the renderer never asks for diagonalConnect, so a diagonal neighbour counts only with a straight one next to it
        function tl(x, y) { return x === 0 || y === 0 || (a(x - 1, y - 1) && (a(x - 1, y) || a(x, y - 1))); }
        function tr(x, y) { return x === w - 1 || y === 0 || (a(x + 1, y - 1) && (a(x + 1, y) || a(x, y - 1))); }
        function recurs(x, y, dx) {
            if (visited[x + ',' + y]) { path += dx ? 'v 100 ' : 'h -100 '; return; }
            if (dx) {
                if (tl(x, y)) topLeftUpR(x, y); else path += 'h 50 ';
                if (x < w - 1 && a(x + 1, y)) {
                    if (tr(x, y)) topRightUpR(x, y); else path += 'h 50 ';
                    recurs(x + 1, y, 1);
                    path += 'h -100 ';
                } else {
                    if (tr(x, y)) { topRightUpR(x, y); topRightDownR(x, y); } else topRightR(x, y);
                    bottomRightR(x, y);
                    path += 'h -50 ';
                }
            } else {
                if (tr(x, y)) topRightDownR(x, y); else path += 'v 50 ';
                if (y < h - 1 && a(x, y + 1)) { path += 'v 50 '; recurs(x, y + 1, 0); path += 'v -50 '; } else { bottomRightR(x, y); bottomLeftR(x, y); }
                if (x === 0 || y === 0 || a(x - 1, y - 1)) topLeftDownR(x, y); else path += 'v -50 ';
            }
            visited[x + ',' + y] = true;
        }
        for (x = 0; x < w; x++) for (y = 0; y < h; y++) {
            if (!a(x, y) || visited[x + ',' + y]) continue;
            path += 'M ' + (x - pad) * 100 + ' ' + ((y - pad) * 100 + 50) + ' ';
            visited[x + ',' + y] = true;
            horizontal = 0; vertical = 0;
            do { horizontal++; } while (x + horizontal < w && a(x + horizontal, y));
            do { vertical++; } while (y + vertical < h && a(x, y + vertical));
            if (tl(x, y)) { topLeftDownR(x, y); topLeftUpR(x, y); } else topLeftR(x, y);
            if (vertical < horizontal) {
                if (x < w - 1 && a(x + 1, y)) {
                    if (tr(x, y)) topRightUpR(x, y); else path += 'h 50 ';
                    recurs(x + 1, y, 1);
                    path += 'h -50 ';
                } else {
                    if (tr(x, y)) { topRightUpR(x, y); topRightDownR(x, y); } else topRightR(x, y);
                    bottomRightR(x, y);
                }
                bottomLeftR(x, y);
            } else {
                if (tr(x, y)) { topRightUpR(x, y); topRightDownR(x, y); } else topRightR(x, y);
                if (y < h - 1 && a(x, y + 1)) { path += 'v 50 '; recurs(x, y + 1, 0); path += 'v -50 '; } else { bottomRightR(x, y); bottomLeftR(x, y); }
            }
            path += 'Z ';
        }
        return path.replace(/ ?([a-zA-Z]) ?/g, '$1').replace(/ -/g, '-');
    }
    function gridOf(rows) {
        rows = (rows || []).map(String);
        var W = 0;
        rows.forEach(function (r) { if (r.length > W) W = r.length; });
        return { W: W, H: rows.length, at: function (x, y) { return y >= 0 && y < rows.length ? rows[y].charAt(x) : ''; } };
    }

    // ------------------------------------------------------------------ one instance per set of textures
    function create(assets) {
        if (!assets) throw new Error('gameart: pass the object of lib/gameart-assets.js');
        var tinted = {}, glows = {};
        TINTED.forEach(function (n) { tinted[n] = true; });
        GLOWS.forEach(function (c) { glows[c] = true; });

        // A texture drawn by a sprite: `w` by `h` units (h left out: in proportion), its anchor (ax, ay: 0..1,
        // default the middle) or its pivot (px, py: units from the left or top edge) on (x, y).
        // PIXI stretches the whole texture into that box, and so does the symbol (preserveAspectRatio none).
        function spr(name, w, h, o) {
            var t = assets[name], x, y, s;
            if (!t) throw new Error('gameart: no texture "' + name + '" in the assets');
            o = o || {};
            if (h === undefined || h === null) h = w * t.h / t.w;
            x = (o.x || 0) - (o.px !== undefined ? o.px : (o.ax !== undefined ? o.ax : 0.5) * w);
            y = (o.y || 0) - (o.py !== undefined ? o.py : (o.ay !== undefined ? o.ay : 0.5) * h);
            s = '<use href="#ga-' + name + '" x="' + num(x) + '" y="' + num(y) + '" width="' + num(w) + '" height="' + num(h) + '"';
            if (tinted[name]) s += ' color="' + hex(o.tint === undefined ? WHITE : o.tint) + '"';
            else if (o.tint !== undefined && o.tint !== WHITE) throw new Error('gameart: texture "' + name + '" is not in the list of tinted textures');
            if (o.rot) s += ' transform="rotate(' + num(o.rot) + (o.x || o.y ? ' ' + num(o.x || 0) + ' ' + num(o.y || 0) : '') + ')"';
            if (o.alpha !== undefined) s += op(o.alpha);
            return s + (o.blend || '') + '/>';
        }
        // the 'glow' texture on the lighting layer: white, opacity falling in a straight line from the middle to the rim
        function glow(size, alpha, tint) {
            if (tint !== undefined && tint !== WHITE && !glows[tint]) throw new Error('gameart: no glow of colour ' + hex(tint));
            return '<circle r="' + num(size / 2) + '" fill="url(#ga-glow' + (tint !== undefined && tint !== WHITE ? '-' + hex6(tint) : '') + ')"' + op(alpha === undefined ? 1 : alpha) + SCREEN + '/>';
        }
        // bars of a store, stacked the way storage, container and factory do: all resources white, power and energy red, energy yellow
        function store(o, dEnergy) {
            var e = frac(o.fill, dEnergy), p = Math.min(1 - e, frac(o.power, 0)), r = Math.min(1 - e - p, frac(o.other, 0));
            return { e: e, p: p, r: r, total: e + p + r };
        }
        function bars(st, w, full, bottom, energyColor) {
            var b = function (part, color) { return rect(-w / 2, bottom - full * part, w, full * part, color); };
            return (st.r ? b(st.total, WHITE) : '') + (st.p ? b(st.e + st.p, POWER) : '') + b(st.e, energyColor || ENERGY);
        }

        var draw = {
            // creep.metadata.js + creepBuildBody.js
            creep: function (o) {
                var angle = +o.angle || 0, main, light, count = {}, order = [], tough = false, front = 0, back = Math.PI, carry = frac(o.carry, 0);
                if (o.owner === 'npc' || o.npc) return { main: spin(angle, spr('creep-npc', 100, 100)), light: glow(100, 0.5) + glow(400, 0.2), z: 6 };
                main = disc(50, 0x202020);
                bodyOf(o.body === undefined ? 'M' : o.body).forEach(function (p) {
                    if (p === 'T') tough = true;
                    if (p === 'T' || p === 'C') return;                   // neither is drawn as an arc
                    if (!count[p]) { count[p] = 0; order.push(p); }
                    count[p]++;
                });
                order.map(function (p, i) { return { p: p, i: i }; }).sort(function (a, b) { return count[a.p] - count[b.p] || a.i - b.i; }).forEach(function (e) {
                    // the fewest parts first; MOVE grows from the back, the rest from the front, each on both sides.
                    // The renderer gives the stroke the colour of the part and tints the shape with it once more.
                    var part = PARTS[e.p], color = mulc(part.color, part.color), ang = PART_ANGLE * count[e.p], start = part.back ? back : front, up = -Math.PI / 2;
                    if (start === (part.back ? Math.PI : 0)) main += arc(41, up + start - ang, up + start + ang, color, 18);
                    else main += arc(41, up + start, up + start + ang, color, 18) + arc(41, up - start - ang, up - start, color, 18);
                    if (part.back) back += ang; else front += ang;
                });
                if (tough) main += spr('tough', 120, 120);
                main += disc(32, 0x000000) + disc(26, OWNER[ownerOf(o)]);
                if (carry) main += disc(20 * carry, o.carryKind === undefined || o.carryKind === 'energy' ? ENERGY : o.carryKind === 'power' ? POWER : WHITE);
                light = '<circle r="50" fill="url(#ga-creep-mask)"' + SCREEN + '/>' + glow(400, 0.2);
                return { main: spin(angle, main), light: light, z: 6 };
            },
            // powerCreep.metadata.js; only operators exist in the game. The badge image sits low, in the ring of the texture.
            powerCreep: function (o) {
                var level = o.level === undefined ? 25 : +o.level, name = 'operator-lvl' + Math.min(4, Math.max(0, Math.ceil(level / 6))), angle = +o.angle || 0;
                return {
                    main: spin(angle, spr(name, 180, 180, { tint: 0xcc3d3e }) + '<circle cy="16.5" r="31.5" fill="' + hex(OWNER[ownerOf(o)]) + '"/>'),
                    light: spin(angle, spr(name, 180, 180, { blend: SCREEN })) + glow(400, 1, 0xff5555), z: 13
                };
            },
            source: function (o) {
                var size = 60 * (o.empty ? 0 : frac(o.fill, 1));
                return {
                    main: '<rect x="-20" y="-20" width="40" height="40" rx="15" fill="' + hex(mulc(0x111111, 0x595026)) + '" stroke="#595026" stroke-width="15"/>' +
                        rect(-size / 2, -size / 2, size, size, ENERGY, ' rx="' + num(Math.min(15, size / 2)) + '"'),
                    light: glow(800, 0.5, 0xffff50) + (size ? glow(150) : ''), z: 2
                };
            },
            mineral: function (o) {
                var kind = o.kind === undefined ? 'H' : String(o.kind), c = MINERALS[kind];
                if (!c) throw new Error('gameart: mineral "' + kind + '" (H, O, U, L, K, Z or X)');
                return {
                    main: '<circle r="54" fill="' + hex(c[1]) + '" stroke="' + hex(c[0]) + '" stroke-width="10"/>' +
                        '<text y="28" text-anchor="middle" fill="' + hex(c[0]) + '" style="font:bold 82px Roboto,Arial,Helvetica,sans-serif">' + kind + '</text>',
                    light: glow(200) + glow(700, 0.7, c[0]), z: 2
                };
            },
            deposit: function (o) {
                var kind = o.kind === undefined ? 'silicon' : String(o.kind), c = DEPOSITS[kind];
                if (!c) throw new Error('gameart: deposit "' + kind + '" (silicon, metal, biomass or mist)');
                return {
                    main: spr('deposit-' + kind + '-fill', 160, 160, { tint: c, alpha: Math.max(0, 0.6 - frac(o.harvested, 0)) }) + spr('deposit-' + kind, 160, 160, { tint: c }),
                    light: spr('deposit-' + kind, 160, 160, { blend: SCREEN }) + glow(700, 1, c), z: 1
                };
            },
            controller: function (o) {
                var level = Math.max(0, Math.min(8, Math.round(+o.level || 0))), who = ownerOf(o, level ? 'me' : 'none'), i, main;
                main = disc(92, WHITE, ' opacity=".05"') + spr('controller', 200, 200, { tint: 0x000000 });
                for (i = 0; i < level; i++) main += spr('controller-level', 100, 100, { ay: 1, rot: i * 45 });
                main += disc(37, who === 'none' ? 0x222222 : OWNER[who]) +       // userBadge: a badge image, or 0x222222 when nobody owns it
                    pie(37, frac(o.progress, 0), WHITE, ' opacity=".8"') +
                    '<circle r="40" fill="none" stroke="#000" stroke-width="10"/>';
                return { main: main, light: glow(1200, 0.5) + (who === 'none' ? '' : glow(500)), z: 4 };
            },
            spawn: function (o) {
                var e = frac(o.fill, 1), s = frac(o.spawning, 0);
                return {
                    main: disc(70, 0xcccccc) + disc(59, 0x181818) + disc(38, OWNER[ownerOf(o)]) +
                        arc(50, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * s, 0xcccccc, 10) + disc(38 * e, ENERGY),
                    light: (e ? glow(100) : '') + glow(600, 0.5), z: 8
                };
            },
            extension: function (o) {
                var cap = o.size === undefined ? 50 : +o.size, size = cap >= 200 ? 100 : cap >= 100 ? 80 : 68, e = frac(o.fill, 1);
                return {
                    main: spr('extension-border' + (cap >= 200 ? 200 : cap >= 100 ? 100 : 50), 100, 100, { tint: OWNER[ownerOf(o)] }) + spr('extension', size, size) + disc(0.32 * size * e, ENERGY),
                    light: e ? glow(100) + glow(cap >= 200 ? 250 : cap >= 100 ? 220 : 200, 0.7) : '', z: 7
                };
            },
            // The turret is a child of nothing but itself: it turns about a point 32 units under its top edge, and its
            // energy bar is drawn in the pixels of the 128 px texture, which the sprite shows 115 units wide.
            tower: function (o) {
                var e = frac(o.fill, 1), k = 115 / assets['tower-rotatable'].w, bar = Math.min(66.7 * e, 66.7);
                return {
                    main: spr('tower-base', 200, 200, { tint: OWNER[ownerOf(o)] }) +
                        '<g transform="rotate(' + num((+o.angle || 0) + 180) + ')">' + spr('tower-rotatable', 115, 115, { py: 32 }) +
                        rect(-45 * k, -32, 90 * k, bar * k, ENERGY, ' rx="' + num(Math.min(12, bar / 2) * k) + '"') + '</g>',
                    light: (e ? glow(100) : '') + glow(600, 0.5), z: 13
                };
            },
            storage: function (o) {
                var st = store(o, 0.6);
                return {
                    main: spr('storage-border', 200, 200, { tint: OWNER[ownerOf(o)] }) + spr('storage', 200, 200) + bars(st, 110, 140, 70),
                    light: (st.total ? glow(200) : '') + glow(800, 0.5), z: 7
                };
            },
            terminal: function (o) {
                var st = store(o, 0.5), sq = function (part, color) { var s = Math.min(76, 76 * part); return rect(-s / 2, -s / 2, s, s, color); };
                return {
                    main: spr('terminal-border', 200, 200, { tint: OWNER[ownerOf(o)] }) + spr('terminal', 200, 200) + spr('terminal-arrows', 200, 200) +
                        (st.r ? sq(st.total, WHITE) : '') + (st.p ? sq(st.e + st.p, POWER) : '') + sq(st.e, ENERGY),
                    light: (st.total ? glow(200) : '') + glow(800, 0.5), z: 16
                };
            },
            container: function (o) {
                var st = store(o, 0.5);
                return { main: rect(-30, -35, 60, 70, 0x181818) + rect(-20, -25, 40, 50, 0x555555) + bars(st, 40, 50, 25), light: st.total ? glow(100) : '', z: 4 };
            },
            link: function (o) {
                var e = frac(o.fill, 1);
                return {
                    main: spr('link-border', 100, 100, { tint: OWNER[ownerOf(o)] }) + spr('link', 100, 100) + (e ? spr('link-energy', 50 * e, 50 * e) : ''),
                    light: e ? glow(100) + glow(400, 0.5) : '', z: 9
                };
            },
            // The mineral is one white shape whatever it is, growing from the bottom of a grey copy of itself.
            lab: function (o) {
                var m = o.empty ? 0 : frac(o.fill, 1), e = frac(o.energy, 1), size = 0.6875 * assets['lab-mineral'].w;
                return {
                    main: spr('lab', 200, null, { tint: OWNER[ownerOf(o)] }) + spr('lab-mineral', size, size, { ay: 1, y: 25, tint: 0x777777 }) +
                        (m ? spr('lab-mineral', size * m, size * m, { ay: 1, y: 25, tint: WHITE }) : '') + rect(-67 * e / 2, 32, 67 * e, 10, ENERGY),
                    light: m ? glow(150) + glow(500, 0.3) : '', z: 15
                };
            },
            factory: function (o) {
                var st = store(o, 0), level = Math.max(0, Math.min(5, Math.round(+o.level || 0)));
                return {
                    main: spr('factory-border', 200, 200, { tint: OWNER[ownerOf(o)] }) + spr('factory', 200, 200) + spr('factory-highlight', 200, 200, { alpha: 0.4 }) +
                        spr('factory-lvl0', 200, 200) + (level ? spr('factory-lvl' + level, 200, 200) : '') + rect(-25, -25, 50, 50, 0x555555) + bars(st, 50, 50, 25, 0xfadf7e),
                    light: (st.total ? glow(200) : '') + glow(800, 0.5), z: 7
                };
            },
            nuker: function (o) {
                var e = frac(o.fill, 1), g = frac(o.g, e), w = 86 * e, h = 118 * e;
                return {
                    main: spr('nuker-border', 300, 300, { y: -40, tint: OWNER[ownerOf(o)] }) + spr('nuker', 300, 300, { y: -40 }) +
                        (e ? '<path d="M' + num(-w / 2) + ' 10L0 ' + num(10 - h) + 'L' + num(w / 2) + ' 10z" fill="' + hex(ENERGY) + '"/>' : '') + rect(-80 * g / 2, 35, 80 * g, 15, WHITE),
                    light: glow(100) + glow(800, 0.5), z: 7
                };
            },
            // The eye wanders over four places; it is shown on the first of them.
            observer: function (o) {
                var c = hex(OWNER[ownerOf(o)]);
                return {
                    main: '<ellipse rx="45" ry="40" fill="#111" stroke="' + c + '" stroke-width="5"/><circle cx="20" r="20" fill="' + c + '"/>',
                    light: glow(800, 0.5), z: 10
                };
            },
            powerSpawn: function (o) {
                var e = frac(o.fill, 1), p = frac(o.power, e);
                return {
                    main: '<circle r="75" fill="#222" stroke="#ccc" stroke-width="7"/><circle r="68" fill="#222" stroke="' + hex(POWER) + '" stroke-width="10"/>' + disc(59, 0x181818) +
                        disc(38, OWNER[ownerOf(o)]) + arc(50, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * p, POWER, 10) + disc(38 * e, ENERGY),
                    light: glow(150) + glow(256, 0.5), z: 12                                // the second glow has no size: the texture is 256 px
                };
            },
            extractor: function (o) { return { main: spr('extractor', 200, null, { tint: OWNER[ownerOf(o)] }), light: '', z: 0 }; },
            // A rampart that is not public is not an object for the renderer: terrain.js draws all of one player as one shape
            // on the effects layer (A.ramparts). This is that shape for a single tile. A public one is only a cross.
            rampart: function (o) {
                var who = ownerOf(o);
                if (o['public']) return { main: '', light: '', fx: spr('rampart', 100, 100, { tint: OWNER[who], alpha: 0.5 }), z: 0 };
                return { main: '', light: '', fx: A.ramparts([[0, 0]], { owner: who, at: [-50, -50] }), z: 0 };
            },
            // constructedWall: terrain.js draws it as a piece of wall, joined to the walls around it; the object adds two light lines.
            wall: function (o) {
                var lines = spr('constructedWall', 100, 100, { blend: ADD });
                if (o.merged) return { main: lines, light: '', z: 0 };
                return {
                    main: '<circle r="50" fill="' + hex(WALL) + '" stroke="#000" stroke-width="10" paint-order="stroke"/>' + lines,
                    light: '<circle r="50" fill="#000" filter="url(#ga-wall-shadow)"/><circle r="50" fill="' + hex(AMBIENT) + '"' + SCREEN + '/>', z: 0
                };
            },
            road: function (o) { return { main: A.road(o.neighbours), light: '', z: -1 }; },
            // constructionSite.metadata.js + siteProgress.js, on the effects layer; it blinks between 0.8 and 0.3
            site: function (o) {
                var c = OWNER[ownerOf(o)];
                return { main: '', light: '', fx: '<g opacity=".8"><circle r="25" fill="none" stroke="' + hex(c) + '" stroke-width="10"/>' + pie(20, frac(o.progress, 0), c) + '</g>', z: 18 };
            },
            // energy.metadata.js + resourceCircle.js: a pile grows up to 1250 units; it is drawn on the lighting layer too
            energy: function (o) {
                var c = disc(30 * (o.amount !== undefined ? frac(o.amount / 1250, 0) : o.big ? 1 : 0.5), ENERGY);
                return { main: c, light: c.replace('/>', SCREEN + '/>'), z: 1 };
            },
            resource: function (o) {
                var part = o.amount !== undefined ? frac(o.amount / 1250, 0) : o.big ? 1 : 0.5, c;
                if (o.kind === 'energy') return draw.energy(o);
                c = disc(45 * part, o.kind === 'power' ? POWER : WHITE);
                return { main: c, light: c.replace('/>', SCREEN + '/>'), z: 1 };
            },
            tombstone: function (o) { return grave('tombstone-border', o); },
            ruin: function (o) { return grave('ruin', o); },
            // flag.metadata.js with userFlagColor: both parts in the flag's own colours, on the effects layer
            flag: function (o) {
                var c = flagColor(o.color, FLAGS[10]);
                return { main: '', light: '', fx: spr('flag', 200, 200, { tint: c }) + spr('flag-secondary', 200, 200, { tint: flagColor(o.secondary, c) }), z: 0 };
            },
            // Two discs swell and fade over a third; shown one second in: the light one at full size, the dark one at 0.3.
            portal: function () {
                return { main: disc(45, 0x111133, ' opacity=".5"') + disc(40, 0x61c0ed, ' opacity=".5"') + disc(12, 0x111133, ' opacity=".5"'), light: glow(700, 0.7, 0x9999ff) + glow(150, 1, 0x7777ff), z: 3 };
            },
            keeperLair: function () {
                return { main: disc(60, 0x000000) + disc(50, 0x780207) + disc(15, 0x000000), light: glow(800, 0.5, 0xff0000) + glow(150), z: 3 };
            },
            invaderCore: function (o) {
                return { main: spr('invaderCore', 200, 200) + pie(23, frac(o.ttl, 1), 0xff0d39), light: glow(100) + glow(800, 1, 0xff8080), z: 17 };
            },
            powerBank: function (o) {
                var r = Math.sqrt(frac(o.fill, 1) * 3000 / Math.PI);
                return { main: spr('powerBank', 200, 200) + (r ? '<circle r="' + num(r) + '" fill="' + hex(POWER) + '" stroke="#8d000d" stroke-width="10"/>' : ''), light: glow(800, 1, 0xff8080), z: 11 };
            },
            // nuke.metadata.js before landing, all on the effects layer: the cross-hair twice (the second one screened; its
            // blur of 2 is left out) and a red disc added over it; the red ring that closes in is left out.
            nuke: function () {
                return { main: '', light: glow(700, 1, 0xff4444), fx: spr('nuke', 260, 260, { alpha: 0.7 }) + spr('nuke', 260, 260, { blend: SCREEN }) + '<circle r="110" fill="#f22" opacity=".5"' + ADD + '/>', z: 0 };
            }
        };
        // tombstone.metadata.js and ruin.metadata.js: an outline added to what is under it, a cross in the owner's colour
        // (black when nothing is left inside), and the cross once more on the lighting layer
        function grave(border, o) {
            return {
                main: spr(border, 100, 100, { alpha: 1 - frac(o.decay, 0), blend: ADD }) + spr('tombstone-resource', 100, 100, { tint: o.empty ? 0x000000 : OWNER[ownerOf(o)], alpha: 0.8 }),
                light: spr('tombstone-resource', 100, 100, { blend: SCREEN }), z: 5
            };
        }

        var A = {
            kinds: KINDS.slice(),
            colors: {
                // as drawn, before the light: what A.terrain fills with
                ground: hex(GROUND), wall: hex(WALL), swamp: hex(SWAMP), swampEdge: hex(SWAMP_EDGE), road: hex(ROAD), ambient: hex(AMBIENT),
                // as seen on the page with no glow near (colour times the ambient light)
                groundLit: hex(mulc(GROUND, AMBIENT)), wallLit: hex(mulc(WALL, AMBIENT)), swampLit: hex(mulc(SWAMP, AMBIENT)), roadLit: hex(mulc(ROAD, AMBIENT)),
                energy: hex(ENERGY), power: hex(POWER), me: hex(OWNER.me), foe: hex(OWNER.foe), none: hex(OWNER.none)
            },
            partColors: (function () { var out = {}, k; for (k in PARTS) out[k] = hex(mulc(PARTS[k].color, PARTS[k].color)); return out; }()),

            defs: function (inner) {
                var s = '<defs>';
                Object.keys(assets).forEach(function (n) {
                    var body = assets[n].body;
                    // PIXI multiplies a tinted texture by the tint. White becomes the colour of the <use>, a grey that share of it.
                    if (tinted[n]) body = body.replace(/(fill|stroke)="#([0-9a-f]{3}|[0-9a-f]{6})"/g, function (m, prop, c) {
                        if (c.length === 3) c = c.replace(/./g, '$&$&');
                        var r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16), grey = (r + g + b) / 3;
                        if (Math.max(r, g, b) - Math.min(r, g, b) > 4) throw new Error('gameart: texture "' + n + '" is tinted but has the colour #' + c);
                        return grey > 252 ? prop + '="currentColor"' : grey < 3 ? m : prop + '="color-mix(in srgb,currentColor ' + num(grey / 2.55) + '%,#000)"';
                    });
                    s += '<symbol id="ga-' + n + '" viewBox="' + assets[n].viewBox + '" preserveAspectRatio="none">' + body + '</symbol>';
                });
                // glow.png: white, alpha 1 in the middle, falling in a straight line to 0 at 0.98 of the radius
                [WHITE].concat(GLOWS).forEach(function (c) {
                    s += '<radialGradient id="ga-glow' + (c === WHITE ? '' : '-' + hex6(c)) + '"><stop stop-color="' + hex(c) + '"/><stop offset=".98" stop-color="' + hex(c) + '" stop-opacity="0"/></radialGradient>';
                });
                // creep-mask.png: a white disc with a soft rim
                s += '<radialGradient id="ga-creep-mask"><stop offset=".8" stop-color="#fff"/><stop offset=".85" stop-color="#fff" stop-opacity=".86"/><stop offset=".9" stop-color="#fff" stop-opacity=".57"/>' +
                    '<stop offset=".95" stop-color="#fff" stop-opacity=".24"/><stop offset="1" stop-color="#fff" stop-opacity=".03"/></radialGradient>';
                // terrain.js: the shadow of the walls, BlurFilter(0.006 * width of the room) = strength 30 units, 4 passes of a 5 tap kernel
                s += '<filter id="ga-wall-shadow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="19"/></filter></defs>';
                return inner ? s : '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + s + '</svg>';
            },

            draw: function (kind, opts) {
                if (!draw.hasOwnProperty(kind)) throw new Error('gameart: unknown kind "' + kind + '"');
                var r = draw[kind](opts || {});
                return { main: r.main, light: r.light || '', fx: r.fx || '', z: r.z };
            },

            // road.js: a dot, and a band to each neighbour that is a road. As in the renderer a tile draws the bands to
            // its W, NW, N and NE neighbours only; the other four are drawn by those tiles.
            // neighbours: [N, NE, E, SE, S, SW, W, NW] (the order of the direction constants), or {n, ne, e, se, s, sw, w, nw}.
            road: function (neighbours) {
                var nb = neighbours || {}, r = 15, rb = r * Math.sin(Math.PI / 4), l = 100, d = '', c = hex(ROAD);
                var is = function (i, k) { return !!(Array.isArray(nb) ? nb[i] : nb[k]); };
                // all bands go into one path, so all are wound the same way: where two of them overlap nothing may cancel out
                var p = function (pts) {
                    var area = 0, i;
                    for (i = 0; i < pts.length; i++) area += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1];
                    if (area < 0) pts.reverse();
                    return 'M' + pts.map(function (q) { return num(q[0]) + ' ' + num(q[1]); }).join('L') + 'z';
                };
                if (is(7, 'nw')) d += p([[rb, -rb], [-rb, rb], [-rb - l, rb - l], [rb - l, -rb - l]]);
                if (is(0, 'n')) d += p([[r, 0], [-r, 0], [-r, -l], [r, -l]]);
                if (is(1, 'ne')) d += p([[-rb, -rb], [rb, rb], [rb + l, rb - l], [-rb + l, -rb - l]]);
                if (is(6, 'w')) d += p([[0, r], [0, -r], [-l, -r], [-l, r]]);
                return '<circle r="' + r + '" fill="' + c + '"/>' + (d ? '<path d="' + d + '" fill="' + c + '"/>' : '');
            },

            // terrain.js. rows: strings of '.' plain, '~' swamp, '#' wall, 'x' exit (drawn as plain; exits are the caller's).
            // The edge of the grid counts as the edge of a room: walls and swamps that reach it end square, as if they
            // went on. {open: true} rounds them there instead.
            // The renderer lays the textures ground.png, ground-mask.png and noise over the floor and the walls and an
            // animated noise over the swamp. Here each is one flat colour, the average of what the renderer shows:
            //   ground  0x555555 (the two ground textures change the average by less than 1/255)
            //   wall    fill #111 plus noise1 at 0.2 added (average 26) = #2b2b2b, outlined 10 wide in black, outside half visible
            //   swamp   #4a501e at alpha 0.4 over the ground, reaching 25 past the tiles (a stroke of 50) = #51533f,
            //           and on the tiles themselves two layers of green noise added (average +9, +23, +0) = #5a6a3f
            terrain: function (rows, opts) {
                var g = gridOf(rows), pad = opts && opts.open ? 1 : 0, s, d;
                s = '<rect width="' + g.W * 100 + '" height="' + g.H * 100 + '" fill="' + hex(GROUND) + '"/>';
                d = outline(g.W, g.H, function (x, y) { return g.at(x, y) === '~'; }, pad);
                if (d) s += '<path d="' + d + '" fill="' + hex(SWAMP) + '" stroke="' + hex(SWAMP_EDGE) + '" stroke-width="50" paint-order="stroke"/>';
                d = outline(g.W, g.H, function (x, y) { return g.at(x, y) === '#'; }, pad);
                if (d) s += '<path d="' + d + '" fill="' + hex(WALL) + '" stroke="#000" stroke-width="10" paint-order="stroke"/>';
                return s;
            },
            // What terrain.js puts on the lighting layer: a blurred black copy of the walls (the ground is darker next to a
            // wall) and the walls themselves in the ambient grey (inside they are never darker than that).
            terrainLight: function (rows, opts) {
                var g = gridOf(rows), d = outline(g.W, g.H, function (x, y) { return g.at(x, y) === '#'; }, opts && opts.open ? 1 : 0);
                return d ? '<path d="' + d + '" fill="#000" filter="url(#ga-wall-shadow)"/><path d="' + d + '" fill="' + hex(AMBIENT) + '"' + SCREEN + '/>' : '';
            },
            // terrain.js, ramparts: all tiles of one player as one shape, added (alpha 0.4) on the effects layer.
            // tiles: [[x, y], ...]; opts.owner; the markup is in tile units like A.terrain (opts.at moves its origin).
            ramparts: function (tiles, opts) {
                var set = {}, W = 0, H = 0, o = opts || {}, mine = ownerOf(o) === 'me', d;
                (tiles || []).forEach(function (t) { set[t[0] + ',' + t[1]] = true; if (t[0] + 1 > W) W = t[0] + 1; if (t[1] + 1 > H) H = t[1] + 1; });
                d = outline(W, H, function (x, y) { return set[x + ',' + y]; }, 1);
                if (!d) return '';
                return '<path d="' + d + '"' + (o.at ? ' transform="translate(' + num(o.at[0]) + ' ' + num(o.at[1]) + ')"' : '') +
                    ' fill="' + (mine ? '#105010' : '#501010') + '" stroke="' + (mine ? '#44ff44' : '#ff4444') + '" stroke-width="25" paint-order="stroke" opacity=".4"' + ADD + '/>';
            },

            lit: function (w, h, lights) {
                return '<g style="mix-blend-mode:multiply"><rect width="' + num(w) + '" height="' + num(h) + '" fill="' + hex(AMBIENT) + '"/>' + (lights || '') + '</g>';
            },

            // A whole drawing. spec: {terrain: rows, size: [tiles wide, tiles high] (default: that of the rows), open,
            //   things: [{is: kind, at: [x, y] or a list of them, dim, scale, ...options of the kind}]}
            // Roads are joined, ramparts of one owner are joined, walls are joined to the terrain. A thing with `dim`
            // (true, or an opacity) is drawn faint and gives no light; `scale` draws it larger or smaller.
            // Returns one nested <svg> of size*100 units: put it in an <svg viewBox="0 0 W*100 H*100">, or in a
            // <g transform="scale(T / 100)"> for tiles of T units, and draw labels and arrows after it.
            scene: function (spec) {
                var g = gridOf(spec.terrain), W = spec.size ? spec.size[0] : g.W, H = spec.size ? spec.size[1] : g.H, rows = [], x, y, row;
                var list = [], roads = {}, ramps = {}, walls = {}, main = '', light = '', fx = '', open = { open: !!spec.open };
                (spec.things || []).forEach(function (t) {
                    (Array.isArray(t.at[0]) ? t.at : [t.at]).forEach(function (p) {
                        var kind = t.is || t.kind;
                        if (kind === 'road') roads[p[0] + ',' + p[1]] = true;
                        if (kind === 'wall' && t.merged !== false && !t.dim) walls[p[0] + ',' + p[1]] = true;
                        list.push({ kind: kind, x: p[0], y: p[1], o: t });
                    });
                });
                for (y = 0; y < H; y++) { row = ''; for (x = 0; x < W; x++) row += walls[x + ',' + y] ? '#' : g.at(x, y) || '.'; rows.push(row); }
                list.forEach(function (it, i) {
                    var o = it.o, at = 'translate(' + (it.x * 100 + 50) + ' ' + (it.y * 100 + 50) + ')' + (o.scale && +o.scale !== 1 ? ' scale(' + num(+o.scale) + ')' : ''), r, key, dim = o.dim ? (o.dim === true ? 0.4 : +o.dim) : 0;
                    var put = function (s) { return s ? '<g transform="' + at + '"' + (dim ? op(dim) : '') + '>' + s + '</g>' : ''; };
                    if (it.kind === 'road') {
                        r = { main: A.road([[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].map(function (d) { return roads[(it.x + d[0]) + ',' + (it.y + d[1])]; })), light: '', fx: '', z: -1 };
                    } else if (it.kind === 'rampart' && !o['public'] && !dim) {
                        key = ownerOf(o);
                        (ramps[key] = ramps[key] || []).push([it.x, it.y]);
                        return;
                    } else if (it.kind === 'wall' && walls[it.x + ',' + it.y]) {
                        r = A.draw('wall', { merged: true });
                    } else r = A.draw(it.kind, o);
                    it.i = i; it.z = r.z; it.main = put(r.main); it.light = dim ? '' : put(r.light); it.fx = put(r.fx);
                });
                list = list.filter(function (it) { return it.z !== undefined; }).sort(function (a, b) { return a.z - b.z || a.i - b.i; });
                list.forEach(function (it) { main += it.main; light += it.light; fx += it.fx; });
                Object.keys(ramps).forEach(function (who) { fx = A.ramparts(ramps[who], { owner: who }) + fx; });
                return '<svg x="0" y="0" width="' + W * 100 + '" height="' + H * 100 + '" overflow="hidden" style="isolation:isolate;fill:#000;stroke:none;stroke-width:1">' +
                    A.terrain(rows, open) + main + A.lit(W * 100, H * 100, A.terrainLight(rows, open) + light) + fx + '</svg>';
            }
        };
        return A;
    }

    return { create: create };
}));
