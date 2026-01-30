import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { Button, Panel, StatusPill } from "./components/ui";
import { healthCheck } from "./api/client";

const TOOL_CATEGORIES = [
  {
    title: "Tools",
    items: [
      { id: "select", label: "Select", hotkey: "V" },
      { id: "trim", label: "Trim", hotkey: "T" },
      { id: "split", label: "Split", hotkey: "S" },
      { id: "transition", label: "Transition", hotkey: "X" },
      { id: "text", label: "Text", hotkey: "A" },
    ],
  },
  {
    title: "FX / Color",
    items: [
      { id: "vhs", label: "VHS Glow", hotkey: "G" },
      { id: "scanlines", label: "Scanlines", hotkey: "L" },
      { id: "grain", label: "Film Grain", hotkey: "F" },
    ],
  },
];

const INITIAL_ASSETS = [
  { id: "a1", type: "video", name: "neon_streets.mp4", durationSec: 12.0 },
  { id: "a2", type: "video", name: "arcade_intro.mp4", durationSec: 7.5 },
  { id: "a3", type: "audio", name: "synth_loop.wav", durationSec: 18.0 },
  { id: "a4", type: "image", name: "pixel_logo.png", durationSec: 0.0 },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return `${mm}:${ss}`;
}

// PUBLIC_INTERFACE
function App() {
  /** Main video editor application shell (retro themed). */

  // --- Backend connectivity
  const [backendStatus, setBackendStatus] = useState({
    state: "idle", // idle | loading | ok | error
    message: "",
  });

  // --- Editor state
  const [activeToolId, setActiveToolId] = useState("select");
  const [assets, setAssets] = useState(INITIAL_ASSETS);

  const [timeline, setTimeline] = useState({
    fps: 30,
    zoom: 1,
    cursorSec: 0,
    clips: [
      { id: "c1", assetId: "a1", name: "neon_streets.mp4", startSec: 0, endSec: 8.0, track: 1 },
      { id: "c2", assetId: "a2", name: "arcade_intro.mp4", startSec: 8.0, endSec: 14.0, track: 1 },
      { id: "c3", assetId: "a3", name: "synth_loop.wav", startSec: 0, endSec: 14.0, track: 2 },
    ],
    selectedClipId: "c1",
  });

  const selectedClip = useMemo(
    () => timeline.clips.find((c) => c.id === timeline.selectedClipId) || null,
    [timeline.clips, timeline.selectedClipId]
  );

  // --- Preview state
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef(null);

  // --- Export state
  const [exportSettings, setExportSettings] = useState({
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    includeAudio: true,
    filename: "retro_cut",
  });
  const [exportJob, setExportJob] = useState({
    state: "idle", // idle | running | success | error
    progress: 0,
    message: "",
  });

  // On mount: check backend connectivity (only endpoint currently exists: GET /)
  useEffect(() => {
    let mounted = true;

    async function run() {
      setBackendStatus({ state: "loading", message: "Pinging backend…" });
      try {
        await healthCheck();
        if (!mounted) return;
        setBackendStatus({ state: "ok", message: "Connected" });
      } catch (e) {
        if (!mounted) return;
        setBackendStatus({
          state: "error",
          message: e?.message || "Backend unreachable",
        });
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  // Playback simulation (UI only for now)
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      playTimerRef.current = null;
      return;
    }

    playTimerRef.current = setInterval(() => {
      setTimeline((prev) => {
        const maxEnd = prev.clips.reduce((m, c) => Math.max(m, c.endSec), 0);
        const next = prev.cursorSec + 0.1;
        if (next >= maxEnd) return { ...prev, cursorSec: maxEnd };
        return { ...prev, cursorSec: next };
      });
    }, 100);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    };
  }, [isPlaying]);

  function selectClip(clipId) {
    setTimeline((prev) => ({ ...prev, selectedClipId: clipId }));
  }

  function nudgeCursor(delta) {
    setTimeline((prev) => {
      const maxEnd = prev.clips.reduce((m, c) => Math.max(m, c.endSec), 0);
      return { ...prev, cursorSec: clamp(prev.cursorSec + delta, 0, maxEnd) };
    });
  }

  function trimSelected(newStart, newEnd) {
    setTimeline((prev) => {
      const clips = prev.clips.map((c) => {
        if (c.id !== prev.selectedClipId) return c;
        const safeStart = clamp(newStart, 0, Math.max(0, newEnd - 0.1));
        const safeEnd = Math.max(safeStart + 0.1, newEnd);
        return { ...c, startSec: safeStart, endSec: safeEnd };
      });
      return { ...prev, clips };
    });
  }

  function addAssetToTimeline(asset) {
    setTimeline((prev) => {
      const maxEnd = prev.clips.reduce((m, c) => Math.max(m, c.endSec), 0);
      const isAudio = asset.type === "audio";
      const isImage = asset.type === "image";
      const defaultDur = isImage ? 3.0 : Math.max(1.0, asset.durationSec || 5.0);
      const nextClip = {
        id: `c_${Date.now()}`,
        assetId: asset.id,
        name: asset.name,
        startSec: maxEnd,
        endSec: maxEnd + defaultDur,
        track: isAudio ? 2 : 1,
      };
      return { ...prev, clips: [...prev.clips, nextClip], selectedClipId: nextClip.id };
    });
  }

  async function onClickExport() {
    // Wire to backend once export endpoints exist; for now we still show loading/error states.
    setExportJob({ state: "running", progress: 0, message: "Starting export…" });

    // Basic validation
    if (!exportSettings.filename.trim()) {
      setExportJob({ state: "error", progress: 0, message: "Filename is required." });
      return;
    }

    try {
      // In step 01.00 backend only has GET /. We still “touch” backend so export panel proves wiring.
      await healthCheck();

      // Simulate a render job progress bar (frontend only placeholder).
      let p = 0;
      const t = setInterval(() => {
        p += 8;
        setExportJob((prev) => ({
          ...prev,
          state: "running",
          progress: clamp(p, 0, 100),
          message: p >= 100 ? "Finalizing…" : "Rendering frames…",
        }));
        if (p >= 100) {
          clearInterval(t);
          setExportJob({
            state: "success",
            progress: 100,
            message: "Export complete (UI simulation).",
          });
        }
      }, 180);
    } catch (e) {
      setExportJob({
        state: "error",
        progress: 0,
        message: e?.message || "Export failed.",
      });
    }
  }

  const connectionTone =
    backendStatus.state === "ok"
      ? "success"
      : backendStatus.state === "error"
        ? "danger"
        : backendStatus.state === "loading"
          ? "warn"
          : "neutral";

  return (
    <div className="editorRoot">
      <header className="topBar">
        <div className="brand">
          <div className="brand__badge">MV</div>
          <div className="brand__text">
            <div className="brand__title">Modern Video Editor</div>
            <div className="brand__subtitle">Retro Console Cut</div>
          </div>
        </div>

        <div className="topBar__center">
          <div className="transport">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => nudgeCursor(-0.5)}
              aria-label="Step back"
            >
              ◀◀
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => nudgeCursor(0.5)}
              aria-label="Step forward"
            >
              ▶▶
            </Button>
            <div className="timeReadout" aria-label="Current time">
              {formatTime(timeline.cursorSec)}
            </div>
          </div>
        </div>

        <div className="topBar__right">
          <StatusPill tone={connectionTone}>
            {backendStatus.state === "loading" ? "Connecting…" : backendStatus.message || "Idle"}
          </StatusPill>
        </div>
      </header>

      <div className="workArea">
        {/* LEFT: tools + assets */}
        <aside className="sidebar">
          <Panel
            title="Toolbox"
            subtitle="Choose a tool (retro hotkeys)"
            className="panel--tight"
          >
            <div className="toolGroups">
              {TOOL_CATEGORIES.map((group) => (
                <div className="toolGroup" key={group.title}>
                  <div className="toolGroup__title">{group.title}</div>
                  <div className="toolGrid" role="list">
                    {group.items.map((t) => {
                      const active = t.id === activeToolId;
                      return (
                        <button
                          key={t.id}
                          className={`toolBtn ${active ? "toolBtn--active" : ""}`}
                          onClick={() => setActiveToolId(t.id)}
                          role="listitem"
                          aria-pressed={active}
                        >
                          <span className="toolBtn__label">{t.label}</span>
                          <span className="toolBtn__key">{t.hotkey}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Assets"
            subtitle="Drag/drop later — click to add"
            right={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // UI-only: create a dummy asset to show state updates.
                  const id = `a_${Date.now()}`;
                  setAssets((prev) => [
                    ...prev,
                    { id, type: "video", name: `clip_${prev.length + 1}.mp4`, durationSec: 5.0 },
                  ]);
                }}
              >
                + New
              </Button>
            }
            className="panel--tight"
          >
            <div className="assetList" role="list">
              {assets.map((a) => (
                <button
                  key={a.id}
                  className="assetRow"
                  onClick={() => addAssetToTimeline(a)}
                  role="listitem"
                >
                  <span className={`assetIcon assetIcon--${a.type}`} aria-hidden="true">
                    {a.type === "video" ? "🎞" : a.type === "audio" ? "♪" : "▦"}
                  </span>
                  <span className="assetName">{a.name}</span>
                  <span className="assetMeta">{a.durationSec ? `${a.durationSec.toFixed(1)}s` : ""}</span>
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        {/* CENTER: preview */}
        <main className="centerStage">
          <Panel
            title="Preview"
            subtitle={selectedClip ? `Selected: ${selectedClip.name}` : "No clip selected"}
            right={
              <div className="previewBadges">
                <StatusPill tone="neutral">{activeToolId.toUpperCase()}</StatusPill>
                <StatusPill tone="neutral">{exportSettings.resolution}</StatusPill>
              </div>
            }
          >
            <div className="previewShell">
              <div className="previewFrame" role="img" aria-label="Video preview area">
                <div className="crtOverlay" aria-hidden="true" />
                <div className="previewContent">
                  <div className="previewTitle">RETRO PREVIEW</div>
                  <div className="previewSub">
                    {selectedClip ? selectedClip.name : "Pick an asset or clip"}
                  </div>
                  <div className="previewStats">
                    <div>Cursor: {formatTime(timeline.cursorSec)}</div>
                    <div>FPS: {timeline.fps}</div>
                    <div>Zoom: {timeline.zoom.toFixed(1)}x</div>
                  </div>
                </div>
              </div>

              <div className="inspectorGrid">
                <div className="inspector">
                  <div className="inspector__title">Clip Inspector</div>
                  {!selectedClip ? (
                    <div className="hint">Select a clip in the timeline.</div>
                  ) : (
                    <div className="inspector__form">
                      <label className="field">
                        <span className="field__label">Start (sec)</span>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          value={selectedClip.startSec}
                          onChange={(e) =>
                            trimSelected(Number(e.target.value), selectedClip.endSec)
                          }
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">End (sec)</span>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          value={selectedClip.endSec}
                          onChange={(e) =>
                            trimSelected(selectedClip.startSec, Number(e.target.value))
                          }
                        />
                      </label>
                      <div className="hint">
                        Trimming is local UI state for now; will call backend trim endpoint once
                        available.
                      </div>
                    </div>
                  )}
                </div>

                <div className="inspector">
                  <div className="inspector__title">Export</div>
                  <div className="inspector__form">
                    <label className="field">
                      <span className="field__label">Filename</span>
                      <input
                        className="input"
                        value={exportSettings.filename}
                        onChange={(e) =>
                          setExportSettings((p) => ({ ...p, filename: e.target.value }))
                        }
                        placeholder="my_video"
                      />
                    </label>

                    <div className="row2">
                      <label className="field">
                        <span className="field__label">Format</span>
                        <select
                          className="input"
                          value={exportSettings.format}
                          onChange={(e) =>
                            setExportSettings((p) => ({ ...p, format: e.target.value }))
                          }
                        >
                          <option value="mp4">MP4</option>
                          <option value="webm">WebM</option>
                          <option value="mov">MOV</option>
                        </select>
                      </label>

                      <label className="field">
                        <span className="field__label">Resolution</span>
                        <select
                          className="input"
                          value={exportSettings.resolution}
                          onChange={(e) =>
                            setExportSettings((p) => ({ ...p, resolution: e.target.value }))
                          }
                        >
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                          <option value="4k">4K</option>
                        </select>
                      </label>
                    </div>

                    <label className="field field--inline">
                      <input
                        type="checkbox"
                        checked={exportSettings.includeAudio}
                        onChange={(e) =>
                          setExportSettings((p) => ({ ...p, includeAudio: e.target.checked }))
                        }
                      />
                      <span className="field__label">Include audio</span>
                    </label>

                    <Button
                      variant="primary"
                      size="md"
                      onClick={onClickExport}
                      isLoading={exportJob.state === "running"}
                    >
                      Export
                    </Button>

                    {exportJob.state !== "idle" ? (
                      <div
                        className={`jobStatus jobStatus--${exportJob.state}`}
                        role="status"
                        aria-live="polite"
                      >
                        <div className="jobStatus__msg">{exportJob.message}</div>
                        <div className="progress">
                          <div
                            className="progress__bar"
                            style={{ width: `${exportJob.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="hint">
                        Export is wired to backend connectivity today (GET /). Full export REST
                        wiring will be enabled once backend endpoints exist.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </main>
      </div>

      {/* BOTTOM: timeline */}
      <footer className="timelineDock">
        <div className="timelineHeader">
          <div className="timelineHeader__left">
            <div className="timelineTitle">Timeline</div>
            <div className="timelineMeta">
              <span>{timeline.clips.length} clips</span>
              <span className="dot" aria-hidden="true" />
              <span>{timeline.fps} fps</span>
            </div>
          </div>
          <div className="timelineHeader__right">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeline((p) => ({ ...p, zoom: clamp(p.zoom - 0.1, 0.6, 2.0) }))}
            >
              Zoom -
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeline((p) => ({ ...p, zoom: clamp(p.zoom + 0.1, 0.6, 2.0) }))}
            >
              Zoom +
            </Button>
          </div>
        </div>

        <div className="timelineBody">
          <div className="tracks">
            {[1, 2].map((track) => (
              <div className="track" key={track} aria-label={`Track ${track}`}>
                <div className="track__label">TRK {track}</div>
                <div className="track__lane">
                  {timeline.clips
                    .filter((c) => c.track === track)
                    .map((clip) => {
                      const dur = Math.max(0.1, clip.endSec - clip.startSec);
                      const left = clip.startSec * 34 * timeline.zoom;
                      const width = dur * 34 * timeline.zoom;
                      const selected = clip.id === timeline.selectedClipId;

                      return (
                        <button
                          key={clip.id}
                          className={`clip ${selected ? "clip--selected" : ""}`}
                          style={{ left, width }}
                          onClick={() => selectClip(clip.id)}
                          title={`${clip.name} (${dur.toFixed(1)}s)`}
                          aria-pressed={selected}
                        >
                          <div className="clip__name">{clip.name}</div>
                          <div className="clip__dur">{dur.toFixed(1)}s</div>
                        </button>
                      );
                    })}
                  <div
                    className="playhead"
                    style={{ left: timeline.cursorSec * 34 * timeline.zoom }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="timelineHint">
            Tip: Click an asset to add it. Click a clip to select. Adjust Start/End in the inspector.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
