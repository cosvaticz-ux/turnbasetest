import { projectGround, projectedBounds } from '../../core/ExplorationProjection.js';

export class FixedExplorationCamera {
    constructor(map) {
        this.map = map;
        this.bounds = projectedBounds(map.walkablePolygons);
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
    }

    update(_pose, width, height) {
        const padding = this.map.camera.padding ?? 70;
        const mapWidth = this.bounds.maxX - this.bounds.minX;
        const mapHeight = this.bounds.maxY - this.bounds.minY;
        const fitScale = Math.min(
            Math.max(1, width - padding * 2) / mapWidth,
            Math.max(1, height - padding * 2) / mapHeight
        );
        this.zoom = Math.max(0.48, Math.min(2, fitScale * (this.map.camera.zoom || 1)));
        const focus = this.map.camera.focus
            ? projectGround(this.map.camera.focus)
            : { x: (this.bounds.minX + this.bounds.maxX) / 2, y: (this.bounds.minY + this.bounds.maxY) / 2 };
        this.x = width / 2 - focus.x * this.zoom + (this.map.camera.offsetX || 0) * width;
        this.y = height / 2 - focus.y * this.zoom + (this.map.camera.offsetY || 0) * height;
        return this;
    }
}

export const LaneCameraController = FixedExplorationCamera;
