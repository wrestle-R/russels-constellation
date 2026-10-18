import { portraitPositions } from "./portrait-layout";
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
  const styles = new Map(artists.map((a) => [a.id, genreFor(a)]));
  const byArtist = new Map<string, Track[]>();
  for (const track of tracks) {
    const owner = byId.get(track.artistId || track.artistIds?.[0] || "");
    if (!owner || styles.get(owner.id)!.name === "Unclassified") continue;
    const list = byArtist.get(owner.id) || [];
    list.push(track);
    byArtist.set(owner.id, list);
  }
  const positions = portraitPositions(
    [...byArtist.values()].reduce((sum, songs) => sum + songs.length, 0),
  );
  const groups = [...byArtist.keys()].map((id) => byId.get(id)!);
  const genreIndex = new Map(genres.map((g, i) => [g.name, i]));
  const ranks = new Map(
    groups.map((a) => [
      a.id,
      genreIndex.get(styles.get(a.id)!.name)! + (hash(a.id) - 0.5) * 2.8,
    ]),
  );
  groups.sort(
    (a, b) => ranks.get(a.id)! - ranks.get(b.id)! || a.id.localeCompare(b.id),
  );
  const nodes: MapNode[] = [],
    edges: [number, number][] = [];
  for (const artist of groups) {
    const color = styles.get(artist.id)!;
    const songs = byArtist
      .get(artist.id)!
      .sort((a, b) => a.id.localeCompare(b.id));
    const members: number[] = [];
    for (const track of songs) {
      const [x, y, z] = positions[nodes.length];
      const node: MapNode = {
        id: track.id,
        track,
        artist,
        x,
        y,
        z,
        size: 5.2,
        genre: color.name,
        color: color.color,
        lightColor: color.light,
      };
      const ni = nodes.length;
      nodes.push(node);
      if (members.length) {
        let parent = members[0],
          best = Infinity;
        for (const j of members) {
          const other = nodes[j];
          const distance =
            (x - other.x) ** 2 + (y - other.y) ** 2 + (z - other.z) ** 2;
          if (distance < best) {
            best = distance;
            parent = j;
          }
        }
        edges.push([parent, ni]);
      }
      members.push(ni);
    }
  }
  return {
    nodes,
    edges,
    overview: edges.map(
      ([a, b]) =>
        Math.hypot(
          nodes[a].x - nodes[b].x,
          nodes[a].y - nodes[b].y,
          nodes[a].z - nodes[b].z,
        ) < 32,
    ),
  };
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
