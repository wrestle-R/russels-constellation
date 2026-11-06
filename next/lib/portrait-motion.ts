export function updatePointerSpeed(
  previousSpeed: number,
  distance: number,
  elapsedMs: number,
) {
  const dt = Math.max(1, Math.min(100, elapsedMs));
  const instantaneous = Math.max(0, distance) / dt;
  return (
    previousSpeed + (instantaneous - previousSpeed) * (1 - Math.exp(-dt / 55))
  );
}
export function revealRadius(speed: number) {
  const finite = Number.isFinite(speed) ? speed : 0;
  const amount = Math.max(0, Math.min(1, (finite - 0.12) / 2.8));
  return 44 + Math.pow(amount, 0.75) * 116;
}
export function stepHeadphones(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  omega = 12,
) {
  const elapsed = Math.max(0, Math.min(0.05, dt));
  const offset = position - target;
  const decay = Math.exp(-omega * elapsed);
  const step = (velocity + omega * offset) * elapsed;
  return {
    position: target + (offset + step) * decay,
    velocity: (velocity - omega * step) * decay,
  };
}
