/* A single musical clock drives every cut and every gesture. No looping product demos. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const TOTAL = 64;
const beats = [
  { kind: "logo" },
  { kind: "pins" },
  { kind: "pins" },
  { title: "Chat on any website." },
  { kind: "scroll" },
  { kind: "scroll" },
  { kind: "thread" },
  { kind: "compose" },
  { kind: "drawer" },
  { kind: "sidebar" },
  { kind: "sidebar" },
  { kind: "sidebar" },
  { title: "Every comment. One place." },
  { kind: "scroll-end" },
  { kind: "logo" },
  { title: "komo.offbr.co", tone: "dark" },
];
let bpm = Number(params.get("bpm")) || 144;
bpm = Math.min(240, Math.max(60, bpm));
let ramp = params.get("ramp") === "1",
  beat = 0;
let playing = !params.has("capture") && !reduced.matches;
let anchorBeat = 0,
  anchorTime = performance.now(),
  lastScene = -1;
let audio,
  voices = [],
  click = false;
const clip = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => 1 - (1 - clip(n)) ** 3;
const fade = (b, a, d = 0.45) => ease((b - a) / d);
const mix = (a, b, p) => a + (b - a) * p;
const pop = (p) => {
  p = clip(p);
  return 1 + 2.1 * (p - 1) ** 3 + 1.1 * (p - 1) ** 2;
};
const show = (s, a) => {
  const e = $(s);
  e.style.opacity = clip(a);
  e.style.visibility = a > 0 ? "visible" : "hidden";
};
const move = (s, x = 0, y = 0, scale = 1, rotation = 0) => {
  $(s).style.transform =
    `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${scale})`;
};
function fit() {
  const r = $("#screen").getBoundingClientRect();
  $("#film").style.transform =
    `scale(${Math.min(r.width / 1920, r.height / 1080)})`;
}
addEventListener("resize", fit);
document.addEventListener("fullscreenchange", fit);
fit();
// Restrained whole-title rise: no elastic letters, rotation, or stroke swell.
function titleMotion(el, p) {
  const q = reduced.matches ? 1 : ease(p);
  el.style.opacity = q;
  el.style.transform = `translateY(${24 * (1 - q)}px)`;
  el.style.filter = `blur(${4 * (1 - q)}px)`;
}
function typeText(selector, text, p) {
  const e = typeof selector === "string" ? $(selector) : selector,
    n = Math.floor(text.length * clip(p));
  e.textContent = text.slice(0, n);
  e.classList.toggle("is-typing", n > 0 && n < text.length);
}
function render(value) {
  beat = Math.max(0, Math.min(TOTAL, value));
  const index = Math.min(15, Math.floor(beat / 4)),
    local = beat - index * 4,
    spec = beats[index];
  for (const s of ["#intro", "#outro", "#story", "#title-hit", "#beat-rings"])
    show(s, 0);
  if (spec.title) {
    show("#title-hit", 1);
    $("#title-hit").dataset.tone = spec.tone || "lavender";
    $("#title-hit h1").textContent = spec.title;
    titleMotion($("#title-hit h1"), local / 0.7);
  } else if (spec.kind === "logo") {
    show("#intro", 1);
    show("#beat-rings", 1);
    $$("#beat-rings i").forEach((e, i) => {
      const p = clip((local - i * 0.4) / 2.8);
      e.style.transform = `scale(${0.65 + p * 1.65})`;
      e.style.opacity = (1 - p) * 0.75;
    });
  } else {
    show("#story", 1);
    let count = 2,
      scroll = 0,
      mode = "page",
      typing = 0,
      scale = 1.75,
      x = -100,
      y = -80;
    if (spec.kind === "pins") count = beat < 6 ? 0 : beat < 9 ? 1 : 2;
    if (spec.kind === "scroll") {
      scroll = 850 * ease((beat - 16) / 7);
      count = beat < 18 ? 2 : beat < 21 ? 3 : 4;
    }
    if (spec.kind === "thread" || spec.kind === "compose") {
      scroll = 850;
      count = 4;
      mode = spec.kind;
      typing = clip((local - 0.6) / 2.5);
      x = -480;
      scale = 2;
    }
    if (spec.kind === "compose") {
      x = -140;
      y = -380;
    }
    if (spec.kind === "drawer") {
      scroll = 850;
      count = 4;
      mode = "drawer";
      scale = 1.6;
      x = -100;
      y = -40;
    }
    if (spec.kind === "sidebar") {
      scroll = 850;
      count = 4;
      mode = beat >= 43 ? "sidebar-thread" : "sidebar";
      const p = ease((beat - 36) / 3);
      scale = mix(1.6, 2, p);
      x = mix(-100, -640, p);
      y = -40 * (1 - p);
      if (mode === "sidebar-thread") {
        const q = ease((beat - 43) / 1.5);
        scale = mix(2, 1.65, q);
        x = mix(-640, -180, q);
        y = -20 * q;
      }
    }
    if (spec.kind === "scroll-end") {
      count = 5;
      scroll = 850 + 600 * ease(local / 3);
      x = -180;
    }
    const frame = $("#product-frame");
    frame.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    frame.contentWindow.widgetDemo?.update({
      count,
      scroll,
      mode,
      typing,
      submit: spec.kind === "compose" && local >= 3.5,
    });
  }
  lastScene = index;
  for (const a of $("#intro").getAnimations({ subtree: true })) {
    a.pause();
    a.currentTime = local * 700;
  }
  $("#progress").style.width = `${(beat / TOTAL) * 100}%`;
  $("#scrub").value = String(beat);
  $("#beat-readout").textContent =
    `${String(Math.min(64, Math.floor(beat) + 1)).padStart(2, "0")} / 64`;
  $$("#meter i").forEach((e, i) =>
    e.classList.toggle("on", i === Math.floor(beat) % 4),
  );
  $("#film").dataset.scene = spec.kind || "title";
  $("#film").dataset.beat = beat.toFixed(3);
}
// Analytic conversion avoids accumulating drift, including the optional 1.5x ramp.
function secondsAt(b) {
  return ramp
    ? ((60 * TOTAL) / (bpm * 0.5)) * Math.log1p((0.5 * b) / TOTAL)
    : (b * 60) / bpm;
}
function beatsAt(t) {
  return ramp
    ? (TOTAL / 0.5) * Math.expm1((t * bpm * 0.5) / (60 * TOTAL))
    : (t * bpm) / 60;
}
function current(now = performance.now()) {
  return playing
    ? beatsAt(secondsAt(anchorBeat) + (now - anchorTime) / 1000)
    : beat;
}
function silence() {
  for (const o of voices) {
    try {
      o.stop();
    } catch {}
  }
  voices = [];
}
function scheduleClicks() {
  silence();
  if (!click || !playing || !audio) return;
  const start = audio.currentTime + 0.025;
  for (let b = Math.ceil(beat); b < TOTAL; b++) {
    const t = start + secondsAt(b) - secondsAt(beat);
    if (t < start) continue;
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.frequency.value = b % 4 === 0 ? 1100 : 760;
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + 0.045);
    voices.push(o);
  }
}
function anchor() {
  anchorBeat = beat;
  anchorTime = performance.now();
  $("#play").textContent = playing ? "Pause" : "Play";
  $("#play").setAttribute(
    "aria-label",
    playing ? "Pause animation" : "Play animation",
  );
  scheduleClicks();
}
function setTempo(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  render(Math.min(64, current()));
  bpm = Math.max(60, Math.min(240, n));
  $("#bpm").value = bpm;
  $("#tempo-range").value = bpm;
  anchor();
}
$("#bpm").value = bpm;
$("#tempo-range").value = bpm;
$("#ramp").checked = ramp;
$("#bpm").addEventListener("change", (e) => setTempo(e.target.value));
$("#tempo-range").addEventListener("input", (e) => setTempo(e.target.value));
$("#ramp").addEventListener("change", (e) => {
  render(Math.min(64, current()));
  ramp = e.target.checked;
  anchor();
});
$("#play").addEventListener("click", () => {
  render(Math.min(64, current()));
  playing = !playing;
  if (playing && beat >= 64) render(0);
  anchor();
});
$("#replay").addEventListener("click", () => {
  render(0);
  playing = true;
  anchor();
});
$("#scrub").addEventListener("input", (e) => {
  playing = false;
  render(Number(e.target.value));
  anchor();
});
$("#click-track").addEventListener("change", async (e) => {
  click = e.target.checked;
  if (click) {
    audio ??= new AudioContext();
    await audio.resume();
  }
  render(Math.min(64, current()));
  anchor();
});
$("#fullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else $("#screen").requestFullscreen();
});
addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    !["INPUT", "BUTTON"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    $("#play").click();
  }
  if (e.code === "Escape" && playing) {
    render(Math.min(64, current()));
    playing = false;
    anchor();
  }
});
let resume = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resume = playing;
    render(Math.min(64, current()));
    playing = false;
    anchor();
  } else if (resume) {
    playing = true;
    anchor();
  }
});
reduced.addEventListener("change", () => {
  if (reduced.matches) {
    render(Math.min(64, current()));
    playing = false;
    anchor();
  }
});
window.seekBeat = (b) => {
  playing = false;
  render(b);
  anchor();
};
window.seek = (t) => window.seekBeat(beatsAt(t));
window.beatStudio = {
  get state() {
    return {
      bpm,
      ramp,
      beat,
      playing,
      duration: secondsAt(TOTAL),
      totalBeats: TOTAL,
    };
  },
  setTempo,
  secondsAt,
  beatsAt,
};
render(0);
anchor();
function frame(now) {
  if (playing) {
    let b = current(now);
    if (b >= TOTAL) {
      if ($("#loop").checked) {
        b = beatsAt(secondsAt(b) % secondsAt(TOTAL));
        render(b);
        anchor();
      } else {
        b = TOTAL;
        playing = false;
        anchor();
      }
    }
    render(b);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
