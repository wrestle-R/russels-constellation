import { test, expect } from "@playwright/test";

test("guitar MP3 decodes, follows the reveal, and stops on navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args) {
        const audio = new target(...args);
        (window as unknown as { themeAudio: HTMLAudioElement }).themeAudio =
          audio;
        return audio;
      },
    });
  });
  await page.clock.install();
  await page.goto("/2D");
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 2000);
  // Establish the browser's user activation before hover playback.
  await page.mouse.click(4, 120);
  const mouth = (await page
    .getByRole("button", { name: "Make a cheeky face" })
    .boundingBox())!;
  const x = mouth.x + mouth.width / 2,
    y = mouth.y - (mouth.width / 0.26) * 0.22;
  await page.mouse.move(x, y);
  await page.clock.runFor(32);
  await expect(page.locator(".portrait-2d")).toHaveAttribute(
    "data-hover-mask",
    "true",
  );
  const status = () =>
    page.evaluate(() => {
      const a = (window as unknown as { themeAudio: HTMLAudioElement })
        .themeAudio;
      return {
        paused: a?.paused,
        ready: a?.readyState,
        duration: a?.duration,
        error: a?.error?.code,
        loop: a?.loop,
      };
    });
  await expect
    .poll(async () => (await status()).ready)
    .toBeGreaterThanOrEqual(2);
  await expect.poll(async () => (await status()).paused).toBe(false);
  expect((await status()).duration).toBeGreaterThan(58);
  expect((await status()).error).toBeUndefined();
  expect((await status()).loop).toBe(true);
  await page.clock.runFor(1000);
  await expect.poll(async () => (await status()).paused).toBe(true);
  await page.mouse.move(x + 3, y);
  await page.clock.runFor(32);
  await expect.poll(async () => (await status()).paused).toBe(false);
  await page.getByRole("link", { name: /3D/ }).click();
  await expect.poll(async () => (await status()).paused).toBe(true);
});
