'use strict';
// Own text for Creep and PowerCreep entries. {{EXPR}} is evaluated against the constants at build time.
// engine: [{file, find, label}] resolves to a line link and fails the build when the code moved.
const API = 'src/game/creeps.js';
const P = 'src/processor/intents/creeps/';

module.exports = {
    Creep: {
        summary: 'A unit you spawn. Its body parts decide what it can do; it lives {{CREEP_LIFE_TIME}} ticks ({{CREEP_CLAIM_LIFE_TIME}} with a CLAIM part).',
        tasks: ['what can a creep do', 'list of creep actions'],
        see: ['mechanic:simultaneous-actions', 'const:body-parts', 'StructureSpawn.spawnCreep'],
    },

    'Creep.harvest': {
        summary: 'Take energy from a source, a mineral from a deposit with an extractor, or a commodity from a highway deposit. Range 1, needs WORK.',
        range: 1, part: 'WORK',
        tasks: ['mine a source', 'harvest energy', 'mine a mineral', 'harvest a deposit', 'how much energy does a WORK part harvest per tick', 'how many WORK parts to drain a source'],
        pitfalls: [
            'Returns ERR_NOT_OWNER in a room owned or reserved by another player; an invader core reservation counts.',
            'Whatever does not fit in the store falls on the ground under the creep (and lands in a container if the creep stands on one). A miner without CARRY drops everything.',
            'A mineral needs an extractor on it, and the extractor rests {{EXTRACTOR_COOLDOWN}} ticks after each harvest.',
            'harvest does not run in a tick where the creep also attacks, builds, repairs, dismantles or heals.',
        ],
        notes: [
            '{{HARVEST_POWER}} energy per WORK per tick. A {{SOURCE_ENERGY_CAPACITY}} source regenerates every {{ENERGY_REGEN_TIME}} ticks, so {{SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER}} WORK drain it exactly; a neutral room ({{SOURCE_ENERGY_NEUTRAL_CAPACITY}}) needs {{Math.ceil(SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER)}} WORK, a keeper room ({{SOURCE_ENERGY_KEEPER_CAPACITY}}) {{Math.ceil(SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER)}}.',
            'Minerals: {{HARVEST_MINERAL_POWER}} per WORK per harvest. Deposits: {{HARVEST_DEPOSIT_POWER}} per WORK, with a cooldown that grows as the deposit is used.',
            'Harvested energy also feeds the room\'s invader counter.',
        ],
        constants: ['HARVEST_POWER', 'HARVEST_MINERAL_POWER', 'HARVEST_DEPOSIT_POWER', 'SOURCE_ENERGY_CAPACITY', 'SOURCE_ENERGY_NEUTRAL_CAPACITY', 'SOURCE_ENERGY_KEEPER_CAPACITY', 'ENERGY_REGEN_TIME', 'EXTRACTOR_COOLDOWN'],
        see: ['recipe:harvest-and-haul', 'mechanic:sources', 'mechanic:invaders', 'Source.energy', 'const:boosts'],
        engine: [
            { file: API, find: 'Creep.prototype.harvest', label: 'engine: API checks' },
            { file: P + 'harvest.js', find: 'if (sum > object.storeCapacity)', label: 'engine: overflow is dropped' },
        ],
    },

    'Creep.transfer': {
        summary: 'Give a resource to an adjacent creep, power creep or structure that can hold it. Range 1.',
        range: 1,
        tasks: ['move energy from one creep to another', 'refill a spawn or extension', 'fill a tower', 'supply a lab', 'put energy into storage', 'deliver energy', 'hand resources to another creep', 'give energy to another player\'s creep', 'can a creep transfer to another player\'s creep', 'what happens when the target is full', 'unload a hauler'],
        pitfalls: [
            'One transfer per creep per tick: a second call in the same tick replaces the first, and both return OK.',
            'With an explicit amount larger than the free space it returns ERR_FULL and nothing is sent. Leave the amount out to send what fits.',
            'The check uses the state at the start of the tick. If two creeps fill the same target in one tick, both get OK and the second one is cut down to what still fits (or does nothing).',
            'Energy received this tick cannot be passed on in the same tick: the script still sees the old store.',
            'A creep cannot take from another creep. The giver has to call transfer.',
        ],
        notes: [
            'There is no ownership check, neither in the API nor in the processor: it works on other players\' creeps and structures too.',
            'transfer(controller, RESOURCE_ENERGY) is the same as upgradeController.',
            'A mineral transferred into an empty lab sets the lab\'s mineral type.',
        ],
        see: ['Creep.withdraw', 'Creep.drop', 'Creep.pickup', 'Store.getFreeCapacity', 'recipe:harvest-and-haul', 'mechanic:simultaneous-actions'],
        engine: [
            { file: API, find: 'Creep.prototype.transfer', label: 'engine: API checks (no owner check on the target)' },
            { file: P + 'transfer.js', find: 'if(storedAmount + amount > targetCapacity)', label: 'engine: amount is cut to the free space' },
        ],
    },

    'Creep.withdraw': {
        summary: 'Take a resource from an adjacent structure, tombstone or ruin. Range 1.',
        range: 1,
        tasks: ['take energy from a container', 'take energy from storage', 'empty a tombstone', 'loot a ruin', 'take resources out of another player\'s structure', 'take energy from a link', 'take minerals out of a lab or terminal'],
        pitfalls: [
            'Does not work on creeps (ERR_INVALID_TARGET); the other creep must transfer.',
            'Another player\'s structure works only if no non-public rampart of theirs is on its tile (ERR_NOT_OWNER), and never while their room is in safe mode.',
            'Not possible from nukers and power banks.',
            'With an explicit amount larger than the free capacity it returns ERR_FULL. Leave the amount out to take what fits.',
            'If several creeps withdraw from the same store in one tick, later ones get less than requested or nothing, although all got OK.',
        ],
        notes: [
            'Containers and roads have no owner, so withdrawing from a container works in any room that is not in another player\'s safe mode.',
            'Dropped resources are taken with pickup, not withdraw.',
        ],
        see: ['Creep.transfer', 'Creep.pickup', 'Tombstone.store', 'Ruin.store', 'mechanic:ownership'],
        engine: [
            { file: API, find: 'Creep.prototype.withdraw', label: 'engine: API checks' },
            { file: P + 'withdraw.js', find: 'i.type == C.STRUCTURE_RAMPART && i.user != object.user && !i.isPublic', label: 'engine: rampart rule' },
        ],
    },

    'Creep.pickup': {
        summary: 'Pick up a dropped resource pile from an adjacent tile (or the own tile). Range 1.',
        range: 1,
        tasks: ['pick up dropped energy', 'collect energy from the ground', 'gather dropped resources'],
        pitfalls: [
            'Takes as much as fits; there is no amount argument.',
            'The pile shrinks every tick: it loses ceil(amount / {{ENERGY_DECAY}}).',
        ],
        constants: ['ENERGY_DECAY'],
        see: ['Resource.amount', 'Creep.withdraw', 'mechanic:decay'],
        engine: [{ file: P + 'pickup.js', find: 'var amount = Math.min(object.storeCapacity - carry, target[resourceType])', label: 'engine: takes what fits' }],
    },

    'Creep.drop': {
        summary: 'Drop a resource on the creep\'s own tile.',
        tasks: ['drop energy on the ground', 'drop mining', 'empty a creep'],
        pitfalls: [
            'If a container is on the tile the resource goes into it first; only the rest becomes a pile.',
            'A pile decays by ceil(amount / {{ENERGY_DECAY}}) per tick.',
        ],
        constants: ['ENERGY_DECAY'],
        see: ['Creep.pickup', 'Creep.transfer', 'mechanic:decay'],
        engine: [{ file: 'src/processor/intents/_create-energy.js', find: "var container = _.find(roomObjects, {type: 'container', x, y});", label: 'engine: a container on the tile takes it first' }],
    },

    'Creep.build': {
        summary: 'Put energy into a construction site. Range 3, needs WORK and energy.',
        range: 3, part: 'WORK',
        tasks: ['build a structure', 'build a construction site', 'can I build in another player\'s room', 'build an ally\'s construction site', 'how fast does a creep build'],
        pitfalls: [
            'ERR_INVALID_TARGET if a creep stands on a site for a non-walkable structure (spawn, extension, tower, wall …). Roads, containers and ramparts can be built under creeps.',
            'build wins over attack and harvest in the same tick, and loses to repair, dismantle and heal.',
            'A creep that had no energy at the start of the tick gets ERR_NOT_ENOUGH_RESOURCES even if it withdraws in the same tick.',
        ],
        notes: [
            '{{BUILD_POWER}} energy per WORK per tick, 1 energy = 1 progress. Boosts (LH, LH2O, XLH2O) add progress without using more energy.',
            'There is no owner check on the site: any creep can build any construction site. Placing a site in a room owned or reserved by someone else is what is blocked.',
            'A new rampart has {{RAMPART_HITS}} hit and a new wall {{WALL_HITS}}; repair them at once.',
        ],
        constants: ['BUILD_POWER', 'CONSTRUCTION_COST', 'MAX_CONSTRUCTION_SITES'],
        see: ['Room.createConstructionSite', 'Creep.repair', 'ConstructionSite.remove', 'mechanic:ownership', 'const:structures'],
        engine: [
            { file: API, find: 'Creep.prototype.build', label: 'engine: API checks' },
            { file: P + 'build.js', find: 'var buildPower =', label: 'engine: build power and boosts' },
        ],
    },

    'Creep.repair': {
        summary: 'Restore hits of a structure. Range 3, needs WORK and energy.',
        range: 3, part: 'WORK',
        tasks: ['repair a road', 'repair a container', 'repair a rampart or wall', 'maintain structures', 'how much does repairing cost', 'repair a structure I do not own'],
        pitfalls: [
            'repair wins over build, attack and harvest in the same tick, and loses to dismantle and heal.',
            'Calling it on a structure at full hits still returns OK and costs the 0.2 CPU; check hits < hitsMax first.',
        ],
        notes: [
            '{{REPAIR_POWER}} hits per WORK per tick for {{REPAIR_POWER * REPAIR_COST}} energy ({{REPAIR_COST}} energy per hit). Boosts (LH, LH2O, XLH2O) add hits for free.',
            'No owner check: any structure with a build cost can be repaired, in any room.',
            'A tower repairs {{TOWER_POWER_REPAIR}} hits for {{TOWER_ENERGY_COST}} energy at close range, which is cheaper per hit only within range {{TOWER_OPTIMAL_RANGE}}.',
        ],
        constants: ['REPAIR_POWER', 'REPAIR_COST'],
        see: ['StructureTower.repair', 'mechanic:decay', 'Structure.hits'],
        engine: [{ file: P + 'repair.js', find: 'var repairPower =', label: 'engine: repair power and cost' }],
    },

    'Creep.dismantle': {
        summary: 'Take a structure apart and get part of its energy back. Range 1, needs WORK.',
        range: 1, part: 'WORK',
        tasks: ['dismantle a wall', 'destroy a structure in a room I do not own', 'remove an enemy structure', 'tear down a road in another player\'s room', 'who can destroy a road', 'break through a rampart'],
        pitfalls: [
            'Does nothing in a room under another player\'s safe mode (returns ERR_NO_BODYPART there).',
            'If a rampart is on the tile, the rampart takes the damage first.',
            'Only structures with a build cost: not controllers, keeper lairs, portals, power banks or invader cores (use attack for those that have hits).',
            'In your own room Structure.destroy() is free and instant; dismantle is for rooms you do not own.',
        ],
        notes: [
            '{{DISMANTLE_POWER}} hits per WORK per tick; returns {{DISMANTLE_COST}} energy per hit ({{DISMANTLE_POWER * DISMANTLE_COST}} per WORK per tick). Energy that does not fit is dropped.',
            'No owner check at all: own, neutral and hostile structures alike. Boosts: ZH ×2, ZH2O ×3, XZH2O ×4.',
        ],
        constants: ['DISMANTLE_POWER', 'DISMANTLE_COST'],
        see: ['Structure.destroy', 'Creep.attack', 'mechanic:ownership', 'mechanic:safe-mode'],
        engine: [
            { file: API, find: 'Creep.prototype.dismantle', label: 'engine: API checks (no owner check)' },
            { file: P + 'dismantle.js', find: 'var power = utils.calcBodyEffectiveness', label: 'engine: power and energy gain' },
        ],
    },

    'Creep.attack': {
        summary: 'Melee attack on a creep, power creep or structure. Range 1, needs ATTACK.',
        range: 1, part: 'ATTACK',
        tasks: ['attack a creep', 'kill an enemy creep', 'kill an invader', 'melee attack', 'destroy a structure by attacking', 'attack an invader core'],
        pitfalls: [
            'The target creep hits back with all its ATTACK parts, unless the attacker stands on a rampart.',
            'A rampart on the target\'s tile takes the damage instead of the target.',
            'Blocked in a room under another player\'s safe mode.',
            'attack does not run in a tick with build, repair, dismantle, attackController, heal or rangedHeal. It does combine with rangedAttack and move.',
        ],
        notes: ['{{ATTACK_POWER}} damage per ATTACK part per tick. Boosts: UH ×2, UH2O ×3, XUH2O ×4.'],
        constants: ['ATTACK_POWER'],
        see: ['Creep.rangedAttack', 'Creep.rangedMassAttack', 'StructureTower.attack', 'mechanic:damage-and-healing', 'mechanic:simultaneous-actions'],
        engine: [{ file: 'src/processor/intents/_damage.js', find: 'attackBackPower = utils.calcBodyEffectiveness', label: 'engine: hit-back rule' }],
    },

    'Creep.rangedAttack': {
        summary: 'Ranged attack on one target. Range 3, needs RANGED_ATTACK.',
        range: 3, part: 'RANGED_ATTACK',
        tasks: ['shoot a creep at range', 'ranged attack', 'kite an enemy'],
        pitfalls: [
            'Not executed in a tick with rangedMassAttack, build, repair or rangedHeal.',
            'A rampart on the target\'s tile takes the damage.',
        ],
        notes: ['{{RANGED_ATTACK_POWER}} damage per part at any distance up to 3. Boosts: KO ×2, KHO2 ×3, XKHO2 ×4.'],
        constants: ['RANGED_ATTACK_POWER'],
        see: ['Creep.rangedMassAttack', 'Creep.attack', 'mechanic:damage-and-healing'],
    },

    'Creep.rangedMassAttack': {
        summary: 'Damage every hostile creep and structure within range 3 at once. Needs RANGED_ATTACK.',
        range: 3, part: 'RANGED_ATTACK',
        tasks: ['area damage', 'attack several creeps at once', 'damage ramparts around the creep'],
        pitfalls: [
            'Damage falls with distance: 100% at range 1, 40% at range 2, 10% at range 3. Against a single target at range 2–3 rangedAttack is stronger.',
            'A creep or structure under a rampart is skipped; the rampart itself is hit.',
            'It hits everything with an owner that is not you, allies included, and power banks.',
        ],
        notes: ['Base {{RANGED_ATTACK_POWER}} per part: {{RANGED_ATTACK_POWER}} / {{RANGED_ATTACK_POWER * 0.4}} / {{RANGED_ATTACK_POWER * 0.1}} at range 1 / 2 / 3.'],
        constants: ['RANGED_ATTACK_POWER'],
        see: ['Creep.rangedAttack', 'mechanic:damage-and-healing'],
        engine: [{ file: P + 'rangedMassAttack.js', find: 'var distanceRate =', label: 'engine: distance rates' }],
    },

    'Creep.heal': {
        summary: 'Heal the creep itself or an adjacent creep. Range 1, needs HEAL.',
        range: 1, part: 'HEAL',
        tasks: ['heal a creep', 'heal itself', 'what does a HEAL part heal', 'what does a boosted HEAL part heal', 'heal another player\'s creep'],
        pitfalls: [
            'heal blocks every other "work" action of the creep in that tick: rangedHeal, attackController, dismantle, repair, build, attack and harvest are dropped. Ranged attacks and move still run.',
            'Damage and healing of one tick are added up at the end of the tick: the creep survives if hits − damage + healing stays above 0.',
            'Blocked in a room under another player\'s safe mode.',
        ],
        notes: [
            '{{HEAL_POWER}} hits per HEAL part per tick at range 1. Boosted: LO {{HEAL_POWER * BOOSTS.heal.LO.heal}}, LHO2 {{HEAL_POWER * BOOSTS.heal.LHO2.heal}}, XLHO2 {{HEAL_POWER * BOOSTS.heal.XLHO2.heal}} per part.',
            'No owner check: any creep can be healed.',
        ],
        constants: ['HEAL_POWER', 'RANGED_HEAL_POWER', 'BOOSTS.heal'],
        see: ['Creep.rangedHeal', 'StructureTower.heal', 'mechanic:damage-and-healing', 'const:boosts'],
        engine: [{ file: P + 'heal.js', find: 'var healPower = utils.calcBodyEffectiveness', label: 'engine: heal power with boosts' }],
    },

    'Creep.rangedHeal': {
        summary: 'Heal a creep up to 3 tiles away. Needs HEAL.',
        range: 3, part: 'HEAL',
        tasks: ['heal at range', 'heal a creep that is not adjacent'],
        pitfalls: ['Dropped if the creep also calls heal in the same tick. Blocks rangedAttack, rangedMassAttack, build, repair, attack and harvest.'],
        notes: ['{{RANGED_HEAL_POWER}} hits per HEAL part per tick. Boosted: LO {{RANGED_HEAL_POWER * BOOSTS.heal.LO.rangedHeal}}, LHO2 {{RANGED_HEAL_POWER * BOOSTS.heal.LHO2.rangedHeal}}, XLHO2 {{RANGED_HEAL_POWER * BOOSTS.heal.XLHO2.rangedHeal}}.'],
        constants: ['RANGED_HEAL_POWER', 'HEAL_POWER'],
        see: ['Creep.heal', 'mechanic:damage-and-healing'],
    },

    'Creep.move': {
        summary: 'Move one tile in a direction (1–8), or follow an adjacent creep that pulls this one. Needs MOVE and no fatigue.',
        part: 'MOVE',
        tasks: ['move one step', 'move in a direction', 'swap places with another creep', 'follow a pulling creep'],
        pitfalls: [
            'Returns OK even if the tile turns out to be blocked; compare the position next tick.',
            'A creep that does not move is an obstacle. Two creeps moving into each other\'s tiles swap.',
            'Your own construction site for a non-walkable structure blocks your creeps.',
            'A second move call in the same tick replaces the first.',
        ],
        notes: [
            'When several creeps want the same tile, the engine prefers the one moving out of a tile somebody else wants, then pulled creeps, then pulling ones, then the best MOVE-to-weight ratio.',
            'Stepping onto another player\'s construction site removes it.',
        ],
        see: ['Creep.moveTo', 'Creep.pull', 'Creep.fatigue', 'mechanic:movement', 'const:directions'],
        engine: [
            { file: 'src/processor/intents/movement.js', find: 'rates.sort(', label: 'engine: who gets a contested tile' },
            { file: 'src/processor/intents/movement.js', find: 'function checkObstacleAtXY', label: 'engine: what blocks a tile' },
        ],
    },

    'Creep.moveTo': {
        summary: 'Find a path to a target and take one step along it. Caches the path in creep memory.',
        part: 'MOVE',
        tasks: ['move a creep to a target', 'walk to a position', 'go to another room', 'path to a target'],
        pitfalls: [
            'The stored path is reused for reusePath ticks (default 5) and treats other creeps as obstacles when it is computed; in traffic it re-paths often. ignoreCreeps plus an own traffic solution is cheaper.',
            'Costs the pathfinding CPU plus the 0.2 CPU of the move it issues.',
            'ERR_NO_PATH also comes back when the cached path is used up and the creep is not next to the target.',
            'Returns ERR_TIRED before doing anything when the creep has fatigue; test creep.fatigue first to save the call.',
            'The default search stops at maxOps 2000 and maxRooms 16; far targets need a route or larger limits.',
        ],
        notes: ['It writes creep.memory._move. With noPathFinding it only follows a stored path and returns ERR_NOT_FOUND otherwise.'],
        see: ['PathFinder.search', 'Creep.moveByPath', 'Creep.move', 'Room.findPath', 'mechanic:movement', 'Game.map.findRoute'],
        engine: [{ file: API, find: 'Creep.prototype.moveTo', label: 'engine: moveTo' }],
    },

    'Creep.moveByPath': {
        summary: 'Take the next step of a path you computed yourself (from findPath, PathFinder.search or a serialized string).',
        part: 'MOVE',
        tasks: ['follow a stored path', 'reuse a path', 'move along a PathFinder path'],
        pitfalls: [
            'ERR_NOT_FOUND when the creep is neither on the path nor next to its first step.',
            'A PathFinder.search path is an array of RoomPosition and does not contain the start tile.',
        ],
        see: ['PathFinder.search', 'Room.findPath', 'Room.serializePath', 'Creep.moveTo'],
    },

    'Creep.pull': {
        summary: 'Tow an adjacent creep: the pulled creep follows without needing MOVE parts, and its fatigue goes to the puller.',
        range: 1,
        tasks: ['pull a creep without MOVE parts', 'tow a miner to its source', 'move a creep that has no MOVE', 'train of creeps'],
        pitfalls: [
            'Three calls in one tick: puller.pull(target), target.move(puller), puller.move(direction). Without the target\'s move nothing follows.',
            'The puller pays the fatigue of both bodies, so it needs enough MOVE for the combined weight.',
            'For the last step the two swap tiles: puller.pull(target), target.move(puller), puller.move(target).',
        ],
        notes: ['pull itself does not cost the 0.2 CPU; the two moves do.'],
        see: ['Creep.move', 'mechanic:movement'],
        engine: [
            { file: 'src/processor/intents/movement.js', find: 'exports.addPulling', label: 'engine: pulling' },
            { file: P + '_add-fatigue.js', find: 'while(!!object._pulled', label: 'engine: fatigue goes to the puller' },
        ],
    },

    'Creep.upgradeController': {
        summary: 'Spend energy on your room controller. Range 3, needs WORK and energy.',
        range: 3, part: 'WORK',
        tasks: ['upgrade the controller', 'raise the room level', 'keep the controller from downgrading', 'how much can I upgrade at RCL 8'],
        pitfalls: [
            'At level 8 a controller takes at most {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy per tick from all creeps together.',
            'ERR_INVALID_TARGET while the controller is upgrade-blocked (after an attackController or a nuke).',
            'A creep without energy at the start of the tick gets ERR_NOT_ENOUGH_RESOURCES even if it withdraws in the same tick.',
        ],
        notes: [
            '{{UPGRADE_CONTROLLER_POWER}} energy per WORK per tick. Boosts (GH ×1.5, GH2O ×1.8, XGH2O ×2) add progress without using more energy.',
            'A tick with any upgrade adds {{CONTROLLER_DOWNGRADE_RESTORE}} ticks to the downgrade timer, up to its maximum.',
            'Upgrading also counts toward GCL, and is independent of harvest, build and repair: a creep can upgrade and do one of those in the same tick.',
            'Each level gained adds one available safe mode.',
        ],
        constants: ['UPGRADE_CONTROLLER_POWER', 'CONTROLLER_MAX_UPGRADE_PER_TICK', 'CONTROLLER_LEVELS', 'CONTROLLER_DOWNGRADE', 'CONTROLLER_DOWNGRADE_RESTORE'],
        see: ['mechanic:controller', 'StructureController.ticksToDowngrade', 'StructureController.progress', 'const:controller'],
        engine: [{ file: P + 'upgradeController.js', find: 'if(target.level == 8)', label: 'engine: level 8 cap' }],
    },

    'Creep.reserveController': {
        summary: 'Reserve a neutral controller. Range 1, needs CLAIM.',
        range: 1, part: 'CLAIM',
        tasks: ['reserve a room', 'reserve a controller', 'find the cheapest way to reserve a room', 'how long does a reservation last per CLAIM part', 'keep a remote room reserved'],
        pitfalls: [
            'A reservation loses 1 tick per tick, so a creep with 1 CLAIM only holds the level; the gain is CLAIM parts − 1 per tick.',
            'At the cap of {{CONTROLLER_RESERVE_MAX}} ticks the call still returns OK and costs 0.2 CPU but adds nothing; skip it when ticksToEnd + parts > {{CONTROLLER_RESERVE_MAX}}.',
            'CLAIM creeps live {{CREEP_CLAIM_LIFE_TIME}} ticks and cannot be renewed.',
            'ERR_INVALID_TARGET if someone else, an invader core included, holds the reservation; use attackController to wear it down.',
        ],
        notes: [
            'Each call adds {{CONTROLLER_RESERVE}} tick per CLAIM part.',
            'A reserved room has {{SOURCE_ENERGY_CAPACITY}} sources instead of {{SOURCE_ENERGY_NEUTRAL_CAPACITY}}, keeps other players from harvesting and placing sites, and its exits stop letting invaders into the neighbours.',
            'Cheapest steady state: body parts that arrive with as many ticks of life left as possible. Two CLAIM parts ({{BODYPART_COST.claim * 2}} energy + MOVE) gain 1 tick per tick; one creep with 2 CLAIM working ~500 ticks banks ~500 ticks of reservation.',
        ],
        constants: ['CONTROLLER_RESERVE', 'CONTROLLER_RESERVE_MAX', 'CREEP_CLAIM_LIFE_TIME', 'BODYPART_COST.claim'],
        see: ['recipe:reserve-and-remote-mine', 'mechanic:reservation', 'StructureController.reservation', 'Creep.attackController', 'Creep.claimController'],
        engine: [
            { file: P + 'reserveController.js', find: 'if(target.reservation.endTime + effect > gameTime + C.CONTROLLER_RESERVE_MAX)', label: 'engine: cap, the intent is skipped' },
            { file: 'src/processor/intents/controllers/tick.js', find: 'gameTime >= object.reservation.endTime-1', label: 'engine: reservation end' },
        ],
    },

    'Creep.claimController': {
        summary: 'Take ownership of a neutral controller. Range 1, needs CLAIM and a free GCL slot.',
        range: 1, part: 'CLAIM',
        tasks: ['claim a room', 'claim a controller', 'expand to a new room', 'take over a room'],
        pitfalls: [
            'ERR_GCL_NOT_ENOUGH when your Global Control Level does not allow another room.',
            'The controller must be at level 0 and not reserved by someone else. An owned controller must first be brought down with attackController until it downgrades to 0.',
            'One CLAIM part is enough; the claim is instant.',
            'The new room starts at level 1 with no spawn: bring builders and energy, or place the spawn site and build it from a neighbour.',
        ],
        constants: ['GCL_MULTIPLY', 'GCL_POW', 'BODYPART_COST.claim', 'CREEP_CLAIM_LIFE_TIME'],
        see: ['recipe:claim-a-room', 'Creep.reserveController', 'Creep.attackController', 'Game.gcl', 'StructureController.unclaim'],
        engine: [{ file: API, find: 'Creep.prototype.claimController', label: 'engine: API checks' }],
    },

    'Creep.attackController': {
        summary: 'Wear down another player\'s reservation or ownership of a controller. Range 1, needs CLAIM.',
        range: 1, part: 'CLAIM',
        tasks: ['remove an enemy reservation', 'remove an invader core reservation', 'downgrade an enemy controller', 'take a room from another player'],
        pitfalls: [
            'Against an owned controller it works once per {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks: the attack sets upgradeBlocked and returns ERR_TIRED until it ends. Bring all CLAIM parts in the same tick.',
            'Blocked while the room is in safe mode.',
            'It replaces heal-type actions: not executed with heal or rangedHeal in the same tick.',
        ],
        notes: [
            'Reserved controller: the reservation loses {{CONTROLLER_RESERVE}} tick per CLAIM part per call.',
            'Owned controller: the downgrade timer loses {{CONTROLLER_CLAIM_DOWNGRADE}} ticks per CLAIM part and the owner cannot upgrade for {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks.',
        ],
        constants: ['CONTROLLER_CLAIM_DOWNGRADE', 'CONTROLLER_ATTACK_BLOCKED_UPGRADE', 'CONTROLLER_RESERVE'],
        see: ['Creep.reserveController', 'Creep.claimController', 'StructureController.upgradeBlocked', 'mechanic:controller', 'mechanic:invaders'],
        engine: [{ file: P + 'attackController.js', find: 'target._upgradeBlocked = gameTime + C.CONTROLLER_ATTACK_BLOCKED_UPGRADE', label: 'engine: effect on an owned controller' }],
    },

    'Creep.signController': {
        summary: 'Write a text on any controller. Range 1, no body part needed.',
        range: 1,
        tasks: ['sign a controller', 'leave a message on a room'],
        notes: ['Works on any controller, owned or not. An empty string removes the sign.'],
        see: ['StructureController.sign'],
    },

    'Creep.generateSafeMode': {
        summary: 'Add one available safe mode to a controller for {{SAFE_MODE_COST}} ghodium. Range 1.',
        range: 1,
        tasks: ['get another safe mode', 'buy a safe mode with ghodium'],
        constants: ['SAFE_MODE_COST'],
        see: ['StructureController.activateSafeMode', 'StructureController.safeModeAvailable', 'recipe:safe-mode'],
    },

    'Creep.say': {
        summary: 'Show a short text bubble over the creep for one tick.',
        tasks: ['show a debug text over a creep'],
        notes: ['At most 10 characters. Free of the 0.2 CPU intent cost. With the second argument true, other players see it.'],
        see: ['RoomVisual.text'],
    },

    'Creep.suicide': {
        summary: 'Kill the creep at once.',
        tasks: ['kill my own creep', 'get rid of a creep'],
        pitfalls: ['The tombstone gets only {{CREEP_CORPSE_RATE * 100}}% of the body energy for the remaining life. Recycling at a spawn returns up to 100%.'],
        constants: ['CREEP_CORPSE_RATE'],
        see: ['StructureSpawn.recycleCreep', 'mechanic:creep-death'],
    },

    'Creep.cancelOrder': {
        summary: 'Drop an intent already issued this tick, by method name.',
        tasks: ['cancel an action this tick', 'undo a move order'],
        notes: ['Example: creep.cancelOrder(\'move\').'],
    },

    'Creep.getActiveBodyparts': {
        summary: 'Count the body parts of one type that still have hits.',
        tasks: ['count working body parts', 'check if a creep can still attack'],
        notes: ['Damaged parts stop working from the front of the body; put TOUGH first and MOVE or HEAL last.'],
        see: ['Creep.body', 'const:body-parts'],
    },

    'Creep.notifyWhenAttacked': {
        summary: 'Switch the e-mail notification for attacks on this creep on or off.',
        tasks: ['turn off attack notifications'],
        notes: ['Only queued when the value changes, so repeating it each tick costs almost nothing.'],
    },

    'Creep.body': {
        summary: 'Array of body parts in order: {type, hits, boost}. Each part has 100 hits; damage removes parts from the front.',
        tasks: ['read a creep\'s body parts', 'see which parts are boosted', 'size of a creep'],
        constants: ['MAX_CREEP_SIZE', 'BODYPART_COST'],
        see: ['Creep.getActiveBodyparts', 'const:body-parts', 'const:boosts'],
    },
    'Creep.store': {
        summary: 'What the creep carries. Capacity is {{CARRY_CAPACITY}} per CARRY part (more when boosted).',
        tasks: ['how much does a creep carry', 'free capacity of a creep', 'is the creep full'],
        constants: ['CARRY_CAPACITY'],
        see: ['Store.getFreeCapacity', 'Store.getUsedCapacity', 'Store.getCapacity'],
    },
    'Creep.fatigue': {
        summary: 'While above 0 the creep cannot move. Each MOVE part removes 2 per tick.',
        tasks: ['why does my creep not move', 'how many MOVE parts does a creep need'],
        see: ['mechanic:movement', 'Creep.move'],
    },
    'Creep.ticksToLive': {
        summary: 'Ticks until the creep dies of age. Undefined while it is spawning.',
        tasks: ['how long does a creep live', 'when to replace a creep', 'remaining life of a creep'],
        constants: ['CREEP_LIFE_TIME', 'CREEP_CLAIM_LIFE_TIME'],
        see: ['StructureSpawn.renewCreep', 'mechanic:creep-death'],
    },
    'Creep.spawning': {
        summary: 'True while the creep is still inside the spawn. Almost every method returns ERR_BUSY then.',
        tasks: ['check if a creep is still spawning'],
        see: ['StructureSpawn.spawning'],
    },
    'Creep.memory': {
        summary: 'Shortcut to Memory.creeps[name].',
        tasks: ['store data on a creep'],
        pitfalls: ['The entry stays in Memory.creeps after the creep dies; delete it yourself.'],
        see: ['Memory', 'mechanic:memory'],
    },
    'Creep.hits': { summary: 'Current hits; hitsMax is 100 per body part.', tasks: ['how damaged is a creep'], see: ['Creep.body', 'mechanic:damage-and-healing'] },
    'Creep.my': { summary: 'True for your own creeps.', tasks: ['is this creep mine'], see: ['Creep.owner'] },
    'Creep.owner': { summary: '{username} of the creep\'s owner. Invaders are "Invader", keepers "Source Keeper".', tasks: ['who owns a creep', 'tell invaders from players'], see: ['mechanic:invaders'] },

    // ---------------------------------------------------------------- PowerCreep
    PowerCreep: {
        summary: 'A hero unit that does not die of age for good: it is created once per account, levelled with GPL, and respawned at a power spawn.',
        tasks: ['what is a power creep', 'operator powers'],
        see: ['recipe:power', 'const:power', 'PowerCreep.usePower'],
    },
    'PowerCreep.create': {
        summary: 'Create a new power creep on the account. It costs one free GPL level and does not appear in a room until spawn() is called.',
        tasks: ['create a power creep'],
        see: ['PowerCreep.spawn', 'Game.gpl', 'recipe:power'],
    },
    'PowerCreep.spawn': {
        summary: 'Place the power creep at one of your power spawns.',
        tasks: ['spawn a power creep'],
        pitfalls: ['After a death it cannot be spawned again for {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours (real time).'],
        constants: ['POWER_CREEP_SPAWN_COOLDOWN', 'POWER_CREEP_LIFE_TIME'],
        see: ['PowerCreep.renew', 'recipe:power'],
    },
    'PowerCreep.renew': {
        summary: 'Reset ticksToLive to {{POWER_CREEP_LIFE_TIME}} at an adjacent power spawn or power bank.',
        range: 1,
        tasks: ['renew a power creep', 'keep a power creep alive'],
        constants: ['POWER_CREEP_LIFE_TIME'],
        see: ['PowerCreep.spawn', 'recipe:power'],
    },
    'PowerCreep.enableRoom': {
        summary: 'Switch on power usage in a room at its controller. Range 1. Needed once per room before any power works there.',
        range: 1,
        tasks: ['enable powers in a room'],
        see: ['StructureController.isPowerEnabled', 'PowerCreep.usePower'],
    },
    'PowerCreep.usePower': {
        summary: 'Use one of the creep\'s powers, on a target where the power needs one.',
        tasks: ['use a power', 'generate ops', 'operate a spawn, tower, lab or factory', 'regenerate a source'],
        pitfalls: [
            'ERR_INVALID_ARGS until the room is enabled with enableRoom.',
            'Each power has its own cooldown, range and ops cost; see POWER_INFO.',
            'ERR_FULL when the target already has a stronger effect of the same power.',
        ],
        constants: ['POWER_INFO'],
        see: ['const:power', 'PowerCreep.enableRoom', 'PowerCreep.upgrade', 'recipe:power'],
    },
    'PowerCreep.upgrade': {
        summary: 'Spend one free GPL level on a power of this creep.',
        tasks: ['level up a power creep'],
        constants: ['POWER_CREEP_MAX_LEVEL'],
        see: ['Game.gpl', 'const:power'],
    },
    'PowerCreep.delete': {
        summary: 'Delete the power creep for good. It must not be spawned in the world; a {{POWER_CREEP_DELETE_COOLDOWN / 3600000}}-hour timer starts, and delete(true) cancels it.',
        tasks: ['delete a power creep'],
        constants: ['POWER_CREEP_DELETE_COOLDOWN'],
    },
};
