import { getMapNode, getMapNodeSpawn } from "../data/maps/mapNodeRegistry.js";

function resolveRuntimeMapId(mapNodeId) {
    if (globalThis.LITANIA_RUNTIME_MODE === "demo" && mapNodeId === "mountain-start") {
        return "front-forest";
    }
    return mapNodeId;
}

export class MapNodeManager {
    constructor({ initialMapId = "front-forest", initialSpawnId = null } = {}) {
        this.currentMapId = null;
        this.currentSpawnId = null;
        this.facing = "south";
        this.movementLocked = false;
        this.arrivalWarpId = null;
        this.load(initialMapId, initialSpawnId);
    }

    getCurrentNode() {
        return getMapNode(this.currentMapId);
    }

    getCurrentSpawn() {
        return getMapNodeSpawn(this.currentMapId, this.currentSpawnId);
    }

    load(mapNodeId, spawnId = null, { preserveFacing = false } = {}) {
        const resolvedMapNodeId = resolveRuntimeMapId(mapNodeId);
        const node = getMapNode(resolvedMapNodeId);
        if (!node) return false;
        const resolvedSpawnId = spawnId || node.defaultSpawnId;
        const spawn = getMapNodeSpawn(resolvedMapNodeId, resolvedSpawnId);
        if (!spawn) return false;
        this.currentMapId = node.id;
        this.currentSpawnId = spawn.spawnId;
        if (!preserveFacing && spawn.facing) this.facing = spawn.facing;
        this.arrivalWarpId = spawn.arrivalWarpId || null;
        return true;
    }

    getWarp(warpId) {
        return this.getCurrentNode()?.groups.warps.find(warp => warp.id === warpId) || null;
    }

    canUseWarp(warpId) {
        const warp = this.getWarp(warpId);
        return Boolean(warp
            && warp.active !== false
            && warp.destinationMapId
            && warp.destinationSpawnId
            && !this.movementLocked
            && warp.id !== this.arrivalWarpId);
    }

    releaseArrivalGuard(warpId = null) {
        if (warpId && this.arrivalWarpId !== warpId) return false;
        this.arrivalWarpId = null;
        return true;
    }

    async transitionThrough(warpId, hooks = {}) {
        if (!this.canUseWarp(warpId)) return false;
        const warp = this.getWarp(warpId);
        const previousState = {
            mapId: this.currentMapId,
            spawnId: this.currentSpawnId,
            facing: this.facing
        };
        this.movementLocked = true;
        try {
            await hooks.fadeOut?.();
            if (!this.load(warp.destinationMapId, warp.destinationSpawnId, { preserveFacing: true })) {
                this.load(previousState.mapId, previousState.spawnId);
                this.facing = previousState.facing;
                return false;
            }
            await hooks.load?.(this.getCurrentNode(), this.getCurrentSpawn());
            await hooks.fadeIn?.();
            return true;
        } finally {
            this.movementLocked = false;
        }
    }
}
