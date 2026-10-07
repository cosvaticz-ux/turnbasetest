import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialGameState } from "../src/core/GameState.js";
import { createMapSkillMenu } from "../src/scenes/map/MapSkillMenu.js";

class ElementMock {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.hidden = true;
    this.children = [];
    this.dataset = {};
    this.listeners = {};
    this.attributes = {};
    this.style = {};
    this.textContent = "";
    this.className = "";
  }
  replaceChildren(...nodes) { this.children = nodes; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  click() { this.listeners.click?.(); }
  querySelectorAll(selector) {
    if (selector === "[data-skill-category]") return this.children.filter((child) => child.dataset.skillCategory);
    return [];
  }
}

globalThis.document = {
  createElement: (tagName) => new ElementMock(tagName),
  createElementNS: (_namespace, tagName) => new ElementMock(tagName),
};

function makeElements() {
  const elements = {
    skillMenu: new ElementMock(), skillClose: new ElementMock(),
    skillCategoryTabs: new ElementMock(), skillPartyTabs: new ElementMock(), skillTree: new ElementMock(),
    skillDetailEmpty: new ElementMock(), skillDetailContent: new ElementMock(),
    skillDetailName: new ElementMock(), skillDetailType: new ElementMock(),
    skillDetailDescription: new ElementMock(), skillDetailLevel: new ElementMock(),
    skillDetailPrerequisite: new ElementMock(), skillDetailCost: new ElementMock(),
    skillDetailStatus: new ElementMock(), skillDetailEffect: new ElementMock(),
    skillFooterPoints: new ElementMock(), skillFooterLevel: new ElementMock(),
    skillFooterExp: new ElementMock(), skillStatus: new ElementMock(),
  };
  for (const category of ["general", "classes", "class-skills", "mastery"]) {
    const button = new ElementMock("button");
    button.dataset.skillCategory = category;
    elements.skillCategoryTabs.append(button);
  }
  return elements;
}

const elements = makeElements();
const state = createInitialGameState();
state.party[0].progression = { level: 3, exp: 12, skillPoints: 1, spentSkillPoints: 0, unlockedSkills: [] };
let saves = 0;
let clears = 0;
let blocked = false;
const menu = createMapSkillMenu({
  getElements: () => elements,
  getGameState: () => state,
  isActive: () => true,
  isTransitionPending: () => false,
  isInteractionModalOpen: () => blocked,
  clearInput: () => clears++,
  persistWorldState: () => saves++,
  updateInteractionPrompt() {},
});

assert.equal(menu.open(), true);
assert.equal(clears, 1);
const skillNodes = elements.skillTree.children.filter((child) => child.dataset.skillId);
assert.equal(skillNodes.length, 10);
assert.equal(elements.skillTree.children.filter((child) => child.dataset.visualRoot === "true").length, 1);
assert.equal(skillNodes[0].dataset.skillStatus, "available");
assert.equal(skillNodes[1].dataset.skillStatus, "locked");
assert.equal(elements.skillDetailName.textContent, "Quick Strike");
assert.equal(elements.skillDetailLevel.textContent, "Level 3");
assert.equal(elements.skillFooterPoints.textContent, "Skill Points: 1");
assert.equal(elements.skillFooterExp.textContent, "EXP 12 / 70");

const connectors = elements.skillTree.children[0].children;
assert.equal(connectors.length, 10, "one visual-root line plus nine real prerequisite lines");
assert.equal(connectors[1].dataset.from, "quick-strike");
assert.equal(connectors[1].dataset.to, "guard-stance");

assert.equal(menu.unlock(), true);
assert.deepEqual(state.party[0].progression.unlockedSkills, ["quick-strike"]);
assert.equal(elements.skillFooterPoints.textContent, "Skill Points: 0");
assert.equal(elements.skillTree.children.filter((child) => child.dataset.skillId)[0].dataset.skillStatus, "unlocked");
assert.equal(saves, 1);

assert.equal(menu.selectSkill("quick-strike"), true);
menu.moveSkill("left");
assert.equal(elements.skillDetailName.textContent, "Guard Stance");
const precisionNode = elements.skillTree.children.find((child) => child.dataset.skillId === "precision-strike");
precisionNode.click();
assert.equal(elements.skillDetailName.textContent, "Precision Strike");
assert.equal(saves, 1, "selecting a locked node does not purchase it");

menu.moveMember(1);
assert.match(elements.skillPartyTabs.children[1].attributes["aria-pressed"], /true/);
assert.equal(elements.skillDetailName.textContent, "Quick Strike");

state.party[1].progression = { level: 30, exp: 0, skillPoints: 0, spentSkillPoints: 10, unlockedSkills: [] };
menu.render();
assert.equal(elements.skillFooterExp.textContent, "EXP MAX");

assert.equal(menu.close(), true);
blocked = true;
assert.equal(menu.open(), false);

const mapSource = await readFile(new URL("../src/scenes/map/LaneMapUI.js", import.meta.url), "utf8");

assert.match(mapSource, /key === "k" \|\| key === "escape"/);
assert.match(mapSource, /skillMenu\.moveMember\(-1\)/);
assert.match(mapSource, /skillMenu\.moveSkill\("left"\)/);
assert.match(mapSource, /skillMenu\.unlock\(\)/);

blocked=false;
menu.open();
elements.skillCategoryTabs.children[1].click();
const classView=elements.skillTree.children[0];
const archerCard=classView.children.find(card=>card.children?.[0]?.textContent==="Archer · Unlocked");
assert.ok(archerCard);
archerCard.children.at(-1).click();
assert.equal(state.party[0].classState.currentClass,"archer");
assert.equal(saves,2,"class changes persist immediately");
elements.skillCategoryTabs.children[2].click();
assert.ok(elements.skillTree.children[0].children.some(card=>card.children?.[0]?.textContent==="Aimed Shot I · active"));
elements.skillCategoryTabs.children[3].click();
assert.equal(elements.skillFooterExp.textContent,"No Class EXP");
assert.ok(elements.skillTree.children[0].children.some(node=>node.textContent.includes("Aimed Shot: I")));
assert.equal(menu.unlock(),false,"class view does not spend starter skill points");
const closeFromEvent=menu.close;
assert.equal(closeFromEvent(),true,"Close remains bound when registered as a DOM event listener");
console.log("Map skill HUD: tree purchasing, class switching/persistence, class skills and mastery views passed.");
