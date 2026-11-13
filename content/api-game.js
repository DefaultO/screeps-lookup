'use strict';
// Own text for Game, Game.cpu, Game.map, Game.market, Memory, RawMemory, InterShardMemory.
const { L, eng, backend, driver, doc, article, common } = require('./_h');
const GAME = 'src/game/game.js';
const MAP = 'src/game/map.js';
const MARKET = 'src/game/market.js';
const MARKETP = 'src/processor/global-intents/market.js';
const UTILS = 'src/utils.js';
const RT = 'lib/runtime/runtime.js';
const DATA = 'lib/runtime/data.js';
const MAKE = 'lib/runtime/make.js';
const STRINGIFY = 'data.userMemory.data = systemFunctions.JSON.stringify(rawMemory._parsed);';

module.exports = {
    Game: { summary: 'The global entry point: your creeps, rooms, spawns, structures, flags, the map, the market, CPU data and the current tick.', tasks: ['global game object'], see: ['Game.creeps', 'Game.rooms', 'Game.getObjectById'] },
    'Game.getObjectById': {
        summary: 'Get a live object by id, if it is in a room you can see this tick.',
        tasks: ['get an object by id', 'store a target between ticks', 'look up a creep or structure from memory'],
        pitfalls: [
            L('Returns null when the object is gone or its room is not visible. Objects from last tick are stale: store ids, not objects.',
                eng(GAME, 'return register._objects[id] || null;'),
                article('global-objects')),
        ],
        see: ['Game.creeps', 'Game.structures', 'mechanic:memory'],
    },
    'Game.notify': { summary: 'Send yourself an e-mail. Up to 20 per tick, each cut at 500 characters (the reference says 1000); groupInterval batches them.', tasks: ['send a notification', 'e-mail alert'], see: ['Structure.notifyWhenAttacked'] },
    'Game.time': { summary: 'The current tick number.', tasks: ['current tick', 'run code every N ticks'] },
    'Game.creeps': { summary: 'All your creeps by name, including those still spawning.', tasks: ['loop over my creeps', 'find a creep by name', 'count my creeps'], see: ['Creep.memory', 'Game.getObjectById'] },
    'Game.rooms': {
        summary: 'The rooms visible this tick, by name.', tasks: ['which rooms can I see', 'loop over my rooms', 'is a room visible'],
        notes: [
            L('Vision comes from your creeps, your structures and observers. Game.rooms[name] is undefined for a room you have nothing in.',
                driver(DATA, 'roomIdsHash[i.room] = true;'),
                driver(DATA, 'roomIdsHash[i.observeRoom] = true;'),
                driver(DATA, "if(i.type == 'flag' || i.type == 'constructionSite') {"),
                eng(GAME, 'game.rooms = _.clone(register.rooms);')),
        ],
        see: ['StructureObserver.observeRoom', 'Room.controller'],
    },
    'Game.spawns': { summary: 'All your spawns by name.', tasks: ['loop over my spawns', 'get a spawn by name'], see: ['StructureSpawn.spawnCreep'] },
    'Game.structures': { summary: 'All structures you own, by id. Roads, containers and walls are not in it.', tasks: ['loop over my structures'], see: ['Room.find', 'OwnedStructure.my'] },
    'Game.constructionSites': { summary: 'All your construction sites by id, in every room.', tasks: ['count my construction sites', 'list my construction sites'], constants: ['MAX_CONSTRUCTION_SITES'], see: ['Room.createConstructionSite'] },
    'Game.flags': { summary: 'All your flags by name.', tasks: ['loop over flags'], see: ['Flag'] },
    'Game.gcl': { summary: 'Global Control Level: {level, progress, progressTotal}. The level is the number of rooms you may own.', tasks: ['how many rooms can I claim', 'GCL progress'], constants: ['GCL_MULTIPLY', 'GCL_POW'], see: ['Creep.claimController', 'mechanic:controller'] },
    'Game.gpl': { summary: 'Global Power Level: {level, progress, progressTotal}. Each level is one point to create or upgrade power creeps.', tasks: ['GPL progress', 'how many power levels do I have'], constants: ['POWER_LEVEL_MULTIPLY', 'POWER_LEVEL_POW'], see: ['StructurePowerSpawn.processPower', 'PowerCreep.upgrade'] },
    'Game.resources': { summary: 'Account-level resources: pixels, CPU unlocks, access keys.', tasks: ['how many pixels do I have'], see: ['Game.cpu.generatePixel'] },
    'Game.shard': { summary: 'Name and type of the current shard.', tasks: ['which shard am I on'], see: ['InterShardMemory'] },

    // ---------------------------------------------------------------- CPU
    'Game.cpu': { summary: 'CPU numbers of this tick: limit, tickLimit, bucket, and getUsed().', tasks: ['cpu limit', 'cpu usage'], see: ['mechanic:cpu', 'Game.cpu.getUsed', 'Game.cpu.bucket'] },
    'Game.cpu.limit': { summary: 'Your CPU allowance per tick on this shard.', tasks: ['my cpu limit'], see: ['mechanic:cpu'] },
    'Game.cpu.tickLimit': {
        summary: 'CPU you may use in this tick: the limit plus what the bucket allows, at most 500.', tasks: ['how much cpu can I use this tick'],
        pitfalls: [
            L('Going over it stops the script in the middle of the tick: whatever code had not run yet does not run.',
                driver('lib/runtime/runtime-driver.js', 'options.timeout = timeout + 5;'),
                driver('lib/runtime/runtime-driver.js', "e.message = 'Script execution timed out: CPU time limit reached';"),
                article('cpu-limit')),
        ],
        see: ['Game.cpu.bucket', 'mechanic:cpu'],
    },
    'Game.cpu.bucket': { summary: 'Saved-up CPU, 0 to 10,000. Unused CPU goes in, overruns come out.', tasks: ['cpu bucket', 'how full is the bucket', 'when to skip expensive work'], see: ['Game.cpu.tickLimit', 'Game.cpu.generatePixel', 'mechanic:cpu'] },
    'Game.cpu.getUsed': {
        summary: 'CPU used so far in this tick, in milliseconds.',
        tasks: ['measure cpu', 'profile code', 'how much cpu did a function use'],
        notes: [
            L('The 0.2 CPU of an intent is added when the call returns OK, so a before/after difference includes it. In the simulation room it always returns 0.',
                driver(RT, 'return nowCpuTime() + intents.cpu - startTime;'),
                driver(RT, 'this.cpu += intentCpu;'),
                doc('Game.cpu.getUsed')),
        ],
        see: ['mechanic:cpu', 'Game.cpu.tickLimit'],
    },
    'Game.cpu.generatePixel': {
        summary: 'Turn {{PIXEL_CPU_COST}} bucket CPU into one pixel.', tasks: ['generate a pixel', 'use a full bucket'],
        pitfalls: [
            L('It empties the bucket; the next ticks have no reserve.',
                doc('Game.cpu.generatePixel'),
                driver('lib/index.js', 'cpuBucketSize: 10000,')),
        ],
        constants: ['PIXEL_CPU_COST'], see: ['Game.cpu.bucket'],
    },
    'Game.cpu.halt': {
        summary: 'Stop the script now and reset the global scope; the next tick starts fresh.', tasks: ['reset the global', 'restart the script'],
        pitfalls: [
            L('The tick ends at that call and its result is thrown away: the intents and Memory changes made in this tick are not saved, so calling it last does not help. The next tick pays for a full reload of your code.',
                driver('lib/runtime/user-vm.js', 'isolate.dispose();'),
                driver(MAKE, 'throw { error: "CPU halted" };'),
                eng('src/runner.js', 'if(runResult.intents) {')),
        ],
        see: ['mechanic:memory'],
    },
    'Game.cpu.getHeapStatistics': { summary: 'Heap size numbers of your isolate, to watch for memory pressure.', tasks: ['check heap usage', 'out of memory'], see: ['mechanic:cpu'] },
    'Game.cpu.setShardLimits': { summary: 'Split your CPU between shards. Once per 12 hours.', tasks: ['assign cpu to shards'] },
    'Game.cpu.unlock': { summary: 'Use a CPU unlock item to get full CPU for a day.', tasks: ['unlock full cpu'] },

    // ---------------------------------------------------------------- map
    'Game.map': { summary: 'World-level helpers that work without vision: exits, routes, distances, terrain, room status.', tasks: ['world map helpers'], see: ['Game.map.findRoute', 'Game.map.describeExits', 'Game.map.getRoomTerrain'] },
    'Game.map.describeExits': {
        summary: 'The neighbouring rooms of a room, keyed by direction ("1", "3", "5", "7").', tasks: ['neighbours of a room', 'which rooms are adjacent', 'exits of a room'],
        notes: [
            L('Works without vision. A missing key means that side has no exit.',
                eng(MAP, 'var gridItem = runtimeData.mapGrid.gridData['),
                eng(MAP, 'if(gridItem.t) {')),
        ],
        see: ['Game.map.findRoute', 'Room.findExitTo'],
    },
    'Game.map.findRoute': {
        summary: 'List of rooms to pass through from one room to another, with the exit to take in each.',
        tasks: ['route between rooms', 'how many rooms away is a room', 'avoid hostile rooms on the way', 'distance between rooms by path'],
        pitfalls: [
            L('High CPU cost: cache routes. It looks only at room exits, not at walls inside rooms. Use routeCallback to return Infinity for rooms to avoid.',
                doc('Game.map.findRoute'),
                eng(MAP, 'let exits = describeExits(fromRoomName);'),
                eng(MAP, 'if (cost === Infinity) {')),
        ],
        see: ['Game.map.findExit', 'PathFinder.search', 'Game.map.getRoomLinearDistance'],
    },
    'Game.map.findExit': { summary: 'The exit direction from one room toward another.', tasks: ['exit toward a room'], see: ['Game.map.findRoute', 'Room.findExitTo'] },
    'Game.map.getRoomLinearDistance': { summary: 'Straight-line distance between two rooms in rooms. With continuous = true it wraps around the world edge, as terminals do.', tasks: ['distance between two rooms', 'room distance for terminal cost', 'is a room in observer range'], see: ['Game.market.calcTransactionCost', 'Game.map.findRoute'] },
    'Game.map.getRoomTerrain': { summary: 'Terrain reader for any room, visible or not.', tasks: ['terrain of a room without vision', 'plan in a room I cannot see'], see: ['Room.getTerrain', 'Room.Terrain.get'] },
    'Game.map.getRoomStatus': { summary: 'Whether a room is normal, closed, novice or respawn area, and until when.', tasks: ['is a room available', 'is a room in a novice area', 'can I enter this room'], see: ['Game.map.describeExits'] },
    'Game.map.getWorldSize': { summary: 'Width of the world in rooms.', tasks: ['size of the world'] },

    // ---------------------------------------------------------------- market
    'Game.market': { summary: 'The market: your credits and orders, other players\' orders, deals and price history.', tasks: ['trade resources'], see: ['recipe:terminal-and-market', 'Game.market.deal', 'Game.market.createOrder'] },
    'Game.market.credits': { summary: 'Your credit balance.', tasks: ['how many credits do I have'] },
    'Game.market.orders': { summary: 'Your own orders, active and inactive, by id.', tasks: ['list my market orders'], see: ['Game.market.cancelOrder'] },
    'Game.market.calcTransactionCost': {
        summary: 'Energy fee to move an amount between two rooms by terminal.', tasks: ['terminal transfer cost', 'energy cost of a deal'],
        notes: [
            L('ceil(amount × (1 − e^(−distance/30))), distance being the linear room distance.',
                eng(UTILS, 'return Math.ceil(amount * (1 - Math.exp(-range / 30)))'),
                eng(MARKET, 'var distance = utils.calcRoomsDistance(roomName1, roomName2, true);')),
        ],
        see: ['StructureTerminal.send', 'Game.market.deal'],
    },
    'Game.market.createOrder': {
        summary: 'Place a buy or sell order for a resource at one of your terminals.',
        tasks: ['sell resources', 'buy resources', 'create a market order'],
        pitfalls: [
            L('A fee of {{MARKET_FEE * 100}}% of price × amount is charged in credits when the order is created.',
                eng(MARKETP, 'var fee = Math.ceil(intent.price * intent.totalAmount * C.MARKET_FEE);'),
                eng(MARKETP, "bulkUsers.inc(user, 'money', -fee);")),
            L('At most {{MARKET_MAX_ORDERS}} orders per player.',
                eng(MARKET, 'if(_.size(this.orders) + ordersCreatedDuringTick >= C.MARKET_MAX_ORDERS) {')),
            L('A sell order only fills while the terminal actually holds the resource; a buy order only while you have the credits.',
                eng(MARKETP, 'terminal && terminal.user == order.user ? terminal.store[order.resourceType] || 0 : 0;'),
                eng(MARKETP, 'var newAmount = Math.min(Math.floor(userMoney / order.price), order.remainingAmount);'),
                eng(MARKETP, 'var newActive = isOwner && newAmount > 0;')),
        ],
        constants: ['MARKET_FEE', 'MARKET_MAX_ORDERS', 'ORDER_SELL', 'ORDER_BUY', 'MARKET_ORDER_LIFE_TIME'],
        see: ['Game.market.deal', 'Game.market.extendOrder', 'Game.market.changeOrderPrice', 'recipe:terminal-and-market'],
    },
    'Game.market.deal': {
        summary: 'Trade against another player\'s order from one of your terminals.',
        tasks: ['buy from the market', 'sell to a buy order', 'execute a deal'],
        pitfalls: [
            L('Your terminal pays the energy transfer fee, whichever side you are on.',
                eng(MARKETP, 'if(executeTransfer(seller, buyer, order.resourceType, amount, targetTerminal, {order: {'),
                eng(MARKET, 'if(!terminal.store || terminal.store[C.RESOURCE_ENERGY] < transferCost) {')),
            L('At most 10 deals per tick (ERR_FULL), and the terminal used goes on cooldown ({{TERMINAL_COOLDOWN}} ticks).',
                eng(MARKET, "if(!intents.pushByName('global', 'deal', {orderId, targetRoomName, amount}, 10)) {"),
                eng(MARKETP, 'bulkObjects.update(targetTerminal, {cooldownTime: gameTime + cooldown});')),
            L('The deal runs after the tick. If someone else took the order first, less or nothing is traded.',
                eng(MARKETP, 'var amount = Math.min(deal.amount, order.remainingAmount);'),
                eng(MARKETP, 'terminalDeals.sort(')),
        ],
        constants: ['TERMINAL_COOLDOWN'],
        see: ['Game.market.getAllOrders', 'Game.market.calcTransactionCost', 'recipe:terminal-and-market'],
    },
    'Game.market.getAllOrders': {
        summary: 'All active orders on the market, optionally filtered.', tasks: ['find the best price', 'list sell orders for a resource'],
        pitfalls: [
            L('High CPU cost. Pass a plain filter object such as {type: ORDER_SELL, resourceType: RESOURCE_ENERGY}; it is much faster than a function.',
                doc('Game.market.getAllOrders'),
                eng(MARKET, 'var orders = _getOrders(filter && filter.resourceType);')),
        ],
        see: ['Game.market.deal', 'Game.market.getHistory'],
    },
    'Game.market.getHistory': { summary: 'Daily price statistics of the last 14 days for a resource.', tasks: ['average market price', 'price history'], see: ['Game.market.getAllOrders'] },
    'Game.market.getOrderById': { summary: 'One order by id.', tasks: ['check an order'], see: ['Game.market.deal'] },
    'Game.market.cancelOrder': { summary: 'Cancel one of your orders. The 5% fee is not returned.', tasks: ['cancel a market order'], see: ['Game.market.orders'] },
    'Game.market.changeOrderPrice': { summary: 'Change the price of your order. Raising it charges the fee on the difference.', tasks: ['change an order price'], see: ['Game.market.createOrder'] },
    'Game.market.extendOrder': { summary: 'Add amount to your order, paying the fee for the added part.', tasks: ['add to an order'], see: ['Game.market.createOrder'] },

    // ---------------------------------------------------------------- memory
    Memory: {
        summary: 'A global object saved between ticks as JSON. Limit 2 MB.',
        tasks: ['store data between ticks', 'persistent memory', 'how big can Memory be'],
        pitfalls: [
            L('It is parsed from JSON on first access in each tick, and that parse is charged to your CPU. Large Memory costs CPU every tick.',
                eng(GAME, 'runCodeCache[userId].memory._parsed = JSON.parse(runCodeCache[userId].memory.get() || "{}");'),
                article('global-objects')),
            L('Only plain data survives: no live objects, functions or undefined.',
                driver(RT, STRINGIFY),
                article('global-objects')),
            L('Memory.creeps entries of dead creeps stay until you delete them.',
                eng('src/game/creeps.js', 'return globals.Memory.creeps[this.name] = globals.Memory.creeps[this.name] || {};'),
                driver(RT, STRINGIFY)),
        ],
        see: ['RawMemory', 'RawMemory.segments', 'mechanic:memory'],
    },
    RawMemory: { summary: 'Direct access to the Memory string and to memory segments: 100 segments of 100 KB each.', tasks: ['own serializer for memory', 'more memory than 2 MB'], see: ['RawMemory.segments', 'RawMemory.setActiveSegments', 'mechanic:memory'] },
    'RawMemory.get': { summary: 'The raw Memory string as stored.', tasks: ['read raw memory'], see: ['RawMemory.set'] },
    'RawMemory.set': {
        summary: 'Replace the stored Memory string.', tasks: ['write raw memory', 'custom memory serialization'],
        pitfalls: [
            L('Do not mix it with the Memory object in one tick: decide per tick whether the string or the object is the source.',
                driver(RT, 'delete this._parsed;'),
                driver(RT, STRINGIFY)),
        ],
        see: ['RawMemory.get', 'Memory'],
    },
    'RawMemory.segments': {
        summary: 'The segments active this tick, by id, as strings. Assign a string to write one.',
        tasks: ['read a memory segment', 'write a memory segment', 'store large data'],
        pitfalls: [
            L('Only the segments requested with setActiveSegments in the previous tick are present.',
                driver(MAKE, '$set.activeSegments = runResult.activeSegments;'),
                driver(DATA, 'env.hmget(env.keys.MEMORY_SEGMENTS+userId, result[0].activeSegments) :')),
            L('Each segment holds at most 100 KB. Segments are saved at the end of the tick.',
                driver(RT, 'if (rawMemory.segments[segmentKeys[i]].length > 100 * 1024) {'),
                driver(RT, 'outMessage.memorySegments[key] = "" + rawMemory.segments[segmentKeys[i]];')),
        ],
        see: ['RawMemory.setActiveSegments', 'mechanic:memory'],
    },
    'RawMemory.setActiveSegments': {
        summary: 'Choose which segments (ids 0–99) are loaded in the next tick.',
        tasks: ['how many memory segments can be active', 'load a memory segment', 'request segments'],
        pitfalls: [
            L('At most 10 segments can be active at a time.',
                driver(RT, 'if (ids.length > 10) {')),
            L('It takes effect next tick, and each call replaces the previous list.',
                driver(RT, 'activeSegments = [];'),
                driver(MAKE, '$set.activeSegments = runResult.activeSegments;')),
        ],
        see: ['RawMemory.segments', 'mechanic:memory'],
    },
    'RawMemory.foreignSegment': { summary: 'A public segment of another player, loaded after setActiveForeignSegment: {username, id, data}.', tasks: ['read another player\'s segment', 'ally communication'], see: ['RawMemory.setActiveForeignSegment', 'RawMemory.setPublicSegments'] },
    'RawMemory.setActiveForeignSegment': { summary: 'Ask for one public segment of another player for the next tick. One at a time; null clears it.', tasks: ['request an ally\'s segment'], see: ['RawMemory.foreignSegment', 'RawMemory.setPublicSegments'] },
    'RawMemory.setPublicSegments': { summary: 'Mark which of your segments other players may read.', tasks: ['publish a segment for allies', 'make a segment public'], see: ['RawMemory.setDefaultPublicSegment', 'RawMemory.foreignSegment'] },
    'RawMemory.setDefaultPublicSegment': { summary: 'The public segment others get when they ask without an id.', tasks: ['default public segment'], see: ['RawMemory.setPublicSegments'] },
    InterShardMemory: { summary: 'One string of up to 100 KB per shard that your code on other shards can read.', tasks: ['share data between shards'], see: ['InterShardMemory.setLocal', 'InterShardMemory.getRemote'] },
    'InterShardMemory.setLocal': { summary: 'Write this shard\'s string.', tasks: ['write inter-shard data'], see: ['InterShardMemory.getRemote'] },
    'InterShardMemory.getRemote': { summary: 'Read the string another shard wrote.', tasks: ['read data from another shard'], see: ['InterShardMemory.setLocal'] },
};
