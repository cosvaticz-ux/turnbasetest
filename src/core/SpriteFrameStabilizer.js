import { AssetPreloader } from "./AssetPreloader.js";

const metricCache = new Map();
const profileCache = new Map();
const ALPHA_THRESHOLD = 24;
const MAX_MEASUREMENT_SIZE = 256;

function loadImage(src) {
    const cachedImage = AssetPreloader.getCachedAsset(src);
    if (cachedImage) return Promise.resolve(cachedImage);
    return AssetPreloader.loadAsset({ type: "image", src }).then(result => {
        if (result.status === "loaded" && result.asset) return result.asset;
        throw result.error || new Error(`Unable to measure sprite frame: ${src}`);
    });
}

async function measureFrame(src) {
    if (metricCache.has(src)) return metricCache.get(src);

    const promise = loadImage(src).then(image => {
        const width = Math.max(1, image.naturalWidth || image.width || 1);
        const height = Math.max(1, image.naturalHeight || image.height || 1);
        const measurementScale = Math.min(1, MAX_MEASUREMENT_SIZE / Math.max(width, height));
        const measurementWidth = Math.max(1, Math.round(width * measurementScale));
        const measurementHeight = Math.max(1, Math.round(height * measurementScale));
        const canvas = document.createElement("canvas");
        canvas.width = measurementWidth;
        canvas.height = measurementHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return { width, height, anchorX: width / 2, anchorY: height };

        context.clearRect(0, 0, measurementWidth, measurementHeight);
        context.drawImage(image, 0, 0, measurementWidth, measurementHeight);
        const pixels = context.getImageData(0, 0, measurementWidth, measurementHeight).data;

        let minY = measurementHeight;
        let maxY = -1;
        for (let y = 0; y < measurementHeight; y += 1) {
            for (let x = 0; x < measurementWidth; x += 1) {
                const alpha = pixels[(y * measurementWidth + x) * 4 + 3];
                if (alpha <= ALPHA_THRESHOLD) continue;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxY < 0) return { width, height, anchorX: width / 2, anchorY: height };

        const silhouetteHeight = Math.max(1, maxY - minY + 1);
        const lowerBandStart = Math.max(minY, Math.floor(maxY - silhouetteHeight * 0.16));
        let weightedX = 0;
        let weight = 0;

        for (let y = lowerBandStart; y <= maxY; y += 1) {
            for (let x = 0; x < measurementWidth; x += 1) {
                const alpha = pixels[(y * measurementWidth + x) * 4 + 3];
                if (alpha <= ALPHA_THRESHOLD) continue;
                weightedX += x * alpha;
                weight += alpha;
            }
        }

        return {
            width,
            height,
            anchorX: (weight > 0 ? weightedX / weight : measurementWidth / 2)
                * (width / measurementWidth),
            anchorY: maxY * (height / measurementHeight)
        };
    }).catch(() => null);

    metricCache.set(src, promise);
    return promise;
}

function profileKey(sources) {
    return sources.join("|");
}

export async function buildFrameStabilizationProfile(sources = []) {
    const safeSources = sources.filter(Boolean);
    if (!safeSources.length) return [];
    const key = profileKey(safeSources);
    if (profileCache.has(key)) return profileCache.get(key);

    const promise = Promise.all(safeSources.map(measureFrame)).then(metrics => {
        const reference = metrics.find(Boolean);
        if (!reference) return safeSources.map(() => null);

        return metrics.map(metric => {
            if (!metric) return null;
            return {
                naturalWidth: metric.width,
                naturalHeight: metric.height,
                deltaX: reference.anchorX - metric.anchorX,
                deltaY: reference.anchorY - metric.anchorY
            };
        });
    });

    profileCache.set(key, promise);
    return promise;
}

export function applyFrameStabilization(sprite, correction, { maxOffset = 8 } = {}) {
    if (!sprite) return false;
    if (!correction) {
        sprite.style.setProperty("--frame-offset-x", "0px");
        sprite.style.setProperty("--frame-offset-y", "0px");
        return false;
    }

    const boxWidth = Math.max(1, sprite.clientWidth || sprite.getBoundingClientRect?.().width || 1);
    const boxHeight = Math.max(1, sprite.clientHeight || sprite.getBoundingClientRect?.().height || 1);
    const scale = Math.min(
        boxWidth / Math.max(1, correction.naturalWidth),
        boxHeight / Math.max(1, correction.naturalHeight)
    );

    const clamp = value => Math.max(-maxOffset, Math.min(maxOffset, value));
    const offsetX = clamp(correction.deltaX * scale);
    const offsetY = clamp(correction.deltaY * scale);

    sprite.style.setProperty("--frame-offset-x", `${offsetX.toFixed(2)}px`);
    sprite.style.setProperty("--frame-offset-y", `${offsetY.toFixed(2)}px`);
    return true;
}

export function copyFrameStabilization(source, destination) {
    if (!source || !destination) return false;
    destination.style.setProperty(
        "--frame-offset-x",
        source.style.getPropertyValue("--frame-offset-x") || "0px"
    );
    destination.style.setProperty(
        "--frame-offset-y",
        source.style.getPropertyValue("--frame-offset-y") || "0px"
    );
    return true;
}
