import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PANEL_CSS,
  PanelThemeProvider,
  ControlSection,
  ControlSlider,
  ControlAction,
  ControlActionGroup,
  ControlToggle,
  ControlSelect,
  ControlReadout,
  ControlTextInput,
  ControlSearchField,
} from "@tjcages/panels/dev";

const $ = (id) => document.getElementById(id);
const click = (id) => $(id).click();
const value = (id) => Number($(id).value);
function setValue(id, next, event = "input") {
  const input = $(id);
  if (input.type === "checkbox") input.checked = next;
  else input.value = next;
  input.dispatchEvent(new Event(event, { bubbles: true }));
  window.dispatchEvent(new Event("editor-change"));
}
// Keep the media engine's DOM islands stable; React owns only the workspace.
function Island({ node, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    ref.current.appendChild(node);
    return () => {
      $("engineHost").appendChild(node);
    };
  }, [node]);
  return <div className={className} ref={ref} />;
}
function Icon({ name }) {
  const paths = {
    minus: "M4 8h8",
    plus: "M4 8h8M8 4v8",
    chevron: "m5 6 3 3 3-3",
    film: "M3 3h10v10H3zM3 6h10M6 3v3M10 3v3",
    sliders: "M3 5h10M3 11h10M6 3v4M10 9v4",
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function mountEditor({ effects, getDuration }) {
  const islands = {
    stage: document.querySelector(".stage"),
    timeline: document.querySelector(".timeline-grid"),
    transport: document.querySelector(".playback"),
    clock: $("clock"),
    actions: document.querySelector(".header-actions"),
    footer: document.querySelector("footer"),
    waveform: document.querySelector(".excerpt"),
    cues: $("cueList"),
    dialog: $("exportHelp"),
  };
  document.body.appendChild(islands.dialog);
  $("export").textContent = "Export MP4";
  $("save").textContent = "Save mix";
  function App() {
    const [, redraw] = useState(0);
    const [track, setTrack] = useState("music"),
      [expanded, setExpanded] = useState(true);
    const [zoom, setZoom] = useState(1),
      [search, setSearch] = useState("");
    useEffect(() => {
      let frame;
      const update = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => redraw((n) => n + 1));
      };
      const select = (e) => {
        setTrack(e.detail);
        update();
      };
      window.addEventListener("editor-change", update);
      window.addEventListener("editor-track", select);
      update();
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("editor-change", update);
        window.removeEventListener("editor-track", select);
      };
    }, []);
    const cue = effects.selected();
    const music = $("songName").textContent;
    const hasMusic = !$("controls").disabled;
    const slider = (label, id, min, max, step = 0.05, event = "input") => (
      <ControlSlider
        label={label}
        value={value(id)}
        min={min}
        max={max}
        step={step}
        onChange={(v) => setValue(id, v, event)}
      />
    );
    const speed = (id) => (
      <>
        {slider("Speed", id, 0.5, 2)}
        <ControlActionGroup>
          {[0.5, 1, 1.5, 2].map((v) => (
            <ControlAction
              key={v}
              label={`${v}×`}
              onClick={() => setValue(id, v)}
              variant={value(id) === v ? "primary" : "default"}
            />
          ))}
        </ControlActionGroup>
        <p className="panel-note">
          Speed changes pitch. Picture timing stays fixed.
        </p>
      </>
    );
    return (
      <PanelThemeProvider value="light">
        <header className="studio-header">
          <div className="studio-title">
            <Icon name="film" />
            <strong>komo</strong>
            <span className="header-separator" />
            <span>Launch film</span>
            <span className="project-type">Video editor</span>
          </div>
          <Island node={islands.actions} />
        </header>
        <style>{PANEL_CSS}</style>
        <div className="studio-shell">
          <div
            className="canvas-workspace"
            style={{
              "--preview-zoom": zoom,
            }}
          >
            <div className="canvas-area">
              <div className="canvas-caption">
                LAUNCH FILM <span>1920 × 1080</span>
              </div>
              <Island node={islands.stage} className="preview-host" />
              <div className="canvas-tools">
                <button
                  aria-label="Zoom out"
                  onClick={() => setZoom((v) => Math.max(0.25, v - 0.1))}
                >
                  <Icon name="minus" />
                </button>
                <button onClick={() => setZoom(1)} title="Fit preview">
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  aria-label="Zoom in"
                  onClick={() => setZoom((v) => Math.min(2, v + 0.1))}
                >
                  <Icon name="plus" />
                </button>
              </div>
            </div>
            <section
              className={`editor-timeline ${expanded ? "expanded" : ""}`}
              aria-label="Editing timeline"
            >
              <button
                className="timeline-tab"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                <Icon name="chevron" />
                Timeline<span>{effects.fields().effects.length}</span>
              </button>
              <div className="timeline-content" hidden={!expanded}>
                <div className="timeline-toolbar">
                  <Island node={islands.transport} />
                  <Island node={islands.clock} />
                  <span>30 fps</span>
                </div>
                <Island node={islands.timeline} />
                <div className="timeline-bottom">
                  <span>Click a scene to seek · select a cue to edit</span>
                  <span>Space to play</span>
                </div>
              </div>
            </section>
          </div>
          <aside
            className="studio-sidebar"
            aria-label="Editor sidebar"
            data-panel=""
            data-panel-theme="light"
          >
            <h2 className="sidebar-heading">Project</h2>
            <div className="sidebar-content">
              <ControlSection title="Media">
                <ControlReadout label="Video" value="Launch film" />
                <ControlReadout
                  label="Duration"
                  value={`${getDuration().toFixed(2)} s · 30 fps`}
                />
                <ControlActionGroup>
                  <ControlAction
                    label="Replace video"
                    onClick={() => click("videoFile")}
                  />
                  <ControlAction
                    label="Add music"
                    onClick={() => click("songFile")}
                  />
                </ControlActionGroup>
                <ControlAction
                  label="Try demo music"
                  onClick={() => click("demo")}
                />
              </ControlSection>
              <div
                className="inspector-switch"
                role="tablist"
                aria-label="Track properties"
              >
                {["music", "effects"].map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={track === t}
                    onClick={() => setTrack(t)}
                  >
                    {t === "music" ? "Music" : "Effects"}
                  </button>
                ))}
              </div>
              {track === "music" ? (
                <>
                  <ControlSection title="Playback">
                    <ControlReadout
                      label="Source"
                      value={hasMusic ? music : "No music added"}
                    />
                    {speed("musicSpeed")}
                    {slider("Volume", "volume", 0, 1, 0.01)}
                    <ControlAction
                      label={hasMusic ? "Replace music" : "Choose audio file"}
                      onClick={() => click("songFile")}
                    />
                  </ControlSection>
                  <ControlSection title="Excerpt">
                    <Island node={islands.waveform} />
                    {slider("Fade in · s", "fadeIn", 0, 10, 0.1, "change")}
                    {slider("Fade out · s", "fadeOut", 0, 10, 0.1, "change")}
                  </ControlSection>
                  <ControlSection title="Beat alignment" defaultOpen={false}>
                    <p className="panel-note">{$("analysis").textContent}</p>
                    {slider("Source BPM", "bpm", 30, 300, 0.1, "change")}
                    {slider(
                      "First beat · s",
                      "firstBeat",
                      0,
                      Number($("firstBeat").max) || 10,
                      0.01,
                      "change",
                    )}
                    <ControlAction
                      label="Align to selected scene"
                      disabled={$("snap").disabled}
                      onClick={() => click("snap")}
                    />
                    <p className="panel-note">{$("tempo").textContent}</p>
                  </ControlSection>
                </>
              ) : (
                <>
                  <ControlSection title="Track">
                    <ControlToggle
                      label="Enabled"
                      value={$("effectsEnabled").checked}
                      onChange={(v) => setValue("effectsEnabled", v, "change")}
                    />
                    {slider("Volume", "effectsVolume", 0, 1, 0.01)}
                    {speed("effectsSpeed")}
                  </ControlSection>
                  <ControlSection title="Selected cue">
                    {cue ? (
                      <>
                        <ControlTextInput
                          label="Action"
                          value={cue.label}
                          onChange={(label) =>
                            effects.patchSelected({
                              label: label.slice(0, 120),
                            })
                          }
                        />
                        <ControlSelect
                          label="Sound"
                          value={cue.sound}
                          options={[
                            ...$("cueInspector").querySelector("select")
                              .options,
                          ].map((o) => ({ label: o.label, value: o.value }))}
                          onChange={(sound) => effects.patchSelected({ sound })}
                        />
                        <ControlSlider
                          label="Frame"
                          value={cue.frame}
                          min={0}
                          max={Math.max(0, Math.ceil(getDuration() * 30) - 1)}
                          step={1}
                          onChange={(frame) => effects.patchSelected({ frame })}
                        />
                        <ControlReadout
                          label="Time"
                          value={`${(cue.frame / 30).toFixed(2)} s`}
                        />
                        <ControlSlider
                          label="Volume"
                          value={cue.volume}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(volume) =>
                            effects.patchSelected({ volume })
                          }
                        />
                        <ControlActionGroup>
                          <ControlAction
                            label="Listen"
                            onClick={() =>
                              $("cueInspector").querySelector("button").click()
                            }
                          />
                          <ControlAction
                            label="Remove"
                            onClick={() =>
                              $("cueInspector")
                                .querySelectorAll("button")[1]
                                .click()
                            }
                          />
                        </ControlActionGroup>
                      </>
                    ) : (
                      <p className="panel-note">
                        Select a cue on the timeline or in the project panel.
                      </p>
                    )}
                  </ControlSection>
                  <ControlSection title="Cue sheet" defaultOpen={false}>
                    <ControlAction
                      label="Import cue sheet"
                      onClick={() => click("cueFile")}
                    />
                    <ControlAction
                      label="Restore scene cues"
                      onClick={() => click("restoreCues")}
                    />
                  </ControlSection>
                </>
              )}
              <div hidden={track !== "effects"}>
                <ControlSection title="Sound cues">
                  <ControlSearchField
                    label="Find"
                    placeholder="Clicks, comments…"
                    value={search}
                    onChange={(v) => {
                      setSearch(v);
                      setValue("cueSearch", v);
                    }}
                  />
                  <Island node={islands.cues} className="cue-browser" />
                  <ControlAction
                    label="Add sound at playhead"
                    onClick={() => click("addCue")}
                  />
                  <p className="panel-note">
                    Sound library by{" "}
                    <a
                      href="https://cuelume-site.pages.dev/"
                      target="_blank"
                      rel="noopener"
                    >
                      Cuelume
                    </a>
                  </p>
                </ControlSection>
              </div>
            </div>
          </aside>
        </div>
        <Island node={islands.footer} className="studio-footer" />
      </PanelThemeProvider>
    );
  }
  createRoot($("panelRoot")).render(<App />);
}
