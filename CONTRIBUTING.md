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
