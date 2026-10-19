import { test, expect } from "@playwright/test";
for (const width of [1440, 390, 320]) {
  test(`2D route preserves the portrait through genre effects and navigation at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: width > 500 ? 1000 : 844 },
      reducedMotion: "reduce",
      colorScheme: "dark",
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const page = await context.newPage();
    const errors: string[] = [],
      images: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes("/portrait.bin")) images.push(r.url());
    });
    await page.goto("/");
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    expect(images).toHaveLength(0);
    await expect(
      page.getByRole("button", { name: "Face", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "2D", exact: true }).click();
    await expect(page).toHaveURL(/\/2D$/);
    await expect(page).toHaveTitle(/2D/);
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await expect(page.locator(".universe")).toHaveAttribute("data-view", "2D");
    expect(images).toHaveLength(1);
    expect(images[0]).toContain("portrait.bin");
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();
    const pop = page.getByRole("button", { name: "Pop", exact: true });
    if (width > 500) await pop.hover();
    else await pop.tap();
    await expect(page.locator(".portrait-2d")).toHaveAttribute(
      "data-portrait-genre",
      "Pop",
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    await pop.click();
    await page.mouse.move(1, 65);
    await expect(pop).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.mouse.move(1, 65);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect((await canvas.screenshot()).equals(before)).toBe(true);
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "3D", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".universe")).toHaveAttribute(
      "data-view",
      "constellation",
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/2D$/);
    await page.reload();
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await expect(canvas).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}
test("2D portrait can recover from a missing image", async ({ page }) => {
  await page.route("**/portrait.bin", (r) => r.fulfill({ status: 404 }));
  await page.goto("/2D");
  await expect(page.locator(".portrait-error")).toContainText("couldn’t load");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.unroute("**/portrait.bin");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();
});
