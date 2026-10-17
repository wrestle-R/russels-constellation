import { test, expect, type Page } from "@playwright/test";

async function findSong(page: Page, touch = false) {
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  for (let y = box.height * 0.3; y < box.height * 0.72; y += 24)
    for (let x = box.width * 0.2; x < box.width * 0.8; x += 24) {
      if (touch) await page.touchscreen.tap(box.x + x, box.y + y);
      else await page.mouse.move(box.x + x, box.y + y);
      if (await page.locator(".graph-tooltip").isVisible())
        return { x: box.x + x, y: box.y + y };
    }
  throw Error("No song could be picked");
}

test("compact song cards open details by click or keyboard and close with Escape", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await findSong(page);
  const tooltip = page.locator(".graph-tooltip");
  await expect(tooltip.locator("strong")).toHaveText(/.+ \(\d+\)$/);
  await expect(tooltip.locator("span,small")).toHaveCount(0);
  const title = await tooltip.locator("strong").innerText();
  const cardBox = (await tooltip.boundingBox())!;
  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2,
    { steps: 12 },
  );
  await tooltip.click();
  const panel = page.locator(".song-details");
  await expect(panel).toBeVisible();
  await expect(panel.locator("h2")).toHaveText(title.replace(/ \(\d+\)$/, ""));
  await expect(panel.getByText("Album", { exact: true })).toBeVisible();
  await expect(panel.getByText("Plays", { exact: true })).toBeVisible();
  await expect(
    panel.getByRole("link", { name: "Open in Spotify" }),
  ).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\//);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await findSong(page);
  await tooltip.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await page.getByRole("button", { name: "Close song details" }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 430, 768])
  test(`two-row genre legend fits and touch details work at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await page.goto("/");
      await expect(page.locator("canvas")).toBeVisible();
      const buttons = page.locator(".legend-items button");
      await expect(buttons).toHaveCount(12);
      const boxes = await buttons.evaluateAll((els) =>
        els.map((el) => {
          const b = el.getBoundingClientRect();
          return {
            x: b.x,
            y: Math.round(b.y),
            right: b.right,
            bottom: b.bottom,
            w: b.width,
            h: b.height,
            overflow: el.scrollWidth > el.clientWidth,
          };
        }),
      );
      expect(new Set(boxes.map((b) => b.y)).size).toBe(2);
      expect(
        boxes.every(
          (b) =>
            b.x >= 0 &&
            b.right <= width &&
            b.bottom <= 844 &&
            b.w >= 44 &&
            b.h >= 44 &&
            !b.overflow,
        ),
      ).toBe(true);
      const strip = page.locator(".legend-items");
      expect(
        await strip.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      for (const name of ["Bollywood", "Reggae", "Afrobeats", "All"]) {
        await page.getByRole("button", { name, exact: true }).tap();
        await expect(page.locator(".universe")).toHaveAttribute(
          "data-genre",
          name === "All" ? "All genres" : name,
        );
      }
      await findSong(page, true);
      const panel = page.locator(".song-details");
      await expect(panel).toBeVisible();
      const p = (await panel.boundingBox())!,
        legend = (await page.locator(".genre-legend").boundingBox())!;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(width);
      expect(p.y + p.height).toBeLessThan(legend.y);
      await page.screenshot({ path: `output/song-details-${width}.png` });
      await page.getByRole("button", { name: "Close song details" }).tap();
      await expect(panel).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    } finally {
      await context.close();
    }
  });
