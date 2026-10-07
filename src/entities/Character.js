export class Character {
    constructor(name, maxHp, attack, defense, speed) {
        this.name = name;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.attack = attack;
        this.defense = defense;
        this.speed = speed;
        this.statusEffects = [];
    }

    takeDamage(damage) {
        const rawDamage = Number.isFinite(damage) ? damage : 0;
        const finalDamage = Math.max(0, rawDamage - this.defense);
        const appliedDamage = Math.min(this.hp, finalDamage);
        this.hp = Math.max(0, this.hp - appliedDamage);
        console.log(`${this.name} takes ${appliedDamage} damage. HP: ${this.hp}/${this.maxHp}`);
        return appliedDamage;
    }

    isAlive() {
        return this.hp > 0;
    }

    resetBattleState() {
        this.hp = this.maxHp;
        this.statusEffects = [];
    }
}

