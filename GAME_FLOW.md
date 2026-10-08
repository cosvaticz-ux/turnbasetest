# Game Flow

The scene architecture supports the complete vertical-slice loop.

```text
MAIN TITLE
  → NEW GAME / CONTINUE
  → MAP / EXPLORATION
  → ENCOUNTER
  → BATTLE INTRO
  → BATTLE
  → VICTORY / DEFEAT
  → BATTLE SUMMARY
  → RETURN TO FRONT FOREST
  → TOWN PART 1: GUILD + SHOP
  → TOWN PART 2: GUILD MONUMENT
  → VERTICAL SLICE COMPLETE
```

`SceneManager` owns scene entry and exit. `GameManager` owns global state and delegates transitions to it. Each scene is responsible for binding and cleaning up its own input, timers, animation state, and temporary UI.

The game boots into `TitleScene`. `New Game` creates a clean schema-versioned state and enters Front Forest. `Continue` is enabled only for a readable, compatible autosave and restores the saved node, coordinates, facing, HP, inventory, quest, encounter, and settings state. Settings provides persisted master/SFX volume, film grain, and screen-effect quality controls.

`MapNodeManager` validates node/spawn changes and coordinates fade, destination load, facing preservation, movement lock, and the arrival-warp guard. `MapScene` adds illustrated terrain/prop layers, viewport-culling, environment presets, fixed and zone encounters, proximity prompts, repeatable dialogue, a potion shop, the `safer-road` guild quest, and the final Town Part 2 landmark. Important warps, battles, quest rewards, purchases, and the final landmark autosave.

`MapBlockoutScene` remains available through `index.html?scene=map-blockout` as an isolated development layout inspector. The playable and inspector views share the geometry registry so collision intent, geography, spawns, and transitions cannot silently diverge.
