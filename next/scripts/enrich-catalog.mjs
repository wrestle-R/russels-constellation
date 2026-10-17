import fs from "node:fs/promises";
// Manual fallback for artists without usable community tags. Only public song
// and artist names are sent; accept a genre only for an exact catalog match.
const file = new URL("../data/private-spotify.json", import.meta.url);
const data = JSON.parse(await fs.readFile(file, "utf8"));
const normalize = (value) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
const tracks = new Map(data.tracks.map((t) => [t.id, t]));
const counts = new Map();
for (const play of data.plays || [])
  counts.set(play.trackId, (counts.get(play.trackId) || 0) + 1);
const artistPlays = new Map();
for (const [id, count] of counts) {
  const artist = tracks.get(id)?.artistId;
  if (artist) artistPlays.set(artist, (artistPlays.get(artist) || 0) + count);
}
const pending = data.artists
  .filter((a) => !a.genres.length && artistPlays.has(a.id))
  .sort((a, b) => artistPlays.get(b.id) - artistPlays.get(a.id))
  .slice(0, Number(process.argv[2]) || 30);
let enriched = 0;
for (const [index, artist] of pending.entries()) {
  const song = data.tracks
    .filter((t) => t.artistId === artist.id)
    .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))[0];
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams({
    term: artist.name + " " + song.name,
    entity: "song",
    media: "music",
    country: "US",
    limit: "10",
  }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.status === 429) {
      console.log(
        "Catalog rate limit reached; remaining artists left unchanged.",
      );
      break;
    }
    if (response.ok) {
      const result = (await response.json()).results.find(
        (row) =>
          normalize(row.artistName || "") === normalize(artist.name) &&
          normalize(row.trackName || "") === normalize(song.name) &&
          row.primaryGenreName,
      );
      if (result) {
        artist.genres = [result.primaryGenreName.toLowerCase()];
        artist.genreSource = "Apple Music matched recording";
        artist.genreUrl = result.trackViewUrl;
        enriched++;
      }
    }
  } catch {
    /* Unverified identities remain unchanged. */
  }
  console.log("Catalog review: " + (index + 1) + "/" + pending.length);
  await new Promise((resolve) => setTimeout(resolve, 3200));
}
await fs.writeFile(file, JSON.stringify(data));
console.log(JSON.stringify({ reviewed: pending.length, enriched }));
