'use strict';
// The start page: the numbers most questions end in. Values are {{EXPR}} over the constants;
// `to` is the entry that explains the number.
module.exports = [
    {
        title: 'Creeps',
        rows: [
            { label: 'Life time', value: '{{CREEP_LIFE_TIME}}', unit: 'ticks', to: 'Creep.ticksToLive' },
            { label: 'Life time with CLAIM', value: '{{CREEP_CLAIM_LIFE_TIME}}', unit: 'ticks, no renew', to: 'Creep.reserveController' },
            { label: 'Spawn time', value: '{{CREEP_SPAWN_TIME}}', unit: 'ticks per part', to: 'StructureSpawn.spawnCreep' },
            { label: 'Body size', value: '{{MAX_CREEP_SIZE}}', unit: 'parts at most', to: 'const:body-parts' },
            { label: 'CARRY part holds', value: '{{CARRY_CAPACITY}}', unit: '', to: 'Creep.store' },
            { label: 'Renew gives', value: '{{SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME}} / parts', unit: 'ticks per call', to: 'StructureSpawn.renewCreep' },
        ],
    },
    {
        title: 'Energy',
        rows: [
            { label: 'Source, owned or reserved', value: '{{SOURCE_ENERGY_CAPACITY}}', unit: 'per {{ENERGY_REGEN_TIME}} ticks', to: 'mechanic:sources' },
            { label: 'Source, neutral room', value: '{{SOURCE_ENERGY_NEUTRAL_CAPACITY}}', unit: 'per {{ENERGY_REGEN_TIME}} ticks', to: 'mechanic:sources' },
            { label: 'WORK to drain a source', value: '{{SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME / HARVEST_POWER}}', unit: 'parts ({{HARVEST_POWER}} per tick each)', to: 'Creep.harvest' },
            { label: 'Dropped pile loses', value: '1 / {{ENERGY_DECAY}}', unit: 'of itself per tick', to: 'Resource.amount' },
            { label: 'Link loses', value: '{{LINK_LOSS_RATIO * 100}}%', unit: 'per transfer', to: 'StructureLink.transferEnergy' },
            { label: 'Spawn + extensions at RCL 8', value: '{{CONTROLLER_STRUCTURES.spawn[8] * SPAWN_ENERGY_CAPACITY + CONTROLLER_STRUCTURES.extension[8] * EXTENSION_ENERGY_CAPACITY[8]}}', unit: 'energy', to: 'const:controller' },
        ],
    },
    {
        title: 'One WORK part, one tick',
        rows: [
            { label: 'Harvest', value: '{{HARVEST_POWER}}', unit: 'energy', to: 'Creep.harvest' },
            { label: 'Build', value: '{{BUILD_POWER}}', unit: 'energy into the site', to: 'Creep.build' },
            { label: 'Repair', value: '{{REPAIR_POWER}}', unit: 'hits for {{REPAIR_POWER * REPAIR_COST}} energy', to: 'Creep.repair' },
            { label: 'Upgrade', value: '{{UPGRADE_CONTROLLER_POWER}}', unit: 'energy ({{CONTROLLER_MAX_UPGRADE_PER_TICK}} per tick cap at RCL 8)', to: 'Creep.upgradeController' },
            { label: 'Dismantle', value: '{{DISMANTLE_POWER}}', unit: 'hits, returns {{DISMANTLE_POWER * DISMANTLE_COST}} energy', to: 'Creep.dismantle' },
        ],
    },
    {
        title: 'Decay',
        rows: [
            { label: 'Road', value: '−{{ROAD_DECAY_AMOUNT}}', unit: 'hits per {{ROAD_DECAY_TIME}} ticks, gone in {{ROAD_HITS / ROAD_DECAY_AMOUNT * ROAD_DECAY_TIME}}', to: 'StructureRoad' },
            { label: 'Container, room without owner', value: '−{{CONTAINER_DECAY}}', unit: 'hits per {{CONTAINER_DECAY_TIME}} ticks, gone in {{CONTAINER_HITS / CONTAINER_DECAY * CONTAINER_DECAY_TIME}}', to: 'StructureContainer' },
            { label: 'Container, owned room', value: '−{{CONTAINER_DECAY}}', unit: 'hits per {{CONTAINER_DECAY_TIME_OWNED}} ticks, gone in {{CONTAINER_HITS / CONTAINER_DECAY * CONTAINER_DECAY_TIME_OWNED}}', to: 'StructureContainer' },
            { label: 'Rampart', value: '−{{RAMPART_DECAY_AMOUNT}}', unit: 'hits per {{RAMPART_DECAY_TIME}} ticks', to: 'StructureRampart' },
            { label: 'Tombstone lasts', value: '{{TOMBSTONE_DECAY_PER_PART}}', unit: 'ticks per body part', to: 'Tombstone' },
        ],
    },
    {
        title: 'Fighting',
        rows: [
            { label: 'ATTACK / RANGED_ATTACK', value: '{{ATTACK_POWER}} / {{RANGED_ATTACK_POWER}}', unit: 'damage per part', to: 'mechanic:damage-and-healing' },
            { label: 'HEAL, adjacent / at range', value: '{{HEAL_POWER}} / {{RANGED_HEAL_POWER}}', unit: 'hits per part', to: 'Creep.heal' },
            { label: 'HEAL with XLHO2', value: '{{HEAL_POWER * BOOSTS.heal.XLHO2.heal}} / {{RANGED_HEAL_POWER * BOOSTS.heal.XLHO2.rangedHeal}}', unit: 'hits per part', to: 'const:boosts' },
            { label: 'Tower up to range {{TOWER_OPTIMAL_RANGE}}', value: '{{TOWER_POWER_ATTACK}} / {{TOWER_POWER_HEAL}} / {{TOWER_POWER_REPAIR}}', unit: 'attack / heal / repair', to: 'mechanic:tower' },
            { label: 'Tower from range {{TOWER_FALLOFF_RANGE}}', value: '{{TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF)}} / {{TOWER_POWER_HEAL * (1 - TOWER_FALLOFF)}} / {{TOWER_POWER_REPAIR * (1 - TOWER_FALLOFF)}}', unit: 'for {{TOWER_ENERGY_COST}} energy', to: 'mechanic:tower' },
        ],
    },
    {
        title: 'Controller',
        rows: [
            { label: 'Reserve', value: '+{{CONTROLLER_RESERVE}}', unit: 'tick per CLAIM part, cap {{CONTROLLER_RESERVE_MAX}}', to: 'mechanic:reservation' },
            { label: 'Safe mode', value: '{{SAFE_MODE_DURATION}}', unit: 'ticks, then {{SAFE_MODE_COOLDOWN}} cooldown', to: 'mechanic:safe-mode' },
            { label: 'Downgrade timer at RCL 8', value: '{{CONTROLLER_DOWNGRADE[8]}}', unit: 'ticks', to: 'mechanic:controller' },
            { label: 'Construction sites', value: '{{MAX_CONSTRUCTION_SITES}}', unit: 'per player', to: 'Room.createConstructionSite' },
            { label: 'Invader raid', value: '{{INVADERS_ENERGY_GOAL}}', unit: 'energy harvested per room', to: 'mechanic:invaders' },
        ],
    },
    {
        title: 'CPU and memory',
        rows: [
            { label: 'Intent that returns OK', value: '0.2', unit: 'CPU', to: 'mechanic:cpu' },
            { label: 'Bucket / tick limit', value: '10,000 / 500', unit: 'CPU', to: 'Game.cpu.bucket' },
            { label: 'Memory', value: '2 MB', unit: 'of JSON, parsed every tick', to: 'Memory' },
            { label: 'Segments', value: '10 of 100', unit: 'active, 100 KB each', to: 'RawMemory.setActiveSegments' },
            { label: 'Terminal cooldown / market fee', value: '{{TERMINAL_COOLDOWN}} / {{MARKET_FEE * 100}}%', unit: 'ticks / of the order', to: 'recipe:terminal-and-market' },
        ],
    },
];
