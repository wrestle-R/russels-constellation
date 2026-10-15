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
export type MapGroup = {
  name: string;
  color: string;
  lightColor: string;
  x: number;
  y: number;
  z: number;
  count: number;
};
export type MapData = {
  nodes: MapNode[];
  edges: [number, number][];
  groups: MapGroup[];
};
const centers = [
  [-100, 60],
  [-140, -55],
  [90, 70],
  [65, -70],
  [10, 140],
  [-30, -140],
  [-220, 85],
  [165, 155],
  [185, -35],
  [255, -150],
];
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
  const nodes: MapNode[] = [],
    groups: MapGroup[] = [],
    edges: [number, number][] = [];
  genres.forEach((genre, g) => {
    const members = artists
      .filter((a) => genreFor(a).name === genre.name)
      .sort(
        (a, b) =>
          (ranks.get(a.id) ?? 10000) - (ranks.get(b.id) ?? 10000) ||
          (counts.get(b.id) || 0) - (counts.get(a.id) || 0),
      );
    if (!members.length) return;
    const [cx, cy] = centers[g],
      cz = Math.sin(g * 2.1) * 25;
    const extent = Math.min(110, Math.max(35, Math.sqrt(members.length) * 4.2));
    const groupIndices: number[] = [];
    groups.push({
      name: genre.name,
      color: genre.color,
      lightColor: genre.light,
      x: cx,
      y: cy + extent + 17,
      z: cz,
      count: members.length,
    });
    members.forEach((a, i) => {
      const h = hash(a.id);
      const angle = i * 2.3999632297 + h * 0.5;
      const radius = Math.sqrt((i + 0.5) / members.length) * extent;
      const count = counts.get(a.id) || 0;
      groupIndices.push(nodes.length);
      nodes.push({
        artist: a,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.8,
        z: cz + (h - 0.5) * 70,
        size: Math.min(12, 4 + Math.sqrt(count) * 0.9),
        count,
        genre: genre.name,
        color: genre.color,
        lightColor: genre.light,
        importance:
          (ranks.has(a.id) ? 10000 - (ranks.get(a.id) || 0) : 0) + count,
      });
    });
    if (genre.name === "Unclassified") return;
    // Link a maximum of two nearby artists only when their original tags overlap.
    for (let i = 0; i < groupIndices.length; i++) {
      const a = nodes[groupIndices[i]];
      const candidates = groupIndices
        .slice(Math.max(0, i - 10), i)
        .map((j) => ({ j, n: nodes[j] }))
        .filter(({ n }) =>
          n.artist.genres.some((tag) => a.artist.genres.includes(tag)),
        )
        .sort(
          (u, v) =>
            Math.hypot(a.x - u.n.x, a.y - u.n.y, a.z - u.n.z) -
            Math.hypot(a.x - v.n.x, a.y - v.n.y, a.z - v.n.z),
        );
      candidates
        .slice(0, 2)
        .forEach(({ j }) => edges.push([groupIndices[i], j]));
    }
  });
  return { nodes, edges, groups };
}
