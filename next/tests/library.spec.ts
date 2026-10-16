import { test, expect } from "@playwright/test";
async function more(page) {
  await page.locator(".more-menu summary").click();
}
test("minimal constellation, hover-only names, filters and orbit controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const canvas = page.locator(".three-host canvas");
  await expect(canvas).toBeVisible();
  await expect(
    page.locator(
      ".sidebar,.page-heading,.collection-bar,.artist-inspector,.album-shelf,.artist-map-label,.genre-map-label",
    ),
  ).toHaveCount(0);
  await expect(page.getByText("Unclassified", { exact: true })).toHaveCount(0);
  await expect(page.locator("h1")).toHaveCount(0);
  const box = await canvas.boundingBox();
  expect(box!.height).toBeGreaterThan(800);
  const before = await canvas.screenshot();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width * 0.6,
    box!.y + box!.height * 0.57,
    { steps: 10 },
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await canvas.screenshot();
  expect(before.equals(after)).toBe(false);
  await page
    .getByRole("button", { name: "Reset constellation", exact: true })
    .click();
  await page.mouse.move(0, 0);
  await expect(page.locator(".graph-tooltip")).toBeHidden();
  let hovered = false;
  for (let x = box!.width * 0.35; x < box!.width * 0.7 && !hovered; x += 24) {
    for (
      let y = box!.height * 0.35;
      y < box!.height * 0.65 && !hovered;
      y += 24
    ) {
      await page.mouse.move(box!.x + x, box!.y + y);
      hovered = await page.locator(".graph-tooltip").isVisible();
    }
  }
  expect(hovered).toBe(true);
  await expect(page.locator(".graph-tooltip")).not.toHaveText("");
  await page.mouse.move(5, 5);
  await expect(page.locator(".graph-tooltip")).toBeHidden();
  await page
    .getByRole("textbox", { name: "Find an artist", exact: true })
    .fill("no-such-artist-zzzz");
  await expect(page.getByText("No artists match these filters.")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  for (const name of ["4 weeks", "6 months", "All available"]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.isEnabled()) {
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(canvas).toBeVisible();
    }
  }
  const genre = page.getByRole("combobox", {
    name: "Filter by genre",
    exact: true,
  });
  await genre.selectOption({ index: 1 });
  await expect(page.locator(".empty-state")).toHaveCount(0);
  await genre.selectOption("All genres");
  await more(page);
  await page.getByRole("button", { name: "Artist list", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const artist = page.locator(".artist-list>div>button").first();
  await artist.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".artist-map-label")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("theme persists and mobile remains a viewport-sized constellation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.waitForTimeout(1100);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("d");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".three-host canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.documentElement.scrollHeight > innerHeight,
    ),
  ).toBe(false);
  await more(page);
  await page
    .getByRole("button", { name: "How to explore", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("local import persists and can be removed without uploading raw data", async ({
  page,
}) => {
  await page.goto("/");
  await more(page);
  await page
    .getByRole("button", { name: "Import history", exact: true })
    .click();
  const records = [
    {
      ts: new Date().toISOString(),
      ms_played: 90000,
      master_metadata_track_name: "Fixture song",
      master_metadata_album_artist_name: "Fixture artist",
      master_metadata_album_album_name: "Fixture album",
      spotify_track_uri: "spotify:track:testrecent",
      ip_addr: "DO-NOT-STORE",
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
  await expect(page.getByRole("status")).toContainText("History saved");
  await expect(
    page.getByText("No genre-tagged artists are available for this period."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("No genre-tagged artists are available for this period."),
  ).toBeVisible();
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
  await more(page);
  await page
    .getByRole("button", { name: "Import history", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Remove import and return to Spotify snapshot",
    })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Returned to your Spotify snapshot",
  );
});
