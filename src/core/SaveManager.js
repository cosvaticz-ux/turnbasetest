import { normalizeGameState, SAVE_SCHEMA_VERSION } from "./GameState.js";

export class SaveManager {
    constructor(storage = globalThis.localStorage) {
        this.storage = storage;
        this.namespace = "turn-based-rpg";
        this.windowNamePrefix = "litania-x-save:";
    }

    getKey(slot) {
        return `${this.namespace}:${slot}`;
    }

    writeCookie(slot, serialized) {
        if (!globalThis.document || serialized.length > 3000) return false;
        try {
            globalThis.document.cookie = `${encodeURIComponent(this.getKey(slot))}=${encodeURIComponent(serialized)}; Path=/; Max-Age=31536000; SameSite=Lax`;
            return true;
        } catch {
            return false;
        }
    }

    readCookie(slot) {
        try {
            const key = `${encodeURIComponent(this.getKey(slot))}=`;
            const match = String(globalThis.document?.cookie || "").split(/;\s*/).find(entry => entry.startsWith(key));
            return match ? decodeURIComponent(match.slice(key.length)) : null;
        } catch {
            return null;
        }
    }

    readWindowNameStore() {
        try {
            const value = String(globalThis.name || "");
            if (!value.startsWith(this.windowNamePrefix)) return {};
            const parsed = JSON.parse(value.slice(this.windowNamePrefix.length));
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
            return {};
        }
    }

    writeWindowName(slot, serialized) {
        if (!globalThis.window || globalThis.window !== globalThis) return false;
        try {
            const store = this.readWindowNameStore();
            store[slot] = serialized;
            globalThis.name = this.windowNamePrefix + JSON.stringify(store);
            return true;
        } catch {
            return false;
        }
    }

    readWindowName(slot) {
        return this.readWindowNameStore()[slot] || null;
    }

    save(slot, state) {
        let serialized;
        try {
            const normalized = normalizeGameState(state);
            if (!normalized) return false;
            const serializableState = structuredClone(normalized);
            for (const member of serializableState.party || []) {
                delete member.maxHp;
                delete member.attack;
                delete member.defense;
                delete member.speed;
                delete member.maxAp;
                delete member.derivedStats;
            }
            serialized = JSON.stringify({
                schemaVersion: SAVE_SCHEMA_VERSION,
                savedAt: new Date().toISOString(),
                state: serializableState
            });
        } catch {
            return false;
        }
        let saved = false;
        try {
            if (this.storage) {
                this.storage.setItem(this.getKey(slot), serialized);
                saved = true;
            }
        } catch {
            saved = false;
        }
        const cookieSaved = this.writeCookie(slot, serialized);
        const windowNameSaved = this.writeWindowName(slot, serialized);
        return saved || cookieSaved || windowNameSaved;
    }

    load(slot) {
        let serialized = null;
        try {
            serialized = this.storage?.getItem?.(this.getKey(slot)) || null;
        } catch {
            serialized = null;
        }
        serialized ||= this.readCookie(slot) || this.readWindowName(slot);
        try {
            if (!serialized) return null;
            const parsed = JSON.parse(serialized);
            if (!parsed || typeof parsed !== "object") return null;
            // Backward compatibility: pre-versioned saves stored state directly.
            const rawState = parsed.state && typeof parsed.state === "object" ? parsed.state : parsed;
            const version = Number(parsed.schemaVersion ?? rawState.schemaVersion ?? 0);
            if (version > SAVE_SCHEMA_VERSION) return null;
            return normalizeGameState(rawState);
        } catch {
            return null;
        }
    }

    hasValidSave(slot = "autosave") {
        return Boolean(this.load(slot));
    }

    remove(slot = "autosave") {
        let removed = false;
        try {
            this.storage?.removeItem?.(this.getKey(slot));
            removed = Boolean(this.storage);
        } catch {
            removed = false;
        }
        try {
            if (globalThis.document) {
                globalThis.document.cookie = `${encodeURIComponent(this.getKey(slot))}=; Path=/; Max-Age=0; SameSite=Lax`;
                removed = true;
            }
        } catch {
            // Keep any successful storage removal result.
        }
        try {
            const store = this.readWindowNameStore();
            delete store[slot];
            if (globalThis.window && globalThis.window === globalThis) {
                globalThis.name = this.windowNamePrefix + JSON.stringify(store);
                removed = true;
            }
        } catch {
            // Keep other successful removal results.
        }
        return removed;
    }
}
