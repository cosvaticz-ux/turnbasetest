import { RewardResolver } from '../core/RewardResolver.js';
import { EXPLORATION_MAPS, normalizeExplorationPosition } from '../data/explorationMaps.js';
import { getExplorationExits } from '../data/greyboxWarpCalibration.js';
import { pointInRegion, distanceBetween } from '../core/WalkableGeometry.js';
import { WalkablePlayerController } from './map/LanePlayerController.js';
import { FixedExplorationCamera } from './map/LaneCameraController.js';
import { WalkableEncounterController } from './map/LaneEncounterController.js';
import { ExplorationMapRenderer } from './map/LaneMapRenderer.js';
import { createLaneMapUI } from './map/LaneMapUI.js';
import { ENCOUNTERS } from '../data/encounters.js';
import { AudioManager } from '../core/AudioManager.js';
import { AssetPreloader } from '../core/AssetPreloader.js';
import { ASSET_PRELOAD_GROUP } from '../data/assetPreloadGroups.js';
import { AssetResolver } from '../core/AssetResolver.js';

let context, ui, player, camera, encounters, renderer, frame, last = 0, active = false, pending = false, timer;
let debug = false;
let generation = 0;
const keys = new Set();
const state = () => (context?.gameManager || context?.sceneManager?.services?.gameManager)?.globalState;
const clearInput = () => keys.clear();

function setDebug(enabled) {
    debug = Boolean(enabled);
    renderer?.setDebugVisible(debug);
    ui?.elements?.screen?.classList.toggle('map-debug-visible', debug);
}

function persistWorldState() {
    if (!state() || !player) return;
    state().mapPosition = { ...player.position, facing: player.facing };
    (context.gameManager || context.sceneManager?.services?.gameManager)?.save?.('autosave');
}

function load(position) {
    renderer?.dispose();
    const normalized = normalizeExplorationPosition(position);
    const map = EXPLORATION_MAPS[normalized.mapId];
    player = new WalkablePlayerController(map, normalized);
    if (['north', 'south', 'east', 'west'].includes(position?.facing)) player.facing = position.facing;
    camera = new FixedExplorationCamera(map);
    encounters = new WalkableEncounterController(map, state()?.completedEncounters || []);
    const initialDebug = false;
    renderer = new ExplorationMapRenderer(ui.elements.viewport, map, encounters.enemies, initialDebug);
    setDebug(initialDebug);
    ui.elements.mapName.textContent = map.name;
    persistWorldState();
}

function fade(on) {
    const overlay = ui.elements.transitionOverlay;
    if (on) { overlay.hidden = false; void overlay.offsetWidth; }
    overlay.classList.toggle('is-active', on);
}

function exitMap(exit) {
    const exitGeneration = generation;
    pending = true;
    clearInput();
    fade(true);
    timer = setTimeout(async () => {
        try { await AssetPreloader.loadGroup(exit.targetMap); }
        catch (error) { console.warn('[Exploration] Map preload fallback', error); }
        if (!active || generation !== exitGeneration) return;
        load({ mapId: exit.targetMap, spawnId: exit.targetSpawn, ...exit.target, facing: exit.targetFacing });
        fade(false);
        timer = setTimeout(() => {
            if (!active || generation !== exitGeneration) return;
            ui.elements.transitionOverlay.hidden = true;
            pending = false;
        }, 180);
    }, 220);
}

function triggerEncounter(enemy) {
    if (pending || !active) return;
    const definition = ENCOUNTERS.find(entry => entry.id === enemy.encounterId) || enemy;
    const encounterGeneration = generation;
    pending = true;
    clearInput();
    persistWorldState();
    AudioManager.playEvent('encounter');
    ui.elements.encounterOverlay.hidden = false;
    ui.elements.encounterOverlay.classList.add('is-active');
    timer = setTimeout(async () => {
        try { await Promise.all([ASSET_PRELOAD_GROUP.BATTLE_COMMON, ASSET_PRELOAD_GROUP.HIGHWAYMAN_BATTLE].map(group => AssetPreloader.loadGroup(group))); }
        catch (error) { console.warn('[Exploration] Battle preload fallback', error); }
        if (!active || generation !== encounterGeneration) return;
        const encounterId = enemy.random ? `${enemy.id}:${globalThis.crypto.randomUUID()}` : enemy.id;
        context.sceneManager.transitionTo('battle', {
            encounterId, enemyId: definition.enemyId || 'highwayman', enemyCount: 1,
            preparePhase: definition.preparePhase || null, persistEncounterCompletion: !enemy.random,
            returnSceneId: 'map', mapReturnNodeId: player.position.mapId,
            mapReturnPosition: { ...player.position }, mapReturnFacing: player.facing
        });
    }, 1500);
}

function nearby() {
    return player.map.interactables.find(item =>
        (!item.onceFlag || !state()?.story.flags[item.onceFlag]) && distanceBetween(item, player.position) < 95
    );
}

function prompt() {
    const item = nearby();
    const label = item?.type === 'sign' ? 'Interact' : item?.name;
    ui.elements.interactionPrompt.textContent = item ? `[E / Space] ${label}` : '';
    ui.elements.interactionPrompt.hidden = !item || ui.isOpen() || pending;
}

function dialoguePresentation(item) {
    const portraitAssetId = item.dialoguePortraitAssetId
        || item.portraitAssetId
        || (item.type === 'npc' ? item.assetId : null);
    return {
        speakerName: item.name,
        dialoguePortrait: item.dialoguePortrait
            || (portraitAssetId ? AssetResolver.npcSprite(portraitAssetId) : null)
    };
}

function movementInput() {
    const pressed = (...names) => names.some(name => keys.has(name));
    return {
        x: Number(pressed('d', 'arrowright')) - Number(pressed('a', 'arrowleft')),
        y: Number(pressed('s', 'arrowdown')) - Number(pressed('w', 'arrowup'))
    };
}

function keydown(event) {
    if (!active) return;
    const key = event.key.toLowerCase();
    if (ui.isOpen()) { clearInput(); ui.handleKey(event); return; }
    if (key === 'f2' && !event.repeat) {
        setDebug(!debug);
        event.preventDefault();
        return;
    }
    if (pending) return;
    if (['tab', 'b', 'k'].includes(key)) { ui.handleKey(event); return; }
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) {
        keys.add(key);
        event.preventDefault();
        return;
    }
    if (!['e', ' ', 'enter'].includes(key) || event.repeat) return;
    event.preventDefault();
    const item = nearby();
    if (!item) return;
    clearInput();
    if (item.type === 'shop') ui.field.openShop();
    else ui.dialogue.openDialogue(item.dialogueId, dialoguePresentation(item), () => {
        if (item.rewards && state()) {
            new RewardResolver(state()).apply(item.rewards);
            if (item.onceFlag) state().story.flags[item.onceFlag] = true;
            persistWorldState();
        }
    });
}

function keyup(event) { keys.delete(event.key.toLowerCase()); }

function update(time) {
    if (!active) return;
    const dt = last ? Math.min((time - last) / 1000, 0.1) : 0;
    last = time;
    if (!pending && !ui.isOpen()) {
        const travelled = player.update(dt, movementInput());
        const exit = getExplorationExits(player.map).find(candidate => pointInRegion(player.position, candidate));
        if (exit) exitMap(exit);
        if (!pending) {
            const enemy = encounters.update(dt, player, travelled);
            if (enemy) triggerEncounter(enemy);
        }
    } else player.moving = false;
    const viewport = ui.elements.viewport;
    camera.update(player.pose(), viewport.clientWidth || 1280, viewport.clientHeight || 720);
    renderer.update(player, camera, dt, state()?.party);
    prompt();
    ui.elements.coordinates.textContent = debug
        ? `${player.position.mapId} · X ${player.position.x.toFixed(1)} Y ${player.position.y.toFixed(1)}`
        : '';
    frame = requestAnimationFrame(update);
}

export const MapScene = {
    enter(next = {}) {
        generation += 1;
        context = next;
        active = true;
        pending = false;
        last = 0;
        debug = false;
        clearInput();
        ui = createLaneMapUI({ getGameState: state, isActive: () => active, isTransitionPending: () => pending, clearInput, persistWorldState, triggerEncounter });
        if (!ui.elements.screen) { active = false; return false; }
        if (next.battleResult === 'victory' && next.encounterId && next.persistEncounterCompletion !== false && state() && !state().completedEncounters.includes(next.encounterId)) {
            state().completedEncounters.push(next.encounterId);
        }
        ui.elements.screen.hidden = false;
        ui.elements.screen.classList.remove('lane-exploration');
        ui.elements.screen.classList.add('greybox-exploration');
        document.body.classList.add('greybox-exploration-active');
        const shouldResume = next.continued || next.previousSceneId === 'battle' || next.previousSceneId === 'battleSummary';
        load(next.resumePosition || (shouldResume ? state()?.mapPosition : {}));
        fade(false);
        ui.elements.encounterOverlay.hidden = true;
        ui.elements.encounterOverlay.classList.remove('is-active');
        document.addEventListener('keydown', keydown);
        document.addEventListener('keyup', keyup);
        globalThis.addEventListener('blur', clearInput);
        frame = requestAnimationFrame(update);
        return true;
    },
    exit() {
        persistWorldState();
        active = false;
        pending = false;
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        clearInput();
        document.removeEventListener('keydown', keydown);
        document.removeEventListener('keyup', keyup);
        globalThis.removeEventListener('blur', clearInput);
        ui.dispose();
        renderer.dispose();
        renderer = null;
        setDebug(false);
        ui.elements.screen.classList.remove('greybox-exploration');
        ui.elements.screen.classList.remove('map-debug-visible');
        document.body.classList.remove('greybox-exploration-active');
        ui.elements.screen.hidden = true;
        AudioManager.stopExplorationAudio();
        return true;
    },
    getCurrentMapNodeId: () => player?.position.mapId,
    inspectExploration: () => ({
        position: { ...player?.position },
        transition: pending,
        debug,
        camera: camera ? { x: camera.x, y: camera.y, zoom: camera.zoom } : null,
        enemies: encounters?.enemies.map(enemy => ({ ...enemy }))
    })
};
