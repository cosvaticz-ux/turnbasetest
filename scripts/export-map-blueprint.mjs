import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { MAP_NODE_GRID, MAP_NODE_LAYER_ORDER } from "../src/data/maps/mapNodeSchema.js";
import { getMapNode } from "../src/data/maps/mapNodeRegistry.js";

const require = createRequire(import.meta.url);
let sharp = null;
try {
    sharp = require("sharp");
} catch {
    // SVG export stays dependency-free. PNG export is an optional convenience.
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, "../docs/blueprints");
const worldOrder = ["town-north", "town-south", "front-forest", "deep-forest"];
const panelWidth = MAP_NODE_GRID.columns * MAP_NODE_GRID.cellSize;
const panelHeight = MAP_NODE_GRID.rows * MAP_NODE_GRID.cellSize;
const pagePadding = 112;
const panelHeaderHeight = 88;
const panelGap = 132;
const pageWidth = panelWidth + pagePadding * 2;
const pageHeight = 180 + worldOrder.length * (panelHeaderHeight + panelHeight) + (worldOrder.length - 1) * panelGap + 150;

const palette = Object.freeze({
    background: "#11130f",
    panel: "#252820",
    grid: "#dad5c6",
    text: "#f1ecdf",
    muted: "#aaa394",
    walkable: "#356f45",
    blocked: "#753838",
    path: "#8d7448",
    footprint: "#5f605b",
    important: "#947033",
    marker: "#555751",
    reserved: "#6c3535",
    npc: "#66537d",
    spawn: "#82742a",
    warp: "#28698d",
    warpReserved: "#45484b"
});

function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
    })[character]);
}

function markerStyle(groupId, object) {
    if (object.type === "walkable") return { fill: palette.walkable, stroke: "#65b978", dash: "" };
    if (object.type === "blocked") return { fill: palette.blocked, stroke: "#d56c6c", dash: "12 8" };
    if (groupId === "paths") return { fill: palette.path, stroke: "#ddc68d", dash: object.type === "path" || object.type === "road" ? "" : "9 6" };
    if (groupId === "footprints") return { fill: object.type === "important-building" ? palette.important : palette.footprint, stroke: object.type === "important-building" ? "#f0cc62" : "#bbb8ae", dash: "" };
    if (groupId === "spawns") return { fill: palette.spawn, stroke: "#ead85f", dash: "" };
    if (groupId === "warps") return { fill: object.active === false ? palette.warpReserved : palette.warp, stroke: object.active === false ? "#888" : "#67c6f5", dash: object.active === false ? "10 7" : "" };
    if (object.type === "important") return { fill: palette.important, stroke: "#f0cc62", dash: "" };
    if (object.type === "reserved") return { fill: palette.reserved, stroke: "#d56c6c", dash: "9 6" };
    if (object.type === "npc-marker") return { fill: palette.npc, stroke: "#b69ad6", dash: "" };
    return { fill: palette.marker, stroke: "#b8b4aa", dash: "8 6" };
}

function wrapLabel(label, width, height) {
    const maxCharacters = Math.max(6, Math.floor((width - 8) / 7));
    const words = `[${label}]`.split(/([ /:_-]+)/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
        if (!line || `${line}${word}`.length <= maxCharacters) line += word;
        else {
            lines.push(line.trim());
            line = word.trim();
        }
    }
    if (line) lines.push(line.trim());
    const lineLimit = Math.max(1, Math.min(4, Math.floor(height / 13)));
    return lines.slice(0, lineLimit);
}

function renderMarker(groupId, object, offsetX, offsetY) {
    const x = offsetX + object.x * MAP_NODE_GRID.cellSize;
    const y = offsetY + object.y * MAP_NODE_GRID.cellSize;
    const width = object.width * MAP_NODE_GRID.cellSize;
    const height = object.height * MAP_NODE_GRID.cellSize;
    const style = markerStyle(groupId, object);
    const fontSize = Math.max(9, Math.min(15, width / 8, height / 3));
    const lines = wrapLabel(object.label, width, height);
    const lineHeight = fontSize + 2;
    const firstLineY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.34;
    const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
    const text = lines.map((line, index) => (
        `<text x="${x + width / 2}" y="${firstLineY + index * lineHeight}" text-anchor="middle" class="marker-label" font-size="${fontSize}">${escapeXml(line)}</text>`
    )).join("");
    return `<g data-object-id="${escapeXml(object.id)}"><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${style.fill}" fill-opacity="0.88" stroke="${style.stroke}" stroke-width="2"${dash}/>${text}</g>`;
}

function renderGrid(offsetX, offsetY) {
    const lines = [];
    for (let column = 0; column <= MAP_NODE_GRID.columns; column += 1) {
        const x = offsetX + column * MAP_NODE_GRID.cellSize;
        lines.push(`<line x1="${x}" y1="${offsetY}" x2="${x}" y2="${offsetY + panelHeight}"/>`);
    }
    for (let row = 0; row <= MAP_NODE_GRID.rows; row += 1) {
        const y = offsetY + row * MAP_NODE_GRID.cellSize;
        lines.push(`<line x1="${offsetX}" y1="${y}" x2="${offsetX + panelWidth}" y2="${y}"/>`);
    }
    return `<g class="grid-lines">${lines.join("")}</g>`;
}

function renderNodePanel(node, offsetX, offsetY, { includeHeader = true } = {}) {
    const mapY = offsetY + (includeHeader ? panelHeaderHeight : 0);
    const header = includeHeader ? `<g>
        <text x="${offsetX}" y="${offsetY + 32}" class="panel-title">${escapeXml(node.name)}</text>
        <text x="${offsetX}" y="${offsetY + 60}" class="panel-role">${escapeXml(node.role)}</text>
    </g>` : "";
    const objects = MAP_NODE_LAYER_ORDER.flatMap(groupId => node.groups[groupId].map(object => renderMarker(groupId, object, offsetX, mapY)));
    return `${header}<rect x="${offsetX}" y="${mapY}" width="${panelWidth}" height="${panelHeight}" fill="${palette.panel}" stroke="#e0dacb" stroke-width="4"/>${objects.join("")}${renderGrid(offsetX, mapY)}`;
}

function svgDocument({ width, height, body, title }) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="blueprint-title">
  <title id="blueprint-title">${escapeXml(title)}</title>
  <style>
    text { font-family: Arial, sans-serif; fill: ${palette.text}; }
    .page-title { font-size: 34px; font-weight: 800; letter-spacing: 4px; }
    .page-subtitle { font-size: 18px; fill: ${palette.muted}; letter-spacing: 1px; }
    .panel-title { font-size: 25px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
    .panel-role { font-size: 15px; fill: ${palette.muted}; }
    .marker-label { font-weight: 800; paint-order: stroke; stroke: #10110e; stroke-width: 3px; stroke-linejoin: round; }
    .grid-lines { stroke: ${palette.grid}; stroke-opacity: 0.27; stroke-width: 1; }
    .flow-arrow { fill: ${palette.warp}; stroke: #67c6f5; stroke-width: 2; }
    .legend-label { font-size: 15px; font-weight: 700; fill: ${palette.muted}; }
  </style>
  <rect width="100%" height="100%" fill="${palette.background}"/>
  ${body}
</svg>`;
}

function renderLegend(y) {
    const entries = [
        [palette.walkable, "WALKABLE"], [palette.blocked, "BLOCKED"], [palette.path, "ROAD / PATH"],
        [palette.footprint, "FOOTPRINT"], [palette.important, "IMPORTANT"], [palette.warp, "WARP"], [palette.spawn, "SPAWN"]
    ];
    return entries.map(([fill, label], index) => {
        const x = pagePadding + index * 205;
        return `<rect x="${x}" y="${y}" width="24" height="24" fill="${fill}" stroke="#ddd7c8"/><text x="${x + 34}" y="${y + 18}" class="legend-label">${label}</text>`;
    }).join("");
}

async function writeBlueprint(filename, svg) {
    const svgPath = resolve(outputDirectory, `${filename}.svg`);
    const pngPath = resolve(outputDirectory, `${filename}.png`);
    await writeFile(svgPath, svg);
    if (sharp) await sharp(Buffer.from(svg)).png().toFile(pngPath);
}

async function exportBlueprints() {
    await mkdir(outputDirectory, { recursive: true });

    let y = 150;
    const panels = [];
    for (let index = 0; index < worldOrder.length; index += 1) {
        const node = getMapNode(worldOrder[index]);
        panels.push(renderNodePanel(node, pagePadding, y));
        y += panelHeaderHeight + panelHeight;
        if (index < worldOrder.length - 1) {
            const arrowCenterX = pageWidth / 2;
            panels.push(`<path class="flow-arrow" d="M ${arrowCenterX - 18} ${y + 22} H ${arrowCenterX + 18} V ${y + 54} H ${arrowCenterX + 38} L ${arrowCenterX} ${y + 96} L ${arrowCenterX - 38} ${y + 54} H ${arrowCenterX - 18} Z"/>`);
            y += panelGap;
        }
    }

    const overviewBody = `<text x="${pagePadding}" y="66" class="page-title">LITANIA X — FOUR MAP NODE BLUEPRINT</text>
      <text x="${pagePadding}" y="98" class="page-subtitle">64PX DEVELOPMENT GRID · NORTH TO SOUTH · GENERATED FROM MAP NODE REGISTRY</text>
      ${panels.join("")}
      ${renderLegend(pageHeight - 74)}`;
    await writeBlueprint(
        "litania-x-four-map-blueprint",
        svgDocument({ width: pageWidth, height: pageHeight, body: overviewBody, title: "Litania X Four Map Node Blueprint" })
    );

    for (const nodeId of worldOrder) {
        const node = getMapNode(nodeId);
        const width = panelWidth + pagePadding * 2;
        const height = panelHeight + panelHeaderHeight + 190;
        const body = `<text x="${pagePadding}" y="54" class="page-title">LITANIA X — ${escapeXml(node.name)}</text>
          ${renderNodePanel(node, pagePadding, 82)}
          ${renderLegend(height - 58)}`;
        await writeBlueprint(
            `${nodeId}-blueprint`,
            svgDocument({ width, height, body, title: `Litania X ${node.name} Blueprint` })
        );
    }
}

await exportBlueprints();
console.log(`Exported map blueprints to ${outputDirectory}`);
if (!sharp) console.warn("PNG export skipped because the optional sharp package is unavailable. SVG blueprints were still generated.");
