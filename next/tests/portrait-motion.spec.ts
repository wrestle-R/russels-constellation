import { test } from "@playwright/test";
import assert from "node:assert/strict";
import {
  updatePointerSpeed,
  revealRadius,
  stepHeadphones,
} from "../lib/portrait-motion";

test("fast movement exposes substantially more area than slow movement", () => {
  assert.ok(revealRadius(2.8) > revealRadius(0.2) * 2);
  for (const speed of [-1, 0, 0.1, 0.5, 1, 3, 100]) {
    assert.ok(revealRadius(speed) >= 44 && revealRadius(speed) <= 160);
  }
});
test("reveal radius increases monotonically with speed and never exceeds its cap", () => {
  let previous = 0;
  for (let speed = 0; speed <= 10; speed += 0.05) {
    const radius = revealRadius(speed);
    assert.ok(radius >= previous);
    previous = radius;
  }
});
test("equivalent pointer movement at different event frequencies gives the same exposure", () => {
  function simulate(dt, samples) {
    let speed = 0;
    for (let i = 0; i < samples; i++)
      speed = updatePointerSpeed(speed, 1.4 * dt, dt);
    return revealRadius(speed);
  }
  assert.ok(Math.abs(simulate(8, 28) - simulate(16, 14)) < 0.001);
});
test("headphone removal is smooth, monotonic and settles without overshoot", () => {
  let position = 0,
    velocity = 0;
  for (let i = 0; i < 120; i++) {
    const next = stepHeadphones(position, velocity, 1, 0.016);
    assert.ok(next.position >= position && next.position <= 1);
    assert.ok(next.position - position < 0.1);
    ({ position, velocity } = next);
  }
  assert.ok(position > 0.999 && Math.abs(velocity) < 0.001);
});
test("headphone spring is consistent across frame rates", () => {
  function simulate(dt, frames) {
    let state = { position: 0, velocity: 0 };
    for (let i = 0; i < frames; i++)
      state = stepHeadphones(state.position, state.velocity, 1, dt);
    return state;
  }
  const a = simulate(0.016, 10),
    b = simulate(0.04, 4);
  assert.ok(Math.abs(a.position - b.position) < 0.000001);
  assert.ok(Math.abs(a.velocity - b.velocity) < 0.000001);
});
test("rapid headphone reversals preserve continuity and recover to the requested state", () => {
  let state = { position: 0, velocity: 0 };
  for (let i = 0; i < 90; i++) {
    const next = stepHeadphones(
      state.position,
      state.velocity,
      Math.floor(i / 3) % 2,
      0.016,
    );
    assert.ok(Math.abs(next.position - state.position) < 0.1);
    assert.ok(next.position >= 0 && next.position <= 1);
    state = next;
  }
  for (let i = 0; i < 120; i++)
    state = stepHeadphones(state.position, state.velocity, 0, 0.016);
  assert.ok(state.position < 0.001 && Math.abs(state.velocity) < 0.001);
});
