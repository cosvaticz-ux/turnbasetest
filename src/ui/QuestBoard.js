import { AudioManager } from "../core/AudioManager.js";
import { QuestManager, QUEST_STATE } from "../core/QuestManager.js";
import { RewardResolver } from "../core/RewardResolver.js";
import { ITEM_DEFINITIONS } from "../data/battleContent.js";
import { QUEST_DEFINITIONS } from "../data/storyContent.js";

let installedController = null;

const QUEST_GIVER_IDS = new Set(
    Object.values(QUEST_DEFINITIONS)
        .map(definition => definition?.giverId)
        .filter(Boolean)
);

function ensureStylesheet() {
    if (document.querySelector?.('link[data-lx-quest-board="true"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./src/styles/questBoard.css";
    link.dataset.lxQuestBoard = "true";
    document.head?.appendChild(link);
}

function normalizeInputKey(event) {
    const code = String(event?.code || "");
    if (code === "Space") return " ";
    if (code === "Enter") return "enter";
    if (code === "Escape") return "escape";
    if (code === "ArrowUp") return "arrowup";
    if (code === "ArrowDown") return "arrowdown";
    if (code === "KeyW") return "w";
    if (code === "KeyS") return "s";
    return String(event?.key || "").toLowerCase();
}

function prettifyId(value) {
    return String(value || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function questStateInfo(questManager, quest) {
    if (!quest) return { id: "missing", label: "Unavailable", action: null };
    if (quest.state === QUEST_STATE.AVAILABLE) {
        return { id: "available", label: "Available", action: "accept" };
    }
    if (quest.state === QUEST_STATE.ACTIVE) {
        if (questManager.canComplete(quest.id)) {
            return { id: "ready", label: "Ready to Turn In", action: "turn-in" };
        }
        return { id: "active", label: "In Progress", action: null };
    }
    if (quest.state === QUEST_STATE.COMPLETED) {
        return { id: "completed", label: "Completed", action: null };
    }
    if (quest.state === QUEST_STATE.FAILED) {
        return { id: "failed", label: "Failed", action: null };
    }
    return { id: "locked", label: "Locked", action: null };
}

function formatRewardParts(rewards = {}) {
    const parts = [];
    const currency = Math.max(0, Number(rewards.currency) || 0);
    if (currency > 0) parts.push(`${currency} crowns`);

    for (const reward of rewards.items || []) {
        const quantity = Math.max(1, Math.floor(Number(reward?.quantity) || 1));
        const name = ITEM_DEFINITIONS[reward?.id]?.name || prettifyId(reward?.id);
        if (name) parts.push(`${name} ×${quantity}`);
    }

    for (const [factionId, amount] of Object.entries(rewards.reputation || {})) {
        const value = Number(amount) || 0;
        if (!value) continue;
        const factionName = factionId === "adventurerGuild" ? "Adventurer Guild" : prettifyId(factionId);
        parts.push(`${factionName} Reputation ${value > 0 ? "+" : ""}${value}`);
    }
    return parts;
}

function createBoardRoot() {
    const root = document.createElement("section");
    root.id = "map-quest-board";
    root.className = "lx-quest-board";
    root.hidden = true;
    root.tabIndex = -1;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "map-quest-board-title");

    root.innerHTML = `
        <header class="lx-quest-board-header">
            <div class="lx-quest-giver">
                <span class="lx-quest-giver-portrait-frame" aria-hidden="true">
                    <img id="map-quest-giver-portrait" class="lx-quest-giver-portrait" alt="">
                </span>
                <div>
                    <span id="map-quest-board-kicker" class="lx-quest-board-kicker">Adventurer Guild · Contracts</span>
                    <h2 id="map-quest-board-title">Guild Warden Mara</h2>
                </div>
            </div>
            <button id="map-quest-close" class="lx-quest-close" type="button">Close <kbd>Esc</kbd></button>
        </header>
        <div class="lx-quest-board-layout">
            <section class="lx-quest-list-panel" aria-label="Quest list">
                <span class="lx-quest-panel-label">Contracts</span>
                <div id="map-quest-list" class="lx-quest-list" role="listbox" aria-label="Available quests"></div>
            </section>
            <article class="lx-quest-detail" aria-live="polite">
                <span id="map-quest-category" class="lx-quest-category"></span>
                <div class="lx-quest-detail-heading">
                    <h3 id="map-quest-name">No contract selected</h3>
                    <strong id="map-quest-state" class="lx-quest-state"></strong>
                </div>
                <p id="map-quest-description" class="lx-quest-description"></p>
                <section class="lx-quest-objective-section">
                    <span class="lx-quest-panel-label">Objectives</span>
                    <ul id="map-quest-objectives" class="lx-quest-objectives"></ul>
                </section>
                <section class="lx-quest-reward-section">
                    <span class="lx-quest-panel-label">Rewards</span>
                    <div id="map-quest-rewards" class="lx-quest-rewards"></div>
                </section>
                <button id="map-quest-action" class="lx-quest-action" type="button">Accept Quest</button>
                <p id="map-quest-status" class="lx-quest-status" role="status"></p>
            </article>
        </div>
        <footer class="lx-quest-board-footer">
            <span>↑ ↓ / W S · Select</span>
            <span>Space / Enter · Confirm</span>
            <span>Esc · Close</span>
        </footer>
    `;
    return root;
}

class QuestBoardController {
    constructor({ gameManager } = {}) {
        this.gameManager = gameManager || null;
        this.mapScreen = document.getElementById("map-screen");
        this.root = createBoardRoot();
        this.currentGiverId = null;
        this.conversationGiverId = null;
        this.conversationActive = false;
        this.selectedIndex = 0;
        this.modalSentinelActive = false;
        this.statusMessage = "";

        this.mapScreen?.appendChild(this.root);
        this.cacheElements();
        this.bindEvents();
        this.observeMapVisibility();
    }

    cacheElements() {
        this.elements = {
            title: this.root.querySelector("#map-quest-board-title"),
            kicker: this.root.querySelector("#map-quest-board-kicker"),
            portrait: this.root.querySelector("#map-quest-giver-portrait"),
            close: this.root.querySelector("#map-quest-close"),
            list: this.root.querySelector("#map-quest-list"),
            category: this.root.querySelector("#map-quest-category"),
            name: this.root.querySelector("#map-quest-name"),
            state: this.root.querySelector("#map-quest-state"),
            description: this.root.querySelector("#map-quest-description"),
            objectives: this.root.querySelector("#map-quest-objectives"),
            rewards: this.root.querySelector("#map-quest-rewards"),
            action: this.root.querySelector("#map-quest-action"),
            status: this.root.querySelector("#map-quest-status"),
            dialogue: document.getElementById("map-dialogue"),
            dialogueSpeaker: document.getElementById("map-dialogue-speaker"),
            dialogueText: document.getElementById("map-dialogue-text"),
            dialogueChoices: document.getElementById("map-dialogue-choices"),
            dialogueHint: document.getElementById("map-dialogue-hint"),
            dialoguePortraitStage: document.getElementById("map-dialogue-portrait-stage"),
            dialoguePortrait: document.getElementById("map-dialogue-portrait")
        };
    }

    bindEvents() {
        this.handleCaptureClick = event => {
            if (this.isOpen() || this.conversationActive || !this.isMapActive()) return;
            const actor = event.target?.closest?.("[data-interaction-id]");
            const giverId = actor?.dataset?.interactionId;
            if (!giverId || !QUEST_GIVER_IDS.has(giverId)) return;
            event.preventDefault?.();
            event.stopImmediatePropagation?.();
            this.beginConversation(giverId);
        };

        this.handleCaptureKeyDown = event => {
            const key = normalizeInputKey(event);
            if (this.conversationActive) {
                event.preventDefault?.();
                event.stopImmediatePropagation?.();
                if (key === " " || key === "enter") this.finishConversation({ openBoard: true });
                else if (key === "escape") this.finishConversation({ openBoard: false });
                return;
            }

            if (this.isOpen()) {
                event.preventDefault?.();
                event.stopImmediatePropagation?.();
                if (key === "escape") this.close({ playSound: true });
                else if (key === "arrowup" || key === "w") this.moveSelection(-1);
                else if (key === "arrowdown" || key === "s") this.moveSelection(1);
                else if (key === " " || key === "enter") this.activateSelectedQuest();
                return;
            }

            if (!this.isMapActive() || (key !== " " && key !== "enter")) return;
            const giverId = this.getPromptQuestGiverId();
            if (!giverId) return;
            event.preventDefault?.();
            event.stopImmediatePropagation?.();
            this.beginConversation(giverId);
        };

        document.addEventListener("click", this.handleCaptureClick, true);
        document.addEventListener("keydown", this.handleCaptureKeyDown, true);
        this.elements.close?.addEventListener("click", () => this.close({ playSound: true }));
        this.elements.action?.addEventListener("click", () => this.activateSelectedQuest());
    }

    observeMapVisibility() {
        if (!this.mapScreen || typeof MutationObserver !== "function") return;
        this.mapObserver = new MutationObserver(() => {
            if (!this.mapScreen.hidden) return;
            if (this.conversationActive) this.finishConversation({ openBoard: false });
            if (this.isOpen()) this.close({ playSound: false });
        });
        this.mapObserver.observe(this.mapScreen, { attributes: true, attributeFilter: ["hidden"] });
    }

    isMapActive() {
        return Boolean(this.mapScreen && !this.mapScreen.hidden);
    }

    isOpen() {
        return Boolean(this.root && !this.root.hidden);
    }

    getGameState() {
        return this.gameManager?.globalState || null;
    }

    getQuestManager() {
        const state = this.getGameState();
        return state ? new QuestManager(state) : null;
    }

    getEntriesForGiver(giverId) {
        const questManager = this.getQuestManager();
        if (!questManager || !giverId) return [];
        return Object.values(QUEST_DEFINITIONS)
            .filter(definition => definition?.giverId === giverId)
            .map(definition => ({
                definition,
                quest: questManager.get(definition.id)
            }));
    }

    getEntries() {
        return this.getEntriesForGiver(this.currentGiverId);
    }

    getPromptQuestGiverId() {
        const prompt = document.getElementById("map-interaction-prompt");
        if (!prompt || prompt.hidden) return null;
        const promptText = String(prompt.textContent || "");
        for (const giverId of QUEST_GIVER_IDS) {
            const actor = document.querySelector(`[data-interaction-id="${giverId}"]`);
            const name = actor?.querySelector("span")?.textContent?.trim();
            if (name && promptText.includes(name)) return giverId;
        }
        return null;
    }

    getGiverPresentation(giverId) {
        const actor = document.querySelector(`[data-interaction-id="${giverId}"]`);
        return {
            name: actor?.querySelector("span")?.textContent?.trim() || prettifyId(giverId) || "Quest Giver",
            portrait: actor?.querySelector("img")?.getAttribute("src") || ""
        };
    }

    getConversationText(giverId) {
        const questManager = this.getQuestManager();
        const entries = this.getEntriesForGiver(giverId);
        const states = entries.map(entry => questStateInfo(questManager, entry.quest));

        if (giverId === "guild-warden") {
            if (states.some(info => info.id === "ready")) {
                return "You're back. If the road is clear, file the report on the board and we'll settle what you're owed.";
            }
            if (states.some(info => info.id === "available")) {
                return "Looking for work? I've got a road contract posted. Read the terms before you put your name to it.";
            }
            if (states.some(info => info.id === "active")) {
                return "Still working that contract? Check the board if you need the details again.";
            }
            return "The guild remembers useful people. Check the board if you're looking for more work.";
        }

        if (states.some(info => info.id === "ready")) return "You've finished the work. Let's look over the details.";
        if (states.some(info => info.id === "available")) return "I have work available, if you're interested.";
        if (states.some(info => info.id === "active")) return "Your current work is still posted here.";
        return "There is nothing urgent, but you may check the available work.";
    }

    activateModalSentinel() {
        const shop = document.getElementById("map-shop");
        if (!shop) return true;
        if (!shop.hidden && shop.dataset.lxQuestSentinel !== "true") return false;
        if (shop.dataset.lxQuestSentinel === "true") return true;

        // Reuse MapScene's existing modal pause contract so movement, pursuit,
        // and random encounters stay paused during the conversation and board.
        shop.dataset.lxQuestSentinel = "true";
        shop.hidden = false;
        shop.style.setProperty("display", "none", "important");
        this.modalSentinelActive = true;
        return true;
    }

    releaseModalSentinel() {
        if (!this.modalSentinelActive) return;
        const shop = document.getElementById("map-shop");
        if (shop?.dataset?.lxQuestSentinel === "true") {
            delete shop.dataset.lxQuestSentinel;
            shop.style.removeProperty("display");
            shop.hidden = true;
        }
        this.modalSentinelActive = false;
    }

    saveState() {
        const saved = this.gameManager?.save?.("autosave") ?? false;
        if (this.mapScreen) this.mapScreen.dataset.lastSaveResult = saved ? "saved" : "failed";
        return saved;
    }

    showConversationPortrait(presentation) {
        const stage = this.elements.dialoguePortraitStage;
        const portrait = this.elements.dialoguePortrait;
        if (!stage || !portrait) return false;
        if (!presentation?.portrait) {
            stage.hidden = true;
            portrait.removeAttribute?.("src");
            portrait.alt = "";
            return false;
        }
        stage.dataset.portraitKind = "npc";
        portrait.src = presentation.portrait;
        portrait.alt = `${presentation.name || "Quest giver"} dialogue portrait`;
        stage.hidden = false;
        return true;
    }

    hideConversationPresentation() {
        if (this.elements.dialogue) this.elements.dialogue.hidden = true;
        if (this.elements.dialogueChoices) this.elements.dialogueChoices.replaceChildren();
        if (this.elements.dialogueHint) this.elements.dialogueHint.textContent = "SPACE — Continue";
        if (this.elements.dialoguePortraitStage) {
            this.elements.dialoguePortraitStage.hidden = true;
            delete this.elements.dialoguePortraitStage.dataset.portraitKind;
        }
        if (this.elements.dialoguePortrait) {
            this.elements.dialoguePortrait.removeAttribute?.("src");
            this.elements.dialoguePortrait.alt = "";
        }
    }

    beginConversation(giverId) {
        if (!giverId || !QUEST_GIVER_IDS.has(giverId) || !this.isMapActive()) return false;
        if (this.isOpen() || this.conversationActive) return false;
        if (!this.activateModalSentinel()) return false;

        this.conversationGiverId = giverId;
        this.conversationActive = true;
        const presentation = this.getGiverPresentation(giverId);
        globalThis.dispatchEvent?.(new Event("blur"));

        if (this.elements.dialogueSpeaker) this.elements.dialogueSpeaker.textContent = presentation.name;
        if (this.elements.dialogueText) this.elements.dialogueText.textContent = this.getConversationText(giverId);
        if (this.elements.dialogueChoices) this.elements.dialogueChoices.replaceChildren();
        if (this.elements.dialogueHint) this.elements.dialogueHint.textContent = "SPACE — Continue · ESC — Leave";
        this.showConversationPortrait(presentation);
        if (this.elements.dialogue) this.elements.dialogue.hidden = false;
        return true;
    }

    finishConversation({ openBoard = true } = {}) {
        if (!this.conversationActive) return false;
        const giverId = this.conversationGiverId;
        this.conversationActive = false;
        this.conversationGiverId = null;
        this.hideConversationPresentation();

        if (openBoard && giverId && this.isMapActive()) {
            AudioManager.playEvent("menuConfirm");
            return this.open(giverId);
        }

        this.releaseModalSentinel();
        return true;
    }

    open(giverId) {
        if (!giverId || !QUEST_GIVER_IDS.has(giverId) || !this.isMapActive()) return false;
        if (!this.activateModalSentinel()) return false;

        this.currentGiverId = giverId;
        this.statusMessage = "";
        const entries = this.getEntries();
        const questManager = this.getQuestManager();
        const actionableIndex = entries.findIndex(entry => {
            const info = questStateInfo(questManager, entry.quest);
            return info.action === "accept" || info.action === "turn-in";
        });
        this.selectedIndex = actionableIndex >= 0 ? actionableIndex : 0;

        const giver = this.getGiverPresentation(giverId);
        if (this.elements.title) this.elements.title.textContent = giver.name;
        if (this.elements.kicker) {
            this.elements.kicker.textContent = giverId === "guild-warden"
                ? "Adventurer Guild · Contracts"
                : "Available Work";
        }
        if (this.elements.portrait) {
            if (giver.portrait) {
                this.elements.portrait.src = giver.portrait;
                this.elements.portrait.hidden = false;
            } else {
                this.elements.portrait.removeAttribute("src");
                this.elements.portrait.hidden = true;
            }
        }

        this.root.hidden = false;
        globalThis.dispatchEvent?.(new Event("blur"));
        this.render();
        this.focusSelectedRow();
        return true;
    }

    close({ playSound = false } = {}) {
        if (this.conversationActive) return this.finishConversation({ openBoard: false });
        if (!this.isOpen()) {
            this.releaseModalSentinel();
            return false;
        }
        this.root.hidden = true;
        this.releaseModalSentinel();
        this.currentGiverId = null;
        this.selectedIndex = 0;
        this.statusMessage = "";
        if (playSound) AudioManager.playEvent("menuCancel");
        return true;
    }

    focusSelectedRow() {
        const selected = this.elements.list?.querySelector?.('[data-selected="true"]');
        selected?.focus?.({ preventScroll: true });
    }

    moveSelection(direction) {
        const entries = this.getEntries();
        if (entries.length < 2) return false;
        this.selectedIndex = (
            this.selectedIndex + Math.sign(direction) + entries.length
        ) % entries.length;
        this.statusMessage = "";
        AudioManager.playEvent("menuMove");
        this.render();
        this.focusSelectedRow();
        return true;
    }

    selectIndex(index, { sound = false } = {}) {
        const entries = this.getEntries();
        if (!entries.length) return false;
        const nextIndex = Math.max(0, Math.min(Number(index) || 0, entries.length - 1));
        if (nextIndex === this.selectedIndex) return true;
        this.selectedIndex = nextIndex;
        this.statusMessage = "";
        if (sound) AudioManager.playEvent("menuMove");
        this.render();
        return true;
    }

    activateSelectedQuest() {
        const state = this.getGameState();
        const questManager = this.getQuestManager();
        const entries = this.getEntries();
        const selected = entries[this.selectedIndex];
        if (!state || !questManager || !selected?.quest) return false;

        const { definition, quest } = selected;
        const info = questStateInfo(questManager, quest);
        if (info.action === "accept") {
            if (!questManager.start(definition.id)) return false;
            this.saveState();
            this.statusMessage = `Quest accepted: ${definition.name}.`;
            AudioManager.playEvent("questAccept");
            this.render();
            return true;
        }

        if (info.action === "turn-in") {
            const rewarded = questManager.completeAndReward(definition.id, new RewardResolver(state));
            if (!rewarded) return false;
            this.saveState();
            this.statusMessage = `Quest completed: ${definition.name}. Rewards received.`;
            AudioManager.playEvent("questTurnIn");
            this.render();
            return true;
        }

        this.statusMessage = info.id === "active"
            ? "The contract is still in progress."
            : info.id === "completed"
                ? "This contract has already been completed."
                : "This contract cannot be accepted right now.";
        this.render();
        return false;
    }

    render() {
        const questManager = this.getQuestManager();
        const entries = this.getEntries();
        this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, Math.max(0, entries.length - 1)));

        if (this.elements.list) {
            if (!entries.length) {
                const empty = document.createElement("p");
                empty.className = "lx-quest-list-empty";
                empty.textContent = "No contracts are currently posted.";
                this.elements.list.replaceChildren(empty);
            } else {
                const rows = entries.map((entry, index) => {
                    const info = questStateInfo(questManager, entry.quest);
                    const row = document.createElement("button");
                    row.type = "button";
                    row.className = "lx-quest-row";
                    row.dataset.selected = String(index === this.selectedIndex);
                    row.dataset.questState = info.id;
                    row.setAttribute("role", "option");
                    row.setAttribute("aria-selected", String(index === this.selectedIndex));

                    const category = document.createElement("small");
                    category.textContent = entry.definition.category || "Quest";
                    const name = document.createElement("strong");
                    name.textContent = entry.definition.name;
                    const stateLabel = document.createElement("b");
                    stateLabel.textContent = info.label;
                    row.append(category, name, stateLabel);
                    row.addEventListener("pointerenter", () => this.selectIndex(index));
                    row.addEventListener("click", () => {
                        this.selectIndex(index, { sound: index !== this.selectedIndex });
                        this.focusSelectedRow();
                    });
                    return row;
                });
                this.elements.list.replaceChildren(...rows);
            }
        }

        const selected = entries[this.selectedIndex] || null;
        const definition = selected?.definition;
        const quest = selected?.quest;
        const info = questStateInfo(questManager, quest);

        if (this.elements.category) this.elements.category.textContent = definition?.category || "";
        if (this.elements.name) this.elements.name.textContent = definition?.name || "No contract selected";
        if (this.elements.state) {
            this.elements.state.textContent = definition ? info.label : "";
            this.elements.state.dataset.questState = info.id;
        }
        if (this.elements.description) {
            this.elements.description.textContent = definition?.description || "No quest details are available.";
        }

        if (this.elements.objectives) {
            const objectiveNodes = definition
                ? Object.keys(definition.objectives || {}).map(objectiveId => {
                    const complete = quest?.objectives?.[objectiveId] === true;
                    const item = document.createElement("li");
                    item.dataset.complete = String(complete);
                    const marker = document.createElement("span");
                    marker.setAttribute("aria-hidden", "true");
                    marker.textContent = complete ? "✓" : "○";
                    const text = document.createElement("span");
                    text.textContent = definition.objectiveLabels?.[objectiveId] || prettifyId(objectiveId);
                    item.append(marker, text);
                    return item;
                })
                : [];
            this.elements.objectives.replaceChildren(...objectiveNodes);
        }

        if (this.elements.rewards) {
            const rewardNodes = definition
                ? formatRewardParts(definition.rewards).map(label => {
                    const chip = document.createElement("span");
                    chip.textContent = label;
                    return chip;
                })
                : [];
            if (!rewardNodes.length && definition) {
                const none = document.createElement("span");
                none.textContent = "No listed reward";
                rewardNodes.push(none);
            }
            this.elements.rewards.replaceChildren(...rewardNodes);
        }

        if (this.elements.action) {
            const actionLabels = {
                accept: "Accept Quest",
                "turn-in": "Turn In Quest"
            };
            this.elements.action.textContent = actionLabels[info.action]
                || (info.id === "completed" ? "Completed" : info.id === "active" ? "In Progress" : info.label);
            this.elements.action.disabled = !info.action;
            this.elements.action.dataset.questAction = info.action || info.id;
        }
        if (this.elements.status) this.elements.status.textContent = this.statusMessage;
        return entries.length;
    }
}

export function installQuestBoard({ gameManager } = {}) {
    if (installedController) return installedController;
    const mapScreen = document.getElementById("map-screen");
    if (!mapScreen) return null;
    ensureStylesheet();
    installedController = new QuestBoardController({ gameManager });
    return installedController;
}
