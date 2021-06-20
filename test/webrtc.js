import loadMP4Module, { isWebCodecsSupported } from "/build/mp4.js";
import "https://unpkg.com/simple-peer@9.9.3/simplepeer.min.js";
const START_CODE = new Uint8Array([0, 0, 0, 1]);

console.log(SimplePeer);

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

  const offerOptions = {
    offerToReceiveAudio: 0,
    offerToReceiveVideo: 1,
  };
  const stream = recordCanvas.captureStream(0);
  const [track] = stream.getTracks();
  const log = console.log.bind(console);
  let interval = 100;
  let pc1, pc2;
  const chunks = [];

  call();

  function getName(pc) {
    return pc === pc1 ? "pc1" : "pc2";
  }

  function getOtherPc(pc) {
    return pc === pc1 ? pc2 : pc1;
  }

  async function call() {
    pc1 = new RTCPeerConnection();
    // const transceiver = pc1.addTransceiver("video");

    console.log("Created local peer connection object pc1");
    pc1.addEventListener("icecandidate", (e) => onIceCandidate(pc1, e));
    pc2 = new RTCPeerConnection({
      encodedInsertableStreams: true,
    });
    console.log("Created remote peer connection object pc2");
    pc2.addEventListener("icecandidate", (e) => onIceCandidate(pc2, e));
    pc1.addEventListener("iceconnectionstatechange", (e) =>
      onIceStateChange(pc1, e)
    );
    pc2.addEventListener("iceconnectionstatechange", (e) =>
      onIceStateChange(pc2, e)
    );
    pc2.addEventListener("track", gotRemoteTrack);

    // const transceiver = pc1.addTransceiver("video");
    // const sender = transceiver.sender;
    // sender.replaceTrack(track);

    pc1.addTrack(track, stream);
    // const transceiver = pc1.addTransceiver("video");
    // console.log(transceiver.sender.getCapabilities("video").codecs);
    // transceiver.setCodecPreferences([
    //   ...RTCRtpSender.getCapabilities("video").codecs,
    // {
    //   clockRate: 90000,
    //   mimeType: "video/H264",
    //   sdpFmtpLine:
    //     "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032",
    // },
    // ]);
    // stream.getTracks().forEach((track) => pc1.addTrack(track, stream));
    console.log("Added local stream to pc1");

    try {
      console.log("pc1 createOffer start");
      const offer = await pc1.createOffer(offerOptions);
      await onCreateOfferSuccess(offer);
    } catch (e) {
      onCreateSessionDescriptionError(e);
    }
  }

  function onCreateSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}`);
  }

  async function onCreateOfferSuccess(desc) {
    console.log(`Offer from pc1\n${desc.sdp}`);
    console.log("pc1 setLocalDescription start");
    try {
      await pc1.setLocalDescription(desc);
      onSetLocalSuccess(pc1);
    } catch (e) {
      onSetSessionDescriptionError();
    }

    console.log("pc2 setRemoteDescription start");
    try {
      await pc2.setRemoteDescription({
        type: "offer",
        sdp: desc.sdp.replace("red/90000", "green/90000"),
      });
      onSetRemoteSuccess(pc2);
    } catch (e) {
      onSetSessionDescriptionError();
    }

    console.log("pc2 createAnswer start");
    try {
      const answer = await pc2.createAnswer(offerOptions);
      answer.sdp = answer.sdp.replace(
        "useinbandfec=1",
        "useinbandfec=1; stereo=1; maxaveragebitrate=510000"
      );
      await onCreateAnswerSuccess(answer);
    } catch (e) {
      onCreateSessionDescriptionError(e);
    }

    console.log("ready for things!!");
    startEncoding();
  }

  function onSetLocalSuccess(pc) {
    console.log(`${getName(pc)} setLocalDescription complete`);
  }

  function onSetRemoteSuccess(pc) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
  }

  function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
  }

  function gotRemoteTrack(e) {
    console.log("pc2 received remote stream");

    const frameStreams = e.receiver.createEncodedStreams();
    const reader = frameStreams.readable || frameStreams.readableStream;
    const writer = frameStreams.writable || frameStreams.writableStream;
    reader
      .pipeThrough(
        new TransformStream({
          transform: videoAnalyzer,
        })
      )
      .pipeTo(writer);

    // new WritableStream({
    //   write(value, controller) {
    //     console.log("writing", value);
    //     writer.write(value);
    //   },
    // })

    const video = document.querySelector("video");
    video.muted = true;
    video.autoplay = false;
    video.srcObject = e.streams[0];
    video.play();
  }

  function videoAnalyzer(encodedFrame, controller) {
    // console.log(frame);
    // console.log(encodedFrame);
    chunks.push(new Uint8Array([0, 0, 0, 1]).buffer);
    chunks.push(encodedFrame.data);
    controller.enqueue(encodedFrame);
  }

  async function onCreateAnswerSuccess(desc) {
    console.log(`Answer from pc2:\n${desc.sdp}`);
    console.log("pc2 setLocalDescription start");
    try {
      await pc2.setLocalDescription(desc);
      onSetLocalSuccess(pc2);
    } catch (e) {
      onSetSessionDescriptionError(e);
    }
    console.log("pc1 setRemoteDescription start");
    try {
      await pc1.setRemoteDescription(desc);
      onSetRemoteSuccess(pc1);
    } catch (e) {
      onSetSessionDescriptionError(e);
    }
  }

  async function onIceCandidate(pc, event) {
    try {
      await getOtherPc(pc).addIceCandidate(event.candidate);
      onAddIceCandidateSuccess(pc);
    } catch (e) {
      onAddIceCandidateError(pc, e);
    }
    console.log(
      `${getName(pc)} ICE candidate:\n${
        event.candidate ? event.candidate.candidate : "(null)"
      }`
    );
  }

  function onAddIceCandidateSuccess(pc) {
    console.log(`${getName(pc)} addIceCandidate success`);
  }

  function onAddIceCandidateError(pc, error) {
    console.log(
      `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`
    );
  }

  function onIceStateChange(pc, event) {
    if (pc) {
      console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
      console.log("ICE state change event: ", event);
    }
  }

  async function once(p, name) {
    return new Promise((resolve) => p.once(name, resolve));
  }

  function startEncoding() {
    setTimeout(loop, 0);
    console.time("encode");
  }

  function requestFrame() {
    return new Promise((resolve) => {
      const track = stream.getTracks()[0];
      if (typeof track.requestFrame === "function") {
        track.requestFrame();
      } else if (typeof stream.requestFrame === "function") {
        stream.requestFrame();
      }
    });
  }

  async function finish() {
    console.timeEnd("encode");
    download(new Blob(chunks, { type: "video/h264" }));
  }

  async function draw() {
    let curFrame = frame;
    const t = curFrame / (totalFrames - 1);
    drawRealFrame(ctx, curFrame, t);

    recordCtx.clearRect(0, 0, canvas.width, canvas.height);
    recordCtx.drawImage(canvas, 0, 0);
    requestFrame();

    frame++;
    setTimeout(loop, interval);
  }

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
