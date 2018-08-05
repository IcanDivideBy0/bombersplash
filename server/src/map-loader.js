const fs = require("fs");
const path = require("path");

const mapsPath = path.join(process.cwd(), "public", "maps");
const mapsNames = fs.readdirSync(mapsPath);

module.exports = {
  getMapUrl: mapName => `/maps/${mapName}/map.json`,
  maps: mapsNames.reduce(
    (acc, mapName) => ({
      ...acc,
      [mapName]: require(path.join(mapsPath, mapName, "map.json"))
    }),
    {}
  )
};
