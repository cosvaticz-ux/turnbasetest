import { AudioManager } from "../../core/AudioManager.js";

// Owns menu DOM/selection only. Availability and execution are scene-supplied commands.
export function createBattleCommandPresentation({
    elements, getCategories, canAcceptPlayerInput, canShowPlayerCommands, isPreparing,
    getEntityView, getActivePlayer, updateActiveActionHud, scheduleVisual, cancelVisual
}) {
    let selectedActionElement = null;
    let commandTransitionTimer = null;
    let activeCommandCategoryId = "action";
    let activeCommandIndex = 0;
    let availableCommandCategories = [];
    let renderedCommandControls = [];
    function createCommandButton(command) {
        const button = document.createElement("button");
        button.id = command.elementId;
        button.className = "command-row";
        button.type = "button";
        button.dataset.commandId = command.id;

        const icon = document.createElement("span");
        icon.className = "command-icon";
        icon.setAttribute("aria-hidden", "true");
        if (command.iconImage) {
            const image = document.createElement("img");
            image.className = "command-icon-image";
            image.src = command.iconImage;
            image.alt = "";
            image.draggable = false;
            icon.appendChild(image);
        } else {
            icon.textContent = command.icon;
        }

        const name = document.createElement("span");
        name.className = "command-name";
        name.textContent = command.name;

        const cost = document.createElement("span");
        cost.className = "action-cost";
        cost.textContent = command.costLabel;

        button.append(icon, name, cost);
        button.addEventListener("click", () => {
            const index = renderedCommandControls.findIndex(control => control.button === button);
            if (index >= 0) activeCommandIndex = index;
            confirmCommandSelection();
        });
        button.addEventListener("pointerenter", () => {
            const index = renderedCommandControls.findIndex(control => control.button === button);
            if (index < 0) return;
            const changed = activeCommandIndex !== index;
            activeCommandIndex = index;
            updateCommandSelection();
            if (changed) AudioManager.playEvent("menuMove", { scope: "battle" });
        });
        return button;
    }

    function updateCommandSelection() {
        renderedCommandControls.forEach(({ button }, index) => {
            const selected = index === activeCommandIndex;
            button.classList[selected ? "add" : "remove"]("keyboard-selected");
            button.setAttribute("aria-current", selected ? "true" : "false");
        });
    }

    function moveCommandSelection(direction) {
        if (!canAcceptPlayerInput() || elements.battleMenu.hidden || renderedCommandControls.length === 0) return false;
        const nextIndex = Math.min(
            renderedCommandControls.length - 1,
            Math.max(0, activeCommandIndex + Math.sign(direction))
        );
        if (nextIndex === activeCommandIndex) return false;
        activeCommandIndex = nextIndex;
        updateCommandSelection();
        AudioManager.playEvent("menuMove", { scope: "battle" });
        return true;
    }

    function confirmCommandSelection() {
        if (!canAcceptPlayerInput() || elements.battleMenu.hidden) return false;
        const control = renderedCommandControls[activeCommandIndex];
        if (!control || control.button.disabled || !control.command.isEnabled()) return false;
        AudioManager.playEvent("menuConfirm", { scope: "battle" });
        return control.command.execute(control.button) !== false;
    }

    function refreshAvailableCommandCategories() {
        availableCommandCategories = getCategories().filter(category => category.isAvailable());
        if (!availableCommandCategories.some(category => category.id === activeCommandCategoryId)) {
            activeCommandCategoryId = availableCommandCategories.find(category => category.id === "action")?.id
                || availableCommandCategories[0]?.id
                || null;
        }
        return availableCommandCategories;
    }

    function animateCommandPage(direction) {
        if (commandTransitionTimer !== null) {
            cancelVisual(commandTransitionTimer);
            commandTransitionTimer = null;
        }
        elements.menuContent.classList.remove("tab-enter-forward", "tab-enter-backward");
        if (direction === 0) return;
        void elements.menuContent.offsetWidth;
        const animationClass = direction > 0 ? "tab-enter-forward" : "tab-enter-backward";
        elements.menuContent.classList.add(animationClass);
        commandTransitionTimer = scheduleVisual(() => {
            commandTransitionTimer = null;
            elements.menuContent.classList.remove(animationClass);
        }, 130);
    }

    function renderActiveCommandCategory(direction = 0) {
        const category = availableCommandCategories.find(entry => entry.id === activeCommandCategoryId);
        for (const { button } of renderedCommandControls) button.disabled = true;
        if (!category) {
            elements.menuContent.replaceChildren();
            renderedCommandControls = [];
            return false;
        }

        const commands = category.getCommands();
        renderedCommandControls = commands.map(command => ({ command, button: createCommandButton(command) }));
        activeCommandIndex = Math.min(activeCommandIndex, Math.max(0, renderedCommandControls.length - 1));
        const categoryLabel = isPreparing() ? "Prepare" : category.label;
        elements.commandCategoryTitle.textContent = categoryLabel;
        elements.commandBox.setAttribute("aria-label", `${categoryLabel} commands`);
        elements.menuContent.replaceChildren(...renderedCommandControls.map(({ button }) => button));
        updateCommandSelection();
        animateCommandPage(direction);
        return true;
    }

    function updateCommandControlStates(canInput = canAcceptPlayerInput()) {
        for (const { command, button } of renderedCommandControls) {
            const commandEnabled = command.isEnabled();
            button.disabled = !canInput || !commandEnabled;
            button.title = commandEnabled ? "" : command.disabledReason?.() || "Command is unavailable";
        }

        const activeIndex = availableCommandCategories.findIndex(category => category.id === activeCommandCategoryId);
        const canGoPrevious = canInput && !elements.battleMenu.hidden && activeIndex > 0;
        const canGoNext = canInput && !elements.battleMenu.hidden
            && activeIndex >= 0
            && activeIndex < availableCommandCategories.length - 1;
        elements.previousCommandTab.disabled = !canGoPrevious;
        elements.nextCommandTab.disabled = !canGoNext;
    }

    function refreshCommandMenu({ resetToAction = false, direction = 0 } = {}) {
        if (resetToAction) activeCommandCategoryId = "action";
        refreshAvailableCommandCategories();
        if (!elements.battleMenu.hidden) renderActiveCommandCategory(direction);
        updateCommandControlStates();
        return availableCommandCategories.map(category => category.id);
    }

    function openCommandMenu() {
        const activeView = getEntityView(getActivePlayer());
        if (!activeView || !canShowPlayerCommands()) return false;
        elements.battleHud.appendChild(elements.battleMenu);
        elements.battleMenu.hidden = false;
        activeCommandIndex = 0;
        refreshCommandMenu({ resetToAction: true });
        updateActiveActionHud();
        return true;
    }

    function closeCommandMenu() {
        elements.battleMenu.hidden = true;
        if (commandTransitionTimer !== null) {
            cancelVisual(commandTransitionTimer);
            commandTransitionTimer = null;
        }
        elements.menuContent.classList.remove("tab-enter-forward", "tab-enter-backward");
        for (const { button } of renderedCommandControls) button.disabled = true;
        elements.menuContent.replaceChildren();
        renderedCommandControls = [];
        activeCommandIndex = 0;
        elements.previousCommandTab.disabled = true;
        elements.nextCommandTab.disabled = true;
    }

    function navigateCommandCategory(direction) {
        if (!Number.isInteger(direction) || direction === 0 || elements.battleMenu.hidden
            || !canAcceptPlayerInput()) return false;
        refreshAvailableCommandCategories();
        const activeIndex = availableCommandCategories.findIndex(category => category.id === activeCommandCategoryId);
        const nextIndex = activeIndex + Math.sign(direction);
        if (activeIndex < 0 || nextIndex < 0 || nextIndex >= availableCommandCategories.length) {
            updateCommandControlStates();
            return false;
        }
        activeCommandCategoryId = availableCommandCategories[nextIndex].id;
        activeCommandIndex = 0;
        renderActiveCommandCategory(Math.sign(direction));
        updateCommandControlStates();
        AudioManager.playEvent("tabChange", { scope: "battle" });
        return true;
    }

    function returnToActionCategory() {
        if (!canAcceptPlayerInput() || elements.battleMenu.hidden || activeCommandCategoryId === "action") return false;
        const previousIndex = availableCommandCategories.findIndex(category => category.id === activeCommandCategoryId);
        activeCommandCategoryId = "action";
        activeCommandIndex = 0;
        renderActiveCommandCategory(previousIndex > 0 ? -1 : 0);
        updateCommandControlStates();
        AudioManager.playEvent("menuCancel", { scope: "battle" });
        return true;
    }

    function setSelectedAction(actionElement) {
        if (selectedActionElement === actionElement) return;
        selectedActionElement?.classList.remove("selected-action");
        selectedActionElement = actionElement;
        selectedActionElement?.classList.add("selected-action");
    }

    function clearSelectedAction() {
        selectedActionElement?.classList.remove("selected-action");
        selectedActionElement = null;
    }

    return {
        moveCommandSelection,
        confirmCommandSelection,
        refreshAvailableCommandCategories,
        updateCommandControlStates,
        refreshCommandMenu,
        openCommandMenu,
        closeCommandMenu,
        navigateCommandCategory,
        returnToActionCategory,
        setSelectedAction,
        clearSelectedAction,
        resetTransition: () => { commandTransitionTimer = null; }
    };
}
