import { AssetResolver } from "../core/AssetResolver.js";

const playerWalkSheet = (id, fileName) => `${AssetResolver.player(id)}walk/${fileName}`;
const playerIdleSprite = (id, fileName) => `${AssetResolver.player(id)}idle/${fileName}`;

const WALK_SOURCE_FRAME_SIZE = 480;
const WALK_REFERENCE_BODY_HEIGHT = 386;

const makeDirection = (fileName, frames, columns, rows, mirror = false, footAnchorY = 1) => Object.freeze({
    fileName,
    src: playerWalkSheet("luke", fileName),
    frames,
    columns,
    rows,
    mirror,
    renderProfile: Object.freeze({
        sourceFrameWidth: WALK_SOURCE_FRAME_SIZE,
        sourceFrameHeight: WALK_SOURCE_FRAME_SIZE,
        referenceFrameHeight: WALK_SOURCE_FRAME_SIZE,
        renderScale: 1,
        footAnchorX: .5,
        footAnchorY
    })
});

// Idle art was exported on a taller, narrower canvas than the 480px walk
// cells. All idle poses share the south walk frame's body height so changing
// facing cannot resize Luke. Directional walk feet still provide the ground
// anchors, which prevents vertical popping during movement transitions.
const LUKE_IDLE_DIRECTIONS = Object.freeze({
    south: Object.freeze({ frame: 1, mirror: false, idleTop: 1, idleFoot: 711, walkFoot: 435 }),
    southeast: Object.freeze({ frame: 2, mirror: false, idleTop: 6, idleFoot: 711, walkFoot: 429 }),
    east: Object.freeze({ frame: 3, mirror: false, idleTop: 0, idleFoot: 713, walkFoot: 442 }),
    northeast: Object.freeze({ frame: 4, mirror: false, idleTop: 0, idleFoot: 709, walkFoot: 405 }),
    north: Object.freeze({ frame: 5, mirror: false, idleTop: 0, idleFoot: 710, walkFoot: 447 }),
    southwest: Object.freeze({ frame: 2, mirror: true, idleTop: 6, idleFoot: 711, walkFoot: 429 }),
    west: Object.freeze({ frame: 3, mirror: true, idleTop: 0, idleFoot: 713, walkFoot: 442 }),
    northwest: Object.freeze({ frame: 4, mirror: true, idleTop: 0, idleFoot: 709, walkFoot: 405 })
});

export const EXPLORATION_ACTOR_METRICS = Object.freeze({
    width: 110,
    height: 145,
    standardVisualHeight: 112,
    playerBodyHeightRatio: WALK_REFERENCE_BODY_HEIGHT / WALK_SOURCE_FRAME_SIZE,
    followerDistance: 85
});

export const LUKE_EXPLORATION = Object.freeze({
    id: "luke",
    walkFrameDurationMs: 75,
    idle: Object.freeze({
        fileName: "luke-idle2.png",
        src: playerIdleSprite("luke", "luke-idle2.png"),
        frames: 5,
        columns: 5,
        rows: 1,
        sourceFrameWidth: 2172 / 5,
        sourceFrameHeight: 724
    }),
    directions: Object.freeze({
        north: makeDirection("luke-n.png", 9, 3, 3, false, 447 / WALK_SOURCE_FRAME_SIZE),
        northeast: makeDirection("luke-nw.png", 16, 4, 4, true, 405 / WALK_SOURCE_FRAME_SIZE),
        east: makeDirection("luke-w.png", 16, 4, 4, true, 442 / WALK_SOURCE_FRAME_SIZE),
        southeast: makeDirection("luke-sw.png", 9, 3, 3, true, 429 / WALK_SOURCE_FRAME_SIZE),
        south: makeDirection("luke-s.png", 16, 4, 4, false, 435 / WALK_SOURCE_FRAME_SIZE),
        southwest: makeDirection("luke-sw.png", 9, 3, 3, false, 429 / WALK_SOURCE_FRAME_SIZE),
        west: makeDirection("luke-w.png", 16, 4, 4, false, 442 / WALK_SOURCE_FRAME_SIZE),
        northwest: makeDirection("luke-nw.png", 16, 4, 4, false, 405 / WALK_SOURCE_FRAME_SIZE)
    })
});

export function getLukeExplorationDirection(direction = "south") {
    return LUKE_EXPLORATION.directions[direction]
        || LUKE_EXPLORATION.directions.south;
}

export function getLukeExplorationFrameData(direction = "south", frame = 1) {
    const definition = getLukeExplorationDirection(direction);
    const safeFrame = Math.min(definition.frames, Math.max(1, Math.floor(Number(frame) || 1)));
    const index = safeFrame - 1;
    return Object.freeze({
        ...definition,
        frame: safeFrame,
        column: index % definition.columns,
        row: Math.floor(index / definition.columns)
    });
}

export function getLukeExplorationIdleData(direction = "south") {
    const facing = LUKE_IDLE_DIRECTIONS[direction] || LUKE_IDLE_DIRECTIONS.south;
    const index = facing.frame - 1;
    const idleBodyHeight = facing.idleFoot - facing.idleTop;
    return Object.freeze({
        ...LUKE_EXPLORATION.idle,
        frame: facing.frame,
        column: index % LUKE_EXPLORATION.idle.columns,
        row: Math.floor(index / LUKE_EXPLORATION.idle.columns),
        mirror: facing.mirror,
        renderProfile: Object.freeze({
            sourceFrameWidth: LUKE_EXPLORATION.idle.sourceFrameWidth,
            sourceFrameHeight: LUKE_EXPLORATION.idle.sourceFrameHeight,
            referenceFrameHeight: WALK_SOURCE_FRAME_SIZE,
            sourceBodyHeight: idleBodyHeight,
            targetBodyHeight: WALK_REFERENCE_BODY_HEIGHT,
            renderScale: WALK_REFERENCE_BODY_HEIGHT / idleBodyHeight,
            footAnchorX: .5,
            footAnchorY: facing.idleFoot / LUKE_EXPLORATION.idle.sourceFrameHeight,
            targetFootAnchorY: facing.walkFoot / WALK_SOURCE_FRAME_SIZE
        })
    });
}

// Backwards-compatible source accessor. The new walk assets are sprite sheets,
// so every frame in a direction resolves to the same PNG source.
export function getLukeExplorationFrame(direction = "south", frame = 1) {
    return getLukeExplorationFrameData(direction, frame).src;
}

export function getLukeExplorationSources() {
    return [...new Set([
        LUKE_EXPLORATION.idle.src,
        ...Object.values(LUKE_EXPLORATION.directions).map(definition => definition.src)
    ])];
}
