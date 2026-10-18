export type StarPosition = [number, number, number];
const fraction = (n: number) => n - Math.floor(n);
const tau = Math.PI * 2;

// A deliberately stylized, closed head volume. Broad hair/glasses cues suggest
// a person without tracing a photograph or storing a facial scan or texture.
export function portraitPositions(count: number): StarPosition[] {
  const points: StarPosition[] = [];
  const headCount = Math.round(count * 0.69);
  for (let i = 0; points.length < headCount; i++) {
    const v = 1 - 2 * fraction((i + 0.5) * 0.754877666);
    const angle = tau * fraction(i * 0.569840291);
    const ring = Math.sqrt(1 - v * v);
    const x = Math.sin(angle) * 76 * ring * (v < -0.2 ? 0.94 : 1);
    const y = 16 + 112 * v;
    const facing = Math.cos(angle);
    const z =
      facing > 0
        ? 70 * ring * Math.pow(facing, 0.7) +
          16 * Math.exp(-((x / 15) ** 2) - ((y - 13) / 28) ** 2) * facing
        : 82 * ring * facing;
    // Keep the glasses softly legible without adding eyes or realistic features.
    const lens = ((Math.abs(x) - 32) / 23) ** 4 + ((y - 40) / 12) ** 4;
    if (facing > 0.55 && lens < 0.9) continue;
    const drift = Math.sin(i * 7.13) * 1.5;
    points.push([x + drift, y + Math.cos(i * 4.7), z + drift]);
  }
  const hairCount = Math.round(count * 0.18);
  for (let i = 0; i < hairCount; i++) {
    const v = 0.48 + 0.52 * fraction((i + 0.5) * 0.754877666);
    const angle = tau * fraction(i * 0.569840291);
    const ring = Math.sqrt(1 - v * v);
    const curl =
      3 * Math.sin(angle * 9 + v * 21) * Math.sin(v * 26 - angle * 5);
    points.push([
      Math.sin(angle) * (81 + curl) * ring,
      20 + 119 * v + curl,
      Math.cos(angle) * (83 + curl) * ring,
    ]);
  }
  const glassesCount = Math.round(count * 0.04);
  for (let i = 0; i < glassesCount; i++) {
    const side = i % 2 ? 1 : -1;
    const t = fraction(i * 0.618033989);
    const angle = t * tau;
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const drift = Math.sin(i * 5.7) * 0.7;
    let x = side * 32 + 24 * Math.sign(c) * Math.abs(c) ** 0.65;
    let y = 40 + 12 * Math.sign(s) * Math.abs(s) ** 0.7;
    let z = 78 - 0.0045 * x * x;
    if (i % 13 === 0) {
      x = (t - 0.5) * 16;
      y = 44;
      z = 78;
    } else if (i % 9 === 0) {
      x = side * (56 + 20 * t);
      y = 44 - 3 * t;
      z = 64 - 60 * t;
    }
    points.push([x + drift, y + drift, z]);
  }
  const earCount = Math.round(count * 0.03);
  for (let i = 0; i < earCount; i++) {
    const side = i % 2 ? 1 : -1;
    const angle = tau * fraction(i * 0.618033989);
    const v = 1 - 2 * fraction(i * 0.754877666);
    const ring = Math.sqrt(1 - v * v);
    points.push([
      side * (74 + 8 * ring * Math.cos(angle)),
      13 + 20 * v,
      -1 + 12 * ring * Math.sin(angle),
    ]);
  }
  for (let i = 0; points.length < count; i++) {
    const t = fraction((i + 0.5) * 0.754877666);
    const angle = tau * fraction(i * 0.569840291);
    const radius = 26 + t * 5;
    points.push([
      Math.sin(angle) * radius,
      -82 - 53 * t,
      -10 + Math.cos(angle) * radius,
    ]);
  }
  // A spatial ordering keeps each artist's consecutive songs in nearby patches
  // on the volume, rather than drawing long threads through the entire head.
  return points
    .slice(0, count)
    .map((position) => ({ position, key: spatialKey(position) }))
    .sort((a, b) => a.key - b.key)
    .map((item) => item.position);
}
function spatialKey([x, y, z]: StarPosition) {
  const values = [(x + 100) / 200, (y + 150) / 300, (z + 100) / 200].map((v) =>
    Math.max(0, Math.min(1023, Math.floor(v * 1023))),
  );
  let key = 0;
  for (let bit = 0; bit < 10; bit++)
    for (let axis = 0; axis < 3; axis++)
      key |= ((values[axis] >> bit) & 1) << (bit * 3 + axis);
  return key;
}
