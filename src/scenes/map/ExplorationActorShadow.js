import {
    EXPLORATION_PLAYER_SHADOW_PROFILE,
    EXPLORATION_SHADOW_PROFILE
} from '../../data/explorationPresentation.js';
import { EXPLORATION_ACTOR_METRICS } from '../../data/explorationCharacters.js';
import { projectGround } from '../../core/ExplorationProjection.js';

const shadowKey = (kind, id) => `${kind}:${id}`;

export const EXPLORATION_PLAYER_SHADOW_NUDGE_Y = -3;

export class ExplorationActorShadow {
    static forRenderer(renderer) {
        const shadows = new ExplorationActorShadow(renderer.root);
        shadows.register('player', 'luke', EXPLORATION_PLAYER_SHADOW_PROFILE);
        shadows.register('follower', 'lucy');
        for (const { enemy } of renderer.enemyNodes) shadows.register('enemy', enemy.id);
        for (const { item } of renderer.interactableNodes) {
            if (item.type === 'npc') shadows.register('npc', item.id);
        }
        return shadows;
    }

    constructor(root) {
        this.layer = document.createElement('div');
        this.layer.className = 'exploration-actor-shadow-layer';
        this.nodes = new Map();
        root.append(this.layer);
    }

    register(kind, id, profile = EXPLORATION_SHADOW_PROFILE) {
        const node = document.createElement('span');
        node.className = `exploration-actor-shadow exploration-actor-shadow-${kind}`;
        node.dataset.shadowFor = id;
        Object.assign(node.style, {
            width: `${profile.width}px`,
            height: `${profile.height}px`,
            opacity: String(profile.opacity),
            '--shadow-offset-x': `${profile.offsetX}px`,
            '--shadow-offset-y': `${profile.offsetY}px`
        });
        this.layer.append(node);
        this.nodes.set(shadowKey(kind, id), node);
        return node;
    }

    place(kind, id, world, visualScale = 1, hidden = false, visualFootOffsetY = 0) {
        const node = this.nodes.get(shadowKey(kind, id));
        if (!node || !world) return;
        const point = projectGround(world);
        node.hidden = Boolean(hidden);
        Object.assign(node.style, {
            left: `${point.x}px`,
            top: `${point.y + visualFootOffsetY}px`,
            transform: `translate(calc(-50% + var(--shadow-offset-x)), calc(-50% + var(--shadow-offset-y))) scale(${visualScale})`,
            zIndex: String(900 + Math.round((world.x + world.y) * 10))
        });
    }

    placePlayer(id, world, frameData, visualScale = 1, hidden = false) {
        const profile = frameData?.renderProfile;
        const footAnchorY = profile?.targetFootAnchorY ?? profile?.footAnchorY ?? 1;
        const visualFootOffsetY = EXPLORATION_ACTOR_METRICS.height * (footAnchorY - 1) * visualScale
            + EXPLORATION_PLAYER_SHADOW_NUDGE_Y;
        this.place('player', id, world, visualScale, hidden, visualFootOffsetY);
    }

    dispose() { this.layer.remove(); }
}
