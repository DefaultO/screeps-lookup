'use strict';
// Pack "practice-code": what experienced players do in fights, in the structure of their code and in
// their tooling. No game code prescribes any of it, so every entry is basis: 'practice'.
// A line about the game carries its code source. A line about what players do says so ("Community
// practice", "A common choice") and points at the wiki page that describes it; nothing is copied from
// the wiki. Numbers are computed from the constants; 0.2 CPU per intent is a literal of the driver.
const { L, eng, driver, backend, common, doc, article, wiki } = require('../../_h');

const P = 'src/processor/intents/';
const G = 'src/game/';
const RT = 'lib/runtime/';

const INTENT_CPU = 0.2;                       // driver lib/runtime/runtime.js: let intentCpu = 0.2,
const intentFee = driver(RT + 'runtime.js', 'let intentCpu = 0.2,');
const r1 = n => Math.round(n * 10) / 10;

const towerAt = (C, r) => {
    const range = Math.min(Math.max(r, C.TOWER_OPTIMAL_RANGE), C.TOWER_FALLOFF_RANGE);
    return Math.floor(C.TOWER_POWER_ATTACK - C.TOWER_POWER_ATTACK * C.TOWER_FALLOFF * (range - C.TOWER_OPTIMAL_RANGE) / (C.TOWER_FALLOFF_RANGE - C.TOWER_OPTIMAL_RANGE));
};
const rangeLabel = (C, r) => (r <= C.TOWER_OPTIMAL_RANGE ? '≤ ' + C.TOWER_OPTIMAL_RANGE : r >= C.TOWER_FALLOFF_RANGE ? '≥ ' + C.TOWER_FALLOFF_RANGE : r);
// parts of a full body beside MOVE: one MOVE per other part, and with XZHO2 on the MOVE parts (plain, full speed)
const freeParts = C => C.MAX_CREEP_SIZE / 2;
const freePartsBoosted = C => C.MAX_CREEP_SIZE - C.MAX_CREEP_SIZE / (1 + C.BOOSTS.move.XZHO2.fatigue);

module.exports = [
    // ================================================================ squads
    {
        id: 'squad-combat',
        basis: 'practice',
        topic: 'practice',
        title: 'Fight as a group: duos, quads, kiting, tower draining',
        summary: 'How players fight in formation. A duo is an attacker with a healer on the next tile; a quad is four creeps in a 2 × 2 block, where every creep reaches every other with {{HEAL_POWER}} per HEAL part. The tables give the HEAL parts a group needs under tower fire, the damage its parts deal and the CPU its intents cost.',
        tasks: [
            'how to fight as a quad', 'duo of attacker and healer', 'squad combat', 'how to drain towers', 'kite a melee creep',
            'how many heal parts does a quad need', 'move four creeps in formation', 'what is pre-healing',
        ],
        steps: [
            { call: 'StructureObserver.observeRoom', text: 'Scout the target: number of towers, where they stand, rampart hits, safe mode. The first table turns towers and range into the HEAL parts that must stand next to the creep under fire.' },
            { text: 'Pick the size. Community practice knows two formations: the duo, one attacker or dismantler with one healer behind it, and the quad, four creeps in a 2 × 2 block. Take the duo where one healer covers the fire (first table), the quad where it does not or where the fire moves between creeps.' },
            { call: 'StructureSpawn.spawnCreep', text: 'Bodies: TOUGH first, HEAL last, and the same share of MOVE in every member. RANGED_ATTACK and HEAL in one body both work in the same tick. ATTACK or WORK next to HEAL do not, so melee and dismantle creeps leave the healing to their partner.' },
            { call: 'StructureLab.boostCreep', text: 'Decide on boosts for the whole group, not per creep. Unboosted, four bodies hold at most {{4 * MAX_CREEP_SIZE / 2}} HEAL parts beside their MOVE parts, {{4 * MAX_CREEP_SIZE / 2 * HEAL_POWER}} per tick: the close-range fire of {{4 * MAX_CREEP_SIZE / 2 * HEAL_POWER / TOWER_POWER_ATTACK}} towers, with no part left to attack.' },
            { call: 'Creep.pull', text: 'Duo on the move: the leader follows the path, the follower calls move(leader) and steps onto the tile the leader leaves. With leader.pull(follower) the pair cannot tear apart; the fatigue of the follower then lands on the leader.' },
            { call: 'PathFinder.search', text: 'Quad on the move: search one path for the top-left creep, with a cost matrix in which a tile is as bad as the worst tile of its 2 × 2 block (wall or structure: blocked; swamp: swamp cost). Give all four the same direction in the same tick, and only when all four have fatigue 0. Through a gap one tile wide go in a line and form up behind it.' },
            { call: 'Creep.heal', text: 'Every tick each creep with HEAL parts heals: the member that lost hits, else the member the defence will most likely hit next (pre-heal).' },
            { call: 'Creep.rangedMassAttack', text: 'Every tick each creep with RANGED_ATTACK parts shoots: rangedAttack on the common target, rangedMassAttack when the targets in range add up to more and no ally stands close.' },
            { call: 'Creep.rangedAttack', text: 'Kiting: against melee creeps hold range 3 and step back when they reach range 2. It works only while your creep moves every tick: enough MOVE for the terrain behind it, and no swamp on the way back.' },
            { text: 'Tower draining: stand at range {{TOWER_FALLOFF_RANGE}} or more from the towers, next to an exit, with the healing for that fire. Each shot costs the defender {{TOWER_ENERGY_COST}} energy; when hits fall, step onto the exit tile and heal up in the next room.' },
            { text: 'Fix the retreat rule before the fight: leave when the damage of one tick exceeds what the group heals, when the boosted TOUGH parts are gone, or when a member is lost.' },
        ],
        notes: [
            L('heal works at range 1 with {{HEAL_POWER}} per part, rangedHeal up to range 3 with {{RANGED_HEAL_POWER}}. In a 2 × 2 block all four creeps are within range 1 of each other, so all their HEAL parts can go to one member at full strength.',
                eng(P + 'creeps/heal.js', 'if(Math.abs(target.x - object.x) > 1 || Math.abs(target.y - object.y) > 1) {'),
                eng(P + 'creeps/rangedHeal.js', "var healPower = utils.calcBodyEffectiveness(object.body, C.HEAL, 'rangedHeal', C.RANGED_HEAL_POWER);")),
            L('A heal is added to the target without asking whether it has lost hits, and is settled against the damage of the same tick. A heal on a full creep that is hit in that tick counts in full: pre-healing rests on this.',
                eng(P + 'creeps/heal.js', 'target._healToApply = (target._healToApply || 0) + healPower;'),
                eng(P + 'creeps/tick.js', 'object.hits += object._healToApply;')),
            L('heal drops attack and dismantle of the same creep in that tick; rangedAttack and rangedMassAttack still run. rangedHeal drops all four.',
                eng(P + 'creeps/intents.js', "attack: ['build','repair','dismantle','attackController','rangedHeal','heal'],"),
                eng(P + 'creeps/intents.js', "rangedMassAttack: ['build','repair','rangedHeal'],")),
            L('A creep may enter the tile that another creep leaves in the same tick. That lets a follower take the leader\'s tile and a block shift as one.',
                eng(P + 'movement.js', "if ((i.type == 'creep' || i.type == 'powerCreep') && !objects[i._id]")),
            L('rangedAttack reaches range 3, attack range 1: two free tiles between a ranged creep and a melee creep keep it out of reach for one more step.',
                eng(P + 'creeps/rangedAttack.js', 'if(Math.abs(target.x - object.x) > 3 || Math.abs(target.y - object.y) > 3) {'),
                eng(P + 'creeps/attack.js', 'if(Math.abs(target.x - object.x) > 1 || Math.abs(target.y - object.y) > 1) {')),
            L('rangedMassAttack does {{RANGED_ATTACK_POWER}} / {{RANGED_ATTACK_POWER * 0.4}} / {{RANGED_ATTACK_POWER * 0.1}} per part to each target at range 1 / 2 / 3. It beats one rangedAttack from 2 targets at range 1, {{Math.floor(1 / 0.4) + 1}} at range 2 or {{Math.floor(1 / 0.1) + 1}} at range 3.',
                eng(P + 'creeps/rangedMassAttack.js', 'var distanceRate = {0: 1, 1: 1, 2: 0.4, 3: 0.1};')),
            L('A tower shot costs {{TOWER_ENERGY_COST}} energy and a full tower holds {{TOWER_CAPACITY / TOWER_ENERGY_COST}} shots. From range {{TOWER_FALLOFF_RANGE}} each shot does {{TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)}}.',
                eng(P + 'towers/attack.js', 'object.store.energy -= C.TOWER_ENERGY_COST;'),
                eng(P + 'towers/attack.js', 'amount -= amount * C.TOWER_FALLOFF * (range - C.TOWER_OPTIMAL_RANGE) / (C.TOWER_FALLOFF_RANGE - C.TOWER_OPTIMAL_RANGE);')),
            L('Community practice: draining pays against a room that refills its towers slowly or shoots at everything. A defender that holds fire while its towers cannot beat the healing is not drained.', wiki('Combat')),
            L('Community practice on the other side: defenders spread tower and creep fire over the members of a quad instead of one target, so that its healing has to split.', wiki('Maturity_Matrix')),
        ],
        pitfalls: [
            L('move() returns ERR_TIRED while the creep has fatigue. One tired member stops or splits the formation: check the fatigue of all members before any of them moves.',
                eng(G + 'creeps.js', 'if(data(this.id).fatigue > 0) {')),
            L('rangedMassAttack hits every creep and structure in range that has an owner other than you, allies included, and nothing without an owner: walls, roads and containers take no damage from it. Use rangedAttack on a wall.',
                eng(P + 'creeps/rangedMassAttack.js', "return (!_.isUndefined(i.user) || i.type == 'powerBank') && i.user != object.user &&")),
            L('A creep that ends a tick on an exit tile is in the next room one tick later. A formation that crosses a border is split over two rooms for that tick; cross where no enemy waits, and form up two tiles inside.',
                eng(P + 'creeps/tick.js', "if(utils.isAtEdge(object) && object.user != '2' && object.user != '3') {")),
            L('Boosted TOUGH lowers damage only while those parts have hits. Once they are gone the same fire lands in full, and the HEAL parts behind them are next.',
                eng(P + 'creeps/tick.js', 'damageRatio = C.BOOSTS[bodyPart.type][bodyPart.boost].damage;')),
            L('Each move, heal and ranged attack is an intent of 0.2 CPU; a quad that moves, heals and shoots pays {{4 * 3 * 0.2}} CPU per tick before any path search (third table).', intentFee),
        ],
        tables: [
            C => {
                const towers = [...new Set(Object.values(C.CONTROLLER_STRUCTURES.tower).filter(n => n > 0))];
                const ranges = [C.TOWER_OPTIMAL_RANGE, 10, 15, C.TOWER_FALLOFF_RANGE];
                const t3 = C.HEAL_POWER * C.BOOSTS.heal.XLHO2.heal;
                const moves = C.MAX_CREEP_SIZE - freePartsBoosted(C);
                return {
                    title: 'HEAL parts needed next to the creep under tower fire',
                    head: ['range to the towers'].concat(towers.map(n => n + (n === 1 ? ' tower' : ' towers'))),
                    rows: ranges.map(r => [rangeLabel(C, r)].concat(towers.map(n => {
                        const damage = n * towerAt(C, r);
                        return `${Math.ceil(damage / C.HEAL_POWER)} / ${Math.ceil(damage / t3)} / ${Math.ceil(damage * C.BOOSTS.tough.XGHO2.damage / t3)}`;
                    }))),
                    foot: `Each cell: unboosted / with XLHO2 / with XLHO2 while XGHO2 TOUGH parts take the hits. With all towers at the same range. A body has ${C.MAX_CREEP_SIZE} parts: ${freeParts(C)} beside its MOVE parts at one MOVE per other part, ${freePartsBoosted(C)} with XZHO2 on ${moves} MOVE parts. A duo has one such body for HEAL, a quad up to four, less what it gives to attack parts.`,
                };
            },
            C => {
                const b = C.BOOSTS, few = freeParts(C), many = freePartsBoosted(C);
                const row = (name, base, mult) => [name, r1(base), r1(base * mult), r1(base * few), r1(base * mult * many)];
                return {
                    title: 'Damage per tick by parts',
                    head: ['action', 'per part', 'per part, tier 3 boost', `${few} parts`, `${many} parts, tier 3 boost`],
                    rows: [
                        row('attack (range 1)', C.ATTACK_POWER, b.attack.XUH2O.attack),
                        row('rangedAttack (range 3, one target)', C.RANGED_ATTACK_POWER, b.ranged_attack.XKHO2.rangedAttack),
                        row('rangedMassAttack, each target at range 1', C.RANGED_ATTACK_POWER, b.ranged_attack.XKHO2.rangedMassAttack),
                        row('rangedMassAttack, each target at range 2', C.RANGED_ATTACK_POWER * 0.4, b.ranged_attack.XKHO2.rangedMassAttack),
                        row('rangedMassAttack, each target at range 3', C.RANGED_ATTACK_POWER * 0.1, b.ranged_attack.XKHO2.rangedMassAttack),
                        row('dismantle (range 1, structures only)', C.DISMANTLE_POWER, b.work.XZH2O.dismantle),
                    ],
                    foot: `Tier 3 boosts: XUH2O for attack, XKHO2 for ranged, XZH2O for dismantle. ${few} and ${many} are the parts a body of ${C.MAX_CREEP_SIZE} has beside its MOVE parts without and with XZHO2. A group deals the sum of its creeps. A rampart on the target tile takes the damage first.`,
                };
            },
            C => {
                const row = (label, creeps, calls) => [label, creeps * calls, r1(creeps * calls * INTENT_CPU), Math.round(creeps * calls * INTENT_CPU * C.CREEP_LIFE_TIME)];
                return {
                    title: 'CPU of the intents of a group',
                    head: ['group and calls per creep', 'intents per tick', 'CPU per tick', `CPU over ${C.CREEP_LIFE_TIME} ticks`],
                    rows: [
                        row('duo: attacker (move, attack), healer (move, heal)', 2, 2),
                        row('duo: both move, heal, rangedAttack', 2, 3),
                        row('quad: each move, heal, rangedMassAttack', 4, 3),
                        row('quad standing still: each heal, rangedMassAttack', 4, 2),
                    ],
                    foot: `${INTENT_CPU} CPU per intent that returns OK. Path search, target choice and the cost matrix for the block come on top; pull and say are free.`,
                };
            },
        ],
        constants: ['HEAL_POWER', 'RANGED_HEAL_POWER', 'ATTACK_POWER', 'RANGED_ATTACK_POWER', 'DISMANTLE_POWER', 'TOWER_POWER_ATTACK', 'TOWER_ENERGY_COST', 'TOWER_CAPACITY',
            'TOWER_OPTIMAL_RANGE', 'TOWER_FALLOFF_RANGE', 'MAX_CREEP_SIZE', 'BOOSTS.heal', 'BOOSTS.tough', 'BOOSTS.move'],
        see: ['recipe:attack-a-room', 'recipe:defend-a-room', 'mechanic:damage-and-healing', 'mechanic:tower', 'mechanic:simultaneous-actions', 'mechanic:movement',
            'mechanic:boosts', 'recipe:labs-and-boosts', 'recipe:clear-a-stronghold', 'recipe:travel-across-rooms', 'Creep.heal', 'Creep.rangedMassAttack', 'Creep.pull'],
    },

    // ================================================================ structure of the code
    {
        id: 'creep-architecture',
        basis: 'practice',
        topic: 'practice',
        title: 'Organise creep logic: roles, tasks or a kernel',
        summary: 'Three ways players structure the code that drives creeps: a role per creep that decides for itself, a manager per room that hands tasks to general creeps, and a kernel that runs everything as processes with priorities. They differ in where a decision is made and what it costs in CPU and code; the game allows all of them and charges the same 0.2 CPU per intent.',
        tasks: [
            'how do I organise creep roles', 'roles or tasks', 'screeps operating system', 'kernel and processes', 'generic worker creeps',
            'lock a target instead of searching every tick', 'how to structure my bot', 'creep state machine',
        ],
        steps: [
            { call: 'Creep.memory', text: 'Roles, the way of the tutorial: give each creep a role name in its memory when you spawn it, and every tick call the module of that role for the creep. One module per job, one body per job.' },
            { text: 'Inside a role keep a state in memory (for a hauler: collect or deliver) and change it only when the store runs empty or full. A creep that decides anew every tick flips between jobs.' },
            { call: 'Game.getObjectById', text: 'Lock targets: store the id of the chosen target, fetch it each tick, check cheaply that it still fits (exists, not full, still damaged), and search again only when it does not.' },
            { call: 'Room.find', text: 'When several creeps repeat the same search, move the decision up: a manager per room collects the work once per tick (sites, structures to fill, things to repair) and hands each free creep a task.' },
            { text: 'A task is data: action, target id, range. The creep code only moves into range and calls the action, so one general body (WORK, CARRY, MOVE) can take whatever is needed next.' },
            { text: 'The two combine: fixed posts such as the miner at a source stay roles; hauling, building and repairing go out as tasks.' },
            { call: 'Game.cpu.getUsed', text: 'A kernel, when run order and CPU get hard to manage: wrap each piece of logic (a room, a remote, the market) as a process with a priority. A scheduler runs them in order, stops at a CPU budget, and raises the priority of what had to wait.' },
            { call: 'Game.cpu.bucket', text: 'In any structure: tie optional work to the bucket, and wrap each creep or process in try/catch so that one error does not end the tick for all.' },
        ],
        notes: [
            L('creep.memory is Memory.creeps[name]. A role or task stored there is found again after a global reset; one held only in a variable of the global scope is not.',
                eng(G + 'creeps.js', 'return globals.Memory.creeps[this.name] = globals.Memory.creeps[this.name] || {};')),
            L('spawnCreep writes its memory option into Memory.creeps[name] in the tick of the call, so role and home room are set before the creep exists.',
                eng(G + 'structures.js', 'globals.Memory.creeps[name] = options.memory || globals.Memory.creeps[name] || {};')),
            L('Game.getObjectById returns null for an object that is gone or in a room you do not see. A locked target needs that check every tick.',
                eng(G + 'game.js', 'return register._objects[id] || null;')),
            L('The fee of 0.2 CPU per intent is the same in every structure. What the structure changes is the CPU spent on deciding, not on acting.', intentFee),
            L('Community practice: role creeps are built for one job and are cheap for it. When the job runs out they stand idle unless the role says what else to do.', wiki('Roles')),
            L('Community practice: general creeps with tasks follow what the colony needs and spare the repeated checks of many equal roles. The price is larger, less fitted bodies and a manager to write.', wiki('Generic_Creeps')),
            L('Community practice: target locking spreads the cost of choosing over many ticks. It gains only when the check of the stored target is cheaper than the search.', wiki('Target_lock')),
            L('Community practice: a kernel pays late, when CPU is the limit and priorities must decide what a short tick drops. Before any game logic it needs process ids, a process table and state that survives a reset.', wiki('Operating_System'), wiki('Optimization')),
        ],
        pitfalls: [
            L('An error that nothing catches ends the loop for the tick: every creep after the failing one does nothing. Catch per creep or per process and log the stack.',
                driver(RT + 'runtime.js', "outMessage.type = 'error';")),
            L('A loop that runs past Game.cpu.tickLimit is cut where it stands, so whatever comes last is skipped on such ticks. Order the work so that the last part is the one you can do without.',
                driver(RT + 'runtime-driver.js', "e.message = 'Script execution timed out: CPU time limit reached';")),
            L('Without a memory option a new creep takes over the Memory.creeps entry that a dead creep of the same name left behind, old role and old target included. Pass the memory with every spawnCreep or delete the entries of dead creeps.',
                eng(G + 'structures.js', 'globals.Memory.creeps[name] = options.memory || globals.Memory.creeps[name] || {};')),
            L('Process state kept only in the global scope is lost on every reset. Keep in Memory what a process cannot work out again, and rebuild the rest.',
                driver(RT + 'user-vm.js', 'codeTimestamp > vms[userId].codeTimestamp')),
        ],
        tables: [() => ({
            kind: 'matrix',
            title: 'What each structure costs and gives',
            head: ['', 'roles', 'tasks for general creeps', 'kernel with processes'],
            rows: [
                ['who decides', 'each creep, every tick', 'a manager per room, once per tick', 'processes, in order of priority'],
                ['searches per tick for n equal creeps', 'up to n', '1', '1 per process'],
                ['bodies', 'fitted to the job', 'general, larger', 'either'],
                ['when the work runs out', 'the creep idles', 'the creep gets another task', 'the process sleeps or ends'],
                ['on a tick short of CPU', 'the last creeps in the loop are skipped', 'the same, unless tasks go out by priority', 'the lowest priority waits'],
                ['code to write first', 'one module per role', 'task format, manager, runner', 'kernel, scheduler, process table'],
                ['CPU per intent', INTENT_CPU, INTENT_CPU, INTENT_CPU],
            ],
        })],
        see: ['Creep.memory', 'Memory', 'Game.getObjectById', 'mechanic:cpu', 'mechanic:intents', 'mechanic:code-execution', 'recipe:save-cpu', 'recipe:cache-between-ticks',
            'recipe:spawning', 'recipe:measure-cpu', 'recipe:tutorial-walkthrough'],
    },

    // ================================================================ Memory
    {
        id: 'memory-tricks',
        basis: 'practice',
        topic: 'practice',
        title: 'Cut the cost of Memory: smaller data, MemHack, own serialisation',
        summary: 'Memory costs CPU twice in a tick: JSON.parse of the whole string at the first access, and JSON.stringify of the whole object after the loop. Players cut that by storing less, by keeping the parsed object in the global scope (MemHack, which rests on an internal of the runtime that may change), or by doing the serialisation themselves through RawMemory.',
        tasks: [
            'reduce memory parse cpu', 'what is memhack', 'skip the memory parse every tick', 'my memory is too big', 'compress data in memory',
            'custom memory serialization', 'what does memory cost per tick', 'save memory only every few ticks',
        ],
        steps: [
            { call: 'RawMemory.get', text: 'Measure first. RawMemory.get().length is the size in characters (limit {{2 * 1024 * 1024}}). Read Game.cpu.getUsed() before and after the first touch of Memory for the parse, and time JSON.stringify(Memory) once for the save, which no reading inside the loop shows.' },
            { call: 'Memory', text: 'Store less: delete the Memory.creeps entries of dead creeps, keep ids instead of objects, drop what can be worked out again.' },
            { call: 'Room.serializePath', text: 'Flatten what stays: a position as one short string or number instead of {x, y, roomName}, a path as the string of Room.serializePath, a list of ids as one joined string.' },
            { call: 'RawMemory.segments', text: 'Move bulk that is read seldom (room intel, statistics, serialised cost matrices) into segments. A segment is a plain string: it costs nothing until you parse it yourself.' },
            { text: 'Keep derived data in the global scope and rebuild it after a reset: recipe:cache-between-ticks.' },
            { call: 'Memory', text: 'MemHack, when the parse still costs too much: in the first tick of a global read Memory as usual and keep the object in a module-level variable. In every later tick, before anything else touches Memory: delete global.Memory; global.Memory = saved; RawMemory._parsed = saved.' },
            { text: 'A riskier step on top: set RawMemory._parsed only every N ticks, so that the stringify runs only then. Everything changed since the last save is lost when the global resets.' },
            { call: 'RawMemory.set', text: 'Or serialise yourself: decode RawMemory.get() in your own format, work on your own object, and hand the new string to RawMemory.set() at the end of the loop. In such a tick use neither Memory nor creep.memory nor the stored path of moveTo.' },
        ],
        notes: [
            L('Each tick the runtime defines Memory on global as a getter. The first read runs JSON.parse on the stored string, keeps the result in RawMemory._parsed and puts that object in place of the getter.',
                eng(G + 'game.js', 'runCodeCache[userId].memory._parsed = JSON.parse(runCodeCache[userId].memory.get() || "{}");'),
                eng(G + 'game.js', 'value: runCodeCache[userId].memory._parsed')),
            L('After the loop the runtime stringifies what RawMemory._parsed holds, if it holds anything. The CPU clock stops after that, so the save is charged to you.',
                driver(RT + 'runtime.js', 'data.userMemory.data = systemFunctions.JSON.stringify(rawMemory._parsed);'),
                driver(RT + 'runtime.js', 'outMessage.usedCleanTime = nowCpuTime() - startTime;')),
            L('MemHack rests on two things the API reference does not promise: Memory is a configurable property of global, so it can be deleted and set, and the save reads RawMemory._parsed. Either may change with a server update; build a switch that turns the hack off.',
                eng(G + 'game.js', 'configurable: true,'),
                driver(RT + 'runtime.js', 'if (rawMemory._parsed) {')),
            L('MemHack saves the parse only. The stringify after the loop still runs every tick, in proportion to the size of Memory.',
                driver(RT + 'runtime.js', 'data.userMemory.data = systemFunctions.JSON.stringify(rawMemory._parsed);')),
            L('creep.memory, room.memory, flag.memory and spawn.memory look up global.Memory at each access, so they work on the object you put there.',
                eng(G + 'creeps.js', 'return globals.Memory.creeps[this.name] = globals.Memory.creeps[this.name] || {};')),
            L('RawMemory.set() stores your string as it is and drops the parsed object, so the runtime does no stringify of its own. The string may have {{2 * 1024 * 1024}} characters.',
                driver(RT + 'runtime.js', 'if (this._parsed) {'),
                driver(RT + 'runtime.js', 'if (value.length > 2 * 1024 * 1024) {')),
            L('The official caching article gives the same advice on size: objects cost more to parse than strings, turn positions into flat strings, compress large repetitive data such as cost matrices and keep the unpacked copy in the global scope.',
                article('contributed/caching-overview')),
            L('Community practice: MemHack is the usual name for keeping the parsed Memory in the global scope; the wiki page that describes it calls it a hack that may stop working.', wiki('MemHack')),
        ],
        pitfalls: [
            L('In the first tick after a global reset the saved variable is empty. Use the normal Memory in that tick and take the reference from it; putting undefined on global.Memory breaks every memory shortcut.',
                driver(RT + 'user-vm.js', 'codeTimestamp > vms[userId].codeTimestamp')),
            L('With RawMemory._parsed unset nothing is stringified and the stored string stays as the last save left it. A reset between two saves throws away every change since: creep memory, spawn bookkeeping, all of it.',
                driver(RT + 'runtime.js', 'if (rawMemory._parsed) {')),
            L('A read of Memory after RawMemory.set() in the same tick parses your string and the runtime writes its own JSON over it. Decide per tick which of the two you use.',
                eng(G + 'game.js', 'runCodeCache[userId].memory._parsed = JSON.parse(runCodeCache[userId].memory.get() || "{}");')),
            L('A stored string that is not valid JSON makes Memory null for the tick, and every Memory.x and creep.memory then throws. With an own format, stay away from the Memory object altogether.',
                eng(G + 'game.js', 'runCodeCache[userId].memory._parsed = null;')),
        ],
        tables: [() => ({
            kind: 'matrix',
            title: 'What each step saves and what it rests on',
            head: ['step', 'parse at first access', 'save after the loop', 'rests on', 'what can go wrong'],
            rows: [
                ['store less, flatten', 'smaller', 'smaller', 'documented API', 'nothing'],
                ['segments', 'none until you parse one', 'only the segments you assign', 'documented API', 'a segment is there one tick after the request'],
                ['global scope as cache', 'none', 'none', 'the life of the isolate', 'empty after every reset'],
                ['MemHack', 'skipped', 'paid every tick', 'Memory being configurable and RawMemory._parsed, both internal', 'stops working when the runtime changes'],
                ['MemHack, save every N ticks', 'skipped', 'paid every N ticks', 'the same internals', 'a reset loses up to N ticks of changes'],
                ['RawMemory.get and set, own format', 'your decoder', 'your encoder', 'documented API', 'Memory shortcuts are unusable in that tick'],
            ],
        })],
        see: ['mechanic:memory', 'Memory', 'RawMemory', 'RawMemory.get', 'RawMemory.set', 'RawMemory.segments', 'recipe:cache-between-ticks', 'recipe:save-cpu', 'recipe:measure-cpu',
            'mechanic:code-execution', 'PathFinder.CostMatrix.serialize'],
    },

    // ================================================================ profiling and statistics
    {
        id: 'profiling-and-stats',
        basis: 'practice',
        topic: 'practice',
        title: 'Profile CPU and keep long-term statistics',
        summary: 'Beyond single readings of Game.cpu.getUsed(): wrap functions to see where the CPU goes, write a few numbers per tick into Memory or a segment, and let a tool outside the game collect them into graphs. The official third-party page lists the profilers and statistics tools; the bucket tells what a tick was really charged.',
        tasks: [
            'profile my bot', 'screeps profiler', 'grafana statistics', 'export stats from the game', 'track cpu over time', 'long term statistics',
            'which function uses the most cpu', 'how much cpu was the last tick charged',
        ],
        steps: [
            { call: 'Game.cpu.getUsed', text: 'Begin with coarse blocks as in recipe:measure-cpu: per room, per role, per process. Go deeper only where a block is large.' },
            { text: 'Function profiler: put wrappers around prototype methods and your own functions that read getUsed() before and after and add up calls and CPU per name. Switch it on from the console for a set number of ticks, print the table, switch it off: the wrappers cost CPU themselves.' },
            { call: 'Game.cpu.bucket', text: 'Take the true cost of a tick from the bucket: charged CPU = Game.cpu.limit − (bucket now − bucket one tick before). It holds while the bucket is below its cap and no pixel was made, and it includes the Memory save.' },
            { call: 'Game.cpu.getHeapStatistics', text: 'Pick a small set of numbers per tick: CPU used and charged, bucket, heap, global resets, creeps, energy in storage per room, progress of controllers and of the account level.' },
            { call: 'RawMemory.segments', text: 'Put them where a collector can read them: one object under Memory that is overwritten every tick, or JSON in a segment, which adds nothing to the Memory parse.' },
            { text: 'Collect outside the game: an agent with an auth token reads that place over the web API on a timer and feeds a time-series store with a dashboard. Give the token access to that endpoint or segment only.' },
            { call: 'RoomVisual.text', text: 'Without outside tools: print a summary to the console every N ticks, or draw the last ticks as a graph with room visuals from an array kept in the global scope.' },
            { call: 'Game.notify', text: 'Add alarms for what must not wait for a look at a graph: a bucket that stays low, a room without a spawn. Group them so that one fault does not send a mail per tick.' },
        ],
        notes: [
            L('Kinds of tools on the official third-party page: a profiler that wraps functions (screeps-profiler), collectors that feed Grafana or Kibana (ScreepsPlus Grafana, screeps-grafana, screeps-stats), and statistics that stay in the console (screeps-ConsoleStats).',
                article('third-party')),
            L('The same page warns: never give a third party your password, many tools rest on unofficial APIs and may stop working, and none are reviewed by the developers.',
                article('third-party')),
            L('getUsed() is the CPU time of your isolate since the loop began plus 0.2 per queued intent. The Memory save comes after the last reading you can take.',
                driver(RT + 'runtime.js', 'return nowCpuTime() + intents.cpu - startTime;'),
                driver(RT + 'runtime.js', 'outMessage.usedCleanTime = nowCpuTime() - startTime;')),
            L('After a tick the bucket is bucket + limit − charged CPU, cut at the bucket size. Two bucket readings one tick apart therefore give what the tick between them was charged, rounded up to a whole CPU.',
                driver(RT + 'make.js', 'var newCpuAvailable = userData.user.cpuAvailable + userData.user.cpu - cpuUsed;'),
                driver(RT + 'make.js', 'const cpuUsed = Math.ceil(runResult.usedCleanTime+intentsCpu);')),
            L('Official limits for requests with a token: GET /api/user/memory 1440 per day, GET /api/user/memory-segment 360 per hour. That is one read per minute or one per 10 seconds; when ticks are faster, keep the last ticks inside the object the collector reads.',
                article('auth-tokens')),
            L('Community practice: compare relative numbers only. The same code reads differently on the official server and on a private one, and the simulation gives no usable CPU reading at all.',
                wiki('CPU'), doc('Game.cpu.getUsed')),
            L('Community practice: graphs over days show what watching cannot: energy lost while a room changes level, CPU use that creeps up, a bucket that slowly drains.', wiki('Basic_debugging')),
        ],
        pitfalls: [
            L('A wrapper around a method that queues an intent books the 0.2 fee to that method, so Creep.move looks costly although its run time is small. Count intents apart from run time.',
                driver(RT + 'runtime.js', 'this.cpu += intentCpu;')),
            L('A wrapper must pass arguments and return value through, and must not be put on twice. The official prototype article shows the pattern with a guard.',
                article('contributed/modifying-prototypes')),
            L('Statistics kept in Memory are parsed with it every tick. Overwrite one object instead of appending history; history belongs in a segment or in the outside store.',
                eng(G + 'game.js', 'runCodeCache[userId].memory._parsed = JSON.parse(runCodeCache[userId].memory.get() || "{}");')),
            L('The first tick after a global reset compiles and loads every module. Record resets as a number of their own instead of letting them lift the average.',
                driver(RT + 'runtime-driver.js', 'var script = runtime.compileScriptSync(code, options);')),
        ],
        tables: [C => {
            const creeps = [10, 25, 50, 100, 200];
            return {
                title: 'CPU per tick that intents alone cost',
                head: ['creeps', '1 intent each', '2 intents each', '3 intents each', `3 each, over ${C.CREEP_LIFE_TIME} ticks`],
                rows: creeps.map(n => [n, r1(n * INTENT_CPU), r1(n * 2 * INTENT_CPU), r1(n * 3 * INTENT_CPU), Math.round(n * 3 * INTENT_CPU * C.CREEP_LIFE_TIME)]),
                foot: `${INTENT_CPU} CPU for every call that returns OK. A profile shows this share under the methods that queue intents; faster code does not shrink it, fewer calls do.`,
            };
        }],
        see: ['recipe:measure-cpu', 'recipe:save-cpu', 'mechanic:cpu', 'mechanic:intents', 'mechanic:web-api', 'Game.cpu.getUsed', 'Game.cpu.bucket', 'Game.cpu.getHeapStatistics',
            'RawMemory.segments', 'mechanic:notifications', 'recipe:prototype-extension', 'recipe:visual-debugging'],
        url: 'https://docs.screeps.com/third-party.html',
    },

    // ================================================================ toolchain
    {
        id: 'toolchain',
        basis: 'practice',
        topic: 'practice',
        title: 'Toolchain: typings, bundler, uploader, starter kit',
        summary: 'The server runs plain JavaScript modules with flat names. Everything else players use (TypeScript, folders, npm packages, other languages, automatic upload) is a build step on their own machine that ends in one upload of modules. The official third-party page lists the common tools; the developers review none of them.',
        tasks: [
            'typescript for screeps', 'bundle my code into one file', 'use folders in my code', 'starter kit for a new bot',
            'use npm packages', 'write my bot in rust or python', 'autocomplete for the game api', 'unit test my bot',
        ],
        steps: [
            { text: 'Ask whether you need a build step at all. The editor in the client, the folder sync of the Steam client and plain JavaScript modules work without one.' },
            { text: 'Typings: a package of declarations for the game API gives the editor completion and, with TypeScript, type checks before upload.' },
            { text: 'Language: TypeScript is compiled to JavaScript. Python and Kotlin are translated to JavaScript by their starter kits. Rust, C and C++ are compiled to WebAssembly and uploaded as a binary module next to a small JavaScript loader.' },
            { text: 'Bundler: joins your folders and npm packages into one main module and leaves out what is not used. Without one, flatten folder paths into module names (lib/util.js becomes lib_util) in a copy step.' },
            { text: 'Uploader: a task that posts the built modules to a branch with an auth token; recipe:upload-code has the request. Keep one target per server: main world, PTR, season, private server.' },
            { text: 'Starter kit: a repository in which typings, build and upload are already wired together. Take one for your language, then read its configuration before you trust it with a token.' },
            { text: 'Keep the token in a file that is not committed, and give it only the access the upload needs.' },
            { text: 'Tests: run pure logic (body builders, planners, queues) on your own machine against mocks of the game objects; run the whole bot on a private server or the PTR.' },
        ],
        notes: [
            L('The runtime knows only module names: require strips a leading "./" and looks the name up among the uploaded modules. There are no folders on the server.',
                eng(G + 'game.js', "moduleName = moduleName.replace(/^\\.\\//,'');")),
            L('A binary module comes back from require as its bytes; that is how WebAssembly built from other languages gets in.',
                eng(G + 'game.js', 'this.globals.require.cache[moduleName] = driver.bufferFromBase64(this.codeModules[moduleName].binary);'),
                article('modules')),
            L('lodash is built in, as the global _ and as require("lodash"). A bundler that packs its own copy makes the bundle larger for nothing; mark lodash as external.',
                eng(G + 'game.js', 'runCodeCache[userId].globals.require.cache = {lodash: runCodeCache[userId].globals._};')),
            L('The official third-party page names the tools of the table below, and warns that they rest on unofficial APIs, may stop working, are not reviewed by the developers and must never be given your password.',
                article('third-party')),
            L('The contributed grunt article shows the usual extras of a build: credentials in a file kept out of git, the branch chosen on the command line, folders flattened into module names, a version stamp in the code, upload to a private server.',
                article('contributed/advanced_grunt')),
            L('Community practice: the ways players push code are the editor in the client, the synced local folder, the GitHub sync, the web API driven by a task runner, and a bundler with an upload step.', wiki('Pushing_code_to_Screeps')),
            L('Community practice: starter kits and typings for more languages than the official page names are collected on the links page of the wiki.', wiki('Useful_Links')),
        ],
        pitfalls: [
            L('Every upload throws the global scope away: the next tick loads all modules again and finds every cache empty. A watch task that uploads on each saved file causes a reset each time.',
                driver(RT + 'user-vm.js', 'codeTimestamp > vms[userId].codeTimestamp')),
            L('The whole bundle is compiled in the first tick after each reset, on your CPU. Packages that are bundled but not used cost on every reset.',
                driver(RT + 'runtime-driver.js', 'var script = runtime.compileScriptSync(code, options);')),
            L('The error you get is the stack of the modules as they were uploaded: after bundling it points into the bundle, not into your source files. A source map can translate it; load it only when an error occurs, since it takes heap and CPU.',
                driver(RT + 'runtime.js', 'outMessage.error = _.isObject(e) && e.stack || e.toString();')),
            L('A compiler that renames property names breaks calls into the game API; the official page lists externs for that case. Leave the names of game objects and constants alone.', article('third-party')),
        ],
        tables: [() => ({
            kind: 'matrix',
            title: 'Kinds of tools and what each solves',
            head: ['kind', 'solves', 'named on the official third-party page'],
            rows: [
                ['typings and autocomplete', 'completion and type checks for the game API in the editor', 'typed-screeps, ScreepsAutocomplete, screeps-kotlin-types, closure-compiler-externs'],
                ['starter kit', 'a project with build and upload set up', 'screeps-typescript-starter, screeps-starter-python, screeps-starter-rust, screeps-kotlin-starter'],
                ['bundler', 'folders and npm packages become flat modules', 'none; the contributed grunt article flattens folders instead'],
                ['uploader', 'sends the built modules to a branch', 'grunt-screeps (by the Screeps team), gulp-screeps'],
                ['API client', 'own scripts that talk to the web API', 'node-screeps-api, python-screeps'],
                ['test server', 'runs code against a server in unit tests', 'screeps-server-mockup'],
                ['backup', 'saves and restores Memory and segments', 'screeps-backup'],
            ],
            foot: 'Profilers and statistics tools: recipe:profiling-and-stats.',
        })],
        see: ['recipe:upload-code', 'mechanic:web-api', 'mechanic:binary-modules', 'mechanic:code-execution', 'mechanic:client-tools', 'mechanic:ptr', 'article:modules',
            'recipe:profiling-and-stats', 'recipe:prototype-extension'],
        url: 'https://docs.screeps.com/third-party.html',
    },

    // ================================================================ prototypes
    {
        id: 'prototype-extension',
        basis: 'practice',
        topic: 'practice',
        title: 'Extend game prototypes and add console helpers',
        summary: 'A method or getter added to Creep.prototype, Room.prototype or another game class is there on every object of that class and stays until the next global reset. Players use this for shortcuts, cached lookups, wrapped built-in methods and commands to type in the console.',
        tasks: [
            'extend the creep prototype', 'add a method to all creeps', 'add a property to rooms', 'override moveTo', 'console helper functions',
            'cached getter on a room', 'give sources a memory', 'monkey patch a game method',
        ],
        steps: [
            { text: 'Put all extensions into modules that main requires at its top, outside the loop. They then run once per global reset, not once per tick.' },
            { text: 'A new method: assign a function to the prototype of the class. Inside it, this is the object the method was called on.' },
            { text: 'A new property: Object.defineProperty on the prototype with a get function and configurable: true. Keep the computed value on the object under another name; it is then computed once per tick and object.' },
            { call: 'Game.getObjectById', text: 'A value that should outlive the tick: keep ids in Memory or in the global scope and turn them into objects inside the getter.' },
            { text: 'Wrap a built-in method: keep the original under a new name, but only if that name is still free; then put a function in its place that does your extra work, calls the original with the same arguments and returns what it returned.' },
            { text: 'Console helpers: assign functions to global, or call your prototype methods on objects from the console (Game.rooms.W1N1.myReport()). Give global helpers a common prefix so they do not collide with later code.' },
            { text: 'Keep a list of what you changed. After an update of the game, compare your wrapped methods with the new behaviour.' },
        ],
        notes: [
            L('The game classes are made once per isolate. A change to a prototype stays until the global reset, and comes back when your module runs again after it.',
                eng(G + 'rooms.js', 'if(globals.Room) {')),
            L('Game objects are created anew every tick, so a value kept on the object itself is gone in the next tick.',
                eng(G + 'game.js', 'register._objects[i] = new globals.Creep(i);')),
            L('Every game object gets its own RoomPosition, made with new. Two positions for the same tile are different objects: a value cached on one is not on the other.',
                eng(G + 'rooms.js', 'this.pos = new globals.RoomPosition(x,y,room);'), wiki('Prototyping')),
            L('Game is a plain object built new each tick, not a class. What you assign to Game is gone next tick, and there is no prototype of it to extend.',
                eng(G + 'game.js', 'runCodeCache[userId].globals.Game = makeGameObject(runCodeCache[userId]);')),
            L('A console command is evaluated in the global scope of your script after the loop, so functions on global and methods on prototypes can be typed there.',
                eng(G + 'game.js', 'code: runCodeCache[userId].consoleCommands[i].expression')),
            L('The official contributed article walks through the patterns: adding methods, keeping the original before overwriting, passing arguments on, getters with a cache for the tick and with a cache in Memory, and a memory property for sources.',
                article('contributed/modifying-prototypes')),
            L('Community practice: prototypes for behaviour that belongs to one object (an own movement method on creeps, the sources of a room), functions on global for commands.', wiki('Prototyping'), wiki('Making_your_own_console_functions')),
        ],
        pitfalls: [
            L('The engine calls its own methods through the prototype: moveTo calls moveByPath, and moveByPath calls move. A replaced move changes all three; keep arguments and return codes as they were.',
                eng(G + 'creeps.js', 'var result = this.moveByPath(path);'),
                eng(G + 'creeps.js', 'return this.move(this.pos.getDirectionTo(path[idx]));')),
            L('A wrapper installed twice wraps itself and never reaches the original. Store the original only when it is not stored yet.',
                article('contributed/modifying-prototypes')),
            L('A game object keeps each property value from its first read. One held over in the global scope answers with the values of its own tick; cache the id and fetch the object again.',
                eng('src/utils.js', "this['_${name}'] = properties['${name}'](dataFn(this.id), this.id);")),
            L('Helpers on global and prototype changes are gone after a reset until the module runs again. Defined inside the loop they are redefined every tick for nothing; defined in a module that is never required they do not exist.',
                eng(G + 'game.js', 'if (!(moduleName in this.globals.require.cache)) {')),
            L('A getter that reads Memory (a memory property on sources) triggers the Memory parse like any other access.',
                eng(G + 'game.js', 'runCodeCache[userId].memory._parsed = JSON.parse(runCodeCache[userId].memory.get() || "{}");')),
        ],
        see: ['mechanic:code-execution', 'mechanic:console', 'recipe:cache-between-ticks', 'Game.getObjectById', 'Creep.moveTo', 'Creep.move', 'Memory', 'recipe:measure-cpu',
            'recipe:profiling-and-stats', 'recipe:toolchain'],
        url: 'https://docs.screeps.com/contributed/modifying-prototypes.html',
    },

    // ================================================================ nukes
    {
        id: 'nuke-response',
        basis: 'practice',
        topic: 'practice',
        title: 'Incoming nuke: protect, evacuate, rebuild; and where to aim one',
        summary: 'A nuke shows in FIND_NUKES for {{NUKE_LAND_TIME}} ticks before it lands. Players use that time to choose, structure by structure, between a rampart that takes the blast ({{NUKE_DAMAGE[2] * REPAIR_COST}} energy per tile in the outer ring, {{NUKE_DAMAGE[0] * REPAIR_COST}} on the centre tile) and rebuilding afterwards, and they move every creep out of the room before the landing tick.',
        tasks: [
            'what to do when a nuke is coming', 'nuke incoming', 'how to survive a nuke', 'rampart hits needed against a nuke', 'detect an incoming nuke',
            'where to aim a nuke', 'move creeps out before a nuke lands', 'is it cheaper to rebuild after a nuke',
        ],
        steps: [
            { call: 'Room.find', text: 'Detect: room.find(FIND_NUKES) in every owned room, every few hundred ticks. Each nuke gives pos, timeToLand and launchRoomName. Store them and notify yourself.' },
            { text: 'Map the blast: {{NUKE_DAMAGE[0]}} on the target tile, {{NUKE_DAMAGE[2]}} on each of the {{5 * 5 - 1}} tiles within range 2. Add up per tile over all nukes aimed at the room.' },
            { text: 'Choose per structure with the table: a rampart where rebuilding costs more or where the contents must survive (storage, terminal, labs, factory); let cheap structures go and rebuild them.' },
            { call: 'Creep.repair', text: 'Raise the chosen ramparts to the summed blast plus a margin: {{NUKE_DAMAGE[2] / REPAIR_POWER}} ticks of one WORK part per outer tile, {{NUKE_DAMAGE[0] / REPAIR_POWER}} for the centre. A creep with 20 WORK needs {{NUKE_DAMAGE[2] / (20 * REPAIR_POWER)}} ticks per outer tile.' },
            { call: 'Creep.withdraw', text: 'Empty what you leave unprotected. Carry the contents out of the blast or send them away through the terminal before the landing.' },
            { call: 'Nuke.timeToLand', text: 'Before the landing: move all creeps into a neighbouring room, let no spawn be busy (a body of {{MAX_CREEP_SIZE}} parts takes {{MAX_CREEP_SIZE * CREEP_SPAWN_TIME}} ticks), place no construction sites.' },
            { text: 'After the landing: bring the creeps back, place the sites again, refill the towers. For {{CONTROLLER_NUKE_BLOCKED_UPGRADE}} ticks the controller takes no upgrade and no safe mode; expect the attacker\'s creeps in that window.' },
            { call: 'StructureNuker.launchNuke', text: 'Aiming one yourself: choose the tile whose range 2 covers the most of spawns, towers, storage and terminal; read the rampart hits with an observer shortly before; send several nukes at one tile when a rampart holds more than one blast; let your creeps enter after the landing tick.' },
        ],
        notes: [
            L('A rampart takes the blast first, and only the damage above its hits reaches what stands under it. Hits equal to the blast are enough; the rampart is gone afterwards.',
                eng(P + 'nukes/tick.js', 'damage -= rampartHits;')),
            L('Every nuke is worked off by itself: two on one tile need a rampart worth both blasts.',
                eng(P + 'nukes/tick.js', 'damage = range == 0 ? C.NUKE_DAMAGE[0] : C.NUKE_DAMAGE[2];')),
            L('All creeps in the room die in the landing tick, under a rampart or not. Construction sites, dropped resources, tombstones and ruins are removed, and a spawn loses the creep it is making.',
                eng(P + 'nukes/tick.js', "require('../creeps/_die')(target, 0, true, scope, C.EVENT_ATTACK_TYPE_NUKE);"),
                eng(P + 'nukes/tick.js', "if(target.type == 'spawn' && target.spawning != null) {")),
            L('A structure destroyed by a nuke leaves no ruin: what it held is lost with it.',
                eng(P + 'structures/_destroy.js', 'if(!attackType || attackType != C.EVENT_ATTACK_TYPE_NUKE) {')),
            L('The landing ends a running safe mode and blocks the controller for {{CONTROLLER_NUKE_BLOCKED_UPGRADE}} ticks. While the block lasts, activateSafeMode does nothing.',
                eng(P + 'nukes/tick.js', 'upgradeBlocked: gameTime + C.CONTROLLER_NUKE_BLOCKED_UPGRADE'),
                eng(P + 'controllers/activateSafeMode.js', 'if(object.upgradeBlocked > gameTime) {')),
            L('A rampart can hold {{RAMPART_HITS_MAX[4]}} hits at room level 4 and {{RAMPART_HITS_MAX[5]}} at level 5. Below level 5 no rampart takes even the blast of the outer ring.',
                eng(P + 'ramparts/tick.js', 'var hitsMax = object.user == roomController.user ? C.RAMPART_HITS_MAX[roomController.level] || 0 : 0;')),
            L('Until the landing a rampart loses {{NUKE_LAND_TIME / RAMPART_DECAY_TIME * RAMPART_DECAY_AMOUNT}} hits to decay. Add that, or finish the repair late.',
                eng(P + 'ramparts/tick.js', 'object.hits -= C.RAMPART_DECAY_AMOUNT;')),
            L('Community practice: defenders answer a launch at once, with ramparts under the valuable structures in the blast, and keep their creeps in another room until the nuke has landed.', wiki('Combat'), wiki('Intermediate-level_tips')),
            L('Community practice on the attack: a nuke reaches the middle of a base without a breach, thins ramparts before creeps arrive and empties the room of defenders. Walls several layers thick are a favoured target.', wiki('Combat'), wiki('Intermediate-level_tips')),
        ],
        pitfalls: [
            L('The nuke strikes in the tick in which timeToLand reads 1. Creeps must have left by then; a repairer that stays to finish a rampart dies with what it carries.',
                eng(P + 'nukes/tick.js', 'if(gameTime == object.landTime-1) {'),
                eng(G + 'nukes.js', 'timeToLand: (o) => o.landTime - runtimeData.time,')),
            L('A landing does not hand you a fresh safe mode at once. The cooldown is cleared only when the nuke ended a running safe mode, and for {{CONTROLLER_NUKE_BLOCKED_UPGRADE}} ticks the blocked controller refuses activation either way.',
                eng(P + 'nukes/tick.js', 'safeModeCooldown: null'),
                eng(P + 'controllers/activateSafeMode.js', 'if(object.upgradeBlocked > gameTime) {')),
            L('Your own nuke kills your creeps in the target room as well. Keep the attack force outside until the tick after the landing.',
                eng(P + 'nukes/tick.js', "if (target.type == 'creep') {")),
            L('A launch costs {{NUKER_ENERGY_CAPACITY}} energy and {{NUKER_GHODIUM_CAPACITY}} ghodium and the nuker then waits {{NUKER_COOLDOWN}} ticks; the defender sees the target tile for {{NUKE_LAND_TIME}} ticks and can raise ramparts exactly there.',
                eng(G + 'structures.js', 'if(this.energy < this.energyCapacity || this.ghodium < this.ghodiumCapacity) {')),
        ],
        tables: [C => {
            const outer = Math.round(C.NUKE_DAMAGE[2] * C.REPAIR_COST), centre = Math.round(C.NUKE_DAMAGE[0] * C.REPAIR_COST);
            const types = ['extension', 'link', 'tower', 'observer', 'spawn', 'storage', 'lab', 'terminal', 'factory', 'powerSpawn', 'nuker'];
            return {
                title: 'Rampart or rebuild, per structure in the blast',
                head: ['structure', 'energy to rebuild', 'rampart for the outer ring', 'rampart for the centre tile', 'cheaper in the outer ring'],
                rows: types.map(t => [t, C.CONSTRUCTION_COST[t], outer, centre, C.CONSTRUCTION_COST[t] < outer ? 'rebuild' : C.CONSTRUCTION_COST[t] === outer ? 'equal' : 'rampart']),
                foot: `Rampart energy: the blast times ${C.REPAIR_COST} energy per hit, for a rampart built up from nothing; one that stands needs only the difference. Rebuilding also costs what the structure held and the ticks until it works again.`,
            };
        }],
        constants: ['NUKE_DAMAGE', 'NUKE_LAND_TIME', 'NUKE_RANGE', 'NUKER_COOLDOWN', 'NUKER_ENERGY_CAPACITY', 'NUKER_GHODIUM_CAPACITY', 'CONTROLLER_NUKE_BLOCKED_UPGRADE',
            'RAMPART_HITS_MAX', 'REPAIR_POWER', 'REPAIR_COST', 'RAMPART_DECAY_AMOUNT', 'RAMPART_DECAY_TIME'],
        see: ['mechanic:nukes', 'mechanic:ramparts-and-walls', 'mechanic:safe-mode', 'recipe:keep-ramparts-up', 'recipe:defend-a-room', 'recipe:attack-a-room', 'Nuke', 'Nuke.timeToLand',
            'Nuke.launchRoomName', 'StructureNuker.launchNuke', 'Game.notify', 'const:nukes'],
    },

    // ================================================================ visuals
    {
        id: 'visual-debugging',
        basis: 'practice',
        topic: 'practice',
        title: 'Debug by looking: say, room visuals, map visuals',
        summary: 'Three ways to see what the code thinks, each lasting one tick: a speech bubble over a creep (10 characters, no intent fee), drawings in a room (up to 500 KB per room and tick) and drawings on the world map (up to 1000 KB per tick). Players show creep states, paths, targets and plans with them.',
        tasks: [
            'show what a creep is doing', 'visualize a path', 'draw my base plan in the room', 'debug with room visuals', 'emoji in creep say',
            'see the state of each creep', 'visual debugging', 'turn visuals on and off',
        ],
        steps: [
            { call: 'Creep.say', text: 'State of a creep: say() a short code or one icon per state (harvest, haul, build, flee). Any Unicode character works.' },
            { call: 'Creep.moveTo', text: 'Paths: pass visualizePathStyle to moveTo while you debug movement, or draw a stored path with RoomVisual.poly.' },
            { call: 'RoomVisual.text', text: 'Numbers where they belong: text next to a structure for its energy or queue, next to a source for the miner assigned to it, next to the controller for progress per tick.' },
            { call: 'RoomVisual.circle', text: 'Targets and plans: a circle on the tile a creep is locked on, a mark on the planned tile of each structure, the tiles of a cost matrix above a value.' },
            { call: 'Game.map.visual.line', text: 'Across rooms: map visuals for routes, the remotes of each room, the age of scouting data, marks on rooms with threats.' },
            { call: 'RoomVisual.export', text: 'A drawing that does not change (a base plan): draw it once, keep the export string in the global scope, and import it on later ticks instead of drawing shape by shape.' },
            { text: 'Give every kind of visual a switch: a flag in Memory or on global that you set from the console, per room. Drawings for rooms nobody looks at are wasted CPU.' },
            { call: 'Memory', text: 'For one value over time use the Memory panel of the client instead of a drawing: mechanic:client-tools.' },
        ],
        notes: [
            L('say() shows the first 10 characters for one tick and is free of the intent fee. With true as the second argument other players see the bubble too.',
                eng(P + 'creeps/say.js', 'message: intent.message.substring(0,10),'),
                driver(RT + 'runtime.js', 'freeMethods = systemFunctions.Object.create(null, {say: {value: true}, pull:{value:true}});')),
            L('Visuals are text collected during the tick: up to 500 KB per room and 1000 KB for the map. The call that goes over throws.',
                eng(G + 'console.js', 'const sizeLimit = roomName == "map" ? 1000 : 500;')),
            L('A drawing call queues no intent. Its cost is the run time of building the text, which grows with every shape.',
                eng(G + 'console.js', 'visual[id][roomName] += dataString;')),
            L('Visuals are stored for your account under the number of the tick: only you see them, and they must be drawn again every tick.',
                driver(RT + 'make.js', "env.keys.ROOM_VISUAL + userData.user._id + ',' + roomName + ',' + data.time,")),
            L('Community practice: one icon per creep state shows a wrong state at a glance; the wiki keeps a table of icons for actions and structures.', wiki('Visuals_emoji')),
            L('Community practice: room visuals for paths, the status of structures, CPU and whole dashboards; map visuals for scouting, observers and long routes.', wiki('Basic_debugging')),
        ],
        pitfalls: [
            L('A creep shows only its last say() of the tick. Role code and movement code that both speak overwrite each other.',
                driver(RT + 'runtime.js', 'this.list[id][name] = data;')),
            L('Many icons are two or more characters long for the cut at 10: an icon with text behind it can lose its end.',
                eng(P + 'creeps/say.js', 'message: intent.message.substring(0,10),')),
            L('A dashboard drawn in every room on every tick is paid in every room on every tick. Draw on request, and only the room you watch.',
                eng(G + 'console.js', 'visual[id][roomName] += dataString;')),
        ],
        tables: [() => ({
            kind: 'matrix',
            title: 'What each one shows and costs',
            head: ['', 'lasts', 'limit', 'seen by', 'intent fee'],
            rows: [
                ['Creep.say', '1 tick', '10 characters', 'you; everyone with public set', 'none'],
                ['RoomVisual', '1 tick', '500 KB per room', 'you', 'none'],
                ['Game.map.visual', '1 tick', '1000 KB', 'you', 'none'],
                ['Memory panel of the client', 'while open', 'the watched path', 'you', 'none, but the value must be in Memory'],
            ],
        })],
        see: ['Creep.say', 'RoomVisual', 'RoomVisual.text', 'RoomVisual.poly', 'RoomVisual.export', 'RoomVisual.import', 'Game.map.visual', 'Creep.moveTo',
            'mechanic:client-tools', 'mechanic:console', 'recipe:profiling-and-stats', 'article:debugging'],
        url: 'https://docs.screeps.com/debugging.html',
    },

    // ================================================================ diplomacy
    {
        id: 'diplomacy',
        basis: 'practice',
        topic: 'practice',
        title: 'Talk to other players: signs, say, public segments, messages, alliances',
        summary: 'What the game offers for dealing with neighbours: a sign of up to 100 characters on any controller, speech bubbles that others can see, memory segments that the code of another player can read, the message box of the client, and resources sent through terminals. An alliance is an agreement between players and nothing more: to the game every other player is the same.',
        tasks: [
            'how to talk to another player', 'make peace with a neighbour', 'what is an alliance', 'leave a message on a controller', 'do my towers shoot allies',
            'whitelist allied creeps', 'let an ally through my ramparts', 'send resources to an ally',
        ],
        steps: [
            { text: 'Find out who the neighbour is: the owner and the sign of their rooms (controller.owner.username, controller.sign), what their creeps say in public, their profile in the client.' },
            { call: 'Creep.signController', text: 'Say what you intend where they will read it: sign your own controllers and those of the rooms you use (remotes, a room you plan to claim). Any creep next to a controller can sign it.' },
            { text: 'Write to them. The client has a message box for every player, reached from the profile. For anything that needs a yes from the other side (a border, a remote, passage) a direct message is the first step.' },
            { text: 'Agree on rules that code can keep: which rooms are whose, which creeps may pass where, what is traded for what.' },
            { call: 'Creep.owner', text: 'Teach your code the agreement: a list of friendly user names in Memory, checked wherever the game says hostile: tower targets, defender targets, the trigger of safe mode, the choice of rangedMassAttack.' },
            { call: 'StructureRampart.setPublic', text: 'Passage: open the ramparts on the agreed way with setPublic(true) while no enemy is in the room, and close them when one shows up.' },
            { call: 'RawMemory.setPublicSegments', text: 'Contact between programs: publish a segment with what others should know (resources you ask for, rooms under attack, your list of friends) and read theirs: recipe:share-data-with-an-ally.' },
            { call: 'StructureTerminal.send', text: 'Help: send resources with terminal.send, where the description says what it is for, or join a defence with creeps.' },
            { text: 'Alliances: groups of players with a shared list of friends, a chat channel and often a common segment format. One joins by asking its members.' },
        ],
        notes: [
            L('The game has no status of friend: FIND_HOSTILE_CREEPS returns every creep that is not yours, the creeps of an ally among them.',
                eng(G + 'game.js', '[C.FIND_HOSTILE_CREEPS]: (i) => !i.spawning && !i.my,')),
            L('A sign holds up to 100 characters and shows the name of the signer and the time. Signing needs range 1 and no body part, on any controller; an empty text removes the sign.',
                common('lib/system.js', "signController: { id: 'string', sign: 'userString'},"),
                common('lib/system.js', "'userString': value => (\"\" + (value||\"\")).substring(0, 100),"),
                eng(P + 'creeps/signController.js', 'bulk.update(target, {sign: intent.sign ? {')),
            L('What a creep of another player said is in creep.saying only when it was said with public set.',
                eng(G + 'creeps.js', 'return o.actionLog.say.isPublic ? o.actionLog.say.message : undefined;')),
            L('A public segment can be read by every player who knows your name, not only by friends.',
                driver(RT + 'data.js', 'env.get(env.keys.PUBLIC_MEMORY_SEGMENTS+result[0].activeForeignSegment.user_id)')),
            L('The description of a terminal transfer, up to 100 characters, is stored with the transaction and shows in the incoming transactions of the receiver.',
                eng(G + 'structures.js', 'if(description && (!_.isString(description) || description.length > 100)) {'),
                eng('src/processor/global-intents/market.js', "description: intent.description ? intent.description.replace(/</g, '&lt;') : undefined")),
            L('Open backend: a message is text of up to {{100 * 1024}} characters. The addressee finds it in the message box and gets a notification.',
                backend('lib/game/api/user-messages.js', 'if(!_.isString(request.body.text) || request.body.text.length > 100*1024) {'),
                backend('lib/game/api/user-messages.js', 'sendMessageNotification(request.body.respondent,')),
            L('The terms of service forbid harassing or threatening material; signs, public say and messages are read by people and fall under them.', article('tos')),
            L('Community practice: players reach each other through the messages of the client, controller signs, public say and public segments, and through the community chat outside the game.', wiki('Community_Communication')),
            L('Community practice: alliances rest on mutual defence, trade and sometimes shared code. A community site keeps a public register of alliances and their members.', wiki('Alliances')),
            L('Community practice: an account that runs an open-source bot unchanged is called an NCP (non-coding player). The terms of service allow it, but the wiki reports that many players are hostile to such accounts; say in a sign or a message what you run and what you intend.', wiki('Community_Communication')),
        ],
        pitfalls: [
            L('An agreement that your code does not know is broken by your own towers, since the default target list holds every foreign creep. Put the names in before the ally arrives.',
                eng(G + 'game.js', '[C.FIND_HOSTILE_CREEPS]: (i) => !i.spawning && !i.my,')),
            L('rangedMassAttack damages everything in range that another player owns, allies included. Next to friendly creeps use rangedAttack.',
                eng(P + 'creeps/rangedMassAttack.js', "return (!_.isUndefined(i.user) || i.type == 'powerBank') && i.user != object.user &&")),
            L('A public rampart lets the creeps of every other player through, friend or not, and covers whoever stands on it.',
                eng(P + 'movement.js', "i.type == 'rampart' && !i.isPublic && i.user != object.user ||")),
            L('Your safe mode stops allies as well: while it runs, the creeps of every other player in the room can neither heal nor attack. Helpers are of use before it starts or after it ends.',
                eng(P + 'creeps/heal.js', 'if(roomController && roomController.user != object.user && roomController.safeMode > gameTime) {'),
                eng(P + 'creeps/attack.js', 'if(roomController && roomController.user != object.user && roomController.safeMode > gameTime) {')),
        ],
        tables: [() => ({
            kind: 'matrix',
            title: 'Channels to another player',
            head: ['channel', 'set with', 'limit', 'who sees it', 'read by code as'],
            rows: [
                ['controller sign', 'Creep.signController', '100 characters', 'everyone who looks at the room', 'controller.sign'],
                ['public say', 'Creep.say(text, true)', '10 characters, one tick', 'everyone who sees the creep', 'creep.saying'],
                ['public segment', 'RawMemory.setPublicSegments', '100 KB per segment', 'every player who asks for it', 'RawMemory.foreignSegment'],
                ['transfer description', 'StructureTerminal.send', '100 characters', 'sender and receiver', 'Game.market.incomingTransactions'],
                ['message in the client', 'the profile of the player', '100 KB of text', 'the addressee', 'not readable by code'],
            ],
        })],
        see: ['recipe:share-data-with-an-ally', 'Creep.signController', 'StructureController.sign', 'Creep.say', 'Creep.saying', 'RawMemory.setPublicSegments', 'RawMemory.foreignSegment',
            'StructureRampart.setPublic', 'StructureTerminal.send', 'mechanic:terminal-transfers', 'mechanic:safe-mode', 'recipe:tower-logic', 'recipe:defend-a-room', 'mechanic:account-rules'],
    },
];
