import { AssetResolver } from "../core/AssetResolver.js";

function getPlayerDisplayName(entity) {
    if (entity?.id === "dummy" && (!entity.name || entity.name === "Dummy")) return "Lucy";
    return entity?.name || entity?.id || "Party Member";
}

function getPlayerAssetId(entity) {
    return entity?.profileAssetId
        || (entity?.id === "luke" ? "luke" : null)
        || (entity?.id === "dummy" ? "lucy" : null);
}

function getPlayerProfileSource(entity) {
    const profileAssetId = getPlayerAssetId(entity);
    if (profileAssetId) return AssetResolver.playerProfile(profileAssetId);
    if (entity?.portraitAssetId) return AssetResolver.playerPortrait(entity.portraitAssetId);
    return null;
}

function getPlayerBannerSource(entity) {
    const assetId = getPlayerAssetId(entity);
    return assetId
        ? `./assets/images/character/player/${assetId}/profile/banner-${assetId}.png`
        : null;
}

function createCombatantHud(slot, entity) {
    const isPlayer = slot.side === "player";
    const displayName = isPlayer ? getPlayerDisplayName(entity) : entity.name;
    if (isPlayer && entity?.id === "dummy" && entity.name === "Dummy") entity.name = displayName;

    const hud = document.createElement("div");
    hud.className = `entity-hud-group ${slot.side}-entity-hud`;
    hud.dataset.entityId = entity.id;
    hud.dataset.formationSlot = slot.id;
    hud.style.setProperty("--hud-offset-x", `${slot.hudOffsetX || 0}px`);
    hud.style.setProperty("--hud-offset-y", `${slot.hudOffsetY || 0}px`);
    if (slot.hudAnchor) hud.dataset.hudAnchor = slot.hudAnchor;
    hud.setAttribute("aria-label", `${displayName} combat status`);

    const card = document.createElement("article");
    card.className = "entity-hud-card";
    if (isPlayer) {
        card.style.gridTemplateColumns = "72px minmax(0, 1fr)";
        card.style.minHeight = "76px";
    }

    const portrait = document.createElement("span");
    portrait.className = "portrait-placeholder";

    if (slot.side === "enemy") {
        const threatTier = ["standard", "elite", "boss"].includes(entity.threatTier)
            ? entity.threatTier
            : "standard";
        portrait.classList.add("enemy-threat-marker", `threat-${threatTier}`);
        portrait.dataset.threatTier = threatTier;
        portrait.textContent = "☠";
        portrait.setAttribute("aria-label", `${displayName} threat level: ${threatTier}`);
    } else {
        const bannerSource = getPlayerBannerSource(entity);
        const profileSource = getPlayerProfileSource(entity);
        const portraitSource = bannerSource || profileSource;

        portrait.classList.add("party-profile-frame");
        portrait.style.width = "72px";
        portrait.style.height = "72px";
        portrait.style.minHeight = "72px";
        portrait.setAttribute("aria-label", `${displayName} portrait`);

        if (portraitSource) {
            const portraitImage = document.createElement("img");
            portraitImage.className = "portrait-image party-profile-image";
            portraitImage.src = portraitSource;
            portraitImage.alt = `${displayName} portrait`;
            portraitImage.style.objectFit = "cover";
            portraitImage.style.objectPosition = "center";

            // Banner artwork replaces the old profile image only inside the
            // existing white portrait frame. The black HUD area stays untouched.
            if (!bannerSource) {
                portraitImage.style.objectPosition = "center 8%";
                portraitImage.style.transform = "scale(1.9)";
                portraitImage.style.transformOrigin = "50% 18%";
            }

            portraitImage.addEventListener("error", () => {
                if (bannerSource && profileSource && portraitImage.src !== profileSource) {
                    portraitImage.src = profileSource;
                    portraitImage.style.objectPosition = "center 8%";
                    portraitImage.style.transform = "scale(1.9)";
                    portraitImage.style.transformOrigin = "50% 18%";
                    return;
                }
                portrait.replaceChildren();
            });
            portrait.appendChild(portraitImage);
        }
    }

    const content = document.createElement("div");
    content.className = "entity-hud-content";

    const titleRow = document.createElement("div");
    titleRow.className = "hud-title-row";
    const name = document.createElement("h2");
    name.textContent = displayName;
    name.title = displayName;
    if (isPlayer) name.style.fontSize = "clamp(0.84rem, 1.08vw, 1.02rem)";
    const turnPip = document.createElement("span");
    turnPip.className = "turn-pip";
    turnPip.setAttribute("aria-hidden", "true");
    titleRow.append(name, turnPip);

    const hpBar = document.createElement("div");
    hpBar.className = "hud-bar hp-bar";
    hpBar.setAttribute("role", "progressbar");
    hpBar.setAttribute("aria-label", `${displayName} health`);
    if (isPlayer) hpBar.style.height = "9px";
    const hpFill = document.createElement("span");
    hpFill.className = "hud-bar-fill";
    hpBar.appendChild(hpFill);

    const values = document.createElement("div");
    values.className = "hud-values";
    const hp = document.createElement("p");
    const ap = document.createElement("p");
    ap.className = "hud-ap";
    if (isPlayer) {
        hp.style.fontSize = "clamp(0.6rem, 0.8vw, 0.76rem)";
        ap.style.fontSize = "clamp(0.6rem, 0.8vw, 0.76rem)";
    }
    values.append(hp);
    if (slot.side === "player") values.append(ap);

    const statuses = document.createElement("div");
    statuses.className = "status-list external-status-list";
    statuses.setAttribute("aria-label", `${displayName} status effects`);
    statuses.setAttribute("aria-live", "polite");

    content.append(titleRow, hpBar, values);
    card.append(portrait, content);
    hud.append(card, statuses);
    return { hud, card, name, hp, ap, hpBar, hpFill, statuses };
}

export { createCombatantHud };
