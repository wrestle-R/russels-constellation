import { unzip } from "fflate";
import {
  type Collection,
  type Artist,
  type Track,
  type Album,
  type Play,
} from "./music";
export async function importHistory(
  files: File[],
  base: Collection,
  progress: (message: string) => void,
): Promise<Collection> {
  const contents: { name: string; text: string }[] = [];
  let totalBytes = 0;
  for (const file of files) {
    if (file.size > 200 * 1024 * 1024)
      throw Error(
        "Choose a file smaller than 200 MB, or import the extracted JSON files.",
      );
    progress("Reading " + file.name + "…");
    if (file.name.toLowerCase().endsWith(".zip")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const entries = await new Promise<Record<string, Uint8Array>>(
        (resolve, reject) =>
          unzip(
            bytes,
            {
              filter: (entry) => {
                const match =
                  /\.json$/i.test(entry.name) &&
                  /streaming.?history|streaming_history_audio/i.test(
                    entry.name,
                  );
                if (match) totalBytes += entry.originalSize;
                return match && totalBytes < 500 * 1024 * 1024;
              },
            },
            (error, result) => (error ? reject(error) : resolve(result)),
          ),
      );
      if (totalBytes >= 500 * 1024 * 1024)
        throw Error(
          "This archive is too large. Import its individual streaming-history JSON files instead.",
        );
      for (const [name, data] of Object.entries(entries))
        contents.push({ name, text: new TextDecoder().decode(data) });
    } else if (file.name.toLowerCase().endsWith(".json"))
      contents.push({ name: file.name, text: await file.text() });
  }
  if (!contents.length)
    throw Error(
      "No Spotify streaming-history JSON files found. Choose your Spotify history ZIP or JSON files.",
    );
  const normalizeArtist = (name: string) =>
    name.normalize("NFKC").trim().toLowerCase();
  const knownArtistsById = new Map(base.artists.map((a) => [a.id, a]));
  const knownArtists = new Map(
      base.artists.map((a) => [normalizeArtist(a.name), a]),
    ),
    knownTracks = new Map(base.tracks.map((t) => [t.id, t]));
  const artists = new Map<string, Artist>(),
    tracks = new Map<string, Track>(),
    albums = new Map<string, Album>(),
    plays: Play[] = [],
    seen = new Set<string>();
  let processed = 0;
  for (const file of contents) {
    progress("Importing " + file.name + "…");
    let rows: unknown;
    try {
      rows = JSON.parse(file.text);
    } catch {
      throw Error(file.name + " is not valid JSON.");
    }
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const name = row.master_metadata_track_name ?? row.trackName,
        artistName = row.master_metadata_album_artist_name ?? row.artistName,
        albumName =
          row.master_metadata_album_album_name || "Album not included";
      const timestamp =
          row.ts ??
          (typeof row.endTime === "string"
            ? row.endTime.replace(" ", "T") + "Z"
            : null),
        ms = Number(row.ms_played ?? row.msPlayed ?? 0);
      if (
        typeof name !== "string" ||
        typeof artistName !== "string" ||
        !timestamp ||
        !Number.isFinite(Date.parse(timestamp)) ||
        ms < 30000
      )
        continue;
      const uri =
        typeof row.spotify_track_uri === "string" ? row.spotify_track_uri : "";
      const id = /^spotify:track:[a-zA-Z0-9]+$/.test(uri)
        ? uri.split(":")[2]
        : "import:" + artistName + ":" + name;
      const playedAt = new Date(timestamp).toISOString();
      const key = id + "@" + playedAt;
      if (seen.has(key)) continue;
      seen.add(key);
      const old = knownTracks.get(id);
      const artist = knownArtists.get(normalizeArtist(artistName)) || {
        id: "import:" + artistName.toLowerCase(),
        name: artistName,
        url:
          "https://open.spotify.com/search/" + encodeURIComponent(artistName),
        genres: [],
      };
      artists.set(artist.id, artist);
      const artistIds = [...new Set([artist.id, ...(old?.artistIds || [])])];
      for (const id of artistIds) {
        const credited = knownArtistsById.get(id);
        if (credited) artists.set(id, credited);
      }
      const albumId = old?.albumId || "import:" + artistName + ":" + albumName;
      const track: Track = old
        ? {
            ...old,
            artist: artistName,
            artistId: artist.id,
            artistIds,
          }
        : {
            id,
            name,
            artist: artistName,
            artistId: artist.id,
            artistIds,
            album: albumName,
            albumId,
            url: uri
              ? "https://open.spotify.com/track/" + id
              : "https://open.spotify.com/search/" +
                encodeURIComponent(name + " " + artistName),
          };
      tracks.set(id, track);
      albums.set(albumId, {
        id: albumId,
        name: track.album,
        artist: artistName,
        artistIds: [artist.id],
        image: track.image,
        url:
          "https://open.spotify.com/search/" +
          encodeURIComponent(track.album + " " + artistName),
      });
      plays.push({ trackId: id, playedAt });
      processed++;
      if (processed % 4000 === 0) {
        progress("Read " + processed.toLocaleString() + " listening events…");
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }
  if (!plays.length)
    throw Error(
      "No music plays of at least 30 seconds found. Choose Spotify streaming-history files.",
    );
  return {
    version: 2,
    source: "import",
    fetchedAt: new Date().toISOString(),
    artists: [...artists.values()],
    tracks: [...tracks.values()],
    albums: [...albums.values()],
    playlists: [],
    top: {},
    status: {},
    plays,
    importedFiles: contents.length,
  };
}
function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("play-it-back-local", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("collection");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveImport(collection: Collection | null) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("collection", "readwrite");
      const store = tx.objectStore("collection");
      if (collection) store.put(collection, "history");
      else store.delete("history");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function loadImport(): Promise<Collection | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("collection")
      .objectStore("collection")
      .get("history");
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}
