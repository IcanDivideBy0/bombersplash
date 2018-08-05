# Setup

Install [rustup](https://rustup.rs/) and [Tiled](https://www.mapeditor.org/), then:

```sh
rustup update
rustup install nightly
rustup target add wasm32-unknown-unknown --toolchain nightly
rustup component add rustfmt-preview

cargo +nightly install wasm-bindgen-cli

yarn physics:build
```

# Useful commands

```sh
yarn physics:watch # watch for rust sources to re-compile physics engine into WebAssembly
yarn maps:watch # watch for maps changes
```
