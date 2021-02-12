import loadMP4Module, { isWebCodecsSupported } from "/build/mp4.js";

const width = 1920;
const height = 1080;

const canvas = document.querySelector("canvas");
canvas.width = width;
canvas.height = height;

const ctx = canvas.getContext("2d");

const drawFrame = (interpolant) => {
  ctx.fillStyle = "#0000FF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FF0000";
  ctx.fillRect(0, 0, canvas.width * interpolant, canvas.height * interpolant);
};

const show = (data, width, height) => {
  const url = URL.createObjectURL(new Blob([data], { type: "video/mp4" }));
  const video = document.createElement("video");
  video.setAttribute("muted", "muted");
  video.setAttribute("autoplay", "autoplay");
  video.setAttribute("controls", "controls");
  const min = Math.min(width, window.innerWidth, window.innerHeight);
  const aspect = width / height;
  const size = min * 0.75;
  video.style.width = `${size}px`;
  video.style.height = `${size / aspect}px`;

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
};

const download = (buf, filename) => {
  const url = URL.createObjectURL(new Blob([buf], { type: "video/mp4" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "download";
  anchor.click();
};

async function start() {
  const fps = 60;
  const duration = 4;
  let frame = 0;
  let totalFrames = Math.round(fps * duration);

  console.time("encode");

  const MP4 = await loadMP4Module();
  const encoder = MP4.createWebCodecsEncoder({ width, height, fps });

  // Start encoding loop
  requestAnimationFrame(loop);

  async function loop() {
    if (frame < totalFrames) {
      console.log("Encoding frame %d of %d", frame + 1, totalFrames);

      // Render the canvas first
      drawFrame(frame / (totalFrames - 1));

      // Create a bitmap out of the frame
      const bitmap = await createImageBitmap(canvas);

      // Add bitmap to encoder
      await encoder.addFrame(bitmap);

      // Trigger next frame loop
      frame++;
      requestAnimationFrame(loop);
    } else {
      // Get an Uint8Array buffer
      const buf = await encoder.end();
      console.timeEnd("encode");
      show(buf, width, height);
      return;
    }
  }
}

if (isWebCodecsSupported()) {
  start();
} else {
  const unsupported = document.querySelector(".unsupported");
  if (unsupported) unsupported.style.display = "";
}
