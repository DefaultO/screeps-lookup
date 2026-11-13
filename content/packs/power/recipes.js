'use strict';
// Power: what an operator does each cycle, and how to spend levels on a power creep.
const { L, eng, backend, article } = require('../../_h');

const G = 'src/game/';
const P = 'src/processor/intents/';
const GI = 'src/processor/global-intents/power/';
const PCG = G + 'power-creeps.js';
const PC = P + 'power-creeps/';
const UP = PC + 'usePower.js';

const I = n => `POWER_INFO[${n}]`;
const num = (n, k) => `{{${I(n)}.${k}}}`;
const arr = (n, k) => `{{${I(n)}.${k}.join(" / ")}}`;
// the PWR_ names whose first level opens at the given creep level, read from POWER_INFO
const opensAt = lvl => `{{Object.keys(globalThis).filter(k => /^PWR_/.test(k) && POWER_INFO[globalThis[k]].level[0] == ${lvl}).join(", ")}}`;

const powerNames = C => {
    const names = {};
    for (const [k, v] of Object.entries(C)) if (/^PWR_/.test(k)) names[v] = k;
    return names;
};

// powers whose effect an operator keeps running on its own base
const upkeepTable = C => {
    const list = ['PWR_OPERATE_SPAWN', 'PWR_OPERATE_TOWER', 'PWR_OPERATE_LAB', 'PWR_OPERATE_STORAGE', 'PWR_OPERATE_TERMINAL', 'PWR_OPERATE_FACTORY', 'PWR_OPERATE_POWER',
        'PWR_OPERATE_CONTROLLER', 'PWR_REGEN_SOURCE', 'PWR_REGEN_MINERAL'];
    const gen = C.POWER_INFO[C.PWR_GENERATE_OPS];
    return {
        title: 'Keeping an effect running on one target',
        head: ['power', 'ops per use', 'lasts', 'cooldown', 'ops per 1000 ticks', 'targets one creep can cover'],
        rows: list.map(name => {
            const p = C.POWER_INFO[C[name]];
            return [name, p.ops || 0, p.duration, p.cooldown, (p.ops || 0) * 1000 / p.duration, Math.floor(p.duration / p.cooldown)];
        }),
        foot: `Targets one creep can cover = duration / cooldown, rounded down: the most targets it can refresh before the first one runs out. PWR_GENERATE_OPS brings ${gen.effect.map(e => e * 1000 / gen.cooldown).join(' / ')} ops per 1000 ticks at levels 1–5.`,
    };
};

const unlockTable = C => {
    const names = powerNames(C);
    return {
        kind: 'levels',
        title: 'Creep level needed before a power level can be taken',
        head: ['power', 'level 1', 'level 2', 'level 3', 'level 4', 'level 5'],
        rows: Object.entries(C.POWER_INFO).map(([id, p]) => [names[id]].concat(p.level)),
        foot: `The creep level counts before the upgrade. A creep has ${C.POWER_CREEP_MAX_LEVEL} levels to spend.`,
    };
};

module.exports = {
    entries: [
        {
            id: 'operator-routine',
            title: 'Operator routine in a room',
            summary: 'What one operator does over and over in a base: make ops, keep the timed effects running, renew before {{POWER_CREEP_LIFE_TIME}} ticks are up. It can use one power per tick, and every power has its own cooldown.',
            tasks: [
                'what should my operator do each tick', 'operator loop in a room', 'keep operate spawn running', 'how often to renew a power creep',
                'which power to use first', 'how many ops does a base need', 'how many spawns can one operator boost', 'automate a power creep',
            ],
            steps: [
                { call: 'PowerCreep.spawn', text: 'Not in a room (powerCreep.room is undefined): spawn it at your power spawn once spawnCooldownTime has passed. It appears on the power spawn tile; move it off.' },
                { call: 'PowerCreep.enableRoom', text: 'Once per room: step next to the controller and enable powers, unless controller.isPowerEnabled is true already.' },
                { call: 'PowerCreep.renew', text: 'Next to the power spawn (range 1): renew. It is free and sets the life back to {{POWER_CREEP_LIFE_TIME}} ticks, so do it on every pass, and start the walk back before ticksToLive is shorter than the way.' },
                { call: 'PowerCreep.usePower', text: 'PWR_GENERATE_OPS whenever powers[PWR_GENERATE_OPS].cooldown is 0: every ' + num('PWR_GENERATE_OPS', 'cooldown') + ' ticks, + ' + arr('PWR_GENERATE_OPS', 'effect') + ' ops by power level. It needs no target, so it fits any tick in which no other power is due.' },
                { call: 'PowerCreep.usePower', text: 'Keep the timed effects up. Look at target.effects for the power: when it is missing or about to end, the power is off cooldown and the ops are in the store, go within range 3 and use it. Only one power per tick, so serve the effect that ends first.' },
                { text: 'Spawns: PWR_OPERATE_SPAWN costs ' + num('PWR_OPERATE_SPAWN', 'ops') + ' ops, lasts ' + num('PWR_OPERATE_SPAWN', 'duration') + ' ticks, cooldown ' + num('PWR_OPERATE_SPAWN', 'cooldown') + ': one creep keeps {{Math.floor(POWER_INFO[PWR_OPERATE_SPAWN].duration / POWER_INFO[PWR_OPERATE_SPAWN].cooldown)}} spawns covered. Put it on before a large creep is started.' },
                { text: 'Labs: PWR_OPERATE_LAB costs ' + num('PWR_OPERATE_LAB', 'ops') + ' ops per lab for ' + num('PWR_OPERATE_LAB', 'duration') + ' ticks, cooldown ' + num('PWR_OPERATE_LAB', 'cooldown') + '. Put it on the labs that call runReaction, not on the two reagent labs.' },
                { text: 'Sources: PWR_REGEN_SOURCE is free, lasts ' + num('PWR_REGEN_SOURCE', 'duration') + ' ticks, cooldown ' + num('PWR_REGEN_SOURCE', 'cooldown') + ': both sources of a room stay covered. Each use adds up to {{POWER_INFO[PWR_REGEN_SOURCE].effect.map(v => v * POWER_INFO[PWR_REGEN_SOURCE].duration / POWER_INFO[PWR_REGEN_SOURCE].period).join(" / ")}} energy to a source that is being harvested.' },
                { text: 'Towers under attack: PWR_OPERATE_TOWER costs ' + num('PWR_OPERATE_TOWER', 'ops') + ' ops per tower for ' + num('PWR_OPERATE_TOWER', 'duration') + ' ticks, cooldown ' + num('PWR_OPERATE_TOWER', 'cooldown') + ': all {{CONTROLLER_STRUCTURES.tower[8]}} towers fit in one cycle.' },
                { call: 'PowerCreep.usePower', text: 'Extensions empty and a spawn waiting: PWR_OPERATE_EXTENSION on the storage, ' + num('PWR_OPERATE_EXTENSION', 'ops') + ' ops, at most every ' + num('PWR_OPERATE_EXTENSION', 'cooldown') + ' ticks. It moves up to {{POWER_INFO[PWR_OPERATE_EXTENSION].effect.map(v => Math.round(v * 100)).join(" / ")}} % of the total extension capacity.' },
                { call: 'PowerCreep.withdraw', text: 'Too few ops for the next power: take ops from the storage or terminal one tick before it is due.' },
                { call: 'PowerCreep.transfer', text: 'Store nearly full: put surplus ops into the storage. PWR_GENERATE_OPS drops on the ground what does not fit.' },
            ],
            pitfalls: [
                L('One power per creep per tick: a second usePower call in the tick replaces the first one. Decide which power is due before you call.',
                    eng(PCG, "intents.set(this.id, 'usePower', {power, id: target ? target.id : undefined});")),
                L('usePower runs before withdraw inside a tick, and the call checks the store from the start of the tick: withdraw the ops one tick ahead.',
                    eng(PC + 'intents.js', "var creepActions = ['move','usePower','withdraw','transfer','say','drop','pickup','enableRoom','renew'];"), eng(PCG, 'if((data(this.id).store.ops || 0) < ops) {')),
                L('PWR_GENERATE_OPS at level 5 brings {{POWER_INFO[PWR_GENERATE_OPS].effect[4] * 1000 / POWER_INFO[PWR_GENERATE_OPS].cooldown}} ops per 1000 ticks; the table shows what each effect takes. Add up what you keep running and bring in the rest.',
                    eng(UP, 'store: {ops: (object.store.ops || 0) - ops}')),
                L('PWR_OPERATE_SPAWN shortens only creeps whose spawning starts while the effect is on.',
                    eng(P + 'spawns/create-creep.js', 'needTime = Math.ceil(needTime * C.POWER_INFO[C.PWR_OPERATE_SPAWN].effect[effect.level-1]);')),
                L('PWR_REGEN_SOURCE adds nothing to a full source: use it where harvesters keep the source below its capacity.',
                    eng(P + 'sources/tick.js', 'if(object.energy < object.energyCapacity) {')),
                L('A death stops the routine for at least {{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours of real time while the effects run out: keep the operator behind ramparts and renew early.',
                    eng(GI + '_diePowerCreep.js', 'spawnCooldownTime: Date.now() + C.POWER_CREEP_SPAWN_COOLDOWN')),
                L('Refreshing an effect early does not add time: the new effect replaces the old one and lasts the normal duration from now.',
                    eng(UP, '_.remove(effects, {power: intent.power});')),
            ],
            tables: [upkeepTable],
            constants: ['POWER_CREEP_LIFE_TIME', 'POWER_CREEP_SPAWN_COOLDOWN', 'POWER_INFO'],
            see: ['mechanic:powers', 'mechanic:ops', 'mechanic:power-creeps', 'PowerCreep.usePower', 'PowerCreep.powers', 'RoomObject.effects', 'recipe:level-a-power-creep', 'recipe:power', 'const:power'],
            engine: [
                { file: UP, find: 'cooldownTime: gameTime + powerInfo.cooldown', label: 'engine: cooldown and ops when a power is applied' },
                { file: PC + 'renew.js', find: 'bulk.update(object, {ageTime: gameTime + C.POWER_CREEP_LIFE_TIME});', label: 'engine: renew' },
            ],
        },

        {
            id: 'level-a-power-creep',
            title: 'Level a power creep: what opens when',
            summary: 'Every Global Power Level is one point: the first creates the creep, each further one adds a level to one of its powers. Higher power levels, and some powers, need a minimum creep level; a creep ends at level {{POWER_CREEP_MAX_LEVEL}}.',
            tasks: [
                'which power can I take at which level', 'when can I take regen source', 'what creep level for operate controller', 'how many powers can reach level 5',
                'how many GPL levels for a max power creep', 'power creep level requirements', 'plan the build of an operator',
            ],
            steps: [
                { call: 'StructurePowerSpawn.processPower', text: 'Earn Global Power Levels: level n needs {{POWER_LEVEL_MULTIPLY}} × n^{{POWER_LEVEL_POW}} processed power in total, and each power takes {{POWER_SPAWN_ENERGY_RATIO}} energy.' },
                { call: 'PowerCreep.create', text: 'First free level: PowerCreep.create(name, POWER_CLASS.OPERATOR). The creep is level 0 with 1,000 hits and a store of 100.' },
                { call: 'PowerCreep.upgrade', text: 'Each further free level: upgrade(power) adds one level to one power, and 1,000 hits and 100 capacity to the creep. Free levels = Game.gpl.level − number of power creeps − sum of their levels.' },
                { text: 'From creep level 0 the first level of these is open: ' + opensAt(0) + '.' },
                { text: 'Take PWR_GENERATE_OPS early: it is the only source of ops, and most other powers are paid in ops.' },
                { text: 'Power levels 2 / 3 / 4 / 5 of those powers need creep level {{POWER_INFO[PWR_OPERATE_SPAWN].level.slice(1).join(" / ")}}.' },
                { text: 'Creep level {{POWER_INFO[PWR_REGEN_SOURCE].level[0]}} opens ' + opensAt(10) + '; their levels 2–5 need creep level {{POWER_INFO[PWR_REGEN_SOURCE].level.slice(1).join(" / ")}}.' },
                { text: 'Creep level {{POWER_INFO[PWR_OPERATE_CONTROLLER].level[0]}} opens ' + opensAt(20) + '; their levels 2–5 need creep level {{POWER_INFO[PWR_OPERATE_CONTROLLER].level.slice(1).join(" / ")}}.' },
                { text: 'Level {{POWER_CREEP_MAX_LEVEL}} is the end: a full creep uses {{POWER_CREEP_MAX_LEVEL + 1}} GPL levels, which is {{POWER_LEVEL_MULTIPLY * Math.pow(POWER_CREEP_MAX_LEVEL + 1, POWER_LEVEL_POW)}} power and {{POWER_LEVEL_MULTIPLY * Math.pow(POWER_CREEP_MAX_LEVEL + 1, POWER_LEVEL_POW) * POWER_SPAWN_ENERGY_RATIO}} energy.' },
            ],
            pitfalls: [
                L('Power level 5 needs the creep at level {{POWER_INFO[PWR_OPERATE_SPAWN].level[4]}} before the upgrade, and the creep stops at {{POWER_CREEP_MAX_LEVEL}}: at most {{POWER_CREEP_MAX_LEVEL - POWER_INFO[PWR_OPERATE_SPAWN].level[4]}} powers reach level 5 on one creep.',
                    eng(PCG, 'if(this.level < powerInfo.level[powerLevel]) {'), eng(PCG, 'if(this.level >= C.POWER_CREEP_MAX_LEVEL) {')),
                L('ERR_FULL from upgrade means: creep level too low for the next level of that power, the power is at 5, or the creep is at {{POWER_CREEP_MAX_LEVEL}}. Take another power meanwhile.',
                    eng(PCG, 'if(powerLevel == 5) {'), eng(PCG, 'if(this.level < powerInfo.level[powerLevel]) {')),
                L('A level cannot be moved to another power later. The only reset is deleting the creep: {{POWER_CREEP_DELETE_COOLDOWN / 3600000}} hours and one GPL level, unless an experimentation period is active.',
                    article('power'), backend('lib/cronjobs.js', 'var change = Math.round(user.power - basePrev -')),
                L('The level of PWR_OPERATE_FACTORY is the factory level the creep can set and operate, and it must match exactly. Raising the power later leaves the factories it set before without an operator.',
                    eng(UP, 'if(target.level != creepPower.level) {')),
                L('An upgrade shows in the next tick; it works on a spawned creep, so there is no need to wait for a death.',
                    eng(GI + 'upgradePowerCreep.js', 'if(roomPowerCreep) {'), eng('src/main.js', "stage = 'global';")),
            ],
            tables: [unlockTable],
            constants: ['POWER_CREEP_MAX_LEVEL', 'POWER_LEVEL_MULTIPLY', 'POWER_LEVEL_POW', 'POWER_SPAWN_ENERGY_RATIO', 'POWER_INFO'],
            see: ['PowerCreep.create', 'PowerCreep.upgrade', 'PowerCreep.level', 'Game.gpl', 'mechanic:power-creeps', 'mechanic:powers', 'mechanic:power-processing', 'const:power', 'recipe:operator-routine'],
            engine: [
                { file: GI + 'upgradePowerCreep.js', find: 'if(level < powerInfo.level[powerCreep.powers[intent.power].level]) {', label: 'engine: creep level needed for a power level' },
                { file: GI + 'createPowerCreep.js', find: 'level: 0,', label: 'engine: a new power creep' },
            ],
        },
    ],

    extend: {
        'recipe:power': {
            pitfalls: [
                L('enableRoom is needed only in rooms that have a controller; in highway and centre rooms powers work at once.',
                    eng(UP, 'if(roomController) {'), article('power')),
                L('One power per creep per tick, and each power has its own cooldown.',
                    eng(PCG, "intents.set(this.id, 'usePower', {power, id: target ? target.id : undefined});"), eng(UP, 'cooldownTime: gameTime + powerInfo.cooldown')),
                L('Renewing is free and works at any power bank and at any active power spawn, so there is no reason to let a power creep die of age.',
                    eng(PC + 'renew.js', 'bulk.update(object, {ageTime: gameTime + C.POWER_CREEP_LIFE_TIME});'), article('power')),
                L('suicide() counts as a death and starts the same cooldown.', eng(GI + 'suicidePowerCreep.js', "require('./_diePowerCreep')(powerCreep, scope);")),
                L('Room.find(FIND_MY_CREEPS) and Game.creeps do not contain power creeps: loop over Game.powerCreeps.',
                    eng(G + 'game.js', 'game.powerCreeps[register.powerCreeps[i].name] = register.powerCreeps[i];')),
            ],
            see: ['mechanic:power-creeps', 'mechanic:powers', 'mechanic:ops', 'recipe:operator-routine', 'recipe:level-a-power-creep'],
        },
        'recipe:observer-and-power': {
            pitfalls: [
                L('With a chance of {{POWER_BANK_CAPACITY_CRIT * 100}} % a bank gets {{POWER_BANK_CAPACITY_MAX}} power on top of the roll, so a bank can hold close to {{POWER_BANK_CAPACITY_MAX * 2}}. Read bank.power before you size the haulers.',
                    backend('lib/cronjobs.js', 'power += C.POWER_BANK_CAPACITY_MAX;')),
                L('A destroyed bank leaves a ruin that holds the power for {{RUIN_DECAY_STRUCTURES.powerBank}} ticks: withdraw from the ruin. Only after that does the power lie on the ground.',
                    eng(P + 'structures/_destroy.js', 'decayTime: gameTime + (C.RUIN_DECAY_STRUCTURES[object.type] || C.RUIN_DECAY)'), eng(P + 'ruins/tick.js', "require('../_create-energy')(object.x, object.y, object.room, amount, resourceType, scope);")),
                L('A bank that runs out of time is removed with its power: nothing drops.',
                    eng('src/processor.js', "if(object.type == 'powerBank' || object.type == 'deposit') {")),
                L('The hit-back is computed for any damage to the bank, ranged attacks included.', eng(P + '_damage.js', 'attackBackPower = damage * C.POWER_BANK_HIT_BACK;')),
                L('A highway room gets its next bank about {{POWER_BANK_RESPAWN_TIME * 0.75}} to {{POWER_BANK_RESPAWN_TIME * 1.25}} ticks after the last one appeared.',
                    backend('lib/cronjobs.js', 'const respawnTime = Math.round(Math.random() * C.POWER_BANK_RESPAWN_TIME / 2 + C.POWER_BANK_RESPAWN_TIME * 0.75);')),
                L('Withdraw does not work on a power bank; the power is only reachable by destroying it.',
                    eng(P + 'creeps/withdraw.js', "if(target.type == 'nuker' || target.type == 'powerBank') {")),
                L('A power creep can renew next to a power bank, which makes banks stepping stones for long trips.',
                    eng(PC + 'renew.js', "if(!target || target.type != 'powerBank' && target.type != 'powerSpawn') {"), article('power')),
                L('Under PWR_OPERATE_POWER a power spawn processes up to {{1 + POWER_INFO[PWR_OPERATE_POWER].effect[4]}} power per tick instead of 1.',
                    eng(P + 'power-spawns/process-power.js', 'amount = Math.min(object.store.power, amount + C.POWER_INFO[C.PWR_OPERATE_POWER].effect[effect.level-1]);')),
            ],
            constants: ['POWER_BANK_CAPACITY_MIN', 'POWER_BANK_CAPACITY_MAX', 'POWER_BANK_CAPACITY_CRIT', 'POWER_BANK_RESPAWN_TIME', 'RUIN_DECAY_STRUCTURES.powerBank'],
            see: ['mechanic:power-processing', 'Ruin', 'Creep.withdraw'],
        },
    },
};
