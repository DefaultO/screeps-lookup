'use strict';
/*
 * Figures of the server pack (private server): {entry id: [figure, ...]}.
 * Ports, defaults and limits are the ones the entry text gives; game numbers come from the constants (C).
 * Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n, seq } = h;
    const gclPoints = level => Math.round(C.GCL_MULTIPLY * Math.pow(level - 1, C.GCL_POW));
    const JOB_SECONDS = 5 * 60;   // the NPC jobs of the backend run every 5 minutes

    return {
        // ------------------------------------------------------------ mechanics
        'mechanic:ps-cli': [
            {
                type: 'flow', title: 'A line typed into the server CLI', cell: [176, 62],
                caption: 'The CLI server runs inside the backend process and listens on port 21026 in the stock setup. Each line is run as JavaScript in a sandbox that holds five objects; when the result is a promise, the prompt waits and prints what it resolves to. The port asks for no password.',
                nodes: [
                    { id: 't', at: [0, 0], text: 'npx screeps cli', sub: 'one line of JavaScript', mono: true },
                    { id: 'sb', at: [1, 0], text: 'Sandbox in the backend', sub: 'runs it, prints the result', tone: 'accent' },
                    { id: 'o', at: [2, 0], text: 'system, map,\nbots, strongholds', sub: 'commands' },
                    { id: 'st', at: [2, 1], text: 'storage', sub: 'db, env, pubsub' },
                ],
                edges: [{ from: 't', to: 'sb', both: true, label: 'port 21026' }, { from: 'sb', to: 'o', label: 'calls' }, { from: 'sb', to: 'st' }],
            },
            {
                type: 'ladder', title: 'The objects of the prompt and their commands',
                caption: '`help()` lists the objects; `help(system)`, `help(map)`, `help(bots)` and `help(strongholds)` list these commands. A server with mods may show more.',
                groups: [
                    { title: '`system`', note: 'the server as a whole', items: ['resetAllData', 'sendServerMessage', 'pauseSimulation', 'resumeSimulation', 'getTickDuration', 'setTickDuration', 'runCronjob'] },
                    { title: '`map`', note: 'rooms and terrain', items: ['generateRoom', 'removeRoom', 'closeRoom', 'openRoom', 'updateRoomImageAssets', 'updateTerrainData'] },
                    { title: '`bots`', note: 'bot players', items: ['spawn', 'reload', 'removeUser'] },
                    { title: '`strongholds`', note: 'NPC strongholds', items: ['spawn', 'expand'] },
                    { title: '`storage`', note: 'the data itself: database, key-value store, event bus', items: ['db', 'env', 'pubsub'] },
                ],
            },
        ],
        'mechanic:ps-config': [
            {
                type: 'flow', title: 'The processes of a stock server', cell: [140, 56],
                caption: 'The launcher starts one storage, one backend and one main process plus the runners and processors, and starts any of them again when it exits. Each writes its own log file, `<logdir>/<name>.log`. The game port and the admin console both belong to the backend.',
                nodes: [
                    { id: 'l', at: [0, 0], span: 4, text: 'Launcher: npx screeps start', sub: 'reads .screepsrc, starts every process, starts it again when it exits', tone: 'accent' },
                    { id: 'be', at: [0, 1], text: 'backend', sub: 'ports 21025 and 21026', mono: true },
                    { id: 'em', at: [1, 1], text: 'engine_main', sub: 'one process', mono: true },
                    { id: 'er', at: [2, 1], text: 'engine_runner1…', sub: 'runners_cnt: 1', mono: true },
                    { id: 'ep', at: [3, 1], text: 'engine_processor1…', sub: 'processors_cnt: 2', mono: true },
                    { id: 'st', at: [0, 2], span: 4, text: 'storage', sub: 'every other process reaches it through STORAGE_PORT', mono: true },
                ],
                edges: [
                    { from: 'l', to: 'be', label: 'starts' }, { from: 'l', to: 'em' }, { from: 'l', to: 'er' }, { from: 'l', to: 'ep' }, { from: 'l', to: 'st' },
                    { from: 'be', to: 'st', label: 'requests' }, { from: 'em', to: 'st' }, { from: 'er', to: 'st' }, { from: 'ep', to: 'st' },
                ],
            },
            {
                type: 'timeline', title: 'restart_interval works once', span: 7200, unit: 'seconds since the launcher started', ticks: [0, 3600, 7200],
                caption: 'After `restart_interval` seconds, 3600 in the stock file, the launcher kills each runner and processor, and they are started again at once. The process that comes back has no timer, so this happens once per launcher start.',
                rows: [
                    { label: 'Runner or processor', segs: [{ from: 0, to: 3600, text: 'first process', tone: 'a' }, { from: 3600, to: 7200, text: 'second process, no timer', tone: 'warn' }], marks: [{ at: 3600, text: 'killed, started again' }] },
                    { label: 'storage, backend, main', segs: [{ from: 0, to: 7200, text: 'not restarted by the timer', tone: 'dim' }] },
                ],
            },
        ],
        'mechanic:ps-mods': [
            {
                type: 'flow', title: 'Every process loads every mod', cell: [196, 64],
                caption: 'Each process calls every mod once with its own `config`. `config.common` is there in all of them; the other parts exist only in the processes shown, so a mod tests for the part it needs, for example `if(config.backend)`.',
                nodes: [
                    { id: 'mj', at: [0, 0], span: 3, text: 'mods.json', sub: 'mods: a list of script paths; bots: AI name to folder', tone: 'accent' },
                    { id: 'be', at: [0, 1], text: 'backend', sub: 'config.backend, .cli, .cronjobs' },
                    { id: 'en', at: [1, 1], text: 'engine_main, runners,\nprocessors', sub: 'config.engine' },
                    { id: 'st', at: [2, 1], text: 'storage', sub: 'config.storage' },
                    { id: 'cm', at: [0, 2], span: 3, text: 'config.common, in every process', sub: 'constants, strongholds, system, bots, storage, dbCollections' },
                ],
                edges: [{ from: 'mj', to: 'be', label: 'mod(config)' }, { from: 'mj', to: 'en', label: 'mod(config)' }, { from: 'mj', to: 'st', label: 'mod(config)' }],
            },
            {
                type: 'ladder', title: 'Events a mod can listen to',
                caption: 'The five events of the first row arrive in this order for each room. Setting `object._skip = true` in `processObject` leaves that object alone for the tick.',
                groups: [
                    { title: 'While a room is processed', note: 'on `config.engine`; `processObject` comes for every object, before the intents', ordered: true, items: ['processObject', 'preProcessObjectIntents', 'processObjectIntents', 'postProcessObject', 'processRoom'] },
                    { title: 'Loops and player scripts', note: 'on `config.engine`: the stages of the three loops, and `playerSandbox` before each run of a player script', items: ['mainLoopStage', 'runnerLoopStage', 'processorLoopStage', 'playerSandbox'] },
                    { title: 'Other engine events', note: 'on `config.engine`: which process this is, a finished chunk of room history, a destroyed invader core', items: ['init', 'saveRoomHistory', 'strongholdDestroyed'] },
                    { title: 'Backend', note: 'on `config.backend`; `cliSandbox` is on `config.cli`', items: ['expressPreConfig', 'expressPostConfig', 'sendUserNotifications', 'cliSandbox'] },
                ],
            },
        ],
        'mechanic:ps-differences': [
            {
                type: 'cols', title: 'Ticks between two runs of a 5-minute job', x: { label: 'ticks per second', cats: ['1', '2', '5', '10'] }, y: { label: 'ticks that pass between two checks' },
                caption: 'Raids, power banks, deposits, strongholds and NPC market orders are checked every 5 minutes of real time. The faster the server ticks, the more ticks pass before something that is due appears.',
                series: [{ name: 'ticks', values: [1, 2, 5, 10].map(rate => JOB_SECONDS * rate) }],
            },
            {
                type: 'flow', title: 'When the server stops running a script', cell: [180, 64],
                caption: 'A player without any object in the world is set inactive and the script is no longer run. Uploading code or placing a spawn makes the account active again.',
                nodes: [
                    { id: 'a', at: [0, 0], text: 'Active', sub: 'the script runs', tone: 'good' },
                    { id: 'b', at: [1, 0], text: 'Inactive', sub: 'the script is not run', tone: 'dim' },
                ],
                edges: [{ from: 'a', to: 'b', both: true, label: ['no object left in the world →', '← code upload or a new spawn'] }],
            },
        ],
        'mechanic:ps-tick-rate': [
            {
                type: 'timeline', title: 'How long a tick lasts', span: 6000, unit: 'milliseconds since the tick began', ticks: seq(0, 6000, 1000),
                caption: 'After a tick the main loop waits for what is left of `mainLoopMinDuration`, 1000 ms by default. A tick that needs longer is followed by the next at once. One that is still running after `mainLoopResetInterval`, 5000 ms, makes the main process log a reset and reset its work queues.',
                rows: [
                    { label: 'Tick needs 300 ms', segs: [{ from: 0, to: 300, tone: 'energy' }, { from: 300, to: 1000, text: 'waits', tone: 'dim' }], marks: [{ at: 1000, text: 'next tick' }] },
                    { label: 'Tick needs 1,400 ms', segs: [{ from: 0, to: 1400, text: 'works', tone: 'energy' }], marks: [{ at: 1400, text: 'next tick at once' }] },
                    { label: 'Tick needs over 5,000 ms', segs: [{ from: 0, to: 6000, text: 'still working', tone: 'energy' }], marks: [{ at: 5000, text: '"Main loop reset!" in the log', tone: 'bad' }] },
                ],
            },
            {
                type: 'flow', title: 'Which tick length the main process uses', cell: [186, 54],
                caption: '`system.setTickDuration(ms)` stores the value and tells the running main process, which uses it from then on. At every start the main process loads the mods first and then takes the stored value, so a mod that sets `mainLoopMinDuration` loses on a server that has run before.',
                nodes: [
                    { id: 'cli', at: [0, 0], text: 'system.setTickDuration', sub: 'in the CLI', mono: true },
                    { id: 'key', at: [1, 0], text: 'Stored key tickRate', sub: 'survives restarts' },
                    { id: 'main', at: [2, 0], text: 'engine_main', sub: 'mainLoopMinDuration', tone: 'accent' },
                    { id: 'mod', at: [2, 1], text: 'A mod', sub: 'sets mainLoopMinDuration', tone: 'dim' },
                ],
                edges: [{ from: 'cli', to: 'key', label: 'stores' }, { from: 'key', to: 'main', label: 'at start' }, { from: 'mod', to: 'main', dashed: true, label: 'overwritten' }],
            },
            {
                type: 'timeline', title: 'Pausing stops the ticks, not the timed jobs', span: 30, unit: 'minutes (an example)', ticks: [0, 10, 20, 30],
                caption: '`system.pauseSimulation()` makes the main loop skip every tick until `system.resumeSimulation()`, and the game time stands still. The backend goes on with its timed jobs, so raids, power banks and NPC orders are still created.',
                rows: [
                    { label: 'Ticks', segs: [{ from: 0, to: 10, text: 'running', tone: 'good' }, { from: 10, to: 20, text: 'paused', tone: 'dim' }, { from: 20, to: 30, text: 'running', tone: 'good' }], marks: [{ at: 10, text: 'pauseSimulation()' }, { at: 20, text: 'resumeSimulation()' }] },
                    { label: 'Timed jobs of the backend', segs: [{ from: 0, to: 30, text: 'keep running: raids, power banks, NPC orders', tone: 'warn' }] },
                ],
            },
        ],
        'mechanic:ps-auth': [
            {
                type: 'flow', title: 'Signing in with Steam', cell: [176, 54],
                caption: 'The only sign-in route takes a Steam ticket and answers with a token. The backend checks the ticket through the Steam Web API when `steam_api_key` is set, otherwise through the Steam client on its own machine; with neither it does not start. The first sign-in of a Steam id creates the user, with CPU 100.',
                nodes: [
                    { id: 'pl', at: [0, 0], text: 'Steam game client', sub: 'of the player', tone: 'energy' },
                    { id: 'be', at: [1, 0], text: 'Backend', sub: 'POST /api/auth/steam-ticket', tone: 'accent' },
                    { id: 'api', at: [2, 0], text: 'Steam Web API', sub: 'if steam_api_key is set' },
                    { id: 'tok', at: [0, 1], text: 'Token', sub: 'valid for 60 seconds' },
                    { id: 'usr', at: [1, 1], text: 'User document', sub: 'made at the first sign-in' },
                    { id: 'loc', at: [2, 1], text: 'Local Steam client', sub: 'if no key is set' },
                ],
                edges: [
                    { from: 'pl', to: 'be', label: 'ticket' }, { from: 'be', to: 'api', label: 'checks it' }, { from: 'be', to: 'loc', dashed: true },
                    { from: 'be', to: 'usr', label: 'creates' }, { from: 'be', to: 'tok' },
                ],
            },
            {
                type: 'timeline', title: 'A token lasts 60 seconds, every answer brings the next', span: 180, unit: 'seconds since the sign-in', ticks: [0, 60, 120, 180],
                caption: 'A token is valid for 60 seconds. Every authenticated answer carries a new one in its `X-Token` header, so a tool goes on with the newest. The times of the two requests are examples.',
                rows: [
                    { label: 'Token of the sign-in', segs: [{ from: 0, to: 60, text: 'valid', tone: 'a' }] },
                    { label: 'Token of the answer at 40 s', segs: [{ from: 40, to: 100, text: 'valid', tone: 'a' }], marks: [{ at: 40, text: 'request' }] },
                    { label: 'Token of the answer at 90 s', segs: [{ from: 90, to: 150, text: 'valid', tone: 'a' }], marks: [{ at: 90, text: 'request' }] },
                ],
            },
        ],
        'mechanic:ps-storage': [
            {
                type: 'flow', title: 'One storage process holds all data', cell: [176, 56],
                caption: 'The storage process holds the collections, the key-value store, the event bus and the work queues of the tick loop. Every other process reaches it over one socket. The file is written by the autosave every 10 seconds only, so the last seconds before a stop can be lost.',
                nodes: [
                    { id: 'p', at: [0, 0], text: 'backend, engine_main,\nrunners, processors' },
                    { id: 's', at: [1, 0], text: 'storage process', sub: 'keeps the data in memory', tone: 'accent' },
                    { id: 'f', at: [2, 0], text: 'db.json', sub: 'not written on exit', mono: true },
                    { id: 'db', at: [0, 1], text: 'storage.db', sub: 'collections (LokiJS)', mono: true },
                    { id: 'env', at: [1, 1], text: 'storage.env', sub: 'names and values', mono: true },
                    { id: 'ps', at: [2, 1], text: 'storage.pubsub', sub: 'events between processes', mono: true },
                ],
                edges: [
                    { from: 'p', to: 's', both: true, label: 'one socket' }, { from: 's', to: 'f', label: 'every 10 s' },
                    { from: 's', to: 'db', dashed: true }, { from: 's', to: 'env', dashed: true, label: 'holds' }, { from: 's', to: 'ps', dashed: true },
                ],
            },
        ],

        // ------------------------------------------------------------ recipes
        'recipe:ps-admin-db': [
            {
                type: 'cols', title: 'What to write into the gcl field', x: { label: 'GCL level wanted', cats: seq(1, 8).map(String) }, y: { label: 'points in the field gcl' },
                caption: `The field holds points, not the level: level N needs ${n(C.GCL_MULTIPLY)} × (N − 1)^${C.GCL_POW}.`,
                series: [{ name: 'points', values: seq(1, 8).map(gclPoints) }],
            },
        ],
        'recipe:ps-map': [
            {
                type: 'scene', title: 'Exits of a generated room', size: [11, 6],
                terrain: ['...##.....#', '...xx.....#', '...xx.....x', '...xx.....x', '...##.....x', '...##.....#'],
                caption: 'A side you leave out of `exits` is copied from the neighbour room, so the open edge tiles line up. Where there is no neighbour the exit is drawn at random. A side you give must be equal to the neighbour\'s, or the command fails.',
                arrows: [{ from: [3, 2], to: [4, 2], tone: 'accent', gap: [0.3, 0.3] }],
                notes: [
                    { at: [1, 0], text: 'existing room', strong: true }, { at: [7, 0], text: 'new room', strong: true },
                    { at: [5, 1.8], text: ['exit copied from', 'the neighbour'], anchor: 'start' },
                    { at: [9, 3.3], text: ['no neighbour:', 'exit at random'], anchor: 'end' },
                ],
            },
            {
                type: 'flow', title: 'The status of a room', cell: [176, 68],
                caption: 'A generated room is `normal` at once. `map.closeRoom` sets `out of borders`; `map.openRoom` sets `normal` again, at once or from a time you give. `map.removeRoom` deletes the room with everything in it, without asking.',
                nodes: [
                    { id: 'gen', at: [0, 0], text: 'map.generateRoom', sub: 'random terrain', mono: true },
                    { id: 'nm', at: [1, 0], text: 'normal', sub: 'in play', tone: 'good' },
                    { id: 'ob', at: [2, 0], text: 'out of borders', sub: 'out of play', tone: 'dim' },
                    { id: 'rm', at: [1, 1], text: 'map.removeRoom', sub: 'room and contents deleted', tone: 'bad', mono: true },
                ],
                edges: [
                    { from: 'gen', to: 'nm' },
                    { from: 'nm', to: 'ob', both: true, label: ['closeRoom →', '← openRoom'] },
                    { from: 'nm', to: 'rm' },
                ],
            },
        ],
        'recipe:ps-bots': [
            {
                type: 'flow', title: 'One AI folder, any number of bot users', cell: [176, 54],
                caption: 'An AI is a name in `mods.json` that points at a folder. `bots.spawn(aiName, roomName)` makes a user whose code is the `.js` files directly in that folder; the user keeps the AI name in its `bot` field. `bots.reload(aiName)` reads the folder again for all users of that AI.',
                nodes: [
                    { id: 'mj', at: [0, 0], text: 'mods.json: bots', sub: 'AI name → folder' },
                    { id: 'dir', at: [1, 0], text: 'AI folder', sub: 'main.js and flat .js files', tone: 'accent' },
                    { id: 'u1', at: [2, 0], text: 'Bot user', sub: 'Spawn1, room level 1' },
                    { id: 'u2', at: [2, 1], text: 'Bot user', sub: 'same AI, another room' },
                ],
                edges: [{ from: 'mj', to: 'dir', label: 'names' }, { from: 'dir', to: 'u1', label: 'bots.spawn' }, { from: 'dir', to: 'u2' }],
            },
        ],
        'recipe:ps-npcs': [
            {
                type: 'flow', title: 'A raid needs all six', cell: [200, 54],
                caption: 'The raid job runs every 300 seconds and raids a room only when all six hold. `invaderGoal: 1` on the room switches the energy test off; the other five still apply. A room with your creeps in it is usually in the active set, so a raid that is due can take several runs of the job.',
                nodes: [
                    { id: 'c1', at: [0, 0], text: 'Room status normal' },
                    { id: 'c2', at: [0, 1], text: 'Not in the active set', sub: 'at the moment the job runs' },
                    { id: 'c3', at: [0, 2], text: 'No invader alive', sub: 'in the room' },
                    { id: 'c4', at: [2, 0], text: 'Energy harvested', sub: 'at or above invaderGoal' },
                    { id: 'c5', at: [2, 1], text: 'Core of level 1 or more', sub: 'in the same sector' },
                    { id: 'c6', at: [2, 2], text: 'A free exit', sub: 'neighbour not owned or reserved' },
                    { id: 'r', at: [1, 1], text: 'Raid', sub: 'job genInvaders', tone: 'bad' },
                ],
                edges: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(id => ({ from: id, to: 'r' })),
            },
            {
                type: 'timeline', title: 'When a stronghold deploys', span: 5000, unit: 'ticks since the core was placed',
                caption: 'Until `deployTime` is reached a stronghold is only its core, which cannot be damaged, and ramparts with 1 hit. The ones the server makes take 5000 ticks; one placed with `strongholds.spawn` deploys after 1 tick unless you pass `deployTime`.',
                rows: [
                    { label: 'Made by the server', segs: [{ from: 0, to: 5000, text: 'core that cannot be damaged, ramparts with 1 hit', tone: 'dim' }], marks: [{ at: 5000, text: 'deploys', tone: 'bad' }] },
                    { label: 'strongholds.spawn', marks: [{ at: 1, text: 'deploys after 1 tick', tone: 'bad' }] },
                ],
            },
            {
                type: 'bars', title: 'Prices of NPC orders',
                caption: 'Terminals without an owner get new orders about every 5000 ticks: always one sell order for a base mineral, half of the time one for energy, a quarter of the time a buy order for a base mineral.',
                rows: [
                    { label: 'H, O', sub: 'NPC sells', value: 3, text: '3 credits' },
                    { label: 'Z, K, U, L', sub: 'NPC sells', value: 6, text: '6 credits' },
                    { label: 'X', sub: 'NPC sells', value: 18, text: '18 credits' },
                    { label: 'Energy', sub: 'NPC sells', value: 1, text: '1 credit', tone: 'energy' },
                    { label: 'Base mineral', sub: 'NPC buys', value: 1, text: '1 credit', tone: 'dim' },
                ],
            },
        ],
        'recipe:ps-reset-and-backup': [
            {
                type: 'timeline', title: 'The file is written every 10 seconds, not on exit', span: 30, unit: 'seconds', ticks: [0, 10, 20, 30],
                caption: 'The storage writes `db.json` every 10 seconds and not when it exits. A change is on disk only after the next write: wait that long after the last change before you stop the server or copy the file.',
                rows: [
                    { label: 'db.json', marks: [{ at: 10, text: 'written' }, { at: 20, text: 'written' }, { at: 30, text: 'written' }] },
                    { label: 'A change at 22 s', segs: [{ from: 22, to: 30, text: 'in memory only', tone: 'warn' }], marks: [{ at: 30, text: 'on disk' }] },
                    { label: 'Server stopped at 26 s', segs: [{ from: 22, to: 26, text: 'lost', tone: 'bad' }], marks: [{ at: 26, text: 'no write on exit' }] },
                ],
            },
        ],
        'recipe:ps-upload-code': [
            {
                type: 'flow', title: 'Two ways onto a private server', cell: [176, 54],
                caption: 'The Steam client uploads a local script folder by itself. A tool posts `{branch, modules}` to the game port over plain HTTP, into a branch that exists already. The route wants a token and the stock server gives tokens only for a Steam ticket, so a login mod has to add a password login. With a server password every request also carries `X-Server-Password`.',
                nodes: [
                    { id: 'sc', at: [0, 0], text: 'Steam client', sub: 'syncs a local folder', tone: 'energy' },
                    { id: 'code', at: [2, 0], text: 'Your code', sub: 'in a branch on the server', tone: 'accent' },
                    { id: 'tl', at: [0, 1], text: 'Your tool', sub: 'for example grunt-screeps', tone: 'energy' },
                    { id: 'rt', at: [1, 1], text: 'POST /api/user/code', sub: 'port 21025, plain HTTP' },
                    { id: 'md', at: [0, 2], text: 'Login mod', sub: 'password login for tools' },
                ],
                edges: [{ from: 'sc', to: 'code', label: 'uploads' }, { from: 'tl', to: 'rt', label: 'modules' }, { from: 'rt', to: 'code' }, { from: 'md', to: 'tl', dashed: true, label: 'token' }],
            },
        ],
        'recipe:ps-write-a-mod': [
            {
                type: 'flow', title: 'A custom object type: which hook does what', cell: [196, 54],
                caption: 'A custom type is a document in `rooms.objects`. `registerCustomObjectPrototype` gives player scripts a class for it; a method added there queues an intent, which gets through only when its name and fields are declared, and the mod carries it out in `processObjectIntents`. Logic for every tick goes into `processObject`.',
                nodes: [
                    { id: 'doc', at: [0, 0], text: 'Document in rooms.objects', sub: 'type: "myobject"', tone: 'accent' },
                    { id: 'cls', at: [1, 0], text: 'Class in player scripts', sub: 'registerCustomObjectPrototype' },
                    { id: 'm', at: [2, 0], text: 'A method of the class', sub: 'calls scope.intents.set', tone: 'energy' },
                    { id: 'chk', at: [2, 1], text: 'customIntentTypes', sub: 'only declared names and fields' },
                    { id: 'h', at: [1, 1], text: 'processObjectIntents', sub: 'the mod carries it out' },
                    { id: 'tick', at: [0, 1], text: 'processObject', sub: 'logic for every tick' },
                ],
                edges: [{ from: 'doc', to: 'cls' }, { from: 'cls', to: 'm' }, { from: 'm', to: 'chk', label: 'intent' }, { from: 'chk', to: 'h' }, { from: 'tick', to: 'doc', label: 'updates' }],
            },
        ],
        'recipe:ps-custom-graphics': [
            {
                type: 'flow', title: 'What a client draws a custom object from', cell: [200, 54],
                caption: 'The backend sends `config.backend.renderer`, its metadata and resources, to clients as part of the server info. The processors of a type say what to draw, `$state` reads a field of the game object, and `{ASSETS_URL}` in a resource path stands for the `/assets` address of the server.',
                nodes: [
                    { id: 'mod', at: [0, 0], text: 'Mod, in the backend', sub: 'renderer.metadata, .resources' },
                    { id: 'obj', at: [0, 1], text: 'Game object of the type', sub: 'its fields, such as score' },
                    { id: 'as', at: [0, 2], text: 'Asset folder', sub: 'image files' },
                    { id: 'c', at: [1, 1], text: 'Client', sub: 'runs the processors', tone: 'accent' },
                ],
                edges: [{ from: 'mod', to: 'c', label: 'server info', dx: 40, dy: -12 }, { from: 'obj', to: 'c', label: '$state reads fields' }, { from: 'as', to: 'c', label: '{ASSETS_URL}', dx: 40, dy: 22 }],
            },
        ],
        'recipe:ps-room-history': [
            {
                type: 'flow', title: 'The two halves a history mod supplies', cell: [176, 54],
                caption: 'The stock server keeps no history. A mod saves each chunk on the `saveRoomHistory` event, which arrives in the processors, and returns it from `config.backend.onGetRoomHistory`, which runs in the backend. Both halves must reach the same files or database.',
                nodes: [
                    { id: 'pr', at: [0, 0], text: 'Processor', sub: 'stores each tick of a room' },
                    { id: 'ev', at: [1, 0], text: 'saveRoomHistory', sub: 'every 20 ticks: one chunk', mono: true },
                    { id: 'sv', at: [2, 0], text: 'Your storage', sub: 'files or a database', tone: 'accent' },
                    { id: 'cl', at: [1, 1], text: 'Client', sub: 'asks /room-history' },
                    { id: 'gt', at: [2, 1], text: 'onGetRoomHistory', sub: 'stock: "not implemented"', mono: true },
                ],
                edges: [{ from: 'pr', to: 'ev' }, { from: 'ev', to: 'sv', label: 'mod saves' }, { from: 'cl', to: 'gt', label: 'room, time' }, { from: 'sv', to: 'gt', label: 'mod reads' }],
            },
            {
                type: 'timeline', title: 'Which ticks make a chunk', span: 40, unit: 'game time', ticks: [0, 20, 40],
                caption: 'Chunks are `historyChunkSize` ticks long, 20 by default. Every 20 ticks the driver puts the previous chunk together and emits it as `saveRoomHistory`. The first tick of a chunk holds all objects, each later tick only what changed.',
                rows: [
                    { label: 'Ticks of one room', segs: [{ from: 0, to: 20, text: 'chunk with base 0', tone: 'a' }, { from: 20, to: 40, text: 'chunk with base 20', tone: 'b' }], marks: [{ at: 20, text: 'chunk 0 is emitted' }, { at: 40, text: 'chunk 20 is emitted' }] },
                ],
            },
        ],
        'recipe:ps-community-stack': [
            {
                type: 'flow', title: 'A usual community setup', cell: [200, 54],
                caption: 'Community practice: a community launcher, usually in Docker, starts the server. The five mods are the ones the contributed official guide installs. The stock server already sets the tick length from the CLI, with `system.setTickDuration`.',
                nodes: [
                    { id: 'l', at: [1, 0], text: 'Community launcher', sub: 'usually in Docker', tone: 'accent' },
                    { id: 's', at: [1, 1], text: 'Private server', sub: 'loads the mods of mods.json', tone: 'energy' },
                    { id: 'm1', at: [0, 0], text: 'screepsmod-auth', sub: 'a password for tools', mono: true },
                    { id: 'm2', at: [0, 1], text: 'screepsmod-mongo', sub: 'storage in MongoDB and Redis', mono: true },
                    { id: 'm3', at: [0, 2], text: 'screepsmod-tickrate', sub: 'tick rate from the CLI', mono: true },
                    { id: 'm4', at: [2, 0], text: 'screepsmod-admin-utils', sub: 'more CLI functions', mono: true },
                    { id: 'm5', at: [2, 1], text: 'screepsmod-features', sub: 'tells clients what it supports', mono: true },
                ],
                edges: [{ from: 'l', to: 's', label: 'starts' }].concat(['m1', 'm2', 'm3', 'm4', 'm5'].map(id => ({ from: id, to: 's' }))),
            },
        ],
    };
};
