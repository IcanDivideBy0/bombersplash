/**
 *  Hack around create-react-app to simulate a proper wasm loader.
 */

module.exports = {
  __wasm_loader: () =>
    fetch(require("./physics_bg.wasm"))
      .then(response =>
        global.WebAssembly.instantiateStreaming(response, {
          "./physics": require("./physics"),
          // WTF ? env ?
          env: { __js_1: function() {} }
        })
      )
      .then(({ instance }) => Object.assign(module.exports, instance.exports))
      .then(() => require("./physics"))
};
