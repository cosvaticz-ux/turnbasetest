export class TurnManager {
    constructor({ playerSide = "player", enemySide = "enemy" } = {}) {
        this.playerSide = playerSide;
        this.enemySide = enemySide;
        this.reset();
    }

    reset() {
        this.currentSide = this.playerSide;
        this.activePlayerIndex = 0;
        this.enemyActionQueue = [];
        this.enemyActionIndex = 0;
        this.turnCounter = 1;
    }

    beginEnemySide(enemyIds) {
        this.currentSide = this.enemySide;
        this.enemyActionQueue = [...enemyIds];
        this.enemyActionIndex = 0;
    }

    advanceEnemyAction() {
        this.enemyActionIndex += 1;
        return this.enemyActionIndex < this.enemyActionQueue.length;
    }

    beginPlayerSide(firstLivingIndex) {
        this.resumePlayerSide(firstLivingIndex);
        this.turnCounter += 1;
    }

    resumePlayerSide(firstLivingIndex) {
        this.currentSide = this.playerSide;
        this.activePlayerIndex = firstLivingIndex;
        this.enemyActionQueue = [];
        this.enemyActionIndex = 0;
    }

    endBattle(endedSide = "ended") {
        this.currentSide = endedSide;
        this.enemyActionQueue = [];
        this.enemyActionIndex = 0;
    }
}
