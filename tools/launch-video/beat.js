/* A single musical clock drives every cut and every gesture. No looping product demos. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const TOTAL = 64;
const beats = [
  { kind: "logo" },
  { kind: "comment" },
  { kind: "reply" },
  { title: "Right. There." },
  { kind: "expand" },
  { kind: "snap-left" },
  { kind: "snap-right" },
  { title: "Make yourself at home." },
  { kind: "sidebar" },
  { kind: "copy" },
  { title: "Your agent. Your code." },
  { kind: "agent" },
  { kind: "improve" },
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

$(".coding-user p").textContent = "Make the button lavender.";
$(".coding-response p").textContent = "Updated the button styles.";
$(".abstract-headline").textContent = "";
$(".abstract-headline.short").textContent = "";
$("#resolved").setAttribute("aria-label", "Feedback verified and resolved");
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
  const spring = (at = 0, d = 0.8) =>
    reduced.matches ? 1 : pop((local - at) / d);
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
    show("#review", 1);
    move("#review");
    for (const s of [
      ".review-scene",
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
    $("#film").dataset.focus = spec.kind;
    // A real 16:9 desktop, cropped by the camera. It never fits inside the stage.
    const desktop = (x = -180, y = -60, scale = 1.55) => {
      show(".review-scene", 1);
      move(".review-scene", x, y, scale);
    };
    const card = (reply = false) => {
      show("#card-one", reply ? 1 : fade(local, 0, 0.6));
      move(
        "#card-one",
        0,
        (reply ? 125 * (1 - fade(local, 1.1, 0.8)) : 125) + 24 * (1 - spring()),
        reply ? 1 : 0.96 + 0.04 * spring(),
      );
      show("#reaction", reply ? fade(local, 0.4) : 0);
      show(".fixture-reply", reply ? fade(local, 1.1) : 0);
      $("#card-one .fixture-card").style.height = reply
        ? `${mix(250, 500, fade(local, 1.1, 0.8))}px`
        : "250px";
      move("#reaction", 0, 0, 0.94 + 0.06 * spring(0.4, 0.5));
      move(".fixture-reply", 0, 18 * (1 - fade(local, 1.1)), 1);
    };
    typeText(
      "#card-one .agent-message p",
      "Make the button lavender.",
      spec.kind === "comment" ? (local - 0.45) / 2.1 : 1,
    );
    typeText(
      ".fixture-reply p",
      "On it. Sending to my agent.",
      spec.kind === "reply" ? (local - 1.35) / 1.7 : 1,
    );
    if (spec.kind === "comment") {
      desktop();
      $(".review-scene").style.opacity = ".24";
      card();
    }
    if (spec.kind === "reply") {
      card(true);
    }
    if (
      spec.kind === "expand" ||
      spec.kind === "snap-left" ||
      spec.kind === "snap-right"
    ) {
      show("#drawer", fade(local, 0, 0.5));
      const expand = spec.kind === "expand";
      const edge =
        expand || local < 0.45
          ? "bottom"
          : spec.kind === "snap-left"
            ? "left"
            : "right";
      window.launchDrawer.update(
        edge,
        expand && local >= 0.6 && local < 3.2,
        true,
      );
    } else {
      window.launchDrawer.update("bottom", false, false);
    }
    if (spec.kind === "sidebar" || spec.kind === "copy") {
      show("#sidebar", spec.kind === "copy" ? 1 : fade(local, 0, 0.7));
      const q = spec.kind === "copy" ? 1 : spring(0, 1.1);
      move("#sidebar", 70 * (1 - q), 0, 0.97 + 0.03 * q);
      $$("#sidebar .fixture-card").forEach((e, i) => {
        const p = spec.kind === "copy" ? 1 : fade(local, 0.3 + i * 0.4);
        e.style.opacity = p;
        e.style.transform = `translateY(${26 * (1 - p)}px)`;
      });
      $$("#sidebar .fixture-card p").forEach((e, i) =>
        typeText(
          e,
          ["Make the button lavender.", "Loosen the headline spacing."][i],
          spec.kind === "copy" ? 1 : (local - 0.5 - i * 0.45) / 1.6,
        ),
      );
      const copied = spec.kind === "copy" && local >= 1;
      $(".side-copy").classList.toggle("is-copied", copied);
      $(".side-copy svg").style.opacity = copied ? 0 : 1;
      $(".side-copy span").textContent = copied
        ? "Copied for your agent"
        : "Copy for agent";
      $(".side-copy").style.transform =
        `scale(${1 - 0.035 * (spec.kind === "copy" ? Math.exp(-Math.max(0, local - 1) * 9) : 0)})`;
    }
    if (spec.kind === "agent") {
      show("#workflow", 1);
      show(".website-window", 0);
      show(".coding-window", 1);
      move("#workflow");
      move(".coding-window", 0, 0, 1.45);
      $(".coding-window").style.filter = "none";
      show(".coding-user", fade(local, 0));
      typeText(
        ".coding-user p",
        "Make the button lavender.",
        (local - 0.25) / 1.1,
      );
      typeText(
        ".coding-response p",
        "Updated the button styles.",
        (local - 1.7) / 1.1,
      );
      show(".coding-response", fade(local, 1.5));
      show(".coding-result", fade(local, 2.8));
      move(".coding-user", 0, 20 * (1 - spring()));
      move(".coding-response");
      $(".coding-response p").style.clipPath = "none";
    }
    if (spec.kind === "improve") {
      desktop(-180 - 30 * (1 - fade(local, 0, 0.8)), -105, 1.65);
      $(".review-scene").style.opacity = fade(local, 0, 0.5);
      const p = fade(local, 1, 0.8);
      $(".hero-studio-heading").style.gap = `${mix(13, 40, p)}px`;
      $(".hero-studio-button").style.background =
        local >= 1 ? "#bfa3ee" : "#e6deef";
      $(".hero-studio-button").style.transform = `scale(${1 + 0.12 * p})`;
    } else {
      $(".hero-studio-heading").style.gap = "13px";
      $(".hero-studio-button").style.transform = "none";
      $(".hero-studio-button").style.background = "#e6deef";
    }
    if (spec.kind === "done") {
      card(true);
      const p = fade(local, 1.6, 0.6);
      show("#card-one", 1 - p);
      move("#card-one", 0, -35 * p, 1 - 0.04 * p);
      show("#resolved", fade(local, 1.85));
      move("#resolved", 0, 0, 0.94 + 0.06 * spring(1.85, 0.7));
    }
  }
  lastScene = index;
  for (const a of $("#intro").getAnimations({ subtree: true })) {
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
