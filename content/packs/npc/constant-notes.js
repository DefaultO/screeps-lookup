'use strict';
// One-line meanings for the constant groups const:decay, const:nukes, const:invaders and const:world.
// Read from where the engine uses each constant; a constant the public server code does not use says so.
module.exports = {
    // ---------------------------------------------------------------- const:decay
    RAMPART_DECAY_AMOUNT: 'Hits a rampart loses at each decay step.',
    RAMPART_DECAY_TIME: 'Ticks between two decay steps of a rampart.',
    ENERGY_DECAY: 'Divisor of the loss of a dropped resource pile: each tick it loses ceil(amount / {{ENERGY_DECAY}}).',
    ROAD_WEAROUT: 'Ticks the next decay step of a road comes closer per body part of a creep that steps on it.',
    ROAD_WEAROUT_POWER_CREEP: 'Ticks the next decay step of a road comes closer when a power creep steps on it.',
    ROAD_DECAY_AMOUNT: 'Hits a road loses at each decay step; multiplied on swamp and on a natural wall.',
    ROAD_DECAY_TIME: 'Ticks between two decay steps of a road.',
    POWER_BANK_DECAY: 'Ticks a power bank exists before it vanishes together with its power.',
    DEPOSIT_DECAY_TIME: 'Ticks a deposit stays after it appeared or was last harvested; then it vanishes.',
    CONTAINER_DECAY: 'Hits a container loses at each decay step.',
    CONTAINER_DECAY_TIME: 'Ticks between decay steps of a container in a room without a controller or with one at level 0.',
    CONTAINER_DECAY_TIME_OWNED: 'Ticks between decay steps of a container in a room whose controller has level 1 or more.',
    TOMBSTONE_DECAY_PER_PART: 'Ticks a tombstone lasts per body part of the dead creep.',
    TOMBSTONE_DECAY_POWER_CREEP: 'Ticks the tombstone of a power creep lasts.',
    RUIN_DECAY: 'Ticks a ruin lasts, unless RUIN_DECAY_STRUCTURES names its structure type.',
    RUIN_DECAY_STRUCTURES: 'Ruin lifetime by structure type where it differs: the ruin of a power bank lasts {{RUIN_DECAY_STRUCTURES.powerBank}} ticks.',
    PORTAL_DECAY: 'Ticks a portal has left once it has turned unstable.',
    STRONGHOLD_DECAY_TICKS: 'Ticks a stronghold lives after its deploy, ±10%; then all of it is removed.',

    // ---------------------------------------------------------------- const:nukes
    NUKER_HITS: 'Hits of a nuker.',
    NUKER_COOLDOWN: 'Ticks a nuker cannot launch after a launch, and after it was built.',
    NUKER_ENERGY_CAPACITY: 'Energy a nuker holds. A launch needs it full and uses all of it.',
    NUKER_GHODIUM_CAPACITY: 'Ghodium a nuker holds. A launch needs it full and uses all of it.',
    NUKE_LAND_TIME: 'Ticks from the launch of a nuke to its landing.',
    NUKE_RANGE: 'Largest distance in rooms, on each axis, between the room of the nuker and the target room.',
    NUKE_DAMAGE: 'Damage to structures by range from the landing tile: key 0 is the tile itself, key 2 the rest of the 5 × 5 tiles around it.',

    // ---------------------------------------------------------------- const:invaders
    INVADERS_ENERGY_GOAL: 'Energy harvested from the sources of a room that makes a raid due; after each raid the goal is drawn anew around this value.',
    INVADER_CORE_HITS: 'Hits of an invader core, the same at every level.',
    INVADER_CORE_CREEP_SPAWN_TIME: 'Ticks per body part a stronghold core needs to spawn a defender, by core level; 0 means that level spawns none.',
    INVADER_CORE_EXPAND_TIME: 'Ticks between two lesser cores a stronghold sends into nearby rooms, by stronghold level.',
    INVADER_CORE_CONTROLLER_POWER: 'Ticks of reservation an invader core adds for itself, or takes off the reservation of a player, each tick.',
    INVADER_CORE_CONTROLLER_DOWNGRADE: 'Downgrade timer a stronghold core keeps on a controller it owns.',
    STRONGHOLD_RAMPART_HITS: 'Hits of the ramparts of a stronghold by level; also the value its fortifier repairs them back to.',

    // ---------------------------------------------------------------- const:world
    WORLD_WIDTH: 'Deprecated: width of the world in rooms. Use Game.map.getWorldSize().',
    WORLD_HEIGHT: 'Deprecated: height of the world in rooms. Use Game.map.getWorldSize().',
    MODE_SIMULATION: 'Defined as null; the public server code does not use it.',
    MODE_WORLD: 'Defined as null; the public server code does not use it.',
    TERRAIN_MASK_WALL: 'Terrain bit of a natural wall.',
    TERRAIN_MASK_SWAMP: 'Terrain bit of a swamp.',
    TERRAIN_MASK_LAVA: 'A third terrain bit; the public server code does not use it.',
    FLAGS_LIMIT: 'Most flags a player can have; createFlag returns ERR_FULL beyond it.',
    PIXEL_CPU_COST: 'Bucket CPU that Game.cpu.generatePixel turns into one pixel.',
    PORTAL_UNSTABLE: 'Milliseconds ({{PORTAL_UNSTABLE / 86400000}} days): the stable time the reference gives for a portal. The public server code does not read it.',
    PORTAL_MIN_TIMEOUT: 'Milliseconds ({{PORTAL_MIN_TIMEOUT / 86400000}} days): a portal timing value of the official server. The public server code does not read it.',
    PORTAL_MAX_TIMEOUT: 'Milliseconds ({{PORTAL_MAX_TIMEOUT / 86400000}} days): a portal timing value of the official server. The public server code does not read it.',
    SYSTEM_USERNAME: 'User name of the game itself: the author of signs it puts on controllers and the owner of the ruins a respawn leaves.',
    SIGN_NOVICE_AREA: 'Deprecated: same text as SIGN_PLANNED_AREA.',
    SIGN_RESPAWN_AREA: 'Deprecated: same text as SIGN_PLANNED_AREA.',
    SIGN_PLANNED_AREA: 'Text of the controller sign the game sets in a sector where a novice or respawn area is planned.',
};
