const ASSET_ROOT = "./assets";

export function normalizeAssetId(value) {
    if (typeof value !== "string") return "";
    return value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

function normalizeExtension(extension, fallback) {
    const normalized = String(extension || fallback).trim().replace(/^\.+/, "").toLowerCase();
    return /^[a-z0-9]+$/.test(normalized) ? normalized : fallback;
}

function resolveIdPath(id, createPath, fallback = null) {
    const normalizedId = normalizeAssetId(id);
    return normalizedId ? createPath(normalizedId) : fallback;
}

function frameName(actionId, frame, extension) {
    const safeFrame = Math.max(1, Number.isFinite(frame) ? Math.floor(frame) : 1);
    return `${actionId}_${String(safeFrame).padStart(2, "0")}.${extension}`;
}

export const AssetResolver = Object.freeze({
    map(relativePath, { fallback = null } = {}) {
        const safePath = String(relativePath || "")
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");
        if (!safePath || safePath.includes("..") || !/^[a-zA-Z0-9_ %./-]+$/.test(safePath)) return fallback;
        return `${ASSET_ROOT}/images/map/${safePath}`;
    },

    player(id, { fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/character/player/${assetId}/`, fallback);
    },

    playerFrame(id, action = "idle", frame = 1, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => {
            const actionId = normalizeAssetId(action) || "idle";
            const fileExtension = normalizeExtension(extension, "png");
            return `${ASSET_ROOT}/images/character/player/${assetId}/${actionId}/${frameName(actionId, frame, fileExtension)}`;
        }, fallback);
    },

    playerWalkFrame(id, direction = "front", frame = 1, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => {
            const directionId = normalizeAssetId(direction) || "front";
            const safeFrame = Math.max(1, Number.isFinite(frame) ? Math.floor(frame) : 1);
            const fileExtension = normalizeExtension(extension, "png");
            return `${ASSET_ROOT}/images/character/player/${assetId}/walk/${assetId}-walk${directionId}${safeFrame}.${fileExtension}`;
        }, fallback);
    },

    playerProfile(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => (
            `${ASSET_ROOT}/images/character/player/${assetId}/profile/${assetId}-profile.${normalizeExtension(extension, "png")}`
        ), fallback);
    },

    npcSprite(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => (
            `${ASSET_ROOT}/images/character/npc/${assetId}.${normalizeExtension(extension, "png")}`
        ), fallback);
    },

    playerPortrait(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/character/player/${assetId}/portrait.${normalizeExtension(extension, "png")}`, fallback);
    },

    enemy(id, { fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/character/enemies/${assetId}/`, fallback);
    },

    enemySprite(id, pose = "idle", { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => {
            const poseId = normalizeAssetId(pose) || "idle";
            return `${ASSET_ROOT}/images/character/enemies/${assetId}/${poseId}.${normalizeExtension(extension, "png")}`;
        }, fallback);
    },

    enemyMapSprite(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => (
            `${ASSET_ROOT}/images/character/enemies/${assetId}/${assetId}-map.${normalizeExtension(extension, "png")}`
        ), fallback);
    },

    enemyAnimationFrame(id, action = "idle", frame = 1, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => {
            const actionId = normalizeAssetId(action) || "idle";
            const safeFrame = Math.max(1, Number.isFinite(frame) ? Math.floor(frame) : 1);
            const fileExtension = normalizeExtension(extension, "png");
            return `${ASSET_ROOT}/images/character/enemies/${assetId}/${assetId}-${actionId}${safeFrame}.${fileExtension}`;
        }, fallback);
    },

    enemyAnimationFramePattern(id, frame = 1, {
        folder = "",
        prefix = "",
        padding = 2,
        extension = "png",
        fallback = null
    } = {}) {
        return resolveIdPath(id, assetId => {
            const folderId = normalizeAssetId(folder);
            const safePrefix = String(prefix || `${assetId}-`)
                .trim()
                .replace(/[^a-zA-Z0-9_-]+/g, "");
            const safeFrame = Math.max(1, Number.isFinite(frame) ? Math.floor(frame) : 1);
            const safePadding = Math.max(1, Math.min(4, Number.isFinite(padding) ? Math.floor(padding) : 2));
            const frameToken = String(safeFrame).padStart(safePadding, "0");
            const fileExtension = normalizeExtension(extension, "png");
            const folderPath = folderId ? `${folderId}/` : "";
            return `${ASSET_ROOT}/images/character/enemies/${assetId}/${folderPath}${safePrefix}${frameToken}.${fileExtension}`;
        }, fallback);
    },

    enemyPortrait(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/character/enemies/${assetId}/portrait.${normalizeExtension(extension, "png")}`, fallback);
    },

    skill(id, { fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/skill/${assetId}/`, fallback);
    },

    skillEffect(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/skill/${assetId}/effect.${normalizeExtension(extension, "png")}`, fallback);
    },

    status(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/ui/status/${assetId}.${normalizeExtension(extension, "png")}`, fallback);
    },

    battleBackground(id, { extension = "jpg", fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/background/battle/${assetId}.${normalizeExtension(extension, "jpg")}`, fallback);
    },

    titleBackground(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/background/title/${assetId}.${normalizeExtension(extension, "png")}`, fallback);
    },

    titleScreen(id, { extension = "png", fallback = null } = {}) {
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/screen/title/${assetId}.${normalizeExtension(extension, "png")}`, fallback);
    },

    effect(category, id, { extension = "png", fallback = null } = {}) {
        const categoryId = normalizeAssetId(category);
        if (!categoryId) return fallback;
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/images/effect/${categoryId}/${assetId}.${normalizeExtension(extension, "png")}`, fallback);
    },

    sfx(category, id, { extension = "ogg", fallback = null } = {}) {
        const categoryId = normalizeAssetId(category);
        if (!categoryId) return fallback;
        return resolveIdPath(id, assetId => `${ASSET_ROOT}/audio/sfx/${categoryId}/${assetId}.${normalizeExtension(extension, "ogg")}`, fallback);
    }
});
