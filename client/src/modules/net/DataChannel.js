import Peer from "simple-peer";

import { EventEmitter } from "modules/utils";
import { encodeMessage, decodeMessage } from "./messages";

// const encodeMessage = (eventName, data) =>
//   JSON.stringify({ type: eventName, data });
// const decodeMessage = message => JSON.parse(message);

export default class DataChannel extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
  }

  init(socket) {
    this.socket = socket;

    return new Promise(resolve => {
      this.peer = new Peer({
        initiator: true,
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
    });
  }

  destroy() {
    this.socket.removeListener("webrtc:signal", this.signalHandler);
    this.peer.destroy();
    this.connected = false;
  }

  async emit(eventName, data) {
    const message = await encodeMessage(eventName, data);
    if (!this.connected) return;
    this.peer.send(message);
  }
}
