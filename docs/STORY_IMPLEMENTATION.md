# Litania X — Chapters 1–4 Implementation

The current New Game route is a continuous, mostly linear campaign slice. Every gate is backed by a persistent story milestone, quest objective, or encounter result. Existing prototype maps remain available for regression/debug use but are no longer the New Game opening.

## Chapter 1 — Rafel: Mountain Escape

- **Implemented events:** Night opening, Rafel's isolation/pursuit setup, structural-magic interaction, Fulitas Lighting unlock/use, story-gated exit, autosave.
- **Maps:** `mountain-start` → `mountain-path`.
- **Systems introduced:** Story milestones with prerequisites and one-time rewards; story Level rewards; conditional world content and exits.
- **Known limitations:** Mountain art, Rafel art, spell VFX, and bespoke ambience use documented placeholders. Dialogue is functional draft text.
- **Next story hook:** Rafel reaches a sheltered crossing and encounters Crescent Anno.

## Chapter 2 — Anno: Encounter / Alliance

- **Implemented events:** Suspicious first meeting, temporary alliance, Anno joins.
- **Maps:** `anno-encounter`.
- **Systems introduced:** `PartyManager`; active/inactive members; persistent HP, equipment, mastery, and known-technique state; battle roster created from party state.
- **Known limitations:** Anno currently reuses the prototype player animation set.
- **Next story hook:** The pair enter the ashen timberline and disturb a dead mage.

## Chapter 3 — Gram / Death Arch-mage Pursuit

- **Implemented events:** Dead mage awakening, persistent Death Arch-mage activation, chase pressure, Gram's mixed-magic camouflage, Gram joins, escape.
- **Maps:** `pursuit-area` → `road-foothill`.
- **Systems introduced:** `StoryThreatManager`; activation/deactivation, detection count, last-known position, chase integration, save persistence; conservative Mastery recording.
- **Known limitations:** The pursuer and all three party members use placeholder sprites. Camouflage is story-event driven rather than a full stealth simulation.
- **Next story hook:** The party reaches Village Kalin while the supernatural threat remains unresolved beyond the slice.

## Chapter 4 — Village Kalin / Ghoul Investigation

- **Implemented events:** Kalin arrival, livestock report, quest start, tracks investigation, Ghoul nest discovery, salt preparation, Ghoul battle, return/report, chapter completion.
- **Maps:** `kalin-village` → `kalin-investigation` → `ghoul-nest`, then back to Kalin.
- **Systems introduced:** Data-driven quest rewards and `RewardResolver`; Prepare action for coarse salt; enemy properties/resistances; status/element interaction; Ghoul fixed encounter; end-of-slice state.
- **Known limitations:** Kalin, its Elder, the hunting grounds, nest, salt icon, and Ghoul use placeholders. Investigation is intentionally linear.
- **Next story hook:** Kalin is safe for the night, while the Death Arch-mage remains an active campaign concern for the next story slice.

## Debug support

- `F2` toggles map/debug information.
- `F3` / `Shift+F3` traverses exits while debug mode is visible; production story prerequisites still apply.
- `F4` jumps to the next chapter while debug mode is visible and seeds the minimum prerequisite state.
- `MapScene.inspectCampaign()` exposes a read-only snapshot of milestones, party, quests, mastery, and threats for automated/debug inspection.

## Save compatibility

Schema version 4 stores milestones, the campaign party, threats, reputation, knowledge, access, quests, and mastery ledger. Version 3/unversioned saves are normalized: useful HP/equipment/inventory/map data is retained, legacy Luke state maps to Rafel, obsolete combat EXP is set to zero, and missing campaign fields receive safe defaults.
