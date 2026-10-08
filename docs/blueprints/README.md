# Map Blueprint Exports

Blueprints are generated locally from the four-node map registry and are omitted from the public source tree. The outputs below are excluded from version control.

- `litania-x-four-map-blueprint.*` — combined north-to-south overview.
- `town-north-blueprint.*` — Town Part 2 / North District.
- `town-south-blueprint.*` — Town Part 1 / South District.
- `front-forest-blueprint.*` — player start and wilderness/town junction.
- `deep-forest-blueprint.*` — deeper forest exploration blockout.

SVG is the editable master. PNG is the convenient review copy. Regenerate them from the repository root with:

```sh
node scripts/export-map-blueprint.mjs
```

The script always creates SVG files. It also creates PNG files when the optional `sharp` package is available.
