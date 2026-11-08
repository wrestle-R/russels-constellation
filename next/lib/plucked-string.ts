// Adapted from the personal Blog guitar component (src/lib/guitar-riff.ts).
export function pluckedString(
  midi: number,
  sampleRate: number,
  seconds = 2.5,
): Float32Array {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  // The two-tap low-pass contributes half a sample of group delay. Interpolate
  // the remaining delay instead of rounding, keeping higher frets in tune too.
  const delay = sampleRate / frequency - 0.5;
  const whole = Math.floor(delay);
  const fraction = delay - whole;
  const samples = new Float32Array(Math.ceil(sampleRate * seconds));
  let seed = (midi * 7919 + 104729) >>> 0;
  for (let i = 0; i <= whole + 1; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = ((seed / 4294967296) * 2 - 1) * 0.65;
  }
  for (let i = whole + 2; i < samples.length; i++) {
    const a =
      samples[i - whole] * (1 - fraction) + samples[i - whole - 1] * fraction;
    const b =
      samples[i - whole - 1] * (1 - fraction) +
      samples[i - whole - 2] * fraction;
    samples[i] = (a + b) * 0.4985;
  }
  // Remove the initial click while keeping the crisp pick attack.
  const attack = Math.round(sampleRate * 0.002);
  for (let i = 0; i < attack; i++) samples[i] *= i / attack;
  return samples;
}
