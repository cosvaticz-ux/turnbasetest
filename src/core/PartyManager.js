const DEFAULT_EQUIPMENT = Object.freeze({
    head: null,
    body: null,
    lower: null,
    shoes: null,
    weapon: null,
    shield: null
});

export const PARTY_SIZE_LIMITS = Object.freeze({ min: 1, max: 3 });

export const PARTY_MEMBER_DEFINITIONS = Object.freeze({
    luke: Object.freeze({
        id: "luke", name: "Luke", maxHp: 100, attack: 20, defense: 5, speed: 10, maxAp: 3,
        knownTechniques: Object.freeze(["fireball", "ice-pike", "poison"]), mastery: Object.freeze({ unarmed: 1, sword: 0 }),
        equipment: Object.freeze({ ...DEFAULT_EQUIPMENT, body: "plain-shirt", lower: "plain-cloth", weapon: "traveler-sword" })
    }),
    dummy: Object.freeze({
        id: "dummy", name: "Lucy", maxHp: 100, attack: 18, defense: 5, speed: 9, maxAp: 3,
        knownTechniques: Object.freeze(["double-strike", "bash", "heal"]), mastery: Object.freeze({ unarmed: 1 })
    }),
    rafel: Object.freeze({
        id: "rafel", name: "Rafel", maxHp: 100, attack: 20, defense: 5, speed: 10, maxAp: 3,
        knownTechniques: Object.freeze(["fireball"]), mastery: Object.freeze({ structuredMagic: 1, unarmed: 1 })
    }),
    anno: Object.freeze({
        id: "anno", name: "Crescent Anno", maxHp: 92, attack: 21, defense: 4, speed: 12, maxAp: 3,
        knownTechniques: Object.freeze(["ice-pike", "bash"]), mastery: Object.freeze({ blade: 1 })
    }),
    gram: Object.freeze({
        id: "gram", name: "Gram de Crescent", maxHp: 86, attack: 17, defense: 4, speed: 9, maxAp: 3,
        knownTechniques: Object.freeze(["poison", "heal"]), mastery: Object.freeze({ mixedMagic: 1 })
    })
});

export function createPartyMemberState(memberId, overrides = {}) {
    const definition = PARTY_MEMBER_DEFINITIONS[memberId];
    if (!definition) return null;
    const classState = normalizeClassState(overrides);
    const maxHp = Math.max(1, Number.isFinite(Number(overrides.maxHp)) ? Number(overrides.maxHp) : definition.maxHp + getClassStatModifiers({ ...overrides, classState },definition).maxHp);
    const hp = Number.isFinite(Number(overrides.hp)) ? Number(overrides.hp) : maxHp;
    const requestedName = typeof overrides.name === "string" ? overrides.name.trim() : "";
    const name = memberId === "dummy" && (!requestedName || requestedName === "Dummy")
        ? definition.name
        : requestedName || definition.name;
    return {
        id: definition.id,
        name,
        active: overrides.active !== false,
        hp: Math.max(0, Math.min(maxHp, hp)),
        maxHp,
        downCount: Math.max(0, Math.floor(Number(overrides.downCount) || 0)),
        isDown: overrides.isDown === true || hp <= 0,
        retreated: overrides.retreated === true,
        poisonTurns: Math.max(0, Math.floor(Number(overrides.poisonTurns) || 0)),
        poisonDamage: Math.max(0, Math.floor(Number(overrides.poisonDamage) || 0)),
        knownTechniques: [...new Set(Array.isArray(overrides.knownTechniques)
            ? overrides.knownTechniques.filter(Boolean)
            : definition.knownTechniques)],
        mastery: { ...definition.mastery, ...(overrides.mastery || {}) },
        equipment: { ...DEFAULT_EQUIPMENT, ...(definition.equipment || {}), ...(overrides.equipment || {}) },
        progression: normalizeCharacterProgression(overrides),
        classState: normalizeClassState(overrides)
    };
}

export class PartyManager {
    constructor(gameState) {
        if (!gameState || typeof gameState !== "object") throw new TypeError("PartyManager requires game state.");
        this.gameState = gameState;
        if (!Array.isArray(this.gameState.party)) this.gameState.party = [];
    }

    get(memberId) {
        return this.gameState.party.find(member => member?.id === memberId) || null;
    }

    add(memberId, overrides = {}) {
        const existing = this.get(memberId);
        if (existing) {
            const wantsActive = overrides.active !== false;
            const { active: _requestedActive, ...safeOverrides } = overrides;
            Object.assign(existing, safeOverrides, { id: memberId });
            this.setActive(memberId, wantsActive);
            return existing;
        }
        const member = createPartyMemberState(memberId, overrides);
        if (!member) return null;
        if (member.active !== false && this.getActiveMembers().length >= PARTY_SIZE_LIMITS.max) member.active = false;
        this.gameState.party.push(member);
        return member;
    }

    remove(memberId, { preserveState = true } = {}) {
        const member = this.get(memberId);
        if (!member) return false;
        if (preserveState) {
            const result = this.setActive(memberId, false);
            if (!result.changed) return false;
        }
        else this.gameState.party = this.gameState.party.filter(entry => entry !== member);
        return true;
    }

    getActiveMembers() {
        return this.gameState.party.filter(member => member?.id && member.active !== false).slice(0, PARTY_SIZE_LIMITS.max);
    }

    setActive(memberId, active) {
        const member = this.get(memberId);
        if (!member) return { changed: false, reason: "Unknown party member" };
        const activeMembers = this.getActiveMembers();
        if (active && member.active === false && activeMembers.length >= PARTY_SIZE_LIMITS.max) {
            return { changed: false, reason: `Party is limited to ${PARTY_SIZE_LIMITS.max} active members` };
        }
        if (!active && member.active !== false && activeMembers.length <= PARTY_SIZE_LIMITS.min) {
            return { changed: false, reason: "At least one party member must remain active" };
        }
        member.active = Boolean(active);
        return { changed: true, member };
    }

    getEquipmentOwners(itemId) {
        if (!itemId) return [];
        return this.gameState.party.filter(member => Object.values(member?.equipment || {}).includes(itemId));
    }

    getEquipmentOwner(itemId) {
        return this.getEquipmentOwners(itemId)[0] || null;
    }

    getLooseInventoryQuantity(itemId) {
        const item = this.gameState.inventory?.find(entry => entry?.id === itemId);
        return Math.max(0, Math.floor(Number(item?.quantity) || 0));
    }

    canEquip(memberId, itemId, slotId, definitions = {}) {
        const member = this.get(memberId);
        const definition = definitions[itemId];
        if (!member) return { allowed: false, reason: "Unknown party member" };
        if (!definition || definition.slot !== slotId) return { allowed: false, reason: "Incompatible equipment slot" };
        if (member.equipment?.[slotId] === itemId) {
            return { allowed: false, reason: `${definition.name} is already equipped`, member, definition };
        }

        const owners = this.getEquipmentOwners(itemId);
        const looseQuantity = this.getLooseInventoryQuantity(itemId);
        if (looseQuantity <= 0 && owners.length === 0) return { allowed: false, reason: "Item is not owned" };
        return {
            allowed: true,
            owner: owners.find(owner => owner.id !== memberId) || owners[0] || null,
            owners,
            looseQuantity,
            definition,
            member
        };
    }

    equip(memberId, itemId, slotId, definitions = {}, { transfer = true } = {}) {
        const check = this.canEquip(memberId, itemId, slotId, definitions);
        if (!check.allowed) return { changed: false, reason: check.reason };
        const { member, definition, looseQuantity, owners } = check;
        const transferOwner = owners.find(owner => owner.id !== memberId) || null;

        if (looseQuantity <= 0 && transferOwner && !transfer) {
            return { changed: false, reason: `Equipped · ${transferOwner.name || transferOwner.id}` };
        }

        if (!member.equipment) member.equipment = { ...DEFAULT_EQUIPMENT };
        const previousItemId = member.equipment[slotId] || null;
        let transferredFrom = null;

        if (looseQuantity > 0) {
            const inventoryItem = this.gameState.inventory.find(item => item?.id === itemId);
            inventoryItem.quantity = Math.max(0, Number(inventoryItem.quantity) - 1);
        } else if (transferOwner) {
            const transferSlotId = Object.keys(transferOwner.equipment || {})
                .find(equipmentSlotId => transferOwner.equipment[equipmentSlotId] === itemId);
            if (transferSlotId) transferOwner.equipment[transferSlotId] = null;
            transferredFrom = transferOwner;
        } else {
            return { changed: false, reason: "Item is not available to equip" };
        }

        if (previousItemId && previousItemId !== itemId) this.addInventory(previousItemId, 1);
        member.equipment[slotId] = itemId;
        return { changed: true, member, previousItemId, transferredFrom };
    }

    unequip(memberId, slotId) {
        const member = this.get(memberId);
        const itemId = member?.equipment?.[slotId];
        if (!member || !itemId) return { changed: false, reason: "Equipment slot is empty" };
        member.equipment[slotId] = null;
        this.addInventory(itemId, 1);
        return { changed: true, member, itemId };
    }

    addInventory(itemId, quantity = 1) {
        if (!Array.isArray(this.gameState.inventory)) this.gameState.inventory = [];
        const item = this.gameState.inventory.find(entry => entry?.id === itemId);
        if (item) item.quantity = Math.max(0, Number(item.quantity) || 0) + quantity;
        else this.gameState.inventory.push({ id: itemId, quantity });
        return true;
    }

    knowsTechnique(memberId, techniqueId) {
        return this.get(memberId)?.knownTechniques?.includes(techniqueId) === true;
    }

    learnTechnique(memberId, techniqueId) {
        const member = this.get(memberId);
        if (!member || !techniqueId) return false;
        if (!Array.isArray(member.knownTechniques)) member.knownTechniques = [];
        if (member.knownTechniques.includes(techniqueId)) return false;
        member.knownTechniques.push(techniqueId);
        return true;
    }
}
import { normalizeCharacterProgression } from "./Progression.js";
import { normalizeClassState, getClassStatModifiers } from "./ClassSystem.js";
