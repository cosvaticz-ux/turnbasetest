const FAMILY_DEFAULTS = Object.freeze({
    humanoid: Object.freeze({ variant: "normal", scale: 1 }),
    quadruped: Object.freeze({ variant: "wolf", scale: 1 }),
    blob: Object.freeze({ variant: "slime", scale: 0.82 }),
    spirit: Object.freeze({ variant: "ghost", scale: 0.94 }),
    construct: Object.freeze({ variant: "wood", scale: 1.12 })
});

export const PLACEHOLDER_PRESETS = Object.freeze({
    player: Object.freeze({ family: "humanoid", variant: "normal", scale: 1 }),
    npc: Object.freeze({ family: "humanoid", variant: "normal", scale: 0.94 }),
    dummy: Object.freeze({ family: "humanoid", variant: "heavy", scale: 1 }),
    "highland-man": Object.freeze({ family: "humanoid", variant: "heavy", scale: 1.06 }),
    ghoul: Object.freeze({ family: "humanoid", variant: "hunched", scale: 1.02 }),
    "death-archmage": Object.freeze({ family: "humanoid", variant: "thin", scale: 1.08 }),
    "deserting-soldier": Object.freeze({ family: "humanoid", variant: "normal", scale: 1 }),
    "corrupted-adventurer": Object.freeze({ family: "humanoid", variant: "hunched", scale: 1.02 }),
    "male-zombie": Object.freeze({ family: "humanoid", variant: "hunched", scale: 1 }),
    "possessed-knight": Object.freeze({ family: "humanoid", variant: "armored", scale: 1.12 }),
    "grey-wolf": Object.freeze({ family: "quadruped", variant: "wolf", scale: 0.94 }),
    "wild-boar": Object.freeze({ family: "quadruped", variant: "boar", scale: 1.02 }),
    slime: Object.freeze({ family: "blob", variant: "slime", scale: 0.8 }),
    "restless-ghost": Object.freeze({ family: "spirit", variant: "ghost", scale: 0.98 }),
    "willow-wood": Object.freeze({ family: "construct", variant: "wood", scale: 1.14 })
});

export function getPlaceholderPreset(entityId, metadata = {}, fallbackFamily = "humanoid") {
    const authoredFamily = metadata.placeholderRenderer;
    const preset = PLACEHOLDER_PRESETS[entityId] || PLACEHOLDER_PRESETS[metadata.placeholderPreset];
    const family = preset?.family || authoredFamily || fallbackFamily;
    const defaults = FAMILY_DEFAULTS[family] || FAMILY_DEFAULTS.humanoid;
    return Object.freeze({
        family,
        variant: preset?.variant || metadata.placeholderVariant || defaults.variant,
        scale: Number(preset?.scale ?? metadata.placeholderScale ?? defaults.scale) || 1
    });
}

// Visual aliases are deliberately not consulted here. A logical compatibility
// alias must never make one species borrow another species' artwork.
export function resolveActorVisual({ entityId, definition = {}, fallbackFamily = "humanoid" }) {
    const exactAsset = entityId === definition.id && (definition.exactVisualAsset === true
        || definition.metadata?.assetStatus === "exact");
    const assetId = exactAsset && definition.assetId ? definition.assetId : null;
    return assetId
        ? Object.freeze({ type: "asset", assetId })
        : Object.freeze({ type: "placeholder", ...getPlaceholderPreset(entityId, definition.metadata, fallbackFamily) });
}
