# Front Forest material pass

Base: main at 32415cabdfd1eb2807a98b75619fa6e4666126ee.
Feature branch: feat/front-forest-visual-pass. Do not merge automatically.

## Implementation

Ports the material definitions, eight SVG tiles, projection-aligned SVG
patterns, solid fallback undercoats, structure-face bindings and reversible
debug paint from 655a69f94ae9a656e477551fb087b3a26a729224.

The current renderer still creates all geometry. A single material adapter
decorates its completed surfaces and sign/chest markers. Only front-forest
opts in. The reference image is hidden in normal play, while its stage,
registration and camera remain in use. F2 restores the image and original
debug paint. Transition corridors receive the same ground texture; exits,
arrival markers and the player foot marker are debug-only.

No gameplay definitions, positions, transforms, movement, collision, camera,
sprite rendering, facing, battle, encounters or save schema were modified.
Other maps retain the original reference and hidden-surface behavior.

## Validation

Full Node command: node --test tests/*.test.mjs.

- Main baseline in this environment: 52 tests, 44 passed, 8 failed.
- Feature: 57 tests, 49 passed, the same 8 failures.
- Five new tests pass: exact geometry/registration baseline, frozen gameplay
  data and reversible paint, unchanged other maps, eight Luke directions,
  and local material assets.
- Existing F2 source assertion now checks material-aware surface visibility;
  runtime tests additionally verify both presentation modes.
- No existing gameplay assertion was weakened.

Baseline failures: asset-preloader expectation, exploration actor height
expectation, arrival walkability, and walkable polygon count expectation.
Four additional failures concern unavailable local assets (battle VFX PNG,
map reference PNGs in two tests, and the Town South fallback SVG). These also
fail with the unmodified main renderer. Source/tests were read at the pinned
commit through the authenticated GitHub connector; direct git clone lacked
credentials and the complete binary asset checkout was unavailable.

Browser validation was blocked by automatic approval review: opening the
private repository preview in Cloud Browser was rejected because it could
disclose source-derived content to an external browser service. No browser
gameplay, collision, warp, encounter, interaction, texture or console checks
are claimed.

## Visual limits and review

Existing structures are mostly generic boundary masses. Materials retain
those silhouettes; they cannot recreate trees or props drawn only into the
reference image. Bare surrounding space and simple block silhouettes remain.
The palette is a restrained material pass, not a replacement illustrated scene.
Tree, grass and dirt tiles are available, but no new scenery or paths were
invented to use them.

Before merging, run the complete suite with a full asset checkout and resolve
the baseline failures separately. Play-test Front Forest, both exits, all
movement/idle directions, collisions, encounters, interactions and F2; review
texture projection and readability. Approve any further scenery work as a
separate task.
