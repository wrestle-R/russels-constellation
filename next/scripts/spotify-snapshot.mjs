import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(
    process.argv[2] || process.env.SPOTIFY_CREDENTIALS_DIR || ".",
  ),
  env = {};
for (const name of [".env", ".env.local"]) {
  const raw = await fs.readFile(path.join(root, name), "utf8").catch(() => "");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?(SPOTIFY_\w+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const trackMap = new Map(),
  artistMap = new Map(),
  albumMap = new Map(),
  status = {};
function addArtist(a) {
  if (!a?.id) return;
  const old = artistMap.get(a.id);
  artistMap.set(a.id, {
    id: a.id,
    name: a.name,
    image: a.images?.[0]?.url || old?.image,
    url: a.external_urls?.spotify || `https://open.spotify.com/artist/${a.id}`,
    genres: a.genres?.length ? a.genres : old?.genres || [],
    genreSource: a.genres?.length ? "Spotify" : old?.genreSource,
  });
}
function addAlbum(a) {
  if (!a?.id) return;
  albumMap.set(a.id, {
    id: a.id,
    name: a.name,
    artist: (a.artists || []).map((a) => a.name).join(", "),
    artistIds: (a.artists || []).map((a) => a.id),
    image: a.images?.[0]?.url,
    url: a.external_urls?.spotify || `https://open.spotify.com/album/${a.id}`,
    releaseDate: a.release_date,
    totalTracks: a.total_tracks,
  });
}
function addTrack(t) {
  if (!t?.id || t.type === "episode") return;
  (t.artists || []).forEach(addArtist);
  addAlbum(t.album);
  const old = trackMap.get(t.id);
  trackMap.set(t.id, {
    ...old,
    id: t.id,
    name: t.name,
    artist: (t.artists || []).map((a) => a.name).join(", "),
    artistId: t.artists?.[0]?.id,
    artistIds: (t.artists || []).map((a) => a.id),
    album: t.album?.name || old?.album || "",
    albumId: t.album?.id || old?.albumId,
    image: t.album?.images?.[0]?.url || old?.image,
    url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
    duration: t.duration_ms,
  });
}
try {
  if (
    !env.SPOTIFY_CLIENT_ID ||
    !env.SPOTIFY_CLIENT_SECRET ||
    !env.SPOTIFY_REFRESH_TOKEN
  )
    throw new Error(
      "Provide the directory containing authorized Spotify credentials as the command argument or SPOTIFY_CREDENTIALS_DIR.",
    );
  const auth = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          env.SPOTIFY_CLIENT_ID + ":" + env.SPOTIFY_CLIENT_SECRET,
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.SPOTIFY_REFRESH_TOKEN || "",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!auth.ok) throw new Error("Token refresh HTTP " + auth.status);
  const token = await auth.json();
  console.log("Granted permissions: " + (token.scope || "not returned"));
  async function get(url) {
    const endpoint = url.startsWith("https://api.spotify.com/v1/")
      ? url
      : "https://api.spotify.com/v1" + url;
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(endpoint, {
        headers: { Authorization: "Bearer " + token.access_token },
        signal: AbortSignal.timeout(18000),
      });
      if (res.status < 500) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!res.ok)
      throw new Error(
        "HTTP " +
          res.status +
          (res.status === 403 ? " (permission unavailable)" : ""),
      );
    return res.json();
  }
  async function pages(url, key, limit = Infinity) {
    let result = [],
      next = url;
    while (next && result.length < limit) {
      const d = await get(next);
      result.push(...(d.items || []));
      next = d.next;
      if (!d.items?.length) break;
    }
    status[key] = { ok: true, count: result.length, complete: !next };
    return result;
  }
  async function safe(key, fn) {
    try {
      return await fn();
    } catch (e) {
      status[key] = { ok: false, message: e.message };
      console.log(key + ": " + e.message);
      return [];
    }
  }
  const top = {};
  for (const period of ["short_term", "medium_term", "long_term"]) {
    const aa = await safe("artists_" + period, () =>
      pages(
        `/me/top/artists?time_range=${period}&limit=50`,
        "artists_" + period,
      ),
    );
    aa.forEach(addArtist);
    const tt = await safe("tracks_" + period, () =>
      pages(`/me/top/tracks?time_range=${period}&limit=50`, "tracks_" + period),
    );
    tt.forEach(addTrack);
    top[period] = {
      artistIds: aa.map((a) => a.id),
      trackIds: tt.map((t) => t.id),
    };
    console.log(
      period + ": " + aa.length + " top artists, " + tt.length + " top tracks",
    );
  }
  const recent = await safe("recent", async () => {
    const d = await get("/me/player/recently-played?limit=50");
    status.recent = { ok: true, count: d.items?.length || 0 };
    return d.items || [];
  });
  recent.forEach((x) => addTrack(x.track));
  const saved = await safe("savedTracks", () =>
    pages("/me/tracks?limit=50", "savedTracks"),
  );
  saved.forEach((x) => addTrack(x.track));
  const albums = await safe("savedAlbums", () =>
    pages("/me/albums?limit=50", "savedAlbums"),
  );
  albums.forEach((x) => {
    addAlbum(x.album);
    (x.album?.tracks?.items || []).forEach((t) =>
      addTrack({ ...t, album: x.album }),
    );
  });
  const rawPlaylists = await safe("playlists", () =>
    pages("/me/playlists?limit=50", "playlists"),
  );
  const playlists = [];
  for (const p of rawPlaylists.filter(Boolean)) {
    const playlist = {
      id: p.id,
      name: p.name,
      image: p.images?.[0]?.url,
      url: p.external_urls?.spotify,
      totalTracks: p.items?.total ?? p.tracks?.total ?? 0,
      trackIds: [],
    };
    const items = await safe("playlist_" + p.id, () =>
      pages(`/playlists/${p.id}/items?limit=50`, "playlist_" + p.id),
    );
    for (const item of items) {
      const t = item.item || item.track;
      addTrack(t);
      if (t?.id && t.type !== "episode") playlist.trackIds.push(t.id);
    }
    playlist.accessible = status["playlist_" + p.id]?.ok || false;
    playlists.push(playlist);
  }
  const cached = JSON.parse(
    await fs.readFile("data/private-spotify.json", "utf8").catch(() => "{}"),
  );
  for (const a of artistMap.values()) {
    const old = cached.artists?.find((x) => x.id === a.id);
    if (old?.genres?.length && !a.genres.length) {
      a.genres = old.genres;
      a.genreSource = old.genreSource;
      a.genreUrl = old.genreUrl;
    }
    if (!a.image && old?.image) a.image = old.image;
  }
  const pending = [...artistMap.values()]
    .filter((a) => !a.image || !a.genres.length)
    .slice(0, 300);
  let cursor = 0,
    blocked = false;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < pending.length && !blocked) {
        const a = pending[cursor++];
        try {
          addArtist(await get("/artists/" + a.id));
        } catch (e) {
          if (/429|401/.test(e.message)) blocked = true;
        }
      }
    }),
  );
  if (!trackMap.size && !artistMap.size)
    throw new Error(
      "No accessible collection data; existing snapshot preserved",
    );
  const previous = JSON.parse(
    await fs.readFile("data/private-spotify.json", "utf8").catch(() => "{}"),
  );
  const snapshot = {
    version: 2,
    fetchedAt: new Date().toISOString(),
    source: "spotify",
    tracks: [...trackMap.values()],
    artists: [...artistMap.values()],
    albums: [...albumMap.values()],
    playlists,
    top,
    recent: recent.map((x) => ({
      trackId: x.track?.id,
      playedAt: x.played_at,
    })),
    savedTrackIds: saved.map((x) => x.track?.id).filter(Boolean),
    status,
  };
  for (const a of snapshot.artists) {
    const old = previous.artists?.find((x) => x.id === a.id);
    if (!a.genres.length && old?.genres?.length) {
      a.genres = old.genres;
      a.genreSource = old.genreSource;
      a.genreUrl = old.genreUrl;
    }
    if (!a.image && old?.image) a.image = old.image;
  }
  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/private-spotify.json.tmp", JSON.stringify(snapshot));
  await fs.rename("data/private-spotify.json.tmp", "data/private-spotify.json");
  console.log(
    JSON.stringify({
      saved: true,
      tracks: snapshot.tracks.length,
      artists: snapshot.artists.length,
      artistsWithGenres: snapshot.artists.filter((a) => a.genres.length).length,
      albums: snapshot.albums.length,
      playlists: snapshot.playlists.length,
      status,
    }),
  );
} catch (e) {
  console.log("Spotify snapshot unavailable: " + e.message);
  process.exitCode = 1;
}
