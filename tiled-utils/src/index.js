const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG = 0x20000000;

const START_POSITION_OBJECT_TYPE = "startPosition";
const COLLISION_BOX_OBJECT_TYPE = "collisionBox";

module.exports = {
  convertTiledColor,
  getRealTileGid,
  getTileId,
  getTileConfig,
  getTileBgPos,
  getTileProperties,
  getTileProperty,
  getTileTransform,
  getLayerProperties,
  getLayerProperty,
  getTileSet,
  getTileSetByName,
  getTileGid,
  getMapStartPositions,
  getMapCollisionRects
};

function convertTiledColor(tiledColor, alpha = 1) {
  let [a, r, g, b] = tiledColor.match(/([0-9]|[a-f]){1,2}/gi);
  if (!b) [r, g, b, a] = [a, r, g, "ff"];

  [r, g, b, a] = [r, g, b, a].map(v => parseInt(v, 16));

  return `rgba(${r}, ${g}, ${b}, ${(a / 255) * alpha})`;
}

function getRealTileGid(tileGid) {
  return (
    tileGid &
    ~(
      FLIPPED_HORIZONTALLY_FLAG |
      FLIPPED_VERTICALLY_FLAG |
      FLIPPED_DIAGONALLY_FLAG
    )
  );
}

function getTileId(tileSet, tileGid) {
  const realTileGid = getRealTileGid(tileGid);
  return realTileGid - tileSet.firstgid;
}

function getTileConfig(tileSet, tileGid) {
  if (!tileSet.tiles) return {};

  const tileId = getTileId(tileSet, tileGid);
  return tileSet.tiles[tileId] || {};
}

function getTileBgPos(tileSet, tileGid) {
  const tileId = getTileId(tileSet, tileGid);

  return {
    x: (tileId % tileSet.columns) * -tileSet.tilewidth,
    y: Math.floor(tileId / tileSet.columns) * -tileSet.tileheight
  };
}

function getTileProperties(tileSet, tileGid) {
  const tileId = getTileId(tileSet, tileGid);
  const tilesProperties = tileSet.tileproperties || {};
  return tilesProperties[tileId] || {};
}

function getTileProperty(tileSet, tileGid, propertyName, defaultValue) {
  const properties = getTileProperties(tileSet, tileGid);
  return propertyName in properties ? properties[propertyName] : defaultValue;
}

function getTileTransform(tileSet, tileGid) {
  let scaleX = 1;
  let scaleY = 1;
  let rotate = 0;

  if (tileGid & FLIPPED_HORIZONTALLY_FLAG) scaleX = -1;
  if (tileGid & FLIPPED_VERTICALLY_FLAG) scaleY = -1;
  if (tileGid & FLIPPED_DIAGONALLY_FLAG) {
    scaleY = ~scaleY + 1;
    rotate = -90;
  }

  return { scaleX, scaleY, rotate };
}

function getLayerProperties(layer) {
  return layer.properties || {};
}

function getLayerProperty(layer, propertyName, defaultValue) {
  const properties = getLayerProperties(layer);
  return propertyName in properties ? properties[propertyName] : defaultValue;
}

function getTileSet(tileSets, tileGid) {
  const realTileGid = getRealTileGid(tileGid);

  return tileSets.find(
    tileSet =>
      realTileGid >= tileSet.firstgid &&
      realTileGid < tileSet.firstgid + tileSet.tilecount
  );
}

function getTileSetByName(tileSets, tileSetName) {
  return tileSets.find(tileSet => tileSet.name === tileSetName);
}

function getTileGid(tileSets, tileSetName, tileId) {
  const tileSet = getTileSetByName(tileSets, tileSetName);
  return !tileSet ? 0 : tileId + tileSet.firstgid;
}

function getMapStartPositions(map) {
  return map.layers.filter(l => l.type === "objectgroup").reduce(
    (acc, layer) => ({
      ...acc,
      ...layer.objects
        .filter(o => o.type === START_POSITION_OBJECT_TYPE)
        .reduce(
          (acc, o) => ({
            ...acc,
            [o.name]: {
              x: layer.x * map.tilewidth + (layer.offsetx || 0) + o.x,
              y: layer.y * map.tileheight + (layer.offsety || 0) + o.y
            }
          }),
          {}
        )
    }),
    {}
  );
}

function getMapCollisionRects(map) {
  // Collision layer rects
  const collisionLayerRects = map.layers
    .filter(l => l.type === "objectgroup" && l.visible)
    .reduce(
      (acc, layer) => [
        ...acc,
        ...layer.objects
          .filter(o => o.type === COLLISION_BOX_OBJECT_TYPE)
          .map(o => ({
            x: layer.x * map.tilewidth + (layer.offsetx || 0) + o.x,
            y: layer.y * map.tileheight + (layer.offsety || 0) + o.y,
            width: o.width,
            height: o.height
          }))
      ],
      []
    );

  // Tiles defined rects
  const tileLayersRects = map.layers
    .filter(l => l.type === "tilelayer" && l.visible)
    .reduce((acc, layer) => {
      const chunksRects = (layer.chunks || []).reduce((acc, chunk) => {
        const chunkRects = (chunk.data || []).reduce(
          (acc, tileGid, tileIdx) => {
            if (!tileGid) return acc;

            const tileSet = getTileSet(map.tilesets, tileGid);
            const tileConfig = getTileConfig(tileSet, tileGid);
            if (!tileConfig) return acc;
            if (!tileConfig.objectgroup) return acc;

            return [
              ...acc,
              ...tileConfig.objectgroup.objects
                .filter(o => o.type === COLLISION_BOX_OBJECT_TYPE)
                .map(o => ({
                  x:
                    (layer.x + chunk.x + (tileIdx % chunk.width)) *
                      map.tilewidth +
                    (layer.offsetx || 0) +
                    o.x,
                  y:
                    (layer.y + chunk.y + Math.floor(tileIdx / chunk.width)) *
                      map.tileheight +
                    (layer.offsety || 0) +
                    o.y,
                  width: o.width,
                  height: o.height
                }))
            ];
          },
          []
        );

        return [...acc, ...chunkRects];
      }, []);

      const dataRects = (layer.data || []).reduce((acc, tileGid, tileIdx) => {
        if (!tileGid) return acc;

        const tileSet = getTileSet(map.tilesets, tileGid);
        const tileConfig = getTileConfig(tileSet, tileGid);
        if (!tileConfig) return acc;
        if (!tileConfig.objectgroup) return acc;

        return [
          ...acc,
          ...tileConfig.objectgroup.objects
            .filter(o => o.type === COLLISION_BOX_OBJECT_TYPE)
            .map(o => ({
              x:
                (layer.x + layer.startx + (tileIdx % layer.width)) *
                  map.tilewidth +
                (layer.offsetx || 0) +
                o.x,
              y:
                (layer.y + layer.starty + Math.floor(tileIdx / layer.width)) *
                  map.tileheight +
                (layer.offsety || 0) +
                o.y,
              width: o.width,
              height: o.height
            }))
        ];
      }, []);

      return [...acc, ...chunksRects, ...dataRects];
    }, []);

  return [...collisionLayerRects, ...tileLayersRects];
}
