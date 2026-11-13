'use strict';
// Game mechanics: rules that span several API calls. Own text; numbers come from the constants ({{EXPR}}).
// tables: functions of the constants returning {title, head, rows}.
const P = 'src/processor/intents/';
const DOCS = 'https://docs.screeps.com/';

const towerAt = (C, base, r) => {
    const range = Math.min(Math.max(r, C.TOWER_OPTIMAL_RANGE), C.TOWER_FALLOFF_RANGE);
    return Math.floor(base - base * C.TOWER_FALLOFF * (range - C.TOWER_OPTIMAL_RANGE) / (C.TOWER_FALLOFF_RANGE - C.TOWER_OPTIMAL_RANGE));
};

module.exports = [
    {
        id: 'ownership',
        title: 'Who may do what in which room',
        summary: 'What your creeps can do depends on who owns or reserved the room, and on whether the target has an owner. Roads, containers and walls have no owner.',
        tasks: [
            'what can I do in a room I do not own', 'what can I do in another player\'s room', 'can a creep build in another player\'s room',
            'can a creep destroy something in another player\'s room', 'who can destroy a road in a claimed room', 'who can destroy a container',
            'can I harvest in a reserved room', 'can I take energy from an enemy container', 'what is allowed in a neutral room', 'can I repair a road in a room I do not own',
        ],
        facts: [
            'harvest a source: yes in your own, your reserved and neutral rooms; ERR_NOT_OWNER in a room owned or reserved by someone else (an invader core reservation included).',
            'createConstructionSite: your rooms (by room level); neutral rooms and rooms you reserved (roads and up to {{CONTROLLER_STRUCTURES.container[0]}} containers); never in a room owned or reserved by someone else.',
            'build, repair: any site or structure in any room. Neither checks the owner.',
            'transfer, pickup: anywhere, into anyone\'s creeps and structures.',
            'withdraw: from containers, tombstones and ruins anywhere; from another player\'s structure only if no closed rampart of theirs covers it. Never in a room under another player\'s safe mode.',
            'dismantle, attack, rangedAttack: any structure in any room, except in a room under another player\'s safe mode. A rampart on the tile takes the damage first.',
            'Structure.destroy(): only in a room whose controller you own, on any structure there, and only while no creep of another user is in the room.',
            'ConstructionSite.remove(): your own sites anywhere; other players\' sites only in your room. Walking onto another player\'s site also removes it.',
            'reserveController: controller without owner and without someone else\'s reservation. claimController: the same, plus a free GCL slot. upgradeController: your controller only. signController: any controller.',
        ],
        tables: [() => ({
            kind: 'matrix',
            title: 'By room',
            head: ['action', 'mine', 'reserved by me', 'neutral', 'reserved by other', 'owned by other'],
            rows: [
                ['harvest source', 'yes', 'yes', 'yes', 'no', 'no'],
                ['place site', 'by RCL', 'road, container', 'road, container', 'no', 'no'],
                ['build / repair', 'yes', 'yes', 'yes', 'yes', 'yes'],
                ['withdraw container', 'yes', 'yes', 'yes', 'yes', 'yes*'],
                ['dismantle / attack', 'yes', 'yes', 'yes', 'yes', 'yes*'],
                ['destroy()', 'yes', 'no', 'no', 'no', 'no'],
                ['transfer / pickup', 'yes', 'yes', 'yes', 'yes', 'yes'],
            ],
            foot: '* not while that room is in safe mode',
        })],
        see: ['Structure.destroy', 'Creep.dismantle', 'Room.createConstructionSite', 'Creep.withdraw', 'Creep.harvest', 'mechanic:safe-mode', 'mechanic:reservation'],
        engine: [
            { file: P + 'room/destroy-structure.js', find: 'if(!roomController || roomController.user != userId) return;', label: 'engine: destroy needs the room' },
            { file: P + 'room/create-construction-site.js', find: 'roomController.user && roomController.user != userId', label: 'engine: where sites may be placed' },
            { file: P + 'creeps/harvest.js', find: 'roomController.reservation && roomController.reservation.user != object.user', label: 'engine: harvest in foreign rooms' },
            { file: P + 'creeps/withdraw.js', find: 'roomController.safeMode > gameTime', label: 'engine: withdraw and safe mode' },
        ],
    },

    {
        id: 'decay',
        title: 'Decay: what disappears on its own, and how fast',
        summary: 'Roads, containers and ramparts lose hits on a timer; dropped resources shrink every tick; tombstones and ruins vanish after a fixed time. Walls and construction sites do not decay.',
        tasks: [
            'how long does a road last', 'how fast do containers decay in unowned rooms', 'how fast do ramparts decay', 'how fast does dropped energy decay',
            'what decays', 'upkeep cost of roads and containers', 'how long does a tombstone last', 'do construction sites decay', 'how long does a ruin last',
        ],
        facts: [
            'Road: −{{ROAD_DECAY_AMOUNT}} hits every {{ROAD_DECAY_TIME}} ticks; {{ROAD_HITS}} hits, so {{ROAD_HITS / ROAD_DECAY_AMOUNT * ROAD_DECAY_TIME}} ticks without traffic. Swamp roads have ×{{CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} hits and decay, tunnels ×{{CONSTRUCTION_COST_ROAD_WALL_RATIO}}. Each creep step brings the next decay closer by {{ROAD_WEAROUT}} tick per body part.',
            'Container: −{{CONTAINER_DECAY}} hits every {{CONTAINER_DECAY_TIME}} ticks in a room without owner (reserved rooms included), every {{CONTAINER_DECAY_TIME_OWNED}} ticks in an owned room; {{CONTAINER_HITS}} hits, so {{CONTAINER_HITS / CONTAINER_DECAY * CONTAINER_DECAY_TIME}} or {{CONTAINER_HITS / CONTAINER_DECAY * CONTAINER_DECAY_TIME_OWNED}} ticks. Its contents drop when it goes.',
            'Rampart: −{{RAMPART_DECAY_AMOUNT}} hits every {{RAMPART_DECAY_TIME}} ticks. A fresh rampart has {{RAMPART_HITS}} hit.',
            'Dropped resource: −ceil(amount / {{ENERGY_DECAY}}) every tick. Small piles lose 1 per tick; a pile of 5,000 loses 5.',
            'Tombstone: {{TOMBSTONE_DECAY_PER_PART}} ticks per body part of the dead creep (power creeps {{TOMBSTONE_DECAY_POWER_CREEP}}), then the contents drop.',
            'Ruin: {{RUIN_DECAY}} ticks, then the contents drop.',
            'Repair cost is {{REPAIR_COST}} energy per hit, so upkeep per tick: road {{ROAD_DECAY_AMOUNT * REPAIR_COST / ROAD_DECAY_TIME}}, swamp road {{ROAD_DECAY_AMOUNT * REPAIR_COST * CONSTRUCTION_COST_ROAD_SWAMP_RATIO / ROAD_DECAY_TIME}}, remote container {{CONTAINER_DECAY * REPAIR_COST / CONTAINER_DECAY_TIME}}, owned-room container {{CONTAINER_DECAY * REPAIR_COST / CONTAINER_DECAY_TIME_OWNED}}, rampart {{RAMPART_DECAY_AMOUNT * REPAIR_COST / RAMPART_DECAY_TIME}}.',
            'No decay: walls, construction sites, and all owned structures other than ramparts. Power banks ({{POWER_BANK_DECAY}} ticks), deposits ({{DEPOSIT_DECAY_TIME}} after the last harvest) and portals have their own timers.',
        ],
        tables: [C => ({
            title: 'Decay and upkeep',
            head: ['object', 'hits', 'loses', 'every', 'full → gone', 'energy / tick'],
            rows: [
                ['road (plain)', C.ROAD_HITS, C.ROAD_DECAY_AMOUNT, C.ROAD_DECAY_TIME, C.ROAD_HITS / C.ROAD_DECAY_AMOUNT * C.ROAD_DECAY_TIME, C.ROAD_DECAY_AMOUNT * C.REPAIR_COST / C.ROAD_DECAY_TIME],
                ['road (swamp)', C.ROAD_HITS * C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO, C.ROAD_DECAY_AMOUNT * C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO, C.ROAD_DECAY_TIME, C.ROAD_HITS / C.ROAD_DECAY_AMOUNT * C.ROAD_DECAY_TIME, C.ROAD_DECAY_AMOUNT * C.REPAIR_COST * C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO / C.ROAD_DECAY_TIME],
                ['road (tunnel)', C.ROAD_HITS * C.CONSTRUCTION_COST_ROAD_WALL_RATIO, C.ROAD_DECAY_AMOUNT * C.CONSTRUCTION_COST_ROAD_WALL_RATIO, C.ROAD_DECAY_TIME, C.ROAD_HITS / C.ROAD_DECAY_AMOUNT * C.ROAD_DECAY_TIME, C.ROAD_DECAY_AMOUNT * C.REPAIR_COST * C.CONSTRUCTION_COST_ROAD_WALL_RATIO / C.ROAD_DECAY_TIME],
                ['container (no owner)', C.CONTAINER_HITS, C.CONTAINER_DECAY, C.CONTAINER_DECAY_TIME, C.CONTAINER_HITS / C.CONTAINER_DECAY * C.CONTAINER_DECAY_TIME, C.CONTAINER_DECAY * C.REPAIR_COST / C.CONTAINER_DECAY_TIME],
                ['container (owned room)', C.CONTAINER_HITS, C.CONTAINER_DECAY, C.CONTAINER_DECAY_TIME_OWNED, C.CONTAINER_HITS / C.CONTAINER_DECAY * C.CONTAINER_DECAY_TIME_OWNED, C.CONTAINER_DECAY * C.REPAIR_COST / C.CONTAINER_DECAY_TIME_OWNED],
                ['rampart', 'by RCL', C.RAMPART_DECAY_AMOUNT, C.RAMPART_DECAY_TIME, '—', C.RAMPART_DECAY_AMOUNT * C.REPAIR_COST / C.RAMPART_DECAY_TIME],
            ],
        })],
        constants: ['ROAD_HITS', 'ROAD_DECAY_AMOUNT', 'ROAD_DECAY_TIME', 'ROAD_WEAROUT', 'CONTAINER_HITS', 'CONTAINER_DECAY', 'CONTAINER_DECAY_TIME', 'CONTAINER_DECAY_TIME_OWNED',
            'RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME', 'ENERGY_DECAY', 'TOMBSTONE_DECAY_PER_PART', 'RUIN_DECAY', 'REPAIR_COST'],
        see: ['StructureRoad', 'StructureContainer', 'StructureRampart', 'Resource.amount', 'Tombstone', 'Ruin', 'Creep.repair', 'StructureTower.repair'],
        engine: [
            { file: P + 'roads/tick.js', find: 'var decayAmount = C.ROAD_DECAY_AMOUNT;', label: 'engine: road decay' },
            { file: P + 'containers/tick.js', find: 'object.hits -= C.CONTAINER_DECAY;', label: 'engine: container decay' },
            { file: P + 'energy/tick.js', find: 'Math.ceil(object[resourceType] / C.ENERGY_DECAY)', label: 'engine: dropped resource decay' },
        ],
    },

    {
        id: 'reservation',
        title: 'Reserving a room',
        summary: 'A creep with CLAIM parts reserves a neutral controller. The reservation is a countdown of at most {{CONTROLLER_RESERVE_MAX}} ticks that each reserve call pushes up.',
        tasks: [
            'how long does a reservation last per CLAIM part', 'find the cheapest way to reserve a room', 'what does reserving a room do',
            'how many CLAIM parts to keep a room reserved', 'why reserve a remote room', 'reservation limit',
        ],
        facts: [
            'Each reserveController call adds {{CONTROLLER_RESERVE}} tick per CLAIM part. The countdown loses 1 per tick, so the net gain is parts − 1 per tick while the creep works.',
            'Maximum {{CONTROLLER_RESERVE_MAX}} ticks. A call that would go above it does nothing, although it returned OK.',
            'A CLAIM creep lives {{CREEP_CLAIM_LIFE_TIME}} ticks and cannot be renewed; a CLAIM part costs {{BODYPART_COST.claim}}.',
            'Over a cycle, a creep with N CLAIM parts that works W ticks covers N × W ticks of reservation. To hold a room for {{CREEP_LIFE_TIME}} ticks with 2-CLAIM creeps working ~{{CREEP_CLAIM_LIFE_TIME - 100}} ticks each you need {{CREEP_LIFE_TIME / 2 / (CREEP_CLAIM_LIFE_TIME - 100)}} creeps: {{CREEP_LIFE_TIME / 2 / (CREEP_CLAIM_LIFE_TIME - 100) * (BODYPART_COST.claim + BODYPART_COST.move) * 2}} energy, about {{Math.round(CREEP_LIFE_TIME / 2 / (CREEP_CLAIM_LIFE_TIME - 100) * (BODYPART_COST.claim + BODYPART_COST.move) * 2 / CREEP_LIFE_TIME * 100) / 100}} per tick.',
            'What it buys: sources hold {{SOURCE_ENERGY_CAPACITY}} instead of {{SOURCE_ENERGY_NEUTRAL_CAPACITY}}; other players cannot harvest or place sites there; invaders cannot enter the neighbouring rooms through the exits that face it.',
            'It does not change container decay (a reserved room still counts as unowned) and gives no vision.',
            'attackController takes {{CONTROLLER_RESERVE}} tick per CLAIM part off someone else\'s reservation; an invader core adds or removes {{INVADER_CORE_CONTROLLER_POWER}} per tick.',
        ],
        constants: ['CONTROLLER_RESERVE', 'CONTROLLER_RESERVE_MAX', 'CREEP_CLAIM_LIFE_TIME', 'BODYPART_COST.claim', 'SOURCE_ENERGY_CAPACITY', 'SOURCE_ENERGY_NEUTRAL_CAPACITY', 'INVADER_CORE_CONTROLLER_POWER'],
        see: ['Creep.reserveController', 'StructureController.reservation', 'Creep.attackController', 'recipe:reserve-and-remote-mine', 'mechanic:sources', 'mechanic:invaders'],
        url: DOCS + 'control.html',
        engine: [{ file: P + 'creeps/reserveController.js', find: 'target.reservation.endTime += effect;', label: 'engine: reserve' }],
    },

    {
        id: 'controller',
        title: 'Controller levels, downgrade and GCL',
        summary: 'Upgrading a controller raises the room level, which unlocks structures. Without upgrades the level counts down and is lost.',
        tasks: [
            'what does each room level unlock', 'how much energy for the next room level', 'how long until a controller downgrades',
            'how many rooms can I own', 'what happens when a controller downgrades', 'structures per RCL',
            'how many towers, links, labs, extensions or spawns at each RCL', 'how many towers at room level 5',
        ],
        facts: [
            'Energy to reach the next level: {{CONTROLLER_LEVELS[1]}} / {{CONTROLLER_LEVELS[2]}} / {{CONTROLLER_LEVELS[3]}} / {{CONTROLLER_LEVELS[4]}} / {{CONTROLLER_LEVELS[5]}} / {{CONTROLLER_LEVELS[6]}} / {{CONTROLLER_LEVELS[7]}} for levels 1 to 7.',
            'Downgrade timer per level 1–8: {{CONTROLLER_DOWNGRADE[1]}}, {{CONTROLLER_DOWNGRADE[2]}}, {{CONTROLLER_DOWNGRADE[3]}}, {{CONTROLLER_DOWNGRADE[4]}}, {{CONTROLLER_DOWNGRADE[5]}}, {{CONTROLLER_DOWNGRADE[6]}}, {{CONTROLLER_DOWNGRADE[7]}}, {{CONTROLLER_DOWNGRADE[8]}} ticks. A tick with an upgrade adds {{CONTROLLER_DOWNGRADE_RESTORE}} ticks, up to that maximum.',
            'After a level-up the timer starts at half of the new maximum.',
            'On a downgrade the level drops by one, progress is set to 90% of that level\'s requirement, the stock of safe modes is set to 0 and the safe mode cooldown starts. At level 0 the room is no longer yours.',
            'Structures above the allowance of the new level stop working (isActive() false); those nearest to the controller keep working.',
            'At level 8 upgrading is capped at {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy per tick.',
            'GCL: the number of rooms you may own. Level n needs {{GCL_MULTIPLY}} × (n − 1)^{{GCL_POW}} upgrade energy in total; every energy spent on any controller counts.',
        ],
        tables: [C => {
            const types = ['spawn', 'extension', 'tower', 'storage', 'link', 'extractor', 'lab', 'terminal', 'factory', 'observer', 'powerSpawn', 'nuker'];
            return {
                kind: 'levels',
                title: 'Structures allowed per room level',
                head: ['RCL'].concat(types),
                rows: [1, 2, 3, 4, 5, 6, 7, 8].map(l => [l].concat(types.map(t => C.CONTROLLER_STRUCTURES[t][l] || 0))),
                foot: `Roads: any level. Containers: ${C.CONTROLLER_STRUCTURES.container[8]} at any level. Walls and ramparts: from level 2 (${C.CONTROLLER_STRUCTURES.rampart[2]}).`,
            };
        }],
        constants: ['CONTROLLER_LEVELS', 'CONTROLLER_DOWNGRADE', 'CONTROLLER_DOWNGRADE_RESTORE', 'CONTROLLER_MAX_UPGRADE_PER_TICK', 'GCL_MULTIPLY', 'GCL_POW', 'CONTROLLER_STRUCTURES'],
        see: ['Creep.upgradeController', 'StructureController.ticksToDowngrade', 'Structure.isActive', 'Game.gcl', 'Creep.attackController', 'const:controller'],
        url: DOCS + 'control.html',
        engine: [{ file: P + 'controllers/tick.js', find: 'object.progress += Math.round(C.CONTROLLER_LEVELS[object.level] * 0.9);', label: 'engine: downgrade' }],
    },

    {
        id: 'safe-mode',
        title: 'Safe mode',
        summary: 'For {{SAFE_MODE_DURATION}} ticks other players\' creeps can do no harm in the room.',
        tasks: ['what does safe mode block', 'how long does safe mode last', 'how do I get safe modes', 'when can safe mode be activated', 'can enemies still enter in safe mode'],
        facts: [
            'Blocked for creeps of other players in the room: attack, rangedAttack, rangedMassAttack, dismantle, heal, rangedHeal, attackController, claimController and withdraw. Towers of the owner keep firing.',
            'Hostile creeps can still enter and move, but they no longer block your creeps: yours walk through them.',
            'One room at a time. After activation the controller cannot activate again for {{SAFE_MODE_COOLDOWN}} ticks.',
            'Not possible while the controller is upgrade-blocked, or when its downgrade timer is more than {{CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD}} ticks below half of the maximum.',
            'Stock: +1 for every room level gained, +1 per generateSafeMode ({{SAFE_MODE_COST}} ghodium). A downgrade sets it to 0.',
            'A nuke that lands ends safe mode.',
        ],
        constants: ['SAFE_MODE_DURATION', 'SAFE_MODE_COOLDOWN', 'SAFE_MODE_COST', 'CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD'],
        see: ['StructureController.activateSafeMode', 'Creep.generateSafeMode', 'StructureController.safeModeAvailable', 'recipe:safe-mode'],
        url: DOCS + 'defense.html',
        engine: [
            { file: P + 'controllers/activateSafeMode.js', find: 'object._safeModeActivated = 1;', label: 'engine: activation checks' },
            { file: P + 'movement.js', find: 'roomIsInSafeMode == object.user && object.user == i.user', label: 'engine: walking through hostiles' },
        ],
    },

    {
        id: 'simultaneous-actions',
        title: 'What a creep can do in one tick',
        summary: 'A creep may call many methods in a tick, but some exclude each other. Of the excluded ones only the highest in the list runs; all calls still return OK and cost CPU.',
        tasks: [
            'which actions can a creep do in the same tick', 'can a creep harvest and transfer in one tick', 'can a creep attack and heal in the same tick',
            'why did my creep action not happen', 'can a creep move and work in the same tick', 'action priority',
        ],
        facts: [
            'Work group, one per tick, highest first: heal, rangedHeal, attackController, dismantle, repair, build, attack, harvest.',
            'Ranged group: rangedHeal, then build or repair, then rangedMassAttack, then rangedAttack. So rangedAttack runs next to attack, harvest, dismantle or heal, but not next to build, repair or rangedHeal.',
            'Always independent: move, transfer, withdraw, pickup, drop, upgradeController, claimController, reserveController, signController, generateSafeMode, say, suicide, pull.',
            'So a creep can, in one tick: move + harvest + transfer, or move + withdraw + upgradeController + build, or move + heal + rangedAttack.',
            'The same method twice in a tick: the later call replaces the earlier one.',
            'Return codes are checked against the state at the start of the tick. Energy that arrives this tick cannot be spent this tick by a creep that had none.',
            'Inside one creep the engine runs: drop, transfer, withdraw, pickup, then the work actions, move, repair, build, the ranged actions, and the controller actions.',
        ],
        viz: {
            type: 'ladder',
            groups: [
                { title: 'Work actions', note: 'one per tick: the highest one called runs, the others are dropped', ordered: true,
                    items: ['heal', 'rangedHeal', 'attackController', 'dismantle', 'repair', 'build', 'attack', 'harvest'] },
                { title: 'Ranged actions', note: 'one per tick; build and repair also drop the two attacks', ordered: true,
                    items: ['rangedHeal', 'rangedMassAttack', 'rangedAttack'] },
                { title: 'Independent', note: 'always run next to anything else',
                    items: ['move', 'transfer', 'withdraw', 'pickup', 'drop', 'upgradeController', 'reserveController', 'claimController', 'signController', 'generateSafeMode', 'say', 'pull'] },
            ],
        },
        see: ['mechanic:tick-order', 'Creep.heal', 'Creep.attack', 'Creep.transfer', 'Creep.cancelOrder'],
        url: DOCS + 'simultaneous-actions.html',
        engine: [{ file: P + 'creeps/intents.js', find: 'var priorities = {', label: 'engine: which action drops which' }],
    },

    {
        id: 'tick-order',
        title: 'Order of events inside a tick',
        summary: 'All scripts run on the same snapshot. The engine then applies every intent, resolves movement, and last runs each object\'s own tick (damage, healing, ageing, decay). You see the result next tick.',
        tasks: ['in which order are intents processed', 'when do changes become visible', 'does a creep that dies this tick still act', 'when is damage applied', 'when does movement happen'],
        facts: [
            'Your script never sees its own changes in the same tick: a store, a position or hits only change in the next tick\'s objects.',
            'Stage 1, intents: for each room, room-level intents (place site, destroy structure, flags) and then each object\'s intents. Transfers and withdrawals change stores at once inside this stage, so a later intent can find a store already full or empty.',
            'Stage 2, movement: all move intents of the room are resolved together after the intents.',
            'Stage 3, object ticks: each creep moves, ages, and gets the tick\'s damage and healing applied together; then structures decay, cool down, finish spawning.',
            'A creep that receives lethal damage this tick still carries out all its intents of this tick.',
            'New objects (a placed site, a spawned creep, a built structure) have no usable id until the next tick.',
        ],
        see: ['mechanic:simultaneous-actions', 'mechanic:damage-and-healing', 'mechanic:movement'],
        url: DOCS + 'game-loop.html',
        engine: [
            { file: 'src/processor.js', find: 'movement.check(', label: 'engine: movement after intents' },
            { file: P + 'creeps/tick.js', find: 'if (object._damageToApply)', label: 'engine: damage and healing at the end' },
        ],
    },

    {
        id: 'movement',
        title: 'Movement, fatigue and what blocks a tile',
        summary: 'Every step makes fatigue from the creep\'s weight and the terrain; MOVE parts remove it. A creep with fatigue cannot move.',
        tasks: [
            'how many MOVE parts does a creep need', 'how does fatigue work', 'can a creep walk through a rampart', 'can a creep walk through another creep',
            'what blocks movement', 'pass through an enemy rampart', 'why is my creep stuck or not moving', 'do empty CARRY parts slow a creep', 'swamp movement cost', 'walk over a construction site',
        ],
        facts: [
            'Weight: every body part except MOVE counts 1; a CARRY part counts only while it holds something.',
            'A step makes weight × 1 fatigue on a road, × 2 on plain, × 10 on swamp. Each MOVE part removes 2 per tick (boosted: ZO ×2, ZHO2 ×3, XZHO2 ×4).',
            'Full speed needs: 1 MOVE per 2 weight on roads, 1 per 1 on plain, 5 per 1 on swamp.',
            'Blocked tiles: walls without a road, non-walkable structures, a creep that is not moving away this tick, a closed rampart of another player, and your own construction site for a non-walkable structure.',
            'Walkable structures: roads, containers, ramparts (your own or public ones). Portals move the creep.',
            'Two creeps moving onto each other\'s tiles swap. In your own safe mode your creeps walk through hostile creeps.',
            'Stepping onto another player\'s construction site destroys it (half of its progress drops as energy).',
            'Stepping onto an exit tile moves the creep to the next room in the following tick; arriving on the exit tile clears fatigue.',
            'A pulled creep needs no MOVE; its fatigue goes to the puller.',
        ],
        constants: ['OBSTACLE_OBJECT_TYPES', 'ROAD_WEAROUT'],
        see: ['Creep.move', 'Creep.moveTo', 'Creep.pull', 'Creep.fatigue', 'PathFinder.search', 'StructureRoad', 'StructureRampart.setPublic'],
        url: DOCS + 'creeps.html',
        engine: [
            { file: P + 'movement.js', find: 'function checkObstacleAtXY', label: 'engine: what blocks a tile' },
            { file: P + 'movement.js', find: 'var fatigueRate = 2;', label: 'engine: fatigue per terrain' },
            { file: P + 'movement.js', find: 'function calcResourcesWeight', label: 'engine: empty CARRY weighs nothing' },
        ],
    },

    {
        id: 'damage-and-healing',
        title: 'Damage, healing, ramparts and boosts in a fight',
        summary: 'All damage and healing a creep receives in a tick is added up and applied once at the end of the tick. Damage removes body parts from the front.',
        tasks: [
            'how is damage applied to a creep', 'what does a boosted HEAL part heal', 'how much damage does TOUGH absorb', 'does a rampart protect a creep',
            'how much damage per ATTACK part', 'why does my creep stop working when damaged', 'can healing outpace tower damage',
        ],
        facts: [
            'Per part and tick: ATTACK {{ATTACK_POWER}}, RANGED_ATTACK {{RANGED_ATTACK_POWER}} (mass attack {{RANGED_ATTACK_POWER}} / {{RANGED_ATTACK_POWER * 0.4}} / {{RANGED_ATTACK_POWER * 0.1}} at range 1 / 2 / 3), HEAL {{HEAL_POWER}} adjacent or {{RANGED_HEAL_POWER}} at range, dismantle {{DISMANTLE_POWER}} against structures.',
            'Boosted HEAL: LO ×{{BOOSTS.heal.LO.heal}}, LHO2 ×{{BOOSTS.heal.LHO2.heal}}, XLHO2 ×{{BOOSTS.heal.XLHO2.heal}}, so {{HEAL_POWER * BOOSTS.heal.LO.heal}} / {{HEAL_POWER * BOOSTS.heal.LHO2.heal}} / {{HEAL_POWER * BOOSTS.heal.XLHO2.heal}} adjacent and {{RANGED_HEAL_POWER * BOOSTS.heal.LO.rangedHeal}} / {{RANGED_HEAL_POWER * BOOSTS.heal.LHO2.rangedHeal}} / {{RANGED_HEAL_POWER * BOOSTS.heal.XLHO2.rangedHeal}} at range, per part.',
            'A creep has 100 hits per part. Parts lose hits from the front of the body, and a part at 0 hits does nothing. Put TOUGH first, HEAL and MOVE last.',
            'Boosted TOUGH takes less damage while it has hits: GO ×{{BOOSTS.tough.GO.damage}}, GHO2 ×{{BOOSTS.tough.GHO2.damage}}, XGHO2 ×{{BOOSTS.tough.XGHO2.damage}}. One XGHO2 part absorbs {{Math.round(100 / BOOSTS.tough.XGHO2.damage)}} damage.',
            'The creep survives the tick if hits − damage + healing is above 0. Healing cannot exceed hitsMax.',
            'A rampart takes all damage aimed at its tile, for creeps and structures under it, until it is destroyed.',
            'Melee attack: the target hits back with its own ATTACK parts, unless the attacker stands on a rampart.',
            'Tower: {{TOWER_POWER_ATTACK}} damage or {{TOWER_POWER_HEAL}} healing up to range {{TOWER_OPTIMAL_RANGE}}, a quarter of that at range {{TOWER_FALLOFF_RANGE}}.',
        ],
        constants: ['ATTACK_POWER', 'RANGED_ATTACK_POWER', 'HEAL_POWER', 'RANGED_HEAL_POWER', 'DISMANTLE_POWER', 'BOOSTS.heal', 'BOOSTS.tough'],
        see: ['Creep.attack', 'Creep.heal', 'Creep.rangedAttack', 'Creep.rangedMassAttack', 'mechanic:tower', 'const:boosts', 'StructureRampart', 'mechanic:tick-order'],
        url: DOCS + 'creeps.html',
        engine: [
            { file: P + 'creeps/tick.js', find: 'function _applyDamage', label: 'engine: TOUGH boost reduction' },
            { file: 'src/utils.js', find: 'exports.calcBodyEffectiveness', label: 'engine: part power with boosts' },
        ],
    },

    {
        id: 'tower',
        title: 'Tower numbers by range',
        summary: 'A tower reaches the whole room. Its effect is full up to range {{TOWER_OPTIMAL_RANGE}} and falls in a straight line to {{(1 - TOWER_FALLOFF) * 100}}% at range {{TOWER_FALLOFF_RANGE}}. Every action costs {{TOWER_ENERGY_COST}} energy.',
        tasks: ['how much does a tower heal at range 20', 'tower damage by range', 'tower falloff', 'how much damage does a tower do at range 10', 'tower energy cost'],
        facts: [
            'Formula for range r between {{TOWER_OPTIMAL_RANGE}} and {{TOWER_FALLOFF_RANGE}}: base × (1 − {{TOWER_FALLOFF}} × (r − {{TOWER_OPTIMAL_RANGE}}) / {{TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE}}), rounded down. Range is the larger of dx and dy.',
            'One action per tower per tick: heal beats repair, repair beats attack.',
            'A full tower ({{TOWER_CAPACITY}} energy) has {{TOWER_CAPACITY / TOWER_ENERGY_COST}} shots.',
            'PWR_OPERATE_TOWER raises and PWR_DISRUPT_TOWER lowers the effect.',
        ],
        tables: [C => ({
            title: 'Tower effect by range',
            head: ['range', 'attack', 'heal', 'repair'],
            rows: [5, 8, 10, 12, 15, 18, 20].map(r => [r === 5 ? '≤ 5' : r === 20 ? '≥ 20' : r, towerAt(C, C.TOWER_POWER_ATTACK, r), towerAt(C, C.TOWER_POWER_HEAL, r), towerAt(C, C.TOWER_POWER_REPAIR, r)]),
        })],
        viz: { type: 'tower' },
        constants: ['TOWER_POWER_ATTACK', 'TOWER_POWER_HEAL', 'TOWER_POWER_REPAIR', 'TOWER_OPTIMAL_RANGE', 'TOWER_FALLOFF_RANGE', 'TOWER_FALLOFF', 'TOWER_ENERGY_COST', 'TOWER_CAPACITY'],
        see: ['StructureTower.attack', 'StructureTower.heal', 'StructureTower.repair', 'recipe:tower-logic', 'mechanic:damage-and-healing'],
        url: DOCS + 'defense.html',
        engine: [{ file: P + 'towers/attack.js', find: 'amount -= amount * C.TOWER_FALLOFF', label: 'engine: falloff formula' }],
    },

    {
        id: 'creep-death',
        title: 'What a dead creep leaves behind',
        summary: 'A creep that dies leaves a tombstone with its cargo and a share of its body energy. How large the share is depends on how it died and how much life it had left.',
        tasks: ['what happens when a creep dies', 'how much energy does recycling return', 'suicide or recycle', 'what is in a tombstone', 'do boosts come back when a creep dies'],
        facts: [
            'Share of the body: rate × remaining life ÷ full life, per part at most {{CREEP_PART_MAX_ENERGY}} energy. Rate is {{CREEP_CORPSE_RATE}} for death and suicide, 1 for recycleCreep.',
            'Boosted parts return {{LAB_BOOST_MINERAL}} compound and {{LAB_BOOST_ENERGY}} energy times the same share.',
            'Death of old age returns nothing from the body, since no life is left; the cargo is still there.',
            'If the creep stands on a container, the resources go into the container first.',
            'The tombstone lasts {{TOMBSTONE_DECAY_PER_PART}} ticks per body part; then what is left drops on the ground.',
            'A nuke leaves no tombstone.',
        ],
        constants: ['CREEP_CORPSE_RATE', 'CREEP_PART_MAX_ENERGY', 'TOMBSTONE_DECAY_PER_PART', 'CREEP_LIFE_TIME', 'CREEP_CLAIM_LIFE_TIME'],
        see: ['StructureSpawn.recycleCreep', 'Creep.suicide', 'Tombstone', 'Creep.withdraw', 'mechanic:decay'],
        engine: [{ file: P + 'creeps/_die.js', find: 'var lifeRate = dropRate * object._ticksToLive / lifeTime;', label: 'engine: what a dead creep drops' }],
    },

    {
        id: 'invaders',
        title: 'Invader raids, invader cores and strongholds',
        summary: 'NPC creeps (user "Invader") appear in rooms where energy is harvested. Raids start from the amount harvested; cores and strongholds are structures that spread through a sector.',
        tasks: [
            'how do invader raids work', 'when do invaders spawn', 'how to stop invaders from spawning', 'how big are invader raids', 'are invaders boosted',
            'what is an invader core', 'why do no invaders come', 'invaders in remote rooms',
        ],
        facts: [
            'Every room counts the energy harvested from its sources. A raid is due when the count passes the room\'s goal: {{INVADERS_ENERGY_GOAL}} at first, then re-rolled after each raid to 70–130% of that.',
            'A raid needs an active stronghold (invader core of level 1 or more) somewhere in the same sector. No stronghold, no raids.',
            'Invaders enter through an exit whose neighbouring room is neither owned nor reserved. If every neighbour is owned or reserved, no raid comes.',
            'No new raid while an invader is still alive in the room. The counter restarts after a raid.',
            'Size: small bodies (10 parts) in unowned rooms and below room level 4; big bodies (50 parts) from level 4. Nine times in ten it is a single creep; otherwise a group of 2 to 5, larger at higher levels.',
            'A single raider is boosted half of the time. The first creep is a melee type, the others ranged or healers.',
            'Invaders live {{CREEP_LIFE_TIME}} ticks and do not leave the room. They hunt creeps and only break structures that are in the way.',
            'A level 0 invader core in a neutral or reserved room reserves the controller as "Invader" at {{INVADER_CORE_CONTROLLER_POWER}} ticks per tick; while that holds you cannot harvest there. It has {{INVADER_CORE_HITS}} hits and does not fight back.',
            'Strongholds (core level 1–5) have towers, ramparts and defenders, hold loot, and collapse after {{STRONGHOLD_DECAY_TICKS}} ticks.',
            'On a private server the raid check runs every five minutes of real time, so the delay after reaching the goal varies with tick speed.',
        ],
        constants: ['INVADERS_ENERGY_GOAL', 'INVADER_CORE_HITS', 'INVADER_CORE_CONTROLLER_POWER', 'STRONGHOLD_DECAY_TICKS', 'INVADER_CORE_EXPAND_TIME', 'STRONGHOLD_RAMPART_HITS'],
        see: ['StructureInvaderCore', 'Creep.attackController', 'mechanic:reservation', 'recipe:defend-against-invaders', 'Creep.owner'],
        url: DOCS + 'invaders.html',
        engine: [
            { repo: 'backend-local', file: 'lib/cronjobs.js', find: 'async function genInvaders', label: 'backend: raid generation' },
            { repo: 'backend-local', file: 'lib/cronjobs.js', find: 'function createRaid', label: 'backend: raid size and boosts' },
            { file: P + 'creeps/harvest.js', find: 'let invaderHarvested', label: 'engine: the harvest counter' },
        ],
    },

    {
        id: 'sources',
        title: 'Sources: capacity and regeneration',
        summary: 'A source refills to its capacity every {{ENERGY_REGEN_TIME}} ticks. The capacity depends on the room.',
        tasks: ['how much energy does a source give per tick', 'source capacity in a reserved room', 'how many WORK parts per source', 'energy income of a remote room'],
        facts: [
            'Capacity: {{SOURCE_ENERGY_CAPACITY}} in owned and reserved rooms, {{SOURCE_ENERGY_NEUTRAL_CAPACITY}} in neutral rooms, {{SOURCE_ENERGY_KEEPER_CAPACITY}} in source keeper rooms.',
            'That is {{SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME}}, {{SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME}} and {{Math.round(SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME * 10) / 10}} energy per tick, needing {{SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER}}, {{Math.ceil(SOURCE_ENERGY_NEUTRAL_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER)}} and {{Math.ceil(SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER)}} WORK parts.',
            'The {{ENERGY_REGEN_TIME}}-tick timer starts when the source first drops below full and refills it completely when it ends. Energy not harvested by then is lost.',
            'The capacity switches in the tick the room becomes reserved or loses the reservation.',
            'More WORK than needed only helps to cover walking time and gaps between miners.',
        ],
        constants: ['SOURCE_ENERGY_CAPACITY', 'SOURCE_ENERGY_NEUTRAL_CAPACITY', 'SOURCE_ENERGY_KEEPER_CAPACITY', 'ENERGY_REGEN_TIME', 'HARVEST_POWER'],
        see: ['Creep.harvest', 'Source.energyCapacity', 'mechanic:reservation', 'recipe:harvest-and-haul'],
        engine: [{ file: P + 'sources/tick.js', find: 'energyCapacity: C.SOURCE_ENERGY_NEUTRAL_CAPACITY', label: 'engine: capacity by room state' }],
    },

    {
        id: 'cpu',
        title: 'CPU: limit, bucket and the cost of intents',
        summary: 'Each tick you may use your limit; unused CPU is saved in a bucket of up to 10,000 that lets a tick use up to 500. Every state-changing call that returns OK costs a fixed 0.2 CPU on top of its run time.',
        tasks: ['which calls cost 0.2 cpu', 'which calls are free', 'how does the cpu bucket work', 'how to save cpu', 'what happens when I run out of cpu', 'intent cost'],
        facts: [
            'The 0.2 CPU fee applies to methods the reference marks as actions (kind "intent" here) and only when they return OK. A call that returns an error costs only its own run time.',
            'So check cheap conditions yourself before calling: range, fatigue, full store, hits < hitsMax, reservation below the cap.',
            'No fee: say, pull, cancelOrder, all find/look/range methods, PathFinder (it costs its own run time, which can be far more).',
            'moveTo is not an action itself, but it issues a move (0.2) and may run a path search.',
            'Typical floor: one intent per creep per tick. A creep that moves and works costs 0.4.',
            'Script over tickLimit: it is stopped in the middle of the tick. Bucket at 0: only the limit is available.',
            'Memory is parsed on first access each tick; the larger it is, the more CPU that takes before your code does anything.',
            'Game.cpu.getUsed() around a block measures it; in the simulation room it returns 0.',
        ],
        constants: ['PIXEL_CPU_COST'],
        see: ['Game.cpu.getUsed', 'Game.cpu.bucket', 'Game.cpu.tickLimit', 'Game.cpu.limit', 'mechanic:memory', 'Creep.moveTo'],
        url: DOCS + 'cpu-limit.html',
    },

    {
        id: 'memory',
        title: 'Memory, segments and the global scope',
        summary: 'Three places to keep data: Memory (2 MB of JSON, parsed every tick), segments (100 × 100 KB strings, loaded on request), and the global scope (free, but lost on every reset).',
        tasks: ['how many memory segments can be active', 'where to store data', 'how big can memory be', 'how to share data with another player', 'how to cache between ticks', 'when does the global reset'],
        facts: [
            'Memory: at most 2 MB as JSON. Parsed on first access in a tick and written back at the end; both cost CPU in proportion to its size.',
            'Segments: ids 0–99, 100 KB each. At most 10 active at a time. Ask with setActiveSegments; they are in RawMemory.segments from the next tick. Write by assigning a string.',
            'Reading another player: they call setPublicSegments, you call setActiveForeignSegment and read RawMemory.foreignSegment next tick. One foreign segment at a time.',
            'Global scope (variables outside the loop, properties on global): kept between ticks at no cost, but wiped whenever the server restarts your isolate or you upload code. Treat it as a cache and rebuild it when empty.',
            'Game objects are new every tick. Keep ids and look them up with Game.getObjectById.',
            'InterShardMemory: one 100 KB string per shard, readable from your code on the other shards.',
        ],
        see: ['Memory', 'RawMemory.segments', 'RawMemory.setActiveSegments', 'RawMemory.setPublicSegments', 'RawMemory.foreignSegment', 'InterShardMemory', 'Game.getObjectById', 'mechanic:cpu'],
        url: DOCS + 'global-objects.html',
    },

    {
        id: 'nukes',
        title: 'Nukes',
        summary: 'A nuke lands {{NUKE_LAND_TIME}} ticks after launch on a position up to {{NUKE_RANGE}} rooms away.',
        tasks: ['what does a nuke do', 'how to see an incoming nuke', 'how much damage does a nuke do', 'defend against a nuke'],
        facts: [
            'Damage to structures: {{NUKE_DAMAGE[0]}} on the target tile, {{NUKE_DAMAGE[2]}} within range 2. A rampart takes the hit for what is under it.',
            'Every creep in the room dies, without a tombstone. Construction sites, dropped resources, tombstones and ruins are removed.',
            'Safe mode ends and the controller cannot be upgraded for {{CONTROLLER_NUKE_BLOCKED_UPGRADE}} ticks.',
            'Incoming nukes are in room.find(FIND_NUKES) with timeToLand. Ramparts above {{NUKE_DAMAGE[2]}} hits (or {{NUKE_DAMAGE[0]}} on the centre) save what is under them.',
            'Launching costs {{NUKER_ENERGY_CAPACITY}} energy and {{NUKER_GHODIUM_CAPACITY}} ghodium, then {{NUKER_COOLDOWN}} ticks of cooldown.',
        ],
        constants: ['NUKE_DAMAGE', 'NUKE_LAND_TIME', 'NUKE_RANGE', 'NUKER_COOLDOWN', 'NUKER_ENERGY_CAPACITY', 'NUKER_GHODIUM_CAPACITY', 'CONTROLLER_NUKE_BLOCKED_UPGRADE'],
        see: ['StructureNuker.launchNuke', 'StructureRampart', 'mechanic:safe-mode'],
        url: DOCS + 'defense.html',
        engine: [{ file: P + 'nukes/tick.js', find: 'C.NUKE_DAMAGE[0]', label: 'engine: landing' }],
    },

    {
        id: 'room-types',
        title: 'Room types in a sector',
        summary: 'The world is made of 10×10 room sectors. Rooms whose number ends in 0 are highways; the 3×3 block in the middle of a sector holds source keeper rooms around a centre room.',
        tasks: ['which rooms have no controller', 'what is a highway room', 'what is a source keeper room', 'what is a sector', 'where are power banks and deposits'],
        facts: [
            'Highway rooms (x or y ending in 0): no controller, no sources. Power banks, deposits and portals between shards appear there.',
            'Source keeper rooms (x and y ending in 4–6, except 5/5): no controller, sources of {{SOURCE_ENERGY_KEEPER_CAPACITY}}, a mineral, keeper lairs that respawn a keeper.',
            'Centre room (x and y ending in 5): no controller and no keepers; portals appear there.',
            'All other rooms have a controller and can be reserved or claimed.',
            'Rooms without a controller cannot be reserved; roads and containers can still be built there.',
        ],
        see: ['Room.controller', 'StructureKeeperLair', 'StructurePowerBank', 'Deposit', 'Game.map.getRoomStatus'],
    },
];
