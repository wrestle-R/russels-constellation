import { test, expect, type Page, type CDPSession } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator(".three-host canvas")).toBeVisible();
  await expect(page.locator(".universe")).toHaveAttribute("data-period", "all");
  await expect(page.locator(".universe")).not.toHaveAttribute(
    "data-visible-songs",
    "0",
  );
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > innerWidth,
      y: document.documentElement.scrollHeight > innerHeight,
    })),
  ).toEqual({ x: false, y: false });
}
async function swipe(
  session: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...from, id: 1 }],
  });
  for (let i = 1; i <= 12; i++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / 12,
          y: from.y + ((to.y - from.y) * i) / 12,
          id: 1,
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

test("desktop keeps only name, fullscreen, theme and zoom, with all-time genre previews", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator("header button")).toHaveCount(2);
  await expect(
    page.locator("input, select, details, dialog, .period-control"),
  ).toHaveCount(0);
  await expect(page.getByText("Unclassified", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Constellation zoom" }),
  ).toBeVisible();
  await noOverflow(page);
  const canvas = page.locator("canvas");
  const before = await canvas.screenshot();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.waitForTimeout(200);
  expect(before.equals(await canvas.screenshot())).toBe(false);
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  const legend = page.getByRole("navigation", { name: "Genre legend" });
  const first = legend.getByRole("button").nth(1),
    second = legend.getByRole("button").nth(2);
  const firstName = (await first.textContent())!.trim(),
    secondName = (await second.textContent())!.trim();
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await second.hover();
  await expect(page.locator(".universe")).toHaveAttribute(
    "data-genre",
    secondName,
  );
  await page.mouse.move(5, 5);
  await expect(page.locator(".universe")).toHaveAttribute(
    "data-genre",
    firstName,
  );
  await legend.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".universe")).toHaveAttribute(
    "data-genre",
    "All genres",
  );
  await page.mouse.move(5, 5);
  const box = (await canvas.boundingBox())!;
  let hovered = false;
  for (let x = box.width * 0.3; x < box.width * 0.75 && !hovered; x += 24)
    for (let y = box.height * 0.25; y < box.height * 0.7 && !hovered; y += 24) {
      await page.mouse.move(box.x + x, box.y + y);
      hovered = await page.locator(".graph-tooltip").isVisible();
    }
  expect(hovered).toBe(true);
  await expect(page.locator(".graph-tooltip strong")).not.toHaveText("");
  await page.mouse.move(5, 5);
  await expect(page.locator(".graph-tooltip")).toBeHidden();
  await page.screenshot({ path: "output/desktop-simplified.png" });
  expect(errors).toEqual([]);
});

test("fullscreen enters/exits, theme persists, and reduced-motion theme switching works", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exit fullscreen", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter fullscreen", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("d");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const size of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
]) {
  test(`touch controls and genre taps fit ${size.width}×${size.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      colorScheme: "dark",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await ready(page);
      await noOverflow(page);
      expect(
        (await page.locator("header").boundingBox())!.height,
      ).toBeLessThanOrEqual(80);
      await expect(page.locator("input,select,details,dialog")).toHaveCount(0);
      for (const button of await page
        .locator("header button,.zoom-controls button,.legend-items button")
        .all()) {
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      const canvas = page.locator("canvas"),
        before = await canvas.screenshot();
      await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
      await page.waitForTimeout(150);
      expect(before.equals(await canvas.screenshot())).toBe(false);
      await page.getByRole("button", { name: "Zoom out", exact: true }).tap();
      const legend = page.getByRole("navigation", { name: "Genre legend" });
      for (const name of ["Pop", "Rock", "Bollywood", "All"]) {
        const button = legend.getByRole("button", { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        await button.tap();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(".universe")).toHaveAttribute(
          "data-genre",
          name === "All" ? "All genres" : name,
        );
        await expect(page.locator(".universe")).not.toHaveAttribute(
          "data-visible-songs",
          "0",
        );
      }
      await page.getByRole("button", { name: "Switch to light mode" }).tap();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      if (size.width === 390)
        await page.screenshot({ path: "output/mobile-light.png" });
      await page.getByRole("button", { name: "Switch to dark mode" }).tap();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await noOverflow(page);
      await page.screenshot({ path: `output/mobile-${size.width}.png` });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("real touch gestures swipe genres, orbit, pinch, and tap songs without accidental gesture selections", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await ready(page);
    const session = await context.newCDPSession(page);
    const strip = page.locator(".legend-items"),
      stripBox = (await strip.boundingBox())!;
    await swipe(
      session,
      { x: stripBox.x + stripBox.width - 30, y: stripBox.y + 22 },
      { x: stripBox.x + 30, y: stripBox.y + 22 },
    );
    expect(await strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(30);
    await expect(page.locator(".universe")).toHaveAttribute(
      "data-genre",
      "All genres",
    );
    const canvas = page.locator("canvas"),
      box = (await canvas.boundingBox())!;
    const before = await canvas.screenshot();
    await swipe(session, { x: 130, y: 350 }, { x: 240, y: 390 });
    await page.waitForTimeout(600);
    expect(before.equals(await canvas.screenshot())).toBe(false);
    await expect(page.locator(".graph-tooltip")).toBeHidden();
    const orbit = await canvas.screenshot();
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 160, y: 360, id: 1 },
        { x: 230, y: 420, id: 2 },
      ],
    });
    for (let i = 1; i <= 10; i++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: 160 - i * 4, y: 360 - i * 3, id: 1 },
          { x: 230 + i * 4, y: 420 + i * 3, id: 2 },
        ],
      });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(600);
    expect(orbit.equals(await canvas.screenshot())).toBe(false);
    await expect(page.locator(".graph-tooltip")).toBeHidden();
    let tapped = false;
    for (let x = box.width * 0.2; x < box.width * 0.8 && !tapped; x += 24)
      for (
        let y = box.height * 0.25;
        y < box.height * 0.65 && !tapped;
        y += 24
      ) {
        await page.touchscreen.tap(box.x + x, box.y + y);
        tapped = await page.locator(".graph-tooltip").isVisible();
      }
    expect(tapped).toBe(true);
    const tooltip = (await page.locator(".graph-tooltip").boundingBox())!;
    expect(tooltip.x).toBeGreaterThanOrEqual(0);
    expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(390);
    expect(tooltip.y + tooltip.height).toBeLessThanOrEqual(844);
    await expect(page.locator(".graph-tooltip strong")).not.toHaveText("");
    await page.screenshot({ path: "output/mobile-song-tap.png" });
    await page.touchscreen.tap(10, box.y + 10);
    await expect(page.locator(".graph-tooltip")).toBeHidden();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(canvas).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: "Zoom in", exact: true }).tap();
    await page.screenshot({ path: "output/mobile-landscape.png" });
  } finally {
    await context.close();
  }
});

test("opening and exploring stays on-device and fullscreen failures are handled", async ({
  page,
}) => {
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) &&
      !["data:", "blob:"].includes(url.protocol)
    )
      outside.push(url.origin);
  });
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = async () => {
      throw new Error("Unavailable");
    };
  });
  await ready(page);
  await page
    .getByRole("button", { name: "Enter fullscreen", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Fullscreen isn't available",
  );
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  expect(outside).toEqual([]);
});

test("mobile star taps keep the background stable and suppress the native canvas highlight", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  try {
    await ready(page);
    const canvas = page.locator("canvas");
    const original = await canvas.elementHandle();
    const bounds = (await canvas.boundingBox())!;
    let point: { x: number; y: number } | undefined;
    for (let x = 80; x < 310 && !point; x += 24)
      for (let y = 250; y < 580 && !point; y += 24) {
        await page.mouse.move(x, y);
        if (await page.locator(".graph-tooltip").isVisible()) point = { x, y };
      }
    expect(point).toBeDefined();
    await page.mouse.move(0, 0);
    const clip = { x: 30, y: bounds.y + 20, width: 120, height: 50 };
    const before = await page.screenshot({ clip });
    const session = await context.newCDPSession(page);
    for (let i = 0; i < 3; i++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ ...point!, id: 1 }],
      });
      await page.waitForTimeout(100);
      expect(
        await canvas.evaluate((el) =>
          getComputedStyle(el).getPropertyValue("-webkit-tap-highlight-color"),
        ),
      ).toBe("rgba(0, 0, 0, 0)");
      expect(before.equals(await page.screenshot({ clip }))).toBe(true);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(page.locator(".graph-tooltip")).toBeVisible();
      await expect(page.locator(".graph-tooltip strong")).not.toHaveText("");
      expect(before.equals(await page.screenshot({ clip }))).toBe(true);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(await original!.evaluate((el) => el.isConnected)).toBe(true);
      await page.touchscreen.tap(10, bounds.y + 10);
      await expect(page.locator(".graph-tooltip")).toBeHidden();
    }
  } finally {
    await context.close();
  }
});
