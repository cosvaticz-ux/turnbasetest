# Battle Flow

The current battle is a side-based sequence with one action per living party character.

```text
BATTLE INTRO
  → PREPARE TURN (eligible encounters)
  → PLAYER SIDE START
  → ACTIVE CHARACTER
  → COMMAND
  → TARGET (Attack / Skill)
  → COMMIT
  → CAMERA RESET
  → ACTION + RESOLVE
  → CHARACTER TURN END
  → NEXT CHARACTER or ENEMY SIDE
  → ENEMY QUEUE + RESOLVE
  → STATUS TICK
  → NEXT PLAYER SIDE
  → VICTORY / DEFEAT
  → BATTLE SUMMARY (victory)
```

## Responsibility boundaries

- `BattleManager` owns registered combatants, active/finished state, battle token, and outcome checks.
- `TurnManager` owns the current side, active party index, enemy queue, and turn counter.
- `TargetManager` owns valid target selection and directional navigation.
- `CombatResolver` returns pure damage results; animations, audio, camera, and logging remain presentation concerns.
- `StatusEffectManager` applies, removes, and ticks combat statuses.
- `BattleCamera` owns camera focus/reset behavior.
- `BattleScene` coordinates the managers and UI lifecycle.

An unsuccessful action returns control to the same character. A successful Attack, Guard, Skill, or Item restores 1 AP and ends that character's turn. Ending without acting restores 2 AP, capped at maximum AP.

Eligible world encounters begin with a free, non-damaging Prepare Turn. The player may Focus to grant each living party member 1 AP or skip directly into normal commands. Prepare state is cleared on cancellation, battle finish, and scene exit.

The shipped battle proves two data-driven enemies, weighted attack/defend AI, target selection, guard mitigation, critical/fatal hits, three skills, poison duration/ticks, and a Healing Draught sourced from persistent inventory. Victory closes command input, cancels queued work, shows a summary, persists the encounter, and returns to the exact originating map position. Defeat locks combat and returns the party with retreat HP.
