const loadMP4Module = require("../");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const readFile = promisify(fs.readFile);

(async () => {
  const MP4 = await loadMP4Module();
  const stream = fs.createWriteStream(
    path.resolve(__dirname, "outputs/foreman.mp4")
  );
  const width = 352;
  const height = 288;

  const mux = MP4.create_muxer(
    {
      width,
      height,
      // Needed to write sequentially to a file
      // i.e. no 'offset' parameter needed
      sequential: true,
    },
    write
  );

  const file = path.resolve(__dirname, "fixtures/foreman.264");
  const buffer = await readFile(file);

  for (let chunk of readNAL(buffer)) {
    // malloc() / free() a pointer
    const p = MP4.create_buffer(chunk.byteLength);
    // set data in memory
    MP4.HEAPU8.set(chunk, p);
    // write NAL units with AnnexB format
    // <Uint8Array [startcode] | [NAL] | [startcode] | [NAL] ...>
    MP4.mux_nal(mux, p, chunk.byteLength);
    MP4.free_buffer(p);
  }

  // Note: this may trigger more writes
  MP4.finalize_muxer(mux);

  function write(pointer, size, offset) {
    const buf = MP4.HEAPU8.slice(pointer, pointer + size);

    // Write the MP4-muxed chunk directly into a .mp4 stream
    stream.write(buf);

    return 0;
  }
})();

// For an arbitrary stream of data, yield/iterate
// on each AnnexB NAL chunk (including the startcode)
function* readNAL(buffer, offset = 0) {
  let h264Size = buffer.byteLength;
  while (h264Size > 0) {
    const nal_size = getNALSize(buffer, offset, h264Size);
    if (nal_size < 4) {
      offset += 1;
      h264Size -= 1;
      continue;
    }
    yield buffer.subarray(offset, offset + nal_size);
    offset += nal_size;
    h264Size -= nal_size;
  }

  function getNALSize(buf, ptr, size) {
    let pos = 3;
    while (size - pos > 3) {
      if (
        buf[ptr + pos] == 0 &&
        buf[ptr + pos + 1] == 0 &&
        buf[ptr + pos + 2] == 1
      )
        return pos;
      if (
        buf[ptr + pos] == 0 &&
        buf[ptr + pos + 1] == 0 &&
        buf[ptr + pos + 2] == 0 &&
        buf[ptr + pos + 3] == 1
      )
        return pos;
      pos++;
    }
    return size;
  }
}
