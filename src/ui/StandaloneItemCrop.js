import {
    EQUIPMENT_DEFINITIONS,
    ITEM_DEFINITIONS
} from "../data/battleContent.js";

import { ITEM_ATLAS_IDS as ITEM_IDS } from "../data/uiIcons.js";

let installed = false;

const ATLAS_ASSETS = Object.freeze({
    item: "./assets/images/item/item.png",
    weapon: "./assets/images/item/weapon.png"
});

const WEAPON_IDS = Object.freeze(
    Object.keys(EQUIPMENT_DEFINITIONS).filter(id => EQUIPMENT_DEFINITIONS[id]?.slot === "weapon")
);

const analysisCache = new Map();
const cropCache = new Map();

function definitionById(itemId) {
    return EQUIPMENT_DEFINITIONS[itemId] || ITEM_DEFINITIONS[itemId] || null;
}

function specificImageSource(definition) {
    return definition?.assetImage
        || definition?.assetPath
        || definition?.image
        || definition?.imageSrc
        || null;
}

function atlasSpecFor(itemId) {
    const definition = definitionById(itemId);
    if (!definition) return null;

    const manual = definition.iconSprite;
    if (manual?.src) {
        return {
            src: manual.src,
            index: Math.max(0, Math.floor(Number(manual.index) || 0)),
            count: Math.max(1, Math.floor(Number(manual.count) || 1)),
            cols: Number(manual.cols) || null,
            rows: Number(manual.rows) || null
        };
    }

    const weaponIndex = WEAPON_IDS.indexOf(itemId);
    if (weaponIndex >= 0) {
        return {
            src: ATLAS_ASSETS.weapon,
            index: weaponIndex,
            count: WEAPON_IDS.length,
            cols: null,
            rows: null
        };
    }

    const itemIndex = ITEM_IDS.indexOf(itemId);
    if (itemIndex >= 0) {
        return {
            src: ATLAS_ASSETS.item,
            index: itemIndex,
            count: ITEM_IDS.length,
            cols: null,
            rows: null
        };
    }

    return null;
}

function inferGrid(width, height, count) {
    const safeCount = Math.max(1, Math.floor(Number(count) || 1));
    let best = { cols: safeCount, rows: 1, score: Number.POSITIVE_INFINITY };

    for (let rows = 1; rows <= safeCount; rows += 1) {
        const cols = Math.ceil(safeCount / rows);
        const unused = cols * rows - safeCount;
        const cellAspect = (width / cols) / Math.max(1, height / rows);
        const score = Math.abs(Math.log(Math.max(0.0001, cellAspect))) + unused * 0.18;
        if (score < best.score) best = { cols, rows, score };
    }

    return { cols: best.cols, rows: best.rows };
}

function mergedSpans(profile, threshold, maxGap) {
    const spans = [];
    let start = -1;
    let lastActive = -1;

    for (let i = 0; i < profile.length; i += 1) {
        if (profile[i] >= threshold) {
            if (start < 0) start = i;
            lastActive = i;
            continue;
        }

        if (start >= 0 && i - lastActive > maxGap) {
            spans.push([start, lastActive]);
            start = -1;
            lastActive = -1;
        }
    }

    if (start >= 0) spans.push([start, lastActive]);
    return spans;
}

function averageCornerColor(data, width, height) {
    const samples = [];
    const size = Math.max(1, Math.floor(Math.min(width, height) * 0.015));
    const corners = [
        [0, 0],
        [Math.max(0, width - size), 0],
        [0, Math.max(0, height - size)],
        [Math.max(0, width - size), Math.max(0, height - size)]
    ];

    for (const [sx, sy] of corners) {
        for (let y = sy; y < Math.min(height, sy + size); y += 1) {
            for (let x = sx; x < Math.min(width, sx + size); x += 1) {
                const offset = (y * width + x) * 4;
                samples.push([data[offset], data[offset + 1], data[offset + 2]]);
            }
        }
    }

    if (!samples.length) return [0, 0, 0];
    const sum = samples.reduce((acc, rgb) => [
        acc[0] + rgb[0],
        acc[1] + rgb[1],
        acc[2] + rgb[2]
    ], [0, 0, 0]);
    return sum.map(value => value / samples.length);
}

function createForegroundMask(imageData, width, height) {
    const data = imageData.data;
    const total = width * height;
    let transparentPixels = 0;

    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 245) transparentPixels += 1;
    }

    const useAlpha = transparentPixels / Math.max(1, total) > 0.01;
    const background = averageCornerColor(data, width, height);
    const mask = new Uint8Array(total);

    for (let pixel = 0; pixel < total; pixel += 1) {
        const offset = pixel * 4;
        const alpha = data[offset + 3];
        if (alpha <= 20) continue;

        if (useAlpha) {
            mask[pixel] = alpha > 32 ? 1 : 0;
            continue;
        }

        const dr = data[offset] - background[0];
        const dg = data[offset + 1] - background[1];
        const db = data[offset + 2] - background[2];
        const distance = Math.sqrt(dr * dr + dg * dg + db * db);
        mask[pixel] = distance > 42 ? 1 : 0;
    }

    return mask;
}

function tightenRegion(mask, width, height, x0, y0, x1, y1) {
    let minX = x1;
    let minY = y1;
    let maxX = x0;
    let maxY = y0;
    let found = false;

    for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y += 1) {
        for (let x = Math.max(0, x0); x <= Math.min(width - 1, x1); x += 1) {
            if (!mask[y * width + x]) continue;
            found = true;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }

    if (!found) return null;
    const objectWidth = maxX - minX + 1;
    const objectHeight = maxY - minY + 1;
    const pad = Math.max(2, Math.round(Math.max(objectWidth, objectHeight) * 0.055));
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const ex = Math.min(width - 1, maxX + pad);
    const ey = Math.min(height - 1, maxY + pad);

    return {
        x: sx,
        y: sy,
        width: ex - sx + 1,
        height: ey - sy + 1
    };
}

function detectRegions(image, imageData) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const mask = createForegroundMask(imageData, width, height);
    const rowProfile = new Uint32Array(height);

    for (let y = 0; y < height; y += 1) {
        let count = 0;
        const rowOffset = y * width;
        for (let x = 0; x < width; x += 1) count += mask[rowOffset + x];
        rowProfile[y] = count;
    }

    const rowThreshold = Math.max(2, Math.round(width * 0.0025));
    const rowGap = Math.max(3, Math.round(height * 0.018));
    const rows = mergedSpans(rowProfile, rowThreshold, rowGap);
    const regions = [];

    for (const [rowStart, rowEnd] of rows) {
        const rowHeight = rowEnd - rowStart + 1;
        const colProfile = new Uint32Array(width);

        for (let x = 0; x < width; x += 1) {
            let count = 0;
            for (let y = rowStart; y <= rowEnd; y += 1) count += mask[y * width + x];
            colProfile[x] = count;
        }

        const colThreshold = Math.max(2, Math.round(rowHeight * 0.008));
        const colGap = Math.max(3, Math.round(width * 0.018));
        const columns = mergedSpans(colProfile, colThreshold, colGap);

        for (const [colStart, colEnd] of columns) {
            const region = tightenRegion(mask, width, height, colStart, rowStart, colEnd, rowEnd);
            if (!region) continue;
            const area = region.width * region.height;
            if (area < width * height * 0.00018) continue;
            regions.push(region);
        }
    }

    regions.sort((a, b) => {
        const rowTolerance = Math.max(4, Math.min(a.height, b.height) * 0.35);
        if (Math.abs(a.y - b.y) > rowTolerance) return a.y - b.y;
        return a.x - b.x;
    });

    return regions;
}

function equalGridRegion(image, spec) {
    const inferred = inferGrid(image.naturalWidth, image.naturalHeight, spec.count);
    const cols = Math.max(1, Math.floor(Number(spec.cols) || inferred.cols));
    const rows = Math.max(1, Math.floor(Number(spec.rows) || inferred.rows));
    const index = Math.max(0, Math.min(Math.floor(Number(spec.index) || 0), cols * rows - 1));
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cellWidth = image.naturalWidth / cols;
    const cellHeight = image.naturalHeight / rows;

    return {
        x: Math.round(col * cellWidth),
        y: Math.round(row * cellHeight),
        width: Math.max(1, Math.round(cellWidth)),
        height: Math.max(1, Math.round(cellHeight))
    };
}

function loadAtlasAnalysis(src) {
    if (analysisCache.has(src)) return analysisCache.get(src);

    const promise = new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                if (!context) throw new Error("Canvas 2D context unavailable");
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const regions = detectRegions(image, imageData);
                resolve({ image, regions });
            } catch (error) {
                reject(error);
            }
        };
        image.onerror = () => reject(new Error(`Unable to load atlas: ${src}`));
        image.src = src;
    });

    analysisCache.set(src, promise);
    return promise;
}

function renderStandaloneCrop(image, region) {
    const outputSize = 192;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");

    context.clearRect(0, 0, outputSize, outputSize);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const safeWidth = Math.max(1, region.width);
    const safeHeight = Math.max(1, region.height);
    const available = outputSize * 0.88;
    const scale = Math.min(available / safeWidth, available / safeHeight);
    const drawWidth = safeWidth * scale;
    const drawHeight = safeHeight * scale;
    const dx = (outputSize - drawWidth) / 2;
    const dy = (outputSize - drawHeight) / 2;

    context.drawImage(
        image,
        region.x,
        region.y,
        region.width,
        region.height,
        dx,
        dy,
        drawWidth,
        drawHeight
    );

    return canvas.toDataURL("image/png");
}

async function cropDataUrl(spec) {
    const key = [spec.src, spec.index, spec.count, spec.cols || "auto", spec.rows || "auto"].join("|");
    if (cropCache.has(key)) return cropCache.get(key);

    const promise = (async () => {
        const analysis = await loadAtlasAnalysis(spec.src);
        const manualGrid = Number(spec.cols) > 0 && Number(spec.rows) > 0;
        let region = null;

        if (manualGrid) {
            region = equalGridRegion(analysis.image, spec);
        } else if (analysis.regions.length > spec.index) {
            region = analysis.regions[spec.index];
        } else {
            region = equalGridRegion(analysis.image, spec);
        }

        return {
            dataUrl: renderStandaloneCrop(analysis.image, region),
            detectedCount: analysis.regions.length
        };
    })();

    cropCache.set(key, promise);
    return promise;
}

function createGeneratedImage(frame, itemId, spec, fallbackSource = null) {
    if (!spec?.src) return false;
    frame.dataset.lxStandaloneCropPending = "true";

    cropDataUrl(spec)
        .then(({ dataUrl, detectedCount }) => {
            if (!frame.isConnected) return;
            if (frame.dataset.itemId !== itemId) return;

            frame.querySelectorAll(
                ":scope > .lx-item-asset-crop, :scope > .lx-item-asset-sheet, :scope > .lx-item-asset-image"
            ).forEach(node => node.remove());

            const image = document.createElement("img");
            image.className = "lx-item-asset-image lx-item-asset-generated";
            image.alt = "";
            image.src = dataUrl;
            frame.prepend(image);
            frame.dataset.hasAsset = "true";
            frame.dataset.assetMode = "standalone-crop";
            frame.dataset.spriteIndex = String(spec.index);
            frame.dataset.detectedSprites = String(detectedCount);
            frame.dataset.lxStandaloneCropDone = "true";
            delete frame.dataset.lxStandaloneCropPending;
        })
        .catch(() => {
            delete frame.dataset.lxStandaloneCropPending;
            if (!frame.isConnected) return;
            if (!fallbackSource || fallbackSource === spec.src) return;
            frame.querySelectorAll(":scope > .lx-item-asset-crop, :scope > .lx-item-asset-sheet").forEach(node => node.remove());
            const image = document.createElement("img");
            image.className = "lx-item-asset-image";
            image.alt = "";
            image.src = fallbackSource;
            frame.prepend(image);
        });

    return true;
}

function decorateFrame(frame) {
    if (!frame || frame.dataset.lxStandaloneCropDone === "true") return;
    if (frame.dataset.lxStandaloneCropPending === "true") return;

    const itemId = frame.dataset.itemId;
    if (!itemId) return;
    const definition = definitionById(itemId);
    if (!definition) return;

    const specific = specificImageSource(definition);
    if (specific) return;

    const spec = atlasSpecFor(itemId);
    if (!spec) return;
    createGeneratedImage(frame, itemId, spec, definition.iconImage || null);
}

function decorate(root) {
    root.querySelectorAll(".lx-item-asset-frame[data-item-id]").forEach(decorateFrame);
}

export function installStandaloneItemCrop() {
    if (installed) return true;
    const root = document.getElementById("map-equipment");
    if (!root) return false;

    installed = true;

    const observer = new MutationObserver(() => decorate(root));
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener("click", () => setTimeout(() => decorate(root), 0));

    decorate(root);
    return true;
}
