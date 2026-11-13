'use strict';
// One-line meanings for the constants of the group const:power (POWER_*, PWR_*, EFFECT_*).
// POWER_BANK_DECAY is in const:decay and is not written here.
module.exports = {
    // power banks
    POWER_BANK_HITS: 'Hits of a power bank.',
    POWER_BANK_CAPACITY_MAX: 'Upper end of the power rolled for a new power bank; a critical bank gets this amount on top.',
    POWER_BANK_CAPACITY_MIN: 'Lower end of the power rolled for a new power bank.',
    POWER_BANK_CAPACITY_CRIT: 'Chance that a new power bank gets POWER_BANK_CAPACITY_MAX extra power.',
    POWER_BANK_HIT_BACK: 'Share of the damage done to a power bank that the attacker takes itself.',
    POWER_BANK_RESPAWN_TIME: 'Base number of ticks between two power banks in one highway room; the real wait is 0.75 to 1.25 times this.',

    // power spawn and GPL
    POWER_SPAWN_HITS: 'Hits of a power spawn.',
    POWER_SPAWN_ENERGY_CAPACITY: 'Energy a power spawn holds.',
    POWER_SPAWN_POWER_CAPACITY: 'Power a power spawn holds.',
    POWER_SPAWN_ENERGY_RATIO: 'Energy burned with each unit of power in processPower.',
    POWER_LEVEL_MULTIPLY: 'Factor of the Global Power Level formula: level n needs POWER_LEVEL_MULTIPLY × n^POWER_LEVEL_POW processed power in total.',
    POWER_LEVEL_POW: 'Exponent of the Global Power Level formula.',

    // power creeps
    POWER_CREEP_SPAWN_COOLDOWN: 'Milliseconds of real time after a death before the power creep can be spawned again ({{POWER_CREEP_SPAWN_COOLDOWN / 3600000}} hours).',
    POWER_CREEP_DELETE_COOLDOWN: 'Milliseconds of real time between delete() and the removal of the power creep ({{POWER_CREEP_DELETE_COOLDOWN / 3600000}} hours).',
    POWER_CREEP_MAX_LEVEL: 'Highest level of a power creep.',
    POWER_CREEP_LIFE_TIME: 'Ticks a power creep lives after a spawn or a renew.',
    POWER_CLASS: 'Classes PowerCreep.create accepts; OPERATOR is the only one.',
    POWER_INFO: 'Per power: class, creep level needed for power levels 1–5, cooldown, and where they apply range, duration, ops cost and effect per level.',

    // powers
    PWR_GENERATE_OPS: 'Adds ops to the power creep\'s own store.',
    PWR_OPERATE_SPAWN: 'Shortens the spawn time of creeps started at the target spawn.',
    PWR_OPERATE_TOWER: 'Raises attack, heal and repair of the target tower.',
    PWR_OPERATE_STORAGE: 'Raises the capacity of the target storage.',
    PWR_OPERATE_LAB: 'Raises the amount the target lab handles per reaction.',
    PWR_OPERATE_EXTENSION: 'Fills the extensions of the room at once with energy from the target storage, terminal, factory or container.',
    PWR_OPERATE_OBSERVER: 'Lets the target observer look at a room at any distance.',
    PWR_OPERATE_TERMINAL: 'Lowers the energy cost of transfers and the cooldown of the target terminal.',
    PWR_DISRUPT_SPAWN: 'Pauses the creep being spawned at the target spawn.',
    PWR_DISRUPT_TOWER: 'Lowers attack, heal and repair of the target tower.',
    PWR_DISRUPT_SOURCE: 'Stops the regeneration timer of the target source.',
    PWR_SHIELD: 'Puts a temporary rampart on the power creep\'s own tile.',
    PWR_REGEN_SOURCE: 'Adds energy to the target source every {{POWER_INFO[PWR_REGEN_SOURCE].period}} ticks.',
    PWR_REGEN_MINERAL: 'Adds units to the target mineral every {{POWER_INFO[PWR_REGEN_MINERAL].period}} ticks.',
    PWR_DISRUPT_TERMINAL: 'Blocks withdrawing from the target terminal.',
    PWR_OPERATE_POWER: 'Lets the target power spawn process more power per processPower call.',
    PWR_FORTIFY: 'Makes the target wall or rampart take no damage from attacks.',
    PWR_OPERATE_CONTROLLER: 'Raises the upgrade limit per tick of a level 8 controller.',
    PWR_OPERATE_FACTORY: 'Sets the level of the target factory and lets it produce commodities of that level.',

    // effects that are not powers
    EFFECT_INVULNERABILITY: 'Effect id on a stronghold core before it deploys and on the controller of a stronghold room: attacks on the object are refused.',
    EFFECT_COLLAPSE_TIMER: 'Effect id on the structures of a deployed stronghold: when it runs out, they are removed.',
};
