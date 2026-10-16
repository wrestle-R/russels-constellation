export type Period = "all" | "short_term" | "medium_term";
export type Track = {
  id: string;
  name: string;
  artist: string;
  artistId?: string;
  artistIds?: string[];
  album: string;
  albumId?: string;
  image?: string;
  url: string;
  duration?: number;
};
export type Artist = {
  id: string;
  name: string;
  image?: string;
  url: string;
  genres: string[];
  genreSource?: string;
  genreUrl?: string;
};
export type Album = {
  id: string;
  name: string;
  artist: string;
  artistIds: string[];
  image?: string;
  url: string;
  releaseDate?: string;
  totalTracks?: number;
};
export type Playlist = {
  id: string;
  name: string;
  image?: string;
  url: string;
  totalTracks: number;
  trackIds: string[];
  accessible: boolean;
};
export type Play = { trackId: string; playedAt: string };
export type Collection = {
  version: 2;
  fetchedAt: string;
  source: "spotify" | "sample" | "import";
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  top: Record<string, { artistIds: string[]; trackIds: string[] }>;
  status: Record<
    string,
    { ok: boolean; count?: number; complete?: boolean; message?: string }
  >;
  recent?: Play[];
  plays?: Play[];
  savedTrackIds?: string[];
  importedFiles?: number;
};
export const genres = [
  {
    name: "Pop",
    color: "#56d487",
    light: "#16834a",
    match: /pop|boy band|girl group|teen|idol/,
  },
  {
    name: "Indie & alternative",
    color: "#90a7f0",
    light: "#506bb0",
    match: /indie|alternative|bedroom|dream pop|shoegaze/,
  },
  {
    name: "Hip-hop",
    color: "#edb568",
    light: "#a36b19",
    match: /hip.?hop|rap|trap|drill|grime/,
  },
  {
    name: "R&B & soul",
    color: "#e58ab4",
    light: "#b0487d",
    match: /r&b|rnb|soul|funk|motown/,
  },
  {
    name: "Electronic",
    color: "#6ad3cc",
    light: "#15837c",
    match:
      /electro|edm|house|techno|dubstep|trance|ambient|dance|dnb|drum and bass/,
  },
  {
    name: "Rock",
    color: "#ed9280",
    light: "#b24e3d",
    match: /rock|metal|punk|grunge|emo/,
  },
  {
    name: "Folk & acoustic",
    color: "#c9cf81",
    light: "#788120",
    match: /folk|acoustic|singer.songwriter|country|americana/,
  },
  {
    name: "Jazz & classical",
    color: "#bda2df",
    light: "#815da9",
    match: /jazz|classical|orchestra|piano|soundtrack|instrumental/,
  },
  {
    name: "Global",
    color: "#e0b1d1",
    light: "#9d5686",
    match:
      /desi|bollywood|hindi|punjabi|tamil|telugu|indian|afro|latin|reggae|reggaeton|bossa|salsa|[kj]-pop/,
  },
  { name: "Unclassified", color: "#8797a0", light: "#5c6d76", match: /$a/ },
];
// Specific provider tags take precedence over the broad "pop" umbrella.
export function genreFor(a: Artist) {
  for (const tag of a.genres)
    for (const index of [8, 1, 2, 3, 4, 5, 6, 7, 0])
      if (genres[index].match.test(tag.toLowerCase())) return genres[index];
  return genres[9];
}
export function tracksForPeriod(c: Collection, p: Period) {
  if (p === "all") return c.tracks;
  if (c.source === "import") {
    const cutoff = Date.now() - (p === "short_term" ? 28 : 183) * 86400000;
    const ids = new Set(
      c.plays
        ?.filter((x) => Date.parse(x.playedAt) >= cutoff)
        .map((x) => x.trackId),
    );
    return c.tracks.filter((t) => ids.has(t.id));
  }
  const ids = new Set(c.top[p]?.trackIds || []);
  return c.tracks.filter((t) => ids.has(t.id));
}
export function artistsForPeriod(c: Collection, p: Period) {
  if (p === "all") return c.artists;
  const tracks = tracksForPeriod(c, p);
  const ids = new Set(
    c.source === "import"
      ? tracks.flatMap((t) => t.artistIds || [])
      : c.top[p]?.artistIds || [],
  );
  return c.artists.filter((a) => ids.has(a.id));
}
export function artistTracks(c: Collection, id: string) {
  return c.tracks.filter((t) => (t.artistIds || [t.artistId]).includes(id));
}
export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}
export function timeLabel(p: Period) {
  return p === "all"
    ? "All available"
    : p === "short_term"
      ? "4 weeks"
      : "6 months";
}
export const sample: Track[] = [
  "Nights|Frank Ocean|Blonde",
  "Everything In Its Right Place|Radiohead|Kid A",
  "Retrograde|James Blake|Overgrown",
  "Bags|Clairo|Immunity",
  "Nude|Radiohead|In Rainbows",
  "Pink + White|Frank Ocean|Blonde",
  "Holocene|Bon Iver|Bon Iver",
  "Open|Rhye|Woman",
  "Intro|The xx|xx",
  "Reckoner|Radiohead|In Rainbows",
  "White Ferrari|Frank Ocean|Blonde",
  "Hey, Ma|Bon Iver|i,i",
].map((s, i) => {
  const [name, artist, album] = s.split("|");
  return {
    id: "sample-" + i,
    name,
    artist,
    artistId: artist,
    artistIds: [artist],
    album,
    albumId: album,
    url:
      "https://open.spotify.com/search/" +
      encodeURIComponent(name + " " + artist),
  };
});
export function sampleCollection(): Collection {
  const tags: Record<string, string[]> = {
    "Frank Ocean": ["alternative r&b"],
    Radiohead: ["alternative rock"],
    "James Blake": ["electronic"],
    Clairo: ["indie pop"],
    "Bon Iver": ["indie folk"],
    Rhye: ["soul"],
    "The xx": ["indie pop"],
  };
  const artists = [...new Set(sample.map((t) => t.artist))].map((name) => ({
    id: name,
    name,
    url: "https://open.spotify.com/search/" + encodeURIComponent(name),
    genres: tags[name] || [],
    genreSource: "Illustrative sample",
  }));
  return {
    version: 2,
    fetchedAt: "",
    source: "sample",
    tracks: sample,
    artists,
    albums: [
      ...new Map(
        sample.map((t) => [
          t.album,
          {
            id: t.album,
            name: t.album,
            artist: t.artist,
            artistIds: [t.artist],
            url: t.url,
          },
        ]),
      ).values(),
    ],
    playlists: [],
    top: {},
    status: {},
  };
}

export function recordedPlayCounts(
  collection: Collection,
  period: Period,
  now = Date.now(),
) {
  const events =
    collection.source === "import"
      ? collection.plays || []
      : collection.recent || [];
  const cutoff =
    period === "all"
      ? -Infinity
      : now - (period === "short_term" ? 28 : 183) * 86400000;
  const counts: Record<string, number> = {};
  if (collection.source === "import")
    for (const t of collection.tracks) counts[t.id] = 0;
  const seen = new Set<string>();
  for (const event of events) {
    const time = Date.parse(event.playedAt);
    if (!Number.isFinite(time) || time < cutoff || time > now) continue;
    const key = event.trackId + "@" + event.playedAt;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[event.trackId] = (counts[event.trackId] || 0) + 1;
  }
  return counts;
}
