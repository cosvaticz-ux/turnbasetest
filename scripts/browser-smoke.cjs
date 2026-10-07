// Optional browser check: requires Playwright and a running local preview server.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const baseUrl = process.env.EXPLORATION_URL || 'http://127.0.0.1:8080/';

(async () => {
    const browser = await chromium.launch({
        headless: true,
        channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined)
    });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        const cancelledMedia = [];
        const requests = [];
        const origin = new URL(baseUrl).origin;
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'warning') errors.push(message.text()); });
        page.on('response', response => {
            if (response.url().startsWith(origin) && response.status() >= 400) errors.push(response.status() + ' ' + response.url());
        });
        page.on('requestfailed', request => {
            if (!request.url().startsWith(origin)) return;
            if (request.failure()?.errorText === 'net::ERR_ABORTED' && request.resourceType() === 'media') {
                cancelledMedia.push(request.url());
            } else errors.push(request.url() + ' ' + request.failure()?.errorText);
        });
        page.on('request', request => requests.push(request.url()));
        // Exercise the shipped system-font fallbacks without external network access.
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.route('https://fonts.gstatic.com/**', route => route.abort());
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !document.getElementById('title-screen').hidden && document.getElementById('loading-screen').hidden);
        assert.equal(await page.locator('[data-title-action="continue"]').isDisabled(), true);
        await page.getByRole('button', { name: 'Setting', exact: true }).click();
        assert.equal(await page.locator('#settings-panel').isVisible(), true);
        assert.equal(await page.locator('#settings-music').count(), 0);
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await page.getByRole('button', { name: 'New Game', exact: true }).click();
        await page.waitForFunction(() => !document.getElementById('map-screen').hidden);
        const inspect = () => page.evaluate(async () => (await import('/src/scenes/MapScene.js')).MapScene.inspectExploration());
        assert.equal((await inspect()).position.mapId, 'front-forest');
        await page.waitForTimeout(500);
        const before = (await inspect()).position;
        await page.keyboard.down('d');
        await page.waitForTimeout(250);
        await page.keyboard.up('d');
        const after = (await inspect()).position;
        assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 0, 'keyboard movement works: ' + JSON.stringify({ before, after }));
        for (const [key, selector] of [['b', '#map-equipment'], ['k', '#map-skill-menu']]) {
            await page.keyboard.press(key);
            assert.equal(await page.locator(selector).isVisible(), true, key + ' opens its field menu');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator(selector).isVisible(), false);
        }
        await page.keyboard.press('F2');
        assert.equal((await inspect()).debug, true);
        await page.keyboard.press('F2');
        assert.equal((await inspect()).debug, false);

        const enter = position => page.evaluate(async resumePosition => {
            const { sceneManager } = await import('/game.js');
            sceneManager.exitCurrent();
            sceneManager.transitionTo('map', { resumePosition });
        }, position);
        const maps = await page.evaluate(async () => Object.keys((await import('/src/data/explorationMaps.js')).EXPLORATION_MAPS));
        for (const mapId of maps) {
            await page.evaluate(async id => {
                const { AssetPreloader } = await import('/src/core/AssetPreloader.js');
                const result = await AssetPreloader.loadGroup(id);
                if (result.failed) throw Error('Map preload failure: ' + id);
            }, mapId);
            await enter({ mapId });
            assert.equal((await inspect()).position.mapId, mapId);
        }
        // Place the player inside the real authored triggers; the normal update
        // loop must perform all six transitions and produce walkable arrivals.
        const exits = await page.evaluate(async () => {
            const { EXPLORATION_MAPS } = await import('/src/data/explorationMaps.js');
            const { getExplorationExits } = await import('/src/data/greyboxWarpCalibration.js');
            return Object.values(EXPLORATION_MAPS).flatMap(map => getExplorationExits(map).map(exit => ({
                mapId: map.id, targetMap: exit.targetMap,
                x: exit.polygon.reduce((sum, point) => sum + point.x, 0) / exit.polygon.length,
                y: exit.polygon.reduce((sum, point) => sum + point.y, 0) / exit.polygon.length
            })));
        });
        assert.equal(exits.length, 6);
        for (const exit of exits) {
            await enter(exit);
            await page.waitForFunction(async targetMap => {
                const inspection = (await import('/src/scenes/MapScene.js')).MapScene.inspectExploration();
                return inspection.position.mapId === targetMap && !inspection.transition;
            }, exit.targetMap);
            assert.equal(await page.evaluate(async () => {
                const position = (await import('/src/scenes/MapScene.js')).MapScene.inspectExploration().position;
                const map = (await import('/src/data/explorationMaps.js')).EXPLORATION_MAPS[position.mapId];
                const { getTraversalPolygons } = await import('/src/data/greyboxWarpCalibration.js');
                return (await import('/src/core/WalkableGeometry.js')).isWalkable(position, getTraversalPolygons(map), map.blockedPolygons);
            }), true, exit.mapId + ' arrival is walkable');
        }
        await enter({ mapId: 'front-forest', x: 890, y: 430 });
        await page.waitForFunction(async () => (await import('/game.js')).sceneManager.currentSceneId === 'battle');
        await page.locator('#battle-screen').waitFor({ state: 'visible' });
        await page.waitForFunction(async () => {
            const { Game } = await import('/src/scenes/BattleScene.js');
            return Game.battleStatus === 'active' && !Game.battleIntroActive;
        });
        assert.equal(await page.locator('#battle-screen').isVisible(), true);
        // Use the existing outcome API to check settlement and return integration.
        // Combat formulas, actions and reward idempotence are covered by Node tests.
        await page.evaluate(async () => {
            const { Game } = await import('/src/scenes/BattleScene.js');
            Game.finishBattle('escape');
            Game.returnToExploration();
        });
        await page.waitForFunction(() => !document.getElementById('map-screen').hidden);
        assert.equal((await inspect()).position.mapId, 'front-forest');
        await page.evaluate(async () => (await import('/game.js')).sceneManager.transitionTo('title'));
        assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), false);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.waitForFunction(() => !document.getElementById('map-screen').hidden);

        const audio = await page.evaluate(async () => {
            const { AudioManager } = await import('/src/core/AudioManager.js');
            return Promise.all([...new Set([...Object.values(AudioManager.sfx).map(sound => sound.src), ...Object.values(AudioManager.eventPaths)]
                .map(src => new URL(src, document.baseURI).href))]
                .map(src => new Promise(resolve => {
                    const sound = new Audio(src);
                    sound.preload = 'auto';
                    const timeout = setTimeout(() => resolve({ src, ok: false }), 10000);
                    const finish = ok => { clearTimeout(timeout); resolve({ src, ok, duration: sound.duration }); };
                    sound.addEventListener('loadeddata', () => finish(sound.duration > 0), { once: true });
                    sound.addEventListener('error', () => finish(false), { once: true });
                    sound.load();
                })));
        });
        assert.equal(audio.length, 13);
        assert.ok(audio.every(sound => sound.ok), 'all gameplay SFX decode in the browser');
        assert.ok(cancelledMedia.every(src => audio.some(sound => sound.src === src && sound.ok)),
            'cancelled preload/playback requests have independently verified audio resources');
        assert.ok(!requests.some(url => /\/audio\/music\/|-(?:theme|ambience)\./i.test(url)), 'no removed background audio requests');
        assert.deepEqual(errors, [], 'no game warnings, page errors, failed requests or missing resources');
        console.log('Browser PASS: title/settings, New Game, movement, field menus, four maps, six real warps, battle entry/escape/return, save/Continue, and thirteen decoded SFX. External fonts blocked to verify fallbacks.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
