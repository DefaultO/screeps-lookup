'use strict';
// NPC and world mechanics: source keepers, strongholds, power banks, portals, start areas, the map.
// Every line that states behaviour names the code or the page that shows it.
const { L, eng, backend, driver, common, doc, article } = require('../../_h');

const P = 'src/processor/intents/';
const DOCS = 'https://docs.screeps.com/';

const PROC = 'src/processor.js';
const GLOBAL = 'src/processor/global.js';
const STRUCT = 'src/game/structures.js';
const ROOMS = 'src/game/rooms.js';
const MAP = 'src/game/map.js';
const UTILS = 'src/utils.js';
const CTICK = P + 'creeps/tick.js';
const DIE = P + 'creeps/_die.js';
const DAMAGE = P + '_damage.js';
const DESTROY = P + 'structures/_destroy.js';
const KEEPER = P + 'creeps/keepers/pretick.js';
const LAIR = P + 'keeper-lairs/tick.js';
const INV = P + 'creeps/invaders/';
const CORE = P + 'invader-core/';
const SH = CORE + 'stronghold/stronghold.js';
const SH_CREEPS = CORE + 'stronghold/creeps.js';
const NUKE = P + 'nukes/tick.js';

const CRON = 'lib/cronjobs.js';          // backend-local
const BSH = 'lib/strongholds.js';        // backend-local
const BUTIL = 'lib/utils.js';            // backend-local
const BGAME = 'lib/game/api/game.js';    // backend-local
const CSH = 'lib/strongholds.js';        // common: stronghold layouts and loot

// ---------------------------------------------------------------- invader bodies (backend-local lib/cronjobs.js, createCreep)

const INVADER_BODIES = [
    ['smallMelee', { tough: 2, move: 5, ranged_attack: 1, work: 1, attack: 1 }],
    ['smallRanged', { tough: 2, move: 5, ranged_attack: 3 }],
    ['smallHealer', { move: 5, heal: 5 }],
    ['bigMelee', { tough: 16, move: 25, ranged_attack: 3, work: 4, attack: 2 }],
    ['bigRanged', { tough: 6, move: 25, ranged_attack: 18, work: 1 }],
    ['bigHealer', { move: 25, heal: 25 }],
];
const INVADER_BOOSTS = {
    'boosted': { attack: 'UH', ranged_attack: 'KO', heal: 'LO', work: 'ZH', tough: 'GO' },
    'boosted, centre block': { attack: 'XUH2O', ranged_attack: 'XKHO2', heal: 'XLHO2', work: 'XZH2O', tough: 'XGHO2' },
};
const PART_NAMES = { tough: 'TOUGH', move: 'MOVE', ranged_attack: 'RANGED_ATTACK', work: 'WORK', attack: 'ATTACK', heal: 'HEAL', carry: 'CARRY' };
const partList = parts => Object.keys(parts).map(t => `${parts[t]} ${PART_NAMES[t]}`).join(', ');

function invaderRows(C) {
    const rows = [];
    for (const [name, parts] of INVADER_BODIES) {
        const n = t => parts[t] || 0;
        const total = Object.values(parts).reduce((a, b) => a + b, 0);
        const states = [['none', {}]].concat(Object.entries(INVADER_BOOSTS).filter(([label]) => label === 'boosted' || name.startsWith('small')));
        for (const [label, boost] of states) {
            const m = (type, key) => (boost[type] ? C.BOOSTS[type][boost[type]][key] : 1);
            const used = Object.keys(boost).filter(t => n(t)).map(t => boost[t]).join(', ');
            const cell = v => (v ? v : '—');
            rows.push([
                label === 'none' ? name : '',
                label === 'none' ? 'none' : `${label}: ${used}`,
                label === 'none' ? partList(parts) : '',
                total * 100,
                Math.round(n('tough') * 100 / m('tough', 'damage') + (total - n('tough')) * 100),
                cell(n('attack') * C.ATTACK_POWER * m('attack', 'attack')),
                cell(n('ranged_attack') * C.RANGED_ATTACK_POWER * m('ranged_attack', 'rangedAttack')),
                n('heal') ? `${n('heal') * C.HEAL_POWER * m('heal', 'heal')} / ${n('heal') * C.RANGED_HEAL_POWER * m('heal', 'rangedHeal')}` : '—',
                cell(n('work') * C.DISMANTLE_POWER * m('work', 'dismantle')),
            ]);
        }
    }
    return rows;
}

// ---------------------------------------------------------------- stronghold numbers (common lib/strongholds.js, engine stronghold/*.js)

const STRONGHOLD_LEVELS = [
    // level, towers, ramparts, containers, defenders, tower refill chance per tick, container budget, core budget
    [1, 1, 4, 1, 'none', '1%', 500, 1000],
    [2, 2, 9, 2, '1 weakDefender', '10%', 4000, 16000],
    [3, 3, 16, 3, '2 fullDefender', '30%', 10000, 60000],
    [4, 4, 25, 4, '4 of 8: fortifier, 4 boostedDefender, 3 boostedRanger', '100%', 50000, 400000],
    [5, 6, 45, 4, 'fortifier + 8 of 17: fortifier, 7 fullBoostedMelee, 9 fullBoostedRanger', '100%', 360000, 3000000],
];
const DEFENDERS = [
    // name, levels, parts, boosts
    ['weakDefender', '2', { attack: 15, move: 15 }, {}],
    ['fullDefender', '3', { attack: 25, move: 25 }, {}],
    ['boostedDefender', '4', { attack: 25, move: 25 }, { attack: 'UH2O' }],
    ['boostedRanger', '4', { ranged_attack: 25, move: 25 }, { ranged_attack: 'KHO2' }],
    ['fullBoostedMelee', '5', { attack: 44, move: 6 }, { attack: 'XUH2O', move: 'XZHO2' }],
    ['fullBoostedRanger', '5', { ranged_attack: 44, move: 6 }, { ranged_attack: 'XKHO2', move: 'XZHO2' }],
    ['fortifier', '4, 5', { work: 15, carry: 15, move: 15 }, { work: 'XLH2O' }],
];

module.exports = {
    entries: [
        // ============================================================ source keepers
        {
            id: 'source-keepers',
            title: 'Source keepers and keeper lairs',
            summary: 'A keeper lair keeps one Source Keeper beside a source or mineral. The keeper has 5,000 hits and deals {{10 * ATTACK_POWER + 10 * RANGED_ATTACK_POWER}} damage per tick to a creep next to it. Its lair replaces it {{ENERGY_REGEN_TIME}} ticks after it was first hurt.',
            tasks: [
                'how strong is a source keeper', 'when does a keeper respawn', 'source keeper body parts', 'how much damage does a source keeper do',
                'how does a source keeper behave', 'which rooms have source keepers', 'keeper lair respawn timer', 'do source keepers attack invaders',
                'how much energy is in a source keeper room source',
            ],
            facts: [
                L('Body: 17 TOUGH, 13 MOVE, 10 ATTACK, 10 RANGED_ATTACK, in that order with ATTACK and RANGED_ATTACK alternating; 5,000 hits.',
                    eng(LAIR, 'for(var i=0;i<17;i++) {'), eng(LAIR, 'hits: 5000,')),
                L('To a creep in range 1 it does attack ({{10 * ATTACK_POWER}}) and a ranged action ({{10 * RANGED_ATTACK_POWER}}) in the same tick. At range 2 or 3 only the ranged damage arrives.',
                    eng(KEEPER, "intents.set(creep._id, 'attack'"), eng(P + 'creeps/intents.js', "rangedAttack: ['rangedMassAttack','build','repair','rangedHeal']")),
                L('Targets are creeps and power creeps of players, always the one with the fewest hits in reach. Invaders and other keepers are never targets.',
                    eng(KEEPER, '(object.user != 2) && (object.user != 3)'), eng(KEEPER, "const meleeTarget = _.min(hostilesInMeleeRange, 'hits');")),
                L('With several creeps near it uses rangedMassAttack instead of rangedAttack: it scores 10 per creep in range 1, 4 at range 2, 1 at range 3 and switches above 13. That hits every creep for {{10 * RANGED_ATTACK_POWER}} / {{10 * RANGED_ATTACK_POWER * 0.4}} / {{10 * RANGED_ATTACK_POWER * 0.1}} at range 1 / 2 / 3.',
                    eng(KEEPER, 'const damageByRange = [10, 10, 4, 1];'), eng(P + 'creeps/rangedMassAttack.js', 'var distanceRate = {0: 1, 1: 1, 2: 0.4, 3: 0.1};')),
                L('It takes the source or mineral within 5 tiles of where it appears, walks next to it and stays. It does not chase and it never leaves the room.',
                    eng(KEEPER, 'source = _.find(resources, o => utils.dist(creep, o) <= 5);'), eng(CTICK, "if(utils.isAtEdge(object) && object.user != '2' && object.user != '3') {")),
                L('The lair starts a timer of {{ENERGY_REGEN_TIME}} ticks as soon as its keeper is missing or below full hits, so the count begins with the first damage, not with the death.',
                    eng(LAIR, 'if(!keeper || keeper.hits < 5000) {')),
                L('When the timer ends a keeper that is still alive is removed, and a new one with full hits appears on the lair tile.',
                    eng(LAIR, 'bulk.remove(keeper._id);'), eng(LAIR, 'x: object.x,')),
                L('lair.ticksToSpawn is the rest of that timer and undefined while none runs.',
                    eng(STRUCT, 'ticksToSpawn: (o) => o.nextSpawnTime ? o.nextSpawnTime - runtimeData.time : undefined')),
                L('A keeper ages like any creep: after {{CREEP_LIFE_TIME}} ticks it dies and the lair counts {{ENERGY_REGEN_TIME}} ticks again.',
                    eng(CTICK, 'object.ageTime = gameTime + (_.any(object.body, {type: C.CLAIM}) ? C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME);')),
                L('A killed keeper leaves a tombstone with energy for its body: up to {{Math.floor((17 * BODYPART_COST.tough + 13 * BODYPART_COST.move + 10 * BODYPART_COST.attack + 10 * BODYPART_COST.ranged_attack) * CREEP_CORPSE_RATE)}}, less the older it was.',
                    eng(DIE, 'var lifeRate = dropRate * object._ticksToLive / lifeTime;')),
                L('Sources in a room without a controller hold {{SOURCE_ENERGY_KEEPER_CAPACITY}}: {{Math.round(SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME * 10) / 10}} energy per tick, {{Math.ceil(SOURCE_ENERGY_KEEPER_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER)}} WORK parts to drain one.',
                    eng(P + 'sources/tick.js', 'else if(object.energyCapacity != C.SOURCE_ENERGY_KEEPER_CAPACITY) {')),
                L('Lairs belong to the map: a room has keepers where the map has lairs. The lair cannot be destroyed.',
                    backend('lib/cli/map.js', "objects.push({room: roomName, type: 'keeperLair', x, y});"), doc('StructureKeeperLair')),
                L('lair.owner.username is "Source Keeper" and lair.my is false. Keepers are creeps of that user, so FIND_HOSTILE_CREEPS returns them and FIND_HOSTILE_STRUCTURES returns the lairs.',
                    eng(STRUCT, "owner: () => ({username: 'Source Keeper'}),"), eng('src/game/game.js', '[C.FIND_HOSTILE_CREEPS]: (i) => !i.spawning && !i.my,')),
                L('A mineral there needs an extractor on it like any mineral. One without an owner works for everybody; you cannot build one where there is no controller.',
                    eng(P + 'creeps/harvest.js', 'if(extractor.user && extractor.user != object.user) {'), eng(UTILS, 'var availableCnt = C.CONTROLLER_STRUCTURES[type][rcl] + offset;')),
                L('Energy harvested there counts toward invader raids. In the centre block of a sector (both room numbers ending in 4, 5 or 6) a raid is always a group of 2 to 5 small invaders.',
                    backend(CRON, 'if(Math.random() > 0.9 || utils.isCenter(x,y)) {'), backend(BUTIL, 'exports.isCenter = function isCenter(x,y) {')),
            ],
            pitfalls: [
                L('Hurting a keeper without killing it gains nothing: the lair replaces it with a fresh one when the timer ends.', eng(LAIR, 'if(!keeper || keeper.hits < 5000) {')),
                L('The quiet time after a kill is {{ENERGY_REGEN_TIME}} ticks minus the length of the fight. Kill fast.', eng(LAIR, 'bulk.update(object, {nextSpawnTime: gameTime + C.ENERGY_REGEN_TIME});')),
                L('Keepers attack creeps only. Containers and roads next to a source are safe from them.', eng(KEEPER, "if((object.type == 'creep' || object.type == 'powerCreep') && (object.user != 2) && (object.user != 3)) {")),
            ],
            tables: [C => ({
                title: 'Source Keeper',
                head: ['', 'value'],
                rows: [
                    ['body', '17 TOUGH, 13 MOVE, 10 ATTACK, 10 RANGED_ATTACK'],
                    ['hits', 5000],
                    ['attack, range 1', 10 * C.ATTACK_POWER],
                    ['rangedAttack, range 1–3', 10 * C.RANGED_ATTACK_POWER],
                    ['rangedMassAttack at range 1 / 2 / 3', `${10 * C.RANGED_ATTACK_POWER} / ${10 * C.RANGED_ATTACK_POWER * 0.4} / ${10 * C.RANGED_ATTACK_POWER * 0.1}`],
                    ['lair timer', C.ENERGY_REGEN_TIME],
                    ['life', C.CREEP_LIFE_TIME],
                    ['source in its room', C.SOURCE_ENERGY_KEEPER_CAPACITY],
                ],
            })],
            constants: ['ENERGY_REGEN_TIME', 'SOURCE_ENERGY_KEEPER_CAPACITY', 'ATTACK_POWER', 'RANGED_ATTACK_POWER', 'CREEP_LIFE_TIME'],
            see: ['StructureKeeperLair', 'StructureKeeperLair.ticksToSpawn', 'recipe:source-keeper-mining', 'mechanic:room-types', 'mechanic:sources', 'mechanic:damage-and-healing', 'mechanic:invaders'],
        },

        // ============================================================ strongholds
        {
            id: 'strongholds',
            title: 'Strongholds: levels, defences, loot and lesser cores',
            summary: 'A stronghold is an invader core of level 1 to 5 with towers, ramparts, loot containers and, from level 2, defenders. It deploys for 5,000 ticks, lives about {{STRONGHOLD_DECAY_TICKS}} ticks, and sends level 0 cores into nearby rooms to take their controllers.',
            tasks: [
                'what is a stronghold', 'stronghold levels', 'how many towers does a stronghold have', 'stronghold loot', 'when does a stronghold collapse',
                'how do invader cores spread', 'what does an invader core do to a controller', 'stronghold defenders', 'how long does a stronghold take to deploy',
                'stronghold rampart hits', 'what is in a stronghold container', 'when does a new stronghold appear',
            ],
            facts: [
                L('A sector gets a new stronghold when it holds no invader core of any level and no ruin of one.',
                    backend(BSH, 'const sectorsWithoutCores = _.reject(rooms'), backend(BSH, "db['rooms.objects'].find({$or: [{type: 'invaderCore'},{$and: [{type: 'ruin'}, {'structure.type': 'invaderCore'}]}]})")),
                L('The room is drawn from the eight rooms around the centre room of the sector, leaving out rooms whose controller is owned or reserved.',
                    backend(BSH, 'if(r.bus || !utils.isCenter(x,y) || utils.isVeryCenter(x, y)'), backend(BSH, 'if(!!controller.user || !!controller.reservation) {')),
                L('The layout (bunker1 to bunker5; its number is the level) and its place are drawn from those that fit between the walls of the room.',
                    backend(BSH, 'const selectedTemplateName = _.sample(_.keys(spots));')),
                L('Deploy stage, 5,000 ticks: the core shows ticksToDeploy, is invulnerable and does nothing; public ramparts with 1 hit mark the tiles of the layout.',
                    backend(BSH, 'const strongholdDeployTime = 5000;'), backend(BSH, 'isPublic: true,'), doc('StructureInvaderCore')),
                L('When the deploy ends the real structures are put down. A creep or power creep standing on a layout tile dies; structures there are destroyed and construction sites removed.',
                    eng(SH, "require('../../creeps/_die')(o, undefined, true, scope);"), eng(SH, "require('../../structures/_destroy')(o, scope);")),
                L('From then the stronghold lives {{STRONGHOLD_DECAY_TICKS}} ticks ±10%. Each of its structures carries EFFECT_COLLAPSE_TIMER with the ticks that remain.',
                    eng(SH, 'const duration = Math.round(C.STRONGHOLD_DECAY_TICKS * (0.9 + Math.random() * 0.2));')),
                L('Towers and ramparts belong to user "Invader"; containers and roads have no owner. Towers start with {{TOWER_CAPACITY}} energy and shoot like player towers, {{TOWER_ENERGY_COST}} energy a shot.',
                    eng(SH, 'if(i.type == C.STRUCTURE_TOWER || i.type == C.STRUCTURE_RAMPART) {'), eng(SH, 'store:{ energy: C.TOWER_CAPACITY },')),
                L('Every tile of the layout has a rampart, the core tile included. Ramparts start with STRONGHOLD_RAMPART_HITS of the level and do not decay before the collapse.',
                    common(CSH, '{ type: C.STRUCTURE_RAMPART,      dx:  0, dy:  0 },'), eng(SH, 'hits: C.STRONGHOLD_RAMPART_HITS[template.rewardLevel],'), eng(SH, 'nextDecayTime: decayTime')),
                L('The core has {{INVADER_CORE_HITS}} hits at every level. attack and rangedAttack work on it; dismantle does not, since it has no build cost.',
                    backend(BSH, 'hits: C.INVADER_CORE_HITS,'), eng(P + 'creeps/dismantle.js', 'if(!target || !C.CONSTRUCTION_COST[target.type]) {')),
                L('The core refills a tower that is down to {{2 * TOWER_ENERGY_COST}} energy or less and still under a rampart, one tower per tick, with a chance per tick of 1% at level 1, 10% at level 2, 30% at level 3 and always at levels 4 and 5.',
                    eng(SH, 'const towerRefillChance = [0,0.01,0.1,0.3,1,1];'), eng(SH, 'const underchargedTowers = _.filter(towers, t => (t.store.energy <= 2*C.TOWER_ENERGY_COST) && _.some(ramparts, {x: t.x, y: t.y}));')),
                L('Levels 1 to 3: all towers shoot the player creep nearest to the core. Levels 4 and 5: towers and defenders pick the creep on which their combined damage is highest.',
                    eng(SH, 'const target = _.min(hostiles, c => utils.dist(c, core));'), eng(SH, 'const target = _.max(hostiles, creep => {')),
                L('The core spawns its defenders itself and replaces dead ones: none at level 1, one at level 2, two at level 3, four at level 4, nine at level 5. A body part takes {{INVADER_CORE_CREEP_SPAWN_TIME[2]}} / {{INVADER_CORE_CREEP_SPAWN_TIME[3]}} / {{INVADER_CORE_CREEP_SPAWN_TIME[4]}} / {{INVADER_CORE_CREEP_SPAWN_TIME[5]}} ticks at levels 2 to 5.',
                    eng(SH, "population: [{body: 'weakDefender', behavior: 'simple-melee'}]"), eng(CORE + 'create-creep.js', 'needTime: C.INVADER_CORE_CREEP_SPAWN_TIME[object.level] * body.length,')),
                L('While player creeps are in the room, defenders walk on rampart tiles only. Melee defenders go for creeps next to a rampart, rangers for creeps within 3 tiles of one.',
                    eng(CORE + 'stronghold/defence.js', 'matrix.set(rampart.x, rampart.y, 1);'), eng(SH, 'meleeSpots.push(..._.filter(context.ramparts, r => utils.dist(h, r) <= 1));')),
                L('Level 5 always has a fortifier, level 4 only if it was drawn: it repairs one rampart per tick by {{15 * REPAIR_POWER * BOOSTS.work.XLH2O.repair}} hits, back up to the level value, with energy the core hands it.',
                    eng(SH_CREEPS, "{part: C.WORK, count: 15, boost: 'XLH2O'},"), eng(SH_CREEPS, 'const repairRamparts = _.filter(ramparts, r => r.hitsTarget && r.hits < r.hitsTarget);')),
                L('At levels 4 and 5 one tower per tick heals a damaged defender that stands on a rampart instead of shooting.',
                    eng(SH, "intents.set(tower._id, 'heal', {id: creep._id});")),
                L('Level 5 raises the repair target of every rampart an incoming nuke will hit by the damage of that nuke (ramparts over containers excepted).',
                    eng(SH, 'hitsTarget += C.NUKE_DAMAGE[0];')),
                L('Defenders live until the collapse and leave an empty tombstone.',
                    eng(CORE + 'create-creep.js', 'ageTime: object.decayTime'), eng(DIE, 'if(dropRate > 0 && !object.userSummoned && !object.strongholdId) {')),
                L('Container loot: each container gets up to three kinds out of utrium, lemergium, zynthium and keanium bars, oxidant, reductant, purifier, ghodium melt, battery, composite, crystal and liquid. The budget per container is 500 / 4,000 / 10,000 / 50,000 / 360,000 points at levels 1 to 5; a unit costs 5 points (the four bars, oxidant, reductant, purifier), 10 (battery, composite), 15 (crystal), 20 (ghodium melt) or 30 (liquid).',
                    common(CSH, 'module.exports.containerAmounts = [0, 500, 4000, 10000, 50000, 360000];'), eng(SH, 's.store = utils.calcReward(strongholds.containerRewards, strongholds.containerAmounts[template.rewardLevel], 3);')),
                L('Core loot: when the core is destroyed its ruin holds commodities of one chain (silicon, metal, biomass or mist, fixed when the stronghold appears), from the first product up to the one of factory level equal to the stronghold level. Budget: 1,000 / 16,000 / 60,000 / 400,000 / 3,000,000 points; a unit costs 10, 220, 1,400, 5,100, 14,000 or 31,500 points by tier.',
                    common(CSH, 'module.exports.coreAmounts = [0, 1000, 16000, 60000, 400000, 3000000];'), eng(CORE + 'destroy.js', 'const rewards = coreRewards[object.depositType].slice(0, 1+rewardLevel).map(r => _.isArray(r) ? _.sample(r) : r);')),
                L('Towers and defenders get their orders from the core each tick. Once the core is destroyed they stop acting.',
                    eng(PROC, "const i = require('./processor/intents/invader-core/pretick')(invaderCore, scope);"), eng(PROC, '} else if ((object.user == INVADER_ID) && !object.strongholdId) {')),
                L('The other structures stay until the collapse time, and the ruin of the core lasts at least that long. While it lies there the sector gets no new stronghold, and without a stronghold no raids.',
                    eng(DESTROY, 'ruin.decayTime = _.max([ruin.decayTime, collapseEffect.endTime]);'), article('invaders#Strongholds')),
                L('At the collapse time everything that carries the timer is removed without a ruin: towers, ramparts, roads, containers with what is still in them, the core and its lesser cores.',
                    eng(PROC, 'if(collapseEffect && collapseEffect.endTime <= gameTime) {'), backend(BSH, 'effects: invaderCore.effects')),
                L('An active stronghold places a level 0 core (a "lesser core") every INVADER_CORE_EXPAND_TIME ticks of its level: {{INVADER_CORE_EXPAND_TIME[1]}} at level 1 down to {{INVADER_CORE_EXPAND_TIME[5]}} at level 5. The reference gives 42 as the most one stronghold can place.',
                    backend(BSH, '{$set: {nextExpandTime: gameTime + C.INVADER_CORE_EXPAND_TIME[invaderCore.level]}});'), doc('StructureInvaderCore')),
                L('The room is found by walking outward from the stronghold through room exits. The first room with a controller that nobody owns and without a core gets one; a reserved room qualifies. The walk goes on through rooms without a controller and rooms that already have a core, never through highways, owned rooms, novice or respawn areas.',
                    backend(BSH, 'if(controller && !controller.user && !hasCore) {'), backend(BSH, 'if ((!controller || hasCore) && openList.indexOf(nextRoom) === -1 && closedList.indexOf(nextRoom) === -1) {'), backend(BSH, 'if(nextRoomInfo.novice > Date.now() || nextRoomInfo.respawnArea > Date.now()) {')),
                L('A lesser core stands on a free tile within 5 tiles of the controller, has {{INVADER_CORE_HITS}} hits, no structures and no creeps.',
                    backend(BSH, 'x1: Math.max(1, found.controller.x - 5),'), article('invaders#Strongholds')),
                L('Each tick a lesser core adds {{INVADER_CORE_CONTROLLER_POWER * CONTROLLER_RESERVE}} ticks to a reservation for "Invader", up to {{CONTROLLER_RESERVE_MAX}}.',
                    eng(CORE + 'reserveController.js', 'const effect = C.INVADER_CORE_CONTROLLER_POWER * C.CONTROLLER_RESERVE;')),
                L('If a player holds the reservation, it takes {{INVADER_CORE_CONTROLLER_POWER * CONTROLLER_RESERVE}} ticks per tick off it instead, on top of the normal countdown, and reserves for itself once it is gone.',
                    eng(SH, "intents.set(core._id, 'attackController', {id: roomController._id});"), eng(CORE + 'attackController.js', 'var endTime = target.reservation.endTime - effect;')),
                L('On a private server new strongholds are checked every 5 minutes and lesser cores every 15 minutes of real time, so both come somewhat later than their timers.',
                    backend(CRON, 'genStrongholds: [5*60, strongholds.genStrongholds],'), backend(CRON, 'expandStrongholds: [15*60, strongholds.expandStrongholds]')),
            ],
            pitfalls: [
                L('withdraw from a stronghold container returns OK but moves nothing while the Invader rampart on its tile stands. Break the rampart first.',
                    eng(P + 'creeps/withdraw.js', 'if(object.user != target.user && _.any(roomObjects, i => i.type == C.STRUCTURE_RAMPART && i.user != object.user && !i.isPublic && i.x == target.x && i.y == target.y)) {')),
                L('During the deploy stage attack, rangedAttack and dismantle on the core return ERR_INVALID_TARGET.',
                    eng('src/game/creeps.js', 'const effect = _.find(target.effects, e => (e.power == C.PWR_FORTIFY || e.effect == C.EFFECT_INVULNERABILITY) && (e.ticksRemaining > 0));')),
                L('Loot that is still in the containers at the collapse time is gone: the containers are removed, not destroyed.',
                    eng(PROC, 'bulk.remove(object._id);')),
            ],
            tables: [
                C => ({
                    title: 'Stronghold by level',
                    head: ['level', 'towers', 'ramparts', 'rampart hits', 'containers', 'defenders', 'ticks per part', 'tower refill / tick', 'lesser core every', 'points per container', 'points in the core'],
                    rows: STRONGHOLD_LEVELS.map(([l, towers, ramparts, containers, defenders, refill, perContainer, core]) =>
                        [l, towers, ramparts, C.STRONGHOLD_RAMPART_HITS[l], containers, defenders, C.INVADER_CORE_CREEP_SPAWN_TIME[l] || '—', refill, C.INVADER_CORE_EXPAND_TIME[l], perContainer, core]),
                    foot: 'Layouts: common lib/strongholds.js; defenders and refill chance: engine invader-core/stronghold/stronghold.js.',
                }),
                C => ({
                    title: 'Stronghold defenders',
                    head: ['body', 'level', 'parts', 'boosts', 'hits', 'attack', 'ranged', 'repair'],
                    rows: DEFENDERS.map(([name, levels, parts, boost]) => {
                        const n = t => parts[t] || 0;
                        const m = (type, key) => (boost[type] ? C.BOOSTS[type][boost[type]][key] : 1);
                        const total = Object.values(parts).reduce((a, b) => a + b, 0);
                        return [name, levels, partList(parts), Object.values(boost).join(', ') || 'none', total * 100,
                            n('attack') ? n('attack') * C.ATTACK_POWER * m('attack', 'attack') : '—',
                            n('ranged_attack') ? n('ranged_attack') * C.RANGED_ATTACK_POWER * m('ranged_attack', 'rangedAttack') : '—',
                            n('work') ? n('work') * C.REPAIR_POWER * m('work', 'repair') : '—'];
                    }),
                    foot: 'Per tick. A ranger next to its target uses rangedMassAttack. Bodies: engine invader-core/stronghold/creeps.js.',
                }),
            ],
            constants: ['STRONGHOLD_DECAY_TICKS', 'STRONGHOLD_RAMPART_HITS', 'INVADER_CORE_HITS', 'INVADER_CORE_CREEP_SPAWN_TIME', 'INVADER_CORE_EXPAND_TIME', 'INVADER_CORE_CONTROLLER_POWER',
                'EFFECT_COLLAPSE_TIMER', 'EFFECT_INVULNERABILITY', 'TOWER_CAPACITY', 'TOWER_ENERGY_COST'],
            see: ['StructureInvaderCore', 'StructureInvaderCore.level', 'StructureInvaderCore.ticksToDeploy', 'mechanic:invaders', 'recipe:clear-a-stronghold', 'recipe:defend-against-invaders',
                'mechanic:reservation', 'mechanic:tower', 'RoomObject.effects', 'const:invaders'],
            url: DOCS + 'invaders.html',
        },

        // ============================================================ power banks
        {
            id: 'power-banks',
            title: 'Power banks',
            summary: 'A power bank appears on a wall tile of a highway room with {{POWER_BANK_CAPACITY_MIN}} to nearly {{POWER_BANK_CAPACITY_MAX * 2}} power and {{POWER_BANK_HITS}} hits. It returns {{POWER_BANK_HIT_BACK * 100}}% of every hit to the attacker and vanishes after {{POWER_BANK_DECAY}} ticks.',
            tasks: [
                'when do power banks appear', 'where do power banks spawn', 'how much power is in a power bank', 'power bank hit back damage',
                'how long does a power bank last', 'what is left when a power bank is destroyed', 'how many attack parts for a power bank',
                'does a power bank hit back ranged attackers', 'how many heal parts for a power bank',
            ],
            facts: [
                L('Banks are created only in highway rooms (rooms the map marks as "bus"), each room on its own timer.',
                    backend(CRON, "const rooms = await db.rooms.find({bus: true, status: 'normal'});")),
                L('When a bank appears, the next one in that room is set {{POWER_BANK_RESPAWN_TIME * 0.75}} to {{POWER_BANK_RESPAWN_TIME * 1.25}} ticks ahead, whatever happens to the first.',
                    backend(CRON, 'const respawnTime = Math.round(Math.random() * C.POWER_BANK_RESPAWN_TIME / 2 + C.POWER_BANK_RESPAWN_TIME * 0.75);')),
                L('It stands on a natural wall tile, at least 5 tiles from the room border, that touches at least one tile that is not a wall.',
                    backend(CRON, 'while (!isWall || !hasExit);'), backend(CRON, 'x = Math.floor(Math.random() * 40 + 5);')),
                L('Power: a random amount from {{POWER_BANK_CAPACITY_MIN}} to {{POWER_BANK_CAPACITY_MAX}}; with a chance of {{POWER_BANK_CAPACITY_CRIT * 100}}% another {{POWER_BANK_CAPACITY_MAX}} is added.',
                    backend(CRON, 'let power = Math.floor(Math.random() * (C.POWER_BANK_CAPACITY_MAX - C.POWER_BANK_CAPACITY_MIN) + C.POWER_BANK_CAPACITY_MIN);'), backend(CRON, 'power += C.POWER_BANK_CAPACITY_MAX;')),
                L('It has {{POWER_BANK_HITS}} hits and {{POWER_BANK_DECAY}} ticks from the moment it appears.',
                    backend(CRON, 'decayTime: gameTime + C.POWER_BANK_DECAY')),
                L('Every hit sends {{POWER_BANK_HIT_BACK * 100}}% of its damage back to the creep that dealt it, for attack, rangedAttack and rangedMassAttack alike.',
                    eng(DAMAGE, 'attackBackPower = damage * C.POWER_BANK_HIT_BACK;'), eng(P + 'creeps/rangedMassAttack.js', "return (!_.isUndefined(i.user) || i.type == 'powerBank') && i.user != object.user &&")),
                L('The returned damage is applied like any damage, so boosted TOUGH parts reduce it.',
                    eng(CTICK, 'damageRatio = C.BOOSTS[bodyPart.type][bodyPart.boost].damage;')),
                L('Per tick an ATTACK part does {{ATTACK_POWER}} and takes {{ATTACK_POWER * POWER_BANK_HIT_BACK}}; a HEAL part restores {{HEAL_POWER}}. Unboosted, every ATTACK part needs {{ATTACK_POWER * POWER_BANK_HIT_BACK / HEAL_POWER}} HEAL parts beside it.',
                    eng(DAMAGE, 'attackBackPower = damage * C.POWER_BANK_HIT_BACK;')),
                L('With N ATTACK parts hitting every tick the bank falls in {{Math.round(POWER_BANK_HITS / ATTACK_POWER)}} ÷ N ticks. Finishing inside its {{POWER_BANK_DECAY}} ticks takes at least {{Math.ceil(POWER_BANK_HITS / ATTACK_POWER / POWER_BANK_DECAY)}} parts, before travel time.',
                    backend(CRON, 'hits: C.POWER_BANK_HITS,')),
                L('It cannot be dismantled, and withdraw does not work on it.',
                    eng(P + 'creeps/dismantle.js', 'if(!target || !C.CONSTRUCTION_COST[target.type]) {'), eng(P + 'creeps/withdraw.js', "if(target.type == 'nuker' || target.type == 'powerBank') {")),
                L('Destroyed, it leaves a ruin that holds the power for {{RUIN_DECAY_STRUCTURES.powerBank}} ticks. After that the power lies on the tile as a dropped resource and decays like one.',
                    eng(DESTROY, 'decayTime: gameTime + (C.RUIN_DECAY_STRUCTURES[object.type] || C.RUIN_DECAY)'), eng(P + 'ruins/tick.js', "require('../_create-energy')(object.x, object.y, object.room, amount, resourceType, scope);")),
                L('When its timer runs out the bank is removed and nothing is left.',
                    eng(PROC, "if(object.type == 'powerBank' || object.type == 'deposit') {")),
                L('Carrying a full bank home takes up to {{POWER_BANK_CAPACITY_MAX * 2 / CARRY_CAPACITY}} CARRY parts.',
                    backend(CRON, 'power += C.POWER_BANK_CAPACITY_MAX;')),
                L('bank.owner.username is "Power Bank" and bank.my is false, so FIND_HOSTILE_STRUCTURES returns it.',
                    eng(STRUCT, "owner: () => ({username: 'Power Bank'})"), eng('src/game/game.js', 'i.my === false && i.owner')),
                L('A power creep next to a power bank can renew itself there.',
                    eng(P + 'power-creeps/renew.js', "if(!target || target.type != 'powerBank' && target.type != 'powerSpawn') {")),
            ],
            pitfalls: [
                L('Ranged attackers are not safe: the bank returns half of ranged damage as well.', eng(DAMAGE, "if(target.type == 'powerBank') {")),
                L('The power is in a ruin first. Use withdraw during its {{RUIN_DECAY_STRUCTURES.powerBank}} ticks and pickup afterwards.', eng(DESTROY, 'ruin.store = object.store || {};')),
                L('The bank sits in a wall: count the walkable tiles around it before you size the group, since melee attackers need range 1.', backend(CRON, 'isWall = parseInt(data.terrain.charAt(y * 50 + x)) & 1;')),
            ],
            constants: ['POWER_BANK_HITS', 'POWER_BANK_CAPACITY_MIN', 'POWER_BANK_CAPACITY_MAX', 'POWER_BANK_CAPACITY_CRIT', 'POWER_BANK_DECAY', 'POWER_BANK_HIT_BACK', 'POWER_BANK_RESPAWN_TIME', 'RUIN_DECAY_STRUCTURES'],
            see: ['StructurePowerBank', 'StructurePowerBank.power', 'StructurePowerBank.ticksToDecay', 'recipe:observer-and-power', 'recipe:power', 'mechanic:room-types', 'mechanic:damage-and-healing', 'const:power'],
            url: DOCS + 'power.html',
        },

        // ============================================================ portals and shards
        {
            id: 'portals-and-shards',
            title: 'Portals and shards',
            summary: 'A portal moves every creep that ends its move on it to its destination: a fixed position in another room, or another shard. A stable portal has no timer; an unstable one disappears after {{PORTAL_DECAY}} ticks.',
            tasks: [
                'how do portals work', 'travel to another shard', 'what happens to a creep in a portal', 'how long does a portal last', 'can a power creep use a portal',
                'where does a portal lead', 'does creep memory survive a shard change', 'avoid walking into a portal', 'send a creep through a portal',
            ],
            facts: [
                L('Two kinds: portal.destination is a RoomPosition for a portal inside the shard, and an object {shard, room} for a portal to another shard.',
                    eng(STRUCT, 'if(o.destination.shard) {')),
                L('A creep that stands on a portal tile after its move is sent on. Inside the shard it is at the destination position in the next tick; only its room and position change, so body, cargo and remaining life stay.',
                    eng(CTICK, 'bulk.update(object, {interRoom: portal.destination});'), eng(GLOBAL, 'bulkObjects.update(creep, {room: creep.interRoom.room, x: creep.interRoom.x, y: creep.interRoom.y, interRoom: null});')),
                L('No call is needed: the portal acts like an exit tile.', doc('StructurePortal')),
                L('Through a portal to another shard the creep arrives on some free tile of the destination room; the position is not fixed.', doc('StructurePortal.destination')),
                L('Your script runs on each shard separately with a Memory of its own. A creep that changes shard has no Memory.creeps entry there; hand over what it needs through InterShardMemory.', doc('InterShardMemory')),
                L('A power creep uses portals inside the shard only: it cannot step onto a portal that leads to another shard.',
                    eng(P + 'creeps/move.js', "object.type == 'powerCreep' && target.type == 'portal' && target.destination.shard)) {"), eng(P + 'power-creeps/tick.js', 'if (portal && !portal.destination.shard) {')),
                L('A portal does not block movement, but Room.findPath and moveTo treat its tile as blocked and walk around it, unless the portal tile itself is the target.',
                    eng(ROOMS, "obstacleTypes.push('portal');"), eng(ROOMS, 'ret.path.push(toPos);')),
                L('A portal with an expiry date turns unstable when that date passes: from then it has ticksToDecay, starting at {{PORTAL_DECAY}}, and is removed when the count ends.',
                    eng(P + 'portals/tick.js', 'decayTime: gameTime + C.PORTAL_DECAY,'), eng(P + 'portals/tick.js', 'if(object.decayTime && gameTime > object.decayTime) {')),
                L('The reference gives a stable time of 10 days for the portals that appear at random in the centre room of a sector.', doc('StructurePortal')),
                L('StructurePortal is a plain Structure without owner: FIND_STRUCTURES returns it, FIND_HOSTILE_STRUCTURES does not.',
                    eng(STRUCT, 'StructurePortal.prototype = Object.create(Structure.prototype);')),
                L('If the destination room is closed the creep is not moved.', eng(GLOBAL, 'if(!accessibleRooms[creep.interRoom.room]) {')),
                L('The world consists of several shards, each a map of its own, connected by such portals.', article('introduction')),
            ],
            pitfalls: [
                L('PathFinder.search gets only the cost matrices you give it and knows nothing of portals. A path of your own may cross a portal tile and send the creep away: write 255 on portal tiles.',
                    eng('src/game/path-finder.js', 'return driver.pathFinder.search(origin, goal, options);')),
                L('Check portal.ticksToDecay before a round trip: an unstable portal may be gone when the creep wants to come back.', eng(STRUCT, 'ticksToDecay: (o) => o.decayTime ? o.decayTime - runtimeData.time : undefined')),
            ],
            constants: ['PORTAL_DECAY', 'PORTAL_UNSTABLE'],
            see: ['StructurePortal', 'StructurePortal.destination', 'StructurePortal.ticksToDecay', 'InterShardMemory', 'Game.shard', 'Game.cpu.setShardLimits', 'mechanic:world-map', 'mechanic:room-types', 'const:world'],
        },

        // ============================================================ respawn and start areas
        {
            id: 'respawn-and-start-areas',
            title: 'First spawn, respawn, novice and respawn areas',
            summary: 'The first spawn goes into any open room with a free controller; novice and respawn areas are walled-off sectors made for it. A respawn wipes everything you have in the world so that you can place a spawn again; your GCL stays.',
            tasks: [
                'what is a novice area', 'what is a respawn area', 'what does a respawn do', 'do I keep my GCL after a respawn', 'how many rooms can I claim in a novice area',
                'can I nuke a novice area', 'when do novice area walls come down', 'where can I place my first spawn', 'what does room status novice mean',
                'will my room become a novice area', 'what happens to my structures when I respawn',
            ],
            facts: [
                L('The first spawn needs a room that is not closed, with a controller that nobody owns or has reserved, and you must have nothing else in the world.',
                    backend(BGAME, "if(action == 'spawn' && controller && controller.reservation) {"), backend(BGAME, "objectsCnt > 0 ? q.reject('already playing') : true")),
                L('Placing it makes the controller yours at level 1 with 20,000 ticks of safe mode. The spawn starts with {{SPAWN_ENERGY_START}} energy.',
                    backend(BGAME, 'safeMode: gameTime + 20000'), backend(BGAME, 'store: { energy: C.SPAWN_ENERGY_START },')),
                L('What other players left in that room is cleared: their creeps and construction sites are removed, their structures become ruins that last 100,000 ticks.',
                    backend(BGAME, 'decayTime: gameTime + 100000')),
                L('A respawn removes your creeps and construction sites, turns every structure of yours into a ruin, deletes your flags and sets your controllers back to level 0 without owner.',
                    backend(BUTIL, "{type: {$in: ['creep','powerCreep','constructionSite']}}"), backend(BUTIL, "await db['rooms.flags'].removeWhere({user: \"\"+userId});"), backend(BUTIL, 'safeModeAvailable: 0,')),
                L('Those ruins keep what the structures held and last 500,000 ticks. They belong to the game, not to you: anyone who gets there can empty them.',
                    backend(BUTIL, 'decayTime: gameTime + 500000'), backend(BUTIL, 'store: i.store || {},')),
                L('GCL is kept, so after a respawn you may claim as many rooms as before.', article('respawn#Respawn')),
                L('After a respawn the new spawn can be placed 180 seconds later at the earliest.',
                    article('respawn#Respawn'), backend(BGAME, 'if(request.user.lastRespawnDate && Date.now() - request.user.lastRespawnDate < 180000) {')),
                L('You count as lost when you still have objects in the world but no spawn in a room whose controller is yours. With a claimed room and a creep that can build you can raise a new spawn instead of respawning.',
                    backend(BUTIL, "return {status: spawns ? 'normal' : 'lost'};"), article('respawn#Respawn')),
                L('A novice area is a sector shut off by walls that cannot be destroyed. The only way in is to place your first spawn there, and only with GCL {{GCL_NOVICE}} or lower.',
                    article('start-areas#Novice-Areas')),
                L('In a novice room claimController returns ERR_FULL once you own {{GCL_NOVICE}} rooms. Reserving is not limited.',
                    eng('src/game/creeps.js', 'if (controllersClaimed >= C.GCL_NOVICE && runtimeData.rooms[data(this.id).room].novice > Date.now()) {'), article('start-areas#Novice-Areas')),
                L('In a novice room safe mode leaves no cooldown.',
                    eng(P + 'controllers/tick.js', 'safeModeCooldown: roomInfo.novice > Date.now() ? null : gameTime + C.SAFE_MODE_COOLDOWN')),
                L('Nukes: launchNuke returns ERR_INVALID_TARGET when the nuker or the target room is in a novice or respawn area. A nuke on its way into a room that has become such an area is removed without effect.',
                    eng(STRUCT, '!_.isUndefined(runtimeData.roomStatusData.novice[pos.roomName]) ||'), eng(NUKE, 'if(roomInfo.novice && roomInfo.novice > Date.now() || roomInfo.respawnArea && roomInfo.respawnArea > Date.now()) {')),
                L('An area ends at a date in real time: the walls vanish and the rooms are normal rooms. Most novice sectors are also split into quarters by inner walls that vanish earlier than the outer wall.',
                    article('start-areas#Novice-Areas'), eng(P + 'constructedWalls/tick.js', 'if(Date.now() > object.decayTime.timestamp) {')),
                L('A respawn area is walled off in the same way but open to any GCL and without the claim limit; only the nuke rule applies.',
                    article('start-areas#Respawn-Areas')),
                L('Strongholds send no lesser cores into novice or respawn areas.',
                    backend(BSH, 'if(nextRoomInfo.novice > Date.now() || nextRoomInfo.respawnArea > Date.now()) {')),
                L('Game.map.getRoomStatus(name) returns {status, timestamp}: status is "normal", "novice", "respawn" or "closed"; for an area the timestamp is the date in milliseconds at which it ends.',
                    eng(MAP, "return { status: 'novice', timestamp: runtimeData.roomStatusData.novice[roomName] };"), driver('lib/index.js', 'statusData.novice[room._id] = room.novice;')),
                L('A closed room cannot be entered: a creep on the exit tile towards it stays where it is.',
                    eng(GLOBAL, 'if(!accessibleRooms[creep.interRoom.room]) {')),
                L('Before an area is made in a settled part of the world, the game signs the controllers of the free rooms in the sector: sign.username is SYSTEM_USERNAME ("{{SYSTEM_USERNAME}}") and sign.text is SIGN_PLANNED_AREA. Rooms you reserve are left out.',
                    article('start-areas#Areas-generation-in-inner-sectors'), eng(STRUCT, 'username: C.SYSTEM_USERNAME,')),
            ],
            pitfalls: [
                L('A respawn gives nothing back and cannot be undone: creeps are gone, and what your storage and terminal held lies in ruins for whoever comes first.',
                    backend(BUTIL, "await db['rooms.objects'].removeWhere({user: \"\" + userId, type: {$ne: 'controller'}});")),
                L('With GCL above {{GCL_NOVICE}} a novice area is closed to you. Use a respawn area or any free room.', article('start-areas#Novice-Areas')),
            ],
            constants: ['GCL_NOVICE', 'SPAWN_ENERGY_START', 'SAFE_MODE_DURATION', 'SYSTEM_USERNAME', 'SIGN_PLANNED_AREA'],
            see: ['Game.map.getRoomStatus', 'Creep.claimController', 'StructureNuker.launchNuke', 'StructureController.sign', 'Game.gcl', 'Ruin',
                'mechanic:safe-mode', 'mechanic:controller', 'mechanic:world-map', 'mechanic:nukes'],
            url: DOCS + 'start-areas.html',
        },

        // ============================================================ world map
        {
            id: 'world-map',
            title: 'The world map: room names, exits, sectors, terrain',
            summary: 'The world is a grid of rooms of 50 × 50 tiles, named by quadrant and number like W12N34. Rooms connect through the exit tiles on their borders; highways, the centre block and the centre room repeat every 10 rooms.',
            tasks: [
                'how are rooms named', 'room name to coordinates', 'which room is north of mine', 'how big is the world', 'how big is a room',
                'how do creeps change rooms', 'which rooms are highways', 'what is the centre room of a sector', 'how do room exits work',
                'terrain types of a tile', 'why does my creep bounce between two rooms',
            ],
            facts: [
                L('A room name is W or E with a number, then N or S with a number. E0 is x = 0 and W0 is x = −1; S0 is y = 0 and N0 is y = −1. The four rooms E0S0, W0S0, E0N0 and W0N0 meet at the origin of the map.',
                    eng(UTILS, 'xx = -xx - 1;'), eng(UTILS, "x = 'W'+(-x-1);")),
                L('North is up and x grows to the right: above W5N5 lies W5N6, right of it W4N5. In the E and S halves the numbers grow to the right and downward.',
                    eng(MAP, 'exits[C.TOP] = utils.getRoomNameFromXY(x,y-1);'), eng(MAP, 'exits[C.RIGHT] = utils.getRoomNameFromXY(x+1,y);')),
                L('A room has 50 × 50 tiles, x and y from 0 to 49, y = 0 being the top row. The tiles with x or y equal to 0 or 49 are the border: exit tiles or walls.',
                    eng(UTILS, 'return object.x == 0 || object.x == 49 || object.y == 0 || object.y == 49'), eng(ROOMS, 'accum.push(this.getPositionAt(key, 0));')),
                L('A side of a room has an exit when at least one of its border tiles is open ground. Game.map.describeExits names the neighbour on each such side without vision, and returns null for a room that is not open.',
                    driver('lib/runtime/mapgrid.js', 'if (terrain[cury * 50 + curx] == 0) {'), eng(MAP, 'if(!gridItem) {')),
                L('A creep that ends its move on an exit tile is in the next tick on the opposite border of the neighbouring room, at the same place along the edge (x 0 ↔ 49, y 0 ↔ 49).',
                    eng(CTICK, 'bulk.update(object, {interRoom: {room, x, y}});'), eng(GLOBAL, 'bulkObjects.update(creep, {room: creep.interRoom.room, x: creep.interRoom.x, y: creep.interRoom.y, interRoom: null});')),
                L('It arrives on an exit tile again, so a creep that does not step off the border is sent back one tick later.',
                    eng(CTICK, "if(utils.isAtEdge(object) && object.user != '2' && object.user != '3') {")),
                L('Creeps of Invader and Source Keeper never change rooms.',
                    eng(CTICK, "if(utils.isAtEdge(object) && object.user != '2' && object.user != '3') {")),
                L('A room has from 1 to 4 exits.', article('introduction')),
                L('Game.map.getWorldSize() is the number of rooms from one edge of the world to the other, the larger of width and height. WORLD_WIDTH and WORLD_HEIGHT are deprecated.',
                    common('index.js', 'return Math.max(maxX - minX + 1, maxY - minY + 1);'), common('lib/constants.js', '// WORLD_WIDTH and WORLD_HEIGHT constants are deprecated, please use Game.map.getWorldSize() instead')),
                L('Game.map.getRoomLinearDistance is the larger of the two coordinate differences; with continuous = true it wraps around the edge of the world.',
                    eng(UTILS, 'dx = Math.min(worldSize - dx, dx);')),
                L('Game.map.findRoute looks at most about 30 rooms away from the start room in each direction.',
                    eng(MAP, 'const kRouteGrid = 30;')),
                L('Rooms whose x or y number ends in 0 are highways. They frame sectors of 9 × 9 rooms, so the pattern repeats every 10 rooms.',
                    backend(BUTIL, 'exports.isBus = function isBus(coord) {')),
                L('The server treats the 3 × 3 rooms whose two numbers end in 4, 5 or 6 as the centre block of a sector, and the room where both end in 5 as the centre room.',
                    backend(BUTIL, 'exports.isCenter = function isCenter(x,y) {'), backend(BUTIL, 'exports.isVeryCenter = function isVeryCenter(x,y) {')),
                L('What the server ties to the kind of room: power banks and deposits are created in highway rooms; strongholds in the centre block except the centre room; raids in the centre block are always groups; lesser cores skip highways.',
                    backend(CRON, "const rooms = await db.rooms.find({bus: true, status: 'normal'});"), backend(BSH, 'if(r.bus || !utils.isCenter(x,y) || utils.isVeryCenter(x, y)'), backend(BSH, 'if(/(W|E)\\d*0/.test(nextRoom) || /(N|S)\\d*0/.test(nextRoom)) {')),
                L('Terrain is fixed for each tile: wall (TERRAIN_MASK_WALL, {{TERRAIN_MASK_WALL}}), swamp (TERRAIN_MASK_SWAMP, {{TERRAIN_MASK_SWAMP}}) or plain (0). Room.Terrain.get returns one of the three; a tile with both bits reads as wall.',
                    eng(ROOMS, 'return (value & C.TERRAIN_MASK_WALL) || (value & C.TERRAIN_MASK_SWAMP) || 0;')),
                L('The terrain of every room of the shard is available without vision through Game.map.getRoomTerrain.',
                    eng(ROOMS, 'const array = (runtimeData.staticTerrainData || {})[roomName];')),
            ],
            tables: [() => ({
                title: 'Room kinds by name',
                head: ['kind', 'room numbers', 'example', 'what the server does there'],
                rows: [
                    ['highway', 'x or y ends in 0', 'W10N3, E7S20', 'power banks and deposits appear; no lesser cores'],
                    ['centre block', 'x and y end in 4, 5 or 6', 'W4N6, E15S25', 'raids are always groups of 2–5; their boosts are tier 3'],
                    ['centre block without the centre room', 'as above, not both 5', 'W4N5', 'strongholds deploy here'],
                    ['centre room', 'x and y end in 5', 'W5N5', 'no stronghold'],
                    ['any other room', '', 'W3N7', 'lesser cores can take the controller'],
                ],
                foot: 'backend-local lib/utils.js (isBus, isCenter, isVeryCenter), lib/cronjobs.js, lib/strongholds.js.',
            })],
            constants: ['TERRAIN_MASK_WALL', 'TERRAIN_MASK_SWAMP', 'WORLD_WIDTH', 'WORLD_HEIGHT'],
            see: ['Game.map.describeExits', 'Game.map.getWorldSize', 'Game.map.getRoomLinearDistance', 'Game.map.findRoute', 'Game.map.getRoomStatus', 'Game.map.getRoomTerrain',
                'Room.Terrain.get', 'Room.findExitTo', 'mechanic:room-types', 'mechanic:portals-and-shards', 'mechanic:respawn-and-start-areas', 'mechanic:movement', 'const:world'],
        },
    ],

    // ================================================================ additions to existing mechanics
    extend: {
        'mechanic:invaders': {
            tasks: [
                'invader body parts', 'how much damage does an invader do', 'how do invaders behave', 'do invaders attack structures', 'how much does an invader healer heal',
                'boosted invader damage', 'why did the invaders kill themselves', 'how many invaders in a raid',
            ],
            facts: [
                L('Invader bodies have 100 hits per part: 1,000 for the small ones, 5,000 for the big ones.', backend(CRON, 'hits: body[type].length * 100,')),
                L('In a group each creep rolls for a boost on its own: 50% for small bodies; 0% for big bodies, except 40% in the larger groups at room level 7 and 8.',
                    backend(CRON, 'promises.push(createCreep(type + subtype, room, square, Math.random() < boostChance));'), backend(CRON, "boostChance = type == 'big' ? 0 : 0.5;")),
                L('A boost covers every HEAL, RANGED_ATTACK, WORK, ATTACK and TOUGH part of the creep: LO, KO, ZH, UH, GO. In the centre block of a sector (both room numbers ending in 4, 5 or 6) the tier-3 compounds are used instead.',
                    backend(CRON, "i.boost = utils.isCenter(x,y) ? 'XLHO2' : 'LO';")),
                L('Four groups out of five are pairs; only the fifth draws its size from the full range. A group is never larger than the number of exit tiles on its side.',
                    backend(CRON, 'if (Math.random() > 0.8 || utils.isCenter(x,y)) {'), backend(CRON, 'count = Math.min(count, exits.length);')),
                L('In the centre block every raid is a group of 2 to 5 small invaders and its first creep is ranged.',
                    backend(CRON, 'if(Math.random() > 0.9 || utils.isCenter(x,y)) {'), backend(CRON, "var subtype = i == 0 && !utils.isCenter(x,y) ? 'Melee' :")),
                L('Elsewhere the second creep of a group is ranged or a healer at even odds and the rest are healers; only in a group of 5 the third may be ranged too.',
                    backend(CRON, "i == 0 || (i == 1 || i == 2 && count == 5) && Math.random() > 0.5 ? 'Ranged' :")),
                L('All creeps of a raid come in on the same side of the room, on exit tiles next to each other.',
                    backend(CRON, 'var square = lastSquare ? findClosestExit(lastSquare, exits) : exits[Math.floor(Math.random() * exits.length)];')),
                L('The count includes what other players harvest from the sources of the room. Minerals do not count.',
                    eng(P + 'creeps/harvest.js', 'let invaderHarvested = (target.invaderHarvested || 0) + amount;'), backend(CRON, "const invaderHarvested = _.sum(sources, 'invaderHarvested');")),
                L('One time in twenty the new goal comes out as 0, which the server reads as {{INVADERS_ENERGY_GOAL}} again.',
                    backend(CRON, 'invaderGoal *= Math.floor( Math.random() > 0.5 ? 2 : 0.5 );'), backend(CRON, 'const goal = room.invaderGoal || C.INVADERS_ENERGY_GOAL;')),
                L('The room of your first spawn starts with a goal of 1,000,000.', backend(BGAME, '{$set: {invaderGoal: 1000000}}')),
                L('Targets are the creeps and power creeps of players. Invaders ignore Source Keepers, and keepers ignore them.',
                    eng(INV + 'pretick.js', 'if(object.user != 3) {')),
                L('A melee invader walks to the nearest player creep it can reach and attacks it at range 1. Every invader with RANGED_ATTACK parts also shoots the creep with the fewest hits within range 3, each tick.',
                    eng(INV + 'findAttack.js', 'target = fakeRuntime.findClosestByPath(creep, hostiles, {ignoreRoads: true, ignoreCreeps: true}, scope);'), eng(INV + 'shootAtWill.js', "const target = _.min(targets, 'hits');")),
                L('A ranged invader keeps its distance: it steps away when a player creep is within 2 tiles and comes closer only while its target is more than 3 away.',
                    eng(INV + 'findAttack.js', 'if(!haveAttack && fakeRuntime.hasActiveBodyparts(creep, C.RANGED_ATTACK) && flee(creep, 3, context)) {'), eng(INV + 'flee.js', 'const nearCreeps = _.filter(hostiles, c => utils.dist(creep, c) < range);')),
                L('Below half of its hits a ranged invader walks to the nearest healer of its group.',
                    eng(INV + 'findAttack.js', 'if(creep.hits < creep.hitsMax / 2 && _.some(healers) && !haveAttack) {')),
                L('A healer heals the most damaged invader within 3 tiles, itself included (heal at range 1, rangedHeal beyond), and walks to the nearest damaged one. With nobody damaged it backs off from player creeps within 3 tiles, or else follows a non-healer.',
                    eng(INV + 'healer.js', 'const healTarget = _.first(healTargets.sort((a, b) => (b.hitsMax - b.hits) - (a.hitsMax - a.hits)));'), eng(INV + 'healer.js', 'if(flee(creep, 4, context)) {')),
                L('If no open path leads to a player creep, the invader plans one through walls and ramparts, then through any destructible structure.',
                    eng(INV + 'findAttack.js', 'target = fakeRuntime.findClosestByPath(creep, hostiles, {maxRooms: 1, ignoreRoads: true, costCallback: costCallbackIgnoreRamparts}, scope);'),
                    eng(INV + 'findAttack.js', 'target = fakeRuntime.findClosestByPath(creep, hostiles, {ignoreDestructibleStructures: true, maxRooms: 1, ignoreRoads: true}, scope);')),
                L('An invader with ATTACK or WORK parts checks the first tile of its path: a structure there (any buildable type except a spawn, roads and containers included) is dismantled if the invader has WORK, attacked otherwise, and shot with RANGED_ATTACK parts.',
                    eng(INV + 'findAttack.js', "const structures = _.filter(roomObjects, o => !!C.CONTROLLER_STRUCTURES[o.type] && o.type != 'spawn' && o.x == pos.x && o.y == pos.y);"),
                    eng(INV + 'findAttack.js', "intents.set(creep._id, 'dismantle', { id: structures[0]._id });")),
                L('With no player creep to go for, an invader in an owned room kills itself, unless a spawn is walled in: then it digs toward that spawn. In a room without owner it waits.',
                    eng(INV + 'findAttack.js', 'if(!unreachableSpawns.length && roomController && roomController.user) {')),
                L('A healer with nobody to heal and no non-healer left to follow kills itself.',
                    eng(INV + 'healer.js', 'target = fakeRuntime.findClosestByPath(creep, _.filter(invaders, c => (c != creep) && !fakeRuntime.hasActiveBodyparts(c, C.HEAL)), null, scope);')),
                L('A dead invader leaves a tombstone with energy for its body and, if boosted, some of the compound: per boosted part {{LAB_BOOST_MINERAL}} × {{CREEP_CORPSE_RATE}} × the share of life it had left.',
                    eng(DIE, 'bodyResources[i.boost] += C.LAB_BOOST_MINERAL * lifeRate;')),
            ],
            tables: [C => ({
                title: 'Invader bodies',
                head: ['body', 'boosts', 'parts', 'hits', 'damage to kill', 'attack', 'ranged', 'heal near / far', 'dismantle'],
                rows: invaderRows(C),
                foot: 'Per tick. Small bodies: rooms without owner and room levels 1–3; big bodies: room level 4 and up. "Damage to kill" counts what boosted TOUGH parts absorb. Bodies and boosts: backend-local lib/cronjobs.js.',
            })],
            constants: ['ATTACK_POWER', 'RANGED_ATTACK_POWER', 'HEAL_POWER', 'RANGED_HEAL_POWER', 'DISMANTLE_POWER'],
            see: ['mechanic:strongholds', 'mechanic:source-keepers', 'recipe:clear-a-stronghold', 'mechanic:damage-and-healing', 'const:boosts'],
        },

        'mechanic:nukes': {
            tasks: ['what survives a nuke', 'can I nuke a room without vision', 'do ruins survive a nuke'],
            facts: [
                L('The nuke strikes in the tick in which timeToLand reads 1; one tick later the Nuke object is gone.',
                    eng(NUKE, 'if(gameTime == object.landTime-1) {'), eng('src/game/nukes.js', 'timeToLand: (o) => o.landTime - runtimeData.time,')),
                L('A structure destroyed by a nuke leaves no ruin, so what it held is lost.',
                    eng(DESTROY, 'if(!attackType || attackType != C.EVENT_ATTACK_TYPE_NUKE) {')),
                L('Power creeps in the room die as well. Spawns lose the creep they are making, and spawn orders given in the landing tick are dropped.',
                    eng(NUKE, 'bulk.update(target, {hits: 0});'), eng(P + 'nukes/pretick.js', 'if(!!i.createCreep) { i.createCreep = null; }')),
                L('When a nuke ends a safe mode, the safe mode cooldown is cleared as well; still, a new safe mode does not start while the controller is blocked from upgrading.',
                    eng(NUKE, 'safeModeCooldown: null'), eng(P + 'controllers/tick.js', 'if(object._safeModeActivated && !(object.upgradeBlocked > gameTime)) {')),
                L('PWR_FORTIFY does not protect walls and ramparts from a nuke.',
                    eng(DAMAGE, "if(attackType != C.EVENT_ATTACK_TYPE_NUKE && (target.type == 'constructedWall' || target.type == 'rampart')) {")),
                L('The range is counted on each axis: the target room lies in the square of {{NUKE_RANGE * 2 + 1}} × {{NUKE_RANGE * 2 + 1}} rooms around the nuker.',
                    eng(STRUCT, 'if(Math.abs(tx-x) > C.NUKE_RANGE || Math.abs(ty-y) > C.NUKE_RANGE) {')),
                L('The target is any RoomPosition; the call does not ask for vision of that room.',
                    eng(STRUCT, 'if(!(pos instanceof globals.RoomPosition)) {')),
                L('A new nuker starts with the full cooldown of {{NUKER_COOLDOWN}} ticks.',
                    eng(P + 'creeps/build.js', 'cooldownTime: gameTime + (config.ptr ? 100 : C.NUKER_COOLDOWN)')),
                L('A launched nuke cannot be stopped. Several nukes may be aimed at one tile.', doc('Nuke')),
                L('No nuke can be launched from or into a novice or respawn area.',
                    eng(STRUCT, '!_.isUndefined(runtimeData.roomStatusData.novice[pos.roomName]) ||')),
            ],
            see: ['Nuke', 'Nuke.timeToLand', 'StructureNuker', 'mechanic:respawn-and-start-areas', 'const:nukes'],
        },

        'mechanic:room-types': {
            tasks: ['what can I build in a room without a controller', 'where do strongholds appear'],
            facts: [
                L('The server tells a highway by the room number alone: x or y ending in 0.', backend(BUTIL, 'exports.isBus = function isBus(coord) {')),
                L('Sources hold {{SOURCE_ENERGY_KEEPER_CAPACITY}} in every room that has no controller.',
                    eng(P + 'sources/tick.js', 'else if(object.energyCapacity != C.SOURCE_ENERGY_KEEPER_CAPACITY) {')),
                L('The allowance in a room without a controller is that of room level 0: {{CONTROLLER_STRUCTURES.container[0]}} containers, roads, and no other structure.',
                    eng(UTILS, 'var availableCnt = C.CONTROLLER_STRUCTURES[type][rcl] + offset;')),
                L('Strongholds deploy in the eight rooms around the centre room. Raids in the whole centre block always come as groups, boosted with tier-3 compounds.',
                    backend(BSH, 'if(r.bus || !utils.isCenter(x,y) || utils.isVeryCenter(x, y)'), backend(CRON, "i.boost = utils.isCenter(x,y) ? 'XLHO2' : 'LO';")),
                L('The highway crossings between sectors (W0N0, W10N0, W10N10 and so on) hold NPC terminals that trade on the market.', article('market')),
                L('The reference places the portals that appear at random in the centre room of a sector.', doc('StructurePortal')),
            ],
            see: ['mechanic:world-map', 'mechanic:source-keepers', 'mechanic:strongholds', 'mechanic:power-banks', 'mechanic:portals-and-shards'],
        },
    },
};
