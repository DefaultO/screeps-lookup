'use strict';
// Runtime pack, recipes: saving CPU, caching, travelling across rooms, measuring CPU, sharing data.
const { L, eng, driver, doc, article } = require('../../_h');

const G = 'src/game/';
const P = 'src/processor/intents/';
const RT = 'lib/runtime/';

module.exports = [
    {
        id: 'save-cpu',
        title: 'Save CPU: what costs and the cheaper way',
        summary: 'A checklist of where CPU goes: intents at 0.2 each, path searches, parsing Memory, repeated finds, and work done every tick without need. With the cheaper way for each.',
        tasks: ['how to save cpu', 'why is my cpu so high', 'reduce cpu usage', 'what costs the most cpu', 'cpu optimization checklist', 'my bucket keeps falling', 'cheaper than moveTo every tick'],
        steps: [
            { call: 'Game.cpu.getUsed', text: 'Measure first: wrap the large blocks (per room, per role) and log the sums. See recipe:measure-cpu.' },
            { text: 'Intents: every call that returns OK costs 0.2. Skip calls that change nothing (repair at full hits, upgrade without energy) and test range yourself before calling. One move plus one work action per creep is 0.4 per tick.' },
            { call: 'Creep.moveTo', text: 'Movement: raise reusePath (default 5) for creeps on fixed routes, pass ignoreCreeps on long trips, and for routes walked all day store the path once and follow it with moveByPath.' },
            { call: 'PathFinder.search', text: 'Path searches: give range 1 or more for goals nobody can stand on, keep maxOps low for near targets, and keep cost matrices in the global scope instead of building them per search.' },
            { call: 'Room.find', text: 'Finds: call find once per room and tick, filter once, hand the list to every creep. Take findClosestByRange unless walls between you and the target matter.' },
            { call: 'Game.getObjectById', text: 'Targets: store the id and look it up. Do not search every tick for the same source, container or controller.' },
            { call: 'Memory', text: 'Memory: keep it small. It is parsed on the first touch of every tick and written back after the loop. Bulky data goes to a segment, data you can recompute goes to the global scope.' },
            { text: 'Spread work: run planning, market checks and repair target lists every N ticks (Game.time % N), with a different offset per room so they do not land on the same tick.' },
            { call: 'Game.cpu.bucket', text: 'Use the bucket as a switch: skip optional work when it is low, run the heavy jobs when it is full.' },
            { call: 'Room.lookForAt', text: 'Looking: lookForAt for the one kind you need instead of lookAt; read terrain in loops through Room.getTerrain().get.' },
            { text: 'Fewer, larger creeps: each creep costs its intents and its logic every tick, whatever its size.' },
        ],
        notes: [
            L('The same method called twice on one object in a tick is charged once; say and pull cost nothing.', driver(RT + 'runtime.js', 'if (!freeMethods[name] && !this.list[id][name]) {')),
            L('A call that returns an error code queues nothing and pays no fee, only its own run time.', eng(G + 'creeps.js', "intents.set(this.id, 'move', {direction});")),
            L('Room.find without a filter only copies a list made at the start of the tick; the filter is the part that costs on every call.', eng(G + 'rooms.js', 'result = _.filter(result, opts.filter);')),
        ],
        pitfalls: [
            L('moveTo that cannot use its stored path runs a full search in that tick. A creep stuck behind another one can do that every tick.', eng(G + 'creeps.js', 'var path = this.pos.findPathTo(targetPos, opts);')),
            L('moveTo across rooms searches again in every room it enters, each time with up to 20000 ops.', eng(G + 'creeps.js', 'if(runtimeData.time > _move.time + parseInt(opts.reusePath) || _move.room != this.pos.roomName) {'), eng(G + 'rooms.js', 'opts.maxOps = 20000;')),
            L('creep.memory, room.memory and flag.memory all read Memory and so trigger the parse; so does moveTo with its stored path.', eng(G + 'creeps.js', 'this.memory._move = {')),
            L('The Memory save after the loop is charged but is not in any Game.cpu.getUsed() reading: a large Memory costs more than a profile shows.', driver(RT + 'runtime.js', 'outMessage.usedCleanTime = nowCpuTime() - startTime;')),
            L('Every tick is booked as at least 1 CPU, because the amount is rounded up.', driver(RT + 'make.js', 'const cpuUsed = Math.ceil(runResult.usedCleanTime+intentsCpu);')),
        ],
        see: ['mechanic:cpu', 'mechanic:intents', 'mechanic:pathfinding', 'mechanic:finding-and-looking', 'recipe:cache-between-ticks', 'recipe:measure-cpu'],
    },

    {
        id: 'cache-between-ticks',
        title: 'Cache data between ticks',
        summary: 'Three stores with different costs: the global scope (free, lost on every reset), Memory (kept, but parsed every tick) and segments (kept, 100 KB each, loaded on request). Cache in global; put into Memory only what must survive a reset.',
        tasks: ['how to cache between ticks', 'store an object between ticks', 'where to keep a cost matrix', 'cache find results', 'keep data without using Memory', 'my global cache is gone', 'skip the Memory parse'],
        steps: [
            { call: 'Game.getObjectById', text: 'Keep ids, not objects. A game object from the last tick is stale; store obj.id and look it up each tick.' },
            { text: 'Per-tick cache: a result needed many times in one tick (a filtered find) goes into a plain object that you empty when Game.time changes.' },
            { text: 'Global cache: put long-lived derived data on global or in a module-level variable: cost matrices, room plans, routes. Always write the rebuild: when the entry is missing, compute it again.' },
            { call: 'PathFinder.CostMatrix.serialize', text: 'What is expensive to rebuild can be saved as well: serialize a cost matrix (625 numbers) into Memory or a segment and deserialize it into global after a reset.' },
            { call: 'Room.serializePath', text: 'Paths: store them as the serialized string; Creep.moveByPath accepts the string as it is.' },
            { call: 'RawMemory.setActiveSegments', text: 'Large or seldom needed data: write it into a segment and request the segment one tick before you read it.' },
            { text: 'Notice a reset: set a module-level variable when the code loads (for example the tick). When it is unset or new, the global scope started empty.' },
            { call: 'Memory', text: 'Optional, saves the Memory parse: keep the parsed Memory object in a global variable and at the top of the loop put it back: delete global.Memory; global.Memory = saved; RawMemory._parsed = saved. Use the normal Memory in the first tick after a reset.' },
        ],
        notes: [
            L('Module-level variables and properties of global live as long as your isolate: until new code is uploaded, the heap overflows, Game.cpu.halt() is called, the script did not run for 3 minutes, or the server restarts.', driver(RT + 'user-vm.js', 'codeTimestamp > vms[userId].codeTimestamp'), driver(RT + 'user-vm.js', 'vms[userId].lastUsed < Date.now() - 3 * 60 * 1000')),
            L('Code at the top of a module runs once per reset, not once per tick. That is the place to set up caches.', eng(G + 'game.js', 'if (!(moduleName in this.globals.require.cache)) {')),
            L('The parse-skipping step works because Memory is a configurable property of global and because the runtime writes back whatever RawMemory._parsed holds after the loop.', eng(G + 'game.js', 'configurable: true,'), driver(RT + 'runtime.js', 'data.userMemory.data = systemFunctions.JSON.stringify(rawMemory._parsed);')),
        ],
        pitfalls: [
            L('A game object put into Memory is saved as a snapshot of its properties. Next tick the action methods reject it; store the id.', eng(G + 'game.js', 'trying to use a serialized game object stored in Memory'), article('global-objects')),
            L('A RoomPosition in Memory comes back as plain {x, y, roomName} without methods.', eng(G + 'rooms.js', 'RoomPosition.prototype.toJSON = register.wrapFn(function() {')),
            L('With the parse-skipping step the stored string is never read again while the global lives. Anything that changed Memory outside your loop is overwritten by your copy.', driver(RT + 'runtime.js', 'if (rawMemory._parsed) {')),
            L('Prototype extensions survive between ticks like any global, and are lost in the same resets. Define them at module level, not inside the loop.', eng(G + 'rooms.js', 'if(globals.Room) {')),
        ],
        see: ['mechanic:memory', 'mechanic:code-execution', 'Memory', 'RawMemory.segments', 'PathFinder.CostMatrix', 'recipe:save-cpu'],
    },

    {
        id: 'travel-across-rooms',
        title: 'Travel across rooms',
        summary: 'Send a creep to a room several rooms away: plan the list of rooms with Game.map.findRoute, search the path with PathFinder.search limited to those rooms, and steer by position, because the target room is not visible on the way.',
        tasks: ['move a creep to another room', 'how to travel several rooms', 'creep stuck on the room border', 'avoid hostile rooms when travelling', 'moveTo a room without vision', 'long distance pathing', 'creep bounces between two rooms'],
        steps: [
            { call: 'RoomPosition.constructor', text: 'Aim at a position: new RoomPosition(25, 25, roomName) works for a room you cannot see. Do not touch Game.rooms[target] on the way.' },
            { call: 'Creep.moveTo', text: 'One or two rooms away: creep.moveTo(pos, {reusePath: 20}) is enough. It searches up to 16 rooms with 20000 ops and plans again in each room it enters.' },
            { call: 'Game.map.findRoute', text: 'Further away: get the list of rooms once, with a routeCallback that returns Infinity for rooms to stay out of and a lower cost for highways and your own rooms. Keep the room names in the creep memory.' },
            { call: 'PathFinder.search', text: 'Search with a roomCallback that returns false for every room not on the route, maxRooms at least the number of rooms on it (limit 64) and a larger maxOps. Give the goal a range.' },
            { call: 'Creep.moveByPath', text: 'Follow the stored path with moveByPath; search again when it returns ERR_NOT_FOUND.' },
            { text: 'On arrival step off the exit tile at once: move at least one tile into the room before doing anything else.' },
            { call: 'Game.map.getRoomStatus', text: 'Before sending: check the status of the target room. "closed" means the room is not available; "novice" and "respawn" mark start areas with their own entry rules.' },
        ],
        notes: [
            L('moveTo keeps its path only for the room the creep is in and drops it when the creep enters the next one.', eng(G + 'creeps.js', 'if(runtimeData.time > _move.time + parseInt(opts.reusePath) || _move.room != this.pos.roomName) {')),
            L('findPath and moveTo return steps up to the exit of the current room only.', eng(G + 'rooms.js', 'if(pos.roomName != id) {')),
            L('The docs show the same plan: findRoute for the rooms, then PathFinder.search with a roomCallback that refuses all other rooms.', doc('Game.map.findRoute')),
        ],
        pitfalls: [
            L('A creep that ends a tick on an exit tile is moved to the neighbouring room. One that arrives and stays on the exit tile goes straight back.', eng(P + 'creeps/tick.js', "if(utils.isAtEdge(object) && object.user != '2' && object.user != '3') {")),
            L('In rooms without vision the path search knows only terrain. Walls and ramparts built there are found when a creep of yours sees the room.', eng(G + 'rooms.js', 'return new globals.PathFinder.CostMatrix();')),
            L('findRoute returns the number ERR_NO_PATH when there is no route, and looks no further than 30 rooms from the start.', eng(G + 'map.js', 'return C.ERR_NO_PATH;'), eng(G + 'map.js', 'const kRouteGrid = 30;')),
            L('An incomplete search still returns a path. Check incomplete before storing it.', driver('native/src/pf.cc', 'Nan::New<v8::Boolean>(min_node_h_cost != 0)')),
        ],
        see: ['mechanic:pathfinding', 'mechanic:visibility', 'mechanic:movement', 'Game.map.describeExits', 'Room.findExitTo', 'mechanic:room-types'],
    },

    {
        id: 'measure-cpu',
        title: 'Measure CPU use',
        summary: 'Find out where the CPU goes: read Game.cpu.getUsed() before and after a block, add up per role or room over many ticks, and judge by the trend of the bucket rather than by single ticks.',
        tasks: ['how to measure cpu', 'profile my code', 'how much cpu does a function use', 'find what uses the most cpu', 'cpu per creep', 'why does cpu spike', 'cpu profiler'],
        steps: [
            { call: 'Game.cpu.getUsed', text: 'const t = Game.cpu.getUsed(); run the block; add Game.cpu.getUsed() - t to a counter for that block. The difference contains 0.2 for every intent the block queued.' },
            { text: 'Take a reading in the first line of the loop. After a reset it shows what loading your modules cost; in other ticks it is near 0.' },
            { call: 'Memory', text: 'Measure the Memory parse by itself: one reading before and one after the first touch of Memory in the tick.' },
            { text: 'Add up: keep sums and counts per role, room or function in the global scope and print the averages every 100 ticks. Single ticks vary too much.' },
            { call: 'Game.cpu.bucket', text: 'Watch the bucket over time. A falling bucket means the average tick costs more than your limit, whatever the profile says.' },
            { call: 'Game.cpu.getHeapStatistics', text: 'Look at the heap too: total_heap_size plus externally_allocated_size close to heap_size_limit means a reset is near.' },
            { text: 'For a quick profile wrap a prototype method: replace it by a function that takes a reading, calls the original and adds the difference to a counter. Remove the wrapper afterwards.' },
        ],
        notes: [
            L('getUsed() is the CPU time of your isolate since the loop was called, plus 0.2 for every intent queued so far.', driver(RT + 'runtime.js', 'return nowCpuTime() + intents.cpu - startTime;')),
            L('What the bucket is charged for a tick: run time plus 0.2 per intent, rounded up to a whole number.', driver(RT + 'make.js', 'const cpuUsed = Math.ceil(runResult.usedCleanTime+intentsCpu);')),
            L('In the simulation room getUsed() always returns 0.', doc('Game.cpu.getUsed')),
        ],
        pitfalls: [
            L('Writing Memory back (JSON.stringify) happens after the loop and is charged, but no reading inside the loop can show it. Time JSON.stringify(Memory) once to know its size.', driver(RT + 'runtime.js', 'data.userMemory.data = systemFunctions.JSON.stringify(rawMemory._parsed);'), driver(RT + 'runtime.js', 'outMessage.usedCleanTime = nowCpuTime() - startTime;')),
            L('The first tick after a global reset compiles and loads every module. Leave it out of the averages.', driver(RT + 'runtime-driver.js', 'var script = runtime.compileScriptSync(code, options);')),
            L('Console commands run after your loop in the same tick and their CPU is yours as well.', eng(G + 'game.js', 'code: runCodeCache[userId].consoleCommands[i].expression')),
        ],
        see: ['mechanic:cpu', 'Game.cpu.tickLimit', 'recipe:save-cpu', 'mechanic:code-execution'],
    },

    {
        id: 'share-data-with-an-ally',
        title: 'Share data with an ally: public and foreign segments',
        summary: 'One player writes a memory segment and marks it public; the other requests it by user name and reads it one tick later. One foreign segment can be loaded per tick, up to 100 KB.',
        tasks: ['share data with an ally', 'read the segment of another player', 'publish a memory segment', 'send a message to the code of another player', 'ally communication', 'public segment does not load', 'ask an ally for resources'],
        steps: [
            { call: 'RawMemory.segments', text: 'Sender: write a string into a segment with an id from 1 to 99, for example RawMemory.segments[id] = JSON.stringify(data). At most 100 KB.' },
            { call: 'RawMemory.setPublicSegments', text: 'Sender: put the id on the public list. One call is enough; the list stays until you change it.' },
            { call: 'RawMemory.setDefaultPublicSegment', text: 'Sender, optional: make it the default, so that readers need not know the id.' },
            { call: 'RawMemory.setActiveForeignSegment', text: 'Reader: request it with the user name of the sender and the id. The request stays active on the following ticks.' },
            { call: 'RawMemory.foreignSegment', text: 'Reader, from the next tick: check that foreignSegment exists and that username and id are the ones you asked for, then JSON.parse(data) inside try/catch.' },
            { text: 'Several allies: only one foreign segment per tick, so go through the list, one ally per tick.' },
            { text: 'Both directions: each side publishes its own segment and reads the other one. Put the tick number into the data, so the reader can tell new from old.' },
        ],
        notes: [
            L('The sender needs no active request to write: every id assigned in RawMemory.segments is saved, up to 10 per tick.', driver(RT + 'runtime.js', 'var segmentKeys = Object.keys(rawMemory.segments);')),
            L('The reader gets what the owner saved at the end of an earlier tick. Count on at least one tick of delay in each direction.', eng('src/runner.js', 'promises.push(driver.saveUserMemorySegments(userId, runResult.memorySegments));'), driver(RT + 'data.js', 'runtimeData.foreignMemorySegment = {')),
            L('For data between your own shards use InterShardMemory instead.', doc('InterShardMemory')),
        ],
        pitfalls: [
            L('Do not publish segment 0: the loader skips an id of 0 and readers never get it.', driver(RT + 'data.js', 'result[0].activeForeignSegment && result[0].activeForeignSegment.user_id && result[0].activeForeignSegment.id ?')),
            L('The reader gets data only while the id is on the public list of the owner. Otherwise foreignSegment is undefined.', driver(RT + 'data.js', "if(result[5] && result[5][1] && result[5][1].split(',').indexOf(\"\"+runtimeData.user.activeForeignSegment.id) != -1) {")),
            L('A public segment can be read by every player who knows your name. Put nothing in it that an enemy should not see.', driver(RT + 'data.js', 'env.get(env.keys.PUBLIC_MEMORY_SEGMENTS+result[0].activeForeignSegment.user_id)')),
            L('setPublicSegments([]) does not take anything back in the public driver. Publish another id, or blank the content.', driver(RT + 'make.js', 'if(runResult.publicSegments) {')),
            L('A segment over 100 KB fails the whole tick of the sender, intents included. Check the length before assigning.', driver(RT + 'runtime.js', 'throw `Memory segment #${segmentKeys[i]} has exceeded 100 KB length limit`;')),
        ],
        see: ['mechanic:memory', 'RawMemory.segments', 'RawMemory.foreignSegment', 'RawMemory.setPublicSegments', 'InterShardMemory'],
    },
];
