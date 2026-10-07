const artwork = mapId => Object.freeze({
    src: './assets/images/background/map/final/' + mapId + '.png',
    alt: ''
});

export const ENVIRONMENT_ARTWORKS = Object.freeze({
    'front-forest': artwork('front-forest'),
    'deep-forest': artwork('deep-forest'),
    'town-south': artwork('town-south'),
    'town-north': artwork('town-north')
});

export function getEnvironmentArtwork(mapId) {
    return ENVIRONMENT_ARTWORKS[mapId] || null;
}
