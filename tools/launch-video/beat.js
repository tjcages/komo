/* A single musical clock drives every cut and every gesture. No looping product demos. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const TOTAL = 64;
const beats = [
  { kind: "logo" },
  { kind: "point" },
  { kind: "area" },
  { title: "Right. There." },
  { kind: "reply" },
  { kind: "resolve" },
  { title: "Keep it moving.", tone: "dark" },
  { kind: "dock" },
  { kind: "sidebar" },
  { title: "Your agent. Your code." },
  { kind: "agent" },
  { kind: "improve" },
  { title: "A little better.", tone: "light" },
  { kind: "done" },
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
$(".hero-studio-heading").innerHTML = "<i></i><i></i>";
$(".hero-studio-copy").textContent = "";
$(".hero-studio-button").textContent = "";
$(".hero-site-nav i").textContent = "";
$(".hero-site-nav span").textContent = "";
$("#card-one .agent-message p").textContent = "";
$("#card-two .agent-message p").textContent = "";
$(".coding-user p").textContent = "";
$(".coding-response p").textContent = "";
$(".abstract-headline").textContent = "";
$(".abstract-headline.short").textContent = "";
$("#resolved").setAttribute("aria-label", "Feedback verified and resolved");
// Same squash / lift / settle contour as the existing logo intro, measured in beats.
const contour = [
  [0, 34, 0.94, 0.9, -2],
  [0.22, 6, 1.04, 0.96, -1],
  [0.43, -13, 1.025, 1.07, 1],
  [0.64, 2, 1.02, 0.985, -0.4],
  [0.83, -1, 0.997, 1.01, 0.2],
  [1, 0, 1, 1, 0],
];
function titleMotion(el, p) {
  p = clip(p);
  let i = contour.findIndex((k) => k[0] >= p);
  i = Math.max(1, i);
  const a = contour[i - 1],
    b = contour[i],
    f = (p - a[0]) / (b[0] - a[0]);
  const k = a.map((v, j) => mix(v, b[j], f));
  el.style.opacity = clip(p * 6);
  el.style.transform = reduced.matches
    ? "none"
    : `translateY(${k[1]}px) rotate(${k[4]}deg) scale(${k[2]},${k[3]})`;
  el.style.webkitTextStroke = `${Math.sin(p * Math.PI) * 1.6}px currentColor`;
}
function render(value) {
  beat = Math.max(0, Math.min(TOTAL, value));
  const index = Math.min(15, Math.floor(beat / 4)),
    local = beat - index * 4,
    spec = beats[index],
    unit = beat % 1;
  const enter = reduced.matches ? 1 : pop(local / 0.65),
    pulse = reduced.matches ? 0 : Math.exp(-unit * 8);
  for (const s of ["#intro", "#outro", "#story", "#title-hit", "#beat-rings"])
    show(s, 0);
  if (spec.title) {
    show("#title-hit", 1);
    $("#title-hit").dataset.tone = spec.tone || "lavender";
    if (lastScene !== index) {
      $("#title-hit h1").replaceChildren(
        ...spec.title.split(" ").map((w, i) => {
          const span = document.createElement("span");
          span.className = "word";
          span.textContent = (i ? " " : "") + w;
          return span;
        }),
      );
    }
    $$("#title-hit .word").forEach((el, i) =>
      titleMotion(el, (local - i * 0.09) / 1.15),
    );
  } else if (spec.kind === "logo") {
    show("#intro", 1);
    show("#beat-rings", 1);
    $$("#beat-rings i").forEach((el, i) => {
      const p = clip((local - i * 0.4) / 2.8);
      el.style.transform = `scale(${0.65 + p * 1.65})`;
      el.style.opacity = (1 - p) * 0.75;
    });
  } else {
    show("#story", 1);
    for (const s of [
      "#review",
      "#workflow",
      "#card-one",
      "#card-two",
      "#reaction",
      ".fixture-reply",
      ".scene-target",
      ".pin-design",
      "#sidebar",
      "#resolved",
      "#drawer",
      "#cursor",
    ])
      show(s, 0);
    show("#review", 1);
    move("#review", 0, 0, 1 + 0.035 * enter);
    move("#card-one", 0, 18 * (1 - enter), 0.94 + 0.06 * enter);
    move("#card-two", 0, 0, 1);
    move("#sidebar");
    move("#drawer");
    $("#drawer").style.translate = "none";
    $("#drawer").style.scale = "";
    $(".hero-studio-heading").style.gap = "13px";
    $(".hero-studio-button").style.background = "#e6deef";
    $(".hero-studio-button").style.width = "165px";
    $(".scene-target").style.setProperty("left", "112px", "important");
    $(".scene-target").style.setProperty("top", "176px", "important");
    $(".scene-target").style.setProperty("width", "680px", "important");
    $(".scene-target").style.setProperty("height", "144px", "important");
    $(".pin-design").style.setProperty("left", "110px", "important");
    $(".pin-design").style.setProperty("top", "176px", "important");
    const cursor = (x, y, a = 1) => {
      show("#cursor", a);
      $("#cursor").style.left = `${x}px`;
      $("#cursor").style.top = `${y}px`;
      move("#cursor", 0, 0, 1 - 0.13 * pulse);
    };
    const target = (x, y, w, h) => {
      for (const [k, v] of Object.entries({
        left: x,
        top: y,
        width: w,
        height: h,
      }))
        $(".scene-target").style.setProperty(k, `${v}px`, "important");
    };
    switch (spec.kind) {
      case "point": {
        move("#review", 35, -10, 1.12);
        show(".scene-target", fade(local, 0.15));
        show(".pin-design", fade(local, 1));
        show("#card-one", fade(local, 2));
        cursor(
          mix(430, 785, fade(local, 0, 1)),
          mix(365, 495, fade(local, 0, 1)),
        );
        move(
          "#card-one",
          0,
          20 * (1 - fade(local, 2)),
          0.94 + 0.06 * pop((local - 2) / 0.7),
        );
        break;
      }
      case "area": {
        const p = fade(local, 0.2, 1.5);
        target(110, 350, 20 + 250 * p, 15 + 95 * p);
        show(".scene-target", 1);
        show("#card-one", 1);
        show("#card-two", fade(local, 2));
        $(".pin-design").style.setProperty("top", "365px", "important");
        show(".pin-design", fade(local, 1.5));
        cursor(270 + 250 * p, 595 + 95 * p);
        move(
          "#card-two",
          10 * (1 - fade(local, 2)),
          30 * (1 - fade(local, 2)),
          0.94 + 0.06 * pop((local - 2) / 0.6),
        );
        break;
      }
      case "reply": {
        show("#card-one", 1);
        show("#reaction", fade(local, 0.75));
        show(".fixture-reply", fade(local, 1.75));
        move("#review", -150, -60, 1.3);
        move("#card-one", -260, 35, 1.13);
        $("#reaction").style.transform =
          `scale(${0.9 + 0.1 * pop((local - 0.75) / 0.5) + 0.06 * pulse})`;
        cursor(1085, local < 1.7 ? 550 : 670);
        break;
      }
      case "resolve": {
        const gone = fade(local, 1.5, 0.6);
        show("#card-one", 1 - gone);
        show("#reaction", 1);
        show(".fixture-reply", 1);
        move("#card-one", 0, -30 * gone, 1 - 0.1 * gone);
        show("#resolved", fade(local, 1.7));
        move(
          "#resolved",
          0,
          10 * (1 - fade(local, 1.7)),
          0.94 + 0.06 * pop((local - 1.7) / 0.65),
        );
        show("#card-two", fade(local, 2.75));
        move("#card-two", -80, -65 * fade(local, 2.75), 1);
        break;
      }
      case "dock": {
        show("#drawer", 1);
        move("#review", 0, 0, 0.94);
        show(".pin-design", 1);
        const key = Math.floor(local),
          p = fade(local, key, 0.7);
        const stops = [
          [640, 0],
          [70, -190],
          [1070, -190],
          [640, 0],
        ];
        const a = stops[Math.max(0, key - 1)],
          b = stops[Math.min(3, key)];
        move(
          "#drawer",
          mix(a[0], b[0], p) - 640,
          mix(a[1], b[1], p),
          2.4 + 0.06 * pulse,
        );
        cursor(920 + mix(a[0], b[0], p) - 640, 840 + mix(a[1], b[1], p));
        break;
      }
      case "sidebar": {
        const p = fade(local, 0, 0.8);
        show("#sidebar", 1);
        move("#sidebar", 120 * (1 - p), 0, 0.98 + 0.02 * p);
        move("#review", -35, 0, 1.04);
        $$("#sidebar .fixture-card").forEach((el, i) => {
          const q = fade(local, 0.4 + i * 0.4);
          el.style.opacity = q;
          el.style.transform = `translateX(${30 * (1 - q)}px)`;
        });
        $(".side-copy").style.transform =
          `scale(${1 - 0.07 * (1 - fade(local % 1, 0, 0.5))})`;
        $(".side-copy svg").style.opacity = local >= 2 ? 0 : 1;
        $(".side-copy").classList.toggle("is-copied", local >= 2);
        cursor(1500, 795);
        break;
      }
      case "agent":
      case "improve": {
        show("#review", 0);
        show("#workflow", 1);
        const improving = spec.kind === "improve";
        const p = fade(local, 0, 0.7);
        move("#workflow", 0, 0, 0.97 + 0.03 * enter);
        $(".website-window").style.zIndex = improving ? "5" : "2";
        $(".coding-window").style.zIndex = improving ? "2" : "5";
        move(
          ".website-window",
          improving ? 0 : -60 * p,
          improving ? -15 : 0,
          improving ? 1 : 0.96,
        );
        move(
          ".coding-window",
          improving ? 20 : 0,
          improving ? 15 : -20 * p,
          improving ? 0.95 : 1,
        );
        $(".coding-window").style.filter = improving
          ? "brightness(.84)"
          : "none";
        show(".coding-user", improving ? 1 : fade(local, 0.8));
        move(".coding-user", 0, improving ? 0 : 20 * (1 - fade(local, 0.8)));
        show(".coding-response", improving ? 1 : fade(local, 2));
        move(".coding-response");
        show(".coding-result", improving ? 1 : fade(local, 3));
        $(".coding-response p").style.clipPath =
          `inset(0 ${improving ? 0 : 100 * (1 - fade(local, 2, 1))}% 0 0)`;
        const better = improving ? fade(local, 1, 1) : 0;
        $(".abstract-hero").style.gap = `${13 + 25 * better}px`;
        $(".abstract-cta").style.background =
          improving && local >= 2 ? "#bfa3ee" : "#e6deef";
        $(".abstract-cta").style.transform = `scaleX(${1 + 0.22 * better})`;
        show(".window-complete", improving ? fade(local, 3) : 0);
        move(".window-complete");
        break;
      }
      case "done": {
        $(".hero-studio-heading").style.gap = "36px";
        $(".hero-studio-button").style.background = "#bfa3ee";
        $(".hero-studio-button").style.width = "205px";
        const p = fade(local, 1, 0.65);
        show("#card-one", 1 - p);
        show("#card-two", 1 - fade(local, 2, 0.65));
        move("#card-one", 0, -40 * p, 1 - 0.09 * p);
        move("#card-two", 0, -40 * fade(local, 2), 1 - 0.09 * fade(local, 2));
        show("#resolved", fade(local, 2.5));
        move("#resolved", 0, 0, 0.94 + 0.06 * pop((local - 2.5) / 0.7));
        break;
      }
    }
  }
  lastScene = index;
  // Seek the site's exact logo keyframes against the beat clock, never a parallel timer.
  for (const a of document.getAnimations()) {
    a.pause();
    a.currentTime = Math.max(0, local) * 700;
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
  window.filmTime = secondsAt(beat);
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
