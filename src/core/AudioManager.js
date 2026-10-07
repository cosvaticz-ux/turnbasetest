import { AssetResolver } from "./AssetResolver.js";
import { AssetPreloader } from "./AssetPreloader.js";
import { normalizeSettings } from "./GameState.js";
import { SfxVoicePool } from "./SfxVoicePool.js";

function createManagedAudio(src) {
    const audio = new Audio();
    audio.preload = "none";
    audio.src = src;
    AssetPreloader.registerManagedAsset(src, audio);
    return audio;
}

export const AudioManager = {
    sfx: {
        punchWhoosh: createManagedAudio(AssetResolver.sfx("weapon", "punch-whoosh", { extension: "wav" })),
        punchImpact: createManagedAudio(AssetResolver.sfx("weapon", "punch-impact", { extension: "wav" })),
        enemyAttack: createManagedAudio(AssetResolver.sfx("weapon", "punch-whoosh", { extension: "wav" })),
        playerHit: createManagedAudio(AssetResolver.sfx("weapon", "punch-impact", { extension: "wav" })),
        skillFireball: createManagedAudio(AssetResolver.sfx("skill", "fireball", { extension: "mp3" })),
        skillIcePike: createManagedAudio(AssetResolver.sfx("skill", "ice-pike", { extension: "wav" })),
        skillPoison: createManagedAudio(AssetResolver.sfx("skill", "poison", { extension: "wav" })),
        skillPoisonTick: createManagedAudio(AssetResolver.sfx("skill", "poison-tick", { extension: "wav" })),
        typewriter: createManagedAudio(AssetResolver.sfx("system", "typewriter-sfx", { extension: "wav" }))
    },
    eventPaths: Object.freeze({
        menuMove: AssetResolver.sfx("system", "tab-sfx", { extension: "wav" }),
        menuConfirm: AssetResolver.sfx("system", "confirm-sfx", { extension: "wav" }),
        menuCancel: AssetResolver.sfx("system", "tab-sfx", { extension: "wav" }),
        tabChange: AssetResolver.sfx("system", "tab-sfx", { extension: "wav" }),
        targetMove: AssetResolver.sfx("system", "tab-sfx", { extension: "wav" }),
        encounter: AssetResolver.sfx("system", "encounter-sfx", { extension: "wav" }),
        battleStart: AssetResolver.sfx("system", "encounter-sfx", { extension: "wav" }),
        playerTurn: AssetResolver.sfx("system", "tab-sfx", { extension: "wav" }),
        enemyTurn: AssetResolver.sfx("system", "tab-sfx", { extension: "wav" }),
        guard: AssetResolver.sfx("action", "guard", { extension: "wav" }),
        hit: AssetResolver.sfx("weapon", "punch-impact", { extension: "wav" }),
        victory: AssetResolver.sfx("system", "victory-sfx", { extension: "wav" }),
        defeat: AssetResolver.sfx("system", "defeat-sfx", { extension: "wav" }),
        summaryOpen: AssetResolver.sfx("system", "confirm-sfx", { extension: "wav" }),
        summaryNext: AssetResolver.sfx("system", "confirm-sfx", { extension: "wav" }),
        questAccept: AssetResolver.sfx("system", "confirm-sfx", { extension: "wav" }),
        questTurnIn: AssetResolver.sfx("system", "victory-sfx", { extension: "wav" })
    }),
    volumes: Object.freeze({
        sfx: Object.freeze({
            punchWhoosh: 0.34,
            punchImpact: 0.38,
            enemyAttack: 0.32,
            playerHit: 0.38,
            skillFireball: 0.32,
            skillIcePike: 0.32,
            skillPoison: 0.30,
            skillPoisonTick: 0.26,
            typewriter: 0.18
        }),
        events: Object.freeze({
            menuMove: 0.20,
            menuConfirm: 0.22,
            menuCancel: 0.18,
            tabChange: 0.20,
            targetMove: 0.18,
            encounter: 0.32,
            battleStart: 0.24,
            playerTurn: 0.22,
            enemyTurn: 0.22,
            guard: 0.28,
            hit: 0.30,
            victory: 0.30,
            defeat: 0.28,
            summaryOpen: 0.20,
            summaryNext: 0.22,
            questAccept: 0.24,
            questTurnIn: 0.28
        })
    }),
    settings: normalizeSettings(),
    debug: false,
    voicePool: null,
    unlockBound: false,
    getVoicePool() {
        if (!this.voicePool) this.voicePool = new SfxVoicePool({
            diagnose: (message, detail) => { if (this.debug) console.warn(`[SFX] ${message}`, detail); }
        });
        return this.voicePool;
    },
    ensureUnlocked() {
        const pool = this.getVoicePool();
        try {
            for (const sound of Object.values(this.sfx)) pool.prepare(sound.src);
            for (const src of Object.values(this.eventPaths)) pool.prepare(src);
            return pool.unlock();
        } catch (error) {
            if (this.debug) console.warn("[SFX] UNLOCK FAILED", error);
            return Promise.resolve(false);
        }
    },
    bindUnlock(target = globalThis.document) {
        if (this.unlockBound || !target?.addEventListener) return;
        this.unlockBound = true;
        const unlock = () => { this.ensureUnlocked(); };
        // Keep retrying locked voices; successfully unlocked voices are skipped.
        for (const event of ["pointerdown", "keydown"]) target.addEventListener(event, unlock, { capture: true });
    },
    stopBattleSFX() { this.voicePool?.stopScope("battle"); },
    setSettings(settings = {}) {
        this.settings = normalizeSettings(settings);
        return { ...this.settings };
    },
    getSfxVolume(baseVolume) {
        return baseVolume * this.settings.masterVolume * this.settings.sfxVolume;
    },
    playAudio(audio) {
        try {
            const playAttempt = audio.play();
            if (playAttempt?.catch) playAttempt.catch(error => { if (this.debug) console.warn("[AUDIO] FAILED", audio.src, error?.name); });
        } catch (error) {
            if (this.debug) console.warn("[AUDIO] FAILED", audio.src, error?.name);
            return false;
        }
        return true;
    },
    playSFX(soundName, options = {}) {
        const src = this.sfx[soundName]?.src || this.eventPaths[soundName];
        if (!src) { if (this.debug) console.warn("[SFX] MISSING", soundName); return false; }
        this.bindUnlock();
        if (Number(options.delay) > 0) return this.getVoicePool().delay(
            () => this.playSFX(soundName, { ...options, delay: 0 }), Number(options.delay), options.scope
        );
        return Boolean(this.getVoicePool().play(src, {
            ...options,
            volume: this.getSfxVolume(options.volume ?? this.volumes.sfx[soundName] ?? this.volumes.events[soundName] ?? 0.32)
        }));
    },
    startLoopingSFX(soundName) {
        const sound = this.sfx[soundName];
        if (!sound) return false;
        sound.loop = true;
        sound.volume = this.getSfxVolume(this.volumes.sfx[soundName] ?? 0.32);
        if (!sound.paused) return true;
        sound.currentTime = 0;
        return this.playAudio(sound);
    },
    stopLoopingSFX(soundName) {
        const sound = this.sfx[soundName];
        if (!sound) return false;
        sound.pause();
        sound.currentTime = 0;
        sound.loop = false;
        return true;
    },
    playEvent(eventName, options = {}) {
        return this.playSFX(eventName, options);
    },
    playEventAndWait(eventName, { maxWaitMs = 8000 } = {}) {
        const src = this.eventPaths[eventName];
        if (!src) return Promise.resolve(false);
        const handle = this.getVoicePool().play(src, {
            volume: this.getSfxVolume(this.volumes.events[eventName] ?? 0.22),
            maxWaitMs
        });
        return handle?.done || Promise.resolve(false);
    },
    stopExplorationAudio() {
        this.stopLoopingSFX("typewriter");
    }
};

AudioManager.bindUnlock();
