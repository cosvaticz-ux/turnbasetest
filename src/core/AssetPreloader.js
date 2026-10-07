const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "ogg", "wav", "webm"]);

function inferAssetType(src) {
    const extension = String(src || "").split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
    if (IMAGE_EXTENSIONS.has(extension)) return "image";
    if (AUDIO_EXTENSIONS.has(extension)) return "audio";
    return null;
}

function normalizeAsset(asset) {
    const entry = typeof asset === "string" ? { src: asset } : asset;
    const src = String(entry?.src || "").trim();
    const type = entry?.type || inferAssetType(src);
    if (!src || (type !== "image" && type !== "audio")) return null;
    return Object.freeze({ src, type });
}

function progressSnapshot(groupName, state) {
    const total = state?.total || 0;
    const completed = Math.min(total, state?.completed || 0);
    return Object.freeze({
        groupName,
        status: state?.status || "idle",
        total,
        completed,
        loaded: state?.loaded || 0,
        failed: state?.failed || 0,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 100
    });
}

export class AssetPreloaderService {
    constructor({
        ImageConstructor = globalThis.Image,
        AudioConstructor = globalThis.Audio,
        maxConcurrent = 4,
        timeoutMs = 30000,
        logger = globalThis.console
    } = {}) {
        this.ImageConstructor = ImageConstructor;
        this.AudioConstructor = AudioConstructor;
        this.maxConcurrent = Math.max(1, Math.min(8, Math.floor(Number(maxConcurrent) || 4)));
        this.timeoutMs = Math.max(0, Number(timeoutMs) || 0);
        this.logger = logger;
        this.groups = new Map();
        this.groupStates = new Map();
        this.loadedAssets = new Map();
        this.loadingAssets = new Map();
        this.failedAssets = new Map();
        this.loadedGroups = new Set();
        this.managedAssets = new Map();
        this.listeners = new Set();
        this.assetQueue = [];
        this.activeLoadCount = 0;
    }

    registerGroup(groupName, assets = []) {
        const name = String(groupName || "").trim();
        if (!name) throw new TypeError("Asset group requires a name.");
        const uniqueAssets = [];
        const seen = new Set();
        for (const candidate of assets) {
            const asset = normalizeAsset(candidate);
            if (!asset || seen.has(asset.src)) continue;
            seen.add(asset.src);
            uniqueAssets.push(asset);
        }
        this.groups.set(name, Object.freeze(uniqueAssets));
        this.groupStates.delete(name);
        this.loadedGroups.delete(name);
        return this;
    }

    hasGroup(groupName) {
        return this.groups.has(groupName);
    }

    isGroupLoaded(groupName) {
        return this.loadedGroups.has(groupName);
    }

    getCachedAsset(src) {
        return this.loadedAssets.get(String(src || "").trim()) || null;
    }

    // Share one media element between background preload and runtime playback.
    registerManagedAsset(src, resource) {
        const source = String(src || "").trim();
        if (!source || !resource) return false;
        if (!this.managedAssets.has(source)) this.managedAssets.set(source, resource);
        return true;
    }

    getProgress(groupName = null) {
        if (groupName) return progressSnapshot(groupName, this.groupStates.get(groupName));
        const activeStates = [...this.groupStates.entries()].filter(([, state]) => state.status !== "idle");
        const aggregate = activeStates.reduce((total, [, state]) => ({
            total: total.total + state.total,
            completed: total.completed + state.completed,
            loaded: total.loaded + state.loaded,
            failed: total.failed + state.failed
        }), { total: 0, completed: 0, loaded: 0, failed: 0 });
        aggregate.status = activeStates.some(([, state]) => state.status === "loading") ? "loading" : "loaded";
        return progressSnapshot("all", aggregate);
    }

    subscribe(listener) {
        if (typeof listener !== "function") return () => {};
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emitProgress(groupName) {
        const progress = this.getProgress(groupName);
        for (const listener of this.listeners) {
            try {
                listener(progress);
            } catch {
                // Progress observers must never interrupt asset loading.
            }
        }
    }

    loadImage(src) {
        const ImageConstructor = this.ImageConstructor || globalThis.Image;
        if (typeof ImageConstructor !== "function") {
            return Promise.reject(new Error("Image API is unavailable"));
        }
        return new Promise((resolve, reject) => {
            const image = new ImageConstructor();
            let timeout = null;
            const finish = (callback, value) => {
                if (timeout !== null) clearTimeout(timeout);
                image.onload = null;
                image.onerror = null;
                callback(value);
            };
            image.decoding = "async";
            image.onload = async () => {
                if (typeof image.decode === "function") {
                    try {
                        await image.decode();
                    } catch {
                        // A successful load remains usable when decode() is unsupported
                        // or the browser declines an explicit decode request.
                    }
                }
                finish(resolve, image);
            };
            image.onerror = () => finish(reject, new Error(`Unable to load image: ${src}`));
            if (this.timeoutMs > 0) {
                timeout = setTimeout(
                    () => finish(reject, new Error(`Image load timed out: ${src}`)),
                    this.timeoutMs
                );
                timeout?.unref?.();
            }
            image.src = src;
        });
    }

    loadAudio(src) {
        const AudioConstructor = this.AudioConstructor || globalThis.Audio;
        if (typeof AudioConstructor !== "function") {
            return Promise.reject(new Error("Audio API is unavailable"));
        }
        return new Promise((resolve, reject) => {
            const audio = this.managedAssets.get(src) || new AudioConstructor();
            let timeout = null;
            let settled = false;
            const cleanUp = () => {
                if (timeout !== null) clearTimeout(timeout);
                audio.removeEventListener?.("loadeddata", handleLoaded);
                audio.removeEventListener?.("canplaythrough", handleLoaded);
                audio.removeEventListener?.("error", handleError);
                audio.onloadeddata = null;
                audio.oncanplaythrough = null;
                audio.onerror = null;
            };
            const finish = (callback, value) => {
                if (settled) return;
                settled = true;
                cleanUp();
                callback(value);
            };
            const handleLoaded = () => finish(resolve, audio);
            const handleError = () => finish(reject, new Error(`Unable to load audio: ${src}`));
            audio.preload = "auto";
            if (typeof audio.addEventListener === "function") {
                audio.addEventListener("loadeddata", handleLoaded, { once: true });
                audio.addEventListener("canplaythrough", handleLoaded, { once: true });
                audio.addEventListener("error", handleError, { once: true });
            } else {
                audio.onloadeddata = handleLoaded;
                audio.oncanplaythrough = handleLoaded;
                audio.onerror = handleError;
            }
            if (this.timeoutMs > 0) {
                timeout = setTimeout(
                    () => finish(reject, new Error(`Audio load timed out: ${src}`)),
                    this.timeoutMs
                );
                timeout?.unref?.();
            }
            const assignedSource = audio.getAttribute?.("src") || audio.src;
            if (!assignedSource) audio.src = src;
            if (audio.readyState >= 2) handleLoaded();
            else if (audio.paused !== false) audio.load?.();
        });
    }

    scheduleAssetLoad(load) {
        return new Promise((resolve, reject) => {
            this.assetQueue.push({ load, resolve, reject });
            this.drainAssetQueue();
        });
    }

    drainAssetQueue() {
        while (this.activeLoadCount < this.maxConcurrent && this.assetQueue.length > 0) {
            const task = this.assetQueue.shift();
            this.activeLoadCount += 1;
            Promise.resolve()
                .then(task.load)
                .then(task.resolve, task.reject)
                .finally(() => {
                    this.activeLoadCount -= 1;
                    this.drainAssetQueue();
                });
        }
    }

    loadAsset(asset) {
        const normalized = normalizeAsset(asset);
        if (!normalized) return Promise.resolve({ status: "failed", src: "", error: new Error("Invalid asset") });
        const { src, type } = normalized;
        if (this.loadedAssets.has(src)) {
            return Promise.resolve({ status: "loaded", src, asset: this.loadedAssets.get(src), cached: true });
        }
        if (this.failedAssets.has(src)) {
            return Promise.resolve({ status: "failed", src, error: this.failedAssets.get(src), cached: true });
        }
        if (this.loadingAssets.has(src)) return this.loadingAssets.get(src);

        const loader = this.scheduleAssetLoad(() => (
            type === "image" ? this.loadImage(src) : this.loadAudio(src)
        ));
        const promise = loader
            .then(resource => {
                this.loadedAssets.set(src, resource);
                return { status: "loaded", src, asset: resource, cached: false };
            })
            .catch(error => {
                this.failedAssets.set(src, error);
                this.logger?.warn?.("[Preloader] Failed:", src);
                return { status: "failed", src, error, cached: false };
            })
            .finally(() => this.loadingAssets.delete(src));
        this.loadingAssets.set(src, promise);
        return promise;
    }

    loadGroup(groupName) {
        if (!this.groups.has(groupName)) {
            return Promise.reject(new Error(`Unknown asset group: ${groupName}`));
        }
        const existing = this.groupStates.get(groupName);
        if (existing?.promise) return existing.promise;
        if (this.loadedGroups.has(groupName)) return Promise.resolve(this.getProgress(groupName));

        const assets = this.groups.get(groupName);
        const state = {
            status: "loading",
            total: assets.length,
            completed: 0,
            loaded: 0,
            failed: 0,
            lastLoggedPercentage: -10,
            promise: null
        };
        this.groupStates.set(groupName, state);
        this.logger?.info?.(`[Preloader] Loading group: ${groupName}`);
        this.emitProgress(groupName);

        const processAsset = asset => this.loadAsset(asset).then(result => {
            state.completed += 1;
            if (result.status === "loaded") state.loaded += 1;
            else state.failed += 1;
            const percentage = state.total > 0 ? Math.floor((state.completed / state.total) * 100) : 100;
            if (percentage >= state.lastLoggedPercentage + 10 || state.completed === state.total) {
                state.lastLoggedPercentage = percentage;
                this.logger?.info?.(`[Preloader] ${state.completed}/${state.total}`);
            }
            this.emitProgress(groupName);
            return result;
        });
        let nextAssetIndex = 0;
        const worker = async () => {
            while (nextAssetIndex < assets.length) {
                const asset = assets[nextAssetIndex];
                nextAssetIndex += 1;
                await processAsset(asset);
            }
        };
        const workerCount = Math.min(this.maxConcurrent, Math.max(1, assets.length));
        state.promise = Promise.all(Array.from({ length: workerCount }, () => worker())).then(() => {
            state.status = "loaded";
            this.loadedGroups.add(groupName);
            this.emitProgress(groupName);
            this.logger?.info?.(`[Preloader] Loaded group: ${groupName}`);
            return this.getProgress(groupName);
        });
        return state.promise;
    }

    preloadGroup(groupName) {
        this.logger?.info?.(`[Preloader] Background preload: ${groupName}`);
        return this.loadGroup(groupName).catch(error => {
            this.logger?.warn?.(`[Preloader] Unable to preload group: ${groupName}`, error);
            return progressSnapshot(groupName, { status: "loaded" });
        });
    }
}

export const AssetPreloader = new AssetPreloaderService();
