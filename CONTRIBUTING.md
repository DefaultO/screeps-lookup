# Writing content for the lookup

The index is generated. Hand-written text lives in `content/`; the build checks it against the
sources in `sources/` and fails when something no longer holds.

## Where text goes

| what | base file | in a topic pack |
| --- | --- | --- |
| text for an API member or object | `content/api-*.js` | `content/packs/<name>/api.js` |
| mechanics (rules that span calls) | `content/mechanics.js` | `content/packs/<name>/mechanics.js` |
| recipes (calls for a job, in order) | `content/recipes.js` | `content/packs/<name>/recipes.js` |
| one-line meaning of a constant | `content/constant-notes.js` | `content/packs/<name>/constant-notes.js` |
| task queries that must find an entry | `test/queries.json` | `content/packs/<name>/queries.json` |

A pack is a folder for one topic area. Every file in it is optional. A pack may add entries and
may add lines to existing entries; it cannot replace an existing summary.

## Formats

```js
'use strict';
const { L, eng, backend, driver, doc, article } = require('../../_h');   // './_h' in a base file
const P = 'src/processor/intents/';

// api.js: keyed by entry id (see `node tools/api.js --list`)
module.exports = {
    'StructureLink.cooldown': {
        summary: 'Ticks until the link can send again.',          // one or two sentences, own words
        tasks: ['is a link ready', 'link cooldown'],               // how someone would ask for it
        pitfalls: [                                                // what goes wrong
            L('The sender cools down {{LINK_COOLDOWN}} tick per tile of distance.', eng(P + 'links/transfer.js', 'object.cooldown += C.LINK_COOLDOWN')),
        ],
        notes: ['…'],                                              // what else is true
        constants: ['LINK_COOLDOWN'],                              // shown with their values
        see: ['StructureLink.transferEnergy'],                     // entry ids
        range: 1, part: 'WORK',                                    // only where they apply
    },
};

// mechanics.js: an array, or {entries: [...], extend: {...}}
module.exports = {
    entries: [{
        id: 'source-keepers',                                      // becomes mechanic:source-keepers
        title: 'Source keepers',
        summary: '…',
        tasks: ['how strong is a source keeper', 'when does a keeper respawn'],
        facts: [L('…', eng('…', '…')), L('…', article('invaders'))],
        pitfalls: ['…'],
        tables: [C => ({ title: '…', head: ['a', 'b'], rows: [['x', C.SOME_CONSTANT]], foot: '…' })],
        constants: ['…'], see: ['…'], url: 'https://docs.screeps.com/….html',
    }],
    extend: {                                                      // add to an entry that exists already
        'mechanic:invaders': { facts: [L('…', backend('lib/cronjobs.js', '…'))], tables: [/* … */], see: ['…'] },
    },
};

// recipes.js: same shape; an entry has steps instead of facts
{ id: 'mine-minerals', title: '…', summary: '…', tasks: ['…'],
  steps: [{ call: 'Room.createConstructionSite', text: '…' }, { text: 'a step without one call' }],
  pitfalls: [L('…', eng('…', '…'))], constants: ['…'], see: ['…'] }

// constant-notes.js
module.exports = { CONTROLLER_DOWNGRADE_RESTORE: 'Ticks added to the downgrade timer in a tick with an upgrade.' };

// queries.json
[{ "q": "when does a keeper respawn", "expect": ["mechanic:source-keepers"], "top": 3 }]
```

## Rules for the text

1. **Only what a source shows.** Every line that states behaviour carries its source: `L(text, …)`
   with `eng`, `backend`, `driver` (code) or `doc`, `article` (official docs). Read the code before
   you write the line. If the source does not settle it, leave the line out.
   Other fetched repositories are cited with `ref('<repository>', 'path/in/repo.js', 'piece of the line')`:
   `screeps`, `launcher`, `storage`, `renderer`, `grunt-screeps`, `tutorial-scripts`, `mod-season1`,
   `mod-season2`, `mod-season5`, `common`. Contributed official articles are `article('contributed/ps_ubuntu')`.
   `wiki('Page_Name')` points at a page of the community wiki. It is allowed only for practice that
   no primary source holds, on a line that says it is community practice; nothing is copied from the wiki.
2. **A code source is a file plus a piece of one line** of that file, copied exactly. The build
   finds the line and links to it. Pick the line that decides the behaviour, not the function head.
3. **Numbers come from constants**: write `{{ROAD_HITS / ROAD_DECAY_AMOUNT * ROAD_DECAY_TIME}}`,
   not `50000`. Any JavaScript expression over the constants works, `Math` included. Use a literal
   only for numbers that are not constants (and then cite the code that has them).
4. **Own words, short.** Do not copy sentences from the official docs. One fact per line. No
   marketing tone, no filler, no "note that". Plain present tense: "A tower does one action per tick."
5. **Say what goes wrong.** A pitfall names the situation and what to do instead.
6. **Task lines are how people ask**, in plain lower-case words: "how fast do containers decay",
   "take energy from a container". Three to eight per entry that people would look for; none for
   entries nobody searches by task.
7. **A summary stands alone.** It says what the thing is or does, with the key number, without
   needing the title.
8. Values of ids, constants and code go in backticks only when they are literal code in the text.
9. Do not describe what a mod or a private-server setting might change; the index follows the
   public sources.
10. An entry about what players do rather than what the game enforces (layouts, priorities,
    tooling) gets `basis: 'practice'`. Its numbers are still computed from constants and its
    statements about the game still carry code sources; advice lines say "community practice"
    and may point to a wiki page.

## Figures

A figure is a small drawing an entry carries next to its text: who stands where, how a number
changes with range or level, what happens in which order. Draw one when it says something faster
than the sentence does; an entry may have several, or none.

Figures live in `content/figures.js` (base entries) and `content/packs/<name>/figures.js`. A file
exports a function of the constants and the helpers of `content/_fig.js`:

```js
module.exports = (C, h) => ({
    'mechanic:tower': [ { type: 'line', title: '…', caption: '…', … } ],
    'Creep.harvest': [ h.action({ … }) ],
});
```

The key is the full entry id. Every figure needs `title` (a few words, no full stop) and `caption`
(one or two sentences that state what the drawing shows; `code` in backticks works). Numbers are
computed from `C`, never typed. A figure states a rule, so everything it shows must be covered by
the sourced lines of its entry.

The build draws every figure once. An error (unknown thing, position outside the grid, missing
field, a constant that does not exist) stops it; layout remarks (a label that leaves the drawing,
two labels on top of each other, text wider than its box) are printed as warnings and have to be
fixed.

### The types

**`scene`**: things on the game's tile grid, drawn with the game's own graphics (`lib/gameart.js`,
a port of the official renderer). The workhorse for rules about position and range.

```js
{ type: 'scene', title, caption, size: [9, 4],            // tiles wide, high. Tile [0, 0] is top left.
  tile: 40,                                                // optional, pixels per tile (default 40)
  terrain: ['.........', '..~~.....', '.....##..', '.........'],   // optional: . plain  ~ swamp  # wall  x exit
  things: [ { is: 'source', at: [1, 1], label: 'source', labelAt: 'right' },
            { is: 'creep', at: [2, 2], body: '5W M', carry: 0.5, foe: false, label: 'miner' },
            { is: 'road', at: [[3, 2], [4, 2], [5, 2]] } ],         // a list of tiles repeats the thing
  ranges: [ { at: [2, 2], r: 1, label: 'range 1', labelAt: 'bl', tone: 'accent' } ],   // a square, as the game measures
  marks:  [ { at: [6, 1], tone: 'bad', text: '5M', span: [2, 2] } ],                   // tinted tiles, optional text
  arrows: [ { from: [1, 1], to: [2, 2], tone: 'energy', label: 'harvest', side: 'below', dashed: false, both: false, bend: 0.2 } ],
  paths:  [ { via: [[3, 2], [4, 2], [5, 2]], tone: 'ink', dashed: true, label: 'walks' } ],
  notes:  [ { at: [6.5, 0.2], text: ['two', 'lines'], anchor: 'start', strong: true } ] }
```

- Things: `creep` (`body`, `carry` 0–1, `foe`), `powerCreep`, `source` (`empty`), `mineral` (`kind`),
  `deposit`, `controller` (`level`, `neutral`, `foe`), `spawn`, `extension`, `tower`, `storage`,
  `terminal`, `container`, `link`, `lab` (`empty`),
  `factory`, `nuker`, `observer`, `powerSpawn`, `extractor`, `rampart` (`public`, `foe`), `wall`,
  `road`, `site` (`progress` 0–1), `energy` (`big`), `resource` (`kind`), `tombstone`, `ruin`, `flag`,
  `portal`, `keeperLair`, `invaderCore`, `powerBank`, `nuke`. Stores take `fill` 0–1. `dim: true`
  fades a thing, `scale: 0.8` draws it smaller. The game's own order of layers decides what lies on top.
- Things are as large as in the game: a creep fills its tile; a spawn, storage, terminal, controller,
  tower or power spawn reaches into the neighbouring tiles. Leave a free tile next to them for labels.
  The build warns when a label lies on a thing.
- A body is `'WWCM'`, `'5W 1C 3M'` or part names. Letters: M W C A R H T, and L for CLAIM.
- A label sits below its thing unless `labelAt` is `top`, `left` or `right`. It needs free tiles
  there: leave an empty row or column rather than squeezing. A label may have two lines (`['a', 'b']`).
- Positions may be fractions (`[5.5, 0.2]`), which is how notes are placed between tiles.
  `dx` and `dy` move the label of an arrow or path by pixels.
- An arrow between neighbouring tiles is short; give it no label and say it in a note or the caption.
- Tones: `ink` (default), `accent`, `good`, `bad`, `warn`, `energy`, `dim`, the chart colours
  `a` `b` `c`, and the body part letters.
- Up to 13 tiles of 40 wide. For more, set a smaller `tile` and label less.
- A scene of more than 9 tiles of 40 takes the full reading column; a smaller one sits in a column
  of two or has its caption beside it. `wide: true` gives any figure the full column.

`h.action({ title, caption, body, actor, target, targetOpts, targetLabel, range, tone, flow: 'in', effect: ['line', 'line'] })`
builds the standard scene of one creep action: the creep, its range square (1, 2 or 3), the target
at that range and what the action does. Use it for API methods that act on a target.

**`panels`**: two or three small scenes side by side, for "works / fails" and "before / after".

```js
{ type: 'panels', title, caption, panels: [ { tag: 'Open rampart: passes', tone: 'good', note: '…', size, things, … }, … ] }
```

Tone `good` and `bad` add a tick and a cross to the tag. Keep the tags to one line.

**`line`**: how a number changes along an axis (range, ticks, distance). One to three series.

```js
{ type: 'line', title, caption, x: { label: 'range in tiles', min: 0, max: 25, step: 5, snap: 1 }, y: { label: 'hits per action' },
  series: [ { name: 'Attack', pts: h.seq(0, 25).map(r => [r, f(r)]), step: false } ],
  marks: [ { x: 5, label: 'full up to here', anchor: 'end' } ], endLabels: true }
```

`step: true` draws a value that jumps. `snap` sets the step of the hover readout. `y.max` and
`x.ticks` override the automatic axis. Never give two series different units. Lines are labelled at
their end; with `endLabels: false` a legend is shown instead.

**`cols`**: one number per level or other ordered category, up to three series.

```js
{ type: 'cols', title, caption, x: { label: 'room level', cats: ['1', '2', '3'] }, y: { label: 'what the numbers are' }, series: [ { name, values: [5, 10, 20] } ] }
```

**`bars`**: named things compared on one scale.

```js
{ type: 'bars', title, caption, unit: 'ticks', max: 50000, rows: [ { label: 'Road', sub: 'no traffic', value: 50000, text: '50,000', tone: 'a' } ] }
```

`text` replaces the printed value. Use it for a handful of rows that share a unit; a table is
better for many.

**`timeline`**: what holds for how long.

```js
{ type: 'timeline', title, caption, span: 50000, unit: 'ticks since activation', ticks: [0, 20000, 50000],
  rows: [ { label: 'Safe mode', segs: [ { from: 0, to: 20000, text: 'protected', tone: 'good' } ], marks: [ { at: 20000, text: 'ends' } ] } ] }
```

**`flow`**: steps or parts with labelled arrows, on a grid of boxes.

```js
{ type: 'flow', title, caption, cell: [150, 54],          // optional box size
  nodes: [ { id: 'a', at: [0, 0], text: 'Your script', sub: 'calls return OK', tone: 'energy', span: 1, mono: false } ],   // at: [column, row]
  edges: [ { from: 'a', to: 'b', label: 'intents', dashed: false, both: false } ] }
```

Keep it to four columns; a box holds about 20 characters per line (`\n` splits the text).
A list of steps that the recipe already numbers is not a flow: draw the part that branches,
loops or runs in parallel.

**`body`**: creep bodies part by part, with cost, spawn time and hits computed.

```js
{ type: 'body', title, caption, rows: [ { label: 'Miner', parts: '5W C 3M', note: '…', dead: 2, boost: { W: true } } ], order: true, stats: true }
```

`dead` greys the first n parts (damage arrives at the front); `order: true` prints that under the rows.

**`map`**: a grid of cells by kind with a key: rooms of a sector, zones of a room.

```js
{ type: 'map', title, caption, cell: 22, rows: ['hhh', 'h.h', 'hhh'], key: { h: { label: 'highway', tone: 'a' }, '.': { label: 'room' } },
  xlabels: ['0', '1', '2'], ylabels: ['0', '1', '2'], marks: [ { at: [1, 1], box: [1, 1], text: 'you' } ] }
```

`weak: true` in a key entry gives the lighter step of the same colour.

**`ladder`**: ordered lists of names, for priorities.

```js
{ type: 'ladder', title, caption, groups: [ { title: 'Work actions', note: 'one per tick', ordered: true, items: ['heal', 'repair', 'build'] } ] }
```

### Rules for figures

1. One figure, one statement. The caption says it in words; the drawing must show the same.
2. Label the things directly. No legend to look up, except the key of a map.
3. Colour repeats what a label already says; nothing may depend on colour alone.
4. Text stays in the drawing: no warnings from the build.
5. Look at it before you call it done:

```sh
node tools/build.js --pack <name> --out <temp folder>
node tools/shots.js --index <temp folder>/index.json --pack <name> --out <temp folder>/shots
```

`tools/shots.js` writes PNG sheets of the figures (it needs Chrome or Edge on the machine; `--theme light`
for the light theme, `--base` for `content/figures.js`, `--ids a,b` for single entries, `--all` for every figure).

## Design

The page follows published guidance rather than taste. These are the rules it was built from;
a change to `site-src/index.html` should keep them.

**Layout**

- The standard documentation page: top bar with the search, sections on the left, one reading
  column, the sections of the page on the right. Predictable patterns before new ones.
- The sidebar has two levels (section, entry) and shows one open section: the one of the current
  page. The headings of a page are not in the sidebar; they are in "On this page".
- The start page routes: topics with their most useful entries, numbers, API objects. It explains nothing.
- Every entry has a breadcrumb and ends in "See also".
- Spacing comes from one scale (4, 8, 12, 16, 24, 32, 40, 56 px). Things that belong together stand
  closer than things that do not; space separates before a line does.
- Borders and filled boxes mark a separate object and are used for few things: the first search
  result, code, a drawing. Not for every block.

**Type**

- Body text 16 px, line height 1.6, lines no longer than about 75 characters.
- Three sizes carry the hierarchy of a page (title 30, section 20, text 16); weight and colour do the rest.
  Small text (14, 13, 12) is for navigation, captions and labels.
- Bold only for the name of the thing. Capitals only for one-line labels, with letterspacing.
  No underline except on a link under the pointer.
- Numbers in tables are tabular. Identifiers are in the monospace face and are not translated.

**Colour**

- Neutral greys with a slight blue cast and one accent, used only for links, the current place
  and focus. Warnings have their own colour and never the accent.
- Text is never pure black on pure white, nor pure white on pure black. The dark theme is dark grey;
  its accent is lighter and less saturated than in the light theme.
- Body text has a contrast of at least 4.5 : 1 in both themes. Nothing depends on colour alone.
- The game's colours (body parts, energy, owner colours, the ground) appear only in drawings
  and on the part chips. A scene is drawn on the game's dark ground in both themes.

**Behaviour**

- Everything works from the keyboard; focus is always visible. Targets are at least 24 px high,
  44 px in the phone navigation.
- The address holds the state (query, filter, entry), Back returns to the scroll position.
- The search field takes the focus on a desktop, not on a phone.
- No motion that carries meaning; transitions name their property and respect reduced motion.

Sources: Nielsen Norman Group, "5 Principles of Visual Design in UX" and "Visual Hierarchy in UX";
Refactoring UI (Wathan, Schoger); Butterick, "Practical Typography" (summary of key rules);
Vercel, "Web Interface Guidelines"; Material Design, "Dark theme"; Tom Johnson, "Design principles
for doc navigation".

## Check your work

```sh
node tools/build.js                 # all content; fails with the entry named when a source, constant or link is wrong
node tools/test.js                  # every query finds its entry
node tools/audit.js --list          # what is still without own text, source or constant meaning
```

For one pack, without touching the built files of the repository:

```sh
node tools/build.js --pack <name> --out <some temp folder>
node tools/test.js --pack <name> --index <that folder>/index.json
node tools/audit.js --index <that folder>/index.json
```

Look at an entry the way a reader gets it: `node tools/api.js --index <file> --full <id>`.
