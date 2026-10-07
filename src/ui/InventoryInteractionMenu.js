import {
    EQUIPMENT_DEFINITIONS,
    ITEM_DEFINITIONS
} from "../data/battleContent.js";

let installed = false;

function ensureStylesheet() {
    if (document.querySelector?.('link[data-lx-item-interaction="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./src/styles/inventoryInteractionMenu.css";
    link.dataset.lxItemInteraction = "true";
    document.head?.appendChild(link);
}

function definitionByName(name) {
    if (!name) return null;
    return [
        ...Object.values(EQUIPMENT_DEFINITIONS),
        ...Object.values(ITEM_DEFINITIONS)
    ].find(definition => definition?.name === name) || null;
}

function definitionById(itemId) {
    return EQUIPMENT_DEFINITIONS[itemId] || ITEM_DEFINITIONS[itemId] || null;
}

function getSelectedPartyIndex(root) {
    const tabs = [...root.querySelectorAll(".map-equipment-party-tab")];
    const selected = tabs.findIndex(tab => tab.dataset.selected === "true");
    return selected >= 0 ? selected : 0;
}

function getCurrentMember(root, gameManager) {
    const roster = gameManager?.globalState?.party || [];
    return roster[getSelectedPartyIndex(root)] || roster[0] || null;
}

function itemIdFromElement(root, element, gameManager) {
    if (!element) return null;
    if (element.dataset?.itemId) return element.dataset.itemId;
    if (element.dataset?.equipmentItemId) return element.dataset.equipmentItemId;

    if (element.classList?.contains("map-equipment-slot")) {
        const slotId = element.dataset.slotId;
        const member = getCurrentMember(root, gameManager);
        return member?.equipment?.[slotId] || null;
    }

    const name = element.querySelector?.("strong")?.textContent?.trim();
    return definitionByName(name)?.id || null;
}

function findEquipmentOption(root, itemId) {
    const definition = EQUIPMENT_DEFINITIONS[itemId];
    if (!definition) return null;
    return [...root.querySelectorAll(".map-equipment-option")].find(button => {
        if (button.dataset.equipmentItemId === itemId) return true;
        return button.querySelector("strong")?.textContent?.trim() === definition.name;
    }) || null;
}

function canUseFieldItem(definition, member) {
    if (!definition?.fieldUsable || !member) return false;
    if (definition.effectType === "heal") {
        const maxHp = Math.max(1, Number(member.maxHp) || 1);
        const hp = Math.max(0, Number(member.hp) || 0);
        return (hp > 0 || definition.canRevive === true) && hp < maxHp;
    }
    if (definition.effectType === "cure-status" && definition.curesStatus === "poison") {
        return Number(member.poisonTurns) > 0
            || member.statusEffects?.some?.(status => status?.id === "poison");
    }
    return false;
}

function consumeInventoryItem(gameManager, itemId, member) {
    const state = gameManager?.globalState;
    const definition = ITEM_DEFINITIONS[itemId];
    const inventoryItem = state?.inventory?.find(entry => entry?.id === itemId);
    if (!state || !definition || !inventoryItem || Number(inventoryItem.quantity) <= 0 || !member) {
        return { changed: false, message: "That item is not available." };
    }
    if (!canUseFieldItem(definition, member)) {
        return {
            changed: false,
            message: definition.effectType === "heal"
                ? `${member.name || member.id} does not need healing.`
                : "That item has no effect right now."
        };
    }

    let message = `${definition.name} used.`;
    if (definition.effectType === "heal") {
        const before = Math.max(0, Number(member.hp) || 0);
        const maxHp = Math.max(1, Number(member.maxHp) || 1);
        member.hp = Math.min(maxHp, before + Math.max(0, Number(definition.healAmount) || 0));
        if (member.hp > 0) {
            member.isDown = false;
            member.retreated = false;
        }
        message = `${member.name || member.id} recovered ${member.hp - before} HP.`;
    } else if (definition.effectType === "cure-status" && definition.curesStatus === "poison") {
        member.poisonTurns = 0;
        member.poisonDamage = 0;
        if (Array.isArray(member.statusEffects)) {
            member.statusEffects = member.statusEffects.filter(status => status?.id !== "poison");
        }
        message = `${member.name || member.id} is no longer poisoned.`;
    } else {
        return { changed: false, message: "That item cannot be used here." };
    }

    inventoryItem.quantity = Math.max(0, Number(inventoryItem.quantity) - 1);
    gameManager.save?.("autosave");
    return { changed: true, message };
}

function createPopover() {
    const popover = document.createElement("section");
    popover.className = "lx-item-interaction";
    popover.hidden = true;
    popover.setAttribute("role", "menu");
    popover.setAttribute("aria-label", "Item actions");

    const header = document.createElement("header");
    const kicker = document.createElement("span");
    kicker.textContent = "Interaction";
    const title = document.createElement("strong");
    title.textContent = "Item";
    header.append(kicker, title);

    const actions = document.createElement("div");
    actions.className = "lx-item-interaction-actions";
    popover.append(header, actions);
    document.body.appendChild(popover);
    return { popover, title, actions };
}

function positionPopover(popover, anchor) {
    if (!popover || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const menuRect = popover.getBoundingClientRect();
    const margin = 12;
    let left = rect.right + 8;
    let top = rect.top;

    if (left + menuRect.width > window.innerWidth - margin) {
        left = rect.left - menuRect.width - 8;
    }
    if (top + menuRect.height > window.innerHeight - margin) {
        top = window.innerHeight - menuRect.height - margin;
    }
    left = Math.max(margin, left);
    top = Math.max(margin, top);
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
}

function createActionButton(label, handler, { disabled = false, hint = "" } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.disabled = disabled;

    const text = document.createElement("strong");
    text.textContent = label;
    const small = document.createElement("small");
    small.textContent = hint;
    button.append(text, small);
    if (typeof handler === "function") button.addEventListener("click", handler);
    return button;
}

export function installInventoryInteractionMenu({ gameManager } = {}) {
    if (installed) return true;
    const root = document.getElementById("map-equipment");
    if (!root) return false;

    ensureStylesheet();
    installed = true;

    const ui = createPopover();
    let activeAnchor = null;
    let nativeActionPass = false;
    let toastTimer = null;
    let lastPointerActivationKey = null;
    let lastPointerActivationTime = 0;
    let suppressNextManagedClick = false;

    const toast = document.createElement("div");
    toast.className = "lx-item-interaction-toast";
    toast.hidden = true;
    toast.setAttribute("role", "status");
    root.appendChild(toast);

    function showToast(message) {
        if (!message) return;
        clearTimeout(toastTimer);
        toast.textContent = message;
        toast.hidden = false;
        toastTimer = setTimeout(() => {
            toast.hidden = true;
        }, 1800);
    }

    function closePopover({ restoreFocus = false } = {}) {
        ui.popover.hidden = true;
        ui.actions.replaceChildren();
        if (restoreFocus) activeAnchor?.focus?.();
        activeAnchor = null;
    }

    function refreshInlineInventory() {
        const inventoryTab = root.querySelector('[data-lx-view-target="inventory"]');
        if (root.dataset.lxView === "inventory") inventoryTab?.click?.();
    }

    function selectSlot(slotId) {
        const slot = root.querySelector(`.map-equipment-slot[data-slot-id="${slotId}"]`);
        slot?.click?.();
        return slot;
    }

    function equipItem(itemId) {
        const definition = EQUIPMENT_DEFINITIONS[itemId];
        if (!definition) return false;
        selectSlot(definition.slot);
        setTimeout(() => {
            const option = findEquipmentOption(root, itemId);
            if (!option) {
                showToast("That item cannot be equipped in this slot.");
                return;
            }
            nativeActionPass = true;
            option.disabled = false;
            option.click();
            nativeActionPass = false;
            setTimeout(() => {
                refreshInlineInventory();
                showToast(`${definition.name} equipped.`);
            }, 0);
        }, 0);
        return true;
    }

    function unequipItem(itemId) {
        const definition = EQUIPMENT_DEFINITIONS[itemId];
        const member = getCurrentMember(root, gameManager);
        if (!definition || member?.equipment?.[definition.slot] !== itemId) return false;
        selectSlot(definition.slot);
        setTimeout(() => {
            root.querySelector("#map-equipment-unequip")?.click?.();
            setTimeout(() => {
                refreshInlineInventory();
                showToast(`${definition.name} unequipped.`);
            }, 0);
        }, 0);
        return true;
    }

    function openFor(anchor) {
        const itemId = itemIdFromElement(root, anchor, gameManager);
        const definition = definitionById(itemId);
        if (!itemId || !definition) return false;

        const member = getCurrentMember(root, gameManager);
        const equipment = EQUIPMENT_DEFINITIONS[itemId];
        const fieldItem = ITEM_DEFINITIONS[itemId];
        activeAnchor = anchor;
        ui.title.textContent = definition.name || itemId;
        const actions = [];

        if (equipment && member) {
            const alreadyEquipped = member.equipment?.[equipment.slot] === equipment.id;
            if (alreadyEquipped) {
                actions.push(createActionButton("Unequip", () => {
                    closePopover();
                    unequipItem(itemId);
                }, { hint: member.name || member.id }));
            } else {
                actions.push(createActionButton("Equip", () => {
                    closePopover();
                    equipItem(itemId);
                }, { hint: `to ${member.name || member.id}` }));
            }
        }

        if (fieldItem?.fieldUsable && member) {
            const usable = canUseFieldItem(fieldItem, member);
            actions.push(createActionButton("Use", () => {
                const result = consumeInventoryItem(gameManager, itemId, member);
                closePopover();
                refreshInlineInventory();
                showToast(result.message);
            }, {
                disabled: !usable,
                hint: usable ? `on ${member.name || member.id}` : "No effect right now"
            }));
        }

        if (!actions.length) {
            actions.push(createActionButton("No available action", null, {
                disabled: true,
                hint: "This item is informational for now"
            }));
        }

        const cancel = createActionButton("Cancel", () => closePopover({ restoreFocus: true }), { hint: "Esc" });
        cancel.classList.add("is-cancel");
        actions.push(cancel);
        ui.actions.replaceChildren(...actions);
        ui.popover.hidden = false;
        positionPopover(ui.popover, anchor);
        ui.actions.querySelector("button:not(:disabled)")?.focus?.();
        return true;
    }

    function managedElement(target) {
        return target?.closest?.(
            ".lx-gear-full-inventory-item, .map-equipment-option, .map-equipment-slot"
        ) || null;
    }

    function markSelected(element) {
        root.querySelectorAll(".map-equipment-option.lx-interaction-selected")
            .forEach(node => node.classList.remove("lx-interaction-selected"));
        if (element?.classList?.contains("map-equipment-option")) {
            element.classList.add("lx-interaction-selected");
        }
    }

    function pointerActivationKey(element) {
        if (!element) return null;
        const itemId = itemIdFromElement(root, element, gameManager);
        if (itemId) return `item:${itemId}`;
        if (element.classList?.contains("map-equipment-slot")) {
            return `slot:${element.dataset.slotId || "unknown"}`;
        }
        return null;
    }

    // Some inventory/slot controls re-render themselves on the first click. Native
    // dblclick then becomes unreliable because the second click lands on a new DOM
    // node. Track the item identity at pointerdown so the second press still opens
    // the action menu even when the card/slot was replaced between clicks.
    root.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        const element = managedElement(event.target);
        if (!element) return;
        const key = pointerActivationKey(element);
        if (!key) return;

        const now = globalThis.performance?.now?.() ?? Date.now();
        const isSecondPress = key === lastPointerActivationKey
            && now - lastPointerActivationTime <= 450;

        if (!isSecondPress) {
            lastPointerActivationKey = key;
            lastPointerActivationTime = now;
            return;
        }

        lastPointerActivationKey = null;
        lastPointerActivationTime = 0;
        suppressNextManagedClick = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        markSelected(element);
        openFor(element);
    }, true);

    // Swallow the click that follows the second pointerdown above so it cannot
    // immediately re-render the card/slot underneath the newly opened popover.
    root.addEventListener("click", event => {
        if (!suppressNextManagedClick) return;
        const element = managedElement(event.target);
        if (!element) return;
        suppressNextManagedClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    // Compatible-equipment cards used to equip immediately on a single click.
    // They are now selection controls; the explicit action lives in this menu.
    root.addEventListener("click", event => {
        if (nativeActionPass) return;
        const option = event.target?.closest?.(".map-equipment-option");
        if (!option) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        markSelected(option);
        option.focus?.();
    }, true);

    root.addEventListener("dblclick", event => {
        const element = managedElement(event.target);
        if (!element) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        markSelected(element);
        openFor(element);
    }, true);

    function enableInteractionOptions() {
        root.querySelectorAll(".map-equipment-option").forEach(option => {
            if (option.disabled) {
                option.disabled = false;
                option.dataset.lxInteractionManaged = "true";
            }
            option.title = "Double-click or press Space for actions";
        });
        root.querySelectorAll(".lx-gear-full-inventory-item, .map-equipment-slot").forEach(element => {
            element.title = "Double-click or press Space for actions";
        });
    }

    const observer = new MutationObserver(enableInteractionOptions);
    observer.observe(root, { childList: true, subtree: true });
    enableInteractionOptions();

    document.addEventListener("pointerdown", event => {
        if (ui.popover.hidden) return;
        if (ui.popover.contains(event.target) || activeAnchor?.contains?.(event.target)) return;
        closePopover();
    }, true);

    document.addEventListener("keydown", event => {
        if (root.hidden) return;
        const key = String(event.key || "").toLowerCase();

        if (!ui.popover.hidden) {
            if (key === "escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                closePopover({ restoreFocus: true });
                return;
            }
            if (key === "arrowdown" || key === "arrowup") {
                const buttons = [...ui.actions.querySelectorAll("button:not(:disabled)")];
                if (!buttons.length) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                const current = buttons.indexOf(document.activeElement);
                const direction = key === "arrowdown" ? 1 : -1;
                const next = current < 0
                    ? 0
                    : (current + direction + buttons.length) % buttons.length;
                buttons[next]?.focus?.();
                return;
            }

            // The map scene also listens for Space/Enter. If a dropdown button has
            // focus, consume the key here and activate that button explicitly so the
            // map scene cannot prevent the native button click.
            if (ui.popover.contains(document.activeElement)
                && (key === " " || key === "spacebar" || key === "enter")) {
                event.preventDefault();
                event.stopImmediatePropagation();
                document.activeElement?.click?.();
                return;
            }

            if (ui.popover.contains(document.activeElement)) return;
        }

        if (key !== " " && key !== "spacebar") return;
        const target = event.target;
        if (target?.matches?.("input, textarea, select") || target?.isContentEditable) return;

        let element = managedElement(document.activeElement);
        if (!element && root.dataset.lxView === "inventory") {
            element = root.querySelector('.lx-gear-full-inventory-item[data-selected="true"]');
        }
        if (!element) {
            element = root.querySelector(".map-equipment-option.lx-interaction-selected")
                || root.querySelector('.map-equipment-slot[data-selected="true"]');
        }
        if (!element) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        openFor(element);
    }, true);

    window.addEventListener("resize", () => {
        if (!ui.popover.hidden && activeAnchor) positionPopover(ui.popover, activeAnchor);
    });

    return true;
}
