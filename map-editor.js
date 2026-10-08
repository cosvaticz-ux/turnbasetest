import { MapEditorScene } from "./src/scenes/MapEditorScene.js";

function startMapEditor() {
    const started = MapEditorScene.enter();
    if (!started) {
        const status = document.getElementById("map-editor-status");
        if (status) status.textContent = "Map Editor failed to start.";
        console.error("[MapEditor] Required editor DOM was not found.");
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startMapEditor, { once: true });
} else {
    startMapEditor();
}

globalThis.addEventListener("beforeunload", () => {
    MapEditorScene.exit();
});
