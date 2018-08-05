import React from "react";
import styled from "styled-components";

import {
  getMapCollisionRects,
  getTileSet,
  getTileId,
  getTileGid,
  getTileTransform,
  getTileConfig
} from "tiled-utils";

import { addVec, lerpVec } from "modules/utils";

const FPS = 60;
const INTERVAL = 1000 / FPS;

const Canvas = styled.canvas`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
`;

class GameCanvas extends React.Component {
  map = null;
  tileSetsImages = {};

  cameraPosition = { x: 0, y: 0 };
  lastFrameTimestamp = null;
  frameInterval = null;
  animationTimer = null;
  stats = {
    fps: 0,
    times: []
  };

  async componentDidMount() {
    const { game } = this.props;

    const player = game.getCurrentPlayer();
    this.cameraPosition = player ? player.pos : { x: 0, y: 0 };

    await this.loadTileSetsImages();

    this.collisionRects = getMapCollisionRects(game.map);

    this.lastFrameTimestamp = performance.now();
    this.animationRequestId = requestAnimationFrame(this.draw);
  }

  componentWillUnmount() {
    clearInterval(this.frameInterval);
    cancelAnimationFrame(this.animationRequestId);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  async loadTileSetsImages() {
    const { game } = this.props;
    const imagesBaseUrl = game.mapUrl.match(/^(.*\/)([^/]*)$/)[1];

    const loadImage = src =>
      new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);

        image.crossOrigin = "Anonymous";
        image.src = src;
      });

    return Promise.all(
      game.map.tilesets.map(async tileSet => {
        this.tileSetsImages[tileSet.image] = await loadImage(
          `${imagesBaseUrl}/${tileSet.image}`
        );
      })
    );
  }

  getTileSetImage(tileSet) {
    return this.tileSetsImages[tileSet.image];
  }

  /**
   * Main draw loop
   */

  draw = (now = performance.now()) => {
    this.animationRequestId = requestAnimationFrame(this.draw);
    const deltaTime = now - this.lastFrameTimestamp;

    if (deltaTime <= INTERVAL) return;

    while (this.stats.times.length > 0 && this.stats.times[0] <= now - 1000) {
      this.stats.times.shift();
    }
    this.stats.fps = this.stats.times.length;
    this.stats.times.push(now);

    this.lastFrameTimestamp = now - (deltaTime % INTERVAL);

    this.drawWorld(deltaTime);
  };

  /**
   * Draw a single tile
   */

  drawTile(ctx, position, tileGid) {
    const { game } = this.props;
    let cacheable = true;

    if (!tileGid) return cacheable;

    const tileSet = getTileSet(game.map.tilesets, tileGid);
    const tileId = getTileId(tileSet, tileGid);
    const tileConfig = getTileConfig(tileSet, tileGid);

    const { scaleX, scaleY, rotate } = getTileTransform(tileSet, tileGid);

    let image = this.getTileSetImage(tileSet);
    let sx = (tileId % tileSet.columns) * tileSet.tilewidth;
    let sy = Math.floor(tileId / tileSet.columns) * tileSet.tileheight;
    let sWidth = tileSet.tilewidth;
    let sHeight = tileSet.tileheight;
    let dx = position.x;
    let dy = position.y;
    let dWidth = tileSet.tilewidth;
    let dHeight = tileSet.tileheight;

    const hasTransforms = scaleX !== 1 || scaleY !== 1 || rotate !== 0;
    if (hasTransforms) {
      ctx.save();

      ctx.translate(dx + game.map.tilewidth / 2, dy + game.map.tileheight / 2);
      dx = -game.map.tilewidth / 2;
      dy = -game.map.tileheight / 2;

      ctx.scale(scaleX, scaleY);
      ctx.rotate(rotate);
    }

    if (tileConfig.animation) {
      cacheable = false;

      const duration = tileConfig.animation.reduce(
        (acc, step) => acc + step.duration,
        0
      );
      const animationTiming = this.animationTimer % duration;

      let combinedStepsDuration = 0;
      let animatedTileId;
      for (let i = 0; i < tileConfig.animation.length; i++) {
        combinedStepsDuration += tileConfig.animation[i].duration;

        if (animationTiming < combinedStepsDuration) {
          animatedTileId = tileConfig.animation[i].tileid;
          break;
        }
      }

      sx = (animatedTileId % tileSet.columns) * tileSet.tilewidth;
      sy = Math.floor(animatedTileId / tileSet.columns) * tileSet.tileheight;
    }

    ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

    if (hasTransforms) ctx.restore();

    return cacheable;
  }

  /**
   * Draw a sing tile layer
   */

  drawTileLayer(ctx, layer) {
    const { game } = this.props;
    let cacheable = true;

    const getTilePosition = (containerWidth, index) => ({
      x: (index % containerWidth) * game.map.tilewidth,
      y: Math.floor(index / containerWidth) * game.map.tileheight
    });

    const layerShift = addVec({
      x: (layer.x + layer.startx) * game.map.tilewidth + (layer.offsetx || 0),
      y: (layer.y + layer.starty) * game.map.tileheight + (layer.offsety || 0)
    });

    cacheable = (layer.data || []).reduce((acc, tileGid, tileIdx) => {
      const tilePosition = getTilePosition(layer.width, tileIdx);

      return this.drawTile(ctx, layerShift(tilePosition), tileGid) && acc;
    }, cacheable);

    cacheable = (layer.chunks || []).reduce((acc, chunk) => {
      const chunkShift = addVec(
        layerShift({
          x: (chunk.x - layer.startx) * game.map.tilewidth,
          y: (chunk.y - layer.starty) * game.map.tileheight
        })
      );

      return (
        chunk.data.reduce((acc, tileGid, tileIdx) => {
          const tilePosition = getTilePosition(chunk.width, tileIdx);

          return this.drawTile(ctx, chunkShift(tilePosition), tileGid) && acc;
        }, cacheable) && acc
      );
    }, cacheable);

    return cacheable;
  }

  /**
   * Draw a layer group
   */

  drawGroupLayer(ctx, layer) {
    const { game } = this.props;

    const layerPosition = {
      x: (layer.x + layer.startx) * game.map.tilewidth + (layer.offsetx || 0),
      y: (layer.y + layer.starty) * game.map.tileheight + (layer.offsety || 0)
    };

    ctx.save();
    ctx.translate(layerPosition.x, layerPosition.x);

    layer.layers.forEach(layer => {
      this.drawLayer(ctx, layer);
    });

    ctx.restore();

    // Not cacheable as a whole, but all sublayers will be cached if possible.
    return false;
  }

  /**
   * Draw a singl layer
   */

  drawLayer(ctx, layer) {
    const { game } = this.props;
    this.layersCache = this.layersCache || {};

    if (!layer.visible) return;

    if (this.layersCache[layer.name]) {
      ctx.drawImage(this.layersCache[layer.name], 0, 0);
      return;
    }

    let layerCtx = ctx;

    if (layer.name in this.layersCache) {
      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = game.map.width * game.map.tilewidth;
      offscreenCanvas.height = game.map.height * game.map.tileheight;

      layerCtx = offscreenCanvas.getContext("2d");
      layerCtx.webkitImageSmoothingEnabled = false;
      layerCtx.mozImageSmoothingEnabled = false;
      layerCtx.imageSmoothingEnabled = false;

      this.layersCache[layer.name] = offscreenCanvas;
    }

    let cacheable;
    switch (layer.type) {
      case "tilelayer": {
        cacheable = this.drawTileLayer(layerCtx, layer);
        break;
      }

      case "objectgroup":
        break; // TODO

      case "group":
        cacheable = this.drawGroupLayer(layerCtx, layer);
        break;

      default:
        break;
    }

    if (cacheable && !(layer.name in this.layersCache)) {
      this.layersCache[layer.name] = null;
    }
  }

  /**
   * Draw the map
   */

  drawMap(ctx) {
    const { game } = this.props;
    game.map.layers.forEach(layer => this.drawLayer(ctx, layer));
  }

  /**
   * Draw paint splashes
   */

  drawPaintSplashes(ctx, gameState) {
    const { game } = this.props;

    if (!this.splashesCanvas) {
      this.splashesCanvas = document.createElement("canvas");
      this.splashesCanvas.width = game.map.width * game.map.tilewidth;
      this.splashesCanvas.height = game.map.height * game.map.tileheight;

      const splashesCtx = this.splashesCanvas.getContext("2d");
      splashesCtx.webkitImageSmoothingEnabled = false;
      splashesCtx.mozImageSmoothingEnabled = false;
      splashesCtx.imageSmoothingEnabled = false;
    }

    if (!this.splashesCache) {
      this.splashesCache = [];
    }

    const getTeamGidOffset = team => {
      return (
        {
          green: 0,
          blue: 3,
          red: 6,
          yellow: 9
        }[team] || 0
      );
    };

    const getTeamColors = team => {
      return {
        green: {
          base: { r: 68, g: 119, b: 51, a: 255 },
          highlight: { r: 100, g: 145, b: 84, a: 255 }
        },
        blue: {
          base: { r: 51, g: 119, b: 153, a: 255 },
          highlight: { r: 91, g: 163, b: 199, a: 255 }
        },
        red: {
          base: { r: 146, g: 38, b: 59, a: 255 },
          highlight: { r: 208, g: 70, b: 72, a: 255 }
        },
        yellow: {
          base: { r: 191, g: 123, b: 63, a: 255 },
          highlight: { r: 207, g: 188, b: 68, a: 255 }
        }
      }[team];
    };

    const splashesCtx = this.splashesCanvas.getContext("2d");

    (gameState.splashes || []).forEach(splash => {
      if (~this.splashesCache.indexOf(splash.id)) return;
      this.splashesCache.push(splash.id);

      const splashCanvas = document.createElement("canvas");
      splashCanvas.width = game.map.width * game.map.tilewidth;
      splashCanvas.height = game.map.height * game.map.tileheight;

      const splashCtx = splashCanvas.getContext("2d");

      splashCtx.save();
      splashCtx.translate(splash.pos.x, splash.pos.y);
      splashCtx.rotate(splash.rot);

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          this.drawTile(
            splashCtx,
            { x: (j - 1) * 16 - 8, y: (i - 1) * 16 - 8 },
            getTileGid(game.map.tilesets, "Custom", 96 + j + i * 16) +
              getTeamGidOffset(splash.team)
          );
        }
      }
      splashCtx.restore();

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

        // splashCtx.fillStyle = "red";
        // splashCtx.beginPath();
        // splashCtx.fillRect(splash.pos.x, splash.pos.y, 1, 1);
        // splashCtx.closePath();
        // splashCtx.fill();
      });

      const splashImageData = splashCtx.getImageData(
        0,
        0,
        splashCanvas.width,
        splashCanvas.height
      );

      const splashesImageData = splashesCtx.getImageData(
        0,
        0,
        splashCanvas.width,
        splashCanvas.height
      );

      const colors = getTeamColors(splash.team);

      for (let idx = 0; idx < splashImageData.data.length; idx += 4) {
        const r = splashImageData.data[idx];
        const g = splashImageData.data[idx + 1];
        const b = splashImageData.data[idx + 2];
        const a = splashImageData.data[idx + 3];

        if (
          r === colors.base.r &&
          g === colors.base.g &&
          b === colors.base.b &&
          a === colors.base.a
        ) {
          splashesImageData.data[idx] = r;
          splashesImageData.data[idx + 1] = g;
          splashesImageData.data[idx + 2] = b;
          splashesImageData.data[idx + 3] = a;
        } else if (
          r === colors.highlight.r &&
          g === colors.highlight.g &&
          b === colors.highlight.b &&
          a === colors.highlight.a
        ) {
          const _r = splashesImageData.data[idx];
          const _g = splashesImageData.data[idx + 1];
          const _b = splashesImageData.data[idx + 2];
          const _a = splashesImageData.data[idx + 3];

          if (
            _r !== colors.base.r ||
            _g !== colors.base.g ||
            _b !== colors.base.b ||
            _a !== colors.base.a
          ) {
            splashesImageData.data[idx] = r;
            splashesImageData.data[idx + 1] = g;
            splashesImageData.data[idx + 2] = b;
            splashesImageData.data[idx + 3] = a;
          }
        }
      }

      splashesCtx.putImageData(splashesImageData, 0, 0);
    });

    ctx.drawImage(this.splashesCanvas, 0, 0);
  }

  /**
   * Draw bombs
   */

  drawBombs(ctx, gameState) {
    const { game } = this.props;

    const getTeamGidOffset = team => {
      return (
        {
          yellow: 3,
          green: 0,
          blue: 1,
          red: 2
        }[team] || 0
      );
    };

    (gameState.bombs || []).forEach(bomb => {
      this.drawTile(
        ctx,
        { x: bomb.pos.x - 8, y: bomb.pos.y - 8 },
        getTileGid(game.map.tilesets, "Custom", 6) + getTeamGidOffset(bomb.team)
      );

      this.drawTile(
        ctx,
        { x: bomb.pos.x - 8, y: bomb.pos.y - 8 },
        getTileGid(game.map.tilesets, "Custom", 10)
      );
    });
  }

  /**
   * Draw players
   */

  drawPlayers(ctx, gameState) {
    const SPEED_THRESHOLD = 0.1;
    const { game } = this.props;

    const getTeamGidOffset = team => {
      return (
        {
          yellow: 0,
          green: 1,
          blue: 2,
          red: 3
        }[team] || 0
      );
    };

    (gameState.players || []).forEach(player => {
      ctx.save();
      ctx.translate(Math.round(player.pos.x), Math.round(player.pos.y));

      const speed = Math.hypot(player.vel.x, player.vel.y);
      const isMoving = speed > SPEED_THRESHOLD;

      if (isMoving) {
        const animShift = Math.sin(this.animationTimer / 60);

        ctx.translate(0, -Math.abs(animShift * 2));

        ctx.translate(0, 8);
        ctx.rotate(animShift / 10);
        ctx.translate(0, -8);
      }

      if (player.vel.x) ctx.scale(Math.sign(player.vel.x), 1);

      this.drawTile(
        ctx,
        { x: -8, y: -26 },
        getTileGid(game.map.tilesets, "Custom", 56) +
          getTeamGidOffset(player.team)
      );
      this.drawTile(
        ctx,
        { x: -8, y: -10 },
        getTileGid(game.map.tilesets, "Custom", 72) +
          getTeamGidOffset(player.team)
      );

      ctx.restore();
    });
  }

  /**
   * Draw game infos
   */

  drawGameInfos(ctx, gameState) {
    const { remainingTime } = gameState;

    const date = new Date(remainingTime);

    const min = date
      .getUTCMinutes()
      .toString()
      .padStart(2, "0");
    const sec = date
      .getUTCSeconds()
      .toString()
      .padStart(2, "0");
    const msec = date
      .getUTCMilliseconds()
      .toString()
      .padStart(3, "0");

    const text = `${min}:${sec}.${msec}`;
    const urgent =
      remainingTime < 10000 && !(Math.floor(remainingTime / 1000) % 2);

    ctx.font = "16px sans-serif";
    const { width: textWidth } = ctx.measureText(text);

    ctx.fillStyle = urgent ? "#aa3333" : "white";
    ctx.fillText(text, (ctx.canvas.width - textWidth) / 2, 16 + 8);
  }

  /**
   * Draw stats
   */

  drawStats(ctx) {
    const { game } = this.props;

    ctx.font = "12px sans-serif";
    ctx.fillStyle = "white";

    // Latency
    if (!isNaN(game.latency)) {
      const latencyText = `${Math.round(game.latency)} ms`;
      const { width: latencyTextWidth } = ctx.measureText(latencyText);
      ctx.fillText(
        latencyText,
        ctx.canvas.width - latencyTextWidth - 4,
        ctx.canvas.height - 20
      );
    }

    // FPS
    const fpsText = `${this.stats.fps} fps`;
    const { width: fpsTextWidth } = ctx.measureText(fpsText);
    ctx.fillText(
      fpsText,
      ctx.canvas.width - fpsTextWidth - 4,
      ctx.canvas.height - 4
    );
  }

  /**
   * Draw he whole canvas
   */

  drawWorld(deltaTime) {
    if (!this.canvas) return;

    const { game } = this.props;
    const gameState = game.getState();
    if (!gameState) return;

    this.animationTimer = performance.now();
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

    ctx.save();

    ctx.translate(
      Math.floor(ctx.canvas.width / 2),
      Math.floor(ctx.canvas.height / 2)
    );

    ctx.scale(3, 3);

    // Smooth camera
    const player = game.getCurrentPlayer();
    if (player)
      this.cameraPosition = lerpVec(this.cameraPosition, player.pos, 0.08);

    ctx.translate(
      Math.round(-this.cameraPosition.x),
      Math.round(-this.cameraPosition.y)
    );

    this.drawMap(ctx);
    this.drawPaintSplashes(ctx, gameState);
    this.drawBombs(ctx, gameState);
    this.drawPlayers(ctx, gameState);

    ctx.restore();

    this.drawGameInfos(ctx, gameState);
    this.drawStats(ctx);
  }

  handleCanvasRef = ref => {
    this.canvas = ref;
    setInterval(() => (this.max = 0), 1000);
  };

  render() {
    return <Canvas width="800" height="600" innerRef={this.handleCanvasRef} />;
  }
}

export default GameCanvas;
