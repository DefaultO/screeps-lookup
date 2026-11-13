'use strict';
// Own text for the remaining objects and for members that mirror another entry.
const { L, eng, driver } = require('./_h');
const same = (id, extra) => ({ summary: `Same as ${id} for a power creep.${extra ? ' ' + extra : ''}`, see: [id] });

module.exports = {
    ConstructionSite: { summary: 'A structure being built. It has an owner, a progress counter and no hits; an enemy creep that steps on it removes it.', tasks: ['what is a construction site'], constants: ['MAX_CONSTRUCTION_SITES'], see: ['Room.createConstructionSite', 'Creep.build', 'ConstructionSite.remove'] },
    Nuke: { summary: 'An incoming nuke: where it lands is its position, when is timeToLand.', tasks: ['incoming nuke'], see: ['mechanic:nukes', 'Nuke.timeToLand'] },
    'Nuke.timeToLand': { summary: 'Ticks until the nuke lands.', tasks: ['when does the nuke land'], see: ['mechanic:nukes'] },
    PathFinder: { summary: 'The pathfinding module. One call matters: PathFinder.search.', tasks: ['pathfinding'], see: ['PathFinder.search', 'PathFinder.CostMatrix'] },
    'Room.Terrain': { summary: 'Read-only terrain of one room, available without vision.', tasks: ['room terrain object'], see: ['Room.Terrain.get', 'Game.map.getRoomTerrain', 'Room.getTerrain'] },
    'Room.Terrain.getRawBuffer': { summary: 'The whole terrain as a Uint8Array of 2500 masks (index y × 50 + x), for fast bulk reads.', tasks: ['read all terrain of a room at once'], see: ['Room.Terrain.get'] },
    RoomObject: { summary: 'Base of everything that has a position in a room: pos, room, effects.', tasks: ['base object'], see: ['RoomObject.pos'] },
    'StructureSpawn.Spawning': { summary: 'Details of the creep a spawn is making: name, needTime, remainingTime, directions.', tasks: ['spawning details'], see: ['StructureSpawn.spawning', 'StructureSpawn.Spawning.cancel'] },
    'Room.deserializePath': { summary: 'Turn a string from serializePath back into path steps.', tasks: ['read a stored path'], see: ['Room.serializePath'] },
    'PathFinder.CostMatrix.get': { summary: 'Cost stored for a tile (0 if never set).', see: ['PathFinder.CostMatrix.set'] },
    'PathFinder.CostMatrix.clone': { summary: 'Copy of the matrix, to change it without touching a cached one.', tasks: ['copy a cost matrix'], see: ['PathFinder.CostMatrix'] },
    'PathFinder.CostMatrix.deserialize': { summary: 'Rebuild a matrix from the array serialize() returned.', tasks: ['load a stored cost matrix'], see: ['PathFinder.CostMatrix.serialize'] },
    'PathFinder.CostMatrix.constructor': { summary: 'New matrix with every tile at 0 (terrain default).', see: ['PathFinder.CostMatrix.set'] },
    'Flag.remove': { summary: 'Delete the flag.', tasks: ['remove a flag'], see: ['Flag'] },
    'Flag.setColor': {
        summary: 'Change the two colors of the flag.',
        tasks: ['change a flag color'],
        pitfalls: [L('It queues two intents, remove and create, so one call costs 0.4 CPU.', eng('src/game/flags.js', 'x: this.pos.x, y: this.pos.y, name: this.name, color, secondaryColor'))],
        see: ['const:colors'],
    },
    'Flag.setPosition': {
        summary: 'Move the flag to another position, in any room.',
        tasks: ['move a flag'],
        pitfalls: [L('It queues two intents, remove and create, so one call costs 0.4 CPU.', eng('src/game/flags.js', 'name: this.name, color: this.color, secondaryColor: this.secondaryColor'))],
        see: ['Flag'],
    },
    'InterShardMemory.getLocal': { summary: 'Read back the string this shard wrote.', see: ['InterShardMemory.setLocal'] },
    'RoomVisual.line': { summary: 'Draw a line between two points.', see: ['RoomVisual'] },
    'RoomVisual.circle': { summary: 'Draw a circle at a point.', tasks: ['mark a position'], see: ['RoomVisual'] },
    'RoomVisual.rect': { summary: 'Draw a rectangle.', see: ['RoomVisual'] },
    'RoomVisual.clear': { summary: 'Remove what was drawn in this room in this tick.', see: ['RoomVisual'] },
    'RoomVisual.getSize': { summary: 'Bytes of visuals added to this room in this tick (limit 512,000).', see: ['RoomVisual'] },
    'PowerCreep.transfer': same('Creep.transfer'),
    'PowerCreep.withdraw': same('Creep.withdraw'),
    'PowerCreep.pickup': same('Creep.pickup'),
    'PowerCreep.drop': same('Creep.drop'),
    'PowerCreep.move': same('Creep.move', 'A power creep has no fatigue.'),
    'PowerCreep.moveTo': same('Creep.moveTo'),
    'PowerCreep.moveByPath': same('Creep.moveByPath'),
    'PowerCreep.say': same('Creep.say'),
    'PowerCreep.suicide': same('Creep.suicide', 'The power creep can be spawned again after the cooldown.'),
    'PowerCreep.cancelOrder': same('Creep.cancelOrder'),
    'PowerCreep.notifyWhenAttacked': same('Creep.notifyWhenAttacked'),
    'PowerCreep.rename': {
        summary: 'Rename a power creep that is not spawned in the world.',
        cpu: 'intent',
        tasks: ['rename a power creep'],
        notes: [
            L('The reference marks this call as free, but it queues an account intent and the runtime charges the 0.2 CPU fee for it.',
                eng('src/game/power-creeps.js', "intents.pushByName('global', 'renamePowerCreep'"), driver('lib/runtime/runtime.js', 'pushByName(id, name, data, maxLen) {')),
        ],
    },
};
