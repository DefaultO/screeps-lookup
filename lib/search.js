/*
 * Task search over the Screeps API index. No dependencies; runs in Node and in the browser.
 *
 *   const engine = ScreepsSearch.create(index);        // index = data/index.json
 *   engine.search('refill a spawn', {limit: 5});       // -> [{entry, score, task, lines}]
 *   engine.get('Creep.transfer');                      // -> entry or undefined
 *   engine.constant('ROAD_DECAY_TIME');                // -> {name, value, group} or undefined
 *   engine.marker('refill a spawn')(text);             // -> [[start, end], ...] words to highlight
 *   engine.source(n);                                  // -> {label, url}: the proof behind a line
 *
 * Ranking: every query word is looked up directly and through its synonym group in the fields
 * of each entry (name, tasks, summary, body text, constants). A word found in a strong field
 * counts more; rare words count more; an entry whose single task line covers the whole query
 * gets a large bonus, because the task lines are written to be matched.
 *
 * Each result also carries `lines`: the pitfalls, notes, facts and steps of the entry that
 * answer this query best, so a caller can show those first instead of the whole entry.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ScreepsSearch = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var FIELD_WEIGHT = { name: 5, tasks: 4, summary: 2.5, consts: 1.5, text: 1, meta: 0.5 };
    var CONCEPT_MATCH = 0.7;
    var KIND_FACTOR = { recipe: 1.0, mechanic: 1.0, method: 1.0, property: 0.95, object: 1.0, constants: 0.95, article: 0.45 };
    var PREFIX = /^(mechanic|recipe|const|article):/;

    function undouble(w) {
        var n = w.length;
        if (n > 3 && w[n - 1] === w[n - 2] && 'lsfz'.indexOf(w[n - 1]) === -1 && 'aeiou'.indexOf(w[n - 1]) === -1) return w.slice(0, -1);
        return w;
    }
    function stem(w) {
        if (/^\d+$/.test(w)) return w;
        if (w.length > 4 && /ies$/.test(w)) w = w.slice(0, -3) + 'y';
        else if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
        if (w.length > 7 && /ation$/.test(w)) w = w.slice(0, -5);
        else if (w.length > 5 && /ing$/.test(w)) w = undouble(w.slice(0, -3));
        else if (w.length > 4 && /ed$/.test(w)) w = undouble(w.slice(0, -2));
        if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
        return w;
    }

    function create(index) {
        var syn = index.synonyms || {};
        var stop = {};
        (syn.stop || []).forEach(function (w) { stop[w] = true; });
        var phrases = (syn.phrases || []).map(function (p) { return [new RegExp(p[0], 'g'), p[1]]; });
        var wordConcepts = {};
        Object.keys(syn.groups || {}).forEach(function (concept) {
            syn.groups[concept].forEach(function (w) {
                var s = stem(w.toLowerCase());
                (wordConcepts[s] = wordConcepts[s] || []).push('~' + concept);
            });
        });

        // the stems one written word stands for: "Creep.transfer" -> creep, transfer, creeptransfer
        function wordStems(raw) {
            raw = raw.replace(/['.]+$/, '').replace(/'s$/, '');
            if (!(/[a-z0-9][A-Z]/.test(raw) || /[_.]/.test(raw))) {
                var w = raw.toLowerCase().replace(/'/g, '');
                return stop[w] ? [] : [stem(w)];
            }
            var parts = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_.]+/).filter(Boolean).map(function (x) { return x.toLowerCase(); });
            var out = [parts.join('')];
            for (var k = 0; k < parts.length; k++) {
                if (!stop[parts[k]]) out.push(stem(parts[k]));
                if (k + 1 < parts.length) out.push(parts[k] + parts[k + 1]);
            }
            return out;
        }

        // text -> {tokens: {token: true}, concepts: {concept: true}, count}
        function analyse(text) {
            var out = { tokens: {}, concepts: {}, count: 0 };
            if (!text) return out;
            text = String(text);
            var add = function (s) {
                if (!out.tokens[s]) { out.tokens[s] = true; out.count++; }
                var cs = wordConcepts[s];
                if (cs) for (var i = 0; i < cs.length; i++) out.concepts[cs[i]] = true;
            };
            var lower = text.toLowerCase();
            for (var p = 0; p < phrases.length; p++) {
                phrases[p][0].lastIndex = 0;
                if (phrases[p][0].test(lower)) phrases[p][1].split(' ').forEach(function (w) { if (!stop[w]) add(stem(w)); });
            }
            var words = text.match(/[A-Za-z][A-Za-z0-9_.']*|\d+/g) || [];
            for (var i = 0; i < words.length; i++) wordStems(words[i]).forEach(add);
            return out;
        }

        // All words of a text, stop words included: used to prefer the task line that reads like the query.
        function rawWords(text) {
            var set = {}, n = 0;
            (String(text).toLowerCase().match(/[a-z0-9_.]+/g) || []).forEach(function (w) { if (!set[w]) { set[w] = true; n++; } });
            return { set: set, n: n };
        }
        function overlap(a, b) {
            var both = 0;
            for (var w in a.set) if (b.set[w]) both++;
            return both / Math.max(1, a.n + b.n - both);
        }
        function join(list, pick) { return (list || []).map(pick).join(' \n '); }

        var entries = index.entries;
        var byId = {};
        var constGroup = {};
        var docs = entries.map(function (e) {
            byId[e.id.toLowerCase()] = e;
            var consts = (e.constants || []).map(function (c) { return c.name; });
            if (e.kind === 'constants') consts.forEach(function (n) { constGroup[n] = e; });
            var tables = join(e.tables, function (t) { return t.title + ' ' + t.rows.map(function (r) { return r.join(' '); }).join(' '); });
            var plainId = e.id.replace(PREFIX, '');
            return {
                entry: e,
                fields: {
                    name: analyse(plainId + ' ' + (e.title || '') + ' ' + (e.name || '')),
                    tasks: analyse((e.tasks || []).join(' \n ')),
                    summary: analyse(e.summary || e.doc || ''),
                    consts: analyse(consts.join(' ')),
                    text: analyse([join(e.pitfalls, String), join(e.notes, String), join(e.facts, String), join(e.steps, function (s) { return (s.call || '') + ' ' + s.text; }), e.summary ? e.doc || '' : '', tables].join(' \n ')),
                    meta: analyse([e.signature || '', join(e.args, function (a) { return a.name + ' ' + (a.desc || '') + ' ' + join(a.options, function (o) { return o.name; }); }),
                        join(e.returns, function (r) { return r.code; }), e.returnsText || '', e.object || '', e.type || ''].join(' ')),
                },
                // the name counts as one more task line, slightly weaker than a written one
                tasks: (e.tasks || []).map(function (t) { return { text: t, a: analyse(t), words: rawWords(t), w: 1 }; })
                    .concat([{ text: null, a: analyse(plainId.replace(/\./g, ' ') + ' ' + (e.title || '')), words: rawWords((e.title || e.id).replace(/\./g, ' ')), w: 0.85 }]),
                constNames: consts,
                lines: null,
            };
        });

        // the lines of an entry a reader acts on, analysed on first use
        function linesOf(doc) {
            if (doc.lines) return doc.lines;
            var e = doc.entry, out = [];
            var push = function (kind, list, text) {
                (list || []).forEach(function (x, i) { var t = text ? text(x) : x; out.push({ kind: kind, index: i, text: t, a: analyse(t) }); });
            };
            push('pitfall', e.pitfalls);
            push('note', e.notes);
            push('fact', e.facts);   // steps are a sequence and are always shown whole
            doc.lines = out;
            return out;
        }

        function matchIn(a, q) {
            if (a.tokens[q.token]) return 1;
            for (var i = 0; i < q.concepts.length; i++) if (a.concepts[q.concepts[i]]) return CONCEPT_MATCH;
            return 0;
        }

        function queryTokens(query) {
            var qa = analyse(query);
            return Object.keys(qa.tokens).map(function (t) { return { token: t, concepts: wordConcepts[t] || [] }; });
        }

        function search(query, opts) {
            opts = opts || {};
            var limit = opts.limit || 8;
            var qTokens = queryTokens(query);
            var norm = String(query).trim().toLowerCase();
            var qWords = rawWords(query);
            var exactConst = (String(query).match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[A-Z]{2,}\b/g) || []).filter(function (n) { return index.constants && n in index.constants; });
            if (!qTokens.length) return [];

            // per-token best field weight for every doc, and document frequency
            var per = docs.map(function () { return new Array(qTokens.length); });
            var idf = qTokens.map(function (q, qi) {
                var df = 0;
                for (var d = 0; d < docs.length; d++) {
                    var best = 0, f = docs[d].fields;
                    for (var name in f) {
                        var m = matchIn(f[name], q);
                        if (m && m * FIELD_WEIGHT[name] > best) best = m * FIELD_WEIGHT[name];
                    }
                    per[d][qi] = best;
                    if (best) df++;
                }
                return Math.log(1 + docs.length / (1 + df));
            });
            var total = idf.reduce(function (a, b) { return a + b; }, 0) || 1;

            var results = [];
            for (var d = 0; d < docs.length; d++) {
                var doc = docs[d], e = doc.entry;
                if (opts.kinds && opts.kinds.indexOf(e.kind) === -1) continue;
                var base = 0, covered = 0;
                for (var qi = 0; qi < qTokens.length; qi++) {
                    if (per[d][qi]) { base += idf[qi] * per[d][qi]; covered += idf[qi]; }
                }
                var bonus = 0;
                var idl = e.id.toLowerCase(), namel = (e.name || '').toLowerCase();
                if (norm === idl || norm === idl.replace(PREFIX, '')) bonus += 1000;
                else if (norm === namel || norm === (e.title || '').toLowerCase()) bonus += 500;
                for (var c = 0; c < exactConst.length; c++) {
                    if (doc.constNames.indexOf(exactConst[c]) !== -1) bonus += e.kind === 'constants' ? 60 : 25;
                }
                if (!base && !bonus) continue;
                var coverage = covered / total;

                // best single task line
                var bestTask = null, bestTaskScore = 0;
                for (var t = 0; t < doc.tasks.length; t++) {
                    var ta = doc.tasks[t].a, got = 0, hits = 0;
                    for (var qj = 0; qj < qTokens.length; qj++) {
                        var m2 = matchIn(ta, qTokens[qj]);
                        if (m2) { got += idf[qj] * m2; hits++; }
                    }
                    if (!hits) continue;
                    var recall = got / total;
                    var precision = Math.min(1, hits / Math.max(1, ta.count));
                    var s = doc.tasks[t].w * recall * recall * (0.45 + 0.3 * precision + 0.25 * overlap(qWords, doc.tasks[t].words));
                    if (s > bestTaskScore) { bestTaskScore = s; bestTask = doc.tasks[t].text; }
                }

                var score = base * (0.3 + 0.7 * coverage * coverage) + bestTaskScore * total * 9;
                score *= KIND_FACTOR[e.kind] || 1;
                if (e.deprecated) score *= 0.4;
                if (e.object === 'PowerCreep') score *= 0.85;
                score += bonus;
                results.push({ doc: doc, entry: e, score: score, task: bestTaskScore > 0.25 ? bestTask : null });
            }
            results.sort(function (a, b) { return b.score - a.score || (a.entry.id < b.entry.id ? -1 : 1); });
            results = results.slice(0, limit);

            // which lines of each result answer the query
            // A query word that every line of the entry contains (or none) tells the lines apart
            // no better than chance, so inside one entry a word weighs more the fewer lines have it.
            results.forEach(function (r) {
                var lines = linesOf(r.doc), scored = [];
                delete r.doc;
                r.lines = [];
                if (!lines.length) return;
                var match = lines.map(function (line) { return qTokens.map(function (q) { return matchIn(line.a, q); }); });
                var localTotal = 0;
                var weight = qTokens.map(function (q, qi) {
                    var n = 0;
                    for (var l = 0; l < lines.length; l++) if (match[l][qi]) n++;
                    var w = n ? idf[qi] * (Math.sqrt(1 - n / lines.length) + 0.15) : 0;
                    localTotal += w;
                    return w;
                });
                if (!localTotal) return;
                lines.forEach(function (line, l) {
                    var got = 0;
                    for (var qi = 0; qi < qTokens.length; qi++) got += weight[qi] * match[l][qi];
                    var share = got / localTotal;
                    if (share >= 0.5) scored.push({ kind: line.kind, index: line.index, text: line.text, score: share });
                });
                scored.sort(function (a, b) { return b.score - a.score || a.index - b.index; });
                r.lines = scored.slice(0, 3);
            });
            return results;
        }

        // marker(query)(text) -> [[start, end], ...]: the words of text that match the query, directly or by synonym
        function marker(query) {
            var want = {}, wantConcepts = {};
            queryTokens(query).forEach(function (q) { want[q.token] = true; q.concepts.forEach(function (c) { wantConcepts[c] = true; }); });
            return function (text) {
                var ranges = [], re = /[A-Za-z][A-Za-z0-9_.']*|\d+/g, m;
                text = String(text);
                while ((m = re.exec(text))) {
                    var stems = wordStems(m[0]), hit = false;
                    for (var i = 0; i < stems.length && !hit; i++) {
                        if (want[stems[i]]) hit = true;
                        else { var cs = wordConcepts[stems[i]]; if (cs) for (var j = 0; j < cs.length; j++) if (wantConcepts[cs[j]]) { hit = true; break; } }
                    }
                    if (hit) ranges.push([m.index, m.index + m[0].replace(/['.]+$/, '').length]);
                }
                return ranges;
            };
        }

        function get(id) {
            if (!id) return undefined;
            var key = String(id).trim().toLowerCase();
            if (byId[key]) return byId[key];
            var prefixes = ['mechanic:', 'recipe:', 'const:', 'article:'];
            for (var i = 0; i < prefixes.length; i++) if (byId[prefixes[i] + key]) return byId[prefixes[i] + key];
            // unique member name, e.g. "transferEnergy"
            var found = entries.filter(function (e) { return (e.name || '').toLowerCase() === key; });
            if (found.length === 1) return found[0];
            var creep = found.filter(function (e) { return e.object === 'Creep'; });
            return creep.length === 1 ? creep[0] : undefined;
        }

        function constant(name) {
            if (!index.constants || !(name in index.constants)) return undefined;
            return { name: name, value: index.constants[name], group: constGroup[name] ? constGroup[name].id : undefined };
        }

        // source(n) -> {label, url, community}: what proves a line; n is a number from entry.src[key][lineIndex]
        function source(n) {
            var s = (index.lineSources || [])[n];
            if (!s) return null;
            if (s.u) return { label: s.t, url: s.u, community: !!s.c };
            var m = (index.meta.sources || {})[s.r] || {};
            return {
                label: s.t || (s.r + ' ' + s.f.slice(s.f.lastIndexOf('/') + 1) + (s.l ? ':' + s.l : '')),
                url: (m.repo || 'https://github.com/screeps/' + s.r) + '/blob/' + (m.commit || 'master') + '/' + s.f + (s.l ? '#L' + s.l : ''),
                community: false
            };
        }

        return { search: search, get: get, constant: constant, marker: marker, source: source, entries: entries, meta: index.meta, analyse: analyse };
    }

    return { create: create, stem: stem };
}));
