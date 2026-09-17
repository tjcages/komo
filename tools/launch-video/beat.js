/* A single musical clock drives every cut and every gesture. No looping product demos. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const TOTAL = 76;
const beats = [
  { kind: "pins" }, { kind: "pins" },
  { kind: "conversation" }, { kind: "conversation" },
  { kind: "scroll" }, { kind: "thread" }, { kind: "thread-two" },
  { kind: "sidebar" }, { kind: "sidebar" }, { kind: "sidebar" },
  { title: "Every comment. One place." },
  { kind: "drawer" }, { kind: "copy" },
  { kind: "agent" }, { kind: "agent" },
  { kind: "logo" }, { title: "komo.offbr.co", tone: "dark" },
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
  const index = Math.min(beats.length - 1, Math.floor(beat / 4)),
    local = beat - index * 4,
    spec = beats[index];
  for (const s of ["#intro", "#outro", "#story", "#title-hit", "#beat-rings", "#agent-handoff", "#demo-cursor", "#click-ring", "#emoji-burst", "#copy-title"])
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
  } else if (spec.kind === "agent") {
    show("#agent-handoff", ease((beat - 52) / 0.8));
    move("#agent-handoff", 0, 35 * (1 - ease((beat - 52) / 0.8)));
    const handoff = $("#product-frame").contentWindow.widgetDemo;
    const copied = handoff?.copied || "";
    if (!copied) handoff?.update({ beat, count: 4, incoming: 3, scroll: 850, mode: "drawer", isolated: true, replies: 2, reaction: 12, copy: true });
    const excerpts = [...copied.matchAll(/\*\*(?:Requested change|Reply)[^\n]*\*\*\n> ([^\n]+)/g)].map(m => m[1]);
    $("#agent-handoff .coding-user p").textContent = excerpts.slice(0, 4).join("\n\n");
    $("#agent-handoff .prompt-attachment").textContent = `${copied.match(/Threads: (\d+) open/)?.[1] || "7"} comments · page context`;
    show("#agent-handoff .coding-user", ease((beat - 53.5) / 0.6));
  } else {
    show("#story", 1);
    let count = 4, scroll = 850, mode = "page", scale = 1.7, x = -70, y = -65;
    let incoming = 0, replies = 0, reaction = 0, isolated = false;
    if (spec.kind === "pins") {
      scroll = 0;
      count = beat < 2.5 ? 0 : beat < 4 ? 1 : 2;
      show("#story", ease(beat / 0.8) * (1 - ease((beat - 7.5) / 0.5)));
    }
    if (spec.kind === "conversation") {
      scroll = 0; count = 2; mode = "hero-thread"; isolated = true;
      replies = beat >= 13 ? 2 : beat >= 10.5 ? 1 : 0;
      scale = 2.55;
      show("#story", ease((beat - 8) / 0.55) * (1 - ease((beat - 15.5) / 0.5)));
    }
    if (spec.kind === "scroll") {
      scroll = 850 * ease((beat - 16) / 1.5);
      count = beat < 17.8 ? 2 : beat < 18.6 ? 3 : 4;
      show("#story", ease((beat - 16) / 0.5));
    }
    if (spec.kind === "thread" || spec.kind === "thread-two") {
      mode = spec.kind; scale = 2.15; x = -530; y = -100;
      if (mode === "thread-two") { x = -160; y = -320; }
    }
    if (spec.kind === "sidebar") {
      mode = "sidebar";
      incoming = beat < 32 ? 0 : beat < 33.5 ? 1 : beat < 35 ? 2 : 3;
      reaction = Math.max(0, Math.min(12, Math.floor((beat - 36) * 4)));
      const p = ease((beat - 30) / 1.5);
      scale = mix(1.7, 2, p); x = mix(-70, -640, p); y = mix(-65, 0, p);
    }
    if (spec.kind === "drawer" || spec.kind === "copy") {
      mode = "drawer"; isolated = true; scale = 2.6;
      incoming = 3;
      show("#story", ease((beat - 44) / 0.65));
      if (spec.kind === "copy") {
        show("#copy-title", ease(local / 0.6));
        $("#copy-title").textContent = "Copy all comments.";
      }
    }
    const frame = $("#product-frame"), demo = frame.contentWindow.widgetDemo;
    demo?.update({ beat, count, incoming, scroll, mode, replies, reaction, isolated,
      copy: spec.kind === "copy" && local >= 1 });
    if (isolated) {
      const r = demo?.focusRect(mode === "drawer" ? "drawer" : "comment");
      if (r) { x = 960 - (r.x + r.width / 2) * scale; y = (mode === "drawer" ? 590 : 540) - (r.y + r.height / 2) * scale; }
    }
    frame.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    if (spec.kind === "pins" && beat >= 5.5) {
      const r = demo?.pinRect("demo-0");
      if (r) {
        const p = ease((beat - 5.5) / 1.25), tx = x + (r.x + r.width / 2) * scale, ty = y + (r.y + r.height / 2) * scale;
        show("#demo-cursor", ease((beat - 5.5) / 0.35));
        move("#demo-cursor", mix(1750, tx, p), mix(950, ty, p), beat >= 7 && beat < 7.25 ? 0.78 : 1);
        const click = clip((beat - 7) / 0.5);
        show("#click-ring", beat >= 7 ? 1 - click : 0);
        move("#click-ring", tx - 48, ty - 48, 0.5 + click * 1.3);
      }
    }
    if (spec.kind === "sidebar" && beat >= 36) {
      show("#emoji-burst", 1);
      $$("#emoji-burst i").forEach((e, i) => {
        const p = clip((beat - 36 - (i % 6) * 0.18) / 2.4);
        e.style.opacity = Math.sin(p * Math.PI);
        e.style.transform = `translate(${1330 + Math.sin(i * 2.4) * p * 250}px,${470 - p * (350 + i * 13)}px) rotate(${(i % 2 ? 1 : -1) * p * 28}deg) scale(${0.6 + Math.sin(p * Math.PI) * 0.65})`;
      });
    }
  }
  lastScene = index;
  for (const a of $("#intro").getAnimations({ subtree: true })) {
    a.pause();
    a.currentTime = local * 700;
  }
  $("#progress").style.width = `${(beat / TOTAL) * 100}%`;
  $("#scrub").value = String(beat);
  $("#beat-readout").textContent =
    `${String(Math.min(TOTAL, Math.floor(beat) + 1)).padStart(2, "0")} / ${TOTAL}`;
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
  render(Math.min(TOTAL, current()));
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
  render(Math.min(TOTAL, current()));
  ramp = e.target.checked;
  anchor();
});
$("#play").addEventListener("click", () => {
  render(Math.min(TOTAL, current()));
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
  render(Math.min(TOTAL, current()));
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
    render(Math.min(TOTAL, current()));
    playing = false;
    anchor();
  }
});
let resume = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resume = playing;
    render(Math.min(TOTAL, current()));
    playing = false;
    anchor();
  } else if (resume) {
    playing = true;
    anchor();
  }
});
reduced.addEventListener("change", () => {
  if (reduced.matches) {
    render(Math.min(TOTAL, current()));
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
  } else {
    render(beat);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
