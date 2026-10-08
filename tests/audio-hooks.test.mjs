import assert from "node:assert/strict";
import { existsSync } from "node:fs";

let playCalls = 0;
const audioSources = [];
globalThis.Audio = class {
    constructor(src) {
        this.src = src;
        this.currentTime = 0;
        this.volume = 1;
        this.loop = false;
    }
    play() {
        audioSources.push(this.src);
        playCalls += 1;
        return Promise.reject(new Error("missing test asset"));
    }
    pause() {}
};

const { AudioManager } = await import("../src/core/AudioManager.js");

assert.equal(AudioManager.playEvent("unknownEvent"), false);
assert.equal(AudioManager.playEvent("menuMove"), true);
await Promise.resolve();
await Promise.resolve();
assert.equal(AudioManager.playEvent("menuMove"), true, "transient rejection must not permanently disable the event");
assert.equal(playCalls, 2);
await Promise.resolve();
assert.match(AudioManager.eventPaths.summaryOpen, /system\/confirm-sfx\.wav$/);
assert.match(AudioManager.eventPaths.victory, /system\/victory-sfx\.wav$/);
assert.match(AudioManager.sfx.skillIcePike.src, /audio\/sfx\/skill\/ice-pike\.wav$/);

const sources = new Set([
    ...Object.values(AudioManager.sfx).map(sound => sound.src),
    ...Object.values(AudioManager.eventPaths)
]);
assert.equal(sources.size, 13, "all thirteen gameplay SFX remain mapped");
for (const src of sources) {
    assert.ok(src.includes("/audio/sfx/"), "managed audio contains only gameplay SFX");
    assert.ok(existsSync(new URL("../" + src, import.meta.url)), "mapped gameplay SFX exists: " + src);
}
assert.ok(audioSources.every(src => src.includes("/audio/sfx/")), "event playback only requests gameplay SFX");
AudioManager.stopExplorationAudio();

console.log("Audio hooks: thirteen preserved SFX, event paths, and transient failure recovery passed.");
