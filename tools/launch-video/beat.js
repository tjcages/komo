/* A single musical clock drives every cut and every gesture. No looping product demos. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const TOTAL = 76;
const beats = [
  { kind: "pins" }, { kind: "pins" },
  { kind: "conversation" }, { kind: "conversation" },
  { kind: "drawer-intro" }, { kind: "drawer-dock" },
  { kind: "scroll" }, { kind: "thread" }, { kind: "wide" },
  { kind: "sidebar" }, { kind: "sidebar" }, { kind: "sidebar" },
  { title: "Every comment. One place." },
  { kind: "drawer" }, { kind: "copy" },
  { kind: "agent" }, { kind: "agent" },
  { kind: "logo" }, { kind: "logo" },
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
  e.setAttribute("aria-hidden", a > 0 ? "false" : "true");
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
// Opacity only: short word stagger, no text translation or scaling.
function titleMotion(el, p) {
  el.style.opacity = 1;
  el.style.transform = "none";
  el.style.filter = "none";
  [...el.children].forEach((word, i) => word.style.opacity = ease((p - i * 0.13) / 0.42));
}
function setTitle(el, text) {
  if (el.dataset.copy === text) return;
  el.dataset.copy = text;
  el.replaceChildren(...text.split(" ").map((word, i) => {
    const span = document.createElement("span"); span.textContent = (i ? " " : "") + word; return span;
  }));
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
    setTitle($("#title-hit h1"), spec.title);
    titleMotion($("#title-hit h1"), local / 0.7);
  } else if (spec.kind === "logo") {
    show("#intro", ease((beat - 68) / 0.7) * (1 - ease((beat - 75) / 1)));
    show("#beat-rings", ease((beat - 68) / 0.7) * (1 - ease((beat - 75) / 1)));
    $$("#beat-rings i").forEach((e, i) => {
      const p = clip((beat - 68 - i * 0.4) / 5.8);
      e.style.transform = `scale(${0.65 + p * 1.65})`;
      e.style.opacity = (1 - p) * 0.75;
    });
  } else if (spec.kind === "agent") {
    const enter = ease((beat - 60.25) / 0.65), exit = 1 - ease((beat - 67) / 0.7);
    show("#agent-handoff", enter * exit);
    const demo = $("#product-frame").contentWindow.widgetDemo;
    const copied = demo?.copied || "";
    if (!copied) demo?.update({ beat, count: 4, incoming: 8, scroll: 850, mode: "drawer", isolated: true, replies: 2, reaction: 6, copy: true });
    const paste = beat >= 63 && copied.length > 0;
    const field = $("#agent-prompt");
    field.value = paste ? copied : "";
    const expansion = paste ? ease((beat - 63) / 0.7) : 0;
    $("#prompt-bar").style.height = `${140 + 210 * expansion}px`;
    $("#prompt-bar").classList.toggle("focused", beat >= 62);
    show("#prompt-meta", expansion);
    $("#prompt-count").textContent = `${copied.match(/Threads: (\d+) open/)?.[1] || "12"} comments · full prompt`;
    // Full generated prompt is pasted at once. Show its actual feedback section
    // and scroll through it, rather than recreating or shortening the prompt.
    if (paste) {
      const measure = $("#prompt-measure");
      measure.style.width = `${field.clientWidth}px`;
      measure.textContent = copied.slice(0, copied.indexOf("**Requested change"));
      const firstThread = measure.offsetHeight;
      field.scrollTop = mix(firstThread, field.scrollHeight - field.clientHeight, ease((beat - 64) / 2.5));
    } else field.scrollTop = 0;
    const p = ease((beat - 60.8) / 1), cursorAlpha = ease((beat - 60.8) / 0.3) * (1 - ease((beat - 63.4) / 0.4));
    show("#demo-cursor", cursorAlpha);
    move("#demo-cursor", mix(1590, 700, p), mix(280, 535, p), beat >= 62 && beat < 62.25 ? 0.78 : 1);
    const click = clip((beat - 62) / 0.5);
    show("#click-ring", beat >= 62 ? (1 - click) * cursorAlpha : 0);
    move("#click-ring", 652, 487, 0.5 + click);
  } else {
    show("#story", 1);
    $("#story").style.filter = "none";
    let count = 4, scroll = 850, mode = "page", scale = 1.7, x = -70, y = -65;
    let incoming = 0, replies = 0, reaction = 0, isolated = false, surfaceOpacity = 1;
    if (spec.kind === "pins") {
      scroll = 0;
      count = beat < 2.5 ? 0 : beat < 4 ? 1 : 2;
      show("#story", 1 - ease((beat - 7.1) / 0.45));
      if (beat >= 7.6) { mode = "hero-thread"; isolated = true; }
    }
    if (spec.kind === "conversation") {
      scroll = 0; count = 2; mode = "hero-thread"; isolated = true;
      replies = beat >= 13 ? 2 : beat >= 10.5 ? 1 : 0;
      scale = 2.55;
      show("#story", ease((beat - 8) / 0.45) * (1 - ease((beat - 15.5) / 0.5)));
    }
    if (spec.kind === "drawer-intro" || spec.kind === "drawer-dock") {
      count = 2; scroll = 0; mode = "drawer"; scale = 2.6; isolated = true;
      show("#story", ease((beat - 16) / 0.6));
      if (spec.kind === "drawer-dock") {
        scroll = 850 * ease((beat - 20) / 3.5);
        isolated = false; surfaceOpacity = ease((beat - 20) / 1);
        if (beat >= 22) mode = "page";
      }
    }
    if (spec.kind === "scroll") {
      scroll = 850;
      count = beat < 24.5 ? 2 : beat < 25.4 ? 3 : 4;
      scale = 1.5; x = 0; y = -10;
    }
    if (spec.kind === "thread" || spec.kind === "thread-two") {
      mode = spec.kind; scale = 2.15; x = -530; y = -100;
      show("#story", 1);
    }
    if (spec.kind === "wide") {
      scale = 1.5; x = 0; y = -10;
      show("#story", 1);
    }
    if (spec.kind === "sidebar") {
      mode = "sidebar";
      incoming = Math.max(0, Math.min(8, Math.floor((beat - 38) / 0.5) + 1));
      reaction = Math.max(0, Math.min(6, Math.floor((beat - 44) * 2)));
      const p = ease((beat - 37) / 0.8);
      scale = mix(1.5, 2, p); x = mix(0, -640, p); y = mix(-10, 0, p);
    }
    if (spec.kind === "drawer" || spec.kind === "copy") {
      mode = "drawer"; isolated = true; scale = 2.6;
      incoming = 8;
      show("#story", ease((beat - 52) / 0.6));
    }
    const frame = $("#product-frame"), demo = frame.contentWindow.widgetDemo;
    demo?.update({ beat, count, incoming, scroll, mode, replies, reaction, isolated, surfaceOpacity,
      copy: spec.kind === "copy" && local >= 2.8 });
    if (isolated || spec.kind === "drawer-dock") {
      const r = demo?.focusRect(["drawer", "drawer-intro", "drawer-dock", "copy"].includes(spec.kind) ? "drawer" : "comment");
      if (r) { x = 960 - (r.x + r.width / 2) * scale; y = 540 - (r.y + r.height / 2) * scale; }
      else show("#story", 0);
    }
    if (spec.kind === "drawer-dock") {
      const p = ease((beat - 20) / 3.5);
      x = mix(x, 0, p); y = mix(y, -10, p); scale = mix(2.6, 1.5, p);
    }
    // No camera reads from an outgoing comment while the next view is being prepared.
    if (!demo?.state.ready || demo.state.mode !== mode) show("#story", 0);
    frame.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    if (spec.kind === "pins" && beat >= 5.5 && beat < 7.55) {
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
    if (spec.kind === "drawer" || spec.kind === "copy") {
      const rows = demo?.menuRects() || [];
      if (rows.length) {
        const t = beat - 52, first = rows[0], last = rows.at(-1), copy = rows.find(r => r.id === "copy-prompts") || first;
        let target = first;
        if (t >= 1.1 && t < 4.8) {
          const p = ease((t - 1.1) / 3.7);
          target = { ...first, y: mix(first.y, last.y, p) };
        } else if (t >= 4.8) {
          target = { ...copy, y: mix(last.y, copy.y, ease((t - 4.8) / 1.4)) };
        }
        const p = ease(t / 0.7), tx = x + (target.x + target.width * 0.7) * scale, ty = y + (target.y + target.height / 2) * scale;
        show("#demo-cursor", p);
        move("#demo-cursor", mix(1700, tx, p), mix(260, ty, p), t >= 6.8 && t < 7.05 ? 0.78 : 1);
        demo?.hoverAt(target.y + target.height / 2);
        const c = clip((t - 6.8) / 0.5);
        show("#click-ring", t >= 6.8 ? 1 - c : 0);
        move("#click-ring", tx - 48, ty - 48, 0.5 + c);
      }
    }
    if (spec.kind === "sidebar" && beat >= 44) {
      show("#emoji-burst", 1);
      $$("#emoji-burst i").forEach((e, i) => {
        const age = beat - 44 - i * 0.35, p = clip(age / 0.55);
        e.style.opacity = ease(age / 0.2) * (1 - ease((age - 1.25) / 0.5));
        e.style.transform = `translate(${1780 + (i % 2) * 35}px,${240 + (i % 3) * 125}px) scale(${0.5 + pop(p) * 0.5})`;
      });
    }

  }
  // A brief opaque midpoint hides the actual scene swap. Continuous desktop
  // movement and native sidebar opening are intentionally not masked.
  const cuts = [8, 16, 28, 32, 48, 52, 60, 68];
  let matte = 0;
  for (const cut of cuts) {
    const before = ease((beat - (cut - 0.32)) / 0.22);
    const after = 1 - ease((beat - (cut + 0.12)) / 0.3);
    matte = Math.max(matte, before * after);
  }
  show("#transition-matte", matte);
  lastScene = index;
  for (const a of $("#intro").getAnimations({ subtree: true })) {
    a.pause();
    a.currentTime = (spec.kind === "logo" ? beat - 68 : local) * 700;
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
