import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Run files separately: the existing browser mocks mutate process globals.
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    }).sort();
}

export function runChecks(root = defaultRoot, { syntaxOnly = false, write = value => console.log(value) } = {}) {
    const tests = files(join(root, 'tests')).filter(path => path.endsWith('.test.mjs'));
    if (!tests.length) throw new Error('No tests found; refusing to report success.');
    const candidates = ['src', 'tests', 'scripts'].flatMap(directory => files(join(root, directory)));
    candidates.push(join(root, 'game.js'), join(root, 'map-editor.js'));
    const sources = [...new Set(candidates.filter(path => /\.(?:js|mjs|cjs)$/.test(path)))].sort();
    const run = (path, syntax = false) => {
        const args = syntax ? ['--input-type=' + (path.endsWith('.cjs') ? 'commonjs' : 'module'), '--check'] : [path];
        const result = spawnSync(process.execPath, args, {
            cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
            ...(syntax ? { input: readFileSync(path, 'utf8') } : {})
        });
        return { path: relative(root, path), status: result.error || result.signal ? null : result.status, signal: result.signal,
            error: result.error?.message || null, stdout: result.stdout || '', stderr: result.stderr || '' };
    };
    write(`Node ${process.version}; checking ${sources.length} source/test/script files.`);
    // All .js sources in this repository are ES modules. Explicit module mode
    // also catches malformed exports that Node's ambiguous-.js detection can miss.
    const syntax = sources.map(path => run(path, true));
    for (const result of syntax.filter(result => result.status !== 0)) {
        write(`SYNTAX FAIL ${result.path}\n${result.error || result.stderr || result.signal}`);
    }
    const results = syntaxOnly ? [] : tests.map(path => {
        const result = run(path);
        write(`${result.status === 0 ? 'PASS' : 'FAIL'} ${result.path}`);
        if (result.status !== 0) {
            write([result.error, result.signal, result.stdout, result.stderr].filter(Boolean).join('\n'));
        }
        return result;
    });
    const syntaxFailures = syntax.filter(result => result.status !== 0);
    const failures = results.filter(result => result.status !== 0);
    write(`Syntax: ${sources.length - syntaxFailures.length}/${sources.length} passed.`);
    if (!syntaxOnly) write(`Tests: ${results.length - failures.length}/${results.length} files passed; ${failures.length} failed.`);
    write('Failures stay failures, including missing assets, syntax errors, signals and timeouts.');
    return { syntax, results, ok: !syntaxFailures.length && !failures.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const args = process.argv.slice(2);
        if (args.some(arg => arg !== '--syntax-only')) throw new Error('Usage: node scripts/run-checks.mjs [--syntax-only]');
        process.exitCode = runChecks(defaultRoot, { syntaxOnly: args.includes('--syntax-only') }).ok ? 0 : 1;
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
