# mp4-wasm

###### This module is still under development and may change. :sparkles:

Fast MP4 mux / demux using WASM, for modern browsers and Node.js.

What's supported:

- MP4 video muxing (taking already-encoded H264 frames and wrapping them in a MP4 container)
- MP4/H264 encoding and muxing via WebCodecs

What's still WIP:

- MP4 video demuxing
- MP4 audio muxing (single AAC track)
- WebCodecs video decoding and demuxing

[:sparkles: Live Demo](https://codepen.io/mattdesl/pen/LYWvmyp?editors=1010) (Chrome only behind "Experimental Web Platforms" flag)

This is built on top of the C/C++ library [minimp4](https://github.com/lieff/minimp4/), and the primary motivator behind this project is to create a hassle-free solution for creating MP4/H264 videos fully client-side in the browser, without running into H264 patent issues. 

---

Docs are WIP.

## License

MIT, see [LICENSE.md](http://github.com/mattdesl/mp4-wasm/blob/master/LICENSE.md) for details.
