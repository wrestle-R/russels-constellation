import { readFile } from "node:fs/promises";
import path from "node:path";
import Explorer from "../components/explorer";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { type Collection } from "../lib/music";
import { collectionView } from "../lib/collection-view";
import showcase from "../lib/showcase-data.json";
// Snapshots change only on a deliberate rebuild; serve the page from the CDN.
export const dynamic = "force-static";
export default async function Page() {
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
      initial={collectionView(applyCollectionPreferences(collection))}
    />
  );
}
