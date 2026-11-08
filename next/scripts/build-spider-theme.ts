// Guitar melody over the user-supplied Spider-Man chord progression.
// No commercial recording or vocals. Uses the Blog guitar component's synth.
// Run: npx tsx scripts/build-spider-theme.ts (requires ffmpeg).
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { pluckedString } from "../lib/plucked-string";
const rate = 44100,
  beat = 60 / 108;
const chords: Record<string, number[]> = {
  Am: [45, 52, 57, 60, 64],
  Dm: [50, 57, 62, 65],
  E: [40, 47, 52, 56, 59, 64],
  G: [43, 47, 50, 55, 59, 67],
  C: [48, 52, 55, 60, 64],
  Am7: [45, 52, 55, 60, 64],
};
// Each lyric line spans two bars, leaving space for the melody.
const verse = [
  "Am",
  "Am",
  "Am",
  "Am",
  "Dm",
  "Dm",
  "Am",
  "Am",
  "E",
  "Dm",
  "Am",
  "Am",
];
const progression = [
  ...verse,
  ...verse,
  "G",
  "C",
  "Dm",
  "Am",
  "G",
  "C",
  "Dm",
  "E",
  ...verse.slice(0, 10),
  "Am",
  "Am",
  "Dm",
  "Am",
  "Dm",
  "Am7",
];
const duration = progression.length * 4 * beat + 3;
const mix = new Float32Array(Math.ceil(duration * rate));
const cache = new Map<number, Float32Array>();
function pluck(midi: number, at: number, gain: number, length = 2.8) {
  if (!cache.has(midi)) cache.set(midi, pluckedString(midi, rate, 2.8));
  const note = cache.get(midi)!;
  const start = Math.round(at * rate);
  const end = Math.min(note.length, Math.round(length * rate));
  for (let i = 0; i < end && start + i < mix.length; i++) {
    const envelope = Math.min(
      1,
      i / (rate * 0.008),
      (end - i) / (rate * 0.045),
    );
    mix[start + i] += note[i] * gain * envelope;
  }
}
progression.forEach((bar, index) => {
  const changes = bar.split(" ");
  for (let tick = 0; tick < 8; tick++) {
    const chord = chords[changes[Math.floor(tick / (8 / changes.length))]];
    const at = (index * 4 + tick * 0.5) * beat;
    if (tick === 0 || tick === 4) pluck(chord[0], at, 0.5);
    if ([0, 2, 3, 5, 6, 7].includes(tick)) {
      const up = tick % 2 === 1;
      const strings = up ? chord.slice(2).reverse() : chord.slice(1);
      strings.forEach((midi, i) =>
        pluck(midi, at + i * 0.012, up ? 0.12 : 0.18),
      );
    }
  }
});
// Pick the recognizable minor-triad lead above the quieter strummed backing.
// Beat offsets and durations keep the phrasing separate from the strum grid.
const phrases: [number, number, number][][] = [
  [
    [0, 69, 0.7],
    [0.75, 72, 0.7],
    [1.5, 76, 1.4],
    [3, 76, 0.7],
    [3.75, 74, 0.65],
    [4.5, 72, 0.7],
    [5.25, 69, 2],
  ],
  [
    [0, 69, 0.65],
    [0.75, 72, 0.65],
    [1.5, 76, 0.65],
    [2.25, 76, 0.65],
    [3, 76, 0.65],
    [3.75, 74, 0.65],
    [4.5, 72, 0.65],
    [5.25, 69, 2],
  ],
  [
    [0, 74, 0.7],
    [0.75, 77, 0.7],
    [1.5, 81, 1.4],
    [3, 81, 0.7],
    [3.75, 79, 0.65],
    [4.5, 77, 0.7],
    [5.25, 74, 2],
  ],
  [
    [0, 69, 0.65],
    [0.75, 72, 0.65],
    [1.5, 76, 0.65],
    [2.25, 76, 0.65],
    [3, 76, 0.65],
    [3.75, 74, 0.65],
    [4.5, 72, 0.65],
    [5.25, 69, 2],
  ],
  [
    [0, 76, 1.25],
    [1.5, 77, 1.25],
    [4, 76, 0.7],
    [4.75, 74, 0.7],
    [5.5, 72, 0.7],
    [6.25, 74, 0.7],
  ],
  [
    [0, 72, 0.7],
    [0.75, 69, 3.5],
  ],
];
for (const startBar of [0, 12, 32]) {
  phrases.forEach((notes, phrase) =>
    notes.forEach(([offset, midi, length]) =>
      pluck(
        midi,
        (startBar * 4 + phrase * 8 + offset) * beat,
        0.72,
        length * beat,
      ),
    ),
  );
}
// A simple picked bridge follows the supplied G/C/Dm/Am/G/C/Dm/E changes.
[71, 72, 74, 72, 71, 72, 74, 76].forEach((root, bar) => {
  [0, 1.5, 2.25].forEach((offset, i) =>
    pluck(
      root + (i === 1 ? 3 : 0),
      (96 + bar * 4 + offset) * beat,
      0.5,
      0.65 * beat,
    ),
  );
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
    "-af",
    "highpass=f=75,lowpass=f=2800,treble=g=-4, aecho=0.8:0.85:38|61:0.10|0.06,loudnorm=I=-18:TP=-2:LRA=9,alimiter=limit=0.9",
    "-codec:a",
    "libmp3lame",
    "-b:a",
    "128k",
    "-metadata",
    "title=Spider-Man Theme - warm guitar",
    "public/audio/spider-man-guitar.mp3",
  ],
  { input: pcm, maxBuffer: 1024 * 1024 },
);
if (result.status !== 0) throw new Error(result.stderr.toString());
console.log(`Rendered ${duration.toFixed(1)}s guitar arrangement`);
