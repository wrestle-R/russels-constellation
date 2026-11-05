import * as THREE from "three";
import { revealRadius, updatePointerSpeed } from "./portrait-motion";

/** A small cached alpha texture; the portrait and mask share its coordinates. */
export function createPortraitHover(aspect: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 200;
  const ink = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const drops = Array.from({ length: 16 }, () => ({
    x: 0,
    y: 0,
    time: -Infinity,
    radius: 0,
  }));
  let next = 0;
  let previous: { x: number; y: number; time: number } | undefined;
  let speed = 0;
  let inside = false;
  let painted = false;
  const clear = () => {
    previous = undefined;
    speed = 0;
    inside = false;
    for (const drop of drops) drop.time = -Infinity;
    if (painted) {
      ink.clearRect(0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;
      painted = false;
    }
  };
  return {
    texture,
    clear,
    leave() { previous = undefined; speed = 0; inside = false; },
    move(x: number, y: number, now: number) {
      // Input uses the same head-local coordinates as song picking and zoom.
      x = (x / aspect + 0.5) * 1230;
      y = (0.5 - y) * 1278;
      inside = true;
      const add = (px: number, py: number, radius: number) => {
        Object.assign(drops[next++ % drops.length], {
          x: px,
          y: py,
          radius,
          time: now,
        });
      };
      let radius = revealRadius(0);
      if (previous && now - previous.time <= 120) {
        const dx = x - previous.x;
        const dy = y - previous.y;
        const distance = Math.hypot(dx, dy);
        speed = updatePointerSpeed(speed, distance, now - previous.time);
        radius = revealRadius(speed);
        const steps = Math.min(
          6,
          Math.max(1, Math.ceil(distance / Math.max(18, radius * 0.45))),
        );
        for (let i = 1; i <= steps; i++)
          add(
            previous.x + (dx * i) / steps,
            previous.y + (dy * i) / steps,
            radius,
          );
      } else {
        speed = 0;
        add(x, y, radius);
      }
      previous = { x, y, time: now };
      return radius;
    },
    update(now: number, reduced: boolean, enabled: boolean) {
      if (!enabled) {
        clear();
        return false;
      }
      const full = reduced && inside;
      const active =
        full || (!reduced && drops.some((drop) => now - drop.time < 850));
      if (!active) {
        if (painted) {
          ink.clearRect(0, 0, canvas.width, canvas.height);
          texture.needsUpdate = true;
          painted = false;
        }
        return false;
      }
      ink.clearRect(0, 0, canvas.width, canvas.height);
      if (full) {
        ink.fillStyle = "rgba(255,255,255,.82)";
        ink.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        for (const drop of drops) {
          const life = Math.max(0, 1 - (now - drop.time) / 850);
          const radius =
            ((drop.radius * Math.pow(life, 0.65)) / 1230) * canvas.width;
          if (radius < 0.2) continue;
          const x = (drop.x / 1230) * canvas.width;
          const y = (drop.y / 1278) * canvas.height;
          const gradient = ink.createRadialGradient(
            x,
            y,
            radius * 0.35,
            x,
            y,
            radius,
          );
          gradient.addColorStop(0, "rgba(255,255,255,.82)");
          gradient.addColorStop(1, "rgba(255,255,255,0)");
          ink.fillStyle = gradient;
          ink.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      }
      painted = true;
      texture.needsUpdate = true;
      return true;
    },
    dispose() {
      texture.dispose();
    },
  };
}
