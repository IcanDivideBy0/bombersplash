#!/usr/bin/env bash
# saner programming env: these switches turn some bugs into errors
set -o errexit -o pipefail -o noclobber -o nounset

pushd $(dirname $0)/../server/public/maps > /dev/null

MAP_PATH="$1"
MAP_NAME=$(dirname $MAP_PATH | xargs basename)

time=$(date +%k:%M:%S)

tiled ./$MAP_NAME/map.tmx --export-map ./$MAP_NAME/map.json
echo -e "\e[90m[$time]\e[0m 🗺️  \e[1mpublic/maps/$MAP_NAME/map.json\e[0m updated"

popd > /dev/null
