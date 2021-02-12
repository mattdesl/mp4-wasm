Module['create_buffer'] = function create_buffer (size) {
  return Module['_malloc'](size);
};

Module['free_buffer'] = function create_buffer (pointer) {
  return Module['_free'](pointer);
};

Module['locateFile'] = function locateFileDefault (path, dir) {
  if (Module['simd']) {
    path = path.replace(/\.wasm$/i, '.simd.wasm');
  }
  if (Module['getWasmPath']) {
    return Module['getWasmPath'](path, dir, Module['simd']);
  } else {
    return dir + path;
  }
};

Module['createWebCodecsEncoder'] = function createWebCodecsEncoder (opts) {
  return createWebCodecsEncoderWithModule(Module, opts);
}