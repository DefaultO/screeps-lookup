'use strict';
// Economy pack: own text for Mineral, Deposit, Resource, Store, the lab, terminal, factory, extractor,
// storage, container and link members, and Game.market. Members that had no own text get a summary;
// the others get added lines only.
const { L, eng, backend, driver, common, doc, article } = require('../../_h');
const P = 'src/processor/intents/';
const STRUCT = 'src/game/structures.js';
const CREEPS = 'src/game/creeps.js';
const STORE = 'src/game/store.js';
const UTILS = 'src/utils.js';
const MARKET_API = 'src/game/market.js';
const MARKET = 'src/processor/global-intents/market.js';
const CRON = 'lib/cronjobs.js';
const RUNTIME_DATA = 'lib/runtime/data.js';

const UNBOOST_TIME = 'return a + boostedParts[r]*utils.calcTotalReactionsTime(r)*C.LAB_UNBOOST_MINERAL/C.LAB_REACTION_AMOUNT;';
// lab cooldown per unboosted part: all reaction times of the chain x LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT
const XLHO2_PART = '{{(REACTION_TIME.XLHO2 + REACTION_TIME.LHO2 + REACTION_TIME.LO + REACTION_TIME.OH) * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT}}';
const XGHO2_PART = '{{(REACTION_TIME.XGHO2 + REACTION_TIME.GHO2 + REACTION_TIME.GO + REACTION_TIME.OH + REACTION_TIME.G + REACTION_TIME.ZK + REACTION_TIME.UL) * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT}}';

module.exports = {
    // ---------------------------------------------------------------- mineral
    Mineral: {
        tasks: ['find the mineral of a room'],
        notes: [
            L('A room has one mineral of one type.', article('resources')),
            L('It blocks movement: creeps harvest it from a neighbouring tile.', common('lib/constants.js', 'OBSTACLE_OBJECT_TYPES: ['), eng(P + 'movement.js', '_.contains(C.OBSTACLE_OBJECT_TYPES, i.type)')),
        ],
        see: ['mechanic:minerals-and-extractors', 'recipe:mine-minerals', 'Mineral.mineralAmount', 'Mineral.density'],
    },
    'Mineral.density': {
        summary: 'Density class {{DENSITY_LOW}} to {{DENSITY_ULTRA}} (DENSITY_LOW … DENSITY_ULTRA). It decides how much the next refill holds: {{MINERAL_DENSITY[1]}}, {{MINERAL_DENSITY[2]}}, {{MINERAL_DENSITY[3]}} or {{MINERAL_DENSITY[4]}}.',
        tasks: ['mineral density', 'how much will the mineral hold after it refills'],
        pitfalls: [
            L('Right after a refill the density can already be a new one: the refill uses the old density, then the density is drawn again for the refill after that. Read mineralAmount for what is there now.', eng(P + 'minerals/tick.js', 'update.density = object.density = newDensity;')),
        ],
        notes: [
            L('It is drawn again at every refill when it was low or ultra, and with a {{MINERAL_DENSITY_CHANGE * 100}}% chance otherwise.', eng(P + 'minerals/tick.js', 'Math.random() < C.MINERAL_DENSITY_CHANGE) {')),
        ],
        constants: ['MINERAL_DENSITY', 'MINERAL_DENSITY_PROBABILITY', 'MINERAL_DENSITY_CHANGE', 'DENSITY_LOW', 'DENSITY_MODERATE', 'DENSITY_HIGH', 'DENSITY_ULTRA'],
        see: ['mechanic:minerals-and-extractors', 'Mineral.mineralAmount', 'const:sources-minerals'],
    },
    'Mineral.mineralAmount': {
        summary: 'Units left in the mineral. When it reaches 0 the refill timer of {{MINERAL_REGEN_TIME}} ticks starts.',
        tasks: ['how much mineral is left', 'is the mineral empty'],
        pitfalls: [
            L('No refill while anything is left: a mineral with 1 unit stays at 1 until someone harvests it.', eng(P + 'minerals/tick.js', 'if(!object.mineralAmount) {')),
        ],
        notes: [
            L('A harvest takes at most what is left.', eng(P + 'creeps/harvest.js', 'let amount = Math.min(target.mineralAmount, harvestAmount);')),
        ],
        constants: ['MINERAL_REGEN_TIME', 'MINERAL_DENSITY'],
        see: ['Mineral.ticksToRegeneration', 'Creep.harvest', 'mechanic:minerals-and-extractors'],
    },
    'Mineral.mineralType': {
        summary: 'The resource the mineral gives: one of the base minerals H, O, U, L, K, Z, X.',
        tasks: ['which mineral does a room have', 'mineral type of a room'],
        notes: [
            L('It is the resource name itself, so it can be passed straight to transfer, withdraw or send.', eng(P + 'creeps/harvest.js', 'bulk.update(object, {store: {[target.mineralType]: (object.store[target.mineralType] || 0)+amount}});')),
        ],
        see: ['const:resources', 'const:reactions', 'mechanic:minerals-and-extractors'],
    },
    'Mineral.id': {
        summary: 'Id of the mineral, for Game.getObjectById.',
        notes: [
            L('The same object is refilled again and again, so the id stays valid: keep it in memory.', eng(P + 'minerals/tick.js', 'bulk.update(object, update);')),
        ],
        see: ['Game.getObjectById'],
    },
    'Mineral.ticksToRegeneration': {
        summary: 'Ticks until the empty mineral is full again. undefined while the mineral still holds something.',
        tasks: ['when does a mineral refill', 'how long until the mineral regenerates'],
        notes: [
            L('It counts down from {{MINERAL_REGEN_TIME}} once the amount is 0.', eng(P + 'minerals/tick.js', 'object.nextRegenerationTime = gameTime + C.MINERAL_REGEN_TIME;')),
        ],
        constants: ['MINERAL_REGEN_TIME'],
        see: ['Mineral.mineralAmount', 'mechanic:minerals-and-extractors'],
    },

    // ---------------------------------------------------------------- deposit
    Deposit: {
        tasks: ['find deposits'],
        notes: [
            L('Any creep with WORK can harvest it from an adjacent tile; no structure, ownership or reservation is involved.', eng(CREEPS, 'else if(register.deposits[target.id] && (target instanceof globals.Deposit)) {')),
            L('It blocks movement.', common('lib/constants.js', 'OBSTACLE_OBJECT_TYPES: [')),
        ],
        see: ['mechanic:deposits', 'recipe:harvest-deposits', 'Deposit.lastCooldown'],
    },
    'Deposit.cooldown': {
        summary: 'Ticks until the deposit can be harvested again; 0 when it is ready.',
        tasks: ['is a deposit ready to harvest', 'deposit cooldown'],
        pitfalls: [
            L('harvest returns ERR_TIRED while it is above 0.', eng(CREEPS, 'if(target.cooldown) {')),
        ],
        notes: [
            L('Each harvest sets it to ceil({{DEPOSIT_EXHAUST_MULTIPLY}} × total harvested ^ {{DEPOSIT_EXHAUST_POW}}); a result of 1 or less sets no cooldown.', eng(P + 'creeps/harvest.js', 'if(cooldown > 1) {')),
        ],
        constants: ['DEPOSIT_EXHAUST_MULTIPLY', 'DEPOSIT_EXHAUST_POW'],
        see: ['Deposit.lastCooldown', 'Creep.harvest', 'mechanic:deposits'],
    },
    'Deposit.depositType': {
        summary: 'The raw commodity the deposit gives: silicon, metal, biomass or mist (RESOURCE_SILICON, RESOURCE_METAL, RESOURCE_BIOMASS, RESOURCE_MIST).',
        tasks: ['deposit types', 'which resource does a deposit give'],
        notes: [
            L('One type per quadrant of the world map.', article('resources')),
        ],
        see: ['mechanic:deposits', 'mechanic:factory-and-commodities'],
    },
    'Deposit.id': {
        summary: 'Id of the deposit, for Game.getObjectById.',
        notes: [
            L('It is gone when the deposit decays; a deposit that appears later is a new object with a new id.', eng(P + 'deposits/tick.js', 'bulk.remove(object._id);')),
        ],
        see: ['Game.getObjectById'],
    },
    'Deposit.lastCooldown': {
        summary: 'The cooldown a harvest causes right now: ceil({{DEPOSIT_EXHAUST_MULTIPLY}} × total harvested ^ {{DEPOSIT_EXHAUST_POW}}). It only grows, so it shows how worn the deposit is.',
        tasks: ['how exhausted is a deposit', 'is a deposit still worth harvesting'],
        notes: [
            L('It counts everything ever harvested from this deposit, by any player.', eng('src/game/deposits.js', 'lastCooldown: o => Math.ceil(C.DEPOSIT_EXHAUST_MULTIPLY*Math.pow(o.harvested,C.DEPOSIT_EXHAUST_POW)),')),
            L('At this value a creep gets {{HARVEST_DEPOSIT_POWER}} unit per WORK part about once every lastCooldown ticks.', eng(P + 'deposits/tick.js', 'cooldownTime: gameTime + object._cooldown')),
        ],
        constants: ['DEPOSIT_EXHAUST_MULTIPLY', 'DEPOSIT_EXHAUST_POW', 'HARVEST_DEPOSIT_POWER'],
        see: ['Deposit.cooldown', 'mechanic:deposits', 'recipe:harvest-deposits'],
    },
    'Deposit.ticksToDecay': {
        summary: 'Ticks until the deposit disappears. Each harvest sets it back to {{DEPOSIT_DECAY_TIME}}.',
        tasks: ['when does a deposit disappear', 'keep a deposit alive'],
        notes: [
            L('Any harvest resets the timer, however small.', eng(P + 'creeps/harvest.js', 'bulk.update(target, {decayTime: C.DEPOSIT_DECAY_TIME + gameTime});')),
        ],
        constants: ['DEPOSIT_DECAY_TIME'],
        see: ['mechanic:deposits'],
    },

    // ---------------------------------------------------------------- dropped resource
    Resource: {
        tasks: ['do dropped minerals decay'],
        notes: [
            L('One pile per resource type per tile: more of the same resource dropped there joins the existing pile.', eng(P + '_create-energy.js', "var existingDrop = _.find(roomObjects, {type: 'energy', x, y, resourceType});")),
            L('Every resource type shrinks on the ground at the same rate as energy.', eng(P + 'energy/tick.js', 'object[resourceType] -= Math.ceil(object[resourceType] / C.ENERGY_DECAY);')),
        ],
        see: ['Resource.resourceType', 'Resource.amount'],
    },
    'Resource.id': {
        summary: 'Id of the pile, for Game.getObjectById.',
        notes: [
            L('The pile keeps its id while anything is left; it is removed when it is picked up completely or has decayed to 0.', eng(P + 'creeps/pickup.js', 'if(!target[resourceType]) {')),
        ],
        see: ['Game.getObjectById', 'Creep.pickup'],
    },
    'Resource.resourceType': {
        summary: 'Which resource the pile holds, one RESOURCE_* value. A pile holds a single type.',
        tasks: ['what resource is lying on the ground', 'find dropped minerals'],
        notes: [
            L('pickup takes whatever type the pile has; it has no resource argument.', eng(P + 'creeps/pickup.js', "var resourceType = target.resourceType || 'energy';")),
        ],
        see: ['Creep.pickup', 'Resource.amount', 'const:resources'],
    },

    // ---------------------------------------------------------------- store
    Store: {
        tasks: ['list all resources in a store', 'loop over the contents of a storage'],
        notes: [
            L('Only resources with an amount above 0 are own keys: for…in or Object.keys(store) lists what is inside.', eng(STORE, 'if(resourceAmount) {')),
            L('Reading a resource that is not inside gives 0; a name that is no resource gives undefined.', eng(STORE, 'if(C.RESOURCES_ALL.indexOf(name) !== -1) {')),
            L('On a shared store getFreeCapacity(resource) does not depend on the resource: it is the capacity minus everything stored.', eng(STORE, 'return capacity - this._sum;')),
            L('A storage, terminal or factory whose capacity is 0 (room not the owner\'s, or level too low) answers null to getCapacity and getFreeCapacity.', eng(STORE, 'if(utils.capacityForResource(object, resource) === 0) {')),
        ],
        see: ['StructureLab.store', 'StructureStorage.store', 'StructureTerminal.store'],
    },

    // ---------------------------------------------------------------- container, storage, link
    StructureContainer: { see: ['StructureContainer.store'] },
    'StructureContainer.store': {
        summary: 'What the container holds: up to {{CONTAINER_CAPACITY}} units of any mix of resources.',
        tasks: ['how much is in a container', 'is a container full'],
        notes: [
            L('One shared capacity: store.getFreeCapacity() without argument is the free space.', eng(STORE, 'return capacity - this._sum;')),
        ],
        constants: ['CONTAINER_CAPACITY'],
        see: ['StructureContainer', 'Store.getFreeCapacity', 'Creep.withdraw'],
    },
    StructureStorage: { see: ['StructureStorage.store'] },
    'StructureStorage.store': {
        summary: 'What the storage holds: up to {{STORAGE_CAPACITY}} units of any mix of resources.',
        tasks: ['how much energy is in storage', 'is the storage full', 'what is in my storage'],
        pitfalls: [
            L('The capacity becomes 0 when the room is no longer yours or its level no longer allows a storage: nothing more goes in, but what is inside can still be withdrawn.',
                eng(P + 'storages/tick.js', 'C.CONTROLLER_STRUCTURES.storage[roomController.level] > 0 ? C.STORAGE_CAPACITY : 0;'), eng(P + 'creeps/withdraw.js', 'if(amount > target.store[intent.resourceType]) {')),
        ],
        notes: [
            L('PWR_OPERATE_STORAGE adds {{POWER_INFO[PWR_OPERATE_STORAGE].effect[0]}} to {{POWER_INFO[PWR_OPERATE_STORAGE].effect[4]}} capacity (power level 1 to 5) while the effect lasts.', eng(P + 'storages/tick.js', 'storeCapacity += C.POWER_INFO[C.PWR_OPERATE_STORAGE].effect[effect.level-1];')),
        ],
        constants: ['STORAGE_CAPACITY'],
        see: ['StructureStorage', 'Room.storage', 'Store.getFreeCapacity'],
    },
    StructureLink: { see: ['StructureLink.store', 'const:link'] },
    'StructureLink.store': {
        summary: 'What the link holds: energy only, up to {{LINK_CAPACITY}}.',
        tasks: ['how much energy is in a link', 'is a link full'],
        pitfalls: [
            L('Call the capacity methods with RESOURCE_ENERGY; without the argument they return null.', eng(STORE, 'if(utils.capacityForResource(object, resource) === 0) {')),
        ],
        notes: [
            L('Other resources are refused: transfer returns ERR_INVALID_TARGET.', eng(CREEPS, 'if(!utils.capacityForResource(data(target.id), resourceType)) {')),
        ],
        constants: ['LINK_CAPACITY'],
        see: ['StructureLink.transferEnergy', 'Store.getFreeCapacity'],
    },
    'StructureLink.cooldown': {
        notes: [
            L('A send adds {{LINK_COOLDOWN}} per tile of distance to the target link, the distance being the larger of dx and dy.', eng(P + 'links/transfer.js', 'object.cooldown += C.LINK_COOLDOWN * Math.max(Math.abs(target.x - object.x), Math.abs(target.y - object.y));')),
            L('It drops by 1 per tick, the tick of the send included: the tick after a send over 10 tiles it reads {{10 * LINK_COOLDOWN - 1}}, and the link can send again {{10 * LINK_COOLDOWN}} ticks after the send.', eng(P + 'links/tick.js', 'object.cooldown--;')),
        ],
        constants: ['LINK_COOLDOWN'],
    },
    'StructureLink.transferEnergy': {
        pitfalls: [
            L('If something else fills the target in the same tick, the amount is cut to the space that is left when the intent runs.', eng(P + 'links/transfer.js', 'amount = target.storeCapacityResource.energy - targetTotal;')),
        ],
    },

    // ---------------------------------------------------------------- extractor
    StructureExtractor: {
        pitfalls: [
            L('It can stand only on a mineral tile, one per mineral.', eng(UTILS, "return _.any(objects, {x, y, type: 'mineral'}) && !_.any(objects, {x, y, type: 'extractor'});")),
            L('Only its owner can harvest through it: with another player\'s extractor on the mineral, harvest returns ERR_NOT_OWNER.', eng(CREEPS, 'if(extractor.owner && !extractor.my) {')),
            L('An extractor that is not active at the current room level gives ERR_RCL_NOT_ENOUGH.', eng(CREEPS, 'if(!extractor.isActive()) {')),
        ],
        see: ['mechanic:minerals-and-extractors', 'recipe:mine-minerals', 'StructureExtractor.cooldown'],
    },
    'StructureExtractor.cooldown': {
        summary: 'Ticks until the mineral can be harvested again; 0 when ready. A harvest sets it to {{EXTRACTOR_COOLDOWN}}.',
        tasks: ['is the extractor ready', 'how often can I harvest a mineral'],
        pitfalls: [
            L('It reads {{EXTRACTOR_COOLDOWN}} in the tick after a harvest and drops by 1 per tick, so the next harvest comes {{EXTRACTOR_COOLDOWN + 1}} ticks after the last one.', eng(P + 'extractors/tick.js', 'object.cooldown--;')),
            L('It is written at the end of the tick: all creeps that harvest in the same tick succeed. Miners that harvest in different ticks block each other.', eng(P + 'extractors/tick.js', 'cooldown: object._cooldown')),
        ],
        constants: ['EXTRACTOR_COOLDOWN'],
        see: ['Creep.harvest', 'mechanic:minerals-and-extractors'],
    },

    // ---------------------------------------------------------------- lab
    StructureLab: {
        notes: [
            L('In one tick a lab can boost, unboost and run one reaction. If runReaction and reverseReaction are both called, only runReaction runs.', eng(P + 'labs/intents.js', 'else if(objectIntents.reverseReaction)')),
            L('LAB_COOLDOWN is not used; the cooldown after a reaction is REACTION_TIME of the compound.', common('lib/constants.js', 'LAB_COOLDOWN: 10,')),
        ],
        see: ['mechanic:labs-and-reactions', 'mechanic:boosts', 'recipe:make-a-tier-3-boost', 'StructureLab.store', 'StructureLab.cooldown'],
    },
    'StructureLab.cooldown': {
        summary: 'Ticks until the lab can run or reverse a reaction, or unboost, again; 0 when ready.',
        tasks: ['is a lab ready', 'lab cooldown', 'how long does a lab cool down after a reaction'],
        pitfalls: [
            L('unboostCreep can set a very long cooldown: per removed part, the reaction times of the compound\'s whole chain × {{LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT}}. That is ' + XLHO2_PART + ' ticks for one XLHO2 part.', eng(P + 'labs/unboost-creep.js', UNBOOST_TIME)),
        ],
        notes: [
            L('A reaction, forward or reverse, sets REACTION_TIME of the compound made or split.', eng(P + 'labs/run-reaction.js', 'cooldownTime: gameTime + C.REACTION_TIME[product]'), eng(P + 'labs/reverse-reaction.js', 'cooldownTime: gameTime + C.REACTION_TIME[mineralType]});')),
            L('Only the lab that ran the reaction cools down; the two other labs do not.', eng(P + 'labs/run-reaction.js', 'bulk.update(lab1, {store: {[lab1MineralType]: lab1.store[lab1MineralType]}});')),
            L('boostCreep does not look at the cooldown.', eng(STRUCT, 'StructureLab.prototype.boostCreep')),
        ],
        constants: ['REACTION_TIME', 'LAB_UNBOOST_MINERAL', 'LAB_REACTION_AMOUNT'],
        see: ['StructureLab.runReaction', 'StructureLab.unboostCreep', 'const:reactions', 'mechanic:labs-and-reactions'],
    },
    'StructureLab.store': {
        summary: 'What the lab holds: up to {{LAB_ENERGY_CAPACITY}} energy and up to {{LAB_MINERAL_CAPACITY}} of one other resource.',
        tasks: ['how much is in a lab', 'is a lab empty', 'can a lab hold two minerals'],
        pitfalls: [
            L('While the lab holds one mineral, store.getFreeCapacity(other) is null: empty the lab completely before loading something else.', eng(UTILS, 'Math.max(0, (object.storeCapacity||0) - _.sum(object.storeCapacityResource));')),
            L('Pass the resource to the capacity methods; without it getCapacity and getFreeCapacity return null.', eng(STORE, 'return object.storeCapacityResource ? null : object.storeCapacity || null;')),
        ],
        notes: [
            L('The first resource other than energy that enters an empty lab claims the slot; taking the last unit out frees it again.',
                eng(P + 'creeps/transfer.js', 'storeCapacityResource: {[resourceType]: C.LAB_MINERAL_CAPACITY},'), eng(P + 'creeps/withdraw.js', 'storeCapacityResource: {[intent.resourceType]: null},')),
        ],
        constants: ['LAB_ENERGY_CAPACITY', 'LAB_MINERAL_CAPACITY'],
        see: ['StructureLab.mineralType', 'Store.getFreeCapacity', 'mechanic:labs-and-reactions'],
    },
    'StructureLab.runReaction': {
        pitfalls: [
            L('Each source lab must hold at least {{LAB_REACTION_AMOUNT}} (ERR_NOT_ENOUGH_RESOURCES). The check runs again when the tick is processed: if one source feeds several labs and runs out, the later reactions are skipped although they returned OK.', eng(P + 'labs/run-reaction.js', 'if(!lab1MineralType || lab1.store[lab1MineralType] < reactionAmount) {')),
            L('ERR_INVALID_TARGET when a source is not a lab or is the producing lab itself.', eng(STRUCT, '!(lab1 instanceof globals.Structure) || lab1.structureType != C.STRUCTURE_LAB || lab1.id == this.id) {')),
        ],
        notes: [
            L('The order of the two source labs does not matter.', eng(P + 'labs/run-reaction.js', 'const product = C.REACTIONS[lab1MineralType][lab2MineralType];')),
            L('Only the producing lab must be within range 2 of each source; the two sources can be up to 4 tiles apart.', eng(P + 'labs/run-reaction.js', 'if(Math.abs(lab2.x - object.x) > 2 || Math.abs(lab2.y - object.y) > 2) {')),
            L('PWR_OPERATE_LAB on the producing lab raises the amount per run from {{LAB_REACTION_AMOUNT}} to {{LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB].effect[0]}}–{{LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB].effect[4]}}, inputs and output alike; the cooldown stays the same.', eng(P + 'labs/run-reaction.js', 'reactionAmount += C.POWER_INFO[C.PWR_OPERATE_LAB].effect[effect.level-1];')),
        ],
        see: ['mechanic:labs-and-reactions', 'recipe:make-a-tier-3-boost', 'StructureLab.cooldown'],
    },
    'StructureLab.reverseReaction': {
        tasks: ['split a compound into its reagents', 'undo a wrong reaction'],
        pitfalls: [
            L('Each target lab must be empty or already hold the matching reagent (ERR_INVALID_ARGS) and have room for {{LAB_REACTION_AMOUNT}} more (ERR_FULL).', eng(STRUCT, '(!lab1.mineralType || lab1.mineralType == v[0]) &&')),
            L('ERR_NOT_ENOUGH_RESOURCES when the lab holds less than {{LAB_REACTION_AMOUNT}} of the compound.', eng(STRUCT, 'if(!this.mineralType || (this.mineralAmount < reactionAmount)) {')),
            L('Base minerals cannot be split: no reaction makes them, so the call returns ERR_INVALID_ARGS.', eng(UTILS, 'if(C.REACTIONS[r1][r2] == compound) {')),
        ],
        notes: [
            L('{{LAB_REACTION_AMOUNT}} of the compound become {{LAB_REACTION_AMOUNT}} of each reagent; nothing is lost.', eng(P + 'labs/reverse-reaction.js', 'store: {[variant[0]]: (lab1.store[variant[0]]||0) + reactionAmount}')),
            L('The cooldown is REACTION_TIME of the compound, the same as for making it.', eng(P + 'labs/reverse-reaction.js', 'cooldownTime: gameTime + C.REACTION_TIME[mineralType]});')),
            L('With two empty target labs the engine decides which lab gets which reagent; read their mineralType next tick.', eng(P + 'labs/reverse-reaction.js', 'const variant = _.find(variants, v =>')),
        ],
        constants: ['LAB_REACTION_AMOUNT', 'REACTION_TIME'],
        see: ['mechanic:labs-and-reactions', 'StructureLab.cooldown'],
    },
    'StructureLab.boostCreep': {
        tasks: ['boost an ally creep', 'which parts get boosted first'],
        pitfalls: [
            L('A part that already has a boost is skipped; to change the compound on a part, unboost first.', eng(P + 'labs/boost-creep.js', 'var nonBoostedParts = _.filter(target.body, i => !i.boost && C.BOOSTS[i.type] && C.BOOSTS[i.type][mineralType]);')),
            L('If the lab runs short part-way it boosts as many parts as it can pay for, although the call returned OK. Check creep.body next tick.', eng(P + 'labs/boost-creep.js', 'while(object.store[mineralType] >= C.LAB_BOOST_MINERAL && object.store.energy >= C.LAB_BOOST_ENERGY && nonBoostedParts.length) {')),
            L('ERR_NOT_FOUND also when bodyPartsCount is larger than the number of parts that can still take the compound.', eng(STRUCT, 'if(!nonBoostedParts || bodyPartsCount && bodyPartsCount > nonBoostedParts) {')),
            L('ERR_INVALID_TARGET for a creep that is still spawning.', eng(STRUCT, '!(target instanceof globals.Creep) || target.spawning) {')),
        ],
        notes: [
            L('The creep need not be yours: the lab must be, and any adjacent creep can be boosted.', eng(P + 'labs/boost-creep.js', "if(!target || target.type != 'creep' || target.spawning) {")),
            L('The lab cooldown does not block boosting.', eng(STRUCT, 'StructureLab.prototype.boostCreep')),
            L('Boosted CARRY parts raise the creep\'s capacity in the same tick.', eng(P + 'labs/boost-creep.js', 'bulk.update(target, {body: target.body, storeCapacity: target.storeCapacity});')),
        ],
        see: ['mechanic:boosts', 'recipe:make-a-tier-3-boost'],
    },
    'StructureLab.unboostCreep': {
        tasks: ['unboost cooldown', 'recover compound from a boosted creep'],
        pitfalls: [
            L('The lab then cools down for the summed reaction times of each removed compound\'s whole chain × {{LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT}} per part: ' + XLHO2_PART + ' ticks per XLHO2 part, ' + XGHO2_PART + ' per XGHO2 part. Use a lab that is not needed for reactions.', eng(P + 'labs/unboost-creep.js', UNBOOST_TIME)),
            L('Own creeps only (ERR_NOT_OWNER), and not while the lab is on cooldown (ERR_TIRED).', eng(STRUCT, 'if(!this.my || !target.my) {')),
        ],
        notes: [
            L('One call removes every boost of the creep, whatever the lab holds; the lab can be empty.', eng(P + 'labs/unboost-creep.js', 'target.body.forEach(function(p) {p.boost = null;});')),
            L('The compound lands in a container under the creep if there is one, otherwise on the ground, where it decays.', eng(P + '_create-energy.js', "var container = _.find(roomObjects, {type: 'container', x, y});")),
        ],
        constants: ['REACTION_TIME', 'LAB_REACTION_AMOUNT'],
        see: ['mechanic:boosts', 'StructureLab.cooldown'],
    },

    // ---------------------------------------------------------------- factory
    StructureFactory: {
        tasks: ['how many factories per room'],
        see: ['mechanic:factory-and-commodities', 'recipe:factory-production', 'StructureFactory.level', 'StructureFactory.store'],
    },
    'StructureFactory.cooldown': {
        summary: 'Ticks until the factory can produce again; 0 when ready.',
        tasks: ['is the factory ready', 'factory cooldown'],
        pitfalls: [
            L('A produce call during the cooldown does nothing (ERR_TIRED).', eng(P + 'factories/produce.js', 'if(!!object.cooldownTime && object.cooldownTime > gameTime) {')),
        ],
        notes: [
            L('Each batch sets the cooldown of its recipe, COMMODITIES[type].cooldown: {{Math.min(...Object.values(COMMODITIES).map(c => c.cooldown))}} to {{Math.max(...Object.values(COMMODITIES).map(c => c.cooldown))}} ticks.', eng(P + 'factories/produce.js', 'bulk.update(object, {cooldownTime: C.COMMODITIES[intent.resourceType].cooldown + gameTime});')),
        ],
        constants: ['COMMODITIES'],
        see: ['StructureFactory.produce', 'const:commodities', 'mechanic:factory-and-commodities'],
    },
    'StructureFactory.level': {
        summary: 'Level of the factory, 1 to 5. undefined until PWR_OPERATE_FACTORY is used on it for the first time.',
        tasks: ['factory level', 'set the level of a factory', 'can I change the level of a factory'],
        pitfalls: [
            L('The first PWR_OPERATE_FACTORY sets the level to the level of that power, and it stays. A power of another level then does nothing on this factory.',
                eng(P + 'power-creeps/usePower.js', 'bulk.update(target, {level: creepPower.level});'), eng(P + 'power-creeps/usePower.js', 'if(target.level != creepPower.level) {')),
            L('The only way to another level is to destroy the factory and build a new one.', article('resources')),
            L('The level alone is not enough: a recipe with a level also needs the power effect to be active.', eng(P + 'factories/produce.js', 'e.power == C.PWR_OPERATE_FACTORY && e.level == C.COMMODITIES[intent.resourceType].level && e.endTime >= gameTime')),
        ],
        see: ['mechanic:factory-and-commodities', 'PowerCreep.usePower', 'StructureFactory.produce', 'const:power'],
    },
    'StructureFactory.store': {
        summary: 'What the factory holds: up to {{FACTORY_CAPACITY}} units of any mix. produce takes the components from it and puts the product into it.',
        tasks: ['how much is in the factory', 'what is in a factory'],
        pitfalls: [
            L('The capacity is 0 while the room is not the owner\'s at a level that allows a factory: nothing can be put in or produced.', eng(P + 'factories/tick.js', 'C.CONTROLLER_STRUCTURES.factory[roomController.level] ? C.FACTORY_CAPACITY : 0;')),
        ],
        constants: ['FACTORY_CAPACITY'],
        see: ['StructureFactory.produce', 'Store.getFreeCapacity'],
    },
    'StructureFactory.produce': {
        tasks: ['why does produce return ERR_BUSY', 'make wire from silicon'],
        pitfalls: [
            L('Recipes without a level run in any factory, levelled or not, with or without the power effect.', eng(STRUCT, 'if(!!C.COMMODITIES[resourceType].level && C.COMMODITIES[resourceType].level != rawFactory.level) {')),
            L('All components must be in the factory itself; ERR_NOT_ENOUGH_RESOURCES when one is short.', eng(STRUCT, 'if(_.some(_.keys(C.COMMODITIES[resourceType].components), p => (rawFactory.store[p]||0)<C.COMMODITIES[resourceType].components[p])) {')),
            L('ERR_FULL when the store after the batch (minus components, plus product) would exceed the capacity.', eng(P + 'factories/produce.js', "if (targetTotal - componentsTotal + (C.COMMODITIES[intent.resourceType].amount||1) > object.storeCapacity) {")),
        ],
        notes: [
            L('One call makes one batch of COMMODITIES[type].amount units; there is no amount argument.', eng(P + 'factories/produce.js', "object.store[intent.resourceType] = (object.store[intent.resourceType]||0) + (C.COMMODITIES[intent.resourceType].amount || 1);")),
            L('PWR_OPERATE_FACTORY changes neither the batch size nor the cooldown.', eng(P + 'factories/produce.js', 'bulk.update(object, {cooldownTime: C.COMMODITIES[intent.resourceType].cooldown + gameTime});')),
        ],
        see: ['mechanic:factory-and-commodities', 'recipe:factory-production', 'StructureFactory.level', 'StructureFactory.cooldown'],
    },

    // ---------------------------------------------------------------- terminal
    StructureTerminal: {
        see: ['mechanic:terminal-transfers', 'mechanic:market', 'recipe:balance-resources-between-rooms', 'StructureTerminal.store'],
    },
    'StructureTerminal.store': {
        summary: 'What the terminal holds: up to {{TERMINAL_CAPACITY}} units of any mix, including the energy that pays for transfers.',
        tasks: ['how much is in the terminal', 'free space in a terminal'],
        pitfalls: [
            L('What arrives by a send or a deal is cut to the free space; a full terminal receives nothing.', eng(MARKET, 'amount = Math.min(amount, freeSpace);')),
            L('The capacity is 0 while the room is not the owner\'s at a level that allows a terminal.', eng(P + 'terminal/tick.js', 'C.CONTROLLER_STRUCTURES.terminal[roomController.level] ? C.TERMINAL_CAPACITY : 0;')),
            L('Under PWR_DISRUPT_TERMINAL creeps cannot withdraw from it (ERR_INVALID_TARGET).', eng(CREEPS, 'var effect = _.find(target.effects, {power: C.PWR_DISRUPT_TERMINAL});')),
        ],
        constants: ['TERMINAL_CAPACITY'],
        see: ['StructureTerminal.send', 'Room.terminal', 'mechanic:terminal-transfers'],
    },
    'StructureTerminal.cooldown': {
        notes: [
            L('It is set on the terminal that sends and on the terminal a deal is made with; receiving sets none.', eng(MARKET, 'bulkObjects.update(targetTerminal, {cooldownTime: gameTime + cooldown});')),
        ],
        see: ['mechanic:terminal-transfers'],
    },
    'StructureTerminal.send': {
        tasks: ['why did my terminal send not arrive'],
        pitfalls: [
            L('OK does not prove delivery. The target room needs a terminal owned by a player; without one nothing is sent, no energy is spent and no cooldown starts.', eng(MARKET, 'if(!terminalsByRoom[intent.targetRoomName] || !terminalsByRoom[intent.targetRoomName].user) {')),
            L('The amount is cut to the free space of the receiving terminal, and the fee is charged on what was actually sent.', eng(MARKET, 'amount = Math.min(amount, freeSpace);')),
            L('The send runs after all rooms are processed. If creeps took the resource or the fee energy out of the terminal in the same tick, it is dropped.', eng(MARKET, 'if(fromTerminal.user && (!fromTerminal.store || !fromTerminal.store[resourceType] || fromTerminal.store[resourceType] < amount)) {')),
            L('One send per terminal per tick: a second call replaces the first.', eng(STRUCT, "intents.set(this.id, 'send', {resourceType, amount, targetRoomName, description});")),
        ],
        notes: [
            L('The resource is in the target terminal at the start of the next tick.', eng('src/main.js', "stage = 'global';")),
            L('PWR_OPERATE_TERMINAL on the sender multiplies fee and cooldown by {{POWER_INFO[PWR_OPERATE_TERMINAL].effect[0]}} down to {{POWER_INFO[PWR_OPERATE_TERMINAL].effect[4]}}; the call itself still wants the full fee in the terminal.',
                eng(MARKET, 'transferCost = Math.ceil(transferCost * C.POWER_INFO[C.PWR_OPERATE_TERMINAL].effect[effect.level-1]);'), eng(STRUCT, 'var cost = utils.calcTerminalEnergyCost(amount,range);')),
            L('The description, at most 100 characters, is shown to the receiver in incomingTransactions.', eng(STRUCT, 'if(description && (!_.isString(description) || description.length > 100)) {')),
        ],
        see: ['mechanic:terminal-transfers', 'Game.market.outgoingTransactions', 'recipe:balance-resources-between-rooms'],
    },

    // ---------------------------------------------------------------- market
    'Game.market': {
        notes: [
            L('createOrder, cancelOrder, changeOrderPrice, extendOrder and deal are intents: each call that returns OK costs 0.2 CPU.', driver('lib/runtime/runtime.js', 'pushByName(id, name, data, maxLen) {')),
        ],
        see: ['mechanic:market', 'mechanic:terminal-transfers', 'recipe:balance-resources-between-rooms'],
    },
    'Game.market.credits': {
        tasks: ['how to get credits'],
        notes: [
            L('Credits belong to the account, not to a room.', article('market')),
            L('The balance has a resolution of 0.001 credit.', eng(MARKET_API, 'return (runtimeData.user.money || 0)/1000;')),
            L('The first credits come from selling to someone\'s buy order with deal, which needs no credits.', article('market')),
        ],
        see: ['mechanic:market', 'Game.market.deal'],
    },
    'Game.market.incomingTransactions': {
        summary: 'The last 100 transfers that arrived at your terminals, newest first: sends from any player and goods bought on the market.',
        tasks: ['who sent me resources', 'list received terminal transfers', 'check that a delivery arrived'],
        notes: [
            L('Each entry has transactionId, time (tick), sender and recipient ({username}), resourceType, amount, from and to (room names), plus description for a send or order {id, type, price} for a deal.', eng(MARKET, 'bulkTransactions.insert(_.extend({')),
            L('Only transfers that were carried out are listed, with the amount that really moved.', eng(MARKET, 'amount: amount,')),
            L('sender is undefined when the goods came from an NPC terminal.', eng(MARKET, 'sender: fromTerminal.user ? ""+fromTerminal.user : undefined,')),
            L('It is loaded newest first, at most 100 entries.', driver(RUNTIME_DATA, 'db.transactions.findEx({recipient: userId}, {sort: {time:-1}, limit: 100}),')),
        ],
        see: ['Game.market.outgoingTransactions', 'StructureTerminal.send', 'Game.market.deal'],
    },
    'Game.market.outgoingTransactions': {
        summary: 'The last 100 transfers that left your terminals, newest first: your sends and goods sold on the market.',
        tasks: ['list sent terminal transfers', 'did my terminal send go through'],
        notes: [
            L('Same fields as incomingTransactions.', eng(MARKET_API, '_outgoingTransactions = _.map(runtimeData.transactions.outgoing || [], i => {')),
            L('A send or deal that returned OK but was not carried out leaves no entry: look here next tick to confirm.', eng(MARKET, 'bulkTransactions.insert(_.extend({')),
            L('recipient is undefined when the goods went to an NPC terminal.', eng(MARKET, 'recipient: toTerminal.user ? ""+toTerminal.user : undefined,')),
            L('It is loaded newest first, at most 100 entries.', driver(RUNTIME_DATA, 'db.transactions.findEx({sender: userId}, {sort: {time:-1}, limit: 100}),')),
        ],
        see: ['Game.market.incomingTransactions', 'StructureTerminal.send', 'Game.market.deal'],
    },
    'Game.market.orders': {
        tasks: ['why is my order inactive', 'clean up filled orders'],
        notes: [
            L('amount is what can trade right now, remainingAmount what is left of the order, totalAmount what was ordered in all.', eng(MARKET, 'availableResourceAmount = Math.min(availableResourceAmount, order.remainingAmount);')),
            L('A completely filled order stays here as inactive until it is cancelled or expires, and keeps counting toward the limit of {{MARKET_MAX_ORDERS}}.', eng(MARKET_API, 'if(_.size(this.orders) + ordersCreatedDuringTick >= C.MARKET_MAX_ORDERS) {')),
        ],
        see: ['mechanic:market'],
    },
    'Game.market.createOrder': {
        pitfalls: [
            L('A new order starts inactive. It turns active in a later tick: a sell order while its terminal holds the resource, a buy order while you can pay for at least one unit and its terminal has free space.', eng(MARKET, 'active: false,'), eng(MARKET, 'var newActive = isOwner && newAmount > 0;')),
            L('ERR_NOT_OWNER unless you own a terminal in roomName. Account resources (INTERSHARD_RESOURCES) need no room.', eng(MARKET_API, "(!roomName || !_.any(runtimeData.userObjects, {type: 'terminal', room: roomName}))) {")),
            L('An order lives {{MARKET_ORDER_LIFE_TIME / 86400000}} days of real time. When it expires the fee for the unfilled part is paid back; cancelOrder pays nothing back.',
                eng(MARKET, 'if(order.user && (nowTimestamp - order.createdTimestamp > C.MARKET_ORDER_LIFE_TIME)) {'), eng(MARKET, 'const remainingFee = order.remainingAmount * order.price * C.MARKET_FEE;')),
            L('Prices are rounded to 0.001 credit. A price that rounds to 0 creates no order although the call returned OK.', common('lib/system.js', "'price': value => parseInt((1000 * value).toFixed(0)),"), eng(MARKET, 'if (!intent.price || !intent.totalAmount) {')),
        ],
        notes: [
            L('It takes one params object, or the five values in the order type, resourceType, price, totalAmount, roomName.', eng(MARKET_API, 'if(_.isObject(type)) {')),
            L('ERR_FULL comes at {{MARKET_MAX_ORDERS}} orders, counting those created earlier in the same tick; the reference text still names 50.', eng(MARKET_API, 'if(_.size(this.orders) + ordersCreatedDuringTick >= C.MARKET_MAX_ORDERS) {'), doc('Game.market.createOrder')),
            L('The fee is rounded up to 0.001 credit.', eng(MARKET, 'var fee = Math.ceil(intent.price * intent.totalAmount * C.MARKET_FEE);')),
        ],
        see: ['mechanic:market', 'Game.market.orders'],
    },
    'Game.market.deal': {
        tasks: ['who pays the energy for a market deal'],
        pitfalls: [
            L('The traded amount is cut to what is left in the order, what the selling terminal holds, the free space of the buying terminal and the credits of the buyer.', eng(MARKET, 'amount = Math.floor(dealCost/order.price);')),
            L('When you buy energy the transfer fee must already be in your terminal; the energy that arrives cannot pay for it.', eng(MARKET, 'transferFeeTerminal === toTerminal && toTerminal.store.energy < transferCost) {')),
            L('A second deal through the same terminal in one tick, or a deal after a send from it, returns OK and is dropped: the first action puts the terminal on cooldown.', eng(MARKET, 'if(targetTerminal.cooldownTime > gameTime) {')),
            L('When several players deal on one order in the same tick, the terminal nearest to the order is served first.', eng(MARKET, 'terminalDeals.sort(')),
            L('ERR_INVALID_ARGS for an order that is not active: only active orders are loaded.', driver(RUNTIME_DATA, "return db['market.orders'].find({active: true})")),
        ],
        notes: [
            L('Only your terminal goes on cooldown; the terminal of the order owner neither cools down nor pays energy.', eng(MARKET, 'bulkObjects.update(targetTerminal, {cooldownTime: gameTime + cooldown});'), article('market')),
            L('A deal has no credit fee: the buyer pays amount × price and the seller receives exactly that.', eng(MARKET, "bulkUsers.inc(usersById[seller.user], 'money', dealCost);")),
            L('Selling to a buy order needs no credits; buying from a sell order needs amount × price (ERR_NOT_ENOUGH_RESOURCES).', eng(MARKET_API, 'if(order.type == C.ORDER_SELL && (runtimeData.user.money || 0) < amount * order.price) {')),
            L('Orders for account resources (INTERSHARD_RESOURCES) trade without terminal, energy or cooldown; yourRoomName is not used.', eng(MARKET_API, 'if(_.contains(C.INTERSHARD_RESOURCES, order.resourceType)) {')),
        ],
        see: ['mechanic:market', 'mechanic:terminal-transfers', 'Game.market.incomingTransactions'],
    },
    'Game.market.cancelOrder': {
        notes: [
            L('A cancel beats deals made on the order in the same tick: they find nothing left to trade.', eng(MARKET, 'ordersById[intent.orderId].remainingAmount = 0;')),
            L('At most 50 cancels per tick are queued; further calls still return OK and do nothing.', eng(MARKET_API, "intents.pushByName('global', 'cancelOrder', {orderId}, 50);"), driver('lib/runtime/runtime.js', 'if (maxLen && this.list[id][name].length >= maxLen) {')),
        ],
        see: ['mechanic:market'],
    },
    'Game.market.changeOrderPrice': {
        pitfalls: [
            L('Lowering the price pays nothing back.', eng(MARKET, 'if (intent.newPrice > order.price) {')),
        ],
        notes: [
            L('The fee for an increase is {{MARKET_FEE * 100}}% of (new price − old price) × remainingAmount, rounded up to 0.001.', eng(MARKET, 'var fee = Math.ceil((intent.newPrice - order.price) * order.remainingAmount * C.MARKET_FEE);')),
        ],
        constants: ['MARKET_FEE'],
        see: ['mechanic:market'],
    },
    'Game.market.extendOrder': {
        notes: [
            L('It raises remainingAmount and totalAmount. The life time of the order still counts from its creation.', eng(MARKET, "bulk.inc(order, 'totalAmount', intent.addAmount);"), eng(MARKET, 'nowTimestamp - order.createdTimestamp > C.MARKET_ORDER_LIFE_TIME')),
        ],
        constants: ['MARKET_FEE', 'MARKET_ORDER_LIFE_TIME'],
        see: ['mechanic:market'],
    },
    'Game.market.getAllOrders': {
        notes: [
            L('Only active orders are returned, your own active ones included.', driver(RUNTIME_DATA, "return db['market.orders'].find({active: true})")),
            L('A filter object with resourceType reads only the orders of that resource. A function filter, or no filter, copies the whole order book; that is what makes the call expensive.', eng(MARKET_API, 'var orders = _getOrders(filter && filter.resourceType);')),
            L('amount is what can be traded now, remainingAmount what is left of the order.', doc('Game.market.getAllOrders')),
            L('The order book is the one from the start of the tick; this tick\'s deals of other players are not in it yet.', driver(RUNTIME_DATA, 'if(gameTime == cachedMarketOrders.gameTime) {')),
        ],
        see: ['mechanic:market'],
    },
    'Game.market.getHistory': {
        pitfalls: [
            L('For a resource without recorded sales the result is an empty object, not an empty array: test with Array.isArray or length.', eng(MARKET_API, 'runtimeData.market.history[resourceType] || {}')),
        ],
        notes: [
            L('One row per resource and day: resourceType, date, transactions, volume, avgPrice, stddevPrice.', backend(CRON, 'avgPrice: +i.avg.toFixed(3),')),
            L('It is built from the sales of players in the last 14 days; avgPrice is weighted by volume.', backend(CRON, '14 * 24 * 3600 * 1000'), backend(CRON, 'sumPrice / result[resourceType][date].sumAmount')),
            L('It is recalculated once an hour and cached for three hours in the runtime, so the newest day lags behind.', backend(CRON, 'calcMarketStats: [60*60, calcMarketStats],'), driver(RUNTIME_DATA, '// cache for 3 hours')),
            L('Without an argument it returns the rows of all resources in one array.', driver(RUNTIME_DATA, 'const result = {all: []};')),
        ],
        see: ['mechanic:market'],
    },
    'Game.market.getOrderById': {
        notes: [
            L('It finds your own orders, active or not, and any other order only while it is active; otherwise null.', eng(MARKET_API, 'const order = runtimeData.market.orders.all[id];')),
        ],
    },
    'Game.market.calcTransactionCost': {
        notes: [
            L('It does not know about PWR_OPERATE_TERMINAL: under that effect the real cost is lower.', eng(MARKET_API, 'return utils.calcTerminalEnergyCost(amount, distance);')),
        ],
        see: ['mechanic:terminal-transfers'],
    },
};
