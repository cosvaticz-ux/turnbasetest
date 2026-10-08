# Assets to verify before publication

No asset-origin manifest, permission records or bundled asset licenses were found.
These categories are review candidates, not findings of unauthorized use. Verify
original sources, permission to redistribute source files, attribution requirements
and any restrictions before making the repository public.

| Remaining content | Location | Owner verification needed |
| --- | --- | --- |
| Gameplay sound effects, including result cues | `assets/audio/sfx/` (13 files) | Confirm the source/license for each recording and required attribution. The fireball MP3 is a short skill effect, not music. |
| Character/NPC sprites, portraits and animation sheets | `assets/images/character/` | Confirm ownership or source-asset redistribution permission. Keep required watermarks/credits. |
| Maps, backgrounds, title illustration, terrain and props | `assets/images/background/`, `assets/images/screen/`, `assets/images/map/` | Confirm the source or generation-service terms. Signed provenance metadata in several PNGs is preserved; it is not a license. |
| Skill effects, inventory sheets and UI icons | `assets/images/skill/`, `assets/images/item/`, `assets/images/ui/` | Confirm sources, licenses and attribution. |
| Optional web fonts: Cinzel, Cinzel Decorative, Oswald | Google Fonts links in `index.html` and `map-editor.html` | Check upstream family licenses before bundling. No font files are stored here; current loading uses Google Fonts and system fallbacks. |
| Optional development packages | `sharp` in the blueprint exporter; `playwright` in the browser smoke check | No package implementations are vendored. Review upstream licenses if distributing dependencies or binaries later. Neither is required to run the game. |

There are no remaining 3D model files, bundled plugin directories or vendored
third-party runtime libraries in the working tree. Background themes and continuous
ambience have been removed from the working tree; historical Git copies still need
attention as described in `PUBLIC_RELEASE_AUDIT.md`.

No project license exists and none was added. MIT is a possible permissive option
for original source code if the owner wants others to study, modify and redistribute
it. The owner must decide the license and scope; third-party assets must retain their
own applicable terms. See the [official MIT license](https://opensource.org/license/mit).
