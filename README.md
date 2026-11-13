# Screeps lookup

Find the Screeps API call for a task. You describe what you want to do; you get the calls that
apply, each with its signature, CPU cost, return codes, the constants involved and the usual mistakes.
The same index serves a command for the terminal (and for Claude sessions) and a static web page.

## Use it

```sh
node tools/api.js "move energy from one creep to another"
node tools/api.js "how fast do containers decay in unowned rooms"
node tools/api.js --full Creep.transfer        # one whole entry: arguments, every return code, sources
node tools/api.js --const ROAD_DECAY_TIME      # value of a constant (a part of a name lists matches)
node tools/api.js --list mechanic              # ids of one kind, or of one object: --list Creep
```

Options: `-n 5` (detailed results, default 3), `--kind method,mechanic`, `--json`, `--width 100`.
It reads `data/index.json`, needs no network and no packages, and answers in about 0.1 s.

Both the command and the page put the lines that answer your question first ("for your question")
and fold the rest of the entry behind them.

The page is `site/index.html` with `site/index.js` next to it. Open the file, or run
`node tools/serve.js` and go to <http://localhost:4173/>. No backend, no external requests; any
static host works. Links keep their state: `#q=refill a spawn`, `#e=Creep.transfer`.

- Start page: the numbers most questions end in (life times, decay, tower, reservation, CPU), each
  linked to the entry that explains it, then the recipes and mechanics.
- Left rail: browse recipes, mechanics, every API object and the constant groups.
- Answers: the first result is opened with signature, CPU cost, a tile grid for the range, the
  matching lines highlighted, return codes and constants; the others are one-line rows.
- Entry pages: arguments, every return code, member tables for objects, tables and a chart
  (tower effect by range) where numbers are easier to read drawn.
- Keys: `/` focuses the search, `↑` `↓` pick a result, `Enter` opens it, `Esc` clears.

### For a Claude session working on a bot

Put this in the project's `CLAUDE.md` (adjust the path):

> Before stating a Screeps game rule or using an API call you are not sure about, look it up:
> `node <path>/screeps-lookup/tools/api.js "<what you want to do>"`. Use `--full <id>` for all
> return codes and `--const <NAME>` for values. Entries cite the engine source where the docs are silent.

## What is in the index

| kind | count | what |
| --- | --- | --- |
| method, property, object | 423 | every member of the official API reference, with signature, arguments, return codes and CPU class |
| mechanic | 17 | rules that span calls: who may do what in which room, decay, reservation, controller, safe mode, what a creep can do in one tick, tick order, movement, damage and healing, towers, creep death, invaders, sources, CPU, memory, nukes, room types |
| recipe | 13 | the calls a job needs, in order: harvest and haul, reserve and remote-mine, claim a room, tower logic, link network, labs and boosts, terminal and market, safe mode, observer and power banks, power creeps, spawning, invaders, roads and upkeep |
| constants | 23 groups | all 423 constants of `@screeps/common` with values, plus derived tables (body parts, boosts, reactions, structures per room level, tower by range, powers, factory recipes) |
| article | 18 | titles and section names of the official articles, as link targets |

An entry has: `id`, `kind`, `signature`, `cpu` (`intent` = +0.2 CPU when it returns OK), `args`,
`returns`, `summary`, `tasks` (the plain-word lines search matches), `pitfalls`, `notes` or `facts`,
`constants` with values, `see`, the official `url`, and `engine` links to the line that proves a note.

## Rebuild

```sh
node tools/fetch-sources.js     # clone or update screeps/docs, common, engine, driver, backend-local into sources/
node tools/build.js             # writes data/index.json, site/index.js, site/index.html
node tools/test.js              # the task queries with the entries they must find, plus index checks
node tools/audit.js --list      # what is still thin: members without own text, lines without a source, constants without a meaning
```

The build fails, with the entry named, when a cited engine line no longer exists, when a constant
used in a text is gone, or when a cross-link points nowhere. It warns when the docs drop a member
that has own text, and when a new constant fits no group. Numbers in the texts are written as
`{{ROAD_HITS / ROAD_DECAY_AMOUNT * ROAD_DECAY_TIME}}` and computed from the constants at build time.

On Windows keep the folder path short: git fails with "Filename too long" in very deep folders
(`--dir <folder>` for fetch and `--sources <folder>` for build move the sources elsewhere).

## Add or correct content

[CONTRIBUTING.md](CONTRIBUTING.md) has the formats and the rules. In short: every line that states
behaviour carries what proves it (a line of engine, driver or backend code, or an official docs
page); the build turns that into a link with a line number and fails when the code is gone.
Numbers are written as expressions over the constants.

| file | holds |
| --- | --- |
| `content/api-*.js` | own text per API entry: summary, tasks, pitfalls, notes, constants, see |
| `content/mechanics.js`, `content/recipes.js` | the core mechanics and recipes |
| `content/packs/<topic>/` | one folder per topic area with its own `api.js`, `mechanics.js`, `recipes.js`, `constant-notes.js`, `queries.json` |
| `content/constants.js` | constant groups and their tables |
| `content/topics.js` | names and order of the topics that group mechanics and recipes |
| `content/cheatsheet.js` | the numbers on the start page |
| `site-src/index.html` | the page template; the build inlines `lib/search.js` into it |
| `content/synonyms.js` | word groups ("refill", "fill", "supply" → transfer), phrases ("do not own"), stop words |
| `test/queries.json` | `{"q": "...", "first": "id"}` or `{"q": "...", "expect": ["id"], "top": 3}` |

When a search misses: add the wording as a task line on the right entry, or the word to a synonym
group, add the query to `test/queries.json`, rebuild, run the tests.

## Search, and whether embeddings would help

Search is keyword based, in `lib/search.js` (one file, shared by the command and the page). Each
query word is matched directly and through its synonym group against name, task lines, summary,
text and constants; rare words weigh more; an entry with one task line that covers the whole query
is ranked up. Inside each result the pitfalls, notes and facts are ranked the same way, so the
line that answers the question is shown first.

Embeddings are not worth adding now. The index is small and written to be matched: all 68 test
queries pass, and a miss is fixed by one line of wording. A semantic search needs a model at query
time, which means a download of tens of megabytes in the browser or a network call from the command,
and both give up "offline, no server". It would start to pay if questions come in another language
or as long free text. The cheap way then: embed the entries at build time (about 200 KB added) and
only the query at run time.

## Sources and licenses

- **Screeps documentation** (`screeps/docs`): the repository has no LICENSE file; the site footer
  states "Documentation licensed under CC BY 4.0". That allows copying and adapting with credit, a
  link to the license and a note of changes. This index takes names, signatures, types, return
  codes and a shortened first sentence of descriptions, credits the source on the page and in
  `NOTICE.md`, and links every entry to its official page. `node tools/build.js --no-doc-text`
  leaves out every sentence from the docs, if you prefer to rely on nothing but names and codes.
- **`@screeps/common`, `screeps/engine`, `screeps/backend-local`**: ISC. Constant values are copied
  (notice in `NOTICE.md`); engine and backend code is linked, not copied.
- Summaries, task lines, pitfalls, mechanics and recipes are own text. This folder has no license
  of its own yet.

## Limits

- Behaviour notes follow `screeps/engine` 4.3.2 and `backend-local` 3.3.0 at the commits shown in
  the page footer. A server with mods can differ.
- 221 of 371 members have own text; the rest (drawing calls, deprecated aliases, plain properties)
  show the first sentence of the official description.
- Invader raid rules come from the private-server backend; the official server is not open source.
