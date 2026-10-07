export const TITLE_SCREEN_CONTENT = Object.freeze({
    studioLabel: "Cosvaticz Present",
    title: "LITANIA X",
    versionLabel: "Version : Demo 1",
    backgroundId: "old-city",
    backgroundExtension: "png",
    backgroundAssetAvailable: true,
    illustrationId: "goddess-left",
    illustrationExtension: "png",
    illustrationAssetAvailable: true,
    menuItems: Object.freeze([
        Object.freeze({ id: "new-game", label: "New Game" }),
        Object.freeze({ id: "continue", label: "Continue", requiresSave: true }),
        Object.freeze({ id: "settings", label: "Setting" }),
        Object.freeze({ id: "exit", label: "Exit" })
    ])
});
