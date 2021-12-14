/* post code */
const START_CODE = new Uint8Array([0, 0, 0, 1]);

function defaultError(error) {
  console.error(error);
}

Module.createFile = createFile;
export function createFile(initialCapacity = 256) {
  let cursor = 0;
  let usedBytes = 0;
  let contents = new Uint8Array(initialCapacity);
  return {
    contents: function () {
      return contents.slice(0, usedBytes);
    },
    seek: function (offset) {
      // offset in bytes
      cursor = offset;
    },
    write: function (data) {
      const size = data.byteLength;
      expand(cursor + size);
      contents.set(data, cursor);
      cursor += size;
      usedBytes = Math.max(usedBytes, cursor);
      return size;
    },
  };

  function expand(newCapacity) {
    var prevCapacity = contents.length;
    if (prevCapacity >= newCapacity) return; // No need to expand, the storage was already large enough.
    // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
    // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
    // avoid overshooting the allocation cap by a very large margin.
    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
    newCapacity = Math.max(
      newCapacity,
      (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>>
        0
    );
    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256); // At minimum allocate 256b for each file when expanding.
    const oldContents = contents;
    contents = new Uint8Array(newCapacity); // Allocate new storage.
    if (usedBytes > 0) contents.set(oldContents.subarray(0, usedBytes), 0);
  }
}

Module.isWebCodecsSupported = isWebCodecsSupported;
export function isWebCodecsSupported() {
  return (
    typeof window !== "undefined" && typeof window.VideoEncoder === "function"
  );
}

export function createWebCodecsEncoderWithModule(MP4, opts = {}) {
  const {
    width,
    height,
    groupOfPictures = 20,
    fps = 30,
    fragmentation = false,
    sequential = false,
    hevc = false,
    format = "annexb",
    // codec = "avc1.420034", // Baseline 4.2
    codec = "avc1.4d0034", // Main 5.2
    acceleration,
    bitrate,
    error = defaultError,
    encoderOptions = {},
    flushFrequency = 10,
  } = opts;

  if (!isWebCodecsSupported()) {
    throw new Error(
      "MP4 H264 encoding/decoding depends on WebCodecs API which is not supported in this environment"
    );
  }

  if (typeof width !== "number" || typeof height !== "number") {
    throw new Error("Must specify { width, height } options");
  }

  if (!isFinite(width) || width < 0 || !isFinite(height) || height < 0) {
    throw new Error("{ width, height } options must be positive integers");
  }

  const file = createFile();
  const mux = MP4.create_muxer(
    {
      width,
      height,
      fps,
      fragmentation,
      sequential,
      hevc,
    },
    mux_write
  );

  const config = {
    codec,
    width: width,
    height: height,
    avc: {
      format,
    },
    hardwareAcceleration: acceleration,
    bitrate,
    ...encoderOptions,
  };

  let frameIndex = 0;

  const encoder = new window.VideoEncoder({
    output(chunk, opts) {
      writeAVC(chunk, opts);
    },
    error,
  });
  encoder.configure(config);

  return {
    async end() {
      await encoder.flush();
      encoder.close();
      MP4.finalize_muxer(mux);
      return file.contents();
    },
    async addFrame(bitmap) {
      const timestamp = (1 / fps) * frameIndex * 1000000;
      const keyFrame = frameIndex % groupOfPictures === 0;
      let frame = new VideoFrame(bitmap, { timestamp });
      encoder.encode(frame, { keyFrame });
      frame.close();
      if (flushFrequency != null && (frameIndex + 1) % flushFrequency === 0) {
        await encoder.flush();
      }
      frameIndex++;
    },
    async flush() {
      return encoder.flush();
    },
  };

  function mux_write(data_ptr, size, offset) {
    // seek to byte offset in file
    file.seek(offset);
    // get subarray of memory we are writing
    const data = MP4.HEAPU8.subarray(data_ptr, data_ptr + size);
    // write into virtual file
    return file.write(data) !== data.byteLength;
  }

  function write_nal(uint8) {
    const p = MP4._malloc(uint8.byteLength);
    MP4.HEAPU8.set(uint8, p);
    MP4.mux_nal(mux, p, uint8.byteLength);
    MP4._free(p);
  }

  function writeAVC(chunk, opts) {
    let avccConfig = null;

    let description;
    if (opts) {
      if (opts.description) {
        description = opts.description;
      }
      if (opts.decoderConfig && opts.decoderConfig.description) {
        description = opts.decoderConfig.description;
      }
    }

    if (description) {
      try {
        avccConfig = parseAVCC(description);
      } catch (err) {
        error(err);
        return;
      }
    }

    const nal = [];
    if (avccConfig) {
      avccConfig.sps_list.forEach((sps) => {
        nal.push(START_CODE);
        nal.push(sps);
      });
      avccConfig.pps_list.forEach((pps) => {
        nal.push(START_CODE);
        nal.push(pps);
      });
    }

    if (format === "annexb") {
      const uint8 = new Uint8Array(chunk.byteLength);
      chunk.copyTo(uint8);
      nal.push(uint8);
    } else {
      try {
        const arrayBuf = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(arrayBuf);
        convertAVCToAnnexBInPlaceForLength4(arrayBuf).forEach((sub) => {
          nal.push(START_CODE);
          nal.push(sub);
        });
      } catch (err) {
        error(err);
        return;
      }
    }

    write_nal(concatBuffers(nal));
  }
}

function concatBuffers(arrays) {
  // Calculate byteSize from all arrays
  const size = arrays.reduce((a, b) => a + b.byteLength, 0);
  // Allcolate a new buffer
  const result = new Uint8Array(size);
  let offset = 0;
  for (let i = 0; i < arrays.length; i++) {
    const arr = arrays[i];
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
}

function convertAVCToAnnexBInPlaceForLength4(arrayBuf) {
  const kLengthSize = 4;
  let pos = 0;
  const chunks = [];
  const size = arrayBuf.byteLength;
  const uint8 = new Uint8Array(arrayBuf);
  while (pos + kLengthSize < size) {
    // read uint 32, 4 byte NAL length
    let nal_length = uint8[pos];
    nal_length = (nal_length << 8) + uint8[pos + 1];
    nal_length = (nal_length << 8) + uint8[pos + 2];
    nal_length = (nal_length << 8) + uint8[pos + 3];

    chunks.push(new Uint8Array(arrayBuf, pos + kLengthSize, nal_length));
    if (nal_length == 0) throw new Error("Error: invalid nal_length 0");
    pos += kLengthSize + nal_length;
  }
  return chunks;
}

function parseAVCC(avcc) {
  const view = new DataView(avcc);
  let off = 0;
  const version = view.getUint8(off++);
  const profile = view.getUint8(off++);
  const compat = view.getUint8(off++);
  const level = view.getUint8(off++);
  const length_size = (view.getUint8(off++) & 0x3) + 1;
  if (length_size !== 4)
    throw new Error("Expected length_size to indicate 4 bytes");
  const numSPS = view.getUint8(off++) & 0x1f;
  const sps_list = [];
  for (let i = 0; i < numSPS; i++) {
    const sps_len = view.getUint16(off, false);
    off += 2;
    const sps = new Uint8Array(view.buffer, off, sps_len);
    sps_list.push(sps);
    off += sps_len;
  }
  const numPPS = view.getUint8(off++);
  const pps_list = [];
  for (let i = 0; i < numPPS; i++) {
    const pps_len = view.getUint16(off, false);
    off += 2;
    const pps = new Uint8Array(view.buffer, off, pps_len);
    pps_list.push(pps);
    off += pps_len;
  }
  return {
    offset: off,
    version,
    profile,
    compat,
    level,
    length_size,
    pps_list,
    sps_list,
    numSPS,
  };
}
