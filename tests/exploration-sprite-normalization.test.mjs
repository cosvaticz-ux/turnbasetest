import assert from "node:assert/strict";
import {
    EXPLORATION_ACTOR_METRICS,
    getLukeExplorationFrameData,
    getLukeExplorationIdleData
} from "../src/data/explorationCharacters.js";
import { GreyboxMapRenderer, resolvePlayerFrameRenderMetrics } from "../src/scenes/map/LaneMapRenderer.js";

const DIRECTIONS = ["south", "southeast", "east", "northeast", "north", "southwest", "west", "northwest"];
const FRAME_SIZE = EXPLORATION_ACTOR_METRICS.height;
const renderedIdleBodyHeights = [];

for (const direction of DIRECTIONS) {
    const walk = getLukeExplorationFrameData(direction, 1);
    const idle = getLukeExplorationIdleData(direction);
    const walkMetrics = resolvePlayerFrameRenderMetrics(walk, FRAME_SIZE);
    const idleMetrics = resolvePlayerFrameRenderMetrics(idle, FRAME_SIZE);
    const profile = idle.renderProfile;

    assert.equal(idle.mirror, direction.includes("west"), `${direction} idle uses the expected mirrored pose`);
    assert.equal(walkMetrics.frameWidth, FRAME_SIZE, `${direction} walk remains at its existing render size`);
    assert.equal(walkMetrics.frameHeight, FRAME_SIZE, `${direction} walk remains at its existing render size`);
    assert.ok(idleMetrics.frameWidth < idleMetrics.frameHeight, `${direction} idle preserves its source aspect ratio`);
    assert.equal(profile.targetFootAnchorY, walk.renderProfile.footAnchorY, `${direction} idle targets its walk foot anchor`);
    assert.equal(idleMetrics.imageLeft, -idle.column * idleMetrics.frameWidth, `${direction} clips to only its selected idle cell`);
    assert.equal(idleMetrics.imageTop, -idle.row * idleMetrics.frameHeight, `${direction} clips to only its selected idle row`);

    const renderedIdleFoot = idleMetrics.top + idleMetrics.frameHeight * profile.footAnchorY;
    const renderedWalkFoot = FRAME_SIZE * profile.targetFootAnchorY;
    const renderedIdleBodyHeight = profile.sourceBodyHeight * FRAME_SIZE / 480 * profile.renderScale;
    const renderedWalkReferenceBodyHeight = profile.targetBodyHeight * FRAME_SIZE / 480;
    renderedIdleBodyHeights.push(renderedIdleBodyHeight);
    assert.ok(Math.abs(renderedIdleFoot - renderedWalkFoot) < 1e-9, `${direction} idle and walk foot anchors coincide`);
    assert.ok(Math.abs(renderedIdleBodyHeight - renderedWalkReferenceBodyHeight) < 1e-9, `${direction} idle matches the shared walk body height`);
}

assert.ok(renderedIdleBodyHeights.every(height => Math.abs(height - renderedIdleBodyHeights[0]) < 1e-9),
    "north and every other idle direction render at one consistent body height");

assert.deepEqual(
    DIRECTIONS.map(direction => getLukeExplorationIdleData(direction).frame),
    [1, 2, 3, 4, 5, 2, 3, 4],
    "all eight movement directions map to the five supplied idle poses"
);

const makeElement = tagName => ({
    tagName,
    style: {
        setProperty(name, value, priority = "") {
            this[name] = value;
            this[`${name}Priority`] = priority;
        }
    },
    dataset: {},
    children: [],
    setAttribute() {},
    append(child) { this.children.push(child); },
    appendChild(child) { this.children.push(child); }
});
globalThis.document = { createElement: makeElement };
const renderer = Object.create(GreyboxMapRenderer.prototype);
renderer.root = { append() {} };
const playerNode = renderer.createPlayerActor();
const idle = getLukeExplorationIdleData("south");
const idleMetrics = resolvePlayerFrameRenderMetrics(idle);
renderer.renderPlayerSpriteFrame(idle);

assert.equal(playerNode.children.length, 1, "Luke has one dedicated frame viewport");
assert.equal(renderer.playerFrameViewport.style.overflow, "hidden", "the frame viewport clips neighboring sheet cells");
assert.equal(renderer.playerFrameViewport.style.width, `${idleMetrics.frameWidth}px`);
assert.equal(renderer.playerImage.style.left, `${idleMetrics.imageLeft}px`);
assert.ok(parseFloat(renderer.playerImage.style.width) > parseFloat(renderer.playerFrameViewport.style.width),
    "the full sheet moves behind the one-cell clipping viewport");

console.log("Luke exploration idle normalization passed.");
