import assert from "node:assert/strict";

const allNodes = [];
class MockClassList {
    constructor(owner) {
        this.owner = owner;
        this.values = new Set();
    }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
}

class MockStyle {
    constructor() { this.values = new Map(); }
    setProperty(name, value) { this.values.set(name, String(value)); }
    removeProperty(name) { this.values.delete(name); }
    getPropertyValue(name) { return this.values.get(name) || ""; }
}

class MockElement {
    constructor(tagName = "div", id = "") {
        allNodes.push(this);
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.attributes = new Map();
        this.classList = new MockClassList(this);
        this.style = new MockStyle();
        this.listeners = new Map();
        this.hidden = false;
        this.inert = false;
        this.disabled = false;
        this.textContent = "";
        this.title = "";
        this.src = "";
        this.alt = "";
        this.scrollTop = 0;
        this.scrollHeight = 0;
        this.isContentEditable = false;
    }
    set className(value) {
        this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    }
    get className() { return [...this.classList.values].join(" "); }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }
    appendChild(node) {
        if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(child => child !== node);
        node.parentNode = this;
        this.children.push(node);
        this.scrollHeight = this.children.length;
        return node;
    }
    replaceChildren(...nodes) {
        for (const child of this.children) child.parentNode = null;
        this.children = [];
        this.append(...nodes);
    }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    removeEventListener(type, listener) {
        this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry !== listener));
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    get offsetWidth() { return 100; }
    getBoundingClientRect() {
        if (this.id === "battlefield") return { left: 0, top: 0, width: 1280, height: 720 };
        if (this.classList.contains("character-hud-anchor")) {
            const slot = this.parentNode;
            const camera = elements.get("battle-camera");
            const slotX = Number.parseFloat(slot?.style.getPropertyValue("--slot-x")) || 0;
            const slotY = Number.parseFloat(slot?.style.getPropertyValue("--slot-y")) || 0;
            const anchorX = Number.parseFloat(this.style.getPropertyValue("--hud-anchor-x")) || 50;
            const anchorY = Number.parseFloat(this.style.getPropertyValue("--hud-anchor-y")) || 40;
            const scale = Number.parseFloat(camera?.style.getPropertyValue("--camera-scale")) || 1;
            const panX = Number.parseFloat(camera?.style.getPropertyValue("--camera-x")) || 0;
            const panY = Number.parseFloat(camera?.style.getPropertyValue("--camera-y")) || 0;
            const worldX = slotX * 12.8 + anchorX * 2;
            const worldY = slotY * 7.2 + anchorY * 2;
            return {
                left: (worldX - 640) * scale + 640 + panX * 12.8,
                top: (worldY - 360) * scale + 360 + panY * 7.2,
                width: 1,
                height: 1
            };
        }
        return { left: 0, top: 0, width: 100, height: 60 };
    }
}

const ids = [
    "battle-screen", "battlefield", "battle-camera", "battle-world-background", "battle-hud", "formation-layer", "party-hud-layer", "enemy-hud-layer",
    "battle-menu", "turn-text", "battle-log", "damage-number", "fireball-effect", "icepike-effect",
    "poison-effect", "turn-popup", "turn-popup-text", "command-box", "command-category-title",
    "previous-command-tab", "next-command-tab", "menu-content", "battle-summary", "battle-summary-content", "battle-summary-next",
    "battle-intro-overlay", "status-tooltip", "status-tooltip-title", "status-tooltip-lines"
];
const elements = new Map(ids.map(id => [id, new MockElement("div", id)]));
elements.get("battle-menu").hidden = true;
elements.get("battle-summary").hidden = true;
elements.get("battle-intro-overlay").hidden = true;

const documentEvents = new Map();
const windowEvents = new Map();
function addListener(registry, type, callback) {
    if (!registry.has(type)) registry.set(type, new Set());
    registry.get(type).add(callback);
}
globalThis.addEventListener = (type, callback) => addListener(windowEvents, type, callback);
globalThis.removeEventListener = (type, callback) => windowEvents.get(type)?.delete(callback);
globalThis.document = {
    createElement: tagName => new MockElement(tagName),
    getElementById: id => elements.get(id) || null,
    addEventListener(type, callback) { addListener(documentEvents, type, callback); },
    removeEventListener(type, callback) { documentEvents.get(type)?.delete(callback); }
};

globalThis.Audio = class {
    constructor(src) { this.src = src; this.currentTime = 0; this.volume = 1; this.loop = false; }
    play() { return Promise.resolve(); }
    pause() {}
};

let now = 0;
let nextTimer = 1;
const tasks = new Map();
function schedule(callback, delay, kind) {
    const id = nextTimer++;
    tasks.set(id, { callback, at: now + delay, delay, kind });
    return id;
}
globalThis.setTimeout = (callback, delay = 0) => schedule(callback, delay, "timeout");
globalThis.clearTimeout = id => tasks.delete(id);
globalThis.setInterval = (callback, delay) => schedule(callback, delay, "interval");
globalThis.clearInterval = id => tasks.delete(id);
globalThis.requestAnimationFrame = callback => schedule(callback, 16, "frame");
globalThis.cancelAnimationFrame = id => tasks.delete(id);
globalThis.performance = { now: () => now };
function advance(duration) {
    const end = now + duration;
    let iterations = 0;
    while (true) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        assert.ok(iterations++ < 10000, "timer queue must converge");
        const [id, task] = next;
        now = task.at;
        if (task.kind === "interval") task.at += task.delay;
        else tasks.delete(id);
        task.callback(now);
    }
    now = end;
}
const snapshot = () => JSON.stringify(allNodes.map(node => ({
    classes: [...node.classList.values], style: [...node.style.values], attributes: [...node.attributes],
    dataset: node.dataset, src: node.src, text: node.textContent, hidden: node.hidden,
    children: node.children.map(child => allNodes.indexOf(child))
})));

export { MockElement, elements, documentEvents, windowEvents, tasks, snapshot, advance, now };
