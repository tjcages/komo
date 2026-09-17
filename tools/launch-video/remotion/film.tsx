import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  spring,
  interpolate,
} from "remotion";
import { spring as nativeSpring } from "motion-dom";
import { move, ramp, pop } from "./motion";
import { ZOOM } from "./camera";
import { Cursor } from "./cursors";
import { validateReadingHold } from "./text";
import type { Scene } from "./scenes";
import native from "./native.json";
import edit from "./edit.json";

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
        opacity={ramp(f, [0, 5])}
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
                      overflow: "hidden",
                      transform: `scale(${0.98 + 0.02 * p})`,
                    }}
                    dangerouslySetInnerHTML={html(
                      m.replace(
                        /(<div class="message-text">)([^<]*)(<\/div>)/,
                        (all, open, text, close) =>
                          open +
                          text.slice(0, Math.max(0, Math.floor((t - 2) * 3))) +
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
      <div
        style={{
          position: "absolute",
          left: 1265,
          top: 370,
          transform: `scale(${pop(f, FPS, 43)})`,
          opacity: ramp(f, [43, 47]),
          fontSize: 58,
        }}
      >
        💜
      </div>
    </Canvas>
  );
}
function Sidebar() {
  const f = useCurrentFrame();
  const p = spring({
    frame: f,
    fps: FPS,
    config: { stiffness: 260, damping: 26, mass: 0.45 },
  });
  const count = Math.min(8, Math.max(0, Math.floor((f - 10) / 6) + 1));
  return (
    <Canvas>
      <Center
        scale={ZOOM.CLOSE}
        x={960 + move(f, [0, 26], [120, 0], "arrive")}
        opacity={ramp(f, [0, 5])}
      >
        <Native className="review-open">
          <aside
            className="panel"
            style={{ clipPath: `inset(0 ${100 * (1 - p)}% 0 0 round 20px)` }}
          >
            <div dangerouslySetInnerHTML={html(native.sidebarHead)} />
            <div className="list">
              {Array.from({ length: count }, (_, i) => {
                const n = count - i - 1;
                const age = f - (10 + n * 6);
                const q = ramp(age, [0, 8], "arrive");
                return (
                  <div
                    key={n}
                    style={{ height: 90 * q, opacity: q, overflow: "hidden" }}
                    dangerouslySetInnerHTML={html(native.rows[n])}
                  />
                );
              })}
              {native.rows.slice(8).map((m, i) => (
                <div
                  key={"old" + i}
                  style={{ height: 90, overflow: "hidden" }}
                  dangerouslySetInnerHTML={html(m)}
                />
              ))}
            </div>
          </aside>
        </Native>
      </Center>
      {["💜", "👍", "✨"].map((e, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 1330 + i * 45,
            top: 590 - move(f, [34 + i * 5, 58 + i * 5], [0, 150], "arrive"),
            opacity:
              ramp(f, [34 + i * 5, 38 + i * 5]) *
              (1 - ramp(f, [54 + i * 5, 64 + i * 5])),
            fontSize: 48,
            transform: `scale(${pop(f, FPS, 34 + i * 5)})`,
          }}
        >
          {e}
        </div>
      ))}
    </Canvas>
  );
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
  const q = opened
    ? 1
    : nativeSpring({ keyframes: [0, 1], duration: 400, bounce: 0.24 }).next(
        Math.max(0, ((f - 12) / FPS) * 1000),
      ).value;
  const compress = opened
    ? 1
    : 1 - 0.12 * ramp(f, [8, 11]) * (1 - ramp(f, [12, 16]));
  const w = 228 + (268 - 228) * q,
    h = 52 + (300 - 52) * q;
  return (
    <Native
      css={`
        .native .morphing-menu__shell {
          width: ${w}px!important;
          height: ${h * compress}px!important;
          left: ${(268 - w) / 2}px!important;
          top: ${(300 - h) / 2}px!important;
          border-radius: ${26 - 2 * q}px!important;
        }
        .native .morphing-menu__panel {
          opacity: ${q}!important;
        }
        .native .morphing-menu__bar {
          opacity: ${1 - q}!important;
        }
      `}
    >
      <div className="toolbar">
        <nav className="morphing-menu">
          <div className="morphing-menu__shell">
            <div
              className="morphing-menu__bar"
              dangerouslySetInnerHTML={html(
                native.bar.replace(/^<div[^>]*>|<\/div>$/g, ""),
              )}
            />
            <div className="morphing-menu__panel">
              {
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
              }
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
    <Canvas color="#e9e0f6">
      <Center
        scale={ZOOM.CLOSE + move(f, [0, 80], [0, 0.1])}
        opacity={ramp(f, [0, 5])}
      >
        <DrawerBody f={f} />
      </Center>
      <Pointer frame={f} start={0} click={11} at={[1165, 540]} />
    </Canvas>
  );
}
function Copy() {
  const f = useCurrentFrame();
  return (
    <Canvas color="#e9e0f6">
      <Center scale={ZOOM.MACRO} y={540}>
        <DrawerBody f={90} opened copied={f >= 22} />
      </Center>
      <style>{`.native{--copy-hover:${f >= 8 ? "#ffffff12" : "transparent"}}`}</style>
      <Pointer frame={f} click={22} at={[1010, 685]} />
    </Canvas>
  );
}
function Agent() {
  const f = useCurrentFrame();
  const p = ramp(f, [20, 30], "arrive");
  return (
    <Canvas>
      <Center scale={1 + move(f, [0, 75], [0, 0.05])} opacity={ramp(f, [0, 7])}>
        <div
          style={{
            width: 1120,
            height: 130 + 150 * p,
            background: "#242128",
            color: "#f6f4f9",
            borderRadius: 38,
            boxShadow: "0 24px 70px #25183620",
            padding: "42px 50px",
            boxSizing: "border-box",
            overflow: "hidden",
            fontSize: 32,
            border: "2px solid #ffffff22",
          }}
        >
          {f < 22 ? (
            <span style={{ color: "#9f96ac" }}>Ask your agent…</span>
          ) : (
            <>
              <div style={{ fontSize: 19, color: LAV, marginBottom: 18 }}>
                12 COMMENTS · WITH CONTEXT
              </div>
              <div style={{ lineHeight: 1.5, fontSize: 26 }}>
                Love this direction.
                <br />
                Can we try lavender here?
                <br />A little more contrast?
              </div>
            </>
          )}
          <div
            style={{
              position: "absolute",
              right: 28,
              bottom: 25,
              width: 48,
              height: 48,
              borderRadius: 50,
              background: LAV,
              color: INK,
              textAlign: "center",
              lineHeight: "48px",
            }}
          >
            ↑
          </div>
        </div>
      </Center>
      <Pointer frame={f} start={0} click={18} at={[700, 510]} />
    </Canvas>
  );
}
function Logo() {
  const f = useCurrentFrame();
  const fade = 1 - ramp(f, [65, 75]);
  return (
    <Canvas color="#e9e0f6">
      <Center scale={2.6 + move(f, [0, 95], [0, 0.12])} opacity={fade}>
        <svg viewBox="-14 -30 319 150" width={319} height={150} fill={INK}>
          <g dangerouslySetInnerHTML={html(native.logoDefs)} />
          {native.letters.map((s, i) => {
            const t = f - i * 2;
            const q = pop(t, FPS);
            return (
              <g
                key={i}
                style={{
                  opacity: ramp(t, [0, 8]),
                  transform: `translateY(${interpolate(t, [0, 6, 13, 20, 30], [5, 2, -5, 1, 0], clamp)}px) scale(1,${0.88 + 0.12 * q})`,
                  transformOrigin: `${[30, 87, 172, 258][i]}px 89px`,
                }}
                dangerouslySetInnerHTML={html(s)}
              />
            );
          })}
        </svg>
      </Center>
      <div
        style={{
          position: "absolute",
          top: 735,
          width: "100%",
          textAlign: "center",
          fontSize: 30,
          letterSpacing: -0.8,
          opacity: ramp(f, [15, 24]) * fade,
        }}
      >
        komo.offbr.co
      </div>
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
  ["sidebar", Sidebar, 63, "action", "CLOSE", "sidebar", "reveal"],
  ["drawer", Drawer, 60, "action", "CLOSE", "drawer", "interaction"],
  ["copy", Copy, 36, "action", "MACRO", "copy", "interaction"],
  ["agent", Agent, 54, "consequence", "CLOSE", "agent", "interaction"],
  ["logo", Logo, 75, "consequence", "PUSH", "logo", "entrance"],
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
