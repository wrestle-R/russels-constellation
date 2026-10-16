"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import {
  Search,
  X,
  MoreHorizontal,
  Upload,
  List,
  HelpCircle,
  Rotate3D,
  Pause,
  Scan,
  Plus,
  Minus,
  ArrowUpRight,
  LoaderCircle,
  ArrowLeft,
} from "lucide-react";
import {
  type Collection,
  type Period,
  genreFor,
  genres,
  tracksForPeriod,
  recordedPlayCounts,
  timeLabel,
} from "../lib/music";
import { buildConstellation } from "../lib/constellation";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { ThemeToggle, useTheme } from "./theme";
import Dialog from "./dialog";
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
  const [collection, setCollection] = useState(() => applyCollectionPreferences(initial)),
    [period, setPeriod] = useState<Period>("all"),
    [query, setQuery] = useState(""),
    [genre, setGenre] = useState("All genres"),
    [previewGenre, setPreviewGenre] = useState<string | null>(null),
    [previewPeriod, setPreviewPeriod] = useState<Period | null>(null),
    [playlistId, setPlaylistId] = useState(""),
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState<"3D" | "2D">("3D"),
    [rotating, setRotating] = useState(false),
    [modal, setModal] = useState<"help" | "import" | "artists" | null>(null),
    [limit, setLimit] = useState(60),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [command, setCommand] = useState<SceneCommand>({ type: "reset", nonce: 0 });
  const { theme } = useTheme();
  const input = useRef<HTMLInputElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    menu = useRef<HTMLDetailsElement>(null);
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
    function key(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target as HTMLElement).closest("input,textarea,select,dialog")
      ) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape" && menu.current) menu.current.open = false;
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const effectivePeriod = previewPeriod ?? period;
  const effectiveGenre = previewGenre ?? genre;
  const tracks = useMemo(
    () => tracksForPeriod(collection, effectivePeriod),
    [collection, effectivePeriod],
  );
  const graph = useMemo(
    () => buildConstellation(collection.artists, collection.tracks),
    [collection],
  );
  const playCounts = useMemo(
    () => recordedPlayCounts(collection, effectivePeriod),
    [collection, effectivePeriod],
  );
  const countScope =
    collection.source === "import"
      ? "imported history"
      : "recent snapshot only";
  const candidates = useMemo(() => {
    const periodIds = new Set(tracks.map((t) => t.id));
    const playlist = collection.playlists.find((p) => p.id === playlistId);
    const playlistIds = playlist ? new Set(playlist.trackIds) : null;
    const q = query.trim().toLowerCase();
    return graph.nodes.filter(
      (n) =>
        periodIds.has(n.id) &&
        (!playlistIds || playlistIds.has(n.id)) &&
        (!q ||
          [n.track.name, n.track.album, n.artist.name, ...n.artist.genres]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    );
  }, [tracks, graph, collection.playlists, playlistId, query]);
  const matches = useMemo(
    () =>
      candidates.filter(
        (n) => effectiveGenre === "All genres" || n.genre === effectiveGenre,
      ),
    [candidates, effectiveGenre],
  );
  const sceneVisible = useMemo(() => matches.map((n) => n.id), [matches]);
  const availableGenres = useMemo(
    () =>
      genres.filter(
        (g) =>
          g.name !== "Unclassified" &&
          candidates.some((n) => n.genre === g.name),
      ),
    [candidates],
  );
  function act(type: SceneCommand["type"]) {
    setCommand((c) => ({ type, nonce: c.nonce + 1 }));
  }
  function clear() {
    setQuery("");
    setGenre("All genres");
    setPlaylistId("");
    setSelected("");
    setPreviewGenre(null);
    setPreviewPeriod(null);
  }
  function open(which: typeof modal) {
    setError("");
    setModal(which);
    if (menu.current) menu.current.open = false;
  }
  async function receiveFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const lib = await import("../lib/history-import");
      const data = applyCollectionPreferences(
        await lib.importHistory(files, initial, setProgress),
      );
      setCollection(data);
      setPeriod("all");
      clear();
      try {
        await lib.saveImport(data);
        setNotice("History saved in this browser.");
      } catch {
        setNotice(
          "History loaded for this session. Browser storage is unavailable.",
        );
      }
      setModal(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not import these files.",
      );
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  async function removeImport() {
    try {
      const lib = await import("../lib/history-import");
      await lib.saveImport(null);
      setCollection(initial);
      setPeriod("all");
      clear();
      setNotice("Returned to your Spotify snapshot.");
      setModal(null);
    } catch {
      setError("Could not clear browser storage. Try again.");
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
        <div className="topbar-filters">
          <label className="search">
            <Search size={15} />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              placeholder="Find a song or artist"
              aria-label="Find a song or artist"
            />
            {query ? (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
          <select
            aria-label="Filter by genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          >
            <option>All genres</option>
            {availableGenres.map((g) => (
              <option key={g.name}>{g.name}</option>
            ))}
          </select>
          <div className="period-control" aria-label="Listening period">
            {(["all", "short_term", "medium_term"] as Period[]).map((p) => (
              <button
                key={p}
                disabled={collection.source === "sample" && p !== "all"}
                aria-pressed={period === p}
                className={effectivePeriod === p ? "active" : ""}
                onMouseEnter={() => setPreviewPeriod(p)}
                onMouseLeave={() => setPreviewPeriod(null)}
                onFocus={() => setPreviewPeriod(p)}
                onBlur={() => setPreviewPeriod(null)}
                onClick={() => {
                  setPeriod(p);
                  setPreviewPeriod(null);
                  setSelected("");
                }}
              >
                {timeLabel(p)}
              </button>
            ))}
          </div>
        </div>
        <div className="topbar-actions">
          <div className="scene-actions">
            <button
              className="icon-button"
              aria-label={rotating ? "Pause rotation" : "Rotate constellation"}
              aria-pressed={rotating}
              onClick={() => setRotating(!rotating)}
            >
              {rotating ? <Pause size={16} /> : <Rotate3D size={17} />}
            </button>
            <button
              className="icon-button"
              aria-label="Reset constellation"
              onClick={() => act("reset")}
            >
              <Scan size={16} />
            </button>
          </div>
          <ThemeToggle />
          <details className="more-menu" ref={menu}>
            <summary aria-label="More options">
              <MoreHorizontal size={20} />
            </summary>
            <div className="menu-panel">
              <button onClick={() => open("artists")}>
                <List size={16} /> Song list
              </button>
              <button onClick={() => open("import")}>
                <Upload size={16} /> Import history
              </button>
              <button onClick={() => open("help")}>
                <HelpCircle size={16} /> How to explore
              </button>
              <div className="menu-divider" />
              <label>
                Playlist
                <select
                  aria-label="Filter by playlist"
                  value={playlistId}
                  onChange={(e) => {
                    setPlaylistId(e.target.value);
                    if (menu.current) menu.current.open = false;
                  }}
                >
                  <option value="">All playlists & listening</option>
                  {collection.playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="menu-row">
                <span>View</span>
                <div className="mode-control">
                  {(["3D", "2D"] as const).map((m) => (
                    <button
                      key={m}
                      aria-pressed={mode === m}
                      onClick={() => {
                        setMode(m);
                        if (menu.current) menu.current.open = false;
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="menu-row">
                <span>Zoom</span>
                <div className="mode-control">
                  <button aria-label="Zoom out" onClick={() => act("out")}>
                    <Minus size={15} />
                  </button>
                  <button aria-label="Zoom in" onClick={() => act("in")}>
                    <Plus size={15} />
                  </button>
                </div>
              </div>
              <button
                className="mobile-reset"
                onClick={() => {
                  act("reset");
                  if (menu.current) menu.current.open = false;
                }}
              >
                <Scan size={16} /> Reset view
              </button>
              {(query || genre !== "All genres" || playlistId) && (
                <button onClick={clear}>
                  <X size={15} /> Clear filters
                </button>
              )}
            </div>
          </details>
        </div>
      </header>
      <main
        className="universe"
        aria-label="Music constellation"
        data-period={effectivePeriod}
        data-genre={effectiveGenre}
        data-visible-songs={sceneVisible.length}
      >
        <Constellation
          data={graph}
          selected={selected}
          visible={sceneVisible}
          theme={theme}
          mode={mode}
          rotating={rotating}
          command={command}
          playCounts={playCounts}
          countScope={countScope}
          onSelect={setSelected}
        />
        {availableGenres.length > 0 && (
          <nav className="genre-legend" aria-label="Genre legend">
            <span className="legend-hint">
              GENRES{" "}
              <small className="legend-desktop-hint">
                Hover to preview · click to focus
              </small>
              <small className="legend-touch-hint">
                Tap a genre to focus · pinch to zoom
              </small>
            </span>
            <div className="legend-items">
              <button
                className={effectiveGenre === "All genres" ? "active" : ""}
                aria-pressed={genre === "All genres"}
                onClick={() => {
                  setGenre("All genres");
                  setPreviewGenre(null);
                  setSelected("");
                }}
                onMouseEnter={() => setPreviewGenre("All genres")}
                onMouseLeave={() => setPreviewGenre(null)}
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
                  onMouseEnter={() => setPreviewGenre(g.name)}
                  onMouseLeave={() => setPreviewGenre(null)}
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
        {matches.length === 0 && (
          <div className="empty-state">
            <p>
              {graph.nodes.length
                ? "No songs match these filters."
                : "No genre-tagged songs are available for this period."}
            </p>
            <button onClick={clear}>Clear filters</button>
          </div>
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
      {modal === "artists" && (
        <Dialog title="Find a song or artist" onClose={() => setModal(null)}>
          <label className="dialog-search">
            <Search size={15} />
            <input
              aria-label="Search song list"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              placeholder="Search your songs"
            />
          </label>
          <div className="artist-list">
            {matches.slice(0, limit).map((a) => (
              <div key={a.id}>
                <button
                  onClick={() => {
                    setSelected(a.id);
                    setModal(null);
                  }}
                >
                  <strong>{a.track.name}</strong>
                  <small>
                    {a.artist.name} · {a.genre}
                  </small>
                </button>
                <a
                  href={a.track.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={"Open " + a.track.name + " in Spotify"}
                >
                  <ArrowUpRight size={16} />
                </a>
              </div>
            ))}
          </div>
          {matches.length > limit && (
            <button
              className="secondary-button"
              onClick={() => setLimit(limit + 60)}
            >
              Show more
            </button>
          )}
          {!matches.length && <p>No songs match your search.</p>}
        </Dialog>
      )}
      {modal === "help" && (
        <Dialog title="Russel’s constellation" onClose={() => setModal(null)}>
          <p>
            Every dot is a song. Songs from the same primary artist sit together
            and connect to each other. There are no links between unrelated
            artists.
          </p>
          <p>
            Genres have consistent homes. Multi-genre artists sit toward the
            boundaries between those homes. Hover a genre or time tab to preview
            it; click to keep that view. Leaving the tab restores your
            selection.
          </p>
          <p>
            More recorded plays produce darker, deeper colors. Hover a song for
            its count and source. The current snapshot has only{" "}
            {collection.recordedEventCount ?? collection.recent?.length ?? 0}{" "}
            recent listening events; missing counts are unknown, never zero.
            Import extended listening history for counts across your years of
            listening.
          </p>
          <p>
            This app reads saved snapshots and browser storage. It does not
            fetch Spotify when you open it, switch tabs, or reload. Fonts and
            app assets are bundled too. External sites open only when you choose
            their links.
          </p>
          <p>
            All available includes the saved song collection. Four weeks and six
            months use imported play dates, or saved Spotify top lists when
            using the existing snapshot. Press / to search or D to switch theme.
          </p>
        </Dialog>
      )}
      {modal === "import" && (
        <Dialog
          title="Bring your history along."
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <p>
            Choose your Spotify streaming-history ZIP or JSON files. Music
            metadata and play dates stay in this browser.
          </p>
          <p>
            Request extended streaming history from{" "}
            <a
              href="https://www.spotify.com/account/privacy/"
              target="_blank"
              rel="noreferrer"
            >
              Spotify’s privacy settings ↗
            </a>
            . Artists with known genre tags appear in the constellation.
          </p>
          <input
            type="file"
            ref={fileInput}
            accept=".zip,.json"
            multiple
            hidden
            onChange={receiveFiles}
          />
          <button
            className="import-dropzone"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {busy ? (
              <LoaderCircle className="spinning" size={25} />
            ) : (
              <Upload size={25} />
            )}
            <span>{busy ? progress : "Choose history files"}</span>
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <p className="source-note">
            Plays under 30 seconds are excluded. Your original files are never
            uploaded.
          </p>
          {collection.source === "import" && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={removeImport}
            >
              <ArrowLeft size={14} /> Remove import and return to Spotify
              snapshot
            </button>
          )}
        </Dialog>
      )}
    </div>
  );
}
