import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { spring as nativeSpring } from "motion-dom";
import { move, ramp, pop } from "./motion";
import { ZOOM } from "./camera";
import { Cursor } from "./cursors";
import { validateReadingHold } from "./text";
import type { Scene } from "./scenes";
import native from "./native.json";
import edit from "./edit.json";
import extra from "./extra.json";

const FPS = 30,
  BG = "#f6f4f9",
  INK = "#242128",
  LAV = "#bba2ee";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const html = (s: string) => ({ __html: s });
function Native({
  children,
  css = "",
  className = "",
}: {
  children: React.ReactNode;
  css?: string;
  className?: string;
}) {
  return (
    <div className={"native " + className} data-demo-drawer>
      <style>{native.css + BASE + css}</style>
      {children}
    </div>
  );
}
const BASE = `.native{font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;line-height:1.45;color:#232321;color-scheme:light;--accent:#bba2ee;--accent-ink:#161616;--sidebar-width:360px;--review-font-family:ui-sans-serif,system-ui,sans-serif;}.native *, .native *::before,.native *::after{animation:none!important;transition:none!important;caret-color:transparent!important;}.native .comment-menu-items{display:none!important}.native button{pointer-events:none}.native .pin{position:relative!important;inset:auto!important;transform:none!important;scale:1!important}.native .dialog{position:relative!important;inset:auto!important;width:340px!important;max-height:none!important;transform:none!important;visibility:visible!important;opacity:1!important}.native .messages{max-height:none!important;overflow:visible!important}.native .message{margin:0!important}.native .panel{position:relative!important;inset:auto!important;width:380px!important;height:400px!important;background:#202020!important;padding:20px!important;transform:none!important;visibility:visible!important;opacity:1!important;overflow:hidden!important;box-shadow:0 16px 45px #24112e18!important;border-radius:20px!important}.native .list{padding:0!important;overflow:hidden!important;mask-image:linear-gradient(black 80%,transparent)}.native .thread-card{position:relative!important;inset:auto!important;margin:0!important;width:100%!important;box-sizing:border-box!important}.native .morphing-menu{--mm-surface:#242424;--mm-ink:#eee;--mm-hover:#ffffff12;--mm-count:5;position:relative!important;width:268px!important;height:300px!important}.native .morphing-menu__shell{position:absolute!important;left:0!important;translate:none!important;top:0!important;bottom:auto!important;border-radius:24px;}.native .morphing-menu__panel{left:0!important;translate:none!important;width:268px!important;max-height:none!important}.native .morphing-menu__row{opacity:1!important;filter:none!important;transform:none!important}.native .morphing-menu__bar{left:0!important;translate:none!important;width:228px!important;bottom:0!important}.native .morphing-menu__shortcut{opacity:1!important}.native .composer textarea{height:36px!important}.native .dialog-head{outline:none!important}.native .toolbar{position:relative!important;inset:auto!important;transform:none!important;display:block!important;padding:0!important;background:none!important;width:268px!important;height:300px!important}.native .morphing-menu__row{background:transparent!important}.native .morphing-menu__row[data-menu-item="copy-prompts"]{background:var(--copy-hover,transparent)!important}`;
function Canvas({
  children,
  color = BG,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <AbsoluteFill
      style={{
        background: color,
        overflow: "hidden",
        color: INK,
        fontFamily: "Helvetica,Arial,sans-serif",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
function Center({
  children,
  scale = 1,
  y = 540,
  x = 960,
  opacity = 1,
}: {
  children: React.ReactNode;
  scale?: number;
  y?: number;
  x?: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%,-50%) scale(${scale})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
}
function Pointer({
  frame,
  at,
  start = 0,
  click = 20,
}: {
  frame: number;
  at: [number, number];
  start?: number;
  click?: number;
}) {
  const x = move(frame, [start, start + 18], [at[0] + 330, at[0]], "standard"),
    y = move(frame, [start + 2, start + 20], [at[1] + 200, at[1]], "arrive");
  const press =
    ramp(frame, [click, click + 2], "snap") *
    (1 - ramp(frame, [click + 3, click + 7], "arrive"));
  return (
    <div
      style={{
        opacity:
          ramp(frame, [start, start + 4]) *
          (1 - ramp(frame, [click + 10, click + 16])),
      }}
    >
      <Cursor kind="soft" size={76} x={x + 19} y={y + 21} press={press} />
    </div>
  );
}
function Pin({
  frame,
  delay,
  x,
  y,
  blue = false,
}: {
  frame: number;
  delay: number;
  x: number;
  y: number;
  blue?: boolean;
}) {
  const s = pop(frame, FPS, delay);
  return (
    <Center
      x={x}
      y={y}
      scale={2.8 * s}
      opacity={ramp(frame, [delay, delay + 4])}
    >
      <Native
        className={blue ? "blue-pin" : ""}
        css={
          ".native.blue-pin .pin,.native.blue-pin .pin .avatar{background:#9ec0de!important}"
        }
      >
        <div
          dangerouslySetInnerHTML={html(
            blue ? native.pin.replace(">M<", ">A<") : native.pin,
          )}
        />
      </Native>
    </Center>
  );
}
function Context() {
  const f = useCurrentFrame();
  return (
    <Canvas>
      <Center scale={1 + move(f, [0, 84], [0, 0.065])}>
        <div
          style={{
            whiteSpace: "nowrap",
            fontSize: 108,
            fontWeight: 550,
            letterSpacing: -6,
          }}
        >
          {["Leave", "feedback", "anywhere."].map((w, i) => (
            <span
              key={w}
              style={{
                opacity: ramp(f, [i * 3, i * 3 + 9], "arrive"),
                display: "inline-block",
                marginRight: 26,
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </Center>
      <Pin frame={f} delay={16} x={1470} y={370} />
      <Pin frame={f} delay={25} x={465} y={715} blue />
      <Pointer frame={f} start={31} click={54} at={[1470, 370]} />
    </Canvas>
  );
}
function Conversation() {
  const f = useCurrentFrame();
  const entry = spring({
    frame: f,
    fps: FPS,
    config: { stiffness: 600, damping: 34 },
  });
  return (
    <Canvas>
      <Center
        scale={ZOOM.CLOSE * (0.88 + 0.12 * entry) + move(f, [0, 90], [0, 0.08])}
        opacity={ramp(f, [0, 5]) * (1 - ramp(f, [57, 65]))}
      >
        <Native>
          <section className="dialog">
            <div dangerouslySetInnerHTML={html(native.commentHead)} />
            <div className="messages">
              {native.messages.map((m, i) => {
                const t = f - i * 17;
                const p = ramp(t, [0, 10], "arrive");
                return (
                  <div
                    key={i}
                    style={{
                      height: (i ? 73 : 76) * p,
                      opacity: p,
                      overflow: "visible",
                      transform: `scale(${0.98 + 0.02 * p})`,
                    }}
                    dangerouslySetInnerHTML={html(
                      m
                        .replace(
                          /(<button class="icon message-reaction")[\s\S]*?<\/button>/,
                          (button) =>
                            f < 39 + i * 5
                              ? button
                              : `<button class="icon message-reaction has-reactions"><span class="reaction-value" style="display:inline-block;transform:scale(${pop(f, FPS, 39 + i * 5)})">${["💜", "👍", "✨"][i]}</span></button>`,
                        )
                        .replace(
                          /(<p class="message-text">)([^<]*)(<\/p>)/,
                          (all, open, text, close) =>
                            open +
                            text.slice(
                              0,
                              Math.max(0, Math.floor((t - 2) * 3)),
                            ) +
                            close,
                        ),
                    )}
                  />
                );
              })}
            </div>
            <div dangerouslySetInnerHTML={html(native.composer)} />
          </section>
        </Native>
      </Center>
    </Canvas>
  );
}
function SidebarStage({ f }: { f: number }) {
  const open = interpolate(f, [2, 10], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.32, 0.72, 0, 1),
  });
  const zoom = move(f, [15, 31], [1, 2.05], "arrive");
  const x = move(f, [15, 31], [0, -2245], "arrive"),
    y = move(f, [15, 31], [0, 0], "arrive");
  const count = Math.min(8, Math.max(0, Math.floor((f - 27) / 4) + 1));
  const search = f >= 66,
    query = "contrast".slice(0, Math.max(0, Math.floor((f - 67) / 1.5)));
  return (
    <Canvas>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 130,
          width: 1700,
          height: 820,
          background: "#080808",
          borderRadius: 20,
          overflow: "hidden",
          opacity: ramp(f, [0, 5]),
          transform: `translate(${x}px,${y}px) scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#e6e5e8",
            borderRadius: 12 * open,
            transform: `translate(${-234 * open}px,${41 * open}px) scale(${1 - 0.1 * open})`,
            transformOrigin: "top left",
          }}
        >
          <Pin frame={f + 35} delay={0} x={450} y={250} />
          <Pin frame={f + 35} delay={0} x={1000} y={520} blue />
          <Pin frame={f + 35} delay={0} x={690} y={680} />
        </div>
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 36,
            width: 380,
            transform: `translateX(${404 * (1 - open)}px)`,
          }}
        >
          <Native
            className="review-open"
            css={`
              .native .panel {
                width: 380px !important;
                height: 720px !important;
                background: transparent !important;
                border-radius: 0 !important;
                padding: 0 24px !important;
                box-shadow: none !important;
              }
              .native .panel-head {
                padding: 0 0 16px !important;
              }
              .native .list {
                mask-image: linear-gradient(black 80%, transparent);
              }
              .native .sidebar-search {
                display: grid !important;
                grid-template-rows: ${ramp(f, [66, 72])}fr!important;
                opacity: ${ramp(f, [66, 72])}!important;
              }
              .native .sidebar-search-inner {
                overflow: hidden !important;
              }
            `}
          >
            <aside className="panel" data-search={search ? "true" : "false"}>
              <div
                dangerouslySetInnerHTML={html(
                  native.sidebarHead.replace(
                    '<input type="search"',
                    `<input value="${query}" type="search"`,
                  ),
                )}
              />
              <div className="list">
                {(query.length > 3
                  ? [native.rows.find((r) => r.includes("contrast"))!]
                  : [
                      ...native.rows.slice(0, count).reverse(),
                      ...native.rows.slice(8),
                    ]
                ).map((r, i) => {
                  const age = f - (27 + (count - i - 1) * 4);
                  const q =
                    query.length > 3 || i >= count
                      ? 1
                      : ramp(age, [0, 7], "arrive");
                  return (
                    <div
                      key={r}
                      style={{ height: 96 * q, opacity: q, overflow: "hidden" }}
                      dangerouslySetInnerHTML={html(r)}
                    />
                  );
                })}
              </div>
            </aside>
          </Native>
        </div>
      </div>
      {f >= 44 && <Pointer frame={f} start={44} click={65} at={[1206, 242]} />}
    </Canvas>
  );
}
function Sidebar() {
  return <SidebarStage f={useCurrentFrame()} />;
}
function Feed() {
  return <SidebarStage f={useCurrentFrame() + 24} />;
}
function DrawerBody({
  f,
  opened = false,
  copied = false,
}: {
  f: number;
  opened?: boolean;
  copied?: boolean;
}) {
  const collapse = ramp(f, [15, 25], "arrive"),
    horizontal = ramp(f, [30, 41], "arrive");
  const q = opened
    ? 1
    : nativeSpring({ keyframes: [0, 1], duration: 400, bounce: 0.24 }).next(
        Math.max(0, ((f - 54) / FPS) * 1000),
      ).value;
  const w = (52 + 176 * horizontal) * (1 - q) + 268 * q;
  const h = (52 + 176 * (1 - collapse)) * (1 - q) + 300 * q;
  return (
    <Native
      css={`
        .native .morphing-menu__shell {
          width: ${w}px!important;
          height: ${h}px!important;
          left: ${(268 - w) / 2}px!important;
          top: ${(300 - h) / 2}px!important;
          overflow: hidden !important;
        }
        .native .morphing-menu__panel {
          opacity: ${ramp(q, [0.2, 0.8])}!important;
        }
        .native .morphing-menu__bar {
          width: ${w}px!important;
          height: ${h}px!important;
          top: 0 !important;
          bottom: auto !important;
          opacity: ${1 - ramp(q, [0, 0.35])}!important;
          display: block !important;
        }
        .native .morphing-menu__shortcut {
          position: absolute !important;
          width: 44px !important;
          height: 44px !important;
          padding: 10px !important;
        }
      `}
    >
      <div className="toolbar">
        <nav className="morphing-menu">
          <div className="morphing-menu__shell">
            <div className="morphing-menu__bar">
              {extra.shortcuts.map((b, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 4 + i * 44 * horizontal,
                    top: 4 + i * 44 * (1 - collapse),
                    opacity: i ? Math.max(1 - collapse, horizontal) : 1,
                  }}
                  dangerouslySetInnerHTML={html(b)}
                />
              ))}
            </div>
            <div className="morphing-menu__panel">
              <div
                dangerouslySetInnerHTML={html(
                  copied
                    ? native.drawerPanel.replaceAll(
                        "Copy all comments for agent",
                        "Copied prompt",
                      )
                    : native.drawerPanel,
                )}
              />
            </div>
          </div>
        </nav>
      </div>
    </Native>
  );
}
function Drawer() {
  const f = useCurrentFrame();
  return (
    <Canvas>
      <Center
        scale={move(f, [64, 74], [2.2, 3.3], "arrive")}
        opacity={ramp(f, [0, 6])}
      >
        <DrawerBody f={f} />
      </Center>
      <Pointer frame={f} start={31} click={53} at={[1154, 540]} />
    </Canvas>
  );
}
function Copy() {
  const f = useCurrentFrame();
  return (
    <Canvas>
      <Center scale={3.3}>
        <DrawerBody f={90} opened copied={f >= 11} />
      </Center>
      <style>{`.native{--copy-hover:${f >= 4 ? "#ffffff12" : "transparent"}}`}</style>
      <Pointer frame={f} start={-10} click={11} at={[1010, 685]} />
    </Canvas>
  );
}
function Agent() {
  const f = useCurrentFrame(),
    paste = f >= 16,
    sent = f >= 43;
  const send = ramp(f, [25, 40], "arrive");
  const px = 700 + 911 * send,
    py = 450 + 264 * send;
  return (
    <Canvas>
      <Center opacity={ramp(f, [0, 6]) * (1 - ramp(f, [55, 60]))}>
        <div style={{ width: 1420, height: 460, position: "relative" }}>
          {sent && (
            <div
              style={{
                position: "absolute",
                right: 20,
                top: 0,
                width: 1000,
                height: 260,
                background: "#e8e6eb",
                borderRadius: 32,
                padding: 32,
                boxSizing: "border-box",
                overflow: "hidden",
                opacity: ramp(f, [43, 47]),
                fontSize: 24,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                maskImage: "linear-gradient(black 80%, transparent)",
              }}
            >
              {extra.prompt}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              width: 1420,
              height: move(f, [43, 48], [460, 130], "arrive"),
              background: "#fff",
              border: "1px solid #dcd9e0",
              borderRadius: 38,
              boxShadow: "0 20px 80px #24112e10",
              padding: 38,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                height: sent ? 35 : 308,
                overflow: "hidden",
                fontSize: 26,
                lineHeight: 1.48,
                whiteSpace: "pre-wrap",
                maskImage: "linear-gradient(black 80%, transparent)",
                color: paste && !sent ? INK : "#99949e",
              }}
            >
              {paste && !sent ? extra.prompt : "Ask your agent…"}
            </div>
            <span
              style={{
                position: "absolute",
                bottom: 25,
                left: 38,
                fontSize: 40,
              }}
            >
              +
            </span>
            <div
              style={{
                position: "absolute",
                right: 28,
                bottom: 25,
                width: 62,
                height: 62,
                borderRadius: 50,
                background: INK,
                color: "white",
                fontSize: 43,
                lineHeight: "58px",
                textAlign: "center",
                transform: `scale(${f === 43 ? 0.85 : 1})`,
              }}
            >
              ↑
            </div>
          </div>
        </div>
      </Center>
      <div style={{ opacity: ramp(f, [1, 6]) * (1 - ramp(f, [47, 51])) }}>
        <Cursor
          kind="soft"
          size={76}
          x={px + 19}
          y={py + 21}
          press={f === 14 || f === 43 ? 1 : 0}
        />
      </div>
    </Canvas>
  );
}
function Logo() {
  const f = useCurrentFrame(),
    fade = 1 - ramp(f, [41, 47]);
  const k = (t: number, values: number[], points = [0, 22, 43, 64, 83, 100]) =>
    interpolate(
      t,
      points.map((n) => n * 0.315),
      values,
      { ...clamp, easing: Easing.bezier(0.4, 0, 0.2, 1) },
    );
  const sp = [0, 22, 43, 64, 77, 90, 100];
  return (
    <Canvas>
      <Center scale={2.8} opacity={fade}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 89,
              height: 89,
              opacity: k(f, [0, 1, 1, 1, 1, 1, 1], sp),
              transformOrigin: "50% 84%",
              transform: `translateY(${k(f, [35, 22, 7, 21, 14, 17, 17], sp)}%) rotate(${k(f, [-4, -2, 2, -0.8, 0.3, -0.1, 0], sp)}deg) scale(${k(f, [0.75, 1.08, 1.04, 1.035, 0.995, 1.002, 1], sp)},${k(f, [0.68, 0.9, 1.13, 0.97, 1.02, 0.999, 1], sp)})`,
            }}
            dangerouslySetInnerHTML={html(extra.symbol)}
          />
          <svg viewBox="-14 -30 319 150" width={319} height={150} fill={INK}>
            <g dangerouslySetInnerHTML={html(native.logoDefs)} />
            {native.letters.map((s, i) => {
              const t = f - 1.8 - i * 1.95;
              return (
                <g
                  key={i}
                  style={{
                    opacity: k(t, [0, 1, 1, 1, 1, 1]),
                    transformOrigin: `${[30, 87, 172, 258][i]}px 89px`,
                    transform: `translateY(${k(t, [20, 3, -7, 1, -0.5, 0])}px) rotate(${k(t, [-5, -2, 2, -0.8, 0.3, 0])}deg) scale(${k(t, [0.72, 1.1, 1.045, 1.045, 0.995, 1])},${k(t, [0.6, 0.88, 1.16, 0.965, 1.02, 1])})`,
                    stroke: INK,
                    strokeWidth: k(t, [0, 2, 6, 2, 0, 0]),
                    strokeLinejoin: "round",
                  }}
                  dangerouslySetInnerHTML={html(s)}
                />
              );
            })}
          </svg>
        </div>
      </Center>
    </Canvas>
  );
}
export const PARTS = [
  "pins",
  "conversation",
  "sidebar",
  "drawer",
  "copy",
  "agent",
  "logo",
];
const defs = [
  ["context", Context, 66, "context", "PUSH", "pins", "entrance"],
  [
    "conversation",
    Conversation,
    66,
    "tension",
    "CLOSE",
    "conversation",
    "reveal",
  ],
  ["sidebar", Sidebar, 24, "action", "PUSH", "sidebar", "reveal"],
  ["feed", Feed, 60, "action", "CLOSE", "sidebar", "reveal"],
  ["drawer", Drawer, 75, "action", "CLOSE", "drawer", "interaction"],
  ["copy", Copy, 21, "action", "MACRO", "copy", "interaction"],
  ["agent", Agent, 60, "consequence", "CLOSE", "agent", "interaction"],
  ["logo", Logo, 48, "consequence", "PUSH", "logo", "entrance"],
] as const;
export const SCENES: Scene[] = defs.map(
  ([id, component, length, beat, tier, subject, activity]) => ({
    id,
    component,
    duration: length + 24,
    beat,
    tier,
    subject,
    activity,
    covers: [subject],
    motion: { from: 0, to: length + 20, tag: "push-in" },
  }),
);
validateReadingHold("context", "Leave feedback anywhere.", 66);
export function Film() {
  let offset = 0;
  return (
    <AbsoluteFill>
      {edit.cuts.map((c) => {
        const s = SCENES.find((s) => s.id === c.scene)!;
        const from = offset;
        offset += c.out - c.in;
        return (
          <Sequence key={s.id} from={from} durationInFrames={c.out - c.in}>
            <Sequence from={-c.in}>
              <s.component />
            </Sequence>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
