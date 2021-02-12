#define MINIMP4_IMPLEMENTATION
#include "minimp4.h"
#define ENABLE_AUDIO 0
#define VIDEO_FPS 24

static uint8_t *preload(const char *path, int32_t *data_size)
{
    FILE *file = fopen(path, "rb");
    uint8_t *data;
    *data_size = 0;
    if (!file)
        return 0;
    if (fseek(file, 0, SEEK_END))
        exit(1);
    *data_size = (int32_t)ftell(file);
    if (*data_size < 0)
        exit(1);
    if (fseek(file, 0, SEEK_SET))
        exit(1);
    data = (unsigned char*)malloc(*data_size);
    if (!data)
        exit(1);
    if ((int32_t)fread(data, 1, *data_size, file) != *data_size)
        exit(1);
    fclose(file);
    return data;
}

static int32_t get_nal_size(uint8_t *buf, int32_t size)
{
    int32_t pos = 3;
    while ((size - pos) > 3)
    {
        if (buf[pos] == 0 && buf[pos + 1] == 0 && buf[pos + 2] == 1)
            return pos;
        if (buf[pos] == 0 && buf[pos + 1] == 0 && buf[pos + 2] == 0 && buf[pos + 3] == 1)
            return pos;
        pos++;
    }
    return size;
}

static int write_callback(int64_t offset, const void *buffer, size_t size, void *token)
{
    FILE *f = (FILE*)token;
    fseek(f, offset, SEEK_SET);
    size_t r = fwrite(buffer, 1, size, f);
    printf("write %d %d %d\n", (int)offset, (int)size, (int)r);
    return r != size;
}

typedef struct
{
    uint8_t *buffer;
    int32_t size;
} INPUT_BUFFER;

int main(int argc, char **argv)
{
    // check switches
    int sequential_mode = 1;
    int fragmentation_mode = 0;
    int i;
    for(i = 1; i < argc; i++)
    {
        if (argv[i][0] != '-')
            break;
        switch (argv[i][1])
        {
        case 's': sequential_mode = 1; break;
        case 'f': fragmentation_mode = 1; break;
        default:
            printf("error: unrecognized option\n");
            return 1;
        }
    }
    if (argc <= (i + 1))
    {
        printf("Usage: minimp4 [command] [options] input output\n"
               "Commands:\n"
               "    -m    - do muxing (default); input is h264 elementary stream, output is mp4 file\n"
               "    -d    - do de-muxing; input is mp4 file, output is h264 elementary stream\n"
               "Options:\n"
               "    -s    - enable mux sequential mode (no seek required for writing)\n"
               "    -f    - enable mux fragmentation mode (aka fMP4)\n"
               "    -t    - de-mux tack number\n");
        return 0;
    }
    int32_t h264_size;
    uint8_t *alloc_buf;
    uint8_t *buf_h264 = alloc_buf = preload(argv[i], &h264_size);
    if (!buf_h264)
    {
        printf("error: can't open h264 file\n");
        exit(1);
    }

    // printf("arg %s", argv[i + 1]);
    FILE *fout = fopen(argv[i + 1], "wb");
    if (!fout)
    {
        printf("error: can't open output file\n");
        exit(1);
    }

    int is_hevc = 0;
    // int is_hevc = (0 != strstr(argv[1], "265")) || (0 != strstr(argv[i], "hevc"));
    // printf("is_hevc %d", is_hevc);
    
    MP4E_mux_t *mux;
    mp4_h26x_writer_t mp4wr;
    mux = MP4E_open(sequential_mode, fragmentation_mode, fout, write_callback);
    if (MP4E_STATUS_OK != mp4_h26x_write_init(&mp4wr, mux, 352, 288, is_hevc))
    {
        printf("error: mp4_h26x_write_init failed\n");
        exit(1);
    }

    while (h264_size > 0)
    {
        int32_t nal_size = get_nal_size(buf_h264, h264_size);
        if (nal_size < 4)
        {
            buf_h264  += 1;
            h264_size -= 1;
            continue;
        }
        if (MP4E_STATUS_OK != mp4_h26x_write_nal(&mp4wr, buf_h264, nal_size, 90000/VIDEO_FPS))
        {
            printf("error: mp4_h26x_write_nal failed\n");
            exit(1);
        }
        buf_h264  += nal_size;
        h264_size -= nal_size;
    }
    if (alloc_buf)
        free(alloc_buf);
    MP4E_close(mux);
    mp4_h26x_write_close(&mp4wr);
    if (fout)
        fclose(fout);
}
