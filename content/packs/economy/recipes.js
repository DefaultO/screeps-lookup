'use strict';
// Economy pack: recipes for minerals, tier 3 boosts, the factory, deposits and moving resources between rooms.
const { L, eng, backend, driver, common, doc, article } = require('../../_h');
const P = 'src/processor/intents/';
const STRUCT = 'src/game/structures.js';
const CREEPS = 'src/game/creeps.js';
const UTILS = 'src/utils.js';
const MARKET = 'src/processor/global-intents/market.js';
const HARVEST = P + 'creeps/harvest.js';
const RUN = P + 'labs/run-reaction.js';
const OP_FACTORY = 'POWER_INFO[PWR_OPERATE_FACTORY]';
const fee = d => `{{Math.ceil(1000 * (1 - Math.exp(-${d} / 30)))}}`;
// first room level at which a structure type is allowed, as an expression for {{ }}
const rcl = type => `{{[1, 2, 3, 4, 5, 6, 7, 8].find(l => CONTROLLER_STRUCTURES.${type}[l] > 0)}}`;
const XLHO2_TIME = '{{REACTION_TIME.LO + REACTION_TIME.OH + REACTION_TIME.LHO2 + REACTION_TIME.XLHO2}}';

module.exports = {
    entries: [
        {
            id: 'mine-minerals',
            title: 'Mine a mineral',
            summary: 'From room level ' + rcl('extractor') + ': an extractor on the mineral, a miner with many WORK parts that harvests every {{EXTRACTOR_COOLDOWN + 1}} ticks, and a hauler that takes the mineral to the terminal or storage.',
            tasks: ['mine a mineral', 'set up mineral mining', 'mineral miner body', 'harvest minerals with an extractor', 'get minerals from my room'],
            steps: [
                { call: 'Room.find', text: 'room.find(FIND_MINERALS)[0] is the mineral of the room. Read mineralType and mineralAmount and keep its id.' },
                { call: 'Room.createConstructionSite', text: 'STRUCTURE_EXTRACTOR on the mineral\'s position: {{CONSTRUCTION_COST.extractor}} energy, one per room from room level ' + rcl('extractor') + '. A container on a free tile next to the mineral gives the miner a place to stand and drop.' },
                { call: 'StructureSpawn.spawnCreep', text: 'Miner: mostly WORK. Each WORK takes {{HARVEST_MINERAL_POWER}} unit per harvest and a harvest is possible every {{EXTRACTOR_COOLDOWN + 1}} ticks, so 30 WORK bring {{30 * HARVEST_MINERAL_POWER / (EXTRACTOR_COOLDOWN + 1)}} units per tick.' },
                { call: 'Creep.harvest', text: 'harvest(mineral) at range 1 in the ticks where extractor.cooldown is 0; skip the call otherwise.' },
                { call: 'Creep.withdraw', text: 'A hauler empties the container (or picks up the pile) and carries the mineral to the terminal or storage.' },
                { call: 'Mineral.ticksToRegeneration', text: 'At mineralAmount 0 the mineral refills after {{MINERAL_REGEN_TIME}} ticks: recycle the miner and spawn the next one shortly before the timer ends.' },
            ],
            pitfalls: [
                L('Mine the mineral down to 0: the refill timer starts only then.', eng(P + 'minerals/tick.js', 'if(!object.mineralAmount) {')),
                L('Two miners must harvest in the same tick. If they alternate, each one\'s harvest puts the extractor on cooldown for the other.', eng(P + 'extractors/tick.js', 'cooldown: object._cooldown')),
                L('A miner without free capacity drops the mineral on its tile, where it shrinks every tick unless a container is under the miner.', eng(P + 'energy/tick.js', 'object[resourceType] -= Math.ceil(object[resourceType] / C.ENERGY_DECAY);')),
                L('The harvest boosts work on minerals too: UO ×{{BOOSTS.work.UO.harvest}}, UHO2 ×{{BOOSTS.work.UHO2.harvest}}, XUHO2 ×{{BOOSTS.work.XUHO2.harvest}} units per WORK part.', eng(HARVEST, "let harvestAmount = utils.calcBodyEffectiveness(object.body, C.WORK, 'harvest', C.HARVEST_MINERAL_POWER);")),
                L('A full mineral holds {{MINERAL_DENSITY[1]}} to {{MINERAL_DENSITY[4]}} units; with 30 WORK that is {{MINERAL_DENSITY[1] / 30 * (EXTRACTOR_COOLDOWN + 1)}} to {{MINERAL_DENSITY[4] / 30 * (EXTRACTOR_COOLDOWN + 1)}} ticks of mining.', eng(P + 'minerals/tick.js', 'mineralAmount: C.MINERAL_DENSITY[object.density]')),
            ],
            constants: ['HARVEST_MINERAL_POWER', 'EXTRACTOR_COOLDOWN', 'MINERAL_REGEN_TIME', 'MINERAL_DENSITY', 'CONSTRUCTION_COST.extractor'],
            see: ['mechanic:minerals-and-extractors', 'Mineral', 'StructureExtractor', 'StructureExtractor.cooldown', 'recipe:make-a-tier-3-boost', 'recipe:harvest-and-haul'],
        },
        {
            id: 'make-a-tier-3-boost',
            title: 'Make a tier 3 boost from base minerals',
            summary: 'Four reactions lead to a tier 3 compound based on U, K, L or Z (tier 1, OH, tier 2, tier 3); the ghodium ones need three more to make G. Run them step by step in a lab group where every producing lab is within range 2 of the two source labs.',
            tasks: ['make a tier 3 boost', 'what do I need to make XGHO2', 'produce XLHO2 step by step', 'which reactions for a catalyzed compound', 'how long does it take to make a tier 3 compound', 'make ghodium'],
            steps: [
                { text: 'Pick the compound and write down its chain. XLHO2 (heal): L + O → LO, H + O → OH, LO + OH → LHO2, LHO2 + X → XLHO2. One unit takes 1 L, 2 O, 1 H and 1 X.' },
                { call: 'StructureTerminal.send', text: 'Bring in the base minerals your room does not have: from your other rooms by terminal, or from the market with Game.market.deal.' },
                { call: 'Room.createConstructionSite', text: 'Lab layout: two source labs in the middle and every other lab within range 2 of both. {{CONTROLLER_STRUCTURES.lab[6]}} labs at room level 6 are two sources and {{CONTROLLER_STRUCTURES.lab[6] - 2}} producing lab; {{CONTROLLER_STRUCTURES.lab[8]}} at level 8 are two sources and {{CONTROLLER_STRUCTURES.lab[8] - 2}} producing labs.' },
                { call: 'Creep.transfer', text: 'A hauler loads one reagent into each source lab. A lab takes a mineral only when it is empty or already holds that mineral; it holds {{LAB_MINERAL_CAPACITY}}.' },
                { call: 'StructureLab.runReaction', text: 'Every producing lab whose cooldown is 0 calls runReaction(sourceA, sourceB): {{LAB_REACTION_AMOUNT}} units per run, then REACTION_TIME[product] ticks of cooldown.' },
                { call: 'Creep.withdraw', text: 'When the batch is done, empty the producing labs completely and store the product. It is the reagent of the next step.' },
                { text: 'Repeat for each step of the chain. For a ghodium compound first make ZK and UL, then G from them.' },
                { call: 'StructureLab.boostCreep', text: 'To use it: one lab holds the compound and energy, the creep stands next to it. {{LAB_BOOST_MINERAL}} compound and {{LAB_BOOST_ENERGY}} energy per part.' },
            ],
            pitfalls: [
                L('Work in batches that are multiples of {{LAB_REACTION_AMOUNT}}. A leftover below {{LAB_REACTION_AMOUNT}} cannot react and keeps the lab on its old mineral until a creep takes it out.', eng(RUN, 'if(!lab1MineralType || lab1.store[lab1MineralType] < reactionAmount) {')),
                L('One producing lab makes {{LAB_REACTION_AMOUNT}} units per REACTION_TIME. The four steps to XLHO2 add up to ' + XLHO2_TIME + ' ticks per {{LAB_REACTION_AMOUNT}} units; enough for 10 parts ({{10 * LAB_BOOST_MINERAL}} units) is {{10 * LAB_BOOST_MINERAL / LAB_REACTION_AMOUNT}} runs of each step.', eng(RUN, 'cooldownTime: gameTime + C.REACTION_TIME[product]')),
                L('The last step is the slow one, and it differs a lot between compounds: XZH2O {{REACTION_TIME.XZH2O}}, XGHO2 {{REACTION_TIME.XGHO2}}, XGH2O {{REACTION_TIME.XGH2O}} ticks, most others {{REACTION_TIME.XLHO2}}.', common('lib/constants.js', 'REACTION_TIME: {')),
                L('A source lab that feeds several producing labs in one tick needs {{LAB_REACTION_AMOUNT}} for each of them; reactions that find it empty are skipped although they returned OK.', eng(RUN, 'if(!lab2MineralType || lab2.store[lab2MineralType] < reactionAmount) {')),
                L('A wrong product can be split again with reverseReaction, at the same cooldown and without loss.', eng(P + 'labs/reverse-reaction.js', 'cooldownTime: gameTime + C.REACTION_TIME[mineralType]});')),
            ],
            constants: ['LAB_REACTION_AMOUNT', 'LAB_MINERAL_CAPACITY', 'LAB_BOOST_MINERAL', 'LAB_BOOST_ENERGY', 'REACTION_TIME', 'CONTROLLER_STRUCTURES.lab'],
            see: ['mechanic:labs-and-reactions', 'mechanic:boosts', 'const:reactions', 'const:boosts', 'recipe:labs-and-boosts', 'recipe:mine-minerals', 'StructureLab.reverseReaction', 'Game.market.deal'],
        },
        {
            id: 'factory-production',
            title: 'Run a factory',
            summary: 'From room level ' + rcl('factory') + ': load the components into the factory, call produce when its cooldown is 0, take the product out. Recipes with a level also need an operator that keeps PWR_OPERATE_FACTORY on the factory.',
            tasks: ['run a factory', 'set up a factory', 'factory production loop', 'produce commodities for the market', 'make bars and batteries', 'what do I need for higher commodities'],
            steps: [
                { call: 'Room.createConstructionSite', text: 'STRUCTURE_FACTORY: {{CONSTRUCTION_COST.factory}} energy, one per room from room level ' + rcl('factory') + '. Next to storage and terminal one hauler serves all three.' },
                { call: 'Creep.transfer', text: 'Load the components of the recipe (COMMODITIES[type].components) for a few batches. The factory holds {{FACTORY_CAPACITY}} in all.' },
                { call: 'StructureFactory.produce', text: 'When factory.cooldown is 0: produce(type). One batch per call; the cooldown is COMMODITIES[type].cooldown.' },
                { call: 'Creep.withdraw', text: 'Take the product out before the factory is full.' },
                { call: 'PowerCreep.usePower', text: 'For recipes of level 1 to 5: an operator uses PWR_OPERATE_FACTORY of that level on the factory, range {{' + OP_FACTORY + '.range}}, {{' + OP_FACTORY + '.ops}} ops, and again every {{' + OP_FACTORY + '.duration}} ticks. The first use fixes the factory level.' },
                { text: 'Without an operator the factory still compresses minerals into bars ({{COMMODITIES.utrium_bar.components.U}} → {{COMMODITIES.utrium_bar.amount}}) and energy into batteries ({{COMMODITIES.battery.components.energy}} → {{COMMODITIES.battery.amount}}), and makes wire, cell, alloy and condensate from deposit resources.' },
            ],
            pitfalls: [
                L('Choose the level before the first PWR_OPERATE_FACTORY: it sets the factory level for good, and a power of another level does nothing afterwards.', eng(P + 'power-creeps/usePower.js', 'if(target.level != creepPower.level) {')),
                L('ERR_BUSY means the effect has run out; ERR_INVALID_TARGET means the recipe level is not the factory level.', eng(STRUCT, 'if(!!C.COMMODITIES[resourceType].level && C.COMMODITIES[resourceType].level != rawFactory.level) {')),
                L('ERR_FULL when the product does not fit; keep free space in the factory.', eng(P + 'factories/produce.js', "if (targetTotal - componentsTotal + (C.COMMODITIES[intent.resourceType].amount||1) > object.storeCapacity) {")),
                L('Batteries are storage, not profit: {{COMMODITIES.battery.components.energy}} energy go in and {{COMMODITIES.energy.amount}} come back out.', common('lib/constants.js', '[exports.RESOURCE_BATTERY]: {')),
                L('A higher commodity needs parts from lower levels, and a factory makes only its own level: plan one room per level, or buy the parts.', article('resources')),
            ],
            constants: ['FACTORY_CAPACITY', 'CONSTRUCTION_COST.factory', 'COMMODITIES'],
            see: ['mechanic:factory-and-commodities', 'StructureFactory', 'StructureFactory.level', 'const:commodities', 'recipe:power', 'recipe:harvest-deposits', 'recipe:terminal-and-market'],
        },
        {
            id: 'harvest-deposits',
            title: 'Harvest a highway deposit',
            summary: 'Find a deposit in a highway room, send creeps with WORK and CARRY, harvest whenever its cooldown is 0 and carry the load home. Stop when the cooldown has grown too long for the trip.',
            tasks: ['harvest a highway deposit', 'find deposits in highway rooms', 'deposit harvester body', 'get silicon metal biomass or mist', 'when to stop harvesting a deposit'],
            steps: [
                { call: 'StructureObserver.observeRoom', text: 'Look into the highway rooms in range, one room per tick; the room is visible in the next tick.' },
                { call: 'Room.find', text: 'room.find(FIND_DEPOSITS): note depositType, lastCooldown and ticksToDecay of each.' },
                { call: 'Game.map.findRoute', text: 'Check the way. A creep lives {{CREEP_LIFE_TIME}} ticks, and the walk there and back comes off its working time.' },
                { call: 'StructureSpawn.spawnCreep', text: 'Body: WORK for the yield ({{HARVEST_DEPOSIT_POWER}} unit per WORK per harvest), CARRY to hold it, MOVE for a trip without roads.' },
                { call: 'Creep.harvest', text: 'At range 1 whenever deposit.cooldown is 0. Creeps that harvest in the same tick all get their share.' },
                { call: 'Creep.transfer', text: 'A full creep walks home or hands over to a hauler; the resource goes to the factory or the terminal.' },
                { call: 'StructureFactory.produce', text: 'At home: {{COMMODITIES.wire.components.silicon}} of the raw resource + {{COMMODITIES.wire.components.utrium_bar}} bars + {{COMMODITIES.wire.components.energy}} energy make {{COMMODITIES.wire.amount}} wire, cell, alloy or condensate.' },
            ],
            pitfalls: [
                L('The cooldown grows with everything ever harvested there: {{Math.ceil(DEPOSIT_EXHAUST_MULTIPLY * Math.pow(10000, DEPOSIT_EXHAUST_POW))}} ticks after 10,000 units, {{Math.ceil(DEPOSIT_EXHAUST_MULTIPLY * Math.pow(50000, DEPOSIT_EXHAUST_POW))}} after 50,000. Skip deposits whose lastCooldown is already high.', eng(HARVEST, 'const cooldown = Math.ceil(C.DEPOSIT_EXHAUST_MULTIPLY*Math.pow(target.harvested,C.DEPOSIT_EXHAUST_POW));')),
                L('A deposit disappears {{DEPOSIT_DECAY_TIME}} ticks after its last harvest; one harvest resets the timer.', eng(HARVEST, 'bulk.update(target, {decayTime: C.DEPOSIT_DECAY_TIME + gameTime});')),
                L('Whatever does not fit in the creep drops on its tile and decays.', eng(HARVEST, 'amount: Math.min(object.store[target.depositType], sum - object.storeCapacity),')),
                L('The harvest boosts multiply the yield per WORK part: UO ×{{BOOSTS.work.UO.harvest}}, UHO2 ×{{BOOSTS.work.UHO2.harvest}}, XUHO2 ×{{BOOSTS.work.XUHO2.harvest}}.', eng(HARVEST, "const amount = utils.calcBodyEffectiveness(object.body, C.WORK, 'harvest', C.HARVEST_DEPOSIT_POWER);")),
                L('Other players can harvest the same deposit, and their harvests lengthen your cooldown too.', eng(CREEPS, 'else if(register.deposits[target.id] && (target instanceof globals.Deposit)) {')),
            ],
            constants: ['HARVEST_DEPOSIT_POWER', 'DEPOSIT_EXHAUST_MULTIPLY', 'DEPOSIT_EXHAUST_POW', 'DEPOSIT_DECAY_TIME', 'CREEP_LIFE_TIME'],
            see: ['mechanic:deposits', 'Deposit', 'Deposit.lastCooldown', 'recipe:factory-production', 'recipe:observer-and-power', 'mechanic:room-types'],
        },
        {
            id: 'balance-resources-between-rooms',
            title: 'Balance resources between your rooms',
            summary: 'Moving a surplus from one of your rooms to another is one terminal send: the sender pays the energy and waits {{TERMINAL_COOLDOWN}} ticks. Compare the stocks, check the space in the target terminal, send, and confirm in the next tick.',
            tasks: ['balance resources between rooms', 'share energy between my rooms', 'send minerals to the room that needs them', 'supply a new room by terminal', 'terminal network'],
            steps: [
                { call: 'Room.terminal', text: 'Per room and resource add up storage.store[r] and terminal.store[r] to see which room has a surplus and which is short.' },
                { call: 'Creep.transfer', text: 'A hauler moves the amount to send, and the energy for the cost, from storage into the terminal: a terminal sends only what it holds itself.' },
                { call: 'Game.market.calcTransactionCost', text: 'Cost of a route: ' + fee(3) + ' energy per 1000 units at 3 rooms, ' + fee(10) + ' at 10. Of several rooms that are short, the nearest is the cheapest to serve.' },
                { call: 'StructureTerminal.send', text: 'send(resource, amount, roomName) from a terminal whose cooldown is 0, with no more than the free space of the target terminal.' },
                { call: 'Game.market.outgoingTransactions', text: 'Next tick: the transfer is listed here if it happened.' },
                { call: 'Game.market.deal', text: 'What none of your rooms has can be bought on the market, and a surplus in all of them sold.' },
            ],
            pitfalls: [
                L('One send per terminal per tick, then {{TERMINAL_COOLDOWN}} ticks of cooldown: a room cannot supply several rooms at once.', eng(MARKET, 'bulkObjects.update(terminal, {cooldownTime: gameTime + cooldown});')),
                L('The amount is cut to the free space of the receiving terminal, so keep space free in every terminal.', eng(MARKET, 'amount = Math.min(amount, freeSpace);')),
                L('Sending energy burns energy: per 1000 sent, ' + fee(5) + ' more at 5 rooms and ' + fee(20) + ' more at 20.', eng(UTILS, 'return Math.ceil(amount * (1 - Math.exp(-range / 30)))')),
                L('A send to a room without an active terminal of a player returns OK and does nothing.', eng(MARKET, 'if(!terminalsByRoom[intent.targetRoomName] || !terminalsByRoom[intent.targetRoomName].user) {')),
                L('A terminal that sent this tick cannot also deal: the deal is dropped.', eng(MARKET, 'if(targetTerminal.cooldownTime > gameTime) {')),
            ],
            constants: ['TERMINAL_COOLDOWN', 'TERMINAL_CAPACITY', 'STORAGE_CAPACITY'],
            see: ['mechanic:terminal-transfers', 'mechanic:market', 'StructureTerminal.send', 'StructureTerminal.store', 'Room.storage', 'recipe:terminal-and-market', 'Game.map.getRoomLinearDistance'],
        },
    ],

    extend: {
        'recipe:labs-and-boosts': {
            pitfalls: [
                L('unboostCreep puts a long cooldown on the lab that does it, per removed part. Use a lab that runs no reactions.', eng(P + 'labs/unboost-creep.js', 'bulk.update(object, { cooldownTime: cooldown + gameTime });')),
                L('A lab keeps its mineral type until the last unit is out; a leftover of fewer than {{LAB_REACTION_AMOUNT}} units has to be withdrawn by a creep.', eng(P + 'creeps/withdraw.js', 'storeCapacityResource: {[intent.resourceType]: null},')),
            ],
            see: ['mechanic:labs-and-reactions', 'mechanic:boosts', 'recipe:make-a-tier-3-boost'],
        },
        'recipe:terminal-and-market': {
            pitfalls: [
                L('send and deal return OK before anything has moved. The transfer is listed in Game.market.outgoingTransactions or incomingTransactions in the next tick if it happened.', eng(MARKET, 'bulkTransactions.insert(_.extend({')),
                L('A filled order stays in Game.market.orders as inactive and counts toward the limit of {{MARKET_MAX_ORDERS}}: cancel it.', eng(MARKET, 'availableResourceAmount = Math.min(availableResourceAmount, order.remainingAmount);')),
                L('An order ends after {{MARKET_ORDER_LIFE_TIME / 86400000}} days of real time.', eng(MARKET, 'if(order.user && (nowTimestamp - order.createdTimestamp > C.MARKET_ORDER_LIFE_TIME)) {')),
            ],
            see: ['mechanic:market', 'mechanic:terminal-transfers', 'recipe:balance-resources-between-rooms'],
        },
    },
};
