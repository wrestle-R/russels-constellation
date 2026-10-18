import { genreFor, recordedPlayCounts, type Collection } from "./music";

// Only the all-time canvas and song details cross the server/client boundary.
// Artwork stays behind its on-demand route; original metadata stays on disk.
export type CollectionView = {
  artists: [id: string, name: string, genres: string[]][];
  tracks: [
    id: string,
    name: string,
    artistId: string,
    album: string,
    url: string,
    duration: number | null,
  ][];
  counts: Record<string, number>;
};
export function collectionView(collection: Collection): CollectionView {
  const artists = collection.artists.filter(
    (a) => genreFor(a).name !== "Unclassified",
  );
  const ids = new Set(artists.map((a) => a.id));
  return {
    artists: artists.map((a) => [a.id, a.name, a.genres]),
    tracks: collection.tracks.flatMap((t) => {
      const owner = t.artistId || t.artistIds?.[0] || "";
      return ids.has(owner)
        ? [
            [
              t.id,
              t.name,
              owner,
              t.album,
              t.url,
              t.duration ?? null,
            ] as CollectionView["tracks"][number],
          ]
        : [];
    }),
    counts: recordedPlayCounts(collection, "all"),
  };
}
export function expandCollection(view: CollectionView): Collection {
  const artists = view.artists.map(([id, name, genres]) => ({
    id,
    name,
    genres,
    url: "",
  }));
  const names = new Map(artists.map((a) => [a.id, a.name]));
  return {
    version: 2,
    source: "import",
    fetchedAt: "",
    artists,
    tracks: view.tracks.map(([id, name, artistId, album, url, duration]) => ({
      id,
      name,
      artistId,
      artist: names.get(artistId) || "",
      album,
      url,
      ...(duration === null ? {} : { duration }),
    })),
    albums: [],
    playlists: [],
    top: {},
    status: {},
    playCountSnapshot: { all: view.counts, short_term: {}, medium_term: {} },
  };
}
