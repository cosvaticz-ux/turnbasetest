import { Character } from "./Character.js";

export class Enemy extends Character {
    constructor(name, maxHp, attack, defense, speed, expReward) {
        super(name, maxHp, attack, defense, speed);
        this.expReward = expReward;
        this.poisonTurns = 0;
        this.poisonDamage = 0;
        this.isGuarding = false;
    }

    resetBattleState() {
        super.resetBattleState();
        this.poisonTurns = 0;
        this.poisonDamage = 0;
        this.isGuarding = false;
    }
}

