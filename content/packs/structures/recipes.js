'use strict';
// Pack "structures": recipes for growing, defending and attacking a room, upgrading at level 8
// and keeping ramparts. Steps name the call; numbers and tables are computed from the constants.
const { L, eng, backend, driver, doc, article } = require('../../_h');

const P = 'src/processor/intents/';
const STRUCT = 'src/game/structures.js';
const CREEPS = 'src/game/creeps.js';
const UTILS = 'src/utils.js';
const RUNTIME = 'lib/runtime/runtime.js';
const DOCS = 'https://docs.screeps.com/';

const rampartFirst = eng(P + 'creeps/attack.js', "var rampart = _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y});");
const rampartHitsMax = eng(P + 'ramparts/tick.js', 'var hitsMax = object.user == roomController.user ? C.RAMPART_HITS_MAX[roomController.level] || 0 : 0;');
const rampartGone = eng(P + 'ramparts/tick.js', 'if(object.hits <= 0) {');
const newRampart = eng(P + 'creeps/build.js', 'nextDecayTime: gameTime + C.RAMPART_DECAY_TIME');
const levelNeedsFullTimer = eng(P + 'creeps/upgradeController.js', 'target.downgradeTime + C.CONTROLLER_DOWNGRADE_RESTORE >= gameTime + C.CONTROLLER_DOWNGRADE[target.level]) {');
const blockedBySafeMode = eng(P + 'controllers/activateSafeMode.js', 'if(object.upgradeBlocked > gameTime) {');
const spawnStomp = eng(P + 'spawns/_born-creep.js', "require('../creeps/_die')(hostileOccupied, undefined, true, scope);");
const towerOrder = eng(P + 'towers/intents.js', 'else if(objectIntents.repair)');

const spawnEnergy = (C, l) => C.CONTROLLER_STRUCTURES.spawn[l] * C.SPAWN_ENERGY_CAPACITY + C.CONTROLLER_STRUCTURES.extension[l] * C.EXTENSION_ENERGY_CAPACITY[l];
const towerAt = (C, base, r) => {
    const range = Math.min(Math.max(r, C.TOWER_OPTIMAL_RANGE), C.TOWER_FALLOFF_RANGE);
    return Math.floor(base - base * C.TOWER_FALLOFF * (range - C.TOWER_OPTIMAL_RANGE) / (C.TOWER_FALLOFF_RANGE - C.TOWER_OPTIMAL_RANGE));
};
const rangeLabel = (C, r) => (r <= C.TOWER_OPTIMAL_RANGE ? '≤ ' + C.TOWER_OPTIMAL_RANGE : r >= C.TOWER_FALLOFF_RANGE ? '≥ ' + C.TOWER_FALLOFF_RANGE : r);
const RANGES = C => [C.TOWER_OPTIMAL_RANGE, 8, 10, 12, 15, 18, C.TOWER_FALLOFF_RANGE];

module.exports = [
    // ================================================================ bootstrap
    {
        id: 'bootstrap-a-room',
        title: 'From the first spawn to room level 4',
        summary: 'What to build and which creeps to run at each room level, from one spawn in an empty room to a storage at level 4.',
        tasks: [
            'bootstrap a room', 'what to build first in a new room', 'what to build at room level 2', 'build order for a new room',
            'which creeps to spawn first', 'get to room level 4', 'start a room from one spawn',
        ],
        steps: [
            { call: 'StructureSpawn.spawnCreep', text: 'Level 1, {{SPAWN_ENERGY_CAPACITY}} energy per creep: workers of [WORK, CARRY, MOVE] ({{BODYPART_COST.work + BODYPART_COST.carry + BODYPART_COST.move}}) or [WORK, WORK, CARRY, MOVE] ({{BODYPART_COST.work * 2 + BODYPART_COST.carry + BODYPART_COST.move}}) that harvest, fill the spawn and upgrade. The spawn adds 1 energy per tick by itself while the room holds less than {{SPAWN_ENERGY_CAPACITY}}.' },
            { call: 'Creep.upgradeController', text: 'Level 2 costs only {{CONTROLLER_LEVELS[1]}} energy: upgrade first, build after.' },
            { call: 'Room.createConstructionSite', text: 'Level 2: {{CONTROLLER_STRUCTURES.extension[2]}} extensions ({{CONSTRUCTION_COST.extension}} each) lift spawn energy to {{CONTROLLER_STRUCTURES.spawn[2] * SPAWN_ENERGY_CAPACITY + CONTROLLER_STRUCTURES.extension[2] * EXTENSION_ENERGY_CAPACITY[2]}}. A container ({{CONSTRUCTION_COST.container}}) at each source. Walls and ramparts become available.' },
            { call: 'Creep.harvest', text: 'With that energy: one miner of {{SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER}} WORK + 1 MOVE ({{SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER * BODYPART_COST.work + BODYPART_COST.move}}) per source takes all of its {{SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME}} energy per tick. Haulers of CARRY and MOVE carry it; the first workers go on as builders and upgraders.' },
            { call: 'Room.createConstructionSite', text: 'Level 3 ({{CONTROLLER_LEVELS[2]}} energy): {{CONTROLLER_STRUCTURES.extension[3] - CONTROLLER_STRUCTURES.extension[2]}} more extensions (spawn energy {{CONTROLLER_STRUCTURES.spawn[3] * SPAWN_ENERGY_CAPACITY + CONTROLLER_STRUCTURES.extension[3] * EXTENSION_ENERGY_CAPACITY[3]}}) and the first tower ({{CONSTRUCTION_COST.tower}}).' },
            { call: 'Creep.transfer', text: 'Fill the tower ({{TOWER_CAPACITY}} energy, {{TOWER_ENERGY_COST}} per action) and keep it filled: it is the answer to invader raids.' },
            { call: 'Room.createConstructionSite', text: 'Roads from the sources to the spawn and the controller: {{CONSTRUCTION_COST.road}} per plain tile, {{CONSTRUCTION_COST.road * CONSTRUCTION_COST_ROAD_SWAMP_RATIO}} per swamp tile. On roads a loaded creep needs half the MOVE parts.' },
            { call: 'Room.createConstructionSite', text: 'Level 4 ({{CONTROLLER_LEVELS[3]}} energy): {{CONTROLLER_STRUCTURES.extension[4] - CONTROLLER_STRUCTURES.extension[3]}} more extensions (spawn energy {{CONTROLLER_STRUCTURES.spawn[4] * SPAWN_ENERGY_CAPACITY + CONTROLLER_STRUCTURES.extension[4] * EXTENSION_ENERGY_CAPACITY[4]}}) and the storage ({{CONSTRUCTION_COST.storage}}, holds {{STORAGE_CAPACITY}}).' },
            { call: 'Creep.repair', text: 'From level 2 on, ramparts over spawn and tower: {{CONSTRUCTION_COST.rampart}} energy to build, then repair at once.' },
        ],
        pitfalls: [
            L('The first room starts in safe mode for 20000 ticks. Towers come at level 3, so that is the time to reach it.', backend('lib/game/api/game.js', 'safeMode: gameTime + 20000'), article('defense')),
            L('Only the first spawn, placed by hand, starts with {{SPAWN_ENERGY_START}} energy and costs nothing. A spawn in a later room is built for {{CONSTRUCTION_COST.spawn}} and starts empty.',
                backend('lib/game/api/game.js', 'store: { energy: C.SPAWN_ENERGY_START },'), eng(P + 'creeps/build.js', 'store: {energy: 0},')),
            L('Upgrade over many ticks, not in a few big ones: the level only rises while the downgrade timer is full, and a tick with an upgrade adds only {{CONTROLLER_DOWNGRADE_RESTORE}} ticks to it. After a level-up it starts at half.',
                levelNeedsFullTimer, eng(P + 'creeps/upgradeController.js', 'target.downgradeTime = gameTime + C.CONTROLLER_DOWNGRADE[target.level]/2;')),
            L('Sites count against the room level like finished structures: a sixth extension site at level 2 returns ERR_RCL_NOT_ENOUGH.', eng(UTILS, "var structuresCnt = _(roomObjects).filter((i) => i.type == type || i.type == 'constructionSite' && i.structureType == type).size();")),
            L('A new rampart has {{RAMPART_HITS}} hit and is gone after {{RAMPART_DECAY_TIME}} ticks unless it has been repaired above {{RAMPART_DECAY_AMOUNT}} hits by then.', newRampart, rampartGone),
            L('Each level gained adds one safe mode to the stock.', eng(P + 'creeps/upgradeController.js', 'target.safeModeAvailable = (target.safeModeAvailable || 0) + 1;')),
            L('At level 2 the downgrade timer is the shortest of all: {{CONTROLLER_DOWNGRADE[2]}} ticks.', doc('StructureController')),
        ],
        tables: [C => {
            const skip = ['road', 'constructedWall', 'rampart', 'container'];
            const types = Object.keys(C.CONTROLLER_STRUCTURES).filter(t => !skip.includes(t));
            return {
                kind: 'levels',
                title: 'What each level brings',
                head: ['RCL', 'energy to reach it', 'new structures', 'energy to build them', 'spawn energy'],
                rows: [1, 2, 3, 4].map(l => {
                    const added = types.map(t => [t, (C.CONTROLLER_STRUCTURES[t][l] || 0) - (C.CONTROLLER_STRUCTURES[t][l - 1] || 0)]).filter(x => x[1] > 0);
                    return [l, l === 1 ? '—' : C.CONTROLLER_LEVELS[l - 1], added.map(([t, n]) => `${n} ${t}`).join(', '),
                        l === 1 ? '—' : added.reduce((sum, [t, n]) => sum + n * C.CONSTRUCTION_COST[t], 0), spawnEnergy(C, l)];
                }),
                foot: `Roads and ${C.CONTROLLER_STRUCTURES.container[1]} containers at every level; walls and ramparts from level 2. "Spawn energy": what all spawns and extensions of the level hold together.`,
            };
        }],
        constants: ['CONTROLLER_LEVELS', 'CONTROLLER_STRUCTURES', 'CONSTRUCTION_COST', 'SPAWN_ENERGY_CAPACITY', 'SPAWN_ENERGY_START', 'EXTENSION_ENERGY_CAPACITY', 'CONTROLLER_DOWNGRADE'],
        see: ['mechanic:controller', 'mechanic:construction-sites', 'mechanic:spawning', 'mechanic:body-design', 'recipe:harvest-and-haul', 'recipe:tower-logic', 'recipe:roads-and-upkeep', 'recipe:claim-a-room', 'const:controller'],
        url: DOCS + 'control.html',
    },

    // ================================================================ defend
    {
        id: 'defend-a-room',
        title: 'Defend a room: ramparts, towers, repair, safe mode',
        summary: 'Defence of an owned room in layers: ramparts over what must survive, towers that fire when it pays, repair under fire, and safe mode as the last step.',
        tasks: [
            'defend a room', 'defend my room against another player', 'when to activate safe mode in a fight', 'where to put ramparts',
            'protect my spawn and storage', 'stop an attack on my room', 'room defence plan',
        ],
        steps: [
            { call: 'Room.createConstructionSite', text: 'Ramparts ({{CONSTRUCTION_COST.rampart}} energy each) on spawn, storage, terminal and towers, and on the tiles where your defenders will stand. A rampart may share its tile with any structure.' },
            { call: 'Creep.repair', text: 'Lift every new rampart above {{RAMPART_DECAY_AMOUNT}} hits within {{RAMPART_DECAY_TIME}} ticks, then raise all of them evenly: {{REPAIR_COST}} energy per hit, up to {{RAMPART_HITS_MAX[4]}} at level 4 and {{RAMPART_HITS_MAX[8]}} at level 8.' },
            { call: 'Room.find', text: 'Every tick: FIND_HOSTILE_CREEPS. Count their HEAL, ATTACK, RANGED_ATTACK and WORK parts; creep.body also shows the boosts.' },
            { call: 'StructureTower.attack', text: 'All towers on one target, when their summed damage at its range beats its healing: {{TOWER_POWER_ATTACK}} per tower up to range {{TOWER_OPTIMAL_RANGE}}, {{TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)}} from range {{TOWER_FALLOFF_RANGE}}. A HEAL part restores {{HEAL_POWER}}, with XLHO2 {{HEAL_POWER * BOOSTS.heal.XLHO2.heal}}.' },
            { call: 'Creep.attack', text: 'Melee defenders stand on ramparts next to the tile under attack: nothing reaches them until the rampart falls, and they take no hit-back.' },
            { call: 'StructureTower.heal', text: 'Towers heal defenders that are hit: {{TOWER_POWER_HEAL}} close, {{TOWER_POWER_HEAL * (1 - TOWER_FALLOFF)}} far.' },
            { call: 'StructureTower.repair', text: 'A rampart that is being broken: {{TOWER_POWER_REPAIR}} hits per tower action close, {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF)}} far; repair creeps add {{REPAIR_POWER}} hits per WORK part per tick. A tower that repairs does not shoot in that tick.' },
            { call: 'Creep.transfer', text: 'Keep the towers fed: a full tower has {{TOWER_CAPACITY / TOWER_ENERGY_COST}} actions, and below {{TOWER_ENERGY_COST}} energy it does nothing.' },
            { call: 'StructureController.activateSafeMode', text: 'Last step, when a rampart over spawn, storage or towers is about to fall: {{SAFE_MODE_DURATION}} ticks in which hostile creeps can do nothing. Needs stock, no cooldown, and a controller that is not upgrade-blocked.' },
        ],
        pitfalls: [
            L('One attackController on your controller takes safe mode away for {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks. Keep CLAIM creeps from reaching the controller (walls or ramparts around it), or activate before they arrive.', blockedBySafeMode),
            L('Safe mode also fails when the downgrade timer is more than {{CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD}} ticks below half of its maximum: a room you do not upgrade cannot be saved this way.',
                eng(P + 'controllers/activateSafeMode.js', 'if(object.downgradeTime < gameTime + C.CONTROLLER_DOWNGRADE[object.level]/2 - C.CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD) {')),
            L('A public rampart lets hostile creeps onto it and then shields them from your towers. Close ramparts while hostiles are in the room.', rampartFirst, eng(P + 'movement.js', "i.type == 'rampart' && !i.isPublic && i.user != object.user ||")),
            L('rangedMassAttack cannot hurt what stands under a rampart, but it wears down every rampart within range 3 at once.', eng(P + 'creeps/rangedMassAttack.js', "if(target.type != 'rampart' && _.find(roomObjects, {type: 'rampart', x: target.x, y: target.y})) {")),
            L('Calling attack, heal and repair on the same tower in one tick runs only one of them (heal, else repair, else attack) and costs the CPU of all three.', towerOrder, driver(RUNTIME, 'if (!freeMethods[name] && !this.list[id][name]) {')),
            L('A spawn boxed in by enemy creeps frees itself: when its creep is ready and no tile is free, one enemy creep next to it is killed.', spawnStomp),
            L('Hostile creeps destroy your construction sites by walking over them. Rebuild inside the ramparts first.', eng(P + 'movement.js', "var constructionSite = _.find(cellObjects, (i) => i.type == 'constructionSite' && i.user != object.user);")),
        ],
        constants: ['RAMPART_HITS_MAX', 'RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME', 'TOWER_POWER_ATTACK', 'TOWER_POWER_HEAL', 'TOWER_POWER_REPAIR', 'TOWER_ENERGY_COST', 'SAFE_MODE_DURATION', 'CONTROLLER_ATTACK_BLOCKED_UPGRADE', 'CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD'],
        see: ['mechanic:ramparts-and-walls', 'mechanic:tower', 'mechanic:safe-mode', 'mechanic:damage-and-healing', 'recipe:tower-logic', 'recipe:safe-mode', 'recipe:keep-ramparts-up', 'recipe:defend-against-invaders', 'recipe:attack-a-room'],
        url: DOCS + 'defense.html',
    },

    // ================================================================ attack
    {
        id: 'attack-a-room',
        title: 'Attack a room: towers, healing, breaking in, the controller',
        summary: 'What an attack on an owned room must survive and do: tower damage by range and number of towers, the healing that matches it, the time to break a rampart, and what CLAIM parts do to the controller.',
        tasks: [
            'attack a room', 'attack another player\'s room', 'how much healing to survive towers', 'how many HEAL parts against towers',
            'tower damage an attacker takes at each range', 'break through ramparts', 'how long to dismantle a rampart', 'downgrade an enemy controller', 'siege a room',
        ],
        steps: [
            { call: 'StructureObserver.observeRoom', text: 'Scout first: number and position of towers, rampart hits, and on the controller level, safeMode, safeModeAvailable and safeModeCooldown.' },
            { call: 'StructureTower.attack', text: 'Count the damage: a tower does {{TOWER_POWER_ATTACK}} at range {{TOWER_OPTIMAL_RANGE}} or less, falling to {{TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)}} at range {{TOWER_FALLOFF_RANGE}} and more. A level 8 room has {{CONTROLLER_STRUCTURES.tower[8]}}: {{CONTROLLER_STRUCTURES.tower[8] * TOWER_POWER_ATTACK}} to {{CONTROLLER_STRUCTURES.tower[8] * TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)}} per tick on one creep.' },
            { call: 'Creep.heal', text: 'Bring healing that matches it: {{HEAL_POWER}} per HEAL part on an adjacent creep, {{RANGED_HEAL_POWER}} at range 3; XLHO2 gives {{HEAL_POWER * BOOSTS.heal.XLHO2.heal}} and {{RANGED_HEAL_POWER * BOOSTS.heal.XLHO2.rangedHeal}}. Damage and healing of a tick are netted, so a creep lives if it never falls to 0 within one tick.' },
            { call: 'StructureSpawn.spawnCreep', text: 'Body order: TOUGH first (with XGHO2 it takes ×{{BOOSTS.tough.XGHO2.damage}} damage while those parts have hits), working parts next, HEAL and MOVE last.' },
            { call: 'Creep.dismantle', text: 'Break in at range 1: {{DISMANTLE_POWER}} hits per WORK part per tick (XZH2O ×{{BOOSTS.work.XZH2O.dismantle}}), or {{ATTACK_POWER}} per ATTACK part (XUH2O ×{{BOOSTS.attack.XUH2O.attack}}); {{RANGED_ATTACK_POWER}} per RANGED_ATTACK part from range 3. A rampart on the tile takes all of it first.' },
            { call: 'Creep.attack', text: 'Targets inside: towers, then spawns (a spawn destroyed while spawning loses the creep in it), then storage and terminal.' },
            { call: 'Creep.attackController', text: 'CLAIM creeps at the controller: each part takes {{CONTROLLER_CLAIM_DOWNGRADE}} ticks off the downgrade timer, and the hit blocks upgrading, safe mode and further hits for {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks. All parts have to hit in the same tick.' },
            { call: 'Creep.claimController', text: 'At level 0 the room is neutral: claim it, reserve it or leave it. The old structures stay and no longer work.' },
        ],
        pitfalls: [
            L('In a room under the defender\'s safe mode attack, rangedAttack, dismantle, heal and attackController return ERR_NO_BODYPART. Read controller.safeMode before you enter, and expect an activation as soon as you do damage, unless the controller is upgrade-blocked.',
                eng(CREEPS, 'if(this.room.controller && !this.room.controller.my && this.room.controller.safeMode) {', 'engine: the check, first in withdraw, then in each blocked call'),
                eng(P + 'creeps/attack.js', 'if(roomController && roomController.user != object.user && roomController.safeMode > gameTime) {'), blockedBySafeMode),
            L('One wave of n CLAIM parts costs the controller n × {{CONTROLLER_CLAIM_DOWNGRADE}} ticks, plus the {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks that run off while the owner cannot upgrade. A full level 8 timer is {{CONTROLLER_DOWNGRADE[8]}} ticks; after each lost level it restarts at half of the lower level\'s maximum.',
                eng(P + 'creeps/attackController.js', 'var downgradeTime = target.downgradeTime - effect;'), eng(P + 'controllers/tick.js', 'object.downgradeTime += C.CONTROLLER_DOWNGRADE[object.level]/2 + 1;')),
            L('CLAIM creeps live {{CREEP_CLAIM_LIFE_TIME}} ticks and cannot be renewed: every wave needs new ones.', eng(P + 'spawns/renew-creep.js', 'if(_.filter(target.body, (i) => i.type == C.CLAIM).length > 0) {')),
            L('Melee against a creep costs you its ATTACK parts back in damage, unless you stand on a rampart. Dismantle and ranged attacks draw no hit-back.', eng(P + '_damage.js', "if(attackType == C.EVENT_ATTACK_TYPE_MELEE && !_.any(roomObjects, {type: 'rampart', x: object.x, y: object.y})) {")),
            L('Overkill on a rampart is lost: what is under it survives the tick in which the rampart falls.', eng(P + 'creeps/attack.js', 'target = rampart;')),
            L('Do not surround an enemy spawn with single creeps: when it has a creep ready and no free tile, it kills one of yours.', spawnStomp),
            L('A drained tower is harmless: under {{TOWER_ENERGY_COST}} energy it cannot act. A full one has {{TOWER_CAPACITY / TOWER_ENERGY_COST}} actions.', eng(STRUCT, 'if(!data(this.id).store || (data(this.id).store.energy < C.TOWER_ENERGY_COST)) {')),
        ],
        tables: [
            C => {
                const counts = [...new Set([3, 4, 5, 6, 7, 8].map(l => C.CONTROLLER_STRUCTURES.tower[l]))];
                const levels = n => [3, 4, 5, 6, 7, 8].filter(l => C.CONTROLLER_STRUCTURES.tower[l] === n);
                return {
                    title: 'Tower damage per tick on one target',
                    head: ['range'].concat(counts.map(n => `${n} tower${n > 1 ? 's' : ''} (RCL ${levels(n).join(', ')})`)),
                    rows: RANGES(C).map(r => [rangeLabel(C, r)].concat(counts.map(n => n * towerAt(C, C.TOWER_POWER_ATTACK, r)))),
                    foot: 'With all towers at the same range. Each tower counts its own distance: the larger of dx and dy.',
                };
            },
            C => {
                const n = C.CONTROLLER_STRUCTURES.tower[8];
                const tough = C.BOOSTS.tough.XGHO2.damage;
                const heal = C.HEAL_POWER, boosted = C.HEAL_POWER * C.BOOSTS.heal.XLHO2.heal;
                return {
                    title: `HEAL parts that match ${n} towers`,
                    head: ['range', 'damage', 'HEAL parts', 'with XLHO2', 'XLHO2 behind XGHO2 TOUGH', 'TOUGH parts that takes'],
                    rows: RANGES(C).map(r => {
                        const d = n * towerAt(C, C.TOWER_POWER_ATTACK, r);
                        return [rangeLabel(C, r), d, Math.ceil(d / heal), Math.ceil(d / boosted), Math.ceil(d * tough / boosted), Math.ceil(d * tough / 100)];
                    }),
                    foot: `Adjacent healing (${heal} per part, ${boosted} with XLHO2); a body has at most ${C.MAX_CREEP_SIZE} parts, so the parts may be spread over several creeps. The TOUGH column: boosted TOUGH parts that must still have hits for the ×${tough} to cover the whole hit.`,
                };
            },
            C => {
                const n = C.MAX_CREEP_SIZE / 2;
                const perTick = [
                    C.DISMANTLE_POWER * n, C.DISMANTLE_POWER * n * C.BOOSTS.work.XZH2O.dismantle,
                    C.ATTACK_POWER * n, C.ATTACK_POWER * n * C.BOOSTS.attack.XUH2O.attack,
                ];
                return {
                    kind: 'levels',
                    title: 'Ticks for one creep to break a rampart at its level maximum',
                    head: ['RCL', 'rampart hits', `${n} WORK`, `${n} WORK, XZH2O`, `${n} ATTACK`, `${n} ATTACK, XUH2O`],
                    rows: [2, 3, 4, 5, 6, 7, 8].map(l => [l, C.RAMPART_HITS_MAX[l]].concat(perTick.map(p => Math.ceil(C.RAMPART_HITS_MAX[l] / p)))),
                    foot: `Hits per tick: ${perTick.join(' / ')}. Most ramparts are far below their maximum; divide their hits by these numbers.`,
                };
            },
        ],
        constants: ['TOWER_POWER_ATTACK', 'TOWER_OPTIMAL_RANGE', 'TOWER_FALLOFF_RANGE', 'TOWER_FALLOFF', 'HEAL_POWER', 'RANGED_HEAL_POWER', 'DISMANTLE_POWER', 'ATTACK_POWER', 'RANGED_ATTACK_POWER',
            'CONTROLLER_CLAIM_DOWNGRADE', 'CONTROLLER_ATTACK_BLOCKED_UPGRADE', 'CONTROLLER_DOWNGRADE', 'BOOSTS.heal', 'BOOSTS.tough', 'CREEP_CLAIM_LIFE_TIME'],
        see: ['mechanic:tower', 'mechanic:damage-and-healing', 'mechanic:ramparts-and-walls', 'mechanic:safe-mode', 'mechanic:controller', 'mechanic:body-design', 'Creep.attackController', 'Creep.dismantle', 'const:boosts', 'recipe:defend-a-room', 'recipe:labs-and-boosts'],
        url: DOCS + 'defense.html',
    },

    // ================================================================ level 8
    {
        id: 'upgrade-at-level-8',
        title: 'Upgrading at room level 8',
        summary: 'A level 8 controller takes {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy per tick from all creeps together. One upgrader with {{CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER}} WORK parts uses the whole cap; only boosts and a power creep go above it.',
        tasks: [
            'upgrade at level 8', 'how much can I upgrade at RCL 8', 'how many WORK parts for a level 8 upgrader', 'raise GCL with a level 8 room',
            'keep a level 8 controller from downgrading', 'is boosting upgraders worth it at level 8',
        ],
        steps: [
            { call: 'StructureSpawn.spawnCreep', text: 'One upgrader with {{CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER}} WORK parts ({{UPGRADE_CONTROLLER_POWER}} energy per WORK per tick) spends the whole cap. More WORK on the controller does nothing.' },
            { call: 'Creep.withdraw', text: 'Feed it from a link or container within range 1, so it never walks: {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy per tick, {{CONTROLLER_MAX_UPGRADE_PER_TICK * CREEP_LIFE_TIME}} per creep life.' },
            { call: 'Creep.upgradeController', text: 'Range 3, every tick. Each point also counts for GCL; controller.progress stays 0.' },
            { call: 'StructureLab.boostCreep', text: 'Boosts multiply the points, not the energy: XGH2O makes {{CONTROLLER_MAX_UPGRADE_PER_TICK * BOOSTS.work.XGH2O.upgradeController}} points from the same {{CONTROLLER_MAX_UPGRADE_PER_TICK}} energy, for {{CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER * LAB_BOOST_MINERAL}} compound and {{CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER * LAB_BOOST_ENERGY}} energy per creep.' },
            { call: 'PowerCreep.usePower', text: 'PWR_OPERATE_CONTROLLER raises the cap by {{POWER_INFO[PWR_OPERATE_CONTROLLER].effect[0]}} to {{POWER_INFO[PWR_OPERATE_CONTROLLER].effect[4]}} energy per tick for {{POWER_INFO[PWR_OPERATE_CONTROLLER].duration}} ticks; size the upgrader for the raised cap.' },
            { call: 'StructureController.ticksToDowngrade', text: 'The timer holds {{CONTROLLER_DOWNGRADE[8]}} ticks and every tick with an upgrade adds {{CONTROLLER_DOWNGRADE_RESTORE}}. Below {{CONTROLLER_DOWNGRADE[8] / 2 - CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD}} safe mode can no longer be activated.' },
        ],
        pitfalls: [
            L('The cap is shared and used up in processing order: once it is reached, the upgradeController calls of the other creeps do nothing, although they returned OK and cost 0.2 CPU each.', eng(P + 'creeps/upgradeController.js', 'if(target._upgraded >= limit) {')),
            L('The cap counts energy, before boosts: a boosted upgrader still needs only {{CONTROLLER_MAX_UPGRADE_PER_TICK / UPGRADE_CONTROLLER_POWER}} WORK parts.', eng(P + 'creeps/upgradeController.js', 'target._upgraded += buildEffect;')),
            L('GCL gets the boosted points, rounded down per creep and tick.', eng(P + 'creeps/upgradeController.js', 'var boostedEffect = Math.floor(buildEffect + _.sum(boostedParts));'), eng(P + 'creeps/upgradeController.js', "bulkUsers.inc(target.user, 'gcl', boostedEffect);")),
            L('progressTotal is undefined at level 8 and progress stays 0: do not steer upgraders by them.', eng(STRUCT, 'progressTotal: (o) => o.level > 0 && o.level < 8 ? C.CONTROLLER_LEVELS[o.level] : undefined,'), eng(P + 'creeps/upgradeController.js', 'if(target.level < 8) {')),
            L('After an attackController hit nobody can upgrade for {{CONTROLLER_ATTACK_BLOCKED_UPGRADE}} ticks and the timer runs down meanwhile.', eng(P + 'creeps/upgradeController.js', 'if(target.upgradeBlocked && target.upgradeBlocked > gameTime) {')),
            L('If the timer does run out the room drops to level 7, and the structures above the level 7 allowance stop working until level 8 is reached again.', eng(UTILS, 'let allowedRemaining = C.CONTROLLER_STRUCTURES[object.type][roomController.level];')),
        ],
        tables: [C => {
            const parts = C.CONTROLLER_MAX_UPGRADE_PER_TICK / C.UPGRADE_CONTROLLER_POWER;
            const boosts = Object.entries(C.BOOSTS.work).filter(([, e]) => e.upgradeController);
            return {
                title: 'Points per tick at the cap',
                head: ['boost', 'points per tick', 'points per creep life', 'compound per creep'],
                rows: [['none', C.CONTROLLER_MAX_UPGRADE_PER_TICK, C.CONTROLLER_MAX_UPGRADE_PER_TICK * C.CREEP_LIFE_TIME, 0]]
                    .concat(boosts.map(([name, e]) => {
                        const points = Math.floor(C.CONTROLLER_MAX_UPGRADE_PER_TICK * e.upgradeController);   // the processor rounds down per creep and tick
                        return [name, points, points * C.CREEP_LIFE_TIME, parts * C.LAB_BOOST_MINERAL];
                    })),
                foot: `One creep with ${parts} boosted WORK parts; its points are rounded down each tick. Energy spent is ${C.CONTROLLER_MAX_UPGRADE_PER_TICK} per tick in every row. "Per creep life": ${C.CREEP_LIFE_TIME} ticks of upgrading without a break.`,
            };
        }],
        constants: ['CONTROLLER_MAX_UPGRADE_PER_TICK', 'UPGRADE_CONTROLLER_POWER', 'CONTROLLER_DOWNGRADE', 'CONTROLLER_DOWNGRADE_RESTORE', 'CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD', 'BOOSTS.work.XGH2O'],
        see: ['Creep.upgradeController', 'mechanic:controller', 'StructureController.ticksToDowngrade', 'Game.gcl', 'const:boosts', 'recipe:labs-and-boosts', 'recipe:link-network', 'recipe:power'],
        url: DOCS + 'control.html',
    },

    // ================================================================ ramparts
    {
        id: 'keep-ramparts-up',
        title: 'Keep ramparts up',
        summary: 'Each rampart loses {{RAMPART_DECAY_AMOUNT}} hits every {{RAMPART_DECAY_TIME}} ticks. Repair new ones at once, hold all of them above a floor with a repair creep, and keep the towers for emergencies.',
        tasks: [
            'keep ramparts up', 'maintain ramparts', 'what does rampart upkeep cost', 'why do my ramparts disappear',
            'how many WORK parts to maintain ramparts', 'repair ramparts with creeps or with towers', 'rampart repair loop',
        ],
        steps: [
            { call: 'Room.find', text: 'FIND_MY_STRUCTURES filtered by STRUCTURE_RAMPART; walls are in FIND_STRUCTURES, they have no owner. Work on the one with the fewest hits.' },
            { call: 'Creep.build', text: 'A finished rampart has {{RAMPART_HITS}} hit and {{RAMPART_DECAY_TIME}} ticks until its first loss of {{RAMPART_DECAY_AMOUNT}}: the builder repairs it straight away, well above that.' },
            { call: 'Creep.repair', text: 'Repair creep: {{REPAIR_POWER}} hits per WORK part per tick for {{REPAIR_POWER * REPAIR_COST}} energy, range 3. One WORK part that repairs all the time offsets the decay of {{Math.floor(REPAIR_POWER / (RAMPART_DECAY_AMOUNT / RAMPART_DECAY_TIME))}} ramparts.' },
            { call: 'StructureRampart.ticksToDecay', text: 'Budget: {{RAMPART_DECAY_AMOUNT * REPAIR_COST / RAMPART_DECAY_TIME}} energy per rampart per tick, so {{RAMPART_DECAY_AMOUNT * REPAIR_COST / RAMPART_DECAY_TIME * 100}} per tick for 100 ramparts.' },
            { call: 'StructureTower.repair', text: 'Tower only below an emergency floor: {{TOWER_POWER_REPAIR}} hits up to range {{TOWER_OPTIMAL_RANGE}}, {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF)}} from range {{TOWER_FALLOFF_RANGE}}, for {{TOWER_ENERGY_COST}} energy.' },
            { call: 'Structure.hitsMax', text: 'Raise the floor with spare energy, up to hitsMax of the room level. Skip ramparts that are at hitsMax.' },
        ],
        pitfalls: [
            L('A rampart with {{RAMPART_DECAY_AMOUNT}} hits or fewer is removed at its next decay, whatever stands under it.', rampartGone),
            L('repair on a rampart at hitsMax returns OK, does nothing and costs the 0.2 CPU.', eng(P + 'creeps/repair.js', 'if(!target || !target.hitsMax || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {')),
            L('hitsMax follows the room level every tick. At level 1, or once the room is no longer yours, it is 0: repair has no effect and the ramparts decay away.', rampartHitsMax),
            L('Per energy a tower restores {{TOWER_POWER_REPAIR / TOWER_ENERGY_COST}} hits close and {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF) / TOWER_ENERGY_COST}} far; a creep always {{1 / REPAIR_COST}}.', eng(P + 'towers/repair.js', 'var amount = C.TOWER_POWER_REPAIR;'), eng(P + 'creeps/repair.js', 'repairCost = Math.min(object.store.energy, Math.ceil(repairEffect * C.REPAIR_COST)),')),
            L('A tower that repairs does not shoot in the same tick.', towerOrder),
            L('Walls need no upkeep: they do not decay.', eng(P + 'constructedWalls/tick.js', 'if(!object.decayTime) {')),
        ],
        tables: [C => {
            const perTick = C.RAMPART_DECAY_AMOUNT / C.RAMPART_DECAY_TIME;
            return {
                title: 'Upkeep by number of ramparts',
                head: ['ramparts', 'hits lost per tick', 'energy per tick', `energy per ${C.CREEP_LIFE_TIME} ticks`, 'WORK parts repairing all the time'],
                rows: [10, 30, 60, 100, 200, 300].map(n => [n, n * perTick, n * perTick * C.REPAIR_COST, n * perTick * C.REPAIR_COST * C.CREEP_LIFE_TIME, Math.ceil(n * perTick / C.REPAIR_POWER)]),
                foot: 'Decay only. Walking time and whatever enemies take off come on top.',
            };
        }],
        constants: ['RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME', 'RAMPART_HITS', 'RAMPART_HITS_MAX', 'REPAIR_POWER', 'REPAIR_COST', 'TOWER_POWER_REPAIR', 'TOWER_ENERGY_COST'],
        see: ['mechanic:ramparts-and-walls', 'mechanic:decay', 'StructureRampart', 'StructureRampart.ticksToDecay', 'Creep.repair', 'StructureTower.repair', 'recipe:defend-a-room', 'recipe:tower-logic'],
        url: DOCS + 'defense.html',
    },
];
