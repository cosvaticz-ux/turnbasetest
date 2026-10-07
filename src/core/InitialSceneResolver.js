export function resolveInitialScene(search = "") {
    const scene = new URLSearchParams(String(search || "")).get("scene");
    if (scene === "map-blockout") return "mapBlockout";
    if (scene === "map-editor") return "mapEditor";
    return "title";
}
