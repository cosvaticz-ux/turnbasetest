import { inverseProjectVector, projectGround } from '../core/ExplorationProjection.js';

const point = value => Object.freeze({ x: value.x, y: value.y });
const polygon = value => Object.freeze(value.map(point));
const makeReference = (id, nativeWidth, nativeHeight, registration, landmarks) => Object.freeze({
    src: `./assets/images/background/map/${id}.png`,
    nativeWidth,
    nativeHeight,
    registration: Object.freeze(registration),
    landmarks: Object.freeze(landmarks.map(entry => Object.freeze({
        name: entry[0], world: point(entry[1]), image: point(entry[2])
    })))
});

// Every PNG was measured independently. Registration maps projectGround()
// coordinates into native image pixels with a uniform scale and translation.
// Three widely separated named landmarks make every calibration auditable.
export const GREYBOX_REFERENCES = Object.freeze({
    'front-forest': makeReference('front-forest', 1672, 941,
        { x: 622.1506043956044, y: -135.8948076923076, scale: 1.3814560439560437 }, [
            ['west-road-threshold', { x: 60, y: 555 }, { x: 129.80, y: 169.96 }],
            ['central-path-corner', { x: 870, y: 270 }, { x: 1218.94, y: 431.05 }],
            ['east-forest-threshold', { x: 1510, y: 655 }, { x: 1472.57, y: 940.81 }]
        ]),
    'deep-forest': makeReference('deep-forest', 1672, 941,
        { x: 658.6105263157895, y: -86.65526315789488, scale: 1.23187134502924 }, [
            ['west-front-threshold', { x: 60, y: 560 }, { x: 215.14, y: 188.30 }],
            ['central-crossroads', { x: 840, y: 600 }, { x: 871.48, y: 551.95 }],
            ['east-fork', { x: 1510, y: 510 }, { x: 1545.56, y: 809.16 }]
        ]),
    'town-south': makeReference('town-south', 1672, 941,
        { x: 672.4613496932516, y: -82.15619631901842, scale: 1.514246762099523 }, [
            ['west-gate-road', { x: 390, y: 370 }, { x: 694.27, y: 332.14 }],
            ['plaza-center', { x: 720, y: 570 }, { x: 836.00, y: 621.06 }],
            ['south-road-mouth', { x: 805, y: 930 }, { x: 536.18, y: 863.64 }]
        ]),
    'town-north': makeReference('town-north', 1672, 941,
        { x: 705.4641237113402, y: -74.77020618556695, scale: 1.2503436426116838 }, [
            ['upper-road-opening', { x: 252, y: 136 }, { x: 809.89, y: 99.88 }],
            ['main-plaza', { x: 640, y: 555 }, { x: 781.99, y: 463.13 }],
            ['east-road', { x: 1510, y: 500 }, { x: 1614.71, y: 829.98 }]
        ])
});

export function getGreyboxReference(mapOrId) {
    return GREYBOX_REFERENCES[typeof mapOrId === 'string' ? mapOrId : mapOrId?.id] || null;
}

export function worldToGreyboxPixel(mapOrId, world) {
    const reference = getGreyboxReference(mapOrId);
    if (!reference) return null;
    const projected = projectGround(world);
    return {
        x: reference.registration.x + projected.x * reference.registration.scale,
        y: reference.registration.y + projected.y * reference.registration.scale
    };
}

export function greyboxPixelToWorld(mapOrId, imagePoint) {
    const reference = getGreyboxReference(mapOrId);
    if (!reference) return null;
    const { x, y, scale } = reference.registration;
    return inverseProjectVector({
        x: (imagePoint.x - x) / scale,
        y: (imagePoint.y - y) / scale
    });
}

const imageExit = (id, targetMap, targetFacing, imagePolygon, targetImage) => Object.freeze({
    id, targetMap, targetFacing, imagePolygon: polygon(imagePolygon), targetImage: point(targetImage)
});

const IMAGE_EXITS = Object.freeze({
    'front-forest': Object.freeze([
        imageExit('to-town-south', 'town-south', 'south',
            [{ x: 120, y: 155 }, { x: 220, y: 155 }, { x: 220, y: 215 }, { x: 120, y: 215 }],
            { x: 700, y: 400 }),
        imageExit('to-deep-forest', 'deep-forest', 'east',
            [{ x: 1420, y: 600 }, { x: 1460, y: 610 }, { x: 1510, y: 650 }, { x: 1400, y: 680 }],
            { x: 313, y: 237 })
    ]),
    'deep-forest': Object.freeze([
        imageExit('to-front-forest', 'front-forest', 'west',
            [{ x: 205, y: 165 }, { x: 300, y: 165 }, { x: 300, y: 245 }, { x: 205, y: 245 }],
            { x: 1340, y: 700 })
    ]),
    'town-south': Object.freeze([
        imageExit('to-front-forest', 'front-forest', 'east',
            [{ x: 620, y: 330 }, { x: 780, y: 330 }, { x: 780, y: 350 }, { x: 620, y: 350 }],
            { x: 254, y: 227 }),
        imageExit('to-town-north', 'town-north', 'south',
            [{ x: 820, y: 840 }, { x: 1100, y: 840 }, { x: 1100, y: 920 }, { x: 820, y: 920 }],
            { x: 850, y: 230 })
    ]),
    'town-north': Object.freeze([
        imageExit('to-town-south', 'town-south', 'north',
            [{ x: 760, y: 80 }, { x: 940, y: 80 }, { x: 940, y: 160 }, { x: 760, y: 160 }],
            { x: 930, y: 780 })
    ])
});

const CALIBRATED_EXITS = Object.freeze(Object.fromEntries(
    Object.entries(IMAGE_EXITS).map(([mapId, exits]) => [
        mapId,
        Object.freeze(exits.map(exit => Object.freeze({
            ...exit,
            polygon: polygon(exit.imagePolygon.map(value => greyboxPixelToWorld(mapId, value))),
            target: point(greyboxPixelToWorld(exit.targetMap, exit.targetImage))
        })))
    ])
));

// Smallest authored exception: Town North's upper image road must connect to
// the current collision mesh without widening unrelated walkable space.
const TRANSITION_IMAGE_POLYGONS = Object.freeze({
    'town-north': Object.freeze([polygon([
        { x: 760, y: 80 }, { x: 940, y: 80 }, { x: 920, y: 190 },
        { x: 880, y: 340 }, { x: 790, y: 340 }, { x: 740, y: 190 }
    ])])
});

const TRANSITION_POLYGONS = Object.freeze(Object.fromEntries(
    Object.entries(TRANSITION_IMAGE_POLYGONS).map(([mapId, polygons]) => [
        mapId,
        Object.freeze(polygons.map(imagePolygon => polygon(
            imagePolygon.map(value => greyboxPixelToWorld(mapId, value))
        )))
    ])
));

export function getExplorationExits(map) {
    return CALIBRATED_EXITS[map?.id] || map?.exits || [];
}

export function getTraversalPolygons(map) {
    const extra = TRANSITION_POLYGONS[map?.id] || [];
    return extra.length ? [...map.walkablePolygons, ...extra] : map.walkablePolygons;
}

export function getTransitionPolygons(map) {
    return TRANSITION_POLYGONS[map?.id] || [];
}

export function getArrivalMarkers(mapOrId) {
    const mapId = typeof mapOrId === 'string' ? mapOrId : mapOrId?.id;
    return Object.entries(CALIBRATED_EXITS).flatMap(([sourceMap, exits]) => exits
        .filter(exit => exit.targetMap === mapId)
        .map(exit => Object.freeze({
            id: `${sourceMap}:${exit.id}`,
            sourceMap,
            world: exit.target,
            image: exit.targetImage,
            facing: exit.targetFacing
        })));
}

export const GREYBOX_WARP_CALIBRATION = CALIBRATED_EXITS;
