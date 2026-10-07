// Playback voices never share the elements owned by the asset preloader.
export class SfxVoicePool {
    constructor({ createAudio = src => new Audio(src), maxVoices = 4, diagnose = () => {} } = {}) {
        this.createAudio = createAudio;
        this.maxVoices = maxVoices;
        this.diagnose = diagnose;
        this.pools = new Map();
        this.timers = new Map();
    }

    prepare(src) {
        try { src = new URL(src, globalThis.document?.baseURI).href; } catch { /* Node tests may have no document URL. */ }
        if (!this.pools.has(src)) this.pools.set(src, []);
        const pool = this.pools.get(src);
        while (pool.length < this.maxVoices) {
            const audio = this.createAudio(src);
            audio.preload = "auto";
            pool.push({ audio, busy: false, unlocked: false, generation: 0, finish: null });
        }
        return pool;
    }

    unlock() {
        const attempts = [];
        for (const pool of this.pools.values()) for (const voice of pool) {
            if (voice.unlocked || voice.busy) continue;
            voice.busy = true;
            voice.priming = true;
            const generation = ++voice.generation;
            voice.audio.volume = 0;
            try {
                // Called synchronously within the input handler, never after an await.
                const attempt = voice.audio.play();
                attempts.push(Promise.resolve(attempt).then(() => {
                    voice.unlocked = true;
                }, error => this.diagnose("UNLOCK FAILED", error?.name)).finally(() => {
                    if (generation !== voice.generation) return;
                    voice.audio.pause();
                    try { voice.audio.currentTime = 0; } catch { /* Not seekable yet. */ }
                    voice.busy = false;
                    voice.priming = false;
                }));
            } catch (error) {
                voice.busy = false;
                voice.priming = false;
                this.diagnose("UNLOCK FAILED", error?.name);
            }
        }
        return Promise.all(attempts);
    }

    play(src, { volume = 0.3, rate = 1, allowOverlap = true, scope = null, maxWaitMs = 15000 } = {}) {
        let pool;
        try { pool = this.prepare(src); } catch (error) { this.diagnose("FAILED", error); return null; }
        let voice = pool.find(entry => !entry.busy) || pool.find(entry => entry.priming);
        if (!allowOverlap && pool.some(entry => entry.busy && !entry.priming)) return null;
        if (!voice) { this.diagnose("VOICE POOL EXHAUSTED", src); return null; }
        voice.busy = true;
        if (voice.priming) voice.audio.pause();
        voice.priming = false;
        voice.scope = scope;
        const generation = ++voice.generation;
        const audio = voice.audio;
        let resolveDone;
        const done = new Promise(resolve => { resolveDone = resolve; });
        let timeout;
        let settled = false;
        const finish = success => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            audio.removeEventListener?.("ended", ended);
            audio.removeEventListener?.("error", failed);
            if (generation === voice.generation) {
                audio.pause();
                voice.busy = false;
                voice.finish = null;
            }
            resolveDone(success);
        };
        const ended = () => finish(true);
        const failed = error => { this.diagnose("FAILED", { src, reason: error?.name || audio.error?.code }); finish(false); };
        voice.finish = finish;
        audio.addEventListener?.("ended", ended);
        audio.addEventListener?.("error", failed);
        timeout = setTimeout(() => { this.diagnose("TIMEOUT", src); finish(false); }, Math.max(1000, Number(maxWaitMs) || 15000));
        timeout?.unref?.();
        try {
            audio.loop = false;
            audio.volume = Math.max(0, Math.min(1, Number(volume) || 0));
            audio.playbackRate = Math.max(0.25, Math.min(4, Number(rate) || 1));
            audio.currentTime = 0;
            this.diagnose("PLAY", { src, voice: pool.indexOf(voice), readyState: audio.readyState });
            Promise.resolve(audio.play()).then(() => {
                if (generation === voice.generation) voice.unlocked = true;
            }, failed);
        } catch (error) { failed(error); }
        return { audio, done, stop: () => finish(false) };
    }

    delay(callback, delayMs, scope) {
        const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, delayMs);
        this.timers.set(timer, scope);
        return true;
    }

    stopScope(scope) {
        for (const [timer, owner] of this.timers) if (owner === scope) { clearTimeout(timer); this.timers.delete(timer); }
        for (const pool of this.pools.values()) for (const voice of pool) {
            if (voice.scope === scope) voice.finish?.(false);
        }
    }
}
