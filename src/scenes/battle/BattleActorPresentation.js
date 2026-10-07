import { STATUS_EFFECT_DEFINITIONS as statusPresentation } from "../../data/statusEffects.js";
import { AssetResolver } from "../../core/AssetResolver.js";
import { resolveBattleVisualTransform } from "../../core/BattleVisualTransform.js";
import { assignFormation } from "../../battle/BattleFormation.js";
import { createEnemyHud } from "../../ui/EnemyHUD.js";
import { createPartyHud } from "../../ui/PartyHUD.js";
import { createPlaceholderActor, setPlaceholderState } from "../../ui/placeholders/PlaceholderActor.js";

const SHOW_FORMATION_MARKERS = false;

// Owns formation DOM and HUD anchoring; target clicks are requests to the scene.
export function createBattleActorPresentation({
    elements, party, enemies, configureResolvedAssets, getActivePlayer, onTargetClick, canTrackHud,
    getAnimationDirector, getEntityStatuses, statusTooltipView, updateCommandControlStates, BATTLE_STATUS, TURN
}) {
    const entityViews = new Map();
    const HUD_VIEWPORT_MARGIN = 28;
    let hudMotionFrame = null;

    function getEntityView(entity) {
        return entity ? entityViews.get(entity.id) || null : null;
    }

    function getPlayerAnimation(entity, action) {
        return entity?.animations?.[action] || { id: action, frames: 1 };
    }

    function resolvePlayerFrameSource(entity, action, frame = 1) {
        const animation = getPlayerAnimation(entity, action);
        const assetId = entity?.assetId || entity?.id;
        if (animation.fileName) {
            const root = AssetResolver.player(assetId);
            const folder = animation.folder ? `${animation.folder}/` : "";
            return `${root}${folder}${animation.fileName}`;
        }
        return AssetResolver.playerFrame(assetId, animation.id, frame);
    }

    function applyPlayerSheetFrame(sprite, entity, animation, frame = 1, source = "") {
        if (!sprite || sprite.dataset?.spriteSheet !== "true" || !animation?.spriteSheet) return false;
        const viewport = sprite._sheetViewport;
        const sheetImage = sprite._sheetImage;
        if (!viewport || !sheetImage) return false;

        const columns = Math.max(1, Math.floor(Number(animation.columns) || 1));
        const rows = Math.max(1, Math.floor(Number(animation.rows) || 1));
        const frameCount = Math.max(1, Math.floor(Number(animation.frames) || 1));
        const logicalFrame = Math.max(1, Math.min(frameCount, Math.floor(Number(frame) || 1)));
        const startFrame = Math.max(1, Math.floor(Number(animation.sheetStartFrame) || 1));
        const sourceFrame = Math.max(1, Math.min(columns * rows, startFrame + logicalFrame - 1));
        const zeroBasedFrame = sourceFrame - 1;
        const column = zeroBasedFrame % columns;
        const row = Math.floor(zeroBasedFrame / columns);
        const frameAspectRatio = Math.max(0.1, Number(animation.frameAspectRatio) || 1);
        const visual = resolveBattleVisualTransform(entity, animation);

        viewport.style.aspectRatio = String(frameAspectRatio);
        viewport.style.width = `${visual.scale * 100}%`;
        viewport.style.left = `${50 + visual.offsetX}%`;
        viewport.style.bottom = `${visual.offsetY}%`;
        viewport.style.transform = "translateX(-50%)";
        sheetImage.style.width = `${columns * 100}%`;
        sheetImage.style.height = `${rows * 100}%`;
        sheetImage.style.transform = `translate(${-column * (100 / columns)}%, ${-row * (100 / rows)}%)`;

        const currentSource = sheetImage.getAttribute("src") || "";
        if (source && currentSource !== source) sheetImage.src = source;

        sprite.dataset.animationFrame = String(logicalFrame);
        sprite.dataset.animationSourceFrame = String(sourceFrame);
        sprite.dataset.sheetColumns = String(columns);
        sprite.dataset.sheetRows = String(rows);
        sprite.dataset.sheetFrameAspectRatio = String(frameAspectRatio);
        sprite.dataset.sheetRenderScale = String(visual.scale);
        sprite.dataset.sheetRenderOffsetX = String(visual.offsetX);
        sprite.dataset.sheetRenderOffsetY = String(visual.offsetY);
        return true;
    }

    function getPlayerFrame(entity, action, frame = 1) {
        const animation = getPlayerAnimation(entity, action);
        const source = resolvePlayerFrameSource(entity, action, frame);
        if (animation.spriteSheet) {
            const sprite = getEntityView(entity)?.sprite;
            applyPlayerSheetFrame(sprite, entity, animation, frame, source);
        }
        return source;
    }

    function createPlayerSheetSprite(entity) {
        const sprite = document.createElement("span");
        sprite.dataset.spriteSheet = "true";
        sprite.setAttribute("role", "img");
        sprite.setAttribute("aria-label", entity.name);
        sprite.style.overflow = "visible";

        const viewport = document.createElement("span");
        viewport.dataset.spriteSheetViewport = "true";
        Object.assign(viewport.style, {
            position: "absolute",
            left: "50%",
            bottom: "0",
            display: "block",
            width: "100%",
            aspectRatio: "1",
            overflow: "hidden",
            transform: "translateX(-50%)",
            transformOrigin: "center bottom",
            pointerEvents: "none"
        });

        const sheetImage = document.createElement("img");
        sheetImage.dataset.spriteSheetImage = "true";
        sheetImage.alt = "";
        sheetImage.draggable = false;
        sheetImage.setAttribute("aria-hidden", "true");
        Object.assign(sheetImage.style, {
            position: "absolute",
            left: "0",
            top: "0",
            display: "block",
            maxWidth: "none",
            maxHeight: "none",
            objectFit: "fill",
            transformOrigin: "top left",
            pointerEvents: "none"
        });
        sheetImage.addEventListener("error", () => sprite.classList.add("asset-missing"));
        sheetImage.addEventListener("load", () => sprite.classList.remove("asset-missing"));

        viewport.appendChild(sheetImage);
        sprite.appendChild(viewport);
        sprite._sheetViewport = viewport;
        sprite._sheetImage = sheetImage;

        // BattleAnimationDirector already writes sprite.src for ordinary frame images.
        // Expose the same property on the sheet host so existing animation clocks can
        // keep running while only the inner sheet image changes source.
        Object.defineProperty(sprite, "src", {
            configurable: true,
            get() {
                return sheetImage.getAttribute("src") || "";
            },
            set(value) {
                const source = String(value || "");
                if (source && sheetImage.getAttribute("src") !== source) sheetImage.src = source;
            }
        });

        return sprite;
    }

    function getEnemyAnimation(entity, action) {
        return entity?.animations?.[action] || null;
    }

    function getEnemyFrame(entity, action = "idle", frame = 1) {
        const animation = getEnemyAnimation(entity, action);
        if (!animation) return entity?.sprite || AssetResolver.enemySprite(entity?.assetId || entity?.id, action);

        if (animation.fileName) {
            const root = AssetResolver.enemy(entity?.assetId || entity?.id);
            const folder = animation.folder ? `${animation.folder}/` : "";
            return `${root}${folder}${animation.fileName}`;
        }

        if (animation.folder || animation.filePrefix) {
            return AssetResolver.enemyAnimationFramePattern(entity?.assetId || entity?.id, frame, {
                folder: animation.folder || "",
                prefix: animation.filePrefix || "",
                padding: animation.framePadding || 2
            });
        }
        return AssetResolver.enemyAnimationFrame(entity?.assetId || entity?.id, animation.id, frame);
    }

    function createFormationSlot(slot, entity) {
        const slotElement = document.createElement("article");
        slotElement.className = `formation-slot ${slot.side}-slot${entity ? "" : " empty-slot"}`;
        slotElement.dataset.formationSlot = slot.id;
        slotElement.style.setProperty("--slot-x", String(slot.x));
        slotElement.style.setProperty("--slot-y", String(slot.y));

        const debugMarker = document.createElement("span");
        debugMarker.className = "formation-marker";
        debugMarker.textContent = slot.id;
        slotElement.appendChild(debugMarker);

        if (!entity) return { slotElement };

        const marker = document.createElement("span");
        marker.className = "active-turn-marker";
        marker.textContent = "◆";
        marker.setAttribute("aria-hidden", "true");

        const hudAnchor = document.createElement("span");
        hudAnchor.className = "character-hud-anchor";
        hudAnchor.style.setProperty("--hud-anchor-x", `${slot.hudAnchorX ?? 50}%`);
        hudAnchor.style.setProperty("--hud-anchor-y", `${slot.hudAnchorY ?? 40}%`);
        hudAnchor.setAttribute("aria-hidden", "true");

        const footShadow = document.createElement("span");
        footShadow.className = `combatant-foot-shadow ${slot.side}-foot-shadow`;
        footShadow.setAttribute("aria-hidden", "true");

        const usesPlaceholder = entity.visual?.type === "placeholder";
        const usesPlayerSheet = slot.side === "player"
            && Object.values(entity.animations || {}).some(animation => animation?.spriteSheet === true);
        const sprite = usesPlaceholder
            ? createPlaceholderActor({
                entityId: entity.visualEntityId || entity.id,
                family: entity.visual.family,
                variant: entity.visual.variant,
                scale: entity.visual.scale,
                facing: slot.side === "enemy" ? "west" : "east",
                role: slot.side
            })
            : (usesPlayerSheet ? createPlayerSheetSprite(entity) : document.createElement("img"));
        sprite.classList.add("combatant-sprite");
        if (usesPlaceholder) {
            sprite.classList.add("battle-placeholder");
        } else if (usesPlayerSheet) {
            const idleAnimation = getPlayerAnimation(entity, "idle");
            const source = resolvePlayerFrameSource(entity, "idle", 1);
            applyPlayerSheetFrame(sprite, entity, idleAnimation, 1, source);
        } else {
            sprite.alt = entity.name;
            sprite.src = slot.side === "player"
                ? getPlayerFrame(entity, "idle", 1)
                : getEnemyFrame(entity, "idle", 1);
            if (slot.side === "enemy") sprite.dataset.animationFrame = "1";
            sprite.addEventListener("error", () => sprite.classList.add("asset-missing"));
        }

        let targetButton = null;
        let frameBlendSprite = null;
        if (slot.side === "enemy") {
            targetButton = document.createElement("button");
            targetButton.type = "button";
            targetButton.className = "enemy-target";
            targetButton.setAttribute("aria-label", `Target ${entity.name}`);

            if (!usesPlaceholder) {
                frameBlendSprite = document.createElement("img");
                frameBlendSprite.className = "combatant-sprite combatant-frame-blend";
                frameBlendSprite.src = sprite.src;
                frameBlendSprite.alt = "";
                frameBlendSprite.setAttribute("aria-hidden", "true");
            }

            if (frameBlendSprite) targetButton.append(sprite, frameBlendSprite);
            else targetButton.appendChild(sprite);
            targetButton.addEventListener("click", () => onTargetClick(entity.id));
            slotElement.append(hudAnchor, marker, footShadow, targetButton);
        } else {
            slotElement.append(hudAnchor, marker, footShadow, sprite);
        }

        return { slotElement, sprite, frameBlendSprite, marker, targetButton, hudAnchor, footShadow };
    }

    function buildBattlePresentation() {
        configureResolvedAssets();
        entityViews.clear();
        elements.formationLayer.replaceChildren();
        elements.partyHudLayer.replaceChildren();
        elements.enemyHudLayer.replaceChildren();
        elements.battleScreen.classList[SHOW_FORMATION_MARKERS ? "add" : "remove"]("show-formation-markers");

        const assignments = [
            ...assignFormation("player", party),
            ...assignFormation("enemy", enemies)
        ];
        for (const { slot, entity } of assignments) {
            const formationView = createFormationSlot(slot, entity);
            elements.formationLayer.appendChild(formationView.slotElement);
            if (!entity) continue;
            const hudView = slot.side === "player"
                ? createPartyHud(slot, entity)
                : createEnemyHud(slot, entity);
            (slot.side === "player" ? elements.partyHudLayer : elements.enemyHudLayer).appendChild(hudView.hud);
            entityViews.set(entity.id, { ...formationView, ...hudView, slot });
        }
        updateAllCharacterHuds();
    }

    function getHudAnchorScreenPosition(view) {
        const anchorRect = view?.hudAnchor?.getBoundingClientRect?.();
        const viewportRect = elements.battlefield?.getBoundingClientRect?.();
        if (!anchorRect || !viewportRect
            || !Number.isFinite(anchorRect.left) || !Number.isFinite(anchorRect.top)
            || !Number.isFinite(viewportRect.left) || !Number.isFinite(viewportRect.top)) return null;

        return {
            x: anchorRect.left + anchorRect.width / 2 - viewportRect.left,
            y: anchorRect.top + anchorRect.height / 2 - viewportRect.top,
            width: viewportRect.width,
            height: viewportRect.height
        };
    }

    function isHudAnchorVisible(position) {
        return Boolean(position)
            && position.x >= -HUD_VIEWPORT_MARGIN
            && position.x <= position.width + HUD_VIEWPORT_MARGIN
            && position.y >= -HUD_VIEWPORT_MARGIN
            && position.y <= position.height + HUD_VIEWPORT_MARGIN;
    }

    function updateEnemyHud(view) {
        const position = getHudAnchorScreenPosition(view);
        if (!position) return false;

        const { hud, slot } = view;
        const visible = isHudAnchorVisible(position);
        hud.hidden = !visible;
        if (!visible) return false;

        hud.style.setProperty("--hud-screen-x", `${position.x}px`);
        hud.style.setProperty("--hud-screen-y", `${position.y}px`);
        return true;
    }

    function updateActiveActionHud() {
        const activePlayer = getActivePlayer();
        const view = getEntityView(activePlayer);
        const position = getHudAnchorScreenPosition(view);
        if (!view || !position || !isHudAnchorVisible(position)) {
            elements.battleMenu.dataset.anchorVisible = "false";
            return false;
        }

        const gap = Number(view.slot.hudOffsetX || 28);
        const menuWidth = elements.battleMenu.offsetWidth || 240;
        const menuHeight = elements.battleMenu.offsetHeight || 210;
        const preferredSide = view.slot.hudSide === "left" ? -1 : 1;
        const preferredLeft = position.x + preferredSide * gap;
        const wouldOverflow = preferredSide > 0
            ? preferredLeft + menuWidth > position.width - HUD_VIEWPORT_MARGIN
            : preferredLeft - menuWidth < HUD_VIEWPORT_MARGIN;
        const side = wouldOverflow ? -preferredSide : preferredSide;
        const x = side > 0 ? position.x + gap : position.x - gap - menuWidth;
        const y = Math.min(
            position.height - menuHeight - HUD_VIEWPORT_MARGIN,
            Math.max(HUD_VIEWPORT_MARGIN, position.y + Number(view.slot.hudOffsetY || -34))
        );
        elements.battleMenu.dataset.anchorVisible = "true";
        elements.battleMenu.dataset.hudSide = side > 0 ? "right" : "left";
        elements.battleMenu.style.setProperty("--action-screen-x", `${x}px`);
        elements.battleMenu.style.setProperty("--action-screen-y", `${y}px`);
        return true;
    }

    function updateAllCharacterHuds() {
        for (const view of entityViews.values()) {
            if (view.slot.side === "enemy") updateEnemyHud(view);
            else view.hud.hidden = false;
        }
        updateActiveActionHud();
    }

    function trackHudDuringCameraTransition() {
        if (!canTrackHud() || typeof requestAnimationFrame !== "function") return;
        if (hudMotionFrame !== null) cancelAnimationFrame(hudMotionFrame);
        const endAt = performance.now() + 320;
        const tick = () => {
            if (!canTrackHud()) { hudMotionFrame = null; return; }
            updateAllCharacterHuds();
            if (performance.now() < endAt) hudMotionFrame = requestAnimationFrame(tick);
            else hudMotionFrame = null;
        };
        hudMotionFrame = requestAnimationFrame(tick);
    }

    function stopHudTracking() {
        if (hudMotionFrame !== null) cancelAnimationFrame(hudMotionFrame);
        hudMotionFrame = null;
    }

    function updateProgressBar(bar, fill, value, maximum) {
        const safeMaximum = Math.max(1, Number.isFinite(maximum) ? maximum : 1);
        const safeValue = Math.min(safeMaximum, Math.max(0, Number.isFinite(value) ? value : 0));
        const percentage = (safeValue / safeMaximum) * 100;
        fill.style.width = `${percentage}%`;
        fill.classList[percentage <= 25 ? "add" : "remove"]("is-low");
        bar.setAttribute("aria-valuemax", String(safeMaximum));
        bar.setAttribute("aria-valuenow", String(safeValue));
    }

    function updateEntityView(entity) {
        const view = getEntityView(entity);
        if (!view) return;
        const alive = entity.isAlive();
        const isEnemy = enemies.includes(entity);

        // Corpse persistence is generic: once any enemy reaches 0 HP, its body
        // remains on the battlefield until the battle scene is reset/exited.
        if (isEnemy && !alive) getAnimationDirector().rememberDeathPose(entity.id);

        const enemyReactionVisible = isEnemy && getAnimationDirector().isAnimatingEnemy(entity.id);
        const persistentDeathPose = isEnemy && getAnimationDirector().hasDeathPose(entity.id);
        const shouldHideBody = !alive && !enemyReactionVisible && !persistentDeathPose;
        view.name.textContent = entity.name;
        view.name.title = entity.name;
        view.hp.textContent = "HP: " + entity.hp + " / " + entity.maxHp;
        if (view.ap) view.ap.textContent = "AP: " + entity.ap + " / " + entity.maxAp;
        if (view.sprite.tagName === "IMG") view.sprite.alt = entity.name;
        else if (view.sprite.dataset?.spriteSheet === "true") view.sprite.setAttribute("aria-label", entity.name);
        if (!alive) setPlaceholderState(view.sprite, "death");
        view.hud.setAttribute("aria-label", entity.name + " combat status");
        updateProgressBar(view.hpBar, view.hpFill, entity.hp, entity.maxHp);
        view.slotElement.classList[shouldHideBody ? "add" : "remove"]("is-defeated");
        view.slotElement.classList[persistentDeathPose ? "add" : "remove"]("is-dead-pose");
        view.hud.classList[alive ? "remove" : "add"]("is-defeated");

        statusTooltipView.renderIndicators(view.statuses, getEntityStatuses(entity), statusPresentation);
    }

    function updateUI(game) {
        const activePlayer = game.getActivePlayer();
        const waitingForCommand = game.canAcceptPlayerInput();
        const targeting = Boolean(game.targetSelection);

        for (const member of party) game.updateEntityView(member);
        for (const opponent of enemies) game.updateEntityView(opponent);

        for (const member of party) {
            const view = getEntityView(member);
            if (!view) continue;
            const isActive = member === activePlayer
                && game.battleStatus === BATTLE_STATUS.ACTIVE
                && game.currentTurn === TURN.PLAYER;
            view.hud.classList[isActive ? "add" : "remove"]("active-combatant");
            view.slotElement.classList[isActive && waitingForCommand ? "add" : "remove"]("awaiting-command");
        }

        for (const opponent of enemies) {
            const view = getEntityView(opponent);
            const isSelected = targeting && opponent.id === game.selectedTargetId && opponent.isAlive();
            view?.targetButton?.classList[isSelected ? "add" : "remove"]("is-selected-target");
        }

        if (activePlayer && game.canShowPlayerCommands() && !elements.battleMenu.hidden) {
            elements.battleHud.appendChild(elements.battleMenu);
        }

        updateAllCharacterHuds();

        elements.battleScreen.dataset.battleState = game.battleStatus;
        elements.battleScreen.dataset.battlePhase = game.battlePhase;
        elements.battleScreen.dataset.turn = game.currentTurn;
        elements.battleScreen.dataset.result = game.battleResult || "";
        elements.battleScreen.dataset.postBattlePhase = game.battleEndPhase;
        elements.battleScreen.dataset.inputMode = game.battleEndPhase === "summary"
            ? "summary"
            : (targeting
            ? "target"
            : (waitingForCommand ? "command" : "locked"));

        if (game.battleStatus === BATTLE_STATUS.FINISHED) {
            elements.turnText.textContent = game.battleResult === "victory" ? "VICTORY" : "DEFEAT";
        } else if (game.prepareTurnActive) {
            elements.turnText.textContent = "PREPARE TURN";
        } else if (game.currentTurn === TURN.PLAYER) {
            elements.turnText.textContent = activePlayer ? "PLAYER TURN — " + activePlayer.name.toUpperCase() : "PLAYER TURN";
        } else {
            elements.turnText.textContent = "ENEMY TURN";
        }
    }

    function updateControls(game) {
        const canInput = game.canAcceptPlayerInput();
        const canTarget = game.canAcceptTargetInput();

        elements.battleMenu.inert = !canInput;
        elements.battleMenu.setAttribute("aria-disabled", String(!canInput));
        elements.battleMenu.classList[canInput ? "remove" : "add"]("is-locked");
        updateCommandControlStates(canInput);
        elements.battleSummaryNext.disabled = game.battleEndPhase !== "summary";

        for (const opponent of enemies) {
            const button = getEntityView(opponent)?.targetButton;
            if (button) button.disabled = !canTarget || !opponent.isAlive();
        }
    }

    return {
        updateEntityView, updateUI, updateControls,
        getEntityView,
        getPlayerAnimation,
        getPlayerFrame,
        getEnemyAnimation,
        getEnemyFrame,
        buildBattlePresentation,
        updateActiveActionHud,
        updateAllCharacterHuds,
        trackHudDuringCameraTransition,
        stopHudTracking,
        getViews: () => entityViews.values()
    };
}
