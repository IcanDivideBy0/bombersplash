const path = require("path");
const protobuf = require("protobufjs");

module.exports = {
  encodeMessage,
  decodeMessage
};

const promise = protobuf
  .load(path.join(process.cwd(), "public", "messages.proto"))
  .then(root => root.lookupType("bombersplash.BombersplashMessage"))
  .catch(console.error);

const getMessage = () => promise;

async function encodeMessage(messageType, data) {
  const Message = await getMessage();

  const dataKey = {
    "player:update": "playerUpdate",
    "game:update": "gameUpdate",
    "game:end": "gameEnd"
  }[messageType];

  return Message.encode(
    Message.fromObject({
      type: messageType,
      [dataKey]: data
    })
  ).finish();
}

async function decodeMessage(buffer) {
  const Message = await getMessage();

  const msg = Message.toObject(Message.decode(buffer), {
    longs: Number,
    enums: String,
    oneofs: true
  });

  return {
    type: msg.type,
    data: msg[msg.data]
  };
}
