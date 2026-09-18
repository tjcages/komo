/* Every visual state is a pure function of time. No polling, requests, randomness or live data. */
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const vertical =
  new URLSearchParams(location.search).get("format") === "vertical";
const film = $("#film");
film.classList.toggle("vertical", vertical);
const W = vertical ? 1080 : 1920,
  H = vertical ? 1920 : 1080;
function fit() {
  film.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`;
}
fit();
addEventListener("resize", fit);
$(".hero-site-nav i").textContent = "Studio";
$(".hero-site-nav span").textContent = "Work   /   About";
$(".hero-studio-heading").innerHTML = "Good ideas.<br>Room to grow.";
$(".hero-studio-copy").textContent = "A design studio for thoughtful brands.";
$(".hero-studio-button").textContent = "Let’s talk";
$(".abstract-site-nav i").textContent = "Studio";
const heads = $$(".abstract-headline");
heads[0].textContent = "Good ideas.";
heads[1].textContent = "Room to grow.";
$(".abstract-cta").textContent = "Let’s talk";
$(".browser-address").textContent = "studio.example";
$(".coding-user p").innerHTML =
  "Give the headline more room to breathe.<br>Make the primary button easier to find.";
$(".coding-response-title").innerHTML =
  '<span class="glyph">' +
  $(".coding-response-title svg").outerHTML +
  "</span>I’ll update the code.";
$(".coding-response p").textContent =
  "Increase the heading’s line height. Use lavender for the primary action.";
$(".coding-result").innerHTML = "✓ Spacing and button updated";
$(".coding-user p").insertAdjacentHTML(
  "beforebegin",
  "<div class=prompt-context>Studio / · h1 + primary action</div>",
);
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => 1 - Math.pow(1 - clamp(n), 3);
const range = (t, a, b) => ease((t - a) / (b - a));
function show(s, v) {
  $(s).style.opacity = clamp(v);
  $(s).style.visibility = v > 0 ? "visible" : "hidden";
}
const chapters = [
  [0, "", "", "Website feedback, right where it belongs."],
  [
    3,
    "01 / POINT",
    "Point. Comment. Keep the context.",
    "Leave feedback on the exact part of the page.",
  ],
  [
    10,
    "02 / DISCUSS",
    "A conversation, in context.",
    "Reply and react before handing off the work.",
  ],
  [
    15,
    "03 / GATHER",
    "Two comments. One clear handoff.",
    "Move the drawer. Open the sidebar. Copy the feedback.",
  ],
  [
    20,
    "04 / HAND OFF",
    "Your agent takes it from here.",
    "Paste the context into your coding agent.",
  ],
  [
    26,
    "05 / IMPROVE",
    "Specific feedback. Visible changes.",
    "The agent edits the code. You verify the result.",
  ],
  [
    32,
    "06 / RESOLVE",
    "Checked. Replied. Resolved.",
    "Resolve the feedback after verifying both changes.",
  ],
  [35, "", "", "Install komo. Get your project key. Start reviewing."],
];
window.seek = function (t) {
  t = Math.max(0, Math.min(42, t));
  const intro = 1 - range(t, 2.65, 3.1),
    outro = range(t, 34.8, 35.3),
    story = range(t, 2.65, 3.1) * (1 - outro);
  show("#intro", intro);
  show("#story", story);
  show("#outro", outro);
  $("#intro").style.transform = `translateY(${-15 * range(t, 2.65, 3.1)}px)`;
  $("#outro").style.transform = `translateY(${20 * (1 - outro)}px)`;
  const chapter = chapters.filter((c) => t >= c[0]).at(-1);
  $("#chapter-number").textContent = chapter[1];
  $("#headline").textContent = chapter[2];
  $("#caption").textContent = chapter[3];
  const flow = range(t, 19.6, 20.1) * (1 - range(t, 29.5, 30));
  show("#workflow", flow);
  show("#review", 1 - flow);
  const second = t >= 7.3 && t < 10;
  film.classList.toggle("second-target", second);
  $(".pin-design").textContent = second ? "R" : "D";
  $("#cursor span").textContent = second
    ? "Reviewer"
    : t >= 10
      ? "Engineer"
      : "Designer";
  const one = range(t, 4.1, 4.45) * (1 - range(t, 14.8, 15.2));
  show("#card-one", one);
  show("#card-two", range(t, 7.7, 8.05) * (1 - range(t, 10, 10.4)));
  $("#card-one").style.transform = `translateY(${12 * (1 - one)}px)`;
  show("#reaction", range(t, 10.2, 10.5));
  show(".fixture-reply", range(t, 11.7, 12.1));
  show(".scene-target", range(t, 3.4, 3.8) * (1 - range(t, 14, 14.4)));
  show(".pin-design", range(t, 4.1, 4.4) * (1 - range(t, 32.8, 33.1)));
  const side = range(t, 16, 16.5) * (1 - range(t, 19.6, 20.1));
  show("#sidebar", side);
  $("#sidebar").style.transform =
    `translate${vertical ? "Y" : "X"}(${(1 - side) * 90}px)`;
  const copied = t >= 18.3;
  $(".side-copy span").textContent = copied
    ? "Copied ✓"
    : "Copy all comments for agent";
  const dock = range(t, 3, 3.5) * (1 - range(t, 17, 17.4));
  show("#drawer", dock);
  const drag = range(t, 14.5, 15.6);
  $("#drawer").style.translate = vertical
    ? `${-170 * drag}px ${-50 * drag}px`
    : `${-460 * drag}px ${-170 * drag}px`;
  const improvement = range(t, 27.2, 28.4);
  $(".hero-studio-heading").style.lineHeight = String(
    0.98 + improvement * 0.28,
  );
  $(".hero-studio-button").style.background =
    `rgb(${235 - improvement * 35},${229 - improvement * 48},${244})`;
  $(".hero-studio-button").style.color = t >= 27.2 ? "#4b365f" : "#756784";
  $(".hero-studio-button").style.width =
    `${(vertical ? 180 : 150) + improvement * 35}px`;
  $(".abstract-hero").style.gap = `${10 + improvement * 15}px`;
  $(".abstract-cta").style.background = t >= 27.2 ? "#c8b5f4" : "#e8e0f2";
  const focus = range(t, 20.3, 21),
    back = range(t, 26.2, 27);
  $(".website-window").style.zIndex = back > 0.5 ? "5" : "2";
  $(".coding-window").style.zIndex = back > 0.5 ? "2" : "5";
  $(".website-window").style.transform =
    `translate(${vertical ? 0 : -15 * focus * (1 - back)}px,${-10 * back}px) scale(${1 - 0.025 * focus * (1 - back)})`;
  $(".coding-window").style.transform =
    `translateY(${-18 * focus * (1 - back)}px) scale(${1 - 0.03 * back})`;
  $(".coding-window").style.filter = `brightness(${1 - 0.15 * back})`;
  $(".coding-user").style.opacity = range(t, 21, 21.4);
  $(".coding-user").style.transform = "none";
  $(".coding-response").style.opacity = range(t, 23.2, 23.6);
  $(".coding-response").style.transform = "none";
  $(".coding-result").style.opacity = range(t, 26, 26.4);
  $(".window-complete").style.opacity = range(t, 28, 28.4);
  $(".window-complete").style.transform = "none";
  const verify = range(t, 30.1, 30.5) * (1 - range(t, 32.5, 32.9));
  if (t >= 29.5) {
    show("#card-one", verify);
    $("#card-one .agent-meta strong").textContent = "Engineer";
    $("#card-one .agent-message p").textContent =
      "Updated the spacing and button. Checked both changes.";
    show("#reaction", 0);
    show(".fixture-reply", 0);
  } else {
    $("#card-one .agent-meta strong").textContent = "Designer";
    $("#card-one .agent-message p").textContent =
      "Give the headline more room to breathe.".slice(
        0,
        Math.floor(clamp((t - 4.2) / 1.15) * 44),
      );
  }
  show("#resolved", range(t, 32.7, 33.1));
  // A continuous cursor route connects the review, drawer and copy actions.
  const path = vertical
    ? [
        [3, 780, 400],
        [4, 450, 520],
        [7.3, 260, 730],
        [10, 230, 1140],
        [12, 510, 1240],
        [14.4, 540, 940],
        [15.7, 360, 890],
        [17.7, 600, 1510],
        [19.5, 620, 1510],
      ]
    : [
        [3, 420, 380],
        [4, 720, 410],
        [7.3, 580, 620],
        [10, 1140, 590],
        [12, 1200, 620],
        [14.4, 900, 840],
        [15.7, 440, 670],
        [17.7, 1540, 820],
        [19.5, 1540, 820],
      ];
  const a = path.filter((p) => t >= p[0]).at(-1) || path[0],
    b = path.find((p) => p[0] > t) || a,
    q = a === b ? 0 : range(t, a[0], b[0]);
  $("#cursor").style.left = `${a[1] + (b[1] - a[1]) * q}px`;
  $("#cursor").style.top = `${a[2] + (b[2] - a[2]) * q - 160}px`;
  show("#cursor", range(t, 3, 3.3) * (1 - range(t, 19.2, 19.6)));
  $("#progress").style.width = `${(t / 42) * 100}%`;
  // Pause and explicitly seek the site's existing logo keyframes.
  for (const animation of document.getAnimations()) {
    animation.pause();
    const el = animation.effect?.target;
    const local = el?.closest("#outro") ? t - 35 : t;
    animation.currentTime = Math.max(0, local * 1000);
  }
  window.filmTime = t;
};
window.seek(0);
if (!new URLSearchParams(location.search).has("capture")) {
  let start;
  function tick(now) {
    start ??= now;
    window.seek(Math.min(42, (now - start) / 1000));
    if (window.filmTime < 42) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
