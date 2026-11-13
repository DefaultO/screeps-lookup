'use strict';
// Own text for NPC and world objects: keeper lair, invader core, portal, power bank, nuker, nuke, source, tombstone, ruin.
const { L, eng, backend, driver, common, doc } = require('../../_h');

const P = 'src/processor/intents/';
const STRUCT = 'src/game/structures.js';
const ROOMS = 'src/game/rooms.js';
const CREEPS = 'src/game/creeps.js';
const TOMB = 'src/game/tombstones.js';
const RUINS = 'src/game/ruins.js';
const PROC = 'src/processor.js';
const DIE = P + 'creeps/_die.js';
const DAMAGE = P + '_damage.js';
const DESTROY = P + 'structures/_destroy.js';
const WITHDRAW = P + 'creeps/withdraw.js';
const LAIR = P + 'keeper-lairs/tick.js';
const CORE = P + 'invader-core/';
const SH = CORE + 'stronghold/stronghold.js';
const NUKE = P + 'nukes/tick.js';
const SOURCE = P + 'sources/tick.js';
const CRON = 'lib/cronjobs.js';
const BSH = 'lib/strongholds.js';
const BUTIL = 'lib/utils.js';

const RAMPART_RULE = 'if(object.user != target.user && _.any(roomObjects, i => i.type == C.STRUCTURE_RAMPART && i.user != object.user && !i.isPublic && i.x == target.x && i.y == target.y)) {';

module.exports = {
    // ---------------------------------------------------------------- keeper lair
    StructureKeeperLair: {
        tasks: ['find the keeper lairs of a room', 'which keeper belongs to which lair'],
        notes: [
            L('lair.owner.username is "Source Keeper" and lair.my is false, so FIND_HOSTILE_STRUCTURES returns lairs.',
                eng(STRUCT, "owner: () => ({username: 'Source Keeper'}),"), eng('src/game/game.js', 'i.my === false && i.owner')),
            L('Its keeper is the creep named "Keeper" followed by the id of the lair.', eng(LAIR, "name: 'Keeper'+object._id,")),
            L('The lair cannot be destroyed.', doc('StructureKeeperLair')),
        ],
        see: ['mechanic:source-keepers', 'recipe:source-keeper-mining'],
    },
    'StructureKeeperLair.ticksToSpawn': {
        notes: [
            L('Undefined while the keeper is alive at full hits. The {{ENERGY_REGEN_TIME}} ticks start when the keeper is first hurt or is gone.',
                eng(STRUCT, 'ticksToSpawn: (o) => o.nextSpawnTime ? o.nextSpawnTime - runtimeData.time : undefined'), eng(LAIR, 'if(!keeper || keeper.hits < 5000) {')),
        ],
        constants: ['ENERGY_REGEN_TIME'],
        see: ['mechanic:source-keepers'],
    },

    // ---------------------------------------------------------------- invader core
    StructureInvaderCore: {
        tasks: ['how to destroy an invader core', 'who owns an invader core'],
        notes: [
            L('core.owner.username is "Invader".', backend('lib/game/socket/rooms.js', "'2': {_id: '2', username: 'Invader'},"), backend(BSH, "user: '2',")),
            L('Towers and defenders of a stronghold act on orders of the core. With the core destroyed they do nothing more.',
                eng(PROC, "const i = require('./processor/intents/invader-core/pretick')(invaderCore, scope);")),
            L('When a core is destroyed or collapses, the controller of its room is set to level 0 without owner. A reservation is not touched and runs out by itself.',
                eng(CORE + 'destroy.js', 'user: null,')),
        ],
        pitfalls: [
            L('dismantle does nothing to a core: it has no build cost. Use attack or rangedAttack.',
                eng(P + 'creeps/dismantle.js', 'if(!target || !C.CONSTRUCTION_COST[target.type]) {')),
            L('In a stronghold the core stands under a rampart that takes the damage first.',
                common('lib/strongholds.js', '{ type: C.STRUCTURE_RAMPART,      dx:  0, dy:  0 },'), eng(P + 'creeps/attack.js', 'target = rampart;')),
        ],
        see: ['mechanic:strongholds', 'recipe:clear-a-stronghold', 'StructureInvaderCore.level'],
    },
    'StructureInvaderCore.level': {
        summary: 'Strength of the core: 0 for a lesser core that only holds a controller, 1 to 5 for the core of a stronghold.',
        tasks: ['how strong is a stronghold', 'stronghold level', 'is this a lesser invader core', 'tell a stronghold from an invader core'],
        notes: [
            L('Levels 1 to 5 are the layouts bunker1 to bunker5, with 1, 2, 3, 4 and 6 towers.',
                common('lib/strongholds.js', "{ type: C.STRUCTURE_INVADER_CORE, dx:  0, dy:  0, level: 1, strongholdBehavior: 'bunker1' },")),
            L('Cores of level 0 and 1 spawn no creeps.', eng(CORE + 'create-creep.js', 'if(!object.level || !C.INVADER_CORE_CREEP_SPAWN_TIME[object.level]) return;')),
            L('The hits are {{INVADER_CORE_HITS}} at every level.', backend(BSH, 'hits: C.INVADER_CORE_HITS,')),
        ],
        constants: ['INVADER_CORE_HITS', 'INVADER_CORE_CREEP_SPAWN_TIME', 'INVADER_CORE_EXPAND_TIME', 'STRONGHOLD_RAMPART_HITS'],
        see: ['mechanic:strongholds', 'recipe:clear-a-stronghold'],
    },
    'StructureInvaderCore.ticksToDeploy': {
        summary: 'Ticks until a new stronghold puts down its towers, ramparts and containers. Undefined once the core is active, and for lesser cores.',
        tasks: ['when does a stronghold deploy', 'is a stronghold still deploying', 'stronghold deploy timer'],
        notes: [
            L('The count starts at 5,000.', backend(BSH, 'const strongholdDeployTime = 5000;')),
        ],
        pitfalls: [
            L('While it counts the core is invulnerable: attack, rangedAttack and dismantle return ERR_INVALID_TARGET.',
                backend(BSH, 'effect: C.EFFECT_INVULNERABILITY,'), eng(CREEPS, 'const effect = _.find(target.effects, e => (e.power == C.PWR_FORTIFY || e.effect == C.EFFECT_INVULNERABILITY) && (e.ticksRemaining > 0));')),
            L('When it ends, a creep standing on a tile of the layout dies. The public 1-hit ramparts around the core mark those tiles.',
                eng(SH, "require('../../creeps/_die')(o, undefined, true, scope);"), backend(BSH, 'isPublic: true,')),
        ],
        see: ['mechanic:strongholds', 'RoomObject.effects'],
    },
    'StructureInvaderCore.spawning': {
        summary: 'The defender the core is making, as an object with name, needTime and remainingTime, or null.',
        tasks: ['is the invader core spawning a defender', 'when is the next stronghold defender ready'],
        notes: [
            L('needTime is the number of body parts times INVADER_CORE_CREEP_SPAWN_TIME of the level: {{INVADER_CORE_CREEP_SPAWN_TIME[2]}} / {{INVADER_CORE_CREEP_SPAWN_TIME[3]}} / {{INVADER_CORE_CREEP_SPAWN_TIME[4]}} / {{INVADER_CORE_CREEP_SPAWN_TIME[5]}} ticks per part at levels 2 to 5.',
                eng(CORE + 'create-creep.js', 'needTime: C.INVADER_CORE_CREEP_SPAWN_TIME[object.level] * body.length,')),
            L('cancel() and setDirections() on it return ERR_NOT_OWNER.', eng(STRUCT, 'if(!this.spawn.my) {')),
        ],
        pitfalls: [
            L('A core that is boxed in on all eight tiles places its new defender on the tile of one of your creeps there and kills that creep, as a player spawn does.',
                eng(CORE + 'tick.js', "const bornOk = require('../spawns/_born-creep')(object, spawningCreep, scope);"), eng(P + 'spawns/_born-creep.js', "require('../creeps/_die')(hostileOccupied, undefined, true, scope);")),
        ],
        constants: ['INVADER_CORE_CREEP_SPAWN_TIME'],
        see: ['mechanic:strongholds'],
    },

    // ---------------------------------------------------------------- portal
    StructurePortal: {
        tasks: ['find portals in a room', 'how to enter a portal'],
        notes: [
            L('A portal has no owner: look for it with FIND_STRUCTURES and structureType STRUCTURE_PORTAL.',
                eng(STRUCT, 'StructurePortal.prototype = Object.create(Structure.prototype);')),
            L('A creep enters by ending its move on the portal tile. moveTo and Room.findPath walk around portals unless the portal tile is the target.',
                eng(P + 'creeps/tick.js', 'bulk.update(object, {interRoom: portal.destination});'), eng(ROOMS, "obstacleTypes.push('portal');")),
        ],
        pitfalls: [
            L('A power creep cannot step onto a portal that leads to another shard.',
                eng(P + 'creeps/move.js', "object.type == 'powerCreep' && target.type == 'portal' && target.destination.shard)) {")),
        ],
        see: ['mechanic:portals-and-shards', 'StructurePortal.destination', 'StructurePortal.ticksToDecay'],
    },
    'StructurePortal.destination': {
        summary: 'Where the portal leads: a RoomPosition for a portal inside the shard, or an object {shard, room} for a portal to another shard.',
        tasks: ['where does a portal lead', 'is this a portal to another shard', 'portal destination room'],
        notes: [
            L('Test destination.shard to tell the two kinds apart.', eng(STRUCT, 'if(o.destination.shard) {')),
            L('For another shard only the room is given: the creep arrives on some free tile of it.', doc('StructurePortal.destination')),
        ],
        see: ['mechanic:portals-and-shards', 'InterShardMemory'],
    },
    'StructurePortal.ticksToDecay': {
        summary: 'Ticks until the portal disappears. Undefined while the portal is stable.',
        tasks: ['when does a portal close', 'is a portal stable', 'how long does a portal last'],
        notes: [
            L('A portal that turns unstable starts at {{PORTAL_DECAY}} ticks.', eng(P + 'portals/tick.js', 'decayTime: gameTime + C.PORTAL_DECAY,')),
        ],
        constants: ['PORTAL_DECAY'],
        see: ['mechanic:portals-and-shards'],
    },

    // ---------------------------------------------------------------- power bank
    StructurePowerBank: {
        tasks: ['what is left of a destroyed power bank', 'find power banks in a room'],
        notes: [
            L('bank.owner.username is "Power Bank" and bank.my is false, so FIND_HOSTILE_STRUCTURES returns it.',
                eng(STRUCT, "owner: () => ({username: 'Power Bank'})"), eng('src/game/game.js', 'i.my === false && i.owner')),
        ],
        pitfalls: [
            L('rangedAttack and rangedMassAttack are hit back as well, with the same {{POWER_BANK_HIT_BACK * 100}}%.',
                eng(DAMAGE, 'attackBackPower = damage * C.POWER_BANK_HIT_BACK;')),
            L('While the power is in the ruin it is taken with withdraw; pickup works only once the ruin is gone and the power lies on the tile.',
                eng(DESTROY, 'decayTime: gameTime + (C.RUIN_DECAY_STRUCTURES[object.type] || C.RUIN_DECAY)')),
            L('A bank whose timer runs out is removed with its power; no ruin is left.',
                eng(PROC, "if(object.type == 'powerBank' || object.type == 'deposit') {")),
        ],
        constants: ['POWER_BANK_CAPACITY_CRIT', 'POWER_BANK_RESPAWN_TIME', 'RUIN_DECAY_STRUCTURES'],
        see: ['mechanic:power-banks', 'StructurePowerBank.power', 'StructurePowerBank.ticksToDecay'],
    },
    'StructurePowerBank.power': {
        summary: 'Power in the bank, from {{POWER_BANK_CAPACITY_MIN}} to nearly {{POWER_BANK_CAPACITY_MAX * 2}}. All of it is in the ruin when the bank is destroyed.',
        tasks: ['how much power is in this power bank', 'is a power bank worth attacking'],
        notes: [
            L('Hauling takes one CARRY part per {{CARRY_CAPACITY}} power: up to {{POWER_BANK_CAPACITY_MAX * 2 / CARRY_CAPACITY}} parts for the largest bank.', eng(DESTROY, 'ruin.store = object.store || {};')),
        ],
        constants: ['POWER_BANK_CAPACITY_MIN', 'POWER_BANK_CAPACITY_MAX', 'POWER_BANK_CAPACITY_CRIT'],
        see: ['mechanic:power-banks', 'recipe:observer-and-power'],
    },
    'StructurePowerBank.ticksToDecay': {
        summary: 'Ticks until the bank vanishes together with its power. It starts at {{POWER_BANK_DECAY}}.',
        tasks: ['how long until a power bank disappears', 'is there enough time to break a power bank'],
        notes: [
            L('Compare it with the time you need: {{POWER_BANK_HITS}} hits ÷ ({{ATTACK_POWER}} × your ATTACK parts) ticks of hitting, plus the way there.',
                backend(CRON, 'decayTime: gameTime + C.POWER_BANK_DECAY')),
        ],
        constants: ['POWER_BANK_DECAY', 'POWER_BANK_HITS'],
        see: ['mechanic:power-banks'],
    },

    // ---------------------------------------------------------------- nuker and nuke
    StructureNuker: {
        notes: [
            L('A new nuker starts with the full cooldown of {{NUKER_COOLDOWN}} ticks.', eng(P + 'creeps/build.js', 'cooldownTime: gameTime + (config.ptr ? 100 : C.NUKER_COOLDOWN)')),
            L('It cannot launch while it stands in a novice or respawn area.', eng(P + 'nukers/launch-nuke.js', 'if(roomInfo.novice && roomInfo.novice > Date.now() || roomInfo.respawnArea && roomInfo.respawnArea > Date.now()) {')),
        ],
        see: ['StructureNuker.cooldown', 'StructureNuker.store', 'mechanic:respawn-and-start-areas'],
    },
    'StructureNuker.launchNuke': {
        notes: [
            L('ERR_INVALID_TARGET means that the nuker or the target room is in a novice or respawn area.',
                eng(STRUCT, '!_.isUndefined(runtimeData.roomStatusData.novice[pos.roomName]) ||')),
            L('ERR_NOT_ENOUGH_RESOURCES comes back unless energy and ghodium are both completely full.',
                eng(STRUCT, 'if(this.energy < this.energyCapacity || this.ghodium < this.ghodiumCapacity) {')),
            L('The target is any RoomPosition; the room need not be visible.', eng(STRUCT, 'if(!(pos instanceof globals.RoomPosition)) {')),
        ],
        see: ['mechanic:respawn-and-start-areas', 'StructureNuker.cooldown', 'StructureNuker.store'],
    },
    'StructureNuker.cooldown': {
        summary: 'Ticks until the nuker can launch again; 0 when it is ready.',
        tasks: ['is the nuker ready', 'nuker cooldown', 'when can I launch the next nuke'],
        notes: [
            L('It is {{NUKER_COOLDOWN}} ticks after a launch and also right after the nuker is built.',
                eng(P + 'nukers/launch-nuke.js', 'cooldownTime: gameTime + (config.ptr ? 100 : C.NUKER_COOLDOWN)'), eng(P + 'creeps/build.js', 'cooldownTime: gameTime + (config.ptr ? 100 : C.NUKER_COOLDOWN)')),
            L('While it is above 0 launchNuke returns ERR_TIRED.', eng(STRUCT, 'StructureNuker.prototype.launchNuke = register.wrapFn(function(pos) {')),
        ],
        constants: ['NUKER_COOLDOWN'],
        see: ['StructureNuker.launchNuke', 'mechanic:nukes'],
    },
    'StructureNuker.store': {
        summary: 'What the nuker is loaded with: up to {{NUKER_ENERGY_CAPACITY}} energy and {{NUKER_GHODIUM_CAPACITY}} ghodium. A launch needs both full and uses all of it.',
        tasks: ['is the nuker loaded', 'how much energy is in the nuker', 'fill a nuker'],
        notes: [
            L('A launch sets both amounts to 0.', eng(P + 'nukers/launch-nuke.js', 'store: {energy: 0, G: 0},')),
        ],
        pitfalls: [
            L('Nothing can be taken out again: withdraw on a nuker returns ERR_INVALID_TARGET.',
                eng(CREEPS, 'register.structures[target.id].structureType == C.STRUCTURE_NUKER')),
        ],
        constants: ['NUKER_ENERGY_CAPACITY', 'NUKER_GHODIUM_CAPACITY'],
        see: ['StructureNuker.launchNuke', 'Creep.transfer', 'mechanic:nukes'],
    },
    Nuke: {
        tasks: ['find incoming nukes', 'where will the nuke land'],
        notes: [
            L('room.find(FIND_NUKES) lists the nukes on their way into a room you can see. nuke.pos is the tile it lands on.', doc('Nuke')),
            L('A nuke cannot be attacked, removed or changed.', doc('Nuke')),
        ],
        see: ['Nuke.launchRoomName'],
    },
    'Nuke.timeToLand': {
        notes: [
            L('The strike happens in the tick in which it reads 1.', eng(NUKE, 'if(gameTime == object.landTime-1) {')),
        ],
    },
    'Nuke.id': {
        summary: 'Id of the incoming nuke, for Game.getObjectById.',
        see: ['Game.getObjectById'],
    },
    'Nuke.launchRoomName': {
        summary: 'Name of the room whose nuker launched this nuke.',
        tasks: ['who launched the nuke', 'where does the nuke come from', 'who is nuking me'],
        notes: [
            L('Only the room name is given. It lies within {{NUKE_RANGE}} rooms of the target on each axis.',
                eng('src/game/nukes.js', 'launchRoomName: o => o.launchRoomName'), eng(P + 'nukers/launch-nuke.js', 'if(Math.abs(tx-x) > C.NUKE_RANGE || Math.abs(ty-y) > C.NUKE_RANGE) {')),
        ],
        constants: ['NUKE_RANGE'],
        see: ['mechanic:nukes', 'StructureObserver.observeRoom'],
    },

    // ---------------------------------------------------------------- source
    Source: {
        notes: [
            L('Each source counts the energy harvested from it. The sum over the sources of a room is what makes an invader raid due.',
                eng(P + 'creeps/harvest.js', 'let invaderHarvested = (target.invaderHarvested || 0) + amount;'), backend(CRON, "const invaderHarvested = _.sum(sources, 'invaderHarvested');")),
        ],
        see: ['mechanic:invaders', 'mechanic:source-keepers'],
    },
    'Source.id': {
        summary: 'Id of the source. Keep it in memory and get the object back with Game.getObjectById while the room is visible.',
        tasks: ['remember a source between ticks'],
        see: ['Game.getObjectById', 'Room.find'],
    },
    'Source.energyCapacity': {
        notes: [
            L('The {{SOURCE_ENERGY_KEEPER_CAPACITY}} applies in every room that has no controller.',
                eng(SOURCE, 'else if(object.energyCapacity != C.SOURCE_ENERGY_KEEPER_CAPACITY) {')),
            L('When a room loses its owner or its reservation, the capacity drops to {{SOURCE_ENERGY_NEUTRAL_CAPACITY}} at once and energy above that is cut off. When it gains one, the capacity rises at once but the energy only with the next refill.',
                eng(SOURCE, 'energy: Math.min(object.energy, C.SOURCE_ENERGY_NEUTRAL_CAPACITY)'), eng(SOURCE, 'bulk.update(object, {energyCapacity: C.SOURCE_ENERGY_CAPACITY});')),
        ],
        see: ['mechanic:source-keepers'],
    },

    // ---------------------------------------------------------------- tombstone
    Tombstone: {
        notes: [
            L('A nuke leaves no tombstones and removes those already in the room.',
                eng(NUKE, "if(target.type == 'constructionSite' || target.type == 'energy' || target.type == 'tombstone' || target.type == 'ruin') {")),
            L('Defenders of a stronghold leave an empty tombstone.', eng(DIE, 'if(dropRate > 0 && !object.userSummoned && !object.strongholdId) {')),
            L('The tombstone of your creep is an object of yours: while it lasts you keep vision of its room.',
                eng(DIE, 'user: object.user,'), driver('lib/runtime/data.js', 'roomIdsHash[i.room] = true;')),
        ],
        pitfalls: [
            L('withdraw on a tombstone under a closed rampart of another player returns OK and moves nothing.', eng(WITHDRAW, RAMPART_RULE)),
        ],
    },
    'Tombstone.creep': {
        summary: 'A snapshot of the dead creep or power creep: id, name, owner, my, body, ticksToLive at death, saying. It is not a live object.',
        tasks: ['whose creep died here', 'which of my creeps died', 'was the dead creep mine', 'name of the creep in a tombstone'],
        notes: [
            L('Every body part and hits read 0; hitsMax is 100 per part.', eng(TOMB, 'return _.map(o.creepBody, type => ({type, hits: 0}))')),
            L('creep.store of the snapshot is empty. What the creep carried is in tombstone.store.', eng(TOMB, 'o = {store: {}, storeCapacity: this.carryCapacity};')),
            L('For a power creep it is a PowerCreep with className, level and powers.', eng(TOMB, 'let powerCreep = new globals.PowerCreep();')),
            L('The name still leads to Memory.creeps[name], for example to read the role of the creep that died.', doc('Tombstone.creep')),
        ],
        see: ['Tombstone.store', 'mechanic:creep-death'],
    },
    'Tombstone.deathTime': {
        summary: 'Game.time of the tick in which the creep died.',
        tasks: ['when did the creep die'],
        notes: [L('Game.time − deathTime is the age of the tombstone.', eng(DIE, 'deathTime: gameTime,'))],
    },
    'Tombstone.id': {
        summary: 'Id of the tombstone, for Game.getObjectById.',
        see: ['Game.getObjectById'],
    },
    'Tombstone.ticksToDecay': {
        summary: 'Ticks until the tombstone disappears; what it still holds then drops on its tile.',
        tasks: ['how long does a tombstone last', 'how long until a tombstone decays'],
        notes: [
            L('It starts at {{TOMBSTONE_DECAY_PER_PART}} ticks per body part of the creep, {{TOMBSTONE_DECAY_POWER_CREEP}} for a power creep.',
                eng(DIE, 'let decayTime = object.body.length * C.TOMBSTONE_DECAY_PER_PART;'), eng('src/processor/global-intents/power/_diePowerCreep.js', 'decayTime: gameTime + C.TOMBSTONE_DECAY_POWER_CREEP,')),
            L('If a container stands on the tile, the dropped resources go into it as far as they fit.',
                eng(P + 'tombstones/tick.js', "require('../_create-energy')(object.x, object.y, object.room, amount, resourceType, scope);"), eng(P + '_create-energy.js', 'var toContainerAmount = Math.min(amount, container.storeCapacity - targetTotal);')),
        ],
        constants: ['TOMBSTONE_DECAY_PER_PART', 'TOMBSTONE_DECAY_POWER_CREEP'],
        see: ['mechanic:decay', 'mechanic:creep-death'],
    },

    // ---------------------------------------------------------------- ruin
    Ruin: {
        notes: [
            L('A structure destroyed by a nuke leaves no ruin, and a nuke removes the ruins already in the room.',
                eng(DESTROY, 'if(!attackType || attackType != C.EVENT_ATTACK_TYPE_NUKE) {'), eng(NUKE, "if(target.type == 'constructionSite' || target.type == 'energy' || target.type == 'tombstone' || target.type == 'ruin') {")),
            L('A ruin can be walked over.', doc('Ruin')),
        ],
        pitfalls: [
            L('withdraw on a ruin under a closed rampart of another player returns OK and moves nothing. Break the rampart first.', eng(WITHDRAW, RAMPART_RULE)),
        ],
        see: ['mechanic:decay', 'Ruin.ticksToDecay'],
    },
    'Ruin.destroyTime': {
        summary: 'Game.time of the tick in which the structure was destroyed.',
        tasks: ['when was the structure destroyed'],
        notes: [L('Game.time − destroyTime is the age of the ruin.', eng(DESTROY, 'destroyTime: gameTime,'))],
    },
    'Ruin.id': {
        summary: 'Id of the ruin, for Game.getObjectById.',
        see: ['Game.getObjectById'],
    },
    'Ruin.structure': {
        summary: 'A snapshot of the destroyed structure: id, structureType, hitsMax, hits 0, and owner and my if it had an owner. It is not a live object.',
        tasks: ['what structure was destroyed here', 'whose structure is this ruin', 'what was this ruin before'],
        notes: [
            L('Without an owner (road, container, wall) it is a plain Structure and has no owner property.', eng(RUINS, 'const structure = new globals.Structure();')),
            L('The ruins a respawn leaves belong to the game: structure.owner.username is "{{SYSTEM_USERNAME}}".',
                backend(BUTIL, "return db['users'].findOne({username: C.SYSTEM_USERNAME})"), backend(BUTIL, 'user: ""+systemUser._id')),
        ],
        see: ['Ruin.store', 'mechanic:respawn-and-start-areas'],
    },
    'Ruin.ticksToDecay': {
        summary: 'Ticks until the ruin disappears; what it still holds then drops on its tile. It starts at {{RUIN_DECAY}} for most structures.',
        tasks: ['how long does a ruin last', 'how long until a ruin decays'],
        notes: [
            L('The ruin of a power bank lasts {{RUIN_DECAY_STRUCTURES.powerBank}} ticks.', eng(DESTROY, 'decayTime: gameTime + (C.RUIN_DECAY_STRUCTURES[object.type] || C.RUIN_DECAY)')),
            L('The ruin of a stronghold structure lasts at least until the collapse time of the stronghold.', eng(DESTROY, 'ruin.decayTime = _.max([ruin.decayTime, collapseEffect.endTime]);')),
            L('Ruins made by a respawn last 500,000 ticks; ruins of what stood in the room of a newly placed first spawn last 100,000.',
                backend(BUTIL, 'decayTime: gameTime + 500000'), backend('lib/game/api/game.js', 'decayTime: gameTime + 100000')),
        ],
        constants: ['RUIN_DECAY', 'RUIN_DECAY_STRUCTURES'],
        see: ['mechanic:decay', 'mechanic:power-banks', 'mechanic:strongholds'],
    },
};
