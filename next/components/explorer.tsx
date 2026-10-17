"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize, Minimize, Plus, Minus, LoaderCircle, X } from "lucide-react";
import { type Collection, genres, recordedPlayCounts } from "../lib/music";
import { buildConstellation } from "../lib/constellation";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { ThemeToggle, useTheme } from "./theme";
import type { SceneCommand } from "./constellation";
const Constellation = dynamic(() => import("./constellation"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">
      <LoaderCircle size={22} />
      <span>Opening your constellation…</span>
    </div>
  ),
});
export default function Explorer({
  collection: initial,
}: {
  collection: Collection;
}) {
  const [collection, setCollection] = useState(() =>
    applyCollectionPreferences(initial),
  );
  const [genre, setGenre] = useState("All genres");
  const [previewGenre, setPreviewGenre] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(true);
  const [notice, setNotice] = useState("");
  const [command, setCommand] = useState<SceneCommand>({
    type: "reset",
    nonce: 0,
  });
  const { theme } = useTheme();
  useEffect(() => {
    let active = true;
    import("../lib/history-import")
      .then((m) => m.loadImport())
      .then((data) => {
        if (active && data) setCollection(applyCollectionPreferences(data));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setFullscreenSupported(Boolean(document.fullscreenEnabled));
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const graph = useMemo(
    () => buildConstellation(collection.artists, collection.tracks),
    [collection],
  );
  const playCounts = useMemo(
    () => recordedPlayCounts(collection, "all"),
    [collection],
  );
  const effectiveGenre = previewGenre ?? genre;
  const sceneVisible = useMemo(
    () =>
      graph.nodes
        .filter(
          (n) => effectiveGenre === "All genres" || n.genre === effectiveGenre,
        )
        .map((n) => n.id),
    [graph, effectiveGenre],
  );
  const availableGenres = useMemo(
    () =>
      genres.filter(
        (g) =>
          g.name !== "Unclassified" &&
          graph.nodes.some((n) => n.genre === g.name),
      ),
    [graph],
  );
  function act(type: SceneCommand["type"]) {
    setCommand((c) => ({ type, nonce: c.nonce + 1 }));
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice("Fullscreen isn't available in this browser.");
    }
  }
  return (
    <div className="constellation-app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Russel’s constellation home">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-disc" />
            <span className="brand-bars">
              <i />
              <i />
              <i />
              <i />
            </span>
          </span>
          <span>
            Russel’s<span className="brand-subtitle">constellation</span>
          </span>
        </a>
        <div className="topbar-actions">
          <button
            className="icon-button fullscreen-toggle"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={fullscreen}
            disabled={!fullscreenSupported}
            title={
              fullscreenSupported
                ? undefined
                : "Fullscreen is unavailable in this browser"
            }
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <ThemeToggle />
        </div>
      </header>
      <main
        className="universe"
        aria-label="Music constellation"
        data-period="all"
        data-genre={effectiveGenre}
        data-visible-songs={sceneVisible.length}
      >
        <Constellation
          data={graph}
          selected={selected}
          visible={sceneVisible}
          theme={theme}
          mode="3D"
          rotating={false}
          command={command}
          playCounts={playCounts}
          onSelect={setSelected}
        />
        <div
          className="zoom-controls"
          role="group"
          aria-label="Constellation zoom"
        >
          <button
            className="icon-button"
            aria-label="Zoom in"
            onClick={() => act("in")}
          >
            <Plus size={20} />
          </button>
          <button
            className="icon-button"
            aria-label="Zoom out"
            onClick={() => act("out")}
          >
            <Minus size={20} />
          </button>
        </div>
        {availableGenres.length > 0 && (
          <nav className="genre-legend" aria-label="Genre legend">
            <span className="legend-hint">
              GENRES{" "}
              <small className="legend-desktop-hint">
                Hover to preview · click to focus
              </small>
              <small className="legend-touch-hint">
                Swipe genres · tap to focus
              </small>
            </span>
            <div
              className="legend-items"
              onTouchStart={() => setPreviewGenre(null)}
            >
              <button
                className={effectiveGenre === "All genres" ? "active" : ""}
                aria-pressed={genre === "All genres"}
                onClick={() => {
                  setGenre("All genres");
                  setPreviewGenre(null);
                  setSelected("");
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setPreviewGenre("All genres");
                }}
                onPointerLeave={() => setPreviewGenre(null)}
                onFocus={() => setPreviewGenre("All genres")}
                onBlur={() => setPreviewGenre(null)}
              >
                All
              </button>
              {availableGenres.map((g) => (
                <button
                  key={g.name}
                  aria-pressed={genre === g.name}
                  className={effectiveGenre === g.name ? "active" : ""}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setPreviewGenre(g.name);
                  }}
                  onPointerLeave={() => setPreviewGenre(null)}
                  onFocus={() => setPreviewGenre(g.name)}
                  onBlur={() => setPreviewGenre(null)}
                  onClick={() => {
                    setGenre(g.name);
                    setPreviewGenre(null);
                    setSelected("");
                  }}
                >
                  <i
                    style={{ background: theme === "dark" ? g.color : g.light }}
                  />
                  {g.name}
                </button>
              ))}
            </div>
          </nav>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
