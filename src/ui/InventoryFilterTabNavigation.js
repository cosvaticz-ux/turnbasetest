let installed = false;

function ensureStylesheet() {
    if (document.querySelector?.('link[data-lx-inventory-filter-tab="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./src/styles/inventoryFilterTabNavigation.css";
    link.dataset.lxInventoryFilterTab = "true";
    document.head?.appendChild(link);
}

function markFilterBarAsNavigable(root) {
    const filterBar = root.querySelector(".lx-gear-inventory-filters");
    if (!filterBar) return false;

    // UnifiedLoadoutMenu's spatial navigator recognizes this alias selector.
    // Without it, Tab could focus a filter button, then the inventory rerender
    // invalidated the previous item current-point and the navigator fell back to
    // the selected party member on the left.
    filterBar.classList.add("lx-gear-full-inventory-filters");
    return true;
}

function visibleFilterButtons(root) {
    return [...root.querySelectorAll('.lx-gear-inventory-filters button[data-lx-inventory-filter]')]
        .filter(button => {
            if (button.disabled || button.hidden || button.closest?.('[hidden]')) return false;
            const style = globalThis.getComputedStyle?.(button);
            if (style?.display === "none" || style?.visibility === "hidden") return false;
            const rect = button.getBoundingClientRect?.();
            return Boolean(rect && rect.width > 1 && rect.height > 1);
        });
}

function selectedFilterIndex(buttons) {
    const focused = buttons.indexOf(document.activeElement);
    if (focused >= 0) return focused;
    const selected = buttons.findIndex(button => button.dataset.selected === "true");
    return selected >= 0 ? selected : 0;
}

function focusAndActivate(button) {
    if (!button) return false;
    try {
        button.focus?.({ preventScroll: true });
    } catch {
        button.focus?.();
    }
    button.click?.();
    return true;
}

export function installInventoryFilterTabNavigation() {
    if (installed) return true;
    const root = document.getElementById("map-equipment");
    if (!root) return false;

    installed = true;
    ensureStylesheet();
    markFilterBarAsNavigable(root);

    // The skin is composed during boot, but keep the alias resilient if that DOM
    // is rebuilt later by another presentation pass.
    const observer = new MutationObserver(() => markFilterBarAsNavigable(root));
    observer.observe(root, { childList: true, subtree: true });

    // Install before UnifiedLoadoutMenu so this handler owns Tab while the B menu
    // is open. Arrow keys remain owned by the unified spatial navigator.
    window.addEventListener("keydown", event => {
        const mapScreen = document.getElementById("map-screen");
        if (!mapScreen || mapScreen.hidden || root.hidden) return;
        if (String(event.key || "").toLowerCase() !== "tab") return;

        // Do not change inventory category while a modal/item action menu is open.
        const inspector = document.querySelector(".lx-item-inspector-overlay");
        const popover = document.querySelector(".lx-item-interaction");
        if ((inspector && !inspector.hidden) || (popover && !popover.hidden)) return;

        const buttons = visibleFilterButtons(root);
        if (!buttons.length) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const current = selectedFilterIndex(buttons);
        const direction = event.shiftKey ? -1 : 1;
        const next = (current + direction + buttons.length) % buttons.length;
        focusAndActivate(buttons[next]);
    }, true);

    for (const button of root.querySelectorAll('.lx-gear-inventory-filters button[data-lx-inventory-filter]')) {
        button.setAttribute("aria-keyshortcuts", "Tab");
        button.title = "Tab / Shift+Tab: change inventory category";
    }

    return true;
}
