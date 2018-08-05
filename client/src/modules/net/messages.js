const protobuf = require("protobufjs");

const promise = fetch(process.env.REACT_APP_GAME_HOST + "/messages.proto")
  .then(response => response.text())
  .then(proto => protobuf.parse(proto))
  .then(({ root }) => root.lookupType("bombersplash.BombersplashMessage"));

const getMessage = () => promise;

export async function encodeMessage(messageType, data) {
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

export async function decodeMessage(buffer) {
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
