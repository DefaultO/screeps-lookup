'use strict';
/*
 * Figures of the economy topic: minerals, labs, boosts, factory, deposits, market, terminal transfers.
 * {entry id: [figure, ...]}. Numbers come from the constants (C). Formats: CONTRIBUTING.md, "Figures".
 */
module.exports = (C, h) => {
    const { n, seq, action } = h;
    const pct = v => Math.round(v * 100) + '%';
    // a nested constant that is missing stops the build, like a missing top-level one
    const must = (v, what) => { if (v === undefined || v !== v) throw new Error('packs/economy/figures: ' + what + ' is not in the constants'); return v; };
    const same = (list, what) => { if (list.some(v => v !== list[0])) throw new Error('packs/economy/figures: ' + what + ' are no longer equal: ' + list.join(', ')); return list[0]; };

    // ---- labs
    const run = C.LAB_REACTION_AMOUNT;
    const product = (a, b) => must((C.REACTIONS[a] || {})[b], `REACTIONS.${a}.${b}`);
    const rt = name => must(C.REACTION_TIME[name], 'REACTION_TIME.' + name);
    const step = (a, b) => { const p = product(a, b); return { name: p, sub: `${a} + ${b}, ${rt(p)} ticks`, time: rt(p) }; };
    const boostOf = (part, compound, act) => must(((C.BOOSTS[part] || {})[compound] || {})[act], `BOOSTS.${part}.${compound}.${act}`);
    // the three compounds of a family, from its mineral and H or O
    const family = (mineral, ho) => { const t1 = product(mineral, ho), t2 = product(t1, 'OH'); return [t1, t2, product(t2, 'X')]; };
    const FAMILIES = ['U', 'K', 'L', 'Z', 'G'].map(m => ({ mineral: m, H: family(m, 'H'), O: family(m, 'O') }));
    // lab cooldown per part after unboostCreep: the reaction times of the whole chain x LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT
    const unboostTicks = chain => chain.reduce((s, c) => s + rt(c), 0) * C.LAB_UNBOOST_MINERAL / run;
    const XLHO2_CHAIN = ['XLHO2', 'LHO2', 'LO', 'OH'], XGHO2_CHAIN = ['XGHO2', 'GHO2', 'GO', 'OH', 'G', 'ZK', 'UL'];
    // which body part a compound boosts
    const PART_OF = {};
    const LETTER = { work: ['W', 'WORK'], attack: ['A', 'ATTACK'], ranged_attack: ['R', 'RANGED'], heal: ['H', 'HEAL'], carry: ['C', 'CARRY'], move: ['M', 'MOVE'], tough: ['T', 'TOUGH'] };
    Object.keys(C.BOOSTS).forEach(part => Object.keys(C.BOOSTS[part]).forEach(c => { PART_OF[c] = must(LETTER[part], 'a letter for the part ' + part); }));
    const tiers = (part, compounds, act) => compounds.map(c => boostOf(part, c, act));
    const sameTiers = (list, what) => [0, 1, 2].map(i => same(list.map(t => t[i]), what + ', tier ' + (i + 1)));

    // ---- minerals
    const mineEvery = C.EXTRACTOR_COOLDOWN + 1;
    const densities = Object.keys(C.MINERAL_DENSITY).map(Number).sort((a, b) => a - b);
    const mineTicks = (amount, work) => amount / (work * C.HARVEST_MINERAL_POWER) * mineEvery;
    const drawShare = d => C.MINERAL_DENSITY_PROBABILITY[d] - (C.MINERAL_DENSITY_PROBABILITY[d - 1] || 0);
    const harvestSegs = times => [].concat(...times.map(t => [{ from: t, to: t + 1, text: 'harvest', tone: 'good' }, { from: t + 1, to: t + mineEvery, text: 'cooldown', tone: 'dim' }]));
    const moderate = C.MINERAL_DENSITY[C.DENSITY_MODERATE], moderateTicks = mineTicks(moderate, 10);

    // ---- deposits
    const depositCd = hv => Math.ceil(C.DEPOSIT_EXHAUST_MULTIPLY * Math.pow(hv, C.DEPOSIT_EXHAUST_POW));
    const depositFree = Math.floor(Math.pow(1 / C.DEPOSIT_EXHAUST_MULTIPLY, 1 / C.DEPOSIT_EXHAUST_POW));

    // ---- factory
    const com = name => must(C.COMMODITIES[name], 'COMMODITIES.' + name);
    const lvl = name => 'level ' + must(com(name).level, 'COMMODITIES.' + name + '.level');
    const SILICON = ['wire', 'switch', 'transistor', 'microchip', 'circuit', 'device'];
    const opFactory = C.POWER_INFO[C.PWR_OPERATE_FACTORY], opTerminal = C.POWER_INFO[C.PWR_OPERATE_TERMINAL];

    // ---- terminal: the 30 is written in the engine code (utils.calcTerminalEnergyCost), it is not a constant
    const sendCost = (amount, rooms) => Math.ceil(amount * (1 - Math.exp(-rooms / 30)));
    const fastCooldown = Math.round(C.TERMINAL_COOLDOWN * opTerminal.effect[opTerminal.effect.length - 1]);
    const orderDays = C.MARKET_ORDER_LIFE_TIME / 86400000;
    // rooms around a sending room: the cost of 1000 units by linear distance
    const costMap = { w: 11, h: 7, rows: [], marks: [] };
    for (let y = 0; y < costMap.h; y++) {
        let row = '';
        for (let x = 0; x < costMap.w; x++) {
            const d = Math.max(Math.abs(x - 5), Math.abs(y - 3));
            row += d === 0 ? 't' : d % 2 ? 'a' : 'b';
            costMap.marks.push(d ? { at: [x, y], text: sendCost(1000, d) } : { at: [x, y], box: [1, 1], text: 'from' });
        }
        costMap.rows.push(row);
    }

    return {
        // ------------------------------------------------------------ mechanics
        'mechanic:minerals-and-extractors': [
            {
                type: 'timeline', title: `One harvest every ${mineEvery} ticks, however many miners`, span: 3 * mineEvery, unit: 'ticks', ticks: seq(0, 3 * mineEvery, mineEvery),
                caption: `A harvest puts ${C.EXTRACTOR_COOLDOWN} ticks of cooldown on the extractor, and every creep that harvests in that same tick gets its share. Miners that take turns block each other: between them they get one harvest per ${mineEvery} ticks.`,
                rows: [
                    { label: 'Miners A and B together', segs: harvestSegs([0, mineEvery, 2 * mineEvery]), marks: [0, 1, 2].map(i => ({ at: i * mineEvery, text: 'A and B harvest' })) },
                    { label: 'A and B taking turns', segs: harvestSegs([0, mineEvery, 2 * mineEvery]), marks: ['A', 'B', 'A'].map((who, i) => ({ at: i * mineEvery, text: who + ' harvests' })) },
                ],
            },
            {
                type: 'timeline', title: 'A mineral refills only after it is empty', span: moderateTicks + C.MINERAL_REGEN_TIME, unit: 'ticks', ticks: [0, moderateTicks, moderateTicks + C.MINERAL_REGEN_TIME],
                caption: `A moderate mineral of ${n(moderate)} units, mined by 10 WORK parts, is empty after ${n(moderateTicks)} ticks. The refill timer of ${n(C.MINERAL_REGEN_TIME)} ticks starts at 0 units; with anything left it never starts.`,
                rows: [
                    { label: 'Mined down to 0', segs: [{ from: 0, to: moderateTicks, text: 'mining', tone: 'a' }, { from: moderateTicks, to: moderateTicks + C.MINERAL_REGEN_TIME, text: 'empty: the refill timer runs', tone: 'dim' }], marks: [{ at: moderateTicks, text: '0 units' }, { at: moderateTicks + C.MINERAL_REGEN_TIME, text: 'full again' }] },
                    { label: 'Stopped at 1 unit', segs: [{ from: 0, to: moderateTicks, text: 'mining', tone: 'a' }, { from: moderateTicks, to: moderateTicks + C.MINERAL_REGEN_TIME, text: 'no timer, no refill', tone: 'bad' }] },
                ],
            },
        ],
        'mechanic:labs-and-reactions': [
            {
                type: 'flow', title: 'From base minerals to a tier 3 compound', cell: [132, 54],
                caption: `Tier 1 is a mineral with H or O, tier 2 adds OH, tier 3 adds X. Each run turns ${run} units of both reagents into ${run} units of product, then the producing lab waits the ticks shown.`,
                nodes: [
                    { id: 'a', at: [0, 0], text: 'U + H', sub: 'base minerals' },
                    { id: 't1', at: [1, 0], text: product('U', 'H'), sub: `tier 1, ${rt(product('U', 'H'))} ticks`, tone: 'a' },
                    { id: 't2', at: [2, 0], text: product('UH', 'OH'), sub: `tier 2, ${rt(product('UH', 'OH'))} ticks`, tone: 'a' },
                    { id: 't3', at: [3, 0], text: product('UH2O', 'X'), sub: `tier 3, ${rt(product('UH2O', 'X'))} ticks`, tone: 'accent' },
                    { id: 'b', at: [0, 1], text: 'H + O', sub: 'base minerals' },
                    { id: 'oh', at: [1, 1], text: product('H', 'O'), sub: `${rt(product('H', 'O'))} ticks` },
                    { id: 'x', at: [2, 1], text: 'X', sub: 'base mineral' },
                ],
                edges: [{ from: 'a', to: 't1' }, { from: 't1', to: 't2' }, { from: 't2', to: 't3' }, { from: 'b', to: 'oh' }, { from: 'oh', to: 't2' }, { from: 'x', to: 't3' }],
            },
            {
                type: 'scene', title: 'Range 2 is measured from the producing lab', size: [9, 5],
                caption: 'Both source labs must be within range 2 of the lab that calls runReaction. They need not be near each other, and a source lab gets no cooldown, so it can feed several producing labs.',
                ranges: [{ at: [2, 2], r: 2, label: 'range 2 of the producing lab', labelAt: 'bl' }],
                things: [
                    { is: 'lab', at: [2, 2], kind: 'OH', label: 'producing lab', labelAt: 'bottom' },
                    { is: 'lab', at: [0, 0], kind: 'H', label: 'source', labelAt: 'right' },
                    { is: 'lab', at: [4, 2], kind: 'O', label: 'source', labelAt: 'right' },
                    { is: 'lab', at: [5, 4], empty: true, dim: true, label: 'range 3: too far', labelAt: 'right' },
                ],
                arrows: [{ from: [0, 0], to: [2, 2], tone: 'c' }, { from: [4, 2], to: [2, 2], tone: 'c' }],
                notes: [{ at: [5.3, 0.3], text: ['sources 4 tiles apart:', 'allowed'], anchor: 'start' }],
            },
        ],
        'mechanic:boosts': [
            {
                type: 'body', title: 'One compound per part, by part type', stats: false,
                caption: `A lab boosts the parts whose type its compound is listed for and skips parts that already have a boost. Each boosted part costs ${C.LAB_BOOST_MINERAL} compound and ${C.LAB_BOOST_ENERGY} energy.`,
                rows: [
                    { label: 'A lab with XLHO2: the 4 HEAL parts', parts: '4T 4M 4H', boost: { H: true }, note: `${4 * C.LAB_BOOST_MINERAL} compound and ${4 * C.LAB_BOOST_ENERGY} energy.` },
                    { label: 'Then a lab with XGHO2: the 4 TOUGH parts', parts: '4T 4M 4H', boost: { H: true, T: true }, note: `${4 * C.LAB_BOOST_MINERAL} compound and ${4 * C.LAB_BOOST_ENERGY} energy more. The MOVE parts would need a third compound.` },
                ],
            },
            {
                type: 'bars', title: `What comes back of the ${C.LAB_BOOST_MINERAL} compound in a part`, unit: 'compound', max: C.LAB_BOOST_MINERAL,
                caption: `unboostCreep returns ${pct(C.LAB_UNBOOST_MINERAL / C.LAB_BOOST_MINERAL)} at any age. A tombstone holds the compound times the share of life left, times ${C.CREEP_CORPSE_RATE} after a death and in full after recycleCreep. renewCreep removes the boosts and returns nothing.`,
                rows: [
                    { label: 'unboostCreep', sub: 'at any age', value: C.LAB_UNBOOST_MINERAL },
                    { label: 'recycleCreep', sub: 'half of its life left', value: C.LAB_BOOST_MINERAL * 0.5 },
                    { label: 'Death', sub: 'half of its life left', value: C.LAB_BOOST_MINERAL * C.CREEP_CORPSE_RATE * 0.5, tone: 'dim' },
                    { label: 'renewCreep', sub: 'boosts removed', value: 0, text: 'nothing', tone: 'bad' },
                ],
            },
        ],
        'mechanic:factory-and-commodities': [
            {
                type: 'flow', title: 'One chain: from silicon to a device', cell: [132, 54],
                caption: 'Wire is made in any factory from silicon and utrium bars. Every later step needs a factory of exactly the level shown, with PWR_OPERATE_FACTORY active on it. The biomass, metal and mist chains rise the same way.',
                nodes: [
                    { id: 'raw', at: [0, 0], text: 'silicon', sub: 'from deposits' },
                    { id: 'bar', at: [0, 1], text: 'utrium_bar', sub: 'compressed U' },
                    { id: 'wire', at: [1, 0], text: 'wire', sub: com('wire').level ? lvl('wire') : 'any factory', tone: 'a' },
                    { id: 'switch', at: [2, 0], text: 'switch', sub: lvl('switch'), tone: 'a' },
                    { id: 'transistor', at: [3, 0], text: 'transistor', sub: lvl('transistor'), tone: 'a' },
                    { id: 'microchip', at: [3, 1], text: 'microchip', sub: lvl('microchip'), tone: 'a' },
                    { id: 'circuit', at: [2, 1], text: 'circuit', sub: lvl('circuit'), tone: 'a' },
                    { id: 'device', at: [1, 1], text: 'device', sub: lvl('device'), tone: 'accent' },
                ],
                edges: [{ from: 'raw', to: 'wire' }, { from: 'bar', to: 'wire' }, { from: 'wire', to: 'switch' }, { from: 'switch', to: 'transistor' }, { from: 'transistor', to: 'microchip' }, { from: 'microchip', to: 'circuit' }, { from: 'circuit', to: 'device' }],
            },
            {
                type: 'timeline', title: 'The level stays, the effect runs out', span: 2 * opFactory.duration + 400, unit: 'ticks since the first PWR_OPERATE_FACTORY', ticks: [0, opFactory.duration, opFactory.duration + 400, 2 * opFactory.duration + 400],
                caption: `The first PWR_OPERATE_FACTORY sets the level of the factory for good, here 3. Recipes of that level run only while the effect is active, ${n(opFactory.duration)} ticks per use; in this example the operator returns 400 ticks late. Recipes without a level always run.`,
                rows: [
                    { label: 'Factory level', segs: [{ from: 0, to: 2 * opFactory.duration + 400, text: 'level 3, cannot be changed', tone: 'accent' }] },
                    { label: 'Power effect', segs: [{ from: 0, to: opFactory.duration, text: 'active', tone: 'good' }, { from: opFactory.duration + 400, to: 2 * opFactory.duration + 400, text: 'active', tone: 'good' }], marks: [{ at: opFactory.duration + 400, text: 'used again' }] },
                    { label: 'Level 3 recipes', segs: [{ from: 0, to: opFactory.duration, text: 'run', tone: 'good' }, { from: opFactory.duration, to: opFactory.duration + 400, text: 'ERR_BUSY', tone: 'bad' }, { from: opFactory.duration + 400, to: 2 * opFactory.duration + 400, text: 'run', tone: 'good' }] },
                    { label: 'Recipes without a level', segs: [{ from: 0, to: 2 * opFactory.duration + 400, text: 'run at any time', tone: 'a' }] },
                ],
            },
        ],
        'mechanic:deposits': [
            {
                type: 'line', title: 'Deposit cooldown by total harvested',
                caption: `The cooldown after a harvest is ceil(${C.DEPOSIT_EXHAUST_MULTIPLY} × total ^ ${C.DEPOSIT_EXHAUST_POW}) ticks, the total being everything ever taken from the deposit. There is none for about the first ${depositFree} units, then ${depositCd(10000)} ticks after 10,000 and ${n(depositCd(100000))} after 100,000.`,
                x: { label: 'units harvested from the deposit, by anyone', min: 0, max: 100000, step: 20000, snap: 1000 }, y: { label: 'ticks of cooldown after a harvest' },
                series: [{ name: 'cooldown', pts: seq(0, 100000, 1000).map(hv => [hv, depositCd(hv)]) }],
                marks: [{ x: 10000, label: `10,000: ${depositCd(10000)} ticks` }, { x: 50000, label: `50,000: ${depositCd(50000)} ticks` }],
            },
            {
                type: 'bars', title: 'Yield of 20 WORK parts per 1000 ticks', unit: 'units',
                caption: `A creep gets ${C.HARVEST_DEPOSIT_POWER} unit per WORK part once per cooldown, so the yield falls as the deposit wears. The wear is shared: a deposit other players have used starts slow for you too.`,
                rows: [1000, 5000, 10000, 20000, 50000, 100000].map(hv => ({ label: `${n(hv)} harvested`, sub: `cooldown ${depositCd(hv)}`, value: Math.round(20 * C.HARVEST_DEPOSIT_POWER * 1000 / Math.max(1, depositCd(hv))), tone: depositCd(hv) > 100 ? 'dim' : 'a' })),
            },
        ],
        'mechanic:market': [
            {
                type: 'scene', title: 'Who pays what in a deal', size: [11, 4],
                caption: `The owner paid ${pct(C.MARKET_FEE)} of the order's value in credits when creating it. The player who deals pays the transfer energy and gets the cooldown of ${C.TERMINAL_COOLDOWN} ticks, whether buying or selling; the deal itself has no credit fee.`,
                things: [
                    { is: 'terminal', at: [2, 1], label: 'terminal of the order', labelAt: 'top' },
                    { is: 'terminal', at: [8, 1], label: 'terminal of the dealer', labelAt: 'top' },
                ],
                arrows: [{ from: [2, 1], to: [8, 1], tone: 'c', both: true, label: 'the resource, seller to buyer' }],
                notes: [
                    { at: [5, 1.45], text: ['price × amount in credits,', 'buyer to seller'] },
                    { at: [2, 2.3], text: [`${pct(C.MARKET_FEE)} fee at createOrder`, 'no energy', 'no cooldown'] },
                    { at: [8, 2.3], text: ['pays the transfer energy', `${C.TERMINAL_COOLDOWN} ticks cooldown`, 'no credit fee'], strong: true },
                ],
            },
        ],
        'mechanic:terminal-transfers': [
            {
                type: 'bars', title: 'Energy the sender pays for 1000 units', unit: 'energy', max: 1000,
                caption: 'The cost is ceil(amount × (1 − e^(−distance / 30))) energy on top of the cargo, whatever the resource. A full bar would be as much energy as the amount sent; there is no distance limit.',
                rows: [1, 5, 10, 20, 30, 60].map(d => ({ label: d === 1 ? '1 room' : d + ' rooms', value: sendCost(1000, d), tone: d >= 30 ? 'b' : 'a' })),
            },
            {
                type: 'timeline', title: 'Only the sender waits', span: C.TERMINAL_COOLDOWN + 2, unit: 'ticks since the send', ticks: [0, fastCooldown, C.TERMINAL_COOLDOWN],
                caption: `A send that went through puts ${C.TERMINAL_COOLDOWN} ticks of cooldown on the sending terminal; PWR_OPERATE_TERMINAL at level 5 cuts it to ${fastCooldown}. The receiver gets no cooldown and can take any number of transfers.`,
                rows: [
                    { label: 'Sending terminal', segs: [{ from: 0, to: C.TERMINAL_COOLDOWN, text: 'cooldown: cannot send', tone: 'bad' }], marks: [{ at: C.TERMINAL_COOLDOWN, text: 'ready', anchor: 'start' }] },
                    { label: 'With PWR_OPERATE_TERMINAL 5', segs: [{ from: 0, to: fastCooldown, text: 'cooldown', tone: 'bad' }], marks: [{ at: fastCooldown, text: 'ready' }] },
                    { label: 'Receiving terminal', segs: [{ from: 0, to: C.TERMINAL_COOLDOWN + 2, text: 'no cooldown', tone: 'good' }] },
                ],
            },
        ],

        // ------------------------------------------------------------ recipes
        'recipe:mine-minerals': [
            {
                type: 'scene', title: 'Mining a mineral', size: [12, 4],
                caption: 'The extractor stands on the mineral and the miner next to it, on a container that catches what it harvests. A hauler carries the mineral to the terminal or storage.',
                things: [
                    { is: 'road', at: [[4, 2], [5, 2], [6, 2], [7, 2], [8, 2]] },
                    { is: 'mineral', at: [2, 1], kind: 'H' }, { is: 'extractor', at: [2, 1], label: ['extractor on', 'the mineral'], labelAt: 'top' },
                    { is: 'container', at: [3, 2], under: true }, { is: 'creep', at: [3, 2], body: '30W 10M', label: ['miner on', 'a container'], labelAt: 'bottom' },
                    { is: 'creep', at: [6, 2], body: '10C 5M', carry: 0.9, label: 'hauler', labelAt: 'bottom' },
                    { is: 'terminal', at: [9, 1], label: 'terminal', labelAt: 'top' }, { is: 'storage', at: [10, 2], label: 'storage', labelAt: 'bottom' },
                ],
                arrows: [{ from: [2, 1], to: [3, 2], tone: 'c' }, { from: [6, 2], to: [8, 2], tone: 'c', gap: [0.45, 0.2] }],
                notes: [{ at: [3.9, 0.45], text: [`30 WORK bring ${30 * C.HARVEST_MINERAL_POWER} units`, `every ${mineEvery} ticks: ${30 * C.HARVEST_MINERAL_POWER / mineEvery} per tick`], anchor: 'start' }],
            },
            {
                type: 'bars', title: 'Ticks of mining with 30 WORK, then the wait', unit: 'ticks',
                caption: `A full mineral holds ${n(C.MINERAL_DENSITY[densities[0]])} to ${n(C.MINERAL_DENSITY[densities[densities.length - 1]])} units. With 30 WORK it is empty after ${n(mineTicks(C.MINERAL_DENSITY[densities[0]], 30))} to ${n(mineTicks(C.MINERAL_DENSITY[densities[densities.length - 1]], 30))} ticks and refills ${n(C.MINERAL_REGEN_TIME)} ticks later, so recycle the miner and spawn the next one shortly before the timer ends.`,
                rows: densities.map(d => ({ label: `Mining ${n(C.MINERAL_DENSITY[d])} units`, value: mineTicks(C.MINERAL_DENSITY[d], 30) }))
                    .concat([{ label: 'Refill timer', sub: 'starts at 0 units', value: C.MINERAL_REGEN_TIME, tone: 'dim' }]),
            },
        ],
        'recipe:make-a-tier-3-boost': [
            (() => {
                const lo = step('L', 'O'), oh = step('H', 'O'), lho2 = step(lo.name, oh.name), xlho2 = step(lho2.name, 'X');
                return {
                    type: 'flow', title: `${xlho2.name}: four reactions`, cell: [132, 54],
                    caption: `One unit of ${xlho2.name} takes 1 L, 2 O, 1 H and 1 X. Each run makes ${run} units and the cooldowns of the four steps add up to ${lo.time + oh.time + lho2.time + xlho2.time} ticks per ${run} units.`,
                    nodes: [
                        { id: 'lo', at: [0, 0], text: lo.name, sub: lo.sub, tone: 'a' },
                        { id: 'oh', at: [0, 1], text: oh.name, sub: oh.sub },
                        { id: 'lho2', at: [1, 0], text: lho2.name, sub: lho2.sub, tone: 'a' },
                        { id: 'x', at: [1, 1], text: 'X', sub: 'base mineral' },
                        { id: 'xlho2', at: [2, 0], text: xlho2.name, sub: xlho2.sub, tone: 'accent' },
                    ],
                    edges: [{ from: 'lo', to: 'lho2' }, { from: 'oh', to: 'lho2' }, { from: 'lho2', to: 'xlho2' }, { from: 'x', to: 'xlho2' }],
                };
            })(),
            (() => {
                const zk = step('Z', 'K'), ul = step('U', 'L'), g = step(zk.name, ul.name), go = step(g.name, 'O'), oh = step('H', 'O'), gho2 = step(go.name, oh.name), xgho2 = step(gho2.name, 'X');
                return {
                    type: 'flow', title: `${xgho2.name}: three more reactions for G`, cell: [132, 54],
                    caption: `A ghodium compound starts with ${zk.name} and ${ul.name}, which make G; from there the steps are the same four. The last one is the slow one: ${xgho2.time} ticks per ${run} units of ${xgho2.name}.`,
                    nodes: [
                        { id: 'zk', at: [0, 0], text: zk.name, sub: zk.sub },
                        { id: 'ul', at: [0, 1], text: ul.name, sub: ul.sub },
                        { id: 'g', at: [1, 0], text: g.name, sub: g.sub, tone: 'b' },
                        { id: 'go', at: [2, 0], text: go.name, sub: go.sub, tone: 'a' },
                        { id: 'oh', at: [2, 1], text: oh.name, sub: oh.sub },
                        { id: 'gho2', at: [3, 0], text: gho2.name, sub: gho2.sub, tone: 'a' },
                        { id: 'xgho2', at: [3, 1], text: xgho2.name, sub: xgho2.sub, tone: 'accent' },
                    ],
                    edges: [{ from: 'zk', to: 'g' }, { from: 'ul', to: 'g' }, { from: 'g', to: 'go' }, { from: 'go', to: 'gho2' }, { from: 'oh', to: 'gho2' }, { from: 'gho2', to: 'xgho2' }],
                };
            })(),
        ],
        'recipe:factory-production': [
            {
                type: 'scene', title: 'One hauler for storage, terminal and factory', size: [12, 4],
                caption: `With the factory next to storage and terminal, one hauler between them loads the components and takes the product out. An operator within range ${opFactory.range} keeps PWR_OPERATE_FACTORY on the factory for recipes of level 1 to 5.`,
                things: [
                    { is: 'storage', at: [2, 1], label: 'storage', labelAt: 'left' },
                    { is: 'terminal', at: [4, 1], label: 'terminal', labelAt: 'right' },
                    { is: 'factory', at: [3, 2], label: 'factory', labelAt: 'bottom' },
                    { is: 'creep', at: [3, 1], body: '8C 4M', carry: 0.6, label: 'hauler', labelAt: 'top' },
                    { is: 'powerCreep', at: [3 + opFactory.range, 2], label: ['operator with', 'PWR_OPERATE_FACTORY'], labelAt: 'right' },
                ],
                arrows: [
                    { from: [2, 1], to: [3, 1], tone: 'energy', both: true }, { from: [4, 1], to: [3, 1], tone: 'energy', both: true }, { from: [3, 1], to: [3, 2], tone: 'energy', both: true },
                    { from: [3 + opFactory.range, 2], to: [3, 2], tone: 'accent', dashed: true, label: `range ${opFactory.range}`, side: 'below' },
                ],
                notes: [{ at: [7.2, 0.4], text: ['no operator needed for bars,', 'batteries, wire, cell,', 'alloy and condensate'], anchor: 'start' }],
            },
        ],
        'recipe:harvest-deposits': [
            {
                type: 'scene', title: 'A deposit in a highway room', size: [12, 4], terrain: ['x...........', 'x...........', 'x...........', 'x...........'],
                caption: `Creeps with WORK and CARRY harvest at range 1 whenever the cooldown of the deposit is 0. A full creep walks home or hands over to a hauler, and the walk there and back comes off the ${n(C.CREEP_LIFE_TIME)} ticks a creep lives.`,
                things: [
                    { is: 'deposit', at: [9, 1], label: 'deposit', labelAt: 'right' },
                    { is: 'creep', at: [8, 2], body: '10W 5C 15M', carry: 0.5, label: 'harvester', labelAt: 'bottom' },
                    { is: 'creep', at: [7, 2], body: '10C 10M', carry: 0.8, label: 'hauler', labelAt: 'top' },
                ],
                arrows: [{ from: [9, 1], to: [8, 2], tone: 'c' }, { from: [8, 2], to: [7, 2], tone: 'c', gap: [0.36, 0.36] }],
                paths: [{ via: [[7, 2], [6, 2], [5, 2], [4, 2], [3, 2], [2, 2], [1, 2]], tone: 'ink', dashed: true, label: 'carries the load home' }],
                notes: [{ at: [0, 0.1], text: 'exit', strong: true, anchor: 'start' }, { at: [8.4, 3.1], text: `${C.HARVEST_DEPOSIT_POWER} unit per WORK part per harvest`, anchor: 'middle' }],
            },
        ],
        'recipe:balance-resources-between-rooms': [
            {
                type: 'scene', title: 'One send, and the nearest room is the cheapest', size: [12, 5],
                caption: `A hauler moves the surplus and the energy for the cost from storage into the terminal; one send delivers it. The sender pays ${sendCost(1000, 3)} energy per 1000 units over 3 rooms and ${sendCost(1000, 10)} over 10, and then waits ${C.TERMINAL_COOLDOWN} ticks before it can serve another room.`,
                things: [
                    { is: 'storage', at: [1, 2], label: 'storage', labelAt: 'bottom' },
                    { is: 'creep', at: [2, 2], body: '8C 4M', carry: 0.8, label: 'hauler', labelAt: 'top' },
                    { is: 'terminal', at: [3, 2], label: ['terminal with', 'the surplus'], labelAt: 'bottom' },
                    { is: 'terminal', at: [9, 1], label: ['3 rooms', 'away'], labelAt: 'right' },
                    { is: 'terminal', at: [9, 3], label: ['10 rooms', 'away'], labelAt: 'right' },
                ],
                arrows: [
                    { from: [1, 2], to: [2, 2], tone: 'energy' }, { from: [2, 2], to: [3, 2], tone: 'energy' },
                    { from: [3, 2], to: [9, 1], tone: 'c', label: `${sendCost(1000, 3)} energy per 1000`, dy: -8 },
                    { from: [3, 2], to: [9, 3], tone: 'c', dashed: true, label: `${sendCost(1000, 10)} energy per 1000`, side: 'below', dy: 8 },
                ],
            },
        ],

        // ------------------------------------------------------------ API
        'StructureLab.boostCreep': [action({
            title: 'boostCreep', caption: `The creep stands next to the lab. Each matching part without a boost takes ${C.LAB_BOOST_MINERAL} compound and ${C.LAB_BOOST_ENERGY} energy from the lab. The lab must be yours; the creep need not be.`,
            body: 'TTHHHHMMMM', actor: 'creep', target: 'lab', targetOpts: { kind: 'LO' }, targetLabel: 'your lab', range: 1, flow: 'in', tone: 'c', effect: [`${C.LAB_BOOST_MINERAL} compound and`, `${C.LAB_BOOST_ENERGY} energy per part`],
        })],
        'StructureLab.unboostCreep': [{
            type: 'scene', title: 'unboostCreep', size: [11, 3],
            caption: `One call removes every boost of an adjacent creep of yours and returns ${pct(C.LAB_UNBOOST_MINERAL / C.LAB_BOOST_MINERAL)} of the compound, into a container under the creep or onto the ground. The lab then cools down ${unboostTicks(XLHO2_CHAIN)} ticks per XLHO2 part and ${unboostTicks(XGHO2_CHAIN)} per XGHO2 part, so use one that runs no reactions.`,
            ranges: [{ at: [1, 1], r: 1, label: 'range 1', labelAt: 'bl' }],
            things: [
                { is: 'lab', at: [1, 1], empty: true, label: 'your lab', labelAt: 'top' },
                { is: 'container', at: [2, 1], under: true }, { is: 'creep', at: [2, 1], body: 'TTHHHHMMMM' },
            ],
            notes: [{ at: [3.3, 0.35], text: ['your creep, here on a container:', `${C.LAB_UNBOOST_MINERAL} compound per boosted part lands there,`, `${C.LAB_BOOST_MINERAL - C.LAB_UNBOOST_MINERAL} are lost, and ${C.LAB_UNBOOST_ENERGY || 'no'} energy comes back`], anchor: 'start' }],
        }],
        'StructureLab.reverseReaction': [{
            type: 'scene', title: 'reverseReaction', size: [10, 3],
            caption: `Called on the lab that holds the compound. ${run} units become ${run} of each reagent in two labs within range 2; nothing is lost, and this lab then waits REACTION_TIME of the compound, the same as for making it.`,
            ranges: [{ at: [3, 1], r: 2, label: 'range 2', labelAt: 'tl' }],
            things: [{ is: 'lab', at: [3, 1], kind: 'OH', label: 'this lab', labelAt: 'bottom' }, { is: 'lab', at: [1, 1], kind: 'H', label: 'lab 1', labelAt: 'bottom' }, { is: 'lab', at: [5, 1], kind: 'O', label: 'lab 2', labelAt: 'bottom' }],
            arrows: [{ from: [3, 1], to: [1, 1], tone: 'c', label: `${run} H` }, { from: [3, 1], to: [5, 1], tone: 'c', label: `${run} O` }],
            notes: [{ at: [6.2, 0.6], text: ['OH → H + O', `cooldown ${rt('OH')} ticks`], anchor: 'start', strong: true }],
        }],
        'StructureTerminal.send': [{
            type: 'scene', title: 'send', size: [12, 3],
            caption: `The target room needs a terminal owned by a player. The sender pays the energy fee on top of the cargo and cools down ${C.TERMINAL_COOLDOWN} ticks; the resource is in the target terminal at the start of the next tick.`,
            things: [{ is: 'terminal', at: [1, 1], label: 'your terminal', labelAt: 'top' }, { is: 'terminal', at: [10, 1], label: 'target terminal', labelAt: 'top' }],
            arrows: [{ from: [1, 1], to: [10, 1], tone: 'c', label: '1000 units over 10 rooms: 1000 arrive' }],
            notes: [{ at: [5.5, 1.75], text: `the sender pays ${sendCost(1000, 10)} energy on top and waits ${C.TERMINAL_COOLDOWN} ticks` }],
        }],
        'StructureFactory.produce': [{
            type: 'flow', title: 'Which factory runs which recipe', cell: [178, 54],
            caption: 'A recipe without a level runs in any factory. A recipe with a level needs a factory of exactly that level and the power effect on it. Either way the components must be in the factory itself.',
            nodes: [
                { id: 'q1', at: [0, 0], text: 'Recipe has a level?', sub: 'COMMODITIES[type].level' },
                { id: 'q2', at: [0, 1], text: 'Factory of that level?' },
                { id: 'q3', at: [0, 2], text: 'Power effect active?', sub: 'PWR_OPERATE_FACTORY' },
                { id: 'a4', at: [0, 3], text: 'one batch is made', tone: 'good' },
                { id: 'a1', at: [1, 0], text: 'runs in any factory', tone: 'good' },
                { id: 'a2', at: [1, 1], text: 'ERR_INVALID_TARGET', tone: 'bad', mono: true },
                { id: 'a3', at: [1, 2], text: 'ERR_BUSY', tone: 'bad', mono: true },
            ],
            edges: [{ from: 'q1', to: 'a1', label: 'no' }, { from: 'q2', to: 'a2', label: 'no' }, { from: 'q3', to: 'a3', label: 'no' }, { from: 'q1', to: 'q2', label: 'yes' }, { from: 'q2', to: 'q3', label: 'yes' }, { from: 'q3', to: 'a4', label: 'yes' }],
        }],
        'StructureExtractor': [{
            type: 'timeline', title: 'Rest after each harvest', span: 2 * mineEvery + 1, unit: 'ticks', ticks: seq(0, 2 * mineEvery, mineEvery),
            caption: `Built on the mineral, the extractor lets creeps harvest it and then rests ${C.EXTRACTOR_COOLDOWN} ticks: one harvest every ${mineEvery} ticks.`,
            rows: [{ label: 'Extractor', segs: harvestSegs([0, mineEvery]).concat([{ from: 2 * mineEvery, to: 2 * mineEvery + 1, text: 'harvest', tone: 'good' }]), marks: [0, 1, 2].map(i => ({ at: i * mineEvery, text: 'harvest' })) }],
        }],
        'Mineral': [action({
            title: 'Harvesting a mineral', caption: `The mineral blocks movement, so the creep harvests from a neighbouring tile, and only with an extractor built on the mineral. Once emptied it refills after ${n(C.MINERAL_REGEN_TIME)} ticks.`,
            body: '10W 2C 3M', actor: 'miner', target: 'mineral', targetOpts: { kind: 'O' }, targetLabel: 'mineral with extractor', things: [{ is: 'extractor', at: [2, 0] }], range: 1, flow: 'in', tone: 'c',
            effect: ['one mineral of one', 'type per room'],
        })],
        'Deposit': [action({
            title: 'Harvesting a deposit', caption: 'Any creep with WORK harvests a deposit from an adjacent tile. No structure, ownership or reservation is involved, and the deposit itself blocks movement.',
            body: '10W 5C 15M', actor: 'creep', target: 'deposit', targetLabel: 'deposit', range: 1, flow: 'in', tone: 'c', effect: ['no extractor,', 'no ownership needed'],
        })],
        'Game.market.deal': [{
            type: 'panels', title: 'Dealing on a sell order and on a buy order',
            caption: `Either way your terminal pays the transfer energy and cools down ${C.TERMINAL_COOLDOWN} ticks; the terminal of the order does neither. The buyer pays amount × price and the seller receives exactly that.`,
            panels: [
                {
                    tag: 'Sell order: you buy', size: [6, 3], note: 'You pay amount × price in credits.',
                    things: [{ is: 'terminal', at: [1, 1], label: 'the order', labelAt: 'bottom' }, { is: 'terminal', at: [4, 1], label: 'your terminal', labelAt: 'bottom' }],
                    arrows: [{ from: [1, 1], to: [4, 1], tone: 'c', label: 'resource' }],
                    notes: [{ at: [4, 0.1], text: 'pays the energy', strong: true }],
                },
                {
                    tag: 'Buy order: you sell', size: [6, 3], note: 'You receive amount × price in credits.',
                    things: [{ is: 'terminal', at: [1, 1], label: 'the order', labelAt: 'bottom' }, { is: 'terminal', at: [4, 1], label: 'your terminal', labelAt: 'bottom' }],
                    arrows: [{ from: [4, 1], to: [1, 1], tone: 'c', label: 'resource' }],
                    notes: [{ at: [4, 0.1], text: 'pays the energy', strong: true }],
                },
            ],
        }],
        'Game.market.createOrder': [{
            type: 'panels', title: 'The two order types',
            caption: `Either type costs ${pct(C.MARKET_FEE)} of price × amount in credits when it is created, and starts inactive. An order lives ${orderDays} days of real time; when it expires the fee of the unfilled part comes back, cancelOrder pays nothing back.`,
            panels: [
                {
                    tag: '`ORDER_SELL`: you offer', size: [5, 3], note: 'Active while the terminal holds the resource.',
                    things: [{ is: 'terminal', at: [1, 1], label: 'your terminal', labelAt: 'bottom' }],
                    arrows: [{ from: [1, 1], to: [4.4, 1], tone: 'c', label: 'to whoever deals', dx: 12 }],
                },
                {
                    tag: '`ORDER_BUY`: you ask', size: [5, 3], note: 'Active while you can pay for one unit and the terminal has free space.',
                    things: [{ is: 'terminal', at: [1, 1], label: 'your terminal', labelAt: 'bottom' }],
                    arrows: [{ from: [4.4, 1], to: [1, 1], tone: 'c', label: 'from whoever deals', dx: 14 }],
                },
            ],
        }],
        'Game.market.calcTransactionCost': [{
            type: 'map', title: 'Energy to move 1000 units, room by room', cell: 44,
            caption: 'Each cell is a room; the number is what calcTransactionCost(1000, the middle room, that room) returns. The distance is the linear room distance, so rooms with the same cost form a square ring.',
            rows: costMap.rows, marks: costMap.marks,
            key: { t: { label: 'room of the terminal' }, a: { label: 'distance 1, 3, 5', tone: 'a', weak: true }, b: { label: 'distance 2, 4', tone: 'b', weak: true } },
        }],

        // ------------------------------------------------------------ constants
        'const:reactions': [(() => {
            const t3 = [].concat(...FAMILIES.map(f => [f.H[2], f.O[2]]));
            const times = t3.map(rt), usual = times.slice().sort((a, b) => times.filter(v => v === b).length - times.filter(v => v === a).length)[0];
            const slow = t3.filter(c => rt(c) > usual).sort((a, b) => rt(b) - rt(a));
            return {
                type: 'cols', title: 'Cooldown of the last step, by tier 3 compound', x: { label: 'tier 3 compound', cats: t3 }, y: { label: 'REACTION_TIME: ticks the lab waits after one run' },
                caption: `Most tier 3 reactions put ${usual} ticks of cooldown on the producing lab for a run of ${run} units. The slow ones: ${slow.map(c => `${c} ${rt(c)}`).join(', ')}.`,
                series: [{ name: 'ticks', values: times }],
            };
        })()],
        'const:boosts': [(() => {
            const harvest = tiers('work', FAMILIES[0].O, 'harvest');
            const build = sameTiers([tiers('work', FAMILIES[2].H, 'build'), tiers('work', FAMILIES[2].H, 'repair'), tiers('work', FAMILIES[4].H, 'upgradeController')], 'the build, repair and upgradeController boosts');
            const other = sameTiers([tiers('attack', FAMILIES[0].H, 'attack'), tiers('ranged_attack', FAMILIES[1].O, 'rangedAttack'), tiers('ranged_attack', FAMILIES[1].O, 'rangedMassAttack'), tiers('heal', FAMILIES[2].O, 'heal'), tiers('heal', FAMILIES[2].O, 'rangedHeal'),
                tiers('work', FAMILIES[3].H, 'dismantle'), tiers('carry', FAMILIES[1].H, 'capacity'), tiers('move', FAMILIES[3].O, 'fatigue')], 'the attack, ranged, heal, dismantle, capacity and fatigue boosts');
            const tough = tiers('tough', FAMILIES[4].O, 'damage');
            const groups = [harvest, build, other, tough];
            return {
                type: 'cols', title: 'Multiplier by tier', x: { label: 'boosted action', cats: ['harvest', 'build, repair, upgrade', 'all other actions', 'TOUGH: damage taken'] }, y: { label: 'multiplier of one boosted part' },
                caption: 'The three tiers of a family multiply the same action by a growing factor. "All other actions" are attack, rangedAttack, rangedMassAttack, heal, rangedHeal, dismantle, capacity and fatigue. For TOUGH the number is the share of damage taken, so lower is better.',
                series: [0, 1, 2].map(i => ({ name: 'tier ' + (i + 1), values: groups.map(g => g[i]) })),
            };
        })()],
        'const:commodities': [(() => {
            const top4 = same(['circuit', 'organoid', 'hydraulics', 'emanation'].map(c => com(c).cooldown), 'the cooldowns of the level 4 commodities');
            const top5 = same(['device', 'organism', 'machine', 'essence'].map(c => com(c).cooldown), 'the cooldowns of the level 5 commodities');
            return {
                type: 'cols', title: 'Cooldown of one produce call, silicon chain', x: { label: 'product, from no level to level 5', cats: SILICON }, y: { label: 'COMMODITIES[product].cooldown in ticks' },
                caption: `Each produce call sets the cooldown of its recipe. Wire takes ${com('wire').cooldown} ticks for a batch of ${com('wire').amount}; a circuit takes ${top4} ticks for ${com('circuit').amount}. Levels 4 and 5 cost ${top4} and ${top5} ticks in all four chains.`,
                series: [{ name: 'ticks', values: SILICON.map(c => com(c).cooldown) }],
            };
        })()],
        'const:resources': [(() => {
            const cells = FAMILIES.map(f => f.H.concat(f.O));
            const SHORT = { attack: 'attack', harvest: 'harvest', capacity: 'capacity', rangedAttack: 'ranged', build: 'build', heal: 'heal', dismantle: 'dismantle', fatigue: 'fatigue', upgradeController: 'upgrade', damage: 'damage' };
            const marks = [];
            cells.forEach((row, y) => row.forEach((c, x) => {
                const part = Object.keys(C.BOOSTS).find(p => C.BOOSTS[p][c]), act = Object.keys(C.BOOSTS[part][c])[0];
                marks.push({ at: [x, y], text: c, dy: -16 }, { at: [x, y], text: must(PART_OF[c], 'a boost for ' + c)[1] },
                    { at: [x, y], text: `${must(SHORT[act], 'a short name for ' + act)} ×${C.BOOSTS[part][c][act]}`, dy: 16 });
            }));
            const key = {};
            Object.values(LETTER).forEach(([letter]) => { key[letter] = { tone: letter, weak: true }; });
            return {
                type: 'map', title: 'The 30 boost compounds, by name', cell: 80,
                caption: 'U, K, L, Z or G with H or O is tier 1, adding OH makes tier 2 and adding X tier 3. Each cell names the compound, the body part it boosts and the first action it multiplies; G is itself made from ZK and UL.',
                rows: cells.map(row => row.map(c => PART_OF[c][0]).join('')), marks, key,
                xlabels: ['+ H', '+ OH', '+ X', '+ O', '+ OH', '+ X'], ylabels: FAMILIES.map(f => f.mineral),
            };
        })()],
        'const:sources-minerals': [{
            type: 'cols', title: 'Units in a full mineral, by density', x: { label: 'density', cats: densities.map(d => ({ [C.DENSITY_LOW]: 'low', [C.DENSITY_MODERATE]: 'moderate', [C.DENSITY_HIGH]: 'high', [C.DENSITY_ULTRA]: 'ultra' }[d] || String(d))) }, y: { label: 'MINERAL_DENSITY: amount after a refill' },
            caption: `A mineral is refilled to the amount of its density. A draw gives ${densities.map(d => ({ [C.DENSITY_LOW]: 'low', [C.DENSITY_MODERATE]: 'moderate', [C.DENSITY_HIGH]: 'high', [C.DENSITY_ULTRA]: 'ultra' }[d] || d) + ' ' + pct(drawShare(d))).join(', ')}; low and ultra are always drawn again at a refill, moderate and high with a ${pct(C.MINERAL_DENSITY_CHANGE)} chance.`,
            series: [{ name: 'units', values: densities.map(d => C.MINERAL_DENSITY[d]) }],
        }],
    };
};
