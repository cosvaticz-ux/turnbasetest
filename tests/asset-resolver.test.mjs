import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AssetResolver, normalizeAssetId } from "../src/core/AssetResolver.js";
import {
    CHARACTER_DEFINITIONS,
    ENEMY_DEFINITIONS,
    SKILL_DEFINITIONS,
    createPrototypeBattleContent
} from "../src/data/battleContent.js";

assert.equal(normalizeAssetId("Highland Man"), "highland-man");
assert.equal(normalizeAssetId("icePike"), "ice-pike");
assert.equal(normalizeAssetId("old_city"), "old-city");

assert.equal(AssetResolver.player("luke"), "./assets/images/character/player/luke/");
assert.equal(
    AssetResolver.playerFrame("rafel", "idle", 3),
    "./assets/images/character/player/rafel/idle/idle_03.png"
);
assert.equal(
    AssetResolver.playerWalkFrame("luke", "front", 3),
    "./assets/images/character/player/luke/walk/luke-walkfront3.png"
);
assert.equal(AssetResolver.npcSprite("town-mara"), "./assets/images/character/npc/town-mara.png");
assert.equal(AssetResolver.enemy("highwayman"), "./assets/images/character/enemies/highwayman/");
assert.equal(
    AssetResolver.enemyAnimationFrame("highwayman", "idle", 1),
    "./assets/images/character/enemies/highwayman/highwayman-idle1.png"
);
assert.equal(AssetResolver.skill("icePike"), "./assets/images/skill/ice-pike/");
assert.equal(AssetResolver.skillEffect("fireball"), "./assets/images/skill/fireball/effect.png");
assert.equal(AssetResolver.status("poison"), "./assets/images/ui/status/poison.png");
assert.equal(
    AssetResolver.battleBackground("ruined-road"),
    "./assets/images/background/battle/ruined-road.jpg"
);
assert.equal(AssetResolver.titleBackground("old-city"), "./assets/images/background/title/old-city.png");
assert.equal(AssetResolver.titleScreen("goddess-left"), "./assets/images/screen/title/goddess-left.png");
assert.equal(
    AssetResolver.playerFrame("", "idle", 1, { fallback: "./assets/images/ui/placeholder.png" }),
    "./assets/images/ui/placeholder.png"
);
assert.equal(AssetResolver.enemySprite(null), null);

assert.equal(CHARACTER_DEFINITIONS.luke.assetId, "luke");
assert.deepEqual(CHARACTER_DEFINITIONS.luke.unlockedSkillIds, ["fireball", "ice-pike", "poison"]);
assert.equal(ENEMY_DEFINITIONS["highland-man"].assetId, null, "missing enemy art does not borrow an unrelated asset");
assert.equal(ENEMY_DEFINITIONS["highland-man"].metadata.placeholderRenderer, "humanoid");
assert.equal(SKILL_DEFINITIONS["ice-pike"].id, "ice-pike");

const content = createPrototypeBattleContent();
assert.equal(content.player.assetId, "luke");
assert.equal(content.enemy.sprite, "./assets/images/character/enemies/highwayman/highwayman-idle1.png");
assert.equal(content.highlandMan.sprite, null, "Highland Man does not synthesize an unrelated sprite path");
assert.equal(content.highlandMan.visual.type, "placeholder");

const [battleContentSource, battleSceneSource, html, css] = await Promise.all([
    readFile(new URL("../src/data/battleContent.js", import.meta.url), "utf8"),
    readFile(new URL("../src/scenes/BattleScene.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8")
]);
assert.doesNotMatch(battleContentSource, /["']\.\/assets\//, "content data stores IDs instead of raw asset paths");
assert.doesNotMatch(battleSceneSource, /["']\.\/assets\//, "BattleScene resolves assets through AssetResolver");
assert.doesNotMatch(html, /src=["']\.\/assets\/images\/skill\//, "skill image paths are not hard-coded in markup");
assert.match(css, /background-image:\s*var\(--battle-background-image, none\)/, "battle background is injected from battle data");

console.log("Asset resolver and data-driven fallback assertions passed.");
