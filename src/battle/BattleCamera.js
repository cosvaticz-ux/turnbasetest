export function createBattleCamera({ cameraElement, screenElement, getFormationSlot, onCameraChanged } = {}) {
    function apply({ x = 0, y = 0, scale = 1, mode = "default" } = {}) {
        cameraElement.style.setProperty("--camera-x", `${x}%`);
        cameraElement.style.setProperty("--camera-y", `${y}%`);
        cameraElement.style.setProperty("--camera-scale", String(scale));
        screenElement.dataset.cameraMode = mode;
        onCameraChanged?.();
    }

    return {
        apply,
        focusDefault() {
            apply();
        },
        focusEntity(entity) {
            const slot = getFormationSlot(entity?.formationSlot);
            if (!slot) {
                this.focusDefault();
                return false;
            }
            apply({ x: slot.focusX, y: slot.focusY, scale: slot.focusScale, mode: "target-focus" });
            return true;
        },
        focusCharacter(character) {
            const slot = getFormationSlot(character?.formationSlot);
            if (!slot || slot.side !== "player") {
                this.focusDefault();
                return false;
            }
            apply({
                x: slot.actionFocusX,
                y: slot.actionFocusY,
                scale: slot.actionFocusScale,
                mode: "player-focus"
            });
            return true;
        },
        focusTarget(target) {
            return this.focusEntity(target);
        },
        reset() {
            this.focusDefault();
        },
        resetCamera() {
            this.focusDefault();
        },
        shake() {
            screenElement.classList.add("camera-shake");
        }
    };
}
