import { createContentRegistry, requireContent } from "./contentRegistry.js";
import { WEAPON_DEFINITIONS as P0_WEAPON_DEFINITIONS } from "./weapons.js";
import { UI_ICON_ASSETS } from "./uiIcons.js";

const material = (id, name, description, value) => ({
    id, name, description, value, icon: "◇", category: "material", inventoryType: "etc"
});
const keyItem = (id, name, description) => ({
    id, name, description, value: 0, icon: "◇", category: "key", inventoryType: "etc"
});
const starterItems = [
    {
        id: "bandage", name: "Linen Bandage", description: "Clean linen and salve. Restores 15 HP.",
        icon: "✚", category: "medicine", inventoryType: "usable", fieldUsable: true, battleUsable: true,
        effectType: "heal", healAmount: 15, canRevive: false, apCost: 0, value: 2, shopPrice: 2
    },
    {
        id: "bitter-tonic", name: "Bitter Tonic", description: "A harsh root infusion. Restores 25 HP.",
        icon: "✚", category: "medicine", inventoryType: "usable", fieldUsable: true, battleUsable: true,
        effectType: "heal", healAmount: 25, canRevive: false, apCost: 0, value: 4, shopPrice: 4
    },
    material("wolf-pelt", "Wolf Pelt", "A road wolf's rough winter coat; useful to local tanners.", 4),
    material("boar-hide", "Boar Hide", "Thick hide marked by old bramble scars.", 5),
    material("beast-fang", "Beast Fang", "A sound fang kept as proof of a wilderness hunt.", 2),
    material("slime-residue", "Slime Residue", "Cloudy residue sealed in a stoppered jar.", 1),
    material("grave-dust", "Grave Dust", "Cold dust gathered where the dead will not rest.", 3),
    material("corrupted-shard", "Corrupted Shard", "A dark splinter wrapped in cloth by its wary finder.", 6),
    material("iron-scrap", "Iron Scrap", "Bent nails and broken fittings a smith might salvage.", 2),
    material("medicinal-herb", "Medicinal Herb", "Bitter leaves sought by the town apothecary.", 1),
    keyItem("guild-contract-token", "Guild Contract Token", "A stamped token identifying the bearer as a local contractor."),
    keyItem("stolen-ledger", "Stolen Ledger", "A carter's accounts, stained by rain and hurried handling."),
    keyItem("bloodstained-pendant", "Bloodstained Pendant", "A modest pendant bearing an old regimental mark.")
];

const ITEM_DEFINITIONS_ENTRIES = [
    Object.freeze({
        id: "healing-draught",
        name: "Healing Draught",
        icon: "✚",
        iconImage: UI_ICON_ASSETS.itemPotion,
        category: "medicine",
        inventoryType: "usable",
        description: "A bitter restorative. Restores 35 HP.",
        fieldUsable: true,
        battleUsable: true,
        effectType: "heal",
        canRevive: true,
        apCost: 0,
        healAmount: 35,
        value: 5,
        shopPrice: 5
    }),
    Object.freeze({
        id: "greater-healing-draught",
        name: "Greater Healing Draught",
        icon: "✚",
        iconImage: UI_ICON_ASSETS.itemPotion,
        category: "medicine",
        inventoryType: "usable",
        description: "A concentrated restorative. Restores 60 HP.",
        fieldUsable: true,
        battleUsable: true,
        effectType: "heal",
        canRevive: true,
        apCost: 0,
        healAmount: 60,
        value: 10,
        shopPrice: 10
    }),
    Object.freeze({
        id: "antidote",
        name: "Antidote",
        icon: "◇",
        iconImage: UI_ICON_ASSETS.itemAntidote,
        category: "medicine",
        inventoryType: "usable",
        description: "A sharp herbal remedy that removes Poison.",
        fieldUsable: true,
        battleUsable: true,
        effectType: "cure-status",
        curesStatus: "poison",
        apCost: 0,
        value: 4,
        shopPrice: 4
    }),
    Object.freeze({
        id: "coarse-salt", name: "Coarse Salt", icon: "◇", category: "material",
        inventoryType: "usable", description: "Prepare a Ghoul by exposing its hide to fire.",
        fieldUsable: false, battleUsable: true, prepareOnly: true,
        prepareActionId: "scatter-salt",
        effectType: "apply-enemy-status", statusEffectId: "salt-exposed", apCost: 0, value: 1
    })
];

export const EQUIPMENT_SLOT_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "head", label: "Head", icon: "◌" }),
    Object.freeze({ id: "body", label: "Body", icon: "▣" }),
    Object.freeze({ id: "lower", label: "Lower Body", icon: "▤" }),
    Object.freeze({ id: "shoes", label: "Shoes", icon: "◇" }),
    Object.freeze({ id: "weapon", label: "Weapon", icon: "⚔" }),
    Object.freeze({ id: "shield", label: "Shield", icon: "◇" })
]);

const EQUIPMENT_DEFINITIONS_ENTRIES = [
    Object.freeze({ id: "wooden-shield", name: "Wooden Shield", icon: "◇", category: "equipment", inventoryType: "equipment", slot: "shield", description: "A practical shield. Shield techniques require a one-hand weapon.", value: 8 }),
    Object.freeze({
        id: "plain-shirt",
        name: "Plain Shirt",
        icon: "▣",
        category: "equipment",
        inventoryType: "equipment",
        slot: "body",
        description: "A simple everyday shirt. It offers no special protection yet.",
        value: 1
    }),
    Object.freeze({
        id: "plain-cloth",
        name: "Plain Cloth",
        icon: "▤",
        category: "equipment",
        inventoryType: "equipment",
        slot: "lower",
        description: "A plain lower-body cloth worn for travel and daily work.",
        value: 1
    }),
    ...Object.values(P0_WEAPON_DEFINITIONS)
];

// Compatibility views share the same frozen records; weapons retain their existing canonical home.
export const ITEM_DEFINITIONS = createContentRegistry([...ITEM_DEFINITIONS_ENTRIES, ...starterItems], "item");
export const EQUIPMENT_DEFINITIONS = createContentRegistry(EQUIPMENT_DEFINITIONS_ENTRIES, "equipment");
export const ITEM_DATABASE = createContentRegistry([...Object.values(ITEM_DEFINITIONS), ...Object.values(EQUIPMENT_DEFINITIONS)], "item");
export const getItemDefinition = id => requireContent(ITEM_DATABASE, id, "item");
export const listItemsByType = type => Object.values(ITEM_DATABASE).filter(item => (item.type || item.category) === type);
