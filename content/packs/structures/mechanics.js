'use strict';
// Pack "structures": spawning, construction sites, body design, ramparts and walls,
// and sourced additions to the controller, safe mode, tower, damage, death, movement and
// simultaneous-action mechanics. Numbers come from the constants; tables are computed.
const { L, eng, backend, driver, doc, article } = require('../../_h');

const P = 'src/processor/intents/';
const STRUCT = 'src/game/structures.js';
const CREEPS = 'src/game/creeps.js';
const ROOMS = 'src/game/rooms.js';
const UTILS = 'src/utils.js';
const RUNTIME = 'lib/runtime/runtime.js';
const DOCS = 'https://docs.screeps.com/';

// ---- sources used more than once
const rampartFirst = eng(P + 'creeps/attack.js', "var rampart = _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y});");
const rampartHitsMax = eng(P + 'ramparts/tick.js', 'var hitsMax = object.user == roomController.user ? C.RAMPART_HITS_MAX[roomController.level] || 0 : 0;');
const wallHitsMax = eng(P + 'constructedWalls/tick.js', 'var hitsMax = C.CONTROLLER_STRUCTURES.constructedWall[roomController.level] ? C.WALL_HITS_MAX : 0;');
const repairNeedsHitsMax = eng(P + 'creeps/repair.js', 'if(!target || !target.hitsMax || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {');
const closedRampartBlocks = eng(P + 'movement.js', "i.type == 'rampart' && !i.isPublic && i.user != object.user ||");
const ownSiteBlocks = eng(P + 'movement.js', "i.type == 'constructionSite' && i.user == object.user && _.contains(C.OBSTACLE_OBJECT_TYPES,");
const siteStomp = eng(P + 'movement.js', "var constructionSite = _.find(cellObjects, (i) => i.type == 'constructionSite' && i.user != object.user);");
const siteStompSafeMode = eng(P + 'movement.js', 'if(!roomController || roomController.user === object.user || !(roomController.safeMode > gameTime)) {');
const levelNeedsFullTimer = eng(P + 'creeps/upgradeController.js', 'target.downgradeTime + C.CONTROLLER_DOWNGRADE_RESTORE >= gameTime + C.CONTROLLER_DOWNGRADE[target.level]) {');
const moveRemovesFatigue = eng(P + 'creeps/tick.js', "require('./_add-fatigue')(object, -2*moves, scope);");
const lifeStarts = eng(P + 'creeps/tick.js', 'object.ageTime = gameTime + (_.any(object.body, {type: C.CLAIM}) ? C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME);');
const firstSpawn = backend('lib/game/api/game.js', 'store: { energy: C.SPAWN_ENERGY_START },');
const intentFee = driver(RUNTIME, 'if (!freeMethods[name] && !this.list[id][name]) {');
const towerOrder = eng(P + 'towers/intents.js', 'else if(objectIntents.repair)');

// ---- helpers for the computed tables
// The step factors and the 2 fatigue per MOVE part are literals in the engine (movement.js, creeps/tick.js).
const STEP = { road: 1, plain: 2, swamp: 10 };
const MOVE_REMOVES = 2;
const ticksPerTile = (weight, move, factor) => Math.max(1, Math.ceil(weight * factor / (MOVE_REMOVES * move)));
const spawnEnergy = (C, l) => C.CONTROLLER_STRUCTURES.spawn[l] * C.SPAWN_ENERGY_CAPACITY + C.CONTROLLER_STRUCTURES.extension[l] * C.EXTENSION_ENERGY_CAPACITY[l];
const bodyCost = (C, body) => body.reduce((sum, [n, part]) => sum + n * C.BODYPART_COST[part], 0);
const bodySize = body => body.reduce((sum, [n]) => sum + n, 0);
const bodyText = body => body.map(([n, part]) => `${n} ${part.toUpperCase()}`).join(' + ');
const firstLevelFor = (C, cost) => { const l = [1, 2, 3, 4, 5, 6, 7, 8].find(x => spawnEnergy(C, x) >= cost); return l === undefined ? '—' : l; };
const num = n => n.toLocaleString('en-US');
const towerAt = (C, base, r) => {
    const range = Math.min(Math.max(r, C.TOWER_OPTIMAL_RANGE), C.TOWER_FALLOFF_RANGE);
    return Math.floor(base - base * C.TOWER_FALLOFF * (range - C.TOWER_OPTIMAL_RANGE) / (C.TOWER_FALLOFF_RANGE - C.TOWER_OPTIMAL_RANGE));
};

const BODIES = [
    ['first worker', [[1, 'work'], [1, 'carry'], [1, 'move']]],
    ['worker for one spawn', [[2, 'work'], [1, 'carry'], [1, 'move']]],
    ['miner that stays put', [[5, 'work'], [1, 'move']]],
    ['miner feeding a link', [[5, 'work'], [1, 'carry'], [3, 'move']]],
    ['hauler on roads', [[10, 'carry'], [5, 'move']]],
    ['hauler off road', [[10, 'carry'], [10, 'move']]],
    ['claimer', [[1, 'claim'], [1, 'move']]],
    ['reserver', [[2, 'claim'], [2, 'move']]],
    ['level 8 upgrader on roads', [[15, 'work'], [3, 'carry'], [9, 'move']]],
    ['dismantler', [[25, 'work'], [25, 'move']]],
    ['melee attacker', [[25, 'attack'], [25, 'move']]],
    ['ranged attacker', [[25, 'ranged_attack'], [25, 'move']]],
    ['healer', [[25, 'heal'], [25, 'move']]],
];

module.exports = {
    entries: [
        // ============================================================ spawning
        {
            id: 'spawning',
            title: 'Spawning: who pays, how long, where the creep comes out',
            summary: 'A spawn makes one creep at a time: {{CREEP_SPAWN_TIME}} ticks per body part, paid in full at the start from the spawns and extensions of the room. The finished creep is put on the first free tile around the spawn.',
            tasks: [
                'which extensions pay for a creep first', 'in what order is spawn energy taken', 'what happens when the spawn exits are blocked',
                'why is my spawn stuck with a finished creep', 'does a spawn kill a creep that blocks it', 'how fast does a spawn regenerate energy',
                'what does renewing a creep cost and add', 'how much energy does recycling give back per part', 'cancel a creep that is being spawned',
                'which direction does a creep leave the spawn',
            ],
            facts: [
                // paying
                L('The whole cost, the sum of BODYPART_COST, is taken in the tick of the call. Nothing is paid over time.', eng(P + 'spawns/create-creep.js', 'var cost = utils.calcCreepCost(intent.body);')),
                L('Without opts.energyStructures the spawn itself pays first, then the other spawns, then the extensions; inside each group the nearest to the spawning spawn first (distance: the larger of dx and dy).',
                    eng(P + 'spawns/_charge-energy.js', 'spawns.sort(utils.comparatorDistance(spawn));'), eng(P + 'spawns/_charge-energy.js', 'extensions.sort(utils.comparatorDistance(spawn));')),
                L('With opts.energyStructures only the listed structures pay, in list order. Entries that are not active spawns or extensions of yours are skipped; a structure listed twice counts once.',
                    eng(P + 'spawns/_charge-energy.js', "(energyStructure.type === 'spawn' || energyStructure.type === 'extension');"), eng(P + 'spawns/_charge-energy.js', 'energyStructures = _.uniq(energyStructures);')),
                L('Spawns and extensions above the allowance of the room level are switched off, farthest from the controller first. They neither count nor pay.',
                    eng(P + '_calc_spawns.js', 'roomSpawns.forEach(i => i._off = !_.contains(spawns, i));'), eng(P + 'spawns/_charge-energy.js', "var spawns = _.filter(roomObjects, i => i.type == 'spawn' && i.user == spawn.user && !i.off);")),
                L('The return code is checked against the energy at the start of the tick. If another spawn of the room has spent it by the time the order is processed, no creep is made and nothing is charged.', eng(P + 'spawns/_charge-energy.js', 'if(availableEnergy < cost) {')),
                // time
                L('Spawn time is {{CREEP_SPAWN_TIME}} ticks per part: {{CREEP_SPAWN_TIME * MAX_CREEP_SIZE}} ticks for a body of {{MAX_CREEP_SIZE}}.', eng(P + 'spawns/create-creep.js', 'var needTime = C.CREEP_SPAWN_TIME * intent.body.length;')),
                L('PWR_OPERATE_SPAWN cuts it to {{POWER_INFO[PWR_OPERATE_SPAWN].effect[0] * 100}}%–{{POWER_INFO[PWR_OPERATE_SPAWN].effect[4] * 100}}% (by power level, rounded up) if it is active when the spawning starts. PWR_DISRUPT_SPAWN stops the clock for as long as it lasts.',
                    eng(P + 'spawns/create-creep.js', 'needTime = Math.ceil(needTime * C.POWER_INFO[C.PWR_OPERATE_SPAWN].effect[effect.level-1]);'), eng(P + 'spawns/tick.js', 'bulk.update(object, {spawning: {spawnTime: 1+object.spawning.spawnTime}});')),
                L('Meanwhile the creep exists on the spawn\'s own tile with spawning = true and cannot act. Its life time starts in its first tick outside.', eng(P + 'spawns/create-creep.js', 'spawning: true,'), lifeStarts),
                // leaving
                L('When the time is up the creep goes to the first free tile in direction order: TOP, TOP_RIGHT, RIGHT and on clockwise, or the order given in opts.directions or setDirections.',
                    eng(P + 'spawns/_born-creep.js', 'var directions = [1,2,3,4,5,6,7,8];'), eng(P + 'spawns/_born-creep.js', 'directions = spawn.spawning.directions;')),
                L('A tile is not free when it holds a creep or a non-walkable structure, a construction site for a non-walkable structure (anybody\'s), a creep moving onto it this tick, or wall terrain without a road.',
                    eng(P + 'spawns/_born-creep.js', 'isOccupied = _.any(roomObjects, checkObstacleFn) ||'), eng(P + 'spawns/_born-creep.js', "(i.type == 'constructionSite' && _.contains(C.OBSTACLE_OBJECT_TYPES, i.structureType))  // unwalkable site")),
                L('No free tile: the spawn stays busy and tries again every tick; spawning.remainingTime reads 0 meanwhile.', eng(P + 'spawns/tick.js', 'bulk.update(object, {spawning: {spawnTime: 1+gameTime}});')),
                L('Hostile-creep case: if every allowed tile is taken and one of them holds a creep of another player (ally and invader alike), that creep is killed and the new creep takes its tile.',
                    eng(P + 'spawns/_born-creep.js', "hostileOccupied = _.find(roomObjects, i => i.x == newX && i.y == newY && i.type == 'creep' && i.user != spawn.user);"),
                    eng(P + 'spawns/_born-creep.js', "require('../creeps/_die')(hostileOccupied, undefined, true, scope);")),
                L('With a restricted direction list that only happens when the other directions are blocked as well. A free tile outside your list means the spawn just waits.', eng(P + 'spawns/_born-creep.js', 'for (var direction of otherDirections) {')),
                // regeneration
                L('A spawn gains 1 energy per tick while the active spawns and extensions of the room hold less than {{SPAWN_ENERGY_CAPACITY}} together and the spawn itself is not full.',
                    eng(P + 'spawns/tick.js', 'if(!object.tutorial && energyAvailable < C.SPAWN_ENERGY_CAPACITY && object.store.energy < C.SPAWN_ENERGY_CAPACITY) {'),
                    eng('src/processor.js', "scope.energyAvailable = _(roomObjects).filter((i) => !i.off && (i.type == 'spawn' || i.type == 'extension')).sum('store.energy');")),
                L('No regeneration in a room whose controller is not yours, and none for a spawn switched off by the room level.',
                    eng(P + 'spawns/tick.js', 'if(!roomController || roomController.level < 1 || roomController.user != object.user) {'), eng(P + 'spawns/tick.js', 'if(!_.contains(spawns, object)) {')),
                L('It is the way back when every creep is dead: from empty, a [WORK, CARRY, MOVE] creep ({{BODYPART_COST.work + BODYPART_COST.carry + BODYPART_COST.move}} energy) is affordable after {{BODYPART_COST.work + BODYPART_COST.carry + BODYPART_COST.move}} ticks.', doc('StructureSpawn')),
                // cancelling
                L('spawning.cancel() removes the unfinished creep at once. The energy is not returned.', eng(P + 'spawns/cancel-spawning.js', 'bulk.remove(spawningCreep._id);'), doc('StructureSpawn.Spawning.cancel')),
                L('A spawn destroyed while spawning takes the unfinished creep with it.', eng(P + 'structures/_destroy.js', 'const spawning = _.find(roomObjects, {user: object.user, name: object.spawning.name});')),
                // renew
                L('renewCreep adds floor({{SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME}} ÷ parts) ticks of life per call.', eng(P + 'spawns/renew-creep.js', 'var effect = Math.floor(C.SPAWN_RENEW_RATIO * C.CREEP_LIFE_TIME / C.CREEP_SPAWN_TIME / target.body.length);')),
                L('One call costs ceil({{SPAWN_RENEW_RATIO / CREEP_SPAWN_TIME}} × body cost ÷ parts) energy. Per tick of life that is body cost ÷ {{CREEP_LIFE_TIME}}, the price of a new creep; what is saved is spawn time.',
                    eng(P + 'spawns/renew-creep.js', 'var cost = Math.ceil(C.SPAWN_RENEW_RATIO * utils.calcCreepCost(target.body) / C.CREEP_SPAWN_TIME / target.body.length);')),
                L('A call that would lift ticksToLive above {{CREEP_LIFE_TIME}} is refused (ERR_FULL).', eng(P + 'spawns/renew-creep.js', 'if(target.ageTime + effect > gameTime + C.CREEP_LIFE_TIME) {')),
                L('The spawn must be idle; the creep adjacent, yours, out of the spawn and without a CLAIM part.', eng(P + 'spawns/renew-creep.js', 'if(_.filter(target.body, (i) => i.type == C.CLAIM).length > 0) {'), eng(P + 'spawns/renew-creep.js', 'if(object.spawning) {')),
                L('Renewing strips every boost from the creep; no compound comes back.', eng(P + 'spawns/renew-creep.js', 'i.boost = null;')),
                // recycle
                L('recycleCreep kills an adjacent creep of yours and returns per part min({{CREEP_PART_MAX_ENERGY}}, part cost × ticksToLive ÷ life time): rate 1 instead of the {{CREEP_CORPSE_RATE}} of every other death.',
                    eng(P + 'spawns/recycle-creep.js', "require('../creeps/_die')(target, 1.0, false, scope);"), eng(P + 'creeps/_die.js', 'C.BODYPART_COST[i.type] * lifeRate')),
                L('The refund does not go into the spawn: it lands in a container under the creep if there is one, else in a tombstone on the creep\'s tile.', eng(P + 'creeps/_die.js', "let container = _.find(roomObjects, { type: 'container', x: object.x, y: object.y });")),
                L('Recycling works while the spawn is busy: the only checks are on the creep.', eng(P + 'spawns/recycle-creep.js', "if(!target || target.type != 'creep' || target.user != object.user || target.spawning) {")),
            ],
            pitfalls: [
                L('Two creeps ordered under the same name in one tick: the second call returns ERR_NAME_EXISTS, because names used this tick count as taken.', eng(STRUCT, 'if(globals.Game.creeps[name] || createdCreepNames.indexOf(name) != -1) {', 'engine: name check (the same line is in spawnCreep)')),
                L('The spawn does not read as busy in the tick of the order: a second spawnCreep on it in the same tick returns OK and replaces the first.',
                    eng(STRUCT, "intents.set(this.id, 'createCreep', {name, body, energyStructures, directions});"), driver(RUNTIME, 'this.list[id][name] = data;')),
                L('Do not park creeps on all eight tiles around a spawn: your own creeps are never killed to make room, the spawn just waits.', eng(P + 'spawns/_born-creep.js', "hostileOccupied = _.find(roomObjects, i => i.x == newX && i.y == newY && i.type == 'creep' && i.user != spawn.user);")),
            ],
            tables: [
                C => ({
                    title: 'Renewing by body size',
                    head: ['parts', 'life per call', 'calls for a full life', 'ticks to spawn anew', 'energy per call, per 1000 of body cost'],
                    rows: [3, 6, 10, 16, 25, 32, 50].map(n => {
                        const gain = Math.floor(C.SPAWN_RENEW_RATIO * C.CREEP_LIFE_TIME / C.CREEP_SPAWN_TIME / n);
                        return [n, gain, Math.ceil(C.CREEP_LIFE_TIME / gain), n * C.CREEP_SPAWN_TIME, Math.ceil(C.SPAWN_RENEW_RATIO * 1000 / C.CREEP_SPAWN_TIME / n)];
                    }),
                    foot: 'One call per spawn per tick, so the calls are also the ticks a spawn is tied up. The last column scales with the cost of the body and is rounded up per call.',
                }),
                C => ({
                    title: 'Energy back per body part at full life',
                    head: ['part', 'cost', 'recycled', 'died or suicide'],
                    rows: C.BODYPARTS_ALL.map(p => [p.toUpperCase(), C.BODYPART_COST[p], Math.min(C.CREEP_PART_MAX_ENERGY, C.BODYPART_COST[p]), Math.min(C.CREEP_PART_MAX_ENERGY, C.BODYPART_COST[p] * C.CREEP_CORPSE_RATE)]),
                    foot: `Both columns shrink with the life already used: × ticksToLive ÷ life time. The cap of ${C.CREEP_PART_MAX_ENERGY} per part is applied after that.`,
                }),
            ],
            constants: ['CREEP_SPAWN_TIME', 'SPAWN_ENERGY_CAPACITY', 'SPAWN_ENERGY_START', 'SPAWN_RENEW_RATIO', 'CREEP_LIFE_TIME', 'CREEP_PART_MAX_ENERGY', 'CREEP_CORPSE_RATE', 'BODYPART_COST', 'MAX_CREEP_SIZE'],
            see: ['StructureSpawn.spawnCreep', 'StructureSpawn.renewCreep', 'StructureSpawn.recycleCreep', 'StructureSpawn.Spawning.setDirections', 'StructureSpawn.Spawning.cancel',
                'Room.energyAvailable', 'mechanic:body-design', 'mechanic:creep-death', 'recipe:spawning', 'const:creep-life'],
            url: DOCS + 'creeps.html',
        },

        // ============================================================ construction sites
        {
            id: 'construction-sites',
            title: 'Construction sites: where, how many, what they cost',
            summary: 'A site marks a structure to be built. A player may have {{MAX_CONSTRUCTION_SITES}} sites in all; whether one may be placed depends on the room, the room level and the tile.',
            tasks: [
                'where can I place a construction site', 'why does createConstructionSite return ERR_INVALID_TARGET', 'how many construction sites can I have',
                'can I build next to an exit', 'what happens when a creep steps on a construction site', 'who can remove a construction site',
                'what does a road cost on swamp or through a wall', 'what does a new structure start with', 'does a new spawn start with energy', 'can two structures share a tile',
            ],
            facts: [
                // limit, rooms, counts
                L('At most {{MAX_CONSTRUCTION_SITES}} sites per player over all rooms, those placed earlier in the same tick included (ERR_FULL).',
                    eng(ROOMS, "if(_(runtimeData.userObjects).filter({type: 'constructionSite'}).size() + createdConstructionSites >= C.MAX_CONSTRUCTION_SITES) {")),
                L('Rooms: your own; rooms whose controller nobody owns and nobody else reserved; rooms without a controller. Never a room owned or reserved by another player (ERR_NOT_OWNER).',
                    eng(P + 'room/create-construction-site.js', 'if (roomController && (roomController.user && roomController.user != userId || roomController.reservation && roomController.reservation.user != userId)) {')),
                L('Count per type: the structures and sites of that type already in the room, whoever owns them, must be fewer than CONTROLLER_STRUCTURES allows at the room level (ERR_RCL_NOT_ENOUGH).',
                    eng(UTILS, "var structuresCnt = _(roomObjects).filter((i) => i.type == type || i.type == 'constructionSite' && i.structureType == type).size();")),
                L('A room without an owner counts as level 0: roads and {{CONTROLLER_STRUCTURES.container[0]}} containers, nothing else.', eng(UTILS, 'if(_.isObject(roomController) && roomController.level && (roomController.user || roomController.owner)) {')),
                // tile rules
                L('Tile: x and y from 1 to 48. Nothing on the outermost ring.', eng(UTILS, 'if(x <= 0 || y <= 0 || x >= 49 || y >= 49) {')),
                L('Tile: on the second ring (x or y equal to 1 or 48) only roads and containers, unless the three border tiles beside it are all wall. Everything else keeps two tiles away from an exit.',
                    eng(UTILS, "if(structureType != 'road' && structureType != 'container' && (x == 1 || x == 48 || y == 1 || y == 48)) {"), article('defense')),
                L('Tile: on wall terrain only roads and extractors.', eng(UTILS, "if(structureType != 'road' && exports.checkTerrain(objects, x, y, C.TERRAIN_MASK_WALL)) {")),
                L('Tile: one site at a time, and no second structure of the same type.', eng(UTILS, "if(_.any(objects, {x, y, type: 'constructionSite'})) {"), eng(UTILS, 'if(_.any(objects, {x, y, type: structureType})) {')),
                L('Tile: only roads and ramparts share. A road or rampart may go onto any structure; anything else needs a tile that holds no structure but roads and ramparts.', eng(UTILS, "if(structureType != 'rampart' && structureType != 'road' &&")),
                L('Tile: an extractor needs a mineral without an extractor.', eng(UTILS, "return _.any(objects, {x, y, type: 'mineral'}) && !_.any(objects, {x, y, type: 'extractor'});")),
                L('A broken tile rule returns ERR_INVALID_TARGET.', eng(ROOMS, 'if(!utils.checkConstructionSite(register.objectsByRoom[roomName], structureType, x, y) ||')),
                L('Creeps do not matter for placing. They matter for building: a site for a non-walkable structure cannot be built while a creep stands on it.',
                    eng(CREEPS, 'const blockingCreeps = (this.room.controller && this.room.controller.my && this.room.controller.safeMode) ? myCreepsInTile : creepsInTile;')),
                // cost
                L('Cost: CONSTRUCTION_COST of the type. A road costs ×{{CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} on swamp ({{CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_SWAMP_RATIO}}) and ×{{CONSTRUCTION_COST_ROAD_WALL_RATIO}} on a wall tile ({{CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_WALL_RATIO}}); the finished road has its hits and its decay multiplied the same way.',
                    eng(P + 'room/create-construction-site.js', 'progressTotal *= C.CONSTRUCTION_COST_ROAD_WALL_RATIO;'), eng(P + 'creeps/build.js', 'hits *= C.CONSTRUCTION_COST_ROAD_WALL_RATIO;'), eng(P + 'roads/tick.js', 'decayAmount *= C.CONSTRUCTION_COST_ROAD_WALL_RATIO;')),
                L('Placing costs no energy, only the 0.2 CPU of the intent, for each site.', eng(ROOMS, "intents.pushByName('room', 'createConstructionSite', intent);"), driver(RUNTIME, 'pushByName(id, name, data, maxLen) {')),
                // build, remove, step on
                L('Any creep may build any site: the processor only checks that the target is a site within range 3. 1 energy is 1 progress, {{BUILD_POWER}} per WORK part per tick.',
                    eng(P + 'creeps/build.js', "if(!target || target.type != 'constructionSite' ||"), eng(P + 'creeps/build.js', 'var buildPower =')),
                L('remove(): the owner of the site anywhere, the owner of the room on any site in it. With progress above 1, half of it (rounded down) drops as energy.',
                    eng(P + 'room/remove-construction-site.js', 'if(object.user != userId && !(roomController && roomController.user == userId)) return;'),
                    eng(P + 'room/remove-construction-site.js', "require('../_create-energy')(object.x, object.y, object.room, Math.floor(object.progress/2), 'energy', scope);")),
                L('A creep that moves onto a tile with another player\'s site removes the site, with the same half refund on the ground. Whose room it is makes no difference.', siteStomp),
                L('Exception: in a room under safe mode only the creeps of the room owner do that.', siteStompSafeMode),
                L('Your own site for a non-walkable structure blocks your own creeps. Such a site, anybody\'s, also keeps a new creep from leaving a spawn onto that tile.',
                    ownSiteBlocks, eng(P + 'spawns/_born-creep.js', "(i.type == 'constructionSite' && _.contains(C.OBSTACLE_OBJECT_TYPES, i.structureType))  // unwalkable site")),
                L('Sites do not decay. A nuke landing in the room removes all of them.',
                    eng(P + 'construction-sites/tick.js', "if(!object || object.type != 'constructionSite') return;"),
                    eng(P + 'nukes/tick.js', "if(target.type == 'constructionSite' || target.type == 'energy' || target.type == 'tombstone' || target.type == 'ruin') {")),
                // the finished structure
                L('The structure appears in the tick after the last progress point, owned by the owner of the site, with a new id.', eng(P + 'creeps/build.js', 'bulk.insert(newObject);'), eng(P + 'creeps/build.js', 'user: target.user,')),
                L('It starts empty: a built spawn has 0 energy, a tower 0. Only the first spawn a player places starts with {{SPAWN_ENERGY_START}}.', eng(P + 'creeps/build.js', 'store: {energy: 0},'), firstSpawn),
                L('It starts with full hits, except a rampart ({{RAMPART_HITS}}) and a wall ({{WALL_HITS}}).', eng(P + 'creeps/build.js', 'hits: C.RAMPART_HITS,'), eng(P + 'creeps/build.js', 'hits: C.WALL_HITS,')),
                L('Rampart, road and container have their first decay {{RAMPART_DECAY_TIME}}, {{ROAD_DECAY_TIME}} and {{CONTAINER_DECAY_TIME}} ticks after completion.',
                    eng(P + 'creeps/build.js', 'nextDecayTime: gameTime + C.RAMPART_DECAY_TIME'), eng(P + 'creeps/build.js', 'nextDecayTime: gameTime + C.ROAD_DECAY_TIME'), eng(P + 'creeps/build.js', 'nextDecayTime: gameTime + C.CONTAINER_DECAY_TIME')),
                L('An extension has capacity 0 in its first tick; after that the room level sets it.', eng(P + 'creeps/build.js', 'storeCapacityResource: {energy: 0},'), eng(P + 'extensions/tick.js', 'const storeCapacity = C.EXTENSION_ENERGY_CAPACITY[roomController.level] || 0;')),
                L('A nuker starts with its full cooldown of {{NUKER_COOLDOWN}} ticks.', eng(P + 'creeps/build.js', 'cooldownTime: gameTime + (config.ptr ? 100 : C.NUKER_COOLDOWN)')),
            ],
            pitfalls: [
                L('Structures left by a former owner count against your allowance: with their extensions standing you cannot place your own until you destroy them.',
                    eng(UTILS, "var structuresCnt = _(roomObjects).filter((i) => i.type == type || i.type == 'constructionSite' && i.structureType == type).size();")),
                L('Your creeps wipe an ally\'s sites by walking over them, in your room as anywhere: path around them.', siteStomp),
            ],
            tables: [
                C => ({
                    kind: 'levels',
                    title: 'Cost and number allowed by room level',
                    head: ['type', 'cost', 'no owner', '1', '2', '3', '4', '5', '6', '7', '8'],
                    rows: Object.keys(C.CONSTRUCTION_COST).map(t => [t, C.CONSTRUCTION_COST[t]].concat([0, 1, 2, 3, 4, 5, 6, 7, 8].map(l => (C.CONTROLLER_STRUCTURES[t] || {})[l] || 0))),
                    foot: 'Sites count like finished structures. "no owner": neutral and reserved rooms and rooms without a controller.',
                }),
                C => ({
                    title: 'Road by terrain',
                    head: ['tile', 'cost', 'hits', `decay per ${C.ROAD_DECAY_TIME} ticks`],
                    rows: [['plain', 1], ['swamp', C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO], ['wall (tunnel)', C.CONSTRUCTION_COST_ROAD_WALL_RATIO]]
                        .map(([name, f]) => [name, C.CONSTRUCTION_COST.road * f, C.ROAD_HITS * f, C.ROAD_DECAY_AMOUNT * f]),
                }),
            ],
            constants: ['MAX_CONSTRUCTION_SITES', 'CONSTRUCTION_COST', 'CONTROLLER_STRUCTURES', 'CONSTRUCTION_COST_ROAD_SWAMP_RATIO', 'CONSTRUCTION_COST_ROAD_WALL_RATIO', 'BUILD_POWER', 'SPAWN_ENERGY_START', 'RAMPART_HITS', 'WALL_HITS'],
            see: ['Room.createConstructionSite', 'Creep.build', 'ConstructionSite.remove', 'ConstructionSite', 'Game.constructionSites', 'mechanic:ownership', 'mechanic:controller', 'const:structures', 'recipe:bootstrap-a-room'],
            url: DOCS + 'api/#Room.createConstructionSite',
        },

        // ============================================================ body design
        {
            id: 'body-design',
            title: 'Body design: cost, weight, speed, part order',
            summary: 'A body is a list of 1 to {{MAX_CREEP_SIZE}} parts. Its cost is the sum of the parts, its speed follows from weight against MOVE parts, and the order of the list decides which parts are lost first.',
            tasks: [
                'how many MOVE parts does a creep need on roads', 'how many MOVE parts for swamp', 'design a creep body', 'how much does a body cost',
                'does body part order matter', 'where to put TOUGH parts in a body', 'largest creep I can spawn at each room level', 'how fast does a creep move', 'how many body parts can a creep have',
            ],
            facts: [
                L('Cost: the sum of BODYPART_COST over the parts. Spawn time: {{CREEP_SPAWN_TIME}} ticks per part. Hits: 100 per part.', eng(UTILS, 'result += C.BODYPART_COST[partType];'), eng(P + 'spawns/create-creep.js', 'hits: body.length * 100,')),
                L('Size: 1 to {{MAX_CREEP_SIZE}} parts, else ERR_INVALID_ARGS. The second limit is the energy capacity of the room, because the whole cost is paid at once.',
                    eng(STRUCT, 'if(!body || !_.isArray(body) || body.length === 0 || body.length > C.MAX_CREEP_SIZE) {'), eng(STRUCT, 'if(energyAvailable < utils.calcCreepCost(body)) {')),
                // weight and speed
                L('Weight: every part that is neither MOVE nor CARRY counts 1, destroyed parts included.', eng(P + 'movement.js', 'fatigue = _(object.body).filter((i) => i.type != C.MOVE && i.type != C.CARRY).size();')),
                L('CARRY parts weigh only as far as the load needs them: one per {{CARRY_CAPACITY}} carried (more per part when boosted). An empty hauler weighs nothing.', eng(P + 'movement.js', 'totalCarry -= Math.min(totalCarry, C.CARRY_CAPACITY * boost);')),
                L('A step adds weight × 1 fatigue onto a road, × 2 onto plain, × 10 onto swamp. The tile stepped onto decides, and a road on it wins over the terrain.',
                    eng(P + 'movement.js', 'var fatigueRate = 2;'), eng(P + 'movement.js', 'fatigueRate = 10;'), eng(P + 'movement.js', 'fatigueRate = 1;')),
                L('Each MOVE part with hits takes 2 fatigue off per tick, in the tick of the step too. Boosted: ×{{BOOSTS.move.ZO.fatigue}} (ZO), ×{{BOOSTS.move.ZHO2.fatigue}} (ZHO2), ×{{BOOSTS.move.XZHO2.fatigue}} (XZHO2).', moveRemovesFatigue),
                L('So ticks per tile = weight × step factor ÷ (2 × MOVE parts), rounded up, at least 1.', moveRemovesFatigue, eng(P + 'movement.js', 'fatigue *= fatigueRate;'), article('creeps')),
                L('One tile per tick needs MOVE = weight ÷ 2 on roads, = weight on plain, = 5 × weight on swamp.', article('creeps')),
                L('With fatigue above 0, or without a MOVE part that still has hits, a creep does not move unless another creep pulls it.', eng(P + 'movement.js', '(!!object._pulled || !object._oldFatigue && _.some(object.body, i => i.hits > 0 && i.type == C.MOVE));')),
                // order
                L('Damage empties the body from the first part of the list toward the last.', eng(P + 'creeps/_recalc-body.js', 'for(var i = object.body.length-1; i>=0; i--) {'), article('creeps')),
                L('A part with 0 hits does nothing: no work, no capacity, no fatigue removed. It still weighs.', eng(UTILS, 'if(!(i.hits || !withoutOldHits && i._oldHits) || i.type != bodyPartType) {')),
                L('So put first what may be lost (TOUGH, then the working parts) and last what must work to the end: MOVE to get away, HEAL to recover.', eng(P + 'creeps/_recalc-body.js', 'for(var i = object.body.length-1; i>=0; i--) {')),
                L('Boosted TOUGH reduces only the damage that arrives while the TOUGH part itself has hits, and damage runs through the parts from the front. TOUGH behind other parts protects nothing in front of it.', eng(P + 'creeps/tick.js', 'let bodyPartHitsEffective = bodyPart.hits / damageRatio;')),
                L('Lost CARRY parts lose their capacity at once and the overflow drops on the tile.',
                    eng(P + 'creeps/_recalc-body.js', "object.storeCapacity = utils.calcBodyEffectiveness(object.body, C.CARRY, 'capacity', C.CARRY_CAPACITY, true);"), eng(P + 'creeps/tick.js', "require('./_drop-resources-without-space')(object, scope);")),
                // the rest
                L('What a part type does scales with the parts of that type that still have hits; a boost multiplies single parts.', eng(UTILS, 'iPower *= C.BOOSTS[bodyPartType][i.boost][methodName];')),
                L('Life: {{CREEP_LIFE_TIME}} ticks. A body with any CLAIM part lives {{CREEP_CLAIM_LIFE_TIME}} and cannot be renewed.', lifeStarts, eng(P + 'spawns/renew-creep.js', 'if(_.filter(target.body, (i) => i.type == C.CLAIM).length > 0) {')),
            ],
            pitfalls: [
                L('A hauler sized for roads crawls off them: with MOVE = weight ÷ 2 it takes 2 ticks per plain tile and 10 per swamp tile when loaded.', eng(P + 'movement.js', 'fatigue *= fatigueRate;')),
                L('WORK, ATTACK, HEAL and the like always weigh; only CARRY gets lighter when empty. A miner with 5 WORK and 1 MOVE needs 5 ticks per plain tile.', eng(P + 'movement.js', 'fatigue = _(object.body).filter((i) => i.type != C.MOVE && i.type != C.CARRY).size();')),
            ],
            tables: [
                C => ({
                    title: 'MOVE parts for one tile per tick',
                    head: ['weight', 'on roads', 'on plain', 'on swamp'],
                    rows: [1, 2, 5, 10, 16, 25].map(w => [w].concat(['road', 'plain', 'swamp'].map(t => Math.ceil(w * STEP[t] / MOVE_REMOVES)))),
                    foot: `Weight = parts other than MOVE, with CARRY counted only when loaded. A body has at most ${C.MAX_CREEP_SIZE} parts in all, so the larger numbers cannot be built.`,
                }),
                () => ({
                    title: 'Ticks per tile by share of MOVE parts',
                    head: ['MOVE : weight', 'road', 'plain', 'swamp'],
                    rows: [[5, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]].map(([m, w]) => [`${m} : ${w}`].concat(['road', 'plain', 'swamp'].map(t => ticksPerTile(w, m, STEP[t])))),
                    foot: 'Rounded up for a body of exactly that ratio; larger bodies of the same ratio move the same.',
                }),
                C => ({
                    title: 'Example bodies',
                    head: ['use', 'body', 'parts', 'cost', 'spawn ticks', 'from RCL'],
                    rows: BODIES.map(([use, body]) => [use, bodyText(body), bodySize(body), bodyCost(C, body), bodySize(body) * C.CREEP_SPAWN_TIME, firstLevelFor(C, bodyCost(C, body))]),
                    foot: `"From RCL": the first room level whose spawns and extensions hold the cost (${[1, 2, 3, 4, 5, 6, 7, 8].map(l => num(spawnEnergy(C, l))).join(' / ')} at levels 1–8).`,
                }),
            ],
            constants: ['BODYPART_COST', 'MAX_CREEP_SIZE', 'CREEP_SPAWN_TIME', 'CARRY_CAPACITY', 'CREEP_LIFE_TIME', 'CREEP_CLAIM_LIFE_TIME', 'BOOSTS.move'],
            see: ['const:body-parts', 'mechanic:movement', 'mechanic:damage-and-healing', 'mechanic:spawning', 'StructureSpawn.spawnCreep', 'Creep.body', 'Creep.getActiveBodyparts', 'Room.energyCapacityAvailable', 'const:boosts'],
            url: DOCS + 'creeps.html',
        },

        // ============================================================ ramparts and walls
        {
            id: 'ramparts-and-walls',
            title: 'Ramparts and walls',
            summary: 'Both are built for {{CONSTRUCTION_COST.rampart}} energy with {{RAMPART_HITS}} hit and have to be repaired up. A rampart shields its tile and lets its owner through; a wall blocks everyone. Only ramparts decay.',
            tasks: [
                'what does a rampart protect', 'rampart max hits by room level', 'how much energy to repair a rampart to max', 'what happens to my ramparts when I lose the room',
                'rampart in a room that is not mine', 'do walls decay', 'can a wall be repaired in an unowned room', 'what does a public rampart allow',
                'difference between a wall and a rampart', 'how many hits does a new rampart have',
            ],
            facts: [
                // start and maximum
                L('A new rampart has {{RAMPART_HITS}} hit, a new wall {{WALL_HITS}}. Each costs {{CONSTRUCTION_COST.rampart}} energy to build, is allowed from room level 2, up to {{CONTROLLER_STRUCTURES.rampart[2]}} per room.',
                    eng(P + 'creeps/build.js', 'hits: C.RAMPART_HITS,'), eng(P + 'creeps/build.js', 'hits: C.WALL_HITS,')),
                L('Rampart maximum: by the level of the room, when the room is the rampart owner\'s: {{RAMPART_HITS_MAX[2]}} at level 2 up to {{RAMPART_HITS_MAX[8]}} at level 8. It is set anew every tick, so it follows a level change at once.', rampartHitsMax),
                L('Wall maximum: {{WALL_HITS_MAX}} in any room whose controller is at level 2 or more, whoever owns it. 0 below that.', wallHitsMax),
                // what a rampart protects
                L('attack, rangedAttack, dismantle and a tower shot aimed at anything on a rampart tile hit the rampart instead.',
                    rampartFirst, eng(P + 'creeps/dismantle.js', "var rampart = _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y});"), eng(P + 'towers/attack.js', "var rampart = _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y});")),
                L('rangedMassAttack leaves out everything on a rampart tile and damages the rampart itself.', eng(P + 'creeps/rangedMassAttack.js', "if(target.type != 'rampart' && _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y})) {")),
                L('The redirect asks neither whose rampart it is nor whose creep: an enemy standing on your public rampart is covered by it.', rampartFirst),
                L('Damage beyond the rampart\'s hits is lost; what stands under it takes nothing in that tick. A nuke is the exception: what the rampart cannot absorb reaches the tile.',
                    eng(P + 'creeps/attack.js', 'target = rampart;'), eng(P + 'nukes/tick.js', 'damage -= rampartHits;')),
                L('A melee attacker standing on a rampart takes no hit-back.', eng(P + '_damage.js', "if(attackType == C.EVENT_ATTACK_TYPE_MELEE && !_.any(roomObjects, {type: 'rampart', x: object.x, y: object.y})) {")),
                L('Creeps of other players cannot step onto a closed rampart; its owner\'s creeps can. A wall blocks everyone, the builder included.',
                    closedRampartBlocks, eng(P + 'movement.js', "i.type != 'creep' && i.type != 'powerCreep' && _.contains(C.OBSTACLE_OBJECT_TYPES, i.type) ||")),
                L('Other players cannot withdraw from a structure under a closed rampart.', eng(P + 'creeps/withdraw.js', 'if(object.user != target.user && _.any(roomObjects, i => i.type == C.STRUCTURE_RAMPART && i.user != object.user && !i.isPublic && i.x == target.x && i.y == target.y)) {')),
                // public
                L('setPublic(true) opens it for the creeps of other players, to walk through and to withdraw from what is under it. It goes on absorbing damage. A new rampart is closed.',
                    eng(P + 'ramparts/set-public.js', 'isPublic: !!intent.isPublic'), doc('StructureRampart.isPublic')),
                // decay
                L('A rampart loses {{RAMPART_DECAY_AMOUNT}} hits every {{RAMPART_DECAY_TIME}} ticks and is removed when that brings it to 0 or below. A wall has no decay.',
                    eng(P + 'ramparts/tick.js', 'object.hits -= C.RAMPART_DECAY_AMOUNT;'), eng(P + 'constructedWalls/tick.js', 'if(!object.decayTime) {')),
                L('A new rampart has its first decay after {{RAMPART_DECAY_TIME}} ticks. Without at least {{RAMPART_DECAY_AMOUNT + 1}} hits by then it is gone.',
                    eng(P + 'creeps/build.js', 'nextDecayTime: gameTime + C.RAMPART_DECAY_TIME'), eng(P + 'ramparts/tick.js', 'if(object.hits <= 0) {')),
                // repair
                L('A creep repairs {{REPAIR_POWER}} hits per WORK part per tick at {{REPAIR_COST}} energy per hit, range 3, never above hitsMax.', eng(P + 'creeps/repair.js', 'repairHitsMax = target.hitsMax - target.hits,')),
                L('Holding a rampart level costs {{RAMPART_DECAY_AMOUNT * REPAIR_COST}} energy per {{RAMPART_DECAY_TIME}} ticks; filling one to the level maximum costs hitsMax × {{REPAIR_COST}} (table).', eng(P + 'creeps/repair.js', 'repairCost = Math.min(object.store.energy, Math.ceil(repairEffect * C.REPAIR_COST)),')),
                L('A tower repairs {{TOWER_POWER_REPAIR}} hits up to range {{TOWER_OPTIMAL_RANGE}}, down to {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF)}} from range {{TOWER_FALLOFF_RANGE}}, for {{TOWER_ENERGY_COST}} energy: {{TOWER_POWER_REPAIR / TOWER_ENERGY_COST}} to {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF) / TOWER_ENERGY_COST}} hits per energy against a creep\'s {{1 / REPAIR_COST}}.',
                    eng(P + 'towers/repair.js', 'var amount = C.TOWER_POWER_REPAIR;')),
                // not your room
                L('In a room that is not its owner\'s (lost, unclaimed, never owned) and in a room below level 2 a rampart has hitsMax 0: repair does nothing and it decays until it is gone, about hits ÷ {{RAMPART_DECAY_AMOUNT}} × {{RAMPART_DECAY_TIME}} ticks.',
                    rampartHitsMax, repairNeedsHitsMax),
                L('Until then it works as before: it blocks other players and absorbs damage.', closedRampartBlocks, rampartFirst),
                L('The owner of a room can destroy() any rampart or wall in it, as long as no creep of another player is in the room.', eng(P + 'room/destroy-structure.js', "if(_.any(roomObjects, i => (i.type == 'creep' || i.type == 'powerCreep') && i.user != userId)) return;")),
                // walls, powers, placing
                L('A built wall has no owner: anyone may repair or dismantle it.', eng(P + 'creeps/build.js', "if (target.structureType == 'constructedWall') {")),
                L('Under PWR_FORTIFY a wall or rampart takes no damage from anything but a nuke. A rampart made by PWR_SHIELD disappears when the effect ends.',
                    eng(P + '_damage.js', 'const effect = _.find(target.effects, e => (e.power == C.PWR_FORTIFY || e.effect == C.EFFECT_INVULNERABILITY) && (e.endTime > gameTime));'), eng(P + 'ramparts/tick.js', 'var effect = _.find(object.effects, {power: C.PWR_SHIELD});')),
                L('Neither may be placed on the two outer rings of tiles next to an exit. A rampart may share its tile with any structure, a wall only with a road or a rampart.',
                    eng(UTILS, "if(structureType != 'road' && structureType != 'container' && (x == 1 || x == 48 || y == 1 || y == 48)) {"), eng(UTILS, "if(structureType != 'rampart' && structureType != 'road' &&")),
            ],
            pitfalls: [
                L('A rampart protects one tile. A creep or structure next to it is hit normally, and ranged attackers reach over it.', rampartFirst),
                L('Close your ramparts when hostiles are in the room: an open one lets them in and then shields them.', closedRampartBlocks, rampartFirst),
            ],
            tables: [
                C => ({
                    kind: 'levels',
                    title: 'Rampart numbers by room level',
                    head: ['RCL', 'max hits', 'energy to fill', 'WORK-ticks to fill', 'ticks from full to gone'],
                    rows: [2, 3, 4, 5, 6, 7, 8].map(l => [l, C.RAMPART_HITS_MAX[l], C.RAMPART_HITS_MAX[l] * C.REPAIR_COST, C.RAMPART_HITS_MAX[l] / C.REPAIR_POWER, Math.ceil(C.RAMPART_HITS_MAX[l] / C.RAMPART_DECAY_AMOUNT) * C.RAMPART_DECAY_TIME]),
                    foot: `A wall: ${num(C.WALL_HITS_MAX)} hits, ${num(C.WALL_HITS_MAX * C.REPAIR_COST)} energy to fill, no decay. "WORK-ticks": ticks for one unboosted WORK part. Last column: without any repair.`,
                }),
            ],
            constants: ['RAMPART_HITS', 'RAMPART_HITS_MAX', 'WALL_HITS', 'WALL_HITS_MAX', 'RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME', 'REPAIR_COST', 'REPAIR_POWER', 'CONSTRUCTION_COST.rampart', 'CONTROLLER_STRUCTURES.rampart'],
            see: ['StructureRampart', 'StructureWall', 'StructureRampart.setPublic', 'StructureRampart.ticksToDecay', 'Creep.repair', 'StructureTower.repair', 'Structure.hitsMax',
                'mechanic:decay', 'mechanic:damage-and-healing', 'mechanic:nukes', 'recipe:keep-ramparts-up', 'recipe:defend-a-room'],
            url: DOCS + 'defense.html',
        },
    ],

    extend: {
        // ============================================================ controller
        'mechanic:controller': {
            tasks: ['why does my controller not level up', 'does controller progress carry over to the next level'],
            facts: [
                L('A level-up needs two things in the same tick: enough progress, and a downgrade timer within {{CONTROLLER_DOWNGRADE_RESTORE}} ticks of its maximum. Until the timer is full, progress just keeps growing.', levelNeedsFullTimer, doc('StructureController.ticksToDowngrade')),
                L('Progress above the requirement is carried into the next level.', eng(P + 'creeps/upgradeController.js', 'target.progress = target.progress + boostedEffect - nextLevelProgress;')),
                L('The timer gains its {{CONTROLLER_DOWNGRADE_RESTORE}} ticks once per tick with an upgrade, whatever the energy: 1 energy every {{CONTROLLER_DOWNGRADE_RESTORE}} ticks holds it level.', eng(P + 'controllers/tick.js', 'object.downgradeTime + C.CONTROLLER_DOWNGRADE_RESTORE + 1,')),
                L('A newly claimed controller starts with a full timer: {{CONTROLLER_DOWNGRADE[1]}} ticks at level 1.', eng(P + 'controllers/tick.js', 'bulk.update(object, {downgradeTime: gameTime + C.CONTROLLER_DOWNGRADE[object.level] + 1});')),
                L('Falling to level 0 clears the owner, the progress, a running safe mode and its stock, and switches powers off. The structures stay.', eng(P + 'controllers/tick.js', 'object.user = null;')),
                L('The level 8 cap of {{CONTROLLER_MAX_UPGRADE_PER_TICK}} is on the energy spent by all creeps together. Boosts add progress on top; PWR_OPERATE_CONTROLLER raises the cap by {{POWER_INFO[PWR_OPERATE_CONTROLLER].effect[0]}} to {{POWER_INFO[PWR_OPERATE_CONTROLLER].effect[4]}}.',
                    eng(P + 'creeps/upgradeController.js', 'buildEffect = Math.min(buildEffect, limit - target._upgraded);'), eng(P + 'creeps/upgradeController.js', 'limit += C.POWER_INFO[C.PWR_OPERATE_CONTROLLER].effect[effect.level-1];')),
                L('GCL counts the boosted amount, at every level.', eng(P + 'creeps/upgradeController.js', "bulkUsers.inc(target.user, 'gcl', boostedEffect);")),
                L('A player who already owns {{GCL_NOVICE}} rooms cannot claim another one inside a novice area (ERR_FULL).', eng(CREEPS, 'if (controllersClaimed >= C.GCL_NOVICE && runtimeData.rooms[data(this.id).room].novice > Date.now()) {')),
            ],
            constants: ['GCL_NOVICE'],
            see: ['recipe:upgrade-at-level-8', 'recipe:bootstrap-a-room', 'mechanic:construction-sites', 'StructureController.progressTotal'],
        },

        // ============================================================ safe mode
        'mechanic:safe-mode': {
            tasks: ['does my first room start in safe mode', 'what stops me from activating safe mode'],
            facts: [
                L('Your first room starts in safe mode: placing the first spawn switches it on for 20000 ticks, without using the stock and without a cooldown.', backend('lib/game/api/game.js', 'safeMode: gameTime + 20000'), article('defense'), doc('StructureController')),
                L('An activation takes effect with the next tick; the stock drops by one at the same moment.', eng(P + 'controllers/tick.js', 'safeModeAvailable: object.safeModeAvailable - 1,')),
                L('attackController blocks activation for {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks: an attacker who reaches the controller first takes safe mode away.', eng(P + 'controllers/activateSafeMode.js', 'if(object.upgradeBlocked > gameTime) {')),
                L('The owner\'s melee creeps take no hit-back in their room while it is in safe mode.', eng(P + '_damage.js', 'if(roomController && roomController.user == object.user && roomController.safeMode > gameTime) {')),
                L('Other players\' creeps no longer remove construction sites by walking on them.', siteStompSafeMode),
                L('The owner can build non-walkable structures on tiles where hostile creeps stand.', eng(P + 'creeps/build.js', 'const blockingCreeps = mySafeMode ? myCreepsInTile : creepsInTile;')),
                L('The blocked calls return ERR_NO_BODYPART; withdraw returns ERR_NOT_OWNER.', eng(CREEPS, 'if(this.room.controller && !this.room.controller.my && this.room.controller.safeMode) {', 'engine: the check, first in withdraw, then in each blocked call')),
                L('Power creeps of other players cannot use enableRoom or usePower in the room.', doc('StructureController')),
                L('A nuke that ends a safe mode clears the cooldown as well.', eng(P + 'nukes/tick.js', 'safeModeCooldown: null')),
                L('The cooldown also starts when the controller loses a level or the room is unclaimed. There is none in novice areas.',
                    eng(P + 'controllers/tick.js', 'object.safeModeCooldown = roomInfo.novice > Date.now() ? null : gameTime + C.SAFE_MODE_COOLDOWN'), eng(P + 'controllers/unclaim.js', 'safeModeCooldown: roomInfo.novice > Date.now() ? null : gameTime + C.SAFE_MODE_COOLDOWN,')),
                L('Of several activateSafeMode calls in one tick only the last one is kept.', eng(STRUCT, "intents.remove(lastActivateSafeMode, 'activateSafeMode');")),
            ],
            see: ['recipe:defend-a-room', 'recipe:attack-a-room', 'StructureController.safeModeCooldown'],
        },

        // ============================================================ tower
        'mechanic:tower': {
            tasks: ['how much damage do six towers do', 'tower damage by room level'],
            facts: [
                L('A target on a rampart tile is replaced by the rampart: the shot damages the rampart, whoever owns it and whatever was aimed at.', eng(P + 'towers/attack.js', "var rampart = _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y});")),
                L('attack takes creeps, power creeps and structures; heal only creeps and power creeps; repair only structures that have a build cost.',
                    eng(P + 'towers/heal.js', "if(!target || target.type != 'creep' && target.type !== 'powerCreep') {"), eng(P + 'towers/repair.js', 'if(!target || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {')),
                L('A creep still inside a spawn can be neither shot nor healed.', eng(P + 'towers/attack.js', "if(target.type == 'creep' && target.spawning) {"), eng(P + 'towers/heal.js', 'if(target.spawning) {')),
                L('repair on a structure at full hits spends no energy, and neither does an action whose amount comes to 0.', eng(P + 'towers/repair.js', 'if(!target || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {'), eng(P + 'towers/attack.js', 'if(!amount) {')),
                L('Below {{TOWER_ENERGY_COST}} energy the three calls return ERR_NOT_ENOUGH_ENERGY.', eng(STRUCT, 'if(!data(this.id).store || (data(this.id).store.energy < C.TOWER_ENERGY_COST)) {')),
                L('attack, heal and repair are three intents: every call that returns OK costs 0.2 CPU, although one runs.', intentFee, towerOrder),
                L('Power effects multiply the amount before it is rounded down: PWR_OPERATE_TOWER ×{{POWER_INFO[PWR_OPERATE_TOWER].effect[0]}} to ×{{POWER_INFO[PWR_OPERATE_TOWER].effect[4]}}, PWR_DISRUPT_TOWER ×{{POWER_INFO[PWR_DISRUPT_TOWER].effect[0]}} to ×{{POWER_INFO[PWR_DISRUPT_TOWER].effect[4]}} by power level.',
                    eng(P + 'towers/attack.js', 'amount *= C.POWER_INFO[power].effect[effect.level-1];')),
            ],
            tables: [C => ({
                kind: 'levels',
                title: 'Towers by room level, all firing at one target',
                head: ['RCL', 'towers', `damage at range ≤ ${C.TOWER_OPTIMAL_RANGE}`, 'at 10', 'at 15', `at ≥ ${C.TOWER_FALLOFF_RANGE}`, 'energy per tick'],
                rows: [3, 4, 5, 6, 7, 8].map(l => {
                    const n = C.CONTROLLER_STRUCTURES.tower[l];
                    return [l, n].concat([C.TOWER_OPTIMAL_RANGE, 10, 15, C.TOWER_FALLOFF_RANGE].map(r => n * towerAt(C, C.TOWER_POWER_ATTACK, r)), [n * C.TOWER_ENERGY_COST]);
                }),
                foot: 'Each tower has its own range to the target; the sum is what the target takes before healing.',
            })],
            see: ['recipe:defend-a-room', 'recipe:attack-a-room', 'StructureTower.store'],
        },

        // ============================================================ damage and healing
        'mechanic:damage-and-healing': {
            facts: [
                L('The rampart redirect asks neither whose rampart it is nor whose creep: an enemy standing on your public rampart is covered by it.', rampartFirst),
                L('Damage beyond a rampart\'s hits is lost in that tick; only a nuke passes the rest on to the tile.', eng(P + 'creeps/attack.js', 'target = rampart;'), eng(P + 'nukes/tick.js', 'damage -= rampartHits;')),
                L('The rampart that spares a melee attacker the hit-back can be anyone\'s. There is no hit-back either for a creep that attacks in its own room during safe mode.',
                    eng(P + '_damage.js', "if(attackType == C.EVENT_ATTACK_TYPE_MELEE && !_.any(roomObjects, {type: 'rampart', x: object.x, y: object.y})) {"),
                    eng(P + '_damage.js', 'if(roomController && roomController.user == object.user && roomController.safeMode > gameTime) {')),
                L('Boosted TOUGH is worked off part by part from the front: unboosted parts in front of it take their damage in full first.', eng(P + 'creeps/tick.js', 'let bodyPartHitsEffective = bodyPart.hits / damageRatio;')),
                L('Destroyed parts still weigh, and destroyed MOVE parts remove no fatigue: a damaged creep slows down on both counts.',
                    eng(P + 'movement.js', 'fatigue = _(object.body).filter((i) => i.type != C.MOVE && i.type != C.CARRY).size();'), eng(P + 'creeps/tick.js', "const moves = utils.calcBodyEffectiveness(object.body, C.MOVE, 'fatigue', 1);")),
                L('Destroyed CARRY parts lose their capacity at once; what no longer fits falls on the tile.', eng(P + 'creeps/tick.js', "require('./_drop-resources-without-space')(object, scope);")),
                L('A creep still inside a spawn can be neither attacked nor healed.', eng(P + 'creeps/attack.js', "if(target.type == 'creep' && target.spawning) {"), eng(P + 'creeps/heal.js', '|| target.spawning) {')),
                L('Walls and ramparts under PWR_FORTIFY take no damage except from a nuke.', eng(P + '_damage.js', 'const effect = _.find(target.effects, e => (e.power == C.PWR_FORTIFY || e.effect == C.EFFECT_INVULNERABILITY) && (e.endTime > gameTime));')),
                L('A structure brought to 0 hits leaves a ruin holding its contents, unless a nuke destroyed it.', eng(P + 'structures/_destroy.js', 'ruin.store = object.store || {};'), eng(P + 'structures/_destroy.js', 'if(!attackType || attackType != C.EVENT_ATTACK_TYPE_NUKE) {')),
            ],
            see: ['mechanic:ramparts-and-walls', 'mechanic:body-design', 'recipe:attack-a-room', 'recipe:defend-a-room'],
        },

        // ============================================================ creep death
        'mechanic:creep-death': {
            facts: [
                L('"Full life" in the formula is {{CREEP_CLAIM_LIFE_TIME}} for a body with a CLAIM part and {{CREEP_LIFE_TIME}} otherwise.', eng(P + 'creeps/_die.js', 'var lifeTime = _.any(object.body, {type: C.CLAIM}) ? C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME;')),
                L('Every part counts with its full price, damaged or destroyed alike. Each resource is rounded down.', eng(P + 'creeps/_die.js', 'C.BODYPART_COST[i.type] * lifeRate'), eng(P + 'creeps/_die.js', 'amount = Math.floor(amount);')),
                L('Parts priced above {{CREEP_PART_MAX_ENERGY}} never return more than that: RANGED_ATTACK, HEAL and CLAIM are capped.', eng(P + 'creeps/_die.js', 'C.CREEP_PART_MAX_ENERGY,')),
                L('A creep killed by a spawn that needed its tile dies like any killed creep and leaves a tombstone.', eng(P + 'spawns/_born-creep.js', "require('../creeps/_die')(hostileOccupied, undefined, true, scope);")),
                L('A creep still inside a spawn leaves nothing when the spawning is cancelled or the spawn is destroyed.',
                    eng(P + 'spawns/cancel-spawning.js', 'bulk.remove(spawningCreep._id);'), eng(P + 'structures/_destroy.js', 'bulk.remove(spawning._id);')),
            ],
            see: ['mechanic:spawning'],
        },

        // ============================================================ movement
        'mechanic:movement': {
            tasks: ['how many ticks per tile does my creep need'],
            facts: [
                L('To move at all a creep needs fatigue 0 and at least one MOVE part with hits, or a creep that pulls it.', eng(P + 'movement.js', '(!!object._pulled || !object._oldFatigue && _.some(object.body, i => i.hits > 0 && i.type == C.MOVE));')),
                L('CARRY parts weigh one per {{CARRY_CAPACITY}} carried: a half-loaded hauler weighs half.', eng(P + 'movement.js', 'totalCarry -= Math.min(totalCarry, C.CARRY_CAPACITY * boost);')),
                L('The tile stepped onto sets the factor, and a road on it wins: a swamp road and a tunnel cost 1 per weight.', eng(P + 'movement.js', 'fatigueRate = 1;')),
                L('MOVE parts take fatigue off in the tick of the step too, so ticks per tile = weight × factor ÷ (2 × MOVE parts), rounded up.', moveRemovesFatigue),
                L('Another player\'s construction site never blocks a tile, whatever it is for; only your own does.', ownSiteBlocks),
                L('In a room under safe mode only the owner\'s creeps remove foreign construction sites by stepping on them.', siteStompSafeMode),
                L('A move toward a tile with a non-walkable structure or a closed foreign rampart is dropped at once and makes no fatigue.', eng(P + 'creeps/move.js', 'if(!_.any(targetObjects, (target) => _.contains(C.OBSTACLE_OBJECT_TYPES, target.type) &&')),
            ],
            see: ['mechanic:body-design', 'mechanic:construction-sites', 'mechanic:ramparts-and-walls'],
        },

        // ============================================================ simultaneous actions
        'mechanic:simultaneous-actions': {
            facts: [
                L('The 0.2 CPU is charged per object and method name: the same method twice in a tick costs it once, and an action that is dropped later still cost its own.', intentFee),
                L('The dropping happens in the processor, after your script has ended: no return code shows it.', eng(P + 'creeps/intents.js', 'return intents[name] && (!priorities[name] || !_.any(priorities[name], i => !!intents[i]));')),
                L('A tower runs one of heal, repair, attack per tick, preferred in that order.', towerOrder),
                L('A spawn takes spawnCreep, renewCreep, recycleCreep, setDirections and cancel in that order within one tick. recycleCreep works while it spawns, renewCreep does not.',
                    eng(P + 'spawns/intents.js', 'if(objectIntents.renewCreep)'), eng(P + 'spawns/renew-creep.js', 'if(object.spawning) {')),
            ],
            see: ['mechanic:spawning', 'mechanic:tower'],
        },
    },
};
