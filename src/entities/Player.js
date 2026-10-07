import { Character } from "./Character.js";

export class Player extends Character {
    constructor(name, maxHp, attack, defense, speed, ap, commandLoadout = {}) {
        super(name, maxHp, attack, defense, speed);
        this.maxAp = ap;
        this.ap = ap;
        this.isGuarding = false;
        this.hasActedThisTurn = false;
        this.secondWindUsed = false;
        this.riposteReady = false;
        this.guardDamageMultiplier = 0.5;
        this.unlockedSkillIds = [...(commandLoadout.unlockedSkillIds || [])];
        this.battleItems = [...(commandLoadout.battleItems || [])];
    }

    resetBattleState() {
        super.resetBattleState();
        this.ap = this.maxAp;
        this.isGuarding = false;
        this.hasActedThisTurn = false;
        this.secondWindUsed = false;
        this.riposteReady = false;
        this.guardDamageMultiplier = 0.5;
    }
}
