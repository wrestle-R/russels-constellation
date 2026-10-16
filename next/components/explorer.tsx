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
  artistsForPeriod,
  timeLabel,
} from "../lib/music";
import { buildConstellation } from "../lib/constellation";
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
  const [collection, setCollection] = useState(initial),
    [period, setPeriod] = useState<Period>("all"),
    [query, setQuery] = useState(""),
    [genre, setGenre] = useState("All genres"),
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
        if (active && data) setCollection(data);
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
  const tracks = useMemo(
    () => tracksForPeriod(collection, period),
    [collection, period],
  );
  const artists = useMemo(
    () =>
      artistsForPeriod(collection, period).filter(
        (a) => genreFor(a).name !== "Unclassified",
      ),
    [collection, period],
  );
  const ranking = useMemo(
    () =>
      period === "all"
        ? collection.top.long_term?.artistIds || []
        : collection.top[period]?.artistIds || [],
    [collection.top, period],
  );
  const graph = useMemo(
    () => buildConstellation(artists, tracks, ranking),
    [artists, tracks, ranking],
  );
  const playlistArtists = useMemo(() => {
    const playlist = collection.playlists.find((p) => p.id === playlistId);
    if (!playlist) return null;
    const ids = new Set(playlist.trackIds);
    return new Set(
      collection.tracks
        .filter((t) => ids.has(t.id))
        .flatMap((t) => t.artistIds || []),
    );
  }, [collection, playlistId]);
  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    return artists.filter(
      (a) =>
        (genre === "All genres" || genreFor(a).name === genre) &&
        (!playlistArtists || playlistArtists.has(a.id)) &&
        (!q ||
          a.name.toLowerCase().includes(q) ||
          a.genres.some((g) => g.includes(q))),
    );
  }, [artists, genre, query, playlistArtists]);
  const visible = useMemo(() => matches.map((a) => a.id), [matches]);
  const availableGenres = useMemo(
    () =>
      genres.filter(
        (g) =>
          g.name !== "Unclassified" &&
          artists.some((a) => genreFor(a).name === g.name),
      ),
    [artists],
  );
  function act(type: SceneCommand["type"]) {
    setCommand((c) => ({ type, nonce: c.nonce + 1 }));
  }
  function clear() {
    setQuery("");
    setGenre("All genres");
    setPlaylistId("");
    setSelected("");
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
      const data = await lib.importHistory(files, initial, setProgress);
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
        <a className="brand" href="/" aria-label="Play It Back home">
          <span className="brand-mark">▸_</span>
          <span>
            play it back<span className="brand-dot">.</span>
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
              placeholder="Find an artist"
              aria-label="Find an artist"
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
                className={period === p ? "active" : ""}
                onClick={() => setPeriod(p)}
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
                <List size={16} /> Artist list
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
      <main className="universe" aria-label="Music constellation">
        <Constellation
          data={graph}
          selected={selected}
          visible={visible}
          theme={theme}
          mode={mode}
          rotating={rotating}
          command={command}
          onSelect={setSelected}
        />
        {matches.length === 0 && (
          <div className="empty-state">
            <p>
              {artists.length
                ? "No artists match these filters."
                : "No genre-tagged artists are available for this period."}
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
        <Dialog title="Find an artist" onClose={() => setModal(null)}>
          <label className="dialog-search">
            <Search size={15} />
            <input
              aria-label="Search artist list"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              placeholder="Search your artists"
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
                  <strong>{a.name}</strong>
                  <small>{genreFor(a).name}</small>
                </button>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={"Open " + a.name + " in Spotify"}
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
          {!matches.length && <p>No artists match your search.</p>}
        </Dialog>
      )}
      {modal === "help" && (
        <Dialog title="Just you and your music." onClose={() => setModal(null)}>
          <p>
            Drag to orbit the constellation. Scroll or pinch to zoom. Hover over
            a dot to see the artist; tap on a touchscreen. Click a dot to
            highlight its connections.
          </p>
          <p>
            Colors follow genre tags, and lines connect artists with shared
            tags. Genres overlap in one cloud. Artists without genre metadata
            are omitted from this view.
          </p>
          <p>
            <strong>All available</strong> combines retrieved top lists and
            playlist contents. <strong>4 weeks</strong> and{" "}
            <strong>6 months</strong> use Spotify’s top items for those periods.
            Imported history uses actual play dates.
          </p>
          <p>
            Use Artist list in the menu for keyboard navigation and Spotify
            links. Press <kbd>/</kbd> to search, or <kbd>D</kbd> to change
            theme.
          </p>
          <p className="source-note">
            Genre tags: Spotify and Last.fm community tags.{" "}
            {collection.source === "sample"
              ? "This is an illustrative sample collection."
              : "This is a private local snapshot, not complete lifetime listening history."}
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
