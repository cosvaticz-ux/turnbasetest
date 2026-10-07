import {
    EQUIPMENT_DEFINITIONS,
    ITEM_DEFINITIONS
} from "../data/battleContent.js";

let installed = false;

const NAVIGABLE_SELECTOR = [
    ".map-equipment-party-tab",
    ".map-equipment-slot",
    ".map-equipment-option",
    ".lx-gear-full-inventory-filters button",
    ".lx-gear-full-inventory-item",
    ".lx-gear-full-inventory-action",
    "#map-equipment-active-toggle",
    "#map-equipment-close"
].join(", ");

function ensureStylesheet() {
    if (document.querySelector?.('link[data-lx-unified-loadout="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./src/styles/unifiedLoadoutMenu.css";
    link.dataset.lxUnifiedLoadout = "true";
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

function currentPartyMember(root, gameManager) {
    const tabs = [...root.querySelectorAll(".map-equipment-party-tab")];
    const selectedIndex = Math.max(0, tabs.findIndex(tab => tab.dataset.selected === "true"));
    return gameManager?.globalState?.party?.[selectedIndex]
        || gameManager?.globalState?.party?.[0]
        || null;
}

function itemIdFromElement(root, element, gameManager) {
    if (!element) return null;
    if (element.dataset?.itemId) return element.dataset.itemId;
    if (element.dataset?.equipmentItemId) return element.dataset.equipmentItemId;
    if (element.dataset?.lxDragItemId) return element.dataset.lxDragItemId;

    if (element.classList?.contains("map-equipment-slot")) {
        const member = currentPartyMember(root, gameManager);
        return member?.equipment?.[element.dataset.slotId] || null;
    }

    const name = element.querySelector?.("strong")?.textContent?.trim();
    return definitionByName(name)?.id || null;
}

function managedElement(target) {
    return target?.closest?.(
        ".lx-gear-full-inventory-item, .map-equipment-option, .map-equipment-slot"
    ) || null;
}

function navigationElement(target) {
    return target?.closest?.(NAVIGABLE_SELECTOR) || null;
}

function isVisibleControl(element) {
    if (!element || element.disabled || element.hidden || element.closest?.("[hidden]")) return false;
    const style = globalThis.getComputedStyle?.(element);
    if (style?.display === "none" || style?.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect?.();
    return Boolean(rect && rect.width > 1 && rect.height > 1);
}

function getNavigationCandidates(root) {
    return [...root.querySelectorAll(NAVIGABLE_SELECTOR)].filter(isVisibleControl);
}

function centerOf(element) {
    const rect = element.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

function directionalCandidate(current, candidates, key) {
    if (!current || !candidates.length) return null;
    const origin = centerOf(current);
    const ranked = [];

    for (const candidate of candidates) {
        if (candidate === current) continue;
        const point = centerOf(candidate);
        const dx = point.x - origin.x;
        const dy = point.y - origin.y;
        let primary = 0;
        let secondary = 0;

        if (key === "arrowleft") {
            if (dx >= -2) continue;
            primary = Math.abs(dx);
            secondary = Math.abs(dy);
        } else if (key === "arrowright") {
            if (dx <= 2) continue;
            primary = Math.abs(dx);
            secondary = Math.abs(dy);
        } else if (key === "arrowup") {
            if (dy >= -2) continue;
            primary = Math.abs(dy);
            secondary = Math.abs(dx);
        } else if (key === "arrowdown") {
            if (dy <= 2) continue;
            primary = Math.abs(dy);
            secondary = Math.abs(dx);
        } else {
            continue;
        }

        // Prefer controls that are truly in the requested direction, then favor
        // nearby controls on the same visual row/column. This allows free travel
        // between Party, equipment slots, Inventory filters/items, and Close.
        const angularPenalty = (secondary / Math.max(1, primary)) * 90;
        const score = primary + secondary * 0.48 + angularPenalty;
        ranked.push({ candidate, score, secondary });
    }

    ranked.sort((a, b) => a.score - b.score || a.secondary - b.secondary);
    return ranked[0]?.candidate || null;
}

function signedPercent(value) {
    const numeric = Number(value) || 0;
    if (!numeric) return null;
    const percent = Math.round(numeric * 100);
    return `${percent > 0 ? "+" : ""}${percent}%`;
}

function itemStatusLines(definition) {
    if (!definition) return [];
    const lines = [];

    if (definition.slot) lines.push(`Slot · ${String(definition.slot).toUpperCase()}`);
    if (definition.damageRange?.length >= 2) {
        lines.push(`Damage · ${definition.damageRange[0]}–${definition.damageRange[1]}`);
    }
    if (definition.attackType) lines.push(`Attack · ${definition.attackType}`);
    if (definition.element && definition.element !== "physical") lines.push(`Element · ${definition.element}`);
    if (definition.hands) lines.push(`Hands · ${definition.hands}`);

    for (const [stat, value] of Object.entries(definition.statModifiers || {})) {
        const amount = Number(value) || 0;
        if (!amount) continue;
        lines.push(`${stat.toUpperCase()} · ${amount > 0 ? "+" : ""}${amount}`);
    }

    const accuracy = signedPercent(definition.accuracyModifier);
    if (accuracy) lines.push(`Accuracy · ${accuracy}`);
    const crit = signedPercent(definition.critModifier);
    if (crit) lines.push(`Critical · ${crit}`);

    if (definition.healAmount) lines.push(`Effect · Restore ${definition.healAmount} HP`);
    if (definition.curesStatus) lines.push(`Effect · Cure ${definition.curesStatus}`);
    if (definition.effectType === "apply-enemy-status" && definition.statusEffectId) {
        lines.push(`Effect · Apply ${definition.statusEffectId}`);
    }
    if (definition.prepareOnly) lines.push("Use · Prepare phase only");
    else if (definition.fieldUsable) lines.push("Use · Field usable");
    if (definition.battleUsable) lines.push("Use · Battle usable");

    if (definition.masteryDiscipline) lines.push(`Mastery · ${definition.masteryDiscipline}`);
    if (definition.traits?.length) lines.push(`Traits · ${definition.traits.join(", ")}`);
    return lines;
}

function ownershipText(root, element, gameManager) {
    const small = element?.querySelector?.("small")?.textContent?.trim();
    if (small) return small;

    const itemId = itemIdFromElement(root, element, gameManager);
    const definition = definitionById(itemId);
    const member = currentPartyMember(root, gameManager);
    if (definition?.slot && member?.equipment?.[definition.slot] === itemId) {
        return `Equipped · ${member.name || member.id}`;
    }
    return "";
}

function createInspector() {
    const overlay = document.createElement("div");
    overlay.className = "lx-item-inspector-overlay";
    overlay.hidden = true;

    const panel = document.createElement("section");
    panel.className = "lx-item-inspector";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Inspect item");

    const header = document.createElement("header");
    const kicker = document.createElement("span");
    kicker.textContent = "Inspect";
    const name = document.createElement("h3");
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    header.append(kicker, name, close);

    const description = document.createElement("p");
    const status = document.createElement("div");
    status.className = "lx-item-inspector-status";
    panel.append(header, description, status);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return { overlay, panel, name, close, description, status };
}

function populateDetail(nameNode, descriptionNode, statusNode, definition, extra = "") {
    nameNode.textContent = definition?.name || "Unknown Item";
    descriptionNode.textContent = definition?.description || "No description is available for this item.";
    const lines = itemStatusLines(definition);
    if (extra) lines.unshift(extra);
    statusNode.replaceChildren(...lines.map(line => {
        const row = document.createElement("span");
        row.textContent = line;
        return row;
    }));
}

function getInlineDetailNodes(root) {
    const detail = root.querySelector(".lx-gear-full-inventory-detail");
    if (!detail) return null;

    let status = detail.querySelector(".lx-gear-inline-status");
    if (!status) {
        status = document.createElement("div");
        status.className = "lx-gear-inline-status";
        detail.appendChild(status);
    }

    return {
        detail,
        category: detail.querySelector(".lx-gear-full-inventory-category"),
        name: detail.querySelector("h4"),
        description: detail.querySelector("p"),
        ownership: detail.querySelector(".lx-gear-full-inventory-ownership"),
        action: detail.querySelector(".lx-gear-full-inventory-action"),
        status
    };
}

function inlineCategory(definition) {
    if (!definition) return "ITEM";
    if (definition.slot) return `EQUIPMENT · ${String(definition.slot).toUpperCase()}`;
    if (definition.fieldUsable || definition.battleUsable) return "USABLE ITEM";
    return String(definition.inventoryType || definition.category || "ITEM").toUpperCase();
}

function unifyTopBarAndPanels(root) {
    const nav = root.querySelector(".lx-gear-nav");
    if (nav && nav.dataset.lxUnified !== "true") {
        const inventoryButton = nav.querySelector('[data-lx-view-target="inventory"]');
        inventoryButton?.click?.();

        const label = document.createElement("div");
        label.className = "lx-gear-unified-nav-label";
        label.textContent = "Party · Equipment · Inventory";
        nav.replaceChildren(label);
        nav.dataset.lxUnified = "true";
    }

    const equipmentPane = root.querySelector(".lx-gear-equipment-pane");
    const inventoryPane = root.querySelector(".lx-gear-full-inventory");
    if (equipmentPane && equipmentPane.hidden !== true) equipmentPane.hidden = true;
    if (inventoryPane && inventoryPane.hidden !== false) inventoryPane.hidden = false;

    // The unified menu uses the double-click / Space interaction menu for actions.
    // Keep the right-hand area dedicated to readable item information.
    const directAction = root.querySelector(".lx-gear-full-inventory-action");
    if (directAction && directAction.hidden !== true) directAction.hidden = true;

    const footer = root.querySelector(":scope > footer");
    if (footer) footer.dataset.lxUnifiedControls = "true";
}

export function installUnifiedLoadoutMenu({ gameManager } = {}) {
    if (installed) return true;
    const root = document.getElementById("map-equipment");
    if (!root) return false;

    installed = true;
    ensureStylesheet();

    const inspector = createInspector();
    let detailAnchor = null;
    let currentPoint = null;

    function showInlineDetail(element) {
        const itemId = itemIdFromElement(root, element, gameManager);
        const definition = definitionById(itemId);
        if (!definition) return false;
        const ui = getInlineDetailNodes(root);
        if (!ui?.name || !ui.description || !ui.status) return false;

        detailAnchor = element;
        if (ui.category) ui.category.textContent = inlineCategory(definition);
        ui.name.textContent = definition.name || itemId;
        ui.description.textContent = definition.description || "No description is available for this item.";
        if (ui.ownership) ui.ownership.textContent = ownershipText(root, element, gameManager);
        populateDetail(ui.name, ui.description, ui.status, definition);
        if (ui.action) ui.action.hidden = true;
        return true;
    }

    function setCurrentPoint(element, { focus = true } = {}) {
        const target = navigationElement(element) || element;
        if (!target || !isVisibleControl(target)) return false;

        root.querySelectorAll(".lx-current-point").forEach(node => {
            if (node !== target) {
                node.classList.remove("lx-current-point");
                delete node.dataset.lxCurrentPoint;
            }
        });
        target.classList.add("lx-current-point");
        target.dataset.lxCurrentPoint = "true";
        currentPoint = target;

        const item = managedElement(target);
        if (item) showInlineDetail(item);
        if (focus) {
            try {
                target.focus?.({ preventScroll: true });
            } catch {
                target.focus?.();
            }
        }
        return true;
    }

    function ensureCurrentPoint({ focus = false } = {}) {
        if (currentPoint && isVisibleControl(currentPoint) && root.contains(currentPoint)) return currentPoint;
        const focused = root.contains(document.activeElement)
            ? navigationElement(document.activeElement)
            : null;
        const preferred = focused
            || root.querySelector('.map-equipment-party-tab[data-selected="true"]')
            || root.querySelector('.lx-gear-full-inventory-item[data-selected="true"]')
            || getNavigationCandidates(root)[0]
            || null;
        if (preferred) setCurrentPoint(preferred, { focus });
        return preferred;
    }

    function closeInspector() {
        inspector.overlay.hidden = true;
        ensureCurrentPoint({ focus: true });
    }

    function inspectDefinition(definition, sourceElement = null) {
        if (!definition) return false;
        populateDetail(
            inspector.name,
            inspector.description,
            inspector.status,
            definition,
            ownershipText(root, sourceElement || detailAnchor, gameManager)
        );
        inspector.overlay.hidden = false;
        inspector.close.focus?.();
        return true;
    }

    function injectInspectAction() {
        const popover = document.querySelector(".lx-item-interaction");
        if (!popover || popover.hidden) return;
        const actions = popover.querySelector(".lx-item-interaction-actions");
        if (!actions || actions.querySelector("[data-lx-inspect-action]")) return;

        const title = popover.querySelector("header strong")?.textContent?.trim();
        const definition = definitionByName(title);
        if (!definition) return;

        const button = document.createElement("button");
        button.type = "button";
        button.dataset.lxInspectAction = "true";
        button.setAttribute("role", "menuitem");
        const label = document.createElement("strong");
        label.textContent = "Inspect";
        const hint = document.createElement("small");
        hint.textContent = "Details / status";
        button.append(label, hint);
        button.addEventListener("click", () => {
            popover.hidden = true;
            actions.replaceChildren();
            inspectDefinition(definition, detailAnchor || currentPoint);
        });
        actions.prepend(button);
    }

    const rootObserver = new MutationObserver(() => {
        unifyTopBarAndPanels(root);
        injectInspectAction();
        if (!root.hidden) requestAnimationFrame(() => ensureCurrentPoint());
    });
    rootObserver.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-selected"]
    });

    const interactionPopover = document.querySelector(".lx-item-interaction");
    const popoverObserver = interactionPopover
        ? new MutationObserver(() => injectInspectAction())
        : null;
    if (interactionPopover && popoverObserver) {
        popoverObserver.observe(interactionPopover, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["hidden"]
        });
    }

    // Mouse hover no longer creates a floating tooltip. It only updates the fixed
    // detail area on the lower-right, matching the user's marked layout.
    root.addEventListener("pointerover", event => {
        const item = managedElement(event.target);
        if (!item) return;
        showInlineDetail(item);
        setCurrentPoint(item, { focus: false });
    });

    root.addEventListener("click", event => {
        const target = navigationElement(event.target);
        if (target) setCurrentPoint(target, { focus: false });
        const item = managedElement(event.target);
        if (item) showInlineDetail(item);
    });

    root.addEventListener("focusin", event => {
        const target = navigationElement(event.target);
        if (target) setCurrentPoint(target, { focus: false });
        const item = managedElement(event.target);
        if (item) showInlineDetail(item);
    });

    inspector.close.addEventListener("click", closeInspector);
    inspector.overlay.addEventListener("pointerdown", event => {
        if (event.target === inspector.overlay) closeInspector();
    });

    // Unified keyboard navigation owns directional movement while B is open.
    // Arrow keys can cross panel boundaries freely, while exactly one control is
    // marked as the current point. Tab remains normal next/previous focus travel.
    window.addEventListener("keydown", event => {
        const mapScreen = document.getElementById("map-screen");
        if (!mapScreen || mapScreen.hidden) return;
        const key = String(event.key || "").toLowerCase();

        if (!inspector.overlay.hidden) {
            if (key === "escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                closeInspector();
            }
            return;
        }

        if (key === "tab") {
            if (root.hidden) event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        if (root.hidden) return;

        if (key === "q" || key === "e") {
            event.stopImmediatePropagation();
            return;
        }

        // Once the item action popover is open, its own arrow-key handler owns it.
        const popover = document.querySelector(".lx-item-interaction");
        if (popover && !popover.hidden) return;

        if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const candidates = getNavigationCandidates(root);
            const current = ensureCurrentPoint() || candidates[0];
            const next = directionalCandidate(current, candidates, key);
            if (next) setCurrentPoint(next, { focus: true });
            return;
        }

        const current = ensureCurrentPoint();
        if (!current) return;

        if (key === "enter") {
            event.preventDefault();
            event.stopImmediatePropagation();
            current.click?.();
            return;
        }

        if (key === " " || key === "spacebar") {
            // Item cards/slots are intentionally left to InventoryInteractionMenu,
            // which opens Equip / Unequip / Use / Inspect. Other controls activate.
            if (managedElement(current)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            current.click?.();
        }
    }, true);

    const rootVisibilityObserver = new MutationObserver(() => {
        if (root.hidden) {
            root.querySelectorAll(".lx-current-point").forEach(node => {
                node.classList.remove("lx-current-point");
                delete node.dataset.lxCurrentPoint;
            });
            currentPoint = null;
            detailAnchor = null;
            if (!inspector.overlay.hidden) inspector.overlay.hidden = true;
            return;
        }
        requestAnimationFrame(() => ensureCurrentPoint({ focus: false }));
    });
    rootVisibilityObserver.observe(root, { attributes: true, attributeFilter: ["hidden"] });

    unifyTopBarAndPanels(root);
    requestAnimationFrame(() => ensureCurrentPoint());
    return true;
}
