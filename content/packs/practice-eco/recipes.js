'use strict';
// Pack "practice-eco": what experienced players do about layout, remote mining, expansion, spawning,
// hauling, trade and GCL. Practice, not rules: every entry has basis 'practice'.
// A line about the game carries its code source; a line of advice says that it is advice and points
// to the community wiki page that describes it (nothing is copied from there). Every number is
// computed from the constants, in {{ }} or in a table function, with the formula given in words.
const { L, eng, backend, driver, common, article, wiki } = require('../../_h');

const P = 'src/processor/intents/';
const UTILS = 'src/utils.js';
const ROOMS = 'src/game/rooms.js';
const STRUCT = 'src/game/structures.js';
const MARKET = 'src/processor/global-intents/market.js';
const MARKET_API = 'src/game/market.js';
const UPGRADE = P + 'creeps/upgradeController.js';
const RUNTIME = 'lib/runtime/runtime.js';
const CRON = 'lib/cronjobs.js';

// ---- code lines used more than once
const harvestPower = eng(P + 'creeps/harvest.js', "let harvestAmount = utils.calcBodyEffectiveness(object.body, C.WORK, 'harvest', C.HARVEST_POWER);");
const sourceRegen = eng(P + 'sources/tick.js', 'object.nextRegenerationTime = gameTime + C.ENERGY_REGEN_TIME;');
const sourceFull = eng(P + 'sources/tick.js', 'bulk.update(object, {energyCapacity: C.SOURCE_ENERGY_CAPACITY});');
const sourceNeutral = eng(P + 'sources/tick.js', 'energyCapacity: C.SOURCE_ENERGY_NEUTRAL_CAPACITY,');
const carryCapacity = eng(P + 'spawns/create-creep.js', 'storeCapacity += C.CARRY_CAPACITY;');
const emptyCarry = eng(P + 'movement.js', 'totalCarry -= Math.min(totalCarry, C.CARRY_CAPACITY * boost);');
const roadStep = eng(P + 'movement.js', 'fatigueRate = 1;');
const plainStep = eng(P + 'movement.js', 'var fatigueRate = 2;');
const lifeTime = eng(P + 'creeps/tick.js', 'C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME);');
const spawnTime = eng(P + 'spawns/create-creep.js', 'var needTime = C.CREEP_SPAWN_TIME * intent.body.length;');
const paidAtOnce = eng(P + 'spawns/create-creep.js', 'var cost = utils.calcCreepCost(intent.body);');
const notEnough = eng(P + 'spawns/_charge-energy.js', 'if(availableEnergy < cost) {');
const noRenewClaim = eng(P + 'spawns/renew-creep.js', 'if(_.filter(target.body, (i) => i.type == C.CLAIM).length > 0) {');
const intentFee = driver(RUNTIME, 'let intentCpu = 0.2,');
const repairCost = eng(P + 'creeps/repair.js', 'repairCost = Math.min(object.store.energy, Math.ceil(repairEffect * C.REPAIR_COST)),');
const containerDecay = eng(P + 'containers/tick.js', 'roomController && roomController.level > 0 ? C.CONTAINER_DECAY_TIME_OWNED : C.CONTAINER_DECAY_TIME');
const roadDecay = eng(P + 'roads/tick.js', 'var decayAmount = C.ROAD_DECAY_AMOUNT;');
const roadWear = eng(P + 'movement.js', 'road.nextDecayTime -= C.ROAD_WEAROUT * object.body.length;');
const raidCounter = eng(P + 'creeps/harvest.js', 'let invaderHarvested = (target.invaderHarvested || 0) + amount;');
const raidGoal = backend(CRON, 'const goal = room.invaderGoal || C.INVADERS_ENERGY_GOAL;');
const terminalFee = eng(UTILS, 'return Math.ceil(amount * (1 - Math.exp(-range / 30)))');
const orderFee = eng(MARKET, 'var fee = Math.ceil(intent.price * intent.totalAmount * C.MARKET_FEE);');
const cap8 = eng(UPGRADE, 'if(target.level == 8) {');
const gclPoints = eng(UPGRADE, "bulkUsers.inc(target.user, 'gcl', boostedEffect);");
const levelCost = eng(UPGRADE, 'var nextLevelProgress = C.CONTROLLER_LEVELS[target.level];');
const claimNeedsGcl = eng(P + 'creeps/claimController.js', 'if(user.gcl < utils.calcNeededGcl(claimedRooms + 1)) {');
const allowance = eng(UTILS, 'var availableCnt = C.CONTROLLER_STRUCTURES[type][rcl] + offset;');
const siteCount = eng(UTILS, "var structuresCnt = _(roomObjects).filter((i) => i.type == type || i.type == 'constructionSite' && i.structureType == type).size();");

// ---- expressions for {{ }}
const RATE = '(SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME)';                     // energy per tick of an owned or reserved source
const NEUTRAL = '(SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME)';
const ROAD = '(ROAD_DECAY_AMOUNT * REPAIR_COST / ROAD_DECAY_TIME)';              // energy per tick to hold one plain road tile
const REMOTE_WORK = `(${RATE} / HARVEST_POWER + 1)`;                             // one WORK part more than the source needs
const MINER_COST = `(${REMOTE_WORK} * BODYPART_COST.work + BODYPART_COST.carry + Math.ceil(${REMOTE_WORK} / 2) * BODYPART_COST.move)`;
const RESERVER_COST = '(2 * (BODYPART_COST.claim + BODYPART_COST.move))';
const CARRY_PER_TILE = `(${RATE} * 2 / CARRY_CAPACITY)`;                         // CARRY parts per tile of one-way distance
const HAUL_PER_TILE = `(${CARRY_PER_TILE} * (BODYPART_COST.carry + BODYPART_COST.move / 2) / CREEP_LIFE_TIME)`;
const SPAWN_ENERGY = l => `(CONTROLLER_STRUCTURES.spawn[${l}] * SPAWN_ENERGY_CAPACITY + CONTROLLER_STRUCTURES.extension[${l}] * EXTENSION_ENERGY_CAPACITY[${l}])`;
const ALL_LEVELS = 'Object.keys(CONTROLLER_LEVELS).reduce((sum, l) => sum + CONTROLLER_LEVELS[l], 0)';
const TERMINAL_LEVEL = '[1, 2, 3, 4, 5, 6, 7, 8].find(l => CONTROLLER_STRUCTURES.terminal[l] > 0)';
const CORE_STRUCTURES = "Object.keys(CONTROLLER_STRUCTURES).filter(t => !['road', 'constructedWall', 'rampart', 'container', 'extractor'].includes(t)).reduce((sum, t) => sum + CONTROLLER_STRUCTURES[t][8], 0)";
const fee = rooms => `{{Math.ceil(1000 * (1 - Math.exp(-${rooms} / 30)))}}`;       // terminal energy for 1000 units

// ---- helpers for the computed tables
const ROOM_TILES = 50;      // a room is 50 tiles wide (engine utils.js: the border is x or y equal to 0 or 49)
const r2 = x => Math.round(x * 100) / 100;
const bodyCost = (C, body) => Object.keys(body).reduce((sum, part) => sum + body[part] * C.BODYPART_COST[part], 0);
const bodySize = body => Object.keys(body).reduce((sum, part) => sum + body[part], 0);
const bodyText = body => Object.keys(body).map(part => `${body[part]} ${part.toUpperCase()}`).join(' + ');
const spawnEnergy = (C, l) => C.CONTROLLER_STRUCTURES.spawn[l] * C.SPAWN_ENERGY_CAPACITY + C.CONTROLLER_STRUCTURES.extension[l] * C.EXTENSION_ENERGY_CAPACITY[l];
const sourceRate = C => C.SOURCE_ENERGY_CAPACITY / C.ENERGY_REGEN_TIME;
const neutralRate = C => C.SOURCE_ENERGY_NEUTRAL_CAPACITY / C.ENERGY_REGEN_TIME;
const roadTile = C => C.ROAD_DECAY_AMOUNT * C.REPAIR_COST / C.ROAD_DECAY_TIME;
const terminalCost = (amount, rooms) => Math.ceil(amount * (1 - Math.exp(-rooms / 30)));     // engine utils.calcTerminalEnergyCost
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];

// One remote source whose road to the drop-off is d tiles long. rate: energy per tick of the source.
//   miner     one WORK part more than the source needs (ticks left to repair the container), 1 CARRY, MOVE for roads;
//             it walks d ticks of its life
//   hauler    CARRY for rate x round trip, half as many MOVE
//   reserver  2 CLAIM + 2 MOVE; every working tick adds 2 ticks and 1 runs off, so it covers 2 x (life - d) ticks
//   upkeep    the container, d road tiles, and the wear of the hauler's parts (one step per tick)
function remote(C, d, rate, reserved, sources) {
    const work = Math.floor(rate / C.HARVEST_POWER) + 1;
    const miner = { work, carry: 1, move: Math.ceil(work / 2) };
    const carry = Math.ceil(rate * 2 * d / C.CARRY_CAPACITY);
    const hauler = { carry, move: Math.ceil(carry / 2) };
    const reserver = { claim: 2, move: 2 };
    const reservedTicks = reserver.claim * C.CONTROLLER_RESERVE * (C.CREEP_CLAIM_LIFE_TIME - d);
    const cost = {
        miner: bodyCost(C, miner) / (C.CREEP_LIFE_TIME - d),
        hauler: bodyCost(C, hauler) / C.CREEP_LIFE_TIME,
        reserver: reserved ? bodyCost(C, reserver) / reservedTicks / sources : 0,
        upkeep: C.CONTAINER_DECAY * C.REPAIR_COST / C.CONTAINER_DECAY_TIME + (d + bodySize(hauler) * C.ROAD_WEAROUT) * roadTile(C),
    };
    const total = cost.miner + cost.hauler + cost.reserver + cost.upkeep;
    const spawnTicks = C.CREEP_SPAWN_TIME * (bodySize(miner) * C.CREEP_LIFE_TIME / (C.CREEP_LIFE_TIME - d) + bodySize(hauler)
        + (reserved ? bodySize(reserver) * C.CREEP_LIFE_TIME / reservedTicks / sources : 0));
    return { miner, hauler, reserver, cost, total, net: rate - total, spawnTicks };
}
const REMOTE_DISTANCES = [25, 50, 75, 100, 150, 200];

module.exports = [
    // ================================================================ base planning
    {
        id: 'base-planning',
        title: 'Plan a base by code: layout, roads, rampart line',
        basis: 'practice',
        topic: 'practice',
        summary: 'Community practice for laying out a room without placing sites by hand: choose a layout style, find where it fits on the terrain, fix the spots at sources and controller, draw roads from stored paths, close the base with a short rampart line, and place the sites level by level. The game sets only the ranges and the counts.',
        tasks: [
            'how to plan a base automatically', 'automatic base building', 'bunker or stamps layout', 'room planner', 'lay out a room by code',
            'where to put ramparts with minimum cut', 'distance transform to find space for a base', 'plan roads automatically', 'where to place extensions labs and towers',
        ],
        steps: [
            { call: 'Game.map.getRoomTerrain', text: 'Read the terrain once. It needs no vision, so a room can be planned before it is claimed; the positions of sources, mineral and controller need one look into the room.' },
            { text: 'Choose the style. Bunker: one fixed layout around an anchor tile; least code, needs one large open area. Stamps: small fixed groups (hub, extension clusters, lab block, towers) placed one after another; fit more rooms, more code. Generated: rules and a flood fill grow the layout; fits any room, hardest to get right.' },
            { call: 'Room.Terrain.get', text: 'Distance transform: give every tile its distance to the nearest wall tile, counting the two outer rings as wall. A square of odd side s fits around a tile whose value is at least (s + 1) / 2.' },
            { call: 'PathFinder.search', text: 'Among the tiles where the layout fits, take as anchor the one with the shortest summed paths to the sources, the controller and the mineral.' },
            { text: 'Fix the outer spots: a miner tile next to each source with a container under it and later a link beside it; tiles for upgraders within range 3 of the controller with a container or link next to them; a container beside the mineral.' },
            { text: 'Core: storage, terminal, a link, factory and power spawn around one tile, so that one creep standing there serves all of them. Labs so that each is within range 2 of the two source labs. Extensions where a filler passes at range 1. Free tiles next to every spawn.' },
            { call: 'PathFinder.CostMatrix', text: 'Roads: search from the storage to each source, the controller, the mineral and the exits in use. Before each search give the tiles already chosen as road a lower cost than plain, so that later paths join earlier ones.' },
            { text: 'Rampart line: a minimum cut between the exit tiles and the tiles to protect gives the fewest ramparts that close the base. Keep the line 3 tiles away from what it protects, or put ramparts on those structures as well.' },
            { call: 'Room.createConstructionSite', text: 'Store the plan and place sites from it as each room level allows, most needed first: spawn, extensions, tower, storage, then the rest; roads and ramparts when energy is spare. Check now and then for planned structures that are missing.' },
        ],
        notes: [
            L('Community practice: the three styles and the three algorithms (distance transform, flood fill, minimum cut) are the common toolkit. The game prescribes none of them.', wiki('Automatic_base_building')),
            L('Ranges that pin the layout: harvest, transfer and withdraw reach 1 tile; build, repair and upgradeController 3; a lab reaction 2; a ranged attack 3.',
                eng(P + 'creeps/harvest.js', 'if(Math.abs(target.x - object.x) > 1 || Math.abs(target.y - object.y) > 1) {'),
                eng(P + 'creeps/transfer.js', 'if(Math.abs(target.x - object.x) > 1 || Math.abs(target.y - object.y) > 1) {'),
                eng(UPGRADE, 'if(Math.abs(target.x - object.x) > 3 || Math.abs(target.y - object.y) > 3) {'),
                eng(P + 'labs/run-reaction.js', 'if(Math.abs(lab1.x - object.x) > 2 || Math.abs(lab1.y - object.y) > 2) {'),
                eng(P + 'creeps/rangedAttack.js', 'if(Math.abs(target.x - object.x) > 3 || Math.abs(target.y - object.y) > 3) {')),
            L('Level 8 allows {{' + CORE_STRUCTURES + '}} structures besides roads, walls, ramparts, containers and the extractor. In a checkerboard of structures and roads that is about {{2 * (' + CORE_STRUCTURES + ')}} tiles, a square of {{Math.ceil(Math.sqrt(2 * (' + CORE_STRUCTURES + ')))}} a side: plan for all of it from the start.', allowance),
            L('Nothing can be built on the border ring, and on the ring next to it only roads and containers. A rampart line at an exit therefore stands 2 tiles inside the room.',
                eng(UTILS, 'if(x <= 0 || y <= 0 || x >= 49 || y >= 49) {'),
                eng(UTILS, "if(structureType != 'road' && structureType != 'container' && (x == 1 || x == 48 || y == 1 || y == 48)) {")),
            L('A finished creep leaves the spawn onto a free adjacent tile, TOP first unless directions are set. With all eight tiles built over it never comes out.',
                eng(P + 'spawns/_born-creep.js', 'var directions = [1,2,3,4,5,6,7,8];'),
                eng(P + 'spawns/tick.js', 'bulk.update(object, {spawning: {spawnTime: 1+gameTime}});')),
            L('A tower does {{TOWER_POWER_ATTACK}} damage up to range {{TOWER_OPTIMAL_RANGE}} and {{TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)}} from range {{TOWER_FALLOFF_RANGE}}. Community practice differs: towers in one cluster are easy to fill and to cover; towers spread toward the rampart line hit harder there.',
                eng(P + 'towers/attack.js', 'amount -= amount * C.TOWER_FALLOFF * (range - C.TOWER_OPTIMAL_RANGE) / (C.TOWER_FALLOFF_RANGE - C.TOWER_OPTIMAL_RANGE);'),
                wiki('Automatic_base_building')),
            L('A nuke hits the 5 × 5 tiles around its target: {{NUKE_DAMAGE[0]}} in the middle, {{NUKE_DAMAGE[2]}} on the others. A tight core loses more to one nuke; a spread one needs more ramparts and longer fill routes.',
                eng(P + 'nukes/tick.js', 'for(let dx=-2; dx<=2; dx++) {'),
                eng(P + 'nukes/tick.js', 'damage = range == 0 ? C.NUKE_DAMAGE[0] : C.NUKE_DAMAGE[2];')),
            L('Every rampart costs {{REPAIR_COST}} energy per hit to raise and {{RAMPART_DECAY_AMOUNT * REPAIR_COST / RAMPART_DECAY_TIME}} per tick to hold, so what the cut should make small is the number of ramparts (table).',
                repairCost, eng(P + 'ramparts/tick.js', 'object.hits -= C.RAMPART_DECAY_AMOUNT;')),
            L('Community practice: the line goes around each exit, around the base by minimum cut, or across choke points of the terrain. Walls in it cost nothing to hold, since they do not decay, but they block your own creeps too.',
                wiki('Defensive_Structures'), eng(P + 'constructedWalls/tick.js', 'if(!object.decayTime) {')),
        ],
        pitfalls: [
            L('Roads placed wherever creeps happen to walk spread into webs nobody uses, because paths differ from tick to tick. Community practice: build roads only from stored paths.', wiki('Maturity_Matrix')),
            L('At most {{MAX_CONSTRUCTION_SITES}} sites per player over all rooms: place by priority, or road sites in one room hold up a tower in another.',
                eng(ROOMS, "if(_(runtimeData.userObjects).filter({type: 'constructionSite'}).size() + createdConstructionSites >= C.MAX_CONSTRUCTION_SITES) {")),
            L('Your own site for a blocking structure stops your own creeps. Do not put a whole level of sites across the paths in use at once.',
                eng(P + 'movement.js', "i.type == 'constructionSite' && i.user == object.user && _.contains(C.OBSTACLE_OBJECT_TYPES,")),
            L('Only {{CONTROLLER_STRUCTURES.storage[8]}} storage and {{CONTROLLER_STRUCTURES.terminal[8]}} terminal are allowed, and sites count like structures: moving one means destroying it first. Put them where the level 8 plan wants them.', allowance, siteCount),
        ],
        tables: [C => {
            const perHit = C.REPAIR_COST, hold = C.RAMPART_DECAY_AMOUNT * C.REPAIR_COST / C.RAMPART_DECAY_TIME;
            const income = 2 * sourceRate(C);
            return {
                title: 'A rampart line by its length',
                head: ['ramparts', 'energy per 1M hits on each', 'per 10M on each', `to the level 8 maximum (${C.RAMPART_HITS_MAX[8] / 1e6}M)`, 'decay per tick', `ticks of two sources (${income} per tick) per 1M`],
                rows: [20, 40, 60, 100, 150].map(n => [n, n * 1e6 * perHit, n * 1e7 * perHit, n * C.RAMPART_HITS_MAX[8] * perHit, r2(n * hold), n * 1e6 * perHit / income]),
                foot: `Energy = ramparts × hits × ${perHit}; decay = ramparts × ${C.RAMPART_DECAY_AMOUNT} hits per ${C.RAMPART_DECAY_TIME} ticks × ${perHit}. Building costs ${C.CONSTRUCTION_COST.rampart} energy per rampart.`,
            };
        }],
        constants: ['CONTROLLER_STRUCTURES', 'MAX_CONSTRUCTION_SITES', 'RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME', 'REPAIR_COST', 'RAMPART_HITS_MAX', 'TOWER_OPTIMAL_RANGE', 'TOWER_FALLOFF_RANGE', 'NUKE_DAMAGE'],
        see: ['mechanic:construction-sites', 'mechanic:controller', 'mechanic:ramparts-and-walls', 'mechanic:pathfinding', 'mechanic:tower', 'mechanic:nukes', 'mechanic:spawning',
            'recipe:bootstrap-a-room', 'recipe:roads-and-upkeep', 'recipe:link-network', 'recipe:labs-and-boosts', 'recipe:keep-ramparts-up', 'recipe:defend-a-room', 'recipe:room-selection'],
    },

    // ================================================================ remote mining economics
    {
        id: 'remote-mining-economics',
        title: 'Is this remote source worth mining',
        basis: 'practice',
        topic: 'practice',
        summary: 'What one source in a room you do not own brings and costs per tick. Reserved it gives {{' + RATE + '}} energy per tick; miner, hauler, reserver and upkeep come off that, and the hauler alone costs {{' + HAUL_PER_TILE + '}} per tick for every road tile. Community practice is to rank sources by this net and take the nearest first.',
        tasks: [
            'is this remote room worth mining', 'is a remote source profitable', 'what does remote mining cost per tick', 'how far away can I mine a remote',
            'is reserving a remote worth the energy', 'net income of a remote source', 'which remote to take first', 'how much spawn time does a remote need',
        ],
        steps: [
            { call: 'PathFinder.search', text: 'Measure d: the length in tiles of the path from the drop-off (storage, or a link near the exit) to the tile next to the source. Use the path the road will be built on.' },
            { call: 'Source.energyCapacity', text: 'Income: {{' + RATE + '}} energy per tick from a reserved source, {{' + NEUTRAL + '}} from an unreserved one.' },
            { call: 'StructureSpawn.spawnCreep', text: 'Miner: {{' + REMOTE_WORK + '}} WORK, 1 CARRY, {{Math.ceil(' + REMOTE_WORK + ' / 2)}} MOVE ({{' + MINER_COST + '}} energy). It walks d ticks of its life, so it costs {{' + MINER_COST + '}} ÷ ({{CREEP_LIFE_TIME}} − d) per tick.' },
            { call: 'Creep.withdraw', text: 'Hauler: CARRY parts = income × 2 × d ÷ {{CARRY_CAPACITY}}, half as many MOVE on a road; cost per tick = body cost ÷ {{CREEP_LIFE_TIME}}. For a reserved source that is {{' + HAUL_PER_TILE + '}} energy per tick for every tile of d.' },
            { call: 'Creep.reserveController', text: 'Reserver: 2 CLAIM + 2 MOVE ({{' + RESERVER_COST + '}} energy) hold the room for 2 × ({{CREEP_CLAIM_LIFE_TIME}} − d) ticks: {{' + RESERVER_COST + '}} ÷ that per tick, shared by all sources of the room.' },
            { call: 'Creep.repair', text: 'Upkeep: container {{CONTAINER_DECAY * REPAIR_COST / CONTAINER_DECAY_TIME}} per tick, road {{' + ROAD + '}} per plain tile per tick plus the wear of the creeps that use it.' },
            { text: 'Net = income − miner − hauler − reserver − upkeep (table). Take the source when the net is worth the spawn time and the CPU it ties up, and the nearest sources before the far ones.' },
            { call: 'Room.find', text: 'Then plan for raids and invader cores: a guard on call, or miners that leave the room for a while (recipe:defend-against-invaders).' },
        ],
        notes: [
            L('Income: a source refills to {{SOURCE_ENERGY_CAPACITY}} every {{ENERGY_REGEN_TIME}} ticks in a reserved room and to {{SOURCE_ENERGY_NEUTRAL_CAPACITY}} in an unreserved one.', sourceFull, sourceNeutral, sourceRegen),
            L('Miner: {{' + RATE + ' / HARVEST_POWER}} WORK empty a reserved source. A tick that repairs cannot harvest, so one more WORK part buys the ticks for keeping the container up.',
                harvestPower, eng(P + 'creeps/intents.js', "harvest: ['attack','build','repair','dismantle','attackController','rangedHeal','heal'],")),
            L('Hauler: {{' + CARRY_PER_TILE + '}} CARRY per tile of d for a reserved source. On a road one MOVE moves two loaded CARRY at one tile per tick.', carryCapacity, roadStep),
            L('Reserver: every CLAIM part adds {{CONTROLLER_RESERVE}} tick per tick and 1 tick runs off, so n CLAIM parts working W ticks hold the room for n × W. With one MOVE per CLAIM a reserved tick costs {{BODYPART_COST.claim + BODYPART_COST.move}} ÷ ({{CREEP_CLAIM_LIFE_TIME}} − walk) energy, whatever n is.',
                eng(P + 'creeps/reserveController.js', 'i.type == C.CLAIM).length * C.CONTROLLER_RESERVE;'), eng(P + 'creeps/reserveController.js', 'endTime: gameTime+1'), lifeTime),
            L('Upkeep: a container in a room without owner loses {{CONTAINER_DECAY}} hits every {{CONTAINER_DECAY_TIME}} ticks, a plain road tile {{ROAD_DECAY_AMOUNT}} every {{ROAD_DECAY_TIME}}, at {{REPAIR_COST}} energy per hit. Each body part that steps on a road tile brings its next decay 1 tick closer: {{' + ROAD + '}} energy.',
                containerDecay, roadDecay, roadWear, repairCost),
            L('One-off: {{CONSTRUCTION_COST.road}} energy per plain road tile, {{CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} on swamp, {{CONSTRUCTION_COST.container}} for the container. A 50-tile plain road with a container is {{50 * CONSTRUCTION_COST.road + CONSTRUCTION_COST.container}} energy.',
                eng(P + 'room/create-construction-site.js', 'var progressTotal = C.CONSTRUCTION_COST[intent.structureType];'),
                eng(P + 'room/create-construction-site.js', 'progressTotal *= C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO;')),
            L('Energy is not the only price: every body part takes {{CREEP_SPAWN_TIME}} ticks of a spawn, and every creep at least 0.2 CPU per tick for its one intent.', spawnTime, intentFee),
            L('Community practice: miner and hauler per source, a shared reserver, a guard and a road repairer shared by several rooms; the wiki has its own cost analysis by distance.', wiki('Remote_Harvesting')),
        ],
        pitfalls: [
            L('A raid is due about every {{INVADERS_ENERGY_GOAL}} energy harvested in the room: every {{INVADERS_ENERGY_GOAL / ' + RATE + '}} ticks for one reserved source. Count the guard, or the creeps lost, into the net.', raidCounter, raidGoal),
            L('While an invader core holds the reservation nothing can be harvested and the creeps go on costing.', eng(P + 'creeps/harvest.js', 'roomController.reservation && roomController.reservation.user != object.user')),
            L('Without a road a loaded hauler needs one MOVE per CARRY to keep one tile per tick on plain: {{BODYPART_COST.carry + BODYPART_COST.move}} energy per {{CARRY_CAPACITY}} carried instead of {{BODYPART_COST.carry + BODYPART_COST.move / 2}}, but no road to build or hold.', plainStep, emptyCarry),
            L('The container holds {{CONTAINER_CAPACITY}}, {{CONTAINER_CAPACITY / ' + RATE + '}} ticks of a reserved source. What a late hauler leaves over lies on the ground and shrinks.',
                eng(P + 'creeps/build.js', 'storeCapacity: C.CONTAINER_CAPACITY,'), eng(P + 'energy/tick.js', 'object[resourceType] -= Math.ceil(object[resourceType] / C.ENERGY_DECAY);')),
        ],
        tables: [
            C => {
                const rate = sourceRate(C);
                const sample = remote(C, 50, rate, true, 1);
                return {
                    title: 'One reserved source, alone in its room: cost per tick by road distance',
                    head: ['road tiles', 'miner', 'hauler CARRY parts', 'hauler', 'reserver', 'container and road', 'all costs', `net of ${rate}`],
                    rows: REMOTE_DISTANCES.map(d => {
                        const x = remote(C, d, rate, true, 1);
                        return [d, r2(x.cost.miner), x.hauler.carry, r2(x.cost.hauler), r2(x.cost.reserver), r2(x.cost.upkeep), r2(x.total), r2(x.net)];
                    }),
                    foot: `Miner ${bodyText(sample.miner)} (${bodyCost(C, sample.miner)}) ÷ (${C.CREEP_LIFE_TIME} − d). Hauler: CARRY = ${rate} × 2d ÷ ${C.CARRY_CAPACITY}, half as many MOVE, cost ÷ ${C.CREEP_LIFE_TIME}; above ${C.MAX_CREEP_SIZE} parts it is two creeps. `
                        + `Reserver ${bodyText(sample.reserver)} (${bodyCost(C, sample.reserver)}) ÷ (2 × (${C.CREEP_CLAIM_LIFE_TIME} − d)), with the controller as far away as the source. `
                        + `Container ${C.CONTAINER_DECAY * C.REPAIR_COST / C.CONTAINER_DECAY_TIME}; road ${roadTile(C)} × (d + parts of the hauler). Building, guards and CPU are not in it.`,
                };
            },
            C => {
                const rate = sourceRate(C), neutral = neutralRate(C);
                return {
                    title: 'Net energy per tick and source',
                    head: ['road tiles', 'reserved, 1 source in the room', 'reserved, 2 sources', `not reserved (of ${neutral})`, 'spawn ticks per creep life (reserved, 1 source)', 'share of one spawn'],
                    rows: REMOTE_DISTANCES.map(d => {
                        const one = remote(C, d, rate, true, 1);
                        return [d, r2(one.net), r2(remote(C, d, rate, true, 2).net), r2(remote(C, d, neutral, false, 1).net), Math.round(one.spawnTicks), Math.round(one.spawnTicks / C.CREEP_LIFE_TIME * 100) + '%'];
                    }),
                    foot: `With 2 sources the reserver is shared. Not reserved: ${bodyText(remote(C, 50, neutral, false, 1).miner)} as miner, half the hauler, no reserver. `
                        + `Spawn ticks: ${C.CREEP_SPAWN_TIME} per body part of everything that has to be spawned in ${C.CREEP_LIFE_TIME} ticks.`,
                };
            },
        ],
        constants: ['SOURCE_ENERGY_CAPACITY', 'SOURCE_ENERGY_NEUTRAL_CAPACITY', 'ENERGY_REGEN_TIME', 'HARVEST_POWER', 'CARRY_CAPACITY', 'CREEP_LIFE_TIME', 'CREEP_CLAIM_LIFE_TIME', 'CONTROLLER_RESERVE',
            'CONTAINER_DECAY', 'CONTAINER_DECAY_TIME', 'ROAD_DECAY_AMOUNT', 'ROAD_DECAY_TIME', 'ROAD_WEAROUT', 'REPAIR_COST', 'INVADERS_ENERGY_GOAL', 'BODYPART_COST'],
        see: ['recipe:reserve-and-remote-mine', 'mechanic:sources', 'mechanic:reservation', 'mechanic:decay', 'mechanic:invaders', 'mechanic:body-design', 'mechanic:cpu',
            'recipe:hauling-logistics', 'recipe:roads-and-upkeep', 'recipe:defend-against-invaders', 'recipe:source-keeper-mining', 'recipe:room-selection'],
    },

    // ================================================================ room selection
    {
        id: 'room-selection',
        title: 'Choose the next room to claim',
        basis: 'practice',
        topic: 'practice',
        summary: 'Community practice for picking a room to expand into: score the candidates from scouting data by sources, mineral, remote sources around them, distance to your rooms, neighbours and terrain. No rule decides it; the code only sets what a room can give and how far a claimer gets ({{CREEP_CLAIM_LIFE_TIME}} ticks).',
        tasks: [
            'which room should I claim next', 'how to choose a room to expand into', 'what makes a good room', 'which mineral should my next room have',
            'how far away can I claim a room', 'one source or two source room', 'score rooms for expansion', 'where to expand',
        ],
        steps: [
            { call: 'Game.gcl', text: 'A free slot: Game.gcl.level above the number of rooms you own. Check the CPU as well: every room adds creeps, and every creep its intents.' },
            { call: 'Game.map.getRoomStatus', text: 'Candidates: rooms with a controller (no highway, keeper or centre room) that are open to you, without owner and without a reservation of someone else.' },
            { call: 'StructureObserver.observeRoom', text: 'Look into each candidate once, by scout or observer, and store: number and positions of sources, mineral type, owner, reservation and sign of the controller, hostile structures.' },
            { call: 'Source.energyCapacity', text: 'Sources: two give {{2 * ' + RATE + '}} energy per tick, one gives {{' + RATE + '}}.' },
            { call: 'Mineral.mineralType', text: 'Mineral: prefer a type that none of your rooms has. What is missing for a compound has to be bought or carried in.' },
            { call: 'Game.map.describeExits', text: 'Remotes: count the sources in the rooms around it that nobody uses. Each is worth its net in recipe:remote-mining-economics; keeper rooms next door hold sources of {{SOURCE_ENERGY_KEEPER_CAPACITY}}.' },
            { call: 'Game.map.findRoute', text: 'Distance to your nearest room: near enough for the claimer, for helpers and for defenders; far enough that the two rooms do not want the same remotes (table).' },
            { call: 'Game.map.getRoomTerrain', text: 'Terrain: your layout must fit (recipe:base-planning); few and narrow exits make a short rampart line; a road tile on swamp costs {{CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} times one on plain.' },
            { text: 'Neighbours: owned and reserved rooms around it, who mines where, what the signs say. A room next to an active player needs defence from its first day.' },
            { call: 'Creep.claimController', text: 'Weigh these as you see fit, take the best candidate, and go on with recipe:claim-a-room.' },
        ],
        notes: [
            L('Community practice: the usual criteria are two sources, a mineral you lack, the remote sources around, the distance to your rooms and the players nearby. How to weigh them is each player\'s choice.', wiki('Claiming_new_room')),
            L('The claim itself needs a GCL level above the rooms you own, and a controller at level 0 that nobody else reserved.', claimNeedsGcl, eng(P + 'creeps/claimController.js', 'if(target.reservation && target.reservation.user != object.user) {')),
            L('A one-source room earns {{' + RATE + '}} energy per tick, less than the {{CONTROLLER_MAX_UPGRADE_PER_TICK}} its controller can take at level 8. A two-source room earns {{2 * ' + RATE + '}}.', sourceRegen, eng(UPGRADE, 'var limit = C.CONTROLLER_MAX_UPGRADE_PER_TICK;')),
            L('A room has one mineral: {{MINERAL_DENSITY[1]}} to {{MINERAL_DENSITY[4]}} units when full, refilled {{MINERAL_REGEN_TIME}} ticks after it has been emptied.',
                article('resources'), eng(P + 'minerals/tick.js', 'mineralAmount: C.MINERAL_DENSITY[object.density]'), eng(P + 'minerals/tick.js', 'object.nextRegenerationTime = gameTime + C.MINERAL_REGEN_TIME;')),
            L('Every boost needs H or O, tier 2 and tier 3 need both (as OH), tier 3 needs X on top. Community practice: cover O and H with the first rooms, the others after.',
                common('lib/constants.js', 'OH: "LHO2"'), common('lib/constants.js', 'X: "XLHO2"'), wiki('Claiming_new_room')),
            L('A claimer lives {{CREEP_CLAIM_LIFE_TIME}} ticks and cannot be renewed: at one tile per tick that is at most {{CREEP_CLAIM_LIFE_TIME / 50}} rooms of 50 tiles in a straight line, fewer on a real path.',
                lifeTime, noRenewClaim, eng(UTILS, 'return object.x == 0 || object.x == 49 || object.y == 0 || object.y == 49')),
            L('Later the two rooms trade through terminals, and that costs by distance: ' + fee(3) + ' energy per 1000 units at 3 rooms, ' + fee(10) + ' at 10.', terminalFee),
            L('Raids enter only through exits to rooms that are neither owned nor reserved. A room whose neighbours you hold gets none.',
                backend(CRON, 'if(controller && (controller.user || controller.reservation)) {'), backend(CRON, 'if(!exits.length) {')),
        ],
        pitfalls: [
            L('Community practice: do not expand while your rooms are short of CPU or energy or under attack. A new room takes builders, energy and guards from the old ones before it gives anything back.', wiki('Claiming_new_room')),
            L('Community practice: a badly placed room is given up and replaced once the energy allows. unclaim() sets the controller to level 0 with no progress, so the whole climb is paid again.',
                wiki('Intermediate-level_tips'), eng(P + 'controllers/unclaim.js', 'level: 0,'), eng(P + 'controllers/unclaim.js', 'progress: 0,')),
            L('A room that looked free can be claimed or reserved by the time the claimer arrives: look again before it sets out, and on arrival.', eng(P + 'creeps/claimController.js', 'if(target.level > 0) {')),
        ],
        tables: [C => ({
            title: 'Distance to your nearest room',
            head: ['rooms apart', 'tiles to walk', 'life left to a claimer on arrival', 'working life of a helper that walks there', 'terminal energy per 1000 units'],
            rows: [1, 2, 3, 5, 8, 10].map(n => [n, n * ROOM_TILES, C.CREEP_CLAIM_LIFE_TIME - n * ROOM_TILES, C.CREEP_LIFE_TIME - n * ROOM_TILES, terminalCost(1000, n)]),
            foot: `Counting ${ROOM_TILES} tiles of path per room at one tile per tick; real paths are longer. Claimer ${C.CREEP_CLAIM_LIFE_TIME} ticks, other creeps ${C.CREEP_LIFE_TIME}. Terminal: ceil(1000 × (1 − e^(−rooms ÷ 30))).`,
        })],
        constants: ['CREEP_CLAIM_LIFE_TIME', 'GCL_MULTIPLY', 'GCL_POW', 'SOURCE_ENERGY_CAPACITY', 'SOURCE_ENERGY_KEEPER_CAPACITY', 'MINERAL_DENSITY', 'MINERAL_REGEN_TIME', 'CONTROLLER_MAX_UPGRADE_PER_TICK'],
        see: ['recipe:claim-a-room', 'recipe:scout-rooms', 'recipe:remote-mining-economics', 'recipe:base-planning', 'mechanic:room-types', 'mechanic:world-map', 'mechanic:controller',
            'mechanic:minerals-and-extractors', 'mechanic:terminal-transfers', 'mechanic:invaders', 'mechanic:respawn-and-start-areas', 'Game.map.getRoomLinearDistance', 'StructureController.unclaim'],
    },

    // ================================================================ spawn queue
    {
        id: 'spawn-queue',
        title: 'Spawn queue: priorities, body size, recovery',
        basis: 'practice',
        topic: 'practice',
        summary: 'Community practice for deciding what a spawn makes next: a priority order with the filler first, bodies sized to the energy at hand, replacements ordered before the old creep dies, and a small creep that restarts a room with no creeps left. One spawn keeps at most {{CREEP_LIFE_TIME / CREEP_SPAWN_TIME}} body parts alive.',
        tasks: [
            'what should my spawn build next', 'spawn queue priorities', 'in which order to spawn creeps', 'all my creeps died how do I recover',
            'restart a room after a wipe', 'how big should the next creep be', 'when to spawn a replacement creep', 'how many creeps can one spawn support',
            'should I renew creeps or spawn new ones',
        ],
        steps: [
            { call: 'Room.find', text: 'Count what is alive per job, in body parts rather than heads: WORK parts on each source, CARRY parts on each route. Leave out creeps that are about to die.' },
            { text: 'Order the needs. A common order: the filler of spawn and extensions, miners, defenders while hostiles are in the room, haulers, then upgraders and builders, then everything that only adds (remotes, mineral, scouts).' },
            { call: 'Room.energyCapacityAvailable', text: 'Normal size: the largest body of the wanted shape that the room capacity pays, up to what the job needs.' },
            { call: 'Room.energyAvailable', text: 'Emergency size: when no filler or no miner is alive, build what the energy at hand pays, down to [WORK, CARRY, MOVE] for {{BODYPART_COST.work + BODYPART_COST.carry + BODYPART_COST.move}}.' },
            { call: 'StructureSpawn.spawnCreep', text: 'Each tick an idle spawn takes the first need on the list that the room can pay. While the filler is missing, nothing else is taken.' },
            { call: 'Creep.ticksToLive', text: 'Replace ahead of time: put the successor on the list when ticksToLive falls to {{CREEP_SPAWN_TIME}} × its parts + the walk to its work place.' },
            { call: 'StructureSpawn.renewCreep', text: 'Decide per job whether to renew instead: it suits creeps that stand next to a spawn anyway and creeps too large for the room to build now.' },
            { text: 'Watch the budget: sum parts × {{CREEP_SPAWN_TIME}} over everything wanted in {{CREEP_LIFE_TIME}} ticks. Above {{CREEP_LIFE_TIME}} per spawn, the lowest needs never get built; cut them or wait for the next spawn.' },
        ],
        notes: [
            L('Community practice: bots grow from a fixed head count per role, to counting the body parts each job needs, to a queue that other parts of the code push requests into.', wiki('Great_Filters')),
            L('A spawn makes one creep at a time, {{CREEP_SPAWN_TIME}} ticks per part, and a creep lives {{CREEP_LIFE_TIME}} ticks: {{CREEP_LIFE_TIME / CREEP_SPAWN_TIME}} parts per spawn at the very most.', spawnTime, lifeTime),
            L('The whole body cost is taken at once from spawns and extensions. Above the first {{SPAWN_ENERGY_CAPACITY}} energy only creeps refill them, which is why the filler leads every order.', paidAtOnce, notEnough),
            L('With no creep left, a spawn still gains 1 energy per tick while the room holds less than {{SPAWN_ENERGY_CAPACITY}}: a [WORK, CARRY, MOVE] is affordable after {{BODYPART_COST.work + BODYPART_COST.carry + BODYPART_COST.move}} ticks at the latest.',
                eng(P + 'spawns/tick.js', 'if(!object.tutorial && energyAvailable < C.SPAWN_ENERGY_CAPACITY && object.store.energy < C.SPAWN_ENERGY_CAPACITY) {')),
            L('Rounding aside, renewing costs the same energy per tick of life as a new creep, and gives {{SPAWN_RENEW_RATIO}} times the life per tick the spawn is busy.',
                eng(P + 'spawns/renew-creep.js', 'var effect = Math.floor(C.SPAWN_RENEW_RATIO * C.CREEP_LIFE_TIME / C.CREEP_SPAWN_TIME / target.body.length);'),
                eng(P + 'spawns/renew-creep.js', 'var cost = Math.ceil(C.SPAWN_RENEW_RATIO * utils.calcCreepCost(target.body) / C.CREEP_SPAWN_TIME / target.body.length);')),
            L('One renew call needs only its own cost in the room, {{SPAWN_RENEW_RATIO / CREEP_SPAWN_TIME}} × body cost ÷ parts: a young room can keep alive a creep it could never build.',
                eng(P + 'spawns/renew-creep.js', "var result = require('./_charge-energy')(object, cost, undefined, scope);")),
            L('Community practice, renew against respawn. Renewing keeps the creep and its memory and leaves the spawn free sooner; it strips boosts, takes one intent per call and keeps the creep waiting at the spawn. A new creep is one intent and can be ordered ahead; the spawn is busy for its whole spawn time.',
                wiki('RenewCreep_vs_SpawnCreep'), eng(P + 'spawns/renew-creep.js', 'i.boost = null;'), intentFee),
        ],
        pitfalls: [
            L('A list that only knows full-size bodies never recovers: without a filler the room does not reach its capacity again. Community practice calls the small restart creep a cold boot.', notEnough, wiki('Great_Filters')),
            L('Creeps with a CLAIM part live {{CREEP_CLAIM_LIFE_TIME}} ticks and cannot be renewed: reservers are always spawned anew.', noRenewClaim, lifeTime),
            L('A 50-part creep keeps a spawn busy for {{CREEP_SPAWN_TIME * MAX_CREEP_SIZE}} ticks. Put the filler and the defenders before it, not behind.', spawnTime),
        ],
        tables: [C => {
            const maxCarry = Math.floor(C.MAX_CREEP_SIZE * 2 / 3);
            const hauler = carry => ({ carry, move: Math.ceil(carry / 2) });
            return {
                kind: 'levels',
                title: 'Spawn capacity by room level',
                head: ['RCL', 'spawns', 'spawn energy', 'body parts kept alive', 'largest road hauler', 'it carries', 'ticks to spawn it'],
                rows: LEVELS.map(l => {
                    let carry = maxCarry;
                    while (carry > 1 && bodyCost(C, hauler(carry)) > spawnEnergy(C, l)) carry--;
                    const body = hauler(carry);
                    return [l, C.CONTROLLER_STRUCTURES.spawn[l], spawnEnergy(C, l), C.CONTROLLER_STRUCTURES.spawn[l] * C.CREEP_LIFE_TIME / C.CREEP_SPAWN_TIME,
                        bodyText(body), body.carry * C.CARRY_CAPACITY, bodySize(body) * C.CREEP_SPAWN_TIME];
                }),
                foot: `Spawn energy: what all spawns and extensions of the level hold. Parts kept alive: spawns × ${C.CREEP_LIFE_TIME} ÷ ${C.CREEP_SPAWN_TIME}, with no tick idle. Hauler: the most CARRY parts the spawn energy pays with half as many MOVE, within ${C.MAX_CREEP_SIZE} parts.`,
            };
        }],
        constants: ['CREEP_SPAWN_TIME', 'CREEP_LIFE_TIME', 'CREEP_CLAIM_LIFE_TIME', 'MAX_CREEP_SIZE', 'SPAWN_ENERGY_CAPACITY', 'SPAWN_RENEW_RATIO', 'EXTENSION_ENERGY_CAPACITY', 'BODYPART_COST'],
        see: ['mechanic:spawning', 'mechanic:body-design', 'recipe:spawning', 'recipe:bootstrap-a-room', 'StructureSpawn.spawnCreep', 'StructureSpawn.renewCreep', 'Room.energyAvailable',
            'Room.energyCapacityAvailable', 'recipe:hauling-logistics', 'recipe:progression-checklist'],
    },

    // ================================================================ hauling logistics
    {
        id: 'hauling-logistics',
        title: 'Move energy: haulers, fillers, links, terminals',
        basis: 'practice',
        topic: 'practice',
        summary: 'Community practice for moving energy. Haulers are sized from energy per tick × round trip ÷ {{CARRY_CAPACITY}}; a filler serves spawn and extensions on a fixed route; from room level 5 links replace the long hauls inside a room, and from level 6 terminals replace creeps between rooms.',
        tasks: [
            'how many haulers do I need', 'how many CARRY parts for a hauler', 'how big should a hauler be', 'links or haulers', 'terminal or haulers between rooms',
            'fixed route for the filler creep', 'one hauler per miner or a hauler pool', 'move energy inside a room', 'container mining or drop mining',
        ],
        steps: [
            { call: 'PathFinder.search', text: 'Measure every route once: the path length from pick-up to drop-off. A round trip is twice that plus the ticks to load and unload.' },
            { call: 'StructureSpawn.spawnCreep', text: 'Size the hauling: CARRY parts = energy per tick × round trip ÷ {{CARRY_CAPACITY}}; one MOVE per two CARRY on roads, one per CARRY without (table). Split the parts over as few creeps as the spawn energy allows.' },
            { text: 'Hand out the work. One hauler per miner is simple and leaves haulers waiting. A pool that always takes the fullest pick-up uses them better, but needs one place that gives out the jobs so that two haulers do not go for the same energy.' },
            { call: 'Creep.withdraw', text: 'Pick-up: from the container under the miner; without one, or when it overflows, pickup from the pile.' },
            { call: 'Creep.transfer', text: 'Drop-off: spawn and extensions first, towers under a threshold, the rest to storage. From room level 4 haulers deliver to storage only and a filler works from there.' },
            { text: 'Filler: either a fixed route past all extensions, or creeps that stand between the storage (or a link) and a block of extensions and never walk. Give spawnCreep the same order in opts.energyStructures.' },
            { call: 'StructureLink.transferEnergy', text: 'From level 5 links take the long hauls: source link to storage link, storage link to controller link. One source fills a link in {{LINK_CAPACITY / ' + RATE + '}} ticks.' },
            { call: 'StructureTerminal.send', text: 'Between two rooms that both have a terminal, send; creeps carry only to rooms below level {{' + TERMINAL_LEVEL + '}} (table). Even out stocks as in recipe:balance-resources-between-rooms.' },
        ],
        notes: [
            L('Community practice: haulers develop from creeps that fetch whatever they find, to one hauler per miner, to haulers that are given tasks by one manager.', wiki('Maturity_Matrix')),
            L('An owned or reserved source needs {{' + CARRY_PER_TILE + '}} CARRY per tile of one-way distance. A body has {{MAX_CREEP_SIZE}} parts, so one road hauler ({{Math.floor(MAX_CREEP_SIZE * 2 / 3)}} CARRY) covers {{Math.floor(Math.floor(MAX_CREEP_SIZE * 2 / 3) / ' + CARRY_PER_TILE + ')}} tiles; beyond that it takes two.',
                carryCapacity, sourceRegen, eng(STRUCT, 'if(!body || !_.isArray(body) || body.length === 0 || body.length > C.MAX_CREEP_SIZE) {')),
            L('An empty CARRY part weighs nothing: a hauler walks out at full speed on any terrain, and only the loaded way back needs the road.', emptyCarry),
            L('Pile or container: a pile loses ceil(amount ÷ {{ENERGY_DECAY}}) per tick, so 1 per tick up to {{ENERGY_DECAY}}. A container loses nothing, holds {{CONTAINER_CAPACITY}}, and costs {{CONTAINER_DECAY * REPAIR_COST / CONTAINER_DECAY_TIME_OWNED}} energy per tick in your room and {{CONTAINER_DECAY * REPAIR_COST / CONTAINER_DECAY_TIME}} in a room without owner.',
                eng(P + 'energy/tick.js', 'object[resourceType] -= Math.ceil(object[resourceType] / C.ENERGY_DECAY);'), containerDecay, repairCost),
            L('A link loses {{LINK_LOSS_RATIO * 100}}% of what it sends: {{LINK_LOSS_RATIO * ' + RATE + '}} energy per tick for one source. A road hauler costs {{' + HAUL_PER_TILE + '}} per tick per tile, so in energy the link is ahead beyond {{LINK_LOSS_RATIO * ' + RATE + ' / ' + HAUL_PER_TILE + '}} tiles; it also saves the spawn time and the intents of the hauler.',
                eng(P + 'links/transfer.js', 'target.store.energy -= Math.ceil(amount * C.LINK_LOSS_RATIO);'), carryCapacity, lifeTime),
            L('Community practice for links: roles are source, storage, controller, and a link near an exit for haulers from remote rooms. Send rules are fixed pairs (source to storage), a priority list of receivers, or evening out all links to one level.', wiki('StructureLink')),
            L('By default a spawn pays from the spawns first and then from the extensions nearest to it. Community practice: refill along a fixed route and pass that order as energyStructures, so that what is spent first is refilled first.',
                eng(P + 'spawns/_charge-energy.js', 'extensions.sort(utils.comparatorDistance(spawn));'), eng(P + 'spawns/_charge-energy.js', 'energyStructures = _.uniq(energyStructures);'), wiki('Maturity_Matrix')),
            L('A full refill at level 8 is {{' + SPAWN_ENERGY(8) + '}} energy ({{EXTENSION_ENERGY_CAPACITY[8]}} per extension); at level 6 it is {{' + SPAWN_ENERGY(6) + '}}. A filler with n CARRY moves {{CARRY_CAPACITY}} × n per trip.',
                eng(P + 'extensions/tick.js', 'const storeCapacity = C.EXTENSION_ENERGY_CAPACITY[roomController.level] || 0;'), carryCapacity),
            L('Every withdraw, transfer and move that succeeds costs 0.2 CPU. Few large haulers are cheaper in CPU than many small ones, and passing energy from creep to creep costs one intent for each hand.', intentFee),
        ],
        pitfalls: [
            L('The receiving link has to be emptied. When it is full nothing arrives, the source link fills up, and the miner\'s energy drops on the ground.',
                eng(P + 'links/transfer.js', 'if(!target.storeCapacityResource || !target.storeCapacityResource.energy || targetTotal == target.storeCapacityResource.energy) {')),
            L('Hauling by creep between two rooms with terminals wastes energy: per 1000 delivered a terminal burns ' + fee(1) + ' at 1 room and ' + fee(5) + ' at 5, a road hauler\'s body costs several times that (table).', terminalFee),
            L('A container is full after {{CONTAINER_CAPACITY / ' + RATE + '}} ticks of one source. What comes after that lies on the ground and shrinks, so a pool should send the next free hauler to the fullest container.',
                eng(P + 'creeps/build.js', 'storeCapacity: C.CONTAINER_CAPACITY,'), eng(P + 'energy/tick.js', 'object[resourceType] -= Math.ceil(object[resourceType] / C.ENERGY_DECAY);')),
        ],
        tables: [
            C => {
                const rate = sourceRate(C), neutral = neutralRate(C), keeper = C.SOURCE_ENERGY_KEEPER_CAPACITY / C.ENERGY_REGEN_TIME;
                const parts = (perTick, d) => Math.ceil(perTick * 2 * d / C.CARRY_CAPACITY);
                return {
                    title: 'CARRY parts for one source by distance',
                    head: ['tiles one way', 'round trip', `at ${neutral} per tick (not reserved)`, `at ${rate} per tick (owned, reserved)`, `at ${r2(keeper)} per tick (keeper room)`,
                        `road haulers for ${rate} per tick`, 'energy', 'creeps'],
                    rows: [10, 20, 30, 50, 75, 100, 150].map(d => {
                        const carry = parts(rate, d);
                        const body = { carry, move: Math.ceil(carry / 2) };
                        return [d, 2 * d, parts(neutral, d), carry, parts(keeper, d), bodyText(body), bodyCost(C, body), Math.ceil(bodySize(body) / C.MAX_CREEP_SIZE)];
                    }),
                    foot: `CARRY = energy per tick × 2 × distance ÷ ${C.CARRY_CAPACITY}, rounded up; loading and unloading ticks come on top. On roads half as many MOVE, without roads as many MOVE as CARRY. "Creeps": the parts split into bodies of at most ${C.MAX_CREEP_SIZE}.`,
                };
            },
            C => {
                const road = { carry: 2, move: 1 }, plain = { carry: 1, move: 1 };
                const per1000 = (unit, trips) => Math.round(bodyCost(C, unit) / (trips * unit.carry * C.CARRY_CAPACITY) * 1000);
                return {
                    title: 'Moving 1,000 energy between two rooms: terminal against haulers',
                    head: ['rooms apart', 'terminal burns', 'round trips in a hauler life', 'road hauler costs', 'hauler without roads costs'],
                    rows: [1, 2, 3, 5, 7, 10].map(n => {
                        const trips = Math.floor(C.CREEP_LIFE_TIME / (2 * ROOM_TILES * n));
                        return [n, terminalCost(1000, n), trips, per1000(road, trips), per1000(plain, trips)];
                    }),
                    foot: `Terminal: ceil(1000 × (1 − e^(−rooms ÷ 30))) energy, both rooms at level ${LEVELS.find(l => C.CONTROLLER_STRUCTURES.terminal[l] > 0)}. Hauler: body cost ÷ energy delivered in ${C.CREEP_LIFE_TIME} ticks × 1000, `
                        + `with ${ROOM_TILES} tiles of path per room, [2 CARRY, 1 MOVE] on roads and [1 CARRY, 1 MOVE] without. Spawn time and CPU of the hauler are not counted.`,
                };
            },
        ],
        constants: ['CARRY_CAPACITY', 'MAX_CREEP_SIZE', 'CONTAINER_CAPACITY', 'ENERGY_DECAY', 'LINK_CAPACITY', 'LINK_LOSS_RATIO', 'LINK_COOLDOWN', 'EXTENSION_ENERGY_CAPACITY', 'STORAGE_CAPACITY', 'TERMINAL_COOLDOWN'],
        see: ['recipe:harvest-and-haul', 'recipe:link-network', 'recipe:balance-resources-between-rooms', 'recipe:roads-and-upkeep', 'recipe:remote-mining-economics', 'recipe:spawn-queue',
            'mechanic:body-design', 'mechanic:movement', 'mechanic:decay', 'mechanic:stores', 'mechanic:terminal-transfers', 'mechanic:cpu', 'StructureLink', 'StructureStorage', 'StructureContainer'],
    },

    // ================================================================ market strategy
    {
        id: 'market-strategy',
        title: 'Trade on the market: first credits, deal or order, arbitrage',
        basis: 'practice',
        topic: 'practice',
        summary: 'Community practice on the market: earn the first credits by dealing to buy orders, count the transfer energy into every price, deal for dear goods and place orders for cheap bulk and for energy. An order costs {{MARKET_FEE * 100}}% of its value up front; a deal costs the dealer the energy.',
        tasks: [
            'how to get my first credits', 'deal or create an order', 'should I buy energy on the market', 'when to sell minerals', 'how to price a market order',
            'is market arbitrage worth it', 'what to sell first', 'market strategy', 'sell pixels for credits',
        ],
        steps: [
            { call: 'Game.cpu.generatePixel', text: 'First credits without a terminal (official server): turn a full bucket into a pixel and deal pixels to a buy order.' },
            { call: 'Game.market.deal', text: 'First credits with a terminal (room level {{' + TERMINAL_LEVEL + '}}): deal spare energy or the mineral of the room to the best buy order. Selling by deal needs no credits.' },
            { call: 'Game.market.getAllOrders', text: 'Read the orders of one resource now and then, not every tick, and keep the result.' },
            { call: 'Game.market.getHistory', text: 'Hold each price against avgPrice and stddevPrice of the last days. Leave out orders far off the average.' },
            { call: 'Game.market.calcTransactionCost', text: 'Count the energy into the price: who deals pays it. A sale by deal brings price × amount minus the transfer energy at what energy is worth to you.' },
            { call: 'Game.market.createOrder', text: 'Deal or order. A deal is instant and costs you the energy. An order costs {{MARKET_FEE * 100}}% up front, waits, and leaves the energy to the other side. Cheap bulk and energy itself: order. Dear goods in small amounts: deal (table).' },
            { call: 'Game.market.changeOrderPrice', text: 'An order that does not fill: move its price. Lowering is free, raising costs the fee on the increase only; cancelling and creating again pays the whole fee twice.' },
            { text: 'Stock rules per resource: a floor you keep, a ceiling above which you sell, a level below which you buy. Sell what your rooms mine too much of and buy the minerals no room of yours has.' },
            { call: 'Game.market.cancelOrder', text: 'Cancel filled orders: they stay in Game.market.orders and count toward the {{MARKET_MAX_ORDERS}}.' },
        ],
        notes: [
            L('Community practice: the first credits come from dealing to existing buy orders, usually with energy, the mineral of the room or pixels.', wiki('Market')),
            L('Selling to a buy order needs no credits. Only a deal on a sell order is checked against your balance.', eng(MARKET_API, 'if(order.type == C.ORDER_SELL && (runtimeData.user.money || 0) < amount * order.price) {')),
            L('The player who deals pays the transfer energy, buying or selling. The owner of the order pays none.', eng(MARKET, 'if(executeTransfer(seller, buyer, order.resourceType, amount, targetTerminal, {order: {')),
            L('An order costs {{MARKET_FEE * 100}}% of price × amount when it is created. Cancelling returns nothing; an order that runs out after {{MARKET_ORDER_LIFE_TIME / 86400000}} days returns the fee of its unfilled part.',
                orderFee, eng(MARKET, 'const remainingFee = order.remainingAmount * order.price * C.MARKET_FEE;')),
            L('At the same price a deal is the cheaper way when one unit is worth more than (1 − e^(−rooms ÷ 30)) ÷ {{MARKET_FEE}} units of energy: {{Math.round((1 - Math.exp(-10 / 30)) / MARKET_FEE * 10) / 10}} at 10 rooms.', terminalFee, orderFee),
            L('Energy bought by deal arrives short of its own transfer: at 10 rooms ' + fee(10) + ' of every 1000 are burnt, so it costs {{Math.round(Math.exp(10 / 30) * 100) / 100}} times the listed price. Community practice: buy energy with a buy order and let the sellers pay the transfer.', terminalFee, wiki('Energy')),
            L('The game fixes no price. getHistory gives the average and the deviation per resource and day for the last 14 days.', backend(CRON, 'avgPrice: +i.avg.toFixed(3),')),
            L('Raising the price of an order costs the fee on the increase × the remaining amount; lowering it costs nothing.',
                eng(MARKET, 'var fee = Math.ceil((intent.newPrice - order.price) * order.remainingAmount * C.MARKET_FEE);'), eng(MARKET, 'if (intent.newPrice > order.price) {')),
            L('Community practice, arbitrage: buy from a low sell order and deal to a higher buy order, also between shards by carrying goods through portals. It pays only when the spread covers the energy of both transfers, and every deal blocks the terminal for {{TERMINAL_COOLDOWN}} ticks.',
                wiki('Market'), eng(MARKET, 'bulkObjects.update(targetTerminal, {cooldownTime: gameTime + cooldown});')),
        ],
        pitfalls: [
            L('A sale by deal over a long distance can burn more than it earns: at 30 rooms ' + fee(30) + ' energy per 1000 units sold.', terminalFee),
            L('Community practice: read your own orders before creating one, or you bid against yourself and tie up the fee twice.', wiki('Market')),
            L('At most 10 deals per tick and one per terminal per cooldown: a plan that needs many small deals is slower than it looks.',
                eng(MARKET_API, "if(!intents.pushByName('global', 'deal', {orderId, targetRoomName, amount}, 10)) {"), eng(MARKET, 'if(targetTerminal.cooldownTime > gameTime) {')),
        ],
        tables: [C => ({
            title: 'Deal or order, by distance between the two terminals',
            head: ['rooms', 'energy the dealer pays per 1000 units', 'deal is cheaper when a unit is worth more than this many units of energy', 'energy bought by deal costs, × listed price'],
            rows: [1, 2, 3, 5, 10, 15, 20, 30, 45].map(n => [n, terminalCost(1000, n), r2((1 - Math.exp(-n / 30)) / C.MARKET_FEE), r2(Math.exp(n / 30))]),
            foot: `Energy: ceil(1000 × (1 − e^(−rooms ÷ 30))). Third column: that share ÷ the order fee of ${C.MARKET_FEE * 100}%, comparing a deal with an order at the same price. Last column: 1 ÷ (1 − share), because the transfer is paid out of the dealer's terminal.`,
        })],
        constants: ['MARKET_FEE', 'MARKET_MAX_ORDERS', 'MARKET_ORDER_LIFE_TIME', 'TERMINAL_COOLDOWN', 'PIXEL_CPU_COST'],
        see: ['mechanic:market', 'mechanic:terminal-transfers', 'mechanic:account-resources', 'recipe:terminal-and-market', 'recipe:balance-resources-between-rooms', 'recipe:mine-minerals',
            'Game.market.deal', 'Game.market.createOrder', 'Game.market.getHistory', 'Game.market.calcTransactionCost', 'Game.market.orders', 'const:terminal-market'],
    },

    // ================================================================ GCL farming
    {
        id: 'gcl-farming',
        title: 'A room kept for GCL: temple, praise room',
        basis: 'practice',
        topic: 'practice',
        summary: 'Community practice: one room below level 8 takes the spare energy of the others and turns it into GCL, because the limit of {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy per tick exists only on a level 8 controller. It costs a room slot and a steady stream of energy from outside.',
        tasks: [
            'how to raise GCL faster', 'what is a temple room', 'gcl temple', 'praise room', 'spend spare energy on GCL', 'is a room only for upgrading worth it',
            'how many ticks to the next GCL level', 'what to do with spare energy when all rooms are level 8',
        ],
        steps: [
            { call: 'Game.gcl', text: 'See whether it pays: add up what your level 8 rooms earn above the {{CONTROLLER_MAX_UPGRADE_PER_TICK}} per tick each controller takes. Only that surplus feeds such a room.' },
            { call: 'Creep.claimController', text: 'Choose the room: next to a strong room of yours, with many free tiles within range 3 of the controller and room for storage and terminal beside them.' },
            { call: 'Creep.transfer', text: 'Feed it: haulers from the neighbour room first, the terminal from room level {{' + TERMINAL_LEVEL + '}} on, filled by every room with a surplus.' },
            { call: 'Creep.upgradeController', text: 'Upgraders: mostly WORK, 1 energy per WORK part per tick, standing still next to the store they draw from. They are built in the neighbour room while this room is small.' },
            { call: 'StructureLab.boostCreep', text: 'Boost them once labs stand: XGH2O turns each energy into {{BOOSTS.work.XGH2O.upgradeController}} points, for {{LAB_BOOST_MINERAL}} compound per WORK part.' },
            { call: 'StructureController.level', text: 'At level 8 the limit applies here too. Either keep it as a normal room and choose another, or start it over (next step).' },
            { call: 'StructureController.unclaim', text: 'Starting over: unclaim, claim again, and climb from level 1. The buildings stay but switch on again only as the levels return, so energy comes by creep until level {{' + TERMINAL_LEVEL + '}}.' },
        ],
        notes: [
            L('The limit of {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy per tick is applied only when the controller is at level 8. Below that every WORK part spends {{UPGRADE_CONTROLLER_POWER}} energy per tick, and every point counts for GCL at any level.',
                cap8, eng(UPGRADE, 'var limit = C.CONTROLLER_MAX_UPGRADE_PER_TICK;'), gclPoints),
            L('With all rooms at level 8, GCL grows by {{CONTROLLER_MAX_UPGRADE_PER_TICK}} points per room per tick, {{CONTROLLER_MAX_UPGRADE_PER_TICK * BOOSTS.work.XGH2O.upgradeController}} with XGH2O, whatever lies in the storages (second table). Only PWR_OPERATE_CONTROLLER lifts the limit, for as long as it lasts.',
                cap8, eng(UPGRADE, 'var boostedEffect = Math.floor(buildEffect + _.sum(boostedParts));'), eng(UPGRADE, 'limit += C.POWER_INFO[C.PWR_OPERATE_CONTROLLER].effect[effect.level-1];')),
            L('Community practice ("temple", "praising"): one room is kept for upgrading alone and fed by the others.', wiki('GCL_temple')),
            L('Upgrading works within range 3 of the controller: {{(2 * 3 + 1) ** 2 - 1}} tiles at most, fewer where walls are. Those tiles and the energy brought in set the rate.', eng(UPGRADE, 'if(Math.abs(target.x - object.x) > 3 || Math.abs(target.y - object.y) > 3) {')),
            L('Boosts multiply the points, not the energy: GH ×{{BOOSTS.work.GH.upgradeController}}, GH2O ×{{BOOSTS.work.GH2O.upgradeController}}, XGH2O ×{{BOOSTS.work.XGH2O.upgradeController}}, for {{LAB_BOOST_MINERAL}} compound and {{LAB_BOOST_ENERGY}} energy per WORK part of each creep.',
                eng(UPGRADE, 'return C.BOOSTS[C.WORK][i.boost].upgradeController-1;'), eng(P + 'labs/boost-creep.js', 'object.store[mineralType] -= C.LAB_BOOST_MINERAL;')),
            L('Levels 1 to 8 take {{' + ALL_LEVELS + '}} energy in all. The terminal works from level {{' + TERMINAL_LEVEL + '}}, {{[1, 2, 3, 4, 5, 6, 7].filter(l => l < ' + TERMINAL_LEVEL + ').reduce((sum, l) => sum + CONTROLLER_LEVELS[l], 0)}} energy after the claim.',
                levelCost, eng(P + 'terminal/tick.js', 'C.CONTROLLER_STRUCTURES.terminal[roomController.level] ? C.TERMINAL_CAPACITY : 0;')),
            L('unclaim() sets the controller to level 0 with progress 0, empties the stock of safe modes and, outside a novice area, starts the safe mode cooldown of {{SAFE_MODE_COOLDOWN}} ticks. Structures above the allowance of a level do not work until that level is back.',
                eng(P + 'controllers/unclaim.js', 'level: 0,'), eng(P + 'controllers/unclaim.js', 'safeModeCooldown: roomInfo.novice > Date.now() ? null : gameTime + C.SAFE_MODE_COOLDOWN,'),
                eng(UTILS, 'let allowedRemaining = C.CONTROLLER_STRUCTURES[object.type][roomController.level];')),
            L('Community practice at level 8: the room is unclaimed and claimed again, to start over at level 1, at the price of the early levels without terminal, towers or safe mode. The other choice is to keep it as a normal room.', wiki('GCL_temple')),
        ],
        pitfalls: [
            L('The room takes one of your GCL slots. A normal room in that slot would earn energy and a mineral; this one only spends.', claimNeedsGcl),
            L('A new level needs a full downgrade timer, and after each level-up the timer starts at half. Points above the requirement are kept meanwhile, so nothing is lost while it fills.',
                eng(UPGRADE, 'target.downgradeTime + C.CONTROLLER_DOWNGRADE_RESTORE >= gameTime + C.CONTROLLER_DOWNGRADE[target.level]) {'), eng(UPGRADE, 'target.progress += boostedEffect;')),
            L('Do not renew boosted upgraders: renewing removes the boost. Community practice is to unboost them shortly before they die, which gives back {{LAB_UNBOOST_MINERAL}} of the {{LAB_BOOST_MINERAL}} compound per part.',
                eng(P + 'spawns/renew-creep.js', 'i.boost = null;'), eng(P + 'labs/unboost-creep.js', 'const mineralReturn = boostedParts[r]*C.LAB_UNBOOST_MINERAL;'), wiki('GCL_temple')),
            L('An upgrader with W WORK parts burns W × {{CREEP_LIFE_TIME}} energy in its life: 30 WORK parts use up the whole output of {{30 / ' + RATE + '}} sources.', eng(UPGRADE, 'buildEffect = Math.min(buildPower, object.store.energy),'), sourceRegen),
        ],
        tables: [
            C => {
                const x = C.BOOSTS.work.XGH2O.upgradeController, cap = C.CONTROLLER_MAX_UPGRADE_PER_TICK;
                const row = (label, work) => [label, work * C.UPGRADE_CONTROLLER_POWER, work * C.UPGRADE_CONTROLLER_POWER * C.CREEP_LIFE_TIME, work * C.UPGRADE_CONTROLLER_POWER, work * C.UPGRADE_CONTROLLER_POWER * x, work * C.LAB_BOOST_MINERAL];
                return {
                    title: 'Points per tick by upgrader',
                    head: ['where', 'energy per tick', `energy in ${C.CREEP_LIFE_TIME} ticks`, 'points per tick', 'with XGH2O', 'compound per creep'],
                    rows: [row(`level 8: all creeps together, ${cap / C.UPGRADE_CONTROLLER_POWER} WORK`, cap / C.UPGRADE_CONTROLLER_POWER)]
                        .concat([15, 30, 45].map(w => row(`below level 8: one creep, ${w} WORK`, w))),
                    foot: `${C.UPGRADE_CONTROLLER_POWER} energy and 1 point per WORK part per tick; XGH2O ×${x} on the points; ${C.LAB_BOOST_MINERAL} compound per boosted part. Below level 8 the rows add up over as many creeps as find a tile and energy.`,
                };
            },
            C => {
                const total = n => Math.round(C.GCL_MULTIPLY * Math.pow(n - 1, C.GCL_POW));
                const cap = C.CONTROLLER_MAX_UPGRADE_PER_TICK;
                return {
                    title: 'GCL levels and the level 8 limit',
                    head: ['GCL level', 'points in all', 'points for this level', 'rooms owned before it', `ticks with each of them at ${cap} per tick`, 'with XGH2O'],
                    rows: [2, 3, 4, 5, 6, 8, 10, 15, 20, 30].map(n => {
                        const step = total(n) - total(n - 1);
                        return [n, total(n), step, n - 1, Math.round(step / ((n - 1) * cap)), Math.round(step / ((n - 1) * cap * C.BOOSTS.work.XGH2O.upgradeController))];
                    }),
                    foot: `Points in all = ${C.GCL_MULTIPLY} × (level − 1)^${C.GCL_POW}. The tick columns assume every room you may own is at level 8 and upgrades at the limit all the time; a room below level 8 adds whatever energy it is given.`,
                };
            },
        ],
        constants: ['CONTROLLER_MAX_UPGRADE_PER_TICK', 'UPGRADE_CONTROLLER_POWER', 'CONTROLLER_LEVELS', 'GCL_MULTIPLY', 'GCL_POW', 'BOOSTS.work.XGH2O', 'LAB_BOOST_MINERAL', 'LAB_UNBOOST_MINERAL', 'SAFE_MODE_COOLDOWN'],
        see: ['mechanic:controller', 'recipe:upgrade-at-level-8', 'Game.gcl', 'Creep.upgradeController', 'StructureController.unclaim', 'recipe:labs-and-boosts', 'recipe:make-a-tier-3-boost',
            'recipe:balance-resources-between-rooms', 'recipe:claim-a-room', 'mechanic:boosts', 'mechanic:safe-mode', 'mechanic:room-loss'],
    },

    // ================================================================ progression checklist
    {
        id: 'progression-checklist',
        title: 'What to automate next: from the first spawn to a mature empire',
        basis: 'practice',
        topic: 'practice',
        summary: 'An ordered list of what a bot has to do without its owner, from the first spawn to many level 8 rooms; each step names the entry that explains it. Community practice sets the order: income and spawning first, then defence, expansion, minerals and trade, and last the level 8 work.',
        tasks: [
            'what should I automate next', 'what to do after the tutorial', 'what to build after room level 4', 'roadmap for a screeps bot', 'in which order to develop my bot',
            'what comes after remote mining', 'progression checklist', 'how long does each room level take',
        ],
        steps: [
            { call: 'recipe:bootstrap-a-room', text: 'Room level 1 and 2: workers that harvest, fill the spawn and upgrade with no order given by hand.' },
            { call: 'recipe:spawn-queue', text: 'Spawning by priority, with a way back from zero creeps. Everything after this depends on it.' },
            { call: 'recipe:harvest-and-haul', text: 'From level 2 ({{' + SPAWN_ENERGY(2) + '}} spawn energy): one miner per source and haulers, so that all {{' + RATE + '}} energy per tick of each source is taken.' },
            { call: 'recipe:tower-logic', text: 'Level 3: the tower, always filled, answers raids (recipe:defend-against-invaders); safe mode stays the last resort (recipe:safe-mode).' },
            { call: 'recipe:base-planning', text: 'Sites placed by code at every new level: extensions, roads, containers, later ramparts (recipe:roads-and-upkeep).' },
            { call: 'recipe:remote-mining-economics', text: 'Levels 3 and 4: mine the rooms next door, reserve them, guard them (recipe:reserve-and-remote-mine).' },
            { call: 'recipe:hauling-logistics', text: 'Level 4: the storage as the hub. Level 5: links instead of long hauls (recipe:link-network).' },
            { call: 'recipe:room-selection', text: 'GCL 2: choose and claim a second room (recipe:claim-a-room), and run every room from the same code.' },
            { call: 'recipe:defend-a-room', text: 'Ramparts over what must survive, raised with spare energy (recipe:keep-ramparts-up), and a defence that answers players, not only invaders.' },
            { call: 'recipe:save-cpu', text: 'Before the CPU runs short: stored paths, cached lookups, fewer and larger creeps (recipe:cache-between-ticks, recipe:measure-cpu, recipe:travel-across-rooms).' },
            { call: 'recipe:mine-minerals', text: 'Level 6: extractor, terminal, labs. Mine the mineral, trade (recipe:market-strategy), even out stocks between rooms (recipe:balance-resources-between-rooms).' },
            { call: 'recipe:make-a-tier-3-boost', text: 'Reactions run by code up to tier 3, and boosting as a part of spawning (recipe:labs-and-boosts).' },
            { call: 'recipe:scout-rooms', text: 'Stored knowledge of the rooms around: free rooms, targets, threats. Scouts first, the observer at level 8.' },
            { call: 'recipe:source-keeper-mining', text: 'Keeper rooms, then the highways: deposits and power banks (recipe:harvest-deposits, recipe:observer-and-power), and the factory at level 7 (recipe:factory-production).' },
            { call: 'recipe:upgrade-at-level-8', text: 'Level 8: the upgrade limit, power processing and power creeps (recipe:power, recipe:operator-routine), spare energy into GCL (recipe:gcl-farming).' },
            { call: 'recipe:attack-a-room', text: 'Offence when the economy carries it: sieges and strongholds (recipe:clear-a-stronghold).' },
        ],
        notes: [
            L('Community practice: the order follows the hurdles most bots meet. The wiki lists them, and describes for each system the stages from done by hand to fully automatic.', wiki('Great_Filters'), wiki('Maturity_Matrix')),
            L('From level 2 a single miner of {{' + RATE + ' / HARVEST_POWER}} WORK and 1 MOVE ({{' + RATE + ' / HARVEST_POWER * BODYPART_COST.work + BODYPART_COST.move}} energy) empties a source; at level 1 a creep with one MOVE holds {{Math.floor((' + SPAWN_ENERGY(1) + ' - BODYPART_COST.move) / BODYPART_COST.work)}} WORK at most.', harvestPower, paidAtOnce),
            L('Level 3 costs {{CONTROLLER_LEVELS[2]}} energy and every level after it {{CONTROLLER_LEVELS[3] / CONTROLLER_LEVELS[2]}} times the one before, up to {{CONTROLLER_LEVELS[7]}} for level 8. From level 5 on the pace is set by income, not by what the room may build (table).', levelCost),
            L('GCL 2 needs {{GCL_MULTIPLY}} upgrade points in all, and the points are the same energy that raises the room: the second room comes while the first climbs from level {{[1, 2, 3, 4, 5, 6, 7].find(l => [1, 2, 3, 4, 5, 6, 7].filter(x => x <= l).reduce((sum, x) => sum + CONTROLLER_LEVELS[x], 0) >= GCL_MULTIPLY)}} to {{[1, 2, 3, 4, 5, 6, 7].find(l => [1, 2, 3, 4, 5, 6, 7].filter(x => x <= l).reduce((sum, x) => sum + CONTROLLER_LEVELS[x], 0) >= GCL_MULTIPLY) + 1}}, sooner with remote income.',
                gclPoints, eng(UTILS, 'return C.GCL_MULTIPLY * Math.pow(gclLevel-1, C.GCL_POW);')),
            L('Community practice: write for many rooms before the second one. Loop over your rooms and give every creep a home room; code that assumes one room is the usual reason a new room stalls.', wiki('Claiming_new_room')),
            L('Community practice on the official server: turn a full bucket into pixels from the first day. They are the first thing you can sell.', wiki('Getting_Started')),
        ],
        pitfalls: [
            L('Remotes before a tower and a guard lose more creeps than they pay for: raids follow the energy harvested, in remote rooms as at home.', raidCounter, raidGoal),
            L('Community practice: make each step run without you before the next. A raid that kills every creep breaks spawning code with fixed assumptions, and a room that cannot restart by itself undoes all that was built on top.', wiki('Great_Filters')),
        ],
        tables: [C => {
            const skip = ['road', 'constructedWall', 'rampart', 'container'];
            const types = Object.keys(C.CONTROLLER_STRUCTURES).filter(t => !skip.includes(t));
            const rate = sourceRate(C), neutral = neutralRate(C);
            const reservedRemote = remote(C, 50, rate, true, 1), neutralRemote = remote(C, 50, neutral, false, 1);
            const claimer = { claim: 1, move: 1 };
            return {
                kind: 'levels',
                title: 'Energy per tick and what it buys, by room level',
                head: ['RCL', 'energy to reach it', 'spawn energy', 'one miner takes per tick', 'two own sources per tick', 'ticks to the next level on that', 'one remote source at 50 road tiles, net', 'new structures'],
                rows: LEVELS.map(l => {
                    const energy = spawnEnergy(C, l);
                    const work = Math.min(rate / C.HARVEST_POWER, Math.floor((energy - C.BODYPART_COST.move) / C.BODYPART_COST.work));
                    const own = 2 * work * C.HARVEST_POWER;
                    const added = types.map(t => [t, (C.CONTROLLER_STRUCTURES[t][l] || 0) - (C.CONTROLLER_STRUCTURES[t][l - 1] || 0)]).filter(x => x[1] > 0);
                    const remoteNet = energy >= Math.max(bodyCost(C, reservedRemote.miner), bodyCost(C, claimer)) ? r2(reservedRemote.net) + ' (reserved)'
                        : energy >= bodyCost(C, neutralRemote.miner) ? r2(neutralRemote.net) + ' (not reserved)' : '—';
                    return [l, l === 1 ? '—' : C.CONTROLLER_LEVELS[l - 1], energy, work * C.HARVEST_POWER, own, l === 8 ? '—' : Math.ceil(C.CONTROLLER_LEVELS[l] / own), remoteNet,
                        added.map(([t, n]) => `${n} ${t}`).join(', ')];
                }),
                foot: `Miner: as many WORK parts as the spawn energy pays next to 1 MOVE, up to the ${rate / C.HARVEST_POWER} a source needs. "Ticks to the next level": the whole income of two sources put into the controller; at level 8 the controller takes ${C.CONTROLLER_MAX_UPGRADE_PER_TICK} per tick. `
                    + `Remote: the net of recipe:remote-mining-economics, reserved as soon as the room can pay its miner (${bodyCost(C, reservedRemote.miner)}) and a ${bodyText(claimer)} creep (${bodyCost(C, claimer)}). Roads, containers, walls and ramparts are left out of the last column.`,
            };
        }],
        constants: ['CONTROLLER_LEVELS', 'CONTROLLER_STRUCTURES', 'GCL_MULTIPLY', 'GCL_POW', 'SOURCE_ENERGY_CAPACITY', 'ENERGY_REGEN_TIME', 'HARVEST_POWER'],
        see: ['recipe:bootstrap-a-room', 'recipe:spawn-queue', 'recipe:harvest-and-haul', 'recipe:tower-logic', 'recipe:base-planning', 'recipe:remote-mining-economics', 'recipe:hauling-logistics',
            'recipe:room-selection', 'recipe:defend-a-room', 'recipe:save-cpu', 'recipe:mine-minerals', 'recipe:market-strategy', 'recipe:make-a-tier-3-boost', 'recipe:scout-rooms',
            'recipe:source-keeper-mining', 'recipe:upgrade-at-level-8', 'recipe:gcl-farming', 'recipe:attack-a-room', 'recipe:troubleshooting', 'mechanic:controller', 'recipe:tutorial-walkthrough'],
    },
];
