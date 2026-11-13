'use strict';
// Runtime pack: Game, Game.cpu, Game.map, Game.map.visual, Game.shard, InterShardMemory, Memory, RawMemory,
// Room, Room.Terrain, RoomPosition, RoomVisual, PathFinder, PathFinder.CostMatrix, Flag, RoomObject.
// Summaries only for members that had none; everything else adds notes and pitfalls with their source.
const { L, eng, driver, doc, article } = require('../../_h');

const G = 'src/game/';
const RT = 'lib/runtime/';

module.exports = {
    // ---------------------------------------------------------------- Game
    Game: {
        notes: [
            L('Built new at the start of every tick. Anything you write on Game or on a game object is gone next tick.', eng(G + 'game.js', 'runCodeCache[userId].globals.Game = makeGameObject(runCodeCache[userId]);'), article('global-objects')),
        ],
        see: ['mechanic:visibility', 'mechanic:code-execution'],
    },
    'Game.getObjectById': {
        notes: [
            L('A lookup in a table filled when the tick starts: cheap, no search.', eng(G + 'game.js', 'return register._objects[id] || null;')),
            L('Your own construction sites are returned even in rooms you cannot see.', eng(G + 'game.js', 'register._objects[i] = new globals.ConstructionSite(i);'), driver(RT + 'data.js', 'roomObjects: _.extend(driver.mapById(result[6]), userObjects),')),
        ],
        see: ['mechanic:visibility'],
    },
    'Game.notify': {
        pitfalls: [
            L('Every call costs 0.2 CPU like an intent. The 21st call in a tick returns ERR_FULL.', eng(G + 'game.js', "if (intents.push('notify', {message, groupInterval}, 20)) {"), driver(RT + 'runtime.js', 'push(name, data, maxLen) {')),
            L('The public driver stores only the first 500 characters of a message.', driver('lib/index.js', 'var message = (""+i.message).substring(0,500);')),
        ],
        notes: [
            L('groupInterval is in minutes and is cut to 0 to 1440.', driver('lib/index.js', 'if (i.groupInterval > 1440) {')),
            L('Equal messages that fall into the same interval become one notification with a counter.', driver('lib/index.js', '$inc: {count: 1}')),
        ],
        see: ['mechanic:intents'],
    },
    'Game.time': {
        notes: [L('Goes up by one when all scripts and all rooms of the tick are done.', eng('src/main.js', 'return driver.incrementGameTime()'))],
        see: ['mechanic:tick-order'],
    },
    'Game.rooms': {
        notes: [
            L('A room is listed when you own an object in it other than a flag or a construction site, or when one of your observers was pointed at it last tick.', driver(RT + 'data.js', "if(i.type == 'flag' || i.type == 'constructionSite') {"), driver(RT + 'data.js', 'roomIdsHash[i.observeRoom] = true;')),
        ],
        see: ['mechanic:visibility'],
    },
    'Game.flags': {
        notes: [
            L('Holds your flags in every room, visible or not.', driver(RT + 'data.js', "db['rooms.flags'].find({user: userId}),"), eng(G + 'game.js', 'game.flags[info[0]] = flag;')),
            L('A flag made with createFlag is in Game.flags at once, in the same tick.', eng(G + 'rooms.js', 'globals.Game.flags[name] = new globals.Flag(name, color, secondaryColor, roomName, x, y);')),
        ],
        see: ['mechanic:visibility'],
    },
    'Game.constructionSites': {
        notes: [
            L('Includes your sites in rooms without vision; their room property is undefined there.', eng(G + 'game.js', 'game.constructionSites[register._objects[i].id] = register._objects[i];')),
        ],
        see: ['mechanic:visibility'],
    },
    'Game.powerCreeps': {
        summary: 'All your power creeps by name, including those that are not spawned in any room.',
        tasks: ['loop over my power creeps', 'find a power creep by name', 'list my power creeps'],
        notes: [
            L('Filled from the power creep list of your account, not from room objects, so an unspawned one is in it too.', eng(G + 'game.js', 'game.powerCreeps[register.powerCreeps[i].name] = register.powerCreeps[i];'), doc('Game.powerCreeps')),
        ],
        see: ['PowerCreep', 'recipe:power'],
    },

    // ---------------------------------------------------------------- Game.cpu
    'Game.cpu': { see: ['recipe:measure-cpu', 'recipe:save-cpu', 'mechanic:code-execution'] },
    'Game.cpu.tickLimit': {
        notes: [
            L('tickLimit = limit + bucket, capped at 500. With a bucket of 100 and a limit of 20 it is 120.', driver(RT + 'data.js', 'cpu = cpuBucket + result[0].cpu;'), driver('lib/index.js', 'cpuMaxPerTick: 500,')),
            L('The stop comes as the error "Script execution timed out: CPU time limit reached".', driver(RT + 'runtime-driver.js', "e.message = 'Script execution timed out: CPU time limit reached';")),
            L('Intents queued before the stop are still carried out, and Memory is still saved with the changes made so far.', driver(RT + 'runtime.js', 'outMessage.intentsList = intents.list;'), driver(RT + 'runtime.js', 'data.userMemory.data = systemFunctions.JSON.stringify(rawMemory._parsed);')),
        ],
        see: ['mechanic:intents'],
    },
    'Game.cpu.bucket': {
        notes: [
            L('After each tick: bucket + limit − CPU used, capped at 10,000. CPU used is rounded up to a whole number, so every tick costs at least 1.', driver(RT + 'make.js', 'var newCpuAvailable = userData.user.cpuAvailable + userData.user.cpu - cpuUsed;'), driver(RT + 'make.js', 'const cpuUsed = Math.ceil(runResult.usedCleanTime+intentsCpu);'), driver('lib/index.js', 'cpuBucketSize: 10000,')),
        ],
        pitfalls: [
            L('An overrun can push the bucket below 0. The script is then not run at all ("CPU bucket is empty"); each skipped tick adds the limit back.', driver(RT + 'make.js', "error: 'Script execution has been terminated: CPU bucket is empty'"), driver(RT + 'make.js', 'cpuAvailable: user.cpuAvailable < -user.cpu * 2 ? -user.cpu * 2 : user.cpuAvailable + user.cpu')),
        ],
        see: ['recipe:save-cpu'],
    },
    'Game.cpu.shardLimits': {
        summary: 'Your CPU limit on each shard, keyed by shard name. Change the split with Game.cpu.setShardLimits.',
        tasks: ['cpu limit per shard', 'how is my cpu split between shards'],
        see: ['Game.cpu.setShardLimits', 'Game.cpu.limit'],
    },
    'Game.cpu.unlocked': {
        summary: 'True while full CPU is unlocked for your account.',
        tasks: ['is my cpu unlocked'],
        see: ['Game.cpu.unlock', 'Game.cpu.unlockedTime'],
    },
    'Game.cpu.unlockedTime': {
        summary: 'Time in milliseconds since the UNIX epoch until which full CPU stays unlocked. Undefined when it is not unlocked, or unlocked by a subscription.',
        tasks: ['when does my cpu unlock end'],
        see: ['Game.cpu.unlock', 'Game.cpu.unlocked'],
    },
    'Game.cpu.getUsed': {
        notes: [
            L('It is the CPU time of your isolate since your loop was called, plus 0.2 for every intent queued so far.', driver(RT + 'runtime.js', 'return nowCpuTime() + intents.cpu - startTime;')),
            L('The clock starts when the loop is called: building the Game object before that is not counted.', driver(RT + 'runtime.js', 'startTime = nowCpuTime();')),
        ],
        pitfalls: [
            L('Memory is turned back into a string after the loop and that time is charged too. No getUsed() call can see it.', driver(RT + 'runtime.js', 'outMessage.usedCleanTime = nowCpuTime() - startTime;')),
        ],
        see: ['recipe:measure-cpu'],
    },
    'Game.cpu.halt': {
        pitfalls: [
            L('The whole tick is thrown away: intents already queued are not carried out and changes to Memory and segments are not saved.', driver(RT + 'make.js', 'throw { error: "CPU halted" };'), eng('src/runner.js', 'if(runResult.intents) {')),
        ],
        notes: [
            L('It destroys your isolate; the next tick gets a new one and loads all modules again.', driver(RT + 'user-vm.js', 'vm.didHaltByUserRequest = true;')),
        ],
        see: ['mechanic:code-execution'],
    },
    'Game.cpu.getHeapStatistics': {
        notes: [
            L('The isolate is created with a memory limit of 256 MB plus the size of the world terrain data.', driver(RT + 'user-vm.js', 'memoryLimit: 256 + staticTerrainDataSize/1024/1024')),
            L('externally_allocated_size (large ArrayBuffers) counts against the limit as well.', doc('Game.cpu.getHeapStatistics')),
        ],
        pitfalls: [
            L('When the heap is full the isolate is destroyed: the tick is lost and the global scope starts empty.', driver(RT + 'make.js', 'Isolate has exhausted v8 heap space')),
        ],
        see: ['mechanic:code-execution'],
    },

    // ---------------------------------------------------------------- Game.map
    'Game.map': { see: ['mechanic:visibility', 'recipe:travel-across-rooms'] },
    'Game.map.describeExits': {
        notes: [
            L('Returns null for a string that is not a room name and for a room that is not open.', eng(G + 'map.js', 'if(!gridItem) {'), driver(RT + 'mapgrid.js', 'for (let roomName of accessibleRooms) {')),
            L('A side is listed when the room edge on that side has at least one open tile.', driver(RT + 'mapgrid.js', 'if (terrain[cury * 50 + curx] == 0) {')),
            L('The table behind it is built once per isolate; rooms opened later show up after the next global reset.', driver(RT + 'runtime.js', 'if(!mapGrid) {')),
        ],
    },
    'Game.map.findExit': {
        notes: [
            L('It runs a complete findRoute and returns the exit of the first step.', eng(G + 'map.js', 'var route = this.findRoute(fromRoom, toRoom, opts);')),
            L('ERR_NO_PATH when there is no route, ERR_INVALID_ARGS when both rooms are the same.', eng(G + 'map.js', 'return C.ERR_INVALID_ARGS;')),
        ],
        see: ['mechanic:pathfinding'],
    },
    'Game.map.findRoute': {
        pitfalls: [
            L('Without a route it returns ERR_NO_PATH, a number and not an array. Test the result before using .length or a loop.', eng(G + 'map.js', 'return C.ERR_NO_PATH;'), eng(G + 'map.js', 'if(!_.isArray(route)) {')),
            L('It never looks further than 30 rooms from the start room in any direction.', eng(G + 'map.js', 'const kRouteGrid = 30;'), eng(G + 'map.js', 'if (ox < 0 || ox >= kRouteGrid * 2 || oy < 0 || oy >= kRouteGrid * 2) {')),
        ],
        notes: [
            L('Each step is {exit, room}: the FIND_EXIT_* constant to leave the current room through, and the room you then enter.', eng(G + 'map.js', 'room: utils.getRoomNameFromXY(xx, yy),')),
            L('routeCallback(roomName, fromRoomName) gives the cost of entering roomName. Default 1; Infinity blocks the room; 0 or no return value counts as 1.', eng(G + 'map.js', 'let cost = Number(routeCallback(roomName, fromRoomName)) || 1;')),
            L('The same room for start and end gives an empty array.', eng(G + 'map.js', 'if(fromRoom == toRoom) {')),
        ],
        see: ['mechanic:pathfinding', 'recipe:travel-across-rooms'],
    },
    'Game.map.getRoomTerrain': {
        pitfalls: [L('Throws "Could not access room" for a room that does not exist.', eng(G + 'rooms.js', 'throw new Error(`Could not access room ${roomName}`);'))],
    },
    'Game.map.getRoomStatus': {
        notes: [
            L('Returns {status, timestamp}. status is "normal", "closed", "novice" or "respawn"; timestamp is the UNIX time in milliseconds when it ends, or null.', eng(G + 'map.js', "return { status: 'novice', timestamp: runtimeData.roomStatusData.novice[roomName] };"), eng(G + 'map.js', "return { status: 'normal', timestamp: null };")),
            L('Returns undefined for a string that is not a room name.', eng(G + 'map.js', 'return undefined;')),
            L('The server refreshes the status data about once a minute, not every tick.', driver(RT + 'data.js', 'roomStatusDataCache.expireTimestamp = Date.now() + 60*1000;')),
        ],
    },

    // ---------------------------------------------------------------- Game.map.visual
    'Game.map.visual': {
        pitfalls: [
            L('Going over the limit throws an error at the drawing call.', eng(G + 'console.js', 'throw new Error( `MapVisual size has exceeded ${sizeLimit} KB limit`);')),
        ],
        notes: [
            L('Drawings last one tick and only you see them. Draw again every tick, or keep the export string and import it.', doc('Game.map.visual')),
        ],
        see: ['Game.map.visual.export', 'RoomVisual'],
    },
    'Game.map.visual.line': {
        summary: 'Draw a line between two positions on the world map.',
        tasks: ['draw a line on the world map', 'show a route on the map'],
        pitfalls: [L('Both ends must be RoomPosition objects; anything else throws.', eng(G + 'map.js', "throw new Error('Invalid pos1, RoomPosition expected')"))],
        see: ['Game.map.visual.poly', 'RoomVisual.line'],
    },
    'Game.map.visual.circle': {
        summary: 'Draw a circle around a position on the world map.',
        tasks: ['mark a room on the world map', 'draw a circle on the map'],
        pitfalls: [L('The centre must be a RoomPosition: pass creep.pos, not the creep.', eng(G + 'map.js', "throw new Error('Invalid pos, RoomPosition expected')"))],
        notes: [L('Sizes are in tiles and a room is 50 tiles wide: a radius of 50 reaches one room far.', doc('Game.map.visual.circle'))],
        see: ['RoomVisual.circle'],
    },
    'Game.map.visual.rect': {
        summary: 'Draw a rectangle on the world map; the position is its top-left corner, width and height are in tiles.',
        tasks: ['draw a rectangle on the world map', 'highlight a room on the map'],
        see: ['RoomVisual.rect'],
    },
    'Game.map.visual.poly': {
        summary: 'Draw a line through a list of positions on the world map.',
        tasks: ['draw a path on the world map', 'show a creep route across rooms'],
        notes: [L('The list may hold positions or objects that have pos. An empty list draws nothing.', eng(G + 'map.js', 'const p = i.pos || i;'))],
        see: ['PathFinder.search', 'RoomVisual.poly'],
    },
    'Game.map.visual.text': {
        summary: 'Write text at a position on the world map.',
        tasks: ['label a room on the world map', 'show text on the map'],
        pitfalls: [L('The argument order is (text, pos, style), and pos must be a RoomPosition.', eng(G + 'map.js', "throw new Error('Invalid pos , RoomPosition expected')"))],
        see: ['RoomVisual.text'],
    },
    'Game.map.visual.clear': {
        summary: 'Remove everything drawn on the world map in this tick.',
        tasks: ['clear map visuals'],
        notes: [L('It empties the buffer of the current tick, so getSize() is 0 again.', eng(G + 'console.js', 'visual[id][roomName] = "";'))],
    },
    'Game.map.visual.getSize': {
        summary: 'Size of the map visuals added in this tick, to compare with the limit of 1000 KB.',
        tasks: ['how much map visual data did I use', 'map visual size limit'],
        notes: [L('It is the length of the stored string; the limit is 1000 × 1024.', eng(G + 'console.js', 'const sizeLimit = roomName == "map" ? 1000 : 500;'), eng(G + 'console.js', 'return visual[id][roomName].length;'))],
    },
    'Game.map.visual.export': {
        summary: 'All map visuals of this tick as one string, to store and draw again in a later tick.',
        tasks: ['save map visuals', 'keep map drawings between ticks'],
        notes: [L('Returns undefined when nothing was drawn on the map this tick.', eng(G + 'console.js', 'return visual[id][roomName || ""];'))],
        see: ['Game.map.visual.import'],
    },
    'Game.map.visual.import': {
        summary: 'Add map visuals from a string made by export to this tick.',
        tasks: ['restore saved map visuals', 'redraw map visuals without rebuilding them'],
        notes: [L('The string is added to what is already drawn; the size limit applies to the sum.', eng(G + 'console.js', 'visual[id][roomName] += dataString;'))],
        see: ['Game.map.visual.export'],
    },

    // ---------------------------------------------------------------- Game.shard
    'Game.shard': {
        notes: [
            L('The public server code sets name to the host name of the machine, type to "normal" and ptr to false.', driver('lib/index.js', 'value: "${os.hostname()}",')),
        ],
    },
    'Game.shard.name': {
        summary: 'Name of the shard this script runs on.',
        tasks: ['name of the current shard', 'which shard is my code running on'],
        see: ['InterShardMemory.getRemote', 'Game.cpu.shardLimits'],
    },
    'Game.shard.type': { summary: 'Type of the shard; always "normal" at present.', tasks: ['shard type'] },
    'Game.shard.ptr': {
        summary: 'True when this shard belongs to the public test realm.',
        tasks: ['am I on the test server', 'detect the PTR in code'],
    },
    'Game.shard.access': {
        summary: 'Whether you may act on this shard right now. Always true on shards without restriction; a restricted shard needs an active access key or a subscription.',
        tasks: ['do I have access to this shard', 'restricted shard access'],
        see: ['Game.shard.activateAccess', 'Game.shard.accessTime'],
    },
    'Game.shard.accessTime': {
        summary: 'Time in milliseconds since the UNIX epoch until which your access to this restricted shard lasts. Undefined when access is unlimited or not active.',
        tasks: ['when does my shard access end'],
        see: ['Game.shard.activateAccess'],
    },
    'Game.shard.activateAccess': {
        summary: 'Spend one access key from your account to get 30 more days on this restricted shard.',
        tasks: ['extend access to a restricted shard', 'use an access key'],
        notes: [L('Without access, claimController, reserveController and upgradeController return ERR_ACCESS_DENIED.', eng(G + 'creeps.js', 'if(runtimeData.user.shardAccess === false) {'))],
        see: ['Game.shard.access', 'Game.resources'],
    },

    // ---------------------------------------------------------------- InterShardMemory
    InterShardMemory: {
        notes: [L('A shard writes only its own string; the strings of the other shards are read-only. Nothing in it is shared with Memory.', doc('InterShardMemory'))],
        see: ['InterShardMemory.getLocal', 'Game.shard.name', 'mechanic:memory'],
    },
    'InterShardMemory.getLocal': {
        tasks: ['read back my own inter-shard data', 'read the inter-shard memory of this shard'],
        see: ['InterShardMemory.setLocal'],
    },

    // ---------------------------------------------------------------- Memory
    Memory: {
        pitfalls: [
            L('Memory has no prototype, so Memory.hasOwnProperty does not exist. Use `key in Memory` or Object.keys(Memory).', eng(G + 'game.js', 'runCodeCache[userId].memory._parsed.__proto__ = null;')),
            L('If the stored string is not valid JSON, Memory is null for the tick and any Memory.x throws.', eng(G + 'game.js', 'runCodeCache[userId].memory._parsed = null;')),
            L('Above the limit (2 × 1024 × 1024 characters of JSON) the save is refused and the stored Memory stays as it was.', driver('lib/index.js', "return q.reject('Script execution has been terminated: memory allocation limit reached');")),
        ],
        notes: [
            L('A tick that never touches Memory pays neither the parse nor the save.', driver(RT + 'runtime.js', 'if (rawMemory._parsed) {')),
            L('creep.memory, room.memory, flag.memory and spawn.memory read Memory, and so does moveTo, which stores its path in creep memory.', eng(G + 'creeps.js', 'return globals.Memory.creeps[this.name] = globals.Memory.creeps[this.name] || {};'), eng(G + 'creeps.js', 'this.memory._move = {')),
            L('Saved also when the script throws or is stopped for CPU, with the changes made up to that point.', driver(RT + 'runtime.js', "outMessage.type = 'error';"), driver(RT + 'runtime.js', 'outMessage.memory = data.userMemory;')),
        ],
        see: ['recipe:cache-between-ticks', 'mechanic:code-execution'],
    },

    // ---------------------------------------------------------------- RawMemory
    RawMemory: { see: ['recipe:share-data-with-an-ally', 'recipe:cache-between-ticks'] },
    'RawMemory.get': {
        notes: [L('Gives the string as it was loaded at the start of the tick, or the one passed to set() this tick. Changes made through the Memory object are not in it.', driver(RT + 'runtime.js', 'return data.userMemory.data;'))],
    },
    'RawMemory.set': {
        pitfalls: [
            L('Throws when the value is not a string or is longer than 2 × 1024 × 1024 characters.', driver(RT + 'runtime.js', "throw new Error('Raw memory length exceeded 2 MB limit');")),
            L('set() drops the parsed Memory object: what you changed on Memory before the call is not saved.', driver(RT + 'runtime.js', 'delete this._parsed;')),
            L('If Memory is read for the first time after set(), it is parsed from the new string and written back after the loop, replacing what set() stored.', eng(G + 'game.js', 'runCodeCache[userId].memory._parsed = JSON.parse(runCodeCache[userId].memory.get() || "{}");')),
        ],
    },
    'RawMemory.segments': {
        pitfalls: [
            L('A segment over 100 × 1024 characters, a value that is not a string, or more than 10 keys makes the end of the tick fail. Nothing of that tick is saved then: no intents, no Memory, no segments.', driver(RT + 'runtime.js', 'throw `Memory segment #${segmentKeys[i]} has exceeded 100 KB length limit`;'), driver(RT + 'runtime.js', "throw 'Cannot save more than 10 memory segments on the same tick';"), driver(RT + 'make.js', 'throw {error: error.stack || error};')),
        ],
        notes: [
            L('Every key present at the end of the tick is saved, loaded or not: you can write a segment without requesting it first.', driver(RT + 'runtime.js', 'var segmentKeys = Object.keys(rawMemory.segments);')),
            L('A requested segment that was never written arrives as an empty string.', driver(RT + 'data.js', 'runtimeData.memorySegments[runtimeData.user.activeSegments[i]] = result[4][i] || "";')),
        ],
        see: ['recipe:share-data-with-an-ally'],
    },
    'RawMemory.setActiveSegments': {
        pitfalls: [
            L('Throws for a value that is not an array, for more than 10 ids and for an id outside 0 to 99.', driver(RT + 'runtime.js', "throw new Error('Only 10 memory segments can be active at the same time');")),
        ],
        notes: [
            L('The list is stored with your account: the same segments are loaded every tick until you call it again. An empty array unloads all.', driver(RT + 'make.js', '$set.activeSegments = runResult.activeSegments;'), driver(RT + 'data.js', 'result[0].activeSegments && result[0].activeSegments.length > 0 ?')),
        ],
    },
    'RawMemory.foreignSegment': {
        pitfalls: [
            L('Segment 0 of another player never arrives: the loader skips an id of 0.', driver(RT + 'data.js', 'result[0].activeForeignSegment && result[0].activeForeignSegment.user_id && result[0].activeForeignSegment.id ?')),
        ],
        notes: [
            L('Undefined unless the owner has that id in the public list at the moment your tick is loaded.', driver(RT + 'data.js', "if(result[5] && result[5][1] && result[5][1].split(',').indexOf(\"\"+runtimeData.user.activeForeignSegment.id) != -1) {")),
        ],
        see: ['recipe:share-data-with-an-ally'],
    },
    'RawMemory.setActiveForeignSegment': {
        tasks: ["read another player's memory segment", 'load the public segment of an ally'],
        notes: [
            L('The request is stored with your account and stays active every tick until you change it or pass null.', driver(RT + 'make.js', 'activeForeignSegment: runResult.activeForeignSegment')),
            L('Without an id the owner\'s default public segment is taken. A default of 0 is not used.', driver(RT + 'make.js', 'if(!runResult.activeForeignSegment.id && user.defaultPublicSegment) {')),
        ],
        see: ['recipe:share-data-with-an-ally'],
    },
    'RawMemory.setPublicSegments': {
        pitfalls: [
            L('An empty list is not stored by the public driver: setPublicSegments([]) leaves the old list in force. To take a segment back, publish another id or blank its content.', driver(RT + 'runtime.js', "outMessage.publicSegments = publicSegments.join(',');"), driver(RT + 'make.js', 'if(runResult.publicSegments) {')),
            L('Any player who knows your name can read a public segment, not only allies.', driver(RT + 'data.js', 'env.get(env.keys.PUBLIC_MEMORY_SEGMENTS+result[0].activeForeignSegment.user_id)')),
        ],
        notes: [
            L('The list replaces the earlier one and stays until changed; one call is enough.', driver(RT + 'make.js', 'env.set(env.keys.PUBLIC_MEMORY_SEGMENTS+userData.user._id, runResult.publicSegments);')),
        ],
        see: ['recipe:share-data-with-an-ally'],
    },
    'RawMemory.setDefaultPublicSegment': {
        pitfalls: [
            L('The default id must also be in the setPublicSegments list, or readers get nothing.', driver(RT + 'data.js', "if(result[5] && result[5][1] && result[5][1].split(',').indexOf(\"\"+runtimeData.user.activeForeignSegment.id) != -1) {")),
            L('Do not use id 0 as the default: a reader that asks without an id does not get it.', driver(RT + 'make.js', 'if(!runResult.activeForeignSegment.id && user.defaultPublicSegment) {')),
        ],
        notes: [L('null removes the default.', driver(RT + 'runtime.js', 'defaultPublicSegment = id;'))],
        see: ['recipe:share-data-with-an-ally'],
    },

    // ---------------------------------------------------------------- Room
    Room: { see: ['mechanic:visibility', 'mechanic:finding-and-looking'] },
    'Room.name': {
        summary: 'The name of the room, such as "E12S7": the key in Game.rooms and in Memory.rooms. Read-only.',
        tasks: ['name of a room', 'get the room name'],
        see: ['Game.rooms', 'Room.memory'],
    },
    'Room.memory': {
        pitfalls: [L('Reading room.memory creates Memory.rooms[name] = {} when it is missing. Reading it for every visible room fills Memory with empty entries.', eng(G + 'rooms.js', 'return globals.Memory.rooms[this.name] = globals.Memory.rooms[this.name] || {};'))],
    },
    'Room.energyAvailable': {
        notes: [L('Only your own spawns and extensions count. In a room of another player the value is 0.', eng(G + 'game.js', "if (!object.off && (object.type == 'extension' || object.type == 'spawn') && (object.user == runtimeData.user._id)) {"))],
    },
    'Room.find': {
        pitfalls: [
            L('FIND_CREEPS, FIND_MY_CREEPS and FIND_HOSTILE_CREEPS leave out creeps that are still spawning.', eng(G + 'game.js', '[C.FIND_CREEPS]: (i) => !i.spawning,')),
            L('The first find(FIND_EXIT, {filter}) of a tick stores its filtered result as the whole exit list of the room; later calls get that subset. Filter exits yourself.', eng(G + 'rooms.js', 'register.findCache[type][this.name] = this.find(C.FIND_EXIT_TOP, opts)')),
        ],
        notes: [
            L('The filter is handed to lodash filter: a function, an object such as {structureType: STRUCTURE_TOWER}, or a property name.', eng(G + 'rooms.js', 'result = _.filter(result, opts.filter);'), doc('Room.find')),
            L('FIND_EXIT_TOP, _RIGHT, _BOTTOM and _LEFT return the open edge tiles of that side as positions; FIND_EXIT returns all four sides.', eng(G + 'rooms.js', 'exits.push(!(runtimeData.staticTerrainData[this.name][y*50+x] & C.TERRAIN_MASK_WALL));')),
            L('FIND_FLAGS holds only your own flags. FIND_DROPPED_RESOURCES holds every pile on the ground, whatever the resource.', eng(G + 'game.js', 'addObjectToFindCache(register, C.FIND_DROPPED_RESOURCES, register.energy[i], object);')),
            L('The result is always an array; a kind with no objects gives an empty one.', eng(G + 'rooms.js', 'var result = [];')),
        ],
        see: ['mechanic:finding-and-looking'],
    },
    'Room.findPath': {
        notes: [
            L('Defaults: plain 2, swamp 10, road 1, maxOps 2000 inside the room and 20000 when the target is in another room.', eng(G + 'rooms.js', 'searchOpts.plainCost = 2;'), eng(G + 'rooms.js', 'opts.maxOps = 20000;')),
            L('With a target in another room the result holds only the steps up to the exit of this room.', eng(G + 'rooms.js', 'if(pos.roomName != id) {')),
            L('An empty path comes back when the start is not in this room, or start and target are the same tile.', eng(G + 'rooms.js', 'if(fromPos.roomName != this.name) {')),
            L('serialize: true returns the path as a string, ready for Memory and for Creep.moveByPath.', eng(G + 'rooms.js', 'return utils.serializePath(resultPath);')),
        ],
        pitfalls: [
            L('The avoid and ignore options no longer do anything; change the matrix in costCallback instead.', eng(G + 'rooms.js', "register.deprecated('`avoid` option cannot be used when `PathFinder.use()` is enabled. Use `costCallback` instead.');")),
        ],
        see: ['mechanic:pathfinding'],
    },
    'Room.findExitTo': {
        notes: [
            L('It calls Game.map.findExit, which runs a full route search on every call.', eng(G + 'rooms.js', 'return register.map.findExit(this.name, room);')),
            L('Returns ERR_NO_PATH or ERR_INVALID_ARGS instead of an exit constant when there is no route or the room is this one.', eng(G + 'map.js', 'return C.ERR_INVALID_ARGS;')),
        ],
    },
    'Room.getEventLog': {
        notes: [
            L('Without argument every caller in the tick gets the same parsed array. Do not change it.', eng(G + 'rooms.js', 'return roomEventLogCache[this.name];')),
            L('A room where nothing happened gives an empty array.', eng(G + 'rooms.js', "roomEventLogCache[this.name] = JSON.parse(runtimeData.roomEventLog[this.name] || '[]');")),
        ],
        see: ['mechanic:event-log'],
    },
    'Room.getPositionAt': {
        notes: [L('Returns null for coordinates outside 0 to 49.', eng(G + 'rooms.js', 'if(x < 0 || x > 49 || y < 0 || y > 49) {'))],
    },
    'Room.lookAt': {
        notes: [
            L('Terrain is always in the result, as {type: "terrain", terrain: "plain" | "swamp" | "wall"}.', eng(G + 'rooms.js', "item = {type: 'terrain', terrain: result};")),
            L('A dropped resource is listed twice, once as type "energy" and once as type "resource".', eng(G + 'rooms.js', '_lookSpatialRegister(this.name, C.LOOK_ENERGY, x,y, result);'), eng(G + 'rooms.js', 'resource: register.byRoom[id].spatial.energy,')),
        ],
        pitfalls: [L('Coordinates outside the room throw "look coords are out of bounds".', eng(G + 'rooms.js', "throw new Error('look coords are out of bounds');"))],
        see: ['mechanic:finding-and-looking'],
    },
    'Room.lookAtArea': {
        notes: [
            L('Without asArray: result[y][x] is an array of {type, [type]: object}. With asArray: one flat list of {x, y, type, [type]: object}.', eng(G + 'rooms.js', 'result.push({x: obj.x || obj.pos.x, y: obj.y || obj.pos.y, type, [type]: obj});')),
            L('Terrain is added for every tile of the area, so the result is large. For one kind use lookForAtArea.', eng(G + 'rooms.js', '_lookAreaMixedRegister(this.name, C.LOOK_TERRAIN, top, left, bottom, right, true, asArray, result);')),
        ],
        see: ['mechanic:finding-and-looking'],
    },
    'Room.lookForAt': {
        notes: [
            L('Returns ERR_INVALID_ARGS for a value that is not a LOOK_* constant.', eng(G + 'rooms.js', "if(type != 'terrain' && !(type in privateStore[this.name].lookTypeSpatialRegisters)) {")),
            L('LOOK_ENERGY and LOOK_RESOURCES read the same list: all dropped resources on the tile.', eng(G + 'rooms.js', 'resource: register.byRoom[id].energy,')),
        ],
        see: ['mechanic:finding-and-looking'],
    },
    'Room.lookForAtArea': {
        pitfalls: [
            L('Without asArray an empty tile is sometimes undefined and sometimes an empty array, depending on how many objects of that kind the room holds. Read it as (row[x] || []), or pass asArray.', eng(G + 'rooms.js', "if(type != 'terrain' && keys.length < (bottom-top+1)*(right-left+1)) {"), eng(G + 'rooms.js', 'result[y][x] = _lookSpatialRegister(id, type, x, y, undefined);')),
        ],
        see: ['mechanic:finding-and-looking'],
    },
    'Room.createFlag': {
        notes: [
            L('Returns the name of the flag, not OK. Without a name it takes Flag1, Flag2 and so on.', eng(G + 'rooms.js', "name = 'Flag'+cnt;")),
            L('Each call costs 0.2 CPU.', eng(G + 'rooms.js', "intents.pushByName('room', 'createFlag', {roomName, x, y, name, color, secondaryColor});")),
        ],
        pitfalls: [
            L('ERR_FULL at {{FLAGS_LIMIT}} flags, ERR_NAME_EXISTS for a name in use, ERR_INVALID_ARGS for a name over 100 characters or a color that is not a COLOR_* value.', eng(G + 'rooms.js', 'if(_.size(globals.Game.flags) >= C.FLAGS_LIMIT) {'), eng(G + 'rooms.js', 'if(name.length > 100) {')),
        ],
        constants: ['FLAGS_LIMIT'],
    },
    'Room.createConstructionSite': {
        notes: [L('Each call is its own intent: 0.2 CPU per site placed.', eng(G + 'rooms.js', "intents.pushByName('room', 'createConstructionSite', intent);"))],
    },
    'Room.serializePath': {
        notes: [L('Format: two digits each for x and y of the first step, then one direction digit per step.', eng('src/utils.js', "result += path[0].x > 9 ? path[0].x : '0'+path[0].x;"))],
    },

    // ---------------------------------------------------------------- Room.Terrain
    'Room.Terrain.constructor': {
        summary: 'new Room.Terrain(roomName): terrain reader for any room of the world, visible or not.',
        tasks: ['create a terrain object for a room', 'read terrain without vision'],
        pitfalls: [L('Throws "Could not access room" when the room does not exist.', eng(G + 'rooms.js', 'throw new Error(`Could not access room ${roomName}`);'))],
        see: ['Room.Terrain.get', 'Game.map.getRoomTerrain', 'Room.getTerrain'],
    },
    'Room.Terrain.get': {
        notes: [L('Returns TERRAIN_MASK_WALL ({{TERRAIN_MASK_WALL}}), TERRAIN_MASK_SWAMP ({{TERRAIN_MASK_SWAMP}}) or 0 for plain. A tile with both bits counts as wall.', eng(G + 'rooms.js', 'return (value & C.TERRAIN_MASK_WALL) || (value & C.TERRAIN_MASK_SWAMP) || 0;'))],
        pitfalls: [L('No bounds check: x or y outside 0 to 49 reads another tile or gives 0.', eng(G + 'rooms.js', 'const value = array[y * 50 + x];'))],
        constants: ['TERRAIN_MASK_WALL', 'TERRAIN_MASK_SWAMP'],
    },
    'Room.Terrain.getRawBuffer': {
        notes: [L('Each call returns a new copy. Pass your own Uint8Array(2500) to have it filled instead.', eng(G + 'rooms.js', 'TerrainConstructorSet.call(destinationArray, array);'))],
    },

    // ---------------------------------------------------------------- RoomPosition
    'RoomPosition.constructor': {
        pitfalls: [L('Throws for x or y outside 0 to 49 and for a malformed room name.', eng(G + 'rooms.js', "throw new Error('Invalid arguments in RoomPosition constructor');"))],
        notes: [L('Stored in Memory a position becomes plain {x, y, roomName} without methods. Rebuild it with new RoomPosition(p.x, p.y, p.roomName).', eng(G + 'rooms.js', 'RoomPosition.prototype.toJSON = register.wrapFn(function() {'))],
    },
    'RoomPosition.x': {
        summary: 'Column of the tile inside its room: 0 at the left edge to 49 at the right.',
        tasks: ['x coordinate of a position'],
        notes: [L('Can be assigned; a value outside 0 to 49 throws.', eng(G + 'rooms.js', "throw new Error('Invalid coordinate');"))],
    },
    'RoomPosition.y': {
        summary: 'Row of the tile inside its room: 0 at the top edge to 49 at the bottom.',
        tasks: ['y coordinate of a position'],
        notes: [L('Can be assigned; a value outside 0 to 49 throws.', eng(G + 'rooms.js', "throw new Error('Invalid coordinate');"))],
    },
    'RoomPosition.roomName': {
        summary: 'Name of the room the position lies in.',
        tasks: ['room of a position', 'is a position in another room'],
        notes: [L('Can be assigned; a string that is not a room name throws.', eng(G + 'rooms.js', "throw new Error('Invalid roomName');"))],
    },
    'RoomPosition.findClosestByPath': {
        notes: [
            L('It is one path search with every candidate as a goal at range 1, kept inside the room; the candidate next to the end of the path wins.', eng(G + 'rooms.js', 'return {range: 1, pos: i};'), eng(G + 'rooms.js', 'maxRooms: 1')),
            L('A candidate on the same tile is returned at once, without a search.', eng(G + 'rooms.js', 'var objectOnSquare = _.find(objects, obj => fromPos.isEqualTo(obj));')),
            L('Takes a FIND_* constant or your own array of objects or positions.', eng(G + 'rooms.js', 'objects = register.rooms[fromPos.roomName].find(objects, {filter: opts.filter});')),
        ],
        pitfalls: [L('Throws "Could not access room" when the room of the position is not visible.', eng(G + 'rooms.js', 'throw new Error(`Could not access room ${this.roomName}`);'))],
        see: ['mechanic:pathfinding', 'mechanic:finding-and-looking'],
    },
    'RoomPosition.findClosestByRange': {
        notes: [
            L('Returns null for an empty list. On a tie the first one in the list wins.', eng(G + 'rooms.js', 'if(range < minRange) {')),
            L('Takes a FIND_* constant or your own array, so one filtered list can serve many callers.', eng(G + 'rooms.js', 'objects = opts.filter ? _.filter(type, opts.filter) : type;')),
            L('An object in another room is never returned: its range counts as Infinity.', eng(G + 'rooms.js', 'return Infinity;')),
        ],
        see: ['mechanic:finding-and-looking'],
    },
    'RoomPosition.findInRange': {
        notes: [L('It takes the whole list of that kind and tests every entry, so the cost follows the number of such objects in the room, not the range.', eng(G + 'rooms.js', 'if(this.inRangeTo(i, range)) {'))],
        see: ['mechanic:finding-and-looking'],
    },
    'RoomPosition.findPathTo': {
        notes: [L('The target may be in another room; the steps returned end at the exit of this room.', eng(G + 'rooms.js', 'return room.findPath(this, new globals.RoomPosition(x,y,roomName), opts);'))],
        see: ['mechanic:pathfinding'],
    },
    'RoomPosition.getDirectionTo': {
        notes: [
            L('For a target further away it is the rough compass direction, not a walkable step: straight when one axis is more than twice the other, diagonal otherwise.', eng('src/utils.js', 'if(adx > ady*2) {')),
            L('Works across rooms, on world coordinates.', eng(G + 'rooms.js', 'return utils.getDirection(thatRoomX*50 + x - thisRoomX*50 - this.x, thatRoomY*50 + y - thisRoomY*50 - this.y);')),
        ],
        pitfalls: [L('Returns undefined when the target is the same tile.', eng('src/utils.js', 'if(dx > 0 && dy > 0) {'))],
    },
    'RoomPosition.inRangeTo': {
        notes: [L('False for a target in another room.', eng(G + 'rooms.js', 'return abs(x - this.x) <= range && abs(y - this.y) <= range && roomName == this.roomName;'))],
    },
    'RoomPosition.isNearTo': {
        notes: [L('False for a target in another room, also for the tile just across the border.', eng(G + 'rooms.js', 'return abs(x - this.x) <= 1 && abs(y - this.y) <= 1 && (!roomName || roomName == this.roomName);'))],
    },
    'RoomPosition.lookFor': {
        notes: [L('lookFor(LOOK_TERRAIN) reads the static terrain and works without vision. Every other kind throws when the room is not visible.', eng(G + 'rooms.js', "if(type == 'terrain') {"))],
        see: ['mechanic:finding-and-looking'],
    },

    // ---------------------------------------------------------------- RoomVisual
    RoomVisual: {
        pitfalls: [L('Going over 500 KB in one room throws an error at the drawing call.', eng(G + 'console.js', 'throw new Error( `RoomVisual size in room ${roomName} has exceeded ${sizeLimit} KB limit`);'))],
        notes: [L('Every drawing call returns the RoomVisual, so calls can be chained.', eng(G + 'rooms.js', 'return this;'))],
        see: ['Game.map.visual'],
    },
    'RoomVisual.constructor': {
        summary: 'new RoomVisual(roomName) draws in that room, visible or not. new RoomVisual() without a name draws in every room at once.',
        tasks: ['draw in a room without vision', 'draw in all rooms at once'],
        see: ['Room.visual'],
    },
    'RoomVisual.roomName': {
        summary: 'Name of the room this RoomVisual draws in; undefined for the one that draws in all rooms.',
    },
    'RoomVisual.line': {
        tasks: ['draw a line in a room', 'show which target a creep has'],
        notes: [L('Takes (x1, y1, x2, y2) or two positions.', eng(G + 'rooms.js', "if(typeof x1 == 'object' && typeof y1 == 'object') {"))],
    },
    'RoomVisual.rect': { tasks: ['draw a rectangle in a room', 'highlight an area of a room'] },
    'RoomVisual.poly': {
        notes: [L('Points may be [x, y] pairs or positions. An empty list draws nothing.', eng(G + 'rooms.js', 'points = points.map(i => i.x !== undefined ? [i.x, i.y] : i);'))],
    },
    'RoomVisual.clear': { tasks: ['erase room visuals', 'clear drawings of this tick'] },
    'RoomVisual.getSize': {
        tasks: ['how much visual data did I draw', 'room visual size limit'],
        notes: [L('The number is the length of the stored string.', eng(G + 'console.js', 'return visual[id][roomName].length;'))],
    },
    'RoomVisual.export': {
        summary: 'All visuals drawn in this room in this tick as one string, to store and draw again later.',
        tasks: ['save room visuals', 'keep room drawings between ticks'],
        notes: [L('Returns undefined when nothing was drawn in the room this tick.', eng(G + 'console.js', 'return visual[id][roomName || ""];'))],
        see: ['RoomVisual.import'],
    },
    'RoomVisual.import': {
        summary: 'Add visuals from a string made by export to this room for the current tick.',
        tasks: ['restore saved room visuals', 'redraw a static overlay cheaply'],
        notes: [L('The string is added to what is already drawn; the 500 KB limit applies to the sum.', eng(G + 'console.js', 'visual[id][roomName] += dataString;'))],
        see: ['RoomVisual.export'],
    },

    // ---------------------------------------------------------------- PathFinder
    PathFinder: { see: ['mechanic:pathfinding'] },
    'PathFinder.search': {
        notes: [
            L('Defaults: plainCost 1, swampCost 5, maxOps 2000, maxRooms 16, heuristicWeight 1.2.', driver('lib/path-finder.js', 'let swampCost = Math.min(254, Math.max(1, (options.swampCost | 0) || 5));'), driver('lib/path-finder.js', 'let heuristicWeight = Math.min(9, Math.max(1, options.heuristicWeight || 1.2));')),
            L('Values are clamped: plainCost and swampCost to 1..254, maxRooms to 1..64, heuristicWeight to 1..9.', driver('lib/path-finder.js', 'let maxRooms = Math.min(64, Math.max(1, (options.maxRooms | 0) || 16));')),
            L('When the origin is already within range of a goal the result is an empty path with incomplete false.', driver('lib/path-finder.js', 'return { path: [], ops: 0, cost: 0, incomplete: false };')),
            L('Without a goal, or with an empty goal list, it returns {path: [], ops: 0} and no incomplete field.', eng(G + 'path-finder.js', 'return {path: [], ops: 0};')),
        ],
        pitfalls: [
            L('A matrix value from 1 to 254 on a wall tile makes that wall walkable for the search. Only write costs on tiles a creep can really enter.', driver('native/src/pf.cc', 'if (tmp != 0) {')),
            L('If roomCallback returns false for the room the search starts in, the result is an empty path with incomplete true.', driver('lib/path-finder.js', 'return { path: [], ops: 0, cost: 0, incomplete: true };')),
        ],
        see: ['mechanic:pathfinding', 'recipe:travel-across-rooms'],
    },
    'PathFinder.CostMatrix': {
        notes: [L('The 2500 costs are stored column by column: tile (x, y) is entry x × 50 + y.', eng(G + 'path-finder.js', 'return this._bits[xx * 50 + yy];'))],
        see: ['mechanic:pathfinding', 'recipe:cache-between-ticks'],
    },
    'PathFinder.CostMatrix.constructor': { tasks: ['create a cost matrix', 'new empty cost matrix'] },
    'PathFinder.CostMatrix.get': { tasks: ['read the cost of a tile', 'check a cost matrix value'] },
    'PathFinder.CostMatrix.set': {
        pitfalls: [L('The cost is clamped to 0..255, but x and y are not checked: coordinates outside 0 to 49 write to another tile.', eng(G + 'path-finder.js', 'this._bits[xx * 50 + yy] = Math.min(Math.max(0, val), 255);'))],
        notes: [L('0 means "use the terrain cost"; 255 blocks the tile; any other value replaces the terrain cost, on wall tiles too.', driver('native/src/pf.cc', 'if (tmp == 0xff) {'))],
    },
    'PathFinder.CostMatrix.serialize': {
        notes: [L('The result is an array of 625 numbers: the 2500 bytes packed four to a number.', eng(G + 'path-finder.js', 'return Array.prototype.slice.apply(new Uint32Array(this._bits.buffer));'))],
    },

    // ---------------------------------------------------------------- Flag
    Flag: {
        notes: [
            L('Only you see your flags, and a flag never gives vision of its room.', driver(RT + 'data.js', "db['rooms.flags'].find({user: userId}),"), driver(RT + 'data.js', "if(i.type == 'flag' || i.type == 'constructionSite') {")),
            L('flag.room is undefined while the room is not visible; flag.pos always works.', eng(G + 'rooms.js', 'this.room = register.rooms[room];')),
        ],
        see: ['mechanic:visibility', 'Game.flags', 'const:colors'],
    },
    'Flag.color': {
        summary: 'Primary color of the flag: one of the COLOR_* constants, 1 to 10.',
        tasks: ['color of a flag', 'pick flags by color'],
        see: ['Flag.setColor', 'const:colors'],
    },
    'Flag.secondaryColor': {
        summary: 'Secondary color of the flag, a COLOR_* constant. Equal to color unless another one was given.',
        tasks: ['secondary color of a flag'],
        notes: [L('When no secondary color is given it is set to the primary one.', eng(G + 'flags.js', 'this.secondaryColor = Number(secondaryColor || color);'))],
        see: ['Flag.setColor', 'const:colors'],
    },
    'Flag.name': {
        summary: 'Unique name of the flag: its key in Game.flags and in Memory.flags. Fixed when the flag is created.',
        tasks: ['name of a flag', 'get a flag by name'],
        notes: [L('At most 100 characters.', eng(G + 'rooms.js', 'if(name.length > 100) {'))],
        see: ['Game.flags', 'Room.createFlag'],
    },
    'Flag.memory': {
        summary: 'Shortcut to Memory.flags[name].',
        tasks: ['store data on a flag', 'flag memory'],
        pitfalls: [L('Reading it creates an empty Memory.flags[name] entry, and the entry stays when the flag is removed. Delete it yourself.', eng(G + 'flags.js', 'return globals.Memory.flags[this.name] = globals.Memory.flags[this.name] || {};'))],
        see: ['Memory'],
    },
    'Flag.remove': {
        notes: [L('Always returns OK and costs 0.2 CPU.', eng(G + 'flags.js', "intents.pushByName('room', 'removeFlag', {roomName: this.pos.roomName, name: this.name});"))],
    },
    'Flag.setColor': {
        notes: [L('Queues a remove and a create: 0.4 CPU.', eng(G + 'flags.js', "intents.pushByName('room', 'createFlag', {roomName: this.pos.roomName, x: this.pos.x, y: this.pos.y, name: this.name, color, secondaryColor});"))],
    },
    'Flag.setPosition': {
        notes: [
            L('The target may be a position in any room, also one you cannot see. With plain x and y the flag stays in its room.', eng(G + 'flags.js', 'roomName = roomName || this.pos.roomName;')),
            L('Queues a remove and a create: 0.4 CPU.', eng(G + 'flags.js', "intents.pushByName('room', 'createFlag', {roomName, x, y, name: this.name, color: this.color, secondaryColor: this.secondaryColor});")),
        ],
        see: ['mechanic:visibility'],
    },

    // ---------------------------------------------------------------- RoomObject
    'RoomObject.effects': {
        pitfalls: [L('The property is missing on objects that never had an effect. Test `obj.effects && obj.effects.length`.', eng(G + 'rooms.js', 'if(effects) {'))],
        notes: [L('Each entry is {power, effect, level, ticksRemaining}; entries whose time is up are left out.', eng(G + 'rooms.js', 'ticksRemaining: i.endTime - runtimeData.time'))],
    },
    'RoomObject.room': { see: ['mechanic:visibility'] },
};
