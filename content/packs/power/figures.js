'use strict';
/*
 * Figures of the power entries: {entry id: [figure, ...]}. Numbers come from the constants (C), most of
 * them from POWER_INFO. Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n, seq, action } = h;
    const info = power => C.POWER_INFO[power];
    const POWER_LEVELS = seq(1, 5);
    const LIFE = C.POWER_CREEP_LIFE_TIME;
    const HOURS = C.POWER_CREEP_SPAWN_COOLDOWN / 3600000;
    const REACH = info(C.PWR_OPERATE_SPAWN).range;   // the range of every power with a target, three excepted
    const powerNames = Object.keys(C).filter(k => /^PWR_/.test(k));
    const nameOf = id => powerNames.find(k => C[k] === +id);
    const list = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : String(a[0]));

    // ticksToLive of a creep that renews every RENEW_EVERY ticks, over three lifetimes
    const RENEW_EVERY = 2000;
    const renewed = [];
    for (let t = 0; t < 3 * LIFE; t += RENEW_EVERY) renewed.push([t, LIFE], [Math.min(t + RENEW_EVERY, 3 * LIFE), LIFE - Math.min(RENEW_EVERY, 3 * LIFE - t)]);

    // Global Power Level: level n needs POWER_LEVEL_MULTIPLY × n^POWER_LEVEL_POW processed power in total
    const gplPower = level => C.POWER_LEVEL_MULTIPLY * Math.pow(level, C.POWER_LEVEL_POW);
    const FULL_CREEP = C.POWER_CREEP_MAX_LEVEL + 1;   // one level to create it, one per creep level

    // the example account of the free-levels bar: GPL 12, two creeps at level 7 and 2
    const GPL = 12, CREEPS = [7, 2];
    const used = CREEPS.reduce((a, l) => a + 1 + l, 0);

    // tower under PWR_OPERATE_TOWER and PWR_DISRUPT_TOWER: the factor is applied to the amount, rounded down (engine towers/attack.js)
    const towerUnder = (power, level) => Math.floor(C.TOWER_POWER_ATTACK * info(power).effect[level - 1]);
    // spawn time of a 50-part creep under PWR_OPERATE_SPAWN, rounded up (engine spawns/create-creep.js)
    const BIG = 50;
    const spawnUnder = level => Math.ceil(BIG * C.CREEP_SPAWN_TIME * info(C.PWR_OPERATE_SPAWN).effect[level - 1]);

    // one fill of a power spawn, burned 1 per call and under PWR_OPERATE_POWER at level 5
    const FILL = C.POWER_SPAWN_POWER_CAPACITY, BOOSTED = 1 + info(C.PWR_OPERATE_POWER).effect[4], BOOSTED_CALLS = Math.floor(FILL / BOOSTED);

    // ops per 1000 ticks
    const opsMade = level => info(C.PWR_GENERATE_OPS).effect[level - 1] * 1000 / info(C.PWR_GENERATE_OPS).cooldown;
    const opsKept = power => info(power).ops * 1000 / info(power).duration;
    const covers = power => Math.floor(info(power).duration / info(power).cooldown);

    // creep level needed for power levels 1 to 5: powers with the same list share a series
    const gates = [];
    Object.keys(C.POWER_INFO).forEach(id => {
        const key = info(id).level.join('/');
        let g = gates.find(x => x.key === key);
        if (!g) gates.push(g = { key, levels: info(id).level, names: [] });
        g.names.push(nameOf(id));
    });
    gates.sort((a, b) => a.levels[0] - b.levels[0]);
    const gateName = g => (g.names.length > 3 ? `${g.names.length} powers, ${g.names[0]} among them` : g.names.join(', '));

    const operatorRow = (power, text) => ({
        label: nameOf(power),
        segs: [{ from: 0, to: info(power).cooldown, text: 'cooldown', tone: 'warn' }, { from: info(power).cooldown, to: info(power).duration, text, tone: 'good' }],
        marks: [{ at: info(power).cooldown, text: `ready again after ${info(power).cooldown}` }],
    });

    return {
        // ------------------------------------------------------------ mechanics
        'mechanic:power-creeps': [
            {
                type: 'line', title: 'Ticks to live, with and without renew', endLabels: false,
                caption: `A power creep lives ${LIFE} ticks. \`renew\` next to a power spawn or a power bank sets the count back to ${LIFE}; it costs nothing and has no cooldown. A creep that dies cannot be spawned again for ${HOURS} hours of real time.`,
                x: { label: 'ticks since the spawn', min: 0, max: 3 * LIFE, step: LIFE }, y: { label: 'ticksToLive', max: LIFE },
                series: [{ name: `renewed every ${RENEW_EVERY} ticks`, pts: renewed }, { name: 'never renewed', pts: [[0, LIFE], [LIFE, 0]] }],
                marks: [{ x: LIFE, label: 'dies of age', dy: 190 }],
            },
            {
                type: 'panels', title: 'No fatigue: every tile takes one tick',
                caption: 'A power creep has no body parts and no fatigue: one tile per tick on road, plain and swamp alike. moveTo plans with the costs of a creep (plain 2, swamp 10) and takes the long way round unless you pass plainCost 1 and swampCost 1.',
                panels: [
                    {
                        tag: 'Default moveTo: 10 ticks', tone: 'bad', tile: 30, size: [7, 5], terrain: ['..~~~..', '..~~~..', '..~~~..', '..~~~..', '.......'],
                        things: [{ is: 'powerCreep', at: [0, 0] }, { is: 'flag', at: [6, 0] }],
                        paths: [{ via: [[0, 0], [1, 1], [1, 2], [1, 3], [2, 4], [3, 4], [4, 4], [5, 3], [5, 2], [5, 1], [6, 0]], dashed: true }],
                        note: 'planned with plain 2, swamp 10',
                    },
                    {
                        tag: 'Both costs set to 1: 6 ticks', tone: 'good', tile: 30, size: [7, 5], terrain: ['..~~~..', '..~~~..', '..~~~..', '..~~~..', '.......'],
                        things: [{ is: 'powerCreep', at: [0, 0] }, { is: 'flag', at: [6, 0] }],
                        paths: [{ via: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]], dashed: true }],
                        note: '`{plainCost: 1, swampCost: 1}`',
                    },
                ],
            },
        ],
        'mechanic:powers': [
            {
                type: 'cols', title: 'A tower under PWR_OPERATE_TOWER and PWR_DISRUPT_TOWER', x: { label: 'level of the power', cats: POWER_LEVELS.map(String) }, y: { label: `attack at range ${C.TOWER_OPTIMAL_RANGE} or less` },
                caption: `Both powers multiply attack, heal and repair of the tower after the range falloff: PWR_OPERATE_TOWER by ${info(C.PWR_OPERATE_TOWER).effect.join(' / ')}, PWR_DISRUPT_TOWER by ${info(C.PWR_DISRUPT_TOWER).effect.join(' / ')}. A tower under both gets both factors.`,
                series: [
                    { name: 'PWR_OPERATE_TOWER', values: POWER_LEVELS.map(l => towerUnder(C.PWR_OPERATE_TOWER, l)) },
                    { name: 'no power', values: POWER_LEVELS.map(() => C.TOWER_POWER_ATTACK) },
                    { name: 'PWR_DISRUPT_TOWER', values: POWER_LEVELS.map(l => towerUnder(C.PWR_DISRUPT_TOWER, l)) },
                ],
            },
            {
                type: 'cols', title: 'Spawn time under PWR_OPERATE_SPAWN', x: { label: 'level of the power', cats: ['none'].concat(POWER_LEVELS.map(String)) }, y: { label: `ticks to spawn a ${BIG}-part creep` },
                caption: `A creep whose spawning starts under the effect takes × ${list(info(C.PWR_OPERATE_SPAWN).effect)} of the normal ${C.CREEP_SPAWN_TIME} ticks per part, rounded up. A creep that is already being spawned keeps its time.`,
                series: [{ name: 'ticks', values: [BIG * C.CREEP_SPAWN_TIME].concat(POWER_LEVELS.map(spawnUnder)) }],
            },
        ],
        'mechanic:ops': [
            {
                type: 'bars', title: 'Ops per 1000 ticks: made and spent', unit: 'ops',
                caption: `PWR_GENERATE_OPS at level 5 brings ${opsMade(5)} ops per 1000 ticks. Keeping one spawn under PWR_OPERATE_SPAWN for that time takes ${opsKept(C.PWR_OPERATE_SPAWN)} of them and the power spawn under PWR_OPERATE_POWER ${opsKept(C.PWR_OPERATE_POWER)}: an operator that runs several effects needs ops from outside.`,
                rows: [1, 3, 5].map(l => ({ label: 'PWR_GENERATE_OPS', sub: `made at level ${l}`, value: opsMade(l), tone: 'good' })).concat([
                    { label: 'PWR_OPERATE_LAB', sub: 'spent on one lab', value: opsKept(C.PWR_OPERATE_LAB), tone: 'warn' },
                    { label: 'PWR_OPERATE_SPAWN', sub: 'spent on one spawn', value: opsKept(C.PWR_OPERATE_SPAWN), tone: 'warn' },
                    { label: 'PWR_OPERATE_TOWER', sub: 'spent on one tower', value: opsKept(C.PWR_OPERATE_TOWER), tone: 'warn' },
                    { label: 'PWR_OPERATE_POWER', sub: 'spent on the power spawn', value: opsKept(C.PWR_OPERATE_POWER), tone: 'warn' },
                ]),
            },
            {
                type: 'timeline', title: 'Ops must be in the store one tick ahead', span: 2, unit: 'ticks; each block is one tick', ticks: seq(0, 2),
                caption: '`usePower` is processed before `withdraw`, and the call checks the store as it was at the start of the tick. Ops taken out of the storage in one tick pay for a power in the next.',
                rows: [
                    { label: 'withdraw ops', segs: [{ from: 0, to: 1, text: 'OK: ops arrive', tone: 'accent' }] },
                    { label: 'usePower', segs: [{ from: 0, to: 1, text: 'ERR_NOT_ENOUGH_RESOURCES', tone: 'bad' }, { from: 1, to: 2, text: 'OK: paid from the store', tone: 'good' }] },
                ],
            },
        ],
        'mechanic:power-processing': [
            {
                type: 'flow', title: 'From power to a power creep', cell: [136, 54],
                caption: `Power from banks or the market goes into the power spawn. Each processPower call, one per tick, burns 1 power and ${C.POWER_SPAWN_ENERGY_RATIO} energy and adds 1 to the total of the account. Every Global Power Level reached pays for creating a power creep or for one level of it.`,
                nodes: [
                    { id: 'bank', at: [0, 0], text: 'Power bank', sub: 'highway room' },
                    { id: 'market', at: [0, 1], text: 'Market', sub: 'buy power' },
                    { id: 'spawn', at: [1, 0], text: 'Power spawn', sub: `holds ${C.POWER_SPAWN_POWER_CAPACITY} power`, tone: 'bad' },
                    { id: 'energy', at: [1, 1], text: 'Energy', sub: `${C.POWER_SPAWN_ENERGY_RATIO} per power`, tone: 'energy' },
                    { id: 'process', at: [2, 0], text: 'processPower', sub: '1 power per tick', mono: true },
                    { id: 'gpl', at: [3, 0], text: 'Game.gpl', sub: 'total of the account', tone: 'accent', mono: true },
                    { id: 'creep', at: [3, 1], text: 'Power creep', sub: '1 GPL level per level' },
                ],
                edges: [{ from: 'bank', to: 'spawn' }, { from: 'market', to: 'spawn' }, { from: 'energy', to: 'spawn' }, { from: 'spawn', to: 'process' }, { from: 'process', to: 'gpl', label: '+1' }, { from: 'gpl', to: 'creep' }],
            },
            {
                type: 'line', title: 'Power needed for each Global Power Level',
                caption: `Level n needs ${C.POWER_LEVEL_MULTIPLY} × n^${C.POWER_LEVEL_POW} processed power in total, and every power takes ${C.POWER_SPAWN_ENERGY_RATIO} energy. GPL ${FULL_CREEP} pays for one power creep at level ${C.POWER_CREEP_MAX_LEVEL}: ${n(gplPower(FULL_CREEP))} power and ${n(gplPower(FULL_CREEP) * C.POWER_SPAWN_ENERGY_RATIO)} energy.`,
                x: { label: 'Global Power Level', min: 0, max: FULL_CREEP, ticks: [0, 5, 10, 15, 20, FULL_CREEP], snap: 1 }, y: { label: 'processed power in total' },
                series: [{ name: 'power', pts: seq(0, FULL_CREEP).map(l => [l, gplPower(l)]) }],
            },
        ],

        // ------------------------------------------------------------ recipes
        'recipe:operator-routine': [{
            type: 'timeline', title: 'How long an effect lasts and when the power is ready again', span: 1000, unit: 'ticks since usePower',
            caption: `Each bar is the time the effect lasts; in its first part the power is still on cooldown. Duration ÷ cooldown is the number of targets one operator can keep covered: ${covers(C.PWR_OPERATE_SPAWN)} spawns, ${covers(C.PWR_OPERATE_LAB)} labs, ${covers(C.PWR_REGEN_SOURCE)} sources or ${covers(C.PWR_OPERATE_TOWER)} towers, but only ${covers(C.PWR_OPERATE_STORAGE)} storage.`,
            rows: [
                operatorRow(C.PWR_OPERATE_SPAWN, `effect goes on until ${info(C.PWR_OPERATE_SPAWN).duration}`),
                operatorRow(C.PWR_OPERATE_LAB, `effect goes on until ${info(C.PWR_OPERATE_LAB).duration}`),
                operatorRow(C.PWR_OPERATE_STORAGE, `until ${info(C.PWR_OPERATE_STORAGE).duration}`),
                operatorRow(C.PWR_REGEN_SOURCE, `until ${info(C.PWR_REGEN_SOURCE).duration}`),
                operatorRow(C.PWR_OPERATE_TOWER, String(info(C.PWR_OPERATE_TOWER).duration)),
            ],
        }],
        'recipe:level-a-power-creep': [{
            type: 'cols', title: 'Creep level needed for each level of a power', x: { label: 'level of the power', cats: POWER_LEVELS.map(String) }, y: { label: 'creep level before the upgrade', max: C.POWER_CREEP_MAX_LEVEL },
            caption: `Most powers open at creep level ${gates[0].levels[0]} and their levels 2 to 5 need creep level ${list(gates[0].levels.slice(1))}. Another ${gates[1].names.length} powers open only at creep level ${gates[1].levels[0]}, and ${gates[2].names.length} at creep level ${gates[2].levels[0]}. A creep ends at level ${C.POWER_CREEP_MAX_LEVEL}, so at most ${C.POWER_CREEP_MAX_LEVEL - gates[0].levels[4]} powers reach level 5.`,
            series: gates.map(g => ({ name: gateName(g), values: g.levels })),
        }],
        'recipe:power': [{
            type: 'scene', title: 'An operator at work', tile: 36, size: [13, 5],
            caption: `The creep appears on the power spawn and lives ${LIFE} ticks. \`renew\` at the power spawn and \`enableRoom\` at the controller, once per room, need range 1; most powers reach a target within ${REACH} tiles.`,
            ranges: [{ at: [5, 2], r: REACH, label: `range ${REACH}`, labelAt: 'bl' }, { at: [5, 2], r: 1, tone: 'good', label: 'range 1', labelAt: 'tl' }],
            things: [
                { is: 'powerCreep', at: [5, 2], label: 'operator', labelAt: 'top' },
                { is: 'controller', at: [4, 3], level: 8, label: 'controller', labelAt: 'left' },
                { is: 'powerSpawn', at: [6, 3], label: 'power spawn', labelAt: 'right' },
                { is: 'spawn', at: [7, 0], label: 'spawn', labelAt: 'right' },
                { is: 'lab', at: [2, 2], label: 'lab', labelAt: 'left' },
                { is: 'tower', at: [8, 2], label: 'tower', labelAt: 'right' },
            ],
            arrows: [{ from: [5, 2], to: [7, 0], tone: 'accent' }, { from: [5, 2], to: [2, 2], tone: 'accent' }, { from: [5, 2], to: [8, 2], tone: 'accent' }],
            notes: [
                { at: [9.7, 0.4], text: 'Range 1', anchor: 'start', strong: true }, { at: [9.7, 0.95], text: ['renew,', 'enableRoom'], anchor: 'start' },
                { at: [9.7, 2.9], text: `Range ${REACH}`, anchor: 'start', strong: true }, { at: [9.7, 3.45], text: ['usePower,', 'most powers'], anchor: 'start' },
            ],
        }],

        // ------------------------------------------------------------ API
        'PowerCreep.usePower': [action({
            title: 'usePower', caption: `Most powers need the target within ${REACH} tiles; PWR_DISRUPT_SPAWN reaches ${info(C.PWR_DISRUPT_SPAWN).range} and PWR_DISRUPT_TOWER and PWR_DISRUPT_TERMINAL ${info(C.PWR_DISRUPT_TOWER).range}. The ops come out of the creep's own store, and only one power runs per tick.`,
            actor: 'power creep', actorOpts: { is: 'powerCreep' }, target: 'spawn', targetLabel: 'spawn', range: REACH, tone: 'accent',
            effect: ['PWR_OPERATE_SPAWN:', `${info(C.PWR_OPERATE_SPAWN).ops} ops, lasts ${info(C.PWR_OPERATE_SPAWN).duration}`],
        })],
        'PowerCreep.enableRoom': [action({
            title: 'enableRoom', caption: 'Next to the controller, once per room. The flag belongs to the room: from then on every player\'s power creep can use powers there. A room without a controller needs no enabling.',
            actor: 'power creep', actorOpts: { is: 'powerCreep' }, target: 'controller', targetOpts: { level: 8 }, targetLabel: 'controller', range: 1, tone: 'accent',
            effect: ['once per room', 'that has a controller'],
        })],
        'PowerCreep.renew': [action({
            title: 'renew', caption: `Next to an active power spawn or any power bank. It costs nothing, has no cooldown and resets only the age; hits stay as they are.`,
            actor: 'power creep', actorOpts: { is: 'powerCreep' }, target: 'powerSpawn', targetLabel: 'power spawn', range: 1, flow: 'in', tone: 'good',
            effect: ['ticksToLive', `back to ${LIFE}`],
        })],
        'PowerCreep.spawn': [{
            type: 'panels', title: 'Where the power creep appears',
            caption: `The creep appears on the tile of the power spawn, with full hits and ${LIFE} ticks to live, and has to walk off. While another power creep stands on that tile nothing is spawned, although the call returned OK.`,
            panels: [
                {
                    tag: 'Tile free: appears on it', tone: 'good', size: [5, 3],
                    things: [{ is: 'powerSpawn', at: [1, 1], label: 'power spawn', labelAt: 'bottom' }, { is: 'powerCreep', at: [1, 1], scale: 0.6 }, { is: 'powerCreep', at: [3, 1], dim: true }],
                    arrows: [{ from: [1, 1], to: [3, 1], gap: [0.48, 0.42] }],
                    notes: [{ at: [3, 0.1], text: 'then walks off' }],
                },
                {
                    tag: 'Tile taken: no spawn', tone: 'bad', size: [5, 3],
                    things: [{ is: 'powerSpawn', at: [1, 1], label: 'power spawn', labelAt: 'bottom' }, { is: 'powerCreep', at: [1, 1], scale: 0.6 }],
                    notes: [{ at: [3.2, 0.8], text: ['another power', 'creep is still', 'on the tile'] }],
                },
            ],
        }],
        'PowerCreep.upgrade': [{
            type: 'timeline', title: 'Where the Global Power Levels go', span: GPL, unit: 'Global Power Levels of the account', ticks: seq(0, GPL),
            caption: `Creating a power creep takes one level and every upgrade one more. Free levels = GPL level − number of power creeps − sum of their levels: at GPL ${GPL} with creeps of level ${list(CREEPS)} that is ${GPL} − ${CREEPS.length} − ${CREEPS.reduce((a, b) => a + b, 0)} = ${GPL - used}.`,
            rows: [{
                label: `GPL ${GPL}`,
                segs: [
                    { from: 0, to: 1, text: 'create', tone: 'a' }, { from: 1, to: 1 + CREEPS[0], text: `${CREEPS[0]} upgrades: first creep at level ${CREEPS[0]}`, tone: 'a' },
                    { from: 1 + CREEPS[0], to: 2 + CREEPS[0], text: 'create', tone: 'b' }, { from: 2 + CREEPS[0], to: used, text: `${CREEPS[1]} upgrades`, tone: 'b' },
                    { from: used, to: GPL, text: 'free', tone: 'good' },
                ],
            }],
        }],
        'StructurePowerSpawn.processPower': [{
            type: 'timeline', title: 'One fill of a power spawn', span: FILL, unit: 'ticks since the power spawn was filled',
            caption: `One call per tick burns 1 power and ${C.POWER_SPAWN_ENERGY_RATIO} energy, so ${FILL} power and ${C.POWER_SPAWN_ENERGY_CAPACITY} energy last ${FILL} ticks. Under PWR_OPERATE_POWER at level 5 a call burns ${BOOSTED} power, and with fewer left it returns ERR_NOT_ENOUGH_RESOURCES: the rest waits for a refill or the end of the effect.`,
            rows: [
                { label: 'No power', segs: [{ from: 0, to: FILL, text: '1 power per tick', tone: 'a' }] },
                { label: 'PWR_OPERATE_POWER, level 5', segs: [{ from: 0, to: BOOSTED_CALLS, text: `${BOOSTED} per tick`, tone: 'good' }, { from: BOOSTED_CALLS, to: FILL, text: `${FILL - BOOSTED_CALLS * BOOSTED} power left: ERR_NOT_ENOUGH_RESOURCES`, tone: 'bad' }] },
            ],
        }],

        // ------------------------------------------------------------ constants
        'const:power': [{
            type: 'timeline', title: 'Power in a new power bank', span: 2 * C.POWER_BANK_CAPACITY_MAX, unit: 'power in the bank',
            caption: `Every new bank rolls between POWER_BANK_CAPACITY_MIN (${C.POWER_BANK_CAPACITY_MIN}) and POWER_BANK_CAPACITY_MAX (${C.POWER_BANK_CAPACITY_MAX}). With a chance of POWER_BANK_CAPACITY_CRIT (${C.POWER_BANK_CAPACITY_CRIT}) it gets POWER_BANK_CAPACITY_MAX on top.`,
            rows: [
                { label: `${Math.round((1 - C.POWER_BANK_CAPACITY_CRIT) * 100)}% of the banks`, segs: [{ from: C.POWER_BANK_CAPACITY_MIN, to: C.POWER_BANK_CAPACITY_MAX, text: `${C.POWER_BANK_CAPACITY_MIN} to ${C.POWER_BANK_CAPACITY_MAX}`, tone: 'a' }] },
                { label: `${Math.round(C.POWER_BANK_CAPACITY_CRIT * 100)}% of the banks`, segs: [{ from: C.POWER_BANK_CAPACITY_MIN + C.POWER_BANK_CAPACITY_MAX, to: 2 * C.POWER_BANK_CAPACITY_MAX, text: `${C.POWER_BANK_CAPACITY_MAX} more`, tone: 'b' }] },
            ],
        }],
    };
};
