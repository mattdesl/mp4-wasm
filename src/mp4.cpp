#include <emscripten/bind.h>
#include <emscripten/val.h>

#define TIMESCALE 90000

#define MINIH264_IMPLEMENTATION
#define MINIMP4_IMPLEMENTATION

#include <string>
#include <stdint.h>
#include <functional>

#include "minimp4.h"

using namespace emscripten;

typedef struct MP4Muxer {
  MP4E_mux_t *mux = nullptr;
  mp4_h26x_writer_t writer;
  float fps;
  std::function<int(const void *buffer, size_t size, int64_t offset)> callback;
} MP4Muxer;

static std::map<uint32_t, MP4Muxer*> mapMuxer;
static uint32_t mapMuxerHandle = 1;

static void _write_nal (MP4Muxer *muxer, const uint8_t *data, size_t size)
{
  mp4_h26x_write_nal(&muxer->writer, data, size, TIMESCALE/(muxer->fps));
}

static int write_callback (int64_t offset, const void *buffer, size_t size, void *token)
{
  MP4Muxer *muxer = (MP4Muxer *)token;
  uint8_t *data = (uint8_t*)(buffer);
  return muxer->callback(
    data,
    (uint32_t)size,
    (uint32_t)offset
  );
}

void mux_nal (uint32_t muxer_handle, uintptr_t nalu_ptr, int nalu_size)
{
  MP4Muxer* muxer = mapMuxer[muxer_handle];
  uint8_t* data = reinterpret_cast<uint8_t*>(nalu_ptr);
  _write_nal(muxer, data, nalu_size);
}

uint32_t create_muxer(val options, val write_fn)
{
  uint32_t width = options["width"].as<uint32_t>();
  uint32_t height = options["height"].as<uint32_t>();
  float fps = options["fps"].isNumber() ? options["fps"].as<float>() : 30.0f;
  int fragmentation = options["fragmentation"].isTrue() ? 1 : 0;
  int sequential = options["sequential"].isTrue() ? 1 : 0;
  int hevc = options["hevc"].isTrue() ? 1 : 0;

  #ifdef DEBUG
  printf("Mux Options ---\n");
  printf("width=%d\n", width);
  printf("height=%d\n", height);
  printf("fps=%f\n", fps);
  printf("sequential=%d\n", sequential);
  printf("fragmentation=%d\n", fragmentation);
  printf("hevc=%d\n", hevc);
  printf("\n");
  #endif
  
  MP4Muxer *muxer = (MP4Muxer *)malloc(sizeof(MP4Muxer));
  muxer->fps = fps;
  
  muxer->callback = [write_fn](const void *buffer, uint32_t size, uint32_t offset) -> int {
    uint8_t *data = (uint8_t*)(buffer);
    return write_fn(
      val((uintptr_t)data),
      val((uint32_t)size),
      val((uint32_t)offset)
    ).as<int>();
  };

  uint32_t handle = mapMuxerHandle++;
  mapMuxer[handle] = muxer;

  muxer->mux = MP4E_open(sequential, fragmentation, muxer, &write_callback);
  // TODO: handle MP4E_STATUS_OK status
  mp4_h26x_write_init(&muxer->writer, muxer->mux, width, height, hevc);

  return handle;
}

void finalize_muxer (uint32_t muxer_handle)
{
  MP4Muxer *muxer = mapMuxer[muxer_handle];
  MP4E_close(muxer->mux);
  mp4_h26x_write_close(&muxer->writer);
  free(muxer);
  mapMuxer.erase(muxer_handle);
  muxer = nullptr;
}

EMSCRIPTEN_BINDINGS(H264MP4EncoderBinding) {
  function("create_muxer", &create_muxer);
  function("mux_nal", &mux_nal);
  function("finalize_muxer", &finalize_muxer);
}
