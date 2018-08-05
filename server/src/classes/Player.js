const EventEmitter = require("events");
const uuidv4 = require("uuid/v4");

const staticProperties = {
  MAX_SPEED: 8 * 16, // tiles * tileSize / seconds;
  RADIUS: 5,
  MAX_BOMBS: 6,
  BOMBS_PER_SEC: 2
};

class Player extends EventEmitter {
  constructor(team) {
    super();

    this.id = uuidv4();
    this.bombsCount = Player.MAX_BOMBS;
    this.team = team;

    this.isPlacingBomb = false;
    this.bombInterval = setInterval(() => {
      if (this.bombsCount < Player.MAX_BOMBS) this.bombsCount++;
    }, 1000 / Player.BOMBS_PER_SEC);
  }

  destroy() {
    clearInterval(this.bombInterval);

    this.removeAllListeners("updateInputVelocity");
    this.removeAllListeners("placeBomb");
  }

  updateInputs({ vel, actions }) {
    this.updateInputVelocity(vel);
    this.updateInputActions(actions);
  }

  updateInputVelocity({ x, y }) {
    const hypot = Math.hypot(x, y);

    this.emit("updateInputVelocity", {
      x: hypot < 1 ? x : x / hypot,
      y: hypot < 1 ? y : y / hypot
    });
  }

  updateInputActions(actions) {
    if (actions.placeBomb && !this.isPlacingBomb) {
      this.isPlacingBomb = true;
      this.placeBomb();
    }

    if (this.isPlacingBomb && !actions.placeBomb) this.isPlacingBomb = false;
  }

  placeBomb() {
    if (this.bombsCount < 1) return;
    this.bombsCount--;

    this.emit("placeBomb");
  }
}

Object.assign(Player, staticProperties);

module.exports = Player;
