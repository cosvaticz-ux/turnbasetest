import { getLivingEntities } from "./BattleFormation.js";

export class BattleManager {
    constructor({ party = [], enemies = [], activeStatus = "active", finishedStatus = "finished" } = {}) {
        this.party = party;
        this.enemies = enemies;
        this.activeStatus = activeStatus;
        this.finishedStatus = finishedStatus;
        this.token = 0;
        this.status = activeStatus;
        this.result = null;
    }

    start() {
        this.token += 1;
        this.status = this.activeStatus;
        this.result = null;
        return this.token;
    }

    finish(result) {
        if (this.status !== this.activeStatus) return false;
        this.status = this.finishedStatus;
        this.result = result;
        return true;
    }

    getLivingParty() {
        return getLivingEntities(this.party);
    }

    getLivingEnemies() {
        return getLivingEntities(this.enemies);
    }

    isActive() {
        return this.status === this.activeStatus
            && this.getLivingParty().length > 0
            && this.getLivingEnemies().length > 0;
    }

    getOutcome() {
        if (this.getLivingEnemies().length === 0) return "victory";
        if (this.getLivingParty().length === 0) return "defeat";
        return null;
    }
}
