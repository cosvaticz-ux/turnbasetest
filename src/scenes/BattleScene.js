import { createBattleSummaryPresentation } from "./battle/BattleSummaryPresentation.js";
import { createBattleEffectPresentation } from "./battle/BattleEffectPresentation.js";
import { createBattleAnimationDirector } from "./battle/BattleAnimationDirector.js";
import { createBattleCommandPresentation } from "./battle/BattleCommandPresentation.js";
import { createBattleActorPresentation } from "./battle/BattleActorPresentation.js";
import { AudioManager } from "../core/AudioManager.js";
import { AssetResolver } from "../core/AssetResolver.js";
import { BattleManager } from "../battle/BattleManager.js";
import { BATTLE_PHASE, BattleFlowManager } from "../battle/BattleFlowManager.js";
import { createBattleCamera } from "../battle/BattleCamera.js";
import { BATTLE_INPUT_ACTION, BattleInputManager } from "../battle/BattleInput.js";
import { applyResolvedDamage, hitFeedbackSuffix, resolveCombatDamage, resolvePropertyMultiplier } from "../battle/CombatResolver.js";
import {
    findNextLivingIndex,
    FORMATION_SLOTS,
    getFormationSlot,
    getLivingEntities
} from "../battle/BattleFormation.js";
import { StatusEffectManager } from "../battle/StatusEffectManager.js";
import {
    getNormalBattleItemEntries,
    PreparePhaseManager
} from "../battle/PreparePhaseManager.js";
import { selectEnemyActionTarget, TargetManager } from "../battle/TargetManager.js";
import { TurnManager } from "../battle/TurnManager.js";
import {
    getLevelExpRequirement,
    getRankProgress
} from "../core/Progression.js";
import { MasteryManager } from "../core/MasteryManager.js";
import { BattleVictoryResolver } from "../core/BattleVictoryResolver.js";
import { DownStateManager } from "../core/DownStateManager.js";
import { TechniqueResolver } from "../core/TechniqueResolver.js";
import { SkillEffectResolver } from "../core/SkillEffectResolver.js";
import { ClassCombat, initializeClassCombat, clearClassCombat } from "../core/ClassCombat.js";
import { getActiveClassSkills, getSkillTier } from "../core/ClassSystem.js";
import { AMMUNITION, CLASS_BALANCE, CLASS_SKILLS } from "../data/classSkills.js";
import { getEquippedWeapon } from "../data/weapons.js";
import {
    createEncounterEnemies,
    createPartyCombatants,
    createPrototypeBattleContent,
    getBattleBackgroundForMap,
    ITEM_DEFINITIONS,
    UI_ICON_ASSETS
} from "../data/battleContent.js";
import { PREPARE_ACTION } from "../data/prepareActions.js";
import { createBattleLog } from "../ui/BattleLog.js";
import { createStatusTooltip } from "../ui/StatusTooltip.js";

const TURN = Object.freeze({ PLAYER: "player", ENEMY: "enemy", ENDED: "ended" });
const BATTLE_STATUS = Object.freeze({ ACTIVE: "active", FINISHED: "finished" });
const skillEffectResolver = new SkillEffectResolver();

const { player, dummy, enemy, highlandMan, party, enemies, skills, battle } = createPrototypeBattleContent();
const DEFAULT_BATTLE_ENEMIES = Object.freeze([enemy, highlandMan]);

function configureBattleEnemies(context = {}) {
    const nextEnemies = context.encounterId
        ? createEncounterEnemies(context.enemyId || "highwayman", context.enemyCount || 1)
        : [...DEFAULT_BATTLE_ENEMIES];
    enemies.splice(0, enemies.length, ...nextEnemies);
    return enemies;
}

function configureBattleParty(initialState = null) {
    if (!initialState?.party) return party;
    const nextParty = createPartyCombatants(initialState.party);
    if (nextParty.length) party.splice(0, party.length, ...nextParty);
    return party;
}

const elements = {
    battleScreen: document.getElementById("battle-screen"),
    battlefield: document.getElementById("battlefield"),
    battleCamera: document.getElementById("battle-camera"),
    battleWorldBackground: document.getElementById("battle-world-background"),
    battleHud: document.getElementById("battle-hud"),
    formationLayer: document.getElementById("formation-layer"),
    partyHudLayer: document.getElementById("party-hud-layer"),
    enemyHudLayer: document.getElementById("enemy-hud-layer"),
    battleMenu: document.getElementById("battle-menu"),
    turnText: document.getElementById("turn-text"),
    battleLog: document.getElementById("battle-log"),
    damageNumber: document.getElementById("damage-number"),
    fireballEffect: document.getElementById("fireball-effect"),
    icePikeEffect: document.getElementById("icepike-effect"),
    poisonEffect: document.getElementById("poison-effect"),
    turnPopup: document.getElementById("turn-popup"),
    turnPopupText: document.getElementById("turn-popup-text"),
    commandBox: document.getElementById("command-box"),
    commandCategoryTitle: document.getElementById("command-category-title"),
    previousCommandTab: document.getElementById("previous-command-tab"),
    nextCommandTab: document.getElementById("next-command-tab"),
    menuContent: document.getElementById("menu-content"),
    battleSummary: document.getElementById("battle-summary"),
    battleSummaryContent: document.getElementById("battle-summary-content"),
    battleSummaryNext: document.getElementById("battle-summary-next"),
    battleIntroOverlay: document.getElementById("battle-intro-overlay"),
    statusTooltip: document.getElementById("status-tooltip"),
    statusTooltipTitle: document.getElementById("status-tooltip-title"),
    statusTooltipLines: document.getElementById("status-tooltip-lines")
};

let battleSceneContext = null;
const battleManager = new BattleManager({
    party,
    enemies,
    activeStatus: BATTLE_STATUS.ACTIVE,
    finishedStatus: BATTLE_STATUS.FINISHED
});
const turnManager = new TurnManager({ playerSide: TURN.PLAYER, enemySide: TURN.ENEMY });
const targetManager = new TargetManager(enemies, opponent => getFormationSlot(opponent.formationSlot));
const statusEffectManager = new StatusEffectManager();
const preparePhaseManager = new PreparePhaseManager({ statusEffectManager });
const classCombat = new ClassCombat({
    statusManager: statusEffectManager,
    randomSource: () => Game.randomSource(),
    damage: (actor, target, profile) => applyDamageProfile(actor, target, profile, {
        statusMultiplier: target.isGuarding ? (target.guardDamageMultiplier || .5) : 1
    }),
    recordUse: (id, discipline) => Game.recordMasteryUse(id, discipline)
});
const battleFlowManager = new BattleFlowManager();
const downStateManager = new DownStateManager();
const techniqueResolver = new TechniqueResolver();
const battleLogView = createBattleLog(elements.battleLog);
const statusTooltipView = createStatusTooltip({
    tooltip: elements.statusTooltip,
    title: elements.statusTooltipTitle,
    lines: elements.statusTooltipLines
});
const CAMERA_RETURN_MS = 300;
const ACTION_WIDE_VIEW_DELAY_MS = 525;
const TURN_ANNOUNCEMENT_MS = 1450;
const RESULT_ANNOUNCEMENT_MS = 1850;
const BATTLE_INTRO_MS = 520;
const BATTLE_START_ANNOUNCEMENT_MS = 1000;

function getActivePlayer() {
    return Game.getActivePlayer() || player;
}

function getSelectedTarget() {
    return Game.getSelectedTarget() || getLivingEntities(enemies)[0] || null;
}

function configureResolvedAssets() {
    const effectElements = {
        fireball: elements.fireballEffect,
        "ice-pike": elements.icePikeEffect,
        poison: elements.poisonEffect
    };
    for (const skill of Object.values(skills)) {
        const effect = effectElements[skill.animationId];
        if (!effect) continue;
        effect.src = AssetResolver.skillEffect(skill.assetId || skill.id);
        if (effect.dataset.assetFallbackBound !== "true") {
            effect.addEventListener("error", () => {
                effect.hidden = true;
                effect.dataset.assetMissing = "true";
            });
            effect.dataset.assetFallbackBound = "true";
        }
    }
    const backgroundDefinition = getBattleBackgroundForMap(battleSceneContext?.mapReturnNodeId);
    const backgroundPath = backgroundDefinition
        ? AssetResolver.battleBackground(backgroundDefinition.id, {
            extension: backgroundDefinition.extension
        })
        : null;
    elements.battleWorldBackground?.style.setProperty(
        "--battle-background-image",
        backgroundPath ? `url("${backgroundPath}")` : "none"
    );
    if (elements.battleScreen) {
        elements.battleScreen.dataset.battleBackgroundMap = battleSceneContext?.mapReturnNodeId || "front-forest";
        elements.battleScreen.dataset.battleBackgroundId = backgroundDefinition?.id || "";
    }
}

const actorPresentation = createBattleActorPresentation({
    elements, party, enemies, configureResolvedAssets,
    getAnimationDirector: () => animationDirector, getEntityStatuses, statusTooltipView,
    updateCommandControlStates: canInput => updateCommandControlStates(canInput), BATTLE_STATUS, TURN,
    getActivePlayer: () => Game.getActivePlayer(), onTargetClick: id => Game.handleTargetClick(id),
    canTrackHud: () => Game.currentScene === "battle"
});
const {
    getEntityView,
    getPlayerAnimation,
    getPlayerFrame,
    getEnemyAnimation,
    getEnemyFrame,
    buildBattlePresentation,
    updateActiveActionHud,
    updateAllCharacterHuds,
    trackHudDuringCameraTransition,
    stopHudTracking
} = actorPresentation;

const animationDirector = createBattleAnimationDirector({
    party, enemies, getEntityView, getPlayerAnimation, getPlayerFrame, getEnemyAnimation, getEnemyFrame,
    isBattleScene: () => Game.currentScene === "battle",
    isBattleActive: () => Game.battleStatus === BATTLE_STATUS.ACTIVE
});
const {
    prepareEnemyStabilizationProfiles,
    startIdleAnimation,
    startEnemyIdleAnimation,
    stopEnemyIdleAnimation,
    stopEnemyHitAnimations,
    playEnemyAttackAnimation,
    playEnemyHitAnimation,
    stopPlayerAnimation,
    playPlayerPunch,
    playPlayerGuard,
    playPlayerCast
} = animationDirector;

const BattleCamera = createBattleCamera({
    cameraElement: elements.battleCamera,
    screenElement: elements.battleScreen,
    getFormationSlot,
    onCameraChanged() {
        updateAllCharacterHuds();
        trackHudDuringCameraTransition();
    }
});

const effects = createBattleEffectPresentation({
    elements, getEntityView, getEntityViews: actorPresentation.getViews, getSelectedTarget,
    hasActiveBattle: () => Game.hasActiveBattle(), isBattleScene: () => Game.currentScene === "battle",
    resetCommandTransition: () => commandPresentation.resetTransition(),
    statusTooltipView, TURN_ANNOUNCEMENT_MS
});
const {
    scheduleVisual,
    clearVisualTimers,
    hideTurnPopup,
    showTurnPopup,
    announceTurn,
    hideBattleIntroOverlay,
    prefersReducedMotion,
    playBattleScreenShake,
    resetBattleVisuals,
    playPunchHitEffect
} = effects;

function showDamageNumber(value, target = getSelectedTarget(), hitType = "normal", metadata = {}) {
    const source = metadata.source || Game.getActingPlayer();
    return effects.present({ type: "damage", value, target, hitType, source,
        weapon: source?.equipment ? getEquippedWeapon(source.equipment) : null,
        damageType: source?.basicAttack?.attackType, ...metadata });
}

function showFloatingCombatNumber(value, target, options = {}) {
    return effects.present({ type: options.type || "damage", value, target, ...options });
}

function getUnlockedSkillEntries() {
    const actor = getActivePlayer();
    return (actor.knownTechniques || actor.unlockedSkillIds)
        .map(skillId => [skillId, skills[skillId]])
        .filter(([, skill]) => Boolean(skill));
}

function resolveTechniqueAvailability(skillId) {
    const actor = getActivePlayer();
    const result = techniqueResolver.resolve(actor, skillId, { ...commandContext(), mode: "battle", ignoreResourceCosts: true });
    const cost = classCombat.getCost(actor, skills[skillId]);
    if (actor.ap < cost) result.reasons.push(`Requires ${cost} AP`);
    result.available = result.reasons.length === 0;
    return result;
}

function getBattleItemEntries() {
    return getNormalBattleItemEntries(getActivePlayer().battleItems);
}

function getPrepareCommandEntries() {
    return [...preparePhaseManager.getCommands({
        battleItems: getActivePlayer().battleItems,
        enemies
    }), ...classCombat.getPrepareCommands(party, skills)];
}

function getClassCommands() {
    const actor = getActivePlayer();
    return getActiveClassSkills(actor).filter(skill => skill.type === "active").flatMap(skill => {
        const targets = skill.targetType === "ally" ? party.filter(member => member.isAlive() && (skill.effect !== "protect" || member !== actor)) : [null];
        return targets.map(target => ({
            id: `class:${skill.id}:${target?.id || "target"}`, elementId: `class-${skill.id}-${target?.id || "target"}`, icon: skill.icon,
            name: `${skill.name} ${["I", "II", "III"][getSkillTier(actor,skill.id)-1]}${target ? ` → ${target.name}` : ""}`,
            costLabel: `${classCombat.availability(actor,skill.id,{party}).cost} AP`,
            isEnabled: () => classCombat.availability(actor,skill.id,{party,target}).available,
            disabledReason: () => classCombat.availability(actor,skill.id,{party,target}).reason,
            execute: button => {
                const check = classCombat.availability(actor,skill.id,{party});
                if (!check.available) return false;
                if (skill.targetType === "enemy") return Game.beginTargetSelection({type:"class-skill",skillId:skill.id,apCost:check.cost,actionElement:button});
                if (!Game.beginPlayerAction(check.cost,button)) return false;
                return Game.queuePlayerActionExecution(() => executeClassSkill(skill.id,target || actor));
            }
        }));
    });
}

function executeClassSkill(id, target) {
    const actor = Game.getActingPlayer();
    if (!actor || !Game.canResolvePlayerAction(0)) return Game.completePlayerAction({successful:false});
    const result = classCombat.execute(actor,id,target,{party,enemies});
    if (!result.executed) { if(result.reason)Game.addBattleLog(result.reason); return Game.completePlayerAction({successful:false}); }
    Game.addBattleLog(result.message);
    const presentationSkill = CLASS_SKILLS[id];
    if (!(result.events || []).length && presentationSkill?.effect !== "reload") {
        effects.present({ type: presentationSkill?.effect === "cleanse" ? "cleanse" : "buff", target, skill: presentationSkill });
    }
    for (const event of result.events || []) {
        if (event.healed) { showFloatingCombatNumber(event.healed,event.target,{type:"heal"}); Game.addBattleLog(`${event.target.name} recovers ${event.healed} HP.`); }
        else if (event.info) Game.addBattleLog(event.info);
        else { showDamageNumber(event.finalDamage || 0,event.target,event.hitType, { source: actor, skill: presentationSkill, skillId: id }); Game.addBattleLog(`${event.target.name}: ${event.hitType === "miss" ? "Miss" : `${event.finalDamage || 0} damage${hitFeedbackSuffix(event.hitType)}`}.`); }
    }
    Game.updateUI();
    if (!Game.getLivingEnemies().length) return Game.finishBattle("victory");
    Game.completePlayerAction({successful:true});
}

function commandContext() {
    return {
        player: getActivePlayer(),
        enemy: getSelectedTarget(),
        party,
        enemies,
        game: Game
    };
}

function chooseWeightedEnemyAction(opponent, randomSource = Math.random) {
    const actions = opponent?.ai?.actions?.filter(action => Number(action.weight) > 0) || [];
    if (!actions.length) return { type: "attack" };
    const total = actions.reduce((sum, action) => sum + Number(action.weight), 0);
    let roll = Math.max(0, Math.min(0.999999, Number(randomSource()) || 0)) * total;
    for (const action of actions) {
        roll -= Number(action.weight);
        if (roll < 0) return action;
    }
    return actions.at(-1) || { type: "attack" };
}

function getForcedEnemyTargetId(livingPlayers) {
    return livingPlayers.find(member => member.statusEffects?.some(status => (
        status?.id === "taunt" && status.remainingTurns !== 0
    )))?.id || null;
}

const commandCategoryDefinitions = Object.freeze([
    {
        id: "action",
        label: "Action",
        isAvailable: () => true,
        getCommands: () => Game.prepareTurnActive
            ? getPrepareCommandEntries().map(command => ({
                id: `prepare:${command.id}`,
                elementId: command.elementId,
                icon: command.icon,
                iconImage: command.iconImage || null,
                name: command.name,
                costLabel: command.costLabel,
                isEnabled: () => getPrepareCommandEntries()
                    .find(entry => entry.id === command.id)?.enabled === true,
                disabledReason: () => command.disabledReason || "Prepare action is unavailable",
                execute: () => Game.executePrepareAction(command.id)
            }))
            : [
            {
                id: "attack",
                elementId: "attack-button",
                icon: "⚔",
                iconImage: UI_ICON_ASSETS.actionPunch,
                name: getActivePlayer().basicAttack?.name || "Attack",
                costLabel: getEquippedWeapon(getActivePlayer().equipment).requiresReload ? `${classCombat.state(getActivePlayer()).loaded ? "Loaded" : "Unloaded"} · ${AMMUNITION[getActivePlayer().classState.ammoId]?.name || "Standard"}` : "",
                isEnabled: () => !classCombat.attackReason(getActivePlayer()),
                disabledReason: () => classCombat.attackReason(getActivePlayer()),
                execute: button => handleAttack(button)
            },
            {
                id: "guard",
                elementId: "guard-button",
                icon: "◆",
                iconImage: UI_ICON_ASSETS.actionGuard,
                name: "Guard",
                costLabel: "",
                isEnabled: () => !getActivePlayer().isGuarding,
                disabledReason: () => "Guard is already active",
                execute: button => Game.playerGuard(button)
            },
            {
                id: "endTurn",
                elementId: "end-turn-button",
                icon: "◯",
                name: "End Turn",
                costLabel: "+2 AP",
                isEnabled: () => true,
                execute: button => Game.endPlayerTurn(button)
            },
            ...(!getEquippedWeapon(getActivePlayer().equipment).requiresReload ? [] : [{
                id: "reload", elementId: "reload-button", icon: "↻", name: "Reload", costLabel: `${CLASS_BALANCE.reloadAp} AP`,
                isEnabled: () => !classCombat.state(getActivePlayer()).loaded && getActivePlayer().ap >= CLASS_BALANCE.reloadAp,
                disabledReason: () => classCombat.state(getActivePlayer()).loaded ? "Weapon is already loaded" : `Requires ${CLASS_BALANCE.reloadAp} AP`,
                execute: button => {
                    if (!Game.beginPlayerAction(CLASS_BALANCE.reloadAp,button)) return false;
                    return Game.queuePlayerActionExecution(() => { const actor=Game.getActingPlayer();const done=classCombat.reload(actor);if(done)Game.addBattleLog(`${actor.name} reloads.`);Game.updateUI();Game.completePlayerAction({successful:done}); });
                }
            }])
        ]
    },
    {
        id: "skill",
        label: "Skill",
        isAvailable: () => Game.battlePhase === BATTLE_PHASE.PLAYER && getUnlockedSkillEntries().length > 0,
        getCommands: () => getUnlockedSkillEntries().map(([skillId, skill]) => ({
            id: `skill:${skillId}`,
            elementId: `${skillId.toLowerCase()}-button`,
            icon: skill.icon || "✦",
            iconImage: skill.iconImage || null,
            name: skill.name,
            costLabel: `${classCombat.getCost(getActivePlayer(),skill)} AP`,
            isEnabled: () => resolveTechniqueAvailability(skillId).available
                && (typeof skill.canUse !== "function" || skill.canUse(commandContext()) !== false),
            disabledReason: () => getActivePlayer().ap < classCombat.getCost(getActivePlayer(),skill)
                ? `Requires ${classCombat.getCost(getActivePlayer(),skill)} AP`
                : (resolveTechniqueAvailability(skillId).reasons[0]
                    || skill.disabledReason || "Skill is temporarily unavailable"),
            execute: button => handleSkill(skillId, button)
        }))
    },
    {
        id: "class", label: "Class Skills",
        isAvailable: () => Game.battlePhase === BATTLE_PHASE.PLAYER,
        getCommands: getClassCommands
    },
    {
        id: "item",
        label: "Item",
        isAvailable: () => Game.battlePhase === BATTLE_PHASE.PLAYER && getBattleItemEntries().length > 0,
        getCommands: () => getBattleItemEntries().map(item => {
            const apCost = Math.max(0, Number.isFinite(item.apCost) ? item.apCost : 0);
            const quantity = Number.isFinite(item.quantity) ? ` ×${item.quantity}` : "";
            return {
                id: `item:${item.id}`,
                elementId: `item-${item.id}-button`,
                icon: item.icon || "◇",
                iconImage: item.iconImage || null,
                name: item.name,
                costLabel: `${apCost > 0 ? `${apCost} AP` : ""}${quantity}`.trim(),
                isEnabled: () => getActivePlayer().ap >= apCost
                    && typeof item.use === "function"
                    && (typeof item.canUse !== "function" || item.canUse(commandContext()) !== false),
                disabledReason: () => getActivePlayer().ap < apCost
                    ? `Requires ${apCost} AP`
                    : (item.disabledReason || "Item is temporarily unavailable"),
                execute: button => Game.useItem(item.id, button)
            };
        })
    }
]);

const commandPresentation = createBattleCommandPresentation({
    elements, getCategories: () => commandCategoryDefinitions,
    canAcceptPlayerInput: () => Game.canAcceptPlayerInput(),
    canShowPlayerCommands: () => Game.canShowPlayerCommands(), isPreparing: () => Game.prepareTurnActive,
    getEntityView, getActivePlayer, updateActiveActionHud, scheduleVisual,
    cancelVisual: timer => effects.cancelVisual(timer)
});
const {
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
    clearSelectedAction
} = commandPresentation;

function getEntityStatuses(entity) {
    return statusEffectManager.getStatuses(entity);
}

function applyDamageProfile(attacker, target, profile, {
    statusMultiplier = 1
} = {}) {
    const preparedProfile = classCombat.modifyDamage(attacker, target, skillEffectResolver.prepareDamageProfile(attacker, target, profile));
    const propertyMultiplier = resolvePropertyMultiplier(target, preparedProfile);
    const wasGuarding = target.isGuarding === true;
    const result = resolveCombatDamage({
        attacker,
        target,
        profile: preparedProfile,
        statusMultiplier: statusMultiplier * propertyMultiplier * skillEffectResolver.getIncomingMultiplier(target) * classCombat.incomingMultiplier(target),
        randomSource: Game.randomSource
    });
    const applied = applyResolvedDamage(target, result);
    skillEffectResolver.afterDamage(attacker, target, { wasGuarding });
    return applied;
}

const summaryPresentation = createBattleSummaryPresentation({
    elements, prefersReducedMotion, scheduleVisual,
    schedulePostBattleTask: (callback, delay) => Game.schedulePostBattleTask(callback, delay)
});

const Game = {
    currentScene: "battle",
    actionInProgress: false,
    actingPlayerId: null,
    enemyTurnPending: false,
    enemySequencePhase: "idle",
    currentEnemyId: null,
    currentEnemyTargetId: null,
    pendingBattleTimers: new Set(),
    pendingPostBattleTimers: new Set(),
    battleIntroActive: false,
    battleEndPhase: "none",
    battleRewards: null,
    randomSource: Math.random,
    masteryDisciplinesUsed: new Map(),

    get battlePhase() {
        return battleFlowManager.phase;
    },

    get prepareTurnActive() {
        return this.battlePhase === BATTLE_PHASE.PREPARE;
    },

    get battleStatus() {
        return battleManager.status;
    },

    set battleStatus(status) {
        battleManager.status = status;
    },

    get battleResult() {
        return battleManager.result;
    },

    set battleResult(result) {
        battleManager.result = result;
    },

    get battleToken() {
        return battleManager.token;
    },

    set battleToken(token) {
        battleManager.token = token;
    },

    get currentTurn() {
        return turnManager.currentSide;
    },

    set currentTurn(side) {
        turnManager.currentSide = side;
    },

    get activePlayerIndex() {
        return turnManager.activePlayerIndex;
    },

    set activePlayerIndex(index) {
        turnManager.activePlayerIndex = index;
    },

    get turnCounter() {
        return turnManager.turnCounter;
    },

    get enemyActionQueue() {
        return turnManager.enemyActionQueue;
    },

    set enemyActionQueue(queue) {
        turnManager.enemyActionQueue = queue;
    },

    get enemyActionIndex() {
        return turnManager.enemyActionIndex;
    },

    set enemyActionIndex(index) {
        turnManager.enemyActionIndex = index;
    },

    get selectedTargetId() {
        return targetManager.selectedTargetId;
    },

    set selectedTargetId(targetId) {
        targetManager.selectedTargetId = targetId;
    },

    get targetSelection() {
        return targetManager.selection;
    },

    set targetSelection(selection) {
        targetManager.selection = selection;
    },

    start({ skipIntro = false, enablePrepare = false, preparePhase = null, initialState = null } = {}) {
        classCombat.gameState = battleSceneContext?.sceneManager?.services?.gameManager?.globalState || null;
        this.cancelPendingBattleTimers();
        stopHudTracking();
        stopPlayerAnimation();
        stopEnemyHitAnimations({ restoreIdle: false });
        stopEnemyIdleAnimation();
        animationDirector.clearDeathPoses();
        buildBattlePresentation();
        resetBattleVisuals();
        battleManager.start();
        const prepareEnabled = preparePhase?.enabled === true || enablePrepare === true;
        battleFlowManager.start({ prepare: prepareEnabled });
        turnManager.reset();
        targetManager.reset(enemies);
        this.currentTurn = TURN.PLAYER;
        this.battleEndPhase = "none";
        this.battleRewards = null;
        this.battleOutcomeApplied = false;
        this.battleOutcomeSaved = false;
        this.masteryDisciplinesUsed.clear();
        this.battleIntroActive = true;
        this.actionInProgress = false;
        this.actingPlayerId = null;
        this.activePlayerIndex = 0;
        this.selectedTargetId = enemies[0]?.id || null;
        this.targetSelection = null;
        this.enemyTurnPending = false;
        this.enemySequencePhase = "idle";
        this.enemyActionQueue = [];
        this.enemyActionIndex = 0;
        this.currentEnemyId = null;
        this.currentEnemyTargetId = null;
        clearSelectedAction();
        for (const member of party) {
            member.resetBattleState();
            initializeClassCombat(member);
            member.ap = Math.min(1, member.maxAp);
            member.hasActedThisTurn = false;
        }
        if (initialState) {
            for (const member of party) {
                const saved = initialState.party?.find(entry => entry.id === member.id);
                if (saved && Number.isFinite(saved.hp)) member.hp = Math.max(0, Math.min(member.maxHp, saved.hp));
                member.poisonTurns = Math.max(0, Math.floor(Number(saved?.poisonTurns) || 0));
                member.poisonDamage = Math.max(0, Math.floor(Number(saved?.poisonDamage) || 0));
            }

            const sharedBattleItems = (initialState.inventory || [])
                .filter(itemState => Number(itemState?.quantity) > 0 && ITEM_DEFINITIONS[itemState.id]?.battleUsable)
                .map(itemState => {
                    const definition = ITEM_DEFINITIONS[itemState.id];
                    return {
                        ...definition,
                        quantity: Math.max(0, Math.floor(Number(itemState.quantity) || 0)),
                        canUse: ({ player: actor }) => {
                            if (!actor?.isAlive?.()) return false;
                            if (definition.effectType === "heal") return actor.hp < actor.maxHp;
                            if (definition.effectType === "cure-status" && definition.curesStatus === "poison") {
                                return Number(actor.poisonTurns) > 0
                                    || actor.statusEffects?.some?.(status => status?.id === "poison");
                            }
                            return false;
                        },
                        disabledReason: definition.effectType === "heal"
                            ? "HP is already full"
                            : "No matching status effect",
                        use: ({ player: actor }) => {
                            if (!actor?.isAlive?.()) return false;
                            if (definition.effectType === "heal") {
                                if (actor.hp >= actor.maxHp) return false;
                                actor.hp = Math.min(
                                    actor.maxHp,
                                    actor.hp + Math.max(0, Number(definition.healAmount) || 0)
                                );
                                return true;
                            }
                            if (definition.effectType === "cure-status" && definition.curesStatus === "poison") {
                                const poisoned = Number(actor.poisonTurns) > 0
                                    || actor.statusEffects?.some?.(status => status?.id === "poison");
                                if (!poisoned) return false;
                                actor.poisonTurns = 0;
                                actor.poisonDamage = 0;
                                statusEffectManager.remove(actor, "poison");
                                return true;
                            }
                            return false;
                        }
                    };
                });
            for (const member of party) member.battleItems = sharedBattleItems;
        }
        const firstLivingIndex = party.findIndex(member => member.isAlive());
        if (firstLivingIndex >= 0) turnManager.resumePlayerSide(firstLivingIndex);
        for (const opponent of enemies) opponent.resetBattleState();
        battleLogView.clear();
        this.addBattleLog("Battle started.");
        this.updateUI();
        this.updateControls();
        prepareEnemyStabilizationProfiles();
        startIdleAnimation();
        startEnemyIdleAnimation();
        BattleCamera.focusDefault();

        if (skipIntro || prefersReducedMotion()) this.completeBattleIntro();
        else this.playBattleIntro();
    },

    playBattleIntro() {
        if (!this.hasActiveBattle() || !this.battleIntroActive) return false;
        elements.battleIntroOverlay.hidden = false;
        elements.battleIntroOverlay.setAttribute("aria-hidden", "false");
        void elements.battleIntroOverlay.offsetWidth;
        elements.battleIntroOverlay.classList.add("is-revealing");
        this.scheduleBattleTask(() => {
            hideBattleIntroOverlay();
            showTurnPopup("BATTLE START!", { duration: BATTLE_START_ANNOUNCEMENT_MS });
            this.scheduleBattleTask(() => this.completeBattleIntro(), BATTLE_START_ANNOUNCEMENT_MS);
        }, BATTLE_INTRO_MS);
        return true;
    },

    completeBattleIntro() {
        if (!this.hasActiveBattle() || !this.battleIntroActive) return false;
        hideBattleIntroOverlay();
        this.battleIntroActive = false;
        this.updateUI();
        openCommandMenu();
        this.updateControls();
        BattleCamera.focusCharacter(this.getActivePlayer());
        announceTurn(this.prepareTurnActive ? "PREPARE TURN" : "YOUR TURN", "playerTurn");
        return true;
    },

    executePrepareAction(actionId) {
        if (!this.prepareTurnActive || !this.hasActiveBattle() || this.actionInProgress) return false;
        const classCommand = classCombat.getPrepareCommands(party,skills).find(command=>command.id===actionId);
        if (classCommand) {
            if (!classCommand.enabled || !classCommand.execute()) return false;
            this.addBattleLog(classCommand.name);
            if (!classCommand.free) return this.completePreparePhase();
            refreshCommandMenu(); this.updateUI(); this.updateControls(); return true;
        }
        const result = preparePhaseManager.execute(actionId, {
            party,
            enemies,
            battleItems: getActivePlayer().battleItems
        });
        if (!result.executed) return false;
        if (result.logMessage) this.addBattleLog(result.logMessage);
        return this.completePreparePhase();
    },

    completePrepareTurn(action = "skip") {
        const legacyActions = {
            focus: PREPARE_ACTION.FOCUS,
            salt: PREPARE_ACTION.SCATTER_SALT,
            skip: PREPARE_ACTION.BEGIN_BATTLE
        };
        return this.executePrepareAction(legacyActions[action] || action);
    },

    completePreparePhase() {
        if (!this.prepareTurnActive || !this.hasActiveBattle() || this.actionInProgress) return false;
        const firstLivingIndex = party.findIndex(member => member.isAlive());
        if (firstLivingIndex < 0 || !battleFlowManager.completePreparation()) return false;
        turnManager.resumePlayerSide(firstLivingIndex);
        this.getActivePlayer().hasActedThisTurn = false;
        refreshCommandMenu({ resetToAction: true });
        this.updateUI();
        this.updateControls();
        BattleCamera.focusCharacter(this.getActivePlayer());
        announceTurn("YOUR TURN", "playerTurn");
        return true;
    },

    scheduleBattleTask(callback, delay) {
        const token = this.battleToken;
        const timerId = setTimeout(() => {
            this.pendingBattleTimers.delete(timerId);
            if (token === this.battleToken && this.battleStatus === BATTLE_STATUS.ACTIVE) callback();
        }, delay);
        this.pendingBattleTimers.add(timerId);
        return timerId;
    },

    schedulePostBattleTask(callback, delay) {
        const token = this.battleToken;
        const timerId = setTimeout(() => {
            this.pendingPostBattleTimers.delete(timerId);
            if (token === this.battleToken && this.battleStatus === BATTLE_STATUS.FINISHED) callback();
        }, delay);
        this.pendingPostBattleTimers.add(timerId);
        return timerId;
    },

    cancelPendingBattleTimers() {
        for (const timerId of this.pendingBattleTimers) clearTimeout(timerId);
        this.pendingBattleTimers.clear();
        for (const timerId of this.pendingPostBattleTimers) clearTimeout(timerId);
        this.pendingPostBattleTimers.clear();
    },

    getActivePlayer() {
        return party[this.activePlayerIndex]?.isAlive() ? party[this.activePlayerIndex] : null;
    },

    getActingPlayer() {
        return party.find(member => member.id === this.actingPlayerId) || this.getActivePlayer();
    },

    getSelectedTarget() {
        return enemies.find(opponent => opponent.id === this.selectedTargetId && opponent.isAlive()) || null;
    },

    getLivingPlayers() {
        return battleManager.getLivingParty();
    },

    getLivingEnemies() {
        return battleManager.getLivingEnemies();
    },

    updateEntityView(entity) {
        return actorPresentation.updateEntityView(entity);
    },

    updateUI() {
        return actorPresentation.updateUI(this);
    },

    updateControls() {
        return actorPresentation.updateControls(this);
    },

    addBattleLog(message) {
        return battleLogView.add(message);
    },

    canShowPlayerCommands() {
        return this.hasActiveBattle()
            && this.currentTurn === TURN.PLAYER
            && !this.battleIntroActive
            && Boolean(this.getActivePlayer());
    },

    canAcceptPlayerInput() {
        return this.canShowPlayerCommands()
            && battleFlowManager.canAcceptPlayerInput()
            && !this.actionInProgress
            && !this.targetSelection
            && !this.getActivePlayer().hasActedThisTurn;
    },

    canAcceptTargetInput() {
        return this.hasActiveBattle()
            && this.battlePhase === BATTLE_PHASE.PLAYER
            && this.currentTurn === TURN.PLAYER
            && !this.actionInProgress
            && Boolean(this.targetSelection)
            && Boolean(this.getSelectedTarget());
    },

    canResolvePlayerAction(apCost = 0) {
        const actor = this.getActingPlayer();
        return this.hasActiveBattle()
            && this.currentTurn === TURN.PLAYER
            && this.battlePhase === BATTLE_PHASE.PLAYER
            && this.actionInProgress
            && Boolean(actor)
            && actor.ap >= apCost;
    },

    hasActiveBattle() {
        return battleManager.isActive();
    },

    canBeginPlayerAction(apCost = 0) {
        const actor = this.getActivePlayer();
        return this.battlePhase === BATTLE_PHASE.PLAYER
            && this.canAcceptPlayerInput()
            && Boolean(actor)
            && actor.ap >= apCost;
    },

    beginPlayerAction(apCost = 0, actionElement = null) {
        if (!this.canBeginPlayerAction(apCost)) return false;
        this.actionInProgress = true;
        this.actingPlayerId = this.getActivePlayer().id;
        setSelectedAction(actionElement);
        closeCommandMenu();
        BattleCamera.focusDefault();
        this.updateUI();
        this.updateControls();
        return true;
    },

    queuePlayerActionExecution(executor, audioEvent = null) {
        if (!this.actionInProgress || typeof executor !== "function" || !this.hasActiveBattle()) return false;
        BattleCamera.focusDefault();
        this.scheduleBattleTask(() => {
            if (audioEvent) AudioManager.playEvent(audioEvent, { scope: "battle" });
            executor();
        }, CAMERA_RETURN_MS + ACTION_WIDE_VIEW_DELAY_MS);
        return true;
    },

    completePlayerAction({ successful = true, manualEnd = false } = {}) {
        const actor = this.getActingPlayer();
        if (!actor || this.battleStatus !== BATTLE_STATUS.ACTIVE) return false;

        if (!successful) {
            this.actionInProgress = false;
            this.actingPlayerId = null;
            clearSelectedAction();
            if (this.battleStatus !== BATTLE_STATUS.ACTIVE) return false;
            this.updateUI();
            openCommandMenu();
            this.updateControls();
            BattleCamera.focusCharacter(this.getActivePlayer());
            return false;
        }

        if (!manualEnd) actor.hasActedThisTurn = true;
        const previousAp = actor.ap;
        const regeneration = manualEnd ? 2 : 1;
        actor.ap = Math.min(actor.maxAp, actor.ap + regeneration);
        const restoredAp = actor.ap - previousAp;
        if (restoredAp > 0) this.addBattleLog(actor.name + " restores " + restoredAp + " AP.");

        this.actionInProgress = false;
        this.actingPlayerId = null;
        clearSelectedAction();
        if (this.battleStatus !== BATTLE_STATUS.ACTIVE) return false;
        this.updateUI();
        this.updateControls();
        return this.advancePlayerTurnOrEnemy();
    },

    beginTargetSelection(action) {
        const livingTargets = this.getLivingEnemies();
        if (!action || !this.canBeginPlayerAction(action.apCost || 0) || livingTargets.length === 0) return false;
        if (!targetManager.begin(action, this.getActivePlayer().id)) return false;
        setSelectedAction(action.actionElement || null);
        closeCommandMenu();
        this.updateUI();
        this.updateControls();
        BattleCamera.focusTarget(this.getSelectedTarget());
        return true;
    },

    changeTarget(direction) {
        if (!this.canAcceptTargetInput()) return false;
        if (!targetManager.changeLinear(direction)) return false;
        this.updateUI();
        this.updateControls();
        BattleCamera.focusTarget(this.getSelectedTarget());
        AudioManager.playEvent("targetMove", { scope: "battle" });
        return true;
    },

    changeTargetSpatially(direction) {
        if (!this.canAcceptTargetInput()) return false;
        if (!targetManager.changeSpatial(direction)) return false;
        this.updateUI();
        this.updateControls();
        BattleCamera.focusTarget(this.getSelectedTarget());
        AudioManager.playEvent("targetMove");
        return true;
    },

    handleTargetClick(targetId) {
        if (!this.canAcceptTargetInput()) return false;
        const target = enemies.find(opponent => opponent.id === targetId && opponent.isAlive());
        if (!target) return false;
        if (target.id !== this.selectedTargetId) {
            targetManager.select(target.id);
            this.updateUI();
            BattleCamera.focusTarget(target);
            AudioManager.playEvent("targetMove", { scope: "battle" });
            return true;
        }
        return this.confirmTargetSelection();
    },

    confirmTargetSelection() {
        if (!this.canAcceptTargetInput()) return false;
        const pending = this.targetSelection;
        const target = this.getSelectedTarget();
        if (!pending || !target || pending.actorId !== this.getActivePlayer()?.id) {
            return this.cancelTargetSelection();
        }

        targetManager.cancel();
        this.updateUI();
        if (!this.beginPlayerAction(pending.apCost || 0, pending.actionElement || null)) {
            this.cancelTargetSelection();
            return false;
        }

        if (pending.type === "attack") {
            return this.queuePlayerActionExecution(() => executeAttack(target));
        }
        if (pending.type === "class-skill") return this.queuePlayerActionExecution(() => executeClassSkill(pending.skillId,target));
        if (pending.type === "skill") {
            return this.queuePlayerActionExecution(() => executeSkill(pending.skillId, target));
        }
        this.completePlayerAction({ successful: false });
        return false;
    },

    cancelTargetSelection() {
        if (!this.targetSelection || this.battleStatus !== BATTLE_STATUS.ACTIVE) return false;
        targetManager.cancel();
        clearSelectedAction();
        AudioManager.playEvent("menuCancel", { scope: "battle" });
        this.updateUI();
        openCommandMenu();
        this.updateControls();
        BattleCamera.focusCharacter(this.getActivePlayer());
        return true;
    },

    playerAttack(target = this.getSelectedTarget(), { deferFinish = false } = {}) {
        const actor = this.getActingPlayer();
        const apCost = actor?.basicAttack?.apCost ?? 1;
        if (!actor || !target?.isAlive() || !this.canResolvePlayerAction(apCost) || classCombat.attackReason(actor)) {
            return { executed: false, damage: 0 };
        }

        const attackProfile = classCombat.beginAttack(actor, actor.basicAttack);
        // Ordinary legacy attacks keep guaranteed accuracy; reload weapons opt in.
        if (!getEquippedWeapon(actor.equipment).requiresReload) delete attackProfile.classAttack;
        const damageResult = applyDamageProfile(actor, target, attackProfile, {
            statusMultiplier: target.isGuarding ? (Number(target.guardDamageMultiplier) || 0.5) : 1
        });
        if (attackProfile.ammo && damageResult.hitType !== "miss") classCombat.applyCondition(actor,target,attackProfile.ammo);
        if (attackProfile.ammo?.allEnemies) for (const secondary of enemies.filter(enemy=>enemy!==target&&enemy.isAlive())) {
            const result=applyDamageProfile(actor,secondary,attackProfile);
            showDamageNumber(result.finalDamage,secondary,result.hitType);
            this.addBattleLog(`Scatter hits ${secondary.name} for ${result.finalDamage} damage.`);
        }
        target.isGuarding = false;
        const damage = damageResult.finalDamage;
        actor.ap = Math.max(0, actor.ap - apCost);
        this.recordMasteryUse(actor.id, actor.basicAttack.masteryDiscipline);
        this.addBattleLog(actor.name + " attacks " + target.name + " for " + damage + " damage."
            + hitFeedbackSuffix(damageResult.hitType));
        this.updateUI();

        const battleEnded = this.getLivingEnemies().length === 0;
        if (battleEnded && !deferFinish) this.finishBattle("victory");
        return {
            executed: true,
            damage,
            rolledDamage: damageResult.rolledDamage,
            hitType: damageResult.hitType,
            target,
            battleEnded
        };
    },

    playerGuard(actionElement = null) {
        if (!this.beginPlayerAction(0, actionElement)) return false;
        const actor = this.getActingPlayer();
        return this.queuePlayerActionExecution(() => {
            if (!actor || actor.isGuarding || !this.canResolvePlayerAction(0)) {
                this.completePlayerAction({ successful: false });
                return;
            }
            const resolveGuard = () => {
                if (!this.canResolvePlayerAction(0)) {
                    this.completePlayerAction({ successful: false });
                    return;
                }
                actor.isGuarding = true;
                this.addBattleLog(actor.name + " is guarding.");
                this.updateUI();
                this.completePlayerAction();
            };
            if (!playPlayerGuard(actor, resolveGuard)) resolveGuard();
        }, "guard");
    },

    useSkill(skillId, target = this.getSelectedTarget(), {
        deferFinish = false,
        spendAp = true
    } = {}) {
        const actor = this.getActingPlayer();
        const skill = skills[skillId];
        const requiredAp = spendAp && skill ? classCombat.getCost(actor,skill) : 0;
        if (!actor || !target?.isAlive() || !skill || !actor.unlockedSkillIds.includes(skillId)
            || !this.canResolvePlayerAction(requiredAp)
            || !techniqueResolver.resolve(actor, skillId, {
                ...commandContext(),
                mode: "battle",
                ignoreResourceCosts: true
            }).available
            || (typeof skill.canUse === "function" && skill.canUse(commandContext()) === false)) {
            return { executed: false, damage: 0 };
        }

        if (spendAp) {
            actor.ap = Math.max(0, Math.round((actor.ap - requiredAp)*100)/100);
            actor.classCombat.castProfile = classCombat.beginAttack(actor,skill);
            delete actor.classCombat.castProfile.classAttack;
        }
        const discipline = skill.masteryDiscipline === "equipped-weapon"
            ? getEquippedWeapon(actor.equipment).masteryDiscipline
            : skill.masteryDiscipline;
        this.recordMasteryUse(actor.id, discipline);
        const castProfile = actor.classCombat.castProfile || skill;
        this.recordMasteryUse(actor.id, `technique:${skillId}`);
        const damageResult = applyDamageProfile(actor, target, castProfile, {
            statusMultiplier: target.isGuarding ? (Number(target.guardDamageMultiplier) || 0.5) : 1
        });
        target.isGuarding = false;
        const damage = damageResult.finalDamage;
        this.addBattleLog(actor.name + " uses " + skill.name + " on " + target.name + " for " + damage + " damage."
            + hitFeedbackSuffix(damageResult.hitType));
        if (castProfile.repeatMultiplier && target.isAlive()) {
            const repeated = applyDamageProfile(actor,target,{...castProfile,attackMultiplier:(castProfile.attackMultiplier||1)*castProfile.repeatMultiplier});
            showDamageNumber(repeated.finalDamage,target,repeated.hitType);
            this.addBattleLog(`Chain Spell deals ${repeated.finalDamage} additional damage.`);
        }

        if (skillId === "poison" && target.isAlive()) {
            statusEffectManager.applyPoison(target, { damage: skill.poisonDamage, duration: skill.duration });
            this.addBattleLog(target.name + " is poisoned for " + skill.duration + " turns.");
        }
        skillEffectResolver.applyOnHit(actor, target, skillId, statusEffectManager);

        this.updateUI();
        const battleEnded = this.getLivingEnemies().length === 0;
        if (battleEnded && !deferFinish) this.finishBattle("victory");
        return {
            executed: true,
            damage,
            rolledDamage: damageResult.rolledDamage,
            hitType: damageResult.hitType,
            target,
            battleEnded
        };
    },

    useItem(itemId, actionElement = null) {
        const actor = this.getActivePlayer();
        const item = getBattleItemEntries().find(entry => entry.id === itemId);
        const apCost = Math.max(0, Number.isFinite(item?.apCost) ? item.apCost : 0);
        if (!actor || !item || typeof item.use !== "function"
            || (typeof item.canUse === "function" && item.canUse(commandContext()) === false)
            || !this.beginPlayerAction(apCost, actionElement)) return false;

        return this.queuePlayerActionExecution(() => {
            if (!this.canResolvePlayerAction(apCost)) {
                this.completePlayerAction({ successful: false });
                return;
            }

            const hpBefore = actor.hp;
            const poisonBefore = Math.max(0, Number(actor.poisonTurns) || 0);
            const used = item.use(commandContext()) === true;
            if (!used) {
                this.completePlayerAction({ successful: false });
                return;
            }

            actor.ap = Math.max(0, actor.ap - apCost);
            if (Number.isFinite(item.quantity)) item.quantity = Math.max(0, item.quantity - 1);
            this.addBattleLog(actor.name + " uses " + item.name + ".");

            const healed = Math.max(0, actor.hp - hpBefore);
            if (healed > 0) {
                showFloatingCombatNumber(healed, actor, { type: "heal" });
                this.addBattleLog(actor.name + " recovers " + healed + " HP.");
            } else if (poisonBefore > 0 && Number(actor.poisonTurns) <= 0) {
                effects.present({ type: "cleanse", target: actor });
                this.addBattleLog(actor.name + " is cured of Poison.");
            }

            this.updateUI();
            refreshCommandMenu();
            if (this.getLivingEnemies().length === 0) this.finishBattle("victory");
            this.completePlayerAction();
        });
    },

    endPlayerTurn(actionElement = null) {
        if (!this.canBeginPlayerAction(0)) return false;
        this.actionInProgress = true;
        this.actingPlayerId = this.getActivePlayer().id;
        setSelectedAction(actionElement);
        closeCommandMenu();
        BattleCamera.focusDefault();
        const actor = this.getActingPlayer();
        this.updateUI();
        this.updateControls();
        this.scheduleBattleTask(() => {
            if (!actor || actor.hasActedThisTurn) {
                this.completePlayerAction({ successful: false });
                return;
            }
            this.addBattleLog(actor.name + " ends the turn without acting.");
            this.completePlayerAction({ manualEnd: true });
        }, CAMERA_RETURN_MS);
        return true;
    },

    advancePlayerTurnOrEnemy() {
        if (this.battleStatus !== BATTLE_STATUS.ACTIVE || this.currentTurn !== TURN.PLAYER) return false;
        const nextIndex = findNextLivingIndex(party, this.activePlayerIndex);
        if (nextIndex >= 0) {
            this.activePlayerIndex = nextIndex;
            this.getActivePlayer().hasActedThisTurn = false;
            clearSelectedAction();
            this.updateUI();
            openCommandMenu();
            this.updateControls();
            BattleCamera.focusCharacter(this.getActivePlayer());
            return true;
        }
        return this.enemyTurn();
    },

    enemyTurn() {
        if (this.battleStatus !== BATTLE_STATUS.ACTIVE || this.currentTurn !== TURN.PLAYER
            || this.enemyTurnPending || this.enemySequencePhase !== "idle"
            || this.getLivingPlayers().length === 0 || this.getLivingEnemies().length === 0) return false;

        targetManager.cancel();
        clearSelectedAction();
        closeCommandMenu();
        BattleCamera.focusDefault();
        turnManager.beginEnemySide(this.getLivingEnemies().map(opponent => opponent.id));
        battleFlowManager.transition(BATTLE_PHASE.PHASE_TRANSITION);
        this.enemyTurnPending = true;
        this.enemySequencePhase = "queued";
        this.currentEnemyId = null;
        this.currentEnemyTargetId = null;
        this.updateUI();
        this.updateControls();
        announceTurn("ENEMY TURN", "enemyTurn");
        this.scheduleBattleTask(() => {
            battleFlowManager.transition(BATTLE_PHASE.ENEMY);
            this.resolveEnemyTurn();
        }, TURN_ANNOUNCEMENT_MS);
        return true;
    },

    resolveEnemyTurn() {
        if (this.battleStatus !== BATTLE_STATUS.ACTIVE || this.currentTurn !== TURN.ENEMY
            || !this.enemyTurnPending || this.enemySequencePhase !== "queued") return false;

        const enemyActor = enemies.find(opponent =>
            opponent.id === this.enemyActionQueue[this.enemyActionIndex] && opponent.isAlive()
        );
        const livingPlayers = this.getLivingPlayers();
        if (!enemyActor || livingPlayers.length === 0) return this.advanceEnemySequence();
        const reaction = classCombat.beforeEnemyAction(enemyActor,party);
        for(const event of reaction.events){showDamageNumber(event.finalDamage,event.target,event.hitType);this.addBattleLog(`Trap deals ${event.finalDamage} damage to ${event.target.name}.`);}
        if(!this.getLivingEnemies().length)return this.finishBattle("victory");
        if(reaction.blocked){this.addBattleLog(`${enemyActor.name}'s action is interrupted.`);return this.advanceEnemySequence();}

        this.currentEnemyId = enemyActor.id;
        const aiRoll = () => ((turnManager.turnCounter * 17 + this.enemyActionIndex * 23) % 100) / 100;
        const enemyAction = chooseWeightedEnemyAction(enemyActor, aiRoll);
        if (enemyAction.type === "defend") {
            enemyActor.isGuarding = true;
            this.enemySequencePhase = "recovery";
            this.addBattleLog(enemyActor.name + " takes a defensive stance.");
            this.updateUI();
            this.scheduleBattleTask(() => this.advanceEnemySequence(), 420);
            return true;
        }
        const target = selectEnemyActionTarget({
            targets: livingPlayers,
            action: enemyAction,
            forcedTargetId: getForcedEnemyTargetId(livingPlayers),
            randomSource: this.randomSource
        });
        if (!target) return this.advanceEnemySequence();
        this.currentEnemyTargetId = target.id;
        this.enemySequencePhase = "windup";
        AudioManager.playSFX("enemyAttack", { scope: "battle" });
        const animationStarted = playEnemyAttackAnimation(enemyActor, {
            onImpact: () => {
                if (this.battleStatus !== BATTLE_STATUS.ACTIVE
                    || this.currentTurn !== TURN.ENEMY
                    || this.enemySequencePhase !== "windup") return;
                this.applyEnemyAttack({ deferAdvance: true });
            },
            onComplete: () => {
                if (this.battleStatus !== BATTLE_STATUS.ACTIVE
                    || this.currentTurn !== TURN.ENEMY
                    || !this.enemyTurnPending
                    || this.enemySequencePhase !== "recovery") return;
                this.advanceEnemySequence();
            }
        });
        if (!animationStarted) {
            this.scheduleBattleTask(() => this.applyEnemyAttack(), 220);
        }
        return true;
    },

    applyEnemyAttack({ deferAdvance = false } = {}) {
        if (this.battleStatus !== BATTLE_STATUS.ACTIVE || this.currentTurn !== TURN.ENEMY
            || !this.enemyTurnPending || this.enemySequencePhase !== "windup") return false;

        const enemyActor = enemies.find(opponent => opponent.id === this.currentEnemyId && opponent.isAlive());
        const intendedTarget = party.find(member => member.id === this.currentEnemyTargetId && member.isAlive());
        if (!enemyActor || !intendedTarget) return this.advanceEnemySequence();
        const interception = classCombat.intercept(intendedTarget,party);
        const target = interception.target;
        if(target!==intendedTarget)this.addBattleLog(`${target.name} protects ${intendedTarget.name}.`);

        this.enemySequencePhase = "recovery";
        const damageResult = applyDamageProfile(enemyActor, target, enemyActor.basicAttack, {
            statusMultiplier: (target.isGuarding ? (Number(target.guardDamageMultiplier) || 0.5) : 1) * (1-interception.reduction)
        });
        const damage = damageResult.finalDamage;
        const counter = classCombat.afterIncoming(enemyActor,target,damageResult,interception);
        if(counter){showDamageNumber(counter.finalDamage,enemyActor,counter.hitType);this.addBattleLog(`${target.name} counters for ${counter.finalDamage} damage.`);}
        target.isGuarding = false;
        showDamageNumber(damage, target, damageResult.hitType, { source: enemyActor });
        this.addBattleLog(enemyActor.name + " attacks " + target.name + " for " + damage + " damage."
            + hitFeedbackSuffix(damageResult.hitType));
        if (target.hp === 0) {
            const downResult = downStateManager.handleZeroHp(target);
            if (downResult.type === "down") {
                const revivedHp = downStateManager.revive(target);
                this.addBattleLog(`${target.name} is downed (${downResult.downCount}/3) and rallies with ${revivedHp} HP.`);
            } else if (downResult.type === "retreat") {
                this.addBattleLog(`${target.name} is downed a third time and retreats from battle.`);
            }
        }
        this.updateUI();

        if (!this.getLivingEnemies().length) { this.finishBattle("victory"); return true; }
        if (this.getLivingPlayers().length === 0) {
            this.finishBattle("defeat");
            return true;
        }

        if (!deferAdvance) this.scheduleBattleTask(() => this.advanceEnemySequence(), 450);
        return true;
    },

    advanceEnemySequence() {
        if (this.battleStatus !== BATTLE_STATUS.ACTIVE || this.currentTurn !== TURN.ENEMY
            || !this.enemyTurnPending) return false;
        turnManager.advanceEnemyAction();
        this.currentEnemyId = null;
        this.currentEnemyTargetId = null;
        if (this.enemyActionIndex < this.enemyActionQueue.length) {
            this.enemySequencePhase = "queued";
            this.scheduleBattleTask(() => this.resolveEnemyTurn(), 260);
            return true;
        }
        this.enemySequencePhase = "recovery";
        return this.completeEnemyTurn();
    },

    completeEnemyTurn() {
        if (this.battleStatus !== BATTLE_STATUS.ACTIVE || this.currentTurn !== TURN.ENEMY
            || !this.enemyTurnPending || this.enemySequencePhase !== "recovery") return false;

        for (const event of statusEffectManager.tickDamageOverTime([...this.getLivingEnemies(), ...this.getLivingPlayers()])) {
            this.addBattleLog(event.entity.name + " takes " + event.damage + ` ${event.statusId} damage.`);
            showDamageNumber(event.damage, event.entity, "normal", { effectId: event.statusId === "burn" ? "burn" : event.statusId === "bleed" ? "bleed" : "poison-tick" });
        }
        for (const event of statusEffectManager.tickDurations([...party, ...enemies])) {
            this.addBattleLog(`${event.entity.name}'s ${event.statusId} effect expires.`);
        }
        for(const member of party.filter(member=>member.hp===0&&!member.retreated)){
            downStateManager.handleZeroHp(member); downStateManager.revive(member);
        }
        classCombat.onRoundStart(party);
        this.updateUI();
        if (!this.getLivingPlayers().length) { this.finishBattle("defeat"); return true; }

        if (this.getLivingEnemies().length === 0) {
            this.finishBattle("victory");
            return true;
        }

        battleFlowManager.transition(BATTLE_PHASE.PHASE_TRANSITION);
        turnManager.beginPlayerSide(party.findIndex(member => member.isAlive()));
        battleFlowManager.transition(BATTLE_PHASE.PLAYER);
        this.getActivePlayer().hasActedThisTurn = false;
        this.enemyTurnPending = false;
        this.enemySequencePhase = "idle";
        this.actionInProgress = false;
        this.actingPlayerId = null;
        this.selectedTargetId = this.getLivingEnemies()[0].id;
        this.updateUI();
        openCommandMenu();
        this.updateControls();
        BattleCamera.focusCharacter(this.getActivePlayer());
        announceTurn("YOUR TURN", "playerTurn");
        return true;
    },

    awardVictoryProgression() {
        if (this.battleRewards) return this.battleRewards;

        const gameManager = battleSceneContext?.sceneManager?.services?.gameManager;
        const state = gameManager?.globalState;
        const enemyRewards = enemies.map(opponent => ({ id: opponent.id, name: opponent.name, exp: Math.max(0, Number(opponent.expReward) || 0), rankPoints: 0 }));
        const totalExp = enemyRewards.reduce((sum, entry) => sum + entry.exp, 0);
        const totalRankPoints = 0;
        const primaryMember = state?.party?.find(member => member.active !== false);
        const levelBefore = Math.max(1, Math.floor(Number(primaryMember?.progression?.level) || 1));
        const expBefore = Math.max(0, Math.floor(Number(primaryMember?.progression?.exp) || 0));
        const levelExpBefore = getLevelExpRequirement(levelBefore);
        const rankBefore = typeof state?.story?.rank === "string" ? state.story.rank : "F";
        const rankProgressBefore = state?.story
            ? getRankProgress(state.story)
            : { rank: rankBefore, nextRank: "E", current: 0, required: 10, totalPoints: 0 };

        let expResult = {
            gained: totalExp,
            levelBefore,
            levelAfter: levelBefore,
            levelsGained: 0,
            exp: expBefore,
            nextLevelExp: getLevelExpRequirement(levelBefore)
        };
        let rankResult = {
            gained: totalRankPoints,
            rankBefore,
            rankAfter: rankBefore,
            rankPoints: Math.max(0, Math.floor(Number(state?.story?.rankPoints) || 0))
        };
        let victoryResolution = null;

        if (state?.story) {
            if (battleSceneContext?.encounterId) {
                victoryResolution = new BattleVictoryResolver(state).resolve({
                    encounterId: battleSceneContext.encounterId,
                    enemyId: battleSceneContext.enemyId || null,
                    enemyCount: battleSceneContext.enemyCount || enemies.length,
                    mapId: battleSceneContext.mapReturnNodeId || null
                });
                const primaryResult = victoryResolution?.loot?.experience?.find(entry => entry.characterId === primaryMember?.id)
                    || victoryResolution?.loot?.experience?.[0];
                if (primaryResult) expResult = primaryResult;
            }
            const mastery = new MasteryManager(state);
            for (const [memberId, disciplines] of this.masteryDisciplinesUsed) {
                for (const discipline of disciplines) {
                    mastery.recordUse(memberId, discipline, {
                        encounterId: battleSceneContext?.encounterId || "prototype-battle",
                        amount: 1,
                        trivial: battleSceneContext?.persistEncounterCompletion === false
                    });
                }
            }
        }

        const rankProgress = state?.story
            ? getRankProgress(state.story)
            : { rank: rankResult.rankAfter, nextRank: null, current: 0, required: 0, totalPoints: rankResult.rankPoints };

        this.battleRewards = {
            enemyRewards,
            exp: victoryResolution?.applied === true ? totalExp : 0,
            rankPoints: totalRankPoints,
            levelBefore: expResult.levelBefore,
            expBefore,
            levelExpBefore,
            levelAfter: expResult.levelAfter,
            levelsGained: expResult.levelsGained,
            currentExp: expResult.exp,
            nextLevelExp: expResult.nextLevelExp,
            rankBefore: rankResult.rankBefore,
            rankProgressBefore,
            rankAfter: rankResult.rankAfter,
            rankProgress,
            loot: victoryResolution?.loot || { currency: 0, rankPoints: 0, items: [], reputation: {}, techniques: [], mastery: {}, flags: [] },
            experienceResults: victoryResolution?.loot?.experience || [],
            skillPointsGained: expResult.skillPointsGained || 0,
            lootApplied: victoryResolution?.applied === true
        };
        return this.battleRewards;
    },

    finishBattle(result) {
        if (!battleManager.finish(result)) return false;
        battleFlowManager.finish(result);
        turnManager.endBattle(TURN.ENDED);
        this.battleIntroActive = false;
        this.battleEndPhase = result === "victory" ? "result" : "complete";
        this.actionInProgress = false;
        this.actingPlayerId = null;
        targetManager.cancel();
        this.enemyTurnPending = false;
        this.enemySequencePhase = "idle";
        this.currentEnemyId = null;
        this.currentEnemyTargetId = null;
        for (const member of party) {
            member.isGuarding = false;
            member.hasActedThisTurn = false;
            clearClassCombat(member);
        }
        clearSelectedAction();
        this.cancelPendingBattleTimers();
        stopHudTracking();
        stopPlayerAnimation();
        stopEnemyHitAnimations({ restoreIdle: false });
        stopEnemyIdleAnimation();
        clearVisualTimers();
        hideTurnPopup();
        hideBattleIntroOverlay();
        elements.battleSummary.hidden = true;
        closeCommandMenu();
        BattleCamera.resetCamera();
        for (const view of actorPresentation.getViews()) {
            view.targetButton?.classList.remove("is-selected-target");
            view.slotElement?.classList.remove("awaiting-command");
        }
        this.addBattleLog(result === "victory" ? "Enemy party defeated!" : "Party defeated!");
        this.updateUI();
        this.updateControls();
        AudioManager.playEvent(result === "victory" ? "victory" : "defeat", { scope: "battle" });
        showTurnPopup(result === "victory" ? "VICTORY!" : "DEFEAT", {
            duration: RESULT_ANNOUNCEMENT_MS,
            allowFinished: true,
            isResult: true
        });
        if (!this.commitBattleOutcome()
            && battleSceneContext?.sceneManager?.services?.gameManager?.globalState) {
            this.addBattleLog("Autosave failed. Battle results remain in this session; saving will retry on return.");
        }
        if (result === "victory") {
            this.schedulePostBattleTask(() => this.openBattleSummary(), RESULT_ANNOUNCEMENT_MS);
        } else {
            this.schedulePostBattleTask(
                () => this.returnToExploration(),
                RESULT_ANNOUNCEMENT_MS + 450
            );
        }
        return true;
    },

    openBattleSummary() {
        if (this.battleStatus !== BATTLE_STATUS.FINISHED || this.battleResult !== "victory"
            || this.battleEndPhase !== "result") return false;
        hideTurnPopup();
        this.battleEndPhase = "summary";
        elements.battleSummary.hidden = false;
        if (elements.battleSummaryContent) {
            summaryPresentation.render(this.battleRewards || this.awardVictoryProgression());
        }
        AudioManager.playEvent("summaryOpen", { scope: "battle" });
        this.updateUI();
        this.updateControls();
        return true;
    },

    completeBattleSummary() {
        if (this.battleEndPhase !== "summary" || elements.battleSummary.hidden) return false;
        this.battleEndPhase = "complete";
        this.cancelPendingBattleTimers();
        clearVisualTimers();
        elements.battleSummary.hidden = true;
        AudioManager.playEvent("summaryNext", { scope: "battle" });
        this.updateUI();
        this.updateControls();
        return this.returnToExploration();
    },

    commitBattleOutcome() {
        if (this.battleStatus !== BATTLE_STATUS.FINISHED) return false;
        const gameManager = battleSceneContext?.sceneManager?.services?.gameManager;
        const state = gameManager?.globalState;
        if (!this.battleOutcomeApplied) {
            // Copy spent resources before loot, so a dropped battle item is added
            // to its final quantity and never overwritten on summary/return.
            if (state) {
                for (const member of state.party || []) {
                    const combatant = party.find(entry => entry.id === member.id);
                    if (!combatant) continue;
                    member.classState = structuredClone(combatant.classState);
                    member.hp = this.battleResult === "defeat"
                        ? Math.max(1, Math.ceil(combatant.maxHp * 0.3))
                        : combatant.hp;
                    member.maxHp = combatant.maxHp;
                    member.poisonTurns = this.battleResult === "defeat"
                        ? 0
                        : Math.max(0, Math.floor(Number(combatant.poisonTurns) || 0));
                    member.poisonDamage = member.poisonTurns > 0
                        ? Math.max(0, Math.floor(Number(combatant.poisonDamage) || 0))
                        : 0;
                    member.downCount = combatant.downCount;
                    member.isDown = combatant.isDown;
                    member.retreated = combatant.retreated;
                    downStateManager.resetAfterBattle(member);
                    clearClassCombat(combatant);
                }

                const sharedBattleItems = party[0]?.battleItems || [];
                for (const inventoryItem of state.inventory || []) {
                    const battleItem = sharedBattleItems.find(item => item.id === inventoryItem.id);
                    if (battleItem && Number.isFinite(battleItem.quantity)) {
                        inventoryItem.quantity = Math.max(0, battleItem.quantity);
                    }
                }
            }
            if (this.battleResult === "victory") this.awardVictoryProgression();
            if (state) {
                const encounterId = battleSceneContext?.encounterId;
                if (this.battleResult === "victory" && encounterId
                    && battleSceneContext?.persistEncounterCompletion !== false
                    && !state.completedEncounters.includes(encounterId)) {
                    state.completedEncounters.push(encounterId);
                }
                const position = battleSceneContext?.mapReturnPosition;
                if (position) state.mapPosition = {
                    ...position,
                    mapId: battleSceneContext.mapReturnNodeId || position.mapId || state.mapPosition.mapId
                };
            }
            this.battleOutcomeApplied = true;
        }
        if (!state || this.battleOutcomeSaved) return this.battleOutcomeSaved;
        try {
            this.battleOutcomeSaved = gameManager.save("autosave") === true;
        } catch {
            this.battleOutcomeSaved = false;
        }
        return this.battleOutcomeSaved;
    },

    returnToExploration() {
        const sceneManager = battleSceneContext?.sceneManager;
        if (!sceneManager?.transitionTo) return false;

        this.commitBattleOutcome();

        const returnSceneId = battleSceneContext?.returnSceneId || "map";
        const returnContext = {
            fromBattle: true,
            battleResult: this.battleResult,
            encounterId: battleSceneContext?.encounterId || null,
            enemyId: battleSceneContext?.enemyId || null,
            enemyCount: battleSceneContext?.enemyCount || enemies.length,
            persistEncounterCompletion: battleSceneContext?.persistEncounterCompletion !== false,
            resumeMapNodeId: battleSceneContext?.mapReturnNodeId || null,
            resumePosition: battleSceneContext?.mapReturnPosition || null,
            resumeFacing: battleSceneContext?.mapReturnFacing || "south"
        };
        return sceneManager.transitionTo(returnSceneId, returnContext);
    },

    reserveSystemMenu() {
        return this.currentScene === "battle";
    },

    refreshCommandMenu(options = {}) {
        return refreshCommandMenu(options);
    },

    getAvailableCommandCategoryIds() {
        return refreshAvailableCommandCategories().map(category => category.id);
    },

    recordMasteryUse(memberId, discipline) {
        if (!memberId || !discipline) return false;
        if (!this.masteryDisciplinesUsed.has(memberId)) this.masteryDisciplinesUsed.set(memberId, new Set());
        this.masteryDisciplinesUsed.get(memberId).add(discipline);
        const member = party.find(actor=>actor.id===memberId);
        if(member?.classState)for(const passive of getActiveClassSkills(member).filter(skill=>skill.type==="passive"))this.masteryDisciplinesUsed.get(memberId).add(`technique:${passive.id}`);
        return true;
    },

    requestPreparePhase({ reason = "", allowReopen = false } = {}) {
        if (!allowReopen || this.prepareTurnActive || !this.hasActiveBattle() || this.battleIntroActive
            || this.actionInProgress || this.targetSelection) return false;
        const firstLivingIndex = party.findIndex(member => member.isAlive());
        if (firstLivingIndex < 0) return false;

        if (this.battlePhase !== BATTLE_PHASE.PHASE_TRANSITION
            && !battleFlowManager.transition(BATTLE_PHASE.PHASE_TRANSITION)) return false;
        if (!battleFlowManager.reopenPreparation({ enabled: allowReopen })) return false;
        classCombat.beginPrepare(party);

        this.cancelPendingBattleTimers();
        targetManager.cancel();
        clearSelectedAction();
        turnManager.resumePlayerSide(firstLivingIndex);
        for (const member of this.getLivingPlayers()) member.hasActedThisTurn = false;
        this.enemyTurnPending = false;
        this.enemySequencePhase = "idle";
        this.actionInProgress = false;
        this.actingPlayerId = null;
        this.currentEnemyId = null;
        this.currentEnemyTargetId = null;
        this.selectedTargetId = this.getLivingEnemies()[0]?.id || null;
        if (reason) this.addBattleLog(`Prepare phase reopened: ${reason}`);
        refreshCommandMenu({ resetToAction: true });
        openCommandMenu();
        this.updateUI();
        this.updateControls();
        BattleCamera.focusCharacter(this.getActivePlayer());
        announceTurn("PREPARE TURN", "playerTurn");
        return true;
    },

    reopenPreparation(options = {}) {
        return this.requestPreparePhase({
            reason: options.reason || "",
            allowReopen: options.allowReopen === true || options.enabled === true
        });
    }
};

function handleAttack(actionElement) {
    return Game.beginTargetSelection({
        type: "attack",
        apCost: getActivePlayer().basicAttack.apCost,
        actionElement
    });
}

function executeAttack(target) {
    const actor = Game.getActingPlayer();
    let actionSucceeded = false;
    let finishingBlow = false;
    let targetDefeated = false;
    let punchComplete = false;
    let reactionComplete = false;

    const completeActionWhenReady = () => {
        if (finishingBlow || !punchComplete) return;
        if (targetDefeated && !reactionComplete) return;
        Game.completePlayerAction({ successful: actionSucceeded });
    };

    const started = playPlayerPunch(actor, () => {
        const result = Game.playerAttack(target, { deferFinish: true });
        actionSucceeded = result.executed;
        finishingBlow = result.battleEnded === true;
        targetDefeated = result.executed && !target.isAlive();

        if (result.executed) {
            showDamageNumber(result.damage, target, result.hitType);
            playPunchHitEffect(target);
            playEnemyHitAnimation(target, () => {
                reactionComplete = true;
                if (finishingBlow && Game.battleStatus === BATTLE_STATUS.ACTIVE) {
                    Game.finishBattle("victory");
                    return;
                }
                completeActionWhenReady();
            });
        }
    }, () => {
        punchComplete = true;
        completeActionWhenReady();
    });

    if (!started) Game.completePlayerAction({ successful: false });
}

function handleSkill(skillId, actionElement) {
    const skill = skills[skillId];
    if (!skill) return false;
    const apCost = classCombat.getCost(getActivePlayer(),skill);

    if (skill.targetType === "all-enemies" || skill.targetType === "all-allies" || skill.targetType === "self") {
        if (!Game.beginPlayerAction(apCost, actionElement)) return false;
        return Game.queuePlayerActionExecution(() => executeSkill(skillId, null));
    }

    return Game.beginTargetSelection({ type: "skill", skillId, apCost, actionElement });
}

function executePunchSkill(skillId, target) {
    const skill = skills[skillId];
    const actor = Game.getActingPlayer();
    if (!skill || !actor || !target?.isAlive()) {
        Game.completePlayerAction({ successful: false });
        return false;
    }

    const hitCount = Math.max(1, Math.floor(Number(skill.hitCount) || 1));
    let hitIndex = 0;
    let apSpent = false;

    const startHit = () => {
        if (!Game.hasActiveBattle() || !target.isAlive()) {
            Game.completePlayerAction({ successful: apSpent });
            return;
        }

        let punchComplete = false;
        let reactionComplete = false;
        let resolved = false;
        let result = null;

        const advance = () => {
            if (!resolved || !punchComplete || !reactionComplete) return;

            if (result?.battleEnded) {
                if (Game.battleStatus === BATTLE_STATUS.ACTIVE) Game.finishBattle("victory");
                return;
            }
            if (!target.isAlive() || hitIndex >= hitCount) {
                Game.completePlayerAction({ successful: true });
                return;
            }

            Game.scheduleBattleTask(startHit, Math.max(0, Number(skill.hitGapMs) || 0));
        };

        const started = playPlayerPunch(actor, () => {
            result = Game.useSkill(skillId, target, {
                deferFinish: true,
                spendAp: !apSpent
            });
            resolved = true;
            if (!result.executed) {
                reactionComplete = true;
                Game.completePlayerAction({ successful: false });
                return;
            }

            apSpent = true;
            hitIndex += 1;
            showDamageNumber(result.damage, target, result.hitType);
            playPunchHitEffect(target);
            playBattleScreenShake(skill.screenShakeIntensity, skill.screenShakeDurationMs);

            const isIntermediateRapidHit = skill.rapidCombo === true && hitIndex < hitCount;
            if (isIntermediateRapidHit) {
                reactionComplete = true;
                advance();
            } else {
                playEnemyHitAnimation(target, () => {
                    reactionComplete = true;
                    advance();
                });
            }
        }, () => {
            punchComplete = true;
            advance();
        }, {
            frameDurationMs: Number.isFinite(skill.animationFrameDurationMs)
                ? skill.animationFrameDurationMs
                : null
        });

        if (!started) Game.completePlayerAction({ successful: false });
    };

    startHit();
    return true;
}

function rollSkillRange(range, randomSource = Game.randomSource) {
    const source = Array.isArray(range) ? range : [0, 0];
    const minimum = Math.max(0, Math.floor(Math.min(Number(source[0]) || 0, Number(source[1]) || 0)));
    const maximum = Math.max(minimum, Math.floor(Math.max(Number(source[0]) || 0, Number(source[1]) || 0)));
    const roll = Math.max(0, Math.min(0.999999, Number(randomSource?.()) || 0));
    return minimum + Math.floor(roll * (maximum - minimum + 1));
}

function executeAreaDamageSkill(skillId) {
    const skill = skills[skillId];
    const actor = Game.getActingPlayer();
    const initialTargets = Game.getLivingEnemies();
    if (!skill || !actor || initialTargets.length === 0) {
        Game.completePlayerAction({ successful: false });
        return false;
    }

    const resolveCast = () => {
        Game.scheduleBattleTask(() => {
            const targets = Game.getLivingEnemies();
            const results = [];
            let apSpent = false;

            for (const enemyTarget of targets) {
                const result = Game.useSkill(skillId, enemyTarget, {
                    deferFinish: true,
                    spendAp: !apSpent
                });
                if (!result.executed) continue;
                apSpent = true;
                results.push(result);
                showFloatingCombatNumber(result.damage, enemyTarget, {
                    type: "damage",
                    hitType: result.hitType,
                    skillId, skill,
                    effectId: skill.effectId || "fire-heavy"
                });
            }

            if (results.length === 0) {
                Game.completePlayerAction({ successful: false });
                return;
            }

            let pendingReactions = results.length;
            const finishReactions = () => {
                pendingReactions -= 1;
                if (pendingReactions > 0) return;
                if (Game.getLivingEnemies().length === 0) {
                    if (Game.battleStatus === BATTLE_STATUS.ACTIVE) Game.finishBattle("victory");
                    return;
                }
                Game.completePlayerAction({ successful: true });
            };

            for (const result of results) {
                playEnemyHitAnimation(result.target, finishReactions);
            }
        }, skill.presentationLeadMs || 0);
    };

    if (!playPlayerCast(actor, resolveCast)) resolveCast();
    return true;
}

function executeTeamHealSkill(skillId) {
    const definition = skills[skillId];
    const skill = definition ? { ...definition, apCost: classCombat.getCost(Game.getActingPlayer(),definition) } : null;
    const actor = Game.getActingPlayer();
    const livingParty = Game.getLivingPlayers();
    const healTargets = livingParty.filter(member => member.hp < member.maxHp);
    if (!skill || !actor || healTargets.length === 0 || !Game.canResolvePlayerAction(skill.apCost)) {
        Game.completePlayerAction({ successful: false });
        return false;
    }

    let resolved = false;
    const resolveHeal = () => {
        if (resolved || !Game.canResolvePlayerAction(skill.apCost)) return;
        resolved = true;
        actor.ap = Math.max(0, actor.ap - skill.apCost);

        for (const member of healTargets) {
            if (!member.isAlive() || member.hp >= member.maxHp) continue;
            const rolledHeal = rollSkillRange(skill.healRange);
            const healed = Math.min(rolledHeal, member.maxHp - member.hp);
            member.hp = Math.min(member.maxHp, member.hp + healed);
            showFloatingCombatNumber(healed, member, { type: "heal" });
            Game.addBattleLog(actor.name + " heals " + member.name + " for " + healed + " HP.");
        }
        Game.updateUI();
    };

    const completeHeal = () => {
        if (!resolved) resolveHeal();
        Game.completePlayerAction({ successful: resolved });
    };

    if (!playPlayerCast(actor, resolveHeal, completeHeal)) {
        resolveHeal();
        completeHeal();
    }
    return true;
}

function executeSkill(skillId, target) {
    const skill = skills[skillId];
    if (!skill) {
        Game.completePlayerAction({ successful: false });
        return;
    }

    if (skill.targetType === "self") {
        const actor = Game.getActingPlayer();
        if (!actor || !Game.canResolvePlayerAction(skill.apCost) || !actor.unlockedSkillIds.includes(skillId)) { Game.completePlayerAction({ successful: false }); return; }
        const activeResult = skillEffectResolver.applyActiveEffect(actor, skill.activeEffect);
        if (!activeResult.applied) { Game.completePlayerAction({ successful: false }); return; }
        actor.ap = Math.max(0, actor.ap - skill.apCost);
        if (activeResult.healed > 0) showFloatingCombatNumber(activeResult.healed, actor, { type: "heal" });
        else effects.present({ type: "buff", target: actor, skill });
        Game.addBattleLog(activeResult.message);
        Game.updateUI(); Game.completePlayerAction({ successful: true }); return;
    }

    if (skill.targetType === "all-enemies") {
        executeAreaDamageSkill(skillId);
        return;
    }

    if (skill.targetType === "all-allies" && skill.healRange) {
        executeTeamHealSkill(skillId);
        return;
    }

    if (skill.animationType === "punch") {
        executePunchSkill(skillId, target);
        return;
    }

    const resolveCast = () => {
        Game.scheduleBattleTask(() => {
            const result = Game.useSkill(skillId, target, { deferFinish: true });
            if (!result.executed) {
                Game.completePlayerAction({ successful: false });
                return;
            }

            showDamageNumber(result.damage, target, result.hitType, { skillId, skill });

            playEnemyHitAnimation(target, () => {
                if (result.battleEnded) {
                    if (Game.battleStatus === BATTLE_STATUS.ACTIVE) Game.finishBattle("victory");
                    return;
                }
                Game.completePlayerAction({ successful: true });
            });
        }, skill.presentationLeadMs || 0);
    };

    const actor = Game.getActingPlayer();
    if (!playPlayerCast(actor, resolveCast)) resolveCast();
}

function handleBattleInput(action) {
    if (action === BATTLE_INPUT_ACTION.SYSTEM_MENU) return Game.reserveSystemMenu();

    if (Game.battleEndPhase === "summary") {
        return action === BATTLE_INPUT_ACTION.CONFIRM && Game.completeBattleSummary();
    }

    if (Game.battleIntroActive || Game.actionInProgress) return false;

    if (Game.targetSelection) {
        if (action === BATTLE_INPUT_ACTION.MOVE_LEFT) return Game.changeTarget(-1);
        if (action === BATTLE_INPUT_ACTION.MOVE_RIGHT) return Game.changeTarget(1);
        if (action === BATTLE_INPUT_ACTION.MOVE_UP) return Game.changeTargetSpatially({ x: 0, y: -1 });
        if (action === BATTLE_INPUT_ACTION.MOVE_DOWN) return Game.changeTargetSpatially({ x: 0, y: 1 });
        if (action === BATTLE_INPUT_ACTION.CONFIRM) return Game.confirmTargetSelection();
        if (action === BATTLE_INPUT_ACTION.CANCEL) return Game.cancelTargetSelection();
        return false;
    }

    if (!Game.canAcceptPlayerInput()) return false;
    if (action === BATTLE_INPUT_ACTION.MOVE_UP) return moveCommandSelection(-1);
    if (action === BATTLE_INPUT_ACTION.MOVE_DOWN) return moveCommandSelection(1);
    if (action === BATTLE_INPUT_ACTION.MOVE_LEFT) return navigateCommandCategory(-1);
    if (action === BATTLE_INPUT_ACTION.MOVE_RIGHT) return navigateCommandCategory(1);
    if (action === BATTLE_INPUT_ACTION.CONFIRM) return confirmCommandSelection();
    if (action === BATTLE_INPUT_ACTION.CANCEL) return returnToActionCategory();
    return false;
}

let sceneEventsBound = false;
const previousCommandClick = () => navigateCommandCategory(-1);
const nextCommandClick = () => navigateCommandCategory(1);
const summaryNextClick = () => Game.completeBattleSummary();

function bindBattleSceneEvents() {
    if (sceneEventsBound) return;
    elements.previousCommandTab.addEventListener("click", previousCommandClick);
    elements.nextCommandTab.addEventListener("click", nextCommandClick);
    elements.battleSummaryNext.addEventListener("click", summaryNextClick);
    sceneEventsBound = true;
}

function unbindBattleSceneEvents() {
    elements.previousCommandTab.removeEventListener?.("click", previousCommandClick);
    elements.nextCommandTab.removeEventListener?.("click", nextCommandClick);
    elements.battleSummaryNext.removeEventListener?.("click", summaryNextClick);
    globalThis.removeEventListener?.("resize", updateAllCharacterHuds);
    sceneEventsBound = false;
}

const BattleScene = {
    enter(context = {}) {
        battleSceneContext = context;
        const { skipIntro = false } = context;
        const initialState = context.sceneManager?.services?.gameManager?.globalState || null;
        if (context.encounterId) configureBattleParty(initialState);
        configureBattleEnemies(context);
        elements.battleScreen.hidden = false;
        bindBattleSceneEvents();
        globalThis.addEventListener?.("resize", updateAllCharacterHuds);
        Game.currentScene = "battle";
        BattleInputManager.configure({
            handler: handleBattleInput,
            contextGuard: () => Game.currentScene === "battle"
        }).attach(document);
        Game.start({
            skipIntro,
            preparePhase: context.preparePhase || null,
            enablePrepare: context.enablePrepare === true,
            initialState
        });
    },

    exit() {
        elements.battleScreen.hidden = true;
        Game.currentScene = null;
        Game.cancelPendingBattleTimers();
        BattleInputManager.detach();
        unbindBattleSceneEvents();
        stopHudTracking();
        closeCommandMenu();
        stopPlayerAnimation();
        stopEnemyHitAnimations({ restoreIdle: false });
        stopEnemyIdleAnimation();
        animationDirector.clearDeathPoses();
        for (const view of actorPresentation.getViews()) {
            view.slotElement?.classList.remove("is-dying", "is-dead-pose");
        }
        clearVisualTimers();
        BattleCamera.resetCamera();
        if (elements.battleScreen) {
            delete elements.battleScreen.dataset.battleBackgroundMap;
            delete elements.battleScreen.dataset.battleBackgroundId;
        }
        battleSceneContext = null;
    }
};

export {
    BATTLE_STATUS,
    BATTLE_PHASE,
    BATTLE_INPUT_ACTION,
    BattleCamera,
    BattleInputManager,
    BattleScene,
    commandCategoryDefinitions,
    dummy,
    enemies,
    enemy,
    FORMATION_SLOTS,
    Game,
    highlandMan,
    party,
    player,
    skills,
    TURN
};
