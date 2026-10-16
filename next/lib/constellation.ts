import { genreFor, genres, type Artist, type Track } from "./music";
export type MapNode = {
  artist: Artist;
  x: number;
  y: number;
  z: number;
  size: number;
  count: number;
  genre: string;
  color: string;
  lightColor: string;
  importance: number;
};
export type MapData = { nodes: MapNode[]; edges: [number, number][] };
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
export function buildConstellation(
  artists: Artist[],
  tracks: Track[],
  ranking: string[],
): MapData {
  const counts = new Map<string, number>();
  for (const t of tracks)
    for (const id of t.artistIds || [t.artistId || ""])
      counts.set(id, (counts.get(id) || 0) + 1);
  const ranks = new Map(ranking.map((id, i) => [id, i]));
  // All genres inhabit one overlapping volume. Multiple tags blend an artist's
  // position between colors; no separate genre containers or unknown cloud.
  const nodes: MapNode[] = artists
    .filter((a) => genreFor(a).name !== "Unclassified")
    .map((a) => {
      const primary = genreFor(a);
      const families = [
        ...new Set(
          a.genres.map((tag) => genreFor({ ...a, genres: [tag] }).name),
        ),
      ].filter((g) => g !== "Unclassified");
      let cx = 0,
        cy = 0;
      for (const name of families) {
        const i = genres.findIndex((g) => g.name === name),
          angle = i * 2.399963;
        cx += Math.cos(angle) * 58;
        cy += Math.sin(angle) * 40;
      }
      cx /= families.length || 1;
      cy /= families.length || 1;
      const angle = hash(a.id + "angle") * Math.PI * 2;
      const radius = Math.sqrt(hash(a.id + "radius")) * 150;
      const curl = angle + radius * 0.006;
      const count = counts.get(a.id) || 0;
      return {
        artist: a,
        x: Math.cos(curl) * radius * 1.35 + cx,
        y: Math.sin(curl) * radius * 0.83 + cy,
        z: (hash(a.id + "depth") - 0.5) * 100 + Math.sin(curl * 2) * 22,
        size: Math.min(10, 3.8 + Math.sqrt(count) * 0.6),
        count,
        genre: primary.name,
        color: primary.color,
        lightColor: primary.light,
        importance:
          (ranks.has(a.id) ? 10000 - (ranks.get(a.id) || 0) : 0) + count,
      };
    });
  // Shared-tag links are found across the whole cloud, including genre borders.
  const byTag = new Map<string, number[]>();
  nodes.forEach((n, i) =>
    n.artist.genres.forEach((tag) => {
      const key = tag.toLowerCase();
      const ids = byTag.get(key) || [];
      ids.push(i);
      byTag.set(key, ids);
    }),
  );
  const edges: [number, number][] = [],
    seen = new Set<string>();
  nodes.forEach((n, i) => {
    const candidates = new Set<number>();
    for (const tag of n.artist.genres)
      for (const j of byTag.get(tag.toLowerCase()) || [])
        if (j !== i) candidates.add(j);
    const nearest = [...candidates]
      .map((j) => ({
        j,
        d:
          (n.x - nodes[j].x) ** 2 +
          (n.y - nodes[j].y) ** 2 +
          (n.z - nodes[j].z) ** 2,
      }))
      .filter((c) => c.d < 90 ** 2)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { j } of nearest) {
      const key = Math.min(i, j) + ":" + Math.max(i, j);
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  });
  return { nodes, edges };
}
