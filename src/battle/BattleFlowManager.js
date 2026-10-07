export const BATTLE_PHASE = Object.freeze({
    PREPARE: "prepare",
    PLAYER: "player",
    ENEMY: "enemy",
    PHASE_TRANSITION: "phase-transition",
    VICTORY: "victory",
    DEFEAT: "defeat"
});

const TERMINAL_PHASES = new Set([BATTLE_PHASE.VICTORY, BATTLE_PHASE.DEFEAT]);

export class BattleFlowManager {
    constructor() {
        this.phase = BATTLE_PHASE.PHASE_TRANSITION;
        this.prepareCompleted = false;
    }

    start({ prepare = false } = {}) {
        this.prepareCompleted = !prepare;
        this.phase = prepare ? BATTLE_PHASE.PREPARE : BATTLE_PHASE.PLAYER;
        return this.phase;
    }

    transition(phase) {
        if (!Object.values(BATTLE_PHASE).includes(phase) || this.isTerminal()) return false;
        if (phase === BATTLE_PHASE.PREPARE && this.prepareCompleted) return false;
        this.phase = phase;
        if (phase !== BATTLE_PHASE.PREPARE) this.prepareCompleted = true;
        return true;
    }

    completePreparation() {
        if (this.phase !== BATTLE_PHASE.PREPARE || this.isTerminal()) return false;
        this.prepareCompleted = true;
        this.phase = BATTLE_PHASE.PLAYER;
        return true;
    }

    finish(result) {
        if (this.isTerminal()) return false;
        this.phase = result === "victory" ? BATTLE_PHASE.VICTORY : BATTLE_PHASE.DEFEAT;
        return true;
    }

    canAcceptPlayerInput() {
        return this.phase === BATTLE_PHASE.PLAYER || this.phase === BATTLE_PHASE.PREPARE;
    }

    isTerminal() {
        return TERMINAL_PHASES.has(this.phase);
    }

    reopenPreparation({ enabled = false } = {}) {
        if (!enabled || this.isTerminal() || this.phase === BATTLE_PHASE.PREPARE) return false;
        this.prepareCompleted = false;
        this.phase = BATTLE_PHASE.PREPARE;
        return true;
    }
}
