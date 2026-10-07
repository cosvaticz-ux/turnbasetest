export function freezeContent(value) {
    if (value && typeof value === "object") {
        for (const child of Object.values(value)) freezeContent(child);
        Object.freeze(value);
    }
    return value;
}

// Build from entries so duplicate IDs are rejected before object keys can overwrite them.
export function createContentRegistry(entries, kind) {
    const registry = Object.create(null);
    for (const entry of entries) {
        if (!entry || typeof entry.id !== "string" || !entry.id.trim()) {
            throw new TypeError(`${kind}: a nonempty id is required`);
        }
        if (Object.hasOwn(registry, entry.id)) throw new Error(`${kind}: duplicate id ${entry.id}`);
        registry[entry.id] = freezeContent(entry);
    }
    return Object.freeze(registry);
}

export function requireContent(registry, id, kind) {
    if (!Object.hasOwn(registry, id)) throw new RangeError(`Unknown ${kind} id: ${String(id)}`);
    return registry[id];
}
