import { readFile, writeFile } from "node:fs/promises";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { recordedPlayCounts, type Collection, type Period } from "../lib/music";
// Explicit manual publication step. Reads only an existing music snapshot,
// never credentials or raw history exports, and never contacts an external API.
async function main() {
  const source = new URL("../data/private-spotify.json", import.meta.url);
  const collection = applyCollectionPreferences(
    JSON.parse(await readFile(source, "utf8")) as Collection,
  );
  const usedArtists = new Set(
    collection.tracks
      .flatMap((t) => [t.artistId, ...(t.artistIds || [])])
      .filter(Boolean),
  );
  const albumImages = new Map(
    collection.tracks
      .filter((t) => t.image)
      .map((t) => [
        (t.artistId || t.artist) + "|" + t.album.trim().toLowerCase(),
        t.image,
      ]),
  );
  const result: Collection = {
    version: 2,
    source: collection.source,
    fetchedAt: collection.fetchedAt,
    tracks: collection.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist,
      artistId: t.artistId,
      artistIds: t.artistIds,
      album: t.album,
      albumId: t.albumId,
      image:
        t.image ||
        albumImages.get(
          (t.artistId || t.artist) + "|" + t.album.trim().toLowerCase(),
        ),
      url: t.url,
      duration: t.duration,
    })),
    artists: collection.artists
      .filter((a) => usedArtists.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        genres: a.genres,
        genreSource: a.genreSource,
        genreUrl: a.genreUrl,
      })),
    albums: [],
    playlists: collection.playlists.map((p) => ({
      id: p.id,
      name: p.name,
      url: p.url,
      totalTracks: p.totalTracks,
      trackIds: p.trackIds,
      accessible: p.accessible,
    })),
    top: collection.top,
    status: {},
    // Publish aggregate counts, not the exact timestamps of private listening.
    playCountSnapshot: Object.fromEntries(
      (["all", "short_term", "medium_term"] as Period[]).map((p) => [
        p,
        recordedPlayCounts(collection, p),
      ]),
    ) as Record<Period, Record<string, number>>,
    recordedEventCount: Object.values(
      recordedPlayCounts(collection, "all"),
    ).reduce((total, count) => total + count, 0),
  };
  await writeFile(
    new URL("../lib/showcase-data.json", import.meta.url),
    JSON.stringify(result),
  );
  console.log(
    JSON.stringify({
      showcaseSaved: true,
      songs: result.tracks.length,
      artists: result.artists.length,
      playlists: result.playlists.length,
      exactListeningTimestampsIncluded: false,
    }),
  );
}
main().catch((error) => {
  console.error("Could not capture showcase: " + error.message);
  process.exitCode = 1;
});
