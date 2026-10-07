import { AudioManager } from "../core/AudioManager.js";

const TYPEWRITER_INTERVAL_MS = 28;

export function createDialogueTypewriter({
    dialogue = document.getElementById("map-dialogue"),
    textElement = document.getElementById("map-dialogue-text"),
    intervalMs = TYPEWRITER_INTERVAL_MS
} = {}) {
    if (!dialogue || !textElement || typeof MutationObserver !== "function") {
        return { destroy() {}, skip() { return false; }, isTyping: () => false };
    }

    let timer = null;
    let characters = [];
    let index = 0;
    let renderedText = textElement.textContent || "";
    let typing = false;

    const observe = () => observer.observe(dialogue, {
        attributes: true,
        attributeFilter: ["hidden"],
        childList: true,
        characterData: true,
        subtree: true
    });

    const writeText = value => {
        observer.disconnect();
        renderedText = value;
        textElement.textContent = value;
        observe();
    };

    const stopTyping = () => {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
        typing = false;
        AudioManager.stopLoopingSFX("typewriter");
    };

    const finishLine = () => {
        const completeText = characters.join("");
        stopTyping();
        writeText(completeText);
        index = characters.length;
        return true;
    };

    const startLine = text => {
        stopTyping();
        characters = Array.from(String(text || ""));
        index = 0;
        writeText("");

        if (!characters.length || dialogue.hidden) return false;

        typing = true;
        AudioManager.startLoopingSFX("typewriter");
        const step = () => {
            if (dialogue.hidden) {
                stopTyping();
                return;
            }
            index += 1;
            writeText(characters.slice(0, index).join(""));
            if (index >= characters.length) stopTyping();
        };
        timer = setInterval(step, Math.max(12, Number(intervalMs) || TYPEWRITER_INTERVAL_MS));
        return true;
    };

    const observer = new MutationObserver(() => {
        if (dialogue.hidden) {
            stopTyping();
            return;
        }
        const nextText = textElement.textContent || "";
        if (nextText === renderedText) return;
        startLine(nextText);
    });

    const handleKeyDown = event => {
        if (!typing || dialogue.hidden || String(event.key || "") !== " ") return;
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        finishLine();
    };

    observe();
    document.addEventListener("keydown", handleKeyDown, true);

    return {
        destroy() {
            stopTyping();
            observer.disconnect();
            document.removeEventListener("keydown", handleKeyDown, true);
        },
        skip() {
            if (!typing) return false;
            return finishLine();
        },
        isTyping: () => typing
    };
}

export function installDialogueTypewriter() {
    return createDialogueTypewriter();
}

export { TYPEWRITER_INTERVAL_MS };