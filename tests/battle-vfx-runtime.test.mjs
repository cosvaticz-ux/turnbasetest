import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BATTLE_VFX } from "../src/data/battleVfx.js";

class Node {
    constructor() { this.children = []; this.dataset = {}; this.style = { setProperty() {} }; this.classList = { add() {}, remove() {} }; }
    setAttribute() {}
    appendChild(node) { node.parent = this; this.children.push(node); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
}
globalThis.document = { createElement: () => new Node() };
globalThis.Audio = class { constructor(src) { this.src = src; } play() { return Promise.resolve(); } pause() {} };
const imageRequests = [];
globalThis.Image = class {
    constructor() { this.naturalWidth = 256; this.naturalHeight = 256; }
    set src(src) { imageRequests.push(src); queueMicrotask(() => this.onload?.()); }
};
let now = 0;
let next = 0;
const timers = new Map();
globalThis.setTimeout = (callback, ms) => { const id = ++next; timers.set(id, { callback, at: now + ms }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
function advance(ms) {
    const until = now + ms;
    while (true) {
        const entry = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
        if (!entry || entry[1].at > until) break;
        timers.delete(entry[0]); now = entry[1].at; entry[1].callback();
    }
    now = until;
}
const { AudioManager } = await import("../src/core/AudioManager.js");
const { createBattleEffectPresentation } = await import("../src/scenes/battle/BattleEffectPresentation.js");
const sounds = [];
AudioManager.playSFX = id => { sounds.push(id); return true; };
const elements = Object.fromEntries(["battleScreen", "battleCamera", "damageNumber", "fireballEffect", "icePikeEffect", "poisonEffect"].map(key => [key, new Node()]));
const target = { id: "test", formationSlot: "E1" };
const sprite = new Node();
const effects = createBattleEffectPresentation({ elements, getEntityView: () => ({ sprite }), getEntityViews: () => [{ sprite }], getSelectedTarget: () => target, hasActiveBattle: () => true, isBattleScene: () => true });
await Promise.resolve(); await Promise.resolve();
effects.present({ type: "damage", value: 23, target, skillId: "ice-pike" });
assert.deepEqual(sounds, ["skillIcePike"], "Ice Pike SFX starts immediately with the VFX");
await Promise.resolve();
const node = elements.battleCamera.children[0];
assert.ok(node.className.includes("vfx-ice"));
assert.equal(node.style.backgroundSize, "500% 300%", "manual atlas overrides a contradictory auto-detection shape");
assert.equal(imageRequests.includes(BATTLE_VFX.ice.src), false, "manual layout bypasses pixel scanning");
assert.equal(node.style.backgroundPosition, "0% 0%");
advance(205);
assert.equal(node.style.backgroundPosition, "0% 50%", "frame six starts the next row");
assert.deepEqual(sounds, ["skillIcePike"], "spell SFX is not replayed at the impact frame");
assert.equal(elements.battleCamera.children.length, 1, "damage number still waits for impact frame");
advance(41);
assert.deepEqual(sounds, ["skillIcePike"]);
assert.equal(elements.battleCamera.children[1].textContent, "-23");
advance(164);
assert.equal(node.style.backgroundPosition, "0% 100%", "frame eleven starts row three");
effects.clearVisualTimers();
assert.equal(timers.size, 0);
assert.equal(elements.battleCamera.children.length, 0);
effects.present({ type: "damage", value: 8, target, skillId: "fireball" });
assert.equal(sounds.at(-1), "skillFireball", "Fireball SFX starts with the VFX instead of waiting for damage");
await Promise.resolve();
assert.equal(elements.battleCamera.children.filter(node => node.className?.includes("runtime-vfx")).length, 1, "skill emits exactly one VFX");
effects.clearVisualTimers();
effects.present({ type: "heal", value: 5, target });
await Promise.resolve();
assert.equal(sounds.at(-1), "menuConfirm", "heal uses an existing audio fallback");
assert.equal(elements.battleCamera.children[0].textContent, "+5");
effects.clearVisualTimers();
effects.present({ type: "damage", value: 3, target });
effects.clearVisualTimers();
await Promise.resolve();
assert.equal(elements.battleCamera.children.length, 0, "late atlas completion cannot resurrect a retired effect");
assert.equal(timers.size, 0);
const png = await readFile(new URL("../assets/images/skill/VFX/ice/vfx-ice1.png", import.meta.url));
assert.equal(png.readUInt32BE(16), 1280);
assert.equal(png.readUInt32BE(20), 384);
assert.equal(png.readUInt32BE(16) / 5, 256);
assert.equal(png.readUInt32BE(20) / 3, 128);
console.log("VFX runtime: actual Ice dimensions, manual precedence, row-major traversal, start-timed spell SFX, impact synchronization, no duplicate VFX, heal and cleanup passed.");
