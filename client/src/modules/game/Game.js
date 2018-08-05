import { getMapCollisionRects } from "tiled-utils";

import { DataChannel } from "modules/net";
import { EventEmitter, lerpVec } from "modules/utils";
import physicsLoader, { PhysicsWorker } from "modules/physics";

const PLAYER_MAX_SPEED = 8 * 16;
const UPDATE_INTERVAL = 1000 / 60;

export default class Game extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;

    this.packetId = 0;
    this.packets = [];
    this.latency = NaN;

    this.inputs = {
      vel: { x: 0, y: 0 },
      actions: {}
    };
    this.gameState = null;
    this.world = null;
    this.worldTime = 0;
    this.physicsWorker = null;

    this.id = null;
    this.mapUrl = null;
    this.map = null;
    this.playerId = null;
    this.remoteState = null;

    this.playerUpdateInterval = null;
  }

  destroy() {
    clearInterval(this.playerUpdateInterval);
    this.dataChannel.destroy();

    this.removeAllListeners("update");
    this.removeAllListeners("end");
  }

  join() {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout… Cannot establish connexion to server."));
      }, 15000);

      this.socket.emit("game:join", async (gameId, playerId, mapPath) => {
        clearTimeout(timeout);

        this.dataChannel = new DataChannel();
        await this.dataChannel.init(this.socket);

        this.id = gameId;
        this.playerId = playerId;
        this.mapUrl = process.env.REACT_APP_GAME_HOST + mapPath;

        await this.init();

        this.dataChannel.on("game:update", ({ gameState, lastPacketId }) => {
          this.updateState(
            {
              players: [],
              bombs: [],
              ...gameState
            },
            lastPacketId
          );
        });

        this.socket.on("game:end", results => {
          this.emit("end", results);
        });

        resolve({ gameId, playerId, mapPath });
      });
    });
  }

  async init() {
    this.physicsWorker = new PhysicsWorker();

    const [map, { BombersplashWorld }] = await Promise.all([
      fetch(this.mapUrl).then(res => res.json()),
      physicsLoader(),
      this.physicsWorker.init()
    ]);

    this.map = map;
    this.world = new BombersplashWorld();
    this.worldTime = performance.now();

    const walls = getMapCollisionRects(this.map).map(rect => ({
      pos: {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
      },
      rot: 0,
      w: rect.width,
      h: rect.height
    }));

    walls.forEach(wall => this.world.addWall(wall));

    await Promise.all(
      walls.map(wall => this.physicsWorker.exec("addWall", wall))
    );

    this.playerUpdateInterval = setInterval(
      () => this.sendPlayerUpdate(),
      UPDATE_INTERVAL
    );
  }

  setInputs(inputs) {
    this.inputs = inputs;
  }

  sendPlayerUpdate() {
    const packet = {
      packetId: this.packetId++,
      inputs: this.inputs
    };

    this.packets.push({
      time: performance.now(),
      ...packet
    });

    this.dataChannel.emit("player:update", packet);
  }

  async updateState(remoteState, lastPacketId) {
    // Remove all packets prior to the remote state
    const lastPacketIndex = this.packets.findIndex(
      p => p.packetId === lastPacketId
    );
    if (lastPacketIndex > 0) this.packets.splice(0, lastPacketIndex);

    // We receive packets faster than we can process them, better drop packets
    // than getting stuck processing data that getting older and older.
    if (this.physicsWorker.busy) return;

    const predictedRemotePlayer = await this.physicsWorker.batch(async exec => {
      // Reset world with remote game state
      await exec("setWorldState", remoteState);

      // Fast forward simulation until now
      if (this.packets.length) {
        const [lastPacketReceived, ...packetsToReplay] = this.packets;
        let rewindTimer = lastPacketReceived.time;

        // TODO
        // The more the player lag, the more there is packets to replay in
        // physical world. Only replay a fixed amount of packets to
        // prevent overloading the system.
        //
        // const MAX_PACKETS_REPLAY = 10;
        // if (packetsToReplay.length > MAX_PACKETS_REPLAY) {
        //   // Replay only firsts packets
        //   packetsToReplay.splice(MAX_PACKETS_REPLAY, packetsToReplay.length);
        // }
        //
        // const drop = this.packets.length - 1 - packetsToReplay.length;
        // console.log(
        //   `Dropped ${drop} replay packets, replaying ${packetsToReplay.length}`
        // );

        for (const packet of packetsToReplay) {
          await exec("step", (packet.time - rewindTimer) / 1000);

          const inputVel = packet.inputs.vel;
          await exec("setPlayerVelocity", this.playerId, {
            x: inputVel.x * PLAYER_MAX_SPEED,
            y: inputVel.y * PLAYER_MAX_SPEED
          });

          rewindTimer = packet.time;
        }
      }

      return exec("getPlayerState", this.playerId);
    });

    // Put everything like the server just told us.
    this.world.setWorldState(remoteState);

    // Mix what we currently showing to the user with what we have predicted
    // the server wil be. This adds a lot of smooth on our own movements.
    if (this.gameState) {
      const currentLocalPlayer = this.gameState.players.find(
        p => p.id === this.playerId
      );

      const mixPos = lerpVec(
        currentLocalPlayer.pos,
        predictedRemotePlayer.pos,
        // 0 = 100% smooth but wrong positioning
        // 1 = lot of hops but correct positioning
        0.5
      );
      this.world.replacePlayer({
        ...currentLocalPlayer,
        pos: mixPos,
        vel: {
          x: this.inputs.vel.x * PLAYER_MAX_SPEED,
          y: this.inputs.vel.y * PLAYER_MAX_SPEED
        }
      });
    }

    // Now replace local game state
    this.gameState = remoteState;
    this.copyWorldToGameState();

    this.emit("update", this.gameState);
  }

  getState() {
    if (!this.gameState) return null;

    const now = performance.now();

    const inputVel = this.inputs.vel;
    this.world.setPlayerVelocity(this.playerId, {
      x: inputVel.x * PLAYER_MAX_SPEED,
      y: inputVel.y * PLAYER_MAX_SPEED
    });

    this.world.step((now - this.worldTime) / 1000);
    this.worldTime = now;

    this.copyWorldToGameState();

    return this.gameState;
  }

  copyWorldToGameState() {
    Object.assign(this.gameState, this.world.getWorldState());
  }

  getCurrentPlayer() {
    if (!this.gameState) return null;
    return this.gameState.players.find(player => player.id === this.playerId);
  }
}
