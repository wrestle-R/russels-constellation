// Guitar-only chord arrangement of the user-supplied Spider-Man tab.
// No commercial recording or vocals. Uses the Blog guitar component's synth.
// Run: npx tsx scripts/build-spider-theme.ts (requires ffmpeg).
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { pluckedString } from "../lib/plucked-string";
const rate = 44100,
  beat = 60 / 112;
const chords: Record<string, number[]> = {
  Am: [45, 52, 57, 60, 64],
  Dm: [50, 57, 62, 65],
  E: [40, 47, 52, 56, 59, 64],
  G: [43, 47, 50, 55, 59, 67],
  C: [48, 52, 55, 60, 64],
  Am7: [45, 52, 55, 60, 64],
};
// Two verses, bridge, final verse and resolving Am7. Each entry is one bar.
const verse = ["Am", "Am", "Dm", "Am", "E Dm", "Am"];
const progression = [
  ...verse,
  ...verse,
  "G C",
  "Dm Am",
  "G C",
  "Dm E",
  "Am",
  "Am",
  "Dm",
  "Am",
  "E Dm",
  "Am",
  "Dm",
  "Am",
  "Dm",
  "Am7",
];
const duration = progression.length * 4 * beat + 3;
const mix = new Float32Array(Math.ceil(duration * rate));
const cache = new Map<number, Float32Array>();
function pluck(midi: number, at: number, gain: number) {
  if (!cache.has(midi)) cache.set(midi, pluckedString(midi, rate, 2.8));
  const note = cache.get(midi)!;
  const start = Math.round(at * rate);
  for (let i = 0; i < note.length && start + i < mix.length; i++)
    mix[start + i] += note[i] * gain;
}
progression.forEach((bar, index) => {
  const changes = bar.split(" ");
  for (let tick = 0; tick < 8; tick++) {
    const chord = chords[changes[Math.floor(tick / (8 / changes.length))]];
    const at = (index * 4 + tick * 0.5) * beat;
    if (tick === 0 || tick === 4) pluck(chord[0], at, 0.85);
    if ([0, 2, 3, 5, 6, 7].includes(tick)) {
      const up = tick % 2 === 1;
      const strings = up ? chord.slice(2).reverse() : chord.slice(1);
      strings.forEach((midi, i) =>
        pluck(midi, at + i * 0.012, up ? 0.24 : 0.38),
      );
    }
  }
});
let peak = 0;
for (const sample of mix) peak = Math.max(peak, Math.abs(sample));
const pcm = Buffer.alloc(mix.length * 4);
for (let i = 0; i < mix.length; i++) {
  const fade = Math.min(1, i / (rate * 0.015), (mix.length - i) / (rate * 0.8));
  pcm.writeFloatLE((mix[i] / peak) * 0.85 * fade, i * 4);
}
mkdirSync("public/audio", { recursive: true });
const result = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "f32le",
    "-ar",
    String(rate),
    "-ac",
    "1",
    "-i",
    "pipe:0",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    "-metadata",
    "title=Spider-Man Theme - guitar chords",
    "public/audio/spider-man-guitar.mp3",
  ],
  { input: pcm, maxBuffer: 1024 * 1024 },
);
if (result.status !== 0) throw new Error(result.stderr.toString());
console.log(`Rendered ${duration.toFixed(1)}s guitar arrangement`);
