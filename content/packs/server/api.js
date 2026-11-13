'use strict';
// Private server: what two API members return there. Notes only; the summaries stay with the base files.
const { L, eng, backend, driver } = require('../../_h');

module.exports = {
    'Game.cpu.limit': {
        notes: [
            L('On a private server the limit is the `cpu` field of the user document: 100 for a new player, whatever the GCL, until the administrator changes it.',
                backend('lib/game/api/auth.js', 'cpu: 100,'),
                eng('src/game/game.js', 'limit: runtimeData.user.cpu,')),
        ],
        see: ['mechanic:ps-differences', 'recipe:ps-admin-db'],
    },
    'Game.shard': {
        notes: [
            L('On a private server `name` is the host name of the server machine, `type` is `normal` and `ptr` is false.',
                driver('lib/index.js', 'value: "${os.hostname()}",'),
                driver('lib/index.js', "value: 'normal',")),
        ],
        see: ['mechanic:ps-differences'],
    },
};
