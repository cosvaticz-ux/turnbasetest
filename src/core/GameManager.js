import { createInitialGameState, normalizeGameState } from "./GameState.js";

export class GameManager {
    constructor({ sceneManager, saveManager = null } = {}) {
        if (!sceneManager) throw new TypeError("GameManager requires a SceneManager.");
        this.sceneManager = sceneManager;
        this.saveManager = saveManager;
        this.globalState = createInitialGameState();
    }

    start(initialScene = "title", context = {}) {
        return this.sceneManager.transitionTo(initialScene, context);
    }

    changeScene(sceneId, context = {}) {
        return this.sceneManager.transitionTo(sceneId, context);
    }

    save(slot = "autosave") {
        return this.saveManager?.save?.(slot, this.globalState) ?? false;
    }

    newGame() {
        this.globalState = createInitialGameState();
        return this.globalState;
    }

    load(slot = "autosave") {
        const loaded = this.saveManager?.load?.(slot);
        if (!loaded) return false;
        this.globalState = normalizeGameState(loaded) || createInitialGameState();
        return true;
    }
}
