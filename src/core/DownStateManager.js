export const DEFAULT_DOWN_STATE_CONFIG = Object.freeze({
    maxDownsBeforeRetreat: 3,
    reviveHpRatio: 0.3,
    resetPolicy: "after-battle"
});

export class DownStateManager {
    constructor(config = {}) {
        this.config = Object.freeze({ ...DEFAULT_DOWN_STATE_CONFIG, ...config });
    }

    handleZeroHp(member) {
        if (!member || Number(member.hp) > 0) return { type: "none", downCount: Number(member?.downCount) || 0 };
        member.hp = 0;
        member.downCount = Math.max(0, Math.floor(Number(member.downCount) || 0)) + 1;
        member.isDown = true;
        if (member.downCount >= this.config.maxDownsBeforeRetreat) {
            member.retreated = true;
            return { type: "retreat", downCount: member.downCount, revivedHp: 0 };
        }
        return { type: "down", downCount: member.downCount, revivedHp: 0 };
    }

    revive(member, { hpRatio = this.config.reviveHpRatio } = {}) {
        if (!member || Number(member.hp) > 0 || member.retreated) return false;
        const revivedHp = Math.max(1, Math.ceil(Math.max(1, Number(member.maxHp) || 1) * Math.max(0, Number(hpRatio) || 0)));
        member.hp = Math.min(member.maxHp, revivedHp);
        member.isDown = false;
        return revivedHp;
    }

    resetAfterBattle(member) {
        if (!member || this.config.resetPolicy !== "after-battle") return false;
        member.downCount = 0;
        member.isDown = Number(member.hp) <= 0;
        member.retreated = false;
        return true;
    }
}
