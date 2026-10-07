export const THREAT_STATE = Object.freeze({ INACTIVE: "inactive", ACTIVE: "active", ESCAPED: "escaped" });

export class StoryThreatManager {
    constructor(gameState) {
        if (!gameState || typeof gameState !== "object") throw new TypeError("StoryThreatManager requires game state.");
        this.gameState = gameState;
        if (!this.gameState.storyThreats) this.gameState.storyThreats = {};
    }

    get(threatId) {
        return this.gameState.storyThreats[threatId] || null;
    }

    activate(threatId, state = {}) {
        if (!threatId) return false;
        const current = this.get(threatId) || {};
        this.gameState.storyThreats[threatId] = {
            ...current,
            ...state,
            id: threatId,
            state: THREAT_STATE.ACTIVE,
            encounters: Math.max(0, Number(current.encounters) || 0)
        };
        return true;
    }

    deactivate(threatId, reason = "escaped") {
        const threat = this.get(threatId);
        if (!threat) return false;
        threat.state = reason === "escaped" ? THREAT_STATE.ESCAPED : THREAT_STATE.INACTIVE;
        threat.deactivationReason = reason;
        return true;
    }

    isActive(threatId) {
        return this.get(threatId)?.state === THREAT_STATE.ACTIVE;
    }

    recordDetection(threatId, position = null) {
        const threat = this.get(threatId);
        if (!threat || !this.isActive(threatId)) return false;
        threat.encounters = Math.max(0, Number(threat.encounters) || 0) + 1;
        if (position) threat.lastKnownPosition = { x: Number(position.x) || 0, y: Number(position.y) || 0 };
        return true;
    }
}
