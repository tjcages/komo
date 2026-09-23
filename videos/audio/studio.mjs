import { loadBrowserSounds } from "./effects.mjs";
await loadBrowserSounds().catch((error) => {
  document.getElementById("status").textContent = error.message;
  throw error;
});
import {
  analyzeSamples,
  cutTimeline,
  suggestTempo,
  snapStart,
  validateMix,
} from "./timing.mjs";
import { renderSoundtrack, validateEffects, SAMPLE_RATE } from "./effects.mjs";
import { createEffectsEditor } from "./effects-ui.mjs";
const $ = (id) => document.getElementById(id);
const video = $("video");
let timeline,
  duration = 0,
  selectedCut = 0,
  playbackFrame,
  song,
  context,
  decodedSong,
  songFile,
  videoFile,
  previewBuffer,
  soundSource,
  soundClock = 0,
  soundOffset = 0,
  localExport = false,
  videoURL,
  generation = 0;
const getContext = () =>
  (context ||= new AudioContext({ sampleRate: SAMPLE_RATE }));
const effects = createEffectsEditor({
  video,
  getDuration: () => duration,
  getContext,
  changed: () => {
    stop();
    invalidatePreview();
  },
});
const time = (value) =>
  `${Math.floor(value / 60)}:${(value % 60).toFixed(2).padStart(5, "0")}`;
const status = (text) => {
  $("status").textContent = text;
};
const number = (id) => Number($(id).value);
const settings = () => ({
  version: 2,
  musicEnabled: !!song,
  ...effects.fields(),
  song: song?.name,
  start: number("start"),
  duration,
  volume: number("volume"),
  fadeIn: number("fadeIn"),
  fadeOut: number("fadeOut"),
  bpm: number("bpm"),
  firstBeat: number("firstBeat"),
});
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function invalidatePreview() {
  previewBuffer = null;
  $("exportDownload").hidden = true;
}
function stopSound() {
  if (soundSource) {
    soundSource.stop();
    soundSource.disconnect();
    soundSource = null;
  }
}
function stop() {
  video.pause();
  stopSound();
  $("play").textContent = "Play preview";
}
function prepareSound() {
  const mix = settings();
  validateMix(mix, duration, song?.duration);
  validateEffects(mix);
  const ctx = getContext();
  if (!previewBuffer) {
    const music = decodedSong
      ? Array.from(
          { length: Math.min(2, decodedSong.numberOfChannels) },
          (_, i) => decodedSong.getChannelData(i),
        )
      : [];
    const { channels } = renderSoundtrack(mix, music, ctx.sampleRate);
    previewBuffer = ctx.createBuffer(2, channels[0].length, ctx.sampleRate);
    channels.forEach((channel, i) => previewBuffer.copyToChannel(channel, i));
  }
}
function startSound() {
  stopSound();
  if (!previewBuffer || video.paused || video.currentTime >= duration) return;
  soundSource = context.createBufferSource();
  soundSource.buffer = previewBuffer;
  soundSource.connect(context.destination);
  soundOffset = video.currentTime;
  soundClock = context.currentTime;
  soundSource.start(0, soundOffset);
}
function sync() {
  if (
    soundSource &&
    !video.paused &&
    Math.abs(
      video.currentTime - (soundOffset + context.currentTime - soundClock),
    ) > 0.08
  )
    startSound();
}
function update() {
  cancelAnimationFrame(playbackFrame);
  $("clock").textContent =
    `${time(video.currentTime || 0)} / ${time(duration)}`;
  $("scrub").value = video.currentTime || 0;
  sync();
  if (!video.paused) playbackFrame = requestAnimationFrame(update);
}
async function play() {
  if (!duration) return;
  if (!video.paused) {
    stop();
    return;
  }
  if (video.currentTime >= duration - 0.03) video.currentTime = 0;
  try {
    prepareSound();
    await context.resume();
    await video.play();
    $("play").textContent = "Pause";
    update();
  } catch (e) {
    stop();
    status(e.message);
  }
}
function draw() {
  const canvas = $("wave"),
    ctx = canvas.getContext("2d");
  const w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const peaks =
    song?.peaks ||
    Array.from({ length: 800 }, (_, i) => 0.06 + 0.035 * Math.sin(i * 0.12));
  ctx.fillStyle = song ? "#a693b9" : "#51445e";
  peaks.forEach((p, i) =>
    ctx.fillRect(
      (i * w) / peaks.length,
      h / 2 - Math.max(2, p * h * 0.45),
      1.4,
      Math.max(4, p * h * 0.9),
    ),
  );
  if (!song) return;
  const start = number("start");
  const bpm = number("bpm"),
    first = number("firstBeat");
  if (
    bpm >= 30 &&
    bpm <= 300 &&
    Number.isFinite(first) &&
    first >= 0 &&
    first <= song.duration
  ) {
    ctx.strokeStyle = "#c6a3ed66";
    for (let beat = first; beat < song.duration; beat += 60 / bpm) {
      const x = (beat / song.duration) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }
  for (const cut of timeline?.cuts || []) {
    ctx.fillStyle = "#f7eeff";
    ctx.fillRect(((start + cut.at) / song.duration) * w, 0, 2, 24);
  }
  $("selection").style.left = `${(start / song.duration) * 100}%`;
  $("selection").style.width =
    `${(Math.min(duration, song.duration) / song.duration) * 100}%`;
  $("range").textContent =
    `${time(start)} → ${time(start + duration)} · ${duration.toFixed(2)}s`;
}
function setStart(value) {
  stop();
  const start = Math.max(
    0,
    Math.min(Number($("start").max), Number.isFinite(value) ? value : 0),
  );
  $("start").value = start;
  $("startNumber").value = start.toFixed(3);
  invalidatePreview();
  sync();
  draw();
}
function refresh() {
  const fits = !!song && song.duration + 0.025 >= duration && duration > 0;
  $("controls").disabled = !fits;
  $("save").disabled = !duration || (!!song && !fits);
  $("export").disabled = $("save").disabled;
  $("start").disabled = !fits;
  $("startNumber").disabled = !fits;
  $("start").max = $("startNumber").max = song
    ? Math.max(0, song.duration - duration)
    : 0;
  if (song && duration > 0 && !fits)
    status("This song is shorter than the film. Choose a longer track.");
  setStart(number("start"));
}
function showCuts() {
  $("cutList").replaceChildren();
  selectedCut = 0;
  for (const [i, cut] of (timeline?.cuts || []).entries()) {
    const b = document.createElement("button");
    b.textContent = `${cut.name} · ${cut.at.toFixed(2)}s`;
    b.setAttribute("aria-pressed", String(i === 0));
    b.onclick = () => {
      selectedCut = i;
      for (const [j, child] of [...$("cutList").children].entries())
        child.setAttribute("aria-pressed", String(j === i));
      stop();
      video.currentTime = cut.at;
      update();
    };
    $("cutList").append(b);
  }
  const tempo = timeline && suggestTempo(timeline.cuts);
  $("tempo").textContent = tempo
    ? `Suggested cut rhythm ${tempo.bpm} BPM · estimate`
    : "No cut map for this video";
}
video.onloadedmetadata = () => {
  duration = video.duration;
  $("scrub").max = duration;
  $("play").disabled = false;
  if (timeline && Math.abs(duration - timeline.duration) > 0.08) {
    timeline = null;
    effects.setEdit(null);
    showCuts();
    status(
      "Video length differs from the edit. Cut snapping is disabled; song timing still works.",
    );
  }
  $("filmInfo").textContent =
    `${duration.toFixed(2)} seconds${timeline ? ` · ${timeline.cuts.length} scenes` : ""}`;
  refresh();
  effects.draw();
  update();
};
video.onerror = () => {
  stop();
  duration = 0;
  $("play").disabled = true;
  refresh();
  status(
    "Choose a video to begin. The local server can load your rendered film automatically.",
  );
};
video.onended = stop;
video.onpause = () => {
  stopSound();
  $("play").textContent = "Play preview";
};
video.onwaiting = stopSound;
video.onplaying = startSound;
video.onseeking = stopSound;
video.onseeked = () => {
  update();
  if (!video.paused) startSound();
};
$("play").onclick = play;
$("loop").onclick = () => {
  video.loop = !video.loop;
  $("loop").setAttribute("aria-pressed", String(video.loop));
  $("loop").textContent = video.loop ? "Loop on" : "Loop off";
};
$("scrub").oninput = () => {
  stop();
  video.currentTime = number("scrub");
  update();
};
$("videoFile").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  stop();
  if (videoURL) URL.revokeObjectURL(videoURL);
  duration = 0;
  $("play").disabled = true;
  refresh();
  timeline = null;
  effects.setEdit(null);
  showCuts();
  videoFile = file;
  videoURL = URL.createObjectURL(file);
  video.src = videoURL;
  status(
    "Custom video loaded. Use the first frame as the alignment point; the original cut map is not applied.",
  );
};
async function loadSong(file) {
  const token = ++generation;
  stop();
  status("Analyzing the waveform and tempo…");
  $("save").disabled = true;
  $("export").disabled = true;
  $("controls").disabled = true;
  $("play").disabled = true;
  try {
    if (file.size > 100 * 1024 * 1024)
      throw Error("Choose an audio file smaller than 100 MB.");
    getContext();
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (token !== generation) return;
    if (decoded.duration > 15 * 60)
      throw Error("Choose a song shorter than 15 minutes.");
    // Downmix all channels so hard-panned material is included.
    const mono = new Float32Array(decoded.length);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < mono.length; i++)
        mono[i] += data[i] / decoded.numberOfChannels;
    }
    const result = analyzeSamples(mono, decoded.sampleRate);
    if (decoded.numberOfChannels > 2) throw Error("Use a mono or stereo song.");
    decodedSong = decoded;
    songFile = file;
    invalidatePreview();
    song = { ...result, name: file.name, duration: decoded.duration };
    $("songName").textContent = file.name;
    $("bpm").value = result.bpm || 120;
    $("firstBeat").value = result.firstBeat.toFixed(3);
    $("firstBeat").max = song.duration;
    $("analysis").textContent = result.bpm
      ? `Estimated ${result.bpm} BPM · ${result.confidence > 0.5 ? "strong" : "tentative"} pulse. Check by ear; half/double tempo may fit.`
      : "No reliable pulse detected. Enter BPM and first beat manually.";
    setStart(0);
    refresh();
    if (song.duration >= duration)
      status("Song ready. Play the preview or align a beat to a cut.");
  } catch (e) {
    if (token !== generation) return;
    // Retain the last successfully decoded track when a replacement fails.
    refresh();
    status(`Could not load song: ${e.message}`);
  } finally {
    if (token === generation) $("play").disabled = !duration;
  }
}
$("songFile").onchange = (e) => {
  const file = e.target.files[0];
  if (file) loadSong(file);
};
$("start").oninput = () => setStart(number("start"));
$("startNumber").onchange = () => setStart(number("startNumber"));
$("volume").oninput = () => {
  $("volumeText").textContent = `${Math.round(number("volume") * 100)}%`;
  stop();
  invalidatePreview();
};
for (const id of ["bpm", "firstBeat", "fadeIn", "fadeOut"])
  $(id).onchange = () => {
    stop();
    invalidatePreview();
    draw();
    sync();
  };
$("snap").onclick = () => {
  if (!$("bpm").reportValidity() || !$("firstBeat").reportValidity()) return;
  const cut = timeline?.cuts[selectedCut]?.at || 0;
  const start = snapStart(
    number("start"),
    cut,
    number("bpm"),
    number("firstBeat"),
    Number($("start").max),
  );
  if (start === null) {
    status(
      "No matching beat fits this excerpt. Choose a longer song or a different cut.",
    );
    return;
  }
  setStart(start);
  status(
    `Beat aligned to ${timeline?.cuts[selectedCut]?.name || "the first frame"} at ${cut.toFixed(2)}s.`,
  );
};
$("save").onclick = () => {
  try {
    const mix = validateMix(settings(), duration, song?.duration);
    validateEffects(mix);
    download(JSON.stringify(mix, null, 2), "komo-mix.json", "application/json");
    status(
      "Mix settings saved. Use the export command below to create your MP4.",
    );
    document.querySelector("details").open = true;
  } catch (e) {
    status(e.message);
  }
};
const wrap = document.querySelector(".wave-wrap");
let dragging = false,
  dragOrigin = 0,
  initialStart = 0;
wrap.onpointerdown = (e) => {
  if (!song || $("start").disabled) return;
  dragging = true;
  dragOrigin = e.clientX;
  initialStart = number("start");
  wrap.setPointerCapture(e.pointerId);
};
wrap.onpointermove = (e) => {
  if (dragging)
    setStart(
      initialStart +
        ((e.clientX - dragOrigin) / wrap.clientWidth) * song.duration,
    );
};
wrap.onpointerup = wrap.onpointercancel = () => {
  dragging = false;
};
// An original synthesized rhythm for testing; never a catalog recording.
$("demo").onclick = async () => {
  const sr = 22050,
    length = sr * 40,
    buffer = new ArrayBuffer(44 + length * 2),
    view = new DataView(buffer);
  const text = (at, value) =>
    [...value].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const t = i / sr,
      beat = t % 0.5,
      bar = Math.floor(t / 2) % 4;
    const kick =
      Math.sin(2 * Math.PI * (55 * beat + 7 * (1 - Math.exp(-beat * 30)))) *
      Math.exp(-beat * 22);
    const note = [220, 261.63, 196, 174.61][bar];
    const pad =
      0.12 *
      Math.sin(2 * Math.PI * note * t) *
      Math.min(1, t / 0.2, (40 - t) / 0.5);
    view.setInt16(44 + i * 2, Math.round((kick * 0.6 + pad) * 32767), true);
  }
  const file = new File([buffer], "komo-demo-120bpm.wav", {
    type: "audio/wav",
  });
  await loadSong(file);
  download(buffer, file.name, file.type);
};
try {
  const response = await fetch("edit.json");
  if (!response.ok) throw Error("Cut map unavailable");
  const edit = await response.json();
  timeline = cutTimeline(edit);
  effects.setEdit(edit);
  try {
    const cueResponse = await fetch("cues.json");
    if (cueResponse.ok) effects.loadSheet(await cueResponse.json());
  } catch (error) {
    status(`Animation cues unavailable: ${error.message}`);
  }
  if (duration && Math.abs(duration - timeline.duration) > 0.08)
    timeline = null;
  showCuts();
  if (duration)
    $("filmInfo").textContent =
      `${duration.toFixed(2)} seconds${timeline ? ` · ${timeline.cuts.length} scenes` : ""}`;
} catch {
  status(
    "Cut map unavailable. Choose a video and song to align from the first frame.",
  );
}
draw();

// Static preview hosts may not support byte ranges. A local blob gives the
// media element a fully seekable source, just like a user-selected file.
try {
  const response = await fetch("film.mp4");
  if (!response.ok) throw Error("Film unavailable");
  const blob = await response.blob();
  if (!videoURL) {
    videoFile = blob;
    videoURL = URL.createObjectURL(blob);
    video.src = videoURL;
  }
} catch {
  if (!videoURL)
    status(
      "Choose a video to begin. No rendered film was found on this server.",
    );
}

try {
  const response = await fetch("capabilities.json");
  if (response.ok) localExport = (await response.json()).localExport === true;
} catch {
  /* Static preview uses the documented local command. */
}
if (!localExport) $("export").textContent = "Export MP4 locally ↗";
$("export").onclick = async () => {
  try {
    const mix = validateMix(settings(), duration, song?.duration);
    validateEffects(mix);
    if (!localExport) {
      $("save").click();
      status(
        "Mix saved with all sound cues. Run the export command below, or open the local studio for one-click MP4 download.",
      );
      return;
    }
    stop();
    $("export").disabled = true;
    status("Exporting picture, music and sound effects together…");
    const body = new FormData();
    body.append("mix", JSON.stringify(mix));
    body.append("video", videoFile, "film.mp4");
    if (songFile) body.append("song", songFile, "song.audio");
    const response = await fetch("export", { method: "POST", body });
    if (!response.ok) throw Error(await response.text());
    const result = await response.json();
    if (!/^\/exports\/[a-f0-9-]+\.mp4$/.test(result.download))
      throw Error("Invalid download response.");
    $("exportDownload").href = result.download;
    $("exportDownload").hidden = false;
    status(
      JSON.stringify(settings()) === JSON.stringify(mix)
        ? "MP4 ready with music and all enabled sound effects. Download within 10 minutes."
        : "The earlier mix is ready to download. Settings changed during export; export again to include them.",
    );
  } catch (error) {
    status(`Export failed: ${error.message}`);
  } finally {
    $("export").disabled = !duration;
  }
};
