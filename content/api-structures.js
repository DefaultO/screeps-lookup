'use strict';
// Own text for the structure entries.
const STRUCT = 'src/game/structures.js';
const P = 'src/processor/intents/';

module.exports = {
    // ---------------------------------------------------------------- controller
    StructureController: {
        summary: 'The room\'s controller: level, ownership, reservation, safe mode. It cannot be built, attacked with weapons or destroyed.',
        tasks: ['room level', 'what does a controller level unlock'],
        see: ['mechanic:controller', 'const:controller', 'Creep.upgradeController', 'Creep.claimController', 'Creep.reserveController'],
    },
    'StructureController.level': { summary: 'Room Control Level 0–8. 0 means nobody owns the room.', tasks: ['get the room level', 'RCL'], constants: ['CONTROLLER_LEVELS', 'CONTROLLER_STRUCTURES'], see: ['const:controller'] },
    'StructureController.progress': { summary: 'Energy put in toward the next level; progressTotal is what the level needs.', tasks: ['how much energy to the next room level'], constants: ['CONTROLLER_LEVELS'], see: ['Creep.upgradeController', 'const:controller'] },
    'StructureController.reservation': {
        summary: '{username, ticksToEnd} when the controller is reserved, else undefined.',
        tasks: ['is a room reserved', 'who reserved this room', 'how long is the reservation left', 'is the room reserved by an invader core'],
        notes: ['An invader core reserves as user "Invader". The reservation drops by 1 per tick and ends at 0.'],
        constants: ['CONTROLLER_RESERVE_MAX'],
        see: ['Creep.reserveController', 'mechanic:reservation', 'Creep.attackController'],
    },
    'StructureController.safeMode': { summary: 'Ticks of safe mode left, or undefined.', tasks: ['is a room in safe mode'], constants: ['SAFE_MODE_DURATION'], see: ['StructureController.activateSafeMode', 'mechanic:safe-mode'] },
    'StructureController.safeModeAvailable': { summary: 'Safe mode activations in stock. One is added per level gained and per generateSafeMode; a downgrade resets it to 0.', tasks: ['how many safe modes do I have'], see: ['StructureController.activateSafeMode', 'Creep.generateSafeMode', 'mechanic:safe-mode'] },
    'StructureController.safeModeCooldown': { summary: 'Ticks during which safe mode cannot be activated again.', tasks: ['when can I use safe mode again'], constants: ['SAFE_MODE_COOLDOWN'], see: ['mechanic:safe-mode'] },
    'StructureController.ticksToDowngrade': {
        summary: 'Ticks until the controller loses a level if nobody upgrades it.',
        tasks: ['when does my controller downgrade', 'how long until I lose a room', 'how often must I upgrade'],
        constants: ['CONTROLLER_DOWNGRADE', 'CONTROLLER_DOWNGRADE_RESTORE'],
        see: ['mechanic:controller', 'Creep.upgradeController'],
    },
    'StructureController.upgradeBlocked': { summary: 'Ticks during which the controller cannot be upgraded, after attackController ({{CONTROLLER_ATTACK_BLOCKED_UPGRADE}}) or a nuke ({{CONTROLLER_NUKE_BLOCKED_UPGRADE}}).', tasks: ['why can I not upgrade my controller'], constants: ['CONTROLLER_ATTACK_BLOCKED_UPGRADE', 'CONTROLLER_NUKE_BLOCKED_UPGRADE'], see: ['Creep.attackController'] },
    'StructureController.sign': { summary: '{username, text, time, datetime} of the sign on the controller.', tasks: ['read a controller sign'], see: ['Creep.signController'] },
    'StructureController.activateSafeMode': {
        summary: 'Start safe mode in the room for {{SAFE_MODE_DURATION}} ticks.',
        tasks: ['activate safe mode', 'protect a room under attack', 'when can I use safe mode'],
        pitfalls: [
            'Only one of your rooms can be in safe mode at a time (ERR_BUSY).',
            'ERR_TIRED during the {{SAFE_MODE_COOLDOWN}}-tick cooldown, while upgradeBlocked, or when the downgrade timer is more than {{CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD}} ticks below half of its maximum.',
            'ERR_NOT_ENOUGH_RESOURCES when safeModeAvailable is 0.',
            'A nuke landing in the room ends safe mode.',
        ],
        constants: ['SAFE_MODE_DURATION', 'SAFE_MODE_COOLDOWN', 'SAFE_MODE_COST', 'CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD'],
        see: ['mechanic:safe-mode', 'recipe:safe-mode', 'Creep.generateSafeMode'],
        engine: [{ file: STRUCT, find: 'StructureController.prototype.activateSafeMode', label: 'engine: API checks' }],
    },
    'StructureController.unclaim': {
        summary: 'Give up the room at once: the controller goes to level 0.',
        tasks: ['abandon a room', 'unclaim a room'],
        pitfalls: ['Structures stay but stop working; nothing is refunded.'],
        see: ['Creep.claimController', 'mechanic:controller'],
    },

    // ---------------------------------------------------------------- spawn
    StructureSpawn: {
        summary: 'Makes creeps. Holds {{SPAWN_ENERGY_CAPACITY}} energy and refills itself by 1 per tick while the room has less than {{SPAWN_ENERGY_CAPACITY}} in spawns and extensions.',
        tasks: ['how many spawns per room level'],
        constants: ['SPAWN_ENERGY_CAPACITY', 'SPAWN_HITS', 'CONTROLLER_STRUCTURES.spawn'],
        see: ['StructureSpawn.spawnCreep', 'recipe:spawning', 'const:structures'],
    },
    'StructureSpawn.spawnCreep': {
        summary: 'Start spawning a creep with the given body and name.',
        tasks: ['spawn a creep', 'create a creep', 'how much does a creep cost', 'how long does spawning take', 'check if a body is affordable', 'choose which extensions pay for a creep'],
        pitfalls: [
            'The name must be unique among your living creeps (ERR_NAME_EXISTS).',
            'ERR_NOT_ENOUGH_ENERGY compares the body cost with room.energyAvailable; with opts.energyStructures only the listed structures count.',
            'The creep exists from this tick with spawning = true; its id is available next tick.',
            'If every tile around the spawn is blocked when the time is up, the spawn stays busy until one is free. A hostile creep on an adjacent tile is killed to make room when there is no other exit.',
            'Bodies are cut at {{MAX_CREEP_SIZE}} parts.',
        ],
        notes: [
            'Cost is the sum of BODYPART_COST; time is {{CREEP_SPAWN_TIME}} ticks per part.',
            'opts: memory, energyStructures (drain order), dryRun (check only, no intent cost), directions (allowed exit directions).',
            'Without energyStructures, energy is taken from spawns first, then from extensions nearest to the spawn.',
        ],
        constants: ['BODYPART_COST', 'CREEP_SPAWN_TIME', 'MAX_CREEP_SIZE', 'SPAWN_ENERGY_CAPACITY', 'EXTENSION_ENERGY_CAPACITY'],
        see: ['recipe:spawning', 'Room.energyAvailable', 'StructureSpawn.spawning', 'const:body-parts', 'StructureSpawn.renewCreep'],
        engine: [
            { file: P + 'spawns/_charge-energy.js', find: 'function oldEnergyHandling', label: 'engine: which structures pay' },
            { file: P + 'spawns/_born-creep.js', find: 'spawn is surrounded', label: 'engine: blocked exits' },
        ],
    },
    'StructureSpawn.renewCreep': {
        summary: 'Add life time to an adjacent creep for energy. Range 1.',
        range: 1,
        tasks: ['renew a creep', 'extend the life of a creep', 'is renewing cheaper than spawning', 'how much does renewing cost'],
        pitfalls: [
            'The spawn must not be spawning (ERR_BUSY).',
            'Creeps with a CLAIM part cannot be renewed.',
            'Renewing removes all boosts from the creep.',
            'ERR_FULL when the gain would push ticksToLive above {{CREEP_LIFE_TIME}}.',
        ],
        notes: [
            'One call adds floor({{SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME}} / body size) ticks and costs ceil({{SPAWN_RENEW_RATIO / CREEP_SPAWN_TIME}} × creep cost / body size) energy.',
            'Per tick of life that is the same energy as a new creep (cost / {{CREEP_LIFE_TIME}}), but it uses {{SPAWN_RENEW_RATIO}}× less spawn time and keeps the creep in place.',
        ],
        constants: ['SPAWN_RENEW_RATIO', 'CREEP_LIFE_TIME', 'CREEP_SPAWN_TIME'],
        see: ['StructureSpawn.recycleCreep', 'Creep.ticksToLive', 'recipe:spawning'],
        engine: [{ file: P + 'spawns/renew-creep.js', find: 'var effect = Math.floor(C.SPAWN_RENEW_RATIO', label: 'engine: gain and cost' }],
    },
    'StructureSpawn.recycleCreep': {
        summary: 'Kill an adjacent creep and get back the energy of its remaining life. Range 1.',
        range: 1,
        tasks: ['recycle a creep', 'get energy back from an old creep'],
        notes: [
            'Refund per part: min({{CREEP_PART_MAX_ENERGY}}, part cost × ticksToLive / life time), plus the same share of boost minerals. It lands in a tombstone on the creep\'s tile, or in a container under the creep.',
            'Works while the spawn is spawning.',
        ],
        constants: ['CREEP_PART_MAX_ENERGY', 'CREEP_CORPSE_RATE'],
        see: ['Creep.suicide', 'mechanic:creep-death', 'StructureLab.unboostCreep'],
        engine: [{ file: P + 'creeps/_die.js', find: 'var lifeRate = dropRate * object._ticksToLive / lifeTime;', label: 'engine: refund formula' }],
    },
    'StructureSpawn.spawning': { summary: 'The Spawning object while a creep is being made, else null.', tasks: ['is the spawn busy', 'time until the creep is ready'], see: ['StructureSpawn.Spawning.remainingTime', 'StructureSpawn.Spawning.cancel'] },
    'StructureSpawn.Spawning.cancel': { summary: 'Abort the creep being spawned. The energy is not returned.', tasks: ['cancel spawning'], see: ['StructureSpawn.spawning'] },
    'StructureSpawn.Spawning.setDirections': { summary: 'Change the directions in which the new creep may leave the spawn.', tasks: ['choose the spawn exit direction'], see: ['StructureSpawn.spawnCreep', 'const:directions'] },
    'StructureSpawn.Spawning.remainingTime': { summary: 'Ticks until the creep is ready.', tasks: ['when is the spawn free'] },
    StructureExtension: {
        summary: 'Extra energy for spawning. Capacity per extension depends on the room level: {{EXTENSION_ENERGY_CAPACITY[1]}} up to level 6, {{EXTENSION_ENERGY_CAPACITY[7]}} at 7, {{EXTENSION_ENERGY_CAPACITY[8]}} at 8.',
        tasks: ['how many extensions per room level', 'extension capacity'],
        constants: ['EXTENSION_ENERGY_CAPACITY', 'CONTROLLER_STRUCTURES.extension', 'EXTENSION_HITS'],
        see: ['Room.energyCapacityAvailable', 'const:controller'],
    },

    // ---------------------------------------------------------------- tower
    StructureTower: {
        summary: 'Attacks, heals or repairs anything in its room for {{TOWER_ENERGY_COST}} energy per action. One action per tick. Allowed: {{CONTROLLER_STRUCTURES.tower[3]}} from room level 3, {{CONTROLLER_STRUCTURES.tower[5]}} from 5, {{CONTROLLER_STRUCTURES.tower[7]}} at 7, {{CONTROLLER_STRUCTURES.tower[8]}} at 8.',
        tasks: ['how many towers per room level', 'tower damage at range'],
        constants: ['TOWER_CAPACITY', 'TOWER_ENERGY_COST', 'CONTROLLER_STRUCTURES.tower'],
        see: ['mechanic:tower', 'recipe:tower-logic', 'StructureTower.attack'],
    },
    'StructureTower.attack': {
        summary: 'Shoot a creep, power creep or structure anywhere in the room.',
        tasks: ['tower attack', 'defend with towers', 'kill hostile creeps in my room', 'how much damage does a tower do', 'tower damage at range 20'],
        pitfalls: [
            'A tower does one thing per tick. If the script calls several, heal wins over repair and repair over attack.',
            'Damage falls off with distance; a healer out at the room edge can out-heal one tower.',
            'A rampart on the target tile takes the hit.',
        ],
        notes: ['{{TOWER_POWER_ATTACK}} damage up to range {{TOWER_OPTIMAL_RANGE}}, falling in a straight line to {{TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)}} at range {{TOWER_FALLOFF_RANGE}} and beyond. Costs {{TOWER_ENERGY_COST}} energy.'],
        constants: ['TOWER_POWER_ATTACK', 'TOWER_OPTIMAL_RANGE', 'TOWER_FALLOFF_RANGE', 'TOWER_FALLOFF', 'TOWER_ENERGY_COST'],
        see: ['mechanic:tower', 'recipe:tower-logic', 'StructureTower.heal', 'StructureTower.repair'],
        engine: [
            { file: P + 'towers/attack.js', find: 'amount -= amount * C.TOWER_FALLOFF', label: 'engine: falloff formula' },
            { file: P + 'towers/intents.js', find: "require('./heal')", label: 'engine: heal, else repair, else attack' },
        ],
    },
    'StructureTower.heal': {
        summary: 'Heal a creep anywhere in the room.',
        tasks: ['tower heal', 'how much does a tower heal at range 20', 'heal defenders with towers'],
        notes: ['{{TOWER_POWER_HEAL}} hits up to range {{TOWER_OPTIMAL_RANGE}}, falling to {{TOWER_POWER_HEAL * (1 - TOWER_FALLOFF)}} at range {{TOWER_FALLOFF_RANGE}} and beyond. Costs {{TOWER_ENERGY_COST}} energy.'],
        constants: ['TOWER_POWER_HEAL', 'TOWER_OPTIMAL_RANGE', 'TOWER_FALLOFF_RANGE', 'TOWER_FALLOFF', 'TOWER_ENERGY_COST'],
        see: ['mechanic:tower', 'StructureTower.attack', 'Creep.heal'],
        engine: [{ file: P + 'towers/heal.js', find: 'amount -= amount * C.TOWER_FALLOFF', label: 'engine: falloff formula' }],
    },
    'StructureTower.repair': {
        summary: 'Repair a structure anywhere in the room.',
        tasks: ['tower repair', 'repair ramparts with towers', 'how much does a tower repair'],
        pitfalls: ['At range {{TOWER_FALLOFF_RANGE}} a tower repairs {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF)}} hits for {{TOWER_ENERGY_COST}} energy, {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF) / TOWER_ENERGY_COST}} hits per energy; a creep gets {{1 / REPAIR_COST}} per energy at any range. Tower repair pays only close up or in an emergency.'],
        notes: ['{{TOWER_POWER_REPAIR}} hits up to range {{TOWER_OPTIMAL_RANGE}}, falling to {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF)}} at range {{TOWER_FALLOFF_RANGE}} and beyond. Costs {{TOWER_ENERGY_COST}} energy.'],
        constants: ['TOWER_POWER_REPAIR', 'TOWER_OPTIMAL_RANGE', 'TOWER_FALLOFF_RANGE', 'TOWER_FALLOFF', 'TOWER_ENERGY_COST', 'REPAIR_COST'],
        see: ['mechanic:tower', 'Creep.repair', 'mechanic:decay'],
    },

    // ---------------------------------------------------------------- link
    StructureLink: {
        summary: 'Sends energy to another link in the same room. Holds {{LINK_CAPACITY}}. Allowed: {{CONTROLLER_STRUCTURES.link[5]}} at room level 5, {{CONTROLLER_STRUCTURES.link[6]}} at 6, {{CONTROLLER_STRUCTURES.link[7]}} at 7, {{CONTROLLER_STRUCTURES.link[8]}} at 8.',
        tasks: ['how many links per room level'],
        constants: ['LINK_CAPACITY', 'LINK_LOSS_RATIO', 'LINK_COOLDOWN', 'CONTROLLER_STRUCTURES.link'],
        see: ['StructureLink.transferEnergy', 'recipe:link-network'],
    },
    'StructureLink.transferEnergy': {
        summary: 'Send energy to another link in the room, at any distance.',
        tasks: ['send energy through links', 'move energy across the room without creeps', 'link cooldown', 'how much energy does a link lose'],
        pitfalls: [
            'The sender then cools down {{LINK_COOLDOWN}} tick per tile of distance to the target (ERR_TIRED meanwhile). The receiver needs no cooldown.',
            '{{LINK_LOSS_RATIO * 100}}% of the amount is lost (rounded up).',
            'With an explicit amount that does not fit it returns ERR_FULL. Without an amount it sends what fits, and returns OK even when the target is full: check the free capacity of the target first.',
            'Only energy.',
        ],
        constants: ['LINK_CAPACITY', 'LINK_LOSS_RATIO', 'LINK_COOLDOWN'],
        see: ['recipe:link-network', 'StructureLink.cooldown'],
        engine: [{ file: P + 'links/transfer.js', find: 'target.store.energy -= Math.ceil(amount * C.LINK_LOSS_RATIO);', label: 'engine: loss and cooldown' }],
    },
    'StructureLink.cooldown': { summary: 'Ticks until the link can send again.', tasks: ['is a link ready'], see: ['StructureLink.transferEnergy'] },

    // ---------------------------------------------------------------- lab
    StructureLab: {
        summary: 'Makes compounds from two other labs and boosts creeps. Holds {{LAB_MINERAL_CAPACITY}} of one mineral and {{LAB_ENERGY_CAPACITY}} energy. Allowed: {{CONTROLLER_STRUCTURES.lab[6]}} at room level 6, {{CONTROLLER_STRUCTURES.lab[7]}} at 7, {{CONTROLLER_STRUCTURES.lab[8]}} at 8.',
        tasks: ['how many labs per room level', 'lab capacity'],
        constants: ['LAB_MINERAL_CAPACITY', 'LAB_ENERGY_CAPACITY', 'CONTROLLER_STRUCTURES.lab'],
        see: ['recipe:labs-and-boosts', 'StructureLab.runReaction', 'StructureLab.boostCreep', 'const:reactions'],
    },
    'StructureLab.runReaction': {
        summary: 'Make a compound in this lab from the minerals of two source labs within range 2.',
        range: 2,
        tasks: ['run a lab reaction', 'produce a compound', 'make boosts', 'how long does a reaction take'],
        pitfalls: [
            'Both source labs must be within range 2 of the producing lab; place the two source labs in the middle.',
            'Each run turns {{LAB_REACTION_AMOUNT}} + {{LAB_REACTION_AMOUNT}} units into {{LAB_REACTION_AMOUNT}} and puts the lab on a cooldown of REACTION_TIME[product] ticks.',
            'ERR_FULL when the product lab is full, ERR_INVALID_ARGS when the two inputs do not react or the lab holds a different mineral.',
        ],
        constants: ['LAB_REACTION_AMOUNT', 'LAB_COOLDOWN', 'REACTION_TIME', 'REACTIONS'],
        see: ['recipe:labs-and-boosts', 'const:reactions', 'StructureLab.reverseReaction'],
    },
    'StructureLab.reverseReaction': {
        summary: 'Split the compound in this lab back into its two reagents, into two labs within range 2.',
        range: 2,
        tasks: ['break down a compound', 'reverse a reaction'],
        see: ['StructureLab.runReaction', 'const:reactions'],
    },
    'StructureLab.boostCreep': {
        summary: 'Boost the matching body parts of an adjacent creep with the compound in the lab. Range 1.',
        range: 1,
        tasks: ['boost a creep', 'how much does a boost cost', 'boost only some parts'],
        pitfalls: [
            'Each part takes {{LAB_BOOST_MINERAL}} compound and {{LAB_BOOST_ENERGY}} energy; ERR_NOT_ENOUGH_RESOURCES when the lab has less than one part\'s worth.',
            'ERR_NOT_FOUND when the creep has no unboosted part the compound applies to.',
            'A boost lasts for the creep\'s life, and renewCreep removes it.',
            'With bodyPartsCount the parts are picked from the end of the body, except TOUGH, which is picked from the front.',
        ],
        constants: ['LAB_BOOST_MINERAL', 'LAB_BOOST_ENERGY', 'BOOSTS'],
        see: ['const:boosts', 'recipe:labs-and-boosts', 'StructureLab.unboostCreep'],
        engine: [{ file: P + 'labs/boost-creep.js', find: 'if(nonBoostedParts[0].type != C.TOUGH)', label: 'engine: which parts get boosted' }],
    },
    'StructureLab.unboostCreep': {
        summary: 'Remove all boosts from an adjacent creep and drop {{LAB_UNBOOST_MINERAL}} compound per part on its tile. Range 1.',
        range: 1,
        tasks: ['unboost a creep', 'get boost minerals back'],
        pitfalls: ['Half of the compound comes back ({{LAB_UNBOOST_MINERAL}} of {{LAB_BOOST_MINERAL}}), no energy. The lab goes on a cooldown that depends on the compounds removed.'],
        constants: ['LAB_UNBOOST_MINERAL', 'LAB_UNBOOST_ENERGY', 'LAB_BOOST_MINERAL'],
        see: ['StructureLab.boostCreep', 'StructureSpawn.recycleCreep'],
    },
    'StructureLab.mineralType': { summary: 'The mineral or compound in the lab, or null when it holds none.', tasks: ['what is in a lab'], see: ['StructureLab.runReaction'] },

    // ---------------------------------------------------------------- terminal, storage, factory
    StructureTerminal: {
        summary: 'Sends resources to other rooms and trades on the market. Holds {{TERMINAL_CAPACITY}}; available at room level 6.',
        tasks: ['terminal capacity', 'when do I get a terminal'],
        constants: ['TERMINAL_CAPACITY', 'TERMINAL_COOLDOWN', 'CONTROLLER_STRUCTURES.terminal'],
        see: ['StructureTerminal.send', 'recipe:terminal-and-market', 'Game.market.deal'],
    },
    'StructureTerminal.send': {
        summary: 'Send a resource to the terminal of another room.',
        tasks: ['send resources to another room', 'send energy to another room', 'how much does a terminal transfer cost', 'give resources to another player'],
        pitfalls: [
            'The energy fee is paid by the sender on top: ceil(amount × (1 − e^(−distance/30))). Sending energy needs amount + fee in the terminal.',
            'The terminal then cools down {{TERMINAL_COOLDOWN}} ticks (ERR_TIRED). One send or deal per terminal in that time.',
            'Distance is the linear room distance, wrapping around the world edge.',
        ],
        notes: ['Fee examples: about 3% at 1 room, 28% at 10 rooms, 63% at 30 rooms. Use Game.market.calcTransactionCost for exact numbers.'],
        constants: ['TERMINAL_COOLDOWN', 'TERMINAL_CAPACITY'],
        see: ['Game.market.calcTransactionCost', 'recipe:terminal-and-market', 'Game.map.getRoomLinearDistance'],
        engine: [{ file: 'src/utils.js', find: 'exports.calcTerminalEnergyCost', label: 'engine: fee formula' }],
    },
    'StructureTerminal.cooldown': { summary: 'Ticks until the terminal can send or deal again.', tasks: ['is the terminal ready'], see: ['StructureTerminal.send'] },
    StructureStorage: {
        summary: 'Holds {{STORAGE_CAPACITY}} of anything. One per room, from level 4.',
        tasks: ['storage capacity', 'when do I get a storage'],
        constants: ['STORAGE_CAPACITY', 'STORAGE_HITS', 'CONTROLLER_STRUCTURES.storage'],
        see: ['Room.storage', 'const:structures'],
    },
    StructureFactory: {
        summary: 'Compresses minerals into bars and builds commodities. Holds {{FACTORY_CAPACITY}}; room level 7.',
        tasks: ['what does a factory do'],
        constants: ['FACTORY_CAPACITY', 'CONTROLLER_STRUCTURES.factory'],
        see: ['StructureFactory.produce', 'const:commodities'],
    },
    'StructureFactory.produce': {
        summary: 'Produce one batch of a commodity from the resources in the factory.',
        tasks: ['produce a commodity', 'compress minerals into bars', 'make batteries', 'turn bars back into minerals'],
        pitfalls: [
            'Levelled commodities need a factory of exactly that level with an active PWR_OPERATE_FACTORY effect (ERR_BUSY without it, ERR_INVALID_TARGET for the wrong level).',
            'Each recipe has its own cooldown (COMMODITIES[type].cooldown).',
        ],
        constants: ['COMMODITIES', 'FACTORY_CAPACITY'],
        see: ['const:commodities', 'PowerCreep.usePower'],
    },

    // ---------------------------------------------------------------- container, road, rampart, wall
    StructureContainer: {
        summary: 'A walkable box for {{CONTAINER_CAPACITY}} of anything. Has no owner, can stand in any room, and decays.',
        tasks: ['what happens to a container in a room I do not own', 'how fast do containers decay in unowned rooms', 'container capacity', 'how many containers per room', 'who can use a container'],
        pitfalls: [
            'It loses {{CONTAINER_DECAY}} hits every {{CONTAINER_DECAY_TIME}} ticks in a room nobody owns (reserved rooms count as that) and every {{CONTAINER_DECAY_TIME_OWNED}} ticks in a room with an owner: {{CONTAINER_HITS / CONTAINER_DECAY * CONTAINER_DECAY_TIME}} and {{CONTAINER_HITS / CONTAINER_DECAY * CONTAINER_DECAY_TIME_OWNED}} ticks from full to gone.',
            'Upkeep is {{CONTAINER_DECAY * REPAIR_COST / CONTAINER_DECAY_TIME}} energy per tick in a remote room and {{CONTAINER_DECAY * REPAIR_COST / CONTAINER_DECAY_TIME_OWNED}} in an owned one.',
            'At most {{CONTROLLER_STRUCTURES.container[8]}} per room, at any room level.',
            'No owner means anyone can withdraw from it, repair it or dismantle it.',
        ],
        notes: ['When it decays away, the contents fall on the ground. Resources dropped on its tile, by a creep or a dying creep, go into it first.'],
        constants: ['CONTAINER_CAPACITY', 'CONTAINER_HITS', 'CONTAINER_DECAY', 'CONTAINER_DECAY_TIME', 'CONTAINER_DECAY_TIME_OWNED', 'CONTROLLER_STRUCTURES.container', 'CONSTRUCTION_COST.container'],
        see: ['mechanic:decay', 'mechanic:ownership', 'StructureContainer.ticksToDecay', 'Creep.withdraw', 'recipe:reserve-and-remote-mine'],
        engine: [{ file: P + 'containers/tick.js', find: 'roomController && roomController.level > 0 ? C.CONTAINER_DECAY_TIME_OWNED : C.CONTAINER_DECAY_TIME', label: 'engine: decay interval' }],
    },
    'StructureContainer.ticksToDecay': { summary: 'Ticks until the container next loses {{CONTAINER_DECAY}} hits.', tasks: ['when does a container decay'], constants: ['CONTAINER_DECAY', 'CONTAINER_DECAY_TIME', 'CONTAINER_DECAY_TIME_OWNED'], see: ['StructureContainer', 'mechanic:decay'] },
    StructureRoad: {
        summary: 'Halves the move cost of a tile (fatigue 1 per weight instead of 2, swamp 10). Has no owner and decays, faster under traffic.',
        tasks: ['how long does a road last', 'how fast do roads decay', 'road upkeep cost', 'how much does a road cost', 'do roads wear out from traffic', 'who can destroy a road', 'road on swamp', 'tunnel through a wall'],
        pitfalls: [
            'It loses {{ROAD_DECAY_AMOUNT}} hits every {{ROAD_DECAY_TIME}} ticks: {{ROAD_HITS / ROAD_DECAY_AMOUNT * ROAD_DECAY_TIME}} ticks from full to gone without traffic.',
            'Every creep step brings the next decay {{ROAD_WEAROUT}} tick closer per body part of that creep (power creeps {{ROAD_WEAROUT_POWER_CREEP}}).',
            'On swamp, hits, cost and decay are ×{{CONSTRUCTION_COST_ROAD_SWAMP_RATIO}}; through a wall ×{{CONSTRUCTION_COST_ROAD_WALL_RATIO}}.',
        ],
        notes: [
            'Upkeep without traffic: {{ROAD_DECAY_AMOUNT * REPAIR_COST}} energy per {{ROAD_DECAY_TIME}} ticks on plain, {{ROAD_DECAY_AMOUNT * REPAIR_COST * CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} on swamp, {{ROAD_DECAY_AMOUNT * REPAIR_COST * CONSTRUCTION_COST_ROAD_WALL_RATIO}} in a tunnel.',
            'Roads have no owner. The room owner can destroy() them; anyone can dismantle or attack them; they can be built in neutral and reserved rooms.',
            'Build cost: {{CONSTRUCTION_COST.road}} on plain, {{CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} on swamp, {{CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_WALL_RATIO}} through a wall.',
        ],
        constants: ['ROAD_HITS', 'ROAD_DECAY_AMOUNT', 'ROAD_DECAY_TIME', 'ROAD_WEAROUT', 'ROAD_WEAROUT_POWER_CREEP', 'CONSTRUCTION_COST.road', 'CONSTRUCTION_COST_ROAD_SWAMP_RATIO', 'CONSTRUCTION_COST_ROAD_WALL_RATIO'],
        see: ['mechanic:decay', 'mechanic:movement', 'Structure.destroy', 'Creep.repair', 'mechanic:ownership'],
        engine: [
            { file: P + 'roads/tick.js', find: 'var decayAmount = C.ROAD_DECAY_AMOUNT;', label: 'engine: decay' },
            { file: P + 'movement.js', find: 'road.nextDecayTime -= C.ROAD_WEAROUT * object.body.length;', label: 'engine: wear from traffic' },
        ],
    },
    'StructureRoad.ticksToDecay': { summary: 'Ticks until the road next loses hits.', tasks: ['when does a road decay'], see: ['StructureRoad', 'mechanic:decay'] },
    StructureRampart: {
        summary: 'A shield on a tile: your creeps and structures under it cannot be hit until it is destroyed. Enemy creeps cannot enter it.',
        tasks: ['protect a structure', 'can enemies walk through my rampart', 'why did my rampart disappear', 'keep a rampart from decaying away', 'rampart max hits by room level', 'how fast do ramparts decay', 'let allies pass through ramparts'],
        pitfalls: [
            'A new rampart has {{RAMPART_HITS}} hit and loses {{RAMPART_DECAY_AMOUNT}} every {{RAMPART_DECAY_TIME}} ticks: repair it right after building or it is gone at the first decay.',
            'Upkeep is {{RAMPART_DECAY_AMOUNT * REPAIR_COST / RAMPART_DECAY_TIME}} energy per tick per rampart.',
            'hitsMax follows the room level and is 0 in a room that is not yours.',
            'A creep attacking from a rampart tile takes no hit-back from melee.',
        ],
        notes: ['A public rampart (setPublic(true)) lets other players\' creeps walk through and lets them withdraw from structures under it.'],
        constants: ['RAMPART_HITS', 'RAMPART_HITS_MAX', 'RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME', 'CONTROLLER_STRUCTURES.rampart'],
        see: ['StructureRampart.setPublic', 'mechanic:decay', 'mechanic:movement', 'mechanic:damage-and-healing'],
        engine: [{ file: P + 'ramparts/tick.js', find: 'object.hits -= C.RAMPART_DECAY_AMOUNT;', label: 'engine: decay' }],
    },
    'StructureRampart.setPublic': { summary: 'Open or close the rampart for other players\' creeps.', tasks: ['open a rampart for allies', 'let other players walk through', 'make a rampart public'], see: ['StructureRampart', 'StructureRampart.isPublic'] },
    'StructureRampart.isPublic': { summary: 'True when other players may walk through.', tasks: ['is a rampart public'], see: ['StructureRampart.setPublic'] },
    StructureWall: {
        summary: 'Blocks movement for everyone. Starts at {{WALL_HITS}} hit, can be repaired up to {{WALL_HITS_MAX}}, does not decay and has no owner.',
        tasks: ['wall max hits', 'do walls decay'],
        constants: ['WALL_HITS', 'WALL_HITS_MAX', 'CONTROLLER_STRUCTURES.constructedWall'],
        see: ['StructureRampart', 'Creep.repair', 'Creep.dismantle'],
    },

    // ---------------------------------------------------------------- the rest
    StructureExtractor: { summary: 'Built on a mineral to allow harvesting it. Room level 6. Rests {{EXTRACTOR_COOLDOWN}} ticks after each harvest.', tasks: ['mine minerals', 'extractor cooldown'], constants: ['EXTRACTOR_COOLDOWN', 'CONTROLLER_STRUCTURES.extractor'], see: ['Creep.harvest', 'Mineral'] },
    StructureObserver: { summary: 'Gives vision of a room up to {{OBSERVER_RANGE}} rooms away. Room level 8.', tasks: ['see a room without creeps'], constants: ['OBSERVER_RANGE'], see: ['StructureObserver.observeRoom', 'recipe:observer-and-power'] },
    'StructureObserver.observeRoom': {
        summary: 'Ask for vision of a room. The room is in Game.rooms on the next tick, for that tick only.',
        tasks: ['observe a room', 'scout a room without a creep', 'get vision of a distant room'],
        pitfalls: [
            'The room is visible one tick later, not in the tick of the call. One room per observer per tick.',
            'Range is {{OBSERVER_RANGE}} rooms in each direction (ERR_NOT_IN_RANGE beyond).',
        ],
        constants: ['OBSERVER_RANGE'],
        see: ['Game.rooms', 'recipe:observer-and-power', 'Game.map.getRoomStatus'],
    },
    StructurePowerSpawn: { summary: 'Turns power into Global Power Level and spawns power creeps. Room level 8.', tasks: ['what is a power spawn for'], constants: ['POWER_SPAWN_ENERGY_RATIO', 'POWER_SPAWN_POWER_CAPACITY', 'POWER_SPAWN_ENERGY_CAPACITY'], see: ['StructurePowerSpawn.processPower', 'recipe:observer-and-power'] },
    'StructurePowerSpawn.processPower': {
        summary: 'Burn 1 power and {{POWER_SPAWN_ENERGY_RATIO}} energy for 1 point of GPL progress. Once per tick.',
        tasks: ['process power', 'raise GPL'],
        constants: ['POWER_SPAWN_ENERGY_RATIO', 'POWER_SPAWN_POWER_CAPACITY', 'POWER_SPAWN_ENERGY_CAPACITY'],
        see: ['Game.gpl', 'recipe:observer-and-power'],
    },
    StructurePowerBank: {
        summary: 'Appears in highway rooms with {{POWER_BANK_CAPACITY_MIN}}–{{POWER_BANK_CAPACITY_MAX}} power and {{POWER_BANK_HITS}} hits, for {{POWER_BANK_DECAY}} ticks.',
        tasks: ['harvest a power bank', 'how much damage does a power bank reflect'],
        pitfalls: ['It returns {{POWER_BANK_HIT_BACK * 100}}% of every hit to the attacker, so attackers need healers. The power drops on the ground when it breaks.'],
        constants: ['POWER_BANK_HITS', 'POWER_BANK_HIT_BACK', 'POWER_BANK_DECAY', 'POWER_BANK_CAPACITY_MIN', 'POWER_BANK_CAPACITY_MAX'],
        see: ['recipe:observer-and-power', 'Creep.attack'],
    },
    StructureNuker: { summary: 'Launches a nuke at a room up to {{NUKE_RANGE}} rooms away. Needs {{NUKER_ENERGY_CAPACITY}} energy and {{NUKER_GHODIUM_CAPACITY}} ghodium per launch.', tasks: ['how does a nuke work'], constants: ['NUKER_ENERGY_CAPACITY', 'NUKER_GHODIUM_CAPACITY', 'NUKER_COOLDOWN', 'NUKE_RANGE', 'NUKE_LAND_TIME', 'NUKE_DAMAGE'], see: ['StructureNuker.launchNuke', 'mechanic:nukes'] },
    'StructureNuker.launchNuke': {
        summary: 'Launch a nuke at a position. It lands {{NUKE_LAND_TIME}} ticks later.',
        tasks: ['launch a nuke', 'nuke a room'],
        pitfalls: ['The nuker then cools down {{NUKER_COOLDOWN}} ticks. The target room must be within {{NUKE_RANGE}} rooms. Resources put into a nuker cannot be taken out.'],
        constants: ['NUKER_COOLDOWN', 'NUKE_LAND_TIME', 'NUKE_RANGE', 'NUKE_DAMAGE'],
        see: ['mechanic:nukes'],
    },
    StructureInvaderCore: {
        summary: 'An NPC structure. Level 0 cores appear in neutral rooms near a stronghold and reserve the controller; levels 1–5 are strongholds with towers, ramparts and loot.',
        tasks: ['what is an invader core', 'remove an invader core from my remote room', 'why is my remote room reserved by Invader'],
        notes: ['A level 0 core has {{INVADER_CORE_HITS}} hits and no defence: kill it with a few ATTACK parts. Its reservation stays until it runs out or is attacked down.'],
        constants: ['INVADER_CORE_HITS', 'INVADER_CORE_CONTROLLER_POWER', 'STRONGHOLD_DECAY_TICKS', 'INVADER_CORE_EXPAND_TIME'],
        see: ['mechanic:invaders', 'Creep.attack', 'Creep.attackController'],
    },
    StructureKeeperLair: { summary: 'Spawns a Source Keeper next to a source or mineral in the centre rooms of a sector.', tasks: ['when does a source keeper respawn'], see: ['StructureKeeperLair.ticksToSpawn'] },
    'StructureKeeperLair.ticksToSpawn': { summary: 'Ticks until the next keeper appears at this lair.', tasks: ['time until the keeper respawns'] },
    StructurePortal: { summary: 'Teleports a creep that steps on it to another room or another shard.', tasks: ['travel to another shard', 'use a portal'], constants: ['PORTAL_DECAY'], see: ['InterShardMemory'] },
};
