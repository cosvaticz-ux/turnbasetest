import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runChecks } from '../scripts/run-checks.mjs';

function fixture(callback) {
    const root = mkdtempSync(join(tmpdir(), 'litania-check-runner-'));
    const put = (path, content) => writeFileSync(join(root, path), content);
    for (const directory of ['src', 'tests', 'scripts']) mkdirSync(join(root, directory));
    put('game.js', ''); put('map-editor.js', '');
    try { callback(root, put); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('CLI stays nonzero after an early failure, executes later tests, and reports invalid source syntax', () => fixture((root, put) => {
    copyFileSync(new URL('../scripts/run-checks.mjs', import.meta.url), join(root, 'scripts/run-checks.mjs'));
    put('src/broken.js', 'export const broken = ;');
    put('tests/a.test.mjs', 'throw new Error("first test failed");');
    put('tests/z.test.mjs', 'import {writeFileSync} from "node:fs"; writeFileSync("later-test-ran", "yes");');
    const result = spawnSync(process.execPath, [join(root, 'scripts/run-checks.mjs')], { encoding: 'utf8', cwd: tmpdir() });
    assert.equal(result.status, 1);
    assert.ok(existsSync(join(root, 'later-test-ran')), 'failure must not short-circuit the suite');
    assert.match(result.stdout, /SYNTAX FAIL src[/\\]broken\.js/);
    assert.match(result.stdout, /first test failed/);
    assert.match(result.stdout, /Tests: 1\/2 files passed; 1 failed\./);
}));

test('test files have isolated globals and a fully green run succeeds', () => fixture((root, put) => {
    put('tests/a.test.mjs', 'globalThis.battleMock = true;');
    put('tests/b.test.mjs', 'import assert from "node:assert/strict"; assert.equal(globalThis.battleMock, undefined);');
    const result = runChecks(root, { write() {} });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.results.length, 2);
}));

test('syntax-only mode catches invalid tests without executing test bodies', () => fixture((root, put) => {
    put('tests/a.test.mjs', 'const invalid = ;');
    put('tests/z.test.mjs', 'throw new Error("must not execute");');
    const result = runChecks(root, { syntaxOnly: true, write() {} });
    assert.equal(result.ok, false);
    assert.equal(result.results.length, 0);
    assert.equal(result.syntax.filter(entry => entry.status !== 0).length, 1, JSON.stringify(result.syntax));
}));

test('an empty test directory cannot silently pass', () => fixture(root => {
    assert.throws(() => runChecks(root, { write() {} }), /No tests found/);
}));
