'use strict';
// Own text laid over the entries parsed from the official API reference.
// Keys are entry ids (Object.member). The build warns when a key no longer exists in the docs.
module.exports = Object.assign({},
    require('./api-creep'),
    require('./api-room'),
    require('./api-structures'),
    require('./api-game'),
    require('./api-misc'));
