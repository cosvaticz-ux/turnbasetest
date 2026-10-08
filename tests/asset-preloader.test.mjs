import assert from "node:assert/strict";

const imageRequests = new Map();
const audioRequests = new Map();
const decodeRequests = new Map();

class FakeImage {
    set src(value) {
        this._src = value;
        imageRequests.set(value, (imageRequests.get(value) || 0) + 1);
        queueMicrotask(() => {
            if (value.includes("missing")) this.onerror?.(new Error("missing"));
            else this.onload?.();
        });
    }
    get src() { return this._src; }
    decode() {
        decodeRequests.set(this.src, (decodeRequests.get(this.src) || 0) + 1);
        return Promise.resolve();
    }
}

class FakeAudio {
    constructor() {
        this.listeners = new Map();
        this.preload = "none";
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type, listener) {
        if (this.listeners.get(type) === listener) this.listeners.delete(type);
    }
    load() {
        audioRequests.set(this.src, (audioRequests.get(this.src) || 0) + 1);
        queueMicrotask(() => {
            const event = this.src.includes("missing") ? "error" : "loadeddata";
            this.listeners.get(event)?.();
        });
    }
}

const logMessages = [];
const logger = {
    info(message) { logMessages.push(message); },
    warn(...parts) { logMessages.push(parts.join(" ")); }
};

const { AssetPreloaderService } = await import("../src/core/AssetPreloader.js");
const preloader = new AssetPreloaderService({
    ImageConstructor: FakeImage,
    AudioConstructor: FakeAudio,
    timeoutMs: 0,
    logger
});

preloader
    .registerGroup("first", [
        { type: "image", src: "shared.png" },
        { type: "image", src: "shared.png" },
        { type: "audio", src: "nearby.wav" },
        { type: "image", src: "missing-optional.png" }
    ])
    .registerGroup("second", [
        { type: "image", src: "shared.png" }
    ]);

const progressEvents = [];
const unsubscribe = preloader.subscribe(progress => progressEvents.push(progress));
const [firstResult, secondResult] = await Promise.all([
    preloader.loadGroup("first"),
    preloader.loadGroup("second")
]);
unsubscribe();

assert.equal(firstResult.total, 3, "duplicate paths count once inside a group");
assert.equal(firstResult.loaded, 2);
assert.equal(firstResult.failed, 1, "a missing optional asset completes instead of freezing the group");
assert.equal(firstResult.percentage, 100);
assert.equal(secondResult.loaded, 1);
assert.equal(imageRequests.get("shared.png"), 1, "simultaneous groups share one image request");
assert.equal(decodeRequests.get("shared.png"), 1, "a shared PNG is decoded once");
assert.equal(audioRequests.get("nearby.wav"), 1);
assert.equal(preloader.isGroupLoaded("first"), true);
assert.equal(preloader.isGroupLoaded("second"), true);
assert.ok(preloader.getCachedAsset("shared.png") instanceof FakeImage);
assert.ok(progressEvents.some(progress => progress.groupName === "first" && progress.percentage > 0 && progress.percentage < 100));
assert.equal(progressEvents.at(-1).percentage, 100);

await preloader.loadGroup("first");
assert.equal(imageRequests.get("shared.png"), 1, "re-entering a loaded group does not request assets again");
assert.equal(imageRequests.get("missing-optional.png"), 1, "failed assets are remembered and not retry-spammed");
assert.ok(logMessages.some(message => message.includes("Failed:") && message.includes("missing-optional.png")));

const managedAudio = new FakeAudio();
managedAudio.src = "managed-map.wav";
assert.equal(preloader.registerManagedAsset("managed-map.wav", managedAudio), true);
preloader.registerGroup("managed-audio", [{ type: "audio", src: "managed-map.wav" }]);
await preloader.loadGroup("managed-audio");
assert.equal(preloader.getCachedAsset("managed-map.wav"), managedAudio,
    "preloading and playback share the same managed audio instance");
assert.equal(audioRequests.get("managed-map.wav"), 1);

await assert.rejects(() => preloader.loadGroup("unknown"), /Unknown asset group/);

let activeImageLoads = 0;
let peakImageLoads = 0;
class LimitedImage {
    set src(value) {
        this._src = value;
        activeImageLoads += 1;
        peakImageLoads = Math.max(peakImageLoads, activeImageLoads);
        queueMicrotask(() => {
            activeImageLoads -= 1;
            this.onload?.();
        });
    }
    decode() { return Promise.resolve(); }
}
const limitedPreloader = new AssetPreloaderService({
    ImageConstructor: LimitedImage,
    AudioConstructor: FakeAudio,
    maxConcurrent: 2,
    timeoutMs: 0,
    logger
});
limitedPreloader.registerGroup("large", Array.from(
    { length: 7 },
    (_, index) => ({ type: "image", src: `large-${index}.png` })
));
await limitedPreloader.loadGroup("large");
assert.equal(peakImageLoads, 2, "a global worker limit prevents large groups from decoding every image at once");

globalThis.Image = FakeImage;
globalThis.Audio = FakeAudio;
const {
    ASSET_PRELOAD_GROUP,
    ASSET_PRELOAD_GROUPS,
    getMapPreloadGroup
} = await import("../src/data/assetPreloadGroups.js");
const bootSources = ASSET_PRELOAD_GROUPS[ASSET_PRELOAD_GROUP.BOOT_CRITICAL].map(asset => asset.src);
const newGameSources = ASSET_PRELOAD_GROUPS[ASSET_PRELOAD_GROUP.NEW_GAME_START].map(asset => asset.src);
const townSouthSources = ASSET_PRELOAD_GROUPS[ASSET_PRELOAD_GROUP.TOWN_SOUTH].map(asset => asset.src);
const townNorthSources = ASSET_PRELOAD_GROUPS[ASSET_PRELOAD_GROUP.TOWN_NORTH].map(asset => asset.src);
const deepForestSources = ASSET_PRELOAD_GROUPS[ASSET_PRELOAD_GROUP.DEEP_FOREST].map(asset => asset.src);
const battleSources = ASSET_PRELOAD_GROUPS[ASSET_PRELOAD_GROUP.BATTLE_COMMON].map(asset => asset.src);
const highwaymanBattleSources = ASSET_PRELOAD_GROUPS[ASSET_PRELOAD_GROUP.HIGHWAYMAN_BATTLE].map(asset => asset.src);
assert.ok(bootSources.some(src => src.endsWith("background/title/old-city.png")));
assert.ok(!bootSources.some(src => src.includes("/map/")), "boot stays limited to common and Title assets");
assert.ok(newGameSources.some(src => src.endsWith("background/map/front-forest.png")),
    "Front Forest preloads its authoritative debug reference");
assert.ok(newGameSources.some(src => src.endsWith("background/map/final/front-forest.png")),
    "Front Forest preloads its final artwork");
assert.ok(newGameSources.some(src => src.endsWith("highwayman/highwayman-map.png")),
    "Front Forest preloads the chibi Highwayman map sprite");
assert.ok(townSouthSources.some(src => src.endsWith("background/map/town-south.png")),
    "Town South preloads its authoritative debug reference");
assert.ok(townSouthSources.some(src => src.endsWith("background/map/final/town-south.png")),
    "Town South preloads its final artwork");
assert.ok(townSouthSources.some(src => src.endsWith("character/npc/town-woman2.png")),
    "Town South preloads the replacement chibi Woman");
assert.ok(townSouthSources.some(src => src.endsWith("character/npc/town-woman.png")),
    "Town South preloads the Townswoman dialogue portrait");
assert.ok(townNorthSources.some(src => src.endsWith("character/npc/town-mara2.png")),
    "Town Part 2 preloads Mara");
assert.ok(townNorthSources.some(src => src.endsWith("character/npc/town-mara.png")),
    "Town Part 2 preloads Mara's dialogue portrait");
assert.ok(deepForestSources.some(src => src.endsWith("highwayman/highwayman-map.png")),
    "Deep Forest preloads the chibi Highwayman map sprite");
const { getLukeExplorationSources } = await import('../src/data/explorationCharacters.js');
for (const [mapId, sources] of Object.entries({
    'front-forest': newGameSources, 'deep-forest': deepForestSources,
    'town-south': townSouthSources, 'town-north': townNorthSources
})) {
    for (const src of getLukeExplorationSources()) {
        assert.equal(sources.filter(source => source === src).length, 1,
            `${mapId} preloads each current walk/idle sheet exactly once`);
    }
    assert.ok(!sources.some(src => /luke-walk(?:front|back|left)\d+\.png$/.test(src)),
        `${mapId} excludes obsolete individual walk frames`);
}
assert.ok(Object.values(ASSET_PRELOAD_GROUPS).flat()
    .filter(asset => asset.type === "audio")
    .every(asset => asset.src.includes("/audio/sfx/")), "preloads contain only gameplay SFX");
assert.ok(!bootSources.some(src => src.includes("/punch/")), "full battle attacks are not loaded at boot");
const lukeBattleSources = battleSources.filter(src => src.includes("/character/player/luke/"));
assert.deepEqual(lukeBattleSources.sort(), [
    "./assets/images/character/player/luke/cast/luke-cast.png",
    "./assets/images/character/player/luke/guard/guard.png",
    "./assets/images/character/player/luke/idle/luke-idle.png",
    "./assets/images/character/player/luke/punch/luke-puch.png"
].sort(), "Luke preloads three animation sheets plus the existing guard image");
assert.ok(!lukeBattleSources.some(src => /\/(?:idle|punch|cast)_\d+\.png$/.test(src)),
    "Luke no longer preloads obsolete individual battle frames");
assert.ok(battleSources.some(src => src.endsWith("skill/ice-pike/effect.png")));
assert.ok(highwaymanBattleSources.some(src => src.endsWith("attack/highwayman-attack-v2-01.png")));
assert.ok(highwaymanBattleSources.some(src => src.endsWith("attack/highwayman-attack-v2-09.png")));
assert.ok(!Object.values(ASSET_PRELOAD_GROUPS).flat().some(asset => (
    asset.src.includes("exploration-theme")
    || asset.src.includes("boss-theme")
    || asset.src.includes("battle-city")
)), "preload groups exclude unresolved/hypothetical repository paths");
assert.equal(getMapPreloadGroup("front-forest"), "front-forest");
assert.equal(getMapPreloadGroup("town-north"), "town-north");
assert.equal(getMapPreloadGroup("future-map"), null);

console.log("Asset preloader: real progress, image decode, shared promises, group cache, audio preload, and failure safety passed.");
