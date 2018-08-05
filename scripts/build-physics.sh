#!/usr/bin/env bash
# saner programming env: these switches turn some bugs into errors
set -o errexit -o pipefail -o noclobber -o nounset

! getopt --test > /dev/null
if [[ ${PIPESTATUS[0]} -ne 4 ]]; then
  echo "I’m sorry, `getopt --test` failed in this environment."
  exit 1
fi

OPTIONS=drcs
LONGOPTS=debug,release,client,server

# -use ! and PIPESTATUS to get exit code with errexit set
# -temporarily store output to be able to check for errors
# -activate quoting/enhanced mode (e.g. by writing out “--options”)
# -pass arguments only via   -- "$@"   to separate them correctly
! PARSED=$(getopt --options=$OPTIONS --longoptions=$LONGOPTS --name "$0" -- "$@")
if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
  # e.g. return value is 1
  #  then getopt has complained about wrong arguments to stdout
  exit 2
fi
# read getopt’s output this way to handle the quoting right:
eval set -- "$PARSED"

BUILD_FLAG=
BUILD_FOLDER=debug

BUILD_ALL=1
BUILD_CLIENT=
BUILD_SERVER=

# now enjoy the options in order and nicely split until we see --
while true; do
  case "$1" in
    -d|--debug)
      BUILD_FLAG=
      BUILD_FOLDER=debug
      shift
      ;;
    -r|--release)
      BUILD_FLAG=--release
      BUILD_FOLDER=release
      shift
      ;;
    -c|--client)
      BUILD_ALL=
      BUILD_CLIENT=1
      shift
      ;;
    -s|--server)
      BUILD_ALL=
      BUILD_SERVER=1
      shift
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Programming error"
      exit 3
      ;;
  esac
done

pushd $(dirname $0)/../physics >/dev/null

cargo fmt
cargo +nightly build --target wasm32-unknown-unknown $BUILD_FLAG

if [[ -n "$BUILD_ALL" || -n "$BUILD_CLIENT" ]]; then
  echo -ne " 📦 Generating \e[94;1mclient\e[0m wasm-bindgen package... "

  wasm-bindgen \
    ./target/wasm32-unknown-unknown/$BUILD_FOLDER/physics.wasm \
    --browser \
    --no-modules \
    --no-typescript \
    --out-dir ../client/src/modules/physics/

  mv ../client/src/modules/physics/physics.js ../client/src/modules/physics/physics.no-modules.js.txt

  wasm-bindgen \
    ./target/wasm32-unknown-unknown/$BUILD_FOLDER/physics.wasm \
    --browser \
    --no-typescript \
    --out-dir ../client/src/modules/physics/

  echo -e "\e[92;1mdone\e[0m"
fi

if [[ -n "$BUILD_ALL" || -n "$BUILD_SERVER" ]]; then
  echo -ne " 📦 Generating \e[94;1mserver\e[0m wasm-bindgen package... "

  wasm-bindgen \
    ./target/wasm32-unknown-unknown/$BUILD_FOLDER/physics.wasm \
    --nodejs \
    --no-typescript \
    --out-dir ../server/src/physics/

  echo -e "\e[92;1mdone\e[0m"
fi

popd >/dev/null
