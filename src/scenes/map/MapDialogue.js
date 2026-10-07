import { AssetResolver } from "../../core/AssetResolver.js";
import { DIALOGUE_DEFINITIONS } from "../../data/worldContent.js";

const QUEST_DIALOGUE_IDS = new Set([
    "guildAvailable",
    "guildActive",
    "guildComplete",
    "guildDone",
    "wolfContractAvailable",
    "wolfContractActive",
    "wolfContractComplete",
    "wolfContractDone"
]);

// Dialogue owns line/choice state. Battle entry and prompt refresh remain scene callbacks.
export function createMapDialogue({ getElements, clearInput, triggerEncounter, updateInteractionPrompt }) {
    let activeDialogue = null;
    let activeDialogueIndex = 0;
    let activeDialoguePresentation = null;
    let activeDialogueComplete = null;
    let activeEncounterDialogue = null;
    let selectedDialogueChoiceIndex = 0;

    function applyDialogueLayout(mode = "standard") {
        const current = getElements();
        const shell = current?.dialogue;
        if (!shell) return false;

        const choiceMode = mode === "choice";
        const questMode = mode === "quest";
        const fixedHeight = choiceMode ? "248px" : (questMode ? "232px" : "188px");

        shell.dataset.dialogueMode = mode;
        shell.style.display = "grid";
        shell.style.gridTemplateRows = choiceMode
            ? "24px minmax(0, 1fr) auto 12px"
            : "24px minmax(0, 1fr) 12px";
        shell.style.alignContent = "stretch";
        shell.style.height = fixedHeight;
        shell.style.minHeight = fixedHeight;
        shell.style.maxHeight = fixedHeight;
        shell.style.overflow = "hidden";

        if (current.dialogueSpeaker) {
            current.dialogueSpeaker.style.display = "block";
            current.dialogueSpeaker.style.minHeight = "0";
            current.dialogueSpeaker.style.overflow = "hidden";
            current.dialogueSpeaker.style.whiteSpace = "nowrap";
        }
        if (current.dialogueText) {
            current.dialogueText.style.minHeight = "0";
            current.dialogueText.style.overflowY = "auto";
            current.dialogueText.style.scrollbarGutter = "stable";
        }
        if (current.dialogueHint) {
            current.dialogueHint.style.display = "block";
            current.dialogueHint.style.minHeight = "12px";
            current.dialogueHint.style.lineHeight = "12px";
            current.dialogueHint.style.alignSelf = "end";
            current.dialogueHint.style.whiteSpace = "nowrap";
        }
        return true;
    }

    function presentDialogueLine() {
        const line = activeDialogue?.[activeDialogueIndex];
        const current = getElements();
        if (!line || !current?.dialogue) return false;
        current.dialogue.hidden = false;
        if (current.dialogueSpeaker) current.dialogueSpeaker.textContent = line.speaker || "";
        if (current.dialogueText) {
            current.dialogueText.textContent = line.text || "";
            current.dialogueText.scrollTop = 0;
        }
        const linePortrait = line.dialoguePortrait || line.portrait || null;
        const inheritedPortrait = line.speaker === activeDialoguePresentation?.speakerName
            ? activeDialoguePresentation.dialoguePortrait
            : null;
        presentDialoguePortrait(linePortrait || inheritedPortrait, line.speaker || "NPC");
        return true;
    }

    function presentDialoguePortrait(source, speakerName = "NPC") {
        if (!getElements()?.dialoguePortraitStage || !getElements()?.dialoguePortrait) return false;
        if (!source) {
            getElements().dialoguePortraitStage.hidden = true;
            delete getElements().dialoguePortraitStage.dataset.portraitKind;
            getElements().dialoguePortrait.removeAttribute?.("src");
            getElements().dialoguePortrait.alt = "";
            return false;
        }
        getElements().dialoguePortraitStage.dataset.portraitKind = activeEncounterDialogue ? "enemy" : "npc";
        getElements().dialoguePortrait.src = source;
        getElements().dialoguePortrait.alt = `${speakerName} dialogue portrait`;
        getElements().dialoguePortraitStage.hidden = false;
        return true;
    }

    function openDialogue(dialogueId, presentation = {}, onComplete = null) {
        const dialogue = DIALOGUE_DEFINITIONS[dialogueId];
        if (!dialogue?.length || !getElements()?.dialogue) return false;
        clearInput();
        activeDialogue = dialogue;
        activeDialogueIndex = 0;
        activeEncounterDialogue = null;
        selectedDialogueChoiceIndex = 0;
        activeDialoguePresentation = {
            speakerName: presentation.speakerName || "",
            dialoguePortrait: presentation.dialoguePortrait || presentation.sprite || null
        };
        activeDialogueComplete = typeof onComplete === "function" ? onComplete : null;
        const dialogueMode = presentation.dialogueMode
            || (QUEST_DIALOGUE_IDS.has(dialogueId) || activeDialoguePresentation.speakerName === "Guild Warden Mara" ? "quest" : "standard");
        applyDialogueLayout(dialogueMode);
        if (getElements()?.dialogueChoices) getElements().dialogueChoices.replaceChildren();
        if (getElements()?.dialogueHint) getElements().dialogueHint.textContent = "SPACE — Continue";
        return presentDialogueLine();
    }

    function updateEncounterDialogueChoiceSelection() {
        const buttons = [...(getElements()?.dialogueChoices?.querySelectorAll?.(".map-dialogue-choice") || [])];
        buttons.forEach((button, index) => {
            const selected = index === selectedDialogueChoiceIndex;
            button.dataset.selected = String(selected);
            button.setAttribute("aria-current", selected ? "true" : "false");
        });
        return buttons.length;
    }

    function closeActiveDialogue() {
        reset();
        updateInteractionPrompt();
        return true;
    }

    function resolveEncounterDialogueChoice(choice) {
        const encounter = activeEncounterDialogue;
        if (!encounter) return false;
        if (choice === "attack") {
            closeActiveDialogue();
            return triggerEncounter(encounter);
        }
        closeActiveDialogue();
        return true;
    }

    function selectEncounterDialogueChoice(direction) {
        if (!activeEncounterDialogue) return false;
        const choices = ["ignore", "attack"];
        selectedDialogueChoiceIndex = (
            selectedDialogueChoiceIndex + Math.sign(direction) + choices.length
        ) % choices.length;
        updateEncounterDialogueChoiceSelection();
        return true;
    }

    function confirmEncounterDialogueChoice() {
        if (!activeEncounterDialogue) return false;
        return resolveEncounterDialogueChoice(selectedDialogueChoiceIndex === 1 ? "attack" : "ignore");
    }

    function openEncounterDialogue(encounter) {
        const dialogue = DIALOGUE_DEFINITIONS[encounter?.dialogueId || "townHighwayman"];
        if (!encounter || !dialogue?.length || !getElements()?.dialogue) return false;

        clearInput();
        activeDialogue = dialogue;
        activeDialogueIndex = 0;
        activeEncounterDialogue = encounter;
        selectedDialogueChoiceIndex = 0;
        activeDialoguePresentation = {
            speakerName: encounter.name,
            dialoguePortrait: AssetResolver.enemyAnimationFrame(encounter.enemyId, "idle", 1)
        };
        applyDialogueLayout("choice");

        if (getElements()?.dialogueChoices) {
            const choices = [
                { id: "ignore", label: "Ignore" },
                { id: "attack", label: "Attack" }
            ];
            const buttons = choices.map((choice, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "map-dialogue-choice";
                button.dataset.choice = choice.id;
                button.dataset.selected = String(index === 0);
                button.textContent = choice.label;
                button.addEventListener?.("click", () => {
                    selectedDialogueChoiceIndex = index;
                    resolveEncounterDialogueChoice(choice.id);
                });
                return button;
            });
            getElements().dialogueChoices.replaceChildren(...buttons);
        }
        if (getElements()?.dialogueHint) getElements().dialogueHint.textContent = "↑ ↓ Select · SPACE Confirm · ESC Ignore";
        presentDialogueLine();
        updateEncounterDialogueChoiceSelection();
        return true;
    }

    function advanceDialogue() {
        if (!activeDialogue || activeEncounterDialogue) return false;
        activeDialogueIndex += 1;
        if (activeDialogueIndex < activeDialogue.length) return presentDialogueLine();
        const onComplete = activeDialogueComplete;
        closeActiveDialogue();
        onComplete?.();
        return true;
    }

    function reset() {
        activeDialogue = null;
        activeDialogueIndex = 0;
        activeDialoguePresentation = null;
        activeDialogueComplete = null;
        activeEncounterDialogue = null;
        selectedDialogueChoiceIndex = 0;
        if (getElements()?.dialogue) getElements().dialogue.hidden = true;
        if (getElements()?.dialogueChoices) getElements().dialogueChoices.replaceChildren();
        if (getElements()?.dialogueHint) getElements().dialogueHint.textContent = "SPACE — Continue";
        presentDialoguePortrait(null);
    }

    function skipDialogue() {
        activeDialogueIndex = activeDialogue.length;
        advanceDialogue();
    }

    return { openDialogue, resolveEncounterDialogueChoice, selectEncounterDialogueChoice, confirmEncounterDialogueChoice, openEncounterDialogue, advanceDialogue, skipDialogue, reset,
        isOpen: () => Boolean(activeDialogue),
        isEncounterOpen: () => Boolean(activeEncounterDialogue)
    };
}
