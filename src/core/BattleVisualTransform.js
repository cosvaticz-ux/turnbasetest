function resolveScale(value) {
    const scale = Number(value);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function resolveOffset(value) {
    const offset = Number(value);
    return Number.isFinite(offset) ? offset : 0;
}

export function resolveBattleVisualTransform(entity, animation) {
    const characterVisual = entity?.battleVisual || {};
    const animationVisual = animation?.visual || {};
    return {
        scale: resolveScale(characterVisual.scale) * resolveScale(animationVisual.scale),
        offsetX: resolveOffset(characterVisual.offsetX) + resolveOffset(animationVisual.offsetX),
        offsetY: resolveOffset(characterVisual.offsetY) + resolveOffset(animationVisual.offsetY)
    };
}
