# Setup

Install [rustup](https://rustup.rs/), then:

```sh
rustup update
rustup install nightly
rustup target add wasm32-unknown-unknown --toolchain nightly
rustup component add rustfmt-preview

cargo +nightly install wasm-bindgen-cli

yarn physics:build
cd tiled-utils && yarn && cd -
```

[Tiled](https://www.mapeditor.org/) map editor is used to generate maps, so you
might want to install it if you plan to change maps

# Run server

```sh
cd server && yarn start
```

# Run client

```sh
cd client && yarn start
```

# Useful commands

```sh
yarn physics:watch # watch for rust sources to re-compile physics engine into WebAssembly
yarn maps:watch # watch for maps changes
```
