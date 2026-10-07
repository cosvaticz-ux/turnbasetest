import { deriveWarpCirclePresentations } from '../../data/explorationPresentation.js';

export class ExplorationExitPresentation {
    static forRenderer(renderer) {
        return new ExplorationExitPresentation(renderer.root, renderer.map);
    }

    constructor(root, map) {
        this.layer = document.createElement('div');
        this.layer.className = 'exploration-exit-presentation-layer';
        this.layer.dataset.mapId = map.id;
        this.markers = deriveWarpCirclePresentations(map).map(definition => {
            const marker = document.createElement('div');
            marker.className = 'exploration-warp-circle';
            marker.dataset.exitId = definition.exitId;
            marker.dataset.targetMap = definition.targetMap;
            Object.assign(marker.style, {
                left: `${definition.projected.x}px`,
                top: `${definition.projected.y}px`,
                width: `${definition.width}px`,
                height: `${definition.height}px`,
                '--warp-ring': definition.profile.ring,
                '--warp-glow': definition.profile.glow,
                '--warp-dust': definition.profile.dust,
                '--warp-opacity': String(definition.profile.opacity)
            });
            const visual = document.createElement('span');
            visual.className = 'exploration-warp-circle-visual';
            visual.setAttribute('aria-hidden', 'true');
            marker.append(visual);
            this.layer.append(marker);
            return { definition, node: marker };
        });
        root.append(this.layer);
    }

    dispose() { this.layer.remove(); }
}
