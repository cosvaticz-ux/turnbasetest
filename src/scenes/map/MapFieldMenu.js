import { PartyManager, PARTY_MEMBER_DEFINITIONS } from "../../core/PartyManager.js";
import { getShopDefinition } from "../../data/shops.js";
import { StatResolver } from "../../core/StatResolver.js";
import { getClassStatModifiers } from "../../core/ClassSystem.js";
import {
    getLevelExpRequirement,
    getRankProgress,
    LEVEL_CAP,
    normalizeProgression
} from "../../core/Progression.js";
import {
    EQUIPMENT_DEFINITIONS,
    EQUIPMENT_SLOT_DEFINITIONS,
    ITEM_DEFINITIONS
} from "../../data/battleContent.js";

// Inventory, equipment and shop share item presentation and the authoritative party state.
export function createMapFieldMenu({
    getElements, getGameState, isActive, isTransitionPending,
    isInteractionModalOpen, clearInput, persistWorldState, updateInteractionPrompt
}) {
    let selectedInventoryIndex = 0;
    let selectedInventoryTargetIndex = 0;
    let selectedInventoryCategory = "usable";
    let selectedEquipmentMemberIndex = 0;
    let selectedEquipmentSlotIndex = 1;
    let selectedShopIndex = 0;
    const IVEN_SHOP_ITEM_IDS = getShopDefinition("iven").itemIds;

    function getInventoryItem(itemId) {
        return getGameState()?.inventory?.find(item => item.id === itemId) || null;
    }

    function addInventoryItem(itemId, quantity = 1) {
        const state = getGameState();
        if (!state) return false;
        const existing = getInventoryItem(itemId);
        if (existing) existing.quantity = Math.max(0, Number(existing.quantity) || 0) + quantity;
        else state.inventory.push({ id: itemId, quantity });
        return true;
    }

    function getInventoryDefinition(entry) {
        if (!entry?.id) return null;
        return ITEM_DEFINITIONS[entry.id]
            || EQUIPMENT_DEFINITIONS[entry.id]
            || {
                id: entry.id,
                name: entry.name || entry.id,
                icon: "◇",
                category: entry.category || "etc",
                inventoryType: entry.inventoryType || "etc",
                description: entry.description || "No description is available for this item."
            };
    }

    function getInventoryType(definition) {
        if (definition?.inventoryType) return definition.inventoryType;
        if (definition?.slot) return "equipment";
        if (definition?.fieldUsable || definition?.battleUsable) return "usable";
        return "etc";
    }

    function getInventoryEntries(category = selectedInventoryCategory) {
        const inventoryEntries = (getGameState()?.inventory || [])
            .filter(entry => entry?.id && Number(entry.quantity) > 0)
            .map(entry => ({
                state: entry,
                definition: getInventoryDefinition(entry)
            }));
        if (category === "equipment") {
            const seen = new Set(inventoryEntries.map(entry => entry.state.id));
            for (const member of getRosterMembers()) {
                for (const itemId of Object.values(member.equipment || {})) {
                    if (!itemId || seen.has(itemId) || !EQUIPMENT_DEFINITIONS[itemId]) continue;
                    seen.add(itemId);
                    inventoryEntries.push({
                        state: { id: itemId, quantity: 0 },
                        definition: EQUIPMENT_DEFINITIONS[itemId],
                        owner: member
                    });
                }
            }
        }
        return inventoryEntries.filter(entry => !category || getInventoryType(entry.definition) === category);
    }

    function setInventoryCategory(category) {
        if (!["equipment", "usable", "etc"].includes(category)) return false;
        selectedInventoryCategory = category;
        selectedInventoryIndex = 0;
        selectedInventoryTargetIndex = 0;
        if (getElements()?.inventoryStatus) getElements().inventoryStatus.textContent = "";
        renderInventory();
        return true;
    }

    function cycleInventoryCategory(direction) {
        const categories = ["equipment", "usable", "etc"];
        const currentIndex = Math.max(0, categories.indexOf(selectedInventoryCategory));
        const nextIndex = (currentIndex + Math.sign(direction) + categories.length) % categories.length;
        return setInventoryCategory(categories[nextIndex]);
    }

    function renderInventoryTabs() {
        const buttons = [...(getElements()?.inventoryTabs?.querySelectorAll?.("[data-inventory-type]") || [])];
        for (const button of buttons) {
            const selected = button.dataset.inventoryType === selectedInventoryCategory;
            button.dataset.selected = String(selected);
            button.setAttribute("aria-current", selected ? "true" : "false");
        }
    }

    function renderProgression() {
        const story = getGameState()?.story || {};
        const progression = getGameState()?.party?.find(member => member.active !== false)?.progression || normalizeProgression(story);
        const level = progression.level;
        const levelPercent = level >= LEVEL_CAP ? 100 : Math.min(100, Math.max(0, (progression.exp / Math.max(1, getLevelExpRequirement(level))) * 100));
        const rankProgress = getRankProgress({ ...story, ...progression });
        const rankPercent = rankProgress.required > 0
            ? Math.min(100, Math.max(0, (rankProgress.current / rankProgress.required) * 100))
            : 100;

        if (getElements()?.progressionLevel) getElements().progressionLevel.textContent = `Lv. ${level}`;
        if (getElements()?.progressionExp) {
            getElements().progressionExp.textContent = level >= LEVEL_CAP ? "MAX LEVEL" : `EXP ${progression.exp} / ${getLevelExpRequirement(level)}`;
        }
        if (getElements()?.progressionExpFill) getElements().progressionExpFill.style.width = `${levelPercent}%`;
        if (getElements()?.progressionRank) getElements().progressionRank.textContent = `Rank ${rankProgress.rank}`;
        if (getElements()?.progressionRankProgress) {
            getElements().progressionRankProgress.textContent = rankProgress.nextRank
                ? `${rankProgress.current} / ${rankProgress.required} to Rank ${rankProgress.nextRank}`
                : "Prototype rank cap";
        }
        if (getElements()?.progressionRankFill) getElements().progressionRankFill.style.width = `${rankPercent}%`;
        return true;
    }

    function getFieldPartyMembers() {
        const state = getGameState();
        return state ? new PartyManager(state).getActiveMembers() : [];
    }

    function getRosterMembers() {
        return (getGameState()?.party || []).filter(member => member?.id);
    }

    function canUseFieldItem(definition, target) {
        if (!definition?.fieldUsable || !target) return false;
        if (definition.effectType === "heal") {
            return (Number(target.hp) > 0 || definition.canRevive === true)
                && Number(target.hp) < Number(target.maxHp);
        }
        if (definition.effectType === "cure-status" && definition.curesStatus === "poison") {
            return Number(target.poisonTurns) > 0
                || target.statusEffects?.some?.(status => status?.id === "poison");
        }
        return false;
    }

    function renderInventoryTargets(definition) {
        if (!definition?.fieldUsable) {
            getElements()?.inventoryTargets?.replaceChildren();
            if (getElements()?.inventoryUse) {
                getElements().inventoryUse.hidden = true;
                getElements().inventoryUse.disabled = true;
            }
            return null;
        }

        const partyMembers = getFieldPartyMembers();
        selectedInventoryTargetIndex = Math.max(
            0,
            Math.min(selectedInventoryTargetIndex, Math.max(0, partyMembers.length - 1))
        );

        if (getElements()?.inventoryTargets) {
            const nodes = partyMembers.map((member, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "map-inventory-target";
                button.dataset.selected = String(index === selectedInventoryTargetIndex);
                button.disabled = Number(member.hp) <= 0 && definition.canRevive !== true;
                const status = Number(member.poisonTurns) > 0 ? " · Poison" : "";
                button.innerHTML = `<strong>${member.name || member.id}</strong><small>HP ${Math.max(0, Number(member.hp) || 0)} / ${Math.max(1, Number(member.maxHp) || 1)}${status}</small>`;
                button.addEventListener?.("click", () => {
                    selectedInventoryTargetIndex = index;
                    renderInventory();
                });
                return button;
            });
            getElements().inventoryTargets.replaceChildren(...nodes);
        }

        const target = partyMembers[selectedInventoryTargetIndex];
        const usable = canUseFieldItem(definition, target);
        if (getElements()?.inventoryUse) {
            getElements().inventoryUse.hidden = false;
            getElements().inventoryUse.disabled = !usable;
            getElements().inventoryUse.textContent = `Use on ${target?.name || target?.id || "Party"}`;
        }
        return target;
    }

    function showFieldItemEffect(targetIndex, amount, type = "heal") {
        const targetButton = getElements()?.inventoryTargets?.children?.[targetIndex];
        if (!targetButton) return false;
        targetButton.classList.remove("is-field-healing", "is-field-cured");
        void targetButton.offsetWidth;
        targetButton.classList.add(type === "heal" ? "is-field-healing" : "is-field-cured");

        if (type === "heal" && amount > 0) {
            const pop = document.createElement("span");
            pop.className = "map-inventory-heal-pop";
            pop.textContent = `+${amount}`;
            pop.setAttribute("aria-hidden", "true");
            targetButton.appendChild(pop);
            setTimeout(() => pop.remove(), 820);
        }

        setTimeout(() => targetButton.classList.remove("is-field-healing", "is-field-cured"), 650);
        return true;
    }

    function useSelectedInventoryItem() {
        if (selectedInventoryCategory !== "usable") return false;
        const entries = getInventoryEntries();
        const selected = entries[selectedInventoryIndex];
        const definition = selected?.definition;
        const partyMembers = getFieldPartyMembers();
        const target = partyMembers[selectedInventoryTargetIndex];
        if (!selected || !definition?.fieldUsable || !target || !canUseFieldItem(definition, target)) {
            if (getElements()?.inventoryStatus) {
                getElements().inventoryStatus.textContent = definition?.effectType === "heal"
                    ? "That party member is already at full HP."
                    : "This item has no effect right now.";
            }
            return false;
        }

        let effectAmount = 0;
        let effectType = definition.effectType;
        if (definition.effectType === "heal") {
            const before = Math.max(0, Number(target.hp) || 0);
            const maxHp = Math.max(1, Number(target.maxHp) || 1);
            target.hp = Math.min(maxHp, before + Math.max(0, Number(definition.healAmount) || 0));
            if (target.hp > 0) {
                target.isDown = false;
                target.retreated = false;
            }
            effectAmount = target.hp - before;
        } else if (definition.effectType === "cure-status" && definition.curesStatus === "poison") {
            target.poisonTurns = 0;
            target.poisonDamage = 0;
            if (Array.isArray(target.statusEffects)) {
                target.statusEffects = target.statusEffects.filter(status => status?.id !== "poison");
            }
            effectType = "cure";
        } else {
            return false;
        }

        selected.state.quantity = Math.max(0, Number(selected.state.quantity) - 1);
        persistWorldState();
        renderInventory();
        showFieldItemEffect(selectedInventoryTargetIndex, effectAmount, effectType);
        if (getElements()?.inventoryStatus) {
            getElements().inventoryStatus.textContent = effectType === "heal"
                ? `${target.name || target.id} recovered ${effectAmount} HP.`
                : `${target.name || target.id} is no longer poisoned.`;
        }
        return true;
    }

    function moveInventoryTargetSelection(direction) {
        if (selectedInventoryCategory !== "usable") return false;
        const entries = getInventoryEntries();
        const selected = entries[selectedInventoryIndex];
        if (!selected?.definition?.fieldUsable) return false;
        const partyMembers = getFieldPartyMembers();
        if (partyMembers.length < 2) return false;
        selectedInventoryTargetIndex = (
            selectedInventoryTargetIndex + Math.sign(direction) + partyMembers.length
        ) % partyMembers.length;
        renderInventory();
        return true;
    }

    function createDefinitionIcon(definition, {
        wrapperClass = "",
        imageClass = "ui-icon-image",
        fallback = "◇"
    } = {}) {
        const wrapper = document.createElement("span");
        if (wrapperClass) wrapper.className = wrapperClass;
        wrapper.setAttribute("aria-hidden", "true");
        if (definition?.iconImage) {
            const image = document.createElement("img");
            image.className = imageClass;
            image.src = definition.iconImage;
            image.alt = "";
            image.draggable = false;
            wrapper.appendChild(image);
        } else {
            wrapper.textContent = definition?.icon || fallback;
        }
        return wrapper;
    }

    function setDefinitionIcon(container, definition, fallback = "◇") {
        if (!container) return false;
        if (definition?.iconImage) {
            const image = document.createElement("img");
            image.className = "map-inventory-detail-icon-image";
            image.src = definition.iconImage;
            image.alt = "";
            image.draggable = false;
            container.replaceChildren(image);
        } else {
            container.replaceChildren();
            container.textContent = definition?.icon || fallback;
        }
        return true;
    }

    function renderInventory() {
        renderProgression();
        renderInventoryTabs();
        const entries = getInventoryEntries();
        selectedInventoryIndex = Math.max(0, Math.min(selectedInventoryIndex, Math.max(0, entries.length - 1)));

        if (getElements()?.inventoryList) {
            const itemNodes = entries.map((entry, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "map-inventory-item";
                button.dataset.selected = String(index === selectedInventoryIndex);
                button.setAttribute("role", "option");
                button.setAttribute("aria-selected", String(index === selectedInventoryIndex));
                const icon = createDefinitionIcon(entry.definition, {
                    wrapperClass: "map-inventory-item-icon",
                    imageClass: "map-inventory-item-icon-image"
                });
                const name = document.createElement("strong");
                name.textContent = entry.definition.name;
                const quantity = document.createElement("small");
                quantity.textContent = entry.owner
                    ? `Equipped · ${entry.owner.name || entry.owner.id}`
                    : `×${entry.state.quantity}`;
                button.append(icon, name, quantity);
                button.addEventListener?.("click", () => {
                    selectedInventoryIndex = index;
                    if (getElements()?.inventoryStatus) getElements().inventoryStatus.textContent = "";
                    renderInventory();
                });
                return button;
            });
            if (!itemNodes.length) {
                const empty = document.createElement("p");
                empty.className = "map-inventory-empty";
                const labels = {
                    equipment: "No unequipped gear is in your pack.",
                    usable: "No usable items are in your pack.",
                    etc: "No ETC items are in your pack."
                };
                empty.textContent = labels[selectedInventoryCategory] || "Your field pack is empty.";
                itemNodes.push(empty);
            }
            getElements().inventoryList.replaceChildren(...itemNodes);
        }

        const selected = entries[selectedInventoryIndex];
        const definition = selected?.definition;
        const categoryLabels = {
            equipment: "Equipment",
            usable: "Usable Item",
            etc: "ETC"
        };
        setDefinitionIcon(getElements()?.inventoryIcon, definition);
        if (getElements()?.inventoryCategory) {
            const slot = definition?.slot
                ? EQUIPMENT_SLOT_DEFINITIONS.find(entry => entry.id === definition.slot)?.label
                : null;
            getElements().inventoryCategory.textContent = definition
                ? `${categoryLabels[getInventoryType(definition)] || definition.category || "Item"}${slot ? ` · ${slot}` : ""}`
                : categoryLabels[selectedInventoryCategory] || "Empty";
        }
        if (getElements()?.inventoryName) getElements().inventoryName.textContent = definition?.name || "No items";
        if (getElements()?.inventoryDescription) {
            getElements().inventoryDescription.textContent = definition?.description
                || "There are no items in this category.";
        }
        if (getElements()?.inventoryQuantity) {
            getElements().inventoryQuantity.textContent = selected?.owner
                ? `Equipped · ${selected.owner.name || selected.owner.id}`
                : `Quantity · ${selected?.state.quantity || 0}`;
        }
        if (getElements()?.inventoryHelp) {
            getElements().inventoryHelp.textContent = selectedInventoryCategory === "equipment"
                ? "Equipment appears here while unequipped. Press B to manage the party loadout."
                : selectedInventoryCategory === "usable"
                    ? "Field-usable medicine can be used here. Battle items remain available in combat."
                    : "ETC stores materials, quest objects, and miscellaneous items.";
        }
        renderInventoryTargets(definition);
        if (getElements()?.inventoryStatus && !definition) getElements().inventoryStatus.textContent = "";
        return entries.length;
    }

    function openInventory() {
        if (!isActive() || !getElements()?.inventory || isTransitionPending() || isInteractionModalOpen()) return false;
        clearInput();
        selectedInventoryIndex = 0;
        selectedInventoryTargetIndex = 0;
        selectedInventoryCategory = "usable";
        if (getElements()?.inventoryStatus) getElements().inventoryStatus.textContent = "";
        renderInventory();
        getElements().inventory.hidden = false;
        if (getElements()?.screen) getElements().screen.dataset.inventoryOpen = "true";
        updateInteractionPrompt();
        return true;
    }

    function closeInventory() {
        if (!getElements()?.inventory || getElements().inventory.hidden) return false;
        getElements().inventory.hidden = true;
        if (getElements()?.screen) delete getElements().screen.dataset.inventoryOpen;
        updateInteractionPrompt();
        return true;
    }

    function moveInventorySelection(direction) {
        const entries = getInventoryEntries();
        if (entries.length < 2) return false;
        selectedInventoryIndex = (selectedInventoryIndex + direction + entries.length) % entries.length;
        renderInventory();
        return true;
    }

    function getEquipmentMember() {
        const partyMembers = getRosterMembers();
        if (!partyMembers.length) return null;
        selectedEquipmentMemberIndex = Math.max(
            0,
            Math.min(selectedEquipmentMemberIndex, partyMembers.length - 1)
        );
        return partyMembers[selectedEquipmentMemberIndex];
    }

    function getEquipmentSlot() {
        selectedEquipmentSlotIndex = Math.max(
            0,
            Math.min(selectedEquipmentSlotIndex, EQUIPMENT_SLOT_DEFINITIONS.length - 1)
        );
        return EQUIPMENT_SLOT_DEFINITIONS[selectedEquipmentSlotIndex] || null;
    }

    function ensureMemberEquipment(member) {
        if (!member) return null;
        if (!member.equipment || typeof member.equipment !== "object") member.equipment = {};
        for (const slot of EQUIPMENT_SLOT_DEFINITIONS) {
            if (!(slot.id in member.equipment)) member.equipment[slot.id] = null;
        }
        return member.equipment;
    }

    function removeInventoryItem(itemId, quantity = 1) {
        const state = getGameState();
        const item = state?.inventory?.find(entry => entry.id === itemId);
        const amount = Math.max(1, Math.floor(Number(quantity) || 1));
        if (!item || Number(item.quantity) < amount) return false;
        item.quantity = Math.max(0, Number(item.quantity) - amount);
        return true;
    }

    function getCompatibleEquipmentEntries(slotId) {
        const state = getGameState();
        const partyManager = new PartyManager(state);
        return Object.values(EQUIPMENT_DEFINITIONS)
            .filter(definition => definition?.slot === slotId)
            .map(definition => ({
                state: state?.inventory?.find(entry => entry.id === definition.id) || { id: definition.id, quantity: 0 },
                definition,
                owner: partyManager.getEquipmentOwner(definition.id)
            }))
            .filter(entry => Number(entry.state.quantity) > 0 || entry.owner);
    }

    function setEquipmentStatus(message = "") {
        if (getElements()?.equipmentStatus) getElements().equipmentStatus.textContent = message;
    }

    function resolveMemberStats(member) {
        if (!member) return null;
        const definition = PARTY_MEMBER_DEFINITIONS[member.id] || {};
        const stats = new StatResolver({ equipmentDefinitions: EQUIPMENT_DEFINITIONS }).resolve({
            baseStats: definition,
            passiveModifiers: getClassStatModifiers(member,definition),
            equipment: member.equipment,
            statusEffects: member.statusEffects
        });
        member.maxHp = stats.maxHp;
        member.hp = Math.min(stats.maxHp, Math.max(0, Number(member.hp) || 0));
        member.attack = stats.attack;
        member.defense = stats.defense;
        member.speed = stats.speed;
        member.maxAp = stats.maxAp;
        return stats;
    }

    function renderEquipment() {
        const partyMembers = getRosterMembers();
        const member = getEquipmentMember();
        const slot = getEquipmentSlot();
        const equipment = ensureMemberEquipment(member);
        const equippedItemId = slot ? equipment?.[slot.id] : null;
        const equippedDefinition = equippedItemId ? EQUIPMENT_DEFINITIONS[equippedItemId] : null;

        if (getElements()?.equipmentPartyTabs) {
            const tabs = partyMembers.map((partyMember, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "map-equipment-party-tab";
                button.dataset.selected = String(index === selectedEquipmentMemberIndex);
                button.dataset.active = String(partyMember.active !== false);
                button.textContent = `${partyMember.name || partyMember.id} · ${partyMember.active !== false ? "Active" : "Reserve"}`;
                button.addEventListener?.("click", () => {
                    selectedEquipmentMemberIndex = index;
                    setEquipmentStatus("");
                    renderEquipment();
                });
                return button;
            });
            getElements().equipmentPartyTabs.replaceChildren(...tabs);
        }

        if (getElements()?.equipmentSlots) {
            const slots = EQUIPMENT_SLOT_DEFINITIONS.map((slotDefinition, index) => {
                const itemId = equipment?.[slotDefinition.id] || null;
                const itemDefinition = itemId ? EQUIPMENT_DEFINITIONS[itemId] : null;
                const button = document.createElement("button");
                button.type = "button";
                button.className = "map-equipment-slot";
                button.dataset.selected = String(index === selectedEquipmentSlotIndex);
                button.dataset.slotId = slotDefinition.id;
                button.innerHTML = `<span aria-hidden="true">${slotDefinition.icon || "◇"}</span><div><small>${slotDefinition.label}</small><strong>${itemDefinition?.name || "Empty"}</strong></div>`;
                button.addEventListener?.("click", () => {
                    selectedEquipmentSlotIndex = index;
                    setEquipmentStatus("");
                    renderEquipment();
                });
                return button;
            });
            getElements().equipmentSlots.replaceChildren(...slots);
        }

        if (getElements()?.equipmentSlotLabel) getElements().equipmentSlotLabel.textContent = slot?.label || "Slot";
        if (getElements()?.equipmentEquippedName) getElements().equipmentEquippedName.textContent = equippedDefinition?.name || "Empty";
        if (getElements()?.equipmentDescription) {
            getElements().equipmentDescription.textContent = equippedDefinition?.description
                || `No ${slot?.label?.toLowerCase() || "equipment"} is currently equipped.`;
        }
        if (getElements()?.equipmentUnequip) {
            getElements().equipmentUnequip.disabled = !equippedDefinition;
            getElements().equipmentUnequip.textContent = equippedDefinition ? `Unequip ${equippedDefinition.name}` : "Unequip";
        }

        const resolvedStats = resolveMemberStats(member);
        if (getElements()?.equipmentMemberStats) {
            getElements().equipmentMemberStats.textContent = resolvedStats
                ? `HP ${resolvedStats.maxHp} · ATK ${resolvedStats.attack} · DEF ${resolvedStats.defense} · SPD ${resolvedStats.speed} · AP ${resolvedStats.maxAp}`
                : "No party member selected";
        }
        if (getElements()?.equipmentActiveToggle) {
            getElements().equipmentActiveToggle.textContent = member?.active !== false ? "Move to Reserve" : "Set Active";
            getElements().equipmentActiveToggle.disabled = !member;
        }

        const compatibleEntries = getCompatibleEquipmentEntries(slot?.id);
        if (getElements()?.equipmentOptions) {
            const nodes = compatibleEntries.map(entry => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "map-equipment-option";
                const ownership = entry.owner
                    ? `Equipped · ${entry.owner.name || entry.owner.id}`
                    : `Inventory ×${entry.state.quantity}`;
                button.innerHTML = `<span aria-hidden="true">${entry.definition.icon || "◇"}</span><div><strong>${entry.definition.name}</strong><small>${ownership}</small></div><b>${entry.owner?.id === member?.id ? "Equipped" : "Equip"}</b>`;
                button.disabled = entry.owner?.id === member?.id;
                button.addEventListener?.("click", () => equipSelectedEquipmentItem(entry.definition.id));
                return button;
            });
            if (!nodes.length) {
                const empty = document.createElement("p");
                empty.className = "map-equipment-empty";
                empty.textContent = "No compatible equipment in Inventory.";
                nodes.push(empty);
            }
            getElements().equipmentOptions.replaceChildren(...nodes);
        }
        return Boolean(member && slot);
    }

    function equipSelectedEquipmentItem(itemId) {
        const member = getEquipmentMember();
        const slot = getEquipmentSlot();
        const definition = EQUIPMENT_DEFINITIONS[itemId];
        const result = new PartyManager(getGameState()).equip(member?.id, itemId, slot?.id, EQUIPMENT_DEFINITIONS, { transfer: true });
        if (!result.changed) {
            setEquipmentStatus(result.reason || "That item cannot be equipped in this slot.");
            return false;
        }
        resolveMemberStats(member);
        if (result.transferredFrom) resolveMemberStats(result.transferredFrom);
        persistWorldState();
        const transfer = result.transferredFrom ? ` Transferred from ${result.transferredFrom.name || result.transferredFrom.id}.` : "";
        setEquipmentStatus(`${member.name || member.id} equipped ${definition.name}.${transfer}`);
        renderEquipment();
        return true;
    }

    function unequipSelectedEquipmentItem() {
        const member = getEquipmentMember();
        const slot = getEquipmentSlot();
        const equipment = ensureMemberEquipment(member);
        const itemId = slot ? equipment?.[slot.id] : null;
        const definition = itemId ? EQUIPMENT_DEFINITIONS[itemId] : null;
        if (!member || !slot || !itemId || !definition) {
            setEquipmentStatus("That slot is already empty.");
            return false;
        }

        const result = new PartyManager(getGameState()).unequip(member.id, slot.id);
        if (!result.changed) return false;
        resolveMemberStats(member);
        persistWorldState();
        setEquipmentStatus(`${member.name || member.id} unequipped ${definition.name}. It is back in Inventory.`);
        renderEquipment();
        return true;
    }

    function openEquipment() {
        if (!isActive() || !getElements()?.equipment || isTransitionPending() || isInteractionModalOpen()) return false;
        clearInput();
        selectedEquipmentMemberIndex = 0;
        selectedEquipmentSlotIndex = Math.min(1, EQUIPMENT_SLOT_DEFINITIONS.length - 1);
        setEquipmentStatus("");
        renderEquipment();
        getElements().equipment.hidden = false;
        if (getElements()?.screen) getElements().screen.dataset.equipmentOpen = "true";
        updateInteractionPrompt();
        return true;
    }

    function closeEquipment() {
        if (!getElements()?.equipment || getElements().equipment.hidden) return false;
        getElements().equipment.hidden = true;
        if (getElements()?.screen) delete getElements().screen.dataset.equipmentOpen;
        updateInteractionPrompt();
        return true;
    }

    function moveEquipmentMemberSelection(direction) {
        const partyMembers = getRosterMembers();
        if (partyMembers.length < 2) return false;
        selectedEquipmentMemberIndex = (
            selectedEquipmentMemberIndex + Math.sign(direction) + partyMembers.length
        ) % partyMembers.length;
        setEquipmentStatus("");
        renderEquipment();
        return true;
    }

    function moveEquipmentSlotSelection(direction) {
        if (EQUIPMENT_SLOT_DEFINITIONS.length < 2) return false;
        selectedEquipmentSlotIndex = (
            selectedEquipmentSlotIndex + Math.sign(direction) + EQUIPMENT_SLOT_DEFINITIONS.length
        ) % EQUIPMENT_SLOT_DEFINITIONS.length;
        setEquipmentStatus("");
        renderEquipment();
        return true;
    }

    function activateSelectedEquipmentSlot() {
        const member = getEquipmentMember();
        const slot = getEquipmentSlot();
        const equipment = ensureMemberEquipment(member);
        if (slot && equipment?.[slot.id]) return unequipSelectedEquipmentItem();
        if (getCompatibleEquipmentEntries(slot?.id).length) {
            setEquipmentStatus("Choose an item and use its explicit Equip action.");
            return false;
        }
        setEquipmentStatus("No compatible equipment is available.");
        return false;
    }

    function toggleSelectedPartyMemberActive() {
        const member = getEquipmentMember();
        if (!member) return false;
        const result = new PartyManager(getGameState()).setActive(member.id, member.active === false);
        if (!result.changed) {
            setEquipmentStatus(result.reason);
            return false;
        }
        persistWorldState();
        setEquipmentStatus(`${member.name || member.id} moved to ${member.active !== false ? "the active party" : "reserve"}.`);
        renderEquipment();
        return true;
    }

    function getIvenShopEntries() {
        return IVEN_SHOP_ITEM_IDS
            .map(itemId => ITEM_DEFINITIONS[itemId])
            .filter(Boolean);
    }

    function openShop() {
        if (!getElements()?.shop) return false;
        clearInput();
        selectedShopIndex = 0;
        getElements().shop.hidden = false;
        if (getElements().shopStatus) getElements().shopStatus.textContent = "";
        updateShopPresentation();
        return true;
    }

    function closeShop() {
        if (!getElements()?.shop || getElements().shop.hidden) return false;
        getElements().shop.hidden = true;
        updateInteractionPrompt();
        return true;
    }

    function updateShopPresentation() {
        const currency = Math.max(0, Number(getGameState()?.story?.currency) || 0);
        const entries = getIvenShopEntries();
        selectedShopIndex = Math.max(0, Math.min(selectedShopIndex, Math.max(0, entries.length - 1)));
        if (getElements()?.shopCurrency) getElements().shopCurrency.textContent = String(currency);

        if (getElements()?.shopList) {
            const nodes = entries.map((definition, index) => {
                const price = Math.max(0, Number(definition.shopPrice ?? definition.value) || 0);
                const row = document.createElement("button");
                row.type = "button";
                row.className = "map-shop-item";
                row.dataset.selected = String(index === selectedShopIndex);
                row.disabled = currency < price;
                const icon = createDefinitionIcon(definition, {
                    wrapperClass: "map-shop-item-icon",
                    imageClass: "map-shop-item-icon-image"
                });
                const details = document.createElement("div");
                const name = document.createElement("strong");
                name.textContent = definition.name;
                const description = document.createElement("small");
                description.textContent = definition.description;
                details.append(name, description);
                const priceLabel = document.createElement("b");
                priceLabel.textContent = `${price} cr`;
                row.append(icon, details, priceLabel);
                row.addEventListener?.("pointerenter", () => {
                    selectedShopIndex = index;
                    updateShopSelection();
                });
                row.addEventListener?.("click", () => {
                    selectedShopIndex = index;
                    buyShopItem(definition.id);
                });
                return row;
            });
            getElements().shopList.replaceChildren(...nodes);
        }
        return entries.length;
    }

    function updateShopSelection() {
        for (const [index, node] of [...(getElements()?.shopList?.children || [])].entries()) {
            node.dataset.selected = String(index === selectedShopIndex);
        }
    }

    function moveShopSelection(direction) {
        const entries = getIvenShopEntries();
        if (entries.length < 2) return false;
        selectedShopIndex = (selectedShopIndex + Math.sign(direction) + entries.length) % entries.length;
        updateShopSelection();
        return true;
    }

    function buyShopItem(itemId) {
        const state = getGameState();
        const definition = ITEM_DEFINITIONS[itemId];
        const price = Math.max(0, Number(definition?.shopPrice ?? definition?.value) || 0);
        if (!state || !definition) return false;
        if (Number(state.story.currency) < price) {
            if (getElements()?.shopStatus) getElements().shopStatus.textContent = `You need ${price} crowns.`;
            return false;
        }

        state.story.currency -= price;
        addInventoryItem(itemId, 1);
        if (getElements()?.shopStatus) getElements().shopStatus.textContent = `${definition.name} added to inventory.`;
        persistWorldState();
        updateShopPresentation();
        return true;
    }

    function buySelectedShopItem() {
        const definition = getIvenShopEntries()[selectedShopIndex];
        if (definition) buyShopItem(definition.id);
    }

    return {
        setInventoryCategory,
        cycleInventoryCategory,
        useSelectedInventoryItem,
        moveInventoryTargetSelection,
        openInventory,
        closeInventory,
        moveInventorySelection,
        unequipSelectedEquipmentItem,
        openEquipment,
        closeEquipment,
        moveEquipmentMemberSelection,
        moveEquipmentSlotSelection,
        activateSelectedEquipmentSlot,
        toggleSelectedPartyMemberActive,
        openShop,
        closeShop,
        moveShopSelection,
        buySelectedShopItem
    };
}
