export const BATTLE_INPUT_ACTION = Object.freeze({
    MOVE_UP: "MOVE_UP",
    MOVE_DOWN: "MOVE_DOWN",
    MOVE_LEFT: "MOVE_LEFT",
    MOVE_RIGHT: "MOVE_RIGHT",
    CONFIRM: "CONFIRM",
    CANCEL: "CANCEL",
    SYSTEM_MENU: "SYSTEM_MENU"
});

const KEY_TO_ACTION = Object.freeze({
    ArrowUp: BATTLE_INPUT_ACTION.MOVE_UP,
    ArrowDown: BATTLE_INPUT_ACTION.MOVE_DOWN,
    ArrowLeft: BATTLE_INPUT_ACTION.MOVE_LEFT,
    ArrowRight: BATTLE_INPUT_ACTION.MOVE_RIGHT,
    " ": BATTLE_INPUT_ACTION.CONFIRM,
    Escape: BATTLE_INPUT_ACTION.CANCEL,
    Tab: BATTLE_INPUT_ACTION.SYSTEM_MENU
});

function isEditableTarget(target) {
    const tagName = target?.tagName?.toLowerCase();
    return Boolean(target?.isContentEditable)
        || tagName === "input"
        || tagName === "textarea"
        || tagName === "select";
}

export const BattleInputManager = {
    handler: null,
    contextGuard: () => true,
    target: null,

    configure({ handler, contextGuard } = {}) {
        if (typeof handler === "function") this.handler = handler;
        if (typeof contextGuard === "function") this.contextGuard = contextGuard;
        return this;
    },

    attach(target = document) {
        if (!target?.addEventListener || this.target === target) return false;
        this.detach();
        this.target = target;
        target.addEventListener("keydown", this.handleKeyDown);
        return true;
    },

    detach() {
        if (!this.target?.removeEventListener) {
            this.target = null;
            return false;
        }
        this.target.removeEventListener("keydown", this.handleKeyDown);
        this.target = null;
        return true;
    },

    handleKeyDown(event) {
        if (!event || isEditableTarget(event.target)) return false;
        const action = KEY_TO_ACTION[event.key];
        if (!action || !BattleInputManager.contextGuard()) return false;
        if (event.repeat) {
            event.preventDefault?.();
            return false;
        }
        const handled = BattleInputManager.handler?.(action, event) === true;
        event.preventDefault?.();
        return handled;
    },

    getActionForKey(key) {
        return KEY_TO_ACTION[key] || null;
    }
};
