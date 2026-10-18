import { test, expect } from "@playwright/test";
import showcase from "../lib/showcase-data.json";
import { collectionView, expandCollection } from "../lib/collection-view";
import { buildConstellation } from "../lib/constellation";
import { applyCollectionPreferences } from "../lib/collection-exclusions";
import { recordedPlayCounts, type Collection } from "../lib/music";

test("the smaller startup payload preserves the published graph, counts and song details", () => {
  const original = applyCollectionPreferences(showcase as Collection);
  const packed = collectionView(original);
  const restored = expandCollection(packed);
  const before = buildConstellation(original.artists, original.tracks);
  const after = buildConstellation(restored.artists, restored.tracks);
  expect(JSON.stringify(packed).length).toBeLessThan(
    JSON.stringify(original).length * 0.5,
  );
  expect(after.edges).toEqual(before.edges);
  expect(
    after.nodes.map(({ track, artist, ...node }) => ({
      ...node,
      artist: artist.name,
      name: track.name,
      album: track.album,
      duration: track.duration,
      url: track.url,
    })),
  ).toEqual(
    before.nodes.map(({ track, artist, ...node }) => ({
      ...node,
      artist: artist.name,
      name: track.name,
      album: track.album,
      duration: track.duration,
      url: track.url,
    })),
  );
  expect(recordedPlayCounts(restored, "all")).toEqual(
    recordedPlayCounts(original, "all"),
  );
});

test("the constellation loader is present before JavaScript and respects reduced motion", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Gathering your stars…");
  const stars = page.locator(".loading-constellation circle");
  await expect(stars).toHaveCount(7);
  expect(
    await stars.first().evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await context.close();
});

test("loading finishes after the scene paints and startup does not download the ZIP parser", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_next/") && response.url().includes(".js"))
      scripts.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  for (const url of scripts) {
    const body = await (await page.request.get(url)).text();
    expect(body).not.toContain("No music plays of at least 30 seconds found");
  }
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".scene-loading")).toHaveCount(0);
});
