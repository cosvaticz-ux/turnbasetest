import {
    EQUIPMENT_DEFINITIONS,
    ITEM_DEFINITIONS
} from "../data/battleContent.js";

import { ITEM_ATLAS_IDS } from "../data/uiIcons.js";

let installed = false;

const DEFAULT_LOADOUT_ASSETS = Object.freeze({
    item: "./assets/images/item/item.png",
    weapon: "./assets/images/item/weapon.png",
    lukeProfile: "./assets/images/character/player/luke/profile/luke-profile.png",
    lucyProfile: "./assets/images/character/player/lucy/profile/lucy-profile.png"
});

const WEAPON_ATLAS_IDS = Object.freeze(
    Object.keys(EQUIPMENT_DEFINITIONS).filter(id => EQUIPMENT_DEFINITIONS[id]?.slot === "weapon")
);

function ensureStylesheet() {
    if (document.querySelector?.('link[data-lx-equipment-polish="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./src/styles/equipmentMenuPolish.css";
    link.dataset.lxEquipmentPolish = "true";
    document.head?.appendChild(link);
}

function allDefinitions() {
    return [
        ...Object.values(EQUIPMENT_DEFINITIONS),
        ...Object.values(ITEM_DEFINITIONS)
    ];
}

function definitionByName(name) {
    if (!name) return null;
    return allDefinitions().find(definition => definition?.name === name) || null;
}

function definitionById(itemId) {
    return EQUIPMENT_DEFINITIONS[itemId] || ITEM_DEFINITIONS[itemId] || null;
}

function itemIdFromCard(card) {
    if (!card) return null;
    if (card.dataset?.itemId) return card.dataset.itemId;
    if (card.dataset?.equipmentItemId) return card.dataset.equipmentItemId;
    if (card.dataset?.lxDragItemId) return card.dataset.lxDragItemId;

    const name = card.querySelector?.("strong")?.textContent?.trim();
    return definitionByName(name)?.id || null;
}

function explicitAssetSource(definition) {
    if (!definition) return null;
    return definition.assetImage
        || definition.assetPath
        || definition.image
        || definition.imageSrc
        || definition.iconImage
        || null;
}

function inferGrid(width, height, count) {
    const safeCount = Math.max(1, Math.floor(Number(count) || 1));
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    let best = { cols: safeCount, rows: 1, score: Number.POSITIVE_INFINITY };

    for (let rows = 1; rows <= safeCount; rows += 1) {
        const cols = Math.ceil(safeCount / rows);
        const unused = cols * rows - safeCount;
        const cellAspect = (safeWidth / cols) / (safeHeight / rows);
        const shapePenalty = Math.abs(Math.log(Math.max(0.0001, cellAspect)));
        const unusedPenalty = unused * 0.18;
        const portraitPenalty = cols < rows ? 0.03 : 0;
        const score = shapePenalty + unusedPenalty + portraitPenalty;
        if (score < best.score) best = { cols, rows, score };
    }

    return { cols: best.cols, rows: best.rows };
}

function resolveAtlasSpec(definition) {
    if (!definition?.id) return null;

    const manual = definition.iconSprite;
    if (manual?.src) {
        return {
            src: manual.src,
            index: Math.max(0, Math.floor(Number(manual.index) || 0)),
            count: Math.max(1, Math.floor(Number(manual.count) || 1)),
            cols: Number(manual.cols) || null,
            rows: Number(manual.rows) || null
        };
    }

    const weaponIndex = WEAPON_ATLAS_IDS.indexOf(definition.id);
    if (weaponIndex >= 0) {
        return {
            src: DEFAULT_LOADOUT_ASSETS.weapon,
            index: weaponIndex,
            count: WEAPON_ATLAS_IDS.length,
            cols: null,
            rows: null
        };
    }

    const itemIndex = ITEM_ATLAS_IDS.indexOf(definition.id);
    if (itemIndex >= 0) {
        return {
            src: DEFAULT_LOADOUT_ASSETS.item,
            index: itemIndex,
            count: ITEM_ATLAS_IDS.length,
            cols: null,
            rows: null
        };
    }

    return null;
}

function createStandaloneImage(frame, source) {
    if (!source) return false;
    const image = document.createElement("img");
    image.className = "lx-item-asset-image";
    image.alt = "";
    image.src = source;
    image.addEventListener("load", () => {
        frame.dataset.hasAsset = "true";
        frame.dataset.assetMode = "image";
    });
    image.addEventListener("error", () => {
        frame.dataset.hasAsset = "false";
        image.remove();
    });
    frame.prepend(image);
    return true;
}

function createAtlasCrop(frame, spec, fallbackSource = null) {
    if (!spec?.src) return false;

    const crop = document.createElement("span");
    crop.className = "lx-item-asset-crop";

    const image = document.createElement("img");
    image.className = "lx-item-asset-sheet";
    image.alt = "";
    image.src = spec.src;

    image.addEventListener("load", () => {
        const inferred = inferGrid(image.naturalWidth, image.naturalHeight, spec.count);
        const cols = Math.max(1, Math.floor(Number(spec.cols) || inferred.cols));
        const rows = Math.max(1, Math.floor(Number(spec.rows) || inferred.rows));
        const capacity = cols * rows;
        const index = Math.max(0, Math.min(Math.floor(Number(spec.index) || 0), capacity - 1));
        const col = index % cols;
        const row = Math.floor(index / cols);

        image.style.width = `${cols * 100}%`;
        image.style.height = `${rows * 100}%`;
        image.style.left = `${col * -100}%`;
        image.style.top = `${row * -100}%`;

        frame.dataset.hasAsset = "true";
        frame.dataset.assetMode = "sprite-crop";
        frame.dataset.spriteIndex = String(index);
        frame.dataset.spriteGrid = `${cols}x${rows}`;
    });

    image.addEventListener("error", () => {
        crop.remove();
        frame.dataset.hasAsset = "false";
        if (fallbackSource && fallbackSource !== spec.src) {
            createStandaloneImage(frame, fallbackSource);
        }
    });

    crop.appendChild(image);
    frame.prepend(crop);
    return true;
}

function getSelectedPartyMember(root, gameManager) {
    const tabs = [...root.querySelectorAll(".map-equipment-party-tab")];
    const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.dataset.selected === "true"));
    const party = gameManager?.globalState?.party || [];
    return party[selectedIndex] || party[0] || null;
}

function getProfileSource(member) {
    if (member?.id === "luke") return DEFAULT_LOADOUT_ASSETS.lukeProfile;
    if (member?.id === "dummy") return DEFAULT_LOADOUT_ASSETS.lucyProfile;
    return null;
}

function decorateCharacterProfile(root, gameManager) {
    const avatar = root.querySelector(".lx-gear-avatar");
    if (!avatar) return;

    const member = getSelectedPartyMember(root, gameManager);
    const profileSource = getProfileSource(member);
    if (!profileSource) {
        delete avatar.dataset.lxProfileAsset;
        return;
    }

    if (avatar.getAttribute("src") !== profileSource) {
        avatar.src = profileSource;
    }
    avatar.dataset.lxProfileAsset = member.id === "dummy" ? "lucy" : member.id;
}

function createAssetFrame(itemId, fallbackGlyph = "◇") {
    const definition = definitionById(itemId);
    const frame = document.createElement("span");
    frame.className = "lx-item-asset-frame";
    frame.dataset.itemId = itemId || "";
    frame.setAttribute("aria-hidden", "true");

    const fallback = document.createElement("span");
    fallback.className = "lx-item-asset-fallback";
    fallback.textContent = definition?.icon || fallbackGlyph || "◇";
    frame.appendChild(fallback);

    const atlas = resolveAtlasSpec(definition);
    const explicit = explicitAssetSource(definition);

    // The supplied weapon.png and item.png are contact sheets. Crop one cell per
    // definition instead of shrinking the entire sheet into every item slot.
    if (atlas) createAtlasCrop(frame, atlas, explicit);
    else if (explicit) createStandaloneImage(frame, explicit);

    return frame;
}

function decorateInventoryCard(card) {
    if (!card || card.dataset.lxAssetVisual === "true") return;
    const itemId = itemIdFromCard(card);
    if (!itemId) return;

    const oldIcon = card.querySelector(":scope > .lx-gear-full-inventory-icon");
    const fallbackGlyph = oldIcon?.textContent?.trim() || "◇";
    const frame = createAssetFrame(itemId, fallbackGlyph);
    frame.classList.add("lx-inventory-asset-frame");

    if (oldIcon) oldIcon.replaceWith(frame);
    else card.prepend(frame);
    card.dataset.lxAssetVisual = "true";
}

function decorateEquipmentOption(card) {
    if (!card || card.dataset.lxAssetVisual === "true") return;
    const itemId = itemIdFromCard(card);
    if (!itemId) return;

    const oldIcon = card.querySelector(":scope > span");
    const fallbackGlyph = oldIcon?.textContent?.trim() || "◇";
    const frame = createAssetFrame(itemId, fallbackGlyph);
    frame.classList.add("lx-equipment-option-asset-frame");

    if (oldIcon) oldIcon.replaceWith(frame);
    else card.prepend(frame);
    card.dataset.lxAssetVisual = "true";
}

function decorateEquipmentSlot(slot) {
    if (!slot) return;
    const itemId = itemIdFromCard(slot);
    const currentId = slot.dataset.lxAssetVisualItem || "";
    if (currentId === (itemId || "")) return;

    slot.querySelector(":scope > .lx-item-asset-frame")?.remove();
    const oldIcon = slot.querySelector(":scope > span:not(.lx-item-asset-frame)");
    const fallbackGlyph = oldIcon?.textContent?.trim() || "◇";

    const frame = createAssetFrame(itemId, fallbackGlyph);
    frame.classList.add("lx-equipment-slot-asset-frame");
    if (oldIcon) oldIcon.replaceWith(frame);
    else slot.prepend(frame);
    slot.dataset.lxAssetVisualItem = itemId || "";
}

function decorate(root, gameManager) {
    root.querySelectorAll(".lx-gear-full-inventory-item").forEach(decorateInventoryCard);
    root.querySelectorAll(".map-equipment-option").forEach(decorateEquipmentOption);
    root.querySelectorAll(".map-equipment-slot").forEach(decorateEquipmentSlot);
    decorateCharacterProfile(root, gameManager);
}

function forceCloseInteractionMenu(event) {
    const action = event.target?.closest?.(".lx-item-interaction-actions button");
    if (!action || action.disabled) return;

    setTimeout(() => {
        const popover = document.querySelector(".lx-item-interaction");
        if (!popover) return;
        popover.hidden = true;
        popover.querySelector(".lx-item-interaction-actions")?.replaceChildren();
    }, 0);
}

export function installEquipmentMenuPolish({ gameManager } = {}) {
    if (installed) return true;
    const root = document.getElementById("map-equipment");
    if (!root) return false;

    installed = true;
    ensureStylesheet();

    const observer = new MutationObserver(() => decorate(root, gameManager));
    observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
            "data-selected",
            "data-item-id",
            "data-equipment-item-id",
            "data-lx-drag-item-id",
            "src"
        ]
    });

    root.addEventListener("click", () => setTimeout(() => decorate(root, gameManager), 0));
    document.addEventListener("click", forceCloseInteractionMenu, false);

    decorate(root, gameManager);
    return true;
}
