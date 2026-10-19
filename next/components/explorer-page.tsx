import { readFile } from "node:fs/promises";
import path from "node:path";
import Explorer from "./explorer";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { type Collection } from "../lib/music";
import { collectionView } from "../lib/collection-view";
import showcase from "../lib/showcase-data.json";
// Snapshots change only on a deliberate rebuild; serve the page from the CDN.
export default async function ExplorerPage({
  portrait2D = false,
}: {
  portrait2D?: boolean;
}) {
  let collection = showcase as Collection;
  try {
    const data = JSON.parse(
      await readFile(
        path.join(process.cwd(), "data/private-spotify.json"),
        "utf8",
      ),
    );
    if (data.version === 2 && data.artists?.length)
      collection = data as Collection;
  } catch {}
  return (
    <Explorer
      key={portrait2D ? "2D" : "3D"}
      portraitAvailable={true}
      portrait2D={portrait2D}
      initial={collectionView(applyCollectionPreferences(collection))}
    />
  );
}
