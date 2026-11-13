# Sources and their licenses

This index is not affiliated with Screeps. It is built from public repositories of the screeps
organisation on GitHub. Hand-written text (summaries, task lines, pitfalls, notes, mechanics and
recipes) is written for this index.

## Screeps documentation (`screeps/docs`)

docs.screeps.com states in its footer: "Documentation licensed under CC BY 4.0"
(<https://creativecommons.org/licenses/by/4.0/>). The repository itself has no LICENSE file.

Taken from it: names of objects, methods and properties, signatures, argument names and types,
return codes, the CPU class of each method, and (unless built with `--no-doc-text`) a shortened
first sentence of each description, argument description and return-code description.
Changes made: text shortened to one sentence, markup removed. Every entry links to its official page.

## Code repositories

| repository | license | what is taken |
| --- | --- | --- |
| `screeps/common` | ISC | the values of `lib/constants.js`; other files are linked by line |
| `screeps/engine`, `screeps/driver`, `screeps/backend-local` | ISC | linked by line as proof of behaviour; no code is copied |
| `screeps/screeps`, `screeps/launcher`, `screeps/storage`, `screeps/renderer` | ISC | linked by line (private server) |
| `screeps/grunt-screeps`, `screeps/mod-season1`, `screeps/mod-season2`, `screeps/mod-season5` | MIT | linked by line |
| `screeps/tutorial-scripts` | none stated | linked by line only; nothing is copied |

ISC notice for the constant values:

    Copyright (c) 2016, Artem Chivchalov <contact@screeps.com>

    Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted,
    provided that the above copyright notice and this permission notice appear in all copies.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN
    AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
    OF THIS SOFTWARE.

## Community wiki (wiki.screepspl.us)

The wiki states no license, and its repository has no LICENSE file. Nothing is copied from it. It
was used as a list of topics to cover; entries about community practice link to the wiki page that
describes the practice, and say on the line that it is community practice.
