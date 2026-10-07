export const PREPARE_ACTION = Object.freeze({
    FOCUS: "focus",
    SCATTER_SALT: "scatter-salt",
    BEGIN_BATTLE: "begin-battle"
});

export const PREPARE_ACTION_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: PREPARE_ACTION.FOCUS,
        elementId: "prepare-focus-button",
        icon: "◇",
        name: "Focus",
        costLabel: "+1 AP",
        resolver: "focus",
        logMessage: "The party focuses before engaging. Each member restores 1 AP."
    }),
    Object.freeze({
        id: PREPARE_ACTION.SCATTER_SALT,
        elementId: "prepare-salt-button",
        icon: "◇",
        name: "Scatter Salt",
        costLabel: "Prepare",
        resolver: "scatter-salt",
        itemAction: true,
        targetDefinitionId: "ghoul",
        disabledReason: "Requires a living Ghoul",
        logMessage: "Coarse salt exposes the Ghoul's hide. Fire will strike with amplified force."
    }),
    Object.freeze({
        id: PREPARE_ACTION.BEGIN_BATTLE,
        elementId: "prepare-skip-button",
        icon: "◯",
        name: "Begin Battle",
        costLabel: "Skip",
        resolver: "begin-battle",
        logMessage: "The party begins the fight without further preparation."
    })
]);
