import { EventEmitter, WebWorker } from "modules/utils";

function physicsWorker() {
  /* eslint-disable no-restricted-globals */

  function init({ origin, wasmUrl, jsUrl }) {
    self.wasmModule = {};

    return Promise.all([
      fetch(origin + wasmUrl),
      fetch(origin + jsUrl).then(response => response.text())
    ])
      .then(result => {
        const response = result[0];
        let jsCode = result[1];

        jsCode = jsCode.substring(
          jsCode.indexOf("{") + 1,
          jsCode.lastIndexOf("}")
        );

        (function() {
          // eslint-disable-next-line no-unused-vars
          var wasm = self.wasmModule;
          // eslint-disable-next-line no-eval
          eval(jsCode);
        })();

        return self.WebAssembly.instantiateStreaming(response, {
          "./physics": self.wasm_bindgen,
          // WTF ? env ?
          env: { __js_1: function() {} }
        });
      })
      .then(({ instance }) => {
        Object.assign(self.wasmModule, instance.exports);

        const { BombersplashWorld } = self.wasm_bindgen;
        self.world = BombersplashWorld.new();
      });
  }

  // eslint-disable-next-line no-restricted-globals
  self.onmessage = event => {
    const { messageId, fn, args } = event.data;

    if (fn === "init") {
      return init
        .apply(null, args)
        .then(data => self.postMessage({ messageId, data }));
    }

    if (fn in self.world) {
      const result = self.world[fn].apply(self.world, args);
      return self.postMessage({ messageId, data: result });
    }
  };

  /* eslint-enable no-restricted-globals */
}

export default class PhysicsWorker {
  constructor() {
    this.messageId = 0;
    this.emitter = new EventEmitter();
    this.currentTask = Promise.resolve();

    this.worker = new WebWorker(physicsWorker);
    this.worker.onmessage = ({ data: { messageId, data } }) => {
      this.emitter.emit("message:" + messageId, data);
    };
  }

  init() {
    return this.exec("init", {
      origin: window.location.origin,
      wasmUrl: require("./physics_bg.wasm"),
      jsUrl: require("./physics.no-modules.js.txt")
    });
  }

  _createTask(fn) {
    const newTask = this.currentTask.then(fn);
    this.currentTask = newTask;
    this.busy = true;

    newTask.then(() => {
      if (this.currentTask === newTask) this.busy = false;
    });

    return this.currentTask;
  }

  _exec(fn, ...args) {
    return new Promise((resolve, reject) => {
      const messageId = this.messageId++;
      this.emitter.once("message:" + messageId, data => resolve(data));
      this.worker.postMessage({ messageId, fn, args });
    });
  }

  exec(fn, ...args) {
    return this._createTask(() => this._exec(fn, ...args));
  }

  async batch(cb) {
    return this._createTask(() => cb(this._exec.bind(this)));
  }
}
