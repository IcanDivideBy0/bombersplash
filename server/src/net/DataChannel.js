const EventEmitter = require("events");
const Peer = require("simple-peer");
const wrtc = require("wrtc");

const { encodeMessage, decodeMessage } = require("./messages");

// const encodeMessage = (eventName, data) =>
//   JSON.stringify({ type: eventName, data });
// const decodeMessage = message => JSON.parse(message);

class DataChannel extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
  }

  init(socket) {
    this.socket = socket;

    return new Promise(resolve => {
      this.peer = new Peer({
        initiator: false,
        wrtc,
        channelConfig: {
          ordered: false,
          maxRetransmits: 0
        }
      });

      this.peer.on("signal", data => {
        socket.emit("webrtc:signal", data);
      });

      this.signalHandler = data => this.peer.signal(data);
      socket.on("webrtc:signal", this.signalHandler);

      this.peer.on("connect", () => {
        this.connected = true;
        resolve();
      });

      this.peer.on("data", async message => {
        const { type, data } = await decodeMessage(message);
        super.emit(type, data);
      });

      this.peer.on("close", () => {
        this.connected = false;
        super.emit("close");
      });

      this.peer.on("error", error => {
        console.error(error);
      });
    });
  }

  destroy() {
    this.socket.removeListener("webrtc:signal", this.signalHandler);
    this.peer.destroy();
  }

  async emit(eventName, data) {
    if (!this.connected) return;

    const message = await encodeMessage(eventName, data);
    this.peer.send(message);
  }
}

module.exports = DataChannel;
