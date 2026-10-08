# Battle VFX / SFX hardening

Base: `891219688bb0e43ca919b9e6793b0d9febb2b889` (`main`).

## Inspection and audio diagnosis

The existing browser application uses HTMLAudioElement, not Web Audio. AudioManager creates managed SFX elements with preload=none. AssetPreloader changes registered elements to preload=auto, waits for loadeddata/canplaythrough, and has a timeout/failure continuation. Battle-common already listed core spell, impact, guard and result audio; runtime VFX sheets were absent from that group.

BattleScene owns action sequencing and calls CombatResolver and ClassCombat. BattleAnimationDirector owns actor frames and previously played both punchImpact and the hit event at impact. BattleEffectPresentation owns visual timers, numbers, sprite-sheet inference and cleanup. Skill-specific sound/VFX, fixed action delays and generic impact suppression were split between these modules. Critical/Fatal values originate in CombatResolver. Heal, item recovery, class actions and DoT have separate existing scene paths.

Confirmed defects in the inspected code:

- Repeated playSFX calls reset one shared element's currentTime, cutting off the previous instance. Event aliases could also share the preloader's single element.
- Any playEvent rejection permanently added that event to failedEvents. Temporary autoplay/abort failures therefore silenced that event for the rest of the session.
- playAudio swallowed asynchronous failures. There was no dedicated SFX gesture-unlock path.
- Background loadAudio could call load() on an element that was already playing.
- Actor animation emitted both punchImpact and hit for one strike, independently of skill presentation.

These are code-level causes and regression-test reproductions. A browser reproduction of Leon's intermittent-audio symptom was not completed, so this report does not claim every real-device cause has been eliminated.

## Changes

SfxVoicePool retains four reusable playback voices per canonical source, separate from preloader-owned media elements. Finished/error/cancelled voices release their listeners and watchdog timers. Pending plays reserve a voice immediately; a fifth simultaneous request returns false with optional diagnostics instead of allocating indefinitely. A 15-second watchdog releases stalled plays. playEventAndWait retains its supplied timeout and resolves on the ended event or failure.

AudioManager.playSFX(id, options) accepts volume, rate, delay, allowOverlap and scope. Master/SFX settings multipliers remain in force. Events use the same pool; transient failures are retriable. ensureUnlocked silently primes voices inside pointerdown/keydown capture handlers. Successful voices are not primed again; unsuccessful ones can retry on a later gesture. Generation checks prevent unlock completion from stopping the first real sound. AudioManager.debug enables failure, missing-entry, readiness and pool-exhaustion diagnostics.

BattleEffectPresentation.present(event) accepts resolved presentation data and selects a definition from battleEffectRegistry. Scene damage/healing callers now use this entry point. Normal attack profiles derive from existing equipped-weapon type/attackType. Class skills and legacy techniques can reference effectId. The registry covers slash/heavy slash, pierce, blunt, unarmed, bow, crossbow, firearm and magic, plus spells, healing and status profiles. Unknown profiles fall back to impact. Existing buff, cleanse and DoT paths are connected; adding registry entries does not create gameplay mechanics.

One event emits one selected VFX. Time-based per-target suppression was removed. An explicit suppressGenericImpact flag can suppress the generic fallback without suppressing a mapped spell. Floating numbers support concurrent hits and MISS labels. Critical/Fatal select heavier generic impact, a louder existing sound and moderate/strong shake. Existing damage calculation and hit rules are unchanged.

Timing accepts frameDurationMs, fps or durationMs, in that precedence order. impactFrame is one-based; impactTimeMs can override it. Sound, flash and number share the impact callback. Existing legacy action lead delays remain in technique metadata, retaining combat resolution timing. VFX and audio presentation do not calculate damage or spend AP.

Ice is explicitly **1280x384**, with **256x128** frames, **5 columns, 3 rows, 11 frames**, traversed **left-to-right, then the next row**. Manual atlas metadata takes precedence over detection. Frame 7 is the impact point; non-square frame proportions are preserved. Metadata inference remains cached and is not repeated per playback. All runtime VFX sheets are now in battle-common preloading.

Battle-scoped sound playback and delayed audio are cancelled alongside visual timers, nodes, number elements and Web Animations. Pools remain available for subsequent battles. The app-lifetime unlock listener intentionally remains after BattleScene exits; scene input listeners are still removed.

## File inventory

Created:

- src/core/SfxVoicePool.js
- src/data/battleEffectRegistry.js
- tests/battle-effects.test.mjs
- tests/battle-vfx-runtime.test.mjs
- docs/BATTLE_VFX_SFX_HARDENING.md

Modified:

- src/core/AudioManager.js
- src/core/AssetPreloader.js
- src/data/assetPreloadGroups.js
- src/data/battleVfx.js
- src/data/classSkills.js
- src/data/techniques.js
- src/scenes/BattleScene.js
- src/scenes/battle/BattleEffectPresentation.js
- src/scenes/battle/BattleAnimationDirector.js
- src/scenes/battle/BattleCommandPresentation.js
- tests/audio-hooks.test.mjs
- tests/battle-presentation-lifecycle.test.mjs
- tests/title-scene.test.mjs

## Validation

`node --test --test-reporter=dot tests/*.test.mjs`: **31 test files passed**. Coverage includes original combat/class/legacy-skill/Prepare/save tests, overlapping voices, bounded exhaustion, reuse, rejected-play recovery, delayed-audio cleanup, first-gesture races, subsequent playback, registry fallbacks, Critical/Fatal/Heal, actual PNG dimensions, manual atlas precedence, row-major frame transitions, impact-frame sound/number synchronization, duplicate suppression and asynchronous cleanup.

The old audio test deliberately asserted permanent suppression after failure; it now asserts that playback can retry. Lifecycle expectations account for one persistent unlock listener and the confirmation-sound watchdog during summary handoff. The title test locates the 650ms transition before later audio watchdogs. Existing gameplay assertions remain in place.

## Browser results and limitations

Browser smoke test is **blocked, not passed**. The browser connection initially closed; a fresh connection reported `net::ERR_BLOCKED_BY_CLIENT` when opening the local application. No real-browser Normal Attack / Fireball / Ice Pike / Poison / Heal sequence, repeated-audio listening test, browser-console validation, or mobile autoplay verification was completed. The PR should remain draft until that check is done.

The repo contains punch/impact, core spell, guard and UI sounds, but no dedicated sword, arrow, gunshot or heal recordings. Weapon profiles intentionally use existing impact recordings; heal uses menuConfirm. No missing audio files or projectile simulation were invented. Status profiles without suitable art use sound only. Bursts beyond four simultaneous instances of one source are deliberately bounded and diagnosed in debug mode.

The existing generic atlas detector is retained for sheets lacking manual metadata. Only Ice's layout and actual dimensions were explicitly verified in the new runtime test. Per-effect artistic timing and cross-browser sound quality still require the blocked visual/listening pass.
