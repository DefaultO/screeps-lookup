'use strict';
// Pack "structures": own text for Creep, ConstructionSite, Structure, OwnedStructure, the controller,
// spawn, extension, tower, rampart, road, wall and observer entries.
// Members that had no own text get a summary and tasks; the others only get sourced additions.
const { L, eng, backend, driver, doc } = require('../../_h');

const CREEPS = 'src/game/creeps.js';
const STRUCT = 'src/game/structures.js';
const SITES = 'src/game/construction-sites.js';
const ROOMS = 'src/game/rooms.js';
const STORE = 'src/game/store.js';
const UTILS = 'src/utils.js';
const P = 'src/processor/intents/';
const RUNTIME = 'lib/runtime/runtime.js';

// A store that holds one resource only answers null when asked without naming the resource.
const storeNull = L('getCapacity() and getFreeCapacity() without a resource return null for this store; pass RESOURCE_ENERGY.',
    eng(STORE, 'return object.storeCapacityResource ? null : object.storeCapacity || null;'),
    eng(STORE, 'if(utils.capacityForResource(object, resource) === 0) {'));

const rampartHitsMax = eng(P + 'ramparts/tick.js', 'var hitsMax = object.user == roomController.user ? C.RAMPART_HITS_MAX[roomController.level] || 0 : 0;');
const wallHitsMax = eng(P + 'constructedWalls/tick.js', 'var hitsMax = C.CONTROLLER_STRUCTURES.constructedWall[roomController.level] ? C.WALL_HITS_MAX : 0;');
const rampartFirst = eng(P + 'creeps/attack.js', "var rampart = _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y});");
const levelNeedsFullTimer = eng(P + 'creeps/upgradeController.js', 'target.downgradeTime + C.CONTROLLER_DOWNGRADE_RESTORE >= gameTime + C.CONTROLLER_DOWNGRADE[target.level]) {');

module.exports = {
    // ---------------------------------------------------------------- Creep
    Creep: {
        notes: [
            L('Every body part has 100 hits, whatever its type; hitsMax is 100 × the number of parts.', eng(P + 'spawns/create-creep.js', 'hitsMax: body.length * 100,')),
            L('The life time is counted from the first tick outside the spawn, not from the spawnCreep call.', eng(P + 'creeps/tick.js', 'object.ageTime = gameTime + (_.any(object.body, {type: C.CLAIM}) ? C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME);')),
        ],
        see: ['mechanic:body-design', 'mechanic:spawning'],
    },
    'Creep.hitsMax': {
        summary: 'Full hits of the creep: 100 per body part. Healing never goes above it.',
        tasks: ['max hits of a creep', 'how many hits does a creep have', 'is a creep at full health'],
        notes: [
            L('It does not change when parts are destroyed; hits falls, hitsMax stays.', eng(P + 'spawns/create-creep.js', 'hitsMax: body.length * 100,')),
            L('Healing above hitsMax is cut off at the end of the tick.', eng(P + 'creeps/tick.js', 'if(object.hits > object.hitsMax) {')),
        ],
        see: ['Creep.hits', 'Creep.body', 'mechanic:body-design', 'mechanic:damage-and-healing'],
    },
    'Creep.id': {
        summary: 'Unique id of the creep, for Game.getObjectById. A creep ordered this tick has no id until the next tick.',
        tasks: ['id of a creep', 'get a creep by id', 'keep a creep in memory'],
        pitfalls: [
            L('The object that spawnCreep puts into Game.creeps in the same tick has no id yet; use the name until the next tick.', eng(STRUCT, 'globals.Game.creeps[name] = new globals.Creep();', 'engine: created without an id (the same line is in spawnCreep)')),
        ],
        see: ['Game.getObjectById', 'Creep.name', 'Game.creeps'],
    },
    'Creep.name': {
        summary: 'Name given in spawnCreep: the key of the creep in Game.creeps and in Memory.creeps.',
        tasks: ['name of a creep', 'find a creep by name', 'rename a creep'],
        pitfalls: [
            L('It cannot be changed after spawning.', doc('Creep.name')),
            L('If two of your creeps ever carry the same name, the second one found is made to suicide.', eng('src/game/game.js', 'register.creeps[i].suicide();')),
        ],
        notes: [
            L('At most 100 characters.', doc('StructureSpawn.spawnCreep')),
            L('Memory.creeps[name] outlives the creep and is picked up by the next creep spawned under that name, unless opts.memory replaces it.', eng(STRUCT, 'globals.Memory.creeps[name] = options.memory || globals.Memory.creeps[name] || {};')),
        ],
        see: ['StructureSpawn.spawnCreep', 'Game.creeps', 'Creep.memory'],
    },
    'Creep.saying': {
        summary: 'Text the creep said with say() in the previous tick. For another player\'s creep only when it was said publicly.',
        tasks: ['read what a creep said', 'see what another creep is saying', 'creep speech bubble text'],
        notes: [
            L('The text is cut to 10 characters.', eng(P + 'creeps/say.js', 'message: intent.message.substring(0,10),')),
            L('Undefined when nothing was said, or when a foreign creep said it without the public flag.', eng(CREEPS, 'return o.actionLog.say.isPublic ? o.actionLog.say.message : undefined;')),
        ],
        see: ['Creep.say'],
    },
    'Creep.spawning': {
        notes: [
            L('The creep sits on the spawn\'s own tile until it is put on a free neighbouring tile.', eng(P + 'spawns/create-creep.js', 'x: spawn.x,')),
            L('If the spawn is destroyed meanwhile, the creep inside is removed with it.', eng(P + 'structures/_destroy.js', 'const spawning = _.find(roomObjects, {user: object.user, name: object.spawning.name});')),
        ],
        see: ['mechanic:spawning'],
    },
    'Creep.ticksToLive': {
        notes: [
            L('The creep dies at the end of the tick in which ticksToLive is 1; it still acts in that tick.', eng(P + 'creeps/tick.js', 'if(gameTime >= object.ageTime-1) {')),
            L('Spawn time is not taken off: the count starts at {{CREEP_LIFE_TIME}} ({{CREEP_CLAIM_LIFE_TIME}} with CLAIM) in the first tick outside the spawn.', eng(P + 'creeps/tick.js', 'object.ageTime = gameTime + (_.any(object.body, {type: C.CLAIM}) ? C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME);')),
        ],
        see: ['mechanic:spawning'],
    },
    'Creep.getActiveBodyparts': {
        notes: [
            L('It counts from the back of the body and stops at the first part with 0 hits, because damage empties parts from the front.', eng(CREEPS, 'if (body[i].hits <= 0)')),
        ],
        see: ['mechanic:body-design'],
    },
    'Creep.build': {
        pitfalls: [
            L('While your room is in safe mode, a hostile creep standing on the site does not block the build; your own creeps still do.', eng(P + 'creeps/build.js', 'const blockingCreeps = mySafeMode ? myCreepsInTile : creepsInTile;')),
            L('A site on wall terrain can only be finished as a road or an extractor.', eng(P + 'creeps/build.js', "if(target.structureType != 'extractor' && target.structureType != 'road' &&")),
        ],
        notes: [
            L('Energy spent per tick: the smallest of WORK parts × {{BUILD_POWER}}, the energy carried and the progress still missing.', eng(P + 'creeps/build.js', 'buildEffect = Math.min(buildPower, buildRemaining, object.store.energy),')),
            L('The structure belongs to the owner of the site, not to the builder, and is a new object with a new id.', eng(P + 'creeps/build.js', 'user: target.user,'), eng(P + 'creeps/build.js', 'bulk.insert(newObject);')),
        ],
        see: ['mechanic:construction-sites'],
    },
    'Creep.repair': {
        pitfalls: [
            L('Nothing can be repaired above hitsMax, and hitsMax is 0 for a rampart in a room its owner does not control and for a wall in a room below level 2.',
                eng(P + 'creeps/repair.js', 'if(!target || !target.hitsMax || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {'), rampartHitsMax, wallHitsMax),
        ],
        notes: [
            L('Hits per tick: the smallest of WORK parts × {{REPAIR_POWER}}, energy carried × {{1 / REPAIR_COST}} and the hits missing. The energy taken is those hits × {{REPAIR_COST}}, rounded up.',
                eng(P + 'creeps/repair.js', 'repairCost = Math.min(object.store.energy, Math.ceil(repairEffect * C.REPAIR_COST)),')),
        ],
        see: ['mechanic:ramparts-and-walls', 'recipe:keep-ramparts-up'],
    },
    'Creep.dismantle': {
        notes: [
            L('Hits removed per tick: the smaller of the creep\'s dismantle power and the hits the target has left; the energy gained is that × {{DISMANTLE_COST}}, rounded down.',
                eng(P + 'creeps/dismantle.js', 'energyGain = Math.floor(amount * C.DISMANTLE_COST);')),
            L('A wall or rampart under PWR_FORTIFY or PWR_SHIELD gives no energy.', eng(P + 'creeps/dismantle.js', 'energyGain = 0;')),
        ],
        see: ['recipe:attack-a-room', 'mechanic:ramparts-and-walls'],
    },
    'Creep.upgradeController': {
        pitfalls: [
            L('The level only rises while the downgrade timer is within {{CONTROLLER_DOWNGRADE_RESTORE}} ticks of its maximum. Until then progress keeps growing past progressTotal.',
                levelNeedsFullTimer, doc('StructureController.ticksToDowngrade')),
        ],
        notes: [
            L('The level 8 cap counts energy spent, so boosts come on top: {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy with XGH2O is {{CONTROLLER_MAX_UPGRADE_PER_TICK * BOOSTS.work.XGH2O.upgradeController}} points per tick.',
                eng(P + 'creeps/upgradeController.js', 'target._upgraded += buildEffect;')),
            L('GCL gets the boosted amount.', eng(P + 'creeps/upgradeController.js', "bulkUsers.inc(target.user, 'gcl', boostedEffect);")),
        ],
        see: ['recipe:upgrade-at-level-8'],
    },
    'Creep.attackController': {
        notes: [
            L('While the controller is upgrade-blocked its owner cannot start safe mode either.', eng(P + 'controllers/activateSafeMode.js', 'if(object.upgradeBlocked > gameTime) {')),
            L('The owner cannot upgrade during the block, so the downgrade timer also runs down by itself for those {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks.',
                eng(P + 'creeps/upgradeController.js', 'if(target.upgradeBlocked && target.upgradeBlocked > gameTime) {')),
        ],
        see: ['recipe:attack-a-room'],
    },

    // ---------------------------------------------------------------- ConstructionSite
    ConstructionSite: {
        notes: [
            L('A site does not decay or time out: the engine does nothing to it from tick to tick.', eng(P + 'construction-sites/tick.js', "if(!object || object.type != 'constructionSite') return;")),
            L('A nuke that lands in the room removes every site in it.', eng(P + 'nukes/tick.js', "if(target.type == 'constructionSite' || target.type == 'energy' || target.type == 'tombstone' || target.type == 'ruin') {")),
        ],
        see: ['mechanic:construction-sites'],
    },
    'ConstructionSite.id': {
        summary: 'Unique id of the site, for Game.getObjectById and as key in Game.constructionSites. Available from the tick after the site was placed.',
        tasks: ['id of a construction site', 'get a construction site by id'],
        notes: [
            L('The finished structure is a new object with its own id; the site id stops resolving.', eng(P + 'creeps/build.js', 'bulk.insert(newObject);')),
        ],
        see: ['Game.constructionSites', 'Game.getObjectById', 'Room.createConstructionSite'],
    },
    'ConstructionSite.my': {
        summary: 'True when the site is yours.',
        tasks: ['is this construction site mine', 'find enemy construction sites'],
        notes: [
            L('Creep.build does not look at it: the processor only checks that the target is a site.', eng(P + 'creeps/build.js', "if(!target || target.type != 'constructionSite' ||")),
            L('Your own site for a non-walkable structure blocks your creeps; another player\'s site never blocks, and stepping on it removes it.',
                eng(P + 'movement.js', "i.type == 'constructionSite' && i.user == object.user && _.contains(C.OBSTACLE_OBJECT_TYPES,"),
                eng(P + 'movement.js', "var constructionSite = _.find(cellObjects, (i) => i.type == 'constructionSite' && i.user != object.user);")),
        ],
        see: ['ConstructionSite.owner', 'mechanic:construction-sites'],
    },
    'ConstructionSite.owner': {
        summary: '{username} of the player who placed the site.',
        tasks: ['who owns a construction site', 'who placed this site'],
        notes: [
            L('The finished structure belongs to this player, whoever built it.', eng(P + 'creeps/build.js', 'user: target.user,')),
        ],
        see: ['ConstructionSite.my'],
    },
    'ConstructionSite.progressTotal': {
        summary: 'Energy the site needs in total: the build cost of the structure, fixed when the site is placed.',
        tasks: ['cost of a construction site', 'how much energy does a site still need', 'energy left to finish building'],
        notes: [
            L('For a road the terrain is already in it: ×{{CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} on swamp, ×{{CONSTRUCTION_COST_ROAD_WALL_RATIO}} on a wall tile.', eng(P + 'room/create-construction-site.js', 'progressTotal *= C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO;')),
            L('Still to pay: progressTotal − progress. Boosted WORK parts add progress without spending more energy.', eng(P + 'creeps/build.js', 'var boostedEffect = Math.min(Math.floor(buildEffect + _.sum(boostedParts)), buildRemaining);')),
        ],
        constants: ['CONSTRUCTION_COST', 'CONSTRUCTION_COST_ROAD_SWAMP_RATIO', 'CONSTRUCTION_COST_ROAD_WALL_RATIO'],
        see: ['ConstructionSite.progress', 'Creep.build', 'const:structures', 'mechanic:construction-sites'],
    },
    'ConstructionSite.structureType': {
        summary: 'Which structure the site becomes: one of the STRUCTURE_* constants.',
        tasks: ['what is being built at a site', 'filter construction sites by type'],
        see: ['const:structures', 'Structure.structureType'],
    },
    'ConstructionSite.remove': {
        pitfalls: [
            L('Nothing comes back from a site with progress 0 or 1, and the half is rounded down.', eng(P + 'room/remove-construction-site.js', 'if(object.progress > 1) {')),
            L('ERR_NOT_OWNER for another player\'s site outside a room whose controller is yours.', eng(SITES, 'if(!this.my && !(this.room && this.room.controller && this.room.controller.my)) {')),
        ],
        see: ['mechanic:construction-sites'],
    },

    // ---------------------------------------------------------------- Structure, OwnedStructure
    'Structure.hitsMax': {
        summary: 'Hits the structure can be repaired up to. Fixed per type, except ramparts (by room level), walls (only from room level 2) and roads (by terrain).',
        tasks: ['max hits of a structure', 'how far can a structure be repaired', 'is a structure at full hits'],
        pitfalls: [
            L('0 for a rampart in a room its owner does not control, and for a wall in a room whose controller is below level 2 (unowned rooms included). Such a structure cannot be repaired.',
                rampartHitsMax, wallHitsMax, eng(P + 'creeps/repair.js', 'if(!target || !target.hitsMax || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {')),
        ],
        notes: [
            L('A road has {{ROAD_HITS}}, ×{{CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} on swamp ({{ROAD_HITS * CONSTRUCTION_COST_ROAD_SWAMP_RATIO}}) and ×{{CONSTRUCTION_COST_ROAD_WALL_RATIO}} on a wall tile ({{ROAD_HITS * CONSTRUCTION_COST_ROAD_WALL_RATIO}}).', eng(P + 'creeps/build.js', 'hits *= C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO;')),
            L('A rampart\'s value is set again every tick from the level of the room.', rampartHitsMax),
        ],
        constants: ['RAMPART_HITS_MAX', 'WALL_HITS_MAX', 'ROAD_HITS'],
        see: ['Structure.hits', 'Creep.repair', 'const:structures', 'mechanic:ramparts-and-walls'],
    },
    'Structure.id': {
        summary: 'Unique id of the structure, for Game.getObjectById. A structure gets it in the tick after its site is finished.',
        tasks: ['id of a structure', 'get a structure by id', 'keep a structure in memory'],
        notes: [
            L('It is not the id of the construction site it came from.', eng(P + 'creeps/build.js', 'bulk.insert(newObject);')),
        ],
        see: ['Game.getObjectById', 'Game.structures'],
    },
    'Structure.isActive': {
        notes: [
            L('Always true for structures without an owner: roads, containers, walls.', eng(STRUCT, 'if(!this.owner) {')),
            L('False for an owned structure of a buildable type when the room\'s controller belongs to someone else or is at level 0.', eng(UTILS, 'if(!roomController || roomController.level < 1 || roomController.user !== object.user) {')),
            L('The distance to the controller that decides it is the larger of dx and dy.', eng(UTILS, 'let objectDist = Math.max(Math.abs(object.x - roomController.x), Math.abs(object.y - roomController.y));')),
        ],
    },
    'Structure.notifyWhenAttacked': {
        pitfalls: [
            L('ERR_NOT_OWNER for a road, container or wall in a room whose controller another player owns.', eng(STRUCT, 'if(this.my === false || (this.room.controller && this.room.controller.owner && !this.room.controller.my)) {')),
        ],
        notes: [
            L('Every newly built structure starts with the notification switched on.', eng(P + 'creeps/build.js', 'notifyWhenAttacked: true')),
        ],
    },
    'OwnedStructure.owner': {
        notes: [
            L('Undefined for a structure nobody owns, such as the controller of a neutral room.', eng(STRUCT, 'owner: (o) => _.isUndefined(o.user) || o.user === null ? undefined : {')),
        ],
    },

    // ---------------------------------------------------------------- StructureController
    StructureController: {
        see: ['mechanic:safe-mode', 'recipe:upgrade-at-level-8', 'recipe:bootstrap-a-room'],
    },
    'StructureController.isPowerEnabled': {
        summary: 'True once a power creep has switched powers on in this room with enableRoom.',
        tasks: ['are powers enabled in this room', 'can power creeps use powers here'],
        notes: [
            L('Reset to false when the controller falls to level 0 or is unclaimed.', eng(P + 'controllers/tick.js', 'object.isPowerEnabled = false;'), eng(P + 'controllers/unclaim.js', 'isPowerEnabled: false,')),
        ],
        see: ['PowerCreep.enableRoom', 'PowerCreep.usePower'],
    },
    'StructureController.progressTotal': {
        summary: 'Energy the current level needs to reach the next one. Undefined at level 0 and at level 8.',
        tasks: ['energy needed for the next room level', 'how much progress is left on the controller', 'controller progress total'],
        pitfalls: [
            L('progress can be higher than progressTotal: the level only rises in a tick where the downgrade timer is full.', levelNeedsFullTimer, doc('StructureController.ticksToDowngrade')),
        ],
        notes: [
            L('Progress above the requirement is carried into the next level.', eng(P + 'creeps/upgradeController.js', 'target.progress = target.progress + boostedEffect - nextLevelProgress;')),
        ],
        constants: ['CONTROLLER_LEVELS'],
        see: ['StructureController.progress', 'StructureController.level', 'mechanic:controller', 'const:controller'],
        engine: [{ file: STRUCT, find: 'progressTotal: (o) => o.level > 0 && o.level < 8 ? C.CONTROLLER_LEVELS[o.level] : undefined,', label: 'engine: undefined at level 0 and 8' }],
    },
    'StructureController.progress': {
        notes: [
            L('Undefined at level 0.', eng(STRUCT, 'progress: (o) => o.level > 0 ? o.progress : undefined,')),
            L('At level 8 it stays 0: the energy still counts for GCL but no longer for the room.', eng(P + 'creeps/upgradeController.js', 'if(target.level < 8) {')),
        ],
    },
    'StructureController.ticksToDowngrade': {
        notes: [
            L('A tick with an upgrade adds {{CONTROLLER_DOWNGRADE_RESTORE}} ticks once, however many creeps upgrade and however little energy they spend.', eng(P + 'controllers/tick.js', 'object.downgradeTime + C.CONTROLLER_DOWNGRADE_RESTORE + 1,')),
            L('After a level-up and after a downgrade it starts at half of the new level\'s maximum.',
                eng(P + 'creeps/upgradeController.js', 'target.downgradeTime = gameTime + C.CONTROLLER_DOWNGRADE[target.level]/2;'),
                eng(P + 'controllers/tick.js', 'object.downgradeTime += C.CONTROLLER_DOWNGRADE[object.level]/2 + 1;')),
            L('You get a notification 3000 ticks before the level is lost.', eng(P + 'controllers/tick.js', 'if(gameTime == object.downgradeTime-3000) {')),
        ],
        see: ['recipe:upgrade-at-level-8'],
    },
    'StructureController.upgradeBlocked': {
        notes: [
            L('While it runs, activateSafeMode returns ERR_TIRED.', eng(STRUCT, 'if(this.safeModeCooldown || this.upgradeBlocked > 0 ||')),
            L('An attackController during the block is refused, so the block cannot be stacked.', eng(CREEPS, 'if(data(target.id).upgradeBlocked > runtimeData.time) {')),
        ],
    },
    'StructureController.safeModeCooldown': {
        notes: [
            L('It also starts when the controller loses a level, falls to level 0 or is unclaimed, so a newly claimed room can inherit it.',
                eng(P + 'controllers/tick.js', 'object.safeModeCooldown = roomInfo.novice > Date.now() ? null : gameTime + C.SAFE_MODE_COOLDOWN'),
                eng(P + 'controllers/unclaim.js', 'safeModeCooldown: roomInfo.novice > Date.now() ? null : gameTime + C.SAFE_MODE_COOLDOWN,'),
                eng(P + 'creeps/claimController.js', 'bulk.update(target, {', 'engine: a claim does not reset it')),
            L('No cooldown in a novice area.', eng(P + 'controllers/tick.js', 'safeModeCooldown: roomInfo.novice > Date.now() ? null : gameTime + C.SAFE_MODE_COOLDOWN')),
        ],
    },
    'StructureController.activateSafeMode': {
        pitfalls: [
            L('Called on two controllers in one tick, only the last call stays.', eng(STRUCT, "intents.remove(lastActivateSafeMode, 'activateSafeMode');")),
        ],
        notes: [
            L('Safe mode starts with the next tick; the stock drops by one at the same moment.', eng(P + 'controllers/tick.js', 'safeModeAvailable: object.safeModeAvailable - 1,')),
        ],
        see: ['recipe:defend-a-room'],
    },
    'StructureController.unclaim': {
        notes: [
            L('Level and progress go to 0, a running safe mode ends and the safe mode stock is emptied.', eng(P + 'controllers/unclaim.js', 'safeModeAvailable: 0,')),
        ],
    },
    'StructureController.sign': {
        notes: [
            L('A sign set by the server itself is shown instead of a player\'s sign, with the system user as author.', eng(STRUCT, 'username: C.SYSTEM_USERNAME,')),
        ],
    },

    // ---------------------------------------------------------------- StructureSpawn
    StructureSpawn: {
        notes: [
            L('The first spawn, placed by hand, starts with {{SPAWN_ENERGY_START}} energy. A spawn built from a construction site starts empty.',
                backend('lib/game/api/game.js', 'store: { energy: C.SPAWN_ENERGY_START },'), eng(P + 'creeps/build.js', 'store: {energy: 0},')),
            L('It refills itself only in a room whose controller you own.', eng(P + 'spawns/tick.js', 'if(!roomController || roomController.level < 1 || roomController.user != object.user) {')),
        ],
        constants: ['SPAWN_ENERGY_START'],
        see: ['mechanic:spawning', 'mechanic:body-design', 'recipe:bootstrap-a-room'],
    },
    'StructureSpawn.memory': {
        summary: 'Shortcut to Memory.spawns[spawn.name]. Reading it creates an empty object when there is none.',
        tasks: ['store data on a spawn', 'spawn memory', 'keep a spawn queue'],
        pitfalls: [
            L('Undefined for another player\'s spawn; assigning to it throws.', eng(STRUCT, 'Could not set other player')),
        ],
        see: ['Memory', 'mechanic:memory', 'StructureSpawn.name'],
        engine: [{ file: STRUCT, find: 'return globals.Memory.spawns[data(this.id).name] = globals.Memory.spawns[data(this.id).name] || {};', label: 'engine: keyed by spawn name' }],
    },
    'StructureSpawn.name': {
        summary: 'Name of the spawn: the key in Game.spawns and in Memory.spawns. Chosen when the site is placed.',
        tasks: ['name of a spawn', 'get a spawn by name', 'name a new spawn'],
        pitfalls: [
            L('It cannot be changed later.', doc('StructureSpawn.name')),
            L('createConstructionSite refuses a name that a spawn or spawn site you can see already has (ERR_INVALID_ARGS).', eng(ROOMS, "if(_.any(register.spawns, {name}) || _.any(register.constructionSites, {structureType: 'spawn', name})) {")),
        ],
        notes: [
            L('Pass it as the last argument of createConstructionSite(x, y, STRUCTURE_SPAWN, name). Without one the first free of "Spawn1", "Spawn2", … is taken.', eng(ROOMS, 'name = "Spawn" + cnt;')),
        ],
        see: ['Game.spawns', 'Room.createConstructionSite', 'StructureSpawn.memory'],
    },
    'StructureSpawn.store': {
        summary: 'Energy in the spawn: store[RESOURCE_ENERGY], at most {{SPAWN_ENERGY_CAPACITY}}. A spawn holds nothing else.',
        tasks: ['how much energy is in the spawn', 'is the spawn full', 'free capacity of a spawn'],
        pitfalls: [storeNull],
        constants: ['SPAWN_ENERGY_CAPACITY'],
        see: ['Store.getFreeCapacity', 'Room.energyAvailable', 'Creep.transfer', 'mechanic:spawning'],
        engine: [{ file: P + 'creeps/build.js', find: 'storeCapacityResource: {energy: C.SPAWN_ENERGY_CAPACITY},', label: 'engine: capacity for energy only' }],
    },
    'StructureSpawn.spawnCreep': {
        pitfalls: [
            L('An empty body and a body with an unknown part type return ERR_INVALID_ARGS too.', eng(STRUCT, 'if(!body || !_.isArray(body) || body.length === 0 || body.length > C.MAX_CREEP_SIZE) {'), eng(STRUCT, 'if(!_.contains(C.BODYPARTS_ALL, body[i]))', 'engine: part type check (the same line is in spawnCreep)')),
            L('Two spawns of one room in the same tick are both checked against the same energy. If the second can no longer be paid, its creep is not made although the call returned OK.', eng(P + 'spawns/_charge-energy.js', 'if(availableEnergy < cost) {')),
            L('In the tick of a successful spawnCreep the spawn does not read as busy yet. A second spawnCreep on the same spawn returns OK as well and replaces the first order; the first name keeps its Memory.creeps entry.',
                eng(STRUCT, "intents.set(this.id, 'createCreep', {name, body, energyStructures, directions});"), driver(RUNTIME, 'this.list[id][name] = data;')),
            L('ERR_RCL_NOT_ENOUGH on an inactive spawn: the room has more spawns than its level allows and this one is farther from the controller.', eng(STRUCT, 'if(data(this.id).off) {'), eng(P + '_calc_spawns.js', 'spawns.sort(utils.comparatorDistance(roomController));')),
        ],
        notes: [
            L('Memory.creeps[name] is written as soon as the call returns OK: opts.memory, or else whatever was stored under that name before.', eng(STRUCT, 'globals.Memory.creeps[name] = options.memory || globals.Memory.creeps[name] || {};')),
            L('opts.directions: the creep leaves in the first free direction of the list, tried in the order given. Without it all eight are tried, TOP first, clockwise.', eng(P + 'spawns/_born-creep.js', 'var directions = [1,2,3,4,5,6,7,8];')),
            L('opts.energyStructures: entries that are not active spawns or extensions of yours are skipped without an error, and a structure listed twice pays once.',
                eng(P + 'spawns/_charge-energy.js', "(energyStructure.type === 'spawn' || energyStructure.type === 'extension');"), eng(P + 'spawns/_charge-energy.js', 'energyStructures = _.uniq(energyStructures);')),
        ],
        see: ['mechanic:spawning', 'mechanic:body-design'],
    },
    'StructureSpawn.renewCreep': {
        pitfalls: [
            L('The refusal for a CLAIM creep comes as ERR_INVALID_TARGET, the same code as for a creep that is still spawning.', eng(STRUCT, 'if(!target || !target.id || !register.creeps[target.id] || !(target instanceof globals.Creep) || target.spawning || _.any(target.body, {type: C.CLAIM})) {')),
            L('When boosts are stripped the carry capacity shrinks, and what no longer fits is dropped.', eng(P + 'spawns/renew-creep.js', "require('../creeps/_drop-resources-without-space')(target, scope);")),
        ],
        notes: [
            L('The energy is taken like for a spawnCreep without energyStructures: spawns first, then extensions, nearest first.', eng(P + 'spawns/renew-creep.js', "var result = require('./_charge-energy')(object, cost, undefined, scope);")),
            L('One renew per spawn per tick: a second call replaces the first.', driver(RUNTIME, 'this.list[id][name] = data;')),
        ],
        see: ['mechanic:spawning'],
    },
    'StructureSpawn.recycleCreep': {
        notes: [
            L('The refund is rounded down per resource. Damaged parts are refunded like intact ones.', eng(P + 'creeps/_die.js', 'amount = Math.floor(amount);')),
        ],
        see: ['mechanic:spawning'],
    },
    'StructureSpawn.spawning': {
        notes: [
            L('It stays set, with remainingTime 0, while no exit tile is free.', eng(P + 'spawns/tick.js', 'bulk.update(object, {spawning: {spawnTime: 1+gameTime}});')),
        ],
        see: ['mechanic:spawning'],
    },

    // ---------------------------------------------------------------- StructureSpawn.Spawning
    'StructureSpawn.Spawning': {
        tasks: ['what is the spawn making right now'],
        see: ['mechanic:spawning', 'StructureSpawn.Spawning.remainingTime'],
    },
    'StructureSpawn.Spawning.directions': {
        summary: 'Directions the new creep may leave in, from opts.directions or setDirections. Undefined when none were set: then all eight are tried, TOP first, clockwise.',
        tasks: ['which way will the creep leave the spawn', 'spawn exit directions', 'read the spawn directions'],
        see: ['StructureSpawn.Spawning.setDirections', 'mechanic:spawning', 'const:directions'],
        engine: [{ file: P + 'spawns/_born-creep.js', find: 'directions = spawn.spawning.directions;', label: 'engine: the list is tried in order' }],
    },
    'StructureSpawn.Spawning.name': {
        summary: 'Name of the creep being spawned. Game.creeps[name] is that creep, with spawning true.',
        tasks: ['which creep is the spawn making', 'name of the creep being spawned'],
        see: ['StructureSpawn.spawning', 'Creep.spawning'],
    },
    'StructureSpawn.Spawning.needTime': {
        summary: 'Ticks this spawning takes in total: {{CREEP_SPAWN_TIME}} per body part.',
        tasks: ['how long does this creep take to spawn', 'total spawn time of a creep'],
        notes: [
            L('An active PWR_OPERATE_SPAWN multiplies it by {{POWER_INFO[PWR_OPERATE_SPAWN].effect[0]}} to {{POWER_INFO[PWR_OPERATE_SPAWN].effect[4]}} (power level 1 to 5), rounded up. It is fixed when the spawning starts.',
                eng(P + 'spawns/create-creep.js', 'needTime = Math.ceil(needTime * C.POWER_INFO[C.PWR_OPERATE_SPAWN].effect[effect.level-1]);')),
        ],
        constants: ['CREEP_SPAWN_TIME'],
        see: ['StructureSpawn.Spawning.remainingTime', 'mechanic:spawning'],
        engine: [{ file: P + 'spawns/create-creep.js', find: 'var needTime = C.CREEP_SPAWN_TIME * intent.body.length;', label: 'engine: spawn time' }],
    },
    'StructureSpawn.Spawning.spawn': {
        summary: 'The spawn this Spawning object belongs to.',
        tasks: ['get the spawn from a spawning object'],
        notes: [
            L('The property is not enumerable: it is left out of JSON.stringify and for…in.', eng(STRUCT, "Object.defineProperty(this, 'spawn', {")),
        ],
        see: ['StructureSpawn.spawning'],
    },
    'StructureSpawn.Spawning.remainingTime': {
        notes: [
            L('0 means the creep is ready but no exit tile is free; the spawn tries again every tick.', eng(P + 'spawns/tick.js', 'bulk.update(object, {spawning: {spawnTime: 1+gameTime}});')),
            L('PWR_DISRUPT_SPAWN holds it still: the end moves one tick later for every tick the effect lasts.', eng(P + 'spawns/tick.js', 'bulk.update(object, {spawning: {spawnTime: 1+object.spawning.spawnTime}});')),
        ],
        see: ['mechanic:spawning'],
    },
    'StructureSpawn.Spawning.cancel': {
        notes: [
            L('The creep inside is removed without a tombstone.', eng(P + 'spawns/cancel-spawning.js', 'bulk.remove(spawningCreep._id);')),
        ],
        see: ['mechanic:spawning'],
    },
    'StructureSpawn.Spawning.setDirections': {
        pitfalls: [
            L('ERR_INVALID_ARGS for an empty list or any value that is not a whole number from 1 to 8.', eng(STRUCT, 'if(!_.any(directions, (direction)=>direction < 1 || direction > 8 || direction !== (direction | 0))) {')),
        ],
        notes: [
            L('It replaces the list for the creep now inside; the list in force when the time is up decides.', eng(P + 'spawns/set-spawn-directions.js', 'spawning.directions = directions;')),
        ],
        see: ['mechanic:spawning'],
    },

    // ---------------------------------------------------------------- StructureExtension
    StructureExtension: {
        notes: [
            L('Any spawn of the room can draw on any extension, at any distance.', doc('StructureExtension')),
            L('With more extensions than the room level allows, those farthest from the controller are switched off and their energy does not count for spawning.',
                eng(P + '_calc_spawns.js', 'extensions.sort(utils.comparatorDistance(roomController));'),
                eng(P + 'spawns/_charge-energy.js', "var extensions = _.filter(roomObjects, i => i.type == 'extension' && i.user == spawn.user && !i.off);")),
        ],
        see: ['mechanic:spawning', 'StructureExtension.store'],
    },
    'StructureExtension.store': {
        summary: 'Energy in the extension: store[RESOURCE_ENERGY]. The capacity follows the room level: {{EXTENSION_ENERGY_CAPACITY[2]}} up to level 6, {{EXTENSION_ENERGY_CAPACITY[7]}} at 7, {{EXTENSION_ENERGY_CAPACITY[8]}} at 8.',
        tasks: ['how much energy is in an extension', 'is an extension full', 'find extensions that need energy'],
        pitfalls: [storeNull],
        notes: [
            L('The capacity is set every tick from the level of the room\'s controller.', eng(P + 'extensions/tick.js', 'const storeCapacity = C.EXTENSION_ENERGY_CAPACITY[roomController.level] || 0;')),
            L('A freshly built extension has capacity 0 during its first tick.', eng(P + 'creeps/build.js', 'storeCapacityResource: {energy: 0},')),
        ],
        constants: ['EXTENSION_ENERGY_CAPACITY'],
        see: ['Store.getFreeCapacity', 'Room.energyAvailable', 'Creep.transfer', 'StructureExtension'],
    },

    // ---------------------------------------------------------------- StructureTower
    StructureTower: {
        see: ['recipe:defend-a-room', 'recipe:attack-a-room', 'StructureTower.store'],
    },
    'StructureTower.store': {
        summary: 'Energy in the tower: store[RESOURCE_ENERGY], at most {{TOWER_CAPACITY}}. Every action takes {{TOWER_ENERGY_COST}}.',
        tasks: ['how much energy is in a tower', 'does a tower need energy', 'find towers to refill'],
        pitfalls: [
            storeNull,
            L('Below {{TOWER_ENERGY_COST}} energy attack, heal and repair return ERR_NOT_ENOUGH_ENERGY.', eng(STRUCT, 'if(!data(this.id).store || (data(this.id).store.energy < C.TOWER_ENERGY_COST)) {')),
        ],
        notes: [
            L('A newly built tower is empty.', eng(P + 'creeps/build.js', 'storeCapacityResource: {energy: C.TOWER_CAPACITY},')),
        ],
        constants: ['TOWER_CAPACITY', 'TOWER_ENERGY_COST'],
        see: ['Store.getFreeCapacity', 'Creep.transfer', 'mechanic:tower', 'recipe:tower-logic'],
    },
    'StructureTower.attack': {
        pitfalls: [
            L('Each of attack, heal and repair that returns OK costs its own 0.2 CPU, the ones that then do not run included.', driver(RUNTIME, 'if (!freeMethods[name] && !this.list[id][name]) {'), eng(P + 'towers/intents.js', 'else if(objectIntents.repair)')),
            L('A creep still inside a spawn cannot be hit.', eng(P + 'towers/attack.js', "if(target.type == 'creep' && target.spawning) {")),
        ],
        notes: [
            L('Power creeps change the result before it is rounded down: PWR_OPERATE_TOWER ×{{POWER_INFO[PWR_OPERATE_TOWER].effect[0]}} to ×{{POWER_INFO[PWR_OPERATE_TOWER].effect[4]}}, PWR_DISRUPT_TOWER ×{{POWER_INFO[PWR_DISRUPT_TOWER].effect[0]}} to ×{{POWER_INFO[PWR_DISRUPT_TOWER].effect[4]}}.',
                eng(P + 'towers/attack.js', 'amount *= C.POWER_INFO[power].effect[effect.level-1];')),
        ],
        see: ['recipe:defend-a-room'],
    },
    'StructureTower.heal': {
        pitfalls: [
            L('Only creeps and power creeps can be healed, and not a creep that is still spawning.', eng(P + 'towers/heal.js', "if(!target || target.type != 'creep' && target.type !== 'powerCreep') {"), eng(P + 'towers/heal.js', 'if(target.spawning) {')),
        ],
        see: ['recipe:defend-a-room'],
    },
    'StructureTower.repair': {
        pitfalls: [
            L('On a structure at full hits nothing happens and no energy is spent, but the call returned OK and cost 0.2 CPU. Check hits < hitsMax first.', eng(P + 'towers/repair.js', 'if(!target || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {')),
        ],
        see: ['recipe:keep-ramparts-up', 'mechanic:ramparts-and-walls'],
    },

    // ---------------------------------------------------------------- rampart, road, wall
    StructureRampart: {
        pitfalls: [
            L('It covers whatever stands on its tile, not only your things: a hostile creep on your public rampart is shielded by it too.', rampartFirst),
            L('Damage beyond the rampart\'s remaining hits is lost and what is under it stays untouched in that tick. Only a nuke passes the rest on.', eng(P + 'creeps/attack.js', 'target = rampart;'), eng(P + 'nukes/tick.js', 'damage -= rampartHits;')),
        ],
        notes: [
            L('In a room that is not yours it goes on blocking and shielding until it has decayed away; it cannot be repaired there.', rampartHitsMax, eng(P + 'movement.js', "i.type == 'rampart' && !i.isPublic && i.user != object.user ||")),
        ],
        see: ['mechanic:ramparts-and-walls', 'recipe:keep-ramparts-up', 'recipe:defend-a-room'],
    },
    'StructureRampart.ticksToDecay': {
        summary: 'Ticks until the rampart next loses {{RAMPART_DECAY_AMOUNT}} hits. After each loss the timer restarts at {{RAMPART_DECAY_TIME}}.',
        tasks: ['when does a rampart decay', 'time until a rampart loses hits', 'will a rampart disappear soon'],
        pitfalls: [
            L('A rampart with {{RAMPART_DECAY_AMOUNT}} hits or fewer is gone at the next decay.', eng(P + 'ramparts/tick.js', 'if(object.hits <= 0) {')),
        ],
        notes: [
            L('A new rampart has its first decay {{RAMPART_DECAY_TIME}} ticks after it is built.', eng(P + 'creeps/build.js', 'nextDecayTime: gameTime + C.RAMPART_DECAY_TIME')),
        ],
        constants: ['RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME', 'RAMPART_HITS'],
        see: ['StructureRampart', 'mechanic:decay', 'mechanic:ramparts-and-walls', 'recipe:keep-ramparts-up'],
    },
    'StructureRampart.setPublic': {
        pitfalls: [
            L('An open rampart still takes the hits for everything on its tile, the visitor included.', rampartFirst),
        ],
        notes: [
            L('It also lets other players withdraw from the structure under it.', eng(P + 'creeps/withdraw.js', 'if(object.user != target.user && _.any(roomObjects, i => i.type == C.STRUCTURE_RAMPART && i.user != object.user && !i.isPublic && i.x == target.x && i.y == target.y)) {')),
        ],
        see: ['mechanic:ramparts-and-walls'],
    },
    'StructureRampart.isPublic': {
        notes: [L('False for a new rampart.', doc('StructureRampart.isPublic'))],
    },
    StructureRoad: {
        notes: [
            L('The road sets the step cost whatever lies under it: a swamp road and a tunnel both make 1 fatigue per weight.', eng(P + 'movement.js', 'fatigueRate = 1;')),
            L('Roads and containers may stand on the tiles next to an exit, where nothing else may.', eng(UTILS, "if(structureType != 'road' && structureType != 'container' && (x == 1 || x == 48 || y == 1 || y == 48)) {")),
        ],
        see: ['mechanic:construction-sites', 'mechanic:body-design'],
    },
    StructureWall: {
        pitfalls: [
            L('hitsMax is 0 while the room\'s controller is below level 2, unowned rooms included: there a wall cannot be repaired.', wallHitsMax),
        ],
        notes: [
            L('The walls around novice and respawn areas cannot be destroyed and have no hits.', doc('StructureWall')),
        ],
        see: ['mechanic:ramparts-and-walls'],
    },

    // ---------------------------------------------------------------- observer
    'StructureObserver.observeRoom': {
        pitfalls: [
            L('The request lasts one tick: it is cleared every tick, so call it again for every tick you want to see the room.', eng('src/processor.js', 'object.observeRoom = null;')),
            L('ERR_INVALID_ARGS for anything that is not a room name such as W1N1.', eng(STRUCT, 'if(!_.isString(roomName) ||')),
        ],
        notes: [
            L('With an active PWR_OPERATE_OBSERVER effect the range limit does not apply.', eng(STRUCT, 'var effect = _.find(this.effects, i => i.power == C.PWR_OPERATE_OBSERVER);')),
        ],
    },
};
