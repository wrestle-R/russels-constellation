import { test, expect } from "@playwright/test";
import showcase from "../lib/showcase-data.json";

for (const scenario of [
  { count: 0, fail: false, phone: false },
  { count: 1, fail: false, phone: false },
  { count: 1, fail: false, phone: true },
  { count: 1, fail: true, phone: false },
])
  test(`song details adjust ${scenario.count} plays with ${scenario.fail ? "unavailable" : "real"} cover art${scenario.phone ? " on phone" : ""}`, async ({
    page,
  }) => {
    const { count, fail, phone } = scenario;
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    if (fail)
      await page.route("**/api/artwork/**", (route) =>
        route.fulfill({ status: 404 }),
      );
    const track = showcase.tracks.find(
      (t) => t.id === "45J4avUb9Ni0bnETYaYFVJ",
    )!;
    const artist = showcase.artists.find((a) => a.id === track.artistId)!;
    const fixture = {
      ...showcase,
      tracks: [track],
      artists: [artist],
      top: {},
      playlists: [],
      playCountSnapshot: {
        all: { [track.id]: count },
        short_term: {},
        medium_term: {},
      },
    };
    await page.addInitScript((collection) => {
      const r = indexedDB.open("play-it-back-local", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("collection");
      r.onsuccess = () => {
        const tx = r.result.transaction("collection", "readwrite");
        tx.objectStore("collection").put(collection, "history");
        tx.oncomplete = () => r.result.close();
      };
    }, fixture);
    await page.goto("/");
    await expect(page.locator(".universe")).toHaveAttribute(
      "data-visible-songs",
      "1",
    );
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".graph-tooltip strong")).toHaveText(
      `${track.name} (${count === 0 ? 4 : 7})`,
    );
    await page.locator(".graph-tooltip").click();
    const panel = page.locator(".song-details");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByText(String(count === 0 ? 4 : 7), { exact: true }),
    ).toBeVisible();
    if (fail) {
      await expect(
        panel.getByRole("img", { name: /artwork unavailable/ }),
      ).toBeVisible();
      await expect(panel.locator("h2")).toHaveText(track.name);
      return;
    }
    const cover = panel.getByRole("img", {
      name: `${track.album} album cover`,
    });
    await expect(cover).toBeVisible();
    await expect
      .poll(
        () =>
          cover.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        { timeout: 20000 },
      )
      .toBe(true);
    await expect(panel.getByText("Artwork unavailable")).toHaveCount(0);
    if (phone) expect((await cover.boundingBox())!.width).toBeLessThan(100);
    if (count === 1)
      await page.screenshot({
        path: phone
          ? "output/album-artwork-phone.png"
          : "output/album-artwork-desktop.png",
      });
  });

test("cover route rejects unknown IDs and resolves an extended-history song", async ({
  request,
}) => {
  const invalid = await request.get("/api/artwork/not-an-id");
  expect(invalid.status()).toBe(404);
  const response = await request.get("/api/artwork/5innYJulGsPtDYqjkPKXHX");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^image\//);
  expect(response.headers()["cache-control"]).toContain("s-maxage=2592000");
  expect((await response.body()).byteLength).toBeGreaterThan(1000);
});
