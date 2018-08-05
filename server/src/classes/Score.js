const os = require("os");
const { getMapCollisionRects } = require("tiled-utils");
const Canvas = require("canvas");

const TEAMS = {
  red: "#ff0000",
  green: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00"
};

class Score {
  constructor(map) {
    this.width = map.width * map.tilewidth;
    this.height = map.height * map.tileheight;
    this.collisionRects = getMapCollisionRects(map);

    this.canvas = new Canvas(this.width, this.height);
    const splashesCtx = this.canvas.getContext("2d");
    splashesCtx.webkitImageSmoothingEnabled = false;
    splashesCtx.mozImageSmoothingEnabled = false;
    splashesCtx.imageSmoothingEnabled = false;
  }

  addSplash(splash) {
    const splashCanvas = new Canvas(this.width, this.height);
    const splashCtx = splashCanvas.getContext("2d");

    splashCtx.fillStyle = TEAMS[splash.team];
    splashCtx.beginPath();
    splashCtx.arc(splash.pos.x, splash.pos.y, splash.r, 0, 2 * Math.PI, true);
    splashCtx.closePath();
    splashCtx.fill();

    // Everything we are drawing now will be cliped from current canvas.
    splashCtx.globalCompositeOperation = "destination-out";

    this.collisionRects.forEach(rect => {
      splashCtx.fillStyle = "#000";
      splashCtx.fillRect(rect.x, rect.y, rect.width, rect.height);

      const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x, y: rect.y + rect.height },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height }
      ];

      // Find the two corners that makes the wider angle with the
      // splash center.
      const res = corners.reduce(
        (acc, corner) => {
          let angle = Math.atan2(
            corner.y - splash.pos.y,
            corner.x - splash.pos.x
          );

          if (splash.pos.x > rect.x + rect.width) {
            angle += 2 * Math.PI;
            angle = angle % (2 * Math.PI);
          }

          if (angle > acc.max.angle) acc.max = { angle, pos: corner };
          if (angle < acc.min.angle) acc.min = { angle, pos: corner };

          return acc;
        },
        {
          min: { angle: Infinity, pos: null },
          max: { angle: -Infinity, pos: null }
        }
      );

      splashCtx.beginPath();
      splashCtx.arc(
        splash.pos.x,
        splash.pos.y,
        splash.r * 1.1,
        res.min.angle,
        res.max.angle,
        false
      );
      splashCtx.lineTo(res.max.pos.x, res.max.pos.y);
      splashCtx.lineTo(res.min.pos.x, res.min.pos.y);
      splashCtx.closePath();
      splashCtx.fill();
    });

    const splashesCtx = this.canvas.getContext("2d");
    splashesCtx.drawImage(splashCanvas, 0, 0);
  }

  getScore() {
    const buf = this.canvas.toBuffer("raw");

    const scores = {
      red: 0,
      green: 0,
      blue: 0,
      yellow: 0
    };

    const endianness = os.endianness();
    for (let i = 0; i < buf.length; i += 4) {
      const a = buf.readUInt8(endianness === "LE" ? i + 3 : i);
      const r = buf.readUInt8(endianness === "LE" ? i + 2 : i + 1);
      const g = buf.readUInt8(endianness === "LE" ? i + 1 : i + 1);
      const b = buf.readUInt8(endianness === "LE" ? i : i + 3);

      if (r === 255 && g === 0 && b === 0 && a === 255) scores.red++;
      if (r === 0 && g === 255 && b === 0 && a === 255) scores.green++;
      if (r === 0 && g === 0 && b === 255 && a === 255) scores.blue++;
      if (r === 255 && g === 255 && b === 0 && a === 255) scores.yellow++;
    }

    return scores;
  }
}

module.exports = Score;
