'use strict';
// Own text for Room, RoomPosition, base objects, Store, PathFinder and visuals.
const { L, eng, backend, driver, doc, article, common } = require('./_h');
const ROOMS = 'src/game/rooms.js';
const STRUCT = 'src/game/structures.js';
const GAME = 'src/game/game.js';
const STORE = 'src/game/store.js';
const UTILS = 'src/utils.js';
const P = 'src/processor/intents/';
const PF = 'lib/path-finder.js';
const PFC = 'native/src/pf.cc';
const CONST = 'lib/constants.js';
const IGNORE_CREEPS = 'if(opts.ignoreCreeps || register.rooms[id].controller && register.rooms[id].controller.safeMode && register.rooms[id].controller.my) {';

module.exports = {
    Room: {
        summary: 'A 50×50 map tile you currently see. Game.rooms only holds rooms where you have a creep, a power creep, a structure or observer vision this tick.',
        tasks: ['which rooms can I see', 'room visibility'],
        see: ['Game.rooms', 'StructureObserver.observeRoom', 'Room.find'],
    },
    'Room.find': {
        summary: 'List objects of one kind in the room (FIND_* constant), optionally filtered.',
        tasks: ['find all creeps in a room', 'find hostile creeps', 'find structures of a type', 'find sources', 'find construction sites', 'find dropped resources', 'list my spawns', 'find exits'],
        pitfalls: [
            L('FIND_MY_STRUCTURES and FIND_HOSTILE_STRUCTURES only contain structures with an owner. Roads, containers and walls have none: use FIND_STRUCTURES for them.',
                eng(GAME, '[C.FIND_MY_STRUCTURES]: (i) =>'),
                eng(GAME, '[C.FIND_HOSTILE_STRUCTURES]: (i) =>'),
                eng(STRUCT, 'my: (o) => _.isUndefined(o.user) ? undefined : o.user == runtimeData.user._id')),
            L('FIND_HOSTILE_CREEPS contains every creep that is not yours: invaders, source keepers and allies too.',
                eng(GAME, '[C.FIND_HOSTILE_CREEPS]: (i) => !i.spawning && !i.my,')),
            L('The unfiltered list is cached per tick, the filter runs on every call. Filter once and keep the result.',
                eng(ROOMS, 'result = register.findCache[type][this.name];'),
                eng(ROOMS, 'result = _.filter(result, opts.filter);')),
            L('FIND_SOURCES_ACTIVE leaves out empty sources.',
                eng(GAME, '[C.FIND_SOURCES_ACTIVE]: (i) => i.energy > 0,')),
        ],
        constants: ['FIND_STRUCTURES', 'FIND_MY_STRUCTURES', 'FIND_HOSTILE_CREEPS', 'FIND_MY_CREEPS', 'FIND_SOURCES', 'FIND_SOURCES_ACTIVE', 'FIND_DROPPED_RESOURCES', 'FIND_CONSTRUCTION_SITES', 'FIND_TOMBSTONES', 'FIND_RUINS', 'FIND_MINERALS', 'FIND_DEPOSITS'],
        see: ['const:find', 'RoomPosition.findClosestByRange', 'RoomPosition.findInRange', 'Room.lookForAt', 'Game.getObjectById'],
    },
    'Room.lookAt': {
        summary: 'Everything on one tile, as {type, [type]: object} records.',
        tasks: ['what is on a tile', 'list objects at a position'],
        see: ['Room.lookForAt', 'RoomPosition.look', 'const:look'],
    },
    'Room.lookForAt': {
        summary: 'Objects of one kind (LOOK_* constant) on one tile.',
        tasks: ['is there a structure on this tile', 'is there a creep on this tile', 'get the terrain of a tile', 'find the container under a creep'],
        pitfalls: [
            L('Always returns an array. LOOK_TERRAIN gives ["plain"], ["swamp"] or ["wall"]; Room.getTerrain() is faster for terrain.',
                eng(ROOMS, 'return [result];'),
                eng(ROOMS, 'return _.clone(typeResult);'),
                doc('Room.getTerrain')),
        ],
        see: ['RoomPosition.lookFor', 'Room.lookForAtArea', 'Room.getTerrain', 'const:look'],
    },
    'Room.lookAtArea': {
        summary: 'Everything inside a rectangle (top, left, bottom, right), as a y→x map or a flat array.',
        tasks: ['scan an area of a room'],
        see: ['Room.lookForAtArea'],
    },
    'Room.lookForAtArea': {
        summary: 'Objects of one kind inside a rectangle. Arguments are top, left, bottom, right, then asArray.',
        tasks: ['find structures around a position', 'count free tiles around a source', 'scan terrain around a point'],
        pitfalls: [
            L('The order is (type, top, left, bottom, right): y before x. Pass true as the last argument to get a flat array.',
                eng(ROOMS, 'Room.prototype.lookForAtArea = register.wrapFn(function(type, top, left, bottom, right, asArray) {'),
                doc('Room.lookForAtArea')),
        ],
        see: ['RoomPosition.findInRange', 'Room.lookForAt'],
    },
    'Room.createConstructionSite': {
        summary: 'Place a construction site. Works in your rooms, in neutral rooms and in rooms you reserved.',
        tasks: ['place a construction site', 'plan a structure', 'build a road in a remote room', 'build a container in a room I do not own', 'can I build in another player\'s room', 'place a spawn'],
        pitfalls: [
            L('ERR_NOT_OWNER in a room owned or reserved by another player.',
                eng(ROOMS, 'if(this.controller && this.controller.level > 0 && !this.controller.my) {'),
                eng(ROOMS, '(register.objectsByRoom[this.name][this.controller.id].reservation.user != runtimeData.user._id)) {')),
            L('ERR_RCL_NOT_ENOUGH counts existing structures and sites of that type against the room level. Without your controller only roads and {{CONTROLLER_STRUCTURES.container[0]}} containers are allowed.',
                eng(UTILS, "var structuresCnt = _(roomObjects).filter((i) => i.type == type || i.type == 'constructionSite' && i.structureType == type).size();"),
                eng(UTILS, 'var availableCnt = C.CONTROLLER_STRUCTURES[type][rcl] + offset;'),
                common(CONST, '"container": {0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5},')),
            L('ERR_FULL at {{MAX_CONSTRUCTION_SITES}} sites per player, counted over all rooms.',
                eng(ROOMS, "if(_(runtimeData.userObjects).filter({type: 'constructionSite'}).size() + createdConstructionSites >= C.MAX_CONSTRUCTION_SITES) {")),
            L('ERR_INVALID_TARGET: border tiles, a tile that already has a site, a second structure on the tile (only roads and ramparts share), walls (except roads and extractors), and any tile next to an exit unless it is a road or container.',
                eng(UTILS, 'if(x <= 0 || y <= 0 || x >= 49 || y >= 49) {'),
                eng(UTILS, "if(_.any(objects, {x, y, type: 'constructionSite'})) {"),
                eng(UTILS, "_.any(objects, (i) => i.x == x && i.y == y && i.type != 'rampart' && i.type != 'road' && C.CONSTRUCTION_COST[i.type])) {"),
                eng(UTILS, "if(structureType != 'road' && exports.checkTerrain(objects, x, y, C.TERRAIN_MASK_WALL)) {"),
                eng(UTILS, "if(structureType != 'road' && structureType != 'container' && (x == 1 || x == 48 || y == 1 || y == 48)) {")),
            L('The site exists from the next tick; its id is not available in the tick you place it.',
                eng(ROOMS, "intents.pushByName('room', 'createConstructionSite', intent);"),
                eng(P + 'room/create-construction-site.js', 'bulk.insert(obj);')),
            L('An enemy creep that steps on a site removes it.',
                eng(P + 'movement.js', "var constructionSite = _.find(cellObjects, (i) => i.type == 'constructionSite' && i.user != object.user);")),
        ],
        notes: [
            L('A road costs {{CONSTRUCTION_COST.road}} on plain, ×{{CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} on swamp and ×{{CONSTRUCTION_COST_ROAD_WALL_RATIO}} through a wall.',
                eng(P + 'room/create-construction-site.js', 'progressTotal *= C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO;'),
                eng(P + 'room/create-construction-site.js', 'progressTotal *= C.CONSTRUCTION_COST_ROAD_WALL_RATIO;')),
        ],
        constants: ['MAX_CONSTRUCTION_SITES', 'CONSTRUCTION_COST', 'CONTROLLER_STRUCTURES', 'CONSTRUCTION_COST_ROAD_SWAMP_RATIO', 'CONSTRUCTION_COST_ROAD_WALL_RATIO'],
        see: ['Creep.build', 'ConstructionSite.remove', 'RoomPosition.createConstructionSite', 'mechanic:ownership', 'const:structures'],
        engine: [
            { file: ROOMS, find: 'Room.prototype.createConstructionSite', label: 'engine: API checks' },
            { file: 'src/utils.js', find: 'exports.checkConstructionSite', label: 'engine: placement rules' },
        ],
    },
    'Room.createFlag': {
        summary: 'Place a flag in a visible room.',
        tasks: ['place a flag'],
        notes: [
            L('The room must be visible: RoomPosition.createFlag throws for a room without vision. To get a flag there, place it in a visible room and move it with Flag.setPosition. Limit: {{FLAGS_LIMIT}} flags.',
                eng(ROOMS, 'return room.createFlag(this, name, color, secondaryColor);'),
                eng('src/game/flags.js', "intents.pushByName('room', 'createFlag', {roomName, x, y, name: this.name, color: this.color, secondaryColor: this.secondaryColor});"),
                eng(ROOMS, 'if(_.size(globals.Game.flags) >= C.FLAGS_LIMIT) {')),
        ],
        constants: ['FLAGS_LIMIT'],
        see: ['RoomPosition.createFlag', 'Flag'],
    },
    'Room.findPath': {
        summary: 'Path between two positions of this room, as steps with x, y, dx, dy, direction.',
        tasks: ['find a path inside a room'],
        pitfalls: [
            L('By default other creeps count as obstacles; pass ignoreCreeps for a stable path. For anything across rooms or with own costs use PathFinder.search.',
                eng(ROOMS, IGNORE_CREEPS),
                eng(ROOMS, 'if(pos.roomName != id) {')),
        ],
        see: ['PathFinder.search', 'Creep.moveByPath', 'Room.serializePath'],
    },
    'Room.findExitTo': {
        summary: 'FIND_EXIT_* constant of the exit that leads toward another room.',
        tasks: ['which exit leads to a room'],
        see: ['Game.map.findExit', 'Game.map.findRoute', 'Game.map.describeExits'],
    },
    'Room.getEventLog': {
        summary: 'What happened in this room in the previous tick: attacks, heals, builds, harvests, transfers, exits, destroyed objects.',
        tasks: ['who attacked my creep', 'detect damage', 'see what other players did last tick', 'count harvested energy'],
        pitfalls: [
            L('The log is parsed from JSON on the first call per room and tick; pass true to get the raw string and parse only when needed.',
                eng(ROOMS, "roomEventLogCache[this.name] = JSON.parse(runtimeData.roomEventLog[this.name] || '[]');"),
                eng(ROOMS, "return runtimeData.roomEventLog[this.name] || '[]';")),
        ],
        see: ['const:events'],
    },
    'Room.getTerrain': {
        summary: 'Terrain reader for the room: terrain.get(x, y) returns 0 (plain), TERRAIN_MASK_WALL or TERRAIN_MASK_SWAMP.',
        tasks: ['is a tile a wall', 'read room terrain', 'check for swamp'],
        constants: ['TERRAIN_MASK_WALL', 'TERRAIN_MASK_SWAMP'],
        see: ['Game.map.getRoomTerrain', 'Room.Terrain.get'],
    },
    'Room.Terrain.get': {
        summary: 'Terrain of one tile as a bit mask: 0 plain, {{TERRAIN_MASK_WALL}} wall, {{TERRAIN_MASK_SWAMP}} swamp.',
        tasks: ['terrain at x y'],
        constants: ['TERRAIN_MASK_WALL', 'TERRAIN_MASK_SWAMP'],
        see: ['Room.getTerrain', 'Game.map.getRoomTerrain'],
    },
    'Room.getPositionAt': { summary: 'RoomPosition for x, y in this room.', tasks: ['make a position'], see: ['RoomPosition.constructor'] },
    'Room.serializePath': { summary: 'Pack a findPath result into a short string for Memory.', tasks: ['store a path in memory'], see: ['Room.deserializePath', 'Creep.moveByPath'] },
    'Room.energyAvailable': {
        summary: 'Energy in all active spawns and extensions of the room: what spawnCreep can spend now.',
        tasks: ['how much energy can the spawn use', 'energy for spawning'],
        see: ['Room.energyCapacityAvailable', 'StructureSpawn.spawnCreep'],
    },
    'Room.energyCapacityAvailable': {
        summary: 'Total capacity of all active spawns and extensions: the largest body the room can pay for.',
        tasks: ['largest creep a room can spawn', 'spawn energy capacity by room level'],
        constants: ['SPAWN_ENERGY_CAPACITY', 'EXTENSION_ENERGY_CAPACITY', 'CONTROLLER_STRUCTURES.extension'],
        see: ['Room.energyAvailable', 'const:controller'],
    },
    'Room.controller': {
        summary: 'The room\'s controller, or undefined in rooms without one (highways, source keeper centre rooms).',
        tasks: ['get the room controller', 'is this room mine', 'who owns this room'],
        notes: [
            L('Mine: room.controller && room.controller.my. Reserved by me: controller.reservation && controller.reservation.username === myName.',
                eng(STRUCT, 'my: (o) => _.isUndefined(o.user) ? undefined : o.user == runtimeData.user._id'),
                eng(STRUCT, 'username: runtimeData.users[o.reservation.user].username,')),
        ],
        see: ['StructureController', 'mechanic:controller'],
    },
    'Room.storage': { summary: 'The storage in the room, if there is one (also another player\'s in their room).', tasks: ['get the room storage'], see: ['StructureStorage'] },
    'Room.terminal': { summary: 'The terminal in the room, if there is one.', tasks: ['get the room terminal'], see: ['StructureTerminal.send'] },
    'Room.memory': { summary: 'Shortcut to Memory.rooms[name].', tasks: ['store data on a room'], see: ['Memory', 'mechanic:memory'] },
    'Room.visual': { summary: 'RoomVisual for this room: draw lines, circles and text for debugging.', tasks: ['draw in a room'], see: ['RoomVisual'] },

    // ---------------------------------------------------------------- RoomPosition
    RoomPosition: { summary: 'A tile: x, y (0–49) and roomName. Can be created for any room, seen or not.', tasks: ['position object'], see: ['RoomPosition.constructor'] },
    'RoomPosition.constructor': { summary: 'new RoomPosition(x, y, roomName). Works for rooms you cannot see.', tasks: ['create a position in another room', 'target a room without vision'], see: ['Creep.moveTo'] },
    'RoomPosition.findClosestByPath': {
        summary: 'Nearest object by walking distance. Runs a pathfinding search, so it is expensive.',
        tasks: ['nearest source by path', 'closest reachable target'],
        pitfalls: [
            L('Returns null when nothing is reachable. Only objects in the same room. Use findClosestByRange when straight distance is good enough.',
                eng(ROOMS, 'var result = null;'),
                eng(ROOMS, 'maxRooms: 1')),
        ],
        see: ['RoomPosition.findClosestByRange', 'PathFinder.search'],
    },
    'RoomPosition.findClosestByRange': {
        summary: 'Nearest object by straight (Chebyshev) distance. Cheap.',
        tasks: ['closest hostile creep', 'nearest structure', 'pick the closest target'],
        see: ['RoomPosition.findClosestByPath', 'RoomPosition.findInRange', 'RoomPosition.getRangeTo'],
    },
    'RoomPosition.findInRange': {
        summary: 'All objects of one kind within a range of this position.',
        tasks: ['hostiles within range 3', 'structures near a position', 'creeps next to a spawn'],
        see: ['Room.lookForAtArea', 'RoomPosition.inRangeTo'],
    },
    'RoomPosition.findPathTo': { summary: 'Room.findPath starting at this position.', tasks: ['path from a position'], see: ['Room.findPath', 'PathFinder.search'] },
    'RoomPosition.getRangeTo': {
        summary: 'Distance in tiles, diagonal steps counting 1 (Chebyshev).',
        tasks: ['distance between two positions', 'range to a target'],
        pitfalls: [
            L('Infinity when the target is in another room.',
                eng(ROOMS, 'if(roomName && roomName != this.roomName) {')),
        ],
        see: ['RoomPosition.inRangeTo', 'RoomPosition.isNearTo', 'Game.map.getRoomLinearDistance'],
    },
    'RoomPosition.inRangeTo': { summary: 'True when the target is within the given range.', tasks: ['is a target in range'], see: ['RoomPosition.getRangeTo'] },
    'RoomPosition.isNearTo': { summary: 'True when the target is on an adjacent tile or the same tile (range ≤ 1).', tasks: ['is a creep next to a target', 'adjacent check'], see: ['RoomPosition.inRangeTo'] },
    'RoomPosition.isEqualTo': { summary: 'True when both are the same tile in the same room.', tasks: ['same position check'] },
    'RoomPosition.getDirectionTo': { summary: 'Direction constant (1–8) toward a target.', tasks: ['direction to a target'], see: ['Creep.move', 'const:directions'] },
    'RoomPosition.look': { summary: 'Everything on this tile.', tasks: ['what is at this position'], see: ['Room.lookAt'] },
    'RoomPosition.lookFor': { summary: 'Objects of one kind (LOOK_*) on this tile.', tasks: ['structures at a position', 'is there a road here'], see: ['Room.lookForAt', 'const:look'] },
    'RoomPosition.createConstructionSite': { summary: 'Room.createConstructionSite at this position. The room must be visible.', tasks: ['place a site at a position'], see: ['Room.createConstructionSite'] },
    'RoomPosition.createFlag': { summary: 'Room.createFlag at this position. The room must be visible; it throws for a room without vision.', tasks: ['place a flag in an unseen room'], see: ['Room.createFlag'] },

    // ---------------------------------------------------------------- base objects
    'RoomObject.pos': { summary: 'Position of the object.', tasks: ['where is an object'] },
    'RoomObject.room': { summary: 'Room of the object; undefined for flags and sites in rooms you cannot see.', tasks: ['room of an object'] },
    'RoomObject.effects': { summary: 'Active effects on the object, each {power, effect, level, ticksRemaining}. The property is undefined on an object that never had an effect.',
        notes: [L('Only effects with ticks left are listed.', eng('src/game/rooms.js', 'filter(i => i.ticksRemaining > 0)'))], tasks: ['is a structure under a power effect', 'invulnerability effect'], see: ['const:power'] },

    Structure: {
        summary: 'Base of every structure: hits, hitsMax, id, structureType, destroy(), isActive(), notifyWhenAttacked().',
        tasks: ['common structure properties'],
        see: ['const:structures', 'OwnedStructure'],
    },
    'Structure.destroy': {
        summary: 'Remove a structure at once. Only in a room whose controller is yours.',
        tasks: ['destroy a structure', 'remove a road', 'who can destroy a road in a claimed room', 'remove a wall or rampart', 'clear old structures after claiming a room', 'destroy another player\'s leftover structures'],
        pitfalls: [
            L('ERR_NOT_OWNER unless room.controller.my. A reservation is not enough: in remote or neutral rooms use Creep.dismantle or attack.',
                eng(STRUCT, 'if(!this.room.controller || !this.room.controller.my) {'),
                eng(P + 'room/destroy-structure.js', 'if(!roomController || roomController.user != userId) return;')),
            L('ERR_BUSY while a creep or power creep of another user is in the room, allies and invaders included; the processor checks the same again.',
                eng(STRUCT, 'if(this.room.find(C.FIND_HOSTILE_CREEPS).length > 0 ||'),
                eng(GAME, '[C.FIND_HOSTILE_CREEPS]: (i) => !i.spawning && !i.my,'),
                eng(P + 'room/destroy-structure.js', "if(_.any(roomObjects, i => (i.type == 'creep' || i.type == 'powerCreep') && i.user != userId)) return;")),
            L('No energy comes back. The structure\'s contents stay behind in a ruin.',
                eng(P + 'structures/_destroy.js', 'ruin.store = object.store || {};')),
        ],
        notes: [
            L('In your room it works on every structure with a build cost, whoever built it: roads, containers, walls, and structures left by a previous owner.',
                eng(P + 'room/destroy-structure.js', 'if(!object || !C.CONSTRUCTION_COST[object.type]) return;'),
                eng(P + 'room/destroy-structure.js', 'if(!roomController || roomController.user != userId) return;')),
            L('Other ways a structure disappears: dismantle (any creep with WORK, range 1), attacks, tower fire, nukes, and decay for roads, containers and ramparts.',
                eng(P + '_damage.js', "require('./structures/_destroy')(target, scope, attackType);"),
                eng(P + 'creeps/dismantle.js', "require('../_damage')(object, target, amount, C.EVENT_ATTACK_TYPE_DISMANTLE, scope);"),
                eng(P + 'nukes/tick.js', "require('../_damage')(object, target, damage, C.EVENT_ATTACK_TYPE_NUKE, scope);"),
                eng(P + 'roads/tick.js', 'object.hits -= decayAmount;'),
                eng(P + 'containers/tick.js', 'object.hits -= C.CONTAINER_DECAY;'),
                eng(P + 'ramparts/tick.js', 'object.hits -= C.RAMPART_DECAY_AMOUNT;')),
        ],
        see: ['Creep.dismantle', 'mechanic:ownership', 'Ruin.store', 'ConstructionSite.remove'],
        engine: [
            { file: STRUCT, find: 'Structure.prototype.destroy', label: 'engine: API checks' },
            { file: 'src/processor/intents/room/destroy-structure.js', find: 'if(!roomController || roomController.user != userId) return;', label: 'engine: only the room owner' },
        ],
    },
    'Structure.isActive': {
        summary: 'False when the room level no longer allows this structure (after a downgrade, or in a room that is not yours).',
        tasks: ['why does my structure not work', 'structures after a controller downgrade'],
        pitfalls: [
            L('Medium CPU cost: it counts the structures of that type. When there are too many, the ones closest to the controller stay active. Cache the result.',
                doc('Structure.isActive'),
                eng(UTILS, 'if(compareDist < objectDist) {'),
                eng(UTILS, 'if(compareObj.type === object.type && compareObj.user === object.user) {')),
        ],
        constants: ['CONTROLLER_STRUCTURES'],
        see: ['mechanic:controller', 'const:controller'],
        engine: [{ file: 'src/utils.js', find: 'exports.checkStructureAgainstController', label: 'engine: which structures stay active' }],
    },
    'Structure.notifyWhenAttacked': { summary: 'Switch the attack e-mail for this structure on or off.', tasks: ['turn off attack notifications for a structure'] },
    'Structure.hits': { summary: 'Current hits. Compare with hitsMax before repairing.', tasks: ['how damaged is a structure', 'does a structure need repair'], see: ['Creep.repair', 'const:structures', 'mechanic:decay'] },
    'Structure.structureType': { summary: 'One of the STRUCTURE_* constants.', tasks: ['type of a structure'], see: ['const:structures'] },
    OwnedStructure: { summary: 'Structures with an owner. Roads, containers, walls and portals are not owned.', tasks: ['which structures have an owner'], see: ['mechanic:ownership'] },
    'OwnedStructure.my': { summary: 'True if the structure is yours. Undefined for roads, containers and walls, which have no owner.', tasks: ['is this structure mine'], see: ['mechanic:ownership'] },
    'OwnedStructure.owner': { summary: '{username} of the owner.', tasks: ['who owns a structure'] },

    'ConstructionSite.remove': {
        summary: 'Cancel a construction site.',
        tasks: ['remove a construction site', 'cancel building'],
        notes: [
            L('Half of the progress is dropped as energy on the tile. The owner of the site and the owner of the room can both remove it.',
                eng(P + 'room/remove-construction-site.js', "require('../_create-energy')(object.x, object.y, object.room, Math.floor(object.progress/2), 'energy', scope);"),
                eng(P + 'room/remove-construction-site.js', 'if(object.user != userId && !(roomController && roomController.user == userId)) return;')),
        ],
        see: ['Room.createConstructionSite', 'Game.constructionSites'],
        engine: [{ file: 'src/processor/intents/room/remove-construction-site.js', find: 'if(object.user != userId && !(roomController && roomController.user == userId)) return;', label: 'engine: who may remove a site' }],
    },
    'ConstructionSite.progress': { summary: 'Energy already built in; progressTotal is the full cost.', tasks: ['how far is a construction site'], see: ['Creep.build'] },

    Source: { summary: 'An energy source. Refills completely every {{ENERGY_REGEN_TIME}} ticks, counted from the first harvest after a refill.', tasks: ['how sources regenerate'], see: ['mechanic:sources', 'Creep.harvest'] },
    'Source.energy': { summary: 'Energy left in the source right now.', tasks: ['is a source empty'], see: ['Source.ticksToRegeneration', 'mechanic:sources'] },
    'Source.energyCapacity': {
        summary: '{{SOURCE_ENERGY_CAPACITY}} in an owned or reserved room, {{SOURCE_ENERGY_NEUTRAL_CAPACITY}} in a neutral room, {{SOURCE_ENERGY_KEEPER_CAPACITY}} in a room without a controller (source keeper and centre rooms).',
        tasks: ['how much energy does a source hold', 'source capacity in a reserved room'],
        constants: ['SOURCE_ENERGY_CAPACITY', 'SOURCE_ENERGY_NEUTRAL_CAPACITY', 'SOURCE_ENERGY_KEEPER_CAPACITY'],
        see: ['mechanic:sources', 'mechanic:reservation'],
    },
    'Source.ticksToRegeneration': { summary: 'Ticks until the source is full again; undefined while it is full.', tasks: ['when does a source refill'], constants: ['ENERGY_REGEN_TIME'] },
    Mineral: { summary: 'A mineral deposit in a room. Needs an extractor (RCL 6) to harvest; refills {{MINERAL_REGEN_TIME}} ticks after it is emptied.', tasks: ['how to mine minerals', 'mineral regeneration'], constants: ['MINERAL_REGEN_TIME', 'MINERAL_DENSITY', 'EXTRACTOR_COOLDOWN'], see: ['Creep.harvest', 'StructureExtractor', 'const:sources-minerals'] },
    Deposit: { summary: 'A commodity deposit in a highway room. Each harvest lengthens its cooldown; it disappears {{DEPOSIT_DECAY_TIME}} ticks after the last harvest.', tasks: ['harvest highway deposits'], constants: ['DEPOSIT_DECAY_TIME', 'DEPOSIT_EXHAUST_MULTIPLY', 'DEPOSIT_EXHAUST_POW'], see: ['Creep.harvest', 'StructureFactory.produce'] },
    Resource: { summary: 'A pile of a resource on the ground.', tasks: ['dropped resources'], see: ['Creep.pickup', 'mechanic:decay'] },
    'Resource.amount': {
        summary: 'Amount in the pile. It loses ceil(amount / {{ENERGY_DECAY}}) every tick.',
        tasks: ['how fast does dropped energy decay', 'how long does a pile on the ground last'],
        constants: ['ENERGY_DECAY'],
        see: ['Creep.pickup', 'mechanic:decay'],
    },
    Tombstone: {
        summary: 'Left where a creep died. Holds what it carried plus part of its body energy; lasts {{TOMBSTONE_DECAY_PER_PART}} ticks per body part, then the contents drop.',
        tasks: ['what happens when a creep dies', 'get resources from a dead creep'],
        constants: ['TOMBSTONE_DECAY_PER_PART', 'CREEP_CORPSE_RATE'],
        see: ['Creep.withdraw', 'mechanic:creep-death'],
    },
    'Tombstone.store': { summary: 'Resources in the tombstone; take them with withdraw.', tasks: ['loot a tombstone'], see: ['Creep.withdraw'] },
    Ruin: {
        summary: 'Left where a structure was destroyed. Holds the structure\'s contents for {{RUIN_DECAY}} ticks, then they drop.',
        tasks: ['what happens to resources when a structure is destroyed', 'loot a destroyed storage'],
        constants: ['RUIN_DECAY'],
        see: ['Creep.withdraw', 'Structure.destroy'],
        engine: [{ file: 'src/processor/intents/structures/_destroy.js', find: 'ruin.store = object.store || {};', label: 'engine: ruin keeps the store' }],
    },
    'Ruin.store': { summary: 'Resources in the ruin; take them with withdraw.', tasks: ['loot a ruin'], see: ['Creep.withdraw'] },
    Flag: { summary: 'A named marker with its own memory. It is placed in a room you can see and can then be moved to any room. Useful to steer code by hand.', tasks: ['mark a position by hand'], constants: ['FLAGS_LIMIT'], see: ['Room.createFlag', 'Game.flags'] },

    // ---------------------------------------------------------------- Store
    Store: {
        summary: 'Contents of a creep or structure: store[RESOURCE_ENERGY] is the amount (0 when none), plus capacity methods.',
        tasks: ['how much energy is in a structure', 'read the contents of a container'],
        pitfalls: [
            L('Creeps, containers, storages, terminals and factories have one shared capacity. Spawns, extensions, towers, links, labs, nukers and power spawns have a capacity per resource: there the capacity methods need the resource argument and return null without it (except getUsedCapacity on a lab that holds no mineral, which returns the total).',
                eng(STORE, 'return object.storeCapacityResource ? null : object.storeCapacity || null;'),
                eng(STORE, 'if(!!object.storeCapacityResource && (utils.capacityForResource(object, resource) === 0)) {'),
                eng(P + 'creeps/build.js', 'storeCapacityResource: {energy: C.SPAWN_ENERGY_CAPACITY},'),
                eng(P + 'creeps/build.js', 'storeCapacity: C.STORAGE_CAPACITY,'),
                eng(P + 'creeps/build.js', 'storeCapacity: C.LAB_ENERGY_CAPACITY + C.LAB_MINERAL_CAPACITY,')),
        ],
        see: ['Store.getFreeCapacity', 'Store.getUsedCapacity', 'Store.getCapacity'],
    },
    'Store.getFreeCapacity': {
        summary: 'Free space, for one resource or in total.',
        tasks: ['how much more fits', 'is a spawn full', 'is the creep full', 'free space in a tower'],
        pitfalls: [
            L('On structures with per-resource capacity (spawn, extension, tower, link, lab) call it with the resource: getFreeCapacity(RESOURCE_ENERGY). Without it the result is null, which is falsy like 0.',
                eng(STORE, 'if(utils.capacityForResource(object, resource) === 0) {'),
                eng(STORE, 'if(!capacity) {'),
                eng(UTILS, 'Math.max(0, (object.storeCapacity||0) - _.sum(object.storeCapacityResource));')),
        ],
        see: ['Store.getUsedCapacity', 'Store.getCapacity', 'Creep.transfer'],
    },
    'Store.getUsedCapacity': {
        summary: 'Amount of one resource, or the total of everything when called without argument.',
        tasks: ['how much is stored', 'total carried by a creep', 'is a creep empty'],
        pitfalls: [
            L('Without argument on a per-resource store (spawn, tower, link …) it returns null; a lab that holds no mineral returns the total instead.',
                eng(STORE, 'if(!!object.storeCapacityResource && (utils.capacityForResource(object, resource) === 0)) {'),
                eng(UTILS, 'Math.max(0, (object.storeCapacity||0) - _.sum(object.storeCapacityResource));'),
                eng(P + 'creeps/build.js', 'storeCapacity: C.LAB_ENERGY_CAPACITY + C.LAB_MINERAL_CAPACITY,')),
        ],
        see: ['Store.getFreeCapacity'],
    },
    'Store.getCapacity': {
        summary: 'Capacity for one resource, or the shared capacity. null if the store cannot hold that resource.',
        tasks: ['capacity of a structure', 'can a structure hold a resource'],
        see: ['Store.getFreeCapacity', 'const:structures'],
    },

    // ---------------------------------------------------------------- PathFinder
    'PathFinder.search': {
        summary: 'The pathfinder: cheapest path from a position to one or several goals, across rooms, with your own tile costs.',
        tasks: ['find a path across rooms', 'path with custom costs', 'avoid a room', 'flee from enemies', 'path that prefers roads', 'plan a road'],
        pitfalls: [
            L('It knows only terrain. Structures, creeps and roads count only through the CostMatrix your roomCallback returns.',
                doc('PathFinder.CostMatrix'),
                driver(PF, 'mod.loadTerrain(terrainData);'),
                driver(PF, 'return ret._bits;')),
            L('Check result.incomplete: when maxOps (default 2000) or maxRooms (default 16) runs out you get a partial path.',
                driver(PF, 'let maxOps = Math.max(1, (options.maxOps | 0) || 2000);'),
                driver(PF, 'let maxRooms = Math.min(64, Math.max(1, (options.maxRooms | 0) || 16));'),
                driver(PFC, 'Nan::New<v8::Boolean>(min_node_h_cost != 0));')),
            L('The path does not contain the start position.',
                driver(PFC, 'while (pos != origin) {')),
            L('To prefer roads set plainCost 2, swampCost 10 and write cost 1 on road tiles.',
                doc('PathFinder.search'),
                eng(ROOMS, 'searchOpts.plainCost = 2;'),
                eng(ROOMS, 'costs.set(object.x, object.y, 1);')),
            L('Return false from roomCallback to keep the search out of a room.',
                driver(PF, 'if (ret === false) {')),
            L('A goal with range 0 on a blocked tile (a source, a controller) is unreachable; give range 1.',
                doc('PathFinder.search'),
                eng(ROOMS, 'var ret = globals.PathFinder.search(fromPos, {range: Math.max(1,opts.range || 0), pos: toPos}, searchOpts);')),
        ],
        notes: [
            L('CostMatrix values: 0 = terrain default, 1–254 = cost, 255 = blocked. 1000 ops cost about 1 CPU.',
                driver(PFC, 'if (tmp != 0) {'),
                driver(PFC, 'if (tmp == 0xff) {'),
                doc('PathFinder.search')),
        ],
        see: ['PathFinder.CostMatrix', 'Creep.moveByPath', 'Game.map.findRoute', 'Creep.moveTo', 'mechanic:movement'],
    },
    'PathFinder.CostMatrix': {
        summary: 'Per-tile costs for one room, passed to PathFinder.search through roomCallback.',
        tasks: ['mark tiles as blocked for pathfinding', 'make roads cheaper for pathfinding'],
        notes: [
            L('Build it once per room and keep it (global or serialized): creating it every tick is the usual CPU waste.',
                doc('PathFinder.search'),
                doc('PathFinder.CostMatrix.serialize')),
        ],
        see: ['PathFinder.search', 'PathFinder.CostMatrix.set', 'PathFinder.CostMatrix.serialize'],
    },
    'PathFinder.CostMatrix.set': { summary: 'Set the cost of a tile: 0 terrain default, 255 blocked.', tasks: ['block a tile for pathfinding'], see: ['PathFinder.search'] },
    'PathFinder.CostMatrix.serialize': { summary: 'Pack the matrix into an array you can store in Memory; deserialize restores it.', tasks: ['store a cost matrix'], see: ['PathFinder.CostMatrix.deserialize'] },

    // ---------------------------------------------------------------- visuals
    RoomVisual: {
        summary: 'Debug drawings in a room: lines, circles, rectangles, polygons, text. They last one tick.',
        tasks: ['draw debug shapes', 'show text in a room', 'visualize a path'],
        pitfalls: [
            L('At most 500 KB of visuals per room and tick. Drawing costs only the JSON size, no intent CPU, but it is not free in bulk.',
                eng('src/game/console.js', 'const sizeLimit = roomName == "map" ? 1000 : 500;'),
                eng('src/game/console.js', 'const dataString = _.isString(data) ? data : JSON.stringify(data)+"\\n";'),
                doc('RoomVisual')),
        ],
        notes: [
            L('new RoomVisual(roomName) draws in a room without vision; new RoomVisual() draws in all rooms.',
                doc('RoomVisual.constructor')),
        ],
        see: ['RoomVisual.text', 'RoomVisual.poly', 'Game.map.visual'],
    },
    'RoomVisual.text': { summary: 'Draw text at a position.', tasks: ['label an object in the room view'], see: ['RoomVisual', 'Creep.say'] },
    'RoomVisual.poly': { summary: 'Draw a line through several points.', tasks: ['draw a path'], see: ['RoomVisual'] },
    'Game.map.visual': { summary: 'The same drawing calls on the world map; limit 1000 KB per tick.', tasks: ['draw on the world map'], see: ['RoomVisual'] },
};
