'use strict';
// Power: text for PowerCreep and StructurePowerSpawn members, and sourced notes for the entries around them.
// Hits and store per level (1,000 and 100) are literals in the processor, not constants; the lines that use them cite the code.
const { L, eng, backend, driver, doc, article } = require('../../_h');

const G = 'src/game/';
const P = 'src/processor/intents/';
const GI = 'src/processor/global-intents/power/';
const PCG = G + 'power-creeps.js';
const PC = P + 'power-creeps/';
const UP = PC + 'usePower.js';
const RT = 'lib/runtime/runtime.js';

const ACTIONS = "var creepActions = ['move','usePower','withdraw','transfer','say','drop','pickup','enableRoom','renew'];";
const FREE_LEVELS = "var used = Object.keys(runtimeData.userPowerCreeps).length + _.sum(runtimeData.userPowerCreeps, 'level');";
const fee = L('The call queues an account intent, so an OK adds the 0.2 CPU intent fee, although the docs list the method without it.',
    driver(RT, 'pushByName(id, name, data, maxLen) {'), driver(RT, 'let intentCpu = 0.2,'));

module.exports = {
    // ---------------------------------------------------------------- PowerCreep
    PowerCreep: {
        tasks: ['what can a power creep do', 'power creep hits and capacity'],
        notes: [
            L('A new power creep has 1,000 hits and a store of 100; each level adds 1,000 hits and 100 capacity.',
                eng(GI + 'createPowerCreep.js', 'hitsMax: 1000,'), eng(GI + 'upgradePowerCreep.js', 'let storeCapacity = powerCreep.storeCapacity + 100;')),
            L('It has no body and no fatigue: one tile costs it one tick on any terrain.', eng(P + 'movement.js', "return object.type == 'powerCreep' ||")),
            L('It can move, carry, say, use powers, enable a room and renew. It has no call to harvest, build, repair, attack or heal.', eng(PC + 'intents.js', ACTIONS)),
            L('POWER_CLASS.OPERATOR is the only class the code accepts; the docs describe two more as not built yet.',
                eng(PCG, 'if(Object.values(C.POWER_CLASS).indexOf(className) === -1) {'), article('power')),
        ],
        pitfalls: [
            L('FIND_CREEPS, FIND_MY_CREEPS and FIND_HOSTILE_CREEPS leave power creeps out: use the FIND_*_POWER_CREEPS constants for them.',
                eng(G + 'game.js', 'addObjectToFindCache(register, C.FIND_POWER_CREEPS, register.powerCreeps[i], object);')),
        ],
        constants: ['POWER_CREEP_LIFE_TIME', 'POWER_CREEP_MAX_LEVEL', 'POWER_CREEP_SPAWN_COOLDOWN'],
        see: ['mechanic:power-creeps', 'mechanic:powers', 'recipe:operator-routine', 'recipe:level-a-power-creep', 'Game.powerCreeps'],
    },
    'PowerCreep.create': {
        notes: [
            L('Free levels = GPL level − number of power creeps − sum of their levels. Without one the call returns ERR_NOT_ENOUGH_RESOURCES.', eng(PCG, FREE_LEVELS)),
            L('The new creep is level 0 with 1,000 hits and a store of 100, and is not on cooldown: it can be spawned in the next tick.',
                eng(GI + 'createPowerCreep.js', 'spawnCooldownTime: 0,'), eng(GI + 'createPowerCreep.js', 'storeCapacity: 100,')),
            fee,
        ],
        pitfalls: [
            L('The call accepts a name of up to 100 characters, but the processor keeps the first 50. A longer name is stored cut, and Game.powerCreeps has it under the cut name.',
                eng(PCG, 'if(!name || !_.isString(name) || (name.length > 100)) {'), eng(GI + 'createPowerCreep.js', 'var name = intent.name.substring(0,50);')),
        ],
        constants: ['POWER_CLASS', 'POWER_LEVEL_MULTIPLY', 'POWER_LEVEL_POW'],
        see: ['mechanic:power-creeps', 'recipe:level-a-power-creep'],
    },
    'PowerCreep.className': {
        summary: 'Class of the power creep. The constants know one class: POWER_CLASS.OPERATOR, the string "{{POWER_CLASS.OPERATOR}}".',
        tasks: ['class of a power creep', 'is this power creep an operator'],
        notes: [L('The class decides which powers upgrade() accepts: POWER_INFO[power].className must be the same.', eng(PCG, 'if(!powerInfo || powerInfo.className !== this.className) {'))],
        constants: ['POWER_CLASS'],
        see: ['PowerCreep.create', 'const:power'],
    },
    'PowerCreep.deleteTime': {
        summary: 'Timestamp in milliseconds at which the power creep will be removed from the account. Undefined when no deletion is pending.',
        tasks: ['is my power creep being deleted', 'when is a power creep deleted'],
        notes: [
            L('delete() sets it to now + {{POWER_CREEP_DELETE_COOLDOWN / 3600000}} hours; delete(true) and spawn() clear it.',
                eng(GI + 'deletePowerCreep.js', 'bulkUsersPowerCreeps.update(powerCreep._id, {deleteTime: Date.now() + C.POWER_CREEP_DELETE_COOLDOWN});'),
                eng(GI + 'deletePowerCreep.js', 'bulkUsersPowerCreeps.update(powerCreep._id, {deleteTime: null});'), eng(GI + 'spawnPowerCreep.js', 'deleteTime: null')),
        ],
        pitfalls: [L('It is real time: compare it with Date.now(), not with Game.time.', eng(GI + 'deletePowerCreep.js', 'bulkUsersPowerCreeps.update(powerCreep._id, {deleteTime: Date.now() + C.POWER_CREEP_DELETE_COOLDOWN});'))],
        constants: ['POWER_CREEP_DELETE_COOLDOWN'],
        see: ['PowerCreep.delete', 'PowerCreep.spawnCooldownTime'],
    },
    'PowerCreep.hits': {
        summary: 'Current hits of the power creep. At 0 it dies and goes back to the account.',
        tasks: ['how damaged is my power creep', 'heal a power creep'],
        notes: [
            L('Every spawn starts at hitsMax.', eng(GI + 'spawnPowerCreep.js', 'hits: powerCreep.hitsMax,')),
            L('Hits change only through damage and healing from others: creeps and towers can heal it, renew() resets the age and not the hits.',
                eng(PC + 'tick.js', 'hits += object._healToApply;'), eng(P + 'towers/heal.js', "if(!target || target.type != 'creep' && target.type !== 'powerCreep') {"), eng(PC + 'renew.js', 'bulk.update(object, {ageTime: gameTime + C.POWER_CREEP_LIFE_TIME});')),
            L('It dies in the tick its hits reach 0: the check runs after the rooms of that tick are processed.',
                eng('src/processor/global-intents/power.js', 'if(gameTime >= creep.ageTime-1 || creep.hits <= 0) {'), eng('src/main.js', "stage = 'global';")),
        ],
        see: ['PowerCreep.hitsMax', 'Creep.heal', 'StructureTower.heal', 'mechanic:power-creeps'],
    },
    'PowerCreep.hitsMax': {
        summary: 'Maximum hits of the power creep: 1,000 plus 1,000 per level, so {{(POWER_CREEP_MAX_LEVEL + 1) * 1000}} at level {{POWER_CREEP_MAX_LEVEL}}.',
        tasks: ['how many hits does a power creep have', 'max hits of a power creep'],
        notes: [
            L('A new creep gets 1,000; each upgrade adds 1,000, also on a creep that is spawned at that moment.',
                eng(GI + 'createPowerCreep.js', 'hitsMax: 1000,'), eng(GI + 'upgradePowerCreep.js', 'let hitsMax = powerCreep.hitsMax + 1000;'), eng(GI + 'upgradePowerCreep.js', 'if(roomPowerCreep) {')),
        ],
        constants: ['POWER_CREEP_MAX_LEVEL'],
        see: ['PowerCreep.hits', 'PowerCreep.level', 'PowerCreep.upgrade'],
    },
    'PowerCreep.id': {
        summary: 'Id of the power creep. It belongs to the account record, so it is the same before the first spawn and after every respawn.',
        tasks: ['id of a power creep'],
        notes: [
            L('The room object is inserted under the id of the account record.', eng(GI + 'spawnPowerCreep.js', '}), powerCreep._id);')),
            L('Game.getObjectById returns it only while it is an object in a room you see; Game.powerCreeps[name] always has it.',
                eng(G + 'game.js', 'register._objects[i] = register.powerCreeps[i];'), eng(G + 'game.js', 'game.powerCreeps[register.powerCreeps[i].name] = register.powerCreeps[i];')),
        ],
        see: ['Game.powerCreeps', 'Game.getObjectById'],
    },
    'PowerCreep.level': {
        summary: 'Level of the power creep, 0 to {{POWER_CREEP_MAX_LEVEL}}. It is the number of power levels taken with upgrade().',
        tasks: ['level of a power creep', 'max level of a power creep'],
        notes: [
            L('The creep uses level + 1 Global Power Levels: one for the creep and one per level.', eng(PCG, FREE_LEVELS)),
            L('The level decides which power levels can be taken next: POWER_INFO[power].level lists the creep level needed.', eng(PCG, 'if(this.level < powerInfo.level[powerLevel]) {')),
        ],
        constants: ['POWER_CREEP_MAX_LEVEL'],
        see: ['PowerCreep.upgrade', 'PowerCreep.powers', 'recipe:level-a-power-creep'],
    },
    'PowerCreep.memory': {
        summary: 'Shortcut to Memory.powerCreeps[name], the memory object of this power creep.',
        tasks: ['memory of a power creep', 'store data on a power creep'],
        notes: [
            L('Reading it creates Memory.powerCreeps and the entry when they are missing. For another player\'s creep it is undefined.',
                eng(PCG, 'return globals.Memory.powerCreeps[this.name] = globals.Memory.powerCreeps[this.name] || {};'), eng(PCG, 'if(this.id && !this.my) {')),
            L('moveTo keeps its reused path there under _move.', eng(G + 'creeps.js', 'this.memory._move = {')),
        ],
        pitfalls: [
            L('The key is the name. After rename() the creep reads a fresh object under the new name and the old entry stays in Memory: move it yourself.',
                eng(GI + 'renamePowerCreep.js', 'bulkUsersPowerCreeps.update(powerCreep._id, {name});')),
        ],
        see: ['Memory', 'PowerCreep.rename', 'mechanic:memory'],
    },
    'PowerCreep.my': {
        summary: 'True for your own power creeps.',
        tasks: ['is this power creep mine'],
        see: ['PowerCreep.owner'],
    },
    'PowerCreep.name': {
        summary: 'Name of the power creep and its key in Game.powerCreeps. Given in create(); rename() changes it while the creep is not spawned.',
        tasks: ['name of a power creep', 'get a power creep by name'],
        pitfalls: [
            L('Names are stored with at most 50 characters; create and rename cut longer ones.',
                eng(GI + 'createPowerCreep.js', 'var name = intent.name.substring(0,50);'), eng(GI + 'renamePowerCreep.js', 'var name = intent.name.substring(0,50);')),
        ],
        notes: [L('Two power creeps of one account cannot share a name (ERR_NAME_EXISTS).', eng(PCG, 'if(_.any(runtimeData.userPowerCreeps, {name})) {'))],
        see: ['Game.powerCreeps', 'PowerCreep.rename', 'PowerCreep.memory'],
    },
    'PowerCreep.owner': {
        summary: '{username} of the player who owns the power creep.',
        tasks: ['who owns a power creep'],
        see: ['PowerCreep.my'],
    },
    'PowerCreep.store': {
        summary: 'What the power creep carries: ops and any other resource in one shared capacity of 100 plus 100 per level, {{(POWER_CREEP_MAX_LEVEL + 1) * 100}} at level {{POWER_CREEP_MAX_LEVEL}}.',
        tasks: ['how much can a power creep carry', 'how many ops does my power creep have', 'free capacity of a power creep', 'power creep store capacity'],
        notes: [
            L('A new creep holds 100; each upgrade adds 100.', eng(GI + 'createPowerCreep.js', 'storeCapacity: 100,'), eng(GI + 'upgradePowerCreep.js', 'let storeCapacity = powerCreep.storeCapacity + 100;')),
            L('Powers are paid from store.ops of this creep.', eng(UP, 'if((object.store.ops || 0) < ops) {')),
            L('PWR_GENERATE_OPS above the capacity drops the excess ops on the tile.', eng(UP, 'if (sum > object.storeCapacity) {')),
            L('On death the whole store goes into the tombstone; the creep respawns empty.', eng(GI + '_diePowerCreep.js', 'tombstone.store[resourceType] = (tombstone.store[resourceType] || 0) + amount;')),
        ],
        constants: ['RESOURCE_OPS', 'POWER_CREEP_MAX_LEVEL', 'TOMBSTONE_DECAY_POWER_CREEP'],
        see: ['Store.getFreeCapacity', 'Store.getUsedCapacity', 'Store.getCapacity', 'mechanic:ops', 'PowerCreep.withdraw', 'PowerCreep.transfer'],
    },
    'PowerCreep.powers': {
        summary: 'The powers this creep has, keyed by power id: {level, cooldown}. cooldown is the number of ticks until that power can be used again, 0 when it is ready.',
        tasks: ['is a power ready', 'power cooldown of a power creep', 'which powers does my power creep have', 'level of a power on a power creep'],
        notes: [
            L('cooldown = max(0, time the power is ready − Game.time).', eng(PCG, 'cooldown: Math.max(0, (i.cooldownTime || 0) - runtimeData.time)')),
            L('A power the creep never took is not in the object: test powers[PWR_X] before reading its fields. usePower then returns ERR_NO_BODYPART.',
                eng(PCG, 'if(!powerData || !powerData.level || !powerInfo) {')),
            L('Each power has its own cooldown, started when the power is applied: one power on cooldown does not block another.',
                eng(UP, 'cooldownTime: gameTime + powerInfo.cooldown')),
        ],
        constants: ['POWER_INFO'],
        see: ['PowerCreep.usePower', 'PowerCreep.upgrade', 'const:power', 'mechanic:powers'],
    },
    'PowerCreep.saying': {
        summary: 'The text the power creep said in the last tick. For another player\'s creep only a public message shows.',
        tasks: ['what did a power creep say'],
        notes: [
            L('Other players see it only when say() was called with public = true.', eng(PCG, 'return o.actionLog.say.isPublic ? o.actionLog.say.message : undefined;')),
            L('The text is cut to 10 characters.', eng(PC + 'say.js', 'message: intent.message.substring(0,10),')),
        ],
        see: ['PowerCreep.say'],
    },
    'PowerCreep.shard': {
        summary: 'Name of the shard where the power creep is spawned. Undefined while it is not spawned.',
        tasks: ['which shard is my power creep on', 'is my power creep spawned'],
        notes: [
            L('spawn() writes the shard name, a death clears it.', eng(GI + 'spawnPowerCreep.js', 'shard: shardName,'), eng(GI + '_diePowerCreep.js', 'shard: null,')),
            L('room and pos exist only when the creep is an object in a room of this tick\'s data; the engine itself tests room to tell spawned from unspawned.',
                eng(PCG, 'if(_data.room) {'), eng(PCG, 'if(!this.room) {')),
        ],
        see: ['PowerCreep.spawn', 'Game.powerCreeps'],
    },
    'PowerCreep.spawnCooldownTime': {
        summary: 'Timestamp in milliseconds before which the power creep cannot be spawned: {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours after its death. Undefined when that time has passed and while the creep is spawned.',
        tasks: ['when can I respawn my power creep', 'how long until a power creep can respawn', 'power creep spawn cooldown', 'is a power creep ready to spawn'],
        notes: [
            L('A death sets it to the real time of death + {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours.', eng(GI + '_diePowerCreep.js', 'spawnCooldownTime: Date.now() + C.POWER_CREEP_SPAWN_COOLDOWN')),
            L('While it is set, spawn() returns ERR_TIRED.', eng(PCG, 'if(this.spawnCooldownTime) {')),
        ],
        pitfalls: [
            L('It counts real time, not ticks: compare it with Date.now().', eng(PCG, 'spawnCooldownTime: (o) => o.spawnCooldownTime !== null && o.spawnCooldownTime > Date.now() ? o.spawnCooldownTime : undefined,')),
            L('undefined means "spawned" as well as "ready to spawn". Tell the two apart by powerCreep.room.',
                eng(PCG, 'spawnCooldownTime: (o) => o.spawnCooldownTime !== null && o.spawnCooldownTime > Date.now() ? o.spawnCooldownTime : undefined,'), eng(PCG, 'if(this.room) {')),
        ],
        constants: ['POWER_CREEP_SPAWN_COOLDOWN'],
        see: ['PowerCreep.spawn', 'PowerCreep.deleteTime', 'mechanic:power-creeps'],
    },
    'PowerCreep.ticksToLive': {
        summary: 'Ticks until the power creep dies of age. Spawn and renew() set it to {{POWER_CREEP_LIFE_TIME}}; an aged creep is not lost, it returns to the account.',
        tasks: ['how long does a power creep live', 'when to renew a power creep', 'remaining life of a power creep'],
        notes: [
            L('The creep dies at the end of the tick in which the value is 1. A renew() in that tick still saves it, because rooms are processed first.',
                eng('src/processor/global-intents/power.js', 'if(gameTime >= creep.ageTime-1 || creep.hits <= 0) {'), eng('src/main.js', "stage = 'global';")),
            L('renew() is free, so there is no reason to let it run low: renew whenever the creep stands next to a power spawn or a power bank.',
                eng(PC + 'renew.js', 'bulk.update(object, {ageTime: gameTime + C.POWER_CREEP_LIFE_TIME});'), article('power')),
        ],
        pitfalls: [
            L('For a creep that is not spawned the value is NaN, not undefined as the docs say: there is no age to subtract from. Test powerCreep.room first.',
                eng(PCG, 'ticksToLive: (o) => o.ageTime - runtimeData.time,'), doc('PowerCreep.ticksToLive')),
            L('Dying of age costs the same {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours as being killed.', eng(GI + '_diePowerCreep.js', 'spawnCooldownTime: Date.now() + C.POWER_CREEP_SPAWN_COOLDOWN')),
        ],
        constants: ['POWER_CREEP_LIFE_TIME', 'POWER_CREEP_SPAWN_COOLDOWN'],
        see: ['PowerCreep.renew', 'PowerCreep.spawn', 'mechanic:power-creeps'],
    },
    'PowerCreep.cancelOrder': {
        tasks: ['cancel an order of a power creep', 'undo usePower in the same tick'],
        notes: [
            L('It removes an order given to the creep in this tick: move, usePower, withdraw, transfer, drop, pickup, say, enableRoom, renew or notifyWhenAttacked.',
                eng(PCG, 'if(intents.remove(this.id, name)) {'), eng(PC + 'intents.js', ACTIONS)),
        ],
        pitfalls: [
            L('spawn, upgrade, delete, rename and suicide are queued for the account, not for the creep: cancelOrder returns ERR_NOT_FOUND for them.',
                eng(PCG, "intents.pushByName('global', 'suicidePowerCreep', {id: this.id}, 50);")),
        ],
    },
    'PowerCreep.delete': {
        notes: [
            L('When the timer ends the creep is removed and the account drops one GPL level, with the same share of progress inside the lower level.',
                backend('lib/cronjobs.js', 'var change = Math.round(user.power - basePrev -'), article('power')),
            L('The levels the creep used become free: deleting a level N creep frees N + 1 levels and costs 1.', eng(PCG, FREE_LEVELS)),
            L('During an experimentation period (started in the game client, 24 hours) the creep is removed at once and no GPL is lost.',
                eng(GI + 'deletePowerCreep.js', 'if(user.powerExperimentationTime > Date.now()) {'), article('power')),
            L('spawn() cancels a pending deletion as delete(true) does.', eng(GI + 'spawnPowerCreep.js', 'deleteTime: null')),
        ],
        pitfalls: [
            L('A second delete() does not restart the timer.', eng(GI + 'deletePowerCreep.js', 'if (powerCreep.deleteTime) {')),
            L('A spawned creep cannot be deleted (ERR_BUSY): call suicide() first.',
                eng(GI + 'deletePowerCreep.js', 'if (!powerCreep || powerCreep.spawnCooldownTime === null) {'), doc('PowerCreep.delete')),
        ],
        see: ['PowerCreep.deleteTime', 'Game.gpl', 'mechanic:power-creeps'],
    },
    'PowerCreep.drop': {
        tasks: ['drop ops on the ground', 'power creep drops a resource'],
        notes: [
            L('ERR_BUSY while the creep is not spawned; everything else is the code of Creep.drop.',
                eng(PCG, 'return globals.Creep.prototype.drop.call(this, resourceType, amount);'), eng(PC + 'drop.js', "require('../creeps/drop')(object, intent, scope);")),
        ],
    },
    'PowerCreep.enableRoom': {
        notes: [
            L('Any controller will do, owned or not, yours or not. Only another player\'s controller in safe mode is refused (ERR_INVALID_TARGET).',
                eng(PCG, "if(target.structureType != 'controller' || target.safeMode && !target.my) {")),
            L('Rooms without a controller need no enabling.', eng(UP, 'if(roomController) {'), article('power')),
            L('The flag is cleared when the controller loses its owner: on the downgrade to level 0 and on unclaim.',
                eng(P + 'controllers/tick.js', 'object.isPowerEnabled = false;'), eng(P + 'controllers/unclaim.js', 'isPowerEnabled: false,')),
        ],
        pitfalls: [
            L('The flag belongs to the room, not to you: once it is set, every player\'s power creep can use powers there.', eng(UP, 'if(!roomController.isPowerEnabled) {')),
        ],
        see: ['mechanic:powers'],
    },
    'PowerCreep.move': {
        tasks: ['move a power creep', 'does a power creep get tired', 'how fast is a power creep on swamp'],
        notes: [
            L('It moves every tick on road, plain and swamp: the processor adds fatigue to creeps only.', eng(P + 'movement.js', "if(object.type == 'creep') {")),
            L('Each step on a road brings the next decay of the road {{ROAD_WEAROUT_POWER_CREEP}} ticks closer: {{ROAD_WEAROUT_POWER_CREEP / (ROAD_WEAROUT * MAX_CREEP_SIZE)}} times the wear of a creep with {{MAX_CREEP_SIZE}} parts.',
                eng(P + 'movement.js', 'road.nextDecayTime -= C.ROAD_WEAROUT_POWER_CREEP;')),
            L('When a power creep and a creep with working MOVE parts want the same tile and nothing else decides, the creep gets it: a power creep counts as having no MOVE parts.',
                eng(P + 'movement.js', "var moves = object.type == 'powerCreep' ? 0 :")),
        ],
        pitfalls: [
            L('A creep cannot pull a power creep.', eng(P + 'creeps/pull.js', "if(!target || target.type != 'creep' || target.spawning) {")),
            L('A portal to another shard blocks it; portals inside the shard work.',
                eng(P + 'creeps/move.js', "object.type == 'powerCreep' && target.type == 'portal' && target.destination.shard)) {"), eng(PC + 'tick.js', 'if (portal && !portal.destination.shard) {')),
        ],
        constants: ['ROAD_WEAROUT_POWER_CREEP'],
        see: ['mechanic:movement', 'mechanic:power-creeps'],
    },
    'PowerCreep.moveByPath': {
        tasks: ['move a power creep along a stored path'],
        notes: [L('ERR_BUSY while the creep is not spawned; everything else is the code of Creep.moveByPath.', eng(PCG, 'return globals.Creep.prototype.moveByPath.call(this, path);'))],
    },
    'PowerCreep.moveTo': {
        tasks: ['move a power creep to a target', 'path for a power creep'],
        notes: [L('The path it reuses is kept in Memory.powerCreeps[name]._move.', eng(G + 'creeps.js', 'this.memory._move = {'))],
        pitfalls: [
            L('The default search plans for creeps: road 1, plain 2, swamp 10. A power creep spends one tick on any tile, so pass {plainCost: 1, swampCost: 1} for the shortest way.',
                eng(G + 'rooms.js', 'searchOpts.swampCost = 10;'), eng(P + 'movement.js', "if(object.type == 'creep') {")),
        ],
        see: ['Room.findPath', 'PowerCreep.move'],
    },
    'PowerCreep.notifyWhenAttacked': {
        tasks: ['stop attack notifications for a power creep'],
        notes: [L('Every spawn switches the notification on again.', eng(GI + 'spawnPowerCreep.js', 'notifyWhenAttacked: true'))],
    },
    'PowerCreep.pickup': {
        tasks: ['power creep picks up dropped ops', 'pick up resources with a power creep'],
        notes: [
            L('ERR_BUSY while the creep is not spawned; everything else is the code of Creep.pickup.',
                eng(PCG, 'return globals.Creep.prototype.pickup.call(this, target);'), eng(PC + 'pickup.js', "require('../creeps/pickup')(object, intent, scope);")),
        ],
    },
    'PowerCreep.rename': {
        notes: [fee],
        pitfalls: [
            L('Memory.powerCreeps keeps the entry under the old name; the creep starts with an empty memory under the new one.',
                eng(GI + 'renamePowerCreep.js', 'bulkUsersPowerCreeps.update(powerCreep._id, {name});'), eng(PCG, 'return globals.Memory.powerCreeps[this.name] = globals.Memory.powerCreeps[this.name] || {};')),
            L('The new name is cut to 50 characters, and a name another of your power creeps has is refused.',
                eng(GI + 'renamePowerCreep.js', 'var name = intent.name.substring(0,50);'), eng(GI + 'renamePowerCreep.js', 'if(_.any(thisUserPowerCreeps, {name})) {')),
        ],
        see: ['PowerCreep.name', 'PowerCreep.memory'],
    },
    'PowerCreep.renew': {
        notes: [
            L('Any power bank works, and any power spawn that is active in its room. The code does not ask who owns the power spawn.',
                eng(PC + 'renew.js', "if(target.type == 'powerSpawn' && !utils.checkStructureAgainstController(target, roomObjects, roomController)) {"), article('power')),
            L('It costs nothing and has no cooldown. Only the age is reset; hits stay as they are.', eng(PC + 'renew.js', 'bulk.update(object, {ageTime: gameTime + C.POWER_CREEP_LIFE_TIME});'), article('power')),
            L('It can share a tick with move, usePower, withdraw and transfer: each is its own order.', eng(PC + 'intents.js', ACTIONS)),
        ],
        see: ['PowerCreep.ticksToLive', 'StructurePowerSpawn', 'StructurePowerBank', 'mechanic:power-creeps'],
    },
    'PowerCreep.say': {
        tasks: ['make a power creep say something'],
        notes: [
            L('The text is cut to 10 characters.', eng(PC + 'say.js', 'message: intent.message.substring(0,10),')),
            L('say is free of the intent fee, as for creeps.', driver(RT, 'freeMethods = systemFunctions.Object.create(null, {say: {value: true}, pull:{value:true}});')),
        ],
    },
    'PowerCreep.spawn': {
        notes: [
            L('The creep appears on the tile of the power spawn itself, with full hits and {{POWER_CREEP_LIFE_TIME}} ticks to live, and has to walk off it.',
                eng(GI + 'spawnPowerCreep.js', 'y: powerSpawn.y,'), eng(GI + 'spawnPowerCreep.js', 'ageTime: gameTime + C.POWER_CREEP_LIFE_TIME,')),
            L('Spawning takes no energy and no power: the processor marks the creep as spawned and inserts it into the room.', eng(GI + 'spawnPowerCreep.js', 'bulkObjects.insert(Object.assign({}, powerCreep, {')),
            L('It cancels a pending deletion.', eng(GI + 'spawnPowerCreep.js', 'deleteTime: null')),
            L('The creep starts with an empty store and with attack notifications on.', eng(GI + 'spawnPowerCreep.js', 'notifyWhenAttacked: true'), eng(GI + 'createPowerCreep.js', 'store: {},')),
        ],
        pitfalls: [
            L('One power creep per power spawn per tick, and none while another power creep stands on the power spawn tile. The call returned OK; check for the creep next tick and try again.',
                eng(GI + 'spawnPowerCreep.js', 'if(_.any(roomObjectsByType.powerCreep, {room: powerSpawn.room, x: powerSpawn.x, y: powerSpawn.y})) {'), eng(GI + 'spawnPowerCreep.js', 'powerSpawn._justSpawned = true;')),
            L('ERR_TIRED means the respawn cooldown is running: read spawnCooldownTime and wait.', eng(PCG, 'if(this.spawnCooldownTime) {')),
        ],
        see: ['PowerCreep.spawnCooldownTime', 'StructurePowerSpawn', 'mechanic:power-creeps'],
    },
    'PowerCreep.suicide': {
        tasks: ['kill my power creep', 'unspawn a power creep'],
        pitfalls: [
            L('It is a death like any other: the {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}}-hour respawn cooldown starts.',
                eng('src/processor/global-intents/power/suicidePowerCreep.js', "require('./_diePowerCreep')(powerCreep, scope);"), eng(GI + '_diePowerCreep.js', 'spawnCooldownTime: Date.now() + C.POWER_CREEP_SPAWN_COOLDOWN')),
        ],
        notes: [
            L('What it carries goes into a tombstone that lasts {{TOMBSTONE_DECAY_POWER_CREEP}} ticks.', eng(GI + '_diePowerCreep.js', 'decayTime: gameTime + C.TOMBSTONE_DECAY_POWER_CREEP,')),
        ],
        constants: ['POWER_CREEP_SPAWN_COOLDOWN', 'TOMBSTONE_DECAY_POWER_CREEP'],
        see: ['PowerCreep.spawn', 'PowerCreep.delete', 'mechanic:power-creeps'],
    },
    'PowerCreep.transfer': {
        tasks: ['put ops into the storage', 'power creep gives a resource to a structure'],
        notes: [
            L('ERR_BUSY while the creep is not spawned; everything else is the code of Creep.transfer.',
                eng(PCG, 'return globals.Creep.prototype.transfer.call(this, target, resourceType, amount);'), eng(PC + 'transfer.js', "require('../creeps/transfer')(object, intent, scope);")),
        ],
        pitfalls: [
            L('transfer(controller, RESOURCE_ENERGY) throws an error: the shared code hands that case to upgradeController, which a power creep does not have.',
                eng(G + 'creeps.js', 'return this.upgradeController(target);')),
        ],
        see: ['mechanic:ops'],
    },
    'PowerCreep.upgrade': {
        notes: [
            L('Each upgrade adds one creep level, 1,000 hits and 100 store capacity. It works on a spawned creep too.',
                eng(GI + 'upgradePowerCreep.js', 'let hitsMax = powerCreep.hitsMax + 1000;'), eng(GI + 'upgradePowerCreep.js', 'if(roomPowerCreep) {')),
            L('A power has 5 levels. Level k needs the creep at POWER_INFO[power].level[k − 1] before the call; otherwise ERR_FULL.',
                eng(PCG, 'if(this.level < powerInfo.level[powerLevel]) {'), eng(PCG, 'if(powerLevel == 5) {')),
            L('It needs a free level: GPL level − number of power creeps − sum of their levels.', eng(PCG, FREE_LEVELS)),
            L('The upgrade is done after the rooms of the tick: the new level shows in the next tick.', eng('src/main.js', "stage = 'global';")),
        ],
        pitfalls: [
            L('A level cannot be moved to another power later. The only reset is deleting the creep, which costs a GPL level outside an experimentation period.', article('power')),
        ],
        constants: ['POWER_INFO'],
        see: ['recipe:level-a-power-creep', 'mechanic:power-creeps', 'PowerCreep.level', 'PowerCreep.powers'],
    },
    'PowerCreep.usePower': {
        notes: [
            L('One power per creep per tick: a second usePower call in the tick replaces the first.',
                eng(PCG, "intents.set(this.id, 'usePower', {power, id: target ? target.id : undefined});"), doc('PowerCreep.usePower')),
            L('Powers without a range in POWER_INFO (PWR_GENERATE_OPS, PWR_SHIELD) take no target.', eng(PCG, 'if(powerInfo.range) {')),
            L('The same power on the same target at an equal or higher level replaces the effect and starts its time again; it does not add up.', eng(UP, '_.remove(effects, {power: intent.power});')),
            L('Ops are checked against the store as it was at the start of the tick and taken when the power is applied.',
                eng(PCG, 'if((data(this.id).store.ops || 0) < ops) {'), eng(UP, 'store: {ops: (object.store.ops || 0) - ops}')),
            L('Each use is written to the room event log as EVENT_POWER with the power and the target id.', eng(UP, 'eventLog.push({event: C.EVENT_POWER, objectId: object._id, data: {')),
        ],
        pitfalls: [
            L('The call does not check the type of the target. A wrong target returns OK and nothing happens: no ops spent, no cooldown.', eng(UP, "if(target.type != 'spawn') {")),
            L('ERR_INVALID_ARGS also in another player\'s room that is in safe mode, even with powers enabled.', eng(PCG, 'if (!this.room.controller.my && this.room.controller.safeMode) {')),
            L('ERR_NO_BODYPART means the creep has not taken that power, not that a body part is missing.', eng(PCG, 'if(!powerData || !powerData.level || !powerInfo) {')),
        ],
        see: ['mechanic:powers', 'mechanic:ops', 'recipe:operator-routine', 'PowerCreep.powers', 'RoomObject.effects'],
    },
    'PowerCreep.withdraw': {
        tasks: ['take ops out of the storage', 'power creep takes a resource from a structure'],
        notes: [
            L('ERR_BUSY while the creep is not spawned; everything else is the code of Creep.withdraw.',
                eng(PCG, 'return globals.Creep.prototype.withdraw.call(this, target, resourceType, amount);'), eng(PC + 'withdraw.js', "require('../creeps/withdraw')(object, intent, scope);")),
        ],
        pitfalls: [
            L('usePower is processed before withdraw: ops taken out in this tick pay for a power in the next tick at the earliest.', eng(PC + 'intents.js', ACTIONS)),
            L('A terminal under PWR_DISRUPT_TERMINAL gives nothing (ERR_INVALID_TARGET).', eng(P + 'creeps/withdraw.js', 'var effect = _.find(target.effects, {power: C.PWR_DISRUPT_TERMINAL});')),
        ],
        see: ['mechanic:ops'],
    },

    // ---------------------------------------------------------------- StructurePowerSpawn
    StructurePowerSpawn: {
        tasks: ['where does a power creep spawn'],
        notes: [
            L('A power creep spawns on the tile of the power spawn itself, and renews from range 1.',
                eng(GI + 'spawnPowerCreep.js', 'y: powerSpawn.y,'), eng(PC + 'renew.js', 'if(utils.dist(object, target) > 1) {')),
            L('Spawning and renewing a power creep take nothing from its store.',
                eng(GI + 'spawnPowerCreep.js', 'bulkObjects.insert(Object.assign({}, powerCreep, {'), eng(PC + 'renew.js', 'bulk.update(object, {ageTime: gameTime + C.POWER_CREEP_LIFE_TIME});')),
            L('Under PWR_OPERATE_POWER one processPower call handles 1 + {{POWER_INFO[PWR_OPERATE_POWER].effect.join(" / ")}} power.',
                eng(P + 'power-spawns/process-power.js', 'amount = Math.min(object.store.power, amount + C.POWER_INFO[C.PWR_OPERATE_POWER].effect[effect.level-1]);')),
            L('It has {{POWER_SPAWN_HITS}} hits and holds {{POWER_SPAWN_ENERGY_CAPACITY}} energy and {{POWER_SPAWN_POWER_CAPACITY}} power.',
                eng(P + 'creeps/build.js', 'storeCapacityResource: {energy: C.POWER_SPAWN_ENERGY_CAPACITY, power: C.POWER_SPAWN_POWER_CAPACITY},')),
        ],
        constants: ['POWER_SPAWN_HITS', 'CONTROLLER_STRUCTURES.powerSpawn'],
        see: ['mechanic:power-processing', 'PowerCreep.spawn', 'PowerCreep.renew', 'StructurePowerSpawn.store'],
    },
    'StructurePowerSpawn.store': {
        summary: 'What the power spawn holds: up to {{POWER_SPAWN_ENERGY_CAPACITY}} energy and up to {{POWER_SPAWN_POWER_CAPACITY}} power, each with its own capacity.',
        tasks: ['how much power is in the power spawn', 'fill a power spawn', 'power spawn capacity', 'does the power spawn need energy'],
        notes: [
            L('The two capacities are separate, so getCapacity and getFreeCapacity need the resource: store.getFreeCapacity(RESOURCE_POWER).',
                eng(P + 'creeps/build.js', 'storeCapacityResource: {energy: C.POWER_SPAWN_ENERGY_CAPACITY, power: C.POWER_SPAWN_POWER_CAPACITY},')),
            L('A full load is used up together: {{POWER_SPAWN_POWER_CAPACITY}} power takes {{POWER_SPAWN_POWER_CAPACITY * POWER_SPAWN_ENERGY_RATIO}} energy.',
                eng(P + 'power-spawns/process-power.js', 'object.store.energy -= amount * C.POWER_SPAWN_ENERGY_RATIO;')),
        ],
        constants: ['POWER_SPAWN_ENERGY_CAPACITY', 'POWER_SPAWN_POWER_CAPACITY', 'POWER_SPAWN_ENERGY_RATIO'],
        see: ['StructurePowerSpawn.processPower', 'Store.getFreeCapacity', 'Creep.transfer', 'mechanic:power-processing'],
    },
    'StructurePowerSpawn.processPower': {
        notes: [
            L('Each processed power adds 1 to the power total of the account, which Game.gpl is computed from.',
                eng(P + 'power-spawns/process-power.js', "bulkUsers.inc(object.user, 'power', amount);")),
            L('Under PWR_OPERATE_POWER one call handles 1 + {{POWER_INFO[PWR_OPERATE_POWER].effect.join(" / ")}} power, with {{POWER_SPAWN_ENERGY_RATIO}} energy each.',
                eng(P + 'power-spawns/process-power.js', 'amount = Math.min(object.store.power, amount + C.POWER_INFO[C.PWR_OPERATE_POWER].effect[effect.level-1]);')),
            L('One call per power spawn per tick: a second call replaces the first.', eng(G + 'structures.js', "intents.set(this.id, 'processPower', {});")),
        ],
        pitfalls: [
            L('Under PWR_OPERATE_POWER the call returns ERR_NOT_ENOUGH_RESOURCES unless the power spawn holds the whole raised amount of power and the energy for it. A smaller rest of power waits until the effect ends.',
                eng(G + 'structures.js', 'if(this.power < amount || this.energy < amount * C.POWER_SPAWN_ENERGY_RATIO) {')),
        ],
        see: ['mechanic:power-processing', 'StructurePowerSpawn.store', 'mechanic:powers'],
    },

    // ---------------------------------------------------------------- entries around them: notes only
    'Game.gpl': {
        notes: [
            L('level = floor((total power / {{POWER_LEVEL_MULTIPLY}}) ^ (1/{{POWER_LEVEL_POW}})); progress = total − {{POWER_LEVEL_MULTIPLY}} × level^{{POWER_LEVEL_POW}}; progressTotal = the size of the step to the next level, (2 × level + 1) × {{POWER_LEVEL_MULTIPLY}}.',
                eng(G + 'game.js', 'var gplLevel = Math.floor(Math.pow((runtimeData.user.power || 0) / C.POWER_LEVEL_MULTIPLY, 1 / C.POWER_LEVEL_POW)),'),
                eng(G + 'game.js', 'progressTotal: Math.pow(gplLevel+1, 2) * 1000 - gplBaseProgress')),
            L('The total rises by 1 for each power a power spawn processes.', eng(P + 'power-spawns/process-power.js', "bulkUsers.inc(object.user, 'power', amount);")),
            L('Free levels are not in Game.gpl: subtract one per power creep and one per level of each.', eng(PCG, FREE_LEVELS)),
            L('The level can go down: removing a deleted power creep takes one level off.', backend('lib/cronjobs.js', 'var change = Math.round(user.power - basePrev -'), article('power')),
        ],
        see: ['mechanic:power-processing', 'mechanic:power-creeps'],
    },
    'Game.powerCreeps': {
        notes: [
            L('It holds every power creep of the account by name, spawned or not.', eng(G + 'game.js', 'game.powerCreeps[register.powerCreeps[i].name] = register.powerCreeps[i];')),
            L('An unspawned one has no room and no pos, and the calls that need a room return ERR_BUSY.', eng(PCG, 'if(_data.room) {'), eng(PCG, 'if(!this.room) {')),
        ],
        see: ['PowerCreep', 'mechanic:power-creeps'],
    },
    'RoomObject.effects': {
        notes: [
            L('Each entry is {power, effect, level, ticksRemaining}. For an effect made by a power, power and effect are both the PWR_* id.',
                eng(G + 'rooms.js', 'ticksRemaining: i.endTime - runtimeData.time'), eng(UP, 'effect: intent.power,')),
            L('Entries whose time is up are left out, so everything in the list is active.', eng(G + 'rooms.js', '})).filter(i => i.ticksRemaining > 0).value();')),
            L('The property is undefined on an object that never had an effect: write (object.effects || []).', eng(G + 'rooms.js', 'if(effects) {')),
            L('An object holds at most one entry per power: using the power again replaces it.', eng(UP, '_.remove(effects, {power: intent.power});')),
            L('EFFECT_INVULNERABILITY and EFFECT_COLLAPSE_TIMER come from strongholds, not from power creeps.',
                backend('lib/strongholds.js', 'effect: C.EFFECT_INVULNERABILITY,'), eng(P + 'invader-core/stronghold/stronghold.js', 'effect: C.EFFECT_COLLAPSE_TIMER,')),
        ],
        see: ['mechanic:powers', 'PowerCreep.usePower'],
    },
    'StructureController.isPowerEnabled': {
        notes: [
            L('PowerCreep.enableRoom sets it, from range 1, on any controller.', eng(PC + 'enableRoom.js', 'bulk.update(target, {isPowerEnabled: true});')),
            L('While it is false, usePower in the room returns ERR_INVALID_ARGS for every player.', eng(PCG, 'if (!this.room.controller.isPowerEnabled) {')),
            L('It is cleared when the controller loses its owner: on the downgrade to level 0 and on unclaim.',
                eng(P + 'controllers/tick.js', 'object.isPowerEnabled = false;'), eng(P + 'controllers/unclaim.js', 'isPowerEnabled: false,')),
        ],
        see: ['PowerCreep.enableRoom', 'mechanic:powers'],
    },
};
