import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    createPlaceholderActor,
    getPlaceholderElementCount,
    setPlaceholderFacing,
    setPlaceholderState
} from "../src/ui/placeholders/PlaceholderActor.js";
import { resolveActorVisual } from "../src/ui/placeholders/placeholderPresets.js";
import { MONSTER_DEFINITIONS, getMonsterDefinition } from "../src/data/monsters.js";
import { CHARACTER_DEFINITIONS, createEncounterEnemies, createPlayer } from "../src/data/battleContent.js";

class Classes {
    constructor(owner) { this.owner = owner; this.values = new Set(); }
    add(...values) { values.forEach(value => this.values.add(value)); }
    contains(value) { return this.values.has(value); }
}
class Element {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase(); this.children = []; this.dataset = {};
        this.style = { values: new Map(), setProperty: (key, value) => this.style.values.set(key, value) };
        this.classList = new Classes(this); this.attributes = new Map();
    }
    set className(value) { this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classList.values].join(" "); }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
}
globalThis.document = { createElement: tag => new Element(tag) };

const exact = resolveActorVisual({ entityId: "highwayman", definition: MONSTER_DEFINITIONS.highwayman });
assert.deepEqual(exact, { type: "asset", assetId: "highwayman" }, "exact available art keeps priority");

const expected = new Map([
    ["grey-wolf", ["quadruped", "wolf"]],
    ["wild-boar", ["quadruped", "boar"]],
    ["restless-ghost", ["spirit", "ghost"]],
    ["slime", ["blob", "slime"]],
    ["deserting-soldier", ["humanoid", "normal"]],
    ["willow-wood", ["construct", "wood"]]
]);
for (const [id, [family, variant]] of expected) {
    const visual = resolveActorVisual({ entityId: id, definition: getMonsterDefinition(id) });
    assert.equal(visual.type, "placeholder", `${id} uses a placeholder when exact art is missing`);
    assert.equal(visual.family, family);
    assert.equal(visual.variant, variant);
    assert.notEqual(visual.assetId, "highwayman", `${id} never borrows Highwayman art`);
}

const wolf = createEncounterEnemies("grey-wolf", 1)[0];
assert.equal(wolf.assetId, null);
assert.equal(wolf.sprite, null);
assert.equal(wolf.visual.family, "quadruped");
const aliased = createEncounterEnemies("death-archmage", 1)[0];
assert.equal(aliased.visual.type, "placeholder", "logical alias does not become a visual alias");
assert.equal(aliased.assetId, null);

const rafel = createPlayer(CHARACTER_DEFINITIONS.rafel);
assert.equal(rafel.visual.type, "placeholder", "missing player art does not borrow Luke");
assert.equal(rafel.assetId, null);
assert.equal(createPlayer(CHARACTER_DEFINITIONS.luke).visual.type, "asset");

const actor = createPlaceholderActor({ entityId: "grey-wolf" });
assert.equal(actor.dataset.placeholderFamily, "quadruped");
assert.equal(actor.dataset.animationState, "idle");
assert.equal(actor.children.length + 1, getPlaceholderElementCount("quadruped"));
assert.ok(getPlaceholderElementCount("blob") <= 5);
assert.ok(getPlaceholderElementCount("spirit") <= 7);
assert.ok(getPlaceholderElementCount("quadruped") <= 18);
assert.ok(getPlaceholderElementCount("humanoid") <= 20);
assert.ok(getPlaceholderElementCount("construct") <= 16);
for (const state of ["attack", "hit", "death"]) {
    assert.equal(setPlaceholderState(actor, state), true);
    assert.equal(actor.dataset.animationState, state);
}
setPlaceholderFacing(actor, "west");
assert.equal(actor.dataset.facing, "west");

const [rendererSource, directorSource, styles] = await Promise.all([
    readFile(new URL("../src/ui/placeholders/PlaceholderActor.js", import.meta.url), "utf8"),
    readFile(new URL("../src/scenes/battle/BattleAnimationDirector.js", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/placeholderActors.css", import.meta.url), "utf8")
]);
assert.doesNotMatch(rendererSource, /setInterval|requestAnimationFrame|addEventListener/, "placeholder renderer owns no frame loop, timer, or listener");
assert.match(directorSource, /isPlaceholderActor\(sprite\)/, "battle animation branches on placeholder actors");
assert.match(styles, /@keyframes placeholder-attack/);
assert.match(styles, /transform:/);
assert.match(styles, /opacity:/);

console.log("Placeholder actors: exact-art priority, species presets, visual-alias isolation, state toggles and DOM budgets passed.");
