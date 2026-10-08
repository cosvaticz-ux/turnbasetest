import assert from "node:assert/strict";
import { BATTLE_PHASE, BattleFlowManager } from "../src/battle/BattleFlowManager.js";
import {
    getNormalBattleItemEntries,
    getPrepareItemEntries,
    PreparePhaseManager
} from "../src/battle/PreparePhaseManager.js";
import { StatusEffectManager } from "../src/battle/StatusEffectManager.js";
import { TurnManager } from "../src/battle/TurnManager.js";
import { ITEM_DEFINITIONS } from "../src/data/battleContent.js";
import { PREPARE_ACTION } from "../src/data/prepareActions.js";

const living = (id, values = {}) => ({
    id,
    definitionId: id,
    hp: 10,
    maxHp: 10,
    ap: 1,
    maxAp: 3,
    statusEffects: [],
    isAlive() { return this.hp > 0; },
    ...values
});

// Prepare is explicit, completes into Player, and an ordinary battle skips it.
const initialFlow = new BattleFlowManager();
assert.equal(initialFlow.start({ prepare: true }), BATTLE_PHASE.PREPARE);
assert.equal(initialFlow.completePreparation(), true);
assert.equal(initialFlow.phase, BATTLE_PHASE.PLAYER);
assert.equal(initialFlow.completePreparation(), false, "Prepare can only complete once per opportunity");

const ordinaryFlow = new BattleFlowManager();
assert.equal(ordinaryFlow.start(), BATTLE_PHASE.PLAYER);

// Reopening requires explicit permission and terminal phases cannot reopen.
assert.equal(initialFlow.reopenPreparation(), false);
assert.equal(initialFlow.phase, BATTLE_PHASE.PLAYER);
assert.equal(initialFlow.reopenPreparation({ enabled: true }), true);
assert.equal(initialFlow.phase, BATTLE_PHASE.PREPARE);

for (const result of ["victory", "defeat"]) {
    const terminalFlow = new BattleFlowManager();
    terminalFlow.start();
    assert.equal(terminalFlow.finish(result), true);
    assert.equal(terminalFlow.reopenPreparation({ enabled: true }), false);
}

const statuses = new StatusEffectManager();
const prepare = new PreparePhaseManager({ statusEffectManager: statuses });

// Focus affects living party members only and clamps at max AP.
const focusedParty = [
    living("rafel", { ap: 2, maxAp: 3 }),
    living("anno", { ap: 3, maxAp: 3 }),
    living("gram", { hp: 0, ap: 1, maxAp: 3 })
];
assert.equal(prepare.execute(PREPARE_ACTION.FOCUS, { party: focusedParty }).executed, true);
assert.deepEqual(focusedParty.map(member => member.ap), [3, 3, 1]);

const createSalt = quantity => ({ ...ITEM_DEFINITIONS["coarse-salt"], quantity });
const ghoul = living("ghoul");
const salt = createSalt(2);
assert.deepEqual(
    prepare.getCommands({ battleItems: [salt], enemies: [ghoul] }).map(command => command.id),
    [PREPARE_ACTION.FOCUS, PREPARE_ACTION.SCATTER_SALT, PREPARE_ACTION.BEGIN_BATTLE],
    "Prepare commands are generated in their data-defined order"
);
const saltResult = prepare.execute(PREPARE_ACTION.SCATTER_SALT, {
    battleItems: [salt],
    enemies: [ghoul]
});
assert.equal(saltResult.executed, true);
assert.equal(salt.quantity, 1, "Scatter Salt consumes exactly one item");
assert.deepEqual(
    ghoul.statusEffects.map(status => status.id),
    ["salt-exposed"],
    "Scatter Salt applies the registered status through StatusEffectManager"
);

assert.equal(prepare.execute(PREPARE_ACTION.SCATTER_SALT, {
    battleItems: [],
    enemies: [living("ghoul")]
}).executed, false, "Scatter Salt cannot execute without salt");
assert.deepEqual(
    prepare.getCommands({ battleItems: [], enemies: [living("ghoul")] }).map(command => command.id),
    [PREPARE_ACTION.FOCUS, PREPARE_ACTION.BEGIN_BATTLE],
    "Prepare item commands are discovered from eligible inventory data"
);

const saltWithoutTarget = createSalt(1);
const invalidTargets = [living("ghoul", { hp: 0 }), living("highwayman")];
assert.equal(
    prepare.getCommands({ battleItems: [saltWithoutTarget], enemies: invalidTargets })
        .find(command => command.id === PREPARE_ACTION.SCATTER_SALT).enabled,
    false,
    "owned salt remains visible but disabled when no valid target exists"
);
assert.equal(prepare.execute(PREPARE_ACTION.SCATTER_SALT, {
    battleItems: [saltWithoutTarget],
    enemies: invalidTargets
}).executed, false, "Scatter Salt cannot execute without a valid living Ghoul");

// Phase-specific item filters honor battleUsable and prepareOnly metadata.
const potion = { id: "potion", battleUsable: true, quantity: 1 };
const fieldItem = { id: "field-item", battleUsable: false, quantity: 1 };
const prepareOnlySalt = createSalt(1);
assert.deepEqual(getNormalBattleItemEntries([potion, fieldItem, prepareOnlySalt]), [potion]);
assert.deepEqual(getPrepareItemEntries([potion, fieldItem, prepareOnlySalt]), [prepareOnlySalt]);

// Completing a battle-level Prepare opportunity does not start a new round.
const turns = new TurnManager();
const counterBeforePrepare = turns.turnCounter;
turns.resumePlayerSide(1);
assert.equal(turns.activePlayerIndex, 1);
assert.equal(turns.turnCounter, counterBeforePrepare);
turns.beginPlayerSide(0);
assert.equal(turns.turnCounter, counterBeforePrepare + 1, "a real post-enemy player side still advances the round");

console.log("Prepare phase: flow policy, action resolution, item filtering, and turn invariants passed.");
