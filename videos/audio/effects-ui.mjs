import {
  SOUNDS,
  resolveCues,
  synthesize,
  validateEffects,
} from "./effects.mjs";
export function createEffectsEditor({
  video,
  getDuration,
  getContext,
  changed,
}) {
  const $ = (id) => document.getElementById(id);
  let cues = [],
    edit,
    sheet;
  const fields = () => ({
    fps: 30,
    effects: cues.map((c) => ({ ...c })),
    effectsEnabled: $("effectsEnabled").checked,
    effectsVolume: Number($("effectsVolume").value),
  });
  function draw() {
    $("cueList").replaceChildren();
    $("cueCount").textContent = `${cues.length} animation cues`;
    $("cueTrack").replaceChildren();
    for (const cue of cues) {
      const row = document.createElement("div");
      row.className = "cue-row";
      const label = document.createElement("input");
      label.value = cue.label;
      label.maxLength = 120;
      label.setAttribute("aria-label", `Label for ${cue.id}`);
      const sound = document.createElement("select");
      sound.setAttribute("aria-label", `Sound for ${cue.label}`);
      for (const name of Object.keys(SOUNDS)) {
        const o = new Option(name, name);
        sound.add(o);
      }
      sound.value = cue.sound;
      const frame = document.createElement("input");
      frame.type = "number";
      frame.min = 0;
      frame.max = Math.max(0, Math.ceil(getDuration() * 30) - 1);
      frame.step = 1;
      frame.value = cue.frame;
      frame.setAttribute("aria-label", `Frame for ${cue.label}`);
      const volume = document.createElement("input");
      volume.type = "range";
      volume.min = 0;
      volume.max = 1;
      volume.step = 0.01;
      volume.value = cue.volume;
      volume.setAttribute("aria-label", `Volume for ${cue.label}`);
      const audition = document.createElement("button");
      audition.textContent = "Hear";
      audition.setAttribute("aria-label", `Hear ${cue.label}`);
      audition.onclick = async () => {
        changed();
        const ctx = getContext();
        await ctx.resume();
        const pcm = synthesize(cue.sound, ctx.sampleRate);
        const buffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
        buffer.copyToChannel(pcm, 0);
        const node = ctx.createBufferSource(),
          gain = ctx.createGain();
        gain.gain.value = cue.volume * Number($("effectsVolume").value);
        node.buffer = buffer;
        node.connect(gain).connect(ctx.destination);
        node.start();
        node.onended = () => {
          node.disconnect();
          gain.disconnect();
        };
      };
      const remove = document.createElement("button");
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${cue.label}`);
      remove.onclick = () => {
        cues = cues.filter((c) => c.id !== cue.id);
        changed();
        draw();
      };
      label.onchange = () => {
        cue.label = label.value;
        changed();
        draw();
      };
      sound.onchange = () => {
        cue.sound = sound.value;
        changed();
      };
      frame.onchange = () => {
        if (!frame.reportValidity()) {
          frame.value = cue.frame;
          return;
        }
        cue.frame = Number(frame.value);
        changed();
        draw();
      };
      volume.oninput = () => {
        cue.volume = Number(volume.value);
        changed();
      };
      row.append(label, sound, frame, volume, audition, remove);
      $("cueList").append(row);
      const marker = document.createElement("button");
      marker.className = "cue-marker";
      marker.style.left = `${Math.min(99, (cue.frame / 30 / getDuration()) * 100)}%`;
      marker.title = `${cue.label} · ${(cue.frame / 30).toFixed(3)}s`;
      marker.setAttribute("aria-label", `Seek ${cue.label}`);
      marker.onclick = () => {
        changed();
        video.currentTime = cue.frame / 30;
      };
      $("cueTrack").append(marker);
    }
  }
  function loadSheet(data) {
    if (!edit) throw Error("A scene cue sheet needs the matching film edit.");
    const next = resolveCues(edit, data);
    validateEffects({
      duration:
        getDuration() || edit.cuts.reduce((n, c) => n + c.out - c.in, 0) / 30,
      musicEnabled: false,
      ...fields(),
      effects: next,
    });
    sheet = data;
    cues = next;
    changed();
    draw();
  }
  $("addCue").onclick = () => {
    if (!getDuration()) return;
    cues.push({
      id: crypto.randomUUID(),
      label: "Click",
      sound: "press",
      frame: Math.min(
        Math.ceil(getDuration() * 30) - 1,
        Math.round(video.currentTime * 30),
      ),
      volume: 0.5,
    });
    changed();
    draw();
  };
  $("restoreCues").onclick = () => {
    if (sheet && edit) loadSheet(sheet);
  };
  $("cueFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 100000) throw Error("Cue sheet is too large.");
      loadSheet(JSON.parse(await file.text()));
      $("status").textContent = "Scene cues imported.";
    } catch (error) {
      $("status").textContent = error.message;
    }
  };
  $("effectsEnabled").onchange = changed;
  $("effectsVolume").oninput = changed;
  draw();
  return {
    fields,
    setEdit(value) {
      edit = value;
      if (!edit) {
        cues = [];
        sheet = null;
        draw();
        changed();
      }
    },
    loadSheet,
    draw,
  };
}
