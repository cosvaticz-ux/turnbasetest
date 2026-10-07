import { ENVIRONMENT_MATERIALS, getEnvironmentMaterials } from '../../data/environmentMaterials.js';
import { EXPLORATION_PROJECTION, projectGround } from '../../core/ExplorationProjection.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let nextInstance = 0;
const node = (name, attributes = {}) => {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
    return element;
};

// Mutates paint/visibility only, never points, transforms, dimensions or map data.
export class EnvironmentMaterialLayer {
    // Decorate existing visuals without touching their geometry or registration.
    static forRenderer(renderer) {
        if (!getEnvironmentMaterials(renderer.map.id)) return null;
        const layer = new EnvironmentMaterialLayer(renderer.map.id);
        for (const ground of renderer.surface.querySelectorAll('.greybox-walkable')) {
            layer.ground(ground, renderer.surface);
        }
        for (const surface of [renderer.backgroundSurface, renderer.foregroundSurface]) {
            for (const group of surface.querySelectorAll('.greybox-structure')) {
                const area = renderer.map.structuralGeometry.find(area => area.id === group.dataset.structureId);
                const bottomPoints = area.polygon.map(point => {
                    const projected = projectGround(point);
                    return { x: projected.x, y: projected.y - (area.baseElevation || 0) };
                });
                layer.structure(group.querySelector('.greybox-structure-bottom'), surface, area, 'bottom', 0, bottomPoints);
                group.querySelectorAll('.greybox-structure-side').forEach((side, index) => {
                    layer.structure(side, surface, area, 'side', index, bottomPoints);
                });
                layer.structure(group.querySelector('.greybox-structure-top'), surface, area, 'top', 0, bottomPoints);
            }
        }
        for (const marker of renderer.surface.querySelectorAll('.greybox-exit, .greybox-arrival-marker, .greybox-player-anchor')) {
            layer.exit(marker);
        }
        if (renderer.referenceImage) layer.exit(renderer.referenceImage);
        for (const { item, node } of renderer.interactableNodes) layer.interactable(node, item);
        return layer;
    }

    constructor(mapId) {
        this.config = getEnvironmentMaterials(mapId);
        this.prefix = `environment-material-${++nextInstance}`;
        this.bindings = [];
        this.patterns = new Map();
    }

    groundTransform(elevation = 0) {
        const { xScale: x, yScale: y } = EXPLORATION_PROJECTION;
        return `matrix(${x} ${y} ${-x} ${y} 0 ${-elevation})`;
    }

    sideTransform(start, end, projectedStart) {
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        if (!length) return this.groundTransform();
        const { xScale: x, yScale: y } = EXPLORATION_PROJECTION;
        return `matrix(${(end.x - start.x - end.y + start.y) * x / length} ${(end.x - start.x + end.y - start.y) * y / length} 0 -1 ${projectedStart.x} ${projectedStart.y})`;
    }

    pattern(surface, category, transform) {
        const key = `${surface.getAttribute('class')}|${category}|${transform}`;
        if (this.patterns.has(key)) return this.patterns.get(key);
        const material = ENVIRONMENT_MATERIALS[category];
        const id = `${this.prefix}-${this.patterns.size}`;
        const defs = node('defs');
        const pattern = node('pattern', {
            id, width: material.tileSize, height: material.tileSize,
            patternUnits: 'userSpaceOnUse', patternTransform: transform
        });
        // Solid undercoat stays visible even if a replacement texture cannot load.
        pattern.append(node('rect', { width: material.tileSize, height: material.tileSize, fill: material.color }));
        pattern.append(node('image', {
            href: material.texture, width: material.tileSize, height: material.tileSize,
            preserveAspectRatio: 'xMidYMid slice'
        }));
        defs.append(pattern);
        surface.append(defs);
        this.patterns.set(key, id);
        return id;
    }

    bind(element, paintedStyle) {
        if (!element) return;
        const originalStyle = Object.fromEntries(Object.keys(paintedStyle).map(key => [key, element.style[key]]));
        const originalFillPriority = element.style.getPropertyPriority('fill');
        this.bindings.push({ element, originalStyle, paintedStyle, originalFillPriority });
    }

    paint(element, surface, category, transform, ground = false) {
        const id = this.pattern(surface, category, transform);
        this.bind(element, {
            fill: `url(#${id})`,
            stroke: ground ? 'none' : ENVIRONMENT_MATERIALS[category].outline,
            strokeWidth: ground ? '0' : '1',
            strokeDasharray: 'none'
        });
    }

    ground(element, surface) {
        this.paint(element, surface, this.config.ground, this.groundTransform(), true);
    }

    structure(element, surface, area, face, index, bottomPoints) {
        const category = this.config.structures[area.id] || this.config.roles[area.role] || this.config.defaultStructure;
        const elevation = (area.baseElevation || 0) + (face === 'top' ? (area.height || 90) : 0);
        const transform = face === 'side'
            ? this.sideTransform(area.polygon[index], area.polygon[(index + 1) % area.polygon.length], bottomPoints[index])
            : this.groundTransform(elevation);
        this.paint(element, surface, category, transform);
    }

    exit(element) { this.bind(element, { display: 'none' }); }

    interactable(element, item) {
        const category = this.config.interactables[item.type];
        if (!category) return;
        const material = ENVIRONMENT_MATERIALS[category];
        // Keep the existing marker silhouette, labels, size and foot anchor.
        this.bind(element, {
            display: 'block', backgroundColor: material.color,
            backgroundImage: `url("${material.texture}")`, backgroundSize: `${material.tileSize}px ${material.tileSize}px`,
            borderColor: material.outline, color: '#ddd1ad'
        });
        this.bind(element.querySelector('.greybox-interactable-label'), { display: 'block' });
    }

    setDebugVisible(debug) {
        for (const { element, originalStyle, paintedStyle, originalFillPriority } of this.bindings) {
            Object.assign(element.style, debug ? originalStyle : paintedStyle);
            // Transition debug CSS has an !important fill; restore its cascade.
            if ('fill' in paintedStyle) {
                element.style.setProperty('fill', debug ? originalStyle.fill : paintedStyle.fill,
                    debug ? originalFillPriority : 'important');
            }
        }
    }
}
