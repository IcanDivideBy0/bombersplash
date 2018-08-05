const EventEmitter = require("events");
const uuidv4 = require("uuid/v4");

const { BombersplashWorld } = require("../physics");
const { getMapStartPositions, getMapCollisionRects } = require("tiled-utils");

const Player = require("./Player");
const Bomb = require("./Bomb");
const Score = require("./Score");

const staticProperties = {
  GAME_DURATION: 2 * 60 * 1000
};

class Game extends EventEmitter {
  constructor(map) {
    super();

    this.id = uuidv4();
    this.started = false;
    this.finished = false;

    this.map = map;

    // Setup teams
    this.teams = new Map();
    const startPositions = getMapStartPositions(this.map);
    Object.keys(startPositions).forEach(teamName =>
      this.teams.set(teamName, {
        name: teamName,
        startPosition: startPositions[teamName],
        players: new Map(),
        bombs: new Map(),
        score: 0,
        get size() {
          return this.players.size;
        }
      })
    );

    this.splashes = [];
    this.score = new Score(map);

    // Setup physic world simulation
    this.world = new BombersplashWorld();

    getMapCollisionRects(this.map).forEach(rect => {
      this.world.addWall({
        pos: {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        },
        rot: 0,
        w: rect.width,
        h: rect.height
      });
    });
  }

  /**
   *
   */

  destroy() {
    clearInterval(this.gameLoopInterval);
    clearInterval(this.scoreInterval);

    this.teams.forEach(team => {
      team.players.forEach(player => player.destroy());
      team.bombs.forEach(bomb => bomb.destroy());
    });

    this.removeAllListeners("end");
  }

  /**
   *
   */

  start() {
    if (this.started) return;
    this.started = true;

    this.startTime = Date.now();
    setTimeout(() => this.end(), Game.GAME_DURATION);

    this.lastLoopTimestamp = Date.now();
    this.gameLoopInterval = setInterval(() => this.run(), 1000 / 60);

    this.scoreInterval = setInterval(() => {
      const scores = this.score.getScore();

      this.teams.forEach(team => {
        team.score = scores[team.name] || 1;
      });
    }, 200);
  }

  /**
   *
   */

  end() {
    this.finished = true;
    this.emit("end", this.getScores());
  }

  /**
   *
   */

  run() {
    const now = Date.now();
    const deltaTime = now - this.lastLoopTimestamp;

    this.world.step(deltaTime / 1000);

    this.lastLoopTimestamp = now;
  }

  /**
   *
   */

  addPlayer() {
    // Find the team with lowest players count
    const team = [...this.teams.values()].reduce(
      (acc, team) => (acc.size <= team.size ? acc : team)
    );

    const player = new Player(team);
    team.players.set(player.id, player);

    this.world.addPlayer({
      id: player.id,
      team: team.name,
      pos: team.startPosition,
      rot: 0,
      vel: { x: 0, y: 0 },
      r: Player.RADIUS
    });

    player.on("updateInputVelocity", inputVelocity => {
      this.world.setPlayerVelocity(player.id, {
        x: inputVelocity.x * Player.MAX_SPEED,
        y: inputVelocity.y * Player.MAX_SPEED
      });
    });

    player.on("placeBomb", () => this.placeBomb(player));

    return player;
  }

  /**
   *
   */

  removePlayer(playerId) {
    // TODO: fix the network layer so it wont attempt to remove players
    // from finished game from the current one.
    // this.world.removePlayer(playerId);

    this.teams.forEach(team => {
      if (team.players.has(playerId)) {
        this.world.removePlayer(playerId);
        team.players.delete(playerId);
      }
    });
  }

  /**
   *
   */

  placeBomb(player) {
    const bomb = new Bomb(player);
    player.team.bombs.set(bomb.id, bomb);

    const { pos, vel } = this.world.getPlayerState(player.id);

    this.world.addBomb({
      id: bomb.id,
      team: player.team.name,
      pos: {
        x: pos.x - (vel.x / Player.MAX_SPEED) * Bomb.RADIUS,
        y: pos.y - (vel.y / Player.MAX_SPEED) * Bomb.RADIUS
      },
      rot: 0,
      vel: { x: 0, y: 0 },
      r: Bomb.RADIUS
    });

    bomb.on("explode", () => {
      const { pos } = this.world.getBombState(bomb.id);
      this.world.removeBomb(bomb.id);

      if (player.team.bombs.has(bomb.id)) {
        player.team.bombs.delete(bomb.id);
      }

      const splash = {
        id: uuidv4(),
        team: player.team.name,
        pos: {
          x: Math.round(pos.x),
          y: Math.round(pos.y)
        },
        rot: (Math.floor(Math.random() * 4) * Math.PI) / 2,
        r: 24
      };

      this.splashes.push(splash);
      this.score.addSplash(splash);
    });
  }

  /**
   *
   */

  getScores() {
    return [...this.teams.values()].reduce(
      (acc, team) => ({
        ...acc,
        [team.name]: team.score
      }),
      {}
    );
  }

  /**
   *
   */

  serialize() {
    return {
      remainingTime: this.startTime + Game.GAME_DURATION - Date.now(),
      ...this.world.getWorldState(),
      splashes: this.splashes,
      scores: this.getScores()
    };
  }
}

// Static properties
Object.assign(Game, staticProperties);

module.exports = Game;
