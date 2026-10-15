"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  Search,
  Plus,
  HelpCircle,
  X,
  Orbit,
  List,
  ChevronRight,
  AudioLines,
  Shuffle,
  Disc3,
  Library,
  Music2,
  Layers3,
  Upload,
  LockKeyhole,
  SlidersHorizontal,
  ArrowLeft,
  Check,
  LoaderCircle,
  Headphones,
  ExternalLink,
  ChevronDown,
  Compass,
  Grid2X2,
} from "lucide-react";
import {
  type Collection,
  type Artist,
  type Album,
  type Playlist,
  type Period,
  genreFor,
  genres,
  tracksForPeriod,
  artistsForPeriod,
  formatNumber,
  timeLabel,
} from "../lib/music";
import { buildConstellation } from "../lib/constellation";
import { ThemeToggle, useTheme } from "./theme";
import Dialog from "./dialog";
const Constellation = dynamic(() => import("./constellation"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <LoaderCircle size={24} />
      Arranging your constellation…
    </div>
  ),
});
type View = "Constellation" | "Genres" | "Albums" | "Playlists" | "Songs";
type Modal = {
  type: "help" | "import" | "album" | "playlist";
  id?: string;
} | null;
const navigation = [
  { name: "Constellation" as View, icon: Orbit },
  { name: "Genres" as View, icon: Layers3 },
  { name: "Albums" as View, icon: Disc3 },
  { name: "Playlists" as View, icon: Library },
  { name: "Songs" as View, icon: Music2 },
];
function Artwork({
  image,
  name,
  round = false,
}: {
  image?: string;
  name: string;
  round?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return (
    <span className={"artwork " + (round ? "round" : "")}>
      {image && !failed ? (
        <img
          src={image}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="artwork-fallback">
          <AudioLines />
          <b>{name.slice(0, 1)}</b>
        </span>
      )}
    </span>
  );
}
export default function Explorer({
  collection: initial,
}: {
  collection: Collection;
}) {
  const [collection, setCollection] = useState(initial),
    [view, setView] = useState<View>("Constellation"),
    [period, setPeriod] = useState<Period>("all"),
    [query, setQuery] = useState(""),
    [genre, setGenre] = useState("All genres"),
    [selectedId, setSelectedId] = useState(
      initial.top.medium_term?.artistIds[0] || initial.artists[0]?.id || "",
    ),
    [display, setDisplay] = useState<"map" | "list">("map"),
    [mode, setMode] = useState<"3D" | "2D">("3D"),
    [modal, setModal] = useState<Modal>(null),
    [limit, setLimit] = useState(60),
    [playlistId, setPlaylistId] = useState(""),
    [importing, setImporting] = useState(false),
    [progress, setProgress] = useState(""),
    [importError, setImportError] = useState(""),
    [notice, setNotice] = useState("");
  const { theme } = useTheme();
  const search = useRef<HTMLInputElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    import("../lib/history-import")
      .then((m) => m.loadImport())
      .then((data) => {
        if (data && active) setCollection(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target as HTMLElement)?.closest("input,textarea,select,dialog")
      ) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const periodTracks = useMemo(
    () => tracksForPeriod(collection, period),
    [collection, period],
  );
  const periodArtists = useMemo(
    () => artistsForPeriod(collection, period),
    [collection, period],
  );
  const tracksByArtist = useMemo(() => {
    const map = new Map<string, typeof collection.tracks>();
    for (const t of periodTracks)
      for (const id of t.artistIds || [t.artistId || ""]) {
        const items = map.get(id) || [];
        items.push(t);
        map.set(id, items);
      }
    return map;
  }, [periodTracks]);
  const activePlaylist = collection.playlists.find((p) => p.id === playlistId);
  const playlistArtists = useMemo(() => {
    if (!activePlaylist) return null;
    const ids = new Set(activePlaylist.trackIds);
    return new Set(
      collection.tracks
        .filter((t) => ids.has(t.id))
        .flatMap((t) => t.artistIds || []),
    );
  }, [activePlaylist, collection.tracks]);
  const scopedArtists = useMemo(
    () =>
      playlistArtists
        ? periodArtists.filter((a) => playlistArtists.has(a.id))
        : periodArtists,
    [playlistArtists, periodArtists],
  );
  const ranking = useMemo(
    () =>
      period === "all"
        ? collection.top.long_term?.artistIds.length
          ? collection.top.long_term.artistIds
          : collection.top.medium_term?.artistIds || []
        : collection.top[period]?.artistIds || [],
    [collection.top, period],
  );
  const graph = useMemo(
    () => buildConstellation(scopedArtists, periodTracks, ranking),
    [scopedArtists, periodTracks, ranking],
  );
  const q = query.toLowerCase().trim();
  const matchingArtists = useMemo(
    () =>
      scopedArtists.filter(
        (a) =>
          (genre === "All genres" || genreFor(a).name === genre) &&
          (!q ||
            `${a.name} ${a.genres.join(" ")}`.toLowerCase().includes(q) ||
            (tracksByArtist.get(a.id) || []).some((t) =>
              `${t.name} ${t.album}`.toLowerCase().includes(q),
            )),
      ),
    [scopedArtists, genre, q, tracksByArtist],
  );
  const visibleIds = useMemo(
    () => matchingArtists.map((a) => a.id),
    [matchingArtists],
  );
  const selected =
    matchingArtists.find((a) => a.id === selectedId) || matchingArtists[0];
  const selectedTracks = selected ? tracksByArtist.get(selected.id) || [] : [];
  const rankedArtists = useMemo(() => {
    const rank = new Map(ranking.map((id, i) => [id, i]));
    return [...matchingArtists].sort(
      (a, b) =>
        (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999) ||
        (tracksByArtist.get(b.id)?.length || 0) -
          (tracksByArtist.get(a.id)?.length || 0),
    );
  }, [matchingArtists, ranking, tracksByArtist]);
  const genreGroups = useMemo(
    () =>
      genres
        .map((g) => ({
          ...g,
          artists: scopedArtists.filter((a) => genreFor(a).name === g.name),
        }))
        .filter((g) => g.artists.length),
    [scopedArtists],
  );
  const albumIds = useMemo(
    () => new Set(periodTracks.map((t) => t.albumId)),
    [periodTracks],
  );
  const filteredAlbums = collection.albums.filter(
    (a) =>
      (period === "all" || albumIds.has(a.id)) &&
      `${a.name} ${a.artist}`.toLowerCase().includes(q),
  );
  const filteredPlaylists = collection.playlists.filter((p) =>
    p.name.toLowerCase().includes(q),
  );
  const filteredSongs = periodTracks.filter((t) =>
    `${t.name} ${t.artist} ${t.album}`.toLowerCase().includes(q),
  );
  const album =
    modal?.type === "album"
      ? collection.albums.find((a) => a.id === modal.id)
      : undefined;
  const playlist =
    modal?.type === "playlist"
      ? collection.playlists.find((p) => p.id === modal.id)
      : undefined;
  const detailTracks = album
    ? collection.tracks.filter((t) => t.albumId === album.id)
    : playlist
      ? collection.tracks.filter((t) => playlist.trackIds.includes(t.id))
      : [];
  const headings: Record<View, [string, string]> = {
    Constellation: [
      "Your music, connected.",
      "A different perspective on everything you love to listen to.",
    ],
    Genres: [
      "Follow your own frequency.",
      "Find the sounds that connect your favorite artists.",
    ],
    Albums: [
      "Good records. Great company.",
      "The albums behind the songs in your collection.",
    ],
    Playlists: [
      "There’s a playlist for that.",
      "Your collections, moods, and very specific moments.",
    ],
    Songs: [
      "Every song has a place.",
      "Rediscover a familiar favorite. Find the next one.",
    ],
  };
  function navigate(next: View) {
    setView(next);
    setQuery("");
    setLimit(60);
  }
  function exploreGenre(name: string) {
    setGenre(name);
    setView("Constellation");
    setQuery("");
    setDisplay("map");
  }
  function selectArtist(id: string) {
    setSelectedId(id);
  }
  function clearFilters() {
    setQuery("");
    setGenre("All genres");
    setPlaylistId("");
  }
  async function receiveFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setImporting(true);
    setImportError("");
    try {
      const lib = await import("../lib/history-import");
      const data = await lib.importHistory(files, initial, setProgress);
      setCollection(data);
      setPeriod("all");
      clearFilters();
      setView("Constellation");
      setSelectedId(data.artists[0]?.id || "");
      try {
        await lib.saveImport(data);
        setNotice("History imported and saved in this browser.");
      } catch {
        setNotice(
          "History imported for this session. Browser storage was unavailable.",
        );
      }
      setModal(null);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Unable to read that file.",
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }
  async function removeImport() {
    try {
      const lib = await import("../lib/history-import");
      await lib.saveImport(null);
      setCollection(initial);
      setPeriod("all");
      clearFilters();
      setNotice("Returned to your Spotify snapshot.");
      setModal(null);
    } catch {
      setImportError("Could not clear browser storage. Try again.");
    }
  }
  const shownCount =
    view === "Albums"
      ? filteredAlbums.length
      : view === "Playlists"
        ? filteredPlaylists.length
        : view === "Songs"
          ? filteredSongs.length
          : matchingArtists.length;
  const snapshotDate = collection.fetchedAt
    ? new Date(collection.fetchedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : "";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Play It Back home">
          <span className="brand-mark">▸_</span>
          <span>
            play it back<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="library-label">YOUR LIBRARY</div>
        <nav aria-label="Library">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "selected" : ""}
              onClick={() => navigate(name)}
              aria-current={view === name ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Playlists" && (
                <small>{collection.playlists.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-separator" />
        <div className="library-label">YOUR SOUND</div>
        <div className="genre-nav">
          {genreGroups
            .filter((g) => g.name !== "Unclassified")
            .slice(0, 6)
            .map((g) => (
              <button key={g.name} onClick={() => exploreGenre(g.name)}>
                <i
                  style={{ background: theme === "dark" ? g.color : g.light }}
                />
                {g.name}
                <small>{g.artists.length}</small>
              </button>
            ))}
        </div>
        <button className="more-genres" onClick={() => navigate("Genres")}>
          Explore all genres <ChevronRight size={13} />
        </button>
        <div className="sidebar-bottom">
          <div className="history-invitation">
            <div className="history-icon">
              <Orbit size={21} />
            </div>
            <strong>Your story goes further.</strong>
            <p>Bring years of listening into your constellation.</p>
            <button onClick={() => setModal({ type: "import" })}>
              Import your history <Plus size={14} />
            </button>
          </div>
          <div className="profile">
            <span>
              <Headphones size={18} />
            </span>
            <div>
              <strong>Your music space</strong>
              <small>
                {collection.source === "import"
                  ? "Imported history"
                  : collection.source === "sample"
                    ? "Sample library"
                    : "Spotify connected snapshot"}
              </small>
            </div>
            <LockKeyhole size={13} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Library size={15} />
            <span>Your library</span>
            <ChevronRight size={12} />
            <strong>{view}</strong>
          </div>
          <label className="global-search">
            <Search size={16} />
            <input
              ref={search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(60);
              }}
              placeholder={
                view === "Playlists"
                  ? "Search your playlists"
                  : view === "Albums"
                    ? "Search albums or artists"
                    : "Search artists, songs, or albums"
              }
              aria-label="Search your collection"
            />
            {query ? (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
          <ThemeToggle />
          <button
            className="icon-button"
            aria-label="How to explore"
            onClick={() => setModal({ type: "help" })}
          >
            <HelpCircle size={18} />
          </button>
          <button
            className="top-import"
            onClick={() => setModal({ type: "import" })}
          >
            <Upload size={14} /> Import history
          </button>
        </header>
        <nav className="mobile-nav" aria-label="Mobile library">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "selected" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="green-dot" />
                {collection.source === "sample"
                  ? "SAMPLE COLLECTION"
                  : collection.source === "import"
                    ? "YOUR LISTENING HISTORY"
                    : "MADE OF YOUR MUSIC"}
              </div>
              <h1>{headings[view][0]}</h1>
              <p>{headings[view][1]}</p>
            </div>
            <div className="snapshot-indicator">
              <LockKeyhole size={12} />
              <span>
                Private collection
                <small>
                  {snapshotDate
                    ? "Updated " + snapshotDate
                    : "Illustrative demo data"}
                </small>
              </span>
            </div>
          </section>
          <section className="collection-bar" aria-label="Collection summary">
            <div className="collection-counts">
              <span>
                <b>{formatNumber(periodArtists.length)}</b> artists
              </span>
              <span>
                <b>{formatNumber(periodTracks.length)}</b> songs
              </span>
              <span>
                <b>{formatNumber(collection.playlists.length)}</b> playlists
              </span>
            </div>
            <div className="period-control" aria-label="Listening period">
              {(["all", "short_term", "medium_term"] as Period[]).map((p) => (
                <button
                  key={p}
                  disabled={
                    view === "Playlists" ||
                    (collection.source === "sample" && p !== "all")
                  }
                  title={
                    view === "Playlists"
                      ? "Playlists show your current collection"
                      : p === "all"
                        ? "All retrieved top lists and playlist contents"
                        : undefined
                  }
                  aria-pressed={period === p}
                  className={period === p ? "active" : ""}
                  onClick={() => {
                    setPeriod(p);
                    setLimit(60);
                  }}
                >
                  {timeLabel(p)}
                </button>
              ))}
            </div>
          </section>
          {notice && (
            <div className="notice" role="status">
              <Check size={14} />
              {notice}
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {view === "Constellation" && (
            <>
              <section className="map-workspace">
                <div className="map-toolbar">
                  <div className="map-title">
                    <Orbit size={17} />
                    <strong>Your artist constellation</strong>
                    <span>{formatNumber(matchingArtists.length)} artists</span>
                  </div>
                  <div className="display-control">
                    <button
                      aria-pressed={display === "map"}
                      className={display === "map" ? "active" : ""}
                      onClick={() => setDisplay("map")}
                    >
                      <Compass size={14} />
                      <span>Explore</span>
                    </button>
                    <button
                      aria-pressed={display === "list"}
                      className={display === "list" ? "active" : ""}
                      onClick={() => setDisplay("list")}
                    >
                      <List size={14} />
                      <span>Artist list</span>
                    </button>
                  </div>
                </div>
                <div className="map-filters">
                  <label>
                    <SlidersHorizontal size={13} />
                    <select
                      aria-label="Filter by genre"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                    >
                      <option>All genres</option>
                      {genreGroups.map((g) => (
                        <option key={g.name}>{g.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <Library size={13} />
                    <select
                      aria-label="Filter by playlist"
                      value={playlistId}
                      onChange={(e) => setPlaylistId(e.target.value)}
                    >
                      <option value="">All playlists & listening</option>
                      {collection.playlists.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(genre !== "All genres" || playlistId || query) && (
                    <button className="text-button" onClick={clearFilters}>
                      Clear filters <X size={12} />
                    </button>
                  )}
                  <div className="dimension-control">
                    {(["2D", "3D"] as const).map((v) => (
                      <button
                        key={v}
                        className={mode === v ? "active" : ""}
                        aria-pressed={mode === v}
                        onClick={() => {
                          setMode(v);
                          setDisplay("map");
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="map-body">
                  <div className="map-stage">
                    {display === "map" ? (
                      <Constellation
                        data={graph}
                        selected={selected?.id || ""}
                        visible={visibleIds}
                        theme={theme}
                        mode={mode}
                        onSelect={selectArtist}
                      />
                    ) : (
                      <div className="artist-list">
                        <div className="artist-list-heading">
                          <span>ARTIST</span>
                          <span>GENRE</span>
                          <span>SONGS</span>
                        </div>
                        {rankedArtists.slice(0, limit).map((a, i) => (
                          <button
                            key={a.id}
                            className={selected?.id === a.id ? "selected" : ""}
                            onClick={() => setSelectedId(a.id)}
                          >
                            <span className="artist-list-name">
                              <small>{String(i + 1).padStart(2, "0")}</small>
                              <Artwork image={a.image} name={a.name} round />
                              <strong>{a.name}</strong>
                            </span>
                            <span>{genreFor(a).name}</span>
                            <span>{tracksByArtist.get(a.id)?.length || 0}</span>
                          </button>
                        ))}
                        {rankedArtists.length > limit && (
                          <button
                            className="load-more"
                            onClick={() => setLimit(limit + 60)}
                          >
                            Show more artists <ChevronDown size={14} />
                          </button>
                        )}
                      </div>
                    )}
                    {!matchingArtists.length && (
                      <div className="empty-state">
                        <Search size={28} />
                        <h3>No artists in this view</h3>
                        <p>
                          Try another search, genre, playlist, or listening
                          period.
                        </p>
                        <button
                          className="secondary-button"
                          onClick={clearFilters}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                    <div className="map-legend">
                      <span>GENRE WORLDS</span>
                      {genreGroups
                        .filter((g) => g.name !== "Unclassified")
                        .slice(0, 6)
                        .map((g) => (
                          <button
                            key={g.name}
                            onClick={() =>
                              setGenre(genre === g.name ? "All genres" : g.name)
                            }
                            className={genre === g.name ? "active" : ""}
                          >
                            <i
                              style={{
                                background:
                                  theme === "dark" ? g.color : g.light,
                              }}
                            />
                            {g.name
                              .replace(" & alternative", "")
                              .replace(" & acoustic", "")}
                          </button>
                        ))}
                    </div>
                  </div>
                  <aside
                    className="artist-inspector"
                    aria-label="Artist details"
                  >
                    {selected ? (
                      <>
                        <div className="inspector-kicker">
                          <span>
                            <span className="green-dot" /> IN FOCUS
                          </span>
                          <AudioLines size={14} />
                        </div>
                        <div className="artist-portrait">
                          <Artwork
                            image={selected.image || selectedTracks[0]?.image}
                            name={selected.name}
                            round
                          />
                        </div>
                        <span className="artist-type">ARTIST</span>
                        <h2>{selected.name}</h2>
                        <div className="artist-tags">
                          {(selected.genres.length
                            ? selected.genres.slice(0, 3)
                            : ["Unclassified"]
                          ).map((g) => (
                            <span key={g}>{g}</span>
                          ))}
                        </div>
                        <div className="artist-summary">
                          <span>
                            <b>{selectedTracks.length}</b> songs in view
                          </span>
                          <span>
                            <b>
                              {
                                new Set(
                                  selectedTracks.map(
                                    (t) => t.albumId || t.album,
                                  ),
                                ).size
                              }
                            </b>{" "}
                            albums
                          </span>
                        </div>
                        <a
                          className="spotify-button"
                          href={selected.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <AudioLines size={15} /> Open artist in Spotify{" "}
                          <ArrowUpRight size={15} />
                        </a>
                        <div className="inspector-tracks">
                          <div className="section-kicker">
                            FROM YOUR COLLECTION
                          </div>
                          {selectedTracks.slice(0, 3).map((t) => (
                            <a
                              key={t.id}
                              href={t.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Artwork image={t.image} name={t.album} />
                              <span>
                                <strong>{t.name}</strong>
                                <small>{t.album}</small>
                              </span>
                              <ArrowUpRight size={13} />
                            </a>
                          ))}
                          {!selectedTracks.length && (
                            <p>
                              This artist appears in your top artists. No tracks
                              by them were returned for this period.
                            </p>
                          )}
                        </div>
                        <button
                          className="discover-button"
                          onClick={() => {
                            const i = rankedArtists.findIndex(
                              (a) => a.id === selected.id,
                            );
                            setSelectedId(
                              rankedArtists[(i + 1) % rankedArtists.length]
                                ?.id || "",
                            );
                          }}
                        >
                          <Shuffle size={14} /> Discover another artist{" "}
                          <ChevronRight size={13} />
                        </button>
                        <p className="metadata-note">
                          {selected.genreSource ? (
                            <>
                              {selected.genreSource}
                              {selected.genreUrl && (
                                <>
                                  {" "}
                                  ·{" "}
                                  <a
                                    href={selected.genreUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View tags <ExternalLink size={9} />
                                  </a>
                                </>
                              )}
                            </>
                          ) : (
                            "No genre tags available for this artist."
                          )}
                        </p>
                      </>
                    ) : (
                      <div className="inspector-placeholder">
                        <Orbit size={35} />
                        <h3>A world to discover.</h3>
                        <p>
                          Select an artist to explore their songs, albums, and
                          genre tags.
                        </p>
                      </div>
                    )}
                  </aside>
                </div>
              </section>
              <div className="map-footnote">
                <span>
                  Each dot is an artist. Lines connect shared genre tags.
                </span>
                <button onClick={() => setModal({ type: "help" })}>
                  About this collection <HelpCircle size={12} />
                </button>
              </div>
              <section className="album-shelf">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      KEEP THE GOOD ONES CLOSE
                    </span>
                    <h2>Records in your orbit</h2>
                  </div>
                  <button onClick={() => navigate("Albums")}>
                    All albums <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="shelf-grid">
                  {filteredAlbums.slice(0, 6).map((a) => (
                    <button
                      className="album-card"
                      key={a.id}
                      onClick={() => setModal({ type: "album", id: a.id })}
                    >
                      <Artwork image={a.image} name={a.name} />
                      <strong>{a.name}</strong>
                      <small>{a.artist}</small>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "Genres" && (
            <section>
              <div className="section-heading">
                <h2>
                  Your genre worlds <span>{genreGroups.length}</span>
                </h2>
                <span className="muted">
                  Provider tags, grouped into broad families
                </span>
              </div>
              <div className="genre-grid">
                {genreGroups
                  .filter(
                    (g) =>
                      !q ||
                      g.name.toLowerCase().includes(q) ||
                      g.artists.some((a) => a.name.toLowerCase().includes(q)),
                  )
                  .map((g, i) => (
                    <button
                      className="genre-card"
                      key={g.name}
                      style={
                        {
                          "--genre-color": theme === "dark" ? g.color : g.light,
                        } as React.CSSProperties
                      }
                      onClick={() => exploreGenre(g.name)}
                    >
                      <span className="genre-card-top">
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <ArrowUpRight size={20} />
                      </span>
                      <div className="genre-artists">
                        {g.artists.slice(0, 3).map((a) => (
                          <Artwork
                            key={a.id}
                            image={a.image}
                            name={a.name}
                            round
                          />
                        ))}
                      </div>
                      <h2>{g.name}</h2>
                      <p>
                        {formatNumber(g.artists.length)} artists <span>·</span>{" "}
                        {g.name === "Unclassified"
                          ? "Tags not yet available"
                          : "Explore this world"}
                      </p>
                    </button>
                  ))}
              </div>
              <p className="collection-explanation">
                Genre families are a navigation aid. Artists can span several
                styles; original Spotify and Last.fm tags remain visible in
                artist details.
              </p>
            </section>
          )}
          {(view === "Albums" || view === "Playlists") && (
            <section>
              <div className="section-heading">
                <h2>
                  {view === "Albums"
                    ? "Your album collection"
                    : "Made for your moments"}{" "}
                  <span>{formatNumber(shownCount)}</span>
                </h2>
                <span className="muted">
                  {view === "Albums"
                    ? "Albums represented in the available songs"
                    : "Current playlists · not time filtered"}
                </span>
              </div>
              <div className="collection-grid">
                {(view === "Albums" ? filteredAlbums : filteredPlaylists)
                  .slice(0, limit)
                  .map((item) => (
                    <button
                      className="album-card"
                      key={item.id}
                      onClick={() =>
                        setModal({
                          type: view === "Albums" ? "album" : "playlist",
                          id: item.id,
                        })
                      }
                    >
                      <div className="artwork-wrapper">
                        <Artwork image={item.image} name={item.name} />
                        <span className="artwork-action">
                          <ArrowUpRight size={21} />
                        </span>
                      </div>
                      <strong>{item.name}</strong>
                      <small>
                        {"artist" in item
                          ? item.artist
                          : formatNumber(item.totalTracks) + " songs"}
                      </small>
                    </button>
                  ))}
              </div>
              {!shownCount && (
                <div className="empty-panel">
                  <Library size={32} />
                  <h3>
                    {query
                      ? "No matches found"
                      : view === "Playlists"
                        ? "No playlists in this source"
                        : "No albums in this period"}
                  </h3>
                  <p>
                    {view === "Playlists" && collection.source === "import"
                      ? "Streaming history contains listening events, not playlists. Return to your Spotify snapshot to browse playlists."
                      : "Try a different search or listening period."}
                  </p>
                </div>
              )}
              {shownCount > limit && (
                <button
                  className="load-more"
                  onClick={() => setLimit(limit + 60)}
                >
                  Load more {view.toLowerCase()} <ChevronDown size={15} />
                </button>
              )}
            </section>
          )}
          {view === "Songs" && (
            <section className="songs-section">
              <div className="section-heading">
                <h2>
                  Your songs <span>{formatNumber(filteredSongs.length)}</span>
                </h2>
                <span className="muted">{timeLabel(period)}</span>
              </div>
              <div className="song-table">
                <div className="song-table-head">
                  <span>#</span>
                  <span>TITLE</span>
                  <span>ALBUM</span>
                  <span>DURATION</span>
                </div>
                {filteredSongs.slice(0, limit).map((t, i) => (
                  <a
                    className="song-row"
                    key={t.id}
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{i + 1}</span>
                    <span>
                      <Artwork image={t.image} name={t.album} />
                      <span>
                        <strong>{t.name}</strong>
                        <small>{t.artist}</small>
                      </span>
                    </span>
                    <span>{t.album}</span>
                    <span>
                      {t.duration ? (
                        Math.floor(t.duration / 60000) +
                        ":" +
                        String(Math.floor(t.duration / 1000) % 60).padStart(
                          2,
                          "0",
                        )
                      ) : (
                        <ArrowUpRight size={14} />
                      )}
                    </span>
                  </a>
                ))}
              </div>
              {!filteredSongs.length && (
                <div className="empty-panel">
                  <Search size={28} />
                  <h3>No songs found</h3>
                  <p>Try another search or listening period.</p>
                </div>
              )}
              {filteredSongs.length > limit && (
                <button
                  className="load-more"
                  onClick={() => setLimit(limit + 60)}
                >
                  Load more songs <ChevronDown size={15} />
                </button>
              )}
            </section>
          )}
          <footer>
            <span>
              <AudioLines size={13} /> Made for the way you listen.
            </span>
            <span>
              Play It Back <i /> Your collection, a little closer.
            </span>
          </footer>
        </main>
      </div>
      {modal?.type === "help" && (
        <Dialog
          title="A little guide to your music."
          onClose={() => setModal(null)}
        >
          <div className="guide-steps">
            <div>
              <Orbit />
              <span>
                <strong>Start with an artist</strong>Each dot is an artist. Drag
                to turn the 3D constellation, scroll to zoom, or switch to 2D.
                Artist list works with a keyboard.
              </span>
            </div>
            <div>
              <Layers3 />
              <span>
                <strong>Follow a genre</strong>Colors represent broad genre
                families. Lines connect artists with a shared original genre
                tag. Missing tags stay unclassified.
              </span>
            </div>
            <div>
              <Disc3 />
              <span>
                <strong>Go deeper into your collection</strong>Open albums and
                playlists to browse their songs, or use a playlist to focus the
                constellation.
              </span>
            </div>
          </div>
          <div className="source-explanation">
            <strong>What the time filters mean</strong>
            <p>
              {collection.source === "import"
                ? "Your imported plays are filtered to the last 28 days or 183 days relative to today. All available includes your entire imported history."
                : "4 weeks and 6 months use Spotify’s top artists and tracks for each period. All available combines retrieved top lists and playlist songs. It is not a complete lifetime play history."}
            </p>
            <p>
              Albums shown are represented in the available songs, rather than
              your saved-album library. Playlists show your current collection
              and are not time filtered.
            </p>
            {collection.source === "spotify" && (
              <p>
                Liked songs and saved albums need additional Spotify
                authorization.{" "}
                {collection.status.tracks_long_term?.complete === false
                  ? "The long-term track snapshot is capped; import history to include older listening."
                  : ""}
              </p>
            )}
            <p>
              Genre tags come from Spotify and public Last.fm community tags.
              More niche artists may have no metadata yet.
            </p>
          </div>
          <button
            className="spotify-button"
            onClick={() => setModal({ type: "import" })}
          >
            <Upload size={15} /> Bring in your full history{" "}
            <ArrowUpRight size={15} />
          </button>
        </Dialog>
      )}
      {modal?.type === "import" && (
        <Dialog
          title="Your story. From the beginning."
          onClose={() => {
            if (!importing) setModal(null);
          }}
        >
          <p className="dialog-intro">
            Bring years of Spotify listening into one collection. Your files are
            processed on this device.
          </p>
          <div className="import-steps">
            <span>01</span>
            <p>
              Request <strong>Extended streaming history</strong> from your{" "}
              <a
                href="https://www.spotify.com/account/privacy/"
                target="_blank"
                rel="noreferrer"
              >
                Spotify privacy settings <ArrowUpRight size={12} />
              </a>
              .
            </p>
            <span>02</span>
            <p>
              When Spotify sends your download, choose the ZIP or its
              streaming-history JSON files below.
            </p>
          </div>
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
            disabled={importing}
            onClick={() => fileInput.current?.click()}
          >
            {importing ? (
              <LoaderCircle className="spinning" size={30} />
            ) : (
              <Upload size={30} />
            )}
            <strong>
              {importing ? progress : "Choose your history files"}
            </strong>
            <span>ZIP or JSON · stays in this browser</span>
          </button>
          {importError && (
            <p className="form-error" role="alert">
              {importError}
            </p>
          )}
          <p className="metadata-note">
            Only music metadata and play dates are retained. Plays shorter than
            30 seconds are excluded. Imports are saved locally in this browser,
            never uploaded. Unknown artists keep their names even when artwork
            and genres are unavailable.
          </p>
          {collection.source === "import" && (
            <button
              className="secondary-button"
              disabled={importing}
              onClick={removeImport}
            >
              <ArrowLeft size={14} /> Remove import and return to Spotify
              snapshot
            </button>
          )}
        </Dialog>
      )}
      {(album || playlist) && (
        <Dialog
          title={album?.name || playlist!.name}
          onClose={() => setModal(null)}
          wide
        >
          <div className="collection-detail-heading">
            <Artwork
              image={album?.image || playlist?.image}
              name={album?.name || playlist!.name}
            />
            <div>
              <div className="eyebrow">{album ? "ALBUM" : "PLAYLIST"}</div>
              <h3>{album?.name || playlist!.name}</h3>
              <p>
                {album?.artist ||
                  formatNumber(playlist!.totalTracks) + " songs"}
                {album?.releaseDate
                  ? " · " + album.releaseDate.slice(0, 4)
                  : ""}
              </p>
              <a
                className="spotify-button"
                href={album?.url || playlist!.url}
                target="_blank"
                rel="noreferrer"
              >
                Open in Spotify <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
          {playlist && playlist.accessible && (
            <button
              className="playlist-map-button"
              onClick={() => {
                setPlaylistId(playlist.id);
                setPeriod("all");
                setGenre("All genres");
                setQuery("");
                setView("Constellation");
                setModal(null);
              }}
            >
              <Orbit size={16} /> Explore this playlist’s artists{" "}
              <ArrowUpRight size={15} />
            </button>
          )}
          <div className="detail-track-list">
            {detailTracks.map((t, i) => (
              <a key={t.id} href={t.url} target="_blank" rel="noreferrer">
                <span>{i + 1}</span>
                <Artwork image={t.image} name={t.album} />
                <span>
                  <strong>{t.name}</strong>
                  <small>{t.artist}</small>
                </span>
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
          {!detailTracks.length && (
            <p className="empty-copy">
              {playlist && !playlist.accessible
                ? "Spotify did not allow access to this playlist’s contents. You can still open it in Spotify."
                : "No songs from this album are present in the snapshot."}
            </p>
          )}
          {album && (
            <p className="metadata-note">
              Showing {detailTracks.length} songs available in this collection
              {album.totalTracks
                ? " of " + album.totalTracks + " album tracks"
                : ""}
              .
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
