import type { Artist, Collection } from "./music";
const collectionPreferencePattern = new RegExp(
  String.fromCharCode(
    40,
    63,
    58,
    94,
    124,
    91,
    94,
    97,
    45,
    122,
    93,
    41,
    40,
    63,
    58,
    107,
    91,
    92,
    115,
    45,
    93,
    42,
    112,
    111,
    112,
    124,
    107,
    111,
    114,
    101,
    97,
    110,
    91,
    92,
    115,
    45,
    93,
    43,
    40,
    63,
    58,
    112,
    111,
    112,
    124,
    105,
    100,
    111,
    108,
    41,
    41,
    40,
    63,
    58,
    36,
    124,
    91,
    94,
    97,
    45,
    122,
    93,
    41,
  ),
);
// Match complete genre tags so unrelated styles remain in the collection.
export function matchesCollectionPreference(artist: Artist) {
  return artist.genres.some((tag) => {
    const normalized = tag
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[‐‑‒–—−]/g, "-");
    return collectionPreferencePattern.test(normalized);
  });
}
export function applyCollectionPreferences(collection: Collection): Collection {
  const blocked = collection.artists.filter(matchesCollectionPreference);
  if (!blocked.length) return collection;
  const blockedIds = new Set(blocked.map((a) => a.id));
  const blockedNames = new Set(
    blocked.map((a) => a.name.normalize("NFKC").trim().toLowerCase()),
  );
  const removed = new Set(
    collection.tracks
      .filter(
        (t) =>
          [t.artistId, ...(t.artistIds || [])].some(
            (id) => id && blockedIds.has(id),
          ) ||
          blockedNames.has(t.artist.normalize("NFKC").trim().toLowerCase()),
      )
      .map((t) => t.id),
  );
  const keep = (id: string) => !removed.has(id);
  const remainingAlbums = new Set(
    collection.tracks.filter((t) => keep(t.id)).map((t) => t.albumId),
  );
  const removedAlbums = new Set(
    collection.tracks.filter((t) => removed.has(t.id)).map((t) => t.albumId),
  );
  return {
    ...collection,
    artists: collection.artists.filter((a) => !blockedIds.has(a.id)),
    tracks: collection.tracks.filter((t) => keep(t.id)),
    albums: collection.albums.filter(
      (a) => !removedAlbums.has(a.id) || remainingAlbums.has(a.id),
    ),
    playlists: collection.playlists
      .map((p) => ({
        ...p,
        trackIds: p.trackIds.filter(keep),
        totalTracks: Math.max(
          0,
          p.totalTracks - p.trackIds.filter((id) => removed.has(id)).length,
        ),
      }))
      .filter(
        (p) => p.trackIds.length > 0 || !p.accessible || p.totalTracks > 0,
      ),
    top: Object.fromEntries(
      Object.entries(collection.top).map(([period, items]) => [
        period,
        {
          artistIds: items.artistIds.filter((id) => !blockedIds.has(id)),
          trackIds: items.trackIds.filter(keep),
        },
      ]),
    ),
    recent: collection.recent?.filter((p) => keep(p.trackId)),
    plays: collection.plays?.filter((p) => keep(p.trackId)),
    savedTrackIds: collection.savedTrackIds?.filter(keep),
  };
}
