'use strict';
// Constant groups. Every constant of @screeps/common lands in the first group that claims it
// (by name or by pattern); the build warns about constants that no group claims.
// tables: functions of the constants returning {title, head, rows, foot}.

const HITS = {
    spawn: 'SPAWN_HITS', extension: 'EXTENSION_HITS', road: 'ROAD_HITS', constructedWall: 'WALL_HITS_MAX', link: 'LINK_HITS_MAX', storage: 'STORAGE_HITS',
    tower: 'TOWER_HITS', observer: 'OBSERVER_HITS', powerSpawn: 'POWER_SPAWN_HITS', extractor: 'EXTRACTOR_HITS', lab: 'LAB_HITS', terminal: 'TERMINAL_HITS',
    container: 'CONTAINER_HITS', nuker: 'NUKER_HITS', factory: 'FACTORY_HITS',
};
const CAPACITY = {
    spawn: C => C.SPAWN_ENERGY_CAPACITY + ' energy', extension: C => `${C.EXTENSION_ENERGY_CAPACITY[1]}–${C.EXTENSION_ENERGY_CAPACITY[8]} energy`, link: C => C.LINK_CAPACITY + ' energy',
    storage: C => C.STORAGE_CAPACITY, tower: C => C.TOWER_CAPACITY + ' energy', powerSpawn: C => `${C.POWER_SPAWN_ENERGY_CAPACITY} energy, ${C.POWER_SPAWN_POWER_CAPACITY} power`,
    lab: C => `${C.LAB_MINERAL_CAPACITY} mineral, ${C.LAB_ENERGY_CAPACITY} energy`, terminal: C => C.TERMINAL_CAPACITY, container: C => C.CONTAINER_CAPACITY,
    nuker: C => `${C.NUKER_ENERGY_CAPACITY} energy, ${C.NUKER_GHODIUM_CAPACITY} G`, factory: C => C.FACTORY_CAPACITY,
};

const structuresTable = C => ({
    title: 'Structures',
    head: ['type', 'cost', 'hits', 'capacity', 'from RCL', 'max'],
    rows: Object.keys(C.CONSTRUCTION_COST).map(t => {
        const per = C.CONTROLLER_STRUCTURES[t] || {};
        const first = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(l => per[l] > 0);
        const hits = t === 'rampart' ? `1 → ${C.RAMPART_HITS_MAX[8]}` : t === 'constructedWall' ? `1 → ${C[HITS[t]]}` : C[HITS[t]];
        return [t, C.CONSTRUCTION_COST[t], hits, CAPACITY[t] ? CAPACITY[t](C) : '—', first === undefined ? '—' : first, per[8]];
    }),
});

const bodyTable = C => ({
    title: 'Body parts',
    head: ['part', 'cost', 'effect per part'],
    rows: [
        ['MOVE', C.BODYPART_COST.move, 'removes 2 fatigue per tick'],
        ['WORK', C.BODYPART_COST.work, `harvest ${C.HARVEST_POWER} energy (mineral ${C.HARVEST_MINERAL_POWER}), build ${C.BUILD_POWER}, repair ${C.REPAIR_POWER} hits for ${C.REPAIR_POWER * C.REPAIR_COST} energy, dismantle ${C.DISMANTLE_POWER} hits, upgrade ${C.UPGRADE_CONTROLLER_POWER}`],
        ['CARRY', C.BODYPART_COST.carry, `holds ${C.CARRY_CAPACITY}; weighs nothing while empty`],
        ['ATTACK', C.BODYPART_COST.attack, `${C.ATTACK_POWER} damage at range 1`],
        ['RANGED_ATTACK', C.BODYPART_COST.ranged_attack, `${C.RANGED_ATTACK_POWER} damage at range 3; mass attack ${C.RANGED_ATTACK_POWER}/${C.RANGED_ATTACK_POWER * 0.4}/${C.RANGED_ATTACK_POWER * 0.1} at range 1/2/3`],
        ['HEAL', C.BODYPART_COST.heal, `${C.HEAL_POWER} hits at range 1, ${C.RANGED_HEAL_POWER} at range 3`],
        ['CLAIM', C.BODYPART_COST.claim, `claim; reserve +${C.CONTROLLER_RESERVE} tick; attack controller −${C.CONTROLLER_CLAIM_DOWNGRADE} downgrade ticks. Creep lives ${C.CREEP_CLAIM_LIFE_TIME} ticks, no renew`],
        ['TOUGH', C.BODYPART_COST.tough, '100 cheap hits; boosted it takes less damage'],
    ],
    foot: `Every part has 100 hits and takes ${C.CREEP_SPAWN_TIME} ticks to spawn. At most ${C.MAX_CREEP_SIZE} parts.`,
});

const boostTable = C => {
    const rows = [];
    for (const [part, compounds] of Object.entries(C.BOOSTS)) {
        for (const [compound, effects] of Object.entries(compounds)) {
            rows.push([part.toUpperCase(), compound, Object.entries(effects).map(([k, v]) => `${k} ×${v}`).join(', ')]);
        }
    }
    return { title: 'Boosts', head: ['part', 'compound', 'effect'], rows,
        foot: `${C.LAB_BOOST_MINERAL} compound + ${C.LAB_BOOST_ENERGY} energy per part. "damage ×0.3" means the part takes 30% of the damage. "capacity" multiplies ${C.CARRY_CAPACITY}; "fatigue" multiplies the 2 fatigue a MOVE part removes.` };
};

const reactionTable = C => {
    const seen = {};
    for (const [a, others] of Object.entries(C.REACTIONS)) {
        for (const [b, product] of Object.entries(others)) if (!seen[product]) seen[product] = [a, b];
    }
    return { title: 'Reactions', head: ['product', 'from', 'cooldown'],
        rows: Object.keys(C.REACTION_TIME).filter(p => seen[p]).map(p => [p, seen[p].join(' + '), C.REACTION_TIME[p]]),
        foot: `Each run uses ${C.LAB_REACTION_AMOUNT} of each reagent and makes ${C.LAB_REACTION_AMOUNT}.` };
};

const powerTable = C => {
    const names = {};
    for (const [k, v] of Object.entries(C)) if (/^PWR_/.test(k)) names[v] = k;
    return { title: 'Powers (operator)', head: ['power', 'creep level for 1–5', 'cooldown', 'duration', 'range', 'ops', 'effect at 1–5'],
        rows: Object.entries(C.POWER_INFO).map(([id, p]) => [names[id] || id, p.level.join('/'), p.cooldown, p.duration === undefined ? '—' : p.duration,
            p.range === undefined ? '—' : p.range, p.ops === undefined ? '—' : (Array.isArray(p.ops) ? p.ops.join('/') : p.ops), Array.isArray(p.effect) ? p.effect.join('/') : (p.effect === undefined ? '—' : String(p.effect))]) };
};

const commodityTable = C => ({
    title: 'Factory recipes', head: ['product', 'level', 'makes', 'cooldown', 'from'],
    rows: Object.entries(C.COMMODITIES).map(([name, c]) => [name, c.level || '—', c.amount, c.cooldown, Object.entries(c.components).map(([k, v]) => `${v} ${k}`).join(', ')]),
});

const controllerTable = C => ({
    title: 'Per room level',
    head: ['RCL', 'energy to next', 'downgrade ticks', 'spawn energy', 'rampart max hits'],
    rows: [1, 2, 3, 4, 5, 6, 7, 8].map(l => [l, C.CONTROLLER_LEVELS[l] || '—', C.CONTROLLER_DOWNGRADE[l],
        C.CONTROLLER_STRUCTURES.spawn[l] * C.SPAWN_ENERGY_CAPACITY + C.CONTROLLER_STRUCTURES.extension[l] * C.EXTENSION_ENERGY_CAPACITY[l], C.RAMPART_HITS_MAX[l] || '—']),
    foot: 'Spawn energy = all spawns and extensions of that level together.',
});

module.exports = [
    {
        id: 'return-codes', title: 'Return codes (OK, ERR_*)',
        summary: 'What the action methods return. OK means the intent was queued, not that it will succeed.',
        tasks: ['what does a return code mean', 'error code -9', 'ERR_NOT_IN_RANGE', 'meaning of ERR_BUSY', 'what does -6 mean'],
        match: [/^OK$/, /^ERR_/],
        notes: [
            'ERR_NOT_OWNER (-1): not your object, or a room owned or reserved by someone else. ERR_BUSY (-4): the creep is still spawning, or the spawn is busy. ERR_NOT_ENOUGH_RESOURCES / _ENERGY / _EXTENSIONS (all -6). ERR_INVALID_TARGET (-7): wrong kind of target, or the target cannot take the action. ERR_FULL (-8). ERR_NOT_IN_RANGE (-9). ERR_INVALID_ARGS (-10). ERR_TIRED (-11): fatigue or cooldown. ERR_NO_BODYPART (-12): no working part of the needed type; also returned for hostile actions in a room under someone else\'s safe mode. ERR_RCL_NOT_ENOUGH (-14). ERR_GCL_NOT_ENOUGH (-15).',
            'Only a call that returns OK costs the 0.2 CPU intent fee.',
        ],
        see: ['mechanic:cpu', 'mechanic:simultaneous-actions'],
    },
    { id: 'find', title: 'FIND_* constants', summary: 'What Room.find and the findClosest/findInRange methods can list.', tasks: ['find constants', 'what can Room.find return'], match: [/^FIND_/], see: ['Room.find', 'RoomPosition.findClosestByRange'] },
    { id: 'look', title: 'LOOK_* constants', summary: 'Object kinds for lookAt and lookFor.', tasks: ['look constants'], match: [/^LOOK_/], see: ['Room.lookForAt', 'RoomPosition.lookFor'] },
    { id: 'directions', title: 'Directions', summary: 'TOP = 1, clockwise to TOP_LEFT = 8.', tasks: ['direction constants', 'direction numbers'], names: ['TOP', 'TOP_RIGHT', 'RIGHT', 'BOTTOM_RIGHT', 'BOTTOM', 'BOTTOM_LEFT', 'LEFT', 'TOP_LEFT'], see: ['Creep.move', 'RoomPosition.getDirectionTo'] },
    { id: 'colors', title: 'Flag colors', summary: 'COLOR_* values for flags.', tasks: ['flag colors'], match: [/^COLOR/], see: ['Flag'] },
    {
        id: 'body-parts', title: 'Body parts: cost and power',
        summary: 'What each body part costs and does per tick.',
        tasks: ['body part costs', 'how much does a body part cost', 'what does each body part do', 'damage per ATTACK part', 'how much does a WORK part harvest', 'how much does a CARRY part hold', 'cost of a CLAIM part'],
        names: ['MOVE', 'WORK', 'CARRY', 'ATTACK', 'RANGED_ATTACK', 'TOUGH', 'HEAL', 'CLAIM', 'BODYPART_COST', 'BODYPARTS_ALL', 'MAX_CREEP_SIZE', 'CARRY_CAPACITY', 'HARVEST_POWER', 'HARVEST_MINERAL_POWER',
            'HARVEST_DEPOSIT_POWER', 'REPAIR_POWER', 'DISMANTLE_POWER', 'BUILD_POWER', 'ATTACK_POWER', 'UPGRADE_CONTROLLER_POWER', 'RANGED_ATTACK_POWER', 'HEAL_POWER', 'RANGED_HEAL_POWER', 'REPAIR_COST', 'DISMANTLE_COST'],
        tables: [bodyTable],
        see: ['const:boosts', 'StructureSpawn.spawnCreep', 'mechanic:movement', 'mechanic:damage-and-healing', 'recipe:spawning'],
    },
    {
        id: 'creep-life', title: 'Creep life, spawning and renewing',
        summary: 'Life times, spawn time, renew ratio and what a corpse returns.',
        tasks: ['how long does a creep live', 'creep life time', 'spawn time per part'],
        names: ['CREEP_LIFE_TIME', 'CREEP_CLAIM_LIFE_TIME', 'CREEP_CORPSE_RATE', 'CREEP_PART_MAX_ENERGY', 'CREEP_SPAWN_TIME', 'SPAWN_RENEW_RATIO', 'SPAWN_ENERGY_START'],
        see: ['StructureSpawn.renewCreep', 'mechanic:creep-death', 'recipe:spawning'],
    },
    {
        id: 'boosts', title: 'Boosts',
        summary: 'Which compound multiplies which action of which body part.',
        tasks: ['what does a boosted HEAL part heal', 'which compound boosts what', 'boost table', 'what does XGHO2 do', 'boost for upgrading', 'boost for harvesting', 'tough boost'],
        names: ['BOOSTS', 'LAB_BOOST_ENERGY', 'LAB_BOOST_MINERAL', 'LAB_UNBOOST_ENERGY', 'LAB_UNBOOST_MINERAL'],
        tables: [boostTable],
        notes: ['HEAL with XLHO2 heals {{HEAL_POWER * BOOSTS.heal.XLHO2.heal}} adjacent and {{RANGED_HEAL_POWER * BOOSTS.heal.XLHO2.rangedHeal}} at range. WORK with XUHO2 harvests {{HARVEST_POWER * BOOSTS.work.XUHO2.harvest}}. Build, repair and upgrade boosts add output without using more energy.'],
        see: ['StructureLab.boostCreep', 'recipe:labs-and-boosts', 'mechanic:damage-and-healing', 'const:reactions'],
    },
    {
        id: 'reactions', title: 'Lab reactions',
        summary: 'Which two reagents make which compound, and the cooldown of each reaction.',
        tasks: ['how to make a compound', 'reaction table', 'what makes ghodium', 'how to make OH', 'reaction time'],
        names: ['REACTIONS', 'REACTION_TIME'], match: [/^LAB_/],
        tables: [reactionTable],
        see: ['StructureLab.runReaction', 'recipe:labs-and-boosts', 'const:boosts'],
    },
    {
        id: 'decay', title: 'Decay constants',
        summary: 'Timers and amounts for everything that decays.',
        tasks: ['decay constants', 'decay rates'],
        match: [/DECAY/, /^ROAD_WEAROUT/, /^RUIN_/, /^TOMBSTONE_/],
        see: ['mechanic:decay'],
    },
    {
        id: 'controller', title: 'Controller, GCL and safe mode constants',
        summary: 'Level requirements, downgrade timers, reservation, safe mode, GCL formula.',
        tasks: ['energy per controller level', 'controller downgrade time', 'rampart max hits per level', 'spawn energy per room level', 'how many extensions per level'],
        match: [/^CONTROLLER_/, /^SAFE_MODE_/, /^GCL_/, /^RAMPART_HITS/, /^EXTENSION_ENERGY_CAPACITY$/],
        tables: [controllerTable],
        see: ['mechanic:controller', 'mechanic:safe-mode', 'mechanic:reservation'],
    },
    { id: 'tower', title: 'Tower constants', summary: 'Power, range, falloff and energy cost of towers.', tasks: ['tower constants'], match: [/^TOWER_/], see: ['mechanic:tower'] },
    { id: 'link', title: 'Link constants', summary: 'Capacity, loss and cooldown of links.', tasks: ['link constants', 'link loss'], match: [/^LINK_/], see: ['StructureLink.transferEnergy'] },
    { id: 'terminal-market', title: 'Terminal and market constants', summary: 'Terminal capacity and cooldown, market fee and order limits.', tasks: ['market fee', 'terminal cooldown'], match: [/^TERMINAL_/, /^MARKET_/, /^ORDER_/], see: ['recipe:terminal-and-market'] },
    {
        id: 'power', title: 'Power constants',
        summary: 'Power creeps, the powers and their numbers, power banks and power spawns.',
        tasks: ['power info', 'what does PWR_OPERATE_SPAWN do', 'ops cost of a power', 'power cooldowns', 'power bank constants'],
        match: [/^POWER_/, /^PWR_/, /^EFFECT_/],
        tables: [powerTable],
        see: ['PowerCreep.usePower', 'recipe:power', 'recipe:observer-and-power'],
    },
    { id: 'nukes', title: 'Nuke constants', summary: 'Nuker cost, cooldown, range, flight time and damage.', tasks: ['nuke damage', 'nuke range'], match: [/^NUKE/], see: ['mechanic:nukes'] },
    { id: 'invaders', title: 'Invader and stronghold constants', summary: 'Raid goal, invader core and stronghold numbers.', tasks: ['invader constants', 'INVADERS_ENERGY_GOAL'], match: [/^INVADER/, /^STRONGHOLD/], see: ['mechanic:invaders'] },
    {
        id: 'sources-minerals', title: 'Source, mineral and deposit constants',
        summary: 'Source capacities and regeneration, mineral amounts and densities, extractor and deposit numbers.',
        tasks: ['source capacity', 'mineral regeneration time', 'mineral density'],
        match: [/^SOURCE_/, /^ENERGY_REGEN_TIME$/, /^MINERAL_/, /^DENSITY_/, /^EXTRACTOR_COOLDOWN$/, /^DEPOSIT_/],
        see: ['mechanic:sources', 'Mineral', 'Deposit'],
    },
    {
        id: 'structures', title: 'Structures: cost, hits, capacity, room level',
        summary: 'Build cost, hits, capacity and availability of every structure.',
        tasks: ['how much does a structure cost', 'structure hits', 'structure capacity', 'construction cost', 'how many towers at level', 'when is a structure available', 'cost of a road', 'cost of a container', 'which objects block movement'],
        match: [/^STRUCTURE_/, /^CONSTRUCTION_COST/, /_HITS(_MAX)?$/, /^(SPAWN_ENERGY|STORAGE|CONTAINER|FACTORY|LAB)_CAPACITY$/, /^OBSTACLE_OBJECT_TYPES$/, /^MAX_CONSTRUCTION_SITES$/, /^OBSERVER_RANGE$/],
        tables: [structuresTable],
        see: ['mechanic:controller', 'Room.createConstructionSite', 'mechanic:decay'],
    },
    { id: 'resources', title: 'Resource names', summary: 'RESOURCE_* constants: energy, power, minerals, compounds, commodities, account items.', tasks: ['resource constants', 'resource names', 'name of a mineral'], match: [/^RESOURCE/, /^INTERSHARD_RESOURCES$/, /^(SUBSCRIPTION_TOKEN|CPU_UNLOCK|PIXEL|ACCESS_KEY)$/], see: ['const:reactions', 'const:commodities'] },
    { id: 'commodities', title: 'Factory commodities', summary: 'What the factory makes from what, at which level, with which cooldown.', tasks: ['factory recipes', 'how to make a battery', 'commodity components'], names: ['COMMODITIES'], tables: [commodityTable], see: ['StructureFactory.produce'] },
    { id: 'events', title: 'Event log constants', summary: 'EVENT_* types and sub-types in Room.getEventLog.', tasks: ['event constants', 'event log types'], match: [/^EVENT_/], see: ['Room.getEventLog'] },
    {
        id: 'world', title: 'World, terrain and misc constants',
        summary: 'Terrain masks, world size, portal timers, limits and account items.',
        tasks: ['terrain mask values', 'flag limit', 'dropped energy decay constant'],
        match: [/^TERRAIN_/, /^WORLD_/, /^PORTAL_/, /^MODE_/, /^FLAGS_LIMIT$/, /^SYSTEM_USERNAME$/, /^SIGN_/, /^PIXEL_CPU_COST$/, /^ENERGY_DECAY$/],
        see: ['Room.getTerrain', 'mechanic:room-types'],
    },
];
