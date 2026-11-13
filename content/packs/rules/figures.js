'use strict';
/*
 * Figures of the pack "rules": {entry id: [figure, ...]}. Numbers come from the constants (C).
 * Formats: CONTRIBUTING.md, "Figures". Helpers: content/_fig.js.
 *
 * The season rules are not part of the game's constants. Their numbers are written once below, as
 * the entries state them, with the file of the public season mod (sources/mod-season*) they are in.
 */
module.exports = (C, h) => {
    const { n, seq } = h;
    const grid = (w, hh, fn) => seq(0, hh - 1).map(y => seq(0, w - 1).map(x => fn(x, y)).join(''));

    // season 1: scoreContainer.roomObject.js (cycle, the two windows), scoreCollector.roomObject.js (wall radius)
    const S1 = { cycle: 50000, none: [10000, 15000], double: [45000, 50000], wallRadius: 5 };
    // season 2: resources.js, CONTROLLER_LEVEL_SCORE_MULTIPLIERS, by room level 0 to 8
    const S2_MULTIPLIER = [0, 1, 1, 1, 3, 9, 27, 81, 243];
    // season 5: thorium.js (penalty) and reactor.roomObject.js (score), both by the power of ten
    const thoriumPenalty = total => Math.floor(Math.log10(total));
    const reactorScore = ticks => 1 + Math.floor(Math.log10(1 + ticks));
    const band = (from, to) => n(from) + '–' + n(to);

    return {
        'mechanic:limits': [{
            type: 'ladder', title: 'What happens above a limit',
            caption: 'Most caps answer with an error code. The others are silent in your code: a text is cut, a call returns OK and is dropped, or the check only runs after the tick.',
            groups: [
                {
                    title: 'An error code comes back', note: 'ERR_INVALID_ARGS, ERR_FULL, ERR_RCL_NOT_ENOUGH or ERR_GCL_NOT_ENOUGH; nothing happens',
                    items: ['name of a creep, spawn, power creep or flag', 'terminal send description', `body over ${C.MAX_CREEP_SIZE} parts`, `${C.MAX_CONSTRUCTION_SITES} construction sites`, `${n(C.FLAGS_LIMIT)} flags`, 'structures per room level', 'rooms per GCL level',`${C.GCL_NOVICE} rooms in a novice area`, `${C.MARKET_MAX_ORDERS} market orders`, 'deals per tick', 'notify calls per tick', `power creep level ${C.POWER_CREEP_MAX_LEVEL}`],
                },
                { title: 'The text is cut', note: 'the call returns OK', items: ['say text', 'controller sign', 'notify text'] },
                { title: 'The call is dropped', note: 'it still returns OK', items: ['cancelOrder', 'changeOrderPrice', 'extendOrder', 'PowerCreep.create', 'power creep rename, upgrade, delete, spawn, suicide'] },
                { title: 'The call throws', items: ['RawMemory.set over the Memory size', 'setActiveSegments with too many ids', 'a room visual over its size', 'the map visual over its size'] },
                { title: 'It fails after your code has run', note: 'a Memory object that is too large is not saved; a bad segment loses the intents and Memory changes of the tick', items: ['Memory object too large', 'segment too long or not a string', 'too many entries in RawMemory.segments'] },
            ],
        }],

        'mechanic:season-1': [
            {
                type: 'timeline', title: `One cycle of ${n(S1.cycle)} ticks`, span: S1.cycle, unit: 'tick of the cycle', ticks: [0, S1.none[0], S1.none[1], S1.double[0], S1.cycle],
                caption: `The map runs in cycles of ${n(S1.cycle)} ticks. From tick ${n(S1.none[0])} to ${n(S1.none[1])} of a cycle no score containers appear; in the last ${n(S1.double[1] - S1.double[0])} ticks they hold double.`,
                rows: [{
                    label: 'Score containers',
                    segs: [{ from: 0, to: S1.none[0], text: 'appear', tone: 'a' }, { from: S1.none[0], to: S1.none[1], text: 'none', tone: 'bad' }, { from: S1.none[1], to: S1.double[0], text: 'appear', tone: 'a' }, { from: S1.double[0], to: S1.double[1], text: 'double', tone: 'energy' }],
                }],
            },
            {
                type: 'map', title: 'A score collector inside its walls', cell: 16,
                caption: `Every tile up to ${S1.wallRadius} tiles around a collector is a wall: a block of ${2 * S1.wallRadius + 1} by ${2 * S1.wallRadius + 1} with the collector in the middle. A wall has 70 to 130 million hits, about one in five 300 million.`,
                rows: grid(2 * S1.wallRadius + 3, 2 * S1.wallRadius + 3, (x, y) => { const d = Math.max(Math.abs(x - S1.wallRadius - 1), Math.abs(y - S1.wallRadius - 1)); return d === 0 ? 'c' : d <= S1.wallRadius ? 'w' : '.'; }),
                key: { c: { label: 'score collector', tone: 'c' }, w: { label: 'wall', tone: 'a', weak: true }, '.': { label: 'open tile' } },
            },
        ],
        'mechanic:season-2': [{
            type: 'cols', title: 'What a decoded symbol is worth, by room level', x: { label: 'level of the room the decoder stands in', cats: seq(0, 8).map(String) }, y: { label: 'score per unit decoded' },
            caption: 'Decoding credits the amount times the multiplier of the room\'s controller level: 1 up to level 3, then three times as much with every level. In a room at level 0 nothing is credited.',
            series: [{ name: 'multiplier', values: S2_MULTIPLIER }],
        }],
        'mechanic:season-5': [
            {
                type: 'cols', title: 'Thorium on a tile and the ticks it takes', x: { label: 'thorium in all stores on one tile', cats: seq(0, 3).map(e => band(Math.pow(10, e), Math.pow(10, e + 1) - 1)) }, y: { label: 'ticks taken from every object on the tile, per tick' },
                caption: 'Each tick the thorium in all stores on a tile is added up and floor(log10(total)) ticks are taken from every object there: life from a creep, decay time from anything else. Below 10 it costs nothing, and 100 costs twice as much as 99.',
                series: [{ name: 'ticks', values: seq(0, 3).map(e => thoriumPenalty(Math.pow(10, e))) }],
            },
            {
                type: 'panels', title: 'The penalty counts the whole tile',
                caption: 'A hauler standing on a container that holds thorium ages by the sum of both loads, and the container decays faster too.',
                panels: [
                    {
                        tag: 'Apart: 60 and 50', tone: 'good', size: [6, 3],
                        things: [{ is: 'creep', at: [1, 1], body: 'CCMM', carry: 0.6, label: ['60 thorium', `−${thoriumPenalty(60)} tick per tick`] }, { is: 'container', at: [4, 1], fill: 0.3, label: ['50 thorium', `−${thoriumPenalty(50)} tick per tick`] }],
                    },
                    {
                        tag: 'On one tile: 110', tone: 'bad', size: [6, 3],
                        things: [{ is: 'container', at: [2, 1], under: true }, { is: 'creep', at: [2, 1], body: 'CCMM', carry: 0.6, label: ['110 thorium on the tile', `−${thoriumPenalty(110)} ticks per tick for both`] }],
                    },
                ],
            },
            {
                type: 'cols', title: 'Score of a reactor per tick', x: { label: 'ticks of continuous work', cats: seq(0, 4).map(e => band(e ? Math.pow(10, e) - 1 : 0, Math.pow(10, e + 1) - 2)) }, y: { label: 'score per tick' },
                caption: 'An owned reactor that holds thorium burns 1 per tick and gives 1 + floor(log10(1 + ticks of continuous work)) score. One tick without thorium puts the count back to zero.',
                series: [{ name: 'score', values: seq(0, 4).map(e => reactorScore(e ? Math.pow(10, e) - 1 : 0)) }],
            },
        ],

        'recipe:tutorial-walkthrough': [
            {
                type: 'flow', title: 'The harvester of section 1', cell: [150, 50],
                caption: 'Every action in the tutorial follows one pattern: call it, and when it returns ERR_NOT_IN_RANGE call moveTo with the same target.',
                nodes: [
                    { id: 'q', at: [0, 0], text: 'Free capacity left?' },
                    { id: 'h', at: [1, 0], text: 'harvest(source)', mono: true, tone: 'energy' },
                    { id: 't', at: [1, 1], text: 'transfer(spawn)', mono: true, tone: 'energy' },
                    { id: 'mh', at: [2, 0], text: 'moveTo(source)', mono: true },
                    { id: 'mt', at: [2, 1], text: 'moveTo(spawn)', mono: true },
                ],
                edges: [{ from: 'q', to: 'h', label: 'yes' }, { from: 'q', to: 't', label: 'no' }, { from: 'h', to: 'mh', label: 'ERR_NOT_IN_RANGE' }, { from: 't', to: 'mt', label: 'ERR_NOT_IN_RANGE' }],
            },
            {
                type: 'flow', title: 'The two states of the builder', cell: [150, 50],
                caption: 'The builder of section 3 keeps a flag in its memory and switches only at the ends: it builds until it is empty and harvests until it is full. It says a word at each switch.',
                nodes: [
                    { id: 'h', at: [0, 0], text: 'harvesting', sub: 'flag off', tone: 'energy' },
                    { id: 'f', at: [1, 0], text: 'Store full?' },
                    { id: 'b', at: [1, 1], text: 'building', sub: 'flag on', tone: 'good' },
                    { id: 'e', at: [0, 1], text: 'Store empty?' },
                ],
                edges: [{ from: 'h', to: 'f' }, { from: 'f', to: 'b', label: 'yes' }, { from: 'b', to: 'e' }, { from: 'e', to: 'h', label: 'yes' }],
            },
        ],
        'recipe:troubleshooting': [
            {
                type: 'flow', title: 'A creep does not move', cell: [204, 56],
                caption: 'Four of the listed reasons as one path of checks. In the first, the action in front of moveTo returned another error than ERR_NOT_IN_RANGE, so moveTo was never called.',
                nodes: [
                    { id: 'q1', at: [0, 0], text: 'Is moveTo called at all?' },
                    { id: 'q2', at: [0, 1], text: 'It returns ERR_TIRED?' },
                    { id: 'q3', at: [0, 2], text: 'It returns ERR_NO_BODYPART?' },
                    { id: 'q4', at: [0, 3], text: 'It returns OK and the\ncreep still stands?' },
                    { id: 'a1', at: [1, 0], text: 'Another error came first', sub: 'empty source: move by distance', tone: 'warn' },
                    { id: 'a2', at: [1, 1], text: 'Fatigue above 0', sub: 'more MOVE parts, or roads', tone: 'warn' },
                    { id: 'a3', at: [1, 2], text: 'No MOVE part with hits', sub: 'heal the creep', tone: 'warn' },
                    { id: 'a4', at: [1, 3], text: 'The kept path is blocked', sub: 'lower reusePath', tone: 'warn' },
                ],
                edges: [{ from: 'q1', to: 'a1', label: 'no' }, { from: 'q2', to: 'a2', label: 'yes' }, { from: 'q3', to: 'a3', label: 'yes' }, { from: 'q4', to: 'a4', label: 'yes' }, { from: 'q1', to: 'q2', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' }, { from: 'q3', to: 'q4', label: 'no' }],
            },
            {
                type: 'panels', title: 'Never end a move on an exit tile',
                caption: 'A creep standing on an exit tile is sent to the next room each tick it stands there. Aim at a tile further inside, never at one with x or y of 0 or 49.',
                panels: [
                    {
                        tag: 'On an exit tile: moved each tick', tone: 'bad', size: [6, 3], terrain: ['..xx..', '..xx..', '..xx..'],
                        things: [{ is: 'creep', at: [2, 1], body: 'WCM' }, { is: 'creep', at: [3, 1], body: 'WCM', dim: true }],
                        notes: [{ at: [0.5, 0], text: 'room A' }, { at: [4.5, 0], text: 'room B' }, { at: [2.5, 2], text: 'one tick here, the next there' }],
                    },
                    {
                        tag: 'One tile inside: stays', tone: 'good', size: [6, 3], terrain: ['..xx..', '..xx..', '..xx..'],
                        things: [{ is: 'creep', at: [1, 1], body: 'WCM' }],
                        notes: [{ at: [0.5, 0], text: 'room A' }, { at: [4.5, 0], text: 'room B' }],
                    },
                ],
            },
        ],
    };
};
