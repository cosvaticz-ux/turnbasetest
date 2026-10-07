import { AudioManager } from "../../core/AudioManager.js";
import { getFormationSlot } from "../../battle/BattleFormation.js";
import { BATTLE_VFX, getBattleVfx } from "../../data/battleVfx.js";
import { resolveBattleEffect, getEffectTiming } from "../../data/battleEffectRegistry.js";

// Shared visual timeout registry, effects and announcements. No combat resolution.
export function createBattleEffectPresentation({
    elements, getEntityView, getEntityViews, getSelectedTarget, hasActiveBattle, isBattleScene,
    resetCommandTransition, statusTooltipView, TURN_ANNOUNCEMENT_MS
}) {
    let turnPopupTimer = null;
    let visualGeneration = 0;
    const visualTimers = new Set();
    const screenAnimations = new Set();
    const floatingNumbers = new Set();
    const runtimeVfxNodes = new Set();
    const atlasLayoutPromises = new Map();

    function getEntityEffectPosition(entity) {
        const slot = getFormationSlot(entity?.formationSlot);
        if (!slot) return null;
        return {
            x: slot.x,
            y: Math.min(86, slot.y + 24)
        };
    }

    function placeEffectAtEntity(entity) {
        const position = getEntityEffectPosition(entity);
        if (!position) return;
        for (const effect of [elements.fireballEffect, elements.icePikeEffect, elements.poisonEffect, elements.damageNumber]) {
            effect?.style?.setProperty("--effect-x", `${position.x}%`);
            effect?.style?.setProperty("--effect-y", `${position.y}%`);
        }
    }

    function scheduleVisual(callback, delay) {
        const generation = visualGeneration;
        const timerId = setTimeout(() => {
            visualTimers.delete(timerId);
            if (generation !== visualGeneration || !isBattleScene()) return;
            callback();
        }, delay);
        visualTimers.add(timerId);
        return timerId;
    }

    function removeRuntimeVfx(node) {
        if (!node) return;
        runtimeVfxNodes.delete(node);
        node.remove?.();
    }

    function clearVisualTimers() {
        visualGeneration += 1;
        for (const timerId of visualTimers) clearTimeout(timerId);
        visualTimers.clear();
        for (const animation of screenAnimations) animation.cancel();
        screenAnimations.clear();
        for (const number of floatingNumbers) number.remove();
        floatingNumbers.clear();
        for (const node of runtimeVfxNodes) node.remove?.();
        runtimeVfxNodes.clear();
        AudioManager.stopBattleSFX();
        elements.fireballEffect?.classList?.remove("fireball-active");
        elements.icePikeEffect?.classList?.remove("icepike-active");
        elements.poisonEffect?.classList?.remove("poison-active");
        elements.damageNumber?.classList?.remove("damage-active", "damage-critical", "damage-fatal");
        for (const view of getEntityViews()) {
            view.sprite?.classList.remove("healing-pulse", "hit-flash", "ice-hit", "punch-hit", "player-hit");
        }
    }

    function hideTurnPopup() {
        if (turnPopupTimer !== null) {
            clearTimeout(turnPopupTimer);
            visualTimers.delete(turnPopupTimer);
            turnPopupTimer = null;
        }
        elements.turnPopup.classList.remove("turn-popup-active", "result-announcement");
        elements.turnPopup.setAttribute("aria-hidden", "true");
    }

    function showTurnPopup(message, {
        duration = TURN_ANNOUNCEMENT_MS,
        allowFinished = false,
        isResult = false
    } = {}) {
        if (!allowFinished && !hasActiveBattle()) return false;
        hideTurnPopup();
        elements.turnPopupText.textContent = message;
        elements.turnPopup.style.setProperty("--announcement-duration", `${duration}ms`);
        elements.turnPopup.classList[isResult ? "add" : "remove"]("result-announcement");
        void elements.turnPopup.offsetWidth;
        elements.turnPopup.classList.add("turn-popup-active");
        elements.turnPopup.setAttribute("aria-hidden", "false");
        turnPopupTimer = scheduleVisual(() => {
            turnPopupTimer = null;
            elements.turnPopup.classList.remove("turn-popup-active");
            elements.turnPopup.setAttribute("aria-hidden", "true");
        }, duration);
        return true;
    }

    function announceTurn(message, audioEvent) {
        AudioManager.playEvent(audioEvent, { scope: "battle" });
        return showTurnPopup(message);
    }

    function hideBattleIntroOverlay() {
        elements.battleIntroOverlay.classList.remove("is-revealing");
        elements.battleIntroOverlay.hidden = true;
        elements.battleIntroOverlay.setAttribute("aria-hidden", "true");
    }

    function prefersReducedMotion() {
        return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    }

    function playBattleScreenShake(intensity = 5, durationMs = 180) {
        if (prefersReducedMotion()) return false;
        const surface = elements.battleScreen;
        if (!surface?.animate) return false;

        const strength = Math.max(1, Number(intensity) || 5);
        const duration = Math.max(80, Number(durationMs) || 180);
        const animation = surface.animate([
            { transform: "translate3d(0, 0, 0)" },
            { transform: `translate3d(${-strength}px, ${Math.round(strength * 0.45)}px, 0)` },
            { transform: `translate3d(${strength}px, ${-Math.round(strength * 0.35)}px, 0)` },
            { transform: `translate3d(${-Math.round(strength * 0.55)}px, ${-Math.round(strength * 0.2)}px, 0)` },
            { transform: `translate3d(${Math.round(strength * 0.45)}px, ${Math.round(strength * 0.25)}px, 0)` },
            { transform: "translate3d(0, 0, 0)" }
        ], {
            duration,
            easing: "ease-out"
        });
        if (animation) {
            screenAnimations.add(animation);
            animation.finished?.then(() => screenAnimations.delete(animation), () => screenAnimations.delete(animation));
        }
        return true;
    }

    function fallbackAtlasLayout(image) {
        const width = Math.max(1, Number(image?.naturalWidth) || 1);
        const height = Math.max(1, Number(image?.naturalHeight) || 1);
        const horizontalRatio = width / height;
        const verticalRatio = height / width;
        const horizontalFrames = Math.round(horizontalRatio);
        const verticalFrames = Math.round(verticalRatio);

        if (horizontalFrames >= 2 && horizontalFrames <= 32 && Math.abs(horizontalRatio - horizontalFrames) < 0.025) {
            return { columns: horizontalFrames, rows: 1, frames: horizontalFrames };
        }
        if (verticalFrames >= 2 && verticalFrames <= 32 && Math.abs(verticalRatio - verticalFrames) < 0.025) {
            return { columns: 1, rows: verticalFrames, frames: verticalFrames };
        }
        return { columns: 1, rows: 1, frames: 1 };
    }

    function inferAtlasLayout(image) {
        const fallback = fallbackAtlasLayout(image);
        if (fallback.frames > 1) return fallback;

        const width = Math.max(1, Number(image?.naturalWidth) || 1);
        const height = Math.max(1, Number(image?.naturalHeight) || 1);
        const documentRef = globalThis.document;
        if (!documentRef?.createElement || width < 32 || height < 32) return fallback;

        try {
            const canvas = documentRef.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext?.("2d", { willReadFrequently: true });
            if (!context?.drawImage || !context?.getImageData) return fallback;
            context.clearRect(0, 0, width, height);
            context.drawImage(image, 0, 0);
            const pixels = context.getImageData(0, 0, width, height).data;

            const alphaAt = (x, y) => pixels[((Math.max(0, Math.min(height - 1, y)) * width
                + Math.max(0, Math.min(width - 1, x))) * 4) + 3] || 0;
            const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 180));
            let overallAlpha = 0;
            let overallSamples = 0;
            for (let y = 0; y < height; y += sampleStep) {
                for (let x = 0; x < width; x += sampleStep) {
                    overallAlpha += alphaAt(x, y) / 255;
                    overallSamples += 1;
                }
            }
            const overallDensity = overallSamples ? overallAlpha / overallSamples : 0;
            if (overallDensity < 0.001) return fallback;

            const candidates = [];
            for (let rows = 1; rows <= 8; rows += 1) {
                if (height % rows !== 0) continue;
                for (let columns = 1; columns <= 8; columns += 1) {
                    if (width % columns !== 0 || (rows === 1 && columns === 1)) continue;
                    const frameWidth = width / columns;
                    const frameHeight = height / rows;
                    if (frameWidth < 24 || frameHeight < 24) continue;
                    const aspect = frameWidth / frameHeight;
                    if (aspect < 0.55 || aspect > 1.8) continue;

                    let boundaryAlpha = 0;
                    let boundarySamples = 0;
                    const boundaryStep = Math.max(1, Math.floor(Math.min(frameWidth, frameHeight) / 18));
                    for (let column = 1; column < columns; column += 1) {
                        const boundaryX = Math.round(column * frameWidth);
                        for (let y = 0; y < height; y += boundaryStep) {
                            for (let offset = -1; offset <= 1; offset += 1) {
                                boundaryAlpha += alphaAt(boundaryX + offset, y) / 255;
                                boundarySamples += 1;
                            }
                        }
                    }
                    for (let row = 1; row < rows; row += 1) {
                        const boundaryY = Math.round(row * frameHeight);
                        for (let x = 0; x < width; x += boundaryStep) {
                            for (let offset = -1; offset <= 1; offset += 1) {
                                boundaryAlpha += alphaAt(x, boundaryY + offset) / 255;
                                boundarySamples += 1;
                            }
                        }
                    }
                    const boundaryDensity = boundarySamples ? boundaryAlpha / boundarySamples : overallDensity;
                    const relativeBoundary = boundaryDensity / Math.max(0.01, overallDensity);

                    let activeCells = 0;
                    let lastActiveCell = -1;
                    for (let row = 0; row < rows; row += 1) {
                        for (let column = 0; column < columns; column += 1) {
                            let occupied = false;
                            const x0 = Math.floor(column * frameWidth);
                            const y0 = Math.floor(row * frameHeight);
                            const cellStep = Math.max(2, Math.floor(Math.min(frameWidth, frameHeight) / 12));
                            for (let y = y0; y < Math.min(height, y0 + frameHeight) && !occupied; y += cellStep) {
                                for (let x = x0; x < Math.min(width, x0 + frameWidth); x += cellStep) {
                                    if (alphaAt(x, y) > 12) {
                                        occupied = true;
                                        break;
                                    }
                                }
                            }
                            if (occupied) {
                                activeCells += 1;
                                lastActiveCell = row * columns + column;
                            }
                        }
                    }

                    const cellCount = rows * columns;
                    if (activeCells < Math.min(2, cellCount)) continue;
                    const activeRatio = activeCells / cellCount;
                    const aspectPenalty = Math.abs(Math.log(aspect));
                    const sparsePenalty = activeRatio < 0.35 ? (0.35 - activeRatio) * 3 : 0;
                    const overSplitPenalty = cellCount > 36 ? (cellCount - 36) * 0.05 : 0;
                    const score = relativeBoundary * 1.8 + aspectPenalty * 0.75 + sparsePenalty + overSplitPenalty;
                    candidates.push({
                        score,
                        columns,
                        rows,
                        frames: Math.max(1, lastActiveCell + 1)
                    });
                }
            }

            candidates.sort((a, b) => a.score - b.score || a.frames - b.frames);
            const best = candidates[0];
            // A single image wins unless a grid has convincing transparent seams.
            if (!best || best.score > 0.82) return fallback;
            return { columns: best.columns, rows: best.rows, frames: best.frames };
        } catch {
            return fallback;
        }
    }

    function getExplicitAtlasLayout(definition) {
        const atlas = definition?.atlas;
        if (!atlas) return null;
        const columns = Math.max(1, Math.floor(Number(atlas.columns) || 1));
        const rows = Math.max(1, Math.floor(Number(atlas.rows) || 1));
        const capacity = columns * rows;
        const frames = Math.max(1, Math.min(capacity, Math.floor(Number(atlas.frames) || capacity)));
        return { columns, rows, frames };
    }

    function loadAtlasLayout(definition) {
        if (!definition?.src) return Promise.resolve({ columns: 1, rows: 1, frames: 1 });
        const explicitLayout = getExplicitAtlasLayout(definition);
        if (explicitLayout) return Promise.resolve(explicitLayout);
        if (atlasLayoutPromises.has(definition.src)) return atlasLayoutPromises.get(definition.src);
        const ImageCtor = globalThis.Image;
        if (typeof ImageCtor !== "function") {
            const fallback = Promise.resolve({ columns: 1, rows: 1, frames: 1 });
            atlasLayoutPromises.set(definition.src, fallback);
            return fallback;
        }

        const promise = new Promise(resolve => {
            const image = new ImageCtor();
            image.onload = () => resolve(inferAtlasLayout(image));
            image.onerror = () => {
                if (AudioManager.debug) console.warn("[VFX] FAILED", definition.src);
                resolve({ columns: 1, rows: 1, frames: 1 });
            };
            image.src = definition.src;
        });
        atlasLayoutPromises.set(definition.src, promise);
        return promise;
    }

    function renderAtlasFrame(node, layout, frameIndex) {
        const columns = Math.max(1, Number(layout?.columns) || 1);
        const rows = Math.max(1, Number(layout?.rows) || 1);
        const frame = Math.max(0, Math.min(Math.max(0, (layout?.frames || 1) - 1), frameIndex));
        const column = frame % columns;
        const row = Math.floor(frame / columns);
        node.style.backgroundSize = `${columns * 100}% ${rows * 100}%`;
        node.style.backgroundPosition = `${columns === 1 ? 0 : (column / (columns - 1)) * 100}% ${rows === 1 ? 0 : (row / (rows - 1)) * 100}%`;
    }

    function playBattleVfx(vfxId, target = getSelectedTarget(), overrides = {}) {
        const definition = getBattleVfx(vfxId);
        const position = getEntityEffectPosition(target);
        const container = elements?.battleCamera;
        const documentRef = globalThis.document;
        if (!definition || !position || !container?.appendChild || !documentRef?.createElement) return false;

        const generation = visualGeneration;
        loadAtlasLayout(definition).then(layout => {
            if (generation !== visualGeneration || !isBattleScene()) return;
            const node = documentRef.createElement("div");
            node.className = `battle-runtime-vfx battle-runtime-vfx-${definition.id}`;
            node.setAttribute("aria-hidden", "true");
            node.style.position = "absolute";
            node.style.zIndex = String(overrides.zIndex || 18);
            node.style.left = `${position.x}%`;
            node.style.top = `${position.y}%`;
            node.style.width = overrides.size || definition.size;
            node.style.height = definition.frameAspectRatio
                ? `calc(${overrides.size || definition.size} / ${definition.frameAspectRatio})`
                : overrides.size || definition.size;
            node.style.pointerEvents = "none";
            node.style.backgroundImage = `url("${definition.src}")`;
            node.style.backgroundRepeat = "no-repeat";
            node.style.transformOrigin = "50% 50%";
            node.style.willChange = "transform, opacity, background-position";
            node.style.transform = "translate(-50%, -50%)";
            node.style.opacity = "1";
            renderAtlasFrame(node, layout, 0);
            container.appendChild(node);
            runtimeVfxNodes.add(node);

            const { durationMs, frameDurationMs, impactTimeMs } = getEffectTiming(definition, layout, overrides);
            const frameCount = prefersReducedMotion() ? 1 : Math.max(1, Number(layout.frames) || 1);
            for (let frame = 1; frame < frameCount; frame += 1) {
                scheduleVisual(() => renderAtlasFrame(node, layout, frame), frameDurationMs * frame);
            }
            if (overrides.onImpact) scheduleVisual(overrides.onImpact, prefersReducedMotion() ? 0 : impactTimeMs);

            if (node.animate && !prefersReducedMotion()) {
                const animation = node.animate([
                    { opacity: 0, transform: `translate(-50%, -50%) scale(${definition.scaleFrom || 0.8})` },
                    { opacity: 1, offset: 0.12, transform: "translate(-50%, -50%) scale(1)" },
                    { opacity: 1, offset: 0.78, transform: `translate(-50%, -50%) scale(${definition.scaleTo || 1.05})` },
                    { opacity: 0, transform: `translate(-50%, -50%) scale(${definition.scaleTo || 1.05})` }
                ], { duration: durationMs, easing: "ease-out", fill: "forwards" });
                if (animation) {
                    screenAnimations.add(animation);
                    animation.finished?.then(() => screenAnimations.delete(animation), () => screenAnimations.delete(animation));
                }
            }
            scheduleVisual(() => removeRuntimeVfx(node), durationMs + 20);
        });
        return true;
    }

    function preloadRuntimeVfx() {
        for (const definition of Object.values(BATTLE_VFX)) loadAtlasLayout(definition);
    }

    function present(event = {}) {
        if (!isBattleScene()) return false;
        const profile = resolveBattleEffect(event);
        const suppressVfx = event.suppressGenericImpact && profile.id === "impact";
        const playSfx = () => profile.sfx
            ? AudioManager.playSFX(profile.sfx, { scope: "battle", volume: profile.volume })
            : false;
        const sfxAtStart = profile.sfxTiming === "start";
        if (sfxAtStart) playSfx();
        const impact = () => {
            if (!sfxAtStart) playSfx();
            if (profile.shake) playBattleScreenShake(profile.shake.intensity, profile.shake.durationMs);
            if (event.type === "heal") {
                showFloatingCombatNumber(event.value, event.target, { type: "heal", suppressGenericImpact: true });
                playHealingEffect(event.target);
            } else if (event.type === "damage") {
                showFloatingCombatNumber(event.value, event.target, { hitType: event.hitType });
                if (event.hitType !== "miss") playPlayerHitEffect(event.target);
            }
        };
        const timing = getEffectTiming(getBattleVfx(profile.vfx) || {}, {}, event);
        if (timing.impactTimeMs === 0) {
            impact();
            if (profile.vfx && !suppressVfx) playBattleVfx(profile.vfx, event.target);
        } else if (!profile.vfx || suppressVfx || !playBattleVfx(profile.vfx, event.target, { onImpact: impact })) impact();
        return true;
    }

    function resetBattleVisuals() {
        clearVisualTimers();
        turnPopupTimer = null;
        resetCommandTransition();
        elements.fireballEffect?.classList?.remove("fireball-active");
        elements.icePikeEffect?.classList?.remove("icepike-active");
        elements.poisonEffect?.classList?.remove("poison-active");
        for (const view of getEntityViews()) {
            view.sprite?.classList.remove("hit-flash", "ice-hit", "punch-hit", "punching", "player-hit");
            view.targetButton?.classList.remove("is-selected-target");
            view.slotElement?.classList.remove("awaiting-command");
        }
        elements.damageNumber.classList.remove("damage-active");
        elements.damageNumber.classList.remove("target-player");
        elements.damageNumber.textContent = "0";
        elements.turnPopup.classList.remove("turn-popup-active");
        elements.turnPopup.setAttribute("aria-hidden", "true");
        hideBattleIntroOverlay();
        statusTooltipView.hide();
        elements.battleSummary.hidden = true;
    }

    function showDamageNumber(damage, target = getSelectedTarget(), hitType = "normal", { suppressGenericImpact = false } = {}) {
        const safeDamage = Math.max(0, Number.isFinite(damage) ? damage : 0);
        placeEffectAtEntity(target);
        const feedback = hitType === "fatal" ? "FATAL!" : (hitType === "critical" ? "CRITICAL!" : "");
        elements.damageNumber.textContent = feedback ? `${feedback}\n-${safeDamage}` : `-${safeDamage}`;
        elements.damageNumber.dataset.hitType = hitType;
        elements.damageNumber.classList.remove("damage-active", "damage-critical", "damage-fatal");
        void elements.damageNumber.offsetWidth;
        if (hitType === "critical") elements.damageNumber.classList.add("damage-critical");
        if (hitType === "fatal") elements.damageNumber.classList.add("damage-fatal");
        elements.damageNumber.classList.add("damage-active");
        scheduleVisual(() => elements.damageNumber.classList.remove("damage-active", "damage-critical", "damage-fatal"), 800);

        if (safeDamage > 0 && hitType !== "miss" && !suppressGenericImpact) {
            playBattleVfx(hitType === "critical" || hitType === "fatal" ? "impact-heavy" : "impact", target);
        }
    }

    function showFloatingCombatNumber(value, target, {
        type = "damage",
        hitType = "normal",
        suppressGenericImpact = false
    } = {}) {
        const slot = getFormationSlot(target?.formationSlot);
        if (!slot || !elements?.battleCamera) return false;

        const amount = Math.max(0, Math.floor(Number(value) || 0));
        const number = document.createElement("div");
        number.className = "battle-floating-number";
        number.setAttribute("aria-hidden", "true");
        number.style.setProperty("--effect-x", `${slot.x}%`);
        number.style.setProperty("--effect-y", `${Math.min(86, slot.y + 24)}%`);

        if (type === "heal") {
            number.classList.add("battle-floating-heal");
            number.textContent = `+${amount}`;
            if (amount > 0 && !suppressGenericImpact) playBattleVfx("heal", target);
        } else {
            const feedback = hitType === "fatal" ? "FATAL!" : (hitType === "critical" ? "CRITICAL!" : "");
            if (hitType === "critical") number.classList.add("battle-floating-critical");
            if (hitType === "fatal") number.classList.add("battle-floating-fatal");
            number.textContent = hitType === "miss" ? "MISS" : feedback ? `${feedback}\n-${amount}` : `-${amount}`;
        }

        elements.battleCamera.appendChild(number);
        floatingNumbers.add(number);
        scheduleVisual(() => { floatingNumbers.delete(number); number.remove(); }, 820);
        return true;
    }

    function playHealingEffect(target) {
        const sprite = getEntityView(target)?.sprite;
        if (!sprite) return false;
        sprite.classList.remove("healing-pulse");
        void sprite.offsetWidth;
        sprite.classList.add("healing-pulse");
        scheduleVisual(() => sprite.classList.remove("healing-pulse"), 620);
        return true;
    }

    function playPlayerHitEffect(target) {
        const sprite = getEntityView(target)?.sprite;
        if (!sprite) return;
        sprite.classList.remove("player-hit");
        void sprite.offsetWidth;
        sprite.classList.add("player-hit");
        scheduleVisual(() => sprite.classList.remove("player-hit"), 340);
    }

    function playPunchHitEffect(target) {
        const sprite = getEntityView(target)?.sprite;
        if (!sprite) return;
        sprite.classList.remove("punch-hit");
        void sprite.offsetWidth;
        sprite.classList.add("punch-hit");
        scheduleVisual(() => sprite.classList.remove("punch-hit"), 140);
    }

    function playIceHitEffect(target) {
        const sprite = getEntityView(target)?.sprite;
        if (!sprite) return;
        sprite.classList.remove("ice-hit");
        void sprite.offsetWidth;
        sprite.classList.add("ice-hit");
        scheduleVisual(() => sprite.classList.remove("ice-hit"), 250);
    }

    function playFireballEffect(target) {
        playBattleVfx("fire", target);
        AudioManager.playSFX("skillFireball", { scope: "battle" });
        scheduleVisual(() => {
            const sprite = getEntityView(target)?.sprite;
            sprite?.classList.add("hit-flash");
            scheduleVisual(() => sprite?.classList.remove("hit-flash"), 120);
        }, 600);
    }

    function playIcePikeEffect(target) {
        playBattleVfx("ice", target);
        AudioManager.playSFX("skillIcePike", { scope: "battle" });
    }

    function playPoisonEffect(target) {
        playBattleVfx("poison", target);
        AudioManager.playSFX("skillPoison", { scope: "battle" });
    }

    function playFireHitEffect(target) {
        playBattleVfx("fire-heavy", target);
        const sprite = getEntityView(target)?.sprite;
        if (!sprite) return false;
        sprite.classList.remove("hit-flash");
        void sprite.offsetWidth;
        sprite.classList.add("hit-flash");
        scheduleVisual(() => sprite.classList.remove("hit-flash"), 280);
        return true;
    }

    preloadRuntimeVfx();

    return {
        present,
        scheduleVisual,
        clearVisualTimers,
        hideTurnPopup,
        showTurnPopup,
        announceTurn,
        hideBattleIntroOverlay,
        prefersReducedMotion,
        playBattleScreenShake,
        resetBattleVisuals,
        showDamageNumber,
        showFloatingCombatNumber,
        playHealingEffect,
        playPlayerHitEffect,
        playPunchHitEffect,
        playIceHitEffect,
        playFireballEffect,
        playIcePikeEffect,
        playPoisonEffect,
        playFireHitEffect,
        playBattleVfx,
        cancelVisual: timer => { clearTimeout(timer); visualTimers.delete(timer); }
    };
}
