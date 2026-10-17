import { test, expect } from "@playwright/test";
import { buildConstellation, playShade } from "../lib/constellation";
import {
  recordedPlayCounts,
  tracksForPeriod,
  type Artist,
  type Track,
  type Collection,
} from "../lib/music";
const artists: Artist[] = [
  { id: "a", name: "A", genres: ["pop", "soul"], url: "" },
  { id: "b", name: "B", genres: ["pop"], url: "" },
  { id: "c", name: "C", genres: ["rock"], url: "" },
];
const tracks: Track[] = ["a1", "a2", "a3", "b1", "b2", "c1"].map((id) => ({
  id,
  name: id,
  artist: id[0],
  artistId: id[0],
  artistIds: [id[0]],
  album: "Album",
  url: "",
}));
test("songs connect within their artist, including when unrelated artists share genres", () => {
  const graph = buildConstellation(artists, tracks);
  expect(graph.nodes).toHaveLength(6);
  expect(graph.edges).toHaveLength(3);
  for (const [a, b] of graph.edges)
    expect(graph.nodes[a].artist.id).toBe(graph.nodes[b].artist.id);
  for (const artist of artists) {
    const owned = graph.nodes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.artist.id === artist.id)
      .map(({ i }) => i);
    const reached = new Set([owned[0]]);
    let progress = true;
    while (progress) {
      progress = false;
      for (const [a, b] of graph.edges) {
        if (reached.has(a) && !reached.has(b)) {
          reached.add(b);
          progress = true;
        }
        if (reached.has(b) && !reached.has(a)) {
          reached.add(a);
          progress = true;
        }
      }
    }
    expect([...reached].sort()).toEqual(owned.sort());
  }
  expect(buildConstellation(artists, tracks)).toEqual(graph);
});
test("recorded events determine counts and darkness, without inventing missing counts", () => {
  const now = Date.parse("2026-10-16T12:00:00Z"),
    recent = "2026-10-15T12:00:00Z",
    older = "2026-06-01T12:00:00Z";
  const collection: Collection = {
    version: 2,
    fetchedAt: "",
    source: "import",
    artists,
    tracks,
    albums: [],
    playlists: [],
    top: {},
    status: {},
    plays: [
      { trackId: "a1", playedAt: recent },
      { trackId: "a1", playedAt: recent },
      { trackId: "a1", playedAt: older },
      { trackId: "a2", playedAt: recent },
      { trackId: "b1", playedAt: "2027-01-01T00:00:00Z" },
    ],
  };
  expect(recordedPlayCounts(collection, "all", now).a1).toBe(2);
  expect(recordedPlayCounts(collection, "short_term", now).a1).toBe(1);
  expect(recordedPlayCounts(collection, "medium_term", now).a1).toBe(2);
  expect(recordedPlayCounts(collection, "all", now).b1).toBe(0);
  const partial = {
    ...collection,
    source: "spotify" as const,
    recent: [{ trackId: "a1", playedAt: recent }],
  };
  expect(recordedPlayCounts(partial, "all", now).a2).toBeUndefined();
  expect(playShade(20, 20)).toBeLessThan(playShade(5, 20));
  expect(playShade(5, 20)).toBeLessThan(playShade(1, 20));
  expect(playShade(undefined, 20)).not.toBe(playShade(0, 20));
});

test("hosted aggregate counts retain period-specific values without raw listening events", () => {
  const collection: Collection = {
    version: 2,
    fetchedAt: "",
    source: "spotify",
    artists: [],
    tracks: [],
    albums: [],
    playlists: [],
    top: {},
    status: {},
    playCountSnapshot: {
      all: { song: 7 },
      short_term: { song: 2 },
      medium_term: { song: 4 },
    },
  };
  expect(recordedPlayCounts(collection, "all")).toEqual({ song: 7 });
  expect(recordedPlayCounts(collection, "short_term")).toEqual({ song: 2 });
  expect(recordedPlayCounts(collection, "medium_term")).toEqual({ song: 4 });
});

test("published history uses aggregate counts when the private event timeline is absent", () => {
  const collection: Collection = {
    version: 2,
    source: "import",
    fetchedAt: "",
    artists,
    tracks,
    albums: [],
    playlists: [],
    top: {},
    status: {},
    playCountSnapshot: {
      all: { a1: 20, a2: 3 },
      short_term: { a2: 3 },
      medium_term: { a1: 4, a2: 3 },
    },
  };
  expect(recordedPlayCounts(collection, "all")).toEqual({ a1: 20, a2: 3 });
  expect(tracksForPeriod(collection, "short_term").map((t) => t.id)).toEqual([
    "a2",
  ]);
  expect(tracksForPeriod(collection, "medium_term").map((t) => t.id)).toEqual([
    "a1",
    "a2",
  ]);
});
