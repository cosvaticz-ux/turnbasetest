import { AssetResolver } from "../core/AssetResolver.js";
import { StatResolver } from "../core/StatResolver.js";
import {
    CHARACTER_DEFINITIONS,
    EQUIPMENT_DEFINITIONS,
    ITEM_DEFINITIONS
} from "../data/battleContent.js";
import { getEquippedWeapon } from "../data/weapons.js";

let installed = false;

function ensureStylesheet() {
    if (document.querySelector?.('link[data-lx-equipment-skin="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./src/styles/equipmentMenu.css";
    link.dataset.lxEquipmentSkin = "true";
    document.head?.appendChild(link);
}

function dispatchMapKey(key, code = key) {
    const event = new KeyboardEvent("keydown", {
        key,
        code,
        bubbles: true,
        cancelable: true
    });
    document.dispatchEvent(event);
}

function definitionByName(name) {
    return Object.values(EQUIPMENT_DEFINITIONS).find(definition => definition?.name === name) || null;
}

function definitionById(itemId) {
    return EQUIPMENT_DEFINITIONS[itemId] || ITEM_DEFINITIONS[itemId] || null;
}

function itemIdFromButton(button) {
    if (!button) return null;
    if (button.dataset?.equipmentItemId) return button.dataset.equipmentItemId;
    const name = button.querySelector?.("strong")?.textContent?.trim();
    const definition = definitionByName(name);
    if (definition) button.dataset.equipmentItemId = definition.id;
    return definition?.id || null;
}

function getSelectedPartyIndex(partyTabs) {
    const tabs = [...(partyTabs?.children || [])];
    const selected = tabs.findIndex(tab => tab?.dataset?.selected === "true");
    return selected >= 0 ? selected : 0;
}

function findSlotButton(slots, slotId) {
    return [...(slots?.querySelectorAll?.(".map-equipment-slot") || [])]
        .find(button => button.dataset?.slotId === slotId) || null;
}

function findOptionButton(options, itemId) {
    return [...(options?.querySelectorAll?.(".map-equipment-option") || [])]
        .find(button => itemIdFromButton(button) === itemId) || null;
}

function getSlotItemId(slotButton) {
    const name = slotButton?.querySelector?.("strong")?.textContent?.trim();
    if (!name || name === "Empty") return null;
    return definitionByName(name)?.id || null;
}

function getPartyMember(gameManager, index) {
    const roster = gameManager?.globalState?.party || [];
    return roster[Math.max(0, Math.min(index, Math.max(0, roster.length - 1)))] || null;
}

function resolveAvatarSource(member) {
    const definition = CHARACTER_DEFINITIONS[member?.id] || CHARACTER_DEFINITIONS.luke;
    if (!definition) return null;
    const assetId = definition.assetId || definition.id;
    const animation = definition.animations?.idle || { id: "idle" };
    if (animation.spriteSheet) return AssetResolver.playerProfile(assetId);
    return AssetResolver.playerFrame(assetId, animation.id || "idle", 1);
}

function createTopNav(root) {
    const header = root.querySelector(":scope > header");
    if (!header) return null;
    const existing = header.querySelector(".lx-gear-nav");
    if (existing) return existing;

    const nav = document.createElement("nav");
    nav.className = "lx-gear-nav";
    nav.setAttribute("aria-label", "Character menu sections");

    const loadout = document.createElement("button");
    loadout.type = "button";
    loadout.textContent = "Party & Equipment";
    loadout.dataset.lxViewTarget = "equipment";
    loadout.dataset.selected = "true";

    const inventory = document.createElement("button");
    inventory.type = "button";
    inventory.textContent = "Inventory";
    inventory.dataset.lxViewTarget = "inventory";

    nav.append(loadout, inventory);
    const close = header.querySelector("#map-equipment-close");
    header.insertBefore(nav, close || null);
    return nav;
}

function createStatusPanel() {
    const panel = document.createElement("aside");
    panel.className = "lx-gear-status-panel";
    panel.setAttribute("aria-label", "Selected party member status");

    const title = document.createElement("div");
    title.className = "lx-gear-status-title";
    title.textContent = "Status";

    const rows = document.createElement("div");
    rows.className = "lx-gear-status-rows";
    panel.append(title, rows);
    return { panel, rows };
}

function createInlineInventoryPane() {
    const pane = document.createElement("section");
    pane.className = "lx-gear-full-inventory";
    pane.hidden = true;

    const header = document.createElement("header");
    const heading = document.createElement("div");
    const kicker = document.createElement("span");
    kicker.textContent = "Field Pack";
    const title = document.createElement("h3");
    title.textContent = "Inventory";
    heading.append(kicker, title);

    const count = document.createElement("small");
    count.className = "lx-gear-inventory-count";
    header.append(heading, count);

    const filters = document.createElement("nav");
    filters.className = "lx-gear-inventory-filters";
    filters.setAttribute("aria-label", "Inventory filters");
    for (const [id, label] of [["all", "All"], ["equipment", "Gear"], ["usable", "Items"], ["etc", "ETC"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.lxInventoryFilter = id;
        button.dataset.selected = String(id === "all");
        button.textContent = label;
        filters.appendChild(button);
    }

    const grid = document.createElement("div");
    grid.className = "lx-gear-full-inventory-grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-label", "Inventory items");

    const detail = document.createElement("article");
    detail.className = "lx-gear-full-inventory-detail";
    const category = document.createElement("span");
    category.className = "lx-gear-full-inventory-category";
    const name = document.createElement("h4");
    name.textContent = "No item selected";
    const description = document.createElement("p");
    description.textContent = "Select an item to inspect it.";
    const ownership = document.createElement("strong");
    ownership.className = "lx-gear-full-inventory-ownership";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "lx-gear-full-inventory-action";
    action.hidden = true;
    detail.append(category, name, description, ownership, action);

    pane.append(header, filters, grid, detail);
    return { pane, count, filters, grid, detail, category, name, description, ownership, action };
}

function composeLayout(root) {
    const partyTabs = root.querySelector("#map-equipment-party-tabs");
    const oldLayout = root.querySelector(".map-equipment-layout");
    const slotsPanel = oldLayout?.querySelector(":scope > section");
    const detail = oldLayout?.querySelector(".map-equipment-detail");
    const memberBar = detail?.querySelector(".map-equipment-member-bar");
    if (!partyTabs || !oldLayout || !slotsPanel || !detail) return null;

    const shell = document.createElement("div");
    shell.className = "lx-gear-shell";

    const party = document.createElement("aside");
    party.className = "lx-gear-party";
    party.setAttribute("aria-label", "Party roster");
    const partyTitle = document.createElement("h3");
    partyTitle.className = "lx-gear-section-title";
    partyTitle.textContent = "Party";
    party.append(partyTitle, partyTabs);

    const center = document.createElement("section");
    center.className = "lx-gear-center";
    center.setAttribute("aria-label", "Selected party member equipment");

    const identity = document.createElement("div");
    identity.className = "lx-gear-identity";
    const identityName = document.createElement("strong");
    identityName.textContent = "Party Member";
    const identityMeta = document.createElement("span");
    identityMeta.textContent = "Active · Loadout";
    identity.append(identityName, identityMeta);

    const status = createStatusPanel();

    const avatarStage = document.createElement("div");
    avatarStage.className = "lx-gear-avatar-stage";
    const avatar = document.createElement("img");
    avatar.className = "lx-gear-avatar";
    avatar.alt = "";
    avatar.addEventListener("error", () => avatar.classList.add("is-missing"));
    avatar.addEventListener("load", () => avatar.classList.remove("is-missing"));
    avatarStage.appendChild(avatar);

    slotsPanel.classList.add("lx-gear-slots-panel");
    center.append(identity, status.panel, avatarStage, slotsPanel);

    detail.classList.add("lx-gear-inventory");
    const equipmentPane = document.createElement("div");
    equipmentPane.className = "lx-gear-equipment-pane";
    while (detail.firstChild) equipmentPane.appendChild(detail.firstChild);

    if (memberBar) {
        memberBar.classList.add("lx-gear-member-controls");
        party.appendChild(memberBar);
    }

    const dropzone = document.createElement("div");
    dropzone.className = "lx-gear-dropzone";
    dropzone.textContent = "Drop equipped item here to unequip";
    dropzone.setAttribute("aria-label", "Drop equipped item here to unequip");
    equipmentPane.appendChild(dropzone);

    const inventoryPane = createInlineInventoryPane();
    detail.append(equipmentPane, inventoryPane.pane);

    shell.append(party, center, detail);
    oldLayout.replaceWith(shell);

    return {
        shell,
        partyTabs,
        slots: root.querySelector("#map-equipment-slots"),
        options: root.querySelector("#map-equipment-options"),
        unequip: root.querySelector("#map-equipment-unequip"),
        dropzone,
        avatar,
        identityName,
        identityMeta,
        statusRows: status.rows,
        equipmentPane,
        inventoryPane
    };
}

function getOwnedInventoryEntries(gameManager) {
    const state = gameManager?.globalState;
    if (!state) return [];
    const byId = new Map();

    for (const entry of state.inventory || []) {
        const quantity = Math.max(0, Math.floor(Number(entry?.quantity) || 0));
        if (!entry?.id || quantity <= 0) continue;
        const definition = definitionById(entry.id);
        byId.set(entry.id, {
            id: entry.id,
            definition,
            looseQuantity: quantity,
            owners: []
        });
    }

    for (const member of state.party || []) {
        for (const itemId of Object.values(member?.equipment || {})) {
            if (!itemId) continue;
            const existing = byId.get(itemId) || {
                id: itemId,
                definition: definitionById(itemId),
                looseQuantity: 0,
                owners: []
            };
            existing.owners.push(member);
            byId.set(itemId, existing);
        }
    }

    return [...byId.values()].sort((a, b) => {
        const aType = a.definition?.inventoryType || a.definition?.category || "etc";
        const bType = b.definition?.inventoryType || b.definition?.category || "etc";
        if (aType !== bType) return aType.localeCompare(bType);
        return String(a.definition?.name || a.id).localeCompare(String(b.definition?.name || b.id));
    });
}

function inventoryTypeOf(entry) {
    const raw = entry?.definition?.inventoryType || entry?.definition?.category || "etc";
    if (raw === "equipment") return "equipment";
    if (raw === "usable" || raw === "medicine") return "usable";
    return "etc";
}

function ownershipLabel(entry) {
    const ownerNames = (entry?.owners || []).map(owner => owner?.name || owner?.id).filter(Boolean);
    const loose = Math.max(0, Number(entry?.looseQuantity) || 0);
    if (ownerNames.length && loose > 0) return `×${loose} · Equipped · ${ownerNames.join(", ")}`;
    if (ownerNames.length) return `Equipped · ${ownerNames.join(", ")}`;
    return `Quantity · ${loose}`;
}

export function installEquipmentMenuSkin({ gameManager } = {}) {
    if (installed) return true;
    const root = document.getElementById("map-equipment");
    if (!root) return false;

    ensureStylesheet();
    root.classList.add("lx-gear-menu");
    root.dataset.lxView = "equipment";
    const nav = createTopNav(root);
    const ui = composeLayout(root);
    if (!ui || !nav) return false;

    installed = true;
    let dragState = null;
    let inventoryFilter = "all";
    let selectedInventoryItemId = null;

    function currentMember() {
        return getPartyMember(gameManager, getSelectedPartyIndex(ui.partyTabs));
    }

    function resolveMemberStatus(member) {
        const definition = CHARACTER_DEFINITIONS[member?.id] || {};
        const baseStats = {
            maxHp: definition.maxHp,
            attack: definition.attack,
            defense: definition.defense,
            speed: definition.speed,
            maxAp: definition.maxAp
        };
        const stats = new StatResolver({ equipmentDefinitions: EQUIPMENT_DEFINITIONS }).resolve({
            baseStats,
            equipment: member?.equipment,
            statusEffects: member?.statusEffects
        });
        const weapon = getEquippedWeapon(member?.equipment);
        const mastery = Math.max(0, Number(member?.mastery?.[weapon.masteryDiscipline]) || 0);
        return { stats, baseStats, weapon, mastery };
    }

    function renderStatus(member) {
        if (!ui.statusRows) return;
        if (!member) {
            ui.statusRows.replaceChildren();
            return;
        }
        const { stats, baseStats, weapon, mastery } = resolveMemberStatus(member);
        const level = Math.max(1, Number(gameManager?.globalState?.story?.level) || 1);
        const rows = [
            ["LEVEL", String(level), ""],
            ["HP", `${Math.max(0, Number(member.hp) || 0)} / ${stats.maxHp}`, ""],
            ["ATK", stats.attack, stats.attack - (Number(baseStats.attack) || 0)],
            ["DEF", stats.defense, stats.defense - (Number(baseStats.defense) || 0)],
            ["SPD", stats.speed, stats.speed - (Number(baseStats.speed) || 0)],
            ["AP", stats.maxAp, stats.maxAp - (Number(baseStats.maxAp) || 0)],
            ["DOWNS", Math.max(0, Number(member.downCount) || 0), ""],
            [weapon.masteryDiscipline?.toUpperCase?.() || "MASTERY", mastery, ""]
        ];
        ui.statusRows.replaceChildren(...rows.map(([label, value, delta]) => {
            const row = document.createElement("div");
            const name = document.createElement("span");
            name.textContent = label;
            const amount = document.createElement("strong");
            amount.textContent = String(value);
            const bonus = document.createElement("em");
            const numericDelta = Number(delta) || 0;
            bonus.textContent = numericDelta ? `${numericDelta > 0 ? "+" : ""}${numericDelta}` : "";
            row.append(name, amount, bonus);
            return row;
        }));
    }

    function updateIdentity() {
        const member = currentMember();
        ui.identityName.textContent = member?.name || member?.id || "Party Member";
        const level = Math.max(1, Number(gameManager?.globalState?.story?.level) || 1);
        ui.identityMeta.textContent = `${member?.active !== false ? "Active Party" : "Reserve"} · Lv. ${level}`;
        const source = resolveAvatarSource(member);
        if (source && ui.avatar.getAttribute("src") !== source) ui.avatar.src = source;
        ui.avatar.alt = member ? `${member.name || member.id} equipment preview` : "";
        renderStatus(member);
    }

    function setView(view) {
        const next = view === "inventory" ? "inventory" : "equipment";
        root.dataset.lxView = next;
        for (const button of nav.querySelectorAll("[data-lx-view-target]")) {
            button.dataset.selected = String(button.dataset.lxViewTarget === next);
        }
        ui.equipmentPane.hidden = next !== "equipment";
        ui.inventoryPane.pane.hidden = next !== "inventory";
        if (next === "inventory") renderFullInventory();
        updateIdentity();
    }

    function clearDragPresentation() {
        root.querySelectorAll(".lx-drop-target, .lx-drop-invalid").forEach(node => {
            node.classList.remove("lx-drop-target", "lx-drop-invalid");
        });
        dragState = null;
    }

    function beginDrag(event, itemId, source = {}) {
        const definition = EQUIPMENT_DEFINITIONS[itemId];
        if (!definition) return;
        dragState = {
            itemId,
            slotId: definition.slot,
            sourcePartyIndex: getSelectedPartyIndex(ui.partyTabs),
            ...source
        };
        event.dataTransfer?.setData("text/plain", itemId);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        root.querySelectorAll(".map-equipment-slot").forEach(slot => {
            slot.classList.toggle("lx-drop-invalid", slot.dataset.slotId !== definition.slot);
        });
    }

    function equipIntoSlot(itemId, slotButton) {
        const definition = EQUIPMENT_DEFINITIONS[itemId];
        if (!definition || !slotButton || slotButton.dataset.slotId !== definition.slot) return false;
        slotButton.click();
        setTimeout(() => {
            decorateDynamicNodes();
            const option = findOptionButton(ui.options, itemId);
            option?.click();
            setTimeout(() => {
                decorateDynamicNodes();
                renderFullInventory();
            }, 0);
        }, 0);
        return true;
    }

    function equipToParty(itemId, partyButton) {
        const definition = EQUIPMENT_DEFINITIONS[itemId];
        if (!definition || !partyButton) return false;
        partyButton.click();
        setTimeout(() => {
            const slot = findSlotButton(ui.slots, definition.slot);
            if (!slot) return;
            equipIntoSlot(itemId, slot);
        }, 0);
        return true;
    }

    function unequipDraggedSlot() {
        if (!dragState?.fromEquippedSlot) return false;
        const partyButton = ui.partyTabs.children?.[dragState.sourcePartyIndex];
        partyButton?.click?.();
        setTimeout(() => {
            const slot = findSlotButton(ui.slots, dragState.sourceSlotId);
            slot?.click?.();
            setTimeout(() => {
                ui.unequip?.click?.();
                setTimeout(() => {
                    decorateDynamicNodes();
                    renderFullInventory();
                }, 0);
            }, 0);
        }, 0);
        return true;
    }

    function selectInventoryItem(itemId) {
        selectedInventoryItemId = itemId;
        renderFullInventory();
    }

    function renderInventoryDetail(entries) {
        const selected = entries.find(entry => entry.id === selectedInventoryItemId) || entries[0] || null;
        if (selected && selectedInventoryItemId !== selected.id) selectedInventoryItemId = selected.id;
        const definition = selected?.definition;
        ui.inventoryPane.category.textContent = definition
            ? `${inventoryTypeOf(selected).toUpperCase()}${definition.slot ? ` · ${definition.slot.toUpperCase()}` : ""}`
            : "";
        ui.inventoryPane.name.textContent = definition?.name || selected?.id || "No item selected";
        ui.inventoryPane.description.textContent = definition?.description || "Select an item to inspect it.";
        ui.inventoryPane.ownership.textContent = selected ? ownershipLabel(selected) : "";

        const action = ui.inventoryPane.action;
        const member = currentMember();
        const equipment = selected ? EQUIPMENT_DEFINITIONS[selected.id] : null;
        if (!equipment || !member) {
            action.hidden = true;
            action.onclick = null;
            return;
        }

        const slot = findSlotButton(ui.slots, equipment.slot);
        const alreadyEquipped = member.equipment?.[equipment.slot] === equipment.id;
        action.hidden = false;
        action.disabled = alreadyEquipped;
        action.textContent = alreadyEquipped ? `Equipped by ${member.name || member.id}` : `Equip to ${equipment.slot}`;
        action.onclick = () => {
            if (alreadyEquipped || !slot) return;
            equipIntoSlot(equipment.id, slot);
        };
    }

    function renderFullInventory() {
        const allEntries = getOwnedInventoryEntries(gameManager);
        const entries = inventoryFilter === "all"
            ? allEntries
            : allEntries.filter(entry => inventoryTypeOf(entry) === inventoryFilter);
        const totalLoose = allEntries.reduce((sum, entry) => sum + Math.max(0, Number(entry.looseQuantity) || 0), 0);
        const totalEquipped = allEntries.reduce((sum, entry) => sum + (entry.owners?.length || 0), 0);
        ui.inventoryPane.count.textContent = `${totalLoose} packed · ${totalEquipped} equipped`;

        for (const button of ui.inventoryPane.filters.querySelectorAll("[data-lx-inventory-filter]")) {
            button.dataset.selected = String(button.dataset.lxInventoryFilter === inventoryFilter);
        }

        const nodes = entries.map(entry => {
            const definition = entry.definition;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "lx-gear-full-inventory-item";
            button.dataset.selected = String(entry.id === selectedInventoryItemId);
            button.dataset.itemId = entry.id;
            button.setAttribute("role", "option");
            button.setAttribute("aria-selected", String(entry.id === selectedInventoryItemId));

            const icon = document.createElement("span");
            icon.className = "lx-gear-full-inventory-icon";
            icon.textContent = definition?.icon || (EQUIPMENT_DEFINITIONS[entry.id] ? "◇" : "·");
            const label = document.createElement("strong");
            label.textContent = definition?.name || entry.id;
            const state = document.createElement("small");
            state.textContent = ownershipLabel(entry);
            button.append(icon, label, state);
            button.addEventListener("click", () => selectInventoryItem(entry.id));

            if (EQUIPMENT_DEFINITIONS[entry.id]) {
                button.draggable = true;
                button.addEventListener("dragstart", event => beginDrag(event, entry.id, { fromInlineInventory: true }));
                button.addEventListener("dragend", clearDragPresentation);
            }
            return button;
        });

        if (!nodes.length) {
            const empty = document.createElement("p");
            empty.className = "lx-gear-full-inventory-empty";
            empty.textContent = "No items in this category.";
            nodes.push(empty);
        }
        ui.inventoryPane.grid.replaceChildren(...nodes);
        renderInventoryDetail(entries);
    }

    function decorateDynamicNodes() {
        [...(ui.options?.querySelectorAll?.(".map-equipment-option") || [])].forEach(button => {
            const itemId = itemIdFromButton(button);
            if (!itemId || button.dataset.lxDragBound === "true") return;
            button.dataset.lxDragBound = "true";
            button.draggable = true;
            button.addEventListener("dragstart", event => beginDrag(event, itemId, { fromOption: true }));
            button.addEventListener("dragend", clearDragPresentation);
        });

        [...(ui.slots?.querySelectorAll?.(".map-equipment-slot") || [])].forEach(slot => {
            if (slot.dataset.lxDropBound !== "true") {
                slot.dataset.lxDropBound = "true";
                slot.addEventListener("dragover", event => {
                    if (!dragState || dragState.slotId !== slot.dataset.slotId) return;
                    event.preventDefault();
                    slot.classList.add("lx-drop-target");
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                });
                slot.addEventListener("dragleave", () => slot.classList.remove("lx-drop-target"));
                slot.addEventListener("drop", event => {
                    event.preventDefault();
                    const itemId = dragState?.itemId || event.dataTransfer?.getData("text/plain");
                    if (itemId) equipIntoSlot(itemId, slot);
                    clearDragPresentation();
                });
            }

            const itemId = getSlotItemId(slot);
            slot.draggable = Boolean(itemId);
            if (itemId) slot.dataset.lxDragItemId = itemId;
            else delete slot.dataset.lxDragItemId;
            if (slot.dataset.lxSlotDragBound !== "true") {
                slot.dataset.lxSlotDragBound = "true";
                slot.addEventListener("dragstart", event => {
                    const currentItemId = getSlotItemId(slot);
                    if (!currentItemId) return;
                    beginDrag(event, currentItemId, {
                        fromEquippedSlot: true,
                        sourceSlotId: slot.dataset.slotId
                    });
                });
                slot.addEventListener("dragend", clearDragPresentation);
            }
        });

        [...(ui.partyTabs?.querySelectorAll?.(".map-equipment-party-tab") || [])].forEach(button => {
            if (button.dataset.lxPartyDropBound === "true") return;
            button.dataset.lxPartyDropBound = "true";
            button.addEventListener("dragover", event => {
                if (!dragState) return;
                event.preventDefault();
                button.classList.add("lx-drop-target");
            });
            button.addEventListener("dragleave", () => button.classList.remove("lx-drop-target"));
            button.addEventListener("drop", event => {
                event.preventDefault();
                const itemId = dragState?.itemId || event.dataTransfer?.getData("text/plain");
                if (itemId) equipToParty(itemId, button);
                clearDragPresentation();
            });
        });

        updateIdentity();
        if (root.dataset.lxView === "inventory") renderFullInventory();
    }

    ui.dropzone.addEventListener("dragover", event => {
        if (!dragState?.fromEquippedSlot) return;
        event.preventDefault();
        ui.dropzone.classList.add("lx-drop-target");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    ui.dropzone.addEventListener("dragleave", () => ui.dropzone.classList.remove("lx-drop-target"));
    ui.dropzone.addEventListener("drop", event => {
        event.preventDefault();
        unequipDraggedSlot();
        clearDragPresentation();
    });

    nav.addEventListener("click", event => {
        const button = event.target?.closest?.("[data-lx-view-target]");
        if (!button) return;
        setView(button.dataset.lxViewTarget);
    });

    ui.inventoryPane.filters.addEventListener("click", event => {
        const button = event.target?.closest?.("[data-lx-inventory-filter]");
        if (!button) return;
        inventoryFilter = button.dataset.lxInventoryFilter || "all";
        selectedInventoryItemId = null;
        renderFullInventory();
    });

    const observer = new MutationObserver(decorateDynamicNodes);
    observer.observe(ui.partyTabs, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-selected", "data-active"] });
    observer.observe(ui.slots, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-selected"] });
    observer.observe(ui.options, { childList: true, subtree: true });

    root.addEventListener("click", () => setTimeout(decorateDynamicNodes, 0));

    document.addEventListener("keydown", event => {
        if (event.defaultPrevented || event.repeat) return;
        const target = event.target;
        if (target?.matches?.("input, textarea, select") || target?.isContentEditable) return;
        const key = String(event.key || "").toLowerCase();
        const mapScreen = document.getElementById("map-screen");
        if (!mapScreen || mapScreen.hidden) return;

        if (!root.hidden && key === "tab") {
            event.preventDefault();
            event.stopImmediatePropagation();
            setView(root.dataset.lxView === "inventory" ? "equipment" : "inventory");
            return;
        }

        if (key !== "p") return;
        event.preventDefault();
        dispatchMapKey("b", "KeyB");
    }, true);

    decorateDynamicNodes();
    setView("equipment");
    return true;
}
