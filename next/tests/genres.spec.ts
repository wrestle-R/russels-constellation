import { test, expect } from "@playwright/test";
import { genreFor, genres } from "../lib/music";
import { buildConstellation } from "../lib/constellation";
const family = (...tags: string[]) =>
  genreFor({ id: "a", name: "Artist", url: "", genres: tags }).name;

test("specific genre tags replace the geographic catch-all without guessing nationality", () => {
  expect(genres.some((g) => g.name === "Global")).toBe(false);
  expect(family("bollywood", "hindi", "soundtrack")).toBe("Bollywood");
  expect(family("indian indie", "hindi indie")).toBe("Indie & alternative");
  expect(family("pop", "indie acoustic pop")).toBe("Indie & alternative");
  expect(family("desi hip hop", "indian indie")).toBe("Hip-hop");
  expect(family("punjabi", "bhangra")).toBe("Bollywood");
  expect(family("tamil", "soundtrack")).toBe("Bollywood");
  expect(family("afrobeats", "hip hop")).toBe("Afrobeats");
  expect(family("latin pop", "reggaeton")).toBe("Reggae");
  expect(family("reggae", "dancehall")).toBe("Reggae");
  expect(family("j-pop")).toBe("Pop");
  expect(family("carnatic", "classical")).toBe("Jazz & classical");
  expect(family("soundtrack")).toBe("Jazz & classical");
  expect(family("indian pop")).toBe("Pop");
  expect(family("qawwali")).toBe("Bollywood");
  expect(family("amapiano")).toBe("Electronic");
  expect(family("dub techno")).toBe("Electronic");
  expect(family("country: dominica")).toBe("Unclassified");
  expect(family()).toBe("Unclassified");
});

test("every named genre has a valid overlapping home", () => {
  const artists = genres
    .filter((g) => g.name !== "Unclassified")
    .map((g, i) => ({
      id: String(i),
      name: g.name,
      url: "",
      genres: [
        g.name === "Jazz & classical" ? "soundtrack" : g.name.toLowerCase(),
      ],
    }));
  const tracks = artists.map((a) => ({
    id: a.id,
    name: "Song",
    artist: a.name,
    artistId: a.id,
    artistIds: [a.id],
    album: "Album",
    url: "",
  }));
  const graph = buildConstellation(artists, tracks);
  expect(graph.nodes).toHaveLength(artists.length);
  expect(graph.nodes.every((n) => Number.isFinite(n.x + n.y + n.z))).toBe(true);
});
