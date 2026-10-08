import assert from "node:assert/strict";
import { BattleFlowManager, BATTLE_PHASE } from "../src/battle/BattleFlowManager.js";
import { resolvePropertyMultiplier } from "../src/battle/CombatResolver.js";
import { DownStateManager } from "../src/core/DownStateManager.js";
import { createInitialGameState, normalizeGameState } from "../src/core/GameState.js";
import { MasteryManager, MASTERY_THRESHOLDS } from "../src/core/MasteryManager.js";
import { PartyManager } from "../src/core/PartyManager.js";
import { RewardResolver } from "../src/core/RewardResolver.js";
import { SaveManager } from "../src/core/SaveManager.js";
import { StatResolver } from "../src/core/StatResolver.js";
import { TechniqueResolver, TECHNIQUE_STATE } from "../src/core/TechniqueResolver.js";
import {
    createPartyCombatants,
    EQUIPMENT_DEFINITIONS
} from "../src/data/battleContent.js";
import { TECHNIQUE_DEFINITIONS } from "../src/data/techniques.js";
import {
    createWeaponAttackProfile,
    getEquippedWeapon,
    UNARMED_WEAPON,
    WEAPON_DEFINITIONS
} from "../src/data/weapons.js";

// StatResolver is DOM-independent, additive, deterministic, and immutable.
const baseStats = Object.freeze({ maxHp: 90, attack: 10, defense: 4, speed: 6, maxAp: 2 });
const resolver = new StatResolver({
    equipmentDefinitions: {
        testBlade: { statModifiers: { maxHp: 10, attack: 2 } }
    }
});
const resolved = resolver.resolve({
    baseStats,
    equipment: { weapon: "testBlade" },
    masteryModifiers: { attack: 1 },
    passiveModifiers: { defense: 2 },
    temporaryModifiers: { speed: 3 },
    statusEffects: [{ statModifiers: { maxAp: 1 } }]
});
assert.deepEqual(resolved, { maxHp: 100, attack: 13, defense: 6, speed: 9, maxAp: 3 });
assert.equal(Object.isFrozen(resolved), true);
assert.deepEqual(baseStats, { maxHp: 90, attack: 10, defense: 4, speed: 6, maxAp: 2 });

// Every P0 weapon family uses the shared schema and supplies basic attacks.
assert.deepEqual(
    new Set(Object.values(WEAPON_DEFINITIONS).map(weapon => weapon.type)),
    new Set(["sword", "greatsword", "spear", "axe", "bow", "firearm", "crossbow"])
);
for (const weapon of [UNARMED_WEAPON, ...Object.values(WEAPON_DEFINITIONS)]) {
    for (const key of ["id", "name", "type", "hands", "damageRange", "attackType", "element", "masteryDiscipline",
        "accuracyModifier", "critModifier", "armorInteraction", "allowedTechniques", "traits"]) {
        assert.ok(key in weapon, `${weapon.id} supplies ${key}`);
    }
    assert.equal(Object.isFrozen(weapon), true);
}
assert.equal(getEquippedWeapon({}).type, "unarmed");
assert.equal(createWeaponAttackProfile({ weapon: "ash-spear" }).attackType, "pierce");
assert.equal(resolvePropertyMultiplier({ properties: { resistances: { physical: 0.5, pierce: 0.5 } } },
    createWeaponAttackProfile({ weapon: "ash-spear" })), 0.25);
const armedCombatant = createPartyCombatants([{ id: "luke", active: true, hp: 80, equipment: { weapon: "ash-spear" } }])[0];
assert.equal(armedCombatant.basicAttack.weaponId, "ash-spear");
assert.equal(armedCombatant.speed, 11, "combat consumes StatResolver output from equipment");

// Mastery v2 exposes levels/progress and limits a discipline to one gain per encounter.
const state = createInitialGameState();
const mastery = new MasteryManager(state);
assert.deepEqual(MASTERY_THRESHOLDS, [0, 5, 15, 30]);
assert.equal(mastery.getLevel("luke", "sword"), 1);
assert.equal(mastery.recordUse("luke", "sword", { encounterId: "p0-fixed" }), 1);
assert.equal(mastery.canGainFromEncounter("luke", "sword", "p0-fixed"), false);
assert.equal(mastery.recordUse("luke", "sword", { encounterId: "p0-fixed" }), 0);
mastery.grant("luke", "sword", 14);
assert.equal(mastery.getLevel("luke", "sword"), 3);
new RewardResolver(state).apply({ mastery: { luke: { sword: 15 } } });
assert.equal(mastery.getLevel("luke", "sword"), 4);

// Technique knowledge and temporary availability are distinct states.
const techniques = new TechniqueResolver({ definitions: TECHNIQUE_DEFINITIONS, masteryManager: mastery });
const luke = { ...state.party[0], ap: 3, statusEffects: [] };
assert.equal(techniques.resolve(luke, "bash", { mode: "battle", party: [luke] }).state, TECHNIQUE_STATE.UNKNOWN);
assert.equal(techniques.resolve(luke, "fireball", { mode: "battle", party: [luke] }).state, TECHNIQUE_STATE.AVAILABLE);
luke.ap = 0;
assert.equal(techniques.resolve(luke, "fireball", { mode: "battle", party: [luke] }).state, TECHNIQUE_STATE.KNOWN);
assert.equal(techniques.resolve(luke, "fireball", { mode: "battle", party: [luke] }).known, true);

// Explicit phases gate input and terminal states cannot reopen.
const flow = new BattleFlowManager();
assert.equal(flow.start({ prepare: true }), BATTLE_PHASE.PREPARE);
assert.equal(flow.canAcceptPlayerInput(), true);
assert.equal(flow.transition(BATTLE_PHASE.PLAYER), true);
assert.equal(flow.transition(BATTLE_PHASE.PHASE_TRANSITION), true);
assert.equal(flow.canAcceptPlayerInput(), false);
assert.equal(flow.transition(BATTLE_PHASE.ENEMY), true);
assert.equal(flow.finish("victory"), true);
assert.equal(flow.phase, BATTLE_PHASE.VICTORY);
assert.equal(flow.reopenPreparation({ enabled: true }), false);

// First and second downs can revive; the third forces retreat. No permanent death.
const down = new DownStateManager({ reviveHpRatio: 0.25 });
const member = { hp: 0, maxHp: 100, downCount: 0 };
assert.equal(down.handleZeroHp(member).type, "down");
assert.equal(down.revive(member), 25);
member.hp = 0;
assert.equal(down.handleZeroHp(member).type, "down");
assert.equal(down.revive(member), 25);
member.hp = 0;
assert.equal(down.handleZeroHp(member).type, "retreat");
assert.equal(down.revive(member), false);
assert.equal(member.retreated, true);
down.resetAfterBattle(member);
assert.equal(member.downCount, 0);
assert.equal(member.retreated, false);

// Party activation, unique ownership, transfer, stat refresh inputs, and save migration.
const party = new PartyManager(state);
party.add("rafel");
const reserve = party.add("anno");
assert.equal(party.getActiveMembers().length, 3);
assert.equal(reserve.active, false, "a fourth roster member becomes reserve");
assert.equal(party.setActive("luke", false).changed, true);
assert.equal(party.setActive("anno", true).changed, true);
assert.equal(party.getActiveMembers().length, 3);
assert.equal(party.getEquipmentOwner("traveler-sword").id, "luke");
const transfer = party.equip("dummy", "traveler-sword", "weapon", EQUIPMENT_DEFINITIONS);
assert.equal(transfer.changed, true);
assert.equal(party.get("luke").equipment.weapon, null);
assert.equal(party.get("dummy").equipment.weapon, "traveler-sword");
assert.equal(party.getEquipmentOwner("traveler-sword").id, "dummy");
assert.equal(state.inventory.find(item => item.id === "traveler-sword")?.quantity || 0, 0);

// Item IDs represent item types: loose copies must be consumed before transferring an equipped copy.
const multiCopyState = createInitialGameState();
multiCopyState.inventory.push({ id: "traveler-sword", quantity: 2 });
const multiCopyParty = new PartyManager(multiCopyState);
assert.equal(multiCopyParty.getEquipmentOwners("traveler-sword").length, 1);
const equipLooseCopy = multiCopyParty.equip("dummy", "traveler-sword", "weapon", EQUIPMENT_DEFINITIONS);
assert.equal(equipLooseCopy.changed, true);
assert.equal(equipLooseCopy.transferredFrom, null, "a loose copy is equipped instead of stealing Luke's sword");
assert.equal(multiCopyParty.get("luke").equipment.weapon, "traveler-sword");
assert.equal(multiCopyParty.get("dummy").equipment.weapon, "traveler-sword");
assert.equal(multiCopyParty.getEquipmentOwners("traveler-sword").length, 2);
assert.equal(multiCopyParty.getLooseInventoryQuantity("traveler-sword"), 1);
multiCopyParty.add("rafel");
const equipSecondLooseCopy = multiCopyParty.equip("rafel", "traveler-sword", "weapon", EQUIPMENT_DEFINITIONS);
assert.equal(equipSecondLooseCopy.changed, true);
assert.equal(multiCopyParty.getEquipmentOwners("traveler-sword").length, 3);
assert.equal(multiCopyParty.getLooseInventoryQuantity("traveler-sword"), 0);
multiCopyParty.add("anno");
const noDuplication = multiCopyParty.equip("anno", "traveler-sword", "weapon", EQUIPMENT_DEFINITIONS, { transfer: false });
assert.equal(noDuplication.changed, false, "no loose copy means transfer must be explicit");
assert.match(noDuplication.reason, /^Equipped · /);

const migratedZeroHp = normalizeGameState({ party: [{ id: "luke", hp: 0, downCount: 2, knownTechniques: ["fireball"] }] });
assert.equal(migratedZeroHp.party[0].hp, 0, "HP 0 remains representable after migration");
assert.equal(migratedZeroHp.party[0].downCount, 2);
assert.deepEqual(migratedZeroHp.party[0].knownTechniques, ["fireball"]);

const values = new Map();
const saves = new SaveManager({ setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) || null });
assert.equal(saves.save("p0", migratedZeroHp), true);
const serialized = JSON.parse(values.get("turn-based-rpg:p0"));
assert.equal("maxHp" in serialized.state.party[0], false, "derived stats are not serialized");
assert.equal(saves.load("p0").party[0].hp, 0);

console.log("P0 core systems: stats, weapons, mastery, techniques, phases, down state, party equipment quantities, and saves passed.");
