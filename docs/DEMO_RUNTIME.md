# Litania X — Core Systems Demo Runtime

The active development runtime is temporarily **demo-first, not story-first**.

## Purpose

This mode exists so core systems can be redesigned, tested, and expanded without coupling every change to the canonical campaign.

The Chapter 1–4 campaign content and documentation remain in the repository for later reuse, but the normal New Game flow does not currently run that campaign.

## Active New Game Flow

```text
TITLE
  ↓
FRONT FOREST / SOUTH ROAD
  ↓
HIGHWAYMAN / ENCOUNTER TESTING
  ↓
TOWN GATE
  ↓
TOWN PART 1
  ↓
GUILD / SHOP / NPC / INVENTORY / EQUIPMENT
  ↓
TOWN PART 2 / FREE DEMO TESTING
```

The demo should remain useful as a testbed for:

- exploration and collision;
- map transitions;
- fixed/random encounters;
- battle flow;
- party state;
- inventory and equipment;
- quests;
- rewards;
- reputation/rank foundations;
- mastery foundations;
- save/continue;
- NPC dialogue and shops.

## Runtime Rules

- `runtimeMode: "demo"` is the default state.
- New Game starts in `front-forest`.
- The default test party is Luke + Dummy.
- Campaign arrival events, chapter gates, story encounters, and story battle callbacks are dormant in demo mode.
- The Chapter HUD is hidden in the active game runtime.
- Story/campaign code is preserved rather than deleted.
- Campaign functionality must be explicitly enabled with `runtimeMode: "campaign"` for dedicated tests or future integration.
- Progression refactors already agreed in `docs/PROGRESSION.md` remain valid; returning to the demo does **not** restore combat EXP-to-Level progression.

## Development Rule

Until the core systems are considered stable, new work should prefer generic reusable systems and demo test cases rather than adding canonical story content.

When the core is ready, story content should consume these systems as data/content instead of adding campaign-specific logic directly into `MapScene` or `BattleScene`.
