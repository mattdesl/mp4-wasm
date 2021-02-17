import loadMP4Module, { isWebCodecsSupported } from "/build/mp4.js";

const width = 1920;
const height = 1080;

const canvas = document.querySelector("canvas");
canvas.width = width;
canvas.height = height;

const recordCanvas = document.createElement("canvas");
recordCanvas.width = canvas.width;
recordCanvas.height = canvas.height;
const recordCtx = recordCanvas.getContext("2d");

const ctx = canvas.getContext("2d");
const drawInBetweenFrame = (ctx, frame, interpolant) => {
  ctx.fillStyle = "pink";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "green";
  ctx.fillRect(0, 0, canvas.width * interpolant, canvas.height * interpolant);
  ctx.font = "100px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(String(frame), 250, 250);
};

const drawRealFrame = (ctx, frame, interpolant) => {
  ctx.fillStyle = "#0000FF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FF0000";
  ctx.fillRect(0, 0, canvas.width * interpolant, canvas.height * interpolant);
  ctx.font = "100px Arial";
  ctx.fillStyle = "white";
  ctx.fillText(String(frame), 250, 250);
};

const show = (data, width, height) => {
  let blob = data instanceof Blob ? data : new Blob([data]);
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.setAttribute("muted", "muted");
  video.setAttribute("autoplay", "autoplay");
  video.setAttribute("controls", "controls");
  const min = Math.min(width, window.innerWidth, window.innerHeight);
  const aspect = width / height;
  const size = 200;
  video.style.width = `${size}px`;
  video.style.height = `${size / aspect}px`;

  video.oncanplay = () => {
    console.log(video.duration);
  };

  const container = document.body;
  container.appendChild(video);
  video.src = url;

  const text = document.createElement("div");
  const anchor = document.createElement("a");
  text.appendChild(anchor);
  anchor.href = url;
  anchor.id = "download";
  anchor.textContent = "Click here to download MP4 file...";
  anchor.download = "download.mp4";
  container.appendChild(text);

  blob.arrayBuffer().then((buf) => {
    console.log("bytes", buf.byteLength);
  });
};

const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
};

async function start() {
  const fps = 60;
  const duration = 1;
  let frame = 0;
  let totalFrames = Math.round(fps * duration);

  const stream = recordCanvas.captureStream(0);
  const recorder = new MediaRecorder(stream, {
    // mimeType: "video/webm",
    // mimeType: "video/webm;codecs=h264",
  });

  const track = stream.getVideoTracks()[0];
  const chunks = [];
  recorder.ondataavailable = async ({ data }) => {
    // const buf = await data.arrayBuffer();
    // const uint8 = new Uint8Array(buf);
    // console.log("got data", uint8);
    chunks.push(data);
    console.log(data);
  };
  recorder.onstop = () => {
    console.log("STOPPED!");
    show(new Blob(chunks, { type: "video/webm" }), "test.webm");
  };

  drawRealFrame(recordCtx, 0, 0);
  recorder.start(0);
  waitForEvent(recorder, "start").then(() => {
    recorder.pause();
  });
  recorder.pause();

  let interval = 50;
  setTimeout(loop, 0);
  console.time("encode");

  function requestFrame() {
    // if (typeof track.requestFrame === "function") {
    //   track.requestFrame();
    // } else if (typeof stream.requestFrame === "function") {
    //   stream.requestFrame();
    // }
    return new Promise((resolve) => {
      window.queueMicrotask(() => {
        if (typeof track.requestFrame === "function") {
          track.requestFrame();
        } else if (typeof stream.requestFrame === "function") {
          stream.requestFrame();
        }
        resolve();
      });
    });
  }

  async function finish() {
    // Get an Uint8Array buffer
    // const buf = await encoder.end();
    setTimeout(() => {});
    // recorder.requestData();
    recorder.stop();
    console.timeEnd("encode");
    // setTimeout(() => {
    //   console.log("done");
    //   // show(new Blob(chunks, { type: "video/webm" }));
    // }, 100);
    // show(new Blob(chunks, { type: "video/webm" }));
    // show(buf, width, height);
  }

  async function pause() {
    if (recorder.state === "paused") return Promise.resolve();
    recorder.pause();
    return waitForEvent(recorder, "pause");
  }

  async function resume() {
    if (recorder.state !== "paused") return Promise.resolve();
    recorder.resume();
    return waitForEvent(recorder, "resume");
  }

  function waitForEvent(p, event) {
    return new Promise((resolve) => {
      function result() {
        p.removeEventListener(event, result);
        resolve();
      }
      p.addEventListener(event, result, false);
    });
  }

  async function draw() {
    // console.log("Encoding frame %d of %d", frame + 1, totalFrames);

    // recorder.ondataavailable = async ({ data }) => {
    //   recorder.pause();
    //   console.log("got blob", data);
    //   const buf = await data.arrayBuffer();
    //   const uint8 = new Uint8Array(buf);
    //   console.log(uint8);
    //   frame++;
    //   setTimeout(loop, interval);
    // };

    // const timer = new Promise((resolve) => setTimeout(1000 / fps));

    // await resume();

    // Render the canvas first

    // window.queueMicrotask(() => {
    //   drawFrame(frame / (totalFrames - 1));
    // });
    // requestFrame();
    // track.enabled = true;
    // recorder.resume();

    // const timer = new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    let curFrame = frame;
    const t = curFrame / (totalFrames - 1);
    drawRealFrame(ctx, curFrame, t);

    recordCtx.clearRect(0, 0, canvas.width, canvas.height);
    recordCtx.drawImage(canvas, 0, 0);

    drawInBetweenFrame(ctx, curFrame, t);

    resume();
    requestFrame();
    const timer = new Promise((resolve) => setTimeout(resolve, 1000 / fps));
    await timer;
    pause();
    recorder.requestData();
    frame++;
    // requestAnimationFrame(loop);
    setTimeout(loop, interval);

    // track.enabled = true;
    // window.queueMicrotask(() => {
    // recorder.requestData();
    // });

    // recorder.requestData();
    // recorder.onresume = () => {
    //   setTimeout(() => {
    //     recorder.requestData();
    //     recorder.pause();
    //   }, 1000 / fps);
    // };
    // recorder.resume();

    // recorder.resume();
    // // Create a bitmap out of the frame
    // const bitmap = await createImageBitmap(canvas);

    // // Add bitmap to encoder
    // await encoder.addFrame(bitmap);

    // Trigger next frame loop
    // requestAnimationFrame(loop);
  }

  // Start encoding loop
  // requestAnimationFrame(loop);

  async function loop() {
    if (frame < totalFrames) {
      draw();
    } else {
      finish();
    }
  }
}

// if (isWebCodecsSupported()) {
start();
// } else {
//   const unsupported = document.querySelector(".unsupported");
//   if (unsupported) unsupported.style.display = "";
// }
