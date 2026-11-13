'use strict';
/*
 * Figures of the pack "practice-code": {entry id: [figure, ...]}. These entries describe what players do,
 * so a caption that gives advice says so. Numbers come from the constants (C) or from a formula the entry
 * states. Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n, seq } = h;
    const towerAt = r => {
        const a = C.TOWER_OPTIMAL_RANGE, b = C.TOWER_FALLOFF_RANGE, x = Math.min(Math.max(r, a), b);
        return Math.floor(C.TOWER_POWER_ATTACK - C.TOWER_POWER_ATTACK * C.TOWER_FALLOFF * (x - a) / (b - a));
    };
    const farShot = towerAt(C.TOWER_FALLOFF_RANGE);
    const towerCounts = [8, 7, 3].map(level => C.CONTROLLER_STRUCTURES.tower[level]);   // towers of a room at levels 8, 7 and 3
    const freeParts = C.MAX_CREEP_SIZE / 2;                       // parts of a body beside its MOVE parts, one MOVE per other part

    // quad: a tile is blocked for the top-left creep when a tile of its 2 x 2 block is a wall
    const quadTerrain = ['......#.....', '......#.....', '............', '............', '......#.....', '......#.....', '............'];
    const quadWall = (x, y) => (quadTerrain[y] || '').charAt(x) === '#';
    const quadBlocked = [];
    quadTerrain.forEach((row, y) => row.split('').forEach((ch, x) => {
        if (!quadWall(x, y) && [[1, 0], [0, 1], [1, 1]].some(d => quadWall(x + d[0], y + d[1]))) quadBlocked.push({ at: [x, y], tone: 'bad', text: '×' });
    }));
    const quadCreeps = [[1, 4], [2, 4], [1, 5], [2, 5]];

    // tower draining: the tower stands DRAIN_X tiles from the left edge, the band at range 20 and more is what is left of it
    const DRAIN_W = 25, DRAIN_TOWER = C.TOWER_FALLOFF_RANGE + 3, DRAIN_BAND = DRAIN_TOWER - C.TOWER_FALLOFF_RANGE;

    // nukes: summed blast per tile for two nukes, in millions
    const NUKES = [[2, 2], [4, 3]];
    const blast = (x, y) => NUKES.reduce((sum, p) => { const d = Math.max(Math.abs(x - p[0]), Math.abs(y - p[1])); return sum + (d === 0 ? C.NUKE_DAMAGE[0] : d <= 2 ? C.NUKE_DAMAGE[2] : 0); }, 0);
    const M = v => v / 1e6;
    const blastMarks = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
        const v = blast(x, y), target = NUKES.some(p => p[0] === x && p[1] === y);
        if (v) blastMarks.push(Object.assign({ at: [x, y], tone: v > C.NUKE_DAMAGE[2] ? 'bad' : 'warn' }, target ? {} : { text: M(v) }));
    }
    const ringEnergy = C.NUKE_DAMAGE[2] * C.REPAIR_COST, centreEnergy = C.NUKE_DAMAGE[0] * C.REPAIR_COST;
    const full = v => v.toLocaleString('en-US');                  // one column of numbers: commas in all of them
    const HOLDS = ['storage', 'terminal', 'lab', 'factory'];      // the entry: where the contents must survive
    const rebuildRow = (type, label) => {
        const cost = C.CONSTRUCTION_COST[type];
        const verdict = cost < ringEnergy ? 'cheaper to rebuild' : cost === ringEnergy ? 'costs the same' : 'cheaper to protect';
        return { label, sub: verdict + (HOLDS.includes(type) ? ', holds contents' : ''), value: cost, text: full(cost), tone: cost < ringEnergy ? 'dim' : 'a' };
    };
    const ticksPerTile = work => C.NUKE_DAMAGE[2] / (work * C.REPAIR_POWER);
    const TEAM_WORK = 20;                                         // the entry's example: a creep with 20 WORK

    return {
        // ------------------------------------------------------------ squads
        'recipe:squad-combat': [
            {
                type: 'panels', wide: true, title: 'The two formations',
                caption: `Players fight in two formations. A duo is an attacker or dismantler with a healer on the next tile; in a 2 × 2 block every creep is within range 1 of the other three, so all HEAL parts can go to one member at ${C.HEAL_POWER} per part.`,
                panels: [
                    {
                        tag: 'Duo: a healer behind the attacker', size: [7, 3],
                        note: 'The healer calls move(attacker) and takes the tile the attacker leaves.',
                        things: [
                            { is: 'creep', at: [2, 1], body: 'TTHHHMMMMM', label: 'healer', labelAt: 'bottom' },
                            { is: 'creep', at: [3, 1], body: 'TTAAAMMMMM', label: 'attacker', labelAt: 'top' },
                            { is: 'rampart', at: [4, 1], foe: true, label: 'their rampart', labelAt: 'right' },
                        ],
                        arrows: [{ from: [2, 1], to: [3, 1], tone: 'good' }, { from: [3, 1], to: [4, 1], tone: 'bad' }],
                    },
                    {
                        tag: 'Quad: four creeps in a 2 × 2 block', size: [7, 3],
                        note: `Every HEAL part of the four gives ${C.HEAL_POWER} hits to the member under fire.`,
                        ranges: [{ at: [3, 1], r: 1, label: 'range 1', labelAt: 'tr' }],
                        things: [
                            { is: 'creep', at: [2, 1], body: 'TTRRHHMMMMMM' }, { is: 'creep', at: [3, 1], body: 'TTRRHHMMMMMM' },
                            { is: 'creep', at: [2, 2], body: 'TTRRHHMMMMMM' }, { is: 'creep', at: [3, 2], body: 'TTRRHHMMMMMM' },
                        ],
                        arrows: [
                            { from: [2, 1], to: [3, 1], tone: 'good' }, { from: [2, 2], to: [3, 1], tone: 'good' }, { from: [3, 2], to: [3, 1], tone: 'good' },
                            { from: [6.5, 1], to: [3, 1], tone: 'bad', gap: [0, 0.42], label: 'tower fire', dx: 22 },
                        ],
                    },
                ],
            },
            {
                type: 'scene', title: 'The path of a quad is searched for its top-left creep', tile: 36, size: [12, 7], terrain: quadTerrain,
                caption: 'A common way to move a quad. In the cost matrix a tile is as bad as the worst tile of the 2 × 2 block that starts on it, so the tiles marked × are blocked. All four creeps take the same direction in the same tick, and only when all four have fatigue 0.',
                marks: quadBlocked,
                things: quadCreeps.map(p => ({ is: 'creep', at: p, body: 'TTRRHHMMMMMM' })),
                paths: [{ via: [[2, 3], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2]], tone: 'accent', dashed: true, label: 'path of the top-left creep', dx: 18 }],
                arrows: quadCreeps.map(p => ({ from: p, to: [p[0] + 1, p[1] - 1] })),
                notes: [
                    { at: [-0.4, 5.85], text: ['all four: same direction,', 'same tick'], anchor: 'start' },
                    { at: [5.6, 5.85], text: ['× blocked for the top-left creep:', 'its block would touch a wall'], anchor: 'start' },
                ],
            },
            {
                type: 'scene', title: 'Kiting a melee creep', size: [10, 5],
                caption: `rangedAttack reaches range 3, attack only range 1. Hold range 3 and step back when the melee creep reaches range 2; that works only while your creep can move every tick.`,
                ranges: [
                    { at: [5, 2], r: 3, label: 'your rangedAttack: range 3', labelAt: 'br' },
                    { at: [2, 2], r: 1, tone: 'bad', label: 'its attack: range 1', labelAt: 'bl' },
                ],
                marks: [{ at: [3, 2], tone: 'good' }, { at: [4, 2], tone: 'good' }],
                things: [
                    { is: 'creep', at: [2, 2], body: 'TTAAAMMMMM', foe: true },
                    { is: 'creep', at: [5, 2], body: 'RRRRMMMM' },
                ],
                arrows: [
                    { from: [5, 2], to: [2, 2], tone: 'bad', bend: 0.3 },
                    { from: [2, 2], to: [3, 2], tone: 'bad', dashed: true },
                    { from: [5, 2], to: [6, 2] },
                ],
                notes: [
                    { at: [3.5, 1.05], text: 'two free tiles' },
                    { at: [6.3, 3.05], text: ['when it steps to range 2,', 'step back one tile'] },
                ],
            },
            {
                type: 'scene', wide: true, title: 'Draining a tower from the edge of its range', tile: 20, size: [DRAIN_W, 5],
                terrain: seq(0, 4).map(() => 'x' + '.'.repeat(DRAIN_W - 1)),
                caption: `At range ${C.TOWER_FALLOFF_RANGE} or more a shot does ${farShot} instead of ${C.TOWER_POWER_ATTACK} and still costs the defender ${C.TOWER_ENERGY_COST} energy. Players stand there next to an exit with the healing for that fire and step out when hits fall; a defender that holds its fire is not drained.`,
                marks: [{ at: [1, 0], span: [DRAIN_BAND, 5], tone: 'good' }, { at: [1 + DRAIN_BAND, 0], span: [DRAIN_W - 1 - DRAIN_BAND, 5], tone: 'warn' }],
                things: [
                    { is: 'tower', at: [DRAIN_TOWER, 2], foe: true, label: 'tower', labelAt: 'bottom' },
                    { is: 'creep', at: [1, 2], body: 'TTHHHHMMMMMM', label: 'drainer', labelAt: 'bottom' },
                ],
                arrows: [
                    { from: [DRAIN_TOWER, 2], to: [1, 2], tone: 'bad', label: `${farShot} per shot, ${C.TOWER_ENERGY_COST} energy each`, dx: 30 },
                    { from: [1, 2], to: [0, 2], dashed: true, gap: [0.42, 0.1] },
                ],
                notes: [
                    { at: [0.7, 0.2], text: `range ${C.TOWER_FALLOFF_RANGE}+`, anchor: 'start', strong: true },
                    { at: [DRAIN_W - 0.8, 0.2], text: `closer than ${C.TOWER_FALLOFF_RANGE}: more than ${farShot} per shot`, anchor: 'end' },
                    { at: [-0.3, 3.85], text: 'hits fall: onto the exit tile, heal up in the next room', anchor: 'start' },
                ],
            },
            {
                type: 'line', title: 'HEAL parts needed next to the creep under tower fire',
                caption: `Towers × damage at that range ÷ ${C.HEAL_POWER}, unboosted, with all towers at the same range. A duo has one body with at most ${freeParts} HEAL parts beside its MOVE parts, a quad four of them and then no part left to attack.`,
                x: { label: 'range to the towers', min: 0, max: 25, step: 5, snap: 1 }, y: { label: 'HEAL parts, unboosted', max: 300 },
                series: towerCounts.map(t => ({ name: t === 1 ? '1 tower' : t + ' towers', pts: seq(0, 25).map(r => [r, Math.ceil(t * towerAt(r) / C.HEAL_POWER)]) })),
                marks: [{ y: freeParts, label: `one body: ${freeParts}` }, { y: 4 * freeParts, label: `four bodies: ${4 * freeParts}` }],
            },
        ],

        // ------------------------------------------------------------ structure of the code
        'recipe:creep-architecture': [
            {
                type: 'flow', title: 'Roles or tasks: who looks for the work', cell: [140, 54],
                caption: 'With roles each of n equal creeps searches the room itself, up to n searches per tick. With tasks a manager per room searches once and hands every free creep a task: action, target id, range. Both pay the same 0.2 CPU per intent.',
                nodes: [
                    { id: 'r1', at: [0, 0], text: 'Builder 1', sub: 'role: decides itself' },
                    { id: 'r2', at: [0, 1], text: 'Builder 2', sub: 'role: decides itself' },
                    { id: 'r3', at: [0, 2], text: 'Builder 3', sub: 'role: decides itself' },
                    { id: 'work', at: [1, 1], text: 'Work in the room', sub: 'sites, fills, repairs', tone: 'energy' },
                    { id: 'mgr', at: [2, 1], text: 'Room manager', sub: 'one search per tick', tone: 'accent' },
                    { id: 't1', at: [3, 0], text: 'General creep', sub: 'moves in range, acts' },
                    { id: 't2', at: [3, 1], text: 'General creep', sub: 'moves in range, acts' },
                    { id: 't3', at: [3, 2], text: 'General creep', sub: 'moves in range, acts' },
                ],
                edges: [
                    { from: 'r1', to: 'work' }, { from: 'r2', to: 'work' }, { from: 'r3', to: 'work' }, { from: 'mgr', to: 'work' },
                    { from: 'mgr', to: 't1' }, { from: 'mgr', to: 't2', label: 'task' }, { from: 'mgr', to: 't3' },
                ],
            },
            {
                type: 'flow', title: 'A kernel: processes run by priority', cell: [180, 54],
                caption: 'As some players build it: a scheduler runs the processes one by one, highest priority first, and stops at a CPU budget. What had to wait gets a higher priority, so a short tick drops the lowest priority and not whatever comes last in the loop.',
                nodes: [
                    { id: 'table', at: [0, 0], text: 'Process table', sub: 'each with a priority' },
                    { id: 'sched', at: [1, 0], text: 'Scheduler', sub: 'highest priority first', tone: 'accent' },
                    { id: 'run', at: [2, 0], text: 'One process', sub: 'a room, a remote, the market', tone: 'energy' },
                    { id: 'stop', at: [1, 1], text: 'Stop for this tick' },
                    { id: 'wait', at: [0, 1], text: 'What had to wait', sub: 'priority raised' },
                ],
                edges: [
                    { from: 'table', to: 'sched' }, { from: 'sched', to: 'run', both: true, label: 'next' },
                    { from: 'sched', to: 'stop', label: 'CPU budget reached' }, { from: 'stop', to: 'wait' }, { from: 'wait', to: 'table', dashed: true, label: 'next tick' },
                ],
            },
        ],

        // ------------------------------------------------------------ Memory
        'recipe:memory-tricks': [
            {
                type: 'flow', title: 'MemHack: one parse per global, a save every tick', cell: [140, 54],
                caption: 'The parsed object is kept in a module-level variable and put back on `global.Memory` and `RawMemory._parsed` before anything touches Memory, so only the first tick after a reset parses. Both hooks are internals of the runtime that may change.',
                nodes: [
                    { id: 'raw', at: [0, 0], text: 'Stored string' },
                    { id: 'parse', at: [1, 0], text: 'JSON.parse', sub: 'only after a reset', tone: 'warn' },
                    { id: 'code', at: [2, 0], text: 'Your code', sub: 'uses global.Memory', tone: 'energy' },
                    { id: 'save', at: [3, 0], text: 'JSON.stringify', sub: 'still every tick', tone: 'warn' },
                    { id: 'kept', at: [2, 1], text: 'Saved object', sub: 'module-level variable' },
                ],
                edges: [{ from: 'raw', to: 'parse' }, { from: 'parse', to: 'code' }, { from: 'code', to: 'save' }, { from: 'kept', to: 'code', both: true, label: 'put back each tick' }],
            },
        ],

        // ------------------------------------------------------------ profiling and statistics
        'recipe:profiling-and-stats': [
            {
                type: 'flow', title: 'Statistics: from the loop to a dashboard', cell: [140, 54],
                caption: 'The loop writes a few numbers per tick to one place, and an agent outside the game reads it with an auth token. A segment adds nothing to the Memory parse and may be read 360 times an hour; the Memory endpoint allows 1440 reads a day.',
                nodes: [
                    { id: 'loop', at: [0, 0], text: 'Your loop', sub: 'numbers of this tick', tone: 'energy' },
                    { id: 'mem', at: [1, 0], text: 'Object in Memory', sub: '1 read per minute' },
                    { id: 'seg', at: [1, 1], text: 'Memory segment', sub: '1 read per 10 seconds' },
                    { id: 'agent', at: [2, 0], text: 'Collector', sub: 'outside, auth token', tone: 'accent' },
                    { id: 'dash', at: [3, 0], text: 'Time-series store', sub: 'graphs over days' },
                ],
                edges: [{ from: 'loop', to: 'mem' }, { from: 'loop', to: 'seg' }, { from: 'mem', to: 'agent' }, { from: 'seg', to: 'agent' }, { from: 'agent', to: 'dash' }],
            },
        ],

        // ------------------------------------------------------------ toolchain
        'recipe:toolchain': [
            {
                type: 'flow', title: 'From your files to the server', cell: [140, 54],
                caption: 'The server takes JavaScript modules with flat names, and binary modules for WebAssembly. Everything left of the uploader is a build step on your own machine; plain JavaScript modules with flat names need none.',
                nodes: [
                    { id: 'ts', at: [0, 0], text: 'TypeScript', sub: 'compiled to JS' },
                    { id: 'py', at: [0, 1], text: 'Python, Kotlin', sub: 'translated to JS' },
                    { id: 'rs', at: [0, 2], text: 'Rust, C, C++', sub: 'to WebAssembly' },
                    { id: 'js', at: [1, 0], text: 'JavaScript', sub: 'folders, npm packages', tone: 'energy' },
                    { id: 'bundle', at: [2, 0], text: 'Bundler', sub: 'one main module' },
                    { id: 'flat', at: [2, 1], text: 'Copy step', sub: 'folders to flat names' },
                    { id: 'wasm', at: [2, 2], text: 'Binary module', sub: 'and a small JS loader' },
                    { id: 'up', at: [3, 1], text: 'Uploader', sub: 'token, to a branch', tone: 'accent' },
                ],
                edges: [
                    { from: 'ts', to: 'js' }, { from: 'py', to: 'js' }, { from: 'rs', to: 'wasm' },
                    { from: 'js', to: 'bundle' }, { from: 'js', to: 'flat' }, { from: 'bundle', to: 'up' }, { from: 'flat', to: 'up' }, { from: 'wasm', to: 'up' },
                ],
            },
        ],

        // ------------------------------------------------------------ prototypes
        'recipe:prototype-extension': [
            {
                type: 'timeline', title: 'How long a value lasts, by where you keep it', span: 12, unit: 'ticks', ticks: seq(0, 12, 2),
                caption: 'Game objects are made anew every tick, so a value on the object is gone in the next one. A method on a prototype or on `global` lasts until the global reset and is back when your module runs again; only Memory outlives the reset.',
                rows: [
                    { label: 'On the game object', segs: seq(0, 11).map(t => ({ from: t, to: t + 1, tone: t % 2 ? 'dim' : 'warn' })), marks: [{ at: 1, text: 'gone after one tick' }] },
                    { label: 'Prototype, global', segs: [{ from: 0, to: 7, text: 'there', tone: 'a' }, { from: 7, to: 12, text: 'set again by your module', tone: 'a' }], marks: [{ at: 7, text: 'global reset (example)' }] },
                    { label: 'Memory', segs: [{ from: 0, to: 12, text: 'kept, and parsed with Memory', tone: 'good' }] },
                ],
            },
            {
                type: 'flow', title: 'A wrapped move also runs inside moveTo', cell: [140, 54],
                caption: 'The engine calls its own methods through the prototype: `moveTo` calls `moveByPath`, which calls `move`. A wrapper around `move` therefore runs for all three, so keep arguments and return codes as they were.',
                nodes: [
                    { id: 'mt', at: [0, 0], text: 'moveTo', mono: true },
                    { id: 'mbp', at: [1, 0], text: 'moveByPath', mono: true },
                    { id: 'mv', at: [2, 0], text: 'move', sub: 'your wrapper', tone: 'accent', mono: true },
                    { id: 'orig', at: [3, 0], text: 'Original move', sub: 'kept under a new name' },
                    { id: 'own', at: [2, 1], text: 'Your own code', sub: 'calls move directly' },
                ],
                edges: [{ from: 'mt', to: 'mbp' }, { from: 'mbp', to: 'mv' }, { from: 'mv', to: 'orig' }, { from: 'own', to: 'mv' }],
            },
        ],

        // ------------------------------------------------------------ nukes
        'recipe:nuke-response': [
            {
                type: 'scene', title: 'Two nukes: hits a rampart needs per tile, in millions', tile: 36, size: [12, 6],
                caption: `Each nuke does ${n(C.NUKE_DAMAGE[0])} on its target tile and ${n(C.NUKE_DAMAGE[2])} on the ${5 * 5 - 1} tiles around it, and every nuke is worked off by itself. Add them up per tile: a rampart with at least that many hits saves what stands under it.`,
                marks: blastMarks,
                things: NUKES.map(p => ({ is: 'nuke', at: p })),
                notes: [
                    { at: [6.9, 1], text: `${M(C.NUKE_DAMAGE[2])}: outer ring of one nuke`, anchor: 'start' },
                    { at: [6.9, 2], text: `${M(2 * C.NUKE_DAMAGE[2])}: two outer rings overlap`, anchor: 'start' },
                    { at: [6.9, 3], text: `target tiles: ${M(C.NUKE_DAMAGE[0])} + ${M(C.NUKE_DAMAGE[2])} = ${M(C.NUKE_DAMAGE[0] + C.NUKE_DAMAGE[2])}`, anchor: 'start', strong: true },
                ],
            },
            {
                type: 'bars', title: 'Rampart or rebuild, for a structure in the outer ring', max: centreEnergy,
                caption: `A rampart raised from nothing against one blast costs ${n(ringEnergy)} energy in the outer ring: ${n(C.NUKE_DAMAGE[2])} hits at ${C.REPAIR_COST} energy each. What costs less to build is cheaper to lose; players still cover what holds contents, since a nuke leaves no ruin.`,
                rows: [
                    { label: 'Rampart, outer ring', sub: `${n(C.NUKE_DAMAGE[2])} hits`, value: ringEnergy, text: full(ringEnergy), tone: 'accent' },
                    rebuildRow('extension', 'Extension'), rebuildRow('tower', 'Tower'), rebuildRow('spawn', 'Spawn'), rebuildRow('storage', 'Storage'), rebuildRow('lab', 'Lab'), rebuildRow('terminal', 'Terminal'),
                    { label: 'Rampart, centre tile', sub: `${n(C.NUKE_DAMAGE[0])} hits`, value: centreEnergy, text: full(centreEnergy), tone: 'accent' },
                ],
            },
            {
                type: 'timeline', title: 'What a repairer gets done before the landing', span: C.NUKE_LAND_TIME, unit: 'ticks since the launch',
                caption: `A WORK part repairs ${C.REPAIR_POWER} hits per tick, so one part needs ${n(ticksPerTile(1))} ticks for a single outer-ring rampart of ${n(C.NUKE_DAMAGE[2])} hits. A creep with ${TEAM_WORK} WORK parts raises one every ${n(ticksPerTile(TEAM_WORK))} ticks, and it must be out of the room when the nuke lands.`,
                rows: [
                    { label: 'Nuke', segs: [{ from: 0, to: C.NUKE_LAND_TIME, text: 'in flight, visible in FIND_NUKES', tone: 'bad' }], marks: [{ at: C.NUKE_LAND_TIME, text: 'lands', tone: 'bad' }] },
                    { label: '1 WORK part', segs: [{ from: 0, to: Math.min(C.NUKE_LAND_TIME, ticksPerTile(1)), text: 'one rampart for the outer ring', tone: 'a' }] },
                    {
                        label: `${TEAM_WORK} WORK parts`,
                        segs: seq(0, Math.floor(C.NUKE_LAND_TIME / ticksPerTile(TEAM_WORK)) - 1).map(k => ({ from: k * ticksPerTile(TEAM_WORK), to: (k + 1) * ticksPerTile(TEAM_WORK), text: String(k + 1), tone: k % 2 ? 'c' : 'a' })),
                        marks: [{ at: ticksPerTile(TEAM_WORK), text: `one outer-ring rampart every ${n(ticksPerTile(TEAM_WORK))} ticks` }],
                    },
                ],
            },
        ],

        // ------------------------------------------------------------ diplomacy
        'recipe:diplomacy': [
            {
                type: 'panels', title: 'To the game every other player is hostile',
                caption: 'FIND_HOSTILE_CREEPS returns every creep that is not yours, the creeps of an ally among them. An agreement holds only where your code checks the owner against a list of friendly names: tower targets, defender targets, the trigger of safe mode.',
                panels: [
                    {
                        tag: 'Default targets: ally shot', tone: 'bad', size: [6, 3],
                        things: [
                            { is: 'tower', at: [1, 1], label: 'your tower', labelAt: 'bottom' },
                            { is: 'creep', at: [4, 0], body: 'CCMM', foe: true, label: 'ally', labelAt: 'right' },
                            { is: 'creep', at: [4, 2], body: 'AAMM', foe: true, label: 'enemy', labelAt: 'right' },
                        ],
                        arrows: [{ from: [1, 1], to: [4, 0], tone: 'bad' }, { from: [1, 1], to: [4, 2], tone: 'bad' }],
                    },
                    {
                        tag: 'Owner checked: enemy only', tone: 'good', size: [6, 3],
                        things: [
                            { is: 'tower', at: [1, 1], label: 'your tower', labelAt: 'bottom' },
                            { is: 'creep', at: [4, 0], body: 'CCMM', foe: true, label: 'ally', labelAt: 'right' },
                            { is: 'creep', at: [4, 2], body: 'AAMM', foe: true, label: 'enemy', labelAt: 'right' },
                        ],
                        arrows: [{ from: [1, 1], to: [4, 2], tone: 'bad' }],
                    },
                ],
            },
        ],
    };
};
