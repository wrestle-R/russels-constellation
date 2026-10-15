import { test, expect } from "@playwright/test";
const nav = (page, name: string) =>
  page
    .getByRole("navigation", { name: "Library", exact: true })
    .getByRole("button", { name: new RegExp("^" + name) });
test("artist exploration, search, periods, and map controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".three-host canvas")).toBeVisible();
  const total = await page
    .locator(".collection-counts b")
    .first()
    .textContent();
  const fourWeeks = page.getByRole("button", { name: "4 weeks", exact: true });
  if (await fourWeeks.isEnabled()) {
    await fourWeeks.click();
    await expect(fourWeeks).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".collection-counts b").first()).not.toHaveText(
      total!,
    );
    await page.getByRole("button", { name: "6 months", exact: true }).click();
    await expect(page.locator(".map-loading")).toHaveCount(0);
    await page
      .getByRole("button", { name: "All available", exact: true })
      .click();
  }
  await page
    .getByRole("textbox", { name: "Search your collection" })
    .fill("no-such-artist-zzzz");
  await expect(page.getByText("No artists in this view")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Artist list", exact: true }).click();
  const rows = page.locator(".artist-list>button:not(.load-more)");
  expect(await rows.count()).toBeGreaterThan(0);
  const name = await rows.nth(1).locator("strong").textContent();
  await rows.nth(1).click();
  await expect(page.locator(".artist-inspector h2")).toHaveText(name!);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "2D", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page
    .getByRole("button", { name: "Reset constellation", exact: true })
    .click();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page
    .getByRole("button", { name: "How to explore", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("genres, albums, playlists, and songs form one browsable collection", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Genres").click();
  const genre = page.locator(".genre-card").first();
  const genreName = await genre.locator("h2").textContent();
  await genre.click();
  await expect(
    page.getByRole("combobox", { name: "Filter by genre" }),
  ).toHaveValue(genreName!);
  await nav(page, "Albums").click();
  await page.locator(".collection-grid .album-card").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".detail-track-list>a").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await nav(page, "Playlists").click();
  const playlists = page.locator(".collection-grid .album-card");
  if (await playlists.count()) {
    await playlists.first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    if (await page.locator(".playlist-map-button").count()) {
      await page.locator(".playlist-map-button").click();
      await expect(
        page.getByRole("combobox", { name: "Filter by playlist" }),
      ).not.toHaveValue("");
    } else await page.keyboard.press("Escape");
  }
  await nav(page, "Songs").click();
  await expect(page.locator(".song-row").first()).toBeVisible();
  await page.getByRole("textbox").fill("zzzz-no-song");
  await expect(page.getByText("No songs found")).toBeVisible();
});
test("theme persists, keyboard shortcut works, and mobile has no overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.waitForTimeout(1100);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("d");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("navigation", { name: "Mobile library" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page
    .getByRole("navigation", { name: "Mobile library" })
    .getByRole("button", { name: "Albums", exact: true })
    .click();
  await expect(page.locator(".collection-grid")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
test("history import is local, time-aware, persistent, and removable", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".top-import").click();
  const recent = new Date().toISOString(),
    old = new Date(Date.now() - 400 * 86400000).toISOString();
  const records = [
    {
      ts: recent,
      ms_played: 90000,
      master_metadata_track_name: "Recent fixture song",
      master_metadata_album_artist_name: "Fixture artist",
      master_metadata_album_album_name: "Fixture album",
      spotify_track_uri: "spotify:track:testrecent",
      ip_addr: "DO-NOT-STORE",
    },
    {
      ts: old,
      ms_played: 90000,
      master_metadata_track_name: "Old fixture song",
      master_metadata_album_artist_name: "Fixture artist",
      master_metadata_album_album_name: "Fixture album",
      spotify_track_uri: "spotify:track:testold",
    },
  ];
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") uploads.push(request.url());
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "Streaming_History_Audio_test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(records)),
    });
  await expect(page.getByRole("status")).toContainText("History imported");
  await expect(page.locator(".collection-counts b").nth(1)).toHaveText("2");
  await page.getByRole("button", { name: "4 weeks", exact: true }).click();
  await expect(page.locator(".collection-counts b").nth(1)).toHaveText("1");
  await page.reload();
  await expect(page.locator(".collection-counts b").nth(1)).toHaveText("2");
  const stored = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("play-it-back-local", 1);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction("collection")
            .objectStore("collection")
            .get("history");
          read.onsuccess = () => {
            resolve(JSON.stringify(read.result));
            db.close();
          };
          read.onerror = () => reject(read.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  expect(stored).not.toContain("DO-NOT-STORE");
  expect(uploads).toEqual([]);
  await page.locator(".top-import").click();
  await page
    .getByRole("button", {
      name: "Remove import and return to Spotify snapshot",
    })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Returned to your Spotify snapshot",
  );
});
