import { AssetResolver } from "../core/AssetResolver.js";
import { AssetPreloader } from "../core/AssetPreloader.js";
import { AudioManager } from "../core/AudioManager.js";
import { ASSET_PRELOAD_GROUP, getMapPreloadGroup } from "../data/assetPreloadGroups.js";
import { TITLE_SCREEN_CONTENT } from "../data/titleContent.js";

const TITLE_ACTION = Object.freeze({
    NEW_GAME: "new-game",
    CONTINUE: "continue",
    SETTINGS: "settings",
    EXIT: "exit"
});

let elements = null;
let menuButtons = [];
let selectedIndex = 0;
let sceneContext = null;
let sceneActive = false;
let mapTransitionTimer = null;

const TITLE_TO_MAP_DELAY_MS = 650;
const NEW_GAME_LOADING_ENABLED = false;
const NEW_GAME_START_MIN_MS = 2500;

function getGameManager() {
    return sceneContext?.gameManager || sceneContext?.sceneManager?.services?.gameManager || null;
}

function getSaveManager() {
    return sceneContext?.saveManager || sceneContext?.sceneManager?.services?.saveManager || null;
}

function getElements() {
    return {
        screen: document.getElementById("title-screen"),
        background: document.getElementById("title-background"),
        illustration: document.getElementById("title-illustration"),
        illustrationPlaceholder: document.getElementById("title-illustration-placeholder"),
        menu: document.getElementById("title-menu"),
        status: document.getElementById("title-menu-status"),
        studioLabel: document.querySelector?.(".title-studio-label") || null,
        title: document.getElementById("title-game-name"),
        version: document.getElementById("title-version"),
        gameStartScreen: document.getElementById("game-start-screen"),
        gameStartStatus: document.getElementById("game-start-status"),
        gameStartProgress: document.getElementById("game-start-progress"),
        gameStartFill: document.getElementById("game-start-progress-fill"),
        gameStartPercentage: document.getElementById("game-start-percentage"),
        settingsPanel: document.getElementById("settings-panel"),
        settingsMaster: document.getElementById("settings-master"),
        settingsMasterOutput: document.getElementById("settings-master-output"),
        settingsSfx: document.getElementById("settings-sfx"),
        settingsSfxOutput: document.getElementById("settings-sfx-output"),
        settingsGrain: document.getElementById("settings-grain"),
        settingsEffects: document.getElementById("settings-effects"),
        settingsClose: document.getElementById("settings-close")
    };
}

function hasContinueSave() {
    return Boolean(getSaveManager()?.load?.("autosave"));
}

function setStatus(message = "") {
    if (elements?.status) elements.status.textContent = message;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function presentGameStartProgress(progress = {}) {
    const percentage = Math.max(0, Math.min(100, progress.percentage || 0));
    if (elements?.gameStartFill) elements.gameStartFill.style.width = `${percentage}%`;
    if (elements?.gameStartPercentage) elements.gameStartPercentage.textContent = `${percentage}%`;
    if (elements?.gameStartProgress) {
        elements.gameStartProgress.setAttribute("aria-valuenow", String(percentage));
        elements.gameStartProgress.dataset.loadedAssets = String(progress.loaded || 0);
        elements.gameStartProgress.dataset.failedAssets = String(progress.failed || 0);
    }
}

function showGameStartScreen() {
    const screen = elements?.gameStartScreen;
    if (!screen) return null;
    screen.hidden = false;
    screen.classList.remove("is-complete");
    if (elements.gameStartStatus) elements.gameStartStatus.textContent = "Loading...";
    presentGameStartProgress({ percentage: 0, loaded: 0, failed: 0 });
    return screen;
}

async function hideGameStartScreen(screen) {
    if (!screen) return;
    screen.classList.add("is-complete");
    await wait(220);
    screen.hidden = true;
    screen.classList.remove("is-complete");
}

function setSelectedIndex(index, { playSound = false } = {}) {
    if (!menuButtons.length) return false;
    const nextIndex = Math.max(0, Math.min(index, menuButtons.length - 1));
    if (nextIndex === selectedIndex && menuButtons[nextIndex]?.classList.contains("is-selected")) return false;
    selectedIndex = nextIndex;
    menuButtons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === selectedIndex;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-current", selected ? "true" : "false");
        if (selected) button.focus?.({ preventScroll: true });
    });
    if (playSound) AudioManager.playEvent("menuMove");
    return true;
}

function moveSelection(direction) {
    if (!menuButtons.length) return false;
    let nextIndex = selectedIndex;
    for (let step = 0; step < menuButtons.length; step += 1) {
        nextIndex = (nextIndex + direction + menuButtons.length) % menuButtons.length;
        if (!menuButtons[nextIndex].disabled) return setSelectedIndex(nextIndex, { playSound: true });
    }
    return false;
}

function getTargetMapId(context = {}) {
    return context.continued
        ? getGameManager()?.globalState?.mapPosition?.mapId || "front-forest"
        : "front-forest";
}

async function runNewGameStart(context = {}) {
    if (!NEW_GAME_LOADING_ENABLED) {
        // Load destination assets before entering exploration.
        try {
            await AssetPreloader.loadGroup(ASSET_PRELOAD_GROUP.NEW_GAME_START);
        } catch (error) {
            console.warn("[Preloader] New Game preload failed:", error);
        }
        sceneContext?.sceneManager?.transitionTo?.("map", context);
        return;
    }

    const startedAt = performance.now();
    const loadingScreen = showGameStartScreen();
    const unsubscribe = AssetPreloader.subscribe(progress => {
        if (progress.groupName !== ASSET_PRELOAD_GROUP.NEW_GAME_START) return;
        presentGameStartProgress(progress);
    });

    let result;
    try {
        result = await AssetPreloader.loadGroup(ASSET_PRELOAD_GROUP.NEW_GAME_START);
    } catch (error) {
        console.warn("[Preloader] New Game preload failed:", error);
        result = { percentage: 100, loaded: 0, failed: 1 };
    } finally {
        unsubscribe();
    }

    presentGameStartProgress({ ...result, percentage: 100 });
    if (elements?.gameStartStatus) {
        elements.gameStartStatus.textContent = result.failed > 0
            ? "Loaded with fallback assets"
            : "Ready";
    }

    const elapsed = performance.now() - startedAt;
    await wait(Math.max(0, NEW_GAME_START_MIN_MS - elapsed));

    /* Reserved transition point for the future opening cutscene.
     * Replace the direct map transition with IntroScene when that scene exists. */
    sceneContext?.sceneManager?.transitionTo?.("map", context);
    await hideGameStartScreen(loadingScreen);
}

function queueMapTransition(context = {}) {
    if (!sceneActive || mapTransitionTimer !== null) return false;
    AudioManager.playEvent("menuConfirm");
    const targetMapId = getTargetMapId(context);
    sceneActive = false;
    menuButtons.forEach(button => { button.disabled = true; });
    mapTransitionTimer = setTimeout(async () => {
        mapTransitionTimer = null;
        if (context.fromNewGame) {
            await runNewGameStart(context);
            return;
        }
        const targetGroup = getMapPreloadGroup(targetMapId) || ASSET_PRELOAD_GROUP.FRONT_FOREST;
        if (typeof globalThis.Image === "function"
            && !AssetPreloader.isGroupLoaded(targetGroup)) {
            setStatus(`Preparing ${String(targetMapId || "front-forest").replace(/-/g, " ")}...`);
            await AssetPreloader.loadGroup(targetGroup);
        }
        sceneContext?.sceneManager?.transitionTo?.("map", context);
    }, TITLE_TO_MAP_DELAY_MS);
    return true;
}

function startBattle() {
    getGameManager()?.newGame?.();
    AudioManager.setSettings(getGameManager()?.globalState?.settings);
    return queueMapTransition({ fromNewGame: true });
}

function continueGame() {
    if (!getGameManager()?.load?.("autosave")) {
        setStatus("No usable save data was found.");
        refreshContinueState();
        AudioManager.playEvent("menuCancel");
        return false;
    }
    AudioManager.setSettings(getGameManager()?.globalState?.settings);
    return queueMapTransition({ continued: true });
}

function presentSettings() {
    const settings = getGameManager()?.globalState?.settings;
    if (!settings || !elements?.settingsPanel) return false;
    if (elements.settingsMaster) elements.settingsMaster.value = String(settings.masterVolume);
    if (elements.settingsSfx) elements.settingsSfx.value = String(settings.sfxVolume);
    if (elements.settingsGrain) elements.settingsGrain.checked = settings.filmGrain !== false;
    if (elements.settingsEffects) elements.settingsEffects.value = settings.screenEffects;
    if (elements.settingsMasterOutput) elements.settingsMasterOutput.textContent = `${Math.round(settings.masterVolume * 100)}%`;
    if (elements.settingsSfxOutput) elements.settingsSfxOutput.textContent = `${Math.round(settings.sfxVolume * 100)}%`;
    return true;
}

function applySettingsControls() {
    const gameManager = getGameManager();
    if (!gameManager?.globalState?.settings) return false;
    const settings = gameManager.globalState.settings;
    settings.masterVolume = Number(elements.settingsMaster?.value ?? settings.masterVolume);
    settings.sfxVolume = Number(elements.settingsSfx?.value ?? settings.sfxVolume);
    settings.filmGrain = elements.settingsGrain?.checked !== false;
    settings.screenEffects = elements.settingsEffects?.value === "low" ? "low" : "high";
    AudioManager.setSettings(settings);
    getSaveManager()?.save?.("settings", gameManager.globalState);
    presentSettings();
    return true;
}

function closeSettings() {
    if (!elements?.settingsPanel || elements.settingsPanel.hidden) return false;
    elements.settingsPanel.hidden = true;
    menuButtons.forEach(button => { button.disabled = button.dataset.titleAction === TITLE_ACTION.CONTINUE && !hasContinueSave(); });
    setSelectedIndex(selectedIndex);
    return true;
}

function openSettingsPlaceholder() {
    AudioManager.playEvent("menuConfirm");
    if (!elements?.settingsPanel) {
        setStatus("Settings will be added in a later phase for this display.");
        return true;
    }
    presentSettings();
    elements.settingsPanel.hidden = false;
    menuButtons.forEach(button => { button.disabled = true; });
    elements.settingsMaster?.focus?.();
    return true;
}

function requestBrowserExit() {
    AudioManager.playEvent("menuConfirm");
    try {
        globalThis.close?.();
    } catch {
        // Browsers normally block close() for tabs that were not opened by script.
    }
    setStatus("Close this browser tab to exit the demo.");
    return true;
}

function activate(actionId) {
    if (!sceneActive) return false;
    const actionButton = menuButtons.find(button => button.dataset.titleAction === actionId);
    if (actionButton?.disabled) return false;
    if (actionId === TITLE_ACTION.NEW_GAME) return startBattle();
    if (actionId === TITLE_ACTION.CONTINUE) return continueGame();
    if (actionId === TITLE_ACTION.SETTINGS) return openSettingsPlaceholder();
    if (actionId === TITLE_ACTION.EXIT) return requestBrowserExit();
    return false;
}

function createMenuButton(item, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "title-menu-item";
    button.dataset.titleAction = item.id;
    button.disabled = Boolean(item.requiresSave && !hasContinueSave());

    const leftArrow = document.createElement("span");
    leftArrow.className = "title-menu-arrow title-menu-arrow-left";
    leftArrow.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "title-menu-label";
    label.textContent = item.label;
    const rightArrow = document.createElement("span");
    rightArrow.className = "title-menu-arrow title-menu-arrow-right";
    rightArrow.setAttribute("aria-hidden", "true");
    button.append(leftArrow, label, rightArrow);

    button.addEventListener("pointerenter", () => {
        if (!button.disabled) setSelectedIndex(index, { playSound: index !== selectedIndex });
    });
    button.addEventListener("focus", () => {
        if (!button.disabled) setSelectedIndex(index);
    });
    button.addEventListener("click", () => activate(item.id));
    return button;
}

function buildMenu() {
    if (!elements?.menu) return false;
    menuButtons = TITLE_SCREEN_CONTENT.menuItems.map(createMenuButton);
    elements.menu.replaceChildren(...menuButtons);
    const firstEnabledIndex = menuButtons.findIndex(button => !button.disabled);
    selectedIndex = Math.max(0, firstEnabledIndex);
    setSelectedIndex(selectedIndex);
    return true;
}

function refreshContinueState() {
    const continueButton = menuButtons.find(button => button.dataset.titleAction === TITLE_ACTION.CONTINUE);
    if (!continueButton) return;
    continueButton.disabled = !hasContinueSave();
    if (elements?.screen) elements.screen.dataset.continueAvailable = String(!continueButton.disabled);
    continueButton.setAttribute(
        "aria-label",
        continueButton.disabled ? "Continue, unavailable because no save data exists" : "Continue"
    );
    if (continueButton.disabled && menuButtons[selectedIndex] === continueButton) {
        const firstEnabledIndex = menuButtons.findIndex(button => !button.disabled);
        if (firstEnabledIndex >= 0) setSelectedIndex(firstEnabledIndex);
    }
}

function configureAssets() {
    if (!elements) return;
    const backgroundPath = TITLE_SCREEN_CONTENT.backgroundAssetAvailable
        ? AssetResolver.titleBackground(TITLE_SCREEN_CONTENT.backgroundId, {
            extension: TITLE_SCREEN_CONTENT.backgroundExtension
        })
        : null;
    elements.background?.style.setProperty(
        "--title-background-image",
        backgroundPath ? `url("${backgroundPath}")` : "none"
    );
    elements.screen?.classList.toggle("has-title-background", Boolean(backgroundPath));

    const illustrationPath = TITLE_SCREEN_CONTENT.illustrationAssetAvailable
        ? AssetResolver.titleScreen(TITLE_SCREEN_CONTENT.illustrationId, {
            extension: TITLE_SCREEN_CONTENT.illustrationExtension
        })
        : null;
    if (elements.illustration) {
        elements.illustration.hidden = !illustrationPath;
        if (illustrationPath) elements.illustration.src = illustrationPath;
        else elements.illustration.removeAttribute?.("src");
        elements.illustration.onerror = () => {
            elements.illustration.hidden = true;
            elements.illustrationPlaceholder.hidden = false;
            elements.screen?.classList.remove("has-title-illustration");
        };
    }
    if (elements.illustrationPlaceholder) elements.illustrationPlaceholder.hidden = Boolean(illustrationPath);
    elements.screen?.classList.toggle("has-title-illustration", Boolean(illustrationPath));
}

function handleKeyDown(event) {
    if (!sceneActive) return false;
    const key = String(event.key || "").toLowerCase();
    if (elements?.settingsPanel && !elements.settingsPanel.hidden) {
        if (key === "escape" || key === "enter") {
            closeSettings();
            event.preventDefault?.();
            return true;
        }
        return false;
    }
    const mapped = ["arrowup", "arrowdown", "w", "s", "enter", " "].includes(key);
    if (event.repeat) {
        if (mapped) event.preventDefault?.();
        return false;
    }
    let handled = false;
    if (key === "arrowup" || key === "w") handled = moveSelection(-1);
    else if (key === "arrowdown" || key === "s") handled = moveSelection(1);
    else if (key === "enter" || key === " ") handled = activate(menuButtons[selectedIndex]?.dataset.titleAction);
    if (handled) event.preventDefault?.();
    return handled;
}

function applyContent() {
    if (elements.studioLabel) elements.studioLabel.textContent = TITLE_SCREEN_CONTENT.studioLabel;
    if (elements.title) elements.title.textContent = TITLE_SCREEN_CONTENT.title;
    if (elements.version) elements.version.textContent = TITLE_SCREEN_CONTENT.versionLabel;
}

function preloadLikelyNextScenes() {
    // Keep the title lightweight. Heavy map/battle assets start after New Game.
}

export const TitleScene = {
    enter(context = {}) {
        sceneContext = context;
        elements = getElements();
        if (!elements.screen || !elements.menu) return false;
        sceneActive = true;
        elements.screen.hidden = false;
        const gameManager = getGameManager();
        const savedSettings = getSaveManager()?.load?.("settings")?.settings;
        if (savedSettings && gameManager?.globalState) {
            gameManager.globalState.settings = { ...savedSettings };
        }
        AudioManager.setSettings(gameManager?.globalState?.settings);
        applyContent();
        configureAssets();
        buildMenu();
        refreshContinueState();
        setStatus("");
        preloadLikelyNextScenes();
        document.addEventListener("keydown", handleKeyDown);
        elements.settingsMaster?.addEventListener?.("input", applySettingsControls);
        elements.settingsSfx?.addEventListener?.("input", applySettingsControls);
        elements.settingsGrain?.addEventListener?.("change", applySettingsControls);
        elements.settingsEffects?.addEventListener?.("change", applySettingsControls);
        elements.settingsClose?.addEventListener?.("click", closeSettings);
        return true;
    },

    exit(context = {}) {
        sceneActive = false;
        if (mapTransitionTimer !== null) {
            clearTimeout(mapTransitionTimer);
            mapTransitionTimer = null;
        }
        document.removeEventListener?.("keydown", handleKeyDown);
        elements?.settingsMaster?.removeEventListener?.("input", applySettingsControls);
        elements?.settingsSfx?.removeEventListener?.("input", applySettingsControls);
        elements?.settingsGrain?.removeEventListener?.("change", applySettingsControls);
        elements?.settingsEffects?.removeEventListener?.("change", applySettingsControls);
        elements?.settingsClose?.removeEventListener?.("click", closeSettings);
        if (elements?.settingsPanel) elements.settingsPanel.hidden = true;
        if (elements?.screen) elements.screen.hidden = true;
        // The destination track starts after its preload completes. Preserve it
        // when TitleScene hands control to the map.
        if (context.nextSceneId !== "map") AudioManager.stopExplorationAudio();
        menuButtons = [];
        sceneContext = null;
        return true;
    },

    activate,
    handleKeyDown,
    moveSelection,
    refreshContinueState,
    getSelectedAction() {
        return menuButtons[selectedIndex]?.dataset.titleAction || null;
    }
};

export { TITLE_ACTION };
