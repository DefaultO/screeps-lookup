'use strict';
/*
 * Figures of the base entries: {entry id: [figure, ...]}. Numbers come from the constants (C), so a
 * drawing changes with the game. Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n, seq, levels, action } = h;
    const pct = v => Math.round(v * 100) + '%';
    const grid = (w, hh, fn) => seq(0, hh - 1).map(y => seq(0, w - 1).map(x => fn(x, y)).join(''));
    const towerAt = (base, r) => {
        const a = C.TOWER_OPTIMAL_RANGE, b = C.TOWER_FALLOFF_RANGE, x = Math.min(Math.max(r, a), b);
        return Math.floor(base - base * C.TOWER_FALLOFF * (x - a) / (b - a));
    };
    const energyCap = l => C.CONTROLLER_STRUCTURES.spawn[l] * C.SPAWN_ENERGY_CAPACITY + C.CONTROLLER_STRUCTURES.extension[l] * C.EXTENSION_ENERGY_CAPACITY[l];
    const sendShare = d => 1 - Math.exp(-d / 30);
    const DIRS = [[1, 0, -1, 'TOP'], [2, 1, -1, 'TOP_RIGHT'], [3, 1, 0, 'RIGHT'], [4, 1, 1, 'BOTTOM_RIGHT'], [5, 0, 1, 'BOTTOM'], [6, -1, 1, 'BOTTOM_LEFT'], [7, -1, 0, 'LEFT'], [8, -1, -1, 'TOP_LEFT']];

    // rangedMassAttack: damage per RANGED_ATTACK part by distance
    const massMarks = [];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        if (d) massMarks.push({ at: [x, y], tone: d === 1 ? 'bad' : d === 2 ? 'warn' : 'dim', text: { 1: 10, 2: 4, 3: 1 }[d] });
    }
    // range numbers around a tile: the larger of dx and dy
    const rangeMarks = [];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) {
        const d = Math.max(Math.abs(x - 4), Math.abs(y - 3));
        if (d) rangeMarks.push({ at: [x, y], tone: d === 1 ? 'accent' : d === 2 ? 'a' : 'dim', text: d });
    }
    // level of a room nobody upgrades: full timer at level 8, then half a timer per level
    const lossPts = (() => { const pts = [[0, 8]]; let t = C.CONTROLLER_DOWNGRADE[8]; for (let l = 7; l >= 0; l--) { pts.push([t, l]); if (l) t += C.CONTROLLER_DOWNGRADE[l] / 2; } return pts; })();
    // energy in a source over two refill periods, for a miner with w WORK parts
    const sourcePts = w => {
        const cap = C.SOURCE_ENERGY_CAPACITY, T = C.ENERGY_REGEN_TIME, rate = w * C.HARVEST_POWER, pts = [], empty = cap / rate;
        for (let k = 0; k < 2; k++) {
            pts.push([k * T, cap]);
            if (empty < T) pts.push([k * T + empty, 0], [(k + 1) * T, 0]);
            else pts.push([(k + 1) * T, cap - rate * T]);
        }
        pts.push([2 * T, cap]);
        return pts;
    };

    return {
        // ------------------------------------------------------------ mechanics
        'mechanic:tower': [
            {
                type: 'line', title: 'Tower effect by range',
                caption: `Full effect up to range ${C.TOWER_OPTIMAL_RANGE}, then a straight fall to ${pct(1 - C.TOWER_FALLOFF)} at range ${C.TOWER_FALLOFF_RANGE} and beyond. Every action costs ${C.TOWER_ENERGY_COST} energy.`,
                x: { label: 'range in tiles', min: 0, max: 25, step: 5, snap: 1 }, y: { label: 'hits per action' },
                series: [['Attack', C.TOWER_POWER_ATTACK], ['Heal', C.TOWER_POWER_HEAL], ['Repair', C.TOWER_POWER_REPAIR]].map(([name, base]) => ({ name, pts: seq(0, 25).map(r => [r, towerAt(base, r)]) })),
                marks: [{ x: C.TOWER_OPTIMAL_RANGE, label: 'full up to here', anchor: 'end' }, { x: C.TOWER_FALLOFF_RANGE, label: 'lowest from here' }],
            },
            {
                type: 'map', title: 'The same in a room', cell: 8,
                caption: 'A tower reaches all 50 × 50 tiles. Only the 11 × 11 square around it gets the full effect, and the range is measured as a square, not a circle.',
                rows: grid(50, 50, (x, y) => { const d = Math.max(Math.abs(x - 18), Math.abs(y - 29)); return d === 0 ? 't' : d <= C.TOWER_OPTIMAL_RANGE ? 'f' : d < C.TOWER_FALLOFF_RANGE ? 'm' : 'l'; }),
                key: { t: { label: 'tower', tone: 'ink' }, f: { label: `range 1–${C.TOWER_OPTIMAL_RANGE}: full`, tone: 'a' }, m: { label: `range ${C.TOWER_OPTIMAL_RANGE + 1}–${C.TOWER_FALLOFF_RANGE - 1}: falling`, tone: 'a', weak: true }, l: { label: `range ${C.TOWER_FALLOFF_RANGE}+: ${pct(1 - C.TOWER_FALLOFF)}` } },
            },
        ],
        'mechanic:simultaneous-actions': [
            {
                type: 'ladder', title: 'Which action runs',
                caption: 'Within a group only the action furthest left runs in a tick. The others still return OK and still cost 0.2 CPU.',
                groups: [
                    { title: 'Work actions', note: 'one per tick: the highest one called runs, the others are dropped', ordered: true, items: ['heal', 'rangedHeal', 'attackController', 'dismantle', 'repair', 'build', 'attack', 'harvest'] },
                    { title: 'Ranged actions', note: 'one per tick; build and repair also drop the two attacks', ordered: true, items: ['rangedHeal', 'rangedMassAttack', 'rangedAttack'] },
                    { title: 'Independent', note: 'always run next to anything else', items: ['move', 'transfer', 'withdraw', 'pickup', 'drop', 'upgradeController', 'reserveController', 'claimController', 'signController', 'generateSafeMode', 'say', 'pull'] },
                ],
            },
            {
                type: 'scene', title: 'Three actions in one tick', size: [10, 3],
                caption: 'Move, harvest and transfer do not exclude each other: this creep steps, harvests the source and hands energy to the next creep in the same tick.',
                things: [
                    { is: 'source', at: [1, 0], label: 'source', labelAt: 'right' },
                    { is: 'creep', at: [2, 1], body: 'WWCM', carry: 0.6, label: 'worker', labelAt: 'bottom' },
                    { is: 'creep', at: [4, 1], body: 'CCMM', label: 'hauler', labelAt: 'bottom' },
                ],
                arrows: [
                    { from: [1, 0], to: [2, 1], tone: 'energy' },
                    { from: [2, 1], to: [3, 1], tone: 'ink', gap: [0.42, 0.25] },
                    { from: [3, 1], to: [4, 1], tone: 'energy', gap: [0.2, 0.42] },
                ],
                notes: [{ at: [5.2, 0.55], text: ['harvest + move + transfer:', 'all three run, 0.6 CPU'], anchor: 'start' }],
            },
        ],
        'mechanic:tick-order': [
            {
                type: 'flow', title: 'One tick, start to end', cell: [138, 54],
                caption: 'Every script sees the same snapshot. Calls only queue intents; the engine applies them after all scripts have ended, so your code sees the result in the next tick.',
                nodes: [
                    { id: 'script', at: [0, 0], text: 'All scripts run', sub: 'same snapshot', tone: 'energy' },
                    { id: 'intents', at: [1, 0], text: '1. Intents', sub: 'stores change here' },
                    { id: 'move', at: [2, 0], text: '2. Movement', sub: 'all moves together' },
                    { id: 'tick', at: [3, 0], text: '3. Object ticks', sub: 'damage, heal, decay' },
                    { id: 'next', at: [0, 1], span: 4, text: 'Game.time + 1: the next tick reads the new state', tone: 'accent' },
                ],
                edges: [{ from: 'script', to: 'intents' }, { from: 'intents', to: 'move' }, { from: 'move', to: 'tick' }, { from: 'tick', to: 'next' }, { from: 'next', to: 'script', dashed: true }],
            },
        ],
        'mechanic:damage-and-healing': [
            {
                type: 'body', title: 'Damage eats the body from the front', order: true, stats: false,
                caption: 'Every part has 100 hits and a part at 0 does nothing. After 250 damage this creep has lost both TOUGH parts and half of the first ATTACK part, and still heals and moves.',
                rows: [
                    { label: 'Before', parts: 'TTAAAMMMHH' },
                    { label: 'After 250 damage', parts: 'TTAAAMMMHH', dead: 2, note: 'Put TOUGH first, HEAL and MOVE last.' },
                ],
            },
            {
                type: 'bars', title: 'Effect of one part in one tick', unit: 'hits',
                caption: 'What a single unboosted part does per tick. Healing and damage of a tick are added up and applied together at the end.',
                rows: [
                    { label: 'ATTACK', sub: 'range 1', value: C.ATTACK_POWER, tone: 'A' },
                    { label: 'RANGED_ATTACK', sub: 'range 3', value: C.RANGED_ATTACK_POWER, tone: 'R' },
                    { label: 'HEAL', sub: 'range 1', value: C.HEAL_POWER, tone: 'H' },
                    { label: 'HEAL', sub: 'rangedHeal, range 3', value: C.RANGED_HEAL_POWER, tone: 'H' },
                    { label: 'WORK', sub: 'dismantle, structures only', value: C.DISMANTLE_POWER, tone: 'W' },
                ],
            },
        ],
        'mechanic:movement': [
            {
                type: 'scene', title: 'Fatigue per step, by terrain', size: [9, 3], terrain: ['.........', '...~~~...', '.........'],
                caption: 'Each step makes fatigue of weight × the terrain factor; each MOVE part removes 2 per tick. A road on a swamp or a wall tile counts as road.',
                things: [{ is: 'road', at: [[6, 1], [7, 1], [8, 1]] }, { is: 'creep', at: [0, 1], body: 'WWCMM' }],
                paths: [{ via: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1]], tone: 'ink', dashed: true }],
                notes: [
                    { at: [1.8, 0], text: ['plain × 2', '6 fatigue'], strong: true }, { at: [4, 0], text: ['swamp × 10', '30 fatigue'], strong: true }, { at: [7, 0], text: ['road × 1', '3 fatigue'], strong: true },
                    { at: [-0.35, 0], text: 'weight 3', anchor: 'start' }, { at: [1.5, 2], text: '2 ticks per tile' }, { at: [4, 2], text: '8 ticks per tile' }, { at: [7, 2], text: '1 tick per tile' },
                ],
            },
            {
                type: 'body', title: 'MOVE parts for full speed', stats: false,
                caption: 'Count every part that is not MOVE; a CARRY part counts only while it holds something. Full speed means the fatigue of a step is gone by the next tick.',
                rows: [
                    { label: 'On roads: 1 MOVE per 2 parts', parts: '4W 2C 3M' },
                    { label: 'On plain: 1 MOVE per part', parts: '4W 2C 6M' },
                    { label: 'On swamp: 5 MOVE per part', parts: '1W 5M' },
                ],
            },
        ],
        'mechanic:decay': [
            {
                type: 'bars', title: 'Ticks from full hits to gone, without repair', unit: 'ticks',
                caption: 'A container in a room nobody owns is gone five times faster than in an owned room. A reserved room counts as not owned.',
                rows: [
                    { label: 'Road', sub: 'no traffic', value: C.ROAD_HITS / C.ROAD_DECAY_AMOUNT * C.ROAD_DECAY_TIME },
                    { label: 'Container', sub: 'owned room', value: C.CONTAINER_HITS / C.CONTAINER_DECAY * C.CONTAINER_DECAY_TIME_OWNED },
                    { label: 'Container', sub: 'unowned or reserved room', value: C.CONTAINER_HITS / C.CONTAINER_DECAY * C.CONTAINER_DECAY_TIME, tone: 'bad' },
                    { label: 'Ruin', value: C.RUIN_DECAY, tone: 'dim' },
                    { label: 'Tombstone', sub: '50-part creep', value: 50 * C.TOMBSTONE_DECAY_PER_PART, tone: 'dim' },
                ],
            },
            {
                type: 'bars', title: 'Energy per tick to keep it standing', max: 0.5,
                caption: `Repair costs ${C.REPAIR_COST} energy per hit, so upkeep is the decay per tick times that. One remote container costs as much as 500 plain roads.`,
                rows: [
                    { label: 'Road', value: C.ROAD_DECAY_AMOUNT / C.ROAD_DECAY_TIME * C.REPAIR_COST, text: '0.001' },
                    { label: 'Road on swamp', value: 5 * C.ROAD_DECAY_AMOUNT / C.ROAD_DECAY_TIME * C.REPAIR_COST, text: '0.005' },
                    { label: 'Rampart', value: C.RAMPART_DECAY_AMOUNT / C.RAMPART_DECAY_TIME * C.REPAIR_COST, text: '0.03' },
                    { label: 'Container', sub: 'owned room', value: C.CONTAINER_DECAY / C.CONTAINER_DECAY_TIME_OWNED * C.REPAIR_COST, text: '0.1' },
                    { label: 'Container', sub: 'unowned or reserved room', value: C.CONTAINER_DECAY / C.CONTAINER_DECAY_TIME * C.REPAIR_COST, text: '0.5', tone: 'bad' },
                ],
            },
        ],
        'mechanic:reservation': [
            {
                type: 'line', title: 'Reservation left, one creep working 500 ticks', endLabels: false,
                caption: 'Each call adds 1 tick per CLAIM part and every tick takes 1 away. Two parts only gain 1 per tick; four parts gain 3, so one creep holds the room three times longer.',
                x: { label: 'ticks since the creep arrived', min: 0, max: 2000, step: 500 }, y: { label: 'ticks of reservation left' },
                series: [{ name: '4 CLAIM parts', pts: [[0, 0], [500, 1500], [2000, 0]] }, { name: '2 CLAIM parts', pts: [[0, 0], [500, 500], [1000, 0], [2000, 0]] }],
                marks: [{ x: 500, label: 'creep stops working' }],
            },
            {
                type: 'panels', title: 'What a reservation changes',
                caption: `The sources hold ${n(C.SOURCE_ENERGY_CAPACITY)} instead of ${n(C.SOURCE_ENERGY_NEUTRAL_CAPACITY)}, and other players can neither harvest nor place sites. Container decay stays as fast as before.`,
                panels: [
                    { tag: 'Neutral room', tone: 'dim', size: [5, 3], things: [{ is: 'controller', at: [1, 1], neutral: true }, { is: 'source', at: [3, 1], label: n(C.SOURCE_ENERGY_NEUTRAL_CAPACITY), labelAt: 'bottom' }], note: '5 energy per tick, 3 WORK' },
                    { tag: 'Reserved by you', tone: 'good', size: [5, 3], things: [{ is: 'controller', at: [1, 1] }, { is: 'creep', at: [0, 0], body: 'LLMM' }, { is: 'source', at: [3, 1], label: n(C.SOURCE_ENERGY_CAPACITY), labelAt: 'bottom' }], arrows: [{ from: [0, 0], to: [1, 1], tone: 'L' }], note: '10 energy per tick, 5 WORK' },
                ],
            },
        ],
        'mechanic:controller': [
            {
                type: 'cols', title: 'Energy the room can spend on one creep', x: { label: 'room level', cats: levels(l => String(l)) }, y: { label: 'spawn and extension capacity' },
                caption: 'Spawns and extensions together set the largest body you can build. Levels 7 and 8 add spawns and make every extension bigger.',
                series: [{ name: 'energy', values: levels(energyCap) }],
            },
            {
                type: 'bars', title: 'Upgrade energy to reach the next level',
                caption: 'Each level costs three times the one before. Level 7 to 8 alone is two thirds of the whole way.',
                rows: seq(1, 7).map(l => ({ label: `Level ${l} to ${l + 1}`, value: C.CONTROLLER_LEVELS[l], text: n(C.CONTROLLER_LEVELS[l]) })),
            },
            {
                type: 'cols', title: 'Ticks without an upgrade before the level drops', x: { label: 'room level', cats: levels(l => String(l)) }, y: { label: 'downgrade timer, full' },
                caption: 'A tick with an upgrade adds 100 ticks to the timer, up to these values. After a level-up the timer starts at half.',
                series: [{ name: 'ticks', values: levels(l => C.CONTROLLER_DOWNGRADE[l]) }],
            },
        ],
        'mechanic:safe-mode': [
            {
                type: 'timeline', title: 'After activateSafeMode', span: C.SAFE_MODE_COOLDOWN, unit: 'ticks since activation',
                caption: `Safe mode lasts ${n(C.SAFE_MODE_DURATION)} ticks. The controller cannot start another one until ${n(C.SAFE_MODE_COOLDOWN)} ticks have passed, so ${n(C.SAFE_MODE_COOLDOWN - C.SAFE_MODE_DURATION)} ticks are unprotected.`,
                rows: [
                    { label: 'Safe mode', segs: [{ from: 0, to: C.SAFE_MODE_DURATION, text: 'hostile creeps harmless', tone: 'good' }] },
                    { label: 'Cooldown', segs: [{ from: 0, to: C.SAFE_MODE_COOLDOWN, text: 'cannot activate again', tone: 'bad' }] },
                ],
            },
        ],
        'mechanic:sources': [
            {
                type: 'line', title: 'Energy in a source, by miner size', endLabels: false,
                caption: `A source refills every ${C.ENERGY_REGEN_TIME} ticks and what is left then is lost. 5 WORK empty a ${n(C.SOURCE_ENERGY_CAPACITY)} source exactly in time; 2 WORK leave 60% behind; 10 WORK only stand idle for half the time.`,
                x: { label: 'ticks', min: 0, max: 2 * C.ENERGY_REGEN_TIME, step: 100 }, y: { label: 'energy in the source', max: 3000 },
                series: [{ name: '5 WORK', pts: sourcePts(5) }, { name: '2 WORK', pts: sourcePts(2) }, { name: '10 WORK', pts: sourcePts(10) }],
            },
            {
                type: 'bars', title: 'Source capacity by room', unit: 'energy',
                caption: 'Reserving a neutral room doubles its sources. Rooms without a controller (source keeper and centre rooms) hold the most.',
                rows: [
                    { label: 'Neutral room', sub: '3 WORK drain it', value: C.SOURCE_ENERGY_NEUTRAL_CAPACITY, tone: 'dim' },
                    { label: 'Owned or reserved', sub: '5 WORK drain it', value: C.SOURCE_ENERGY_CAPACITY },
                    { label: 'No controller', sub: '7 WORK drain it', value: C.SOURCE_ENERGY_KEEPER_CAPACITY, tone: 'b' },
                ],
            },
        ],
        'mechanic:nukes': [
            {
                type: 'scene', title: 'Damage to structures where a nuke lands', tile: 36, size: [8, 5],
                caption: `${n(C.NUKE_DAMAGE[0])} on the target tile and ${n(C.NUKE_DAMAGE[2])} on every tile within range 2. A rampart takes the hit first; every creep in the room dies wherever it stands.`,
                marks: [{ at: [1, 0], span: [5, 5], tone: 'warn' }, { at: [3, 2], tone: 'bad' }],
                things: [{ is: 'nuke', at: [3, 2] }, { is: 'storage', at: [4, 1] }, { is: 'rampart', at: [4, 1] }, { is: 'tower', at: [2, 3] }, { is: 'spawn', at: [6, 2], label: 'no damage', labelAt: 'bottom' }],
                notes: [{ at: [3, 1], text: '10M', strong: true }, { at: [1.6, 0.1], text: '5M each', strong: true }],
            },
            {
                type: 'timeline', title: 'From launch to the next launch', span: C.NUKER_COOLDOWN, unit: 'ticks since launch',
                caption: `The defender sees the nuke for ${n(C.NUKE_LAND_TIME)} ticks before it lands. The nuker is busy for twice as long.`,
                rows: [
                    { label: 'Nuke', segs: [{ from: 0, to: C.NUKE_LAND_TIME, text: 'in flight, visible in FIND_NUKES', tone: 'bad' }], marks: [{ at: C.NUKE_LAND_TIME, text: 'lands', tone: 'bad' }] },
                    { label: 'Nuker', segs: [{ from: 0, to: C.NUKER_COOLDOWN, text: 'cooldown', tone: 'dim' }] },
                ],
            },
        ],
        'mechanic:room-types': [
            {
                type: 'map', title: 'One sector of the world map', cell: 26,
                caption: 'Rooms whose x or y number ends in 0 are highways. The nine rooms in the middle have no controller: eight source keeper rooms around a centre room. All others can be claimed.',
                rows: grid(11, 11, (x, y) => (x % 10 === 0 || y % 10 === 0 ? 'h' : x === 5 && y === 5 ? 'c' : x >= 4 && x <= 6 && y >= 4 && y <= 6 ? 'k' : '.')),
                xlabels: seq(0, 10).map(String), ylabels: seq(0, 10).map(String),
                key: { h: { label: 'highway: power banks, deposits', tone: 'a' }, k: { label: 'source keeper room', tone: 'b' }, c: { label: 'centre room: portals', tone: 'c' }, '.': { label: 'room with a controller' } },
            },
        ],
        'mechanic:creep-death': [
            {
                type: 'line', title: 'Body energy returned when a creep goes', endLabels: false,
                caption: `Recycling at a spawn returns the unused share of the body; dying or suicide returns ${pct(C.CREEP_CORPSE_RATE)} of that. Either way at most 125 energy per part, and a creep at the end of its life returns almost nothing.`,
                x: { label: 'ticks of life left', min: 0, max: C.CREEP_LIFE_TIME, step: 300 }, y: { label: 'share of the body cost', max: 1 },
                series: [{ name: 'recycleCreep', pts: [[0, 0], [C.CREEP_LIFE_TIME, 1]] }, { name: 'death or suicide', pts: [[0, 0], [C.CREEP_LIFE_TIME, C.CREEP_CORPSE_RATE]] }],
            },
        ],
        'mechanic:cpu': [
            {
                type: 'flow', title: 'Where the CPU of a tick comes from', cell: [150, 54],
                caption: 'What a tick does not use goes into the bucket. A tick may spend its limit plus what the bucket holds, up to 500 in total.',
                nodes: [
                    { id: 'limit', at: [0, 0], text: 'Your limit', sub: 'per tick', tone: 'energy' },
                    { id: 'tick', at: [1, 0], text: 'This tick', sub: 'may use up to 500', tone: 'accent' },
                    { id: 'bucket', at: [1, 1], text: 'Bucket', sub: 'at most 10,000' },
                    { id: 'fee', at: [2, 0], text: 'Run time', sub: '+ 0.2 per OK action' },
                ],
                edges: [{ from: 'limit', to: 'tick' }, { from: 'tick', to: 'bucket', label: 'unused', both: true }, { from: 'tick', to: 'fee', label: 'spent on' }],
            },
            {
                type: 'bars', title: 'Intent fees of one creep in one tick', unit: 'CPU', max: 0.8,
                caption: 'Each action that returns OK costs 0.2 on top of its run time. A call that returns an error costs only its run time, so check cheap conditions first.',
                rows: [
                    { label: 'move', value: 0.2 },
                    { label: 'move + harvest', value: 0.4 },
                    { label: 'move + harvest + transfer', value: 0.6 },
                    { label: 'harvest returns ERR_NOT_IN_RANGE', value: 0, text: '0', tone: 'dim' },
                ],
            },
        ],
        'mechanic:memory': [
            {
                type: 'flow', title: 'What happens to Memory in a tick', cell: [138, 54],
                caption: 'Memory is one JSON string. It is parsed the first time you touch it in a tick and written back at the end, and both cost CPU in proportion to its size. The global scope skips both but is lost on a reset.',
                nodes: [
                    { id: 'raw', at: [0, 0], text: 'Stored string', sub: 'at most 2 MB' },
                    { id: 'parse', at: [1, 0], text: 'JSON.parse', sub: 'on first access', tone: 'warn' },
                    { id: 'code', at: [2, 0], text: 'Your code', sub: 'reads and writes', tone: 'energy' },
                    { id: 'save', at: [3, 0], text: 'JSON.stringify', sub: 'at the end of a tick', tone: 'warn' },
                    { id: 'global', at: [2, 1], text: 'global scope', sub: 'free, lost on reset' },
                ],
                edges: [{ from: 'raw', to: 'parse' }, { from: 'parse', to: 'code' }, { from: 'code', to: 'save' }, { from: 'code', to: 'global', both: true, dashed: true }],
            },
        ],
        'mechanic:ownership': [
            {
                type: 'panels', title: 'Withdrawing from a container that is not yours',
                caption: 'A container has no owner, so anyone can withdraw from it. A closed rampart of another player on the same tile blocks that.',
                panels: [
                    { tag: 'No rampart: works', tone: 'good', size: [4, 3], things: [{ is: 'container', at: [2, 1], fill: 0.8 }, { is: 'creep', at: [1, 1], body: 'CCMM', label: 'you', labelAt: 'bottom' }], arrows: [{ from: [2, 1], to: [1, 1], tone: 'energy' }] },
                    { tag: 'Closed rampart of another player: blocked', tone: 'bad', size: [4, 3], things: [{ is: 'container', at: [2, 1], fill: 0.8 }, { is: 'rampart', at: [2, 1], foe: true }, { is: 'creep', at: [1, 1], body: 'CCMM', label: 'you', labelAt: 'bottom' }], notes: [{ at: [2.9, 0.1], text: 'ERR_NOT_OWNER', anchor: 'end', strong: true }] },
                ],
            },
        ],
        'mechanic:stores': [
            {
                type: 'bars', title: 'Shared stores: any mix up to the total',
                caption: 'These hold every resource. Spawn, extension, tower, link, lab, nuker and power spawn instead have a fixed capacity per resource and take nothing else.',
                rows: [
                    { label: 'Creep', sub: '1 CARRY part', value: C.CARRY_CAPACITY, text: n(C.CARRY_CAPACITY) },
                    { label: 'Container', value: C.CONTAINER_CAPACITY, text: n(C.CONTAINER_CAPACITY) },
                    { label: 'Factory', value: C.FACTORY_CAPACITY, text: n(C.FACTORY_CAPACITY) },
                    { label: 'Terminal', value: C.TERMINAL_CAPACITY, text: n(C.TERMINAL_CAPACITY) },
                    { label: 'Storage', value: C.STORAGE_CAPACITY, text: n(C.STORAGE_CAPACITY) },
                ],
            },
        ],
        'mechanic:invaders': [
            {
                type: 'flow', title: 'When a raid comes', cell: [140, 58],
                caption: `A room is raided only when all three hold. Reserve or own every neighbouring room and no raid can enter.`,
                nodes: [
                    { id: 'a', at: [0, 0], text: 'Energy harvested', sub: `passes about ${n(C.INVADERS_ENERGY_GOAL)}` },
                    { id: 'b', at: [1, 0], text: 'Stronghold alive', sub: 'in the same sector' },
                    { id: 'c', at: [2, 0], text: 'A free exit', sub: 'neighbour not owned' },
                    { id: 'd', at: [3, 0], text: 'Raid', sub: 'counter starts again', tone: 'bad' },
                ],
                edges: [{ from: 'a', to: 'b', label: 'and' }, { from: 'b', to: 'c', label: 'and' }, { from: 'c', to: 'd' }],
            },
        ],
        'mechanic:room-loss': [
            {
                type: 'line', title: 'A level 8 room that nobody upgrades', endLabels: false,
                caption: `The full level 8 timer runs first, then half a timer for every level below. After about ${n(lossPts[lossPts.length - 1][0])} ticks the room is neutral; the structures stay but stop working.`,
                x: { label: 'ticks without an upgrade', min: 0, max: 450000, step: 100000 }, y: { label: 'room level', max: 8 },
                series: [{ name: 'room level', step: true, pts: lossPts.concat([[450000, 0]]) }],
            },
        ],
        'mechanic:structure-destruction': [
            {
                type: 'panels', title: 'What is left of a full storage',
                caption: `Destroyed by damage or destroy(), a structure leaves a ruin that keeps its contents for ${C.RUIN_DECAY} ticks. A nuke leaves nothing.`,
                panels: [
                    { tag: 'Attack, dismantle, destroy()', tone: 'good', size: [5, 3], things: [{ is: 'ruin', at: [2, 1], label: 'ruin with the store', labelAt: 'bottom' }, { is: 'creep', at: [3, 1], body: 'CCMM' }], arrows: [{ from: [2, 1], to: [3, 1], tone: 'energy' }] },
                    { tag: 'Nuke', tone: 'bad', size: [5, 3], marks: [{ at: [2, 1], tone: 'bad' }], things: [{ is: 'nuke', at: [2, 1], label: 'no ruin, contents lost', labelAt: 'bottom' }] },
                ],
            },
        ],

        // ------------------------------------------------------------ recipes
        'recipe:harvest-and-haul': [
            {
                type: 'scene', title: 'The income loop', size: [11, 4], terrain: ['##.........', '#..........', '...........', '...........'],
                caption: 'The miner never moves: it stands on a container and its harvest falls in. Haulers carry from there to the spawn and extensions. 5 WORK parts empty the source exactly as fast as it refills.',
                things: [
                    { is: 'road', at: [[3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 1]] },
                    { is: 'source', at: [1, 1], label: 'source', labelAt: 'right' },
                    { is: 'container', at: [2, 2], under: true }, { is: 'creep', at: [2, 2], body: '5W M', label: ['miner on', 'a container'], labelAt: 'bottom' },
                    { is: 'creep', at: [5, 2], body: '4C 2M', carry: 0.9, label: 'hauler', labelAt: 'bottom' },
                    { is: 'spawn', at: [9, 1], label: 'spawn', labelAt: 'bottom' }, { is: 'extension', at: [[8, 0], [9, 0], [10, 0], [10, 1]] },
                ],
                arrows: [{ from: [1, 1], to: [2, 2], tone: 'energy' }, { from: [5, 2], to: [7, 2], tone: 'energy', label: 'withdraw, carry, transfer', dy: -17, gap: [0.45, 0.2] }],
                notes: [{ at: [2.6, 0.2], text: '10 energy per tick', anchor: 'start' }],
            },
        ],
        'recipe:reserve-and-remote-mine': [
            {
                type: 'scene', title: 'A remote room', size: [12, 4], terrain: ['.....xx.....', '.....xx.....', '.....xx.....', '.....xx.....'],
                caption: 'Home on the left, the reserved room on the right. A reserver keeps the controller, a miner sits on a container at the source, and haulers cross the exit with the energy.',
                things: [
                    { is: 'road', at: [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2]] },
                    { is: 'storage', at: [1, 2], label: 'storage', labelAt: 'bottom' },
                    { is: 'creep', at: [4, 2], body: '6C 3M', carry: 0.9, label: 'hauler', labelAt: 'bottom' },
                    { is: 'source', at: [10, 3] }, { is: 'container', at: [9, 2], under: true }, { is: 'creep', at: [9, 2], body: '5W M', label: 'miner', labelAt: 'right' },
                    { is: 'controller', at: [10, 0], neutral: true }, { is: 'creep', at: [9, 0], body: 'LLMM', label: 'reserver', labelAt: 'left' },
                ],
                arrows: [{ from: [9, 0], to: [10, 0], tone: 'L' }, { from: [10, 3], to: [9, 2], tone: 'energy' }, { from: [7, 2], to: [5, 2], tone: 'energy', gap: [0.2, 0.45] }],
                notes: [{ at: [2, 0], text: 'your room', strong: true }, { at: [5.5, 0], text: 'exit', strong: true }, { at: [8, 3.25], text: 'reserved room', strong: true, anchor: 'end' }],
            },
        ],
        'recipe:claim-a-room': [
            {
                type: 'scene', title: 'The first ticks in a new room', size: [10, 4],
                caption: 'One creep with a CLAIM part claims the controller at range 1. Builders from the old room then build the spawn from energy they harvest on the spot.',
                things: [
                    { is: 'controller', at: [1, 1], label: 'controller', labelAt: 'bottom' }, { is: 'creep', at: [2, 0], body: 'LM', label: 'claimer', labelAt: 'right' },
                    { is: 'site', at: [5, 2], progress: 0.3, label: ['spawn site', n(C.CONSTRUCTION_COST.spawn) + ' energy'], labelAt: 'bottom' },
                    { is: 'creep', at: [6, 1], body: 'WWCCMM', carry: 0.6, label: 'builder', labelAt: 'right' },
                    { is: 'source', at: [9, 3] }, { is: 'creep', at: [8, 2], body: 'WWCCMM', label: 'builder', labelAt: 'top' },
                ],
                arrows: [{ from: [2, 0], to: [1, 1], tone: 'L' }, { from: [6, 1], to: [5, 2], tone: 'good' }, { from: [9, 3], to: [8, 2], tone: 'energy' }],
            },
        ],
        'recipe:tower-logic': [
            {
                type: 'flow', title: 'What each tower does this tick', cell: [178, 54],
                caption: 'A tower acts once per tick, so decide in this order. If you call several, the engine keeps heal over repair and repair over attack.',
                nodes: [
                    { id: 'q1', at: [0, 0], text: 'Hostile you can hurt?', sub: 'damage beats its healing' },
                    { id: 'q2', at: [0, 1], text: 'Damaged creep of yours?' },
                    { id: 'q3', at: [0, 2], text: 'Urgent repair close by?', sub: 'rampart about to fall' },
                    { id: 'a1', at: [1, 0], text: 'attack', tone: 'bad', mono: true }, { id: 'a2', at: [1, 1], text: 'heal', tone: 'good', mono: true }, { id: 'a3', at: [1, 2], text: 'repair', tone: 'accent', mono: true },
                ],
                edges: [{ from: 'q1', to: 'a1', label: 'yes' }, { from: 'q2', to: 'a2', label: 'yes' }, { from: 'q3', to: 'a3', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' }, { from: 'q2', to: 'q3', label: 'no' }],
            },
        ],
        'recipe:link-network': [
            {
                type: 'scene', title: 'Links instead of haulers', size: [12, 4],
                caption: `The miner fills the link beside it. One call moves the energy across the room; ${pct(C.LINK_LOSS_RATIO)} is lost and the sending link cools down for as many ticks as the distance in tiles.`,
                things: [
                    { is: 'source', at: [0, 1] }, { is: 'creep', at: [1, 2], body: '5W C M', label: 'miner', labelAt: 'bottom' }, { is: 'link', at: [2, 1], label: 'source link', labelAt: 'top' },
                    { is: 'link', at: [9, 1], label: 'storage link', labelAt: 'top' }, { is: 'storage', at: [10, 2], label: 'storage', labelAt: 'bottom' }, { is: 'creep', at: [9, 2], body: 'CCM', label: 'filler', labelAt: 'bottom' },
                ],
                arrows: [
                    { from: [0, 1], to: [1, 2], tone: 'energy' }, { from: [1, 2], to: [2, 1], tone: 'energy' },
                    { from: [2, 1], to: [9, 1], tone: 'energy', label: `transferEnergy: ${C.LINK_CAPACITY} in, ${Math.floor(C.LINK_CAPACITY * (1 - C.LINK_LOSS_RATIO))} out`, side: 'below' },
                    { from: [9, 1], to: [9, 2], tone: 'energy', gap: [0.4, 0.36] }, { from: [9, 2], to: [10, 2], tone: 'energy' },
                ],
            },
        ],
        'recipe:labs-and-boosts': [
            {
                type: 'scene', title: 'Lab layout: every product lab within range 2 of both source labs', size: [10, 5],
                caption: `The two labs in the middle hold the reagents. Each of the others calls runReaction on them and makes ${C.LAB_REACTION_AMOUNT} units per reaction.`,
                ranges: [{ at: [3, 2], r: 2, label: 'range 2 of the left source lab', labelAt: 'bl' }],
                things: [
                    { is: 'lab', at: [3, 2], kind: 'O' }, { is: 'lab', at: [4, 2], kind: 'H' },
                    { is: 'lab', at: [2, 1], kind: 'OH' }, { is: 'lab', at: [3, 1], kind: 'OH' }, { is: 'lab', at: [4, 1], kind: 'OH' }, { is: 'lab', at: [5, 1], kind: 'OH' },
                    { is: 'lab', at: [2, 3], kind: 'OH' }, { is: 'lab', at: [3, 3], kind: 'OH' }, { is: 'lab', at: [4, 3], kind: 'OH' }, { is: 'lab', at: [5, 3], kind: 'OH' },
                ],
                arrows: [{ from: [3, 2], to: [5, 1], tone: 'c', gap: [0.4, 0.42] }, { from: [4, 2], to: [5, 1], tone: 'c' }],
                notes: [{ at: [6, 1], text: ['runReaction', '(source 1, source 2)'], anchor: 'start' }, { at: [6, 2.4], text: ['O + H → OH'], anchor: 'start', strong: true }],
            },
        ],
        'recipe:terminal-and-market': [
            {
                type: 'line', title: 'Energy a terminal pays to send, by distance', endLabels: false,
                caption: 'The sender pays energy on top of the cargo: a share of the amount that grows with the distance in rooms. At 30 rooms it is 63%, and sending energy itself across 60 rooms costs almost as much as it delivers.',
                x: { label: 'distance in rooms', min: 0, max: 100, step: 20, snap: 5 }, y: { label: 'energy paid, as a share of the amount sent', max: 1 },
                series: [{ name: 'share of the amount', pts: seq(0, 100, 5).map(d => [d, Math.round(sendShare(d) * 1000) / 1000]) }],
                marks: [{ x: 30, label: '30 rooms: 63%' }],
            },
        ],
        'recipe:spawning': [
            {
                type: 'body', title: 'What the energy of each level buys',
                caption: 'A body may cost at most the capacity of all spawns and extensions. Spawning takes 3 ticks per part, so a 50-part creep blocks a spawn for 150 ticks.',
                rows: [
                    { label: 'Level 1, 300 energy', parts: 'WWCM' },
                    { label: 'Level 2, 550 energy', parts: '3W 2C 3M' },
                    { label: 'Level 3, 800 energy: a miner', parts: '5W C 3M' },
                    { label: 'Level 4, 1300 energy: a hauler', parts: '16C 8M' },
                ],
            },
            {
                type: 'line', title: 'Renewing against spawning anew', endLabels: false,
                caption: `Each renewCreep adds floor(600 / parts) ticks of life. The energy per tick of life is the same as for a new creep, but the spawn is busy ${C.SPAWN_RENEW_RATIO} times less. Small creeps renew fast, large ones slowly.`,
                x: { label: 'body parts', min: 1, max: 50, ticks: [1, 10, 20, 30, 40, 50], snap: 1 }, y: { label: 'ticks of life per renew call' },
                series: [{ name: 'ticks added', step: true, pts: seq(1, 50).map(p => [p, Math.floor(600 / p)]) }],
            },
        ],
        'recipe:roads-and-upkeep': [
            {
                type: 'bars', title: 'Build cost of one tile', unit: 'energy',
                caption: 'A road costs five times as much on swamp and 150 times as much through a wall, and it has that many times the hits and decay. A container costs as much as 17 plain roads.',
                rows: [
                    { label: 'Road on plain', value: C.CONSTRUCTION_COST.road },
                    { label: 'Road on swamp', value: C.CONSTRUCTION_COST.road * C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO },
                    { label: 'Container', value: C.CONSTRUCTION_COST.container, tone: 'b' },
                    { label: 'Road through a wall', value: C.CONSTRUCTION_COST.road * C.CONSTRUCTION_COST_ROAD_WALL_RATIO, tone: 'dim' },
                ],
            },
            {
                type: 'scene', title: 'Traffic wears a road', size: [9, 3], terrain: ['.........', '.........', '.........'],
                caption: `Besides the decay every ${n(C.ROAD_DECAY_TIME)} ticks, each creep that steps on a road tile brings its next decay 1 tick closer per body part. A 50-part hauler wears a road 50 times faster than a scout.`,
                things: [{ is: 'road', at: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1]] }, { is: 'creep', at: [2, 1], body: 'M', label: ['1 part', '1 tick per step'], labelAt: 'bottom' }, { is: 'creep', at: [6, 1], body: '33C 17M', carry: 1, label: ['50 parts', '50 ticks per step'], labelAt: 'bottom' }],
            },
        ],
        'recipe:observer-and-power': [
            {
                type: 'map', title: 'Rooms an observer can watch', cell: 14,
                caption: `Any room up to ${C.OBSERVER_RANGE} rooms away in x and in y, one per tick. From a room next to a highway crossing that is four highway lanes to scan for power banks and deposits.`,
                rows: grid(23, 23, (x, y) => { const hw = (x + 4) % 10 === 0 || (y + 4) % 10 === 0, inR = Math.abs(x - 11) <= C.OBSERVER_RANGE && Math.abs(y - 11) <= C.OBSERVER_RANGE; return x === 11 && y === 11 ? 'o' : inR ? (hw ? 'h' : 'r') : hw ? 'x' : '.'; }),
                key: { o: { label: 'observer', tone: 'ink' }, h: { label: 'highway in range', tone: 'b' }, r: { label: 'in range', tone: 'a', weak: true }, x: { label: 'highway out of range', tone: 'b', weak: true }, '.': { label: 'out of range' } },
            },
        ],

        // ------------------------------------------------------------ creep actions
        'Creep.harvest': [action({
            title: 'harvest', caption: `Stand next to the source; diagonal counts. Each WORK part takes ${C.HARVEST_POWER} energy per tick, and what the creep cannot carry falls on its tile.`,
            body: 'WWCM', actor: 'creep', target: 'source', range: 1, flow: 'in', tone: 'energy', effect: [`${C.HARVEST_POWER} energy per WORK`, 'per tick'],
        })],
        'Creep.build': [action({
            title: 'build', caption: `Up to 3 tiles away, measured as a square. Each WORK part spends ${C.BUILD_POWER} energy per tick and adds ${C.BUILD_POWER} progress.`,
            body: 'WWCCMM', actorOpts: { carry: 0.8 }, target: 'site', targetOpts: { progress: 0.4 }, targetLabel: 'construction site', range: 3, tone: 'good', effect: [`${C.BUILD_POWER} energy per WORK`, 'per tick'],
        })],
        'Creep.repair': [action({
            title: 'repair', caption: `Up to 3 tiles away. Each WORK part restores ${C.REPAIR_POWER} hits per tick for ${C.REPAIR_POWER * C.REPAIR_COST} energy.`,
            body: 'WWCCMM', actorOpts: { carry: 0.8 }, target: 'container', targetOpts: { fill: 0.4 }, targetLabel: 'damaged container', range: 3, tone: 'good', effect: [`${C.REPAIR_POWER} hits per WORK`, `for ${C.REPAIR_POWER * C.REPAIR_COST} energy`],
        })],
        'Creep.upgradeController': [action({
            title: 'upgradeController', caption: `Up to 3 tiles away. Each WORK part turns ${C.UPGRADE_CONTROLLER_POWER} energy per tick into ${C.UPGRADE_CONTROLLER_POWER} progress; at level 8 the room is capped at ${C.CONTROLLER_MAX_UPGRADE_PER_TICK} per tick.`,
            body: '4W C M', actorOpts: { carry: 0.8 }, target: 'controller', targetOpts: { level: 4 }, targetLabel: 'controller', range: 3, tone: 'energy', effect: [`${C.UPGRADE_CONTROLLER_POWER} energy per WORK`, 'per tick'],
        })],
        'Creep.attack': [action({
            title: 'attack', caption: `Only next to the target. Each ATTACK part does ${C.ATTACK_POWER} damage, and a creep that is hit strikes back with its own ATTACK parts.`,
            body: 'AAMM', actor: 'you', target: 'creep', targetOpts: { body: 'TAM', foe: true }, targetLabel: 'hostile', range: 1, tone: 'bad', effect: [`${C.ATTACK_POWER} damage per ATTACK`, 'per tick'],
        })],
        'Creep.rangedAttack': [action({
            title: 'rangedAttack', caption: `One target up to 3 tiles away, ${C.RANGED_ATTACK_POWER} damage per RANGED_ATTACK part at any of those distances.`,
            body: 'RRMM', actor: 'you', target: 'creep', targetOpts: { body: 'TAM', foe: true }, targetLabel: 'hostile', range: 3, tone: 'bad', effect: [`${C.RANGED_ATTACK_POWER} damage per`, 'RANGED_ATTACK'],
        })],
        'Creep.rangedMassAttack': [{
            type: 'scene', title: 'rangedMassAttack', tile: 32, size: [7, 7],
            caption: 'Hits every hostile creep and structure within range 3. Damage per RANGED_ATTACK part falls with distance: 10 next to the creep, 4 at range 2, 1 at range 3.',
            marks: massMarks, things: [{ is: 'creep', at: [3, 3], body: 'RRRMMM' }],
        }],
        'Creep.heal': [action({
            title: 'heal', caption: `Next to the target, or on itself. Each HEAL part restores ${C.HEAL_POWER} hits per tick.`,
            body: 'HHMM', actor: 'healer', target: 'creep', targetOpts: { body: 'TAAMM' }, targetLabel: 'damaged creep', range: 1, tone: 'good', effect: [`${C.HEAL_POWER} hits per HEAL`, 'per tick'],
        })],
        'Creep.rangedHeal': [action({
            title: 'rangedHeal', caption: `Up to 3 tiles away, but only ${C.RANGED_HEAL_POWER} hits per HEAL part: a third of heal at range 1.`,
            body: 'HHMM', actor: 'healer', target: 'creep', targetOpts: { body: 'TAAMM' }, targetLabel: 'damaged creep', range: 3, tone: 'good', effect: [`${C.RANGED_HEAL_POWER} hits per HEAL`, 'per tick'],
        })],
        'Creep.dismantle': [action({
            title: 'dismantle', caption: `Next to the structure. Each WORK part removes ${C.DISMANTLE_POWER} hits and returns ${C.DISMANTLE_POWER * C.DISMANTLE_COST} energy to the creep. It works on anyone's structures.`,
            body: 'WWWWMM', target: 'wall', targetLabel: 'wall', range: 1, tone: 'bad', effect: [`${C.DISMANTLE_POWER} hits per WORK`, `${C.DISMANTLE_POWER * C.DISMANTLE_COST} energy back`],
        })],
        'Creep.transfer': [action({
            title: 'transfer', caption: 'Next to the target, any amount up to what the creep carries and the target can take. It works into other players\' creeps and structures too.',
            body: 'CCMM', actorOpts: { carry: 1 }, actor: 'hauler', target: 'spawn', targetOpts: { fill: 0.3 }, targetLabel: 'spawn', range: 1, tone: 'energy', effect: ['any amount,', 'in the same tick'],
        })],
        'Creep.withdraw': [action({
            title: 'withdraw', caption: 'Next to a structure, tombstone or ruin. Not from creeps: the other creep has to transfer.',
            body: 'CCMM', actor: 'hauler', target: 'container', targetOpts: { fill: 0.9 }, targetLabel: 'container', range: 1, flow: 'in', tone: 'energy', effect: ['any amount,', 'in the same tick'],
        })],
        'Creep.pickup': [action({
            title: 'pickup', caption: 'Next to a pile on the ground, or standing on it. A pile loses ceil(amount / 1000) every tick, so pick it up early.',
            body: 'CCMM', actor: 'hauler', target: 'energy', targetOpts: { big: true }, targetLabel: 'dropped energy', range: 1, flow: 'in', tone: 'energy', effect: ['as much as fits'],
        })],
        'Creep.claimController': [action({
            title: 'claimController', caption: 'Next to a neutral controller, with at least one CLAIM part. The room becomes yours at level 1 if your GCL allows another room.',
            body: 'LM', actor: 'claimer', target: 'controller', targetOpts: { neutral: true }, targetLabel: 'neutral controller', range: 1, tone: 'L', effect: ['needs a free', 'GCL slot'],
        })],
        'Creep.reserveController': [action({
            title: 'reserveController', caption: `Next to a neutral controller. Each CLAIM part adds ${C.CONTROLLER_RESERVE} tick per call, up to ${n(C.CONTROLLER_RESERVE_MAX)}; the reservation loses 1 per tick.`,
            body: 'LLMM', actor: 'reserver', target: 'controller', targetOpts: { neutral: true }, targetLabel: 'neutral controller', range: 1, tone: 'L', effect: [`+${C.CONTROLLER_RESERVE} tick per CLAIM`, 'per call'],
        })],
        'Creep.attackController': [action({
            title: 'attackController', caption: `Next to a controller owned or reserved by someone else. Each CLAIM part takes ${C.CONTROLLER_CLAIM_DOWNGRADE} ticks off the downgrade timer or 1 tick off a reservation, then the controller is blocked for ${n(C.CONTROLLER_ATTACK_BLOCKED_UPGRADE)} ticks.`,
            body: 'LLLLLMMMMM', actor: 'attacker', target: 'controller', targetOpts: { foe: true, level: 5 }, targetLabel: 'their controller', range: 1, tone: 'bad', effect: [`−${C.CONTROLLER_CLAIM_DOWNGRADE} ticks per CLAIM`],
        })],
        'Creep.pull': [{
            type: 'scene', title: 'pull', size: [8, 3],
            caption: 'A creep with MOVE parts drags one without. The puller moves, the pulled creep moves towards the puller in the same tick, and the puller takes all the fatigue.',
            things: [{ is: 'creep', at: [4, 1], body: 'MMMMM', label: 'puller', labelAt: 'bottom' }, { is: 'creep', at: [3, 1], body: 'WWWWW', label: ['miner,', 'no MOVE'], labelAt: 'bottom' }],
            arrows: [{ from: [4, 1], to: [5.6, 1], tone: 'ink', gap: [0.42, 0], label: 'move', dx: 12 }, { from: [3, 1], to: [4, 1], tone: 'accent', gap: [0.36, 0.36] }],
            notes: [{ at: [0.2, -0.05], text: ['puller.pull(miner)', 'miner.move(puller)'], anchor: 'start' }],
        }],
        'StructureLab.runReaction': [{
            type: 'scene', title: 'runReaction', size: [8, 3],
            caption: `Called on the lab that receives the product. Both source labs must be within range 2; each call uses ${C.LAB_REACTION_AMOUNT} of each reagent and makes ${C.LAB_REACTION_AMOUNT} product.`,
            things: [{ is: 'lab', at: [1, 1], kind: 'Z', label: 'source 1', labelAt: 'bottom' }, { is: 'lab', at: [5, 1], kind: 'K', label: 'source 2', labelAt: 'bottom' }, { is: 'lab', at: [3, 1], kind: 'ZK', label: 'this lab', labelAt: 'bottom' }],
            arrows: [{ from: [1, 1], to: [3, 1], tone: 'c', label: `${C.LAB_REACTION_AMOUNT} Z` }, { from: [5, 1], to: [3, 1], tone: 'c', label: `${C.LAB_REACTION_AMOUNT} K` }],
            notes: [{ at: [5.8, 0.1], text: ['Z + K → ZK'], anchor: 'start', strong: true }],
        }],
        'StructureLink.transferEnergy': [{
            type: 'scene', title: 'transferEnergy', size: [10, 3],
            caption: `Any distance inside the room. ${pct(C.LINK_LOSS_RATIO)} of the amount is lost and the sender cools down ${C.LINK_COOLDOWN} tick per tile of distance.`,
            things: [{ is: 'link', at: [1, 1], label: 'sender', labelAt: 'bottom' }, { is: 'link', at: [8, 1], fill: 0, label: 'receiver', labelAt: 'bottom' }],
            arrows: [{ from: [1, 1], to: [8, 1], tone: 'energy', label: `${C.LINK_CAPACITY} sent, ${Math.floor(C.LINK_CAPACITY * (1 - C.LINK_LOSS_RATIO))} arrive, 7 ticks cooldown` }],
        }],
        'StructureSpawn.spawnCreep': [{
            type: 'timeline', title: 'How long a spawn is busy', span: 150, unit: 'ticks',
            caption: `${C.CREEP_SPAWN_TIME} ticks per body part. The creep exists from the first tick (spawning: true) and can be given memory, but acts only when it is out.`,
            rows: [
                { label: 'WWCM (4 parts)', segs: [{ from: 0, to: 12, tone: 'energy' }], marks: [{ at: 12, text: '12 ticks' }] },
                { label: '5W C 3M (9 parts)', segs: [{ from: 0, to: 27, tone: 'energy' }], marks: [{ at: 27, text: '27 ticks' }] },
                { label: '16C 8M (24 parts)', segs: [{ from: 0, to: 72, tone: 'energy' }], marks: [{ at: 72, text: '72 ticks' }] },
                { label: '50 parts', segs: [{ from: 0, to: 150, tone: 'energy' }], marks: [{ at: 150, text: '150 ticks' }] },
            ],
        }],
        'RoomPosition.getRangeTo': [{
            type: 'scene', title: 'Range is the larger of the x and y distance', tile: 32, size: [9, 7],
            caption: 'The number on each tile is its range from the creep. A diagonal step counts as 1, so everything in range n forms a square of 2n + 1 tiles, not a circle.',
            marks: rangeMarks, things: [{ is: 'creep', at: [4, 3], body: 'WCM' }],
        }],

        // ------------------------------------------------------------ constants
        'const:directions': [{
            type: 'scene', title: 'The eight directions', size: [7, 5],
            caption: 'Direction constants count clockwise from TOP, which is 1. move(direction) takes them and getDirectionTo returns them.',
            things: [{ is: 'creep', at: [3, 2], body: 'M' }],
            marks: DIRS.map(d => ({ at: [3 + d[1], 2 + d[2]], tone: 'accent', text: d[0] })),
            arrows: DIRS.map(d => ({ from: [3, 2], to: [3 + d[1], 2 + d[2]], gap: [0.38, 0.32] })),
            notes: DIRS.map(d => ({ at: [3 + 2 * d[1], 2 + 2 * d[2]], text: d[3] })),
        }],
        'const:body-parts': [
            {
                type: 'bars', title: 'Cost of one body part', unit: 'energy',
                caption: 'A body can have up to 50 parts. CLAIM is by far the most expensive and cuts the life of the creep to 600 ticks.',
                rows: [['TOUGH', 'tough', 'T'], ['MOVE', 'move', 'M'], ['CARRY', 'carry', 'C'], ['ATTACK', 'attack', 'A'], ['WORK', 'work', 'W'], ['RANGED_ATTACK', 'ranged_attack', 'R'], ['HEAL', 'heal', 'H'], ['CLAIM', 'claim', 'L']].map(([label, key, tone]) => ({ label, value: C.BODYPART_COST[key], tone })),
            },
        ],
        'const:creep-life': [{
            type: 'timeline', title: 'How long a creep lives', span: C.CREEP_LIFE_TIME, unit: 'ticks', ticks: seq(0, C.CREEP_LIFE_TIME, 300),
            caption: `${n(C.CREEP_LIFE_TIME)} ticks, or ${C.CREEP_CLAIM_LIFE_TIME} with a CLAIM part. A spawn can renew the first kind; a CLAIM creep cannot be renewed.`,
            rows: [
                { label: 'Any other body', segs: [{ from: 0, to: C.CREEP_LIFE_TIME, text: 'alive, can be renewed', tone: 'good' }] },
                { label: 'Body with CLAIM', segs: [{ from: 0, to: C.CREEP_CLAIM_LIFE_TIME, text: 'alive', tone: 'L' }], marks: [{ at: C.CREEP_CLAIM_LIFE_TIME, text: 'dies, no renewal' }] },
            ],
        }],
        'const:tower': [{
            type: 'line', title: 'Tower effect by range',
            caption: `Full effect up to range ${C.TOWER_OPTIMAL_RANGE}, then a straight fall to ${pct(1 - C.TOWER_FALLOFF)} at range ${C.TOWER_FALLOFF_RANGE} and beyond.`,
            x: { label: 'range in tiles', min: 0, max: 25, step: 5, snap: 1 }, y: { label: 'hits per action' },
            series: [['Attack', C.TOWER_POWER_ATTACK], ['Heal', C.TOWER_POWER_HEAL], ['Repair', C.TOWER_POWER_REPAIR]].map(([name, base]) => ({ name, pts: seq(0, 25).map(r => [r, towerAt(base, r)]) })),
        }],
        'const:controller': [{
            type: 'cols', title: 'Structures unlocked by room level', x: { label: 'room level', cats: levels(l => String(l)) }, y: { label: 'allowed in the room' },
            caption: 'Extensions grow with every level; towers and labs arrive late. Level 8 alone doubles the towers and adds four labs.',
            series: [{ name: 'Extensions', values: levels(l => C.CONTROLLER_STRUCTURES.extension[l]) }, { name: 'Labs', values: levels(l => C.CONTROLLER_STRUCTURES.lab[l]) }, { name: 'Towers', values: levels(l => C.CONTROLLER_STRUCTURES.tower[l]) }],
        }],
        'const:structures': [{
            type: 'cols', title: 'Highest hits a rampart or wall can be repaired to', x: { label: 'room level', cats: seq(2, 8).map(String) }, y: { label: 'RAMPART_HITS_MAX' },
            caption: 'The cap grows about threefold per level. Constructed walls can always go to 300M; ramparts depend on the room level.',
            series: [{ name: 'hits', values: seq(2, 8).map(l => C.RAMPART_HITS_MAX[l]) }],
        }],
    };
};
