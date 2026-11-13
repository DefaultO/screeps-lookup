'use strict';
/*
 * Figures of the runtime pack: how the code runs, intents, pathfinding, visibility, the event log,
 * find and look, and the API around them. Format: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 *
 * Numbers that are not game constants (0.2 CPU per intent, the path costs 1/5 and 2/10/1, reusePath 5)
 * are fixed in the engine and driver code. Each is stated, with its source, in the text of the entry
 * the figure belongs to.
 *
 * Paths are not drawn by hand: walk() finds the cheapest way over the terrain of the scene, so a drawing
 * cannot show a path that the costs do not give. Where two ways cost the same and one reads better,
 * sameAs() takes the chosen one only if it is as cheap as the one walk() found.
 */
module.exports = (C, h) => {
    const { n, seq } = h;

    // ---------------------------------------------------------------- numbers from the entry texts
    const FEE = 0.2;                                  // CPU per queued intent (mechanic:intents)
    const SEARCH = { plain: 1, swamp: 5 };            // defaults of PathFinder.search (mechanic:pathfinding)
    const WRAP = { plain: 2, swamp: 10, road: 1 };    // what findPath, moveTo and findClosestByPath search with
    const BLOCKED = 255;                              // cost matrix value of a blocked tile
    const REUSE = 5;                                  // default reusePath of moveTo

    // ---------------------------------------------------------------- helpers
    const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));   // range, as the game measures it
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    const has = (list, p) => list.some(q => same(q, p));

    // Cheapest way over a small grid, counted the way the pathfinder counts: entering a tile costs
    // cost(x, y) (Infinity = blocked) and all eight steps cost the same. Returns the tiles from the
    // start to the first goal tile reached, and the cost of the way.
    const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    function walk(w, hh, cost, from, isGoal) {
        const id = p => p[1] * w + p[0], best = { [id(from)]: 0 }, prev = {}, closed = {}, open = [from];
        while (open.length) {
            open.sort((a, b) => best[id(a)] - best[id(b)]);
            const cur = open.shift();
            if (closed[id(cur)]) continue;
            closed[id(cur)] = true;
            if (isGoal(cur[0], cur[1])) {
                const path = [cur];
                while (prev[id(path[0])]) path.unshift(prev[id(path[0])]);
                return { path, cost: best[id(cur)], steps: path.length - 1 };
            }
            for (const s of STEPS) {
                const nx = [cur[0] + s[0], cur[1] + s[1]];
                if (nx[0] < 0 || nx[1] < 0 || nx[0] >= w || nx[1] >= hh) continue;
                const c = best[id(cur)] + cost(nx[0], nx[1]);
                if (c < (best[id(nx)] === undefined ? Infinity : best[id(nx)])) { best[id(nx)] = c; prev[id(nx)] = cur; open.push(nx); }
            }
        }
        throw new Error('runtime figures: a scene asks for a path that does not exist');
    }
    // cost of a tile from the terrain rows of a scene: # wall, ~ swamp, anything else plain
    const terrainCost = (terrain, costs, opt = {}) => (x, y) => {
        if (has(opt.blocked || [], [x, y])) return Infinity;
        if (has(opt.road || [], [x, y])) return costs.road;
        const ch = terrain[y].charAt(x);
        return ch === '#' ? Infinity : ch === '~' ? costs.swamp : costs.plain;
    };
    const sumCost = (via, cost) => via.slice(1).reduce((s, p) => s + cost(p[0], p[1]), 0);
    // Where two ways cost the same, a figure may pick the one that reads better. It must be a way of
    // single steps that ends on a goal tile and costs no more than the one walk() found.
    function sameAs(best, via, cost, isGoal) {
        const last = via[via.length - 1], stepsOk = via.every((q, i) => !i || cheb(q, via[i - 1]) === 1);
        if (!stepsOk || !isGoal(last[0], last[1]) || sumCost(via, cost) !== best.cost) throw new Error('runtime figures: a hand-picked path is not a cheapest one');
        return { path: via, cost: best.cost, steps: via.length - 1 };
    }

    // ---------------------------------------------------------------- computed scenes
    // mechanic:pathfinding: the same gap in a wall, with a creep standing in it
    const gap = (() => {
        const terrain = ['...#...', '.......', '...#...', '...#...', '.......'];
        const me = [1, 1], other = [3, 1], goal = [5, 1], at = (x, y) => same([x, y], goal);
        return {
            terrain, me, other, goal,
            blind: walk(7, 5, terrainCost(terrain, SEARCH), me, at),
            aware: walk(7, 5, terrainCost(terrain, WRAP, { blocked: [other] }), me, at),
        };
    })();
    // mechanic:pathfinding: a road beside a swamp
    const roadScene = (() => {
        const terrain = ['...~~~~...', '...~~~~...', '..........', '..........'];
        const road = seq(1, 8).map(x => [x, 2]), me = [0, 1], goal = [9, 1];
        const cost = terrainCost(terrain, WRAP, { road });
        const straight = seq(0, 9).map(x => [x, 1]);
        return { terrain, road, me, goal, best: walk(10, 4, cost, me, (x, y) => same([x, y], goal)), straight, straightCost: sumCost(straight, cost) };
    })();
    // mechanic:finding-and-looking: two sources, one of them behind a wall
    const near = (() => {
        const terrain = ['.......', '.......', '#####..', '.......', '.......'];
        const me = [1, 3], A = [1, 1], B = [5, 4];
        const cost = terrainCost(terrain, WRAP, { blocked: [A, B] });
        const beside = t => (x, y) => cheb([x, y], t) === 1, to = t => walk(7, 5, cost, me, beside(t));
        // to B along the bottom row, so that it does not hide the first steps of the way to A
        const toB = sameAs(to(B), [me, [2, 4], [3, 4], [4, 4]], cost, beside(B));
        return { terrain, me, A, B, toA: to(A), toB, rangeA: cheb(me, A), rangeB: cheb(me, B) };
    })();
    // RoomPosition.findClosestByPath: one search, every candidate a goal at range 1
    const closest = (() => {
        const terrain = ['...#......', '...#......', '...#......', '..........', '..........'];
        const me = [1, 1], A = [5, 1], B = [8, 3];
        const cost = terrainCost(terrain, WRAP, { blocked: [A, B] });
        return { terrain, me, A, B, way: walk(10, 5, cost, me, (x, y) => cheb([x, y], A) === 1 || cheb([x, y], B) === 1) };
    })();
    // PathFinder.search with flee: the first tile that is `range` away from the goal
    const flee = (() => {
        const range = 3, foe = [5, 2], me = [4, 2];
        return { range, foe, me, way: walk(9, 5, () => SEARCH.plain, me, (x, y) => cheb([x, y], foe) >= range) };
    })();
    // PathFinder.CostMatrix: a room and the matrix that findPath and moveTo build for it
    const matrix = (() => {
        const terrain = ['......', '..~~..', '......', '#.....'];
        const things = [
            { is: 'road', at: seq(0, 5).map(x => [x, 2]) },
            { is: 'extension', at: [[1, 0], [2, 0], [3, 0]] }, { is: 'spawn', at: [4, 0] },
            { is: 'container', at: [5, 3] }, { is: 'creep', at: [2, 3], body: 'WCM' },
        ];
        const value = (x, y) => {
            let v = 0;
            for (const t of things) for (const p of (Array.isArray(t.at[0]) ? t.at : [t.at])) if (same(p, [x, y])) {
                if (C.OBSTACLE_OBJECT_TYPES.includes(t.is)) v = BLOCKED; else if (t.is === 'road' && v !== BLOCKED) v = WRAP.road;
            }
            return v;
        };
        const marks = [];
        for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { const v = value(x, y); marks.push({ at: [x, y], tone: v === BLOCKED ? 'bad' : v ? 'good' : 'dim', text: v }); }
        return { terrain, things, marks };
    })();
    // RoomPosition.getDirectionTo: the engine's rule, tile by tile
    const dirOf = (dx, dy) => {
        const ax = Math.abs(dx), ay = Math.abs(dy);
        if (ax > ay * 2) return dx > 0 ? C.RIGHT : C.LEFT;
        if (ay > ax * 2) return dy > 0 ? C.BOTTOM : C.TOP;
        return dx > 0 ? (dy > 0 ? C.BOTTOM_RIGHT : C.TOP_RIGHT) : (dy > 0 ? C.BOTTOM_LEFT : C.TOP_LEFT);
    };
    const dirMarks = [];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) {
        if (x === 5 && y === 3) continue;
        const d = dirOf(x - 5, y - 3);
        dirMarks.push({ at: [x, y], tone: d % 2 ? 'accent' : 'warn', text: d });
    }
    // Room.lookAtArea: a 3 x 3 area with two structures in it
    const area = (() => {
        const tiles = []; for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) tiles.push([x, y]);
        const structures = [{ is: 'extension', at: [1, 1] }, { is: 'container', at: [3, 2] }];
        return { tiles, structures, terrain: ['.....', '..~~.', '..~~.', '.....', '.....'] };
    })();

    // Room.lookForAtArea: the rectangle of the example call; the grid is drawn one tile in for the axis labels
    const box = { top: 1, left: 2, bottom: 3, right: 5 };

    // a row of ticks as one-tick blocks: [[from, text, tone], ...]
    const blocks = (list, len = 1) => list.map(([from, text, tone]) => ({ from, to: from + len, text, tone }));
    // a timeline without numbers on its axis: lanes that are not to scale
    const noTicks = [];

    return {
        // ------------------------------------------------------------ mechanics
        'mechanic:code-execution': [
            {
                type: 'timeline', title: 'What lasts how long', span: 6, unit: 'ticks', ticks: seq(0, 6),
                caption: '`Game` is built new every tick. Global variables, the module cache and changed prototypes live until a global reset: new code, a full heap, the hard timeout, `Game.cpu.halt()`, 3 minutes without a run or a server restart. Memory and segments are not touched by it.',
                rows: [
                    { label: 'Game object', segs: blocks(seq(0, 5).map(t => [t, 'new', 'energy'])) },
                    { label: 'Global scope, modules', segs: [{ from: 0, to: 4, text: 'kept from tick to tick', tone: 'a' }, { from: 4, to: 6, text: 'starts empty', tone: 'a' }], marks: [{ at: 4, text: 'global reset', tone: 'bad', anchor: 'end' }] },
                    { label: 'Memory, segments', segs: [{ from: 0, to: 6, text: 'kept across the reset', tone: 'good' }] },
                ],
            },
            {
                type: 'flow', title: 'How a tick of your script can end', cell: [172, 56],
                caption: 'An uncaught error or the CPU limit ends the loop for this tick only: what was queued and written before it is saved. `Game.cpu.halt()`, a full heap and the hard timeout lose the whole tick and bring a global reset.',
                nodes: [
                    { id: 'end', at: [0, 0], text: 'Loop runs to its end' },
                    { id: 'err', at: [0, 1], text: 'Uncaught error', sub: 'or CPU limit reached' },
                    { id: 'kill', at: [0, 2], text: 'halt(), full heap', sub: 'or the hard timeout', tone: 'bad' },
                    { id: 'saved', at: [1, 0], text: 'Saved', sub: 'intents, Memory, segments', tone: 'good' },
                    { id: 'part', at: [1, 1], text: 'Saved up to that point', sub: 'intents queued before it', tone: 'good' },
                    { id: 'lost', at: [1, 2], text: 'Nothing is saved', sub: 'the whole tick is lost', tone: 'bad' },
                    { id: 'same', at: [2, 0], text: 'Next tick', sub: 'same isolate, globals kept' },
                    { id: 'new', at: [2, 2], text: 'Next tick', sub: 'new isolate, globals empty', tone: 'warn' },
                ],
                edges: [{ from: 'end', to: 'saved' }, { from: 'err', to: 'part' }, { from: 'kill', to: 'lost' }, { from: 'saved', to: 'same' }, { from: 'part', to: 'same' }, { from: 'lost', to: 'new' }],
            },
        ],
        'mechanic:intents': [
            {
                type: 'flow', title: 'From call to action', cell: [138, 56],
                caption: `A call that fails its checks returns an error code, queues nothing and pays no fee. OK means queued, at ${FEE} CPU: after all scripts have run the processor checks again and drops the intent without a word if the conditions no longer hold.`,
                nodes: [
                    { id: 'call', at: [0, 0], text: 'Method call', sub: 'checked at tick start' },
                    { id: 'ok', at: [1, 0], text: 'Returns OK', sub: `queued, +${FEE} CPU`, tone: 'energy' },
                    { id: 'proc', at: [2, 0], text: 'After all scripts', sub: 'checked once more' },
                    { id: 'done', at: [3, 0], text: 'Carried out', sub: 'seen next tick', tone: 'good' },
                    { id: 'err', at: [0, 1], text: 'Error code', sub: 'no intent, no fee', tone: 'bad' },
                    { id: 'drop', at: [2, 1], text: 'Dropped silently', sub: 'the fee stays spent', tone: 'warn' },
                ],
                edges: [{ from: 'call', to: 'ok' }, { from: 'ok', to: 'proc' }, { from: 'proc', to: 'done' }, { from: 'call', to: 'err', label: 'check fails' }, { from: 'proc', to: 'drop', label: 'no longer valid' }],
            },
            {
                type: 'scene', title: 'The same method twice: the last call wins', size: [10, 3],
                caption: `An action is stored per object and method name. The second transfer replaces the first, so only B gets energy, and the fee of ${FEE} CPU is charged once.`,
                things: [
                    { is: 'extension', at: [1, 0], fill: 0, label: 'A', labelAt: 'left' },
                    { is: 'spawn', at: [3, 0], fill: 0.3, label: 'B', labelAt: 'right' },
                    { is: 'creep', at: [2, 1], body: 'CCMM', carry: 0.8, label: 'creep', labelAt: 'bottom' },
                ],
                arrows: [{ from: [2, 1], to: [1, 0], tone: 'dim', dashed: true }, { from: [2, 1], to: [3, 0], tone: 'energy' }],
                notes: [
                    { at: [4.6, 0.25], text: ['1. creep.transfer(A): OK', '2. creep.transfer(B): OK'], anchor: 'start' },
                    { at: [4.6, 1.45], text: 'only the transfer to B happens', anchor: 'start', strong: true },
                ],
            },
        ],
        'mechanic:pathfinding': [
            {
                type: 'panels', title: 'What the search knows', wide: true,
                caption: 'By itself PathFinder.search knows terrain only, so it plans straight through a creep or a structure. findPath, findClosestByPath and moveTo hand it a cost matrix in which creeps and blocking structures are blocked.',
                panels: [
                    {
                        tag: 'PathFinder.search without a matrix', size: [7, 5], terrain: gap.terrain, note: `${gap.blind.steps} steps, through the other creep`,
                        things: [{ is: 'creep', at: gap.me, body: 'WCM' }, { is: 'creep', at: gap.other, body: 'CCMM', label: 'another creep', labelAt: 'top' }, { is: 'flag', at: gap.goal }],
                        paths: [{ via: gap.blind.path }],
                    },
                    {
                        tag: 'findPath, moveTo', size: [7, 5], terrain: gap.terrain, note: `${gap.aware.steps} steps, around the wall`,
                        things: [{ is: 'creep', at: gap.me, body: 'WCM' }, { is: 'creep', at: gap.other, body: 'CCMM', label: 'another creep', labelAt: 'top' }, { is: 'flag', at: gap.goal }],
                        marks: [{ at: gap.other, tone: 'bad' }],
                        paths: [{ via: gap.aware.path }],
                    },
                ],
            },
            {
                type: 'scene', title: 'Tile costs of findPath and moveTo', size: [10, 4], terrain: roadScene.terrain,
                caption: `A step costs what the tile it enters costs: plain ${WRAP.plain}, swamp ${WRAP.swamp}, road ${WRAP.road}. So the path takes the road. PathFinder.search by itself counts plain ${SEARCH.plain} and swamp ${SEARCH.swamp} and knows no roads.`,
                things: [{ is: 'road', at: roadScene.road }, { is: 'creep', at: roadScene.me, body: 'WCM' }, { is: 'flag', at: roadScene.goal }],
                paths: [
                    { via: roadScene.straight, tone: 'dim', dashed: true, label: `straight through the swamp: ${roadScene.straightCost}` },
                    { via: roadScene.best.path, label: `along the road: ${roadScene.best.cost}`, dy: 30 },
                ],
                notes: [
                    { at: [1.5, 0], text: `plain ${WRAP.plain}`, strong: true }, { at: [4.5, 0], text: `swamp ${WRAP.swamp}`, strong: true },
                    { at: [8, 3], text: `road ${WRAP.road}`, strong: true },
                ],
            },
        ],
        'mechanic:visibility': [
            {
                type: 'panels', title: 'What makes a room visible',
                caption: 'A creep, power creep or structure of yours shows the whole room, with everything in it. A flag or a construction site does not: the room stays hidden, though the flag and the site are still in `Game.flags` and `Game.constructionSites`.',
                panels: [
                    {
                        tag: 'Your creep is there: visible', tone: 'good', size: [5, 3], note: '`Game.rooms` holds the room',
                        things: [{ is: 'source', at: [0, 0] }, { is: 'creep', at: [2, 0], body: 'RRMM', foe: true, label: 'hostile', labelAt: 'right' }, { is: 'container', at: [4, 2] }, { is: 'creep', at: [1, 1], body: 'WCM', label: 'your creep' }],
                    },
                    {
                        tag: 'Only a flag and a site: hidden', tone: 'bad', size: [5, 3], note: '`Game.rooms[name]` is undefined',
                        things: [{ is: 'source', at: [0, 0], dim: true }, { is: 'creep', at: [2, 0], body: 'RRMM', foe: true, dim: true }, { is: 'container', at: [4, 2], dim: true }, { is: 'flag', at: [1, 1], label: 'your flag' }, { is: 'site', at: [3, 1], progress: 0.3, label: 'your site' }],
                    },
                ],
            },
            {
                type: 'timeline', title: 'Vision from an observer', span: 5, unit: 'ticks', ticks: seq(0, 5),
                caption: 'The room is visible in the tick after `observeRoom`, and for that tick only. A tick without a call leaves a tick without vision.',
                rows: [
                    { label: 'observeRoom called', segs: blocks([[0, 'call', 'energy'], [2, 'call', 'energy'], [3, 'call', 'energy']]) },
                    { label: 'Room in Game.rooms', segs: [{ from: 1, to: 2, text: 'visible', tone: 'good' }, { from: 3, to: 5, text: 'visible', tone: 'good' }] },
                ],
            },
        ],
        'mechanic:event-log': [
            {
                type: 'scene', title: 'One attack, two records', size: [11, 3],
                caption: 'A creep hit by `attack` strikes back with its own ATTACK parts. The log then holds two EVENT_ATTACK records with the two ids swapped; the second has the attackType EVENT_ATTACK_TYPE_HIT_BACK.',
                things: [{ is: 'creep', at: [0, 1], body: 'AAMM', label: 'A' }, { is: 'creep', at: [1, 1], body: 'TAAMM', foe: true, label: 'B' }],
                arrows: [{ from: [0, 0.8], to: [1, 0.8], tone: 'bad', gap: [0.36, 0.36] }, { from: [1, 1.2], to: [0, 1.2], tone: 'warn', gap: [0.36, 0.36] }],
                notes: [
                    { at: [2.1, 0.1], text: 'A attacks B', anchor: 'start', strong: true },
                    { at: [2.1, 0.45], text: 'objectId A, targetId B, EVENT_ATTACK_TYPE_MELEE', anchor: 'start' },
                    { at: [2.1, 1.35], text: 'B hits back', anchor: 'start', strong: true },
                    { at: [2.1, 1.7], text: 'objectId B, targetId A, EVENT_ATTACK_TYPE_HIT_BACK', anchor: 'start' },
                ],
            },
            {
                type: 'scene', title: 'EVENT_TRANSFER: objectId is the giver', size: [11, 3],
                caption: 'The record is written from the giving side. For a transfer the creep is the objectId; for a withdraw it is the structure or tombstone, and the creep is the targetId. Link transfers are logged the same way.',
                things: [
                    { is: 'creep', at: [2, 1], body: 'CCMM', carry: 0.9, label: 'objectId', labelAt: 'left' }, { is: 'spawn', at: [3, 1], fill: 0.3, label: 'targetId', labelAt: 'right' },
                    { is: 'container', at: [7, 1], fill: 0.8, label: 'objectId', labelAt: 'left' }, { is: 'creep', at: [8, 1], body: 'CCMM', label: 'targetId', labelAt: 'right' },
                ],
                arrows: [{ from: [2, 1], to: [3, 1], tone: 'energy' }, { from: [7, 1], to: [8, 1], tone: 'energy' }],
                notes: [{ at: [2.5, 0.1], text: 'creep.transfer(spawn)', strong: true }, { at: [7.5, 0.1], text: 'creep.withdraw(container)', strong: true }],
            },
        ],
        'mechanic:finding-and-looking': [
            {
                type: 'flow', title: 'Filled once, read many times', cell: [140, 56],
                caption: 'When the tick starts every visible object goes into the list of each FIND_* constant it belongs to and into an index by tile. `Room.find` hands out a copy of a list; a filter runs again on every call. `lookForAt` is one read in the index.',
                nodes: [
                    { id: 'start', at: [0, 0], text: 'Tick starts', sub: 'objects sorted once' },
                    { id: 'lists', at: [1, 0], text: 'List per FIND_*', sub: 'for each room' },
                    { id: 'find', at: [2, 0], text: 'Room.find', sub: 'a copy of the list' },
                    { id: 'filter', at: [3, 0], text: 'filter', sub: 'runs on every call', tone: 'warn' },
                    { id: 'index', at: [1, 1], text: 'Index by tile', sub: 'for each LOOK_*' },
                    { id: 'look', at: [2, 1], text: 'lookForAt', sub: 'one array read', tone: 'good' },
                ],
                edges: [{ from: 'start', to: 'lists' }, { from: 'start', to: 'index' }, { from: 'lists', to: 'find' }, { from: 'find', to: 'filter' }, { from: 'index', to: 'look' }],
            },
            {
                type: 'panels', title: 'Nearest by range, nearest by path', wide: true,
                caption: 'Range ignores the wall, so findClosestByRange returns source A. findClosestByPath runs a path search and returns B, because the way round the wall to A is longer. The search is what makes it cost far more.',
                panels: [
                    {
                        tag: 'findClosestByRange: source A', size: [7, 5], terrain: near.terrain,
                        ranges: [{ at: near.me, r: near.rangeA, label: 'range ' + near.rangeA, labelAt: 'br' }],
                        things: [{ is: 'source', at: near.A, label: 'A: range ' + near.rangeA, labelAt: 'right' }, { is: 'source', at: near.B, label: 'B: range ' + near.rangeB, labelAt: 'top' }, { is: 'creep', at: near.me, body: 'WCM' }],
                    },
                    {
                        tag: 'findClosestByPath: source B', size: [7, 5], terrain: near.terrain,
                        things: [{ is: 'source', at: near.A, label: 'A', labelAt: 'left' }, { is: 'source', at: near.B, label: 'B', labelAt: 'right' }, { is: 'creep', at: near.me, body: 'WCM' }],
                        paths: [{ via: near.toA.path, tone: 'dim', dashed: true, label: near.toA.steps + ' steps', dx: 30, dy: -2 }, { via: near.toB.path, label: near.toB.steps + ' steps' }],
                    },
                ],
            },
        ],

        // ------------------------------------------------------------ recipes
        'recipe:save-cpu': [
            {
                type: 'timeline', title: 'Spread the periodic work', span: 30, unit: 'Game.time', ticks: [0, 10, 20, 30],
                caption: 'A job that runs every 10 ticks in three rooms, as an example. With a different offset per room the three runs never land on the same tick.',
                rows: [
                    { label: 'Room 1: time % 10 == 0', segs: blocks([[0, '', 'a'], [10, '', 'a'], [20, '', 'a']]) },
                    { label: 'Room 2: time % 10 == 3', segs: blocks([[3, '', 'b'], [13, '', 'b'], [23, '', 'b']]) },
                    { label: 'Room 3: time % 10 == 6', segs: blocks([[6, '', 'c'], [16, '', 'c'], [26, '', 'c']]) },
                ],
            },
        ],
        'recipe:cache-between-ticks': [
            {
                type: 'flow', title: 'Read through the cache', cell: [186, 56],
                caption: 'The global scope can be empty on any tick, so every cached value needs its way back: take a saved copy from Memory or a segment if there is one, otherwise compute it again.',
                nodes: [
                    { id: 'q1', at: [0, 0], text: 'In the global cache?', sub: 'global or a module variable' },
                    { id: 'q2', at: [0, 1], text: 'Saved copy?', sub: 'in Memory or a segment' },
                    { id: 'make', at: [0, 2], text: 'Compute it again' },
                    { id: 'use', at: [1, 0], text: 'Use it', sub: 'costs nothing', tone: 'good' },
                    { id: 'load', at: [1, 1], text: 'Deserialize it', sub: 'cost matrix, path string', tone: 'accent' },
                    { id: 'keep', at: [1, 2], text: 'Put it into global', sub: 'for the next ticks', tone: 'accent' },
                ],
                edges: [{ from: 'q1', to: 'use', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' }, { from: 'q2', to: 'load', label: 'yes' }, { from: 'q2', to: 'make', label: 'no' }, { from: 'load', to: 'keep' }, { from: 'make', to: 'keep' }],
            },
        ],
        'recipe:travel-across-rooms': [
            {
                type: 'map', title: 'Rooms first, tiles second', cell: 46,
                caption: 'Game.map.findRoute picks the rooms; a routeCallback that returns Infinity keeps it out of a room. PathFinder.search then gets `false` from roomCallback for every room that is not on the route.',
                rows: ['rrrr.', 'sxxt.', '.....'],
                key: {
                    s: { label: 'start', tone: 'a' }, t: { label: 'target', tone: 'c' }, r: { label: 'on the route: searched', tone: 'a', weak: true },
                    x: { label: 'routeCallback returns Infinity', tone: 'b' }, '.': { label: 'not on the route: roomCallback returns false' },
                },
                marks: [{ at: [0, 1], text: 'start' }, { at: [3, 1], text: 'target' }],
            },
            {
                type: 'panels', title: 'On arrival, step off the exit tile',
                caption: 'A creep that ends a tick on an exit tile is moved to the neighbouring room. One that arrives and stays where it appeared goes straight back, so move one tile into the room before anything else.',
                panels: [
                    {
                        tag: 'Steps in: stays', tone: 'good', size: [6, 3], terrain: ['..xx..', '..xx..', '..xx..'],
                        things: [{ is: 'creep', at: [3, 1], body: 'WCM' }], arrows: [{ from: [3, 1], to: [4, 1], tone: 'good' }],
                        notes: [{ at: [0.5, 0], text: 'old room' }, { at: [4.5, 0], text: 'new room' }],
                    },
                    {
                        tag: 'Stays on the exit: sent back', tone: 'bad', size: [6, 3], terrain: ['..xx..', '..xx..', '..xx..'],
                        things: [{ is: 'creep', at: [3, 1], body: 'WCM' }], arrows: [{ from: [3, 1], to: [2, 1], tone: 'bad' }],
                        notes: [{ at: [0.5, 0], text: 'old room' }, { at: [4.5, 0], text: 'new room' }],
                    },
                ],
            },
        ],
        'recipe:measure-cpu': [
            {
                type: 'timeline', title: 'What the first reading of a tick shows', span: 10, ticks: noTicks,
                caption: 'A reading in the first line of the loop shows what loading the modules cost: a lot in the first tick after a global reset, close to 0 in any other. Leave that tick out of the averages. The Memory save after the loop is charged, but no reading can show it. Not to scale.',
                rows: [
                    { label: 'Tick after a reset', segs: [{ from: 0, to: 4, text: 'modules compile and load', tone: 'warn' }, { from: 4, to: 8, text: 'your loop', tone: 'energy' }, { from: 8, to: 10, text: 'Memory save', tone: 'dim' }], marks: [{ at: 4, text: 'first line of the loop', anchor: 'end' }] },
                    { label: 'Any other tick', segs: [{ from: 0, to: 4, text: 'your loop', tone: 'energy' }, { from: 4, to: 6, text: 'Memory save', tone: 'dim' }], marks: [{ at: 0, text: 'first line of the loop' }] },
                ],
            },
        ],
        'recipe:share-data-with-an-ally': [
            {
                type: 'flow', title: 'Two players, one segment', cell: [168, 56],
                caption: 'The sender writes a segment and puts its id on the public list. The reader asks for it by user name and id and finds it in `RawMemory.foreignSegment` from the next tick on, as long as the id stays public. The id 7 is an example.',
                nodes: [
                    { id: 'write', at: [0, 0], text: 'Sender writes', sub: 'RawMemory.segments[7]', tone: 'energy' },
                    { id: 'pub', at: [1, 0], text: 'setPublicSegments([7])', sub: 'once; the list stays' },
                    { id: 'stored', at: [2, 0], text: 'Saved at the tick end', sub: 'public segment 7' },
                    { id: 'ask', at: [0, 1], text: 'Reader asks', sub: 'setActiveForeignSegment', tone: 'accent' },
                    { id: 'read', at: [2, 1], text: 'foreignSegment', sub: '{username, id, data}', tone: 'good' },
                ],
                edges: [{ from: 'write', to: 'pub' }, { from: 'pub', to: 'stored' }, { from: 'ask', to: 'read', label: 'next tick' }, { from: 'stored', to: 'read', label: 'while 7 is public' }],
            },
            {
                type: 'timeline', title: 'Several allies: one per tick', span: 5, unit: 'ticks', ticks: seq(0, 5),
                caption: 'Only one foreign segment is loaded per tick, and it arrives one tick after the request. With several allies go through the list, one ally per tick.',
                rows: [
                    { label: 'You request', segs: blocks([[0, 'ally A', 'a'], [1, 'ally B', 'b'], [2, 'ally C', 'c'], [3, 'ally A', 'a'], [4, 'ally B', 'b']]) },
                    { label: 'foreignSegment holds', segs: blocks([[1, 'A', 'a'], [2, 'B', 'b'], [3, 'C', 'c'], [4, 'A', 'a']]) },
                ],
            },
        ],

        // ------------------------------------------------------------ movement and paths
        'Creep.moveTo': [{
            type: 'timeline', title: 'When moveTo searches', span: 25, unit: 'ticks since the first call', ticks: [0, 5, 10, 15, 20, 25],
            caption: `moveTo searches a path, stores it in the creep's memory and follows it for reusePath ticks before it searches again. The default is ${REUSE}; a higher value means fewer searches on a fixed route.`,
            rows: [
                { label: `reusePath ${REUSE} (default)`, segs: [].concat(...seq(0, 24, REUSE + 1).map(t => [{ from: t, to: t + 1, tone: 'warn' }].concat(t + 1 < 25 ? [{ from: t + 1, to: Math.min(25, t + 1 + REUSE), text: 'follows', tone: 'a' }] : []))), marks: seq(0, 24, REUSE + 1).map(t => ({ at: t, text: 'search' })) },
                { label: 'reusePath 20', segs: [{ from: 0, to: 1, tone: 'warn' }, { from: 1, to: 21, text: 'follows the stored path', tone: 'a' }, { from: 21, to: 22, tone: 'warn' }, { from: 22, to: 25, tone: 'a' }], marks: [{ at: 0, text: 'search' }, { at: 21, text: 'search', anchor: 'end' }] },
            ],
        }],
        'Creep.move': [{
            type: 'panels', title: 'Two creeps face to face',
            caption: 'Two creeps that move into each other\'s tiles swap. A creep that does not move is an obstacle: the move into its tile returns OK and then does nothing, so compare the position next tick.',
            panels: [
                {
                    tag: 'Both move: they swap', tone: 'good', size: [4, 3], note: 'A moves right, B moves left',
                    things: [{ is: 'creep', at: [1, 1], body: 'WCM', label: 'A' }, { is: 'creep', at: [2, 1], body: 'CCMM', label: 'B' }],
                    arrows: [{ from: [1, 0.8], to: [2, 0.8], gap: [0.36, 0.36] }, { from: [2, 1.2], to: [1, 1.2], gap: [0.36, 0.36] }],
                },
                {
                    tag: 'B stands still: A stays', tone: 'bad', size: [4, 3], note: 'A.move still returned OK',
                    things: [{ is: 'creep', at: [1, 1], body: 'WCM', label: 'A' }, { is: 'creep', at: [2, 1], body: 'CCMM', label: 'B' }],
                    arrows: [{ from: [1, 1], to: [2, 1], tone: 'bad', gap: [0.36, 0.36] }],
                },
            ],
        }],
        'Creep.moveByPath': [{
            type: 'scene', title: 'Where the creep must stand', size: [11, 4],
            caption: 'A creep on the path takes the next step, and one beside the first step moves onto it. From any other tile `moveByPath` returns ERR_NOT_FOUND. The numbers are the steps of a PathFinder.search path, which does not hold the start tile.',
            marks: [[3, 2], [4, 2], [5, 2], [6, 1], [7, 1], [8, 1]].map((p, i) => ({ at: p, tone: 'a', text: i === 2 ? undefined : i + 1 })),
            things: [
                { is: 'creep', at: [2, 2], body: 'WCM', label: ['beside step 1:', 'OK'] },
                { is: 'creep', at: [5, 2], body: 'WCM', label: 'on step 3: OK' },
                { is: 'creep', at: [5, 0], body: 'WCM', label: 'off the path: ERR_NOT_FOUND', labelAt: 'right' },
            ],
            arrows: [{ from: [2, 2], to: [3, 2], gap: [0.36, 0.3] }, { from: [5, 2], to: [6, 1], gap: [0.36, 0.3] }],
        }],
        'PathFinder.search': [{
            type: 'scene', title: 'A search with flee', size: [9, 5],
            caption: `With \`flee: true\` the goals are turned round: the search ends on the cheapest tile that is at least \`range\` away from every goal. Here the goal is the hostile creep with range ${flee.range}.`,
            marks: [{ at: [flee.foe[0] - flee.range + 1, 0], span: [2 * flee.range - 1, 5], tone: 'bad' }],
            things: [{ is: 'creep', at: flee.foe, body: 'RRMM', foe: true, label: 'hostile' }, { is: 'creep', at: flee.me, body: 'WCM' }],
            paths: [{ via: flee.way.path }],
            notes: [{ at: [5, 0], text: `closer than ${flee.range}: not far enough`, strong: true }, { at: [1, 3], text: [`range ${flee.range}:`, 'the search ends'] }],
        }],
        'PathFinder.CostMatrix': [{
            type: 'panels', title: 'A room and its cost matrix', wide: true,
            caption: `One number per tile: 0 keeps the terrain cost, 1 to ${BLOCKED - 1} sets the cost of the tile, ${BLOCKED} blocks it. This is the matrix findPath and moveTo build: ${BLOCKED} on creeps and on structures that block, ${WRAP.road} on roads, 0 everywhere else, also under a container.`,
            panels: [
                { tag: 'The room', size: [6, 4], terrain: matrix.terrain, things: matrix.things },
                { tag: 'The matrix', size: [6, 4], terrain: matrix.terrain, marks: matrix.marks },
            ],
        }],
        'Room.findPath': [{
            type: 'scene', title: 'A target in another room', size: [12, 3], terrain: ['.....xx.....', '.....xx.....', '.....xx.....'],
            caption: 'The search goes the whole way, but `findPath` returns only the steps inside its own room: up to the exit tile. The next room needs a new call.',
            things: [{ is: 'creep', at: [1, 1], body: 'WCM' }, { is: 'flag', at: [10, 1], label: 'target' }],
            paths: [{ via: seq(1, 5).map(x => [x, 1]), label: 'returned' }, { via: seq(6, 10).map(x => [x, 1]), tone: 'dim', dashed: true, label: 'searched, not returned', dx: -14 }],
            notes: [{ at: [1, 0], text: 'this room', strong: true }, { at: [5.5, 0], text: 'exit', strong: true }, { at: [10, 0], text: 'next room', strong: true }],
        }],

        // ------------------------------------------------------------ find and look
        'Room.find': [{
            type: 'scene', title: 'Which list a structure is in', tile: 36, size: [12, 3],
            caption: 'A structure without an owner (road, container, wall) is in FIND_STRUCTURES only. FIND_MY_STRUCTURES and FIND_HOSTILE_STRUCTURES hold only structures that have an owner.',
            things: [
                { is: 'road', at: [0, 1] }, { is: 'container', at: [1, 1] }, { is: 'wall', at: [2, 1] },
                { is: 'spawn', at: [5, 1] }, { is: 'tower', at: [6, 1] },
                { is: 'spawn', at: [9, 1], foe: true }, { is: 'tower', at: [10, 1], foe: true },
            ],
            notes: [
                { at: [1, 0.1], text: 'no owner', strong: true }, { at: [5.5, 0.1], text: 'yours', strong: true }, { at: [9.5, 0.1], text: 'another owner', strong: true },
                { at: [1, 1.85], text: ['FIND_STRUCTURES'] }, { at: [5.5, 1.85], text: ['FIND_STRUCTURES', 'FIND_MY_STRUCTURES'] }, { at: [9.5, 1.85], text: ['FIND_STRUCTURES', 'FIND_HOSTILE_STRUCTURES'] },
            ],
        }],
        'Room.lookForAtArea': [{
            type: 'scene', title: 'lookForAtArea(type, top, left, bottom, right)', tile: 36, size: [11, 6],
            caption: `The area is given as top, left, bottom, right: each y comes before its x. This is \`lookForAtArea(LOOK_STRUCTURES, ${box.top}, ${box.left}, ${box.bottom}, ${box.right}, true)\`; it returns the two structures inside.`,
            marks: [{ at: [box.left + 1, box.top + 1], span: [box.right - box.left + 1, box.bottom - box.top + 1], tone: 'accent' }],
            things: [{ is: 'extension', at: [4, 3] }, { is: 'container', at: [6, 2] }, { is: 'tower', at: [1, 4], dim: true }],
            notes: [{ at: [1, 0], text: 'x = 0' }, { at: [0, 1], text: 'y = 0' }]
                .concat(seq(1, 6).map(x => ({ at: [x + 1, 0], text: String(x) })), seq(1, 3).map(y => ({ at: [0, y + 1], text: String(y) })),
                    [{ at: [7.7, box.top + 1], text: 'top = ' + box.top, anchor: 'start', strong: true }, { at: [7.7, box.bottom + 1], text: 'bottom = ' + box.bottom, anchor: 'start', strong: true },
                        { at: [box.left + 1, 5], text: 'left = ' + box.left, strong: true }, { at: [box.right + 1, 5], text: 'right = ' + box.right, strong: true }]),
        }],
        'Room.lookAtArea': [{
            type: 'panels', title: 'One kind or everything',
            caption: `lookAtArea adds a terrain entry for every tile, so this 3 × 3 area with ${area.structures.length} structures gives ${area.tiles.length + area.structures.length} entries. lookForAtArea for the one kind you need gives ${area.structures.length}.`,
            panels: [
                {
                    tag: `lookAtArea: ${area.tiles.length + area.structures.length} entries`, size: [5, 5], terrain: area.terrain, note: `${area.tiles.length} × terrain + ${area.structures.length} structures`,
                    marks: area.tiles.map(p => ({ at: p, tone: 'warn' })), things: area.structures,
                },
                {
                    tag: `lookForAtArea: ${area.structures.length} entries`, tone: 'good', size: [5, 5], terrain: area.terrain, note: 'LOOK_STRUCTURES only',
                    ranges: [{ at: [2, 2], r: 1 }], marks: area.structures.map(s => ({ at: s.at, tone: 'good' })), things: area.structures,
                },
            ],
        }],
        'RoomPosition.findClosestByPath': [{
            type: 'scene', title: 'One search, every candidate a goal', size: [10, 5], terrain: closest.terrain,
            caption: 'All candidates go into one path search as goals at range 1. The search ends at the goal that is cheapest to reach, and the candidate beside the end of the path is returned: source A here.',
            ranges: [{ at: closest.A, r: 1, label: 'goal: range 1' }, { at: closest.B, r: 1, label: 'goal: range 1', tone: 'dim' }],
            things: [{ is: 'source', at: closest.A, label: 'A', labelAt: 'right' }, { is: 'source', at: closest.B, label: 'B', labelAt: 'right' }, { is: 'creep', at: closest.me, body: 'WCM' }],
            paths: [{ via: closest.way.path }],
        }],
        'RoomPosition.findClosestByRange': [{
            type: 'scene', title: 'Closest by range', size: [8, 5],
            caption: 'Range is the larger of the x and y distance. B is two tiles away diagonally and A three tiles to the side, so B is returned. No path is searched; on a tie the first one in the list wins.',
            ranges: [{ at: [2, 2], r: 2, label: 'range 2' }],
            things: [{ is: 'creep', at: [2, 2], body: 'WCM' }, { is: 'source', at: [5, 2], label: 'A: range ' + cheb([2, 2], [5, 2]), labelAt: 'right' }, { is: 'source', at: [4, 4], label: 'B: range ' + cheb([2, 2], [4, 4]), labelAt: 'right' }],
            arrows: [{ from: [2, 2], to: [4, 4], tone: 'accent', gap: [0.42, 0.42] }],
        }],
        'RoomPosition.findInRange': [{
            type: 'scene', title: 'findInRange(FIND_HOSTILE_CREEPS, 3)', tile: 32, size: [11, 7],
            caption: 'Returns every creep of the list inside the square of range 3, the corner included. It tests each entry of the list, so its cost follows the number of such objects in the room, not the range.',
            ranges: [{ at: [3, 3], r: 3, label: 'range 3' }],
            things: [
                { is: 'creep', at: [3, 3], body: 'RRMM' },
                { is: 'creep', at: [5, 1], body: 'AM', foe: true, label: 'returned' }, { is: 'creep', at: [1, 4], body: 'AM', foe: true, label: 'returned' },
                { is: 'creep', at: [6, 6], body: 'AM', foe: true, label: 'returned', labelAt: 'top' },
                { is: 'creep', at: [8, 3], body: 'AM', foe: true, label: ['range ' + cheb([3, 3], [8, 3]) + ':', 'left out'] },
            ],
        }],
        'RoomPosition.isNearTo': [{
            type: 'panels', title: 'What counts as near',
            caption: 'True for the eight tiles around the position and for the position itself. False for a target in another room, also when it stands on the tile just across the border.',
            panels: [
                {
                    tag: 'Next tile, also diagonal: true', tone: 'good', size: [6, 3],
                    ranges: [{ at: [2, 1], r: 1 }], things: [{ is: 'creep', at: [2, 1], body: 'WCM' }, { is: 'source', at: [3, 2] }],
                },
                {
                    tag: 'Across the border: false', tone: 'bad', size: [6, 3], terrain: ['..xx..', '..xx..', '..xx..'],
                    things: [{ is: 'creep', at: [2, 1], body: 'WCM' }, { is: 'creep', at: [3, 1], body: 'CCMM' }],
                    notes: [{ at: [0.5, 0], text: 'this room' }, { at: [4.5, 0], text: 'next room' }],
                },
            ],
        }],
        'RoomPosition.inRangeTo': [{
            type: 'scene', title: 'inRangeTo(target, 2)', size: [8, 5],
            caption: 'True when the target is at most that many tiles away in x and in y: the square of that range, corners included. False for a target in another room.',
            ranges: [{ at: [2, 2], r: 2, label: 'range 2' }],
            things: [
                { is: 'creep', at: [2, 2], body: 'WCM' },
                { is: 'container', at: [4, 0], label: String(cheb([2, 2], [4, 0]) <= 2), labelAt: 'right' }, { is: 'source', at: [1, 4], label: String(cheb([2, 2], [1, 4]) <= 2), labelAt: 'right' },
                { is: 'controller', at: [6, 2], level: 3, label: String(cheb([2, 2], [6, 2]) <= 2) },
            ],
        }],
        'RoomPosition.getDirectionTo': [{
            type: 'scene', title: 'Direction to each tile', tile: 32, size: [11, 7],
            caption: 'The number on a tile is what `getDirectionTo` returns for a target there. Further away it is a rough compass direction: straight when one axis is more than twice the other, diagonal otherwise. It is not a step that can be walked.',
            marks: dirMarks, things: [{ is: 'creep', at: [5, 3], body: 'M' }],
        }],

        // ------------------------------------------------------------ map
        'Game.map.findRoute': [{
            type: 'flow', title: 'A route of three steps', cell: [150, 54],
            caption: 'Each step is `{exit, room}`: the FIND_EXIT_* constant to leave the current room through, and the room you then enter. The start room is not in the list.',
            nodes: [
                { id: 'a', at: [0, 1], text: 'W3N1', sub: 'start, not in the route' },
                { id: 'b', at: [1, 1], text: 'W2N1', sub: 'exit: FIND_EXIT_RIGHT', tone: 'accent' },
                { id: 'c', at: [1, 0], text: 'W2N2', sub: 'exit: FIND_EXIT_TOP', tone: 'accent' },
                { id: 'd', at: [2, 0], text: 'W1N2', sub: 'exit: FIND_EXIT_RIGHT', tone: 'accent' },
            ],
            edges: [{ from: 'a', to: 'b', label: String(C.FIND_EXIT_RIGHT) }, { from: 'b', to: 'c', label: String(C.FIND_EXIT_TOP) }, { from: 'c', to: 'd', label: String(C.FIND_EXIT_RIGHT) }],
        }],
        'Game.map.findExit': [{
            type: 'flow', title: 'The first step of the route', cell: [150, 54],
            caption: `findExit runs a whole findRoute and returns the exit of its first step only: FIND_EXIT_RIGHT (${C.FIND_EXIT_RIGHT}) for this route.`,
            nodes: [
                { id: 'a', at: [0, 1], text: 'W3N1', sub: 'from' },
                { id: 'b', at: [1, 1], text: 'W2N1' },
                { id: 'c', at: [1, 0], text: 'W2N2' },
                { id: 'd', at: [2, 0], text: 'W1N2', sub: 'to' },
            ],
            edges: [{ from: 'a', to: 'b', label: 'returned: ' + C.FIND_EXIT_RIGHT, tone: 'accent' }, { from: 'b', to: 'c', dashed: true, tone: 'dim' }, { from: 'c', to: 'd', dashed: true, tone: 'dim' }],
        }],

        // ------------------------------------------------------------ event log
        'Room.getEventLog': [{
            type: 'timeline', title: 'One tick behind, one tick long', span: 3, unit: 'ticks', ticks: seq(0, 3),
            caption: 'The log lists what was carried out in the room in the previous tick, and nothing older. Read it every tick or the records are gone.',
            rows: [
                { label: 'In the room', segs: blocks([[0, 'A attacks', 'bad'], [1, 'B is healed', 'good']]) },
                { label: 'getEventLog() lists', segs: blocks([[1, 'the attack', 'bad'], [2, 'the heal', 'good']]) },
            ],
        }],

        // ------------------------------------------------------------ memory
        'RawMemory.setActiveSegments': [{
            type: 'timeline', title: 'From the call to the data', span: 6, unit: 'ticks', ticks: seq(0, 6),
            caption: 'The list takes effect in the next tick and stays in force every tick after. A new call replaces the whole list. At most 10 segments can be active.',
            rows: [
                { label: 'Your calls', segs: blocks([[0, '', 'energy'], [3, '', 'energy']]), marks: [{ at: 0, text: 'setActiveSegments([3, 7])' }, { at: 3, text: 'setActiveSegments([5])' }] },
                { label: 'segments[3] and [7]', segs: [{ from: 1, to: 4, text: 'loaded every tick', tone: 'good' }] },
                { label: 'segments[5]', segs: [{ from: 4, to: 6, text: 'loaded', tone: 'good' }] },
            ],
        }],
        'RawMemory.setActiveForeignSegment': [{
            type: 'timeline', title: 'From the request to the data', span: 6, unit: 'ticks', ticks: seq(0, 6),
            caption: 'The segment is there one tick after the request and then every tick, for as long as its owner keeps that id public. One foreign segment at a time; `null` ends the request.',
            rows: [
                { label: 'Your request', segs: blocks([[0, '', 'energy']]), marks: [{ at: 0, text: "setActiveForeignSegment('ally', 7)" }] },
                { label: 'Public list of the ally', segs: [{ from: 0, to: 4, text: 'holds 7', tone: 'a' }] },
                { label: 'RawMemory.foreignSegment', segs: [{ from: 1, to: 4, text: '{username, id, data}', tone: 'good' }, { from: 4, to: 6, text: 'undefined', tone: 'dim' }] },
            ],
        }],
        'InterShardMemory': [{
            type: 'flow', title: 'One string per shard', cell: [150, 54],
            caption: 'Each shard writes only its own string, with `setLocal`. Your code on the other shards reads it with `getRemote` and cannot change it.',
            nodes: [
                { id: 'a', at: [0, 0], text: 'Your code', sub: 'on shard A', tone: 'energy' },
                { id: 'sa', at: [1, 0], text: 'String of shard A', sub: 'up to 100 KB' },
                { id: 'b', at: [1, 1], text: 'Your code', sub: 'on shard B', tone: 'accent' },
                { id: 'sb', at: [0, 1], text: 'String of shard B', sub: 'up to 100 KB' },
            ],
            edges: [{ from: 'a', to: 'sa', label: 'setLocal' }, { from: 'sa', to: 'b', label: 'getRemote' }, { from: 'b', to: 'sb', label: 'setLocal' }, { from: 'sb', to: 'a', label: 'getRemote' }],
        }],

        // ------------------------------------------------------------ CPU
        'Game.cpu.getUsed': [{
            type: 'timeline', title: 'What getUsed() counts', span: 10, ticks: noTicks,
            caption: `The clock starts when your loop is called, so building \`Game\` before it is free. Every intent queued so far adds ${FEE}. Turning Memory back into a string after the loop is charged too, but no call of getUsed() can see it. Not to scale.`,
            rows: [
                { label: 'One tick of your script', segs: [{ from: 0, to: 2.2, text: 'Game is built', tone: 'dim' }, { from: 2.2, to: 7.4, text: 'your loop', tone: 'energy' }, { from: 7.4, to: 10, text: 'Memory is saved', tone: 'warn' }] },
                { label: 'getUsed() can show', segs: [{ from: 2.2, to: 7.4, text: `run time + ${FEE} per intent`, tone: 'a' }] },
                { label: 'Charged to you', segs: [{ from: 2.2, to: 10, text: 'the loop and the Memory save', tone: 'b' }] },
            ],
        }],
        'Game.cpu.generatePixel': [{
            type: 'flow', title: 'A full bucket for one pixel', cell: [176, 56],
            caption: `One pixel costs ${n(C.PIXEL_CPU_COST)} CPU from the bucket. The call empties the bucket, so the next ticks have no reserve.`,
            nodes: [
                { id: 'full', at: [0, 0], text: `Bucket holds ${n(C.PIXEL_CPU_COST)}`, tone: 'energy' },
                { id: 'call', at: [1, 0], text: 'generatePixel()', sub: 'returns OK', mono: true },
                { id: 'pixel', at: [2, 0], text: 'One pixel', sub: 'and an empty bucket', tone: 'good' },
                { id: 'low', at: [0, 1], text: 'Bucket holds less' },
                { id: 'err', at: [1, 1], text: 'No pixel', sub: 'ERR_NOT_ENOUGH_RESOURCES', tone: 'bad' },
            ],
            edges: [{ from: 'full', to: 'call' }, { from: 'call', to: 'pixel' }, { from: 'low', to: 'err' }],
        }],

        // ------------------------------------------------------------ Game
        'Game.getObjectById': [{
            type: 'panels', title: 'The same id in two ticks',
            caption: 'An id finds its object only while the room is visible in this tick. Without anything of yours there the lookup returns null, although the object still exists.',
            panels: [
                {
                    tag: 'Room visible: the object', tone: 'good', size: [5, 3],
                    things: [{ is: 'container', at: [3, 1], fill: 0.7, label: 'container' }, { is: 'creep', at: [1, 1], body: 'CCMM', label: 'your creep' }],
                },
                {
                    tag: 'Room not visible: null', tone: 'bad', size: [5, 3],
                    things: [{ is: 'container', at: [3, 1], fill: 0.7, dim: true, label: 'container' }],
                },
            ],
        }],
        'Game.notify': [{
            type: 'timeline', title: 'Grouping with groupInterval', span: 60, unit: 'minutes', ticks: [0, 30, 60],
            caption: 'With a groupInterval, equal messages that fall into the same interval become one notification with a counter. Here the interval is 30 minutes.',
            rows: [
                { label: 'Game.notify(text, 30)', marks: [{ at: 3 }, { at: 8 }, { at: 13, text: 'three calls, same text' }, { at: 41, text: 'one call' }] },
                { label: 'Notifications', segs: [{ from: 0, to: 30, text: 'one, counter 3', tone: 'a' }, { from: 30, to: 60, text: 'one, counter 1', tone: 'a' }] },
            ],
        }],
        'Room.Terrain': [{
            type: 'scene', title: 'What get(x, y) returns', tile: 44, size: [9, 3], terrain: ['...~~~###', '...~~~###', '...~~~###'],
            caption: `A number for every tile: 0 for plain, TERRAIN_MASK_SWAMP (${C.TERRAIN_MASK_SWAMP}) for swamp, TERRAIN_MASK_WALL (${C.TERRAIN_MASK_WALL}) for wall. The object reads the static map, so it works for a room you cannot see.`,
            notes: [
                { at: [1, 0.3], text: 'plain', strong: true }, { at: [4, 0.3], text: 'swamp', strong: true }, { at: [7, 0.3], text: 'wall', strong: true },
                { at: [1, 1], text: '0', strong: true }, { at: [4, 1], text: String(C.TERRAIN_MASK_SWAMP), strong: true }, { at: [7, 1], text: String(C.TERRAIN_MASK_WALL), strong: true },
                { at: [4, 1.7], text: 'TERRAIN_MASK_SWAMP' }, { at: [7, 1.7], text: 'TERRAIN_MASK_WALL' },
            ],
        }],

        // ------------------------------------------------------------ constants
        'const:find': [{
            type: 'scene', title: 'The exit lists of a room', tile: 36, size: [11, 7],
            terrain: ['###xxxxx###', '#.........#', 'x.........x', 'x.........x', 'x.........x', '#.........#', '###xxxxx###'],
            caption: 'Each FIND_EXIT_* list holds the open tiles of one room edge, as positions and not as objects; FIND_EXIT holds all four. Their numbers are those of the directions TOP, RIGHT, BOTTOM and LEFT. The room is drawn small: a real one has 50 × 50 tiles.',
            notes: [
                { at: [5, 1], text: `FIND_EXIT_TOP = ${C.FIND_EXIT_TOP}`, strong: true }, { at: [5, 5], text: `FIND_EXIT_BOTTOM = ${C.FIND_EXIT_BOTTOM}`, strong: true },
                { at: [0.8, 2], text: `FIND_EXIT_LEFT = ${C.FIND_EXIT_LEFT}`, anchor: 'start', strong: true }, { at: [9.2, 4], text: `FIND_EXIT_RIGHT = ${C.FIND_EXIT_RIGHT}`, anchor: 'end', strong: true },
                { at: [5, 3], text: `FIND_EXIT = ${C.FIND_EXIT}: all four edges` },
            ],
        }],
        'const:look': [{
            type: 'scene', title: 'What each LOOK_* constant finds', size: [10, 6], terrain: ['..........', '..........', '..........', '..........', '....~.....', '..........'],
            caption: 'The word under a thing is the value of its LOOK_* constant, and the `type` it has in a lookAt result. Dropped resources answer to LOOK_ENERGY and to LOOK_RESOURCES. All structures on a tile, a road and a rampart too, come under LOOK_STRUCTURES.',
            things: [
                { is: 'creep', at: [0, 0], body: 'WCM', label: C.LOOK_CREEPS }, { is: 'powerCreep', at: [2, 0], label: C.LOOK_POWER_CREEPS }, { is: 'source', at: [4, 0], label: C.LOOK_SOURCES },
                { is: 'mineral', at: [6, 0], label: C.LOOK_MINERALS }, { is: 'deposit', at: [8, 0], label: C.LOOK_DEPOSITS },
                { is: 'flag', at: [0, 2], label: C.LOOK_FLAGS }, { is: 'road', at: [2, 2] }, { is: 'tower', at: [2, 2] }, { is: 'rampart', at: [2, 2], label: C.LOOK_STRUCTURES },
                { is: 'site', at: [5, 2], progress: 0.4, label: C.LOOK_CONSTRUCTION_SITES }, { is: 'ruin', at: [8, 2], label: C.LOOK_RUINS },
                { is: 'nuke', at: [0, 4], label: C.LOOK_NUKES }, { is: 'energy', at: [2, 4], big: true, label: [C.LOOK_ENERGY, C.LOOK_RESOURCES] }, { is: 'tombstone', at: [6, 4], label: C.LOOK_TOMBSTONES },
            ],
            notes: [{ at: [4, 4.7], text: C.LOOK_TERRAIN }],
        }],
        'const:return-codes': [{
            type: 'panels', title: 'OK or an error code',
            caption: `OK means the intent is queued, for ${FEE} CPU; it can still fail when it is carried out. An error code is a negative number: nothing is queued and no fee is charged.`,
            panels: [
                {
                    tag: `harvest returns OK (${C.OK})`, tone: 'good', size: [5, 3], note: 'intent queued',
                    things: [{ is: 'source', at: [1, 1] }, { is: 'creep', at: [2, 1], body: 'WWCM' }], arrows: [{ from: [1, 1], to: [2, 1], tone: 'energy' }],
                },
                {
                    tag: `ERR_NOT_IN_RANGE (${C.ERR_NOT_IN_RANGE})`, tone: 'bad', size: [5, 3], note: 'nothing queued, no fee',
                    things: [{ is: 'source', at: [1, 1] }, { is: 'creep', at: [4, 1], body: 'WWCM' }],
                },
            ],
        }],
    };
};
