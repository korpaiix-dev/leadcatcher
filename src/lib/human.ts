import { Page } from 'playwright';

/** Sleep for a random time between min and max ms (inclusive). */
export async function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Scroll down using a few small random steps to mimic human scrolling. */
export async function humanScroll(page: Page, distance = 600): Promise<void> {
  const steps = 3 + Math.floor(Math.random() * 3);
  const stepSize = Math.ceil(distance / steps);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepSize);
    await humanDelay(200, 600);
  }
}

/** Move mouse around to look human-like (best effort, no-op on errors). */
export async function humanMouseJitter(page: Page): Promise<void> {
  try {
    const x = 200 + Math.random() * 800;
    const y = 200 + Math.random() * 400;
    await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) });
  } catch {
    // ignore
  }
}
