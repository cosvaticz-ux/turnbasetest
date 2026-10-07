# Litania X Data Schemas

## Save envelope

`SaveManager` writes a versioned envelope and migrates legacy direct-state saves:

```js
{
  schemaVersion: 1,
  savedAt: "ISO-8601 timestamp",
  state: {
    party: [{ id, hp, maxHp }],
    inventory: [{ id, quantity }],
    story: { flags, currency, level, rank, mastery },
    mapPosition: { mapNodeId, spawnId, x, y, facing },
    quests: { [questId]: { id, state, objectives, rewarded } },
    completedEncounters: [encounterId],
    settings: { masterVolume, musicVolume, sfxVolume, filmGrain, screenEffects }
  }
}
```

Unknown future schema versions and malformed JSON return `null`. Storage failures are
non-fatal. Local storage is primary; a same-origin cookie and the tab's window name are
small synchronous fallbacks for privacy-restricted browser environments.

## World content

`src/data/worldContent.js` keeps presentation/content out of `MapScene`:

```js
{
  environment: "forestFog",
  npcs: [{ id, name, type, x, y, radius, dialogueId?, marker?, sprite?, dialoguePortrait? }],
  interactives: [{ id, name, type, x, y, radius, dialogueId?, flag? }],
  encounterZones: [{ id, x, y, width, height, chancePerSecond, enemyId }]
}
```

Coordinates are authored in the shared 64px map grid. NPC and interactive behavior is
selected by generic `type`; ordinary content does not branch on display names.

`dialoguePortrait` is optional. When present, the exploration dialogue presenter shows that
full-body source for lines spoken by the initiating NPC; when the speaker changes, it switches
or hides the portrait without creating another presentation layer. `sprite` remains the safe
fallback for NPCs that do not provide a separate portrait asset.

## Audio in the public release

Background music and continuous ambience loops have been removed. `AudioManager`
maps only gameplay SFX. Master and SFX volume still apply. The unused
`settings.musicVolume` field is retained solely for compatibility with older saves;
it no longer has a UI control or affects playback.

## Exploration characters

`src/data/explorationCharacters.js` maps Luke's four movement directions to the
repository frames. South uses six `walkfront` frames, north uses six `walkback`
frames, and west/east share five `walkleft` frames. East is mirrored in CSS.
Frame duration is 140 ms and is independent of movement speed. Frame 1 of the
last facing direction is the idle fallback because no dedicated directional
standing set is present.

The active map visual mode is `minimal-ground`. Ground and road/floor surfaces
remain active; forest mass, vegetation, town props, editor-layout props, and
decorative weather/screen layers remain in the repository but are not rendered.

## Quest

Quest states are `locked`, `available`, `active`, `completed`, and `failed`. Objectives
are named booleans. `QuestManager` owns state transitions and completion validation;
dialogue only chooses which already-defined conversation to present.

## Items and encounters

Items use stable kebab-case IDs, category, battle usability, AP cost, and effect metadata.
Runtime quantities come from inventory. Fixed and zone encounters use stable IDs; victory
adds the ID to `completedEncounters`, preventing unintended respawn after return or reload.
