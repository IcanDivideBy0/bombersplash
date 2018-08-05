const Game = require("./classes/Game");
const { maps, getMapUrl } = require("./map-loader");
const { DataChannel } = require("./net");

module.exports = gameMiddleware;

// Simulate some reasonable lag in development so we never forget about it
const LAG =
  process.env.NODE_ENV !== "development"
    ? 0
    : Math.round(Math.random() * 10) + 20;
const fakeLag = () =>
  LAG && new Promise(resolve => setTimeout(resolve, LAG / 2));

const GAME_MAP = "default";

function gameFactory(io) {
  const game = new Game(maps[GAME_MAP]);
  game.start();

  const updateInterval = setInterval(async () => {
    io.in(game.id).clients(async (err, socketIds) => {
      const serializedGame = game.serialize();

      socketIds.forEach(async socketId => {
        const socket = io.clients().sockets[socketId];
        const lastPacketId = socket.player.lastPacketId;

        await fakeLag();

        if (!socket.dataChannel || !socket.dataChannel.connected) return;
        socket.dataChannel.emit("game:update", {
          lastPacketId,
          gameState: serializedGame
        });
      });
    });
  }, 1000 / 30);

  game.once("end", scores => {
    clearInterval(updateInterval);
    io.to(game.id).emit("game:end", scores);

    game.destroy();
  });

  return game;
}

function gameMiddleware(io) {
  let game;

  io.on("connection", socket => {
    socket.on("game:join", async callback => {
      if (!game || game.finished) game = gameFactory(io);

      const player = game.addPlayer();
      socket.player = player;

      const dataChannel = new DataChannel();
      dataChannel.init(socket);

      dataChannel.on("player:update", async ({ packetId, inputs }) => {
        await fakeLag();

        if (!player) return;
        player.lastPacketId = packetId;
        player.updateInputs(inputs);
      });

      socket.dataChannel = dataChannel;
      socket.join(game.id);

      game.once("end", () => {
        if (socket.player) {
          socket.player.destroy();
          delete socket.player;
        }

        if (socket.dataChannel) {
          socket.dataChannel.destroy();
          delete socket.dataChannel;
        }
      });

      callback(game.id, player.id, getMapUrl(GAME_MAP));
    });

    socket.once("disconnect", () => {
      if (socket.player) {
        game.removePlayer(socket.player.id);
        socket.player.destroy();
        delete socket.player;
      }

      if (socket.dataChannel) {
        socket.dataChannel.destroy();
        delete socket.dataChannel;
      }
    });
  });

  return (req, res, next) => next();
}
