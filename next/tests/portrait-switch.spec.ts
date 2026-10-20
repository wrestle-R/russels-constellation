import { test, expect } from "@playwright/test";
for (const width of [1440, 390, 320]) {
  test(`2D temporary genres, expression easter eggs and one-row layout work at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: width > 500 ? 1000 : 844 },
      reducedMotion: "reduce",
      colorScheme: "dark",
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const page = await context.newPage(),
      errors: string[] = [],
      images: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (r.url().includes("/portrait.bin")) images.push(r.url());
    });
    await page.clock.install();
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript(() =>
      localStorage.setItem("play-it-back-theme", "light"),
    );
    await page.goto("/");
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    expect(images).toHaveLength(0);
    await page.getByRole("link", { name: "2D", exact: true }).click();
    await expect(page).toHaveURL(/\/2D$/);
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    expect(images).toHaveLength(1);
    const portrait = page.locator(".portrait-2d"),
      canvas = portrait.locator("canvas:not(.portrait-word)");
    await expect(portrait).toHaveAttribute("data-density", "85");
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.locator(".portrait-tools")).toHaveCount(0);
    await page.mouse.move(1, 5);
    const before = await canvas.screenshot();
    const pop = page.getByRole("button", { name: "Pop", exact: true });
    if (width > 500) {
      await pop.hover();
      await expect(portrait).toHaveAttribute("data-portrait-genre", "Pop");
      await pop.click();
      await page.mouse.move(1, 5);
    } else {
      await pop.dispatchEvent("pointerdown", { pointerType: "touch" });
      await expect(portrait).toHaveAttribute("data-portrait-genre", "Pop");
      await pop.dispatchEvent("pointerup", { pointerType: "touch" });
      await pop.tap();
    }
    await expect(portrait).toHaveAttribute("data-portrait-genre", "All genres");
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect((await canvas.screenshot()).equals(before)).toBe(true);
    const layout = await page.locator(".legend-items").evaluate((row) => {
      const bounds = row.getBoundingClientRect();
      return Array.from(row.querySelectorAll("button"))
        .filter((b) => getComputedStyle(b).visibility !== "hidden")
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { top: r.top, right: r.right, limit: bounds.right };
        });
    });
    expect(new Set(layout.map((b) => Math.round(b.top))).size).toBe(1);
    for (const b of layout) expect(b.right).toBeLessThanOrEqual(b.limit + 1);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
    const mouth = page.getByRole("button", { name: "Make a cheeky face" });
    const relaxedMouth = await mouth.screenshot();
    await mouth.click();
    await page.clock.runFor(100);
    await expect(portrait).toHaveAttribute("data-tongue", "true");
    expect((await mouth.screenshot()).equals(relaxedMouth)).toBe(false);
    await page.clock.resume();
    await expect(portrait).toHaveAttribute("data-tongue", "false", {
      timeout: 5000,
    });
    await page.mouse.move(1, 5);
    await page
      .getByRole("button", { name: "Take headphones off" })
      .first()
      .click();
    await expect(portrait).toHaveAttribute("data-headphones", "off");
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    await page
      .getByRole("button", { name: "Put headphones back on" })
      .first()
      .click();
    await expect(portrait).toHaveAttribute("data-headphones", "on");
    await page
      .getByRole("button", {
        name: "Reveal wrestle with the Aries constellation",
      })
      .click();
    await expect(portrait).toHaveAttribute("data-signature", "true");
    await expect(canvas).toHaveCount(1);
    await expect(
      portrait.getByText("wrestle, formed from the portrait’s own dots"),
    ).toBeAttached();
    await expect(
      page.getByRole("button", { name: "Make a cheeky face" }),
    ).toBeDisabled();
    await expect(page.locator(".portrait-aries circle")).toHaveCount(4);
    await expect(portrait).toHaveAttribute("data-signature", "false", {
      timeout: 7000,
    });
    await page
      .getByRole("button", { name: "Take headphones off" })
      .first()
      .click();
    const ear = page
      .getByRole("button", { name: "Put headphones back on" })
      .first();
    const bareEar = await ear.screenshot();
    await page.getByRole("button", { name: "Make a cheeky face" }).click();
    await expect(portrait).toHaveAttribute("data-tongue", "true");
    expect((await ear.screenshot()).equals(bareEar)).toBe(true);
    await expect(portrait).toHaveAttribute("data-headphones", "off");
    await page
      .getByRole("button", {
        name: "Reveal wrestle with the Aries constellation",
      })
      .click();
    await expect(portrait).toHaveAttribute("data-signature", "true");
    await expect(portrait).toHaveAttribute("data-signature", "false", {
      timeout: 7000,
    });
    await expect(portrait).toHaveAttribute("data-headphones", "off");
    await expect(portrait).toHaveAttribute("data-tongue", "false", {
      timeout: 5000,
    });
    await expect(portrait).toHaveAttribute("data-headphones", "off");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await expect(page.locator(".theme-toggle")).toHaveCount(0);
    await page.keyboard.press("d");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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
    await page.reload();
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await expect(portrait).toHaveAttribute("data-headphones", "on");
    expect(errors).toEqual([]);
    await context.close();
  });
}
for (const file of ["portrait.bin", "portrait-expressions.bin"]) {
  test(`2D portrait recovers when ${file} fails`, async ({ page }) => {
    await page.route(`**/${file}`, (r) => r.fulfill({ status: 404 }));
    await page.goto("/2D");
    await expect(page.locator(".portrait-error")).toContainText(
      "couldn’t load",
    );
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await page.unroute(`**/${file}`);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await expect(page.locator(".portrait-2d canvas")).toBeVisible();
  });
}

test("2D portrait song hover opens the matching song details", async ({
  page,
}) => {
  await page.goto("/2D");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  const canvas = page.locator(".portrait-2d canvas");
  const box = (await canvas.boundingBox())!;
  const label = page.locator(".portrait-song-tooltip");
  let found = false;
  for (const dy of [-0.15, -0.1, 0, 0.1]) {
    for (const dx of [0, -0.08, 0.08]) {
      await page.mouse.move(
        box.x + box.width * (0.5 + dx),
        box.y + box.height * (0.5 + dy),
      );
      if (await label.isVisible()) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  expect(found).toBe(true);
  const title = await label.getAttribute("aria-label");
  await label.click();
  await expect(page.locator(".song-details h2")).toHaveText(
    title!.replace("Open details for ", ""),
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".song-details")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Reveal wrestle with the Aries constellation",
    })
    .click();
  await expect(label).toBeHidden();
});

test("Glimpse of Us stays in the left lens through headset removal and zoom", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2D");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  const portrait = page.locator(".portrait-2d"),
    label = page.locator(".portrait-song-tooltip");
  async function hoverLens() {
    const point = await portrait.evaluate((host) => {
      const box = host.getBoundingClientRect(),
        style = getComputedStyle(host);
      const scale = parseFloat(style.getPropertyValue("--mouth-width")) / 0.26;
      const pivotY =
        parseFloat(style.getPropertyValue("--mouth-top")) - 0.18 * scale;
      return {
        x: box.x + box.width / 2 + ((445 - 615) / 1278) * scale,
        y: box.y + pivotY - (0.5 - 650 / 1278) * scale,
      };
    });
    await page.mouse.move(point.x, point.y);
    await expect(label).toHaveAccessibleName("Open details for Glimpse of Us");
    await expect(label).toContainText(/\(\d+\)/);
  }
  await hoverLens();
  await label.click();
  await expect(page.locator(".song-details-artist")).toHaveText("Joji");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Take headphones off" })
    .first()
    .click();
  await expect(portrait).toHaveAttribute("data-headphones", "off");
  await hoverLens();
  const size = await portrait.evaluate((host) =>
    parseFloat(getComputedStyle(host).getPropertyValue("--mouth-width")),
  );
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect
    .poll(() =>
      portrait.evaluate((host) =>
        parseFloat(getComputedStyle(host).getPropertyValue("--mouth-width")),
      ),
    )
    .toBeGreaterThan(size);
  await hoverLens();
});
