'use strict';
// Platform recipes: jobs done from outside the game client.
// Steps say what to do; the notes and pitfalls carry the source for each step.
const { L, backend, driver, article, ref } = require('../../_h');

const DOCS = 'https://docs.screeps.com/';
const USER = 'lib/game/api/user.js';
const UTILS = 'lib/utils.js';
const grunt = find => ref('grunt-screeps', 'tasks/screeps.js', find);

module.exports = [
    // ------------------------------------------------------------------ 1.2
    {
        id: 'upload-code',
        title: 'Upload code from outside the client, and manage branches',
        summary: 'One HTTP request replaces all modules of a branch: `POST /api/user/code` with your auth token and a JSON body of branch and modules. Further endpoints list, copy, switch and delete branches. The open backend takes up to 5 MB of modules and 30 branches.',
        tasks: [
            'upload code from a script', 'push code to the server', 'commit code with grunt', 'upload code to the ptr', 'upload to the season server',
            'switch the active code branch', 'code size limit', 'how big can my code be',
        ],
        steps: [
            { text: 'Official server: make an auth token in your account settings. Keep it in a file that is not committed.' },
            { text: 'Collect the modules as one object: name → source text. The name is what `require` takes. A binary module is `{binary: "<base64>"}` instead of text.' },
            { text: 'Send `POST /api/user/code` with the header `X-Token` and the JSON body `{"branch": "default", "modules": {"main": "…"}}`. On `screeps.com` the paths are `/api/user/code` (main world), `/ptr/api/user/code` (PTR) and `/season/api/user/code` (season).' },
            { text: 'Read the answer: `ok: 1` means the branch now holds exactly the modules you sent. The next tick starts with a fresh global scope.' },
            { text: 'For other branches: `GET /api/user/branches` lists them, `POST /api/user/clone-branch` copies or creates one, `POST /api/user/set-active-branch` picks the one that runs, `POST /api/user/delete-branch` removes one.' },
            { text: 'Or let grunt-screeps do the request: options `token` and `branch`, plus `ptr: true` or `server: "season"` for those servers, the files under `src`, then `grunt screeps`.' },
        ],
        notes: [
            L('The docs name two ways: the grunt-screeps task, or a direct request to `/api/user/code`, where `POST` writes and `GET` reads. External upload needs an auth token.',
                article('commit')),
            L('grunt-screeps sends the `token` option as the `X-Token` header and posts to `screeps.com` under `/api/user/code`, `/ptr/api/user/code` or `/season/api/user/code`.',
                grunt("requestOptions.headers['X-Token'] = options.token;"),
                grunt("ptr: { name: 'PTR', host: 'screeps.com', path: '/ptr/api/user/code' },"),
                grunt("season: { name: 'Season', host: 'screeps.com', path: '/season/api/user/code' }")),
            L('The body is `{branch, modules}`. grunt-screeps leaves `branch` out when the option is not set.',
                grunt('var postData = {modules: modules};'), grunt('postData.branch = options.branch;')),
            L('Lines marked "open backend" are read from the public private-server code (screeps/backend-local); the code of the official server is not public.',
                backend(USER, "router.post('/code', auth.tokenAuth, jsonResponse((request) => {")),
            L('Open backend: without `branch` the upload goes to `$activeWorld`, the branch that runs in the world; `$activeSim` names the one active in the simulation. `GET /api/user/code` takes the same names.',
                backend(USER, "request.body.branch = request.body.branch || '$activeWorld';"),
                backend(USER, "request.query.branch = request.query.branch || '$activeWorld';"),
                backend(USER, "if(!_.contains(['activeWorld','activeSim'], request.body.activeName)) {")),
            L('Open backend: the upload replaces the whole module set of the branch, so a module you leave out is gone.',
                backend(USER, 'modules: utils.translateModulesToDb(request.body.modules),')),
            L('Open backend: the `modules` object as JSON may not be longer than 5 MB; the answer is then "code length exceeds 5 MB limit".',
                backend(USER, 'if (JSON.stringify(request.body.modules).length > 5 * 1024 * 1024) {')),
            L('Open backend: a module `main` is added empty when it is missing. A module whose name starts with `$`, `.`, `/` or `\\` is dropped.',
                backend(UTILS, 'if(!modules.main) {'), backend(UTILS, "if(newKey[0] == '$') {"),
                backend(UTILS, "var newKey = key.replace(/\\./g,'$DOT$');")),
            L('Open backend: at most 30 branches per account, a further one answers "too many branches". Copying onto an existing name overwrites that branch.',
                backend(USER, ".then((count) => count >= 30 ? q.reject('too many branches') : true)"),
                backend(USER, '}, {upsert: true}))')),
            L('Open backend: `clone-branch` takes `branch` (the source, at most 30 characters), `newName`, and `defaultModules` for a new branch without a source; with neither the new branch has an empty `main`.',
                backend(USER, 'if (request.body.branch && (!_.isString(request.body.branch) || request.body.branch.length > 30)) {'),
                backend(USER, "modules: data ? data.modules : (request.body.defaultModules || {main: ''}),")),
            L('Open backend: `set-active-branch` takes `branch` and `activeName`, which is `activeWorld` or `activeSim`. `delete-branch` takes `branch` and leaves it alone while it is active for either.',
                backend(USER, "if(!_.contains(['activeWorld','activeSim'], request.body.activeName)) {"),
                backend(USER, '{activeWorld: {$ne: true}},')),
            L('Open private server: after an upload the runner sees a newer code timestamp and discards your isolate, so the next tick has an empty global scope and loads every module again.',
                backend(USER, 'timestamp: new Date().getTime()'),
                driver('lib/runtime/user-vm.js', '} else if(codeTimestamp > vms[userId].codeTimestamp) {')),
            L('Official limits for token requests: `POST /api/user/code` 240 per day, `GET /api/user/code` 60 per hour, `POST /api/user/set-active-branch` 240 per day.',
                article('auth-tokens#Rate-Limiting')),
            L('Code on the PTR is wiped every Monday with the rest of the PTR data.',
                article('ptr')),
        ],
        pitfalls: [
            L('Open backend: uploading to a branch that does not exist fails with "branch does not exist"; create it first with `clone-branch`.',
                backend(USER, "return q.reject('branch does not exist');")),
            L('grunt-screeps takes only the file name: `a/util.js` and `b/util.js` both become the module `util`, and the later one wins. Flatten folders into names such as `a_util` before uploading.',
                grunt("name = basename.replace(ext,'');"), article('contributed/advanced_grunt')),
            L('Keep the token out of the repository: the contributed grunt article reads credentials from a separate file listed in `.gitignore`.',
                article('contributed/advanced_grunt')),
        ],
        see: ['mechanic:web-api', 'mechanic:binary-modules', 'mechanic:ptr', 'mechanic:simulation', 'mechanic:memory', 'article:modules'],
        url: DOCS + 'commit.html',
    },
];
