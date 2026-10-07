import { getPlaceholderPreset } from "./placeholderPresets.js";

const PARTS = Object.freeze({
    humanoid: ["head", "torso", "pelvis", "arm left", "arm right", "forearm left", "forearm right", "thigh left", "thigh right", "shin left", "shin right", "foot left", "foot right"],
    quadruped: ["torso", "neck", "head", "snout", "ear left", "ear right", "leg front-left", "leg front-right", "leg rear-left", "leg rear-right", "tail"],
    blob: ["body", "eye left", "eye right"],
    spirit: ["body", "face", "wisp left", "wisp right"],
    construct: ["trunk", "head", "branch left", "branch right", "root left", "root right", "crown"]
});

export const PLACEHOLDER_STATES = Object.freeze(["idle", "walk", "move", "attack", "hit", "guard", "death"]);

function appendPart(root, description) {
    const [part, side = ""] = description.split(" ");
    const element = document.createElement("span");
    element.className = `placeholder-part placeholder-${part}${side ? ` is-${side}` : ""}`;
    element.setAttribute("aria-hidden", "true");
    root.appendChild(element);
}

export function createPlaceholderActor({
    entityId, family = null, variant = null, scale = null,
    state = "idle", facing = "east", role = "actor"
} = {}) {
    const preset = getPlaceholderPreset(entityId, {
        placeholderRenderer: family,
        placeholderVariant: variant,
        placeholderScale: scale
    });
    const root = document.createElement("div");
    root.className = `placeholder-actor placeholder-family-${preset.family} placeholder-variant-${preset.variant}`;
    root.dataset.placeholderFamily = preset.family;
    root.dataset.placeholderVariant = preset.variant;
    root.dataset.entityId = entityId || "unknown";
    root.dataset.actorRole = role;
    root.style.setProperty("--placeholder-scale", String(preset.scale));
    root.setAttribute("aria-hidden", "true");
    for (const part of PARTS[preset.family] || PARTS.humanoid) appendPart(root, part);
    setPlaceholderFacing(root, facing);
    setPlaceholderState(root, state);
    return root;
}

export function isPlaceholderActor(element) {
    return Boolean(element?.dataset?.placeholderFamily);
}

export function setPlaceholderState(element, state = "idle") {
    if (!isPlaceholderActor(element)) return false;
    element.dataset.animationState = PLACEHOLDER_STATES.includes(state) ? state : "idle";
    return true;
}

export function setPlaceholderFacing(element, facing = "east") {
    if (!isPlaceholderActor(element)) return false;
    const direction = ["north", "south", "east", "west"].includes(facing) ? facing : "east";
    element.dataset.facing = direction;
    element.style.setProperty("--placeholder-facing", direction === "west" ? "-1" : "1");
    return true;
}

export const getPlaceholderElementCount = family => 1 + (PARTS[family] || PARTS.humanoid).length;
