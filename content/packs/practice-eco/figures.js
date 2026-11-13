'use strict';
/*
 * Figures of the pack "practice-eco": {entry id: [figure, ...]}. These entries describe what players do,
 * so layouts are drawn as one common way and the captions say so. Numbers come from the constants (C) or
 * from a formula the entry states. Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n, seq } = h;
    const r2 = v => Math.round(v * 100) / 100;
    const bodyCost = b => Object.keys(b).reduce((sum, p) => sum + b[p] * C.BODYPART_COST[p], 0);
    const bodySize = b => Object.keys(b).reduce((sum, p) => sum + b[p], 0);
    const rate = C.SOURCE_ENERGY_CAPACITY / C.ENERGY_REGEN_TIME, neutral = C.SOURCE_ENERGY_NEUTRAL_CAPACITY / C.ENERGY_REGEN_TIME, keeper = C.SOURCE_ENERGY_KEEPER_CAPACITY / C.ENERGY_REGEN_TIME;
    const roadTile = C.ROAD_DECAY_AMOUNT * C.REPAIR_COST / C.ROAD_DECAY_TIME;
    const spawnEnergy = l => C.CONTROLLER_STRUCTURES.spawn[l] * C.SPAWN_ENERGY_CAPACITY + C.CONTROLLER_STRUCTURES.extension[l] * C.EXTENSION_ENERGY_CAPACITY[l];

    // One remote source whose road is d tiles long, as recipe:remote-mining-economics computes it:
    // miner one WORK part more than the source needs, hauler CARRY for rate x round trip, reserver 2 CLAIM + 2 MOVE
    // shared by the sources of the room, upkeep of the container, the road and the wear of the hauler.
    function remote(d, perTick, reserved, sources) {
        const work = Math.floor(perTick / C.HARVEST_POWER) + 1;
        const miner = { work, carry: 1, move: Math.ceil(work / 2) };
        const carry = Math.ceil(perTick * 2 * d / C.CARRY_CAPACITY);
        const hauler = { carry, move: Math.ceil(carry / 2) };
        const reserver = { claim: 2, move: 2 };
        const reservedTicks = reserver.claim * C.CONTROLLER_RESERVE * (C.CREEP_CLAIM_LIFE_TIME - d);
        const cost = {
            miner: bodyCost(miner) / (C.CREEP_LIFE_TIME - d),
            hauler: bodyCost(hauler) / C.CREEP_LIFE_TIME,
            reserver: reserved ? bodyCost(reserver) / reservedTicks / sources : 0,
            upkeep: C.CONTAINER_DECAY * C.REPAIR_COST / C.CONTAINER_DECAY_TIME + (d + bodySize(hauler) * C.ROAD_WEAROUT) * roadTile,
        };
        const total = cost.miner + cost.hauler + cost.reserver + cost.upkeep;
        return { miner, hauler, reserver, cost, total, net: perTick - total };
    }
    const SAMPLE = 50, sample = remote(SAMPLE, rate, true, 1);
    const spec = b => Object.keys(b).map(p => b[p] + ({ work: 'W', carry: 'C', move: 'M', claim: 'L' })[p]).join(' ');

    // hauling
    const carryFor = (perTick, d) => Math.ceil(perTick * 2 * d / C.CARRY_CAPACITY);
    const maxCarry = Math.floor(C.MAX_CREEP_SIZE * 2 / 3);        // CARRY parts of a full road hauler
    const carryPerTile = rate * 2 / C.CARRY_CAPACITY;
    const haulPerTile = carryPerTile * (C.BODYPART_COST.carry + C.BODYPART_COST.move / 2) / C.CREEP_LIFE_TIME;
    const linkLoss = C.LINK_LOSS_RATIO * rate;
    const linkAhead = linkLoss / haulPerTile;
    const tripRoad = seq(1, 10).map(x => [x, 2]);                 // the road of the round-trip scene: d tiles
    const tripD = tripRoad.length, tripCarry = carryFor(rate, tripD);

    // a filler block: two creeps beside a link, a spawn and extensions around them
    const fillBlock = ['EESEE', 'EcLcE', 'EEEEE'], fillAt = [3, 1];
    const fillThings = [], fillers = [];
    let fillReached = 0;
    fillBlock.forEach((row, y) => row.split('').forEach((ch, x) => {
        const at = [fillAt[0] + x, fillAt[1] + y];
        if (ch === 'c') { fillers.push(at); return; }
        fillThings.push(ch === 'E' ? { is: 'extension', at } : ch === 'S' ? { is: 'spawn', at, label: 'spawn', labelAt: 'top' } : { is: 'link', at });
    }));
    fillBlock.forEach((row, y) => row.split('').forEach((ch, x) => {
        if (ch === 'E' && fillers.some(f => Math.max(Math.abs(f[0] - fillAt[0] - x), Math.abs(f[1] - fillAt[1] - y)) <= 1)) fillReached++;
    }));

    // distance transform of a piece of terrain: range to the nearest wall tile
    const dtTerrain = ['#############', '###.......###', '##.........##', '#...........#', '#...........#', '#.......#...#', '##..........#', '####.....####', '#############'];
    const dtWall = (x, y) => y < 0 || y >= dtTerrain.length || x < 0 || x >= dtTerrain[0].length || dtTerrain[y].charAt(x) === '#';
    const dtValue = (x, y) => { for (let r = 1; ; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dtWall(x + dx, y + dy)) return r; };
    const STAMP = 5, stampValue = (STAMP + 1) / 2;
    const dtMarks = [];
    dtTerrain.forEach((row, y) => row.split('').forEach((ch, x) => {
        if (ch === '#') return;
        const v = dtValue(x, y);
        dtMarks.push({ at: [x, y], text: v, tone: v >= stampValue ? 'good' : v === 2 ? 'a' : 'dim' });
    }));

    // stamps: a lab block whose middle column holds the two source labs, and a field of extensions and roads
    const stampLabs = [];
    for (let y = 1; y <= 2; y++) for (let x = 1; x <= 5; x++) stampLabs.push({ is: 'lab', at: [x, y], kind: x === 3 ? (y === 1 ? 'O' : 'H') : 'OH' });
    const fieldTiles = [];
    for (let y = 8; y <= 10; y++) for (let x = 1; x <= 11; x++) fieldTiles.push([x, y]);

    // roads searched one by one: each path alone, and with earlier road tiles made cheaper
    const roadsAlone = [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [2, 3], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4]];
    const roadsJoined = [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 1], [7, 3]];
    const roadPanel = (tag, tone, roads) => ({
        tag: `${tag}: ${roads.length} road tiles`, tone, tile: 30, size: [10, 6],
        things: [
            { is: 'road', at: roads },
            { is: 'storage', at: [1, 2], label: 'storage', labelAt: 'bottom' },
            { is: 'source', at: [9, 0], label: 'source', labelAt: 'left' }, { is: 'container', at: [8, 1] },
            { is: 'source', at: [9, 5], label: 'source', labelAt: 'left' }, { is: 'container', at: [8, 4] },
        ],
    });

    // GCL
    const gclTotal = level => Math.round(C.GCL_MULTIPLY * Math.pow(level - 1, C.GCL_POW));
    const cap = C.CONTROLLER_MAX_UPGRADE_PER_TICK, xgh2o = C.BOOSTS.work.XGH2O.upgradeController;
    const GCL_LEVELS = [2, 3, 4, 5, 6, 8, 10, 15, 20, 30];
    const upgraders = [[2, 1], [3, 1], [4, 1], [2, 2], [4, 2], [2, 3], [2, 4], [3, 4], [4, 4]];

    // progression: income of two own sources by room level, with the largest miner the spawn energy pays next to one MOVE
    const ownIncome = l => 2 * C.HARVEST_POWER * Math.min(rate / C.HARVEST_POWER, Math.floor((spawnEnergy(l) - C.BODYPART_COST.move) / C.BODYPART_COST.work));
    const levelTicks = seq(1, 7).map(l => Math.ceil(C.CONTROLLER_LEVELS[l] / ownIncome(l)));
    const firstLevel = type => seq(1, 8).find(l => C.CONTROLLER_STRUCTURES[type][l] > 0);
    const from = (level, text, tone) => ({ from: level, to: 9, text, tone: tone || 'a' });

    // spawn queue: the successor of a creep, with the miner of the remote entry and a walk of SAMPLE tiles as the example
    const heirParts = bodySize(sample.miner), heirSpawn = C.CREEP_SPAWN_TIME * heirParts, heirLead = heirSpawn + SAMPLE, life = C.CREEP_LIFE_TIME;
    const restart = C.BODYPART_COST.work + C.BODYPART_COST.carry + C.BODYPART_COST.move;

    return {
        // ------------------------------------------------------------ base planning
        'recipe:base-planning': [
            {
                type: 'scene', title: 'Distance transform: where a stamp fits', tile: 32, size: [13, 9], terrain: dtTerrain,
                caption: `A common tool of room planners: every tile gets its distance to the nearest wall tile. A square of odd side s fits around a tile whose value is at least (s + 1) ÷ 2, so a ${STAMP} × ${STAMP} stamp fits on each tile marked ${stampValue}. In a real room the two outer rings count as wall.`,
                marks: dtMarks,
                ranges: [{ at: [5, 3], r: (STAMP - 1) / 2 }],
                notes: [{ at: [5, 0], text: `${STAMP} × ${STAMP} around a tile marked ${stampValue}` }],
            },
            {
                type: 'scene', wide: true, title: 'Stamps: small fixed groups, placed one after another', size: [13, 11],
                caption: 'One way to lay out a base from stamps; the layouts of players differ. The hub puts storage, link, terminal, factory and power spawn around the tile of one creep, every lab lies within range 2 of the two source labs, each spawn keeps free tiles next to it, and extensions alternate with roads so that a filler passes each of them at range 1.',
                ranges: [{ at: [6, 5], r: 1 }],
                things: [
                    { is: 'road', at: fieldTiles.filter(p => (p[0] + p[1]) % 2 === 1) },
                    { is: 'extension', at: fieldTiles.filter(p => (p[0] + p[1]) % 2 === 0 && !(p[0] === 6 && p[1] === 8)) },
                    { is: 'spawn', at: [6, 8] },
                ].concat(stampLabs, [
                    { is: 'tower', at: [[8, 1], [9, 1], [10, 1], [8, 2], [9, 2], [10, 2]] },
                    { is: 'storage', at: [5, 4], label: 'storage', labelAt: 'top' }, { is: 'link', at: [6, 4], label: 'link', labelAt: 'top' }, { is: 'terminal', at: [7, 4], label: 'terminal', labelAt: 'top' },
                    { is: 'factory', at: [5, 6], label: 'factory', labelAt: 'bottom' }, { is: 'powerSpawn', at: [7, 6], label: 'power spawn', labelAt: 'bottom' },
                    { is: 'creep', at: [6, 5], body: 'CCCCCCCM', carry: 0.5 },
                    { is: 'spawn', at: [2, 5], label: 'spawn', labelAt: 'bottom' }, { is: 'spawn', at: [10, 5], label: 'spawn', labelAt: 'bottom' },
                ]),
                notes: [
                    { at: [-0.4, 0], text: 'labs: each within range 2 of the two source labs', anchor: 'start' },
                    { at: [9, 0], text: 'towers, here in one cluster' },
                    { at: [8.45, 4.85], text: ['hub creep:', 'serves five'] },
                    { at: [-0.4, 4.1], text: 'free tiles around each spawn', anchor: 'start' },
                    { at: [-0.4, 7.05], text: 'extensions alternate with roads', anchor: 'start' },
                    { at: [8.7, 7.05], text: 'fillers pass at range 1', anchor: 'start' },
                ],
            },
            {
                type: 'panels', wide: true, title: 'Later paths join earlier roads',
                caption: `Search the paths one after another and give the tiles already chosen as road a lower cost than plain. Here both sources stay as many steps away, and the roads share a trunk: ${roadsJoined.length} tiles to build and hold instead of ${roadsAlone.length}.`,
                panels: [roadPanel('Each path searched alone', 'dim', roadsAlone), roadPanel('Earlier road tiles cost less', 'good', roadsJoined)],
            },
            {
                type: 'scene', title: 'A rampart line at an exit', tile: 36, size: [10, 7],
                terrain: ['##########', '###.......', 'x.........', 'x.........', 'x.........', '###.......', '##########'],
                caption: 'Nothing can be built on the border ring and only roads and containers on the next, so the line stands 2 tiles inside the room. Players keep it 3 tiles from what it protects, out of reach of a ranged attack, or give the structures behind it ramparts of their own.',
                ranges: [{ at: [1, 3], r: 3, tone: 'bad', label: 'range 3 of the attacker', labelAt: 'br' }],
                things: [
                    { is: 'rampart', at: [[2, 2], [2, 3], [2, 4]] },
                    { is: 'creep', at: [1, 3], body: 'RRRMMM', foe: true },
                    { is: 'tower', at: [4, 3] }, { is: 'rampart', at: [4, 3] },
                    { is: 'storage', at: [5, 3], label: ['3 tiles from the line:', 'out of reach'], labelAt: 'right' },
                ],
                notes: [
                    { at: [2, 1.05], text: 'rampart line' },
                    { at: [4.6, 1.4], text: ['2 tiles from the line:', 'needs its own rampart'], anchor: 'start' },
                    { at: [0, 5.05], text: 'exit' },
                ],
            },
        ],

        // ------------------------------------------------------------ remote mining economics
        'recipe:remote-mining-economics': [
            {
                type: 'line', title: 'Net energy per tick of one remote source, by road distance', endLabels: false,
                caption: `Income less the cost per tick of miner, hauler, reserver and upkeep. A reserved source gives ${rate} per tick and an unreserved one ${neutral}; the hauler grows with every tile, so players take the nearest sources first.`,
                x: { label: 'road tiles from the drop-off to the source', min: 0, max: 200, step: 25, snap: 5 }, y: { label: 'net energy per tick', max: rate },
                series: [
                    { name: 'reserved, 2 sources in the room', pts: seq(10, 200, 5).map(d => [d, r2(remote(d, rate, true, 2).net)]) },
                    { name: 'reserved, 1 source', pts: seq(10, 200, 5).map(d => [d, r2(remote(d, rate, true, 1).net)]) },
                    { name: 'not reserved', pts: seq(10, 200, 5).map(d => [d, r2(remote(d, neutral, false, 1).net)]) },
                ],
            },
            {
                type: 'bars', title: `One reserved source at ${SAMPLE} road tiles: energy per tick`, max: rate,
                caption: `Of ${rate} energy per tick, ${r2(sample.total)} go to the creeps and the upkeep and ${r2(sample.net)} are left. Building, guards and CPU are not counted.`,
                rows: [
                    { label: 'Income', sub: 'reserved source', value: rate, text: String(rate), tone: 'good' },
                    { label: 'Hauler', sub: `body cost ÷ ${n(C.CREEP_LIFE_TIME)} ticks`, value: sample.cost.hauler, text: String(r2(sample.cost.hauler)), tone: 'C' },
                    { label: 'Miner', sub: 'body cost ÷ its working life', value: sample.cost.miner, text: String(r2(sample.cost.miner)), tone: 'W' },
                    { label: 'Reserver', sub: 'alone in its room', value: sample.cost.reserver, text: String(r2(sample.cost.reserver)), tone: 'L' },
                    { label: 'Container and road', sub: 'repair', value: sample.cost.upkeep, text: String(r2(sample.cost.upkeep)), tone: 'dim' },
                    { label: 'Net', value: sample.net, text: String(r2(sample.net)), tone: 'accent' },
                ],
            },
            {
                type: 'body', title: `The creeps of one reserved source at ${SAMPLE} road tiles`,
                caption: `The miner has one WORK part more than the source needs, which buys the ticks for repairing its container. The hauler carries ${rate} × 2 × ${SAMPLE} ÷ ${C.CARRY_CAPACITY} with half as many MOVE parts for the road; the reserver is shared by all sources of the room.`,
                rows: [
                    { label: 'Miner', parts: spec(sample.miner) },
                    { label: 'Hauler', parts: spec(sample.hauler) },
                    { label: 'Reserver', parts: spec(sample.reserver), note: `Lives ${C.CREEP_CLAIM_LIFE_TIME} ticks and holds the room for 2 × (${C.CREEP_CLAIM_LIFE_TIME} − walk) ticks.` },
                ],
            },
        ],

        // ------------------------------------------------------------ room selection
        'recipe:room-selection': [
            {
                type: 'bars', title: 'What a room earns and what its controller takes', unit: 'energy per tick',
                caption: `A one-source room earns less than the ${cap} energy per tick its controller can take at level 8; a two-source room earns ${2 * rate}. Players usually ask for two sources, but how to weigh the criteria is each player's choice.`,
                rows: [
                    { label: 'One source', value: rate },
                    { label: 'Level 8 controller', sub: 'the most it takes', value: cap, tone: 'dim' },
                    { label: 'Two sources', value: 2 * rate },
                ],
            },
        ],

        // ------------------------------------------------------------ spawn queue
        'recipe:spawn-queue': [
            {
                type: 'flow', title: 'What size the next creep gets', cell: [176, 54],
                caption: `A common rule. With filler and miner alive the spawn builds the largest body the room capacity pays. Without them it builds what the energy at hand pays, down to a creep of ${restart} energy; a list that only knows full-size bodies never recovers.`,
                nodes: [
                    { id: 'idle', at: [0, 0], text: 'Idle spawn', sub: 'first need on the list' },
                    { id: 'q', at: [1, 0], text: 'Filler and miner alive?' },
                    { id: 'normal', at: [2, 0], text: 'Normal size', sub: 'energyCapacityAvailable', tone: 'good' },
                    { id: 'small', at: [1, 1], text: 'Emergency size', sub: 'energyAvailable', tone: 'warn' },
                    { id: 'least', at: [2, 1], text: 'WORK, CARRY, MOVE', sub: `the least: ${restart} energy` },
                ],
                edges: [{ from: 'idle', to: 'q' }, { from: 'q', to: 'normal', label: 'yes' }, { from: 'q', to: 'small', label: 'no' }, { from: 'small', to: 'least', label: 'down to' }],
            },
            {
                type: 'timeline', title: 'Order the successor before the old creep dies', span: [life - 150, life + 50], unit: 'age of the old creep in ticks', ticks: seq(life - 150, life + 50, 50),
                caption: `Put the successor on the list when ticksToLive falls to ${C.CREEP_SPAWN_TIME} × its parts + the walk to its work place. For a body of ${heirParts} parts and a walk of ${SAMPLE} tiles that is ${heirLead}: it arrives in the tick the old creep dies.`,
                rows: [
                    { label: 'Old creep', segs: [{ from: life - 150, to: life, text: 'works', tone: 'a' }], marks: [{ at: life, text: 'dies' }] },
                    {
                        label: 'Successor',
                        segs: [{ from: life - heirLead, to: life - SAMPLE, text: 'spawns', tone: 'energy' }, { from: life - SAMPLE, to: life, text: `walks ${SAMPLE} tiles`, tone: 'dim' }, { from: life, to: life + 50, text: 'works', tone: 'a' }],
                        marks: [{ at: life - heirLead, text: `ordered at ticksToLive ${heirLead}`, anchor: 'end' }],
                    },
                ],
            },
        ],

        // ------------------------------------------------------------ hauling logistics
        'recipe:hauling-logistics': [
            {
                type: 'scene', wide: true, title: 'Sizing a hauler from the round trip', size: [13, 4],
                caption: `CARRY parts = energy per tick × round trip ÷ ${C.CARRY_CAPACITY}. Here the path is ${tripD} tiles one way, so the ${rate} energy per tick of the source need ${tripCarry} CARRY parts; loading and unloading ticks come on top.`,
                things: [
                    { is: 'road', at: tripRoad },
                    { is: 'storage', at: [0, 2], label: 'storage', labelAt: 'bottom' },
                    { is: 'creep', at: [8, 2], body: `${tripCarry}C ${Math.ceil(tripCarry / 2)}M`, carry: 1, label: ['hauler', `${tripCarry} CARRY, ${Math.ceil(tripCarry / 2)} MOVE`], labelAt: 'bottom' },
                    { is: 'container', at: [11, 2], under: true }, { is: 'creep', at: [11, 2], body: '5W M', label: 'miner', labelAt: 'bottom' },
                    { is: 'source', at: [12, 1], label: 'source', labelAt: 'top' },
                ],
                arrows: [
                    { from: [12, 1], to: [11, 2], tone: 'energy' },
                    { from: [7, 2], to: [1, 2], tone: 'energy', gap: [0.45, 0.2], label: 'loaded: 1 MOVE per 2 CARRY on a road', side: 'below', dx: -8 },
                    { from: [1, 1], to: [10, 1], tone: 'dim', dashed: true, label: 'empty: full speed on any terrain' },
                ],
                notes: [{ at: [-0.35, 0], text: `${rate} per tick × ${2 * tripD} ticks ÷ ${C.CARRY_CAPACITY} = ${tripCarry} CARRY`, anchor: 'start', strong: true }],
            },
            {
                type: 'line', title: 'CARRY parts for one source, by path length', endLabels: false,
                caption: `Energy per tick × 2 × distance ÷ ${C.CARRY_CAPACITY}, rounded up. A body of ${C.MAX_CREEP_SIZE} parts holds ${maxCarry} CARRY with half as many MOVE for roads, which covers an owned source up to ${Math.floor(maxCarry / carryPerTile)} tiles away; beyond that it takes two haulers.`,
                x: { label: 'tiles one way', min: 0, max: 150, step: 25, snap: 5 }, y: { label: 'CARRY parts' },
                series: [
                    { name: `keeper room, ${r2(keeper)} per tick`, pts: seq(0, 150, 5).map(d => [d, carryFor(keeper, d)]) },
                    { name: `owned or reserved, ${rate} per tick`, pts: seq(0, 150, 5).map(d => [d, carryFor(rate, d)]) },
                    { name: `not reserved, ${neutral} per tick`, pts: seq(0, 150, 5).map(d => [d, carryFor(neutral, d)]) },
                ],
                marks: [{ y: maxCarry, label: `one road hauler: ${maxCarry} CARRY` }],
            },
            {
                type: 'scene', title: 'A filler that never walks', size: [11, 5],
                caption: `One way to build a filler that stands still, as players do: two creeps next to a link, inside a block of extensions. Between them they reach the spawn and all ${fillReached} extensions without a step; a storage can take the place of the link.`,
                ranges: fillers.map((at, i) => ({ at, r: 1, tone: i ? 'a' : 'accent' })),
                things: fillThings.concat(fillers.map(at => ({ is: 'creep', at, body: 'CCCC', carry: 0.6 }))),
                arrows: fillers.map(at => ({ from: [fillAt[0] + 2, fillAt[1] + 1], to: at, tone: 'energy', gap: [0.3, 0.36] })),
                notes: [
                    { at: [2.2, 1.6], text: ['two fillers,', 'each next to', 'the link'], anchor: 'end' },
                    { at: [7.8, 1.6], text: [`${fillReached} extensions`, 'and the spawn', 'at range 1'], anchor: 'start' },
                ],
            },
            {
                type: 'line', title: 'Link or road hauler: energy per tick for one source', endLabels: false,
                caption: `A link loses ${C.LINK_LOSS_RATIO * 100}% of what it sends, ${r2(linkLoss)} energy per tick for one source. The body of a road hauler costs ${r2(haulPerTile)} per tick for every tile, so in energy the link is ahead beyond ${Math.round(linkAhead)} tiles; it also saves the spawn time and the intents.`,
                x: { label: 'tiles one way', min: 0, max: 50, step: 10, snap: 1 }, y: { label: 'energy per tick', max: 1 },
                series: [
                    { name: 'road hauler, body cost', pts: [[0, 0], [50, r2(50 * haulPerTile)]] },
                    { name: 'link, loss in transfer', pts: [[0, r2(linkLoss)], [50, r2(linkLoss)]] },
                ],
                marks: [{ x: Math.round(linkAhead), label: `${Math.round(linkAhead)} tiles: equal` }],
            },
        ],

        // ------------------------------------------------------------ market strategy
        'recipe:market-strategy': [
            {
                type: 'flow', title: 'Deal or order', cell: [138, 54],
                caption: `A deal is instant and the dealer pays the transfer energy. An order costs ${C.MARKET_FEE * 100}% of its value when it is created, waits, and leaves the energy to the other side. What suits which goods is community practice.`,
                nodes: [
                    { id: 'start', at: [0, 0], text: 'Buy or sell', sub: 'one resource' },
                    { id: 'deal', at: [1, 0], text: 'Deal', sub: 'on an existing order', tone: 'accent' },
                    { id: 'order', at: [1, 1], text: 'Order', sub: 'your own, it waits', tone: 'accent' },
                    { id: 'c1', at: [2, 0], text: 'You pay the energy', sub: 'instant' },
                    { id: 'c2', at: [2, 1], text: `${C.MARKET_FEE * 100}% fee up front`, sub: 'they pay the energy' },
                    { id: 'u1', at: [3, 0], text: 'Suits dear goods', sub: 'in small amounts' },
                    { id: 'u2', at: [3, 1], text: 'Suits cheap bulk', sub: 'and energy itself' },
                ],
                edges: [{ from: 'start', to: 'deal' }, { from: 'start', to: 'order' }, { from: 'deal', to: 'c1' }, { from: 'order', to: 'c2' }, { from: 'c1', to: 'u1' }, { from: 'c2', to: 'u2' }],
            },
            {
                type: 'line', title: 'Deal or order, by distance and value',
                caption: `The line is (1 − e^(−rooms ÷ 30)) ÷ ${C.MARKET_FEE}: the transfer energy a deal costs against the ${C.MARKET_FEE * 100}% fee of an order at the same price. A unit worth more units of energy than the line is cheaper to deal, one worth less is cheaper to order.`,
                x: { label: 'rooms between the two terminals', min: 0, max: 45, step: 5, snap: 1 }, y: { label: 'value of one unit, in units of energy' },
                series: [{ name: 'deal and order cost the same', pts: seq(0, 45).map(k => [k, r2((1 - Math.exp(-k / 30)) / C.MARKET_FEE)]) }],
                marks: [{ x: 10, label: `10 rooms: ${Math.round((1 - Math.exp(-10 / 30)) / C.MARKET_FEE * 10) / 10}` }],
            },
        ],

        // ------------------------------------------------------------ GCL farming
        'recipe:gcl-farming': [
            {
                type: 'scene', title: 'A room kept for upgrading', tile: 36, size: [10, 7],
                terrain: ['..........', '#.........', '##........', '#.........', '##........', '#.........', '..........'],
                caption: `Upgrading works within range 3 of the controller, ${(2 * 3 + 1) ** 2 - 1} tiles at most. Players put storage and terminal inside that square, so that the upgraders stand still next to the store they draw from; below level 8 nothing caps what they spend.`,
                ranges: [{ at: [1, 3], r: 3, label: 'range 3 of the controller', labelAt: 'bl' }],
                things: [
                    { is: 'controller', at: [1, 3], level: 7 },
                    { is: 'terminal', at: [3, 2] }, { is: 'storage', at: [3, 3] },
                    { is: 'creep', at: upgraders, body: '8W C M' },
                    { is: 'creep', at: [4, 3], body: '10C 5M', carry: 1, label: ['energy comes by hauler,', `by terminal from level ${firstLevel('terminal')}`], labelAt: 'right' },
                ],
                arrows: [{ from: [2, 3], to: [1, 3], tone: 'energy' }],
                notes: [{ at: [5.2, 1.1], text: [`${upgraders.length} upgraders, mostly WORK,`, 'each next to a store'], anchor: 'start' }],
            },
            {
                type: 'bars', title: 'Upgrade points per tick', unit: 'points',
                caption: `A level 8 controller takes ${cap} energy per tick, whatever stands around it. Below level 8 every WORK part spends ${C.UPGRADE_CONTROLLER_POWER} energy per tick, and the creeps add up for as many as find a tile and energy.`,
                rows: [
                    { label: 'Level 8', sub: 'all creeps together', value: cap, tone: 'dim' },
                    { label: 'Level 8', sub: 'all creeps together, with XGH2O', value: cap * xgh2o, tone: 'dim' },
                    { label: 'Below level 8', sub: 'one creep, 15 WORK', value: 15 * C.UPGRADE_CONTROLLER_POWER },
                    { label: 'Below level 8', sub: 'one creep, 30 WORK', value: 30 * C.UPGRADE_CONTROLLER_POWER },
                    { label: 'Below level 8', sub: 'one creep, 45 WORK', value: 45 * C.UPGRADE_CONTROLLER_POWER },
                    { label: 'Below level 8', sub: 'one creep, 45 WORK with XGH2O', value: 45 * C.UPGRADE_CONTROLLER_POWER * xgh2o, tone: 'b' },
                ],
            },
            {
                type: 'cols', title: 'Ticks for one GCL level with every room at the level 8 limit',
                caption: `Points in all = ${n(C.GCL_MULTIPLY)} × (level − 1)^${C.GCL_POW}, and each room adds ${cap} per tick at most. Every level takes longer than the one before, although each brings a room; a room below level 8 adds whatever energy it is given.`,
                x: { label: 'GCL level to reach', cats: GCL_LEVELS.map(String) }, y: { label: `ticks, each room owned at ${cap} points per tick` },
                series: [{ name: 'ticks', values: GCL_LEVELS.map(l => Math.round((gclTotal(l) - gclTotal(l - 1)) / ((l - 1) * cap))) }],
            },
        ],

        // ------------------------------------------------------------ progression checklist
        'recipe:progression-checklist': [
            {
                type: 'timeline', title: 'What starts at which room level', span: [1, 9], unit: 'room level', ticks: seq(1, 8),
                caption: 'The steps of the list that are tied to a room level, each drawn from the level it names. The order is community practice: income and spawning first, then defence and expansion, minerals and trade, and last the level 8 work.',
                rows: [
                    { label: 'Workers, spawn queue', segs: [from(1, 'harvest, fill and upgrade with no order given by hand')] },
                    { label: 'Miners and haulers', segs: [from(2, `all ${rate} energy per tick of each source`)] },
                    { label: 'Tower', segs: [from(firstLevel('tower'), 'always filled, answers raids', 'bad')] },
                    { label: 'Remote mining', segs: [from(3, 'mine, reserve and guard the rooms next door')] },
                    { label: 'Storage', segs: [from(firstLevel('storage'), 'the hub of the room')] },
                    { label: 'Links', segs: [from(firstLevel('link'), 'instead of long hauls')] },
                    { label: 'Extractor, terminal, labs', segs: [from(firstLevel('terminal'), 'mineral, trade, boosts', 'c')] },
                    { label: 'Factory', segs: [from(firstLevel('factory'), 'production', 'c')] },
                    { label: 'Observer, power, GCL', segs: [from(firstLevel('observer'), '', 'b')] },
                ],
            },
            {
                type: 'cols', title: 'Ticks to the next room level on two own sources',
                caption: `The whole income of two sources put into the controller: ${ownIncome(1)} energy per tick with the miners of level 1, ${ownIncome(2)} from level 2 on. After level 3 every level costs ${C.CONTROLLER_LEVELS[3] / C.CONTROLLER_LEVELS[2]} times the one before, so from level 5 on the pace is set by income.`,
                x: { label: 'room level', cats: seq(1, 7).map(String) }, y: { label: 'ticks to the next level', max: Math.ceil(levelTicks[6] / 1e5) * 1e5 },
                series: [{ name: 'ticks', values: levelTicks }],
            },
        ],
    };
};
