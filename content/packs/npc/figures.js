'use strict';
/*
 * Figures of the NPC and world entries: {entry id: [figure, ...]}. Numbers come from the constants (C).
 * What the game does not keep in a constant is named here once, with the file that holds it.
 * Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n, seq } = h;
    const pct = v => Math.round(v * 100) + '%';
    const grid = (w, hh, fn) => seq(0, hh - 1).map(y => seq(0, w - 1).map(x => fn(x, y)).join(''));
    const mega = v => v / 1e6 + 'M';

    // Source Keeper (engine keeper-lairs/tick.js): 17 TOUGH, 13 MOVE, then ATTACK and RANGED_ATTACK in turn; 5000 hits
    const KEEPER_BODY = '17T 13M ' + 'AR'.repeat(10);
    const KEEPER_HITS = 5000;
    const KEEPER_MELEE = 10 * C.ATTACK_POWER, KEEPER_RANGED = 10 * C.RANGED_ATTACK_POWER;
    const LAIR_TIMER = C.ENERGY_REGEN_TIME;
    // the guard of the examples: 20 RANGED_ATTACK parts, and as many HEAL parts as cover the keeper's ranged damage
    const GUARD_RANGED = 20, GUARD_HEAL = Math.ceil(KEEPER_RANGED / C.HEAL_POWER);
    const KILL_TICKS = Math.ceil(KEEPER_HITS / (GUARD_RANGED * C.RANGED_ATTACK_POWER));
    const GUARD_BODY = `${GUARD_RANGED}R ${GUARD_HEAL}H ${50 - GUARD_RANGED - GUARD_HEAL}M`;
    const KEEPER_MINER = Math.ceil(C.SOURCE_ENERGY_KEEPER_CAPACITY / C.ENERGY_REGEN_TIME / C.HARVEST_POWER) + 'W C 4M';

    // Stronghold layouts (common lib/strongholds.js, templates bunker1 to bunker5; the number is the level).
    // C core, T tower, c container, r road. Every tile of a layout also carries a rampart.
    const BUNKERS = {
        1: ['Cc', 'rT'],
        2: ['Trr', 'cCc', 'rrT'],
        3: ['rTrc', 'crCr', 'rTrT', 'rrcr'],
        4: ['rrcrr', 'rTrTr', 'crCrc', 'rTrTr', 'rrcrr'],
        5: ['.rrrrr.', 'rcrTrcr', 'rrTrTrr', 'rrrCrrr', 'rrTrTrr', 'rcrTrcr', '.rrrrr.'],
    };
    const LEVELS = seq(1, 5);
    const countOf = (level, ch) => BUNKERS[level].join('').split('').filter(c => c === ch).length;
    const tilesOf = level => BUNKERS[level].join('').replace(/\./g, '').length;
    const bunker = (level, ox, oy) => {
        const things = [], ramparts = [];
        BUNKERS[level].forEach((row, y) => row.split('').forEach((ch, x) => {
            if (ch === '.') return;
            const at = [ox + x, oy + y];
            if (ch === 'C') things.push({ is: 'invaderCore', at });
            if (ch === 'T') things.push({ is: 'tower', at });
            if (ch === 'c') things.push({ is: 'container', at });
            ramparts.push({ is: 'rampart', at, foe: true });
        }));
        return things.concat(ramparts);
    };
    const bunkerPanel = (level, size, ox, oy, extra) => Object.assign({
        tag: `Level ${level}: ${countOf(level, 'T')} tower${countOf(level, 'T') > 1 ? 's' : ''}`, tile: 26, size,
        things: bunker(level, ox, oy), note: `${tilesOf(level)} ramparts of ${n(C.STRONGHOLD_RAMPART_HITS[level])} hits`,
    }, extra || {});
    const STRONGHOLD_DEPLOY = 5000;   // backend-local lib/strongholds.js, strongholdDeployTime
    const towerFar = Math.floor(C.TOWER_POWER_ATTACK * (1 - C.TOWER_FALLOFF));

    // power bank: the pair of the example
    const BANK_ATTACK = 20;
    const bankDamage = BANK_ATTACK * C.ATTACK_POWER, bankBack = bankDamage * C.POWER_BANK_HIT_BACK, bankHeal = Math.ceil(bankBack / C.HEAL_POWER);
    const bankTicks = parts => Math.ceil(C.POWER_BANK_HITS / (parts * C.ATTACK_POWER));
    const bankMinParts = Math.ceil(C.POWER_BANK_HITS / C.ATTACK_POWER / C.POWER_BANK_DECAY);

    // ruins left by a first spawn and by a respawn (backend-local lib/game/api/game.js and lib/utils.js)
    const RUIN_FIRST_SPAWN = 100000, RUIN_RESPAWN = 500000;

    // a lesser core against a full reservation nobody renews: 1 per tick as always, plus the core
    const reserveGone = Math.ceil(C.CONTROLLER_RESERVE_MAX / (1 + C.INVADER_CORE_CONTROLLER_POWER));
    const reserveFull = reserveGone + C.CONTROLLER_RESERVE_MAX / (C.INVADER_CORE_CONTROLLER_POWER - 1);

    // room names: x and y as the engine counts them (utils.js, roomNameToXY)
    const roomName = (x, y) => (x < 0 ? 'W' + (-x - 1) : 'E' + x) + (y < 0 ? 'N' + (-y - 1) : 'S' + y);
    const signed = v => (v < 0 ? '−' + -v : String(v));

    const nukeMarks = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        const centre = x === 2 && y === 2;
        nukeMarks.push({ at: [x, y], tone: centre ? 'bad' : 'warn', text: mega(C.NUKE_DAMAGE[centre ? 0 : 2]) });
    }
    const distMarks = [];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) {
        const d = Math.max(Math.abs(x - 5), Math.abs(y - 3));
        if (d) distMarks.push({ at: [x, y], text: d });
    }

    return {
        // ------------------------------------------------------------ source keepers
        'mechanic:source-keepers': [
            {
                type: 'scene', title: 'What a keeper reaches', tile: 36, size: [12, 7],
                caption: `A creep next to the keeper takes ${KEEPER_MELEE + KEEPER_RANGED} per tick: ${KEEPER_MELEE} from attack and ${KEEPER_RANGED} from its ranged attack. At range 2 and 3 only the ${KEEPER_RANGED} arrive. The keeper walks to the source or mineral within 5 tiles of its lair and stays beside it; it does not follow.`,
                ranges: [
                    { at: [4, 3], r: 3, tone: 'warn', label: `range 2 and 3: ${KEEPER_RANGED} per tick`, labelAt: 'bl' },
                    { at: [4, 3], r: 1, tone: 'bad', label: `range 1: ${KEEPER_MELEE + KEEPER_RANGED} per tick`, labelAt: 'tl' },
                ],
                things: [
                    { is: 'source', at: [3, 3], label: 'source', labelAt: 'left' },
                    { is: 'creep', at: [4, 3], body: KEEPER_BODY, foe: true, label: 'keeper', labelAt: 'bottom' },
                    { is: 'keeperLair', at: [8, 3], label: 'lair', labelAt: 'top' },
                    { is: 'creep', at: [7, 5], body: GUARD_BODY, label: 'guard', labelAt: 'bottom' },
                    { is: 'creep', at: [10, 5], body: KEEPER_MINER, label: 'miner waits', labelAt: 'bottom' },
                ],
                paths: [{ via: [[8, 3], [7, 3], [6, 3], [5, 3], [4, 3]], tone: 'dim', dashed: true }],
                notes: [{ at: [9.5, 1], text: ['beyond range 3:', 'out of its reach'] }],
            },
            {
                type: 'body', title: 'The body of a Source Keeper', order: true, stats: false,
                caption: `50 parts, ${n(KEEPER_HITS)} hits. The 10 ATTACK parts do ${KEEPER_MELEE} at range 1 and the 10 RANGED_ATTACK parts ${KEEPER_RANGED} up to range 3.`,
                rows: [{ label: '17 TOUGH, 13 MOVE, then ATTACK and RANGED_ATTACK in turn', parts: KEEPER_BODY }],
            },
        ],
        'recipe:source-keeper-mining': [
            {
                type: 'scene', title: 'Fight from range 3', size: [11, 5],
                caption: `At range 2 or 3 the keeper's attack does not reach, only its ranged ${KEEPER_RANGED} per tick, and ${GUARD_HEAL} HEAL parts cover that. rangedAttack and heal run in the same tick, and the keeper does not follow.`,
                ranges: [
                    { at: [2, 2], r: 3, tone: 'warn', label: 'range 3 of the keeper', labelAt: 'bl' },
                    { at: [2, 2], r: 1, tone: 'bad', label: 'attack: range 1', labelAt: 'bl' },
                ],
                things: [
                    { is: 'source', at: [1, 1] },
                    { is: 'creep', at: [2, 2], body: KEEPER_BODY, foe: true, label: 'keeper', labelAt: 'bottom' },
                    { is: 'creep', at: [5, 2], body: GUARD_BODY, label: 'guard', labelAt: 'bottom' },
                ],
                arrows: [
                    { from: [5, 2], to: [2, 2], tone: 'R', bend: 0.22 },
                    { from: [2, 2], to: [5, 2], tone: 'bad', bend: 0.22 },
                ],
                notes: [
                    { at: [6.3, 0.7], text: 'Per tick', anchor: 'start', strong: true },
                    { at: [6.3, 1.3], text: [`guard, ${GUARD_RANGED} RANGED_ATTACK: ${GUARD_RANGED * C.RANGED_ATTACK_POWER}`, `keeper shoots back: ${KEEPER_RANGED}`, `guard, ${GUARD_HEAL} HEAL: heals ${GUARD_HEAL * C.HEAL_POWER}`], anchor: 'start' },
                ],
            },
            {
                type: 'timeline', title: 'One round at one lair', span: LAIR_TIMER + KILL_TICKS, unit: 'ticks since the first hit', ticks: seq(0, LAIR_TIMER, 60),
                caption: `The lair counts ${LAIR_TIMER} ticks from the first hit, so the quiet time is ${LAIR_TIMER} minus the fight: ${LAIR_TIMER - KILL_TICKS} ticks here, with ${GUARD_RANGED} RANGED_ATTACK parts that kill in ${KILL_TICKS}. Guard and miners change places again when the new keeper appears on the lair tile.`,
                rows: [
                    { label: 'Guard', segs: [{ from: 0, to: KILL_TICKS, text: 'kill', tone: 'R' }, { from: KILL_TICKS, to: LAIR_TIMER, text: 'free for the next lair, back before 0', tone: 'dim' }, { from: LAIR_TIMER, to: LAIR_TIMER + KILL_TICKS, text: 'kill', tone: 'R' }] },
                    { label: 'Miner and haulers', segs: [{ from: KILL_TICKS, to: LAIR_TIMER, text: 'at the source', tone: 'good' }, { from: LAIR_TIMER, to: LAIR_TIMER + KILL_TICKS, text: 'away', tone: 'bad' }] },
                    { label: 'lair.ticksToSpawn', segs: [{ from: 0, to: LAIR_TIMER, text: `counts down from ${LAIR_TIMER}`, tone: 'a' }], marks: [{ at: LAIR_TIMER, text: 'new keeper' }] },
                ],
            },
        ],
        'StructureKeeperLair': [{
            type: 'timeline', title: 'The lair counts from the first damage', span: LAIR_TIMER + 100, unit: 'ticks since the keeper was first hurt', ticks: seq(0, LAIR_TIMER + 100, 100),
            caption: `The timer of ${LAIR_TIMER} ticks starts when the keeper is missing or below full hits, not when it dies. When it ends a fresh keeper stands on the lair tile, whether the old one was killed or only hurt.`,
            rows: [
                { label: 'Keeper killed', segs: [{ from: 0, to: 60, text: 'fight', tone: 'warn' }, { from: 60, to: LAIR_TIMER, text: 'no keeper', tone: 'good' }, { from: LAIR_TIMER, to: LAIR_TIMER + 100, text: 'new keeper', tone: 'bad' }] },
                { label: 'Keeper only hurt', segs: [{ from: 0, to: LAIR_TIMER, text: 'hurt, still alive and fighting', tone: 'warn' }, { from: LAIR_TIMER, to: LAIR_TIMER + 100, text: 'new keeper', tone: 'bad' }] },
                { label: 'lair.ticksToSpawn', segs: [{ from: 0, to: LAIR_TIMER, text: `counts down from ${LAIR_TIMER}`, tone: 'a' }], marks: [{ at: LAIR_TIMER, text: 'undefined again' }] },
            ],
        }],

        // ------------------------------------------------------------ strongholds and invader cores
        'mechanic:strongholds': [
            {
                type: 'panels', title: 'Stronghold layouts', wide: true,
                caption: 'The layouts of levels 1, 3 and 5. Every tile carries an Invader rampart, the core tile included; the tiles drawn empty are roads. A container can be emptied only once the rampart on it is down.',
                panels: [
                    bunkerPanel(1, [7, 4], 2, 1, {
                        things: [
                            { is: 'invaderCore', at: [2, 1], label: 'core', labelAt: 'left' }, { is: 'container', at: [3, 1], label: 'container', labelAt: 'right' },
                            { is: 'tower', at: [3, 2], label: 'tower', labelAt: 'right' },
                        ].concat(bunker(1, 2, 1).filter(t => t.is === 'rampart')),
                        notes: [{ at: [1.35, 2], text: 'road', anchor: 'end' }],
                    }),
                    bunkerPanel(3, [6, 6], 1, 1),
                    bunkerPanel(5, [9, 9], 1, 1),
                ],
            },
            {
                type: 'timeline', title: 'Life of a stronghold', span: STRONGHOLD_DEPLOY + C.STRONGHOLD_DECAY_TICKS * 1.1, unit: 'ticks since the core appeared',
                caption: `During the ${n(STRONGHOLD_DEPLOY)} ticks of the deploy stage the core cannot be hurt and does nothing. After that the stronghold lives ${n(C.STRONGHOLD_DECAY_TICKS)} ticks, give or take 10%; at the collapse everything that carries the timer is removed, loot included.`,
                rows: [
                    {
                        label: 'Stronghold', marks: [{ at: STRONGHOLD_DEPLOY, text: 'deploy ends: structures appear' }],
                        segs: [
                            { from: 0, to: STRONGHOLD_DEPLOY, text: 'deploy', tone: 'dim' },
                            { from: STRONGHOLD_DEPLOY, to: STRONGHOLD_DEPLOY + C.STRONGHOLD_DECAY_TICKS * 0.9, text: 'towers and defenders act', tone: 'bad' },
                            { from: STRONGHOLD_DEPLOY + C.STRONGHOLD_DECAY_TICKS * 0.9, to: STRONGHOLD_DEPLOY + C.STRONGHOLD_DECAY_TICKS * 1.1, text: 'collapses', tone: 'warn' },
                        ],
                    },
                    { label: 'Lesser cores', segs: [{ from: STRONGHOLD_DEPLOY, to: STRONGHOLD_DEPLOY + C.STRONGHOLD_DECAY_TICKS * 0.9, text: `one every ${C.INVADER_CORE_EXPAND_TIME[5]} to ${C.INVADER_CORE_EXPAND_TIME[1]} ticks, by level`, tone: 'a' }] },
                ],
            },
            {
                type: 'line', title: 'A lesser core against your reservation', endLabels: false,
                caption: `With no reserver at work a full reservation of ${C.CONTROLLER_RESERVE_MAX} ticks is gone after ${n(reserveGone)}: 1 per tick as always plus ${C.INVADER_CORE_CONTROLLER_POWER} from the core. Then the core reserves for Invader, ${C.INVADER_CORE_CONTROLLER_POWER} ticks per tick against the 1 that runs off, up to ${C.CONTROLLER_RESERVE_MAX}.`,
                x: { label: 'ticks since the core appeared', min: 0, max: 8000, step: 1000 }, y: { label: 'ticks of reservation left', max: C.CONTROLLER_RESERVE_MAX },
                series: [
                    { name: 'your reservation', pts: [[0, C.CONTROLLER_RESERVE_MAX], [reserveGone, 0]] },
                    { name: 'reservation of Invader', pts: [[reserveGone, 0], [reserveFull, C.CONTROLLER_RESERVE_MAX], [8000, C.CONTROLLER_RESERVE_MAX]] },
                ],
                marks: [{ x: reserveGone, label: 'yours is gone' }],
            },
        ],
        'recipe:clear-a-stronghold': [
            {
                type: 'cols', title: 'Tower damage per tick by stronghold level', x: { label: 'stronghold level', cats: LEVELS.map(String) }, y: { label: 'damage of all towers on one creep' },
                caption: `${LEVELS.map(l => countOf(l, 'T')).join(', ').replace(/, (\d+)$/, ' and $1')} towers that shoot like player towers: ${C.TOWER_POWER_ATTACK} each up to range ${C.TOWER_OPTIMAL_RANGE}, ${towerFar} from range ${C.TOWER_FALLOFF_RANGE}. From level 2 the defenders come on top.`,
                series: [
                    { name: `range ${C.TOWER_OPTIMAL_RANGE} or less`, values: LEVELS.map(l => countOf(l, 'T') * C.TOWER_POWER_ATTACK) },
                    { name: `range ${C.TOWER_FALLOFF_RANGE} or more`, values: LEVELS.map(l => countOf(l, 'T') * towerFar) },
                ],
            },
            {
                type: 'scene', title: 'How far the defenders reach', tile: 26, size: [17, 11],
                caption: 'Defenders walk on rampart tiles only. Melee defenders hit creeps next to a rampart, rangers creeps within 3 tiles of one; the towers reach the whole room. The layout is that of level 4.',
                ranges: [
                    { at: [5, 5], r: 5, tone: 'warn', label: 'rangers: within 3 tiles of a rampart', labelAt: 'tl' },
                    { at: [5, 5], r: 3, tone: 'bad', label: 'melee: next to a rampart', labelAt: 'tl' },
                ],
                things: bunker(4, 3, 3),
                notes: [{ at: [11.3, 5], text: ['towers:', 'the whole room'], anchor: 'start' }],
            },
        ],
        'StructureInvaderCore': [{
            type: 'scene', title: 'A level 0 core at a controller', size: [11, 3],
            caption: `A level 0 core reserves the controller of its room for Invader, ${C.INVADER_CORE_CONTROLLER_POWER} ticks every tick. It has ${n(C.INVADER_CORE_HITS)} hits and no defence; after it is destroyed the reservation stays until it runs out or is attacked down.`,
            things: [
                { is: 'controller', at: [1, 1], neutral: true, label: ['controller,', 'reserved by Invader'], labelAt: 'bottom' },
                { is: 'invaderCore', at: [5, 1], label: 'invader core, level 0', labelAt: 'bottom' },
                { is: 'creep', at: [6, 0], body: '10A 10M', label: 'your attacker', labelAt: 'right' },
            ],
            arrows: [
                { from: [5, 1], to: [1, 1], tone: 'bad', label: `+${C.INVADER_CORE_CONTROLLER_POWER} ticks per tick` },
                { from: [6, 0], to: [5, 1], tone: 'A' },
            ],
            notes: [{ at: [7.4, 1.4], text: [`${n(C.INVADER_CORE_HITS)} hits,`, 'no towers, no creeps'], anchor: 'start' }],
        }],
        'recipe:defend-against-invaders': [{
            type: 'flow', title: 'What to do, by what you find', cell: [140, 54],
            caption: `Towers deal with a raid in your own room. In a remote room send a guard or pull the miners out until the invader has died of age. A level 0 core does not fight back, but its reservation outlasts it.`,
            nodes: [
                { id: 'inv', at: [0, 1], text: 'Owner "Invader"', sub: 'hostile in the room', tone: 'bad' },
                { id: 'creep', at: [1, 0], text: 'A creep', sub: `lives ${C.CREEP_LIFE_TIME} ticks` },
                { id: 'core', at: [1, 2], text: 'An invader core', sub: 'level 0' },
                { id: 'towers', at: [2, 0], text: 'Your room: towers', sub: 'healers first', tone: 'good' },
                { id: 'guard', at: [2, 1], text: 'Remote: a guard', sub: 'or wait until it dies', tone: 'good' },
                { id: 'attack', at: [2, 2], text: 'Attack it', sub: `${n(C.INVADER_CORE_HITS)} hits`, tone: 'good' },
                { id: 'rest', at: [3, 2], text: 'Reservation stays', sub: 'wear it down or wait' },
            ],
            edges: [{ from: 'inv', to: 'creep' }, { from: 'inv', to: 'core' }, { from: 'creep', to: 'towers' }, { from: 'creep', to: 'guard' }, { from: 'core', to: 'attack' }, { from: 'attack', to: 'rest' }],
        }],
        'recipe:safe-mode': [{
            type: 'flow', title: 'When to activate safe mode', cell: [140, 54],
            caption: `Trigger on real damage to spawn, storage, terminal or towers, or on a rampart about to fall, not on any hostile in the room. It starts only with a charge in stock, no cooldown and no other room of yours in safe mode.`,
            nodes: [
                { id: 'seen', at: [0, 0], text: 'Hostile in the room' },
                { id: 'damage', at: [1, 0], text: 'Real damage?', sub: 'spawn, storage, tower' },
                { id: 'ready', at: [2, 0], text: 'Can it start?', sub: 'in stock, no cooldown' },
                { id: 'go', at: [3, 0], text: 'activateSafeMode', sub: `${n(C.SAFE_MODE_DURATION)} ticks`, tone: 'good', mono: true },
                { id: 'wait', at: [1, 1], text: 'Leave it', sub: 'towers handle a raid', tone: 'dim' },
                { id: 'later', at: [2, 1], text: 'Fight on', sub: `restock: ${C.SAFE_MODE_COST} ghodium`, tone: 'dim' },
            ],
            edges: [{ from: 'seen', to: 'damage' }, { from: 'damage', to: 'ready', label: 'yes' }, { from: 'ready', to: 'go', label: 'yes' }, { from: 'damage', to: 'wait', label: 'no' }, { from: 'ready', to: 'later', label: 'no' }],
        }],
        'const:invaders': [{
            type: 'cols', title: 'Hits of a stronghold rampart by level', x: { label: 'stronghold level', cats: LEVELS.map(String) }, y: { label: 'STRONGHOLD_RAMPART_HITS' },
            caption: `Every rampart of a stronghold starts with this many hits, and its fortifier repairs them back to the same value. The invader core has ${n(C.INVADER_CORE_HITS)} hits at every level.`,
            series: [{ name: 'hits', values: LEVELS.map(l => C.STRONGHOLD_RAMPART_HITS[l]) }],
        }],

        // ------------------------------------------------------------ power banks
        'mechanic:power-banks': [
            {
                type: 'scene', title: 'Half of every hit comes back', size: [11, 4], terrain: ['####.......', '###........', '###........', '####.......'],
                caption: `The bank returns ${pct(C.POWER_BANK_HIT_BACK)} of every hit to the creep that dealt it, ranged hits included. Unboosted, every ATTACK part needs ${C.ATTACK_POWER * C.POWER_BANK_HIT_BACK / C.HEAL_POWER} HEAL parts beside it.`,
                things: [
                    { is: 'powerBank', at: [2, 1], label: 'power bank', labelAt: 'left' },
                    { is: 'creep', at: [3, 1], body: `${BANK_ATTACK}A ${BANK_ATTACK}M`, label: 'attacker', labelAt: 'top' },
                    { is: 'creep', at: [4, 2], body: `${bankHeal}H ${bankHeal}M`, label: 'healer', labelAt: 'bottom' },
                ],
                arrows: [{ from: [3, 1], to: [2, 1], tone: 'bad', both: true }, { from: [4, 2], to: [3, 1], tone: 'good' }],
                notes: [
                    { at: [5.6, 0.6], text: 'Per tick', anchor: 'start', strong: true },
                    { at: [5.6, 1.2], text: [`${BANK_ATTACK} ATTACK parts hit for ${bankDamage}`, `and take ${bankBack} back`, `${bankHeal} HEAL parts heal ${bankHeal * C.HEAL_POWER}`], anchor: 'start' },
                ],
            },
            {
                type: 'line', title: 'Ticks to break a bank, by ATTACK parts',
                caption: `With N ATTACK parts hitting every tick the bank falls in ${n(bankTicks(1))} ÷ N ticks. With fewer than ${bankMinParts} parts it is gone before it breaks, and the way there comes on top.`,
                x: { label: 'ATTACK parts hitting every tick', min: 10, max: 120, step: 10, snap: 5 }, y: { label: 'ticks until the bank falls' },
                series: [{ name: 'ticks', pts: [bankMinParts].concat(seq(15, 120, 5)).map(p => [p, bankTicks(p)]) }],
                marks: [{ y: C.POWER_BANK_DECAY, label: `the bank is removed after ${C.POWER_BANK_DECAY} ticks` }],
            },
            {
                type: 'timeline', title: 'One bank and the next in the same room', span: C.POWER_BANK_RESPAWN_TIME * 1.25, unit: 'ticks since the bank appeared',
                caption: `A bank stays ${C.POWER_BANK_DECAY} ticks. When it appears the next one in that room is set ${n(C.POWER_BANK_RESPAWN_TIME * 0.75)} to ${n(C.POWER_BANK_RESPAWN_TIME * 1.25)} ticks ahead, whatever happens to the first.`,
                rows: [
                    { label: 'This bank', segs: [{ from: 0, to: C.POWER_BANK_DECAY, tone: 'bad' }], marks: [{ at: C.POWER_BANK_DECAY, text: `removed after ${C.POWER_BANK_DECAY} ticks` }] },
                    { label: 'Next bank', segs: [{ from: C.POWER_BANK_RESPAWN_TIME * 0.75, to: C.POWER_BANK_RESPAWN_TIME * 1.25, text: 'appears in this window', tone: 'a' }] },
                ],
            },
        ],
        'StructurePowerBank': [{
            type: 'panels', title: 'What is left of a power bank', wide: true,
            caption: `A destroyed bank leaves a ruin that holds the power for ${C.RUIN_DECAY_STRUCTURES.powerBank} ticks. After that the power lies on the tile as a dropped resource. A bank whose ${C.POWER_BANK_DECAY} ticks run out is removed with its power.`,
            panels: [
                { tag: `Destroyed: a ruin for ${C.RUIN_DECAY_STRUCTURES.powerBank} ticks`, tone: 'good', size: [5, 3], terrain: ['###..', '##...', '###..'], things: [{ is: 'ruin', at: [1, 1], label: 'ruin', labelAt: 'bottom' }, { is: 'creep', at: [2, 1], body: '10C 10M' }], arrows: [{ from: [1, 1], to: [2, 1], tone: 'accent' }], note: '`withdraw` takes the power' },
                { tag: 'After that: on the tile', tone: 'good', size: [5, 3], terrain: ['###..', '##...', '###..'], things: [{ is: 'resource', at: [1, 1], kind: 'P', label: 'power', labelAt: 'bottom' }, { is: 'creep', at: [2, 1], body: '10C 10M' }], arrows: [{ from: [1, 1], to: [2, 1], tone: 'accent' }], note: '`pickup` takes it; it decays' },
                { tag: 'Timer ran out: nothing', tone: 'bad', size: [5, 3], terrain: ['###..', '###..', '###..'], things: [{ is: 'powerBank', at: [1, 1], dim: true }], note: 'no ruin, no power' },
            ],
        }],

        // ------------------------------------------------------------ portals
        'mechanic:portals-and-shards': [
            {
                type: 'panels', title: 'Where a portal leads',
                caption: 'A creep that ends its move on the portal tile is sent on; no call is needed. Inside the shard it stands on the destination position in the next tick. Through a portal to another shard it arrives on some free tile of the destination room.',
                panels: [
                    {
                        tag: 'Inside the shard: a fixed position', tile: 30, size: [7, 3], terrain: ['..#....', '..#....', '..#....'],
                        marks: [{ at: [5, 1], tone: 'accent' }],
                        things: [{ is: 'portal', at: [1, 1], label: 'portal', labelAt: 'bottom' }, { is: 'creep', at: [0, 1], body: 'CCMM' }, { is: 'creep', at: [5, 1], body: 'CCMM', dim: true, label: 'next tick', labelAt: 'bottom' }],
                        arrows: [{ from: [0, 1], to: [1, 1] }, { from: [1, 1], to: [5, 1], tone: 'accent', dashed: true, bend: -0.3 }],
                        note: '`destination` is a RoomPosition',
                    },
                    {
                        tag: 'To another shard: some free tile', tile: 30, size: [7, 3], terrain: ['..#....', '..#....', '..#....'],
                        marks: [{ at: [4, 0], tone: 'accent', text: '?' }, { at: [6, 1], tone: 'accent', text: '?' }, { at: [4, 2], tone: 'accent', text: '?' }],
                        things: [{ is: 'portal', at: [1, 1], label: 'portal', labelAt: 'bottom' }, { is: 'creep', at: [0, 1], body: 'CCMM' }],
                        arrows: [{ from: [0, 1], to: [1, 1] }, { from: [1, 1], to: [5, 1], tone: 'accent', dashed: true, bend: -0.3 }],
                        note: '`destination` is {shard, room}',
                    },
                ],
            },
            {
                type: 'flow', title: 'What crosses to another shard', cell: [170, 54],
                caption: 'Your script runs on each shard separately, with a Memory of its own. A creep that arrives from another shard has no Memory.creeps entry there: hand over what it needs through InterShardMemory.',
                nodes: [
                    { id: 'a', at: [0, 0], text: 'Your script on shard A', sub: 'Memory of shard A' },
                    { id: 'b', at: [1, 0], text: 'Your script on shard B', sub: 'Memory of shard B' },
                    { id: 'm', at: [0, 1], span: 2, text: 'InterShardMemory', sub: 'the only data both sides see', tone: 'accent', mono: true },
                ],
                edges: [{ from: 'a', to: 'b', label: 'creep, through the portal' }, { from: 'a', to: 'm', label: 'writes' }, { from: 'm', to: 'b', label: 'reads', dashed: true }],
            },
        ],
        'StructurePortal': [{
            type: 'panels', title: 'moveTo and a portal in the way',
            caption: '`moveTo` and `Room.findPath` treat a portal tile as blocked and walk around it, unless the portal tile itself is the target. A creep enters by ending its move on the tile.',
            panels: [
                {
                    tag: 'Target beyond the portal: around it', tile: 30, size: [7, 3],
                    things: [{ is: 'portal', at: [3, 1], label: 'portal', labelAt: 'bottom' }, { is: 'creep', at: [0, 1], body: 'CCMM' }, { is: 'flag', at: [6, 1], label: 'target', labelAt: 'bottom' }],
                    paths: [{ via: [[0, 1], [1, 1], [2, 0], [3, 0], [4, 0], [5, 1], [6, 1]], dashed: true }],
                },
                {
                    tag: 'Target is the portal tile: onto it', tile: 30, size: [7, 3],
                    things: [{ is: 'portal', at: [3, 1], label: 'target', labelAt: 'bottom' }, { is: 'creep', at: [0, 1], body: 'CCMM' }],
                    paths: [{ via: [[0, 1], [1, 1], [2, 1], [3, 1]], dashed: true }],
                    notes: [{ at: [5, 0.8], text: ['sent to the', 'destination'] }],
                },
            ],
        }],

        // ------------------------------------------------------------ start areas, world map, vision
        'mechanic:respawn-and-start-areas': [{
            type: 'bars', title: 'How long the ruins last', unit: 'ticks',
            caption: `A first spawn turns the structures other players left in the room into ruins that last ${n(RUIN_FIRST_SPAWN)} ticks. A respawn turns all your structures into ruins that keep their contents for ${n(RUIN_RESPAWN)} ticks, and anyone who gets there can empty them.`,
            rows: [
                { label: 'Usual ruin', sub: 'a structure destroyed in play', value: C.RUIN_DECAY, tone: 'dim' },
                { label: 'First spawn in a room', sub: 'structures of other players there', value: RUIN_FIRST_SPAWN },
                { label: 'Respawn', sub: 'every structure you had', value: RUIN_RESPAWN, tone: 'b' },
            ],
        }],
        'mechanic:world-map': [
            {
                type: 'map', title: 'Room names and their coordinates', cell: 62,
                caption: 'W and N numbers grow to the left and upward, E and S numbers to the right and downward. E0 is x = 0 and W0 is x = −1; S0 is y = 0 and N0 is y = −1, so four rooms with a 0 meet at the origin.',
                rows: grid(6, 4, (x, y) => ((x === 2 || x === 3) && (y === 1 || y === 2) ? 'o' : '.')),
                xlabels: seq(-3, 2).map(v => 'x ' + signed(v)), ylabels: seq(-2, 1).map(v => 'y ' + signed(v)),
                marks: [].concat(...seq(0, 3).map(y => seq(0, 5).map(x => ({ at: [x, y], text: roomName(x - 3, y - 2) })))),
                key: { o: { label: 'the four rooms at the origin', tone: 'a' }, '.': { label: 'other rooms' } },
            },
            {
                type: 'panels', title: 'Crossing an exit',
                caption: 'A creep that ends its move on an exit tile is on the opposite border of the next room one tick later, at the same place along the edge and on an exit tile again. If it does not step off, it is sent back the tick after.',
                panels: [
                    {
                        tag: 'Steps off the exit tile: stays', tone: 'good', tile: 30, size: [7, 3], terrain: ['..xx...', '..xx...', '..xx...'],
                        things: [{ is: 'creep', at: [0, 1], body: 'CCMM', dim: true }, { is: 'creep', at: [4, 1], body: 'CCMM' }],
                        paths: [{ via: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], dashed: true }],
                        notes: [{ at: [2, 0], text: 'x 49' }, { at: [3, 0], text: 'x 0' }, { at: [0.5, 2], text: 'W5N5' }, { at: [5, 2], text: 'W4N5' }],
                    },
                    {
                        tag: 'Stays on the exit tile: sent back', tone: 'bad', tile: 30, size: [7, 3], terrain: ['..xx...', '..xx...', '..xx...'],
                        things: [{ is: 'creep', at: [3, 1], body: 'CCMM' }],
                        arrows: [{ from: [3, 1], to: [2, 1], tone: 'bad', both: true, gap: [0.4, 0.05] }],
                        notes: [{ at: [2, 0], text: 'x 49' }, { at: [3, 0], text: 'x 0' }, { at: [0.5, 2], text: 'W5N5' }, { at: [5, 2], text: 'W4N5' }],
                    },
                ],
            },
        ],
        'recipe:scout-rooms': [{
            type: 'panels', title: 'What gives vision of a room', wide: true,
            caption: 'Every object that carries your user id makes its room visible: creeps, power creeps, structures, your tombstones and the ruins of your structures. Flags, construction sites and a reservation do not.',
            panels: [
                { tag: 'A creep of yours: visible', tone: 'good', size: [5, 3], things: [{ is: 'creep', at: [2, 1], body: 'M', label: 'scout, 1 MOVE', labelAt: 'bottom' }] },
                { tag: 'Flag or site: not visible', tone: 'bad', size: [5, 3], things: [{ is: 'flag', at: [1, 1], label: 'flag', labelAt: 'bottom' }, { is: 'site', at: [3, 1], progress: 0.3, label: 'site', labelAt: 'bottom' }] },
                { tag: 'Reservation: not visible', tone: 'bad', size: [5, 3], things: [{ is: 'controller', at: [2, 1], neutral: true, label: 'reserved by you', labelAt: 'bottom' }] },
            ],
        }],
        'StructureObserver.observeRoom': [{
            type: 'timeline', title: 'Visible one tick later, for one tick', span: 5, unit: 'ticks; each block is one tick', ticks: seq(0, 5),
            caption: 'The room is in Game.rooms in the tick after the call and only in that tick. To keep watching, call every tick; an observer takes one room per tick.',
            rows: [
                { label: 'observeRoom(name)', segs: [{ from: 0, to: 1, text: 'call', tone: 'accent' }, { from: 2, to: 3, text: 'call', tone: 'accent' }, { from: 3, to: 4, text: 'call', tone: 'accent' }] },
                { label: 'Game.rooms[name]', segs: [{ from: 1, to: 2, text: 'visible', tone: 'good' }, { from: 3, to: 4, text: 'visible', tone: 'good' }, { from: 4, to: 5, text: 'visible', tone: 'good' }] },
            ],
        }],
        'StructureNuker.launchNuke': [{
            type: 'map', title: 'Rooms a nuker can hit', cell: 12,
            caption: `The target room must lie within ${C.NUKE_RANGE} rooms of the nuker on each axis, a square of ${2 * C.NUKE_RANGE + 1} × ${2 * C.NUKE_RANGE + 1} rooms. The room need not be visible, and the nuke lands ${n(C.NUKE_LAND_TIME)} ticks after the call.`,
            rows: grid(2 * C.NUKE_RANGE + 5, 2 * C.NUKE_RANGE + 5, (x, y) => { const dx = Math.abs(x - C.NUKE_RANGE - 2), dy = Math.abs(y - C.NUKE_RANGE - 2); return !dx && !dy ? 'n' : dx <= C.NUKE_RANGE && dy <= C.NUKE_RANGE ? 'r' : '.'; }),
            key: { n: { label: 'nuker', tone: 'ink' }, r: { label: `in range: up to ${C.NUKE_RANGE} rooms on each axis`, tone: 'bad', weak: true }, '.': { label: 'ERR_NOT_IN_RANGE' } },
        }],
        'Game.map.getRoomLinearDistance': [{
            type: 'map', title: 'Distance in rooms', cell: 34,
            caption: 'The number in each room is its distance from the marked room: the larger of the x and the y difference, so a diagonal neighbour is 1 away. With continuous = true the count wraps around the edge of the world.',
            rows: grid(11, 7, (x, y) => { const d = Math.max(Math.abs(x - 5), Math.abs(y - 3)); return d === 0 ? 'o' : d === 1 ? 'a' : d === 2 ? 'b' : '.'; }),
            marks: distMarks,
            key: { o: { label: 'the first room', tone: 'ink' }, a: { label: 'distance 1', tone: 'a' }, b: { label: 'distance 2', tone: 'a', weak: true }, '.': { label: 'further' } },
        }],
        'Game.map.describeExits': [{
            type: 'map', title: `What describeExits("${roomName(-6, -6)}") returns`, cell: 84,
            caption: `The keys are the directions TOP (${C.TOP}), RIGHT (${C.RIGHT}), BOTTOM (${C.BOTTOM}) and LEFT (${C.LEFT}), the values the names of the rooms there. A side without an exit has no key; here that is the bottom side.`,
            rows: ['.n.', 'ncn', '.x.'],
            marks: [
                { at: [1, 1], text: roomName(-6, -6) },
                { at: [1, 0], text: `"${C.TOP}"`, dy: -9 }, { at: [1, 0], text: roomName(-6, -7), dy: 9 },
                { at: [2, 1], text: `"${C.RIGHT}"`, dy: -9 }, { at: [2, 1], text: roomName(-5, -6), dy: 9 },
                { at: [0, 1], text: `"${C.LEFT}"`, dy: -9 }, { at: [0, 1], text: roomName(-7, -6), dy: 9 },
                { at: [1, 2], text: 'no exit:', dy: -9 }, { at: [1, 2], text: `no "${C.BOTTOM}"`, dy: 9 },
            ],
            key: { c: { label: 'the room asked about', tone: 'a' }, n: { label: 'neighbour behind an exit', tone: 'a', weak: true }, x: {}, '.': {} },
        }],
        'const:nukes': [{
            type: 'scene', title: 'NUKE_DAMAGE by tile', tile: 36, size: [5, 5],
            caption: `Key 0 is the landing tile: ${n(C.NUKE_DAMAGE[0])} damage to structures. Key 2 is the rest of the 5 × 5 tiles around it: ${n(C.NUKE_DAMAGE[2])} each.`,
            marks: nukeMarks,
        }],
    };
};
