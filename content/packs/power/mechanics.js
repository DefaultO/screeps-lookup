'use strict';
// Power: power creeps, what each power does, ops, and turning power into GPL.
// Numbers come from the constants ({{EXPR}}); hits and store per level are literals in the processor and are cited.
const { L, eng, backend, common, article } = require('../../_h');

const G = 'src/game/';
const P = 'src/processor/intents/';
const GI = 'src/processor/global-intents/';
const PCG = G + 'power-creeps.js';
const UP = P + 'power-creeps/usePower.js';
const DOCS = 'https://docs.screeps.com/';

// {{POWER_INFO[PWR_X].key}} for a number, the same joined for a per-level list
const num = (n, k) => `{{POWER_INFO[${n}].${k}}}`;
const arr = (n, k) => `{{POWER_INFO[${n}].${k}.join(" / ")}}`;
// "PWR_X (target; range 3; 100 ops; lasts 1000; cooldown 300)"; a key ending in "[]" is a per-level list
const head = (n, target, keys) => {
    const part = k => (k.endsWith('[]') ? arr(n, k.slice(0, -2)) : num(n, k));
    const find = k => keys.find(x => x === k || x === k + '[]');
    const bits = [target];
    if (find('range')) bits.push('range ' + part(find('range')));
    bits.push(find('ops') ? part(find('ops')) + ' ops' : 'no ops');
    bits.push(find('duration') ? 'lasts ' + part(find('duration')) : 'instant');
    bits.push('cooldown ' + num(n, 'cooldown'));
    return `${n} (${bits.join('; ')})`;
};

const powerNames = C => {
    const names = {};
    for (const [k, v] of Object.entries(C)) if (/^PWR_/.test(k)) names[v] = k;
    return names;
};
const big = n => n.toLocaleString('en-US');

const gplTable = C => {
    const total = n => C.POWER_LEVEL_MULTIPLY * Math.pow(n, C.POWER_LEVEL_POW);
    const levels = [1, 2, 3, 4, 5, 10, 15, 20, C.POWER_CREEP_MAX_LEVEL + 1];
    return {
        title: 'Global Power Level: power and energy needed',
        head: ['GPL', 'power in total', 'power for this level', 'energy to process the total'],
        rows: levels.map(n => [n, total(n), total(n) - total(n - 1), total(n) * C.POWER_SPAWN_ENERGY_RATIO]),
        foot: `GPL ${C.POWER_CREEP_MAX_LEVEL + 1} pays for one power creep at level ${C.POWER_CREEP_MAX_LEVEL}: one level to create it, one per creep level.`,
    };
};

const creepLevelTable = C => ({
    title: 'Power creep by level',
    head: ['level', 'hits', 'store', 'GPL levels used'],
    rows: [0, 1, 2, 5, 10, 15, 20, C.POWER_CREEP_MAX_LEVEL].map(l => [l, (l + 1) * 1000, (l + 1) * 100, l + 1]),
    foot: 'A new creep has 1,000 hits and a store of 100; each level adds as much again.',
});

const powersTable = C => {
    const I = C.POWER_INFO;
    const fixed = v => (v === undefined ? '—' : Array.isArray(v) ? 'by level' : v);
    const row = (name, target, changes, per) => {
        const p = I[C[name]];
        return [name, target, changes].concat([0, 1, 2, 3, 4].map(i => per(p, i)), [fixed(p.ops), fixed(p.duration), p.cooldown]);
    };
    const plus = (p, i) => '+' + big(p.effect[i]);
    const times = (p, i) => '×' + p.effect[i];
    const ticks = (p, i) => p.duration[i] + (p.duration[i] === 1 ? ' tick' : ' ticks');
    return {
        title: 'What each power changes, by power level',
        head: ['power', 'target', 'changes', '1', '2', '3', '4', '5', 'ops', 'lasts', 'cooldown'],
        rows: [
            row('PWR_GENERATE_OPS', 'itself', 'ops in its store', plus),
            row('PWR_OPERATE_SPAWN', 'spawn', 'spawn time of new creeps', times),
            row('PWR_OPERATE_TOWER', 'tower', 'attack, heal, repair', times),
            row('PWR_OPERATE_STORAGE', 'storage', 'capacity', plus),
            row('PWR_OPERATE_LAB', 'lab', 'units per reaction', plus),
            row('PWR_OPERATE_EXTENSION', 'storage, terminal, factory, container', 'share of extension capacity filled', (p, i) => Math.round(p.effect[i] * 100) + '%'),
            row('PWR_OPERATE_OBSERVER', 'observer', 'no range limit for', ticks),
            row('PWR_OPERATE_TERMINAL', 'terminal', 'send cost and cooldown', times),
            row('PWR_DISRUPT_SPAWN', 'spawn', 'spawning paused for', ticks),
            row('PWR_DISRUPT_TOWER', 'tower', 'attack, heal, repair', times),
            row('PWR_DISRUPT_SOURCE', 'source', 'regeneration paused for', ticks),
            row('PWR_SHIELD', 'own tile', 'hits of the temporary rampart', (p, i) => big(p.effect[i])),
            row('PWR_REGEN_SOURCE', 'source', `energy every ${I[C.PWR_REGEN_SOURCE].period} ticks`, plus),
            row('PWR_REGEN_MINERAL', 'mineral', `mineral every ${I[C.PWR_REGEN_MINERAL].period} ticks`, plus),
            row('PWR_DISRUPT_TERMINAL', 'terminal', 'no withdraw; ops cost', (p, i) => p.ops[i] + ' ops'),
            row('PWR_OPERATE_POWER', 'power spawn', 'power per processPower', plus),
            row('PWR_FORTIFY', 'wall, rampart', 'no damage for', ticks),
            row('PWR_OPERATE_CONTROLLER', 'controller (level 8)', 'upgrade cap per tick', plus),
            row('PWR_OPERATE_FACTORY', 'factory', 'factory level', (p, i) => 'level ' + (i + 1)),
        ],
        foot: 'Every power with a target has range 3, except PWR_DISRUPT_SPAWN (' + I[C.PWR_DISRUPT_SPAWN].range + ') and PWR_DISRUPT_TOWER, PWR_DISRUPT_TERMINAL (' + I[C.PWR_DISRUPT_TOWER].range + ', the whole room). Creep levels needed: see const:power.',
    };
};

const opsTable = C => {
    const names = powerNames(C);
    const rows = [];
    for (const [id, p] of Object.entries(C.POWER_INFO)) {
        if (p.ops === undefined) continue;
        const scalar = !Array.isArray(p.ops) && !Array.isArray(p.duration) && p.duration !== undefined;
        rows.push([names[id], Array.isArray(p.ops) ? p.ops.join(' / ') : p.ops,
            p.duration === undefined ? 'instant' : Array.isArray(p.duration) ? p.duration.join(' / ') : p.duration,
            p.cooldown, scalar ? p.ops * 1000 / p.duration : '—']);
    }
    const gen = C.POWER_INFO[C.PWR_GENERATE_OPS];
    return {
        title: 'Ops cost of each power',
        head: ['power', 'ops per use', 'lasts', 'cooldown', 'ops per 1000 ticks to keep it on one target'],
        rows,
        foot: `PWR_GENERATE_OPS brings ${gen.effect.map(e => e * 1000 / gen.cooldown).join(' / ')} ops per 1000 ticks at levels 1–5.`,
    };
};

module.exports = {
    entries: [
        {
            id: 'power-creeps',
            title: 'Power creeps: life cycle, levels, limits',
            summary: 'A power creep belongs to the account, not to a room. It costs one Global Power Level to create and one per level, lives {{POWER_CREEP_LIFE_TIME}} ticks until renewed, and after a death cannot be spawned for {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours.',
            tasks: [
                'how does a power creep work', 'what happens when a power creep dies', 'how many hits does a power creep have',
                'how much can a power creep carry', 'can a power creep attack or harvest', 'how many GPL levels does a power creep cost',
                'what does deleting a power creep cost', 'find hostile power creeps',
            ],
            facts: [
                L('Global Power Level = floor((processed power / {{POWER_LEVEL_MULTIPLY}}) ^ (1/{{POWER_LEVEL_POW}})). Level n needs {{POWER_LEVEL_MULTIPLY}} × n^{{POWER_LEVEL_POW}} power in total: {{POWER_LEVEL_MULTIPLY}}, {{POWER_LEVEL_MULTIPLY * Math.pow(2, POWER_LEVEL_POW)}}, {{POWER_LEVEL_MULTIPLY * Math.pow(3, POWER_LEVEL_POW)}} for levels 1 to 3.',
                    eng(G + 'game.js', 'var gplLevel = Math.floor(Math.pow((runtimeData.user.power || 0) / C.POWER_LEVEL_MULTIPLY, 1 / C.POWER_LEVEL_POW)),')),
                L('Free levels = GPL level − number of power creeps − sum of their levels. PowerCreep.create and upgrade each take one free level.',
                    eng(PCG, "var used = Object.keys(runtimeData.userPowerCreeps).length + _.sum(runtimeData.userPowerCreeps, 'level');")),
                L('A new power creep is level 0 with 1,000 hits and a store of 100. Every level adds 1,000 hits and 100 capacity; level {{POWER_CREEP_MAX_LEVEL}} is the last ({{(POWER_CREEP_MAX_LEVEL + 1) * 1000}} hits, {{(POWER_CREEP_MAX_LEVEL + 1) * 100}} capacity).',
                    eng(GI + 'power/createPowerCreep.js', 'storeCapacity: 100,'), eng(GI + 'power/upgradePowerCreep.js', 'let hitsMax = powerCreep.hitsMax + 1000;')),
                L('Each level goes into one power. A power has 5 levels, and level k of it needs the creep to be at POWER_INFO[power].level[k − 1] before the upgrade.',
                    eng(GI + 'power/upgradePowerCreep.js', 'if(level < powerInfo.level[powerCreep.powers[intent.power].level]) {')),
                L('create, upgrade, spawn, rename, delete and suicide are account intents. They run after all rooms of the tick, so the result shows in the next tick.',
                    eng('src/main.js', "stage = 'global';"), eng(GI + 'power.js', "const intentTypes = ['spawnPowerCreep','suicidePowerCreep','deletePowerCreep','upgradePowerCreep','createPowerCreep','renamePowerCreep'];")),
                L('spawn(powerSpawn) needs your own active power spawn and a creep that is not on cooldown. The creep appears on the tile of the power spawn with full hits and {{POWER_CREEP_LIFE_TIME}} ticks to live. Spawning takes no energy and no power.',
                    eng(GI + 'power/spawnPowerCreep.js', 'ageTime: gameTime + C.POWER_CREEP_LIFE_TIME,'), eng(GI + 'power/spawnPowerCreep.js', 'y: powerSpawn.y,')),
                L('One spawn per power spawn per tick, and none while another power creep stands on the power spawn tile. The call returns OK either way.',
                    eng(GI + 'power/spawnPowerCreep.js', 'if(_.any(roomObjectsByType.powerCreep, {room: powerSpawn.room, x: powerSpawn.x, y: powerSpawn.y})) {'), eng(GI + 'power/spawnPowerCreep.js', 'powerSpawn._justSpawned = true;')),
                L('renew(target) from range 1 of a power bank or an active power spawn sets the life back to {{POWER_CREEP_LIFE_TIME}} ticks. It is free, has no cooldown, and the code does not ask whose power spawn it is.',
                    eng(P + 'power-creeps/renew.js', 'bulk.update(object, {ageTime: gameTime + C.POWER_CREEP_LIFE_TIME});'), eng(P + 'power-creeps/renew.js', "if(target.type == 'powerSpawn' && !utils.checkStructureAgainstController(target, roomObjects, roomController)) {")),
                L('It dies when its hits reach 0, or at the end of the tick in which ticksToLive is 1. Rooms are processed before that check, so a renew in the same tick still saves it.',
                    eng(GI + 'power.js', 'if(gameTime >= creep.ageTime-1 || creep.hits <= 0) {'), eng('src/main.js', "stage = 'global';")),
                L('A death leaves a tombstone for {{TOMBSTONE_DECAY_POWER_CREEP}} ticks that holds everything the creep carried.',
                    eng(GI + 'power/_diePowerCreep.js', 'decayTime: gameTime + C.TOMBSTONE_DECAY_POWER_CREEP,'), eng(GI + 'power/_diePowerCreep.js', 'tombstone.store[resourceType] = (tombstone.store[resourceType] || 0) + amount;')),
                L('After any death, suicide included, the creep is back on the account and cannot be spawned for {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours of real time. Its level and powers stay.',
                    eng(GI + 'power/_diePowerCreep.js', 'spawnCooldownTime: Date.now() + C.POWER_CREEP_SPAWN_COOLDOWN'), eng(GI + 'power/suicidePowerCreep.js', "require('./_diePowerCreep')(powerCreep, scope);"), article('power')),
                L('A nuke kills every power creep in the room it lands in.', eng(P + 'nukes/tick.js', 'bulk.update(target, {hits: 0});')),
                L('delete() on an unspawned creep starts a {{POWER_CREEP_DELETE_COOLDOWN / 3600000}}-hour timer in real time; delete(true) or a spawn stops it.',
                    eng(GI + 'power/deletePowerCreep.js', 'bulkUsersPowerCreeps.update(powerCreep._id, {deleteTime: Date.now() + C.POWER_CREEP_DELETE_COOLDOWN});'), eng(GI + 'power/spawnPowerCreep.js', 'deleteTime: null')),
                L('When the timer ends the creep is removed and the account drops one GPL level, keeping the same share of progress inside the lower level. The levels the creep used are free again.',
                    backend('lib/cronjobs.js', 'var change = Math.round(user.power - basePrev -'), article('power')),
                L('During an experimentation period (started in the game client, 24 hours) delete() removes the creep at once and no GPL is lost.',
                    eng(GI + 'power/deletePowerCreep.js', 'if(user.powerExperimentationTime > Date.now()) {'), article('power')),
                L('No body parts and no fatigue: it moves one tile per tick on road, plain and swamp alike.',
                    eng(P + 'movement.js', "return object.type == 'powerCreep' ||"), eng(P + 'movement.js', "if(object.type == 'creep') {")),
                L('Its actions are move, usePower, withdraw, transfer, say, drop, pickup, enableRoom and renew: one of each per tick, processed in this order.',
                    eng(P + 'power-creeps/intents.js', "var creepActions = ['move','usePower','withdraw','transfer','say','drop','pickup','enableRoom','renew'];")),
                L('It cannot harvest, build, repair, upgrade, attack, heal, claim or pull, and a creep cannot pull it.',
                    eng(P + 'power-creeps/intents.js', "var creepActions = ['move','usePower','withdraw','transfer','say','drop','pickup','enableRoom','renew'];"), eng(P + 'creeps/pull.js', "if(!target || target.type != 'creep' || target.spawning) {")),
                L('It takes damage from attack, rangedAttack, rangedMassAttack and towers, and is healed by heal, rangedHeal and towers. Nothing else changes its hits: they do not come back on their own.',
                    eng(P + '_damage.js', "else if(target.type == 'powerCreep') {"), eng(P + 'creeps/heal.js', "target.type != 'powerCreep') || target.spawning"), eng(P + 'power-creeps/tick.js', 'hits -= object._damageToApply;')),
                L('Invaders, source keepers and stronghold defenders treat it as a hostile.',
                    eng(P + 'creeps/keepers/pretick.js', "if((object.type == 'creep' || object.type == 'powerCreep') && (object.user != 2) && (object.user != 3)) {"), eng(P + 'invader-core/pretick.js', "if((o.type == 'creep' || o.type == 'powerCreep') && !o.spawning) {")),
                L('It blocks a tile like a creep, crosses room edges like one and uses portals inside the shard. It cannot step onto a portal that leads to another shard.',
                    eng(P + 'power-creeps/tick.js', 'if (portal && !portal.destination.shard) {'), eng(P + 'creeps/move.js', "object.type == 'powerCreep' && target.type == 'portal' && target.destination.shard)) {")),
                L('Each step on a road brings the next decay of that road {{ROAD_WEAROUT_POWER_CREEP}} ticks closer.', eng(P + 'movement.js', 'road.nextDecayTime -= C.ROAD_WEAROUT_POWER_CREEP;')),
                L('Game.powerCreeps holds every power creep of the account by name, spawned or not; its memory is Memory.powerCreeps[name].',
                    eng(G + 'game.js', 'game.powerCreeps[register.powerCreeps[i].name] = register.powerCreeps[i];'), eng(PCG, 'return globals.Memory.powerCreeps[this.name] = globals.Memory.powerCreeps[this.name] || {};')),
            ],
            pitfalls: [
                L('FIND_CREEPS, FIND_MY_CREEPS and FIND_HOSTILE_CREEPS do not return power creeps. Use FIND_POWER_CREEPS, FIND_MY_POWER_CREEPS and FIND_HOSTILE_POWER_CREEPS, or defence code never sees an enemy operator.',
                    eng(G + 'game.js', 'addObjectToFindCache(register, C.FIND_HOSTILE_POWER_CREEPS, register.powerCreeps[i], object);')),
                L('spawnCooldownTime and deleteTime are timestamps in milliseconds of real time: compare them with Date.now(), not with Game.time.',
                    eng(GI + 'power/_diePowerCreep.js', 'spawnCooldownTime: Date.now() + C.POWER_CREEP_SPAWN_COOLDOWN')),
                L('An unspawned power creep has no room and no pos, and its ticksToLive is NaN (the docs say undefined). Check powerCreep.room before you use it.',
                    eng(PCG, 'if(_data.room) {'), eng(PCG, 'ticksToLive: (o) => o.ageTime - runtimeData.time,')),
                L('moveTo plans for creeps by default: road 1, plain 2, swamp 10. A power creep spends one tick on any tile, so pass {plainCost: 1, swampCost: 1} to get the shortest way.',
                    eng(G + 'rooms.js', 'searchOpts.swampCost = 10;'), eng(P + 'movement.js', "if(object.type == 'creep') {")),
                L('It respawns with an empty store: what it carried is in the tombstone where it died.',
                    eng(GI + 'power/_diePowerCreep.js', 'tombstone.store[resourceType] = (tombstone.store[resourceType] || 0) + amount;')),
            ],
            tables: [gplTable, creepLevelTable],
            constants: ['POWER_CREEP_LIFE_TIME', 'POWER_CREEP_SPAWN_COOLDOWN', 'POWER_CREEP_DELETE_COOLDOWN', 'POWER_CREEP_MAX_LEVEL', 'POWER_LEVEL_MULTIPLY', 'POWER_LEVEL_POW',
                'TOMBSTONE_DECAY_POWER_CREEP', 'ROAD_WEAROUT_POWER_CREEP', 'POWER_CLASS'],
            see: ['PowerCreep', 'PowerCreep.create', 'PowerCreep.upgrade', 'PowerCreep.spawn', 'PowerCreep.renew', 'PowerCreep.delete', 'Game.gpl', 'Game.powerCreeps',
                'mechanic:powers', 'mechanic:ops', 'mechanic:power-processing', 'recipe:level-a-power-creep', 'recipe:operator-routine', 'recipe:power'],
            url: DOCS + 'power.html',
            engine: [
                { file: GI + 'power/createPowerCreep.js', find: 'hitsMax: 1000,', label: 'engine: hits and store of a new power creep' },
                { file: GI + 'power/upgradePowerCreep.js', find: 'let storeCapacity = powerCreep.storeCapacity + 100;', label: 'engine: hits and store per level' },
                { file: GI + 'power/_diePowerCreep.js', find: 'spawnCooldownTime: Date.now() + C.POWER_CREEP_SPAWN_COOLDOWN', label: 'engine: death of a power creep' },
            ],
        },

        {
            id: 'powers',
            title: 'Powers: what each one does',
            summary: 'An operator has {{Object.keys(POWER_INFO).length}} powers with up to 5 levels each. usePower spends ops, starts the cooldown of that power and, for most powers, puts a timed effect on the target that the rest of the engine reads.',
            tasks: [
                'what does each power do', 'how much faster is a spawn with operate spawn', 'how much energy does regen source give',
                'how long does a power effect last', 'which factory level does operate factory set', 'does fortify stop a nuke',
                'what does disrupt terminal block', 'can I use powers in another player\'s room',
            ],
            facts: [
                L('usePower works in a room without a controller, or with a controller that has isPowerEnabled. It does not work in another player\'s room that is in safe mode.',
                    eng(UP, 'if(!roomController.isPowerEnabled) {'), eng(UP, 'if(roomController.user != object.user && roomController.safeMode > gameTime) {')),
                L('It also needs the power at level 1 or more, its cooldown over, enough ops in the creep, and for a power with a range a target within that range.',
                    eng(UP, 'if(!creepPower || creepPower.level == 0 || creepPower.cooldownTime > gameTime) {'), eng(UP, 'if(utils.dist(object, target) > powerInfo.range) {')),
                L('The effect is stored on the target with the power id, the power level and an end time. Scripts read it in target.effects as {power, effect, level, ticksRemaining}.',
                    eng(UP, 'effects.push({'), eng(G + 'rooms.js', 'ticksRemaining: i.endTime - runtimeData.time')),
                L('The same power used again on a target at the same or a higher level replaces the old effect and its time starts over. Against a higher active level the call returns ERR_FULL.',
                    eng(UP, 'if(currentEffect && currentEffect.level > creepPower.level && currentEffect.endTime > gameTime) {'), eng(UP, '_.remove(effects, {power: intent.power});')),
                L('Effects of different powers sit side by side on one target: a tower under PWR_OPERATE_TOWER and PWR_DISRUPT_TOWER gets both factors.',
                    eng(P + 'towers/attack.js', '[C.PWR_OPERATE_TOWER, C.PWR_DISRUPT_TOWER].forEach(power => {')),
                L('Only the type of the target is checked, not its owner, PWR_OPERATE_EXTENSION excepted: operate powers work on an ally\'s structures and disrupt powers on an enemy\'s.',
                    eng(UP, "if(target.type != 'tower') {"), eng(UP, 'if(target.user && target.user != roomController.user) {')),

                L(head('PWR_GENERATE_OPS', 'no target', []) + ': adds ' + arr('PWR_GENERATE_OPS', 'effect') + ' ops to the creep\'s own store. What does not fit drops on its tile.',
                    eng(UP, 'store:{[C.RESOURCE_OPS]: (object.store[C.RESOURCE_OPS] || 0) + powerInfo.effect[creepPower.level-1]},'), eng(UP, 'amount: Math.min(object.store[C.RESOURCE_OPS], sum - object.storeCapacity),')),
                L(head('PWR_OPERATE_SPAWN', 'spawn', ['range', 'ops', 'duration']) + ': a creep whose spawning starts under the effect takes × ' + arr('PWR_OPERATE_SPAWN', 'effect') + ' of the normal time, rounded up. A creep already being spawned keeps its time.',
                    eng(P + 'spawns/create-creep.js', 'needTime = Math.ceil(needTime * C.POWER_INFO[C.PWR_OPERATE_SPAWN].effect[effect.level-1]);')),
                L(head('PWR_OPERATE_TOWER', 'tower', ['range', 'ops', 'duration']) + ': attack, heal and repair of the tower × ' + arr('PWR_OPERATE_TOWER', 'effect') + ', applied after the range falloff and rounded down.',
                    eng(P + 'towers/attack.js', 'amount *= C.POWER_INFO[power].effect[effect.level-1];'), eng(P + 'towers/heal.js', 'amount *= C.POWER_INFO[power].effect[effect.level-1];'), eng(P + 'towers/repair.js', 'amount *= C.POWER_INFO[power].effect[effect.level-1];')),
                L(head('PWR_OPERATE_STORAGE', 'storage', ['range', 'ops', 'duration']) + ': capacity + {{POWER_INFO[PWR_OPERATE_STORAGE].effect.map(v => v / 1e6 + "M").join(" / ")}} while it lasts. Afterwards the capacity is {{STORAGE_CAPACITY}} again; the contents stay, but nothing more fits until the storage is below that.',
                    eng(P + 'storages/tick.js', 'storeCapacity += C.POWER_INFO[C.PWR_OPERATE_STORAGE].effect[effect.level-1];'), eng(P + 'storages/tick.js', 'bulk.update(object, {storeCapacity});'),
                    eng(P + 'creeps/transfer.js', 'if(storedAmount >= targetCapacity) {')),
                L(head('PWR_OPERATE_LAB', 'lab', ['range', 'ops', 'duration']) + ': runReaction and reverseReaction called on this lab handle {{LAB_REACTION_AMOUNT}} + ' + arr('PWR_OPERATE_LAB', 'effect') + ' units per call. The lab cooldown does not change.',
                    eng(P + 'labs/run-reaction.js', 'reactionAmount += C.POWER_INFO[C.PWR_OPERATE_LAB].effect[effect.level-1];'), eng(P + 'labs/reverse-reaction.js', 'reactionAmount += C.POWER_INFO[C.PWR_OPERATE_LAB].effect[effect.level-1];')),
                L(head('PWR_OPERATE_EXTENSION', 'storage, terminal, factory or container', ['range', 'ops']) + ': moves energy from the target into the room owner\'s extensions, nearest to the target first, until {{POWER_INFO[PWR_OPERATE_EXTENSION].effect.map(v => Math.round(v * 100)).join(" / ")}} % of their total capacity has been moved or the target is empty. Spawns get nothing.',
                    eng(UP, "if(!target.store || target.type != 'storage' && target.type != 'terminal' && target.type != 'factory' && target.type !== 'container') {"),
                    eng(UP, "powerInfo.effect[creepPower.level-1] * _.sum(extensions, 'storeCapacityResource.energy'));"), eng(UP, 'extensions.sort(utils.comparatorDistance(target));')),
                L(head('PWR_OPERATE_OBSERVER', 'observer', ['range', 'ops', 'duration[]']) + ': observeRoom accepts a room at any distance. The range check sits in the API call.',
                    eng(G + 'structures.js', 'if((!effect || effect.ticksRemaining <= 0) &&')),
                L(head('PWR_OPERATE_TERMINAL', 'terminal', ['range', 'ops', 'duration']) + ': the energy this terminal pays for a send or a deal × ' + arr('PWR_OPERATE_TERMINAL', 'effect') + ' (rounded up), and its cooldown becomes {{POWER_INFO[PWR_OPERATE_TERMINAL].effect.map(f => Math.round(TERMINAL_COOLDOWN * f)).join(" / ")}} instead of {{TERMINAL_COOLDOWN}} ticks.',
                    eng(P + 'terminal/send.js', 'cost = Math.ceil(cost * C.POWER_INFO[C.PWR_OPERATE_TERMINAL].effect[effect.level-1]);'),
                    eng(GI + 'market.js', 'transferCost = Math.ceil(transferCost * C.POWER_INFO[C.PWR_OPERATE_TERMINAL].effect[effect.level-1]);'),
                    eng(GI + 'market.js', 'cooldown = Math.round(cooldown * C.POWER_INFO[C.PWR_OPERATE_TERMINAL].effect[effect.level-1]);')),
                L(head('PWR_DISRUPT_SPAWN', 'spawn', ['range', 'ops', 'duration[]']) + ': while it lasts, the creep being spawned makes no progress: its finish time moves back one tick per tick.',
                    eng(P + 'spawns/tick.js', 'bulk.update(object, {spawning: {spawnTime: 1+object.spawning.spawnTime}});')),
                L(head('PWR_DISRUPT_TOWER', 'tower', ['range', 'ops', 'duration']) + ': attack, heal and repair of the tower × ' + arr('PWR_DISRUPT_TOWER', 'effect') + '.',
                    eng(P + 'towers/attack.js', 'amount *= C.POWER_INFO[power].effect[effect.level-1];')),
                L(head('PWR_DISRUPT_SOURCE', 'source', ['range', 'ops', 'duration[]']) + ': while it lasts and the source is not full, its regeneration timer stands still.',
                    eng(P + 'sources/tick.js', 'nextRegenerationTime: object.nextRegenerationTime+1')),
                L(head('PWR_SHIELD', 'no target', ['duration']) + ': puts a rampart of {{POWER_INFO[PWR_SHIELD].effect.join(" / ")}} hits on the creep\'s tile, owned by the creep\'s owner. It is removed when the time is up, does not decay before, and cannot be repaired (hitsMax 0).',
                    eng(UP, 'hits: powerInfo.effect[creepPower.level-1],'), eng(P + 'ramparts/tick.js', 'if(effect.endTime <= gameTime) {'), eng(P + 'creeps/repair.js', 'if(!target || !target.hitsMax || !C.CONSTRUCTION_COST[target.type] || target.hits >= target.hitsMax) {')),
                L(head('PWR_REGEN_SOURCE', 'source', ['range', 'duration']) + ': every ' + num('PWR_REGEN_SOURCE', 'period') + ' ticks the source gains ' + arr('PWR_REGEN_SOURCE', 'effect') + ' energy, up to its capacity: at most {{POWER_INFO[PWR_REGEN_SOURCE].effect.map(v => v * POWER_INFO[PWR_REGEN_SOURCE].duration / POWER_INFO[PWR_REGEN_SOURCE].period).join(" / ")}} per use. A full source gains nothing.',
                    eng(P + 'sources/tick.js', 'energy: Math.min(object.energyCapacity, object.energy + powerInfo.effect[effect.level - 1])'), eng(P + 'sources/tick.js', 'if(((effect.endTime - gameTime - 1) % powerInfo.period) === 0) {')),
                L(head('PWR_REGEN_MINERAL', 'mineral', ['range', 'duration']) + ': every ' + num('PWR_REGEN_MINERAL', 'period') + ' ticks the mineral gains ' + arr('PWR_REGEN_MINERAL', 'effect') + ' units: {{POWER_INFO[PWR_REGEN_MINERAL].effect.map(v => v * POWER_INFO[PWR_REGEN_MINERAL].duration / POWER_INFO[PWR_REGEN_MINERAL].period).join(" / ")}} per use. It does nothing on a depleted mineral.',
                    eng(P + 'minerals/tick.js', 'mineralAmount: object.mineralAmount + powerInfo.effect[effect.level - 1]'), eng(UP, 'if(target.nextRegenerationTime) {')),
                L(head('PWR_DISRUPT_TERMINAL', 'terminal', ['range', 'ops[]', 'duration']) + ': nobody can withdraw from the terminal, its owner included, and PWR_OPERATE_EXTENSION cannot draw from it. The engine code reads the effect in these two places only.',
                    eng(P + 'creeps/withdraw.js', 'var effect = _.find(target.effects, {power: C.PWR_DISRUPT_TERMINAL});'), eng(UP, 'var effect = _.find(target.effects, {power: C.PWR_DISRUPT_TERMINAL});')),
                L(head('PWR_OPERATE_POWER', 'power spawn', ['range', 'ops', 'duration']) + ': one processPower call handles 1 + ' + arr('PWR_OPERATE_POWER', 'effect') + ' power, each with {{POWER_SPAWN_ENERGY_RATIO}} energy.',
                    eng(P + 'power-spawns/process-power.js', 'amount = Math.min(object.store.power, amount + C.POWER_INFO[C.PWR_OPERATE_POWER].effect[effect.level-1]);')),
                L(head('PWR_FORTIFY', 'wall or rampart', ['range', 'ops', 'duration[]']) + ': the target takes no damage from attack, rangedAttack, rangedMassAttack, dismantle or towers. A nuke still damages it.',
                    eng(P + '_damage.js', "const effect = _.find(target.effects, e => (e.power == C.PWR_FORTIFY || e.effect == C.EFFECT_INVULNERABILITY) && (e.endTime > gameTime));"),
                    eng(P + '_damage.js', "if(attackType != C.EVENT_ATTACK_TYPE_NUKE && (target.type == 'constructedWall' || target.type == 'rampart')) {")),
                L(head('PWR_OPERATE_CONTROLLER', 'controller', ['range', 'ops', 'duration']) + ': the level 8 limit of {{CONTROLLER_MAX_UPGRADE_PER_TICK}} upgrade energy per tick rises by ' + arr('PWR_OPERATE_CONTROLLER', 'effect') + '. Below level 8 it changes nothing.',
                    eng(P + 'creeps/upgradeController.js', 'limit += C.POWER_INFO[C.PWR_OPERATE_CONTROLLER].effect[effect.level-1];')),
                L(head('PWR_OPERATE_FACTORY', 'factory', ['range', 'ops', 'duration']) + ': on a factory without a level it sets the level to the level of the power, for good. After that only a power of exactly that level works on it. Commodities that have a level can only be produced while the effect is active.',
                    eng(UP, 'bulk.update(target, {level: creepPower.level});'), eng(UP, 'if(target.level != creepPower.level) {'),
                    eng(P + 'factories/produce.js', 'e.power == C.PWR_OPERATE_FACTORY && e.level == C.COMMODITIES[intent.resourceType].level')),

                L('effects can also hold two entries no power creep makes: EFFECT_INVULNERABILITY (stronghold core before it deploys, controller of a stronghold room: attacks are refused) and EFFECT_COLLAPSE_TIMER (stronghold structures: removed when it ends).',
                    backend('lib/strongholds.js', 'effect: C.EFFECT_INVULNERABILITY,'), eng('src/processor.js', 'if(collapseEffect && collapseEffect.endTime <= gameTime) {')),
            ],
            pitfalls: [
                L('usePower does not check the type of the target. On a wrong target it returns OK and the processor drops the intent: no ops spent, no cooldown, no effect.',
                    eng(UP, "if(target.type != 'spawn') {"), eng(PCG, "intents.set(this.id, 'usePower', {power, id: target ? target.id : undefined});")),
                L('PWR_OPERATE_SPAWN counts when spawnCreep is processed, not while the creep is being built: put the effect on before you start a large creep.',
                    eng(P + 'spawns/create-creep.js', 'if(effect && effect.endTime > gameTime) {')),
                L('Under PWR_OPERATE_LAB a reaction needs the raised amount of both reagents and that much room in the lab, or nothing happens (ERR_NOT_ENOUGH_RESOURCES, ERR_FULL). There is no partial run.',
                    eng(P + 'labs/run-reaction.js', 'if(!lab1MineralType || lab1.store[lab1MineralType] < reactionAmount) {'), eng(G + 'structures.js', 'if(lab1.mineralAmount < reactionAmount || lab2.mineralAmount < reactionAmount) {')),
                L('Under PWR_OPERATE_POWER processPower returns ERR_NOT_ENOUGH_RESOURCES unless the power spawn holds the full raised amount of power and the energy for it. A smaller rest waits until the effect ends.',
                    eng(G + 'structures.js', 'if(this.power < amount || this.energy < amount * C.POWER_SPAWN_ENERGY_RATIO) {')),
                L('PWR_OPERATE_FACTORY cannot be undone: the first use fixes the factory level, and a power creep with another level of the power can never operate that factory.',
                    eng(UP, 'if(target.level != creepPower.level) {')),
                L('PWR_SHIELD needs a tile where a rampart may stand: not one that already has a rampart, not the room edge, not the tile next to an exit. A construction site under the creep is removed first, your own included, even when the shield then fails.',
                    eng(UP, "if(!utils.checkConstructionSite(roomObjects, 'rampart', object.x, object.y) ||"), eng(UP, 'bulk.remove(constructionSite._id);'),
                    eng('src/utils.js', "if(structureType != 'road' && structureType != 'container' && (x == 1 || x == 48 || y == 1 || y == 48)) {")),
                L('The docs give PWR_SHIELD an energy cost of {{POWER_INFO[PWR_SHIELD].energy}}, and POWER_INFO has that field, but the engine code of the power takes no energy.',
                    article('power'), eng(UP, 'case C.PWR_SHIELD: {')),
                L('PWR_OPERATE_EXTENSION with nothing to move (target without energy, extensions full) spends nothing and starts no cooldown.',
                    eng(UP, 'if(energySent === 0) {')),
                L('attack, rangedAttack and dismantle return ERR_INVALID_TARGET on a wall or rampart under PWR_FORTIFY; pick another target instead of repeating the call.',
                    eng(G + 'creeps.js', 'const effect = _.find(target.effects, e => (e.power == C.PWR_FORTIFY || e.effect == C.EFFECT_INVULNERABILITY) && (e.ticksRemaining > 0));')),
                L('Dismantling a rampart made by PWR_SHIELD, or one under PWR_FORTIFY, gives no energy back.',
                    eng(P + 'creeps/dismantle.js', 'var effect = _.find(target.effects, e => e.endTime >= gameTime && (e.power == C.PWR_SHIELD || e.power == C.PWR_FORTIFY || e.effect == C.EFFECT_INVULNERABILITY));')),
            ],
            tables: [powersTable],
            constants: ['POWER_INFO', 'EFFECT_INVULNERABILITY', 'EFFECT_COLLAPSE_TIMER'],
            see: ['PowerCreep.usePower', 'PowerCreep.enableRoom', 'RoomObject.effects', 'const:power', 'mechanic:ops', 'mechanic:power-creeps', 'recipe:operator-routine',
                'StructureSpawn.spawnCreep', 'mechanic:tower', 'StructureLab.runReaction', 'StructureObserver.observeRoom', 'StructureTerminal.send', 'StructureFactory.produce',
                'StructurePowerSpawn.processPower', 'Creep.upgradeController', 'mechanic:sources'],
            url: DOCS + 'power.html#Powers',
            engine: [{ file: UP, find: 'switch(intent.power) {', label: 'engine: usePower, one case per power' }],
        },

        {
            id: 'ops',
            title: 'Ops: what powers are paid with',
            summary: 'Ops is a resource that only PWR_GENERATE_OPS makes. A power takes its ops from the store of the power creep that uses it; apart from that ops can be stored, moved and traded like any resource.',
            tasks: [
                'where do ops come from', 'how many ops does a power cost', 'how fast can I generate ops', 'can I buy ops on the market', 'where to store ops',
                'what are ops used for', 'which powers cost no ops', 'why does usePower return ERR_NOT_ENOUGH_RESOURCES',
            ],
            facts: [
                L('PWR_GENERATE_OPS adds ' + arr('PWR_GENERATE_OPS', 'effect') + ' ops per use at power levels 1–5, with a cooldown of ' + num('PWR_GENERATE_OPS', 'cooldown') + ' ticks: {{POWER_INFO[PWR_GENERATE_OPS].effect.map(v => v / POWER_INFO[PWR_GENERATE_OPS].cooldown).join(" / ")}} ops per tick.',
                    eng(UP, 'store:{[C.RESOURCE_OPS]: (object.store[C.RESOURCE_OPS] || 0) + powerInfo.effect[creepPower.level-1]},')),
                L('It needs no target and costs nothing, but the room rule holds for it too: no controller, or a controller with isPowerEnabled.',
                    eng(UP, 'if(!roomController.isPowerEnabled) {'), eng(UP, 'if(powerInfo.range) {')),
                L('Ops beyond the free space of the creep fall on its tile as a dropped resource.',
                    eng(UP, 'amount: Math.min(object.store[C.RESOURCE_OPS], sum - object.storeCapacity),')),
                L('A power is paid from the store of the creep that uses it. Ops in a storage or terminal count only after a withdraw.',
                    eng(UP, 'if((object.store.ops || 0) < ops) {'), eng(UP, 'store: {ops: (object.store.ops || 0) - ops}')),
                L('usePower is processed before withdraw in the same tick, and the API call checks the store as it was at the start of the tick: ops you take out now pay for a power next tick.',
                    eng(P + 'power-creeps/intents.js', "var creepActions = ['move','usePower','withdraw','transfer','say','drop','pickup','enableRoom','renew'];"), eng(PCG, 'if((data(this.id).store.ops || 0) < ops) {')),
                L('PWR_GENERATE_OPS, PWR_SHIELD, PWR_REGEN_SOURCE and PWR_REGEN_MINERAL cost no ops: POWER_INFO has no ops field for them.',
                    eng(UP, 'var ops = powerInfo.ops || 0;')),
                L('PWR_DISRUPT_TERMINAL is the one power whose cost depends on the level: ' + arr('PWR_DISRUPT_TERMINAL', 'ops') + ' ops.',
                    eng(UP, 'ops = ops[creepPower.level-1];')),
                L('ops is in RESOURCES_ALL: transfer, withdraw, drop, storage, terminal, container and market orders take it like any other resource.',
                    common('lib/constants.js', 'exports.RESOURCE_OPS,'), eng(G + 'market.js', 'if(!_.contains(C.RESOURCES_ALL, resourceType) && !_.contains(C.INTERSHARD_RESOURCES, resourceType)) {')),
                L('A power creep holds 100 units per level plus 100, ops and everything else together.',
                    eng(GI + 'power/upgradePowerCreep.js', 'let storeCapacity = powerCreep.storeCapacity + 100;')),
                L('Ops a power creep carries when it dies stay in its tombstone for {{TOMBSTONE_DECAY_POWER_CREEP}} ticks.',
                    eng(GI + 'power/_diePowerCreep.js', 'decayTime: gameTime + C.TOMBSTONE_DECAY_POWER_CREEP,')),
            ],
            pitfalls: [
                L('PWR_GENERATE_OPS at level 5 brings {{POWER_INFO[PWR_GENERATE_OPS].effect[4] * 1000 / POWER_INFO[PWR_GENERATE_OPS].cooldown}} ops per 1000 ticks. Keeping PWR_OPERATE_SPAWN on one spawn takes {{POWER_INFO[PWR_OPERATE_SPAWN].ops * 1000 / POWER_INFO[PWR_OPERATE_SPAWN].duration}} of them and PWR_OPERATE_POWER {{POWER_INFO[PWR_OPERATE_POWER].ops * 1000 / POWER_INFO[PWR_OPERATE_POWER].duration}}: an operator that runs several effects needs ops from outside, from a second operator or the market.',
                    common('lib/constants.js', 'effect: [1, 2, 4, 6, 8]'), eng(UP, 'store: {ops: (object.store.ops || 0) - ops}')),
                L('Ops are taken when the power is applied, whether the effect is then used or not: PWR_OPERATE_TOWER on a tower that never fires costs the same.',
                    eng(UP, 'store: {ops: (object.store.ops || 0) - ops}')),
            ],
            tables: [opsTable],
            constants: ['RESOURCE_OPS', 'POWER_INFO'],
            see: ['PowerCreep.usePower', 'PowerCreep.store', 'PowerCreep.withdraw', 'PowerCreep.transfer', 'mechanic:powers', 'recipe:operator-routine', 'const:power'],
            url: DOCS + 'power.html#Powers',
        },

        {
            id: 'power-processing',
            title: 'Processing power into Global Power Level',
            summary: 'A power spawn burns 1 power and {{POWER_SPAWN_ENERGY_RATIO}} energy per processPower call, one call per tick, and adds 1 to the account\'s power total. Global Power Level n needs {{POWER_LEVEL_MULTIPLY}} × n^{{POWER_LEVEL_POW}} in total.',
            tasks: [
                'how much energy per power', 'how much power for the next GPL level', 'how fast can I process power', 'how does GPL progress work',
                'how much power does a power spawn hold', 'GPL formula', 'speed up power processing', 'what is power used for',
            ],
            facts: [
                L('processPower takes 1 power and {{POWER_SPAWN_ENERGY_RATIO}} energy out of the power spawn and adds 1 to the power total of the account.',
                    eng(P + 'power-spawns/process-power.js', "bulkUsers.inc(object.user, 'power', amount);"), eng(P + 'power-spawns/process-power.js', 'object.store.energy -= amount * C.POWER_SPAWN_ENERGY_RATIO;')),
                L('One call per power spawn per tick; a room has one power spawn, at room level 8.',
                    eng(G + 'structures.js', "intents.set(this.id, 'processPower', {});"), common('lib/constants.js', '"powerSpawn": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1},')),
                L('The power spawn holds {{POWER_SPAWN_POWER_CAPACITY}} power and {{POWER_SPAWN_ENERGY_CAPACITY}} energy: {{POWER_SPAWN_POWER_CAPACITY}} ticks of work per fill, and both run out together.',
                    eng(P + 'creeps/build.js', 'storeCapacityResource: {energy: C.POWER_SPAWN_ENERGY_CAPACITY, power: C.POWER_SPAWN_POWER_CAPACITY},')),
                L('Under PWR_OPERATE_POWER one call handles 1 + ' + arr('PWR_OPERATE_POWER', 'effect') + ' power at the same energy rate: up to {{1 + POWER_INFO[PWR_OPERATE_POWER].effect[4]}} power and {{(1 + POWER_INFO[PWR_OPERATE_POWER].effect[4]) * POWER_SPAWN_ENERGY_RATIO}} energy per tick, so a full power spawn lasts {{Math.floor(POWER_SPAWN_POWER_CAPACITY / (1 + POWER_INFO[PWR_OPERATE_POWER].effect[4]))}} ticks.',
                    eng(P + 'power-spawns/process-power.js', 'amount = Math.min(object.store.power, amount + C.POWER_INFO[C.PWR_OPERATE_POWER].effect[effect.level-1]);')),
                L('The power spawn must be active: in your room, at a level that allows it. Otherwise nothing is processed (ERR_RCL_NOT_ENOUGH).',
                    eng(P + 'power-spawns/process-power.js', 'if(!utils.checkStructureAgainstController(object, roomObjects, roomController)) {')),
                L('Game.gpl.level = floor((total / {{POWER_LEVEL_MULTIPLY}}) ^ (1/{{POWER_LEVEL_POW}})). progress is the total minus what the current level needed; progressTotal is the size of the step to the next level, (2 × level + 1) × {{POWER_LEVEL_MULTIPLY}}.',
                    eng(G + 'game.js', 'progressTotal: Math.pow(gplLevel+1, 2) * 1000 - gplBaseProgress')),
                L('Each GPL level is one point for power creeps: creating one takes a point, and so does every level of it.',
                    eng(PCG, "var used = Object.keys(runtimeData.userPowerCreeps).length + _.sum(runtimeData.userPowerCreeps, 'level');")),
                L('Power comes from power banks in highway rooms and from the market.', article('power')),
                L('The total can go down: when a deleted power creep is removed, the account drops one GPL level.',
                    backend('lib/cronjobs.js', 'var change = Math.round(user.power - basePrev -')),
            ],
            pitfalls: [
                L('Each level costs more than the one before: level n alone takes (2n − 1) × {{POWER_LEVEL_MULTIPLY}} power, and every power takes {{POWER_SPAWN_ENERGY_RATIO}} energy. Plan the energy before you buy the power.',
                    eng(G + 'game.js', 'gplBaseProgress = Math.pow(gplLevel, C.POWER_LEVEL_POW) * C.POWER_LEVEL_MULTIPLY;')),
                L('processPower returns ERR_NOT_ENOUGH_RESOURCES when the power spawn has power but less than {{POWER_SPAWN_ENERGY_RATIO}} energy: keep both filled.',
                    eng(G + 'structures.js', 'if(this.power < amount || this.energy < amount * C.POWER_SPAWN_ENERGY_RATIO) {')),
            ],
            tables: [gplTable],
            constants: ['POWER_SPAWN_ENERGY_RATIO', 'POWER_SPAWN_POWER_CAPACITY', 'POWER_SPAWN_ENERGY_CAPACITY', 'POWER_LEVEL_MULTIPLY', 'POWER_LEVEL_POW', 'CONTROLLER_STRUCTURES.powerSpawn'],
            see: ['StructurePowerSpawn.processPower', 'StructurePowerSpawn', 'Game.gpl', 'recipe:observer-and-power', 'mechanic:power-creeps', 'mechanic:powers', 'StructurePowerBank'],
            url: DOCS + 'power.html',
        },
    ],

    extend: {
        'const:power': {
            notes: [
                L('A field missing in POWER_INFO means "not needed": no range = no target, no ops = free, no duration = instant.',
                    eng(UP, 'if(powerInfo.range) {'), eng(UP, 'var ops = powerInfo.ops || 0;')),
                L('duration and ops can be a list with one value per power level instead of a number.',
                    eng(UP, '(_.isArray(powerInfo.duration) ? powerInfo.duration[creepPower.level-1] : powerInfo.duration)')),
                L('POWER_INFO[power].level[k − 1] is the creep level needed before power level k can be taken.',
                    eng(PCG, 'if(this.level < powerInfo.level[powerLevel]) {')),
                L('PWR_REGEN_SOURCE and PWR_REGEN_MINERAL have a period: the ticks between two additions.',
                    eng(P + 'sources/tick.js', 'if(((effect.endTime - gameTime - 1) % powerInfo.period) === 0) {')),
                L('Hits and store of a power creep are not constants: 1,000 and 100 per level are written in the processor.',
                    eng(GI + 'power/upgradePowerCreep.js', 'let hitsMax = powerCreep.hitsMax + 1000;')),
                L('POWER_BANK_CAPACITY_MIN and _MAX bound the roll for a new bank; with a chance of POWER_BANK_CAPACITY_CRIT the bank gets _MAX on top.',
                    backend('lib/cronjobs.js', 'power += C.POWER_BANK_CAPACITY_MAX;')),
            ],
            see: ['mechanic:powers', 'mechanic:power-creeps', 'mechanic:ops', 'mechanic:power-processing'],
        },
    },
};
