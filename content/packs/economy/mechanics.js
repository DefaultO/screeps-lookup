'use strict';
// Economy pack: minerals, labs, boosts, factory, deposits, market, terminal transfers.
// Every fact carries the line of code or the page that shows it; numbers come from the constants.
const { L, eng, backend, driver, common, doc, article } = require('../../_h');
const P = 'src/processor/intents/';
const STRUCT = 'src/game/structures.js';
const CREEPS = 'src/game/creeps.js';
const UTILS = 'src/utils.js';
const MARKET_API = 'src/game/market.js';
const MARKET = 'src/processor/global-intents/market.js';
const CRON = 'lib/cronjobs.js';
const RUNTIME_DATA = 'lib/runtime/data.js';
const CONSTANTS = 'lib/constants.js';
const DOCS = 'https://docs.screeps.com/';

const HARVEST = P + 'creeps/harvest.js';
const MINERAL_TICK = P + 'minerals/tick.js';
const RUN = P + 'labs/run-reaction.js';
const REVERSE = P + 'labs/reverse-reaction.js';
const BOOST = P + 'labs/boost-creep.js';
const UNBOOST = P + 'labs/unboost-creep.js';
const PRODUCE = P + 'factories/produce.js';
const USE_POWER = P + 'power-creeps/usePower.js';

const OP_LAB = 'POWER_INFO[PWR_OPERATE_LAB]';
const OP_FACTORY = 'POWER_INFO[PWR_OPERATE_FACTORY]';
const OP_TERMINAL = 'POWER_INFO[PWR_OPERATE_TERMINAL]';
const DISRUPT_TERMINAL = 'POWER_INFO[PWR_DISRUPT_TERMINAL]';
const REGEN_MINERAL = 'POWER_INFO[PWR_REGEN_MINERAL]';
// energy for 1000 units over d rooms, as an expression for {{ }}
const fee = d => `{{Math.ceil(1000 * (1 - Math.exp(-${d} / 30)))}}`;
// all reaction times of a chain, as an expression
const chainTime = names => names.map(n => 'REACTION_TIME.' + n).join(' + ');
const XLHO2_CHAIN = chainTime(['XLHO2', 'LHO2', 'LO', 'OH']);
const XGHO2_CHAIN = chainTime(['XGHO2', 'GHO2', 'GO', 'OH', 'G', 'ZK', 'UL']);

// ---- tables (functions of the constants)

const reagentsOf = C => {
    const from = {};
    for (const [a, others] of Object.entries(C.REACTIONS)) {
        for (const [b, product] of Object.entries(others)) if (!from[product]) from[product] = [a, b];
    }
    return from;
};

const mineralTable = C => {
    const names = { 1: 'low', 2: 'moderate', 3: 'high', 4: 'ultra' };
    let prev = 0;
    return {
        title: 'Mineral density',
        head: ['density', 'value', 'amount when full', 'share of a fresh draw', 'drawn again at a refill', 'ticks to empty with 10 WORK'],
        rows: Object.keys(C.MINERAL_DENSITY).map(d => {
            const share = C.MINERAL_DENSITY_PROBABILITY[d] - prev;
            prev = C.MINERAL_DENSITY_PROBABILITY[d];
            return [names[d] || d, +d, C.MINERAL_DENSITY[d], Math.round(share * 100) + '%',
                +d === C.DENSITY_LOW || +d === C.DENSITY_ULTRA ? 'always' : Math.round(C.MINERAL_DENSITY_CHANGE * 100) + '%',
                C.MINERAL_DENSITY[d] / (10 * C.HARVEST_MINERAL_POWER) * (C.EXTRACTOR_COOLDOWN + 1)];
        }),
        foot: 'A new draw is repeated until the density differs from the old one.',
    };
};

const chainTable = C => {
    const from = reagentsOf(C);
    const raw = m => (from[m] ? raw(from[m][0]).concat(raw(from[m][1])) : [m]);
    const time = m => (from[m] ? C.REACTION_TIME[m] + time(from[m][0]) + time(from[m][1]) : 0);
    const count = list => {
        const n = {};
        list.forEach(x => { n[x] = (n[x] || 0) + 1; });
        const order = ['U', 'L', 'K', 'Z', 'H', 'O', 'X'];
        return Object.keys(n).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(k => (n[k] > 1 ? n[k] + ' ' : '') + k).join(' + ');
    };
    const rows = [];
    for (const [part, compounds] of Object.entries(C.BOOSTS)) {
        for (const t3 of Object.keys(compounds).filter(c => from[c] && from[c].includes('X'))) {
            const t2 = from[t3].find(r => r !== 'X');
            const t1 = from[t2].find(r => r !== 'OH');
            rows.push([part.toUpperCase(), Object.keys(compounds[t3]).join(', '), t1, t2, t3, count(raw(t3)), time(t3)]);
        }
    }
    return {
        title: 'Chains to tier 3',
        head: ['part', 'boosts', 'tier 1', 'tier 2', 'tier 3', 'base minerals per unit of tier 3', `reaction ticks per ${C.LAB_REACTION_AMOUNT} units`],
        rows,
        foot: `Tier 2 = tier 1 + OH, tier 3 = tier 2 + X. The last column adds the cooldowns of every reaction in the chain for one run of ${C.LAB_REACTION_AMOUNT} units.`,
    };
};

const factoryLevelTable = C => {
    const byLevel = {};
    for (const [name, c] of Object.entries(C.COMMODITIES)) (byLevel[c.level || 0] = byLevel[c.level || 0] || []).push(name);
    return {
        title: 'Recipes by factory level',
        head: ['level', 'needs', 'products'],
        rows: Object.keys(byLevel).sort().map(l => [+l === 0 ? 'none' : +l, +l === 0 ? 'any factory' : `factory level ${l} + PWR_OPERATE_FACTORY`, byLevel[l].join(', ')]),
        foot: 'Components, batch size and cooldown of each recipe are in const:commodities.',
    };
};

const depositTable = C => {
    const cd = h => Math.ceil(C.DEPOSIT_EXHAUST_MULTIPLY * Math.pow(h, C.DEPOSIT_EXHAUST_POW));
    return {
        title: 'Deposit cooldown by total harvested',
        head: ['total harvested', 'cooldown after a harvest', 'units per 1000 ticks with 20 WORK'],
        rows: [300, 1000, 2500, 5000, 10000, 20000, 50000, 100000].map(h => [h, cd(h) > 1 ? cd(h) : 'none', Math.round(20 * C.HARVEST_DEPOSIT_POWER * 1000 / Math.max(1, cd(h)))]),
        foot: 'The total counts what every player has taken from this deposit.',
    };
};

const terminalCostTable = () => ({
    title: 'Terminal energy cost by distance',
    head: ['rooms', 'energy per 1000 units', 'share of the amount'],
    rows: [1, 2, 3, 5, 10, 15, 20, 30, 45, 60].map(d => {
        const cost = Math.ceil(1000 * (1 - Math.exp(-d / 30)));
        return [d, cost, Math.round(cost / 10) + '%'];
    }),
    foot: 'ceil(amount × (1 − e^(−distance / 30))); the 30 is written in the engine code, not a constant.',
});

const marketFeeTable = C => ({
    title: 'What each market action costs',
    head: ['action', 'credits', 'energy', 'terminal cooldown'],
    rows: [
        ['createOrder', `${C.MARKET_FEE * 100}% of price × amount`, '—', '—'],
        ['extendOrder', `${C.MARKET_FEE * 100}% of price × added amount`, '—', '—'],
        ['changeOrderPrice (up)', `${C.MARKET_FEE * 100}% of the increase × remaining amount`, '—', '—'],
        ['changeOrderPrice (down)', 'nothing, nothing back', '—', '—'],
        ['cancelOrder', 'nothing, nothing back', '—', '—'],
        ['order expires', `${C.MARKET_FEE * 100}% of price × unfilled amount comes back`, '—', '—'],
        ['deal (you buy)', 'price × amount', 'transfer cost, from your terminal', `${C.TERMINAL_COOLDOWN} ticks, your terminal`],
        ['deal (you sell)', 'you receive price × amount', 'transfer cost, from your terminal', `${C.TERMINAL_COOLDOWN} ticks, your terminal`],
        ['someone deals on your order', 'price × amount, paid or received', 'none', 'none'],
    ],
});

module.exports = {
    entries: [
        // ------------------------------------------------------------ minerals
        {
            id: 'minerals-and-extractors',
            title: 'Minerals and extractors',
            summary: 'A room holds one mineral of one type. With an extractor on it each WORK part takes {{HARVEST_MINERAL_POWER}} unit per harvest, and a harvest is possible once every {{EXTRACTOR_COOLDOWN + 1}} ticks. An emptied mineral is full again after {{MINERAL_REGEN_TIME}} ticks.',
            tasks: [
                'how fast can I mine a mineral', 'how many WORK parts for mineral mining', 'when does a mineral regenerate', 'how much mineral is in a room',
                'mineral amount by density', 'why can I not harvest the mineral', 'how often can I harvest a mineral', 'does the mineral density change',
            ],
            facts: [
                L('There are seven base minerals: H, O, U, L, K, Z, X. A room has one mineral, of one type.', article('resources')),
                L('Harvesting needs an extractor on the mineral tile. It is allowed from room level {{[1, 2, 3, 4, 5, 6, 7, 8].find(l => CONTROLLER_STRUCTURES.extractor[l] > 0)}}, costs {{CONSTRUCTION_COST.extractor}} energy and can be placed only on a mineral.', eng(UTILS, "return _.any(objects, {x, y, type: 'mineral'}) && !_.any(objects, {x, y, type: 'extractor'});")),
                L('A harvest takes {{HARVEST_MINERAL_POWER}} unit per working WORK part, at most what is left. The harvest boosts multiply it: UO ×{{BOOSTS.work.UO.harvest}}, UHO2 ×{{BOOSTS.work.UHO2.harvest}}, XUHO2 ×{{BOOSTS.work.XUHO2.harvest}}.', eng(HARVEST, "let harvestAmount = utils.calcBodyEffectiveness(object.body, C.WORK, 'harvest', C.HARVEST_MINERAL_POWER);")),
                L('A harvest puts a cooldown of {{EXTRACTOR_COOLDOWN}} on the extractor. It counts down by 1 per tick, so the mineral can be harvested once every {{EXTRACTOR_COOLDOWN + 1}} ticks: {{HARVEST_MINERAL_POWER / (EXTRACTOR_COOLDOWN + 1)}} unit per WORK part per tick.', eng(HARVEST, 'extractor._cooldown = C.EXTRACTOR_COOLDOWN;'), eng(P + 'extractors/tick.js', 'object.cooldown--;')),
                L('The cooldown is written at the end of the tick, so every creep that harvests in that same tick gets its share. Several miners must harvest in the same tick.', eng(P + 'extractors/tick.js', 'cooldown: object._cooldown')),
                L('What does not fit in the creep falls on its tile, into a container if it stands on one.', eng(HARVEST, 'amount: Math.min(object.store[target.mineralType], sum - object.storeCapacity),')),
                L('A full mineral holds {{MINERAL_DENSITY[1]}}, {{MINERAL_DENSITY[2]}}, {{MINERAL_DENSITY[3]}} or {{MINERAL_DENSITY[4]}} units, by its density (low, moderate, high, ultra).', eng(MINERAL_TICK, 'mineralAmount: C.MINERAL_DENSITY[object.density]')),
                L('The refill timer of {{MINERAL_REGEN_TIME}} ticks starts when the amount reaches 0, not earlier.', eng(MINERAL_TICK, 'object.nextRegenerationTime = gameTime + C.MINERAL_REGEN_TIME;')),
                L('At the refill the mineral gets the amount of the density it has. After that the density is drawn again for the next refill: always when it was low or ultra, otherwise with a {{MINERAL_DENSITY_CHANGE * 100}}% chance. A new draw never keeps the old density.', eng(MINERAL_TICK, 'Math.random() < C.MINERAL_DENSITY_CHANGE) {'), eng(MINERAL_TICK, 'while(newDensity == oldDensity);')),
                L('A draw gives low {{MINERAL_DENSITY_PROBABILITY[1] * 100}}%, moderate {{(MINERAL_DENSITY_PROBABILITY[2] - MINERAL_DENSITY_PROBABILITY[1]) * 100}}%, high {{(MINERAL_DENSITY_PROBABILITY[3] - MINERAL_DENSITY_PROBABILITY[2]) * 100}}%, ultra {{(MINERAL_DENSITY_PROBABILITY[4] - MINERAL_DENSITY_PROBABILITY[3]) * 100}}%.', eng(MINERAL_TICK, 'if (random <= C.MINERAL_DENSITY_PROBABILITY[density]) {')),
                L('harvest returns ERR_NOT_FOUND without an extractor, ERR_NOT_OWNER when the extractor belongs to another player, ERR_RCL_NOT_ENOUGH when it is inactive, ERR_TIRED during the cooldown and ERR_NOT_ENOUGH_RESOURCES when the mineral is empty.', eng(CREEPS, "var extractor = _.find(target.pos.lookFor('structure'), {structureType: C.STRUCTURE_EXTRACTOR});")),
                L('The mineral itself blocks movement; the miner stands next to it.', common(CONSTANTS, 'OBSTACLE_OBJECT_TYPES: [')),
                L('PWR_REGEN_MINERAL adds {{' + REGEN_MINERAL + '.effect[0]}} to {{' + REGEN_MINERAL + '.effect[4]}} units (power level 1 to 5) every {{' + REGEN_MINERAL + '.period}} ticks to a mineral that is not empty.', eng(MINERAL_TICK, 'mineralAmount: object.mineralAmount + powerInfo.effect[effect.level - 1]')),
                L('The room generator of the private server picks the mineral type from a weighted list: H and O 6 of 25 each, Z, K, U and L 3 of 25 each, X 1 of 25.', backend('lib/cli/map.js', "var types = ['H','H','H','H','H','H',")),
            ],
            pitfalls: [
                L('A mineral left with a few units never refills: harvest it down to 0.', eng(MINERAL_TICK, 'if(!object.mineralAmount) {')),
                L('Call harvest only when extractor.cooldown is 0; in between the call returns ERR_TIRED.', eng(CREEPS, 'if(extractor.cooldown) {')),
                L('An extractor in a room whose level dropped below the required one is inactive, and the mineral cannot be harvested until the level is back.', eng(HARVEST, 'if(!utils.checkStructureAgainstController(extractor, roomObjects, roomController)) {')),
            ],
            tables: [mineralTable],
            constants: ['HARVEST_MINERAL_POWER', 'EXTRACTOR_COOLDOWN', 'MINERAL_REGEN_TIME', 'MINERAL_DENSITY', 'MINERAL_DENSITY_PROBABILITY', 'MINERAL_DENSITY_CHANGE', 'CONSTRUCTION_COST.extractor', 'CONTROLLER_STRUCTURES.extractor'],
            see: ['Mineral', 'StructureExtractor', 'StructureExtractor.cooldown', 'Creep.harvest', 'recipe:mine-minerals', 'mechanic:labs-and-reactions', 'const:sources-minerals'],
            url: DOCS + 'resources.html',
        },

        // ------------------------------------------------------------ labs
        {
            id: 'labs-and-reactions',
            title: 'Labs and reactions',
            summary: 'A lab holds {{LAB_ENERGY_CAPACITY}} energy and {{LAB_MINERAL_CAPACITY}} of one mineral or compound. A reaction takes {{LAB_REACTION_AMOUNT}} units from each of two labs within range 2 and makes {{LAB_REACTION_AMOUNT}} units of the product; the producing lab then waits REACTION_TIME[product] ticks.',
            tasks: [
                'how do lab reactions work', 'reaction chain from base minerals to tier 3', 'which minerals make which compound', 'lab range for reactions',
                'how is the mineral type of a lab set', 'empty a lab to change its mineral', 'how much compound does a lab make per tick', 'what does PWR_OPERATE_LAB do',
            ],
            facts: [
                L('First steps: H + O → {{REACTIONS.H.O}}; Z + K → {{REACTIONS.Z.K}}; U + L → {{REACTIONS.U.L}}; ZK + UL → {{REACTIONS.ZK.UL}}. G is not mined, it is made this way.', common(CONSTANTS, 'REACTIONS: {')),
                L('Tier 1: U, K, L, Z or G with H or O, for example U + H → {{REACTIONS.U.H}}. Tier 2: tier 1 + OH, for example UH + OH → {{REACTIONS.UH.OH}}. Tier 3: tier 2 + X, for example UH2O + X → {{REACTIONS.UH2O.X}}.', common(CONSTANTS, 'REACTIONS: {')),
                L('Each run takes {{LAB_REACTION_AMOUNT}} from each source lab and adds {{LAB_REACTION_AMOUNT}} to the producing lab: one unit of product uses one unit of each reagent.', eng(RUN, 'lab1.store[lab1MineralType] -= reactionAmount;')),
                L('So one unit of a tier 3 compound from U, K, L or Z uses 1 of that mineral, 1 X and 3 of H and O together; one from G uses 1 each of Z, K, U, L and X and 3 of H and O.', eng(RUN, 'const product = C.REACTIONS[lab1MineralType][lab2MineralType];')),
                L('Both source labs must be within range 2 of the producing lab. The two sources need not be near each other.', eng(RUN, 'if(Math.abs(lab1.x - object.x) > 2 || Math.abs(lab1.y - object.y) > 2) {')),
                L('After a run the producing lab waits REACTION_TIME of the product, between {{Math.min(...Object.values(REACTION_TIME))}} and {{Math.max(...Object.values(REACTION_TIME))}} ticks. Source labs get no cooldown and can feed several labs.', eng(RUN, 'cooldownTime: gameTime + C.REACTION_TIME[product]')),
                L('Output of one producing lab: {{LAB_REACTION_AMOUNT}} units per REACTION_TIME ticks. OH at {{REACTION_TIME.OH}} ticks is {{LAB_REACTION_AMOUNT / REACTION_TIME.OH * 1000}} per 1000 ticks; XGHO2 at {{REACTION_TIME.XGHO2}} is {{Math.round(LAB_REACTION_AMOUNT / REACTION_TIME.XGHO2 * 1000)}}.', eng(RUN, 'cooldownTime: gameTime + C.REACTION_TIME[product]')),
                L('How a lab gets its mineral type: the first resource other than energy that enters an empty lab, by transfer or as a reaction product, takes the mineral slot.', eng(P + 'creeps/transfer.js', 'storeCapacityResource: {[resourceType]: C.LAB_MINERAL_CAPACITY},'), eng(RUN, 'storeCapacityResource: {[product]: C.LAB_MINERAL_CAPACITY},')),
                L('How it is cleared: when the amount reaches 0, by withdraw, by a reaction that uses it up or by boosting. Then the lab accepts any resource again.', eng(P + 'creeps/withdraw.js', 'storeCapacityResource: {[intent.resourceType]: null},'), eng(RUN, 'storeCapacityResource: {[lab1MineralType]: null},'), eng(P + 'labs/boost-creep.js', 'storeCapacityResource:{[mineralType]: null},')),
                L('A lab that holds one mineral refuses every other one: transfer returns ERR_INVALID_TARGET.', eng(CREEPS, 'if(!utils.capacityForResource(data(target.id), resourceType)) {')),
                L('The producing lab must be empty or already hold the product (ERR_INVALID_ARGS otherwise) and have room for one more run (ERR_FULL).', eng(STRUCT, 'this.mineralType && this.mineralType != C.REACTIONS[lab1.mineralType][lab2.mineralType]) {')),
                L('reverseReaction splits {{LAB_REACTION_AMOUNT}} units of the compound in the lab into {{LAB_REACTION_AMOUNT}} of each reagent, put into two labs within range 2. Nothing is lost, and the cooldown is the same as for making the compound.', eng(REVERSE, 'cooldownTime: gameTime + C.REACTION_TIME[mineralType]});'), eng(STRUCT, 'if(this.pos.getRangeTo(lab1) > 2 || this.pos.getRangeTo(lab2) > 2) {', 'engine: range check, the same line in runReaction and reverseReaction')),
                L('In one tick a lab can boost, unboost and run one reaction; runReaction wins over reverseReaction.', eng(P + 'labs/intents.js', 'else if(objectIntents.reverseReaction)')),
                L('PWR_OPERATE_LAB adds {{' + OP_LAB + '.effect[0]}} to {{' + OP_LAB + '.effect[4]}} units per run (power level 1 to 5) on the lab it is used on, for {{' + OP_LAB + '.duration}} ticks. Inputs and output grow alike; the cooldown stays.', eng(RUN, 'reactionAmount += C.POWER_INFO[C.PWR_OPERATE_LAB].effect[effect.level-1];')),
                L('Labs allowed: {{CONTROLLER_STRUCTURES.lab[6]}} at room level 6, {{CONTROLLER_STRUCTURES.lab[7]}} at 7, {{CONTROLLER_STRUCTURES.lab[8]}} at 8, for {{CONSTRUCTION_COST.lab}} energy each. A lab above the allowance of the current level returns ERR_RCL_NOT_ENOUGH.', common(CONSTANTS, '"lab": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10},'), eng(STRUCT, 'if(!utils.checkStructureAgainstController(data(this.id), register.objectsByRoom[data(this.id).room], data(this.room.controller.id))) {')),
            ],
            pitfalls: [
                L('Checks use the amounts at the start of the tick and run again when the tick is processed. A source lab that feeds several producing labs must hold {{LAB_REACTION_AMOUNT}} for each of them, or the later reactions are skipped although they returned OK.', eng(RUN, 'if(!lab1MineralType || lab1.store[lab1MineralType] < reactionAmount) {')),
                L('To switch a lab to another compound, empty it completely first: one leftover unit keeps the old type.', eng(P + 'creeps/withdraw.js', "if(target.type == 'lab' && intent.resourceType != 'energy' && !target.store[intent.resourceType]) {")),
                L('LAB_COOLDOWN is not used anywhere; the cooldown is REACTION_TIME.', common(CONSTANTS, 'LAB_COOLDOWN: 10,')),
            ],
            tables: [chainTable],
            constants: ['LAB_MINERAL_CAPACITY', 'LAB_ENERGY_CAPACITY', 'LAB_REACTION_AMOUNT', 'REACTION_TIME', 'REACTIONS', 'CONTROLLER_STRUCTURES.lab'],
            see: ['StructureLab', 'StructureLab.runReaction', 'StructureLab.reverseReaction', 'StructureLab.store', 'StructureLab.cooldown', 'const:reactions', 'mechanic:boosts', 'recipe:make-a-tier-3-boost', 'recipe:labs-and-boosts', 'mechanic:minerals-and-extractors'],
            url: DOCS + 'resources.html',
        },

        // ------------------------------------------------------------ boosts
        {
            id: 'boosts',
            title: 'Boosts: how they are applied and what they change',
            summary: 'A lab puts its compound on the matching body parts of an adjacent creep for {{LAB_BOOST_MINERAL}} compound and {{LAB_BOOST_ENERGY}} energy per part. A boosted part multiplies the actions its compound is listed for, until the creep dies, is renewed or is unboosted.',
            tasks: [
                'how are boosts applied', 'which body parts does a compound boost', 'how much does it cost to boost a whole creep', 'what removes a boost',
                'does renewing remove boosts', 'how long does a boost last', 'where is boosted power calculated', 'get compound back from a boosted creep',
            ],
            facts: [
                L('boostCreep takes {{LAB_BOOST_MINERAL}} compound and {{LAB_BOOST_ENERGY}} energy from the lab for every part it boosts. The lab must be yours; the creep must be adjacent and done spawning.', eng(BOOST, 'object.store[mineralType] -= C.LAB_BOOST_MINERAL;')),
                L('Which parts: those without a boost whose type is listed for the compound in BOOSTS. One compound per part; a boosted part is skipped.', eng(BOOST, 'var nonBoostedParts = _.filter(target.body, i => !i.boost && C.BOOSTS[i.type] && C.BOOSTS[i.type][mineralType]);')),
                L('Order: TOUGH parts are taken from the front of the body, all other types from the back. bodyPartsCount limits how many are boosted.', eng(BOOST, 'if(nonBoostedParts[0].type != C.TOUGH) {')),
                L('A full lab ({{LAB_MINERAL_CAPACITY}} compound, {{LAB_ENERGY_CAPACITY}} energy) boosts {{Math.min(LAB_MINERAL_CAPACITY / LAB_BOOST_MINERAL, LAB_ENERGY_CAPACITY / LAB_BOOST_ENERGY)}} parts. Ten parts cost {{10 * LAB_BOOST_MINERAL}} compound and {{10 * LAB_BOOST_ENERGY}} energy.', eng(BOOST, 'object.store.energy -= C.LAB_BOOST_ENERGY;')),
                L('Where the power is computed: each action adds up the working parts of its type, and a part multiplies its base value by BOOSTS[type][compound][action] when that action is listed for the compound. Every other action of the part stays at ×1.', eng(UTILS, 'iPower *= C.BOOSTS[bodyPartType][i.boost][methodName];')),
                L('So a WORK part with UO harvests ×{{BOOSTS.work.UO.harvest}} but builds, repairs, dismantles and upgrades at the normal rate.', eng(UTILS, 'if(i.boost && C.BOOSTS[bodyPartType][i.boost] && C.BOOSTS[bodyPartType][i.boost][methodName]) {')),
                L('The harvest boost works on sources, minerals and deposits alike.', eng(P + 'creeps/harvest.js', "const amount = utils.calcBodyEffectiveness(object.body, C.WORK, 'harvest', C.HARVEST_DEPOSIT_POWER);")),
                L('build, repair and upgradeController: the boost adds output; the energy spent is the same as without a boost.', eng(P + 'creeps/build.js', 'object.store.energy -= buildEffect;')),
                L('CARRY: a boosted part holds {{CARRY_CAPACITY}} × {{BOOSTS.carry.KH.capacity}}, {{BOOSTS.carry.KH2O.capacity}} or {{BOOSTS.carry.XKH2O.capacity}}, and it still counts as one part of weight when loaded.', eng(P + 'creeps/_recalc-body.js', "object.storeCapacity = utils.calcBodyEffectiveness(object.body, C.CARRY, 'capacity', C.CARRY_CAPACITY, true);"), eng(P + 'movement.js', 'totalCarry -= Math.min(totalCarry, C.CARRY_CAPACITY * boost);')),
                L('MOVE: a boosted part removes 2 fatigue × {{BOOSTS.move.ZO.fatigue}}, {{BOOSTS.move.ZHO2.fatigue}} or {{BOOSTS.move.XZHO2.fatigue}} per tick.', eng(P + 'creeps/tick.js', "require('./_add-fatigue')(object, -2*moves, scope);")),
                L('TOUGH: damage that lands on a boosted TOUGH part with hits left is multiplied by {{BOOSTS.tough.GO.damage}}, {{BOOSTS.tough.GHO2.damage}} or {{BOOSTS.tough.XGHO2.damage}}.', eng(P + 'creeps/tick.js', 'damageRatio = C.BOOSTS[bodyPart.type][bodyPart.boost].damage;')),
                L('A part at 0 hits adds nothing, boosted or not.', eng(UTILS, 'if(!(i.hits || !withoutOldHits && i._oldHits) || i.type != bodyPartType) {')),
                L('A boost has no timer. renewCreep removes every boost of the creep and gives nothing back.', eng(P + 'spawns/renew-creep.js', 'i.boost = null;')),
                L('unboostCreep (own creep, adjacent, lab off cooldown) removes all boosts at once and drops {{LAB_UNBOOST_MINERAL}} compound per part on the creep\'s tile, {{LAB_UNBOOST_MINERAL / LAB_BOOST_MINERAL * 100}}% of what went in, and {{LAB_UNBOOST_ENERGY}} energy.', eng(UNBOOST, 'const mineralReturn = boostedParts[r]*C.LAB_UNBOOST_MINERAL;')),
                L('The unboosting lab then cools down: per part, the reaction times of the whole chain of the compound × {{LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT}}. One XLHO2 part: {{(' + XLHO2_CHAIN + ') * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT}} ticks; one XGHO2 part: {{(' + XGHO2_CHAIN + ') * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT}}.', eng(UNBOOST, 'return a + boostedParts[r]*utils.calcTotalReactionsTime(r)*C.LAB_UNBOOST_MINERAL/C.LAB_REACTION_AMOUNT;')),
                L('Death: each boosted part leaves {{LAB_BOOST_MINERAL}} compound and {{LAB_BOOST_ENERGY}} energy × rate × remaining life ÷ full life in the tombstone. The rate is {{CREEP_CORPSE_RATE}}, or 1 for recycleCreep.', eng(P + 'creeps/_die.js', 'bodyResources[i.boost] += C.LAB_BOOST_MINERAL * lifeRate;'), eng(P + 'spawns/recycle-creep.js', "require('../creeps/_die')(target, 1.0, false, scope);")),
            ],
            pitfalls: [
                L('If the lab runs short it boosts only the parts it can pay for, and boostCreep has already returned OK. Check creep.body before sending the creep out.', eng(BOOST, 'while(object.store[mineralType] >= C.LAB_BOOST_MINERAL && object.store.energy >= C.LAB_BOOST_ENERGY && nonBoostedParts.length) {')),
                L('Unboosting a creep with many tier 3 parts blocks that lab for thousands of ticks. Use a lab that runs no reactions.', eng(UNBOOST, 'bulk.update(object, { cooldownTime: cooldown + gameTime });')),
                L('Renew a boosted creep and the boosts are gone; cargo above the smaller capacity drops on the ground.', eng(P + 'spawns/renew-creep.js', "require('../creeps/_drop-resources-without-space')(target, scope);")),
            ],
            constants: ['LAB_BOOST_MINERAL', 'LAB_BOOST_ENERGY', 'LAB_UNBOOST_MINERAL', 'LAB_UNBOOST_ENERGY', 'BOOSTS', 'CREEP_CORPSE_RATE'],
            see: ['StructureLab.boostCreep', 'StructureLab.unboostCreep', 'const:boosts', 'mechanic:labs-and-reactions', 'recipe:make-a-tier-3-boost', 'recipe:labs-and-boosts', 'StructureSpawn.renewCreep', 'mechanic:creep-death', 'mechanic:damage-and-healing', 'Creep.body'],
            url: DOCS + 'resources.html',
        },

        // ------------------------------------------------------------ factory
        {
            id: 'factory-and-commodities',
            title: 'Factory, commodities and factory levels',
            summary: 'A factory turns resources from its own store into commodities, one batch per call, with a cooldown per recipe. Recipes without a level run in any factory; recipes of level 1 to 5 need a factory of exactly that level with an active PWR_OPERATE_FACTORY effect.',
            tasks: [
                'how does a factory work', 'how do factory levels work', 'what does PWR_OPERATE_FACTORY do', 'which commodities need no factory level',
                'store energy as batteries', 'commodity production chains', 'can a factory level be changed', 'what are bars for',
            ],
            facts: [
                L('One factory per room from room level {{[1, 2, 3, 4, 5, 6, 7, 8].find(l => CONTROLLER_STRUCTURES.factory[l] > 0)}}, for {{CONSTRUCTION_COST.factory}} energy. It holds {{FACTORY_CAPACITY}} units of any mix.', common(CONSTANTS, '"factory": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1}'), common(CONSTANTS, 'FACTORY_CAPACITY: 50000,')),
                L('produce(type) takes the components of COMMODITIES[type] out of the factory store, adds COMMODITIES[type].amount units of the product and sets a cooldown of COMMODITIES[type].cooldown ticks.', eng(PRODUCE, 'bulk.update(object, {cooldownTime: C.COMMODITIES[intent.resourceType].cooldown + gameTime});')),
                L('Compression, in any factory: {{COMMODITIES.utrium_bar.components.U}} of a mineral + {{COMMODITIES.utrium_bar.components.energy}} energy → {{COMMODITIES.utrium_bar.amount}} bar, cooldown {{COMMODITIES.utrium_bar.cooldown}}. Back: {{COMMODITIES.U.components.utrium_bar}} bar + {{COMMODITIES.U.components.energy}} energy → {{COMMODITIES.U.amount}} mineral.', common(CONSTANTS, '[exports.RESOURCE_UTRIUM_BAR]: {')),
                L('The bars: utrium_bar, lemergium_bar, zynthium_bar, keanium_bar, ghodium_melt (G), oxidant (O), reductant (H), purifier (X).', common(CONSTANTS, '[exports.RESOURCE_UTRIUM_BAR]: {')),
                L('Battery: {{COMMODITIES.battery.components.energy}} energy → {{COMMODITIES.battery.amount}} battery; {{COMMODITIES.energy.components.battery}} battery → {{COMMODITIES.energy.amount}} energy, cooldown {{COMMODITIES.battery.cooldown}} each way. A round trip loses {{COMMODITIES.battery.components.energy - COMMODITIES.energy.amount}} energy per batch.', common(CONSTANTS, '[exports.RESOURCE_BATTERY]: {')),
                L('Four chains start from the deposit resources, in any factory: {{COMMODITIES.wire.components.silicon}} silicon + {{COMMODITIES.wire.components.utrium_bar}} utrium_bar → {{COMMODITIES.wire.amount}} wire; biomass + lemergium_bar → cell; metal + zynthium_bar → alloy; mist + keanium_bar → condensate.', common(CONSTANTS, '[exports.RESOURCE_WIRE]: {')),
                L('Each chain then rises one factory level per step: wire → switch → transistor → microchip → circuit → device; cell → phlegm → tissue → muscle → organoid → organism; alloy → tube → fixtures → frame → hydraulics → machine; condensate → concentrate → extract → spirit → emanation → essence.', article('resources')),
                L('Shared components made from bars: composite (level {{COMMODITIES.composite.level}}), crystal (level {{COMMODITIES.crystal.level}}), liquid (level {{COMMODITIES.liquid.level}}).', common(CONSTANTS, '[exports.RESOURCE_COMPOSITE]: {')),
                L('A new factory has no level. The first PWR_OPERATE_FACTORY used on it sets its level to the level of the power, for good. Later uses must have the same level and only renew the effect.', eng(USE_POWER, 'bulk.update(target, {level: creepPower.level});'), eng(USE_POWER, 'if(target.level != creepPower.level) {')),
                L('The effect lasts {{' + OP_FACTORY + '.duration}} ticks and costs {{' + OP_FACTORY + '.ops}} ops, at range {{' + OP_FACTORY + '.range}}; the power itself has a cooldown of {{' + OP_FACTORY + '.cooldown}} ticks.', common(CONSTANTS, '[exports.PWR_OPERATE_FACTORY]: {')),
                L('A recipe with a level needs a factory of exactly that level (ERR_INVALID_TARGET otherwise) and the effect active (ERR_BUSY otherwise).', eng(STRUCT, 'if(!!C.COMMODITIES[resourceType].level && C.COMMODITIES[resourceType].level != rawFactory.level) {'), eng(PRODUCE, 'e.power == C.PWR_OPERATE_FACTORY && e.level == C.COMMODITIES[intent.resourceType].level && e.endTime >= gameTime')),
                L('Without the effect a levelled factory still runs every recipe that has no level.', eng(PRODUCE, 'if(!!C.COMMODITIES[intent.resourceType].level && (object.level > 0) &&')),
                L('The power changes nothing else: batch size and cooldown stay those of COMMODITIES.', eng(PRODUCE, "object.store[intent.resourceType] = (object.store[intent.resourceType]||0) + (C.COMMODITIES[intent.resourceType].amount || 1);")),
                L('A factory makes only its own level and the recipes without level, so a chain up to level 5 needs factories of several levels, each in its own room.', article('resources')),
                L('The level cannot be changed afterwards; only a rebuilt factory can get another one.', article('resources')),
            ],
            pitfalls: [
                L('Decide the level before the first usePower: an operator whose PWR_OPERATE_FACTORY has another level can never operate that factory.', eng(USE_POWER, 'if(target.level != creepPower.level) {')),
                L('The product must fit: ERR_FULL when the store minus the components plus the product would exceed the capacity.', eng(PRODUCE, "if (targetTotal - componentsTotal + (C.COMMODITIES[intent.resourceType].amount||1) > object.storeCapacity) {")),
                L('A factory in a room that is no longer yours, or below the needed level, has capacity 0 and produces nothing.', eng(P + 'factories/tick.js', 'C.CONTROLLER_STRUCTURES.factory[roomController.level] ? C.FACTORY_CAPACITY : 0;')),
            ],
            tables: [factoryLevelTable],
            constants: ['FACTORY_CAPACITY', 'COMMODITIES', 'CONTROLLER_STRUCTURES.factory', 'CONSTRUCTION_COST.factory'],
            see: ['StructureFactory', 'StructureFactory.produce', 'StructureFactory.level', 'StructureFactory.cooldown', 'const:commodities', 'PowerCreep.usePower', 'const:power', 'mechanic:deposits', 'recipe:factory-production'],
            url: DOCS + 'resources.html#Commodities',
        },

        // ------------------------------------------------------------ deposits
        {
            id: 'deposits',
            title: 'Deposits in highway rooms',
            summary: 'Deposits appear in highway rooms and give silicon, metal, biomass or mist: {{HARVEST_DEPOSIT_POWER}} unit per WORK part per harvest. Every harvest makes the next cooldown longer, and a deposit nobody harvests for {{DEPOSIT_DECAY_TIME}} ticks disappears.',
            tasks: [
                'how do deposits work', 'deposit cooldown formula', 'when does a deposit disappear', 'where do deposits appear', 'when does a new deposit spawn',
                'how much can I get from a deposit', 'silicon metal biomass mist', 'does a deposit run out',
            ],
            facts: [
                L('Four types: silicon, metal, biomass, mist.', doc('Deposit.depositType')),
                L('One type per quadrant of the world map; deposits lie in the highway rooms between the sectors.', article('resources')),
                L('Any creep with WORK harvests it at range 1. No extractor, no ownership and no reservation is checked.', eng(CREEPS, 'else if(register.deposits[target.id] && (target instanceof globals.Deposit)) {')),
                L('A harvest gives {{HARVEST_DEPOSIT_POWER}} unit per working WORK part, times the harvest boost. A deposit has no amount that runs out.', eng(P + 'creeps/harvest.js', "const amount = utils.calcBodyEffectiveness(object.body, C.WORK, 'harvest', C.HARVEST_DEPOSIT_POWER);")),
                L('After a harvest the cooldown is ceil({{DEPOSIT_EXHAUST_MULTIPLY}} × total harvested ^ {{DEPOSIT_EXHAUST_POW}}) ticks. The total counts everything ever taken from this deposit, by anyone.', eng(P + 'creeps/harvest.js', 'const cooldown = Math.ceil(C.DEPOSIT_EXHAUST_MULTIPLY*Math.pow(target.harvested,C.DEPOSIT_EXHAUST_POW));')),
                L('There is no cooldown while that value is 1 or less: about the first {{Math.floor(Math.pow(1 / DEPOSIT_EXHAUST_MULTIPLY, 1 / DEPOSIT_EXHAUST_POW))}} units.', eng(P + 'creeps/harvest.js', 'if(cooldown > 1) {')),
                L('Later it grows fast: {{Math.ceil(DEPOSIT_EXHAUST_MULTIPLY * Math.pow(10000, DEPOSIT_EXHAUST_POW))}} ticks after 10,000 units, {{Math.ceil(DEPOSIT_EXHAUST_MULTIPLY * Math.pow(50000, DEPOSIT_EXHAUST_POW))}} after 50,000, {{Math.ceil(DEPOSIT_EXHAUST_MULTIPLY * Math.pow(100000, DEPOSIT_EXHAUST_POW))}} after 100,000.', eng(P + 'creeps/harvest.js', 'const cooldown = Math.ceil(C.DEPOSIT_EXHAUST_MULTIPLY*Math.pow(target.harvested,C.DEPOSIT_EXHAUST_POW));')),
                L('All creeps that harvest in the same tick succeed; the cooldown is set at the end of the tick from the new total.', eng(P + 'deposits/tick.js', 'cooldownTime: gameTime + object._cooldown')),
                L('Every harvest sets the decay timer back to {{DEPOSIT_DECAY_TIME}} ticks, and a new deposit starts with that timer. When it runs out the deposit is removed.', eng(P + 'creeps/harvest.js', 'bulk.update(target, {decayTime: C.DEPOSIT_DECAY_TIME + gameTime});'), eng(P + 'deposits/tick.js', 'if(object.decayTime && gameTime > object.decayTime) {')),
                L('Deposit.lastCooldown is the current value of the formula; the total itself is not shown.', eng('src/game/deposits.js', 'lastCooldown: o => Math.ceil(C.DEPOSIT_EXHAUST_MULTIPLY*Math.pow(o.harvested,C.DEPOSIT_EXHAUST_POW)),')),
                L('The server job that places deposits runs every five minutes of real time. Per sector it puts one into a highway room of that sector that has no deposit yet.', backend(CRON, 'genDeposits: [5*60, genDeposits],'), backend(CRON, 'const freeRooms = _.reject(rooms, r => _.includes(busyRooms, r._id));')),
                L('A sector gets a new one only while its deposits are worn: each counts 20 ÷ max(1, its cooldown value) and the sum must be below 2.5. A fresh deposit counts 20 and blocks new ones; a single deposit must be past a cooldown of 8, about {{Math.ceil(Math.pow(8 / DEPOSIT_EXHAUST_MULTIPLY, 1 / DEPOSIT_EXHAUST_POW))}} units harvested.', backend(CRON, 'if(throughput >= 2.5) {'), backend(CRON, 'const throughput = _.sum(sectorDeposits, deposit => 20/Math.max(1,(C.DEPOSIT_EXHAUST_MULTIPLY*Math.pow(deposit.harvested||0,C.DEPOSIT_EXHAUST_POW))));')),
                L('It is placed on a wall tile with at least one open neighbour, between 5 and 44 on both axes, with no other object within 2 tiles.', backend(CRON, 'while ((!isWall || !hasExit || nearObjects) && cnt < 1000);')),
                L('A deposit blocks movement; creeps harvest from a neighbouring tile.', common(CONSTANTS, 'OBSTACLE_OBJECT_TYPES: [')),
            ],
            pitfalls: [
                L('Once the cooldown is long a creep mostly waits: with W WORK parts it gets W units once per cooldown. Decide by lastCooldown and the travel time whether the trip still pays.', eng(P + 'deposits/tick.js', 'cooldownTime: gameTime + object._cooldown')),
                L('The wear is shared: a deposit other players have used starts slow for you too.', eng(P + 'creeps/harvest.js', "bulk.inc(target, 'harvested', amount);")),
                L('What does not fit in the creep drops on its tile and decays; bring enough CARRY.', eng(P + 'creeps/harvest.js', 'amount: Math.min(object.store[target.depositType], sum - object.storeCapacity),')),
            ],
            tables: [depositTable],
            constants: ['HARVEST_DEPOSIT_POWER', 'DEPOSIT_EXHAUST_MULTIPLY', 'DEPOSIT_EXHAUST_POW', 'DEPOSIT_DECAY_TIME'],
            see: ['Deposit', 'Deposit.lastCooldown', 'Deposit.cooldown', 'Deposit.ticksToDecay', 'Creep.harvest', 'recipe:harvest-deposits', 'mechanic:factory-and-commodities', 'mechanic:room-types', 'StructureObserver.observeRoom'],
            url: DOCS + 'resources.html#Commodities',
        },

        // ------------------------------------------------------------ market
        {
            id: 'market',
            title: 'Market: orders, deals, fees and credits',
            summary: 'Players trade through buy and sell orders tied to a terminal. Creating an order costs {{MARKET_FEE * 100}}% of its value in credits. A deal against an order moves the resource between the two terminals at the end of the tick, and the side that makes the deal pays the energy.',
            tasks: [
                'how does the market work', 'how long does a market order last', 'when does a deal execute', 'buy order or sell order', 'how many market orders can I have',
                'do I get the fee back when I cancel an order', 'what are NPC orders', 'trade pixels or tokens',
            ],
            facts: [
                L('Two order types. ORDER_SELL offers a resource out of your terminal; ORDER_BUY asks for a resource to be delivered to it. An order names a room where you own a terminal.', eng(MARKET_API, "(!roomName || !_.any(runtimeData.userObjects, {type: 'terminal', room: roomName}))) {")),
                L('Fee: {{MARKET_FEE * 100}}% of price × amount in credits, rounded up to 0.001, taken when the order is created. extendOrder charges it on the added amount, changeOrderPrice on the increase × remaining amount.', eng(MARKET, 'var fee = Math.ceil(intent.price * intent.totalAmount * C.MARKET_FEE);'), eng(MARKET, 'var fee = Math.ceil(order.price * intent.addAmount * C.MARKET_FEE);')),
                L('cancelOrder returns no fee. An order that expires gets the fee of its unfilled part back.', eng(MARKET, 'const remainingFee = order.remainingAmount * order.price * C.MARKET_FEE;')),
                L('Life time: {{MARKET_ORDER_LIFE_TIME / 86400000}} days of real time from creation. Extending the order or changing its price does not restart it.', eng(MARKET, 'if(order.user && (nowTimestamp - order.createdTimestamp > C.MARKET_ORDER_LIFE_TIME)) {')),
                L('At most {{MARKET_MAX_ORDERS}} orders per player; inactive and filled ones count.', eng(MARKET_API, 'if(_.size(this.orders) + ordersCreatedDuringTick >= C.MARKET_MAX_ORDERS) {')),
                L('A sell order is active while its terminal holds the resource. A buy order is active while you have credits for at least one unit and its terminal has free space. This is checked again every tick, and a new order starts inactive.', eng(MARKET, 'var newActive = isOwner && newAmount > 0;'), eng(MARKET, 'active: false,')),
                L('order.amount is what can trade right now (limited by stock, credits and space), remainingAmount what is left of the order, totalAmount what was ordered.', eng(MARKET, 'var newAmount = Math.min(Math.floor(userMoney / order.price), order.remainingAmount);')),
                L('Only active orders are visible in getAllOrders and can be dealt with.', driver(RUNTIME_DATA, "return db['market.orders'].find({active: true})")),
                L('deal(orderId, amount, yourRoomName) trades against an order through your terminal in that room; at most 10 deals per tick.', eng(MARKET_API, "if(!intents.pushByName('global', 'deal', {orderId, targetRoomName, amount}, 10)) {")),
                L('Deals and terminal sends run once per tick, after all rooms have been processed. The result is visible in the next tick.', eng('src/main.js', "stage = 'global';"), eng('src/processor/global.js', 'marketProcessor({orders, userIntents, usersById, gameTime, roomObjectsByType, bulkObjects, bulkUsers, bulkTransactions,')),
                L('The traded amount is the smallest of: the amount asked, what is left in the order, the stock of the selling terminal, the free space of the buying terminal, and what the buyer can pay.', eng(MARKET, 'var amount = Math.min(deal.amount, order.remainingAmount);'), eng(MARKET, 'amount = Math.floor(dealCost/order.price);')),
                L('The price is the order\'s price per unit. The buyer pays amount × price and the seller receives exactly that; a deal has no credit fee.', eng(MARKET, 'var dealCost = amount * order.price;')),
                L('Energy: the terminal of the player who makes the deal pays the transfer cost for the distance between the two rooms, whether buying or selling. The order owner pays no energy.', eng(MARKET, 'if(executeTransfer(seller, buyer, order.resourceType, amount, targetTerminal, {order: {'), article('market')),
                L('Only the dealing terminal gets the cooldown of {{TERMINAL_COOLDOWN}} ticks, so each terminal makes at most one deal per tick.', eng(MARKET, 'bulkObjects.update(targetTerminal, {cooldownTime: gameTime + cooldown});')),
                L('When several players deal on the same order in one tick, the terminal nearest to the order is served first.', eng(MARKET, 'terminalDeals.sort(')),
                L('Credits belong to the account. Balance and prices have a resolution of 0.001 credit.', article('market'), common('lib/system.js', "'price': value => parseInt((1000 * value).toFixed(0)),")),
                L('First credits: sell to an existing buy order with deal. That needs no credits; only buying from a sell order is checked against your balance.', article('market'), eng(MARKET_API, 'if(order.type == C.ORDER_SELL && (runtimeData.user.money || 0) < amount * order.price) {')),
                L('Account resources (INTERSHARD_RESOURCES: token, cpuUnlock, pixel, accessKey) trade without terminals: no room, no energy, no cooldown; the items move between the two accounts.', eng(MARKET, "bulkUsers.inc(buyer, 'resources.' + order.resourceType, amount);")),
                L('NPC terminals stand in the highway crossroads rooms. Their orders have no owner: they are limited only by their remaining amount, never by stock, space or credits.', article('market'), eng(MARKET, 'if(seller.user) {')),
                L('On the private server a job renews the orders of each NPC terminal about every 5,000 ticks: one sell order for a base mineral, sometimes one for energy and one buy order for a base mineral.', backend(CRON, 'var sellMineralAmount = 40, sellEnergyAmount = 40, buyMineralAmount = 20, period = 5000;')),
                L('getHistory gives, per resource and day, the transactions, volume, avgPrice and stddevPrice of the sales by players in the last 14 days. It is rebuilt hourly and cached for three hours in the runtime.', backend(CRON, 'avgPrice: +i.avg.toFixed(3),'), backend(CRON, 'calcMarketStats: [60*60, calcMarketStats],'), driver(RUNTIME_DATA, '// cache for 3 hours')),
                L('Every send and deal that was carried out is logged; the last 100 in each direction are in incomingTransactions and outgoingTransactions.', driver(RUNTIME_DATA, 'db.transactions.findEx({sender: userId}, {sort: {time:-1}, limit: 100}),')),
            ],
            pitfalls: [
                L('OK from createOrder, deal, extendOrder or changeOrderPrice only means the request was queued. Whether it took effect shows next tick in Game.market.orders, credits and the transaction lists.', eng(MARKET, 'if (user.money < fee) {')),
                L('A filled order stays in Game.market.orders as inactive and still counts toward the limit: cancel it.', eng(MARKET, 'availableResourceAmount = Math.min(availableResourceAmount, order.remainingAmount);')),
                L('When you buy energy, the transfer fee must already be in your terminal; the energy that arrives cannot pay for it.', eng(MARKET, 'transferFeeTerminal === toTerminal && toTerminal.store.energy < transferCost) {')),
                L('If the owner changes the price of an order in the tick you deal on it, your deal is either dropped or runs at the new price, depending on which player is processed first.', eng(MARKET, 'order._skip = true;'), eng(MARKET, "bulk.inc(order, 'price', intent.newPrice - order.price);")),
                L('Each market call that returns OK costs 0.2 CPU like any other intent.', driver('lib/runtime/runtime.js', 'pushByName(id, name, data, maxLen) {')),
            ],
            tables: [marketFeeTable],
            constants: ['MARKET_FEE', 'MARKET_MAX_ORDERS', 'MARKET_ORDER_LIFE_TIME', 'TERMINAL_COOLDOWN', 'ORDER_SELL', 'ORDER_BUY', 'INTERSHARD_RESOURCES'],
            see: ['Game.market', 'Game.market.createOrder', 'Game.market.deal', 'Game.market.orders', 'Game.market.getAllOrders', 'Game.market.getHistory', 'Game.market.credits', 'Game.market.incomingTransactions',
                'mechanic:terminal-transfers', 'recipe:terminal-and-market', 'recipe:balance-resources-between-rooms', 'const:terminal-market', 'Game.resources'],
            url: DOCS + 'market.html',
        },

        // ------------------------------------------------------------ terminal transfers
        {
            id: 'terminal-transfers',
            title: 'Terminal transfers: energy cost, cooldown, limits',
            summary: 'A terminal sends any resource to a player\'s terminal in any other room. The sender pays ceil(amount × (1 − e^(−distance / 30))) energy on top and then waits {{TERMINAL_COOLDOWN}} ticks; the resource arrives at the end of the same tick.',
            tasks: [
                'terminal energy cost formula', 'how far can a terminal send', 'who pays for a terminal transfer', 'how long is the terminal cooldown',
                'what does PWR_OPERATE_TERMINAL do', 'what does PWR_DISRUPT_TERMINAL do', 'is there a minimum amount for terminal send', 'send to a full terminal',
            ],
            facts: [
                L('Energy cost: ceil(amount × (1 − e^(−distance / 30))). It depends only on amount and distance, not on the resource.', eng(UTILS, 'return Math.ceil(amount * (1 - Math.exp(-range / 30)))')),
                L('Distance is counted in rooms: the larger of the two axis differences, wrapping around the edge of the world.', eng(UTILS, 'dx = Math.min(worldSize - dx, dx);')),
                L('Per 1000 units that is ' + fee(1) + ' energy at 1 room, ' + fee(5) + ' at 5, ' + fee(10) + ' at 10, ' + fee(20) + ' at 20, ' + fee(30) + ' at 30 and ' + fee(60) + ' at 60. There is no distance limit; far away the cost comes close to the amount itself.', eng(UTILS, 'return Math.ceil(amount * (1 - Math.exp(-range / 30)))')),
                L('The sender pays. To send energy the terminal needs the amount plus the cost.', eng(MARKET, 'resourceType == C.RESOURCE_ENERGY && fromTerminal.store.energy < amount + transferCost) ||')),
                L('The sending terminal then cools down {{TERMINAL_COOLDOWN}} ticks, if the send went through. The receiver gets no cooldown and can take any number of transfers.', eng(MARKET, 'bulkObjects.update(terminal, {cooldownTime: gameTime + cooldown});')),
                L('Sends run once per tick after all rooms have been processed; both stores show the result in the next tick.', eng('src/main.js', "stage = 'global';")),
                L('The target room must hold a terminal that belongs to a player. If not, nothing happens and nothing is charged.', eng(MARKET, 'if(!terminalsByRoom[intent.targetRoomName] || !terminalsByRoom[intent.targetRoomName].user) {')),
                L('The amount is cut to the free space of the target terminal and the cost is counted on what is really sent. A full target receives nothing.', eng(MARKET, 'amount = Math.min(amount, freeSpace);')),
                L('A terminal holds {{TERMINAL_CAPACITY}} in all. Its capacity is 0 while the room is not the owner\'s at a level that allows a terminal, so such a terminal receives nothing.', eng(P + 'terminal/tick.js', 'C.CONTROLLER_STRUCTURES.terminal[roomController.level] ? C.TERMINAL_CAPACITY : 0;')),
                L('send() only checks your side at the start of the tick: resource and fee in the terminal, no cooldown, a well-formed room name. It cannot see the target.', eng(STRUCT, "intents.set(this.id, 'send', {resourceType, amount, targetRoomName, description});")),
                L('There is no minimum amount. TERMINAL_MIN_SEND and TERMINAL_SEND_COST are not read by the engine.', eng(P + 'terminal/send.js', 'if(!intent.amount || !object.store || !(object.store[intent.resourceType] >= intent.amount)) {')),
                L('PWR_OPERATE_TERMINAL multiplies the energy cost (rounded up) and the cooldown (rounded) of that terminal by {{' + OP_TERMINAL + '.effect[0]}}, {{' + OP_TERMINAL + '.effect[1]}}, {{' + OP_TERMINAL + '.effect[2]}}, {{' + OP_TERMINAL + '.effect[3]}} or {{' + OP_TERMINAL + '.effect[4]}} (power level 1 to 5) for {{' + OP_TERMINAL + '.duration}} ticks. At level 5 the cooldown is {{Math.round(TERMINAL_COOLDOWN * ' + OP_TERMINAL + '.effect[4])}} ticks. It applies to sends from the terminal and to deals made through it.',
                    eng(MARKET, 'transferCost = Math.ceil(transferCost * C.POWER_INFO[C.PWR_OPERATE_TERMINAL].effect[effect.level-1]);'), eng(MARKET, 'cooldown = Math.round(cooldown * C.POWER_INFO[C.PWR_OPERATE_TERMINAL].effect[effect.level-1]);')),
                L('PWR_DISRUPT_TERMINAL lasts {{' + DISRUPT_TERMINAL + '.duration}} ticks and reaches the whole room (range {{' + DISRUPT_TERMINAL + '.range}}). While it lasts creeps cannot withdraw from the terminal (ERR_INVALID_TARGET) and PWR_OPERATE_EXTENSION cannot take energy from it.',
                    eng(CREEPS, 'var effect = _.find(target.effects, {power: C.PWR_DISRUPT_TERMINAL});'), eng(P + 'power-creeps/usePower.js', 'var effect = _.find(target.effects, {power: C.PWR_DISRUPT_TERMINAL});')),
                L('The engine code for send and deal looks only at PWR_OPERATE_TERMINAL; it has no check for the disrupt effect.', eng(P + 'terminal/send.js', 'var effect = _.find(object.effects, {power: C.PWR_OPERATE_TERMINAL});')),
            ],
            pitfalls: [
                L('send returns OK for a room without a terminal, for a full terminal and for a terminal in a room that is no longer active. Check Game.market.outgoingTransactions in the next tick.', eng(MARKET, 'bulkTransactions.insert(_.extend({')),
                L('Under PWR_OPERATE_TERMINAL send() and deal() still compare the terminal\'s energy with the full cost, so keep the undiscounted fee in the terminal.', eng(STRUCT, 'var cost = utils.calcTerminalEnergyCost(amount,range);')),
                L('A send and a deal from the same terminal in one tick: the send runs first and the deal is dropped.', eng(MARKET, 'if(targetTerminal.cooldownTime > gameTime) {')),
                L('If creeps take the resource or the fee energy out of the terminal in the tick of the send, the send is dropped.', eng(MARKET, 'if(fromTerminal.user && (!fromTerminal.store || !fromTerminal.store[resourceType] || fromTerminal.store[resourceType] < amount)) {')),
            ],
            tables: [terminalCostTable],
            constants: ['TERMINAL_CAPACITY', 'TERMINAL_COOLDOWN', 'CONSTRUCTION_COST.terminal', 'CONTROLLER_STRUCTURES.terminal'],
            see: ['StructureTerminal', 'StructureTerminal.send', 'StructureTerminal.cooldown', 'StructureTerminal.store', 'Game.market.calcTransactionCost', 'Game.map.getRoomLinearDistance',
                'Game.market.outgoingTransactions', 'mechanic:market', 'recipe:balance-resources-between-rooms', 'recipe:terminal-and-market', 'const:terminal-market', 'const:power'],
            url: DOCS + 'market.html',
        },
    ],

    extend: {
        'const:boosts': {
            notes: [
                L('A compound multiplies only the actions listed for it; every other action of the boosted part stays at ×1.', eng(UTILS, 'iPower *= C.BOOSTS[bodyPartType][i.boost][methodName];')),
                L('Each compound belongs to one part type, and a part carries one compound at a time.', eng(BOOST, 'var nonBoostedParts = _.filter(target.body, i => !i.boost && C.BOOSTS[i.type] && C.BOOSTS[i.type][mineralType]);')),
            ],
            see: ['mechanic:boosts', 'recipe:make-a-tier-3-boost'],
        },
        'const:reactions': {
            notes: [
                L('REACTIONS lists every pair in both orders, so the order of the two source labs does not matter.', eng(RUN, 'const product = C.REACTIONS[lab1MineralType][lab2MineralType];')),
                L('REACTION_TIME is also the cooldown of reverseReaction for that compound.', eng(REVERSE, 'cooldownTime: gameTime + C.REACTION_TIME[mineralType]});')),
            ],
            see: ['mechanic:labs-and-reactions', 'recipe:make-a-tier-3-boost'],
        },
        'const:commodities': {
            notes: [
                L('A recipe with a level runs only in a factory of exactly that level while PWR_OPERATE_FACTORY is active on it; a recipe without a level runs in any factory.', eng(PRODUCE, 'e.power == C.PWR_OPERATE_FACTORY && e.level == C.COMMODITIES[intent.resourceType].level && e.endTime >= gameTime')),
                L('"makes" is the output of one produce call; the components are taken from the factory\'s own store.', eng(PRODUCE, "object.store[intent.resourceType] = (object.store[intent.resourceType]||0) + (C.COMMODITIES[intent.resourceType].amount || 1);")),
            ],
            see: ['mechanic:factory-and-commodities', 'recipe:factory-production', 'StructureFactory.level'],
        },
    },
};
