import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class MockClassList {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
    toggle(name, force) {
        const enabled = force ?? !this.values.has(name);
        if (enabled) this.values.add(name);
        else this.values.delete(name);
        return enabled;
    }
}

class MockStyle {
    constructor() { this.values = new Map(); }
    setProperty(name, value) { this.values.set(name, String(value)); }
    getPropertyValue(name) { return this.values.get(name) || ""; }
}

class MockElement {
    constructor(tagName = "div", id = "") {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.dataset = {};
        this.attributes = new Map();
        this.classList = new MockClassList();
        this.style = new MockStyle();
        this.listeners = new Map();
        this.disabled = false;
        this.hidden = false;
        this.textContent = "";
        this.src = "";
    }
    set className(value) {
        this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    }
    get className() { return [...this.classList.values].join(" "); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() {
        for (const listener of this.listeners.get("focus") || []) listener({ currentTarget: this });
    }
}

const ids = [
    "title-screen", "title-background", "title-illustration", "title-illustration-placeholder",
    "title-menu", "title-menu-status", "title-game-name", "title-version",
    "game-start-screen", "game-start-status", "game-start-progress",
    "game-start-progress-fill", "game-start-percentage"
];
const elements = new Map(ids.map(id => [id, new MockElement("div", id)]));
elements.get("title-screen").hidden = true;
const studioLabel = new MockElement("header");
const documentListeners = new Map();

globalThis.document = {
    createElement: tagName => new MockElement(tagName),
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector === ".title-studio-label" ? studioLabel : null,
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    removeEventListener(type, listener) {
        if (documentListeners.get(type) === listener) documentListeners.delete(type);
    }
};

globalThis.Audio = class {
    constructor(src) { this.src = src; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
};

let queuedTimers = [];
let nextTimerId = 0;
globalThis.setTimeout = (callback, delay) => {
    const id = ++nextTimerId;
    queuedTimers.push({ callback, delay, id });
    return id;
};
globalThis.clearTimeout = timerId => {
    const timer = queuedTimers.find(entry => entry.id === timerId);
    if (timer) timer.cancelled = true;
};

function runNextTimer() {
    const timer = queuedTimers.shift();
    assert.ok(timer, "expected a queued title transition");
    if (!timer.cancelled) timer.callback();
    return timer.delay;
}

async function settleAsyncWork() {
    for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

let storedSave = null;
let transition = null;
const context = {
    saveManager: { load: () => storedSave },
    gameManager: {
        load() { return Boolean(storedSave); }
    },
    sceneManager: {
        transitionTo(sceneId, options) {
            transition = { sceneId, options };
            return true;
        }
    }
};

const { TitleScene } = await import("../src/scenes/TitleScene.js");

assert.equal(TitleScene.enter(context), true);
assert.equal(elements.get("title-screen").hidden, false);
assert.equal(elements.get("title-game-name").textContent, "LITANIA X");
assert.equal(elements.get("title-version").textContent, "Version : Demo 1");
assert.equal(elements.get("title-menu").children.length, 4);
assert.equal(
    elements.get("title-background").style.getPropertyValue("--title-background-image"),
    'url("./assets/images/background/title/old-city.png")'
);
assert.equal(elements.get("title-illustration").hidden, false, "available title art is displayed");
assert.equal(elements.get("title-illustration").src, "./assets/images/screen/title/goddess-left.png");
assert.equal(TitleScene.getSelectedAction(), "new-game");

const [newGameButton, continueButton] = elements.get("title-menu").children;
assert.equal(continueButton.disabled, true, "Continue is disabled without a valid autosave");

let prevented = false;
assert.equal(TitleScene.handleKeyDown({ key: "ArrowDown", repeat: false, preventDefault() { prevented = true; } }), true);
assert.equal(prevented, true);
assert.equal(TitleScene.getSelectedAction(), "settings", "navigation skips disabled Continue");
assert.equal(TitleScene.handleKeyDown({ key: "Enter", repeat: false, preventDefault() {} }), true);
assert.match(elements.get("title-menu-status").textContent, /later phase/i);

storedSave = { party: [{ id: "luke" }] };
TitleScene.refreshContinueState();
assert.equal(continueButton.disabled, false, "Continue reacts to a valid autosave");
assert.equal(TitleScene.activate("continue"), true);
queuedTimers.sort((a, b) => a.delay - b.delay);
assert.equal(queuedTimers[0].delay, 650, "Continue uses the title-to-map transition delay");
assert.equal(runNextTimer(), 650);
assert.deepEqual(transition, { sceneId: "map", options: { continued: true } });

assert.equal(TitleScene.exit(), true);
transition = null;
queuedTimers = [];
assert.equal(TitleScene.enter(context), true);
const [reenteredNewGameButton] = elements.get("title-menu").children;

assert.equal(TitleScene.activate(reenteredNewGameButton.dataset.titleAction), true);
queuedTimers.sort((a, b) => a.delay - b.delay);
assert.equal(queuedTimers[0].delay, 650, "New Game uses the title-to-map transition delay");
assert.equal(runNextTimer(), 650);
await settleAsyncWork();
assert.equal(elements.get("game-start-screen").hidden, false, "New Game reveals its staged loading screen");
for (let attempt = 0; attempt < 256 && !transition; attempt += 1) {
    await settleAsyncWork();
    if (queuedTimers.length) runNextTimer();
}
assert.deepEqual(transition, { sceneId: "map", options: { fromNewGame: true } });
while (queuedTimers.length) {
    runNextTimer();
    await settleAsyncWork();
}
assert.equal(TitleScene.exit(), true);
assert.equal(elements.get("title-screen").hidden, true);
assert.equal(documentListeners.has("keydown"), false, "Title input detaches outside the scene");

const [html, css, gameStartCss, bootstrap, contentSource] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/gameStart.css", import.meta.url), "utf8"),
    readFile(new URL("../game.js", import.meta.url), "utf8"),
    readFile(new URL("../src/data/titleContent.js", import.meta.url), "utf8")
]);
assert.match(html, /id="title-screen"[\s\S]*id="title-menu"[\s\S]*id="title-version"/, "Title markup is separate from battle markup");
assert.match(css, /#title-screen\s*\{[\s\S]*height:\s*100dvh/, "Title layout fills the viewport");
assert.match(css, /\.title-interface\s*\{[\s\S]*width:\s*min\(44vw,\s*760px\)/, "desktop layout reserves a right-side menu column");
assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*\.title-interface/, "Title layout has a narrow-screen mode");
assert.match(bootstrap, /const initialScene = resolveInitialScene\([\s\S]*loadGroup\(ASSET_PRELOAD_GROUP\.BOOT_CRITICAL\)[\s\S]*gameManager\.start\(initialScene/, "application resolves the initial scene but waits for critical assets before starting it");
assert.match(html, /id="loading-screen"[\s\S]*id="game-start-screen"[\s\S]*id="game-start-progress"[\s\S]*id="game-start-percentage"[\s\S]*id="title-screen"/, "boot fade and real New Game progress UI precede the Title screen");
assert.match(gameStartCss, /\.boot-fade-screen\s*\{[\s\S]*transition:\s*opacity 1800ms ease-out/);
assert.match(gameStartCss, /\.game-start-screen\.is-complete\s*\{/);
assert.match(gameStartCss, /\.game-start-progress-fill\s*\{/, "New Game loading UI has a gothic progress fill");
assert.match(contentSource, /backgroundAssetAvailable:\s*true/, "title background availability is explicitly data-driven");
assert.match(contentSource, /illustrationAssetAvailable:\s*true/, "title illustration availability is explicitly data-driven");

console.log("Title scene: layout, navigation, save state, and transition assertions passed.");
