# Asset Guide

Assets use one rule throughout the project:

```text
content ID → AssetResolver → predictable browser path
```

Use lowercase kebab-case IDs (`highland-man`, `ice-pike`, `ruined-road`). Display names may use normal capitalization.

## Image folders

```text
assets/images/
├── character/
│   ├── player/{character-id}/
│   ├── enemies/{enemy-id}/
│   └── npc/{npc-id}/
├── background/
│   ├── title/
│   ├── map/
│   ├── battle/
│   └── cutscene/
├── screen/
│   ├── title/
│   ├── battle-summary/
│   ├── game-over/
│   └── loading/
├── skill/{skill-id}/
├── ui/
│   ├── portrait/
│   ├── status/
│   ├── cursor/
│   └── icon/
└── effect/
    ├── battle/
    ├── transition/
    └── environment/
```

Do not scan these directories at runtime. Browser code resolves declared content IDs through `src/core/AssetResolver.js`.

## Player characters

Use `assets/images/character/player/{character-id}/`.

```text
luke/
├── profile/luke-profile.png
├── idle/luke-idle.png
├── punch/luke-puch.png
├── cast/luke-cast.png
└── guard/guard.png
```

Character data declares `assetId` and available animation metadata. A folder does not need to contain every optional action.
Spritesheets declare their grid and native cell aspect ratio directly; visual scale and offsets are independent tuning values.

```js
{
  id: "luke",
  name: "Luke",
  assetId: "luke",
  battleVisual: { scale: 0.53, offsetX: 0, offsetY: 0 },
  animations: {
    idle: {
      id: "idle",
      frames: 36,
      spriteSheet: true,
      columns: 6,
      rows: 6,
      folder: "idle",
      fileName: "luke-idle.png",
      frameAspectRatio: 298 / 678,
      visual: { scale: 1, offsetX: 0, offsetY: 0 }
    }
  }
}
```

## Enemies

Use `assets/images/character/enemies/{enemy-id}/` with `idle.png` as the default sprite. Optional files are `attack.png`, `hit.png`, `death.png`, and `portrait.png`.

An enemy may temporarily reuse another enemy's art through data:

```js
{ id: "highland-man", name: "Highland Man", assetId: "highwayman" }
```

When dedicated art exists, change only `assetId` to `highland-man`.

## Skills and statuses

- Skill effect: `assets/images/skill/{skill-id}/effect.png`
- Status icon: `assets/images/ui/status/{status-id}.png`
- Missing skill animation: the action still resolves without a dedicated effect.
- Missing status icon: keep the current text/symbol indicator.

Skill IDs in character unlock lists, skill definitions, animation lookup, and audio metadata must match exactly.

## Backgrounds and scene art

- Battle: `assets/images/background/battle/{background-id}.jpg` (or declared extension)
- Title background: `assets/images/background/title/{background-id}.png`
- Title foreground illustration: `assets/images/screen/title/{illustration-id}.png`

Battle/scene data stores `backgroundId`, not a full path. Set `backgroundAssetAvailable: true` only after the declared file exists; otherwise the scene keeps its CSS fallback without issuing a missing-file request.

## Exploration map dressing

Exploration ground and vegetation use declared paths in `src/data/maps/mapDressing.js`:

```text
assets/images/map/
├── ground/
│   ├── dirt/
│   ├── grass/
│   ├── stone/
│   └── mix/
└── tree/
```

- Every route uses a continuous pure dirt/stone core over a separate mixed-terrain edge. Keep the pure surfaces readable and reserve mixed images for transitions instead of covering the whole road with several terrain types.
- Tree images must keep transparent backgrounds and use the trunk/root center at the bottom of the canvas as their placement footpoint.
- Do not bake strong directional shadows into map trees. Root integration and the current light contact shadow are separate CSS layers so lighting can be replaced later.
- Forest tree placement is deterministic and derived from each map node's blocked zones. Change the blocked geometry or the density controls in `mapDressing.js`; do not scatter trees independently into walkable space.
- Front Forest is the first CSS forest-mass test. Each large blocked zone becomes one `.forest-mass.forest-edge.forest-shadow` region behind a limited set of illustrated trees. These regions are visual only; the authored blocked-zone rectangles remain the collision source.
- Individual tree PNGs are reserved for readable path edges, landmarks, and positions where canopy/player Y-sorting matters. `.tree`, `.tree-shadow`, and `.ground-decoration` are reusable hooks; most selected Front Forest trees use the shared region shadow rather than an individual drop-shadow filter.
- Forest tree footpoints belong inside blocked space. Narrow silhouettes frame the blocked boundary while broader trees fill its interior; canopies may touch a path edge but must not hide its center, a warp, or a spawn.
- `tree/grass1.png` is the forest undergrowth seam asset. In Front Forest it appears selectively at tree bases and exposed forest edges; in the unchanged Deep Forest comparison it also fills larger tree-row gaps. It remains inside blocked zones so the walkable path center stays clean.
- Town nodes intentionally receive no forest trees during this phase. Add dedicated town vegetation later only through explicit town landscaping markers.
- Playable maps lazily add tree/grass DOM to a persistent per-map pool. Culling toggles `hidden` outside the camera margin and never detaches/reinserts the whole visible set while walking. CSS forest regions are culled as four static rectangles on Front Forest. Keep vegetation and regions in `mapDressing.js`; bypassing this path will reintroduce off-screen image/filter cost or DOM churn.
- The 24×20 development grid is created only in `?mapDebug=1`. Normal exploration does not retain 480 grid cells.
- The known duplicate mixed-ground file ending in `_03.png` is intentionally not referenced.
- Append `?mapDebug=1` while developing to restore the grid and blockout labels over dressed regions.

## Audio

```text
assets/audio/
└── sfx/{ui|system|weapon|skill|battle}/{event-id}.{ext}
```

The public repository intentionally contains no background music or ambience loops. Gameplay SFX and dialogue typewriter audio are retained.

Gameplay calls named AudioManager events. Raw audio paths belong only in the resolver/mapping layer. Missing optional audio fails silently and a failed event is cached to avoid repeated playback errors.

## Staged preloading

`src/core/AssetPreloader.js` owns the shared loaded/loading/failed caches, image decoding, audio readiness, progress reporting, and a small concurrent worker pool. It contains no scene-specific asset names.

Register current and future content in `src/data/assetPreloadGroups.js`. Every declared path must resolve to a file already present in the repository; unavailable battle backgrounds or future enemies stay out of preload groups until their files exist.

- `boot-critical`: Common, Title, and immediate Front Forest essentials only.
- `front-forest`, `deep-forest`, `town-south`, `town-north`: ground and vegetation derived from the existing map data.
- `battle-common`: shared player battle frames, skill effects and present battle SFX.
- `highwayman-battle`: existing Highwayman idle, hit, and death frames.

Title and exploration start likely-next groups in the background. Map warps wait for only the destination map group while the existing black transition overlay is active. Encounters wait for `battle-common` plus their enemy group before entering BattleScene. Shared paths reuse the same Promise and successfully decoded image instead of issuing another preload request.

## Fallback rules

- Missing portrait → existing white placeholder.
- Missing optional player action → use an available animation or static frame declared by data.
- Missing dedicated enemy art → set a fallback `assetId` in enemy data.
- Missing skill effect → resolve the skill without the visual effect.
- Missing status icon → use the text/symbol indicator.
- Missing audio → continue without sound and do not retry-spam.

## Adding content

1. Add a kebab-case asset folder/files.
2. Add a definition in `src/data/` using the same ID.
3. Declare only available animations and file extensions.
4. Run `node tests/asset-resolver.test.mjs` and the full regression suite.

Ordinary content must not require named-character or named-enemy branches in BattleManager, Camera, targeting, or HUD code.
