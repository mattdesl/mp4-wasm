# replace this with your own emsdk path
EMSDK="/Users/matt/prj/emsdk"

# EMSDK_NODE_BIN="$EMSDK/node/12.18.1_64bit/bin"
EMSCRIPTEN="$EMSDK/upstream/emscripten"
PATH="$EMSDK:$EMSCRIPTEN:$EMSDK_NODE_BIN:${PATH}"
EM_CONFIG="$EMSDK/.emscripten"
EM_PORTS="$EMSDK/.emscripten_ports"
EM_CACHE="$EMSDK/.emscripten_cache"
EMSDK_NODE="$EMSDK_NODE_BIN/node"
EMCC_WASM_BACKEND=1
EMCC_SKIP_SANITY_CHECK=1

mkdir -p embuild
cd embuild

rm -rf *.js

cmake -DWEB=ON -DCMAKE_TOOLCHAIN_FILE=$EMSCRIPTEN/cmake/Modules/Platform/Emscripten.cmake ..
cmake --build .

cmake -DWEB=OFF -DCMAKE_TOOLCHAIN_FILE=$EMSCRIPTEN/cmake/Modules/Platform/Emscripten.cmake ..
cmake --build .

cp mp4.wasm ../build/mp4.wasm
cp mp4.node.wasm ../build/mp4.node.wasm


