import { test, expect } from "@playwright/test";
import { portraitPositions } from "../lib/portrait-layout";
import { buildConstellation } from "../lib/constellation";
import { genreFor, type Collection } from "../lib/music";
import showcase from "../lib/showcase-data.json";

test("portrait is a complete deterministic volume with a rounded back, not a face plane", () => {
  const points = portraitPositions(6217);
  expect(points).toHaveLength(6217);
  expect(points).toEqual(portraitPositions(6217));
  expect(points.every((p) => p.every(Number.isFinite))).toBe(true);
  expect(new Set(points.map((p) => p.join(","))).size).toBe(6217);
  expect(
    points.filter(([x, y, z]) => z < -50 && y > -70 && y < 110).length,
  ).toBeGreaterThan(700);
  expect(
    points.filter(([x, y, z]) => z > 50 && y > -70 && y < 110).length,
  ).toBeGreaterThan(700);
  expect(Math.min(...points.map((p) => p[0]))).toBeLessThan(-75);
  expect(Math.max(...points.map((p) => p[0]))).toBeGreaterThan(75);
  expect(Math.max(...points.map((p) => p[1]))).toBeGreaterThan(130);
  expect(Math.min(...points.map((p) => p[1]))).toBeLessThan(-125);
  for (const count of [0, 1, 2, 7, 50])
    expect(portraitPositions(count)).toHaveLength(count);
});

test("reshaping preserves every classified song and artist-only connections, with mostly short local threads", () => {
  const collection = showcase as Collection;
  const known = new Set(
    collection.artists
      .filter((a) => genreFor(a).name !== "Unclassified")
      .map((a) => a.id),
  );
  const graph = buildConstellation(collection.artists, collection.tracks);
  const expected = collection.tracks
    .filter((t) => known.has(t.artistId || t.artistIds?.[0] || ""))
    .map((t) => t.id)
    .sort();
  expect(graph.nodes.map((n) => n.id).sort()).toEqual(expected);
  expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(expected.length);
  for (const [a, b] of graph.edges)
    expect(graph.nodes[a].artist.id).toBe(graph.nodes[b].artist.id);
  const lengths = graph.edges
    .map(([a, b]) =>
      Math.hypot(
        graph.nodes[a].x - graph.nodes[b].x,
        graph.nodes[a].y - graph.nodes[b].y,
        graph.nodes[a].z - graph.nodes[b].z,
      ),
    )
    .sort((a, b) => a - b);
  expect(lengths[Math.floor(lengths.length * 0.9)]).toBeLessThan(32);
  expect(graph.overview.filter(Boolean).length).toBeGreaterThan(
    graph.edges.length * 0.85,
  );
});

test("the head can be orbited to the back and its rear stars still open song details", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  const front = await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  const start = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.42 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + box.height * 0.48, start.y, { steps: 24 });
  await page.mouse.up();
  await page.mouse.move(0, 0);
  expect(front.equals(await canvas.screenshot())).toBe(false);
  await expect(page.locator(".brand-disc")).toHaveCount(1);
  await expect(page.locator(".brand-face")).toHaveCount(0);
  let found = false;
  for (let y = box.height * 0.3; y < box.height * 0.7 && !found; y += 24)
    for (let x = box.width * 0.35; x < box.width * 0.65 && !found; x += 24) {
      await page.mouse.move(box.x + x, box.y + y);
      found = await page.locator(".graph-tooltip").isVisible();
    }
  expect(found).toBe(true);
  await page.locator(".graph-tooltip").click();
  await expect(page.locator(".song-details")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".song-details")).toHaveCount(0);
  await page.screenshot({ path: "output/portrait-back.png" });
});
