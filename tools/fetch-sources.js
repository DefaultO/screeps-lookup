#!/usr/bin/env node
'use strict';
/*
 * Fetches or updates the public sources the index is built from, into sources/ (not committed):
 *   the public repositories of the screeps organisation that hold rules, the private server or tools
 *   (docs, common, engine, driver, backend-local, screeps, launcher, storage, renderer, grunt-screeps,
 *   tutorial-scripts, mod-season1, mod-season2, mod-season5)
 * Nothing in them is executed, except that build.js evaluates common/lib/constants.js
 * (plain data) in an empty context.
 *   node tools/fetch-sources.js [--dir <folder>]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const i = argv.indexOf('--dir');
const dir = path.resolve(i === -1 ? path.join(__dirname, '..', 'sources') : argv[i + 1]);
const repos = ['docs', 'common', 'engine', 'backend-local', 'driver', 'screeps', 'launcher', 'storage', 'renderer', 'grunt-screeps', 'tutorial-scripts', 'mod-season1', 'mod-season2', 'mod-season5'];

fs.mkdirSync(dir, { recursive: true });
for (const name of repos) {
    const target = path.join(dir, name);
    // core.longpaths: a deep folder on Windows otherwise fails with "Filename too long"
    const git = args => execFileSync('git', ['-c', 'core.longpaths=true'].concat(args), { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' }).trim();
    if (fs.existsSync(path.join(target, '.git'))) {
        const before = git(['-C', target, 'rev-parse', 'HEAD']);
        git(['-C', target, 'pull', '--ff-only', '--depth', '1', '-q']);
        const after = git(['-C', target, 'rev-parse', 'HEAD']);
        console.log(`${name}: ${before === after ? 'unchanged' : 'updated ' + before.slice(0, 10) + ' -> ' + after.slice(0, 10)} (${git(['-C', target, 'log', '-1', '--format=%cs'])})`);
    } else {
        git(['clone', '--depth', '1', '-q', `https://github.com/screeps/${name}.git`, target]);
        console.log(`${name}: cloned ${git(['-C', target, 'rev-parse', 'HEAD']).slice(0, 10)} (${git(['-C', target, 'log', '-1', '--format=%cs'])})`);
    }
}
console.log('next: node tools/build.js && node tools/test.js');
