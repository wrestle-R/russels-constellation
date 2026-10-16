import { test, expect } from "@playwright/test";
import {
  matchesCollectionPreference,
  applyCollectionPreferences,
} from "../lib/collection-exclusions";
import { type Artist, type Collection } from "../lib/music";
const artist = (id: string, tags: string[]): Artist => ({
  id,
  name: id,
  genres: tags,
  url: "",
});
test("collection preferences use genre boundaries and preserve unrelated styles", () => {
  for (const tag of [
    "\u006b-pop",
    "\u004bPOP",
    "\u006b pop",
    "\u004b‑pop",
    "\u006borean pop",
    "\u006borean idol",
    "alternative \u006b-pop",
  ])
    expect(matchesCollectionPreference(artist("a", [tag]))).toBe(true);
  for (const tag of [
    "folk pop",
    "dark pop",
    "UK pop",
    "punk pop",
    "dansk pop",
    "j-pop",
    "rock",
    "pop",
  ])
    expect(matchesCollectionPreference(artist("a", [tag]))).toBe(false);
});
test("applies preferences to collaborations, playlists, top lists and events without changing the source", () => {
  const collection: Collection = {
    version: 2,
    fetchedAt: "",
    source: "spotify",
    artists: [artist("pop", ["pop"]), artist("idol", ["\u006b-pop"])],
    tracks: [
      {
        id: "keep",
        name: "Keep",
        artist: "pop",
        artistId: "pop",
        artistIds: ["pop"],
        album: "Album",
        albumId: "album",
        url: "",
      },
      {
        id: "remove",
        name: "Remove",
        artist: "idol",
        artistId: "idol",
        artistIds: ["idol"],
        album: "Excluded album",
        albumId: "excluded-album",
        url: "",
      },
      {
        id: "collab",
        name: "Collab",
        artist: "pop, idol",
        artistId: "pop",
        artistIds: ["pop", "idol"],
        album: "Album",
        albumId: "album",
        url: "",
      },
    ],
    albums: [
      {
        id: "album",
        name: "Album",
        artist: "pop",
        artistIds: ["pop"],
        url: "",
      },
      {
        id: "excluded-album",
        name: "Excluded album",
        artist: "idol",
        artistIds: ["idol"],
        url: "",
      },
    ],
    playlists: [
      {
        id: "mix",
        name: "Mix",
        url: "",
        totalTracks: 3,
        trackIds: ["keep", "remove", "collab"],
        accessible: true,
      },
    ],
    top: {
      short_term: {
        artistIds: ["pop", "idol"],
        trackIds: ["keep", "remove", "collab"],
      },
    },
    recent: [{ trackId: "remove", playedAt: "2026-10-16T00:00:00Z" }],
    plays: [{ trackId: "collab", playedAt: "2026-10-16T00:00:00Z" }],
    savedTrackIds: ["keep", "remove"],
    status: {},
  };
  const original = JSON.stringify(collection),
    filtered = applyCollectionPreferences(collection);
  expect(filtered.tracks.map((t) => t.id)).toEqual(["keep"]);
  expect(filtered.artists.map((a) => a.id)).toEqual(["pop"]);
  expect(filtered.albums.map((a) => a.id)).toEqual(["album"]);
  expect(filtered.playlists[0].trackIds).toEqual(["keep"]);
  expect(filtered.playlists[0].totalTracks).toBe(1);
  expect(filtered.top.short_term).toEqual({
    artistIds: ["pop"],
    trackIds: ["keep"],
  });
  expect(filtered.recent).toEqual([]);
  expect(filtered.plays).toEqual([]);
  expect(filtered.savedTrackIds).toEqual(["keep"]);
  expect(JSON.stringify(collection)).toBe(original);
  expect(applyCollectionPreferences(filtered)).toEqual(filtered);
});
