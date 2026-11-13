'use strict';
// Economy pack: one-line meanings for the constants of const:boosts, const:reactions, const:terminal-market,
// const:sources-minerals, const:commodities, const:link, and for the resource names that do not explain themselves.
// The behaviour behind each line is sourced in the mechanics of this pack.

// a compound: "UH": tier 1, boosts ATTACK parts: attack ×2.
const compound = (symbol, tier, part, action, what) => `"${symbol}", tier ${tier} compound: boosts ${part.toUpperCase()} parts, ${what} ×{{BOOSTS.${part}.${symbol}.${action}}}.`;
// the three tiers of one family: [constant suffix, symbol]
const family = (tiers, part, action, what) => {
    const out = {};
    tiers.forEach(([name, symbol], i) => { out['RESOURCE_' + name] = compound(symbol, i + 1, part, action, what); });
    return out;
};
// a bar: compressed form of a mineral
const bar = (name, mineral) => `Compressed ${mineral}: {{COMMODITIES.${name}.components.${mineral}}} ${mineral} + {{COMMODITIES.${name}.components.energy}} energy make {{COMMODITIES.${name}.amount}} in a factory, and back.`;
// the commodities of one deposit chain
const chain = (raw, names) => {
    const out = {};
    names.forEach((name, i) => {
        out['RESOURCE_' + name.toUpperCase()] = i === 0
            ? `Commodity of the ${raw} chain, made in any factory from ${raw}.`
            : `Commodity of the ${raw} chain, factory level {{COMMODITIES.${name}.level}}.`;
    });
    return out;
};

module.exports = Object.assign({
    // ---------------------------------------------------------------- const:boosts
    LAB_BOOST_ENERGY: 'Energy a lab spends per body part it boosts.',
    LAB_BOOST_MINERAL: 'Compound a lab spends per body part it boosts.',
    LAB_UNBOOST_ENERGY: 'Energy dropped per part when a creep is unboosted.',
    LAB_UNBOOST_MINERAL: 'Compound dropped on the creep\'s tile per part when it is unboosted; it also scales the lab cooldown after unboostCreep.',
    BOOSTS: 'BOOSTS[part type][compound][action] is the multiplier for that action of a part boosted with that compound. For TOUGH, damage is the share of damage taken.',

    // ---------------------------------------------------------------- const:reactions
    LAB_HITS: 'Hits of a lab.',
    LAB_MINERAL_CAPACITY: 'Most a lab holds of its one mineral or compound.',
    LAB_ENERGY_CAPACITY: 'Most energy a lab holds; the energy is used only for boosting.',
    LAB_COOLDOWN: 'Not used by the engine. The cooldown after a reaction is REACTION_TIME of the product.',
    LAB_REACTION_AMOUNT: 'Units taken from each source lab, and units of product made, per reaction run.',
    REACTIONS: 'REACTIONS[a][b] is the compound made from a and b; every pair is listed in both orders.',
    REACTION_TIME: 'Cooldown in ticks of the producing lab after one run, by product. Reversing the compound costs the same.',

    // ---------------------------------------------------------------- const:terminal-market
    TERMINAL_CAPACITY: 'Most a terminal holds, all resources together.',
    TERMINAL_HITS: 'Hits of a terminal.',
    TERMINAL_SEND_COST: 'Not used by the engine. The transfer cost is ceil(amount × (1 − e^(−distance / 30))) energy.',
    TERMINAL_MIN_SEND: 'Not used by the engine: send has no minimum amount.',
    TERMINAL_COOLDOWN: 'Ticks a terminal waits after it sent something or was used to make a deal.',
    MARKET_FEE: 'Share of price × amount charged in credits when an order is created, extended or raised in price.',
    MARKET_MAX_ORDERS: 'Most orders one player can have at a time; inactive and filled ones count.',
    MARKET_ORDER_LIFE_TIME: 'Life time of an order in milliseconds of real time: {{MARKET_ORDER_LIFE_TIME / 86400000}} days. Then it is removed and the fee of its unfilled part is paid back.',
    ORDER_SELL: 'Order type: you offer a resource out of your terminal.',
    ORDER_BUY: 'Order type: you ask for a resource to be delivered to your terminal.',

    // ---------------------------------------------------------------- const:sources-minerals
    ENERGY_REGEN_TIME: 'Ticks from the moment a source drops below full until it is refilled completely.',
    SOURCE_ENERGY_CAPACITY: 'Energy of a full source in a room that is owned or reserved.',
    SOURCE_ENERGY_NEUTRAL_CAPACITY: 'Energy of a full source in a room whose controller nobody owns or has reserved.',
    SOURCE_ENERGY_KEEPER_CAPACITY: 'Energy of a full source in a room without a controller, such as a source keeper room.',
    EXTRACTOR_COOLDOWN: 'Cooldown a mineral harvest puts on the extractor; the next harvest is possible {{EXTRACTOR_COOLDOWN + 1}} ticks after the last.',
    MINERAL_REGEN_TIME: 'Ticks from the moment a mineral is emptied until it is full again.',
    MINERAL_MIN_AMOUNT: 'Not used by the engine; a refill takes its amount from MINERAL_DENSITY.',
    MINERAL_RANDOM_FACTOR: 'Not used by the engine.',
    MINERAL_DENSITY: 'Amount a mineral is refilled to, by density ({{DENSITY_LOW}} low to {{DENSITY_ULTRA}} ultra).',
    MINERAL_DENSITY_PROBABILITY: 'Cumulative thresholds for drawing a density: a random number up to the value picks that density.',
    MINERAL_DENSITY_CHANGE: 'Chance that a moderate or high mineral gets a new density at a refill. Low and ultra always get a new one.',
    DENSITY_LOW: 'Mineral density: a refill gives {{MINERAL_DENSITY[DENSITY_LOW]}}.',
    DENSITY_MODERATE: 'Mineral density: a refill gives {{MINERAL_DENSITY[DENSITY_MODERATE]}}.',
    DENSITY_HIGH: 'Mineral density: a refill gives {{MINERAL_DENSITY[DENSITY_HIGH]}}.',
    DENSITY_ULTRA: 'Mineral density: a refill gives {{MINERAL_DENSITY[DENSITY_ULTRA]}}.',
    DEPOSIT_EXHAUST_MULTIPLY: 'Factor of the deposit cooldown: ceil(DEPOSIT_EXHAUST_MULTIPLY × total harvested ^ DEPOSIT_EXHAUST_POW) ticks after each harvest.',
    DEPOSIT_EXHAUST_POW: 'Exponent of the deposit cooldown: above 1, so the cooldown grows faster than the total harvested.',

    // ---------------------------------------------------------------- const:commodities
    COMMODITIES: 'COMMODITIES[product] = {amount made per produce call, cooldown in ticks, components taken from the factory, level: the factory level needed (absent = any factory)}.',

    // ---------------------------------------------------------------- const:link
    LINK_HITS: 'Hits of a new link.',
    LINK_HITS_MAX: 'Most hits a link can have.',
    LINK_CAPACITY: 'Most energy a link holds.',
    LINK_COOLDOWN: 'Cooldown ticks of the sending link per tile of distance to the receiving link.',
    LINK_LOSS_RATIO: 'Share of the sent energy that is lost on the way, rounded up.',

    // ---------------------------------------------------------------- const:resources
    SUBSCRIPTION_TOKEN: 'Account item "token". It is held by the account, not in a room, and trades on the market without a terminal.',
    CPU_UNLOCK: 'Account item "cpuUnlock", used up by Game.cpu.unlock. It trades on the market without a terminal.',
    PIXEL: 'Account item "pixel", made by Game.cpu.generatePixel. It trades on the market without a terminal.',
    ACCESS_KEY: 'Account item "accessKey", used up by Game.shard.activateAccess. It trades on the market without a terminal.',
    RESOURCES_ALL: 'Every resource a store can hold. transfer, withdraw, drop and terminal send accept only these names.',
    INTERSHARD_RESOURCES: 'The account items (token, cpuUnlock, pixel, accessKey): listed in Game.resources and traded on the market without a terminal.',

    RESOURCE_CATALYST: '"X", a base mineral: tier 2 compound + X makes the tier 3 compound.',
    RESOURCE_GHODIUM: '"G": not mined, made from ZK + UL. Base of the TOUGH and upgrade boosts; a nuker and generateSafeMode use it too.',
    RESOURCE_HYDROXIDE: '"OH" = H + O. Tier 1 compound + OH makes the tier 2 compound.',
    RESOURCE_ZYNTHIUM_KEANITE: '"ZK" = Z + K. Its only use is making G together with UL.',
    RESOURCE_UTRIUM_LEMERGITE: '"UL" = U + L. Its only use is making G together with ZK.',
    RESOURCE_OPS: '"ops": made by a power creep with PWR_GENERATE_OPS and spent when it uses its other powers.',

    RESOURCE_SILICON: 'Raw resource from deposits; with utrium bars it makes wire.',
    RESOURCE_BIOMASS: 'Raw resource from deposits; with lemergium bars it makes cell.',
    RESOURCE_METAL: 'Raw resource from deposits; with zynthium bars it makes alloy.',
    RESOURCE_MIST: 'Raw resource from deposits; with keanium bars it makes condensate.',

    RESOURCE_UTRIUM_BAR: bar('utrium_bar', 'U'),
    RESOURCE_LEMERGIUM_BAR: bar('lemergium_bar', 'L'),
    RESOURCE_ZYNTHIUM_BAR: bar('zynthium_bar', 'Z'),
    RESOURCE_KEANIUM_BAR: bar('keanium_bar', 'K'),
    RESOURCE_GHODIUM_MELT: bar('ghodium_melt', 'G'),
    RESOURCE_OXIDANT: bar('oxidant', 'O'),
    RESOURCE_REDUCTANT: bar('reductant', 'H'),
    RESOURCE_PURIFIER: bar('purifier', 'X'),
    RESOURCE_BATTERY: 'Compressed energy: {{COMMODITIES.battery.components.energy}} energy make {{COMMODITIES.battery.amount}} in a factory; {{COMMODITIES.energy.components.battery}} give {{COMMODITIES.energy.amount}} energy back.',

    RESOURCE_COMPOSITE: 'Shared component for higher commodities, made from utrium and zynthium bars at factory level {{COMMODITIES.composite.level}}.',
    RESOURCE_CRYSTAL: 'Shared component for higher commodities, made from lemergium and keanium bars and purifier at factory level {{COMMODITIES.crystal.level}}.',
    RESOURCE_LIQUID: 'Shared component for higher commodities, made from oxidant, reductant and ghodium melt at factory level {{COMMODITIES.liquid.level}}.',
},
// ---------------------------------------------------------------- compounds: which part, which action
family([['UTRIUM_HYDRIDE', 'UH'], ['UTRIUM_ACID', 'UH2O'], ['CATALYZED_UTRIUM_ACID', 'XUH2O']], 'attack', 'attack', 'attack'),
family([['UTRIUM_OXIDE', 'UO'], ['UTRIUM_ALKALIDE', 'UHO2'], ['CATALYZED_UTRIUM_ALKALIDE', 'XUHO2']], 'work', 'harvest', 'harvest'),
family([['KEANIUM_HYDRIDE', 'KH'], ['KEANIUM_ACID', 'KH2O'], ['CATALYZED_KEANIUM_ACID', 'XKH2O']], 'carry', 'capacity', 'capacity'),
family([['KEANIUM_OXIDE', 'KO'], ['KEANIUM_ALKALIDE', 'KHO2'], ['CATALYZED_KEANIUM_ALKALIDE', 'XKHO2']], 'ranged_attack', 'rangedAttack', 'rangedAttack and rangedMassAttack'),
family([['LEMERGIUM_HYDRIDE', 'LH'], ['LEMERGIUM_ACID', 'LH2O'], ['CATALYZED_LEMERGIUM_ACID', 'XLH2O']], 'work', 'build', 'build and repair'),
family([['LEMERGIUM_OXIDE', 'LO'], ['LEMERGIUM_ALKALIDE', 'LHO2'], ['CATALYZED_LEMERGIUM_ALKALIDE', 'XLHO2']], 'heal', 'heal', 'heal and rangedHeal'),
family([['ZYNTHIUM_HYDRIDE', 'ZH'], ['ZYNTHIUM_ACID', 'ZH2O'], ['CATALYZED_ZYNTHIUM_ACID', 'XZH2O']], 'work', 'dismantle', 'dismantle'),
family([['ZYNTHIUM_OXIDE', 'ZO'], ['ZYNTHIUM_ALKALIDE', 'ZHO2'], ['CATALYZED_ZYNTHIUM_ALKALIDE', 'XZHO2']], 'move', 'fatigue', 'fatigue removed'),
family([['GHODIUM_HYDRIDE', 'GH'], ['GHODIUM_ACID', 'GH2O'], ['CATALYZED_GHODIUM_ACID', 'XGH2O']], 'work', 'upgradeController', 'upgradeController'),
family([['GHODIUM_OXIDE', 'GO'], ['GHODIUM_ALKALIDE', 'GHO2'], ['CATALYZED_GHODIUM_ALKALIDE', 'XGHO2']], 'tough', 'damage', 'damage taken'),
// ---------------------------------------------------------------- commodity chains
chain('silicon', ['wire', 'switch', 'transistor', 'microchip', 'circuit', 'device']),
chain('biomass', ['cell', 'phlegm', 'tissue', 'muscle', 'organoid', 'organism']),
chain('metal', ['alloy', 'tube', 'fixtures', 'frame', 'hydraulics', 'machine']),
chain('mist', ['condensate', 'concentrate', 'extract', 'spirit', 'emanation', 'essence']));
