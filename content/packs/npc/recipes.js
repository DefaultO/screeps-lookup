'use strict';
// Recipes around NPCs and the map: keeper rooms, strongholds, scouting.
const { L, eng, backend, driver } = require('../../_h');

const P = 'src/processor/intents/';
const STRUCT = 'src/game/structures.js';
const PROC = 'src/processor.js';
const KEEPER = P + 'creeps/keepers/pretick.js';
const LAIR = P + 'keeper-lairs/tick.js';
const SH = P + 'invader-core/stronghold/stronghold.js';
const CRON = 'lib/cronjobs.js';
const BSH = 'lib/strongholds.js';

module.exports = {
    entries: [
        {
            id: 'source-keeper-mining',
            title: 'Mine a source keeper room',
            summary: 'Kill the keeper at a source, mine while its lair counts down {{ENERGY_REGEN_TIME}} ticks, and have the guard back when the next keeper appears. Sources there hold {{SOURCE_ENERGY_KEEPER_CAPACITY}} and need no reservation.',
            tasks: [
                'source keeper mining', 'mine a source keeper room', 'kill a source keeper', 'harvest in a keeper room', 'how many heal parts against a source keeper',
                'when to step back from a keeper lair', 'guard for source keeper rooms',
            ],
            steps: [
                { call: 'Room.find', text: 'With vision of the room: FIND_HOSTILE_STRUCTURES filtered by STRUCTURE_KEEPER_LAIR gives the lairs, FIND_SOURCES and FIND_MINERALS what they guard: a keeper takes the source or mineral within 5 tiles of its lair.' },
                { call: 'StructureSpawn.spawnCreep', text: 'Guard: the keeper has 5,000 hits and deals {{10 * ATTACK_POWER}} melee plus {{10 * RANGED_ATTACK_POWER}} ranged per tick to a creep next to it. A ranged guard at range 2 or 3 takes only the {{10 * RANGED_ATTACK_POWER}}, which {{Math.ceil(10 * RANGED_ATTACK_POWER / HEAL_POWER)}} HEAL parts cover.' },
                { call: 'Creep.rangedAttack', text: 'Fight from range 3 and heal yourself in the same tick: rangedAttack and heal do not exclude each other. The keeper does not follow; it walks to its source and stays beside it. The kill takes 5,000 ÷ ({{RANGED_ATTACK_POWER}} × your RANGED_ATTACK parts) ticks.' },
                { call: 'StructureKeeperLair.ticksToSpawn', text: 'The lair has been counting {{ENERGY_REGEN_TIME}} ticks since your first hit. Send the guard to the next lair and bring it back before ticksToSpawn reaches 0: the new keeper appears on the lair tile.' },
                { call: 'Creep.harvest', text: 'Miner per source: {{Math.ceil(SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER)}} WORK parts drain {{SOURCE_ENERGY_KEEPER_CAPACITY}} per {{ENERGY_REGEN_TIME}} ticks. The room has no controller, so nothing has to be reserved.' },
                { call: 'Room.createConstructionSite', text: 'Containers (up to {{CONTROLLER_STRUCTURES.container[0]}} in the room) and roads can be built; keepers do not attack structures.' },
                { call: 'Creep.withdraw', text: 'Haul home. The tombstone of a killed keeper holds up to {{Math.floor((17 * BODYPART_COST.tough + 13 * BODYPART_COST.move + 10 * BODYPART_COST.attack + 10 * BODYPART_COST.ranged_attack) * CREEP_CORPSE_RATE)}} energy as well.' },
                { text: 'Minerals: harvesting needs an extractor on the mineral. You cannot build one in a room without a controller; an extractor without an owner works for everybody.' },
            ],
            pitfalls: [
                L('A living keeper shoots every player creep within 3 tiles and hits those next to it for {{10 * ATTACK_POWER + 10 * RANGED_ATTACK_POWER}} per tick. Pull miners and haulers back before ticksToSpawn runs out.',
                    eng(KEEPER, 'if(distance <= 3) { hostilesInRangedRange.push(object); }')),
                L('The lair timer starts with the first damage. A keeper you hurt but do not kill is replaced by a fresh one when it ends.',
                    eng(LAIR, 'if(!keeper || keeper.hits < 5000) {')),
                L('When the creeps around it score above 13 (10 per creep in range 1, 4 at range 2, 1 at range 3) the keeper uses rangedMassAttack and hits all of them.',
                    eng(KEEPER, 'if(massDamage > 13) {')),
                L('Energy harvested here counts toward raids, and a raid in these rooms is always a group of 2 to 5 small invaders, each boosted with tier-3 compounds half of the time.',
                    backend(CRON, 'if(Math.random() > 0.9 || utils.isCenter(x,y)) {'), backend(CRON, "i.boost = utils.isCenter(x,y) ? 'XLHO2' : 'LO';")),
                L('Strongholds deploy in these rooms. When the deploy ends, a creep standing on a tile of the layout dies: keep off the marker ramparts around a core that shows ticksToDeploy.',
                    backend(BSH, 'if(r.bus || !utils.isCenter(x,y) || utils.isVeryCenter(x, y)'), eng(SH, "require('../../creeps/_die')(o, undefined, true, scope);")),
                L('Keepers and invaders do not fight each other, so neither clears the room for you.',
                    eng(KEEPER, '(object.user != 2) && (object.user != 3)')),
            ],
            constants: ['ENERGY_REGEN_TIME', 'SOURCE_ENERGY_KEEPER_CAPACITY', 'ATTACK_POWER', 'RANGED_ATTACK_POWER', 'HEAL_POWER', 'HARVEST_POWER'],
            see: ['mechanic:source-keepers', 'mechanic:sources', 'mechanic:invaders', 'mechanic:strongholds', 'mechanic:simultaneous-actions', 'StructureKeeperLair', 'recipe:harvest-and-haul'],
        },

        {
            id: 'clear-a-stronghold',
            title: 'Clear a stronghold and take its loot',
            summary: 'Break the rampart over the invader core and destroy the core ({{INVADER_CORE_HITS}} hits): towers and defenders stop, the ruin of the core holds commodities, and each container can be emptied once the rampart on it is down.',
            tasks: [
                'clear a stronghold', 'attack a stronghold', 'destroy a stronghold core', 'loot a stronghold', 'how to beat stronghold towers',
                'drain stronghold towers', 'stop invader raids in my sector', 'take resources from stronghold containers',
            ],
            steps: [
                { call: 'Room.find', text: 'FIND_HOSTILE_STRUCTURES with structureType STRUCTURE_INVADER_CORE finds the core. core.level (1 to 5) tells the strength. While core.ticksToDeploy is set it cannot be hurt.' },
                { call: 'RoomObject.effects', text: 'The effect EFFECT_COLLAPSE_TIMER on the core gives the ticks the stronghold has left. At 0 everything is removed, loot included, so plan the trip inside that time.' },
                { text: 'Size the force by level: 1 / 2 / 3 / 4 / 6 towers of {{TOWER_POWER_ATTACK}} damage each at close range, ramparts of {{STRONGHOLD_RAMPART_HITS[1]}} to {{STRONGHOLD_RAMPART_HITS[5]}} hits, defenders from level 2 (tables in mechanic:strongholds).' },
                { text: 'Levels 1 to 3 refill a tower only by chance once it is down to {{2 * TOWER_ENERGY_COST}} energy (1%, 10%, 30% per tick), and each shot costs it {{TOWER_ENERGY_COST}} of {{TOWER_CAPACITY}}: towers there can be run dry. Levels 4 and 5 refill at once.' },
                { text: 'Defenders move on rampart tiles only: melee reaches 1 tile beyond the ramparts, rangers 3. Towers reach the whole room.' },
                { call: 'Creep.attack', text: 'Every structure stands under a rampart, which takes the damage first. Ramparts, towers and containers can also be dismantled; the core only takes attack and rangedAttack.' },
                { call: 'Creep.withdraw', text: 'With the core destroyed the towers and defenders no longer act. Take the commodities from the ruin of the core.' },
                { call: 'Creep.dismantle', text: 'For each container: break the rampart on its tile, then withdraw.' },
            ],
            pitfalls: [
                L('withdraw on a container under an Invader rampart returns OK and moves nothing.',
                    eng(P + 'creeps/withdraw.js', 'if(object.user != target.user && _.any(roomObjects, i => i.type == C.STRUCTURE_RAMPART && i.user != object.user && !i.isPublic && i.x == target.x && i.y == target.y)) {')),
                L('Towers and defenders are driven by the core. Destroying a tower first costs time under fire; destroying the core stops all of them.',
                    eng(PROC, "const i = require('./processor/intents/invader-core/pretick')(invaderCore, scope);")),
                L('A fortifier (level 5 always, level 4 sometimes) repairs one rampart per tick by {{15 * REPAIR_POWER * BOOSTS.work.XLH2O.repair}} hits. Damage on a single rampart must stay above that.',
                    eng(P + 'invader-core/stronghold/creeps.js', "{part: C.WORK, count: 15, boost: 'XLH2O'},")),
                L('At levels 4 and 5 all towers shoot the creep that takes the most raw damage from towers and defenders together. Your healing is not part of that sum.',
                    eng(SH, 'const target = _.max(hostiles, creep => {')),
                L('Level 5 strengthens its ramparts against incoming nukes: their repair target rises by the nuke damage.',
                    eng(SH, 'hitsTarget += C.NUKE_DAMAGE[2];')),
                L('The ruin of the core stays until the time the stronghold would have collapsed. Until then no new stronghold appears in the sector and no raids come.',
                    eng(P + 'structures/_destroy.js', 'ruin.decayTime = _.max([ruin.decayTime, collapseEffect.endTime]);'), backend(BSH, 'const sectorsWithoutCores = _.reject(rooms')),
                L('What is left in the containers at the collapse time is removed with them.',
                    eng(PROC, 'if(collapseEffect && collapseEffect.endTime <= gameTime) {')),
            ],
            constants: ['INVADER_CORE_HITS', 'STRONGHOLD_RAMPART_HITS', 'STRONGHOLD_DECAY_TICKS', 'TOWER_POWER_ATTACK', 'TOWER_CAPACITY', 'TOWER_ENERGY_COST', 'EFFECT_COLLAPSE_TIMER'],
            see: ['mechanic:strongholds', 'StructureInvaderCore', 'mechanic:tower', 'mechanic:damage-and-healing', 'mechanic:invaders', 'recipe:defend-against-invaders', 'Ruin'],
        },

        {
            id: 'scout-rooms',
            title: 'Get vision of a room',
            summary: 'A room is visible in a tick when something of yours is in it, or when one of your observers looked at it the tick before. Terrain, exits and room status can be read without vision.',
            tasks: [
                'scout a room', 'get vision of a room', 'see into a room I am not in', 'why is Game.rooms undefined for a room', 'scout without an observer',
                'check a room before claiming it', 'what can I know about a room without vision', 'does a flag give vision',
            ],
            steps: [
                { call: 'Game.rooms', text: 'Game.rooms[name] exists only in a tick in which you have vision of the room. Everything read through room.find needs it.' },
                { call: 'Game.map.getRoomStatus', text: 'Without vision you still get the status (normal, closed, novice, respawn), the neighbours from Game.map.describeExits and walls and swamps from Game.map.getRoomTerrain.' },
                { call: 'Creep.moveTo', text: 'Scout creep: one MOVE part ({{BODYPART_COST.move}} energy) is enough. The room is visible while the creep is in it. Step off the exit tile at once, or the creep is back in the old room one tick later.' },
                { call: 'StructureObserver.observeRoom', text: 'Observer (from room level {{Object.keys(CONTROLLER_STRUCTURES.observer).find(l => CONTROLLER_STRUCTURES.observer[l] > 0)}}): one room per call, up to {{OBSERVER_RANGE}} rooms away on each axis. The room is visible in the next tick only; call every tick to keep watching.' },
                { call: 'PowerCreep.usePower', text: 'While PWR_OPERATE_OBSERVER is active on the observer, the range limit does not apply.' },
                { call: 'Room.find', text: 'In the visible tick write down what you need: sources, mineral, controller owner and reservation, hostile structures, FIND_NUKES, power banks and deposits with their ticksToDecay.' },
                { call: 'Game.getObjectById', text: 'Keep positions and room names, not only ids: getObjectById returns null for an object in a room you cannot see.' },
            ],
            pitfalls: [
                L('Flags and construction sites give no vision of their room.',
                    driver('lib/runtime/data.js', "if(i.type == 'flag' || i.type == 'constructionSite') {")),
                L('Every other object that carries your user id does: creeps, power creeps, structures, and also your tombstones and the ruins of your structures while they last.',
                    driver('lib/runtime/data.js', 'roomIdsHash[i.room] = true;'), eng(P + 'creeps/_die.js', 'user: object.user,')),
                L('A reservation gives no vision: the reserved controller is not an object of yours.',
                    driver('lib/runtime/data.js', "return db['rooms.objects'].find({user: userId})")),
                L('An observer keeps its target for one tick: the room it was told to watch is cleared at the start of each tick.',
                    eng(PROC, 'object.observeRoom = null;'), driver('lib/runtime/data.js', 'roomIdsHash[i.observeRoom] = true;')),
                L('observeRoom returns ERR_NOT_IN_RANGE beyond {{OBSERVER_RANGE}} rooms on either axis unless PWR_OPERATE_OBSERVER is active.',
                    eng(STRUCT, 'var effect = _.find(this.effects, i => i.power == C.PWR_OPERATE_OBSERVER);')),
            ],
            constants: ['OBSERVER_RANGE', 'BODYPART_COST.move'],
            see: ['Game.rooms', 'StructureObserver.observeRoom', 'Game.map.describeExits', 'Game.map.getRoomTerrain', 'Game.map.getRoomStatus', 'mechanic:world-map', 'recipe:observer-and-power'],
        },
    ],

    // the existing recipe answers how to remove a lesser core; link it to the stronghold entries
    extend: {
        'recipe:defend-against-invaders': {
            tasks: ['get rid of an invader core'],
            see: ['mechanic:strongholds', 'recipe:clear-a-stronghold'],
        },
    },
};
