"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Minimize, Plus, Minus, X } from "lucide-react";
import { genres, recordedPlayCounts, displayPlayCounts } from "../lib/music";
import { buildConstellation } from "../lib/constellation";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { ThemeToggle, useTheme } from "./theme";
import Constellation, { type SceneCommand } from "./constellation";
import { expandCollection, type CollectionView } from "../lib/collection-view";
import SceneLoading from "./scene-loading";
import Link from "next/link";
import Portrait2D from "./portrait-2d";
import AlbumArtwork from "./album-artwork";
const compactGenres: Record<string, string> = {
  "Indie & alternative": "Indie",
  "R&B & soul": "R&B\nSoul",
  "Folk & acoustic": "Folk\nAcoustic",
  "Jazz & classical": "Jazz\nClassical",
};
export default function Explorer({
  initial,
  portraitAvailable = false,
  portrait2D = false,
}: {
  initial: CollectionView;
  portraitAvailable?: boolean;
  portrait2D?: boolean;
}) {
  const [collection, setCollection] = useState(() => expandCollection(initial));
  const [sceneReady, setSceneReady] = useState(false);

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
    import("../lib/history-storage")
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
  const originalGraph = useMemo(
    () => buildConstellation(collection.artists, collection.tracks),
    [collection],
  );
  const rawCounts = useMemo(
    () => recordedPlayCounts(collection, "all"),
    [collection],
  );
  const graph = originalGraph;
  const playCounts = useMemo(() => displayPlayCounts(rawCounts), [rawCounts]);
  const selectedSong = graph.nodes.find((node) => node.id === selected);
  const detailsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected) return;
    detailsRef.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected("");
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [selected]);
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
            Russel’s
            <span className="brand-subtitle">
              {portrait2D ? "constellation · 2D" : "constellation"}
            </span>
          </span>
        </a>
        <div className="topbar-actions">
          {(portraitAvailable || portrait2D) && (
            <Link
              className="portrait-toggle"
              href={portrait2D ? "/" : "/2D"}
              title={
                portrait2D
                  ? "Return to the 3D constellation"
                  : "Open the 2D particle portrait"
              }
            >
              {portrait2D ? "3D" : "2D"}
            </Link>
          )}
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
        aria-label={portrait2D ? "2D particle portrait" : "Music constellation"}
        data-view={portrait2D ? "2D" : "constellation"}
        data-period="all"
        data-genre={effectiveGenre}
        data-visible-songs={
          new Set(
            graph.nodes
              .filter(
                (n) =>
                  effectiveGenre === "All genres" || n.genre === effectiveGenre,
              )
              .map((n) => n.track.id),
          ).size
        }
        data-visible-dots={sceneVisible.length}
      >
        {!sceneReady && <SceneLoading />}
        {portrait2D ? (
          <Portrait2D
            genre={effectiveGenre}
            theme={theme}
            command={command}
            onReady={setSceneReady}
          />
        ) : (
          <Constellation
            onReady={setSceneReady}
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
        )}
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
                {portrait2D
                  ? "Hover to ripple · click to hold"
                  : "Hover to preview · click to focus"}
              </small>
              <small className="legend-touch-hint">Tap a genre to focus</small>
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
                  aria-label={g.name}
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
                  <span className="genre-full-label">{g.name}</span>
                  <span className="genre-compact-label" aria-hidden="true">
                    {compactGenres[g.name] || g.name}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        )}
        {selectedSong && (
          <aside
            className="song-details"
            ref={detailsRef}
            tabIndex={-1}
            aria-labelledby="song-details-title"
          >
            <div className="song-details-heading">
              <span className="song-details-eyebrow">YOUR COLLECTION</span>
              <button
                className="icon-button"
                aria-label="Close song details"
                onClick={() => setSelected("")}
              >
                <X size={17} />
              </button>
            </div>
            <div className="song-details-hero">
              <AlbumArtwork key={selectedSong.id} track={selectedSong.track} />
              <div className="song-details-copy">
                <span
                  className="song-details-genre"
                  style={{
                    color:
                      theme === "dark"
                        ? selectedSong.color
                        : selectedSong.lightColor,
                  }}
                >
                  {selectedSong.genre}
                </span>
                <h2 id="song-details-title">{selectedSong.track.name}</h2>
                <p className="song-details-artist">
                  {selectedSong.artist.name}
                </p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Album</dt>
                <dd>{selectedSong.track.album}</dd>
              </div>
              {playCounts[selectedSong.track.id] !== undefined && (
                <div>
                  <dt>Plays</dt>
                  <dd>{playCounts[selectedSong.track.id].toLocaleString()}</dd>
                </div>
              )}
              {selectedSong.track.duration != null && (
                <div>
                  <dt>Length</dt>
                  <dd>
                    {Math.floor(selectedSong.track.duration / 60000)}:
                    {String(
                      Math.floor(selectedSong.track.duration / 1000) % 60,
                    ).padStart(2, "0")}
                  </dd>
                </div>
              )}
            </dl>
            <a
              className="song-details-link"
              href={selectedSong.track.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Spotify <span aria-hidden="true">↗</span>
            </a>
          </aside>
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
