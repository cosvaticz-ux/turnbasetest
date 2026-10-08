import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, elements } from './helpers/battle-dom.mjs';
import { GameManager } from '../src/core/GameManager.js';
import { SaveManager } from '../src/core/SaveManager.js';
import { BattleVictoryResolver } from '../src/core/BattleVictoryResolver.js';
import { RewardResolver } from '../src/core/RewardResolver.js';

const { BattleScene, Game, party } = await import('../src/scenes/BattleScene.js');
const origin = { mapId: 'front-forest', x: 800, y: 500 };

function withBattle(callback, { encounterId = 'lane-front-guard', persistent = true, setup = () => {} } = {}) {
    const memory = new Map();
    let blocked = false, writes = 0;
    const saveManager = new SaveManager({
        getItem: key => memory.get(key) || null,
        setItem(key, value) {
            writes++;
            if (blocked) throw new Error('Storage quota exceeded');
            memory.set(key, value);
        }
    });
    // Explicitly unavailable secondary storage makes the quota test deterministic.
    saveManager.writeCookie = () => false;
    saveManager.writeWindowName = () => false;
    const handoffs = [];
    const sceneManager = { services: {}, transitionTo(id, context) { handoffs.push({ id, context }); return true; } };
    const gameManager = new GameManager({ sceneManager, saveManager });
    sceneManager.services.gameManager = gameManager;
    setup(gameManager.globalState);
    assert.equal(gameManager.save(), true);
    BattleScene.enter({ skipIntro: true, sceneManager, encounterId, enemyId: 'highwayman',
        enemyCount: 1, persistEncounterCompletion: persistent,
        mapReturnNodeId: origin.mapId, mapReturnPosition: origin });
    try {
        callback({ gameManager, saveManager, memory, handoffs, combatant: party.find(member => member.id === 'luke'),
            writes: () => writes, blockWrites: value => { blocked = value; } });
    } finally {
        BattleScene.exit();
    }
}

for (const checkpoint of ['victory-result', 'victory-summary', 'defeat-result']) {
    test(`autosave is coherent when interrupted at ${checkpoint}`, () => withBattle(({ combatant, saveManager, writes }) => {
        const result = checkpoint.startsWith('victory') ? 'victory' : 'defeat';
        combatant.hp = result === 'defeat' ? 0 : 23;
        const potion = combatant.battleItems.find(item => item.id === 'healing-draught');
        assert.ok(potion);
        potion.quantity = 0;
        assert.equal(Game.finishBattle(result), true);
        if (checkpoint.endsWith('summary')) {
            advance(1850);
            assert.equal(Game.battleEndPhase, 'summary');
        }
        const loaded = saveManager.load('autosave');
        assert.deepEqual({
            hp: loaded.party.find(member => member.id === 'luke').hp,
            potion: loaded.inventory.find(item => item.id === 'healing-draught').quantity,
            reward: loaded.resolvedBattleRewards.includes('battle-victory:lane-front-guard'),
            completed: loaded.completedEncounters.includes('lane-front-guard'),
            position: loaded.mapPosition
        }, {
            hp: result === 'defeat' ? Math.max(1, Math.ceil(combatant.maxHp * .3)) : 23,
            potion: 0, reward: result === 'victory', completed: result === 'victory', position: origin
        });
        assert.equal(writes(), 2, 'one pre-battle save and one coherent terminal save');
    }));
}

for (const result of ['victory', 'defeat']) {
    test(`${result} checkpoint preserves class/status and the existing after-battle down policy`, () => withBattle(({ combatant, saveManager }) => {
        combatant.poisonTurns = 2; combatant.poisonDamage = 7;
        combatant.classState.selectedElement = 'ice';
        combatant.downCount = 2;
        const fallen = party.find(member => member.id !== combatant.id);
        fallen.hp = 0; fallen.isDown = true; fallen.downCount = 3; fallen.retreated = true;
        Game.finishBattle(result);
        const loaded = saveManager.load('autosave');
        const member = loaded.party.find(member => member.id === combatant.id);
        assert.equal(member.classState.selectedElement, 'ice');
        assert.equal(member.poisonTurns, result === 'victory' ? 2 : 0);
        assert.equal(member.poisonDamage, result === 'victory' ? 7 : 0);
        assert.equal(member.downCount, 0);
        const down = loaded.party.find(member => member.id === fallen.id);
        assert.equal(down.downCount, 0); assert.equal(down.retreated, false);
        assert.equal(down.isDown, result === 'victory');
        assert.equal(down.hp, result === 'victory' ? 0 : Math.ceil(fallen.maxHp * .3));
    }));
}

test('summary and repeated settlement cannot duplicate rewards, overwrite resources or save again', () => withBattle(({ gameManager, saveManager, writes, handoffs }) => {
    Game.finishBattle('victory');
    const settled = structuredClone(gameManager.globalState);
    const durable = saveManager.load('autosave');
    assert.equal(Game.finishBattle('victory'), false);
    assert.equal(Game.commitBattleOutcome(), true);
    advance(1850);
    assert.equal(Game.completeBattleSummary(), true);
    assert.equal(Game.completeBattleSummary(), false);
    assert.deepEqual(gameManager.globalState, settled);
    assert.deepEqual(saveManager.load('autosave'), durable);
    assert.equal(writes(), 2);
    assert.equal(handoffs.length, 1);
    assert.equal(handoffs[0].context.battleResult, 'victory');
}));

test('a reward for a consumed battle item survives both terminal save and map return', () => {
    const resolve = BattleVictoryResolver.prototype.resolve;
    BattleVictoryResolver.prototype.resolve = function(context) {
        const result = resolve.call(this, context);
        if (result.applied) new RewardResolver(this.gameState).apply({ items: [{ id: 'healing-draught', quantity: 2 }] });
        return result;
    };
    try {
        withBattle(({ combatant, saveManager }) => {
            combatant.battleItems.find(item => item.id === 'healing-draught').quantity = 0;
            Game.finishBattle('victory');
            assert.equal(saveManager.load('autosave').inventory.find(item => item.id === 'healing-draught').quantity, 2);
            Game.returnToExploration();
            assert.equal(saveManager.load('autosave').inventory.find(item => item.id === 'healing-draught').quantity, 2);
        });
    } finally { BattleVictoryResolver.prototype.resolve = resolve; }
});

test('failed storage leaves the old checkpoint intact and retries without reapplying rewards', () => withBattle(({ combatant, gameManager, saveManager, memory, blockWrites, writes }) => {
    const key = saveManager.getKey('autosave');
    const previous = memory.get(key);
    combatant.hp = 23;
    combatant.battleItems.find(item => item.id === 'healing-draught').quantity = 0;
    blockWrites(true);
    Game.finishBattle('victory');
    assert.equal(Game.battleOutcomeSaved, false);
    assert.equal(memory.get(key), previous);
    assert.ok(elements.get('battle-log').children.some(node => node.textContent.includes('Autosave failed')));
    const outcome = structuredClone(gameManager.globalState);
    blockWrites(false);
    Game.returnToExploration();
    assert.equal(Game.battleOutcomeSaved, true);
    assert.deepEqual(gameManager.globalState, outcome);
    assert.equal(saveManager.load('autosave').party.find(member => member.id === 'luke').hp, 23);
    assert.equal(writes(), 3, 'pre-battle save, failed terminal write, successful retry');
}));

test('distinct random victories resolve independently without completing a fixed encounter', () => {
    let previous;
    for (const id of ['random-a', 'random-b']) {
        withBattle(({ saveManager }) => {
            Game.finishBattle('victory');
            const loaded = saveManager.load('autosave');
            assert.deepEqual(loaded.completedEncounters, []);
            assert.ok(loaded.resolvedBattleRewards.includes(`battle-victory:${id}`));
            assert.equal(loaded.resolvedBattleRewards.length, id === 'random-a' ? 1 : 2);
            previous = loaded;
        }, { encounterId: id, persistent: false, setup(state) {
            if (previous) Object.assign(state, structuredClone(previous));
        } });
    }
});

test('a reloaded resolved fixed encounter cannot grant its experience twice', () => withBattle(({ saveManager }) => {
    Game.finishBattle('victory');
    const loaded = saveManager.load('autosave');
    assert.equal(loaded.party.find(member => member.id === 'luke').progression.exp, 10);
    assert.deepEqual(loaded.completedEncounters, ['lane-front-guard']);
    assert.deepEqual(loaded.resolvedBattleRewards, ['battle-victory:lane-front-guard']);
}, { setup(state) {
    state.party.find(member => member.id === 'luke').progression.exp = 10;
    state.completedEncounters.push('lane-front-guard');
    state.resolvedBattleRewards.push('battle-victory:lane-front-guard');
} }));
