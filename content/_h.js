'use strict';
/*
 * Helpers for content files.
 *
 *   const { L, eng, backend, driver, doc, article } = require('./_h');     // '../../_h' inside a pack
 *
 *   L('A reservation loses 1 tick per tick.', eng('src/processor/intents/controllers/tick.js', 'object.reservation.endTime-1'))
 *
 * L(text, ...sources) is one line of pitfalls, notes or facts together with what proves it.
 * A source is a line of code (file path inside the repository + a piece of that line, which the
 * build looks up and turns into a link with a line number) or a page of the official docs.
 * The build fails when the piece of code is no longer there.
 */
const code = repo => (file, find, label) => Object.assign({ file, find }, repo === 'engine' ? {} : { repo }, label ? { label } : {});

module.exports = {
    L: (t, ...src) => (src.length ? { t, src } : t),
    eng: code('engine'),            // screeps/engine, e.g. eng('src/processor/intents/creeps/transfer.js', 'storedAmount + amount')
    backend: code('backend-local'), // screeps/backend-local, e.g. backend('lib/cronjobs.js', 'function createRaid')
    driver: code('driver'),         // screeps/driver: the runtime around a player script
    common: code('common'),         // @screeps/common
    doc: id => ({ doc: id }),                       // API reference entry: doc('Creep.transfer')
    article: slug => ({ doc: 'article:' + slug }),  // official article: article('control') or article('invaders#Raids')
};
