// Choreography inspired by each genre; these are visual rhythms, not audio analysis.
export const portraitEffects: Record<
  string,
  { label: string; mode: number; speed: number; strength: number }
> = {
  Pop: { label: "Bubble pulse", mode: 0, speed: 2.4, strength: 0.045 },
  "Indie & alternative": {
    label: "Drifting ribbons",
    mode: 1,
    speed: 1.5,
    strength: 0.014,
  },
  "Hip-hop": { label: "Bass bounce", mode: 0, speed: 1.7, strength: 0.065 },
  "R&B & soul": { label: "Slow silk", mode: 1, speed: 0.85, strength: 0.016 },
  Electronic: { label: "Signal scan", mode: 2, speed: 2.5, strength: 0.018 },
  Rock: { label: "Shock waves", mode: 3, speed: 3, strength: 0.015 },
  "Folk & acoustic": {
    label: "Paper breeze",
    mode: 1,
    speed: 0.7,
    strength: 0.011,
  },
  "Jazz & classical": {
    label: "Orbit waltz",
    mode: 4,
    speed: 1.2,
    strength: 0.014,
  },
  Bollywood: { label: "Spiral bloom", mode: 4, speed: 2.1, strength: 0.02 },
  Reggae: { label: "Offbeat sway", mode: 1, speed: 1.6, strength: 0.019 },
  Afrobeats: { label: "Ripple rhythm", mode: 0, speed: 3.1, strength: 0.045 },
};
