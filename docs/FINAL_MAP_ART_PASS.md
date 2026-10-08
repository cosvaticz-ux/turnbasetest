# Final illustrated exploration map pass

Base: main at eed663f43626f6989232d83f5f3cbd78d73a2696.
Branch: feat/final-map-art-pass.

## Runtime approach

Each map has a 1672 by 941 final artwork registered inside the existing
greybox reference stage. It therefore inherits the authoritative reference
scale, translation, viewport contain scaling, and camera registration.

Normal mode shows final artwork with gameplay and debug surfaces hidden.
F2 hides the final artwork and restores the original greybox reference,
walkable and transition polygons, structure faces, exits, arrivals, and player
anchor. Actors and interactions continue to use the current renderer and
authoritative world coordinates.

The existing EnvironmentMaterialLayer remains as a projection-aware fallback.
All four map preload groups now load both their final artwork and debug
reference before entry.

## Map artwork

- Front Forest: broad worn earth road, evergreen and rock boundaries,
  weathered sign, stone-and-wood fence, right gate, and lantern.
- Deep Forest: dense canopy, mature trunks, mossy stone boundaries, forked
  trails, central pillar, and foreground fallen log.
- Town South: pale fortified gate, red banners, open paved plaza,
  timber/plaster buildings, stalls, notice board, crates, and barrels.
- Town North: open civic plaza, central enclosed fountain, guild building,
  shops, timber/plaster houses, lanterns, crates, barrels, and fencing.

The four PNGs were created with the built-in image generation edit workflow.
For each map, the greybox was the edit target and strict composition reference;
the supplied finished illustration was the style and material reference.

## Geometry protection

No gameplay data file was changed. Walkable and blocked polygons, exits,
transition corridors, spawns, arrivals, encounters, enemies, interactables,
projection, camera registration, movement, collision, actors, battle, story,
and save data remain identical to main.

Regression tests compare those values to the authoritative main snapshot,
freeze map data while the renderer is exercised, verify every final PNG
against its calibrated native size, toggle normal/debug presentation
repeatedly, and exercise all eight Luke walk and idle directions.

## Validation

- Focused environment suite: 6 of 6 tests pass.
- Full Node suite: 50 of 58 tests pass.
- The same eight baseline failures remain. They cover stale preload and actor
  expectations, an existing arrival-walkability check, an existing polygon
  count check, and missing binary/reference assets in this connector checkout.
- The final artwork files load and match 1672 by 941 calibration exactly.

Cloud Browser runtime QA was not performed. Automatic approval review
previously rejected loading this private repository into the external Cloud
Browser because that could disclose private source-derived content. No runtime
screenshots, collision playthrough, transition playthrough, or console check
are claimed.

## Remaining differences and next pass

These are single registered background paintings. They do not yet contain
separate foreground occlusion masks, so actors render above painted tree
crowns, roofs, fences, and fountain edges. Authoritative collision prevents
actors from entering most of those masses, but selected foreground elements
should be cut into transparent overlay PNGs in the next visual pass.

The generated paintings preserve the large silhouettes and openings closely,
but hand-painted internal edges are not pixel-identical to the greybox meshes.
Review each map with F2 at runtime and adjust visual registration or localized
art only. Do not change gameplay geometry to fit the paintings.
