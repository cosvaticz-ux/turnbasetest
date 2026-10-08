# File retention audit

The public-release cleanup removed eight background audio files, generated
blueprints, four historical screenshots, an old diagnostic capture, an unreferenced
editor draft, the obsolete lane-browser smoke script and the Lucy extraction script.
The extraction script expected source-sheet filenames that no longer exist and
produced individual frames that the current spritesheet renderer does not use.
The current browser smoke check is `scripts/browser-smoke.cjs`.

Generated blueprints can be recreated with `scripts/export-map-blueprint.mjs`.
Their outputs are now ignored. Historical development notes remain as explanations
of the code; obsolete captures and duplicate output copies are omitted.

The following files are deliberately retained:

- All thirteen gameplay SFX, including the fireball MP3, UI and dialogue sounds,
  and short victory/defeat result cues.
- Luke/Lucy battle sheets, Luke directional exploration sheets, current NPC art,
  portraits, map backgrounds, VFX and UI images.
- Highwayman animation files with identical bytes: the resolver generates each
  filename as an authored endpoint or repeated frame, so deleting duplicates
  would break animation sequences.
- Greybox/reference PNGs and the Town South SVG fallback, which are referenced
  by current geometry, renderer data and regression checks.
- Map-editor palette assets, map layout/content modules, debug inspectors,
  campaign/class data and validation infrastructure. Being absent from normal
  play does not make a file unused.
- Other assets whose runtime or future-content status is uncertain. They were
  kept under the task's conservative deletion rule.

See `PUBLIC_RELEASE_AUDIT.md` for final validation and publication blockers.
