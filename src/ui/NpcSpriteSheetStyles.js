const STYLE_ID = "litania-npc-sprite-sheet-styles";

function installNpcSpriteSheetStyles() {
    if (typeof document === "undefined" || !document.head) return false;
    if (document.getElementById(STYLE_ID)) return true;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* Mara town idle / stretch sprite sheet ---------------------------------- */
.map-world-actor[data-interaction-id="guild-warden"][data-has-sprite="true"] {
  height: clamp(90px, 9vh, 104px);
}

.map-world-actor[data-interaction-id="guild-warden"][data-has-sprite="true"] > .map-world-actor-sprite {
  opacity: 0;
}

.map-world-actor[data-interaction-id="guild-warden"][data-has-sprite="true"]::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -3px;
  width: auto;
  height: 100%;
  /* Source sheet is 1024x1536 arranged as 6 columns x 3 rows.
     A single frame is therefore approximately 1:3, not 2:3. */
  aspect-ratio: 1 / 3;
  transform: translateX(-50%);
  transform-origin: center bottom;
  background-image: url("./assets/images/character/npc/mara/mara-idle.png");
  background-repeat: no-repeat;
  background-size: 600% 300%;
  background-position: 0% 0%;
  pointer-events: none;
  filter: drop-shadow(0 7px 4px rgba(0, 0, 0, 0.3));
  animation: mara-town-stretch 6.8s steps(1, end) infinite;
}

/*
 * Approved Mara sequence from the annotated sheet:
 * F01-F06 -> F12-F18.
 * Skip F07-F11 entirely so the deep side-bend section never appears.
 */
@keyframes mara-town-stretch {
  0%, 35% { background-position: 0% 0%; }       /* F01 */
  38% { background-position: 20% 0%; }          /* F02 */
  41% { background-position: 40% 0%; }          /* F03 */
  44% { background-position: 60% 0%; }          /* F04 */
  47% { background-position: 80% 0%; }          /* F05 */
  50%, 55% { background-position: 100% 0%; }    /* F06 - brief overhead hold */

  /* F07-F11 intentionally skipped. F12 returns to the upright overhead pose. */
  59% { background-position: 100% 50%; }        /* F12 */
  63% { background-position: 0% 100%; }         /* F13 */
  67% { background-position: 20% 100%; }        /* F14 */
  71% { background-position: 40% 100%; }        /* F15 */
  75% { background-position: 60% 100%; }        /* F16 */
  79% { background-position: 80% 100%; }        /* F17 */
  83%, 100% { background-position: 100% 100%; } /* F18 */
}

@media (prefers-reduced-motion: reduce) {
  .map-world-actor[data-interaction-id="guild-warden"][data-has-sprite="true"]::before {
    animation: none;
    background-position: 0% 0%;
  }
}
`;
    document.head.appendChild(style);
    return true;
}

installNpcSpriteSheetStyles();

export { installNpcSpriteSheetStyles };
