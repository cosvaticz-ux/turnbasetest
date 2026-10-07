import assert from "node:assert/strict";
import { SfxVoicePool } from "../src/core/SfxVoicePool.js";
import { BATTLE_VFX } from "../src/data/battleVfx.js";
import { getEffectTiming, resolveBattleEffect } from "../src/data/battleEffectRegistry.js";
import { TECHNIQUE_DEFINITIONS } from "../src/data/techniques.js";

class AudioMock extends EventTarget {
    constructor(src) { super(); this.src = src; this.currentTime = 0; this.paused = true; this.plays = 0; }
    play() { this.plays++; this.paused = false; return this.reject ? Promise.reject(Object.assign(new Error(), { name: "NotAllowedError" })) : Promise.resolve(); }
    pause() { this.paused = true; }
}
const voices = [];
const pool = new SfxVoicePool({ createAudio: src => { const voice = new AudioMock(src); voices.push(voice); return voice; } });
const handles = Array.from({ length: 4 }, () => pool.play("ice", { scope: "battle" }));
assert.equal(new Set(handles.map(h => h.audio)).size, 4, "same SFX overlaps on four separate voices");
assert.equal(pool.play("ice"), null, "pool stays bounded");
handles[0].audio.dispatchEvent(new Event("ended"));
assert.equal(await handles[0].done, true);
assert.equal(pool.play("ice", { scope: "battle" }).audio, handles[0].audio, "finished voice is reused");
pool.stopScope("battle");
assert.equal(voices.every(voice => voice.paused), true);
const rejected = pool.play("reject");
rejected.stop();
rejected.audio.reject = true;
const failed = pool.play("reject");
assert.equal(await failed.done, false, "play rejection is contained");
rejected.audio.reject = false;
const recovered = pool.play("reject");
assert.ok(recovered, "a later battle can retry the same sound");
recovered.stop();
let lateSound = false;
pool.delay(() => { lateSound = true; }, 1, "battle");
pool.stopScope("battle");
await new Promise(resolve => setTimeout(resolve, 10));
assert.equal(lateSound, false, "cleanup cancels scheduled audio");
const unlocking = pool.unlock();
const firstGesture = pool.play("ice");
assert.ok(firstGesture, "unlock priming must not consume all channels on the first input");
await unlocking;
assert.equal(firstGesture.audio.paused, false, "unlock completion cannot stop a newly started voice");
firstGesture.stop();

assert.deepEqual(BATTLE_VFX.ice.atlas, { columns: 5, rows: 3, frames: 11 });
const timing = getEffectTiming(BATTLE_VFX.ice);
assert.equal(timing.durationMs, 450);
assert.ok(Math.abs(timing.impactTimeMs - 6 * 450 / 11) < 1e-9);
assert.equal(getEffectTiming(BATTLE_VFX["fire-heavy"]).impactTimeMs, 520, "Fireball impact is authored inside the VFX instead of via a second scene delay");
assert.equal(getEffectTiming(BATTLE_VFX["poison-hit"]).impactTimeMs, 700, "initial Poison impact is authored inside the VFX instead of via a second scene delay");
for (const id of ["fireball", "ice-pike", "poison"]) {
    assert.equal(TECHNIQUE_DEFINITIONS[id].presentationLeadMs, undefined, `${id} must not delay before starting its VFX`);
    assert.equal(resolveBattleEffect({ skillId: id }).sfxTiming, "start", `${id} SFX should start with its VFX`);
}
assert.equal(resolveBattleEffect({ weapon: { type: "sword" } }).sfxTiming, "impact", "weapon impact SFX stays impact-synchronized");
assert.equal(resolveBattleEffect({ effectId: "poison-tick" }).sfxTiming, "impact", "DoT tick SFX stays impact-synchronized");
assert.equal(getEffectTiming({ fps: 20, atlas: { frames: 11 }, impactFrame: 7 }).durationMs, 550);
assert.equal(getEffectTiming({ frameDurationMs: 10, atlas: { frames: 11 }, impactFrame: 7 }).impactTimeMs, 60);
assert.equal(resolveBattleEffect({ skillId: "ice-pike" }).vfx, "ice");
assert.equal(resolveBattleEffect({ skillId: "poison" }).vfx, "poison-hit");
assert.equal(resolveBattleEffect({ effectId: "poison-tick" }).vfx, "poison");
assert.equal(resolveBattleEffect({ skillId: "unknown" }).vfx, "impact");
assert.equal(resolveBattleEffect({ effectId: "unknown" }).vfx, "impact");
assert.equal(resolveBattleEffect({ skillId: "fireball" }).suppressGenericImpact, true);
for (const type of ["unarmed", "bow", "crossbow", "firearm"]) assert.equal(resolveBattleEffect({ weapon: { type } }).id, type);
assert.equal(resolveBattleEffect({ weapon: { type: "sword" } }).id, "slash");
assert.equal(resolveBattleEffect({ hitType: "critical" }).vfx, "impact-heavy");
assert.equal(resolveBattleEffect({ hitType: "fatal" }).shake.intensity, 7);
assert.equal(resolveBattleEffect({ type: "heal" }).vfx, "heal");
assert.equal(resolveBattleEffect({ hitType: "miss" }).vfx, null);
console.log("Battle effects: bounded overlap, reuse, rejection recovery, cleanup, first-gesture race, atlas timing, SFX timing, sequencing and registry passed.");
