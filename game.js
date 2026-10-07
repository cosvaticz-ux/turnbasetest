import { GameManager } from "./src/core/GameManager.js";
import { AssetPreloader } from "./src/core/AssetPreloader.js";
import { resolveInitialScene } from "./src/core/InitialSceneResolver.js";
import { SaveManager } from "./src/core/SaveManager.js";
import { SceneManager } from "./src/core/SceneManager.js";
import { BattleScene } from "./src/scenes/BattleScene.js";
import { BattleSummaryScene } from "./src/scenes/BattleSummaryScene.js";
import { MapBlockoutScene } from "./src/scenes/MapBlockoutScene.js";
import { MapEditorScene } from "./src/scenes/MapEditorScene.js";
import { MapScene } from "./src/scenes/MapScene.js";
import { TitleScene } from "./src/scenes/TitleScene.js";
import { ASSET_PRELOAD_GROUP } from "./src/data/assetPreloadGroups.js";
import { installDialogueTypewriter } from "./src/ui/DialogueTypewriter.js";
import { installEquipmentMenuSkin } from "./src/ui/EquipmentMenuSkin.js";
import { installInventoryInteractionMenu } from "./src/ui/InventoryInteractionMenu.js";
import { installEquipmentMenuPolish } from "./src/ui/EquipmentMenuPolish.js";
import { installStandaloneItemCrop } from "./src/ui/StandaloneItemCrop.js";
import { installInventoryFilterTabNavigation } from "./src/ui/InventoryFilterTabNavigation.js";
import { installUnifiedLoadoutMenu } from "./src/ui/UnifiedLoadoutMenu.js";
import { installQuestBoard } from "./src/ui/QuestBoard.js";

globalThis.LITANIA_RUNTIME_MODE = "demo";

const sceneManager = new SceneManager();
const saveManager = new SaveManager();
const gameManager = new GameManager({ sceneManager, saveManager });
sceneManager.services = { gameManager, saveManager, audioManager: null };

sceneManager
    .register("title", TitleScene)
    .register("mapBlockout", MapBlockoutScene)
    .register("mapEditor", MapEditorScene)
    .register("map", MapScene)
    .register("battle", BattleScene)
    .register("battleSummary", BattleSummaryScene);

const dialogueTypewriter = installDialogueTypewriter();
const equipmentMenuSkin = installEquipmentMenuSkin({ gameManager });
const inventoryInteractionMenu = installInventoryInteractionMenu({ gameManager });
const equipmentMenuPolish = installEquipmentMenuPolish({ gameManager });
const standaloneItemCrop = installStandaloneItemCrop();
const inventoryFilterTabNavigation = installInventoryFilterTabNavigation();
const unifiedLoadoutMenu = installUnifiedLoadoutMenu({ gameManager });
const questBoard = installQuestBoard({ gameManager });

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function applyDemoRuntimePresentation() {
    const campaignHud = document.querySelector?.(".map-campaign-hud");
    if (campaignHud) {
        campaignHud.hidden = true;
        campaignHud.style.display = "none";
    }
    const startKicker = document.querySelector?.(".game-start-kicker");
    const startChapter = document.querySelector?.(".game-start-chapter");
    if (startKicker) startKicker.textContent = "Core Systems Demo";
    if (startChapter) startChapter.textContent = "— FRONT FOREST —";
}

async function revealInitialScene() {
    const overlay = document.getElementById("loading-screen");
    if (!overlay) return;

    if (typeof globalThis.requestAnimationFrame === "function") {
        await new Promise(resolve => {
            globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve));
        });
    }

    overlay.classList.add("is-complete");
    await wait(1800);
    overlay.hidden = true;
}

async function boot() {
    applyDemoRuntimePresentation();
    const initialScene = resolveInitialScene(globalThis.location?.search);
    const overlay = document.getElementById("loading-screen");
    if (overlay) {
        overlay.hidden = false;
        overlay.classList.remove("is-complete");
    }

    try {
        await AssetPreloader.loadGroup(ASSET_PRELOAD_GROUP.BOOT_CRITICAL);
    } catch (error) {
        console.warn("[Preloader] Initial preload failed:", error);
    }

    const started = gameManager.start(initialScene, { gameManager, saveManager });
    await revealInitialScene();
    return started;
}

const bootPromise = boot();

export {
    boot,
    bootPromise,
    dialogueTypewriter,
    equipmentMenuSkin,
    inventoryInteractionMenu,
    equipmentMenuPolish,
    standaloneItemCrop,
    inventoryFilterTabNavigation,
    unifiedLoadoutMenu,
    questBoard,
    gameManager,
    resolveInitialScene,
    saveManager,
    sceneManager
};
export * from "./src/scenes/BattleScene.js";
