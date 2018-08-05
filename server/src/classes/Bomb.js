const EventEmitter = require("events");
const uuidv4 = require("uuid/v4");

const staticProperties = {
  RADIUS: 5,
  EXPLODE_TIMEOUT: 4 * 1000
};

class Bomb extends EventEmitter {
  constructor(player) {
    super();

    this.id = uuidv4();
    this.player = player;

    this.explodeTimeout = setTimeout(
      () => this.explode(),
      Bomb.EXPLODE_TIMEOUT
    );
  }

  destroy() {
    clearTimeout(this.explodeTimeout);
    this.removeAllListeners("explode");
  }

  explode() {
    this.emit("explode");
  }
}

Object.assign(Bomb, staticProperties);

module.exports = Bomb;
