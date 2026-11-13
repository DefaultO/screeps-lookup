'use strict';
/*
 * Figures of the platform pack (account, web API, tools): {entry id: [figure, ...]}.
 * Numbers are the ones the entry text gives, or come from the constants (C).
 * Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 */
module.exports = (C, h) => {
    const { n } = h;
    const HOUR = 3600 * 1000, DAY = 24 * HOUR;
    const pcSpawn = C.POWER_CREEP_SPAWN_COOLDOWN / HOUR, pcDelete = C.POWER_CREEP_DELETE_COOLDOWN / HOUR;

    return {
        // ------------------------------------------------------------ mechanics
        'mechanic:web-api': [
            {
                type: 'flow', title: 'A token request on the official server', cell: [164, 54],
                caption: 'Every request signed with a token counts toward 120 per minute in total and toward a lower limit on some endpoints. Over a limit the answer is `429` and its text gives the wait in milliseconds. The three `X-RateLimit` headers of an answer tell where you stand.',
                nodes: [
                    { id: 'tool', at: [0, 0], text: 'Your tool', sub: 'X-Token header or _token', tone: 'energy' },
                    { id: 'lim', at: [1, 0], text: 'Token limits', sub: '120 per minute in total' },
                    { id: 'ok', at: [2, 0], text: 'JSON answer', sub: 'ok: 1 when it worked', tone: 'good' },
                    { id: 'over', at: [1, 1], text: 'HTTP 429', sub: 'text: the wait in ms', tone: 'bad' },
                    { id: 'hdr', at: [2, 1], text: 'X-RateLimit headers', sub: 'Limit, Remaining, Reset' },
                ],
                edges: [{ from: 'tool', to: 'lim', label: 'request' }, { from: 'lim', to: 'ok', label: 'under' }, { from: 'lim', to: 'over', label: 'over a limit' }, { from: 'ok', to: 'hdr', label: 'carries' }],
            },
            {
                type: 'bars', title: 'Official token limits per endpoint, as requests in 24 hours',
                caption: 'Each bar is the most one token can send in 24 hours: a daily limit as it is, an hourly limit times 24. All of these requests also count toward the 120 per minute in total. The names are short for the paths under `/api/user/` and `/api/game/`.',
                rows: [
                    { label: 'POST code', sub: 'also set-active-branch and POST memory', value: 240, text: '240 / day' },
                    { label: 'GET code', sub: 'also POST memory-segment, map-stats, market, money-history', value: 60 * 24, text: '60 / hour' },
                    { label: 'GET memory', value: 1440, text: '1440 / day' },
                    { label: 'GET memory-segment', sub: 'also POST console and room-terrain', value: 360 * 24, text: '360 / hour' },
                ],
            },
            {
                type: 'flow', title: 'Signing in on the socket', cell: [190, 58],
                caption: 'Open backend: the socket is SockJS under `/socket`. Left is what your tool sends, right what the server sends. After `subscribe` every event of that channel arrives as a JSON array of channel and data.',
                nodes: [
                    { id: 'c', at: [0, 0], text: 'connect', sub: 'your tool, to /socket' },
                    { id: 'g', at: [1, 0], text: 'time <ms>\nprotocol <n>', mono: true },
                    { id: 'a', at: [0, 1], text: 'auth <token>', sub: 'your tool sends', mono: true },
                    { id: 'r', at: [1, 1], text: 'auth ok <new token>', sub: 'or: auth failed', mono: true },
                    { id: 's', at: [0, 2], text: 'subscribe <channel>', sub: 'your tool sends', mono: true },
                    { id: 'e', at: [1, 2], text: '[channel, data]', sub: 'one for each event', mono: true },
                ],
                edges: [
                    { from: 'c', to: 'g', label: 'server sends' }, { from: 'a', to: 'r', label: 'answer' }, { from: 's', to: 'e', label: 'events' },
                    { from: 'c', to: 'a', dashed: true, label: 'then' }, { from: 'a', to: 's', dashed: true, label: 'then' },
                ],
            },
        ],
        'mechanic:account-resources': [
            {
                type: 'bars', title: 'CPU limit of an account', unit: 'CPU',
                caption: 'On the official server full CPU comes from a subscription or from CPU unlock items, 24 hours each; the limit then grows with the GCL until it reaches 300. A private server gives every new account 100 and does not look at the GCL.',
                rows: [
                    { label: 'Official server', sub: 'without full CPU', value: 20, tone: 'dim' },
                    { label: 'Official server', sub: 'full CPU: 10 more for each GCL level', value: 300, text: 'up to 300 CPU' },
                    { label: 'Private server', sub: 'new account, whatever its GCL', value: 100, tone: 'b' },
                ],
            },
            {
                type: 'flow', title: 'Account resources on the official server', cell: [150, 54],
                caption: `Three calls each use something up: \`generatePixel\` takes ${n(C.PIXEL_CPU_COST)} CPU from the bucket for one pixel, \`unlock\` one \`${C.CPU_UNLOCK}\` for 24 hours of full CPU, \`activateAccess\` one \`${C.ACCESS_KEY}\` for 30 days on a restricted shard. All three resources trade on the market without a terminal.`,
                nodes: [
                    { id: 'bucket', at: [0, 0], text: 'CPU bucket', sub: `${n(C.PIXEL_CPU_COST)} CPU a pixel`, tone: 'energy' },
                    { id: 'pixel', at: [1, 0], text: C.PIXEL, mono: true },
                    { id: 'full', at: [0, 1], text: 'Full CPU', sub: 'for 24 hours', tone: 'good' },
                    { id: 'unlock', at: [1, 1], text: C.CPU_UNLOCK, mono: true },
                    { id: 'access', at: [0, 2], text: 'Shard access', sub: 'for 30 days', tone: 'good' },
                    { id: 'key', at: [1, 2], text: C.ACCESS_KEY, mono: true },
                    { id: 'market', at: [2, 1], text: 'Market', sub: 'needs no terminal', tone: 'accent' },
                ],
                edges: [
                    { from: 'bucket', to: 'pixel', label: 'generatePixel()' },
                    { from: 'unlock', to: 'full', label: 'unlock()' },
                    { from: 'key', to: 'access', label: 'activateAccess()' },
                    { from: 'pixel', to: 'market', both: true }, { from: 'unlock', to: 'market', both: true, label: 'buy and sell' }, { from: 'key', to: 'market', both: true },
                ],
            },
        ],
        'mechanic:real-time': [
            {
                type: 'timeline', title: 'Timers that follow the clock, up to one day', span: 24, unit: 'hours', ticks: [0, 2, 8, 12, 24],
                caption: `None of these counts ticks. The respawn wait, the lifted rate limit, the CPU unlock and \`setShardLimits\` are those of the official server. Longer ones are the market order, removed ${C.MARKET_ORDER_LIFE_TIME / DAY} days after it was created, the 30 days of shard access from a key, and the PTR copy every Monday.`,
                rows: [
                    { label: 'Respawn wait', segs: [{ from: 0, to: 180 / 3600, tone: 'bad' }], marks: [{ at: 180 / 3600, text: '180 seconds, then a new first spawn' }] },
                    { label: 'Lifted rate limit', segs: [{ from: 0, to: 2, text: '2 h', tone: 'a' }] },
                    { label: 'Dead power creep', segs: [{ from: 0, to: pcSpawn, text: `no spawn for ${pcSpawn} h`, tone: 'bad' }] },
                    { label: 'setShardLimits', segs: [{ from: 0, to: 12, text: 'once per 12 h', tone: 'bad' }] },
                    { label: 'CPU unlock', segs: [{ from: 0, to: 24, text: 'full CPU for 24 h', tone: 'good' }] },
                    { label: 'Deleting a power creep', segs: [{ from: 0, to: pcDelete, text: `takes ${pcDelete} h`, tone: 'a' }] },
                    { label: 'Experimentation period', segs: [{ from: 0, to: 24, text: 'lasts 24 h', tone: 'a' }] },
                ],
            },
        ],
        'mechanic:notifications': [
            {
                type: 'flow', title: 'From a message to the mail on a private server', cell: [168, 54],
                caption: 'Every message is stored first. Once a minute the backend takes the messages of an account that are due, at most one batch per interval (60 minutes unless set), and hands them to the event. The open backend sends no mail itself.',
                nodes: [
                    { id: 'n1', at: [0, 0], text: 'Game.notify', sub: 'at most 20 per tick', tone: 'energy' },
                    { id: 'n2', at: [0, 1], text: 'The game', sub: 'attacks, level changes' },
                    { id: 'n3', at: [0, 2], text: 'Uncaught script error' },
                    { id: 'q', at: [1, 1], text: 'Stored message', sub: 'waits until it is due' },
                    { id: 'ev', at: [2, 1], text: 'sendUserNotifications', sub: 'the backend sends no mail', tone: 'accent' },
                ],
                edges: [{ from: 'n1', to: 'q' }, { from: 'n2', to: 'q' }, { from: 'n3', to: 'q' }, { from: 'q', to: 'ev', label: 'once a minute' }],
            },
            {
                type: 'timeline', title: 'Game.notify with groupInterval 30', span: 60, unit: 'minutes past the hour', ticks: [0, 15, 30, 45, 60],
                caption: 'Open private server: a message waits for the next full interval mark of the clock, here every 30 minutes. The same text queued again before that mark only raises the count of the stored message.',
                rows: [
                    { label: 'Calls with the same text', marks: [{ at: 4, text: 'call' }, { at: 11 }, { at: 19 }, { at: 41, text: 'call' }] },
                    { label: 'Stored message', segs: [{ from: 4, to: 30, text: 'one message, count 3', tone: 'warn' }, { from: 41, to: 60, text: 'count 1', tone: 'warn' }], marks: [{ at: 30, text: 'due' }, { at: 60, text: 'due' }] },
                ],
            },
        ],
        'mechanic:console': [
            {
                type: 'flow', title: 'From a console command to its result', cell: [170, 54],
                caption: 'A command waits until your script runs again, then runs once after `loop` has returned, and its CPU counts toward that tick. Open private server: log lines and results are published on the channel after the tick and are not kept for a client that subscribes later.',
                nodes: [
                    { id: 'cmd', at: [0, 0], text: 'Console command', sub: 'typed, or sent over HTTP' },
                    { id: 'wait', at: [1, 0], text: 'Waiting commands', sub: 'each one runs once' },
                    { id: 'run', at: [2, 0], text: 'Your script run', sub: 'loop first, then commands', tone: 'energy' },
                    { id: 'chan', at: [2, 1], text: 'user:<id>/console', sub: 'published, not kept', mono: true },
                    { id: 'out', at: [0, 1], text: 'Client console', sub: 'log lines and results' },
                ],
                edges: [{ from: 'cmd', to: 'wait', label: 'queued' }, { from: 'wait', to: 'run', label: 'next tick' }, { from: 'run', to: 'chan', label: 'after tick' }, { from: 'chan', to: 'out', label: 'output' }],
            },
        ],
        'mechanic:ptr': [
            {
                type: 'timeline', title: 'Two weeks on the PTR', span: 14, unit: 'days, counted from a Monday at 0:00 UTC', ticks: [0, 7, 14],
                caption: 'Every Monday at 0:00 UTC the main world and all accounts are copied to the PTR and what was on it is wiped: the code you uploaded there, and the free CPU subscription you turned on. The days of the upload and the order are examples.',
                rows: [
                    { label: 'PTR world', segs: [{ from: 0, to: 7, text: 'copy of the main world', tone: 'a' }, { from: 7, to: 14, text: 'new copy', tone: 'a' }], marks: [{ at: 7, text: 'Monday: wiped, copied anew' }] },
                    { label: 'Code uploaded there', segs: [{ from: 2, to: 7, text: 'runs', tone: 'good' }], marks: [{ at: 2, text: 'upload' }, { at: 7, text: 'gone' }] },
                    { label: 'Free CPU subscription', segs: [{ from: 1, to: 7, text: 'on until the reset', tone: 'energy' }], marks: [{ at: 1, text: 'ordered' }, { at: 7, text: 'off again' }] },
                ],
            },
        ],
        'mechanic:client-tools': [
            {
                type: 'flow', title: 'A test invader is created when all three hold', cell: [140, 54],
                caption: 'Open backend: otherwise the request is refused with "not owned", "too many invaders exist" or "hostiles present". The creep is an ordinary Invader: it fights for real and its hits send no attack notification.',
                nodes: [
                    { id: 'a', at: [0, 0], text: 'The room is yours', sub: 'owned or reserved' },
                    { id: 'b', at: [1, 0], text: 'Under 5 invaders', sub: 'in the room already' },
                    { id: 'c', at: [2, 0], text: 'No other player', sub: 'has a creep there' },
                    { id: 'd', at: [3, 0], text: 'Test invader', sub: 'lives 1,500 ticks', tone: 'bad' },
                ],
                edges: [{ from: 'a', to: 'b', label: 'and' }, { from: 'b', to: 'c', label: 'and' }, { from: 'c', to: 'd' }],
            },
        ],
        'mechanic:simulation': [
            {
                type: 'flow', title: 'Where your script runs', cell: [160, 54],
                caption: 'In simulation mode the script runs in your browser and the server takes no part, so run time is not limited, `Game.cpu.getUsed()` returns 0 and nothing runs while you are away. In the world the script runs on the server whether you are there or not.',
                nodes: [
                    { id: 'sim', at: [0, 0], text: 'Simulation', sub: 'the room named sim', tone: 'accent' },
                    { id: 'b1', at: [1, 0], text: 'Your browser', sub: 'runs the script', tone: 'energy' },
                    { id: 'c1', at: [2, 0], text: 'No time limit', sub: 'getUsed() returns 0' },
                    { id: 'world', at: [0, 1], text: 'World' },
                    { id: 'srv', at: [1, 1], text: 'Server', sub: 'runs the script', tone: 'energy' },
                    { id: 'c2', at: [2, 1], text: 'Keeps running', sub: 'while you are away' },
                ],
                edges: [{ from: 'sim', to: 'b1', label: 'your code' }, { from: 'b1', to: 'c1', label: 'so' }, { from: 'world', to: 'srv', label: 'your code' }, { from: 'srv', to: 'c2', label: 'so' }],
            },
        ],
        'mechanic:binary-modules': [
            {
                type: 'flow', title: 'From a binary module to functions you can call', cell: [138, 54],
                caption: '`require` of a binary module returns its bytes, not an exports object. `WebAssembly.Module` compiles them and `WebAssembly.Instance` gives the functions. Only the bytes are cached, so compile and instantiate outside `loop` and keep the instance.',
                nodes: [
                    { id: 'm', at: [0, 0], text: 'Binary module', sub: '{binary: "<base64>"}' },
                    { id: 'r', at: [1, 0], text: 'require(name)', sub: 'returns the bytes', mono: true },
                    { id: 'c', at: [2, 0], text: 'Compile', sub: 'WebAssembly.Module', tone: 'warn' },
                    { id: 'i', at: [3, 0], text: 'Instantiate', sub: 'WebAssembly.Instance', tone: 'warn' },
                    { id: 'k', at: [2, 1], span: 2, text: 'Once, outside loop. Then call the exports', tone: 'warn' },
                ],
                edges: [{ from: 'm', to: 'r' }, { from: 'r', to: 'c', label: 'bytes' }, { from: 'c', to: 'i' }, { from: 'k', to: 'c', dashed: true }, { from: 'k', to: 'i', dashed: true }],
            },
        ],

        // ------------------------------------------------------------ recipes
        'recipe:upload-code': [
            {
                type: 'flow', title: 'From an upload to the code that runs', cell: [170, 54],
                caption: 'Open backend: an upload replaces the whole module set of one branch; without `branch` it goes to the one that runs in the world. A branch runs only where it is active, `activeWorld` for the world and `activeSim` for the simulation, and `POST /api/user/set-active-branch` moves either mark to another branch. Which branch carries which mark is an example here.',
                nodes: [
                    { id: 'up', at: [0, 0], text: 'POST /api/user/code', sub: '{branch, modules}', tone: 'energy' },
                    { id: 'b1', at: [1, 0], text: 'Branch default', sub: 'whole module set replaced' },
                    { id: 'w', at: [2, 0], text: 'World', sub: 'fresh global scope', tone: 'accent' },
                    { id: 'b2', at: [1, 1], text: 'Any other branch', sub: 'up to 30 in all' },
                    { id: 's', at: [2, 1], text: 'Simulation' },
                ],
                edges: [{ from: 'up', to: 'b1', label: 'modules' }, { from: 'up', to: 'b2', dashed: true }, { from: 'b1', to: 'w', label: 'activeWorld' }, { from: 'b2', to: 's', label: 'activeSim' }],
            },
        ],
    };
};
