export function createBattleLog(logElement) {
    return {
        add(message) {
            if (!logElement || !message) return false;
            const entry = document.createElement("p");
            entry.textContent = message;
            logElement.appendChild(entry);
            logElement.scrollTop = logElement.scrollHeight;
            return true;
        },
        clear() {
            logElement?.replaceChildren();
        }
    };
}
