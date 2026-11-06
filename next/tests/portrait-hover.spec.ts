import { test, expect } from "@playwright/test";

test("hover responds to speed, fades, and yields to the headphones", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/2D");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
  const portrait = page.locator(".portrait-2d");
  const mouth = (await page
    .getByRole("button", { name: "Make a cheeky face" })
    .boundingBox())!;
  const scale = mouth.width / 0.26;
  const x = mouth.x + mouth.width / 2;
  const y = mouth.y - scale * 0.22;
  await page.mouse.move(x, y);
  for (let i = 1; i <= 5; i++) {
    await page.clock.runFor(40);
    await page.mouse.move(x + i * 2, y);
  }
  const slow = Number(await portrait.getAttribute("data-reveal-radius"));
  await page.clock.runFor(16);
  await page.mouse.move(x + 90, y);
  const fast = Number(await portrait.getAttribute("data-reveal-radius"));
  expect(fast).toBeGreaterThan(slow + 10);
  await page.clock.runFor(32);
  await expect(portrait).toHaveAttribute("data-hover-mask", "true");
  await page.clock.runFor(900);
  await expect(portrait).toHaveAttribute("data-hover-mask", "false");
  await page.mouse.move(x, y);
  await page.clock.runFor(32);
  await expect(portrait).toHaveAttribute("data-hover-mask", "true");
  await page
    .getByRole("button", { name: "Take headphones off" })
    .first()
    .click();
  await page.clock.runFor(32);
  await expect(portrait).toHaveAttribute("data-hover-mask", "false");
  await expect(portrait).toHaveAttribute("data-headphones", "off");
  await page.clock.runFor(100);
  await page
    .getByRole("button", { name: "Put headphones back on" })
    .first()
    .click();
  await page.clock.runFor(100);
  await page
    .getByRole("button", { name: "Take headphones off" })
    .first()
    .click();
  await page.clock.runFor(1000);
  await expect(portrait).toHaveAttribute("data-headphones", "off");
  await expect(portrait.locator("canvas")).toHaveCount(1);
  expect(
    Number(await portrait.getAttribute("data-headphone-depth")),
  ).toBeGreaterThan(0.97);
  expect(
    await portrait.evaluate((host) =>
      Number(getComputedStyle(host, "::after").opacity),
    ),
  ).toBeGreaterThan(0.58);
  await page
    .getByRole("button", { name: "Put headphones back on" })
    .first()
    .click();
  await page.clock.runFor(1900);
  expect(
    Number(await portrait.getAttribute("data-headphone-depth")),
  ).toBeLessThan(0.005);
  await expect(
    page.getByRole("navigation", { name: "Genre legend" }),
  ).toHaveCount(0);
});

test("touch keeps headset state through Aries without activating the hover mask", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/2D");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
  const portrait = page.locator(".portrait-2d");
  await page.getByRole("button", { name: "Take headphones off" }).first().tap();
  await page.clock.runFor(1000);
  await expect(portrait).toHaveAttribute("data-headphones", "off");
  await expect(portrait).toHaveAttribute("data-hover-mask", "false");
  await page
    .getByRole("button", {
      name: "Reveal wrestle with the Aries constellation",
    })
    .tap();
  await page.clock.runFor(32);
  await expect(portrait).toHaveAttribute("data-signature", "true");
  await page.clock.fastForward(7000);
  await expect(portrait).toHaveAttribute("data-signature", "false");
  await expect(portrait).toHaveAttribute("data-headphones", "off");
  await expect(page.locator(".portrait-aries circle")).toHaveCount(4);
  await context.close();
});

test("a failed mask asset leaves the original portrait and controls available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/spider-mask.svg", (route) => route.abort());
  await page.goto("/2D");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  const portrait = page.locator(".portrait-2d");
  await expect(portrait.locator("canvas")).toBeVisible();
  const mouth = (await page
    .getByRole("button", { name: "Make a cheeky face" })
    .boundingBox())!;
  await page.mouse.move(mouth.x + mouth.width / 2, mouth.y - mouth.width);
  await expect(portrait).toHaveAttribute("data-hover-mask", "false");
  await page
    .getByRole("button", { name: "Take headphones off" })
    .first()
    .click();
  await expect(portrait).toHaveAttribute("data-headphones", "off");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Reveal wrestle with the Aries constellation",
    }),
  ).toBeEnabled();
  expect(
    (await portrait.locator("canvas").screenshot()).length,
  ).toBeGreaterThan(20000);
  expect(errors).toEqual([]);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`phone finger drag reveals the mask and cleans up on release (${reducedMotion})`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.clock.install();
    await page.goto("/2D");
    await expect(page.locator(".scene-loading")).toHaveCount(0);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
    const portrait = page.locator(".portrait-2d");
    const mouth = (await page
      .getByRole("button", { name: "Make a cheeky face" })
      .boundingBox())!;
    const x = mouth.x + mouth.width / 2 - 25;
    const y = mouth.y - (mouth.width / 0.26) * 0.22;
    const input = await context.newCDPSession(page);
    const finger = (id: number, px: number) => ({
      id,
      x: px,
      y,
      radiusX: 4,
      radiusY: 4,
      force: 1,
    });
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [finger(1, x)],
    });
    await page.clock.runFor(32);
    await expect(portrait).toHaveAttribute("data-hover-mask", "false");
    // Native touch input must reach Pointer Events; synthetic mouse hover would hide the phone bug.
    for (let i = 1; i <= 4; i++) {
      await input.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [finger(1, x + i * 14)],
      });
      await page.clock.runFor(32);
    }
    await expect(portrait).toHaveAttribute("data-hover-mask", "true");
    await expect(page.locator(".portrait-song-tooltip")).toBeHidden();
    expect(
      (await portrait.locator("canvas").screenshot()).length,
    ).toBeGreaterThan(20000);
    await page.screenshot({ path: `output/phone-mask-${reducedMotion}.png` });
    await input.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.clock.fastForward(1000);
    await expect(portrait).toHaveAttribute("data-hover-mask", "false");
    // A second contact cancels the reveal rather than leaving a stuck or jumping brush.
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [finger(1, x)],
    });
    await input.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [finger(1, x + 20)],
    });
    await page.clock.runFor(32);
    await expect(portrait).toHaveAttribute("data-hover-mask", "true");
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [finger(1, x + 20), finger(2, x + 55)],
    });
    await page.clock.runFor(32);
    await expect(portrait).toHaveAttribute("data-hover-mask", "false");
    await input.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    // The next fresh gesture works, and cancellation immediately clears it.
    await input.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [finger(3, x)],
    });
    await input.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [finger(3, x + 20)],
    });
    await page.clock.runFor(32);
    await expect(portrait).toHaveAttribute("data-hover-mask", "true");
    await input.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await page.clock.runFor(32);
    await expect(portrait).toHaveAttribute("data-hover-mask", "false");
    await page
      .getByRole("button", { name: "Take headphones off" })
      .first()
      .tap();
    await page.clock.runFor(32);
    await expect(portrait).toHaveAttribute("data-headphones", "off");
    await expect(portrait).toHaveAttribute("data-hover-mask", "false");
    expect(errors).toEqual([]);
    await context.close();
  });
}
