import { createMapFieldMenu } from './MapFieldMenu.js';
import { createMapSkillMenu } from './MapSkillMenu.js';
import { createMapDialogue } from './MapDialogue.js';
export function getElements() {
    return {
        screen: document.getElementById("map-screen"),
        viewport: document.getElementById("map-viewport"),
        encounterOverlay: document.getElementById("map-encounter-overlay"),
        transitionOverlay: document.getElementById("map-node-transition-overlay"),
        coordinates: document.getElementById("map-coordinates"),
        mapName: document.getElementById("map-node-name"),
        interactionPrompt: document.getElementById("map-interaction-prompt"),
        dialogue: document.getElementById("map-dialogue"),
        dialogueSpeaker: document.getElementById("map-dialogue-speaker"),
        dialogueText: document.getElementById("map-dialogue-text"),
        dialogueChoices: document.getElementById("map-dialogue-choices"),
        dialogueHint: document.getElementById("map-dialogue-hint"),
        dialoguePortraitStage: document.getElementById("map-dialogue-portrait-stage"),
        dialoguePortrait: document.getElementById("map-dialogue-portrait"),
        inventory: document.getElementById("map-inventory"),
        inventoryClose: document.getElementById("map-inventory-close"),
        inventoryTabs: document.getElementById("map-inventory-tabs"),
        inventoryList: document.getElementById("map-inventory-list"),
        inventoryIcon: document.getElementById("map-inventory-icon"),
        inventoryCategory: document.getElementById("map-inventory-category"),
        inventoryName: document.getElementById("map-inventory-name"),
        inventoryDescription: document.getElementById("map-inventory-description"),
        inventoryQuantity: document.getElementById("map-inventory-quantity"),
        inventoryTargets: document.getElementById("map-inventory-targets"),
        inventoryUse: document.getElementById("map-inventory-use"),
        inventoryStatus: document.getElementById("map-inventory-status"),
        inventoryHelp: document.getElementById("map-inventory-help"),
        equipment: document.getElementById("map-equipment"),
        equipmentClose: document.getElementById("map-equipment-close"),
        equipmentPartyTabs: document.getElementById("map-equipment-party-tabs"),
        equipmentSlots: document.getElementById("map-equipment-slots"),
        equipmentSlotLabel: document.getElementById("map-equipment-slot-label"),
        equipmentEquippedName: document.getElementById("map-equipment-equipped-name"),
        equipmentDescription: document.getElementById("map-equipment-description"),
        equipmentUnequip: document.getElementById("map-equipment-unequip"),
        equipmentOptions: document.getElementById("map-equipment-options"),
        equipmentStatus: document.getElementById("map-equipment-status"),
        equipmentMemberStats: document.getElementById("map-equipment-member-stats"),
        equipmentActiveToggle: document.getElementById("map-equipment-active-toggle"),
        skillMenu: document.getElementById("map-skill-menu"),
        skillClose: document.getElementById("map-skill-close"),
        skillCategoryTabs: document.getElementById("map-skill-category-tabs"),
        skillPartyTabs: document.getElementById("map-skill-party-tabs"),
        skillTree: document.getElementById("map-skill-tree"),
        skillDetailEmpty: document.getElementById("map-skill-detail-empty"),
        skillDetailContent: document.getElementById("map-skill-detail-content"),
        skillDetailName: document.getElementById("map-skill-detail-name"),
        skillDetailType: document.getElementById("map-skill-detail-type"),
        skillDetailDescription: document.getElementById("map-skill-detail-description"),
        skillDetailLevel: document.getElementById("map-skill-detail-level"),
        skillDetailPrerequisite: document.getElementById("map-skill-detail-prerequisite"),
        skillDetailCost: document.getElementById("map-skill-detail-cost"),
        skillDetailStatus: document.getElementById("map-skill-detail-status"),
        skillDetailEffect: document.getElementById("map-skill-detail-effect"),
        skillFooterPoints: document.getElementById("map-skill-footer-points"),
        skillFooterLevel: document.getElementById("map-skill-footer-level"),
        skillFooterExp: document.getElementById("map-skill-footer-exp"),
        skillStatus: document.getElementById("map-skill-status"),
        progressionLevel: document.getElementById("map-progression-level"),
        progressionExp: document.getElementById("map-progression-exp"),
        progressionExpFill: document.getElementById("map-progression-exp-fill"),
        progressionRank: document.getElementById("map-progression-rank"),
        progressionRankProgress: document.getElementById("map-progression-rank-progress"),
        progressionRankFill: document.getElementById("map-progression-rank-fill"),
        campaignChapter: document.getElementById("map-campaign-chapter"),
        campaignObjective: document.getElementById("map-campaign-objective"),
        shop: document.getElementById("map-shop"),
        shopCurrency: document.getElementById("map-shop-currency"),
        shopList: document.getElementById("map-shop-list"),
        shopClose: document.getElementById("map-shop-close"),
        shopStatus: document.getElementById("map-shop-status"),
        sliceEnd: document.getElementById("vertical-slice-end"),
        sliceContinue: document.getElementById("vertical-slice-continue"),
        sliceTitle: document.getElementById("vertical-slice-title-button")
    };
}

export function createLaneMapUI(options) {
const elements=getElements(); const getElementsRef=()=>elements;
const clearInput=options.clearInput; const persistWorldState=options.persistWorldState; const updateInteractionPrompt=()=>{};
const dialogue=createMapDialogue({getElements:getElementsRef,clearInput,triggerEncounter:options.triggerEncounter,updateInteractionPrompt});
const isInteractionModalOpen=()=> dialogue.isOpen() || ['inventory','equipment','shop','skillMenu'].some(k=>elements[k]&&!elements[k].hidden);
const opts={...options,getElements:getElementsRef,isInteractionModalOpen,updateInteractionPrompt};
const field=createMapFieldMenu(opts); const skillMenu=createMapSkillMenu(opts);
const {setInventoryCategory,cycleInventoryCategory,useSelectedInventoryItem,moveInventoryTargetSelection,openInventory,closeInventory,moveInventorySelection,unequipSelectedEquipmentItem,openEquipment,closeEquipment,moveEquipmentMemberSelection,moveEquipmentSlotSelection,activateSelectedEquipmentSlot,toggleSelectedPartyMemberActive,openShop,closeShop,moveShopSelection,buySelectedShopItem}=field;
const {selectEncounterDialogueChoice,confirmEncounterDialogueChoice,resolveEncounterDialogueChoice,advanceDialogue,skipDialogue}=dialogue;
function handleKey(event){const key=event.key.toLowerCase();
    if (dialogue.isEncounterOpen()) {
        if (key === "arrowup" || key === "w" || key === "arrowleft" || key === "a") {
            selectEncounterDialogueChoice(-1);
        } else if (key === "arrowdown" || key === "s" || key === "arrowright" || key === "d") {
            selectEncounterDialogueChoice(1);
        } else if (key === " " || key === "enter") {
            confirmEncounterDialogueChoice();
        } else if (key === "escape") {
            resolveEncounterDialogueChoice("ignore");
        }
        event.preventDefault?.();
        return;
    }
    if (dialogue.isOpen()) {
        if (key === " " || key === "enter") advanceDialogue();
        else if (key === "escape") {
            skipDialogue();
        }
        event.preventDefault?.();
        return;
    }
    if (elements?.shop && !elements.shop.hidden) {
        if (key === "escape") closeShop();
        else if (key === "arrowup" || key === "w") moveShopSelection(-1);
        else if (key === "arrowdown" || key === "s") moveShopSelection(1);
        else if (key === " " || key === "enter") {
            buySelectedShopItem();
        }
        event.preventDefault?.();
        return;
    }
    if (elements?.sliceEnd && !elements.sliceEnd.hidden) {
        if (key === "escape" || key === " ") elements.sliceEnd.hidden=true;
        event.preventDefault?.();
        return;
    }
    if (elements?.inventory && !elements.inventory.hidden) {
        if (key === "tab" || key === "escape") closeInventory();
        else if (key === "b") {
            closeInventory();
            openEquipment();
        } else if (key === "q") cycleInventoryCategory(-1);
        else if (key === "e") cycleInventoryCategory(1);
        else if (key === "1") setInventoryCategory("equipment");
        else if (key === "2") setInventoryCategory("usable");
        else if (key === "3") setInventoryCategory("etc");
        else if (key === "arrowup" || key === "w") moveInventorySelection(-1);
        else if (key === "arrowdown" || key === "s") moveInventorySelection(1);
        else if (key === "arrowleft" || key === "a") moveInventoryTargetSelection(-1);
        else if (key === "arrowright" || key === "d") moveInventoryTargetSelection(1);
        else if (key === " " || key === "enter") useSelectedInventoryItem();
        event.preventDefault?.();
        return;
    }

    if (elements?.equipment && !elements.equipment.hidden) {
        if (key === "b" || key === "escape") closeEquipment();
        else if (key === "tab") {
            closeEquipment();
            openInventory();
        } else if (key === "q") moveEquipmentMemberSelection(-1);
        else if (key === "e") moveEquipmentMemberSelection(1);
        else if (key === "arrowleft" || key === "a") moveEquipmentMemberSelection(-1);
        else if (key === "arrowright" || key === "d") moveEquipmentMemberSelection(1);
        else if (key === "arrowup" || key === "w") moveEquipmentSlotSelection(-1);
        else if (key === "arrowdown" || key === "s") moveEquipmentSlotSelection(1);
        else if (key === " " || key === "enter") activateSelectedEquipmentSlot();
        event.preventDefault?.();
        return;
    }
    if (skillMenu.isOpen()) {
        // Native Tab, select arrows and button activation remain usable in the
        // class views; the original spatial tree retains its game shortcuts.
        if (key === "tab" || (skillMenu.activeCategory !== "general" && !["k", "escape", "q", "e"].includes(key))) return;
        if (key === "k" || key === "escape") skillMenu.close();
        else if (key === "q") skillMenu.moveMember(-1);
        else if (key === "e") skillMenu.moveMember(1);
        else if (key === "arrowup" || key === "w") skillMenu.moveSkill("up");
        else if (key === "arrowdown" || key === "s") skillMenu.moveSkill("down");
        else if (key === "arrowleft" || key === "a") skillMenu.moveSkill("left");
        else if (key === "arrowright" || key === "d") skillMenu.moveSkill("right");
        else if (key === " ") skillMenu.unlock();
        event.preventDefault?.(); return;
    }

    if (key === "k") { event.preventDefault?.(); skillMenu.open(); return; }

    if (key === "tab") {
        event.preventDefault?.();
        if (!options.isTransitionPending()) openInventory();
        return;
    }

    if (key === "b") {
        event.preventDefault?.();
        if (!options.isTransitionPending()) openEquipment();
        return;
    }


}
const bindings=[[elements.inventoryClose,closeInventory],[elements.equipmentClose,closeEquipment],[elements.shopClose,closeShop],[elements.skillClose,()=>skillMenu.close()],[elements.inventoryUse,useSelectedInventoryItem],[elements.equipmentUnequip,unequipSelectedEquipmentItem],[elements.equipmentActiveToggle,toggleSelectedPartyMemberActive]];
for(const [el,fn] of bindings) el?.addEventListener('click',fn);
return {elements,isOpen:isInteractionModalOpen,handleKey,dialogue,field,dispose(){dialogue.reset();closeInventory();closeEquipment();closeShop();skillMenu.close();for(const [el,fn] of bindings)el?.removeEventListener('click',fn);}};
}