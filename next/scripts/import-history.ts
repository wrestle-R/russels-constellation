import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { importHistory } from "../lib/history-import";
import type { Collection } from "../lib/music";

// Manual local import. Raw exports and exact listening events stay outside Git.
async function main() {
  const inputs = process.argv.slice(2);
  if (!inputs.length) throw Error("Pass a Spotify history ZIP or JSON path.");
  const target = new URL("../data/private-spotify.json", import.meta.url);
  const base = JSON.parse(await readFile(target, "utf8")) as Collection;
  const files = await Promise.all(
    inputs.map(
      async (input) => new File([await readFile(input)], path.basename(input)),
    ),
  );
  const history = await importHistory(files, base, console.log);
  const mergeById = <T extends { id: string }>(old: T[], added: T[]) => [
    ...new Map([...old, ...added].map((item) => [item.id, item])).values(),
  ];
  // The export is authoritative. Mixing API start times with export end times
  // would count the same listen twice, so replace the previous event timeline.
  const plays = history.plays || [];
  const result: Collection = {
    ...base,
    source: "import",
    fetchedAt: history.fetchedAt,
    tracks: mergeById(base.tracks, history.tracks),
    artists: mergeById(base.artists, history.artists),
    albums: mergeById(base.albums, history.albums),
    plays,
    importedFiles: history.importedFiles,
  };
  delete result.playCountSnapshot;
  delete result.recent;
  await writeFile(target, JSON.stringify(result));
  console.log(
    JSON.stringify({
      songs: result.tracks.length,
      artists: result.artists.length,
      recordedEvents: plays.length,
      importedFiles: result.importedFiles,
      artistsNeedingGenres: result.artists.filter((a) => !a.genres.length)
        .length,
    }),
  );
}
main().catch((error) => {
  console.error("History import failed: " + error.message);
  process.exitCode = 1;
});
