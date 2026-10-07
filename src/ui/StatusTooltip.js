function getTooltipLines(status) {
    const lines = [];
    if (Number.isFinite(status.damagePerTurn)) lines.push(`${status.damagePerTurn} damage / turn`);
    if (Number.isFinite(status.healingPerTurn)) lines.push(`${status.healingPerTurn} healing / turn`);
    if (status.modifierText) lines.push(String(status.modifierText));
    if (Number.isFinite(status.remainingTurns)) {
        lines.push(`${status.remainingTurns} turn${status.remainingTurns === 1 ? "" : "s"} left`);
    }
    if (status.description) lines.push(String(status.description));
    return lines;
}

export function createStatusTooltip({ tooltip, title, lines } = {}) {
    function hide() {
        if (!tooltip) return;
        tooltip.hidden = true;
        tooltip.setAttribute("aria-hidden", "true");
    }

    function position(indicator) {
        if (!tooltip) return;
        const rect = indicator?.getBoundingClientRect?.() || {
            left: 8,
            right: 32,
            top: 8,
            bottom: 32,
            width: 24,
            height: 24
        };
        const viewportWidth = Math.max(320, Number(globalThis.innerWidth) || 1024);
        const viewportHeight = Math.max(320, Number(globalThis.innerHeight) || 768);
        const tooltipWidth = Math.min(240, viewportWidth - 16);
        const estimatedHeight = 118;
        const gap = 10;
        const centeredLeft = rect.left + (rect.width || rect.right - rect.left || 24) / 2 - tooltipWidth / 2;
        const left = Math.min(viewportWidth - tooltipWidth - 8, Math.max(8, centeredLeft));
        const aboveTop = rect.top - estimatedHeight - gap;
        const top = aboveTop >= 8
            ? aboveTop
            : Math.min(viewportHeight - estimatedHeight - 8, rect.bottom + gap);
        tooltip.style.setProperty("--tooltip-left", `${left}px`);
        tooltip.style.setProperty("--tooltip-top", `${Math.max(8, top)}px`);
    }

    function show(indicator, status) {
        if (!tooltip || !status) return false;
        title.textContent = status.name || status.id || "Status";
        const lineElements = getTooltipLines(status).map(line => {
            const paragraph = document.createElement("p");
            paragraph.textContent = line;
            return paragraph;
        });
        lines.replaceChildren(...lineElements);
        position(indicator);
        tooltip.hidden = false;
        tooltip.setAttribute("aria-hidden", "false");
        return true;
    }

    function renderIndicators(container, statuses, presentationById = {}) {
        const indicators = statuses.map(status => {
            const presentation = presentationById[status.id] || {
                symbol: status.icon || "●",
                className: status.className || "status-generic"
            };
            const indicator = document.createElement("button");
            const description = [status.name, ...getTooltipLines(status)].filter(Boolean).join(". ");
            indicator.type = "button";
            indicator.className = `status-icon ${presentation.className}`;
            const symbol = presentation.icon || presentation.symbol;
            if (presentation.iconAssetId) {
                const icon = document.createElement("img");
                icon.src = AssetResolver.status(presentation.iconAssetId);
                icon.alt = "";
                icon.setAttribute("aria-hidden", "true");
                icon.addEventListener("error", () => {
                    indicator.replaceChildren();
                    indicator.textContent = symbol;
                });
                indicator.appendChild(icon);
            } else {
                indicator.textContent = symbol;
            }
            indicator.setAttribute("aria-label", description);
            indicator.setAttribute("aria-describedby", "status-tooltip");
            indicator.dataset.status = status.id;
            indicator.addEventListener("mouseenter", () => show(indicator, status));
            indicator.addEventListener("mouseleave", hide);
            indicator.addEventListener("focus", () => show(indicator, status));
            indicator.addEventListener("blur", hide);
            return indicator;
        });
        hide();
        container.replaceChildren(...indicators);
        container.hidden = indicators.length === 0;
    }

    return { hide, renderIndicators, show };
}
import { AssetResolver } from "../core/AssetResolver.js";
