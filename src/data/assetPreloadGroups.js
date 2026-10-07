import { AssetPreloader } from "../core/AssetPreloader.js";
import { AssetResolver } from "../core/AssetResolver.js";
import { getBattleVfxSources } from "./battleVfx.js";
import {
    BATTLE_BACKGROUNDS,
    CHARACTER_DEFINITIONS,
    ENEMY_DEFINITIONS,
    SKILL_DEFINITIONS,
    UI_ICON_ASSETS
} from "./battleContent.js";
import { TITLE_SCREEN_CONTENT } from "./titleContent.js";
import { EXPLORATION_MAPS } from './explorationMaps.js';
import { getLukeExplorationSources } from "./explorationCharacters.js";
import { getEnvironmentArtwork } from "./environmentArtworks.js";
import { ENCOUNTER_DEFINITIONS } from "./encounters.js";


export const ASSET_PRELOAD_GROUP = Object.freeze({
    BOOT_CRITICAL: "boot-critical",
    NEW_GAME_START: "new-game-start",
    COMMON: "common",
    TITLE: "title",
    FRONT_FOREST: "front-forest",
    DEEP_FOREST: "deep-forest",
    TOWN_SOUTH: "town-south",
    TOWN_NORTH: "town-north",
    BATTLE_COMMON: "battle-common",
    HIGHWAYMAN_BATTLE: "highwayman-battle"
});

const image = src => Object.freeze({ type: "image", src });
const audio = src => Object.freeze({ type: "audio", src });

const LOADOUT_UI_ASSETS = Object.freeze([
    "./assets/images/character/player/luke/profile/luke-profile.png",
    "./assets/images/character/player/lucy/profile/lucy-profile.png",
    "./assets/images/item/item.png",
    "./assets/images/item/weapon.png"
]);

function uniqueAssets(assets) {
    const seen = new Set();
    return assets.filter(asset => {
        if (!asset?.src || seen.has(asset.src)) return false;
        seen.add(asset.src);
        return true;
    });
}

function playerFrames(definition, actions = Object.keys(definition.animations || {})) {
    return actions.flatMap(action => {
        const animation = definition.animations?.[action];
        if (!animation) return [];
        const assetId = definition.assetId || definition.id;
        if (animation.fileName) {
            const root = AssetResolver.player(assetId);
            const folder = animation.folder ? `${animation.folder}/` : "";
            return [image(`${root}${folder}${animation.fileName}`)];
        }
        return Array.from({ length: Math.max(1, animation.frames || 1) }, (_, index) => image(
            AssetResolver.playerFrame(assetId, animation.id, index + 1)
        ));
    });
}

function enemyFrames(definition, actions = Object.keys(definition.animations || {})) {
    return actions.flatMap(action => {
        const animation = definition.animations?.[action];
        if (!animation) return [];
        if (animation.fileName) {
            const root = AssetResolver.enemy(definition.assetId || definition.id);
            const folder = animation.folder ? `${animation.folder}/` : "";
            return [image(`${root}${folder}${animation.fileName}`)];
        }
        return Array.from({ length: Math.max(1, animation.frames || 1) }, (_, index) => {
            if (animation.folder || animation.filePrefix) {
                return image(AssetResolver.enemyAnimationFramePattern(
                    definition.assetId || definition.id,
                    index + 1,
                    {
                        folder: animation.folder || "",
                        prefix: animation.filePrefix || "",
                        padding: animation.framePadding || 2
                    }
                ));
            }
            return image(AssetResolver.enemyAnimationFrame(
                definition.assetId || definition.id,
                animation.id,
                index + 1
            ));
        });
    });
}

function mapAssets(mapId) {
    const map = EXPLORATION_MAPS[mapId];
    if (!map) return [];
    const artwork = getEnvironmentArtwork(mapId);
    const npcAssets = map.interactables
        .filter(item => item.type === 'npc')
        .flatMap(item => [
            image(AssetResolver.npcSprite(item.assetId || 'town-woman')),
            ...(item.dialoguePortraitAssetId
                ? [image(AssetResolver.npcSprite(item.dialoguePortraitAssetId))]
                : [])
        ]);
    const enemyMapAssets = map.enemies
        .map(enemy => enemy.mapSpriteId || ENCOUNTER_DEFINITIONS[enemy.encounterId]?.mapSpriteId)
        .filter(Boolean)
        .map(assetId => image(AssetResolver.enemyMapSprite(assetId)));
    return uniqueAssets([
        image(`./assets/images/background/map/${map.id}.png`),
        ...(artwork ? [image(artwork.src)] : []),
        ...getLukeExplorationSources().map(image),
        ...npcAssets,
        ...enemyMapAssets,
    ]);
}

const common = uniqueAssets([
    image(getLukeExplorationSources()[0]),
    ...LOADOUT_UI_ASSETS.map(image),
    ...Object.values(UI_ICON_ASSETS).map(image),
    audio(AssetResolver.sfx("system", "tab-sfx", { extension: "wav" })),
    audio(AssetResolver.sfx("system", "confirm-sfx", { extension: "wav" })),
    audio(AssetResolver.sfx("system", "encounter-sfx", { extension: "wav" })),
    audio(AssetResolver.sfx("system", "typewriter-sfx", { extension: "wav" }))
]);

const title = uniqueAssets([
    image(AssetResolver.titleBackground(TITLE_SCREEN_CONTENT.backgroundId, {
        extension: TITLE_SCREEN_CONTENT.backgroundExtension
    })),
    image(AssetResolver.titleScreen(TITLE_SCREEN_CONTENT.illustrationId, {
        extension: TITLE_SCREEN_CONTENT.illustrationExtension
    })),
]);

const frontForest = uniqueAssets([
    ...mapAssets("front-forest")
]);

const battleCommon = uniqueAssets([
    ...getBattleVfxSources().map(image),
    audio(AssetResolver.sfx("system", "confirm-sfx", { extension: "wav" })),
    audio(AssetResolver.sfx("system", "tab-sfx", { extension: "wav" })),
    ...playerFrames(CHARACTER_DEFINITIONS.luke),
    ...playerFrames(CHARACTER_DEFINITIONS.dummy),
    ...Object.values(SKILL_DEFINITIONS)
        .filter(skill => skill.assetId)
        .map(skill => image(AssetResolver.skillEffect(skill.assetId))),
    ...uniqueAssets(Object.values(BATTLE_BACKGROUNDS).map(background => image(
        AssetResolver.battleBackground(background.id, {
            extension: background.extension
        })
    ))),
    audio(AssetResolver.sfx("weapon", "punch-whoosh", { extension: "wav" })),
    audio(AssetResolver.sfx("weapon", "punch-impact", { extension: "wav" })),
    audio(AssetResolver.sfx("skill", "fireball", { extension: "mp3" })),
    audio(AssetResolver.sfx("skill", "ice-pike", { extension: "wav" })),
    audio(AssetResolver.sfx("skill", "poison", { extension: "wav" })),
    audio(AssetResolver.sfx("skill", "poison-tick", { extension: "wav" })),
    audio(AssetResolver.sfx("action", "guard", { extension: "wav" })),
    audio(AssetResolver.sfx("system", "victory-sfx", { extension: "wav" })),
    audio(AssetResolver.sfx("system", "defeat-sfx", { extension: "wav" }))
]);

const highwaymanBattle = uniqueAssets(enemyFrames(ENEMY_DEFINITIONS.highwayman));

export const ASSET_PRELOAD_GROUPS = Object.freeze({
    [ASSET_PRELOAD_GROUP.COMMON]: Object.freeze(common),
    [ASSET_PRELOAD_GROUP.TITLE]: Object.freeze(title),
    [ASSET_PRELOAD_GROUP.FRONT_FOREST]: Object.freeze(frontForest),
    [ASSET_PRELOAD_GROUP.DEEP_FOREST]: Object.freeze(mapAssets("deep-forest")),
    [ASSET_PRELOAD_GROUP.TOWN_SOUTH]: Object.freeze(mapAssets("town-south")),
    [ASSET_PRELOAD_GROUP.TOWN_NORTH]: Object.freeze(mapAssets("town-north")),
    [ASSET_PRELOAD_GROUP.BATTLE_COMMON]: Object.freeze(battleCommon),
    [ASSET_PRELOAD_GROUP.HIGHWAYMAN_BATTLE]: Object.freeze(highwaymanBattle),
    [ASSET_PRELOAD_GROUP.BOOT_CRITICAL]: Object.freeze(uniqueAssets([
        ...common,
        ...title
    ])),
    [ASSET_PRELOAD_GROUP.NEW_GAME_START]: Object.freeze(uniqueAssets([
        ...frontForest
    ]))
});

for (const [groupName, assets] of Object.entries(ASSET_PRELOAD_GROUPS)) {
    AssetPreloader.registerGroup(groupName, assets);
}

export function getMapPreloadGroup(mapNodeId) {
    return ASSET_PRELOAD_GROUPS[mapNodeId] ? mapNodeId : null;
}
