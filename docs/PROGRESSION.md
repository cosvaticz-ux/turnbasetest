# Litania X — Progression System

> Working design specification for the progression architecture. This document defines the intended direction for implementation and supersedes the prototype EXP/grind progression where they conflict.

## 1. Core Philosophy

Litania X separates progression into distinct axes. Each axis answers a different question and should not duplicate another system's purpose.

- **Level** — How far has the character progressed through the main story?
- **Rank / Reputation** — How much recognition, trust, permission, and institutional access has the character earned?
- **Mastery** — What has the character actually become proficient at through use, training, and experience?
- **Techniques** — What combat knowledge has the character discovered or learned?
- **Equipment / Preparation** — How has the player chosen to prepare for the current challenge?

Core flow:

```text
MAIN STORY
    ↓
STORY MILESTONES
    ↓
LEVEL

QUESTS / CONTRACTS / FACTIONS
    ↓
REPUTATION
    ↓
RANK / ACCESS / PERMISSIONS

COMBAT / TRAINING / DISCOVERY
    ↓
MASTERY + TECHNIQUES

EXPLORATION / COMBAT / QUESTS
    ↓
MONEY + MATERIALS + ITEMS + KNOWLEDGE

LEVEL + MASTERY + TECHNIQUES + EQUIPMENT + PREPARATION
    ↓
CHARACTER BUILD / COMBAT POWER
```

The game should **not** use the conventional loop `kill enemies → EXP → level up` as its primary character progression.

---

## 2. Level — Story Progression

### Rule

**Level comes from main-story milestones, not combat EXP.**

Random encounters, farming, and repeatedly killing enemies must not increase character level.

A story milestone may increase level, but not every story flag or story event needs to grant a level.

Example:

```text
Start / Prologue            Level 1
Major story milestone       Level 2
Later major milestone       Level 3
...
```

Exact level pacing is content-design work and is not locked by this document.

### Implementation direction

Replace prototype EXP progression with milestone-driven progression, e.g.:

```js
story: {
  level: 1,
  milestones: []
}
```

A central story progression system should:

- register milestones;
- validate prerequisites;
- prevent duplicate completion;
- apply level rewards when applicable;
- apply story flags and unlocks;
- persist progression;
- trigger autosave where appropriate.

### Remove from intended design

- EXP rewards from normal enemies;
- EXP grinding;
- EXP-to-level thresholds;
- EXP bars as a core progression UI element.

---

## 3. Rank & Reputation — World / Guild Progression

Rank represents social/institutional standing rather than combat strength.

Rank progression should primarily come from:

- quests;
- contracts;
- guild assignments;
- faction work;
- promotion trials;
- major world contributions;
- special achievements where appropriate.

### Important rule

**Normal enemy kills do not directly grant Rank Points.**

Example:

```text
Kill random Highwayman
→ no direct rank progression

Complete "Clear the South Road" contract
→ Adventurer Guild reputation

Reach promotion requirement
→ promotion becomes available

Complete Guild Trial
→ Rank F → Rank E
```

Rank should unlock meaningful world content such as:

- contracts;
- restricted quests;
- areas;
- guild services;
- equipment access;
- trainers;
- NPC contacts;
- permissions;
- faction dialogue/options.

### Reputation and Rank should remain distinguishable

Recommended model:

```text
Reputation = accumulated trust / contribution
Rank       = formal status
```

Reaching a reputation threshold can make the player **eligible** for promotion without necessarily promoting them automatically.

---

## 4. Mastery — Combat Proficiency

Mastery is the main progression axis associated with actually fighting and practicing.

Potential mastery categories include:

- Unarmed
- Sword
- Greatsword
- Axe
- Spear
- Bow
- Firearm
- other disciplines added by content design

Mastery should describe proficiency rather than general character power.

### Sources of Mastery

Mastery/proficiency can come from:

- meaningful weapon use in combat;
- successful use of techniques;
- difficult encounters;
- trainers;
- practice/training events;
- quests;
- special encounters;
- manuals or other sources when appropriate.

### Anti-grind principle

Mastery must not simply become "EXP with another name."

Repeatedly attacking trivial enemies should provide strongly diminishing or zero useful progression once the encounter is beneath the character's relevant proficiency.

The exact mastery formula is intentionally left for implementation/balance testing.

---

## 5. Techniques — Knowledge & Discovery

Techniques are not required to come from a single linear skill tree.

A technique may be discovered or learned through:

- weapon mastery;
- trainers;
- NPC dialogue;
- quests;
- secret quests;
- manuals / tomes;
- duels;
- bosses;
- dungeons;
- exploration;
- high Rank access;
- story events;
- other special discoveries.

Example:

```text
Sword Mastery requirement
        +
Learned Guard Break from trainer
        ↓
Guard Break becomes usable
```

A character can therefore possess sufficient mastery to perform a technique but still need to **learn/discover the technique itself**.

This is intentional: progression should reward exploration and interaction with the world, not only repeated combat.

---

## 6. Equipment & Character Builds

Characters at the same Level and Rank should be capable of playing very differently.

Example:

```text
Character A
Level 5 / Rank E
Sword Mastery 6
Heavy armor
Guard-oriented techniques

Character B
Level 5 / Rank E
Firearm Mastery 5
Rare pistol
Reload / precision techniques

Character C
Level 5 / Rank E
Unarmed Mastery 7
Light equipment
Counter / mobility techniques
```

Therefore combat power should emerge from several sources rather than Level alone:

```text
Base Character Stats
+ Level / story growth
+ Equipment
+ Mastery
+ Techniques
+ Status / temporary buffs
+ Preparation
= Effective Combat Capability
```

Equipment and mastery must remain separate systems: owning a powerful weapon does not automatically make the character a master of that weapon type.

---

## 7. Reward Philosophy

Different content should serve different progression purposes.

| Content | Primary Rewards |
| --- | --- |
| Main Story | Level, major unlocks, access, story progression |
| Quest | Reputation, money, items, world state |
| Contract | Guild/faction reputation, Rank progression, money |
| Random Encounter | Materials, money, practice/mastery, Bestiary/knowledge |
| Fixed Encounter | Loot, mastery, route/world progression |
| Elite Encounter | Rare materials, items, techniques, knowledge |
| Boss | Unique gear, techniques, major unlocks, story rewards |
| Exploration | Secrets, items, manuals, lore/knowledge |
| Trainer | Techniques, training/mastery |
| Dungeon/Raid | Gear, techniques, materials, lore, special rewards |

Random encounters are therefore useful, but they are **not the main progression engine**.

Story/quest/world encounters should generally be more meaningful and rewarding than ordinary random encounters.

---

## 8. Relationship to Encounter Design

Progression must support the intended exploration structure:

- Random encounters occur only in designated areas.
- Fixed encounters may guard routes or locations.
- Elite enemies may patrol and chase the player on the exploration map.
- Nemesis/Pursuer encounters may act as persistent threats.
- Story and quest encounters should carry greater meaning than ordinary farming encounters.

This prevents the world from becoming a generic EXP-grinding field.

---

## 9. Quest Reward Architecture

Quest definitions should eventually declare rewards as data rather than hardcoding reward logic inside scenes.

Example direction:

```js
rewards: {
  currency: 25,
  items: [
    ["healing_draught", 1]
  ],
  reputation: {
    adventurerGuild: 3
  }
}
```

A central Reward Resolver should eventually support:

- currency;
- items;
- materials;
- reputation;
- Rank eligibility/progression;
- techniques;
- mastery rewards;
- story flags;
- map/content access;
- recipes;
- knowledge;
- unique rewards.

---

## 10. Save-State Direction

When the progression refactor is implemented, the save schema should evolve to represent the new model cleanly.

Target direction:

```js
story: {
  level: 1,
  milestones: []
},

reputation: {
  adventurerGuild: 0
},

rank: {
  current: "F",
  promotionEligible: false
},

mastery: {},
knownTechniques: [],
knowledge: []
```

Existing prototype saves should be migrated rather than silently interpreted using obsolete EXP behavior.

---

## 11. Implementation Roadmap

### Phase A — Progression Foundation

1. Remove enemy EXP → Level progression.
2. Remove direct Rank rewards from ordinary enemy kills.
3. Implement Story Milestone progression.
4. Implement Reputation / Rank foundation.
5. Implement centralized quest/content Reward Resolver.
6. Update progression UI.
7. Migrate save schema.
8. Update regression tests to enforce the new design.

### Phase B — Character Growth

1. Implement MasteryManager.
2. Define mastery categories and gain rules.
3. Add anti-trivial-grind behavior.
4. Implement technique ownership/unlock requirements.
5. Separate technique discovery from mastery where appropriate.
6. Implement equipment/stat pipeline.
7. Move prototype battle data into dedicated data modules.

### Phase C — Combat Progression Integration

Connect progression to the planned combat systems:

- Prepare Turn;
- weapon choices / attack types;
- firearm reload/preparation;
- Critical / Fatal rules;
- KO / repeated downs;
- Overkill / death rules;
- Last Stand traits;
- boss phase transitions.

These systems should consume the progression model rather than inventing separate progression currencies.

### Phase D — Architecture Cleanup

After gameplay rules stabilize:

- reduce BattleScene responsibilities;
- reduce MapScene responsibilities;
- move reward/progression logic out of scenes;
- separate characters, enemies, attacks, techniques, items, weapons, armor, quests, contracts, and progression definitions into dedicated data modules.

Do not perform a large scene rewrite before the gameplay rules stabilize unless required to safely implement them.

---

## 12. Design Rules to Protect

When adding future content, preserve these rules:

1. **Story → Level.**
2. **Quest / Contract / Faction → Reputation & Rank.**
3. **Combat / Training → Mastery.**
4. **Techniques can be discovered through many sources.**
5. **Random combat must not be the primary progression path.**
6. **Same Level does not mean same build or same combat capability.**
7. **Rank represents recognition/access, not raw combat power.**
8. **Mastery represents proficiency, not general character level.**
9. **Equipment, mastery, techniques, and preparation should create build diversity.**
10. **Progression should encourage story, quests, exploration, experimentation, and world interaction rather than repetitive grinding.**

---

## 13. Short Design Summary

> **Level tells us how far the character has progressed through the story.**
>
> **Rank tells us how much the world and its institutions recognize the character.**
>
> **Mastery tells us what the character is actually good at.**
>
> **Techniques tell us what the character has learned or discovered.**
>
> **Equipment and preparation determine how the player chooses to approach the next fight.**

---

## 14. Chapters 1–4 Implementation Status

The opening campaign slice now enforces this document in code:

- normal enemies define zero EXP and zero direct Rank reward;
- the compatibility `applyExperience` API ignores incoming combat EXP and cannot change Level;
- persistent, prerequisite-checked story milestones are the only Level source;
- the Chapter 3 escape milestone raises the party's story Level from 1 to 2; other opening beats do not grant arbitrary levels;
- Kalin quest completion grants currency, an item, and Kalin reputation through the central reward resolver;
- party members store their own techniques and mastery;
- fixed meaningful encounters can grant one conservative Mastery increment per member/discipline/encounter, while repeat/trivial encounters grant none;
- save schema 4 migrates legacy EXP to zero and preserves useful legacy state.

Technique definitions include a `source` field and are learned into character state. This deliberately does not assume that Level automatically unlocks techniques.

This separation is the core progression identity of **Litania X**.
