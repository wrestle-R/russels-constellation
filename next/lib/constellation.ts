import { genreFor, genres, type Artist, type Track } from "./music";
export type MapNode = {
  id: string;
  track: Track;
  artist: Artist;
  x: number;
  y: number;
  z: number;
  size: number;
  genre: string;
  color: string;
  lightColor: string;
};
export type MapData = {
  nodes: MapNode[];
  edges: [number, number][];
  overview: boolean[];
};
// Neighboring styles have neighboring homes. Multi-genre artists interpolate
// toward their other homes, so the regions have overlapping, permeable edges.
const homes: Record<string, [number, number, number]> = {
  Pop: [0, 20, 0],
  "Indie & alternative": [-105, 65, 15],
  "Hip-hop": [110, 25, 0],
  "R&B & soul": [50, -85, 15],
  Electronic: [60, 130, -10],
  Rock: [-145, -40, -5],
  "Folk & acoustic": [-85, -115, 5],
  "Jazz & classical": [155, -100, -10],
  Bollywood: [175, 100, 10],
  Reggae: [-40, -85, 5],
  Afrobeats: [100, -40, 10],
};
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}
export function buildConstellation(
  artists: Artist[],
  tracks: Track[],
): MapData {
  const byId = new Map(artists.map((a) => [a.id, a]));
  const byArtist = new Map<string, Track[]>();
  for (const track of tracks) {
    const owner = byId.get(track.artistId || track.artistIds?.[0] || "");
    if (!owner || genreFor(owner).name === "Unclassified") continue;
    const list = byArtist.get(owner.id) || [];
    list.push(track);
    byArtist.set(owner.id, list);
  }
  const regions = new Map<string, Artist[]>();
  for (const id of byArtist.keys()) {
    const artist = byId.get(id)!;
    const key = genreFor(artist).name;
    const list = regions.get(key) || [];
    list.push(artist);
    regions.set(key, list);
  }
  for (const list of regions.values())
    list.sort((a, b) => a.id.localeCompare(b.id));
  const nodes: MapNode[] = [],
    edges: [number, number][] = [];
  for (const [family, group] of regions) {
    const home = homes[family];
    const extent = Math.min(83, 28 + Math.sqrt(group.length) * 3.5);
    group.forEach((artist, index) => {
      const secondary = [
        ...new Set(
          artist.genres.map((g) => genreFor({ ...artist, genres: [g] }).name),
        ),
      ].filter((g) => g !== family && homes[g]);
      const center = [...home];
      if (secondary.length) {
        for (let axis = 0; axis < 3; axis++)
          center[axis] =
            home[axis] * 0.78 +
            (secondary.reduce((sum, g) => sum + homes[g][axis], 0) /
              secondary.length) *
              0.22;
      }
      const angle = index * 2.399963 + hash(artist.id) * 0.4;
      const radius = Math.sqrt((index + 0.5) / group.length) * extent;
      const ax = center[0] + Math.cos(angle) * radius,
        ay = center[1] + Math.sin(angle) * radius * 0.85,
        az = center[2] + (hash(artist.id + "depth") - 0.5) * 45;
      const color = genres.find((g) => g.name === family)!;
      const songs = byArtist
        .get(artist.id)!
        .sort((a, b) => a.id.localeCompare(b.id));
      const members: number[] = [];
      songs.forEach((track, i) => {
        const theta = i * 2.399963 + hash(artist.id) * Math.PI * 2;
        const orbit = songs.length === 1 ? 0 : 3 + Math.sqrt(i) * 2.8;
        const node: MapNode = {
          id: track.id,
          track,
          artist,
          x: ax + Math.cos(theta) * orbit,
          y: ay + Math.sin(theta) * orbit,
          z: az + (hash(track.id) - 0.5) * 9,
          size: 5.2,
          genre: family,
          color: color.color,
          lightColor: color.light,
        };
        const ni = nodes.length;
        nodes.push(node);
        if (members.length) {
          let parent = members[0],
            best = Infinity;
          for (const j of members) {
            const other = nodes[j],
              distance =
                (node.x - other.x) ** 2 +
                (node.y - other.y) ** 2 +
                (node.z - other.z) ** 2;
            if (distance < best) {
              best = distance;
              parent = j;
            }
          }
          edges.push([parent, ni]);
        }
        members.push(ni);
      });
    });
  }
  return { nodes, edges, overview: edges.map(() => true) };
}
// More observed plays means lower luminance in both themes. Unknown counts
// retain a neutral midpoint, rather than being silently interpreted as zero.
export function playShade(count: number | undefined, max: number) {
  return count === undefined
    ? 0.64
    : 0.92 -
        (0.5 * Math.log1p(Math.max(0, count))) / Math.log1p(Math.max(1, max));
}

// More plays gently increase the base size, capped at 15% larger.
// Unknown counts retain the base size; logarithmic scaling avoids oversized dots.
export function playSize(count: number | undefined, max: number) {
  if (count === undefined) return 1;
  const ratio = Math.log1p(Math.max(0, count)) / Math.log1p(Math.max(1, max));
  return 1 + 0.15 * Math.min(1, ratio);
}
