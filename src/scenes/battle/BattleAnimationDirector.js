import { AudioManager } from "../../core/AudioManager.js";
import {
    applyFrameStabilization,
    buildFrameStabilizationProfile,
    copyFrameStabilization
} from "../../core/SpriteFrameStabilizer.js";
import { isPlaceholderActor, setPlaceholderState } from "../../ui/placeholders/PlaceholderActor.js";

// Owns sprite clocks/locks. Impact and completion callbacks remain gameplay-owned.
export function createBattleAnimationDirector({
    party, enemies, getEntityView, getPlayerAnimation, getPlayerFrame, getEnemyAnimation, getEnemyFrame,
    isBattleScene, isBattleActive
}) {
    let playerGeneration = 0;
    let idleFrame = 1;
    let idleInterval = null;
    let enemyIdleFrame = 1;
    let enemyIdleInterval = null;
    const enemyStabilizationProfiles = new Map();
    const enemyAnimationLocks = new Set();
    const enemyPersistentDeathPoses = new Set();
    const enemyHitTimers = new Map();
    let playerActionInterval = null;
    let playerActionFinishTimer = null;
    function getEnemyProfileKey(entity, action = "idle") {
        return `${entity?.id || entity?.assetId || "enemy"}:${action}`;
    }

    function getEnemyAnimationSources(entity, action = "idle") {
        const animation = getEnemyAnimation(entity, action);
        if (!animation) return [];
        return Array.from({ length: Math.max(1, animation.frames || 1) }, (_, index) => (
            getEnemyFrame(entity, action, index + 1)
        ));
    }

    function prepareEnemyStabilizationProfiles() {
        const generation = playerGeneration;
        for (const opponent of enemies) {
            if (opponent.visual?.type === "placeholder") continue;
            const idleSources = getEnemyAnimationSources(opponent, "idle");
            if (idleSources.length > 1) {
                const idleKey = getEnemyProfileKey(opponent, "idle");
                buildFrameStabilizationProfile(idleSources).then(profile => {
                    enemyStabilizationProfiles.set(idleKey, profile);
                    if (generation !== playerGeneration || !isBattleScene() || !isBattleActive() || enemyAnimationLocks.has(opponent.id)) return;
                    const view = getEntityView(opponent);
                    const sprite = view?.sprite;
                    const frameBlendSprite = view?.frameBlendSprite;
                    const currentFrame = Math.max(1, Number(sprite?.dataset.animationFrame) || 1);
                    applyFrameStabilization(sprite, profile[currentFrame - 1], { maxOffset: 9 });
                    copyFrameStabilization(sprite, frameBlendSprite);
                });
            }

            const attackSources = getEnemyAnimationSources(opponent, "attack");
            if (attackSources.length > 0) {
                const attackKey = getEnemyProfileKey(opponent, "attack");
                const idleReference = getEnemyFrame(opponent, "idle", 1);
                buildFrameStabilizationProfile([idleReference, ...attackSources]).then(profile => {
                    enemyStabilizationProfiles.set(attackKey, profile.slice(1));
                });
            }

            const hitSources = getEnemyAnimationSources(opponent, "hit");
            if (hitSources.length > 0) {
                const hitKey = getEnemyProfileKey(opponent, "hit");
                const idleReference = getEnemyFrame(opponent, "idle", 1);
                buildFrameStabilizationProfile([idleReference, ...hitSources]).then(profile => {
                    enemyStabilizationProfiles.set(hitKey, profile.slice(1));
                });
            }

            // Death frames are supplied by the encounter preload group. The
            // stabilizer reuses the shared decoded-image cache when it measures
            // animation anchors.
        }
    }

    function playPlayerIdle() {
        idleFrame += 1;
        for (const member of party) {
            const sprite = getEntityView(member)?.sprite;
            if (!sprite || isPlaceholderActor(sprite) || !member.isAlive() || sprite.classList.contains("asset-missing")) continue;
            const memberFrameCount = Math.max(1, getPlayerAnimation(member, "idle").frames || 1);
            const memberFrame = ((idleFrame - 1) % memberFrameCount) + 1;
            sprite.src = getPlayerFrame(member, "idle", memberFrame);
        }
    }

    function startIdleAnimation() {
        if (idleInterval !== null) clearInterval(idleInterval);
        idleFrame = 1;
        for (const member of party) {
            const sprite = getEntityView(member)?.sprite;
            if (isPlaceholderActor(sprite)) setPlaceholderState(sprite, "idle");
            else if (sprite) sprite.src = getPlayerFrame(member, "idle", 1);
        }
        idleInterval = setInterval(playPlayerIdle, 65);
    }

    function playEnemyIdle() {
        enemyIdleFrame += 1;
        for (const opponent of enemies) {
            const view = getEntityView(opponent);
            const sprite = view?.sprite;
            const frameBlendSprite = view?.frameBlendSprite;
            if (!sprite || isPlaceholderActor(sprite) || !opponent.isAlive() || enemyAnimationLocks.has(opponent.id)
                || sprite.classList.contains("asset-missing")) continue;
            const animation = getEnemyAnimation(opponent, "idle");
            const frameCount = Math.max(1, animation?.frames || 1);
            const frame = ((enemyIdleFrame - 1) % frameCount) + 1;
            const nextSrc = getEnemyFrame(opponent, "idle", frame);

            if (frameBlendSprite) {
                frameBlendSprite.src = sprite.src;
                copyFrameStabilization(sprite, frameBlendSprite);
                frameBlendSprite.classList.remove("is-frame-blending");
                void frameBlendSprite.offsetWidth;
            }

            sprite.dataset.animationFrame = String(frame);
            sprite.src = nextSrc;
            const profile = enemyStabilizationProfiles.get(getEnemyProfileKey(opponent, "idle"));
            applyFrameStabilization(sprite, profile?.[frame - 1], { maxOffset: 9 });
            frameBlendSprite?.classList.add("is-frame-blending");
        }
    }

    function startEnemyIdleAnimation() {
        if (enemyIdleInterval !== null) clearInterval(enemyIdleInterval);
        enemyIdleFrame = 1;
        for (const opponent of enemies) {
            const view = getEntityView(opponent);
            const sprite = view?.sprite;
            const frameBlendSprite = view?.frameBlendSprite;
            if (isPlaceholderActor(sprite) && opponent.isAlive()) {
                setPlaceholderState(sprite, "idle");
            } else if (sprite && opponent.isAlive()) {
                sprite.dataset.animationFrame = "1";
                sprite.src = getEnemyFrame(opponent, "idle", 1);
                const profile = enemyStabilizationProfiles.get(getEnemyProfileKey(opponent, "idle"));
                applyFrameStabilization(sprite, profile?.[0], { maxOffset: 9 });
            }
            if (frameBlendSprite) {
                frameBlendSprite.src = sprite?.src || getEnemyFrame(opponent, "idle", 1);
                copyFrameStabilization(sprite, frameBlendSprite);
                frameBlendSprite.classList.remove("is-frame-blending");
            }
        }
        const frameDurations = enemies
            .map(opponent => getEnemyAnimation(opponent, "idle")?.frameDurationMs)
            .filter(Number.isFinite);
        const frameDurationMs = Math.max(40, frameDurations.length ? Math.min(...frameDurations) : 125);
        enemyIdleInterval = setInterval(playEnemyIdle, frameDurationMs);
    }

    function stopEnemyIdleAnimation() {
        if (enemyIdleInterval !== null) {
            clearInterval(enemyIdleInterval);
            enemyIdleInterval = null;
        }
        enemyIdleFrame = 1;
        for (const opponent of enemies) {
            const view = getEntityView(opponent);
            const sprite = view?.sprite;
            const frameBlendSprite = view?.frameBlendSprite;
            if (!sprite) continue;
            if (isPlaceholderActor(sprite)) setPlaceholderState(sprite, "idle");
            else if (opponent.isAlive()) sprite.src = getEnemyFrame(opponent, "idle", 1);
            if (frameBlendSprite) {
                frameBlendSprite.src = sprite.src;
                frameBlendSprite.classList.remove("is-frame-blending");
            }
        }
    }

    function restoreEnemyIdleFrame(opponent) {
        const view = getEntityView(opponent);
        const sprite = view?.sprite;
        const frameBlendSprite = view?.frameBlendSprite;
        if (!sprite || !opponent?.isAlive()) return false;

        if (isPlaceholderActor(sprite)) {
            setPlaceholderState(sprite, "idle");
            return true;
        }
        sprite.dataset.animationFrame = "1";
        sprite.src = getEnemyFrame(opponent, "idle", 1);
        const idleProfile = enemyStabilizationProfiles.get(getEnemyProfileKey(opponent, "idle"));
        applyFrameStabilization(sprite, idleProfile?.[0], { maxOffset: 9 });

        if (frameBlendSprite) {
            frameBlendSprite.src = sprite.src;
            copyFrameStabilization(sprite, frameBlendSprite);
            frameBlendSprite.classList.remove("is-frame-blending");
        }
        return true;
    }

    function clearEnemyHitTimer(enemyId) {
        const timer = enemyHitTimers.get(enemyId);
        if (timer !== undefined) clearTimeout(timer);
        enemyHitTimers.delete(enemyId);
    }

    function stopEnemyHitAnimations({ restoreIdle = true } = {}) {
        for (const enemyId of [...enemyAnimationLocks]) {
            clearEnemyHitTimer(enemyId);
            const opponent = enemies.find(candidate => candidate.id === enemyId);
            enemyAnimationLocks.delete(enemyId);
            if (restoreIdle && opponent?.isAlive()) restoreEnemyIdleFrame(opponent);
        }
    }

    function persistEnemyCorpse(target, {
        spriteSrc = null,
        offsetX = null,
        offsetY = null,
        holdDurationMs = 0,
        onComplete = null
    } = {}) {
        const view = getEntityView(target);
        const sprite = view?.sprite;
        const frameBlendSprite = view?.frameBlendSprite;

        if (!view || !sprite) {
            onComplete?.();
            return false;
        }

        clearEnemyHitTimer(target.id);
        enemyAnimationLocks.add(target.id);
        enemyPersistentDeathPoses.add(target.id);

        view.slotElement?.classList.remove("is-defeated");
        view.slotElement?.classList.add("is-dying");
        view.hud?.classList.add("is-defeated");

        if (frameBlendSprite) {
            frameBlendSprite.classList.remove("is-frame-blending");
            frameBlendSprite.style.opacity = "0";
        }

        if (spriteSrc) sprite.src = spriteSrc;
        if (isPlaceholderActor(sprite)) setPlaceholderState(sprite, "death");
        if (offsetX !== null) sprite.style.setProperty("--frame-offset-x", offsetX);
        if (offsetY !== null) sprite.style.setProperty("--frame-offset-y", offsetY);

        const finish = () => {
            enemyHitTimers.delete(target.id);
            enemyAnimationLocks.delete(target.id);
            enemyPersistentDeathPoses.add(target.id);

            // A corpse is a persistent battlefield object. Never add is-defeated
            // back to the slot here; that class hides the entire body.
            view.slotElement?.classList.remove("is-dying", "is-defeated");
            view.slotElement?.classList.add("is-dead-pose");
            view.hud?.classList.add("is-defeated");

            if (frameBlendSprite) {
                frameBlendSprite.classList.remove("is-frame-blending");
                frameBlendSprite.style.removeProperty("opacity");
            }

            onComplete?.();
        };

        if (holdDurationMs > 0) {
            const timer = setTimeout(finish, holdDurationMs);
            enemyHitTimers.set(target.id, timer);
        } else {
            finish();
        }

        return true;
    }

    function playEnemyDeathPose(target, onComplete = null) {
        const animation = getEnemyAnimation(target, "death");
        const view = getEntityView(target);
        const sprite = view?.sprite;

        if (!sprite) {
            onComplete?.();
            return false;
        }

        if (isPlaceholderActor(sprite)) {
            return persistEnemyCorpse(target, { holdDurationMs: 480, onComplete });
        }

        // Every enemy uses the same corpse lifecycle. Enemies without a dedicated
        // death asset simply keep their current visible frame instead of vanishing.
        if (!animation) {
            return persistEnemyCorpse(target, {
                spriteSrc: sprite.src,
                offsetX: sprite.style.getPropertyValue("--frame-offset-x") || "0px",
                offsetY: sprite.style.getPropertyValue("--frame-offset-y") || "0px",
                onComplete
            });
        }

        sprite.dataset.animationFrame = "death";
        return persistEnemyCorpse(target, {
            spriteSrc: getEnemyFrame(target, "death", 1),
            offsetX: "0px",
            offsetY: "0px",
            holdDurationMs: Math.max(300, Number(animation.holdDurationMs) || 700),
            onComplete
        });
    }

    function playEnemyAttackAnimation(attacker, {
        onImpact = null,
        onComplete = null
    } = {}) {
        const animation = getEnemyAnimation(attacker, "attack");
        const view = getEntityView(attacker);
        const sprite = view?.sprite;
        const frameBlendSprite = view?.frameBlendSprite;
        if (!animation || !sprite || !attacker?.isAlive()) return false;

        if (isPlaceholderActor(sprite)) {
            clearEnemyHitTimer(attacker.id);
            enemyAnimationLocks.add(attacker.id);
            setPlaceholderState(sprite, "attack");
            const duration = Math.max(160, Number(animation.frameDurationMs) || 360);
            const impactTimer = setTimeout(() => {
                onImpact?.();
                if (!isBattleActive() || !enemyAnimationLocks.has(attacker.id)) return;
                if (!attacker.isAlive()) {
                    playEnemyDeathPose(attacker, onComplete);
                    return;
                }
                const finishTimer = setTimeout(() => {
                    enemyHitTimers.delete(attacker.id);
                    enemyAnimationLocks.delete(attacker.id);
                    if (attacker.isAlive() && isBattleActive()) setPlaceholderState(sprite, "idle");
                    onComplete?.();
                }, Math.max(80, duration / 2));
                enemyHitTimers.set(attacker.id, finishTimer);
            }, Math.max(80, duration / 2));
            enemyHitTimers.set(attacker.id, impactTimer);
            return true;
        }

        clearEnemyHitTimer(attacker.id);
        enemyAnimationLocks.add(attacker.id);
        if (frameBlendSprite) {
            frameBlendSprite.classList.remove("is-frame-blending");
            frameBlendSprite.style.opacity = "0";
        }

        const frameCount = Math.max(1, animation.frames || 1);
        const fallbackFrameDurationMs = Math.max(40, animation.frameDurationMs || 70);
        const frameDurationsMs = Array.isArray(animation.frameDurationsMs)
            ? animation.frameDurationsMs
            : [];
        const getFrameDurationMs = frameNumber => Math.max(
            40,
            Number(frameDurationsMs[frameNumber - 1]) || fallbackFrameDurationMs
        );
        const impactFrame = Math.min(
            frameCount,
            Math.max(1, Number(animation.impactFrame) || Math.ceil(frameCount / 2))
        );
        const profile = enemyStabilizationProfiles.get(getEnemyProfileKey(attacker, "attack"));
        let frame = 1;
        let impactTriggered = false;

        const finish = () => {
            enemyHitTimers.delete(attacker.id);
            enemyAnimationLocks.delete(attacker.id);
            if (frameBlendSprite) frameBlendSprite.style.removeProperty("opacity");
            if (attacker.isAlive() && isBattleActive()) {
                restoreEnemyIdleFrame(attacker);
            }
            onComplete?.();
        };

        const showFrame = () => {
            if (!isBattleScene() || !enemyAnimationLocks.has(attacker.id)) return;
            if (!attacker.isAlive()) {
                playEnemyDeathPose(attacker, onComplete);
                return;
            }

            sprite.dataset.animationFrame = String(frame);
            sprite.src = getEnemyFrame(attacker, "attack", frame);
            applyFrameStabilization(sprite, profile?.[frame - 1], { maxOffset: 9 });

            if (!impactTriggered && frame === impactFrame) {
                impactTriggered = true;
                onImpact?.();
                if (!isBattleActive()
                    || !enemyAnimationLocks.has(attacker.id)) return;
                // Counter damage is applied synchronously at impact. Complete the
                // action through the corpse lifecycle so the enemy queue can advance.
                if (!attacker.isAlive()) {
                    playEnemyDeathPose(attacker, onComplete);
                    return;
                }
            }

            const currentFrameDurationMs = getFrameDurationMs(frame);
            if (frame >= frameCount) {
                const timer = setTimeout(finish, currentFrameDurationMs);
                enemyHitTimers.set(attacker.id, timer);
                return;
            }

            frame += 1;
            const timer = setTimeout(showFrame, currentFrameDurationMs);
            enemyHitTimers.set(attacker.id, timer);
        };

        showFrame();
        return true;
    }

    function playEnemyHitAnimation(target, onComplete = null) {
        const animation = getEnemyAnimation(target, "hit");
        const view = getEntityView(target);
        const sprite = view?.sprite;
        const frameBlendSprite = view?.frameBlendSprite;
        if (!sprite) {
            onComplete?.();
            return false;
        }

        if (isPlaceholderActor(sprite)) {
            clearEnemyHitTimer(target.id);
            enemyAnimationLocks.add(target.id);
            view.slotElement?.classList.remove("is-defeated");
            setPlaceholderState(sprite, "hit");
            const timer = setTimeout(() => {
                enemyHitTimers.delete(target.id);
                enemyAnimationLocks.delete(target.id);
                if (target.isAlive()) {
                    setPlaceholderState(sprite, "idle");
                    onComplete?.();
                } else playEnemyDeathPose(target, onComplete);
            }, 280);
            enemyHitTimers.set(target.id, timer);
            return true;
        }

        if (!animation) {
            if (!target.isAlive()) return playEnemyDeathPose(target, onComplete);
            onComplete?.();
            return false;
        }

        clearEnemyHitTimer(target.id);
        enemyAnimationLocks.add(target.id);

        // A finishing blow may already have marked the formation slot defeated.
        // Keep the sprite visible until the recoil sequence has completed.
        view.slotElement?.classList.remove("is-defeated");
        view.hud?.classList.remove("is-defeated");

        if (frameBlendSprite) {
            frameBlendSprite.classList.remove("is-frame-blending");
            frameBlendSprite.style.opacity = "0";
        }

        const frameCount = Math.max(1, animation.frames || 1);
        const fallbackFrameDurationMs = Math.max(50, animation.frameDurationMs || 80);
        const frameDurationsMs = Array.isArray(animation.frameDurationsMs)
            ? animation.frameDurationsMs
            : [];
        const getFrameDurationMs = frameNumber => Math.max(
            50,
            Number(frameDurationsMs[frameNumber - 1]) || fallbackFrameDurationMs
        );
        const profile = enemyStabilizationProfiles.get(getEnemyProfileKey(target, "hit"));
        let frame = 1;

        const finish = () => {
            enemyHitTimers.delete(target.id);
            enemyAnimationLocks.delete(target.id);
            if (frameBlendSprite) frameBlendSprite.style.removeProperty("opacity");

            if (target.isAlive() && isBattleActive()) {
                restoreEnemyIdleFrame(target);
                onComplete?.();
                return;
            }

            if (!target.isAlive()) {
                playEnemyDeathPose(target, onComplete);
                return;
            }

            onComplete?.();
        };

        const showFrame = () => {
            if (!isBattleScene() || !enemyAnimationLocks.has(target.id)) return;

            sprite.dataset.animationFrame = String(frame);
            sprite.src = getEnemyFrame(target, "hit", frame);
            applyFrameStabilization(sprite, profile?.[frame - 1], { maxOffset: 9 });

            if (frame >= frameCount) {
                const timer = setTimeout(finish, getFrameDurationMs(frame));
                enemyHitTimers.set(target.id, timer);
                return;
            }

            const currentFrameDurationMs = getFrameDurationMs(frame);
            frame += 1;
            const timer = setTimeout(showFrame, currentFrameDurationMs);
            enemyHitTimers.set(target.id, timer);
        };

        showFrame();
        return true;
    }

    function stopPlayerAnimation() {
        playerGeneration += 1;
        if (idleInterval !== null) {
            clearInterval(idleInterval);
            idleInterval = null;
        }
        if (playerActionInterval !== null) {
            clearInterval(playerActionInterval);
            playerActionInterval = null;
        }
        if (playerActionFinishTimer !== null) {
            clearTimeout(playerActionFinishTimer);
            playerActionFinishTimer = null;
        }
        for (const member of party) {
            const sprite = getEntityView(member)?.sprite;
            if (!sprite) continue;
            sprite.classList.remove("punching", "guarding-animation", "casting-animation", "player-acting", "player-hit", "hit-flash", "ice-hit", "punch-hit");
            if (isPlaceholderActor(sprite)) setPlaceholderState(sprite, member.isAlive() ? "idle" : "death");
            else if (member.isAlive()) sprite.src = getPlayerFrame(member, "idle", 1);
        }
    }

    function playPlayerActionAnimation(actor, action, {
        className = "player-acting",
        onImpact = null,
        onComplete = null,
        frameDurationOverrideMs = null
    } = {}) {
        if (playerActionInterval !== null || playerActionFinishTimer !== null) return false;
        const animation = actor?.animations?.[action];
        if (!animation) return false;

        if (idleInterval !== null) {
            clearInterval(idleInterval);
            idleInterval = null;
        }

        const sprite = getEntityView(actor)?.sprite;
        if (!sprite) return false;

        if (isPlaceholderActor(sprite)) {
            const state = action === "cast" ? "attack" : action;
            setPlaceholderState(sprite, state);
            const duration = Math.max(120, Number(frameDurationOverrideMs || animation.frameDurationMs) || 360);
            playerActionFinishTimer = setTimeout(() => {
                playerActionFinishTimer = null;
                onImpact?.();
                if (actor?.isAlive()) setPlaceholderState(sprite, "idle");
                onComplete?.();
            }, duration);
            return true;
        }

        const frameCount = Math.max(1, animation.frames || 1);
        const frameDurationMs = Number.isFinite(frameDurationOverrideMs)
            ? Math.max(16, Number(frameDurationOverrideMs))
            : Math.max(30, Number(animation.frameDurationMs) || 50);
        const impactFrame = Math.max(1, Math.min(frameCount, Number(animation.impactFrame) || frameCount));
        const soundFrame = Math.max(0, Math.min(frameCount, Number(animation.soundFrame) || 0));
        let frame = 1;
        let impactResolved = false;

        sprite.classList.add(className);

        const generation = playerGeneration;
        const renderFrame = () => {
            if (generation !== playerGeneration || !isBattleScene() || !isBattleActive()) return;
            sprite.src = getPlayerFrame(actor, action, frame);

            if (action === "attack" && soundFrame > 0 && frame === soundFrame) {
                AudioManager.playSFX("punchWhoosh", { scope: "battle" });
            }

            if (frame === impactFrame && !impactResolved) {
                impactResolved = true;
                onImpact?.();
                if (generation !== playerGeneration || !isBattleScene() || !isBattleActive()) return;
            }

            if (frame >= frameCount) {
                clearInterval(playerActionInterval);
                playerActionInterval = null;
                playerActionFinishTimer = setTimeout(() => {
                    playerActionFinishTimer = null;
                    if (generation !== playerGeneration || !isBattleScene() || !isBattleActive()) return;
                    sprite.classList.remove(className);
                    if (actor?.isAlive()) startIdleAnimation();
                    onComplete?.();
                }, frameDurationMs);
                return;
            }
            frame += 1;
        };

        renderFrame();
        if (frameCount > 1 && generation === playerGeneration && isBattleScene() && isBattleActive()) {
            playerActionInterval = setInterval(renderFrame, frameDurationMs);
        }
        return true;
    }

    function playPlayerPunch(actor, onImpact, onComplete, {
        frameDurationMs = null
    } = {}) {
        return playPlayerActionAnimation(actor, "attack", {
            className: "punching",
            onImpact,
            onComplete,
            frameDurationOverrideMs: frameDurationMs
        });
    }

    function playPlayerGuard(actor, onComplete) {
        return playPlayerActionAnimation(actor, "guard", {
            className: "guarding-animation",
            onComplete
        });
    }

    function playPlayerCast(actor, onCast, onComplete = null) {
        return playPlayerActionAnimation(actor, "cast", {
            className: "casting-animation",
            onImpact: onCast,
            onComplete
        });
    }

    return {
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
        playPlayerCast,
        clearDeathPoses: () => enemyPersistentDeathPoses.clear(),
        rememberDeathPose: id => enemyPersistentDeathPoses.add(id),
        hasDeathPose: id => enemyPersistentDeathPoses.has(id),
        isAnimatingEnemy: id => enemyAnimationLocks.has(id)
    };
}
