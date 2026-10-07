import { PartyManager } from "../../core/PartyManager.js";
import { SkillManager } from "../../core/SkillManager.js";
import { getLevelExpRequirement, LEVEL_CAP } from "../../core/Progression.js";
import { renderClassProgression } from "../../ui/ClassProgressionView.js";
import {
  SKILL_TREE_LAYOUT,
  SKILL_TREE_ROOT,
  findSpatialSkill,
} from "./skillTree/SkillTreeLayout.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function createElement(tag, className, text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createSvgElement(tag) {
  return document.createElementNS
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
}

function getInitials(name = "?") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getPortraitSource(member) {
  return member?.portrait || member?.portraitUrl || member?.image || "";
}

function getPresentationStatus(check) {
  if (check.status === "unlocked") return "unlocked";
  if (check.status === "available" || check.reason === "points") return "available";
  return "locked";
}

function formatPrerequisites(skill, tree) {
  if (!skill.prerequisites?.length) return "None";
  return skill.prerequisites
    .map((id) => tree.find((candidate) => candidate.id === id)?.name || id)
    .join(", ");
}

function formatStatus(check) {
  if (check.status === "unlocked") return "Unlocked";
  if (check.status === "available") return "Available to unlock";
  if (check.reason === "points") return "Available — more Skill Points required";
  if (check.reason === "level") return `Locked — requires level ${check.skill?.requiredLevel ?? "?"}`;
  if (check.reason === "prerequisite") return "Locked — prerequisite not unlocked";
  return "Locked";
}

function formatEffect(skill) {
  return SKILL_TREE_LAYOUT[skill.id]?.effect || skill.description || "Passive combat upgrade.";
}

function setLinePosition(line, from, to) {
  line.setAttribute("x1", String(from.x));
  line.setAttribute("y1", String(from.y));
  line.setAttribute("x2", String(to.x));
  line.setAttribute("y2", String(to.y));
}

class MapSkillMenu {
  constructor({
    getElements, getGameState, isActive, isTransitionPending,
    isInteractionModalOpen, clearInput, persistWorldState, updateInteractionPrompt,
  }) {
    this.getElements = getElements;
    this.getGameState = getGameState;
    this.isActive = isActive;
    this.isTransitionPending = isTransitionPending;
    this.isInteractionModalOpen = isInteractionModalOpen;
    this.clearInput = clearInput;
    this.persistWorldState = persistWorldState;
    this.updateInteractionPrompt = updateInteractionPrompt;
    this.memberIndex = 0;
    this.selectedSkillId = null;
    this.activeCategory = "general";
    this.statusMessage = "";
    this.close = this.close.bind(this);
  }

  get elements() {
    return this.getElements?.() || {};
  }

  get manager() {
    return new SkillManager(this.getGameState?.());
  }

  getMembers() {
    const state = this.getGameState?.();
    return state ? new PartyManager(state).getActiveMembers() : [];
  }

  getMember() {
    const members = this.getMembers();
    if (!members.length) return null;
    this.memberIndex = Math.min(this.memberIndex, members.length - 1);
    return members[this.memberIndex];
  }

  getTree() {
    return SkillManager.tree();
  }

  getSelectedSkill(tree = this.getTree()) {
    return tree.find((skill) => skill.id === this.selectedSkillId) || tree[0] || null;
  }

  renderCategories() {
    const tabs = this.elements.skillCategoryTabs;
    if (!tabs) return;
    for (const button of tabs.querySelectorAll?.("[data-skill-category]") || tabs.children) {
      button.dataset.selected = String(button.dataset.skillCategory === this.activeCategory);
      button.setAttribute?.("aria-selected", button.dataset.selected);
      if (!button.dataset.classTabBound) {
        button.dataset.classTabBound = "true";
        button.addEventListener("click", () => { this.activeCategory=button.dataset.skillCategory; this.render(); });
      }
    }
  }

  renderParty(members, member) {
    const container = this.elements.skillPartyTabs;
    const buttons = members.map((candidate, index) => {
      const selected = candidate === member;
      const button = createElement("button", "map-skill-character");
      button.type = "button";
      button.dataset.selected = String(selected);
      button.setAttribute("aria-pressed", String(selected));
      const progression = this.manager.getProgression(candidate.id);
      button.setAttribute("aria-label", `${candidate.name}, level ${progression?.level || 1}`);

      const portrait = createElement("span", "map-skill-portrait");
      const portraitSource = getPortraitSource(candidate);
      if (portraitSource) {
        const image = createElement("img");
        image.src = portraitSource;
        image.alt = "";
        portrait.append(image);
      } else {
        portrait.textContent = getInitials(candidate.name);
      }

      const copy = createElement("span", "map-skill-character-copy");
      copy.append(
        createElement("strong", "", candidate.name),
        createElement("small", "", `Level ${progression?.level || 1}`),
      );
      button.append(portrait, copy);
      button.addEventListener("click", () => {
        this.memberIndex = index;
        this.selectedSkillId = SkillManager.tree()[0]?.id || null;
        this.statusMessage = "";
        this.render();
      });
      return button;
    });
    container.replaceChildren(...buttons);
  }

  renderGraph(member, tree, selectedSkill) {
    const graph = this.elements.skillTree;
    const svg = createSvgElement("svg");
    svg.setAttribute("class", "map-skill-connectors");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");

    const firstSkill = tree[0];
    const firstLayout = firstSkill && SKILL_TREE_LAYOUT[firstSkill.id];
    if (firstLayout) {
      const line = createSvgElement("line");
      line.setAttribute("class", "map-skill-connector is-unlocked is-root-connector");
      line.dataset.from = "visual-root";
      line.dataset.to = firstSkill.id;
      setLinePosition(line, SKILL_TREE_ROOT, firstLayout);
      svg.append(line);
    }

    for (const skill of tree) {
      const to = SKILL_TREE_LAYOUT[skill.id];
      if (!to) continue;
      for (const prerequisiteId of skill.prerequisites || []) {
        const from = SKILL_TREE_LAYOUT[prerequisiteId];
        if (!from) continue;
        const prerequisiteCheck = this.manager.getStatus(member.id, prerequisiteId);
        const line = createSvgElement("line");
        line.setAttribute("class", `map-skill-connector${prerequisiteCheck.status === "unlocked" ? " is-unlocked" : ""}`);
        line.dataset.from = prerequisiteId;
        line.dataset.to = skill.id;
        setLinePosition(line, from, to);
        svg.append(line);
      }
    }

    const root = createElement("div", "map-skill-root");
    root.dataset.visualRoot = "true";
    root.style.left = `${SKILL_TREE_ROOT.x}%`;
    root.style.top = `${SKILL_TREE_ROOT.y}%`;
    root.setAttribute("aria-hidden", "true");
    root.append(
      createElement("span", "map-skill-root-glyph", "✦"),
      createElement("small", "", SKILL_TREE_ROOT.label),
    );

    const nodes = tree.map((skill) => {
      const layout = SKILL_TREE_LAYOUT[skill.id] || { x: 50, y: 50, icon: "✦" };
      const check = this.manager.getStatus(member.id, skill.id);
      const status = getPresentationStatus(check);
      const selected = skill.id === selectedSkill?.id;
      const node = createElement("button", `map-skill-node is-${status}`);
      node.type = "button";
      node.style.left = `${layout.x}%`;
      node.style.top = `${layout.y}%`;
      node.dataset.skillId = skill.id;
      node.dataset.skillStatus = status;
      node.dataset.selected = String(selected);
      node.setAttribute("aria-pressed", String(selected));
      node.setAttribute("aria-label", `${skill.name}. ${formatStatus(check)}`);
      node.append(
        createElement("span", "map-skill-node-ring", layout.icon || "✦"),
        createElement("span", "map-skill-node-label", skill.name),
      );
      node.addEventListener("click", () => {
        if (this.selectedSkillId === skill.id && status === "available") {
          this.unlock();
          return;
        }
        this.selectedSkillId = skill.id;
        this.statusMessage = "";
        this.render();
      });
      return node;
    });

    graph.replaceChildren(svg, root, ...nodes);
  }

  renderDetails(member, tree, skill) {
    this.elements.skillDetailEmpty.hidden = Boolean(skill);
    this.elements.skillDetailContent.hidden = !skill;
    if (!skill) return;

    const check = this.manager.getStatus(member.id, skill.id);
    this.elements.skillDetailName.textContent = skill.name;
    this.elements.skillDetailType.textContent = skill.type || "Passive";
    this.elements.skillDetailDescription.textContent = skill.description;
    this.elements.skillDetailLevel.textContent = `Level ${skill.requiredLevel}`;
    this.elements.skillDetailPrerequisite.textContent = formatPrerequisites(skill, tree);
    this.elements.skillDetailCost.textContent = `${skill.cost} Skill Point${skill.cost === 1 ? "" : "s"}`;
    this.elements.skillDetailStatus.textContent = formatStatus(check);
    this.elements.skillDetailStatus.dataset.skillStatus = getPresentationStatus(check);
    this.elements.skillDetailEffect.textContent = formatEffect(skill);
  }

  renderFooter(member) {
    const progression = this.manager.getProgression(member.id);
    const level = progression?.level || 1;
    const experience = progression?.exp || 0;
    this.elements.skillFooterPoints.textContent = `Skill Points: ${progression?.skillPoints || 0}`;
    this.elements.skillFooterLevel.textContent = `Lv. ${level}`;
    this.elements.skillFooterExp.textContent = level >= LEVEL_CAP
      ? "EXP MAX"
      : `EXP ${experience} / ${getLevelExpRequirement(level)}`;
    this.elements.skillStatus.textContent = this.statusMessage;
  }

  render() {
    const members = this.getMembers();
    const member = this.getMember();
    if (!member) return;
    const tree = this.getTree();
    const selectedSkill = this.getSelectedSkill(tree);
    this.selectedSkillId = selectedSkill?.id || null;

    this.renderCategories();
    this.renderParty(members, member);
    this.elements.skillMenu.dataset.progressionView=this.activeCategory;
    const heading=this.elements.skillTree.parentElement?.querySelector?.(".map-skill-graph-heading span");
    if(heading)heading.textContent={general:"General Discipline",classes:"Class Specialization","class-skills":"Class Techniques",mastery:"Combat Mastery"}[this.activeCategory];
    if (this.activeCategory !== "general") {
      renderClassProgression({ container:this.elements.skillTree, member, gameState:this.getGameState(), category:this.activeCategory, persist:this.persistWorldState, rerender:()=>this.render() });
      this.elements.skillDetailContent.hidden=true;
      this.elements.skillDetailEmpty.hidden=false;
      this.elements.skillDetailEmpty.textContent="Choose a class or inspect mastery. Class skills are available while that class is equipped; previous mastery is preserved.";
      this.elements.skillFooterPoints.textContent="Combat practice → Mastery";
      this.elements.skillFooterLevel.textContent="World training → Classes";
      this.elements.skillFooterExp.textContent="No Class EXP";
      this.elements.skillStatus.textContent=this.statusMessage;
      return;
    }
    this.renderGraph(member, tree, selectedSkill);
    this.renderDetails(member, tree, selectedSkill);
    this.renderFooter(member);
  }

  selectSkill(skillId) {
    if (!this.getTree().some((skill) => skill.id === skillId)) return false;
    this.selectedSkillId = skillId;
    this.statusMessage = "";
    this.render();
    return true;
  }

  unlock() {
    if (this.activeCategory !== "general") return false;
    const member = this.getMember();
    const skill = this.getSelectedSkill();
    if (!member || !skill) return false;

    const result = this.manager.purchase(member.id, skill.id);
    if (result.changed) {
      this.persistWorldState?.();
      this.statusMessage = `${skill.name} unlocked.`;
    } else {
      this.statusMessage = formatStatus(this.manager.getStatus(member.id, skill.id));
    }
    this.render();
    return result.changed;
  }

  open() {
    if (!this.isActive?.() || !this.elements.skillMenu || this.isTransitionPending?.() || this.isInteractionModalOpen?.()) return false;
    if (!this.elements.skillMenu.hidden) return false;
    this.clearInput?.();
    this.memberIndex = 0;
    this.selectedSkillId = this.getTree()[0]?.id || null;
    this.statusMessage = "";
    this.render();
    this.elements.skillMenu.hidden = false;
    this.updateInteractionPrompt?.();
    return true;
  }

  close() {
    if (!this.elements.skillMenu || this.elements.skillMenu.hidden) return false;
    this.clearInput?.();
    this.elements.skillMenu.hidden = true;
    this.updateInteractionPrompt?.();
    return true;
  }

  moveSkill(direction) {
    if (this.activeCategory !== "general") return false;
    const normalizedDirection = typeof direction === "number"
      ? direction < 0 ? "up" : "down"
      : direction;
    const nextId = findSpatialSkill(this.getTree(), this.selectedSkillId, normalizedDirection);
    if (!nextId || nextId === this.selectedSkillId) return false;
    this.selectedSkillId = nextId;
    this.statusMessage = "";
    this.render();
    return true;
  }

  moveMember(direction) {
    const members = this.getMembers();
    if (members.length < 2) return false;
    this.memberIndex = (this.memberIndex + direction + members.length) % members.length;
    this.selectedSkillId = SkillManager.tree()[0]?.id || null;
    this.statusMessage = "";
    this.render();
    return true;
  }

  isOpen() {
    return Boolean(this.elements.skillMenu && !this.elements.skillMenu.hidden);
  }
}

export function createMapSkillMenu(options) {
  return new MapSkillMenu(options);
}
