# Battle settlement checkpoint

Based on Phase 1 commit `e290501aae998021fc8155c685d02762a840be9a`. This is the first bounded Phase 2 change, focused on the confirmed result/summary save gap. Broader save validation/migration hardening remains later work.

## Behavior

Previously, victory saved rewards while final HP, consumed items, class/poison/down state and fixed completion were still pending. Closing the page during the result/summary could restore HP 110 and an unspent potion despite the battle ending at HP 23 with no potion; the fixed enemy remained present with rewards already resolved. Defeat did not checkpoint its retreat resources until returning to exploration.

`Game.commitBattleOutcome()` now owns terminal settlement. It copies final party resources using the existing victory/defeat and after-battle down policies, then applies victory rewards/mastery, records fixed completion and the return position, and calls autosave once with the coherent state. Resource quantities are copied before loot so rewards for consumed battle items are retained. Random encounters retain unique reward identities and do not enter fixed completion.

The scene separately tracks outcome application and save success, resetting both per battle. Summary/return does not reapply resources or rewards. A failed/throwing save does not mark the outcome durable; the result log reports the failure and map return retries the same in-memory outcome. If all storage remains unavailable, persistence is still impossible and the session outcome is only in memory. A failed write never intentionally erases the previous checkpoint.

No save schema change, balance change, encounter activation, map/asset change, animation/RNG change or summary-timing change is included. Existing SaveManager normalization, fallback selection and cookie limitations remain. Previously written mixed checkpoints are not retroactively repaired.

## Validation

The actual BattleScene, GameManager and SaveManager run under the existing shared DOM/timer harness. Ten settlement tests cover result/summary interruption for victory, defeat result interruption, poison/class/down/retreat policy, origin, repeat settlement/summary confirmation, consumed-item loot retention, quota failure and retry, independent random resolutions, and reloaded fixed reward idempotency. The medicine-drop case injects a loot addition through the real RewardResolver; production content definitions are untouched.

Node 24.19.0 validation: syntax 169/169; isolated test files 33/36 pass. The battle lifecycle, timing, battle state, effects, class, Prepare, progression and existing save tests pass. Aggregate remains exit 1: the same bad Deep Forest → Front Forest arrival affects two exploration files, and the integration/reference-image assertions still have unavailable local PNG bytes. These assets exist in the Git tree; no checks are skipped or replaced with dummy images. No browser playthrough is claimed.

To validate on a full checkout:

```sh
node scripts/run-checks.mjs
node scripts/preview-exploration.mjs
```

Browser reproduction to verify: begin a fixed encounter, spend medicine and lose HP, win, reload during the victory result and again during summary; Continue must retain the spent medicine/final HP/rewards and omit the fixed enemy. Repeat with defeat to verify the existing retreat HP and poison clearing. Use the same origin/port for Continue. Full assets and browser verification remain pending.
