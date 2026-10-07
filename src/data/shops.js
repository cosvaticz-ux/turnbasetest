import { createContentRegistry, requireContent } from "./contentRegistry.js";

export const SHOP_DEFINITIONS = createContentRegistry([{
    id: "iven", name: "Apothecary Iven", npcId: "potion-merchant", mapNodeId: "town-south",
    itemIds: ["healing-draught", "greater-healing-draught", "antidote", "bandage", "bitter-tonic"]
}], "shop");
export const getShopDefinition = id => requireContent(SHOP_DEFINITIONS, id, "shop");
