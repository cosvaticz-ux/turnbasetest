import { EnvironmentMaterialLayer } from './EnvironmentMaterialLayer.js';
import { ExplorationExitPresentation } from './ExplorationExitPresentation.js';
import { ExplorationActorShadow } from './ExplorationActorShadow.js';
import { getEnvironmentArtwork } from '../../data/environmentArtworks.js';
import {
    EXPLORATION_ACTOR_METRICS,
    getLukeExplorationDirection,
    getLukeExplorationFrameData,
    getLukeExplorationIdleData,
    LUKE_EXPLORATION
} from '../../data/explorationCharacters.js';
import { AssetResolver } from '../../core/AssetResolver.js';
import { projectGround } from '../../core/ExplorationProjection.js';
import { createPlaceholderActor, setPlaceholderState, setPlaceholderFacing } from '../../ui/placeholders/PlaceholderActor.js';
import { ENCOUNTER_DEFINITIONS } from '../../data/encounters.js';
import {
    getArrivalMarkers,
    getExplorationExits,
    getGreyboxReference,
    getTransitionPolygons
} from '../../data/greyboxWarpCalibration.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgNode = name => document.createElementNS(SVG_NS, name);
const pointString = polygon => polygon.map(point => { const p = projectGround(point); return `${p.x},${p.y}`; }).join(' ');

export function resolveExplorationActorScales(actorScale = 1) {
    const playerBodyHeight = EXPLORATION_ACTOR_METRICS.height * EXPLORATION_ACTOR_METRICS.playerBodyHeightRatio;
    const playerScale = actorScale * (EXPLORATION_ACTOR_METRICS.standardVisualHeight / playerBodyHeight);
    return Object.freeze({
        standard: actorScale,
        player: playerScale
    });
}

export function resolvePlayerFrameRenderMetrics(frameData, viewportSize = EXPLORATION_ACTOR_METRICS.height) {
    const profile = frameData.renderProfile;
    const sourceFrameWidth = profile?.sourceFrameWidth || 480;
    const sourceFrameHeight = profile?.sourceFrameHeight || 480;
    const referenceFrameHeight = profile?.referenceFrameHeight || sourceFrameHeight;
    const sourceScale = viewportSize / referenceFrameHeight * (profile?.renderScale || 1);
    const frameWidth = sourceFrameWidth * sourceScale;
    const frameHeight = sourceFrameHeight * sourceScale;
    const footAnchorX = profile?.footAnchorX ?? .5;
    const footAnchorY = profile?.footAnchorY ?? 1;
    const targetFootAnchorY = profile?.targetFootAnchorY ?? footAnchorY;

    return Object.freeze({
        frameWidth,
        frameHeight,
        left: viewportSize * .5 - frameWidth * footAnchorX,
        top: viewportSize * targetFootAnchorY - frameHeight * footAnchorY,
        imageLeft: -frameData.column * frameWidth,
        imageTop: -frameData.row * frameHeight
    });
}

export class GreyboxMapRenderer {
    constructor(viewport, map, enemies, debugGeometry = false) {
        this.viewport = viewport;
        this.map = map;
        this.referenceDefinition = getGreyboxReference(map);
        this.referenceWidth = this.referenceDefinition?.nativeWidth || 1;
        this.referenceHeight = this.referenceDefinition?.nativeHeight || 1;
        this.referenceStage = null;
        this.referenceImage = this.createReferenceImage();
        this.artworkImage = this.createArtworkImage();
        this.referenceCamera = this.referenceDefinition ? {
            x: this.referenceDefinition.registration.x,
            y: this.referenceDefinition.registration.y,
            zoom: this.referenceDefinition.registration.scale
        } : null;

        this.root = document.createElement('div');
        this.root.className = 'greybox-world';
        this.root.style.zIndex = '1';
        this.root.style.setProperty('--exploration-actor-width', `${EXPLORATION_ACTOR_METRICS.width}px`);
        this.root.style.setProperty('--exploration-actor-height', `${EXPLORATION_ACTOR_METRICS.height}px`);
        this.root.style.setProperty('--exploration-unit-visual-height', `${EXPLORATION_ACTOR_METRICS.standardVisualHeight}px`);
        (this.referenceStage || viewport).append(this.root);
        this.environmentLayer = this.createEnvironmentLayer();
        this.backgroundSurface = this.createSurface('greybox-background-structures');
        this.surface = this.createSurface('greybox-ground-layer');
        this.foregroundSurface = this.createSurface('greybox-foreground-occluders');
        this.buildGeometry(debugGeometry);
        this.playerAnchor = svgNode('circle');
        this.playerAnchor.setAttribute('r', '6');
        this.playerAnchor.setAttribute('class', 'greybox-player-anchor');
        this.surface.append(this.playerAnchor);
        this.player = this.actor('greybox-player');
        this.follower = document.createElement('div');
        this.follower.className = 'greybox-actor greybox-follower';
        this.follower.dataset.entityId = 'lucy';
        this.followerBody = createPlaceholderActor({ entityId: 'lucy', family: 'humanoid', state: 'idle', facing: 'east', role: 'follower' });
        this.follower.append(this.followerBody);
        this.root.append(this.follower);
        this.enemyNodes = enemies.map(enemy => {
            const definition = ENCOUNTER_DEFINITIONS[enemy.encounterId];
            return {
                enemy,
                assetId: enemy.assetId || definition?.enemyId,
                mapSpriteId: enemy.mapSpriteId || definition?.mapSpriteId || null,
                frames: enemy.idleFrames || definition?.idleAnimation?.frames || 1,
                node: this.actor('greybox-enemy')
            };
        });
        this.interactableNodes = map.interactables.map(item => this.createInteractable(item));
        this.exitPresentation = ExplorationExitPresentation.forRenderer(this);
        this.actorShadows = ExplorationActorShadow.forRenderer(this);
        this.foregroundLayer = document.createElement('div');
        this.foregroundLayer.className = 'exploration-foreground-layer';
        this.foregroundLayer.dataset.mapId = map.id;
        this.root.append(this.foregroundLayer);
        this.time = 0;
        this.playerAnimationTime = 0;
        this.lastPlayerFacing = 'south';
        this.wasPlayerMoving = false;
        this.followPosition = null;
        this.materialLayer = EnvironmentMaterialLayer.forRenderer(this);
        this.setDebugVisible(debugGeometry);
    }

    createReferenceImage() {
        const reference = this.referenceDefinition;
        if (!reference) return null;

        const stage = document.createElement('div');
        stage.className = 'exploration-greybox-reference-stage';
        stage.dataset.mapId = this.map.id;
        Object.assign(stage.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: `${this.referenceWidth}px`,
            height: `${this.referenceHeight}px`,
            zIndex: '0',
            transformOrigin: '0 0',
            pointerEvents: 'none'
        });

        const image = document.createElement('img');
        image.className = 'exploration-greybox-reference';
        image.alt = '';
        image.draggable = false;
        image.dataset.mapId = this.map.id;
        image.setAttribute('aria-hidden', 'true');
        Object.assign(image.style, {
            position: 'absolute',
            inset: '0',
            zIndex: '0',
            display: 'block',
            width: '100%',
            height: '100%',
            maxWidth: 'none',
            objectFit: 'contain',
            objectPosition: 'center center',
            pointerEvents: 'none',
            userSelect: 'none'
        });
        image.addEventListener('load', () => {
            if (!image.naturalWidth || !image.naturalHeight) return;
            if (image.naturalWidth !== reference.nativeWidth || image.naturalHeight !== reference.nativeHeight) {
                console.error(
                    `[Exploration] ${this.map.id} greybox is ${image.naturalWidth}x${image.naturalHeight}; `
                    + `calibration expects ${reference.nativeWidth}x${reference.nativeHeight}.`
                );
            }
        });
        image.src = reference.src;
        stage.append(image);
        this.viewport.append(stage);
        this.referenceStage = stage;
        return image;
    }

    createArtworkImage() {
        const artwork = getEnvironmentArtwork(this.map.id);
        if (!artwork || !this.referenceStage) return null;

        const image = document.createElement('img');
        image.className = 'exploration-final-artwork';
        image.alt = artwork.alt;
        image.draggable = false;
        image.dataset.mapId = this.map.id;
        image.setAttribute('aria-hidden', 'true');
        Object.assign(image.style, {
            position: 'absolute',
            inset: '0',
            zIndex: '0',
            display: 'block',
            width: '100%',
            height: '100%',
            maxWidth: 'none',
            objectFit: 'contain',
            objectPosition: 'center center',
            pointerEvents: 'none',
            userSelect: 'none'
        });
        image.addEventListener('load', () => {
            if (!image.naturalWidth || !image.naturalHeight) return;
            if (image.naturalWidth !== this.referenceWidth || image.naturalHeight !== this.referenceHeight) {
                console.error(
                    '[Exploration] ' + this.map.id + ' final artwork is '
                    + image.naturalWidth + 'x' + image.naturalHeight + '; calibration expects '
                    + this.referenceWidth + 'x' + this.referenceHeight + '.'
                );
            }
        });
        image.src = artwork.src;
        this.referenceStage.append(image);
        return image;
    }

    syncReferenceStage() {
        if (!this.referenceStage) return 1;
        const width = this.viewport.clientWidth || 1280;
        const height = this.viewport.clientHeight || 720;
        const scale = Math.min(width / this.referenceWidth, height / this.referenceHeight);
        const x = (width - this.referenceWidth * scale) / 2;
        const y = (height - this.referenceHeight * scale) / 2;
        this.referenceStage.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
        return scale;
    }

    createEnvironmentLayer() {
        if (this.referenceImage || !this.map.environmentImage) return null;
        const { src, projectionFrame, alt = '' } = this.map.environmentImage;
        const image = document.createElement('img');
        image.className = 'exploration-environment-image';
        image.src = src;
        image.alt = alt;
        image.draggable = false;
        image.dataset.mapId = this.map.id;
        Object.assign(image.style, {
            left: `${projectionFrame.x}px`,
            top: `${projectionFrame.y}px`,
            width: `${projectionFrame.width}px`,
            height: `${projectionFrame.height}px`
        });
        this.root.append(image);
        return image;
    }

    createSurface(layerClass) {
        const surface = svgNode('svg');
        surface.classList.add('greybox-surface', layerClass);
        surface.setAttribute('overflow', 'visible');
        this.root.append(surface);
        return surface;
    }

    buildGeometry(visible) {
        this.surface.hidden = !visible;
        const defs = svgNode('defs');
        const pattern = svgNode('pattern');
        pattern.id = `greybox-grid-${this.map.id}`;
        pattern.setAttribute('width', String(this.map.gridSize));
        pattern.setAttribute('height', String(this.map.gridSize));
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('patternTransform', 'matrix(.72 .36 -.72 .36 0 0)');
        const base = svgNode('rect');
        base.setAttribute('width', String(this.map.gridSize));
        base.setAttribute('height', String(this.map.gridSize));
        base.setAttribute('class', 'greybox-grid-base');
        const path = svgNode('path');
        path.setAttribute('d', `M ${this.map.gridSize} 0 L 0 0 0 ${this.map.gridSize}`);
        path.setAttribute('class', 'greybox-grid-line');
        pattern.append(base, path); defs.append(pattern); this.surface.append(defs);
        for (const polygon of this.map.walkablePolygons) {
            const ground = svgNode('polygon');
            ground.setAttribute('points', pointString(polygon));
            ground.setAttribute('class', 'greybox-walkable');
            ground.style.fill = `url(#${pattern.id})`;
            this.surface.append(ground);
        }
        for (const polygon of getTransitionPolygons(this.map)) {
            const ground = svgNode('polygon');
            ground.setAttribute('points', pointString(polygon));
            ground.setAttribute('class', 'greybox-walkable greybox-transition-walkable');
            ground.style.fill = `url(#${pattern.id})`;
            this.surface.append(ground);
        }
        for (const area of this.map.structuralGeometry) {
            const baseElevation = area.baseElevation || 0;
            const groundPoints = area.polygon.map(point => projectGround(point));
            const bottomPoints = groundPoints.map(point => ({ x: point.x, y: point.y - baseElevation }));
            const topPoints = bottomPoints.map(point => ({ x: point.x, y: point.y - (area.height || 90) }));
            const group = svgNode('g');
            group.setAttribute('class', 'greybox-structure');
            group.dataset.structureId = area.id;
            group.dataset.structureRole = area.role || 'structure';
            group.dataset.occlusionLayer = area.layer || 'background';
            const bottom = svgNode('polygon');
            bottom.setAttribute('points', bottomPoints.map(point => `${point.x},${point.y}`).join(' '));
            bottom.setAttribute('class', 'greybox-structure-bottom');
            group.append(bottom);
            for (let index = 0; index < bottomPoints.length; index += 1) {
                const side = svgNode('polygon');
                const next = (index + 1) % bottomPoints.length;
                side.setAttribute('points', [bottomPoints[index], bottomPoints[next], topPoints[next], topPoints[index]].map(point => `${point.x},${point.y}`).join(' '));
                side.setAttribute('class', 'greybox-structure-side');
                group.append(side);
            }
            const top = svgNode('polygon');
            top.setAttribute('points', topPoints.map(point => `${point.x},${point.y}`).join(' '));
            top.setAttribute('class', 'greybox-structure-top');
            group.append(top);
            (area.layer === 'foreground' ? this.foregroundSurface : this.backgroundSurface).append(group);
        }
        for (const exit of getExplorationExits(this.map)) {
            const polygon = exit.polygon || [
                { x: exit.xMin, y: exit.yMin },
                { x: exit.xMax, y: exit.yMin },
                { x: exit.xMax, y: exit.yMax },
                { x: exit.xMin, y: exit.yMax }
            ];
            const node = svgNode('polygon');
            node.setAttribute('points', pointString(polygon));
            node.setAttribute('class', 'greybox-exit');
            node.dataset.exitId = exit.id;
            this.surface.append(node);
        }
        for (const arrival of getArrivalMarkers(this.map)) {
            const projected = projectGround(arrival.world);
            const marker = svgNode('circle');
            marker.setAttribute('cx', String(projected.x));
            marker.setAttribute('cy', String(projected.y));
            marker.setAttribute('r', '7');
            marker.setAttribute('class', 'greybox-arrival-marker');
            marker.dataset.arrivalId = arrival.id;
            this.surface.append(marker);
        }
    }

    actor(extraClass) {
        if (extraClass === 'greybox-player') return this.createPlayerActor();
        const node = document.createElement('img');
        node.className = `greybox-actor ${extraClass}`;
        this.root.append(node);
        return node;
    }

    createPlayerActor() {
        const node = document.createElement('div');
        const frameSize = EXPLORATION_ACTOR_METRICS.height;
        node.className = 'greybox-actor greybox-player';
        node.dataset.entityId = 'luke';
        node.dataset.groundAnchor = 'feet';
        node.dataset.animationState = 'idle';
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', 'Luke');
        Object.assign(node.style, {
            width: `${frameSize}px`,
            height: `${frameSize}px`,
            overflow: 'visible'
        });
        node.style.setProperty('width', `${frameSize}px`, 'important');

        const viewport = document.createElement('span');
        Object.assign(viewport.style, {
            position: 'absolute',
            display: 'block',
            overflow: 'hidden',
            pointerEvents: 'none'
        });

        const image = document.createElement('img');
        image.alt = '';
        image.draggable = false;
        image.setAttribute('aria-hidden', 'true');
        Object.assign(image.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            display: 'block',
            maxWidth: 'none',
            maxHeight: 'none',
            pointerEvents: 'none',
            userSelect: 'none'
        });
        viewport.append(image);
        node.append(viewport);
        this.root.append(node);
        this.playerFrameViewport = viewport;
        this.playerImage = image;
        return node;
    }

    renderPlayerFrame(frameData) {
        if (this.playerImage.getAttribute('src') !== frameData.src) this.playerImage.src = frameData.src;
        this.player.dataset.animationState = 'walk';
        this.renderPlayerSpriteFrame(frameData);
    }

    renderPlayerIdle(idleData) {
        if (this.playerImage.getAttribute('src') !== idleData.src) this.playerImage.src = idleData.src;
        this.player.dataset.animationState = 'idle';
        this.renderPlayerSpriteFrame(idleData);
    }

    renderPlayerSpriteFrame(frameData) {
        const metrics = resolvePlayerFrameRenderMetrics(frameData);
        Object.assign(this.playerFrameViewport.style, {
            width: `${metrics.frameWidth}px`,
            height: `${metrics.frameHeight}px`,
            left: `${metrics.left}px`,
            top: `${metrics.top}px`
        });
        Object.assign(this.playerImage.style, {
            width: `${frameData.columns * metrics.frameWidth}px`,
            height: `${frameData.rows * metrics.frameHeight}px`,
            left: `${metrics.imageLeft}px`,
            top: `${metrics.imageTop}px`,
            objectFit: 'fill',
            objectPosition: 'center center'
        });
    }

    createInteractable(item) {
        const node = document.createElement('div');
        node.className = `greybox-interactable greybox-interactable-${item.type}`;
        node.dataset.interactionId = item.id;
        node.dataset.interactableId = item.id;
        if (item.type === 'npc') {
            const image = document.createElement('img');
            image.className = 'greybox-map-unit-sprite';
            image.src = AssetResolver.npcSprite(item.assetId || 'town-woman');
            image.alt = item.name;
            node.append(image);
        } else if (item.type !== 'sign') {
            const marker = document.createElement('span');
            marker.className = 'greybox-marker-glyph';
            marker.textContent = item.type === 'chest' ? '◇' : '◆';
            marker.setAttribute('aria-hidden', 'true');
            node.append(marker);
        }
        if (item.type !== 'sign') {
            const label = document.createElement('span');
            label.className = 'greybox-interactable-label';
            label.textContent = item.name;
            node.append(label);
        }
        this.root.append(node);
        return { item, node };
    }

    setDebugVisible(visible) {
        this.debugVisible = Boolean(visible);
        const normalGeometryVisible = Boolean(this.materialLayer && !this.artworkImage);
        for (const surface of [this.backgroundSurface, this.surface, this.foregroundSurface]) {
            surface.toggleAttribute('hidden', !this.debugVisible && !normalGeometryVisible);
        }
        this.materialLayer?.setDebugVisible(this.debugVisible);
        if (this.artworkImage) {
            this.artworkImage.style.display = this.debugVisible ? 'none' : 'block';
            if (this.referenceImage) this.referenceImage.style.display = this.debugVisible ? 'block' : 'none';
        }
        this.root.classList.toggle('greybox-debug-visible', this.debugVisible);
        this.root.classList.toggle(
            'exploration-environment-debug',
            Boolean((this.referenceImage || this.environmentLayer) && this.debugVisible)
        );
    }

    place(node, world, facing = 1, visualScale = 1) {
        const point = projectGround(world);
        Object.assign(node.style, {
            left: `${point.x}px`, top: `${point.y}px`,
            transform: `translate(-50%,-100%) scale(${visualScale}) scaleX(${facing})`,
            zIndex: String(1000 + Math.round((world.x + world.y) * 10))
        });
    }

    update(player, camera, dt, party) {
        this.time += dt * 1000;
        const stageScale = this.syncReferenceStage();
        const renderCamera = this.referenceCamera || camera;
        this.root.style.transform = `translate(${renderCamera.x}px,${renderCamera.y}px) scale(${renderCamera.zoom})`;
        const totalZoom = renderCamera.zoom * stageScale;
        const actorScale = (this.map.camera.actorScale || 1) / totalZoom;
        const actorScales = resolveExplorationActorScales(actorScale);
        const uiScale = 1 / totalZoom;
        const playerGround = projectGround(player.position);
        this.playerAnchor.setAttribute('cx', String(playerGround.x));
        this.playerAnchor.setAttribute('cy', String(playerGround.y));

        if (player.moving) {
            const direction = getLukeExplorationDirection(player.facing);
            if (!this.wasPlayerMoving || this.lastPlayerFacing !== player.facing) {
                this.playerAnimationTime = 0;
            } else {
                this.playerAnimationTime += dt * 1000;
            }
            const frame = Math.floor(this.playerAnimationTime / LUKE_EXPLORATION.walkFrameDurationMs) % direction.frames + 1;
            const frameData = getLukeExplorationFrameData(player.facing, frame);
            this.actorShadows.placePlayer('luke', player.position, frameData, actorScales.player);
            this.place(this.player, player.position, frameData.mirror ? -1 : 1, actorScales.player);
            this.renderPlayerFrame(frameData);
        } else {
            this.playerAnimationTime = 0;
            const idleData = getLukeExplorationIdleData(player.facing);
            this.actorShadows.placePlayer('luke', player.position, idleData, actorScales.player);
            this.place(this.player, player.position, idleData.mirror ? -1 : 1, actorScales.player);
            this.renderPlayerIdle(idleData);
        }
        this.lastPlayerFacing = player.facing;
        this.wasPlayerMoving = player.moving;

        this.follower.hidden = !party?.some(member => ['lucy', 'dummy'].includes(member.id) && member.active !== false);
        const followerOffset = EXPLORATION_ACTOR_METRICS.followerDistance * 0.65;
        const target = { x: player.position.x - followerOffset, y: player.position.y + followerOffset };
        if (!this.followPosition) this.followPosition = { ...target };
        const before = { ...this.followPosition };
        const blend = 1 - Math.exp(-8 * dt);
        this.followPosition.x += (target.x - this.followPosition.x) * blend;
        this.followPosition.y += (target.y - this.followPosition.y) * blend;
        this.actorShadows.place('follower', 'lucy', this.followPosition, actorScales.standard, this.follower.hidden);
        this.place(this.follower, this.followPosition, 1, actorScales.standard);
        setPlaceholderState(this.followerBody, Math.hypot(before.x - this.followPosition.x, before.y - this.followPosition.y) > 0.05 ? 'walk' : 'idle');
        const followerFacing = player.facing.includes('west')
            ? 'west'
            : player.facing.includes('east')
                ? 'east'
                : player.facing;
        setPlaceholderFacing(this.followerBody, followerFacing);
        for (const { enemy, node, assetId, mapSpriteId, frames } of this.enemyNodes) {
            this.actorShadows.place('enemy', enemy.id, enemy, actorScales.standard, node.hidden);
            this.place(node, enemy, enemy.direction || 1, actorScales.standard);
            const enemySource = mapSpriteId
                ? AssetResolver.enemyMapSprite(mapSpriteId)
                : AssetResolver.enemyAnimationFrame(assetId, 'idle', Math.floor(this.time / 125) % frames + 1);
            if (node.getAttribute('src') !== enemySource) node.src = enemySource;
        }
        for (const { item, node } of this.interactableNodes) {
            if (item.type === 'npc') this.actorShadows.place('npc', item.id, item, actorScales.standard, node.hidden);
            this.place(node, item, 1, item.type === 'npc' ? actorScales.standard : uiScale);
        }
    }

    dispose() {
        this.exitPresentation?.dispose();
        this.actorShadows?.dispose();
        this.artworkImage?.remove();
        this.referenceImage?.remove();
        this.referenceStage?.remove();
        if (!this.referenceStage) this.root.remove();
    }
}

export const LaneMapRenderer = GreyboxMapRenderer;
export const ExplorationMapRenderer = GreyboxMapRenderer;
