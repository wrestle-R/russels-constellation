import fs from "node:fs/promises";
// Public community tags. Only public artist names are queried.
const file = new URL("../data/private-spotify.json", import.meta.url),
  data = JSON.parse(await fs.readFile(file, "utf8"));
const counts = new Map();
for (const t of data.tracks)
  for (const id of t.artistIds || []) counts.set(id, (counts.get(id) || 0) + 1);
const ranks = new Set(data.top.medium_term?.artistIds || []);
const pending = data.artists
  .filter((a) => !a.genres.length)
  .sort(
    (a, b) =>
      (ranks.has(b.id) ? 1000 : 0) +
      (counts.get(b.id) || 0) -
      (ranks.has(a.id) ? 1000 : 0) -
      (counts.get(a.id) || 0),
  )
  .slice(0, Number(process.argv[2] || 450));
let cursor = 0,
  done = 0,
  failures = 0;
const isGenre =
  /pop|rock|hip.?hop|rap|r&b|rnb|soul|funk|electro|house|techno|ambient|indie|folk|country|jazz|classical|metal|punk|reggae|latin|bollywood|desi|hindi|punjabi|tamil|telugu|afro|singer.songwriter|acoustic|soundtrack|dance|trance|drill|grime|shoegaze|[kj]-pop/i;
await Promise.all(
  Array.from({ length: Math.min(6, Math.max(1, Number(process.argv[3]) || 3)) }, async () => {
    while (cursor < pending.length) {
      const a = pending[cursor++];
      try {
        const url =
          "https://www.last.fm/music/" + encodeURIComponent(a.name) + "/+tags";
        const res = await fetch(url, {
          headers: {
            "User-Agent": "PlayItBack/0.1 (local personal music explorer)",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          failures++;
          continue;
        }
        const html = await res.text();
        const tags = [
          ...new Set(
            [...html.matchAll(/href="\/tag\/([^"?#]+)"/g)].map((m) =>
              decodeURIComponent(m[1]).replace(/\+/g, " ").trim().toLowerCase(),
            ),
          ),
        ]
          .slice(0, 12)
          .filter(
            (t) => isGenre.test(t) && !t.includes("test") && t.length < 50,
          )
          .slice(0, 5);
        if (tags.length) {
          a.genres = tags;
          a.genreSource = "Last.fm community tags";
          a.genreUrl = url;
          done++;
        }
      } catch {
        failures++;
      }
      if (cursor % 30 === 0)
        console.log("Genre enrichment: " + cursor + "/" + pending.length);
      await new Promise((r) => setTimeout(r, 500));
    }
  }),
);
await fs.writeFile(file, JSON.stringify(data));
console.log(
  JSON.stringify({
    enriched: done,
    failures,
    totalWithGenres: data.artists.filter((a) => a.genres.length).length,
    totalArtists: data.artists.length,
  }),
);
