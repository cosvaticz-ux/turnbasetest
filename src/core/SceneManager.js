export class SceneManager {
    constructor() {
        this.scenes = new Map();
        this.currentSceneId = null;
        this.currentScene = null;
    }

    register(sceneId, scene) {
        if (!sceneId || !scene || typeof scene.enter !== "function") {
            throw new TypeError("A scene requires an id and enter() lifecycle method.");
        }
        this.scenes.set(sceneId, scene);
        return this;
    }

    transitionTo(sceneId, context = {}) {
        const nextScene = this.scenes.get(sceneId);
        if (!nextScene) throw new Error(`Unknown scene: ${sceneId}`);
        if (this.currentScene === nextScene) return false;

        this.currentScene?.exit?.({ nextSceneId: sceneId, ...context });
        const previousSceneId = this.currentSceneId;
        this.currentSceneId = sceneId;
        this.currentScene = nextScene;
        nextScene.enter({ previousSceneId, sceneManager: this, ...context });
        return true;
    }

    exitCurrent(context = {}) {
        if (!this.currentScene) return false;
        this.currentScene.exit?.(context);
        this.currentScene = null;
        this.currentSceneId = null;
        return true;
    }
}
