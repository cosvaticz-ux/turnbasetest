const VFX_ROOT = "assets/images/skill/VFX";

export const BATTLE_VFX = Object.freeze({
    impact: Object.freeze({
        id: "impact",
        src: `${VFX_ROOT}/impact/vfx-impact.png`,
        durationMs: 280,
        size: "clamp(96px, 10vw, 150px)",
        scaleFrom: 0.72,
        scaleTo: 1.08
    }),
    "impact-heavy": Object.freeze({
        id: "impact-heavy",
        src: `${VFX_ROOT}/impact/vfx-impact2.png`,
        durationMs: 340,
        size: "clamp(118px, 12vw, 178px)",
        scaleFrom: 0.7,
        scaleTo: 1.18
    }),
    fire: Object.freeze({
        id: "fire",
        src: `${VFX_ROOT}/fire/vfx-fire1.png`,
        durationMs: 600,
        size: "clamp(150px, 16vw, 230px)",
        scaleFrom: 0.78,
        scaleTo: 1.08
    }),
    "fire-heavy": Object.freeze({
        id: "fire-heavy",
        src: `${VFX_ROOT}/fire/vfx-fire2.png`,
        durationMs: 520,
        impactTimeMs: 520,
        size: "clamp(150px, 17vw, 245px)",
        scaleFrom: 0.76,
        scaleTo: 1.12
    }),
    ice: Object.freeze({
        id: "ice",
        frameAspectRatio: 2,
        impactFrame: 7,
        src: `${VFX_ROOT}/ice/vfx-ice1.png`,
        durationMs: 450,
        size: "clamp(145px, 15vw, 220px)",
        scaleFrom: 0.84,
        scaleTo: 1.04,
        // vfx-ice1 uses 256x128 frames inside a 1280x384 sheet:
        // 5 columns x 3 rows, 11 populated frames. Playback is row-major:
        // left-to-right across each row, then continue on the next row.
        atlas: Object.freeze({ columns: 5, rows: 3, frames: 11 })
    }),
    "poison-hit": Object.freeze({
        id: "poison-hit",
        // Initial Poison cast: VFX starts immediately, then resolves at the end of the authored effect.
        src: `${VFX_ROOT}/poision/vfx-poision.png`,
        durationMs: 700,
        impactTimeMs: 700,
        size: "clamp(138px, 15vw, 220px)",
        scaleFrom: 0.82,
        scaleTo: 1.08
    }),
    poison: Object.freeze({
        id: "poison",
        // Keep the source spelling as committed in the asset folder. This profile is also used by DoT ticks.
        src: `${VFX_ROOT}/poision/vfx-poision.png`,
        durationMs: 700,
        size: "clamp(138px, 15vw, 220px)",
        scaleFrom: 0.82,
        scaleTo: 1.08
    }),
    heal: Object.freeze({
        id: "heal",
        src: `${VFX_ROOT}/heal/vfx-heal.png`,
        durationMs: 620,
        size: "clamp(140px, 15vw, 220px)",
        scaleFrom: 0.78,
        scaleTo: 1.06
    })
});

export function getBattleVfx(id) {
    return BATTLE_VFX[id] || null;
}

export function getBattleVfxSources() {
    return [...new Set(Object.values(BATTLE_VFX).map(definition => definition.src))];
}
