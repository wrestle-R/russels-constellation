import { readFile } from "node:fs/promises";
import path from "node:path";
import Explorer from "../components/explorer";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { sampleCollection, type Collection } from "../lib/music";
export const dynamic = "force-dynamic";
export default async function Page() {
  let collection = sampleCollection();
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
  return <Explorer collection={applyCollectionPreferences(collection)} />;
}
