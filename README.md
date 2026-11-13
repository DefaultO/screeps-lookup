# Screeps lookup

A reference for Screeps that you query by task. You describe what you want to do; you get the
calls and rules that apply, each with its signature, CPU cost, return codes, the constants involved,
the usual mistakes, and the line of the game's source code that proves each statement.
The same index serves a command for the terminal (and for Claude sessions) and a static web page.

## Use it

```sh
node tools/api.js "move energy from one creep to another"
node tools/api.js "how fast do containers decay in unowned rooms"
node tools/api.js --full Creep.transfer        # one whole entry: arguments, every return code, the source of every line
node tools/api.js --const ROAD_DECAY_TIME      # value and meaning of a constant (a part of a name lists matches)
node tools/api.js --list mechanic              # ids of one kind, or of one object: --list Creep
```

Options: `-n 5` (detailed results, default 3), `--kind method,mechanic`, `--json`, `--width 100`.
It reads `data/index.json`, needs no network and no packages, and answers in about 0.2 s.

Both the command and the page put the lines that answer your question first ("for your question")
and fold the rest of the entry behind them. A community word in the question (quad, SK, blinky,
temple …) is explained in one line and leads to its entry.

The page is `site/index.html` with `site/index.js` next to it. Open the file, or run
`node tools/serve.js` and go to <http://localhost:4173/>. No backend, no external requests; any
static host works. Links keep their state: `#q=refill a spawn`, `#e=Creep.transfer`.

- Start page: the numbers most questions end in (life times, decay, tower, reservation, CPU), each
  linked to the entry that explains it, then recipes and mechanics by topic.
- Left rail: browse recipes and mechanics by topic, every API object and the constant groups.
- Answers: the first result is opened with signature, CPU cost, a tile grid for the range, the
  matching lines highlighted, return codes and constants; the others are one-line rows.
- Every sourced line ends in a small chip such as `engine tick.js:51` that opens that line on GitHub.
- Entry pages: arguments, every return code, member tables for objects, computed tables and a
  chart (tower effect by range) where numbers are easier to read drawn.
- Keys: `/` focuses the search, `↑` `↓` pick a result, `Enter` opens it, `Esc` clears.

### For a Claude session working on a bot

Put this in the project's `CLAUDE.md` (adjust the path):

> Before stating a Screeps game rule or using an API call you are not sure about, look it up:
> `node <path>/screeps-lookup/tools/api.js "<what you want to do>"`. Use `--full <id>` for all
> return codes and the source line behind each statement, and `--const <NAME>` for values.

## What is in the index

| kind | count | what |
| --- | --- | --- |
| method, property, object | 423 | every member of the official API reference, each with own text, signature, arguments, return codes and CPU class |
| mechanic | 68 | rules that span calls, in nine topics: core rules, structures and creeps, resources and trade, NPCs and the world, power, code/CPU/memory, account/web API/tools, seasonal worlds, private server |
| recipe | 64 | the calls a job needs, in order; 18 of them are marked as community practice |
| constants | 23 groups | all 423 constants of `@screeps/common` with values and a one-line meaning, plus computed tables |
| article | 18 | titles and section names of the official articles, as link targets |
| glossary | 41 words | the community's words, each pointing at the entry that explains it |

2,745 of the 2,751 pitfalls, notes and facts carry a source: 2,139 distinct lines of code in the
screeps repositories, 109 official docs pages, and 32 pointers to the community wiki on practice
entries. `node tools/audit.js --list` shows what is still without one.

An entry has: `id`, `kind`, `topic`, `signature`, `cpu` (`intent` = +0.2 CPU when it returns OK),
`args`, `returns`, `summary`, `tasks` (the plain-word lines search matches), `pitfalls`, `notes` or
`facts`, `steps` (recipes), `tables`, `constants` with values and meanings, `see`, the official
`url`, and `src`: for each line, numbers into `index.lineSources`.

**Practice entries** (`basis: 'practice'`) describe what players do, not what the game enforces:
base planning, remote-mining economics, squad combat, creep architecture and the like. Their
numbers are computed from the constants and their statements about the game carry code sources;
their advice says "community practice" and points at the wiki page that describes it.

## Rebuild

```sh
node tools/fetch-sources.js     # clone or update 14 public screeps repositories into sources/
node tools/build.js             # writes data/index.json, site/index.js, site/index.html
node tools/test.js              # 325 task queries with the entries they must find, plus index checks
node tools/audit.js --list      # what is still thin: members without own text, lines without a source, constants without a meaning
```

The build fails, with the entry named, when a cited line of code no longer exists, when a constant
used in a text is gone, or when a cross-link points nowhere. It warns when the docs drop a member
that has own text, and when a new constant fits no group. Numbers in the texts are written as
`{{ROAD_HITS / ROAD_DECAY_AMOUNT * ROAD_DECAY_TIME}}` and computed from the constants at build time.

`--pack a,b` builds the base content plus the named topic packs, `--pack none` the base alone,
`--out <dir>` writes somewhere else, `--no-doc-text` leaves out every sentence taken from the
official docs.

On Windows keep the folder path short: git fails with "Filename too long" in very deep folders
(`--dir <folder>` for fetch and `--sources <folder>` for build move the sources elsewhere).

## Add or correct content

[CONTRIBUTING.md](CONTRIBUTING.md) has the formats and the rules. In short: every line that states
behaviour carries what proves it (a line of code in a screeps repository, or an official docs
page); the build turns that into a link with a line number and fails when the code is gone.
Numbers are written as expressions over the constants.

| file | holds |
| --- | --- |
| `content/api-*.js` | own text per API entry: summary, tasks, pitfalls, notes, constants, see |
| `content/mechanics.js`, `content/recipes.js` | the core mechanics and recipes |
| `content/packs/<topic>/` | one folder per topic area with its own `api.js`, `mechanics.js`, `recipes.js`, `constant-notes.js`, `glossary.json`, `queries.json` |
| `content/constants.js` | constant groups and their tables |
| `content/topics.js` | names and order of the topics that group mechanics and recipes |
| `content/cheatsheet.js` | the numbers on the start page |
| `content/synonyms.js` | word groups ("refill", "fill", "supply" → transfer), phrases ("do not own"), stop words |
| `site-src/index.html` | the page template; the build inlines `lib/search.js` into it |
| `test/queries.json` | `{"q": "...", "first": "id"}` or `{"q": "...", "expect": ["id"], "top": 3}` |

When a search misses: add the wording as a task line on the right entry, or the word to a synonym
group or the glossary, add the query to a `queries.json`, rebuild, run the tests.

## Search, and whether embeddings would help

Search is keyword based, in `lib/search.js` (one file, shared by the command and the page). Each
query word is matched directly and through its synonym group against name, task lines, summary,
text and constants; rare words weigh more; an entry with one task line that covers the whole query
is ranked up. Inside each result the pitfalls, notes and facts are ranked the same way, so the
line that answers the question is shown first.

Embeddings are not worth adding now. The index is written to be matched: all 325 test queries
pass, and a miss is fixed by one line of wording. A semantic search needs a model at query time,
which means a download of tens of megabytes in the browser or a network call from the command,
and both give up "offline, no server". It would start to pay if questions come in another language
or as long free text. The cheap way then: embed the entries at build time and only the query at
run time. The per-line sources in the index are what a later answer layer would cite.

## Sources and licenses

- **Screeps documentation** (`screeps/docs`): the repository has no LICENSE file; the site footer
  states "Documentation licensed under CC BY 4.0". This index takes names, signatures, types,
  return codes and a shortened first sentence of descriptions, credits the source on the page and
  in `NOTICE.md`, and links every entry to its official page.
- **Code repositories of the screeps organisation** (ISC or MIT; `tutorial-scripts` states none):
  constant values are copied from `@screeps/common`; everything else is linked by line, not copied.
- **Community wiki** (wiki.screepspl.us): states no license. Nothing is copied from it; it was a
  list of topics, and practice entries link to its pages.
- This folder has no license of its own yet. Details are in [NOTICE.md](NOTICE.md).

## Limits

- Behaviour follows the public code at the commits shown in the page footer (engine 4.3.2, driver
  5.3.0, backend-local 3.3.0). A server with mods can differ, and the official server's own backend
  is not public: where a detail is known only from the open-source server, the line says so.
- Six lines have no source: which rooms are highway, keeper or centre rooms is map data, and two
  are plain advice.
- Seasons 3, 4, 6 and later, the shard 3 CPU cap, the official console output limit and what
  happens to a creep that changes shard are not in any public source and are left out.
