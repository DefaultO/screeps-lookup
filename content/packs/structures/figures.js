'use strict';
/*
 * Figures of the pack "structures": {entry id: [figure, ...]}. Numbers come from the constants (C).
 * Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n, seq, action } = h;
    const pct = v => Math.round(v * 100) + '%';
    const DIRS = [[1, 0, -1], [2, 1, -1], [3, 1, 0], [4, 1, 1], [5, 0, 1], [6, -1, 1], [7, -1, 0], [8, -1, -1]];
    const AROUND = DIRS.map(d => [d[1], d[2]]);

    // bodies: '5W C 3M' -> part letters, cost, and what the spawn does with them
    const PART = { M: 'move', W: 'work', C: 'carry', A: 'attack', R: 'ranged_attack', H: 'heal', T: 'tough', L: 'claim' };
    const partsOf = spec => { const out = []; String(spec).replace(/(\d*)\s*([MWCARHTL])/g, (m, k, p) => { for (let i = 0; i < (+k || 1); i++) out.push(p); return m; }); return out; };
    const costOf = spec => partsOf(spec).reduce((s, p) => s + C.BODYPART_COST[PART[p]], 0);
    const lifeOf = spec => (partsOf(spec).includes('L') ? C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME);
    // energy a creep leaves with ttl ticks of life: rate 1 for recycleCreep, CREEP_CORPSE_RATE for any other death
    const refund = (spec, ttl, rate) => Math.floor(partsOf(spec).reduce((s, p) => s + Math.min(C.CREEP_PART_MAX_ENERGY, C.BODYPART_COST[PART[p]] * rate * ttl / lifeOf(spec)), 0));
    const renewGain = spec => Math.floor(C.SPAWN_RENEW_RATIO * C.CREEP_LIFE_TIME / C.CREEP_SPAWN_TIME / partsOf(spec).length);
    const renewCost = spec => Math.ceil(C.SPAWN_RENEW_RATIO * costOf(spec) / C.CREEP_SPAWN_TIME / partsOf(spec).length);

    const energyCap = l => C.CONTROLLER_STRUCTURES.spawn[l] * C.SPAWN_ENERGY_CAPACITY + C.CONTROLLER_STRUCTURES.extension[l] * C.EXTENSION_ENERGY_CAPACITY[l];
    const firstLevel = cost => seq(1, 8).find(l => energyCap(l) >= cost);
    const towerAt = (base, r) => {
        const a = C.TOWER_OPTIMAL_RANGE, b = C.TOWER_FALLOFF_RANGE, x = Math.min(Math.max(r, a), b);
        return Math.floor(base - base * C.TOWER_FALLOFF * (x - a) / (b - a));
    };
    const towersAt = l => C.CONTROLLER_STRUCTURES.tower[l];

    // a pile on the ground: every tick it loses ceil(amount / ENERGY_DECAY)
    const pile = start => { const pts = [[0, start]]; let a = start, t = 0; while (a > 0) { a -= Math.ceil(a / C.ENERGY_DECAY); t++; if (t % 20 === 0 || a <= 0) pts.push([t, Math.max(0, a)]); } return pts; };
    const pileEnd = start => { const p = pile(start); return p[p.length - 1][0]; };
    const pileUntil = (start, left) => { let a = start, t = 0; while (a > left) { a -= Math.ceil(a / C.ENERGY_DECAY); t++; } return t; };

    // build cost: structure types with the same cost share a row
    const TYPE_NAME = { spawn: 'spawn', extension: 'extension', road: 'road on plain', constructedWall: 'wall', rampart: 'rampart', link: 'link', storage: 'storage', tower: 'tower', observer: 'observer', powerSpawn: 'power spawn', extractor: 'extractor', lab: 'lab', terminal: 'terminal', container: 'container', nuker: 'nuker', factory: 'factory' };
    const costRows = (() => {
        const by = {};
        Object.keys(C.CONSTRUCTION_COST).forEach(k => { const v = C.CONSTRUCTION_COST[k]; (by[v] = by[v] || []).push(TYPE_NAME[k] || k); });
        return Object.keys(by).map(Number).sort((a, b) => a - b).map(v => { const s = by[v].join(', '); return { label: s.charAt(0).toUpperCase() + s.slice(1), value: v, text: n(v) }; });
    })();

    // the first room, level by level: what is new at a level is drawn in full, the rest faded
    const EXT_AT = [].concat(seq(3, 7).map(x => [x, 0]), seq(3, 7).map(x => [x, 1]), seq(3, 7).map(x => [x, 4]), seq(3, 7).map(x => [x, 5]));
    const bootPanel = level => {
        const ext = l => C.CONTROLLER_STRUCTURES.extension[l], had = ext(level - 1), has = ext(level), things = [];
        const add = (since, t) => { if (level >= since) things.push(Object.assign({ dim: level > since }, t)); };
        if (level >= 3) things.push({ is: 'road', at: [[2, 2], [3, 2], [2, 3], [1, 4]] });
        things.push({ is: 'source', at: [0, 1] }, { is: 'controller', at: [0, 5], level });
        add(1, { is: 'spawn', at: [4, 2] });
        add(2, { is: 'rampart', at: [4, 2] });
        add(2, { is: 'container', at: [1, 2], under: true });
        things.push({ is: 'creep', at: [1, 2], body: '5W M', label: level === 2 ? 'miner' : undefined });
        if (had) things.push({ is: 'extension', at: EXT_AT.slice(0, had), dim: true });
        things.push({ is: 'extension', at: EXT_AT.slice(had, has) });
        add(3, { is: 'tower', at: [6, 2], label: level === 3 ? 'tower' : undefined, labelAt: 'right' });
        add(3, { is: 'rampart', at: [6, 2] });
        add(4, { is: 'storage', at: [6, 3], label: 'storage', labelAt: 'right' });
        things.push({ is: 'creep', at: [3, 3], body: 'CCMM', carry: 0.8 }, { is: 'creep', at: [1, 4], body: 'WCM', carry: 0.5 });
        const note = level === 2 ? `${has - had} extensions, a container at each source, the first ramparts. Spawn energy ${n(energyCap(level))}.`
            : level === 3 ? `${has - had} more extensions, the first tower, roads. Spawn energy ${n(energyCap(level))}.`
                : `${has - had} more extensions and the storage. Spawn energy ${n(energyCap(level))}.`;
        return { tag: 'Level ' + level, tile: 30, size: [9, 6], things, note };
    };
    const buildAt = l => ['extension', 'tower', 'storage'].reduce((s, t) => s + (C.CONTROLLER_STRUCTURES[t][l] - C.CONTROLLER_STRUCTURES[t][l - 1]) * C.CONSTRUCTION_COST[t], 0);

    // one WORK part against the decay of ramparts
    const decayPerTick = C.RAMPART_DECAY_AMOUNT / C.RAMPART_DECAY_TIME;
    const heldByOneWork = Math.floor(C.REPAIR_POWER / decayPerTick);
    const rampartTiles = (() => { const out = []; for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (!(x === 3 && y === 3) && out.length < heldByOneWork) out.push([x, y]); return out; })();

    const MINER = '5W C 3M', HALF = C.CREEP_LIFE_TIME / 2, BIG = C.MAX_CREEP_SIZE / 2;
    const upgradeCap = C.CONTROLLER_MAX_UPGRADE_PER_TICK;
    const upgrader = action({
        title: 'The spot of a level 8 upgrader',
        caption: `A level 8 controller takes ${upgradeCap} energy per tick from all creeps together, so one upgrader with ${upgradeCap} WORK parts uses the whole cap. Fed from a link next to it, it stands within range 3 and never walks.`,
        body: `${upgradeCap}W 3C 9M`, actorOpts: { carry: 0.8 }, actor: 'upgrader', target: 'controller', targetOpts: { level: 8 }, targetLabel: 'controller', range: 3, tone: 'energy',
        effect: [`${upgradeCap} energy per tick:`, 'the cap of the room'],
        things: [{ is: 'link', at: [2, 3], label: 'link', labelAt: 'left' }],
    });
    upgrader.arrows.push({ from: [2, 3], to: [3, 3], tone: 'energy' });

    return {
        // ------------------------------------------------------------ mechanics
        'mechanic:spawning': [
            {
                type: 'scene', title: 'Which structures pay for a creep', size: [12, 2],
                caption: 'Without `opts.energyStructures` the spawn that makes the creep pays first, then the other spawns, then the extensions, each group from the nearest to the farthest. The far spawn is emptied before the extension next door.',
                things: [
                    { is: 'spawn', at: [1, 0], label: ['1', 'this spawn'] },
                    { is: 'extension', at: [3, 0], label: ['3', 'range 2'] },
                    { is: 'extension', at: [5, 0], label: ['4', 'range 4'] },
                    { is: 'spawn', at: [8, 0], label: ['2', 'other spawn'] },
                    { is: 'extension', at: [10, 0], label: ['5', 'range 9'] },
                ],
            },
            {
                type: 'scene', title: 'Where the new creep comes out', size: [11, 3],
                caption: 'The finished creep goes to the first free tile in direction order, TOP first and then clockwise, or in the order of `opts.directions`. A tile is not free when it holds a creep, a structure that blocks movement or a site for one, or when it is wall terrain without a road.',
                terrain: ['..#........', '...........', '...........'],
                marks: [{ at: [2, 0], tone: 'bad' }, { at: [3, 0], tone: 'bad' }, { at: [3, 1], tone: 'good' }],
                things: [{ is: 'spawn', at: [2, 1], label: 'spawn', labelAt: 'left' }, { is: 'extension', at: [3, 0] }, { is: 'creep', at: [3, 1], body: 'WCM', scale: 0.8 }],
                arrows: [{ from: [2, 1], to: [3, 1], gap: [0.4, 0.38] }],
                notes: DIRS.map(d => ({ at: [2 + d[1] - 0.36, 1 + d[2] - 0.36], text: String(d[0]), size: 9 })).concat([
                    { at: [4.4, 0.5], anchor: 'start', text: ['1  TOP: wall terrain', '2  TOP_RIGHT: a structure', '3  RIGHT: free, the creep goes here', '4 to 8: the next ones, clockwise'] },
                ]),
            },
            {
                type: 'panels', title: 'No free tile around the spawn',
                caption: 'With every allowed tile taken the spawn stays busy and tries again each tick. It never removes your own creeps; a creep of another player on one of the tiles is killed and the new creep takes its place.',
                panels: [
                    {
                        tag: 'Your own creeps: it waits', tone: 'bad', tile: 36, size: [5, 4],
                        things: [{ is: 'spawn', at: [2, 1] }].concat(AROUND.map(d => ({ is: 'creep', at: [2 + d[0], 1 + d[1]], body: 'WCM', label: d[0] === 0 && d[1] === 1 ? 'your creeps' : undefined }))),
                        note: '`spawning.remainingTime` reads 0 meanwhile.',
                    },
                    {
                        tag: 'Another player\'s creep: killed', tone: 'good', tile: 36, size: [5, 4],
                        marks: [{ at: [3, 1], tone: 'bad' }],
                        things: [{ is: 'spawn', at: [2, 1] }].concat(AROUND.map(d => (d[0] === 1 && d[1] === 0
                            ? { is: 'creep', at: [3, 1], body: 'AM', foe: true, label: 'killed', labelAt: 'right' }
                            : { is: 'creep', at: [2 + d[0], 1 + d[1]], body: 'WCM', label: d[0] === 0 && d[1] === 1 ? 'your creeps' : undefined }))),
                        note: 'Ally or invader alike. The new creep comes out on its tile.',
                    },
                ],
            },
        ],
        'mechanic:construction-sites': [
            {
                type: 'scene', title: 'What may be built next to an exit', tile: 36, size: [11, 7],
                caption: 'Nothing can be built on the outer ring. On the second ring only roads and containers, unless the three border tiles beside the tile are all wall. Walls, ramparts and everything else start two tiles from an exit.',
                terrain: ['###########', '#..........', '#..........', '#..........', 'x..........', 'x..........', '#..........'],
                marks: [{ at: [1, 3], span: [1, 4], tone: 'warn' }],
                things: [
                    { is: 'road', at: [[1, 4], [2, 4], [3, 4], [4, 4]] },
                    { is: 'container', at: [1, 6] },
                    { is: 'extension', at: [1, 2] },
                    { is: 'wall', at: [[2, 5], [2, 6]] }, { is: 'rampart', at: [2, 4] },
                ],
                arrows: [{ from: [3.2, 3], to: [1.5, 3.2], tone: 'warn', gap: [0, 0.1] }, { from: [3.2, 5.5], to: [2.5, 5.5], gap: [0, 0.05] }],
                notes: [
                    { at: [0, 4.5], text: 'exit', strong: true },
                    { at: [3.3, 0], anchor: 'start', text: 'outer ring: nothing' },
                    { at: [1.7, 2], anchor: 'start', text: 'border beside it is all wall: anything' },
                    { at: [3.3, 2.82], anchor: 'start', text: ['second ring beside an exit:', 'roads and containers only'] },
                    { at: [3.3, 5.32], anchor: 'start', text: ['from the third ring on:', 'walls, ramparts and all the rest'] },
                ],
            },
            {
                type: 'panels', title: 'A creep steps onto a construction site',
                caption: 'A creep that moves onto another player\'s site removes it, whoever owns the room; under safe mode only the creeps of the room owner do. Your own creeps leave your sites alone, and your site for a structure that blocks movement stops them.',
                panels: [
                    {
                        tag: 'Other player: site removed', tone: 'bad', size: [5, 3],
                        things: [{ is: 'site', at: [3, 1], progress: 0.5, label: 'your site' }, { is: 'creep', at: [1, 1], body: 'MMA', foe: true, label: 'another player' }],
                        paths: [{ via: [[1, 1], [2, 1], [3, 1]], tone: 'bad', dashed: true }],
                        note: 'With progress above 1, half of it drops as energy.',
                    },
                    {
                        tag: 'Your own creep: the site stays', tone: 'good', size: [5, 3],
                        things: [{ is: 'site', at: [3, 1], progress: 0.5, label: 'your road site' }, { is: 'creep', at: [1, 1], body: 'WCM', label: 'yours' }],
                        paths: [{ via: [[1, 1], [2, 1], [3, 1], [4, 1]], tone: 'good', dashed: true }],
                        note: 'A site for a spawn, extension or wall blocks your creeps.',
                    },
                ],
            },
            {
                type: 'bars', title: 'Energy to build one structure',
                caption: `A wall or rampart costs ${C.CONSTRUCTION_COST.rampart} energy and is then repaired up. A road costs ${C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO} times as much on swamp and ${C.CONSTRUCTION_COST_ROAD_WALL_RATIO} times as much on a wall tile. Placing the site costs no energy.`,
                rows: costRows,
            },
        ],
        'mechanic:body-design': [
            {
                type: 'body', title: 'Bodies by role',
                caption: `Cost is the sum of the parts, spawn time ${C.CREEP_SPAWN_TIME} ticks per part, hits 100 per part. The level is the first one whose spawns and extensions hold the cost.`,
                rows: [['First worker', 'WCM'], ['Miner that stays put', '5W M'], ['Miner feeding a link', MINER], ['Hauler on roads', '10C 5M'], ['Hauler off road', '10C 10M'], ['Reserver', '2L 2M'], ['Level 8 upgrader on roads', `${upgradeCap}W 3C 9M`]]
                    .map(([label, parts]) => ({ label: `${label}, from level ${firstLevel(costOf(parts))}`, parts })),
            },
            {
                type: 'body', title: `The largest body: ${C.MAX_CREEP_SIZE} parts`,
                caption: `No body may have more than ${C.MAX_CREEP_SIZE} parts. At that size every creep takes ${C.MAX_CREEP_SIZE * C.CREEP_SPAWN_TIME} ticks to spawn and has ${n(C.MAX_CREEP_SIZE * 100)} hits; the cost depends on the parts.`,
                rows: [['Dismantler', 'W'], ['Melee attacker', 'A'], ['Ranged attacker', 'R'], ['Healer', 'H']].map(([label, p]) => ({ label, parts: `${BIG}${p} ${BIG}M` })),
            },
            {
                type: 'body', title: 'The order decides what is lost first', order: true, stats: false,
                caption: 'Damage empties the list from the front, and a part at 0 hits does nothing but still weighs. The same eleven parts after 300 damage: the first body has lost only TOUGH, the second its healing and one MOVE part.',
                rows: [
                    { label: 'TOUGH first, MOVE and HEAL last', parts: '3T 3A 3M 2H', dead: 3, note: 'Still attacks, heals and moves as before.' },
                    { label: 'HEAL and MOVE first', parts: '2H 3M 3A 3T', dead: 3, note: 'Cannot heal any more and is slower.' },
                ],
            },
        ],
        'mechanic:ramparts-and-walls': [
            {
                type: 'panels', title: 'A rampart takes the hits for its tile',
                caption: 'Whatever is aimed at something on a rampart tile hits the rampart, and what stands under it takes nothing. The rampart covers its own tile only: a ranged attack passes over it to what stands behind.',
                panels: [
                    {
                        tag: 'Under a rampart: shielded', tone: 'good', size: [6, 4],
                        things: [{ is: 'spawn', at: [3, 1], label: ['the rampart', 'takes the hits'] }, { is: 'rampart', at: [3, 1] }, { is: 'creep', at: [1, 1], body: 'AAMM', foe: true, label: 'hostile' }],
                        arrows: [{ from: [1, 1], to: [3, 1], tone: 'bad' }],
                    },
                    {
                        tag: 'Behind a rampart: hit as usual', tone: 'bad', size: [6, 4],
                        things: [{ is: 'rampart', at: [[2, 0], [2, 1]] }, { is: 'rampart', at: [2, 2], label: 'ramparts' }, { is: 'spawn', at: [4, 1], label: ['the spawn', 'is hit'] }, { is: 'creep', at: [1, 1], body: 'RRMM', foe: true, label: 'hostile' }],
                        arrows: [{ from: [1, 1], to: [4, 1], tone: 'bad' }],
                    },
                ],
            },
            {
                type: 'panels', title: 'Who gets past', wide: true,
                caption: 'A rampart lets the creeps of its owner through and stops everyone else, unless it is public. A wall stops every creep, the builder\'s included.',
                panels: [
                    {
                        tag: 'Rampart, its owner: passes', tone: 'good', size: [5, 3],
                        things: [{ is: 'rampart', at: [3, 1] }, { is: 'creep', at: [1, 1], body: 'WCM', label: 'the owner' }],
                        paths: [{ via: [[1, 1], [2, 1], [3, 1], [4, 1]], tone: 'good', dashed: true }],
                    },
                    {
                        tag: 'Closed rampart, anyone else: blocked', tone: 'bad', size: [5, 3],
                        things: [{ is: 'rampart', at: [3, 1] }, { is: 'creep', at: [1, 1], body: 'AAMM', foe: true, label: 'another player' }],
                        paths: [{ via: [[1, 1], [2, 1]], tone: 'bad', dashed: true }],
                    },
                    {
                        tag: 'Wall: blocks everyone', tone: 'bad', size: [5, 3],
                        things: [{ is: 'wall', at: [3, 1] }, { is: 'creep', at: [1, 1], body: 'WCM', label: 'any creep' }],
                        paths: [{ via: [[1, 1], [2, 1]], tone: 'bad', dashed: true }],
                    },
                ],
            },
        ],

        // ------------------------------------------------------------ recipes
        'recipe:bootstrap-a-room': [
            {
                type: 'panels', title: 'The first room at levels 2, 3 and 4', wide: true,
                caption: `What a level adds is drawn in full, the structures of earlier levels are faded. Level 1 is the spawn alone, with ${n(energyCap(1))} energy per creep.`,
                panels: [bootPanel(2), bootPanel(3), bootPanel(4)],
            },
            {
                type: 'cols', title: 'Upgrade energy against build energy', x: { label: 'room level', cats: ['2', '3', '4'] }, y: { label: 'energy' },
                caption: `Level 2 costs only ${n(C.CONTROLLER_LEVELS[1])} energy, so upgrade first and build after. From level 3 on, the upgrade costs more than the new extensions, tower and storage together.`,
                series: [{ name: 'upgrade energy to reach the level', values: seq(2, 4).map(l => C.CONTROLLER_LEVELS[l - 1]) }, { name: 'energy to build what it unlocks', values: seq(2, 4).map(buildAt) }],
            },
        ],
        'recipe:defend-a-room': [
            {
                type: 'scene', title: 'The layers of a defence', size: [11, 4],
                caption: 'Ramparts cover the storage, the towers and the spawn, so the attacker can only hit a rampart. A melee defender on the rampart beside it strikes without being struck back; one tower shoots while another repairs the rampart under fire.',
                things: [
                    { is: 'storage', at: [3, 2], label: 'storage under a rampart' }, { is: 'rampart', at: [3, 2] },
                    { is: 'rampart', at: [2, 2] }, { is: 'creep', at: [2, 2], body: 'AAAMM', label: ['defender', 'on a rampart'], labelAt: 'left' },
                    { is: 'creep', at: [3, 1], body: 'AAAMMM', foe: true, label: 'attacker', labelAt: 'top' },
                    { is: 'tower', at: [8, 1], label: 'tower', labelAt: 'right' }, { is: 'rampart', at: [8, 1] },
                    { is: 'tower', at: [8, 3], label: 'tower', labelAt: 'right' }, { is: 'rampart', at: [8, 3] },
                    { is: 'spawn', at: [10, 2], label: 'spawn' }, { is: 'rampart', at: [10, 2] },
                ],
                arrows: [
                    { from: [3, 1], to: [3, 2], tone: 'bad', gap: [0.4, 0.44] },
                    { from: [2, 2], to: [3, 1], tone: 'ink', gap: [0.4, 0.4] },
                    { from: [8, 1], to: [3, 1], tone: 'ink', label: 'attack' },
                    { from: [8, 3], to: [3, 2], tone: 'good', label: 'repair', side: 'below' },
                ],
            },
            {
                type: 'panels', title: 'An open rampart shields the enemy',
                caption: 'A public rampart lets hostile creeps step onto it, and a shot aimed at a creep on a rampart tile hits the rampart instead. Close your ramparts while hostiles are in the room.',
                panels: [
                    {
                        tag: 'Closed: the hostile is hit', tone: 'good', size: [6, 4],
                        things: [{ is: 'rampart', at: [2, 2], label: 'closed rampart', labelAt: 'right' }, { is: 'creep', at: [1, 2], body: 'AAMM', foe: true, label: 'hostile' }, { is: 'tower', at: [3, 0], label: 'tower', labelAt: 'right' }],
                        arrows: [{ from: [3, 0], to: [1, 2], tone: 'bad' }],
                    },
                    {
                        tag: 'Public: the rampart is hit', tone: 'bad', size: [6, 4],
                        things: [{ is: 'rampart', at: [2, 2], public: true, label: 'public rampart', labelAt: 'right' }, { is: 'creep', at: [2, 2], body: 'AAMM', foe: true, label: 'hostile' }, { is: 'tower', at: [3, 0], label: 'tower', labelAt: 'right' }],
                        arrows: [{ from: [3, 0], to: [2, 2], tone: 'bad' }],
                    },
                ],
            },
        ],
        'recipe:attack-a-room': [
            {
                type: 'scene', title: 'Breaking in under tower fire', size: [10, 4],
                caption: `The dismantler works at range 1, and the rampart on the tile takes everything before the storage under it. The healer stays next to it, where each HEAL part restores ${C.HEAL_POWER} hits; the tower's damage depends on its own range to the creep it shoots.`,
                things: [
                    { is: 'storage', at: [4, 1], label: 'the rampart takes the hits first', labelAt: 'top' }, { is: 'rampart', at: [4, 1], foe: true },
                    { is: 'creep', at: [4, 2], body: '2T 4W 4M', label: ['dismantler', `${C.DISMANTLE_POWER} hits per WORK`], labelAt: 'left' },
                    { is: 'creep', at: [4, 3], body: '4H 4M', label: ['healer', `${C.HEAL_POWER} hits per HEAL`], labelAt: 'left' },
                    { is: 'tower', at: [9, 2], foe: true, label: 'tower' },
                ],
                arrows: [
                    { from: [4, 2], to: [4, 1], tone: 'bad', gap: [0.4, 0.44] },
                    { from: [4, 3], to: [4, 2], tone: 'good', gap: [0.4, 0.4] },
                    { from: [9, 2], to: [4, 2], tone: 'bad', label: `${C.TOWER_POWER_ATTACK} per tick at range ${C.TOWER_OPTIMAL_RANGE}` },
                ],
            },
            {
                type: 'line', title: 'Tower damage on one creep',
                caption: `A room has ${towersAt(8)} towers at level 8, ${towersAt(7)} at level 7 and ${towersAt(3)} at level 3. Damage and healing of a tick are netted, so healing above the line keeps the creep at full hits.`,
                x: { label: 'range in tiles, all towers at the same range', min: 0, max: 25, step: 5, snap: 1 }, y: { label: 'damage per tick' },
                series: [towersAt(8), towersAt(7), towersAt(3)].map(k => ({ name: k + (k === 1 ? ' tower' : ' towers'), pts: seq(0, 25).map(r => [r, k * towerAt(C.TOWER_POWER_ATTACK, r)]) })),
                marks: [
                    { y: BIG * C.HEAL_POWER, label: `${BIG} HEAL parts next to it: ${n(BIG * C.HEAL_POWER)}` },
                    { y: BIG * C.HEAL_POWER * C.BOOSTS.heal.XLHO2.heal, label: `the same with XLHO2: ${n(BIG * C.HEAL_POWER * C.BOOSTS.heal.XLHO2.heal)}` },
                ],
            },
        ],
        'recipe:upgrade-at-level-8': [
            upgrader,
            {
                type: 'bars', title: 'Points per tick at the cap', unit: 'points',
                caption: `Boosts multiply the points, not the energy: every row spends ${upgradeCap} energy per tick with ${upgradeCap} WORK parts. The points also count for GCL.`,
                rows: [{ label: 'No boost', value: upgradeCap }].concat(['GH', 'GH2O', 'XGH2O'].map(b => ({ label: b, sub: '× ' + C.BOOSTS.work[b].upgradeController, value: Math.floor(upgradeCap * C.BOOSTS.work[b].upgradeController), tone: 'b' }))),
            },
        ],
        'recipe:keep-ramparts-up': [
            {
                type: 'scene', title: `One WORK part holds ${heldByOneWork} ramparts`, tile: 28, size: [14, 7],
                caption: `A rampart loses ${C.RAMPART_DECAY_AMOUNT} hits every ${C.RAMPART_DECAY_TIME} ticks, ${decayPerTick} per tick. One WORK part that repairs every tick restores ${C.REPAIR_POWER} hits for ${C.REPAIR_POWER * C.REPAIR_COST} energy, which offsets the decay of ${heldByOneWork} ramparts within range 3.`,
                ranges: [{ at: [3, 3], r: 3, label: 'range 3', labelAt: 'bl' }],
                things: [{ is: 'rampart', at: rampartTiles }, { is: 'creep', at: [3, 3], body: 'WCM', carry: 0.6 }],
                notes: [{ at: [7.3, 2.3], anchor: 'start', text: [`1 WORK: +${C.REPAIR_POWER} hits per tick`, `${heldByOneWork} ramparts: −${heldByOneWork * decayPerTick} per tick`, `for ${C.REPAIR_POWER * C.REPAIR_COST} energy per tick`] }],
            },
            {
                type: 'flow', title: 'Who repairs the lowest rampart', cell: [196, 54],
                caption: `Work on the rampart with the fewest hits. A creep restores ${1 / C.REPAIR_COST} hits per energy, a tower ${C.TOWER_POWER_REPAIR / C.TOWER_ENERGY_COST} at best, so the towers repair only in an emergency.`,
                nodes: [
                    { id: 'q1', at: [0, 0], text: 'Below the emergency floor?', sub: 'about to fall' },
                    { id: 'q2', at: [0, 1], text: 'Below your floor?' },
                    { id: 'q3', at: [0, 2], text: 'Spare energy?' },
                    { id: 'a1', at: [1, 0], text: 'tower.repair', mono: true, tone: 'warn' },
                    { id: 'a2', at: [1, 1], text: 'creep.repair', mono: true, tone: 'good' },
                    { id: 'a3', at: [1, 2], text: 'Raise the floor', sub: 'up to hitsMax of the level', tone: 'accent' },
                ],
                edges: [{ from: 'q1', to: 'a1', label: 'yes' }, { from: 'q2', to: 'a2', label: 'yes' }, { from: 'q3', to: 'a3', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' }, { from: 'q2', to: 'q3', label: 'no' }],
            },
        ],

        // ------------------------------------------------------------ spawn, tower, controller, rampart
        'StructureSpawn.renewCreep': [{
            type: 'scene', title: 'renewCreep', size: [9, 3],
            caption: `One call adds floor(${C.SPAWN_RENEW_RATIO * C.CREEP_LIFE_TIME / C.CREEP_SPAWN_TIME} / parts) ticks of life and costs ceil(${Math.round(C.SPAWN_RENEW_RATIO / C.CREEP_SPAWN_TIME * 1000) / 1000} × body cost / parts) energy: for this body of ${partsOf(MINER).length} parts and ${costOf(MINER)} energy, ${renewGain(MINER)} ticks for ${renewCost(MINER)} energy. The spawn must be idle and the creep next to it.`,
            ranges: [{ at: [1, 1], r: 1, label: 'range 1', labelAt: 'bl' }],
            things: [{ is: 'spawn', at: [1, 1], label: 'spawn', labelAt: 'top' }, { is: 'creep', at: [2, 1], body: MINER, label: 'creep' }],
            arrows: [{ from: [1, 1], to: [2, 1], tone: 'good', gap: [0.4, 0.38] }],
            notes: [{ at: [3.4, 0.8], anchor: 'start', text: [`one call: +${renewGain(MINER)} ticks of life`, `for ${renewCost(MINER)} energy`] }],
        }],
        'StructureSpawn.recycleCreep': [{
            type: 'panels', title: 'Where the refund of recycleCreep lands',
            caption: `The spawn kills a creep next to it and returns the body cost for the life it had left, at most ${C.CREEP_PART_MAX_ENERGY} per part. The energy does not go into the spawn: here a body of ${costOf(MINER)} energy with half its life left returns ${refund(MINER, HALF, 1)}.`,
            panels: [
                {
                    tag: 'The creep stood on a container', tone: 'good', size: [6, 3],
                    things: [{ is: 'spawn', at: [1, 1], label: 'spawn' }, { is: 'container', at: [2, 1], fill: 0.8, label: [`${refund(MINER, HALF, 1)} energy`, 'in the container'], labelAt: 'right' }],
                },
                {
                    tag: 'It stood on a bare tile', size: [6, 3],
                    things: [{ is: 'spawn', at: [1, 1], label: 'spawn' }, { is: 'tombstone', at: [2, 1], label: [`${refund(MINER, HALF, 1)} energy`, 'in a tombstone'], labelAt: 'right' }],
                },
            ],
        }],
        'StructureTower.attack': [{
            type: 'ladder', title: 'Which tower action runs',
            caption: 'A tower does one thing per tick. If the script calls several, heal wins over repair and repair over attack; every call that returned OK still costs its 0.2 CPU.',
            groups: [{ title: 'Tower actions', note: 'one per tick: of those called, the one furthest left runs', ordered: true, items: ['heal', 'repair', 'attack'] }],
        }],
        'StructureTower.repair': [{
            type: 'bars', title: 'Hits repaired per energy', unit: 'hits',
            caption: `A creep restores ${1 / C.REPAIR_COST} hits per energy wherever it stands. A tower gets ${C.TOWER_POWER_REPAIR / C.TOWER_ENERGY_COST} close by and ${towerAt(C.TOWER_POWER_REPAIR, C.TOWER_FALLOFF_RANGE) / C.TOWER_ENERGY_COST} from range ${C.TOWER_FALLOFF_RANGE}, so tower repair pays only near the tower or in an emergency.`,
            rows: [
                { label: 'Creep', sub: 'any WORK part, range 3', value: 1 / C.REPAIR_COST },
                { label: 'Tower', sub: `range ${C.TOWER_OPTIMAL_RANGE} or less`, value: C.TOWER_POWER_REPAIR / C.TOWER_ENERGY_COST, tone: 'b' },
                { label: 'Tower', sub: `range ${C.TOWER_FALLOFF_RANGE} or more`, value: towerAt(C.TOWER_POWER_REPAIR, C.TOWER_FALLOFF_RANGE) / C.TOWER_ENERGY_COST, tone: 'bad' },
            ],
        }],
        'StructureController.activateSafeMode': [{
            type: 'flow', title: 'What activateSafeMode checks', cell: [214, 58],
            caption: `The checks run in this order. ERR_TIRED stands for three things: the ${n(C.SAFE_MODE_COOLDOWN)}-tick cooldown, a controller that is upgradeBlocked, and a downgrade timer more than ${n(C.CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD)} ticks below half of its maximum.`,
            nodes: [
                { id: 'c1', at: [0, 0], text: 'A safe mode in stock?', sub: 'safeModeAvailable above 0' },
                { id: 'c2', at: [0, 1], text: 'Cooldown over, not blocked,\ndowngrade timer high enough?' },
                { id: 'c3', at: [0, 2], text: 'No other room of yours\nin safe mode?' },
                { id: 'ok', at: [0, 3], text: 'OK', sub: `${n(C.SAFE_MODE_DURATION)} ticks, from the next tick`, tone: 'good' },
                { id: 'e1', at: [1, 0], text: 'ERR_NOT_ENOUGH_RESOURCES', mono: true, tone: 'bad' },
                { id: 'e2', at: [1, 1], text: 'ERR_TIRED', mono: true, tone: 'bad' },
                { id: 'e3', at: [1, 2], text: 'ERR_BUSY', mono: true, tone: 'bad' },
            ],
            edges: [{ from: 'c1', to: 'e1', label: 'no' }, { from: 'c2', to: 'e2', label: 'no' }, { from: 'c3', to: 'e3', label: 'no' }, { from: 'c1', to: 'c2', label: 'yes' }, { from: 'c2', to: 'c3', label: 'yes' }, { from: 'c3', to: 'ok', label: 'yes' }],
        }],
        'StructureController.unclaim': [{
            type: 'panels', title: 'Before and after unclaim',
            caption: 'The controller goes to level 0 at once. A running safe mode ends, the safe mode stock is emptied and nothing is refunded.',
            panels: [
                {
                    tag: 'Before: your room', size: [5, 3],
                    things: [{ is: 'controller', at: [1, 1], level: 5, label: 'level 5' }, { is: 'spawn', at: [3, 1], label: 'working' }, { is: 'extension', at: [[3, 0], [4, 0], [4, 1]] }],
                },
                {
                    tag: 'After: a neutral room', tone: 'bad', size: [5, 3],
                    things: [{ is: 'controller', at: [1, 1], neutral: true, label: 'level 0' }, { is: 'spawn', at: [3, 1], dim: true, label: 'stays, does not work' }, { is: 'extension', at: [[3, 0], [4, 0], [4, 1]], dim: true }],
                },
            ],
        }],
        'StructureRampart.setPublic': [{
            type: 'panels', title: 'A rampart closed and public',
            caption: 'setPublic(true) lets the creeps of other players walk through, and withdraw from a structure under the rampart. It goes on taking the hits for whatever stands on its tile, a visitor included.',
            panels: [
                {
                    tag: 'Closed, as built: blocked', tone: 'bad', size: [5, 3],
                    things: [{ is: 'rampart', at: [3, 1], label: 'closed' }, { is: 'creep', at: [1, 1], body: 'CCMM', foe: true, label: 'another player' }],
                    paths: [{ via: [[1, 1], [2, 1]], tone: 'bad', dashed: true }],
                },
                {
                    tag: 'Public: others walk through', tone: 'good', size: [5, 3],
                    things: [{ is: 'rampart', at: [3, 1], public: true, label: 'public' }, { is: 'creep', at: [1, 1], body: 'CCMM', foe: true, label: 'another player' }],
                    paths: [{ via: [[1, 1], [2, 1], [3, 1], [4, 1]], tone: 'good', dashed: true }],
                },
            ],
        }],
        'Room.createConstructionSite': [{
            type: 'panels', title: 'In which rooms a site can be placed', wide: true,
            caption: `In your own room the level decides what may be placed. In a room nobody owns, one you reserved or one without a controller only roads and ${C.CONTROLLER_STRUCTURES.container[0]} containers are allowed. In a room owned or reserved by another player nothing is.`,
            panels: [
                {
                    tag: 'Your room', tone: 'good', size: [5, 3],
                    things: [{ is: 'controller', at: [1, 1], level: 3 }, { is: 'site', at: [3, 1], label: 'what the level allows' }],
                },
                {
                    tag: 'Neutral, or reserved by you', tone: 'good', size: [5, 3],
                    things: [{ is: 'controller', at: [1, 1], neutral: true }, { is: 'site', at: [3, 1], label: 'roads, containers' }],
                },
                {
                    tag: 'Owned or reserved by another', tone: 'bad', size: [5, 3],
                    marks: [{ at: [3, 1], tone: 'bad' }],
                    things: [{ is: 'controller', at: [1, 1], foe: true }],
                    notes: [{ at: [3, 2], text: 'ERR_NOT_OWNER', strong: true }],
                },
            ],
        }],

        // ------------------------------------------------------------ structures
        'StructureExtension': [{
            type: 'scene', title: 'More extensions than the level allows', size: [11, 3],
            caption: `A room at level 2 may use ${C.CONTROLLER_STRUCTURES.extension[2]} extensions. With ${C.CONTROLLER_STRUCTURES.extension[2] + 2} standing, the 2 farthest from the controller are switched off and their energy does not count for spawning.`,
            marks: [{ at: [2 + C.CONTROLLER_STRUCTURES.extension[2], 1], span: [2, 1], tone: 'bad' }],
            things: [
                { is: 'controller', at: [0, 1], level: 2, label: 'level 2' },
                { is: 'extension', at: seq(2, 1 + C.CONTROLLER_STRUCTURES.extension[2]).map(x => [x, 1]) },
                { is: 'extension', at: seq(2 + C.CONTROLLER_STRUCTURES.extension[2], 3 + C.CONTROLLER_STRUCTURES.extension[2]).map(x => [x, 1]), dim: true },
            ],
            notes: [
                { at: [1.5 + C.CONTROLLER_STRUCTURES.extension[2] / 2, 1.8], text: `the ${C.CONTROLLER_STRUCTURES.extension[2]} nearest the controller work` },
                { at: [2.5 + C.CONTROLLER_STRUCTURES.extension[2], 0.2], text: 'switched off', strong: true },
            ],
        }],
        'StructureRoad': [{
            type: 'scene', title: 'A road on plain, swamp and wall', size: [9, 3], terrain: ['.........', '...~~~###', '.........'],
            caption: `On swamp a road costs ${C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO} times as much and has ${C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO} times the hits and the decay, through a wall ${C.CONSTRUCTION_COST_ROAD_WALL_RATIO} times. Whatever lies under it, a step onto the road makes 1 fatigue per weight.`,
            things: [{ is: 'road', at: seq(0, 8).map(x => [x, 1]) }],
            notes: [
                { at: [1, 0.05], text: ['plain', `${n(C.ROAD_HITS)} hits`], strong: true },
                { at: [4, 0.05], text: ['swamp', `${n(C.ROAD_HITS * C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO)} hits`], strong: true },
                { at: [7, 0.05], text: ['wall', `${n(C.ROAD_HITS * C.CONSTRUCTION_COST_ROAD_WALL_RATIO)} hits`], strong: true },
                { at: [1, 2], text: `${n(C.CONSTRUCTION_COST.road)} energy` },
                { at: [4, 2], text: `${n(C.CONSTRUCTION_COST.road * C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO)} energy` },
                { at: [7, 2], text: `${n(C.CONSTRUCTION_COST.road * C.CONSTRUCTION_COST_ROAD_WALL_RATIO)} energy` },
            ],
        }],
        'StructureRampart': [{
            type: 'timeline', title: 'The first ticks of a new rampart', span: 3 * C.RAMPART_DECAY_TIME, unit: 'ticks since it was built', ticks: seq(0, 3).map(i => i * C.RAMPART_DECAY_TIME),
            caption: `A rampart is built with ${C.RAMPART_HITS} hit and loses ${C.RAMPART_DECAY_AMOUNT} every ${C.RAMPART_DECAY_TIME} ticks. With ${C.RAMPART_DECAY_AMOUNT} hits or fewer at a decay it is removed, so repair it right after building.`,
            rows: [
                { label: `Left at ${C.RAMPART_HITS} hit`, segs: [{ from: 0, to: C.RAMPART_DECAY_TIME, text: 'standing', tone: 'warn' }], marks: [{ at: C.RAMPART_DECAY_TIME, text: 'first decay: removed', tone: 'bad' }] },
                { label: 'Repaired to 10,000 hits', segs: [{ from: 0, to: 3 * C.RAMPART_DECAY_TIME, text: 'standing', tone: 'good' }], marks: seq(1, 3).map(i => ({ at: i * C.RAMPART_DECAY_TIME, text: '−' + C.RAMPART_DECAY_AMOUNT })) },
            ],
        }],
        'Creep.signController': [action({
            title: 'signController', caption: 'Next to any controller, owned or not. No body part is needed, and an empty text removes the sign.',
            body: 'M', actor: 'creep', target: 'controller', targetOpts: { neutral: true }, targetLabel: 'any controller', range: 1, tone: 'ink', effect: ['no body part', 'needed'],
        })],
        'Creep.generateSafeMode': [action({
            title: 'generateSafeMode', caption: `Next to the controller, with ${n(C.SAFE_MODE_COST)} ghodium in the creep. The controller gets one more safe mode to activate.`,
            body: 'CCMM', actorOpts: { carry: 1 }, actor: 'creep', target: 'controller', targetOpts: { level: 4 }, targetLabel: 'controller', range: 1, tone: 'accent', effect: [`${n(C.SAFE_MODE_COST)} ghodium:`, '1 more safe mode'],
        })],
        'Creep.drop': [{
            type: 'panels', title: 'Where a dropped resource ends up',
            caption: `drop puts the resource on the creep's own tile. A container there takes it first; what is left becomes a pile that loses ceil(amount / ${n(C.ENERGY_DECAY)}) every tick.`,
            panels: [
                {
                    tag: 'On a container: it goes in', tone: 'good', size: [5, 3],
                    things: [{ is: 'container', at: [1, 1], fill: 0.8, label: 'container' }, { is: 'creep', at: [3, 1], body: 'CCMM', label: 'creep, moved on' }],
                    paths: [{ via: [[1, 1], [2, 1], [3, 1]], dashed: true }],
                },
                {
                    tag: 'On a bare tile: a pile', tone: 'warn', size: [5, 3],
                    things: [{ is: 'energy', at: [1, 1], big: true, label: 'pile' }, { is: 'creep', at: [3, 1], body: 'CCMM', label: 'creep, moved on' }],
                    paths: [{ via: [[1, 1], [2, 1], [3, 1]], dashed: true }],
                },
            ],
        }],
        'Store.getFreeCapacity': [{
            type: 'panels', title: 'With and without the resource', wide: true,
            caption: 'A spawn, extension, tower, link or lab has a capacity per resource, so the call needs the resource. Without it the result is null, which is falsy like 0.',
            panels: [
                {
                    tag: 'Container: one shared capacity', size: [8, 3],
                    things: [{ is: 'container', at: [1, 1], fill: 0.6, label: [`${n(C.CONTAINER_CAPACITY * 0.6)} of`, n(C.CONTAINER_CAPACITY)] }],
                    notes: [{ at: [2.2, 0.85], anchor: 'start', text: ['getFreeCapacity()', `gives ${n(C.CONTAINER_CAPACITY * 0.4)}`] }],
                },
                {
                    tag: 'Spawn: a capacity per resource', size: [8, 3],
                    things: [{ is: 'spawn', at: [1, 1], fill: 1 / 3, label: [`${C.SPAWN_ENERGY_CAPACITY / 3} of`, String(C.SPAWN_ENERGY_CAPACITY)] }],
                    notes: [
                        { at: [2.2, 0.3], anchor: 'start', text: ['getFreeCapacity()', 'gives null'], tone: 'bad' },
                        { at: [2.2, 1.4], anchor: 'start', text: ['getFreeCapacity(RESOURCE_ENERGY)', `gives ${C.SPAWN_ENERGY_CAPACITY * 2 / 3}`] },
                    ],
                },
            ],
        }],
        'Tombstone': [{
            type: 'timeline', title: 'How long a tombstone lasts', span: C.MAX_CREEP_SIZE * C.TOMBSTONE_DECAY_PER_PART, unit: 'ticks since the creep died',
            caption: `${C.TOMBSTONE_DECAY_PER_PART} ticks per body part of the dead creep. After that the tombstone is gone and what it held drops on the tile.`,
            rows: [3, 10, 25, C.MAX_CREEP_SIZE].map(p => ({ label: p + ' parts', segs: [{ from: 0, to: p * C.TOMBSTONE_DECAY_PER_PART, tone: 'dim' }], marks: [{ at: p * C.TOMBSTONE_DECAY_PER_PART, text: p * C.TOMBSTONE_DECAY_PER_PART + ' ticks' }] })),
        }],
        'Source': [{
            type: 'timeline', title: 'When a source refills', span: C.ENERGY_REGEN_TIME + 200, unit: 'ticks',
            caption: `The ${C.ENERGY_REGEN_TIME} ticks are counted from the first harvest after a refill, not from the refill itself. A full source has no timer running.`,
            rows: [{
                label: 'Source',
                segs: [{ from: 0, to: 100, text: 'full', tone: 'dim' }, { from: 100, to: 100 + C.ENERGY_REGEN_TIME, text: `ticksToRegeneration counts down from ${C.ENERGY_REGEN_TIME}`, tone: 'energy' }, { from: 100 + C.ENERGY_REGEN_TIME, to: C.ENERGY_REGEN_TIME + 200, text: 'full', tone: 'dim' }],
                marks: [{ at: 100, text: 'first harvest' }, { at: 100 + C.ENERGY_REGEN_TIME, text: 'refilled' }],
            }],
        }],

        // ------------------------------------------------------------ constants
        'const:decay': [{
            type: 'line', title: 'A pile on the ground, tick by tick',
            caption: `Each tick a pile loses ceil(amount / ${n(C.ENERGY_DECAY)}): ${10000 / C.ENERGY_DECAY} per tick at 10,000, 1 per tick from ${n(C.ENERGY_DECAY)} down. A pile of 10,000 is down to ${n(C.ENERGY_DECAY)} after ${n(pileUntil(10000, C.ENERGY_DECAY))} ticks, and those last ${n(C.ENERGY_DECAY)} take another ${n(pileEnd(10000) - pileUntil(10000, C.ENERGY_DECAY))}.`,
            x: { label: 'ticks on the ground', min: 0, max: 3000, step: 500, snap: 100 }, y: { label: 'amount left' },
            series: [10000, 3000, 1000].map(a => ({ name: 'from ' + n(a), pts: pile(a) })), endLabels: false,
        }],
        'const:link': [{
            type: 'bars', title: 'A full link, sent', unit: 'energy',
            caption: `${pct(C.LINK_LOSS_RATIO)} of the amount is lost on the way, rounded up. The sending link then cools down ${C.LINK_COOLDOWN} tick per tile of distance.`,
            rows: [
                { label: 'Sent', value: C.LINK_CAPACITY },
                { label: 'Arrives', value: C.LINK_CAPACITY - Math.ceil(C.LINK_CAPACITY * C.LINK_LOSS_RATIO), tone: 'good' },
                { label: 'Lost', value: Math.ceil(C.LINK_CAPACITY * C.LINK_LOSS_RATIO), tone: 'bad' },
            ],
        }],
    };
};
