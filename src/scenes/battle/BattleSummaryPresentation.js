import { LEVEL_CAP } from "../../core/Progression.js";
import { getItemDefinition } from "../../data/items.js";

// Renders already-resolved rewards; the scene owns result gates, rewards and post-battle scheduling.
export function createBattleSummaryPresentation({ elements, prefersReducedMotion, scheduleVisual, schedulePostBattleTask }) {
    function summaryPercent(current, required, complete = false) {
        if (complete) return 100;
        const safeRequired = Math.max(0, Number(required) || 0);
        if (safeRequired <= 0) return 100;
        return Math.min(100, Math.max(0, (Math.max(0, Number(current) || 0) / safeRequired) * 100));
    }

    function setSummaryMeterWidth(fill, percent, { instant = false } = {}) {
        if (!fill) return false;
        fill.style.transition = instant ? "none" : "";
        fill.style.width = `${Math.min(100, Math.max(0, Number(percent) || 0))}%`;
        if (instant) {
            void fill.offsetWidth;
            fill.style.transition = "";
        }
        return true;
    }

    function createSummaryMeter({
        type,
        title,
        valueText,
        detailText,
        initialPercent = 0
    }) {
        const card = document.createElement("section");
        card.className = `battle-summary-meter-card battle-summary-${type}`;

        const header = document.createElement("div");
        header.className = "battle-summary-meter-header";

        const label = document.createElement("span");
        label.className = "battle-summary-meter-label";
        label.textContent = title;

        const value = document.createElement("strong");
        value.className = "battle-summary-meter-value";
        value.textContent = valueText;

        header.append(label, value);

        const track = document.createElement("div");
        track.className = "battle-summary-meter-track";
        track.setAttribute("aria-hidden", "true");

        const fill = document.createElement("i");
        fill.className = "battle-summary-meter-fill";
        fill.style.width = `${summaryPercent(initialPercent, 100)}%`;
        track.appendChild(fill);

        const detail = document.createElement("small");
        detail.className = "battle-summary-meter-detail";
        detail.textContent = detailText;

        card.append(header, track, detail);
        return { card, value, fill, detail };
    }

    function pulseSummaryPromotion(card) {
        if (!card) return;
        card.classList.remove("is-promotion");
        void card.offsetWidth;
        card.classList.add("is-promotion");
        scheduleVisual(() => card.classList.remove("is-promotion"), 650);
    }

    function animateSummaryProgress(rewards, expMeter, rankMeter) {
        if (!rewards || !expMeter || !rankMeter) return false;

        const expStartPercent = summaryPercent(
            rewards.expBefore,
            rewards.levelExpBefore,
            rewards.levelBefore >= LEVEL_CAP
        );
        const expFinalPercent = summaryPercent(
            rewards.currentExp,
            rewards.nextLevelExp,
            rewards.levelAfter >= LEVEL_CAP
        );
        const rankBefore = rewards.rankProgressBefore || {};
        const rankAfter = rewards.rankProgress || {};
        const rankStartPercent = summaryPercent(
            rankBefore.current,
            rankBefore.required,
            !rankBefore.nextRank
        );
        const rankFinalPercent = summaryPercent(
            rankAfter.current,
            rankAfter.required,
            !rankAfter.nextRank
        );

        setSummaryMeterWidth(expMeter.fill, expStartPercent, { instant: true });
        setSummaryMeterWidth(rankMeter.fill, rankStartPercent, { instant: true });

        expMeter.value.textContent = `Lv. ${rewards.levelBefore}`;
        expMeter.detail.textContent = rewards.levelBefore >= LEVEL_CAP
            ? "MAX LEVEL"
            : `EXP ${rewards.expBefore} / ${rewards.levelExpBefore}`;
        rankMeter.value.textContent = `Rank ${rewards.rankBefore}`;
        rankMeter.detail.textContent = rankBefore.nextRank
            ? `${rankBefore.current} / ${rankBefore.required} to Rank ${rankBefore.nextRank}`
            : "Prototype rank cap";

        if (prefersReducedMotion()) {
            setSummaryMeterWidth(expMeter.fill, expFinalPercent, { instant: true });
            setSummaryMeterWidth(rankMeter.fill, rankFinalPercent, { instant: true });
            expMeter.value.textContent = `Lv. ${rewards.levelAfter}`;
            expMeter.detail.textContent = rewards.levelAfter >= LEVEL_CAP
                ? "MAX LEVEL"
                : `EXP ${rewards.currentExp} / ${rewards.nextLevelExp}`;
            rankMeter.value.textContent = `Rank ${rewards.rankAfter}`;
            rankMeter.detail.textContent = rankAfter.nextRank
                ? `${rankAfter.current} / ${rankAfter.required} to Rank ${rankAfter.nextRank}`
                : "Prototype rank cap";
            return true;
        }

        const expPromotion = rewards.levelAfter > rewards.levelBefore;
        const rankPromotion = rewards.rankAfter !== rewards.rankBefore;
        const startDelay = 180;
        const fillDuration = 850;
        const resetDelay = 1080;
        const finalDelay = 1190;

        schedulePostBattleTask(() => {
            setSummaryMeterWidth(expMeter.fill, expPromotion ? 100 : expFinalPercent);
            setSummaryMeterWidth(rankMeter.fill, rankPromotion ? 100 : rankFinalPercent);
        }, startDelay);

        schedulePostBattleTask(() => {
            if (!expPromotion) {
                expMeter.value.textContent = `Lv. ${rewards.levelAfter}`;
                expMeter.detail.textContent = rewards.levelAfter >= LEVEL_CAP
                    ? "MAX LEVEL"
                    : `EXP ${rewards.currentExp} / ${rewards.nextLevelExp}`;
            }
            if (!rankPromotion) {
                rankMeter.value.textContent = `Rank ${rewards.rankAfter}`;
                rankMeter.detail.textContent = rankAfter.nextRank
                    ? `${rankAfter.current} / ${rankAfter.required} to Rank ${rankAfter.nextRank}`
                    : "Prototype rank cap";
            }
        }, startDelay + fillDuration);

        if (expPromotion) {
            schedulePostBattleTask(() => {
                expMeter.value.textContent = `LEVEL UP · Lv. ${rewards.levelAfter}`;
                expMeter.detail.textContent = rewards.levelAfter >= LEVEL_CAP
                    ? "MAX LEVEL"
                    : `Next · ${rewards.nextLevelExp} EXP`;
                pulseSummaryPromotion(expMeter.card);
            }, startDelay + fillDuration);

            schedulePostBattleTask(() => {
                setSummaryMeterWidth(expMeter.fill, 0, { instant: true });
            }, resetDelay);

            schedulePostBattleTask(() => {
                setSummaryMeterWidth(expMeter.fill, expFinalPercent);
                expMeter.value.textContent = `Lv. ${rewards.levelAfter}`;
                expMeter.detail.textContent = rewards.levelAfter >= LEVEL_CAP
                    ? "MAX LEVEL"
                    : `EXP ${rewards.currentExp} / ${rewards.nextLevelExp}`;
            }, finalDelay);
        }

        if (rankPromotion) {
            schedulePostBattleTask(() => {
                rankMeter.value.textContent = `RANK UP · ${rewards.rankAfter}`;
                rankMeter.detail.textContent = rankAfter.nextRank
                    ? `Next Rank · ${rankAfter.required}`
                    : "Prototype rank cap";
                pulseSummaryPromotion(rankMeter.card);
            }, startDelay + fillDuration);

            schedulePostBattleTask(() => {
                setSummaryMeterWidth(rankMeter.fill, 0, { instant: true });
            }, resetDelay);

            schedulePostBattleTask(() => {
                setSummaryMeterWidth(rankMeter.fill, rankFinalPercent);
                rankMeter.value.textContent = `Rank ${rewards.rankAfter}`;
                rankMeter.detail.textContent = rankAfter.nextRank
                    ? `${rankAfter.current} / ${rankAfter.required} to Rank ${rankAfter.nextRank}`
                    : "Prototype rank cap";
            }, finalDelay);
        }

        return true;
    }

    function render(rewards) {
        const reward = document.createElement("p");
        reward.className = "battle-summary-reward";
        const lootText = (rewards.loot?.items || [])
            .map(item => `${getItemDefinition(item.id).name} ×${item.quantity}`)
            .join(" · ");
        const levelText = rewards.levelsGained > 0 ? ` · LEVEL UP ${rewards.levelBefore} → ${rewards.levelAfter}` : "";
        const pointText = rewards.skillPointsGained > 0 ? ` · SKILL POINT +${rewards.skillPointsGained}` : "";
        reward.textContent = `EXP +${rewards.exp || 0}${levelText}${pointText}${lootText ? ` · Loot: ${lootText}` : ""}`;

        const progression = document.createElement("div");
        progression.className = "battle-summary-progression";

        const expBeforePercent = summaryPercent(
            rewards.expBefore,
            rewards.levelExpBefore,
            rewards.levelBefore >= LEVEL_CAP
        );
        const expMeter = createSummaryMeter({
            type: "exp",
            title: "CHARACTER LEVEL",
            valueText: `Lv. ${rewards.levelBefore}`,
            detailText: rewards.levelBefore >= LEVEL_CAP
                ? "MAX LEVEL"
                : `EXP ${rewards.expBefore} / ${rewards.levelExpBefore}`,
            initialPercent: expBeforePercent
        });

        const rankBefore = rewards.rankProgressBefore || {};
        const rankBeforePercent = summaryPercent(
            rankBefore.current,
            rankBefore.required,
            !rankBefore.nextRank
        );
        const rankMeter = createSummaryMeter({
            type: "rank",
            title: "GUILD RANK",
            valueText: `Rank ${rewards.rankBefore}`,
            detailText: rankBefore.nextRank
                ? `${rankBefore.current} / ${rankBefore.required} to Rank ${rankBefore.nextRank}`
                : "Prototype rank cap",
            initialPercent: rankBeforePercent
        });

        progression.append(expMeter.card, rankMeter.card);

        const breakdown = document.createElement("p");
        breakdown.className = "battle-summary-breakdown";
        const rewardedEnemies = rewards.enemyRewards.filter(entry => entry.exp > 0 || entry.rankPoints > 0);
        breakdown.textContent = rewardedEnemies.length
            ? rewardedEnemies.map(entry => `${entry.name}: ${entry.exp} EXP`).join(" · ")
            : "No combat EXP earned.";

        elements.battleSummaryContent.replaceChildren(reward, progression, breakdown);
        animateSummaryProgress(rewards, expMeter, rankMeter);
    }

    return { render };
}
