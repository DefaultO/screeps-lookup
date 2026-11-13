'use strict';
// Platform notes on API members: account resources, CPU unlock, pixels, shard limits, notifications.
// A pack adds lines to these entries; the summaries live elsewhere.
const { L, eng, backend, driver, common, doc, article } = require('../../_h');

const G = 'src/game/';
const P = 'src/processor/intents/';
const DRIVER = 'lib/index.js';
const OFFICIAL_ONLY = 'Official server only: the open engine does not define it, so on a private server the call throws.';
const NO_CPU_EXTRAS = eng(G + 'game.js', 'halt: cpuHalt,');
const SHARD_OBJECT = driver(DRIVER, 'sandbox.run(`Game.shard = Object.create(null, {');

module.exports = {
    // ---------------------------------------------------------------- CPU and account resources
    'Game.cpu.limit': {
        tasks: ['how much cpu do I get'],
        notes: [
            L('Official server: 20 without full CPU; with full CPU unlocked it grows by 10 per GCL level up to 300.', article('control#Global-Control-Level'), article('cpu-limit#CPU-Limit')),
            L('Private server: 100 for a new account.', backend('lib/game/api/auth.js', 'cpu: 100,'), eng(G + 'game.js', 'limit: runtimeData.user.cpu,')),
        ],
        see: ['mechanic:account-resources'],
    },
    'Game.cpu.unlock': {
        tasks: ['extend full cpu', 'use a cpu unlock item'],
        notes: [
            L('One call uses up one `{{CPU_UNLOCK}}` from `Game.resources` and adds 24 hours.', doc('Game.cpu.unlock')),
            L('When full CPU was off, the unlock can take up to 5 minutes to apply.', doc('Game.cpu.unlock')),
        ],
        pitfalls: [
            L('`Game.cpu.unlockedTime` is a clock time in milliseconds: compare it with `Date.now()`, not with `Game.time`.', doc('Game.cpu.unlock'), doc('Game.cpu.unlockedTime')),
            L(OFFICIAL_ONLY, NO_CPU_EXTRAS),
        ],
        constants: ['CPU_UNLOCK'],
        see: ['mechanic:account-resources', 'Game.cpu.unlocked', 'Game.cpu.unlockedTime', 'Game.resources'],
    },
    'Game.cpu.unlocked': {
        notes: [L('Official server only; undefined in the open engine.', NO_CPU_EXTRAS)],
        see: ['mechanic:account-resources', 'Game.cpu.unlock'],
    },
    'Game.cpu.unlockedTime': {
        notes: [
            L('Undefined when full CPU is not unlocked, and when it is unlocked by a subscription.', doc('Game.cpu.unlockedTime')),
            L('Official server only; undefined in the open engine.', NO_CPU_EXTRAS),
        ],
        see: ['mechanic:account-resources', 'mechanic:real-time', 'Game.cpu.unlock'],
    },
    'Game.cpu.generatePixel': {
        tasks: ['what is a pixel', 'how to make pixels'],
        notes: [
            L('With the Pixelization Deluxe upgrade the cost is 9,000 instead of {{PIXEL_CPU_COST}}.', doc('Game.cpu.generatePixel')),
            L('The pixel is added to `Game.resources` under `{{PIXEL}}` and can be sold on the market without a terminal.',
                doc('Game.resources'), eng(G + 'market.js', 'if(!_.contains(C.INTERSHARD_RESOURCES, resourceType) &&')),
        ],
        pitfalls: [L(OFFICIAL_ONLY, NO_CPU_EXTRAS)],
        constants: ['PIXEL'],
        see: ['mechanic:account-resources', 'Game.resources'],
    },
    'Game.cpu.setShardLimits': {
        tasks: ['split cpu between shards', 'move cpu to another shard'],
        notes: [
            L('The values must add up to the total of the current `Game.cpu.shardLimits`.', doc('Game.cpu.setShardLimits')),
        ],
        pitfalls: [
            L('After one call the next is refused with ERR_BUSY for 12 hours of real time: settle the split before you call.', doc('Game.cpu.setShardLimits')),
            L(OFFICIAL_ONLY, NO_CPU_EXTRAS),
        ],
        see: ['Game.cpu.shardLimits', 'mechanic:account-resources', 'mechanic:real-time'],
    },
    'Game.cpu.shardLimits': {
        notes: [L('Official server only; undefined in the open engine.', NO_CPU_EXTRAS)],
        see: ['Game.cpu.setShardLimits', 'mechanic:account-resources'],
    },
    'Game.cpu.getUsed': {
        see: ['mechanic:simulation'],
    },
    'Game.resources': {
        tasks: ['what is in Game.resources', 'how many cpu unlocks do I have'],
        notes: [
            L('The keys are the names in INTERSHARD_RESOURCES: `{{SUBSCRIPTION_TOKEN}}`, `{{CPU_UNLOCK}}`, `{{PIXEL}}`, `{{ACCESS_KEY}}`.', common('lib/constants.js', 'INTERSHARD_RESOURCES: [')),
            L('It is a copy made for the tick: writing to it changes nothing.', eng(G + 'game.js', 'resources: jsonParse(jsonStringify(runtimeData.user.resources||{})),')),
        ],
        constants: ['INTERSHARD_RESOURCES'],
        see: ['mechanic:account-resources', 'Game.cpu.unlock', 'Game.market.createOrder'],
    },
    'Game.market.createOrder': {
        notes: [
            L('For an account resource (one of INTERSHARD_RESOURCES) no terminal and no `roomName` are needed.',
                eng(G + 'market.js', 'if(!_.contains(C.INTERSHARD_RESOURCES, resourceType) &&'), doc('Game.market.createOrder')),
            L('An order is removed {{MARKET_ORDER_LIFE_TIME / 86400000}} days of real time after it was created.',
                eng('src/processor/global-intents/market.js', 'if(order.user && (nowTimestamp - order.createdTimestamp > C.MARKET_ORDER_LIFE_TIME)) {')),
        ],
        see: ['mechanic:account-resources', 'mechanic:real-time'],
    },
    'Game.market.deal': {
        notes: [
            L('A deal on an account resource takes no room and no terminal and pays no energy; selling needs the amount in `Game.resources`.',
                eng(G + 'market.js', 'if(_.contains(C.INTERSHARD_RESOURCES, order.resourceType)) {'),
                eng(G + 'market.js', 'if(order.type == C.ORDER_BUY && (runtimeData.user.resources[order.resourceType]||0) < amount) {')),
        ],
        see: ['mechanic:account-resources'],
    },

    // ---------------------------------------------------------------- shard
    'Game.shard.name': {
        notes: [L('On a private server it is the host name of the machine.', driver(DRIVER, 'value: "${os.hostname()}",'))],
    },
    'Game.shard.ptr': {
        tasks: ['is this shard the ptr'],
        notes: [L('The open private server sets it to false.', driver(DRIVER, 'value: false,'))],
        see: ['mechanic:ptr'],
    },
    'Game.shard.access': {
        notes: [L('Official server only: the open private server defines `name`, `type` and `ptr` and nothing else on `Game.shard`.', SHARD_OBJECT)],
        see: ['mechanic:account-resources', 'Game.shard.activateAccess'],
    },
    'Game.shard.accessTime': {
        notes: [L('A clock time in milliseconds: compare it with `Date.now()`.', doc('Game.shard.activateAccess'))],
        see: ['mechanic:account-resources', 'mechanic:real-time'],
    },
    'Game.shard.activateAccess': {
        tasks: ['use an access key', 'enter a restricted shard'],
        notes: [L('One call uses up one `{{ACCESS_KEY}}` from `Game.resources` and adds 30 days.', doc('Game.shard.activateAccess'))],
        pitfalls: [L('Official server only: the open private server defines `name`, `type` and `ptr` and nothing else on `Game.shard`, so there the call throws.', SHARD_OBJECT)],
        constants: ['ACCESS_KEY'],
        see: ['mechanic:account-resources', 'Game.shard.access', 'Game.resources'],
    },

    // ---------------------------------------------------------------- time
    'Game.time': {
        notes: [L('A tick counter, not a clock: how long a tick takes depends on the load of the servers.', article('game-loop#Additional-information'))],
        see: ['mechanic:real-time'],
    },
    'Game.map.getRoomStatus': {
        notes: [L('`timestamp` is a clock time in milliseconds, null when the status is permanent.', doc('Game.map.getRoomStatus'))],
        see: ['mechanic:real-time'],
    },

    // ---------------------------------------------------------------- notifications
    'Game.notify': {
        tasks: ['how many notifications per tick', 'send myself an email from code'],
        notes: [
            L('Returns OK, or ERR_FULL once 20 are queued in the tick.', eng(G + 'game.js', "if (intents.push('notify', {message, groupInterval}, 20)) {")),
            L('`groupInterval` is in minutes; the open private server holds it between 0 and 1,440.', doc('Game.notify'), driver(DRIVER, 'if (i.groupInterval > 1440) {')),
            L('Open private server: the same text queued again for the same send time is counted, not repeated.', driver(DRIVER, '$inc: {count: 1}')),
            L('Not available in the simulation room.', doc('Game.notify')),
        ],
        pitfalls: [
            L('The open private server stores only the first 500 characters of a message.', driver(DRIVER, 'var message = (""+i.message).substring(0,500);')),
        ],
        see: ['mechanic:notifications', 'Creep.notifyWhenAttacked'],
    },
    'Structure.notifyWhenAttacked': {
        notes: [
            L('It is on for every built structure.', eng(P + 'creeps/build.js', 'notifyWhenAttacked: true')),
            L('For a road, wall or container the message goes to the owner of the room controller. In a room whose controller belongs to someone else the call returns ERR_NOT_OWNER.',
                eng('src/utils.js', 'var user = target.user ? target.user : roomController ? roomController.user : null;'),
                eng(G + 'structures.js', 'if(this.my === false || (this.room.controller && this.room.controller.owner && !this.room.controller.my)) {')),
        ],
        see: ['mechanic:notifications', 'Game.notify'],
    },
    'Creep.notifyWhenAttacked': {
        notes: [
            L('It is on for every new creep. Hits by Invader and Source Keeper creeps send nothing either way.',
                eng(P + 'spawns/create-creep.js', 'notifyWhenAttacked: true'),
                eng(P + '_damage.js', "if(object.user != '2' && object.user != '3') {")),
        ],
        see: ['mechanic:notifications', 'Game.notify'],
    },
    'PowerCreep.notifyWhenAttacked': {
        see: ['mechanic:notifications'],
    },
};
