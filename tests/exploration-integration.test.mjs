import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    getLukeExplorationFrameData, getLukeExplorationIdleData,
    getLukeExplorationSources, LUKE_EXPLORATION
} from "../src/data/explorationCharacters.js";
import { AssetResolver } from "../src/core/AssetResolver.js";
import { EXPLORATION_MAPS } from "../src/data/explorationMaps.js";
import { MAP_CONTENT } from "../src/data/worldContent.js";

const directions = {
    north: ['luke-n.png', 9, 3, false], northeast: ['luke-nw.png', 16, 4, true],
    east: ['luke-w.png', 16, 4, true], southeast: ['luke-sw.png', 9, 3, true],
    south: ['luke-s.png', 16, 4, false], southwest: ['luke-sw.png', 9, 3, false],
    west: ['luke-w.png', 16, 4, false], northwest: ['luke-nw.png', 16, 4, false]
};

test('Luke preserves current eight-direction sheet, frame, idle and timing contracts', () => {
    assert.equal(LUKE_EXPLORATION.walkFrameDurationMs, 75);
    assert.deepEqual(Object.keys(LUKE_EXPLORATION.directions).sort(), Object.keys(directions).sort());
    for (const [direction, [fileName, frames, columns, mirror]] of Object.entries(directions)) {
        const last = getLukeExplorationFrameData(direction, 999);
        assert.equal(last.fileName, fileName, direction);
        assert.equal(last.frames, frames, direction);
        assert.equal(last.columns, columns, direction);
        assert.equal(last.rows, columns, direction);
        assert.equal(last.frame, frames, direction + ' clamps to final frame');
        assert.equal(last.column, (frames - 1) % columns);
        assert.equal(last.row, Math.floor((frames - 1) / columns));
        assert.equal(last.mirror, mirror, direction);
        assert.equal(getLukeExplorationFrameData(direction, -1).frame, 1);
    }
    for (const [direction, frame, mirror] of [
        ['south', 1, false], ['southeast', 2, false], ['east', 3, false], ['northeast', 4, false],
        ['north', 5, false], ['southwest', 2, true], ['west', 3, true], ['northwest', 4, true]
    ]) {
        const idle = getLukeExplorationIdleData(direction);
        assert.equal(idle.frame, frame, direction);
        assert.equal(idle.mirror, mirror, direction);
        assert.equal(idle.row, 0);
    }
    assert.equal(getLukeExplorationSources().length, 6, 'five walk sheets and one idle sheet, deduplicated');
    assert.equal(new Set(getLukeExplorationSources()).size, 6);
});

test('public map content has no soundtrack assignments', () => {
    for (const content of [...Object.values(MAP_CONTENT), ...Object.values(EXPLORATION_MAPS)]) {
        assert.ok(!('music' in content));
        assert.ok(!('ambience' in content));
    }
});

function png(source) {
    const buffer = readFileSync(new URL('../' + source, import.meta.url));
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', source + ' PNG signature');
    assert.equal(buffer.subarray(-8, -4).toString('ascii'), 'IEND', source + ' complete PNG');
    return buffer;
}

// Actual bytes are checked separately so absent assets never prevent the source
// and audio contracts above from running. Missing files remain failures.
for (const source of getLukeExplorationSources()) {
    test('Luke sheet exists with its authored dimensions: ' + source, () => {
        const definition = source === LUKE_EXPLORATION.idle.src ? LUKE_EXPLORATION.idle
            : Object.values(LUKE_EXPLORATION.directions).find(direction => direction.src === source);
        const buffer = png(source);
        assert.equal(buffer.readUInt32BE(16), source === LUKE_EXPLORATION.idle.src ? 2172 : definition.columns * 480);
        assert.equal(buffer.readUInt32BE(20), source === LUKE_EXPLORATION.idle.src ? 724 : definition.rows * 480);
    });
}

const townNpcs = MAP_CONTENT['town-south'].npcs;
test('catalog NPC dialogue portraits retain the same standing sprite', () => {
    assert.equal(townNpcs.filter(npc => npc.sprite).length, 3);
    for (const npc of townNpcs) assert.equal(npc.dialoguePortrait, npc.sprite, npc.name);
});
const npcSources = [...new Set([
    ...townNpcs.map(npc => npc.sprite),
    ...Object.values(EXPLORATION_MAPS).flatMap(map => map.interactables
        .filter(item => item.type === 'npc')
        .flatMap(item => [AssetResolver.npcSprite(item.assetId || 'town-woman'),
            ...(item.dialoguePortraitAssetId ? [AssetResolver.npcSprite(item.dialoguePortraitAssetId)] : [])]))
].filter(Boolean))];
for (const source of npcSources) {
    test('standing/dialogue NPC asset exists with RGBA data: ' + source, () => {
        assert.equal(png(source)[25], 6, source + ' uses RGBA rather than a baked white background');
    });
}
