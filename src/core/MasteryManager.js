import { PartyManager } from "./PartyManager.js";
import { CLASS_BALANCE } from "../data/classSkills.js";
import { getSkillTier, ensureClassState } from "./ClassSystem.js";

export const MASTERY_THRESHOLDS = Object.freeze(CLASS_BALANCE.weaponThresholds);

export class MasteryManager {
    constructor(gameState) {
        this.gameState = gameState;
        if (!this.gameState.masteryLedger) this.gameState.masteryLedger = {};
    }

    getProgress(memberId, discipline) {
        const member = new PartyManager(this.gameState).get(memberId);
        return Math.max(0, Number(member?.mastery?.[discipline]) || 0);
    }

    getLevel(memberId, discipline) {
        const progress = this.getProgress(memberId, discipline);
        return MASTERY_THRESHOLDS.reduce((level, threshold, index) => (
            progress >= threshold ? index + 1 : level
        ), 1);
    }

    canGainFromEncounter(memberId, discipline, encounterId = "unknown", { trivial = false } = {}) {
        if (!new PartyManager(this.gameState).get(memberId) || !discipline || trivial) return false;
        return !this.gameState.masteryLedger[`${memberId}:${discipline}:${encounterId}`];
    }

    grant(memberId, discipline, amount = 1) {
        const member = new PartyManager(this.gameState).get(memberId);
        if (!member || !discipline) return 0;
        const gained = Math.max(0, Number(amount) || 0);
        if (!gained) return 0;
        if (!member.mastery) member.mastery = {};
        member.mastery[discipline] = this.getProgress(memberId, discipline) + gained;
        if (discipline.startsWith("technique:")) {
            const id = discipline.slice(10), state = ensureClassState(member);
            if (state.ownedSkills.includes(id)) state.skillMastery[id] = getSkillTier(member,id);
        }
        return gained;
    }

    recordUse(memberId, discipline, { encounterId = "unknown", amount = 1, trivial = false } = {}) {
        if (!this.canGainFromEncounter(memberId, discipline, encounterId, { trivial })) return 0;
        const ledgerKey = `${memberId}:${discipline}:${encounterId}`;
        this.gameState.masteryLedger[ledgerKey] = true;
        return this.grant(memberId, discipline, Math.min(1, Math.max(0, Number(amount) || 0)));
    }

    recordMeaningfulUse(memberId, discipline, options = {}) {
        return this.recordUse(memberId, discipline, options);
    }
}
