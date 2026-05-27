import 'dotenv/config';
import { Page, Locator } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanMouseJitter } from './lib/human';
import { log } from './lib/logger';
import { FB_SELECTORS } from './lib/selectors';
import { loadConfig } from './lib/session';
import { JoinMode } from './types';

const MODE_DELAYS: Record<JoinMode, [number, number]> = {
  safe: [30_000, 90_000],     // 30-90 sec
  normal: [5_000, 15_000],    // 5-15 sec
  aggressive: [2_000, 5_000], // 2-5 sec — high ban risk
};

async function findClickable(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    const exists = (await loc.count()) > 0;
    if (!exists) continue;
    const visible = await loc.isVisible().catch(() => false);
    if (visible) return loc;
  }
  return null;
}

async function main(): Promise<void> {
  const groupUrl = process.argv[2];
  if (!groupUrl) {
    log.err('Usage: npm run join -- "https://www.facebook.com/groups/123456"');
    process.exit(1);
  }

  if (!hasExistingSession()) {
    log.err('ไม่พบ session — กรุณารัน `npm run login` ก่อน');
    process.exit(1);
  }

  const config = loadConfig();
  const mode = config.join.mode;
  log.info(`โหมด: ${mode}`);
  log.warn('Auto-join เป็นฟีเจอร์เสี่ยง — ระบบจะ delay ก่อน join ตามโหมด');

  const [minDelay, maxDelay] = MODE_DELAYS[mode];
  log.info(`รอ ${minDelay / 1000}-${maxDelay / 1000} วินาทีก่อน join...`);
  await humanDelay(minDelay, maxDelay);

  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  await page.goto(groupUrl, { waitUntil: 'domcontentloaded' });
  await humanDelay(3000, 6000);
  await humanMouseJitter(page);

  const joinBtn = await findClickable(page, FB_SELECTORS.joinButton);
  if (!joinBtn) {
    log.warn('ไม่พบปุ่ม Join — อาจเข้ากลุ่มอยู่แล้ว หรือ FB เปลี่ยน selector');
    await context.close();
    return;
  }

  log.info('กดปุ่ม Join...');
  await joinBtn.click();
  await humanDelay(2000, 5000);

  // Check for membership question dialog
  const dialog = page.locator(FB_SELECTORS.membershipDialog[0]);
  const hasDialog = (await dialog.count()) > 0;

  if (hasDialog) {
    log.warn('กลุ่มนี้มี membership question');
    if (mode === 'safe') {
      log.info('Safe mode: ปล่อยให้คุณตอบเอง (รอ 5 นาที)...');
      await page.waitForTimeout(5 * 60 * 1000);
    } else {
      // Phase 0: don't auto-fill — we haven't validated this is safe yet
      log.warn('Phase 0 ยังไม่ auto-fill — กรุณาตอบเองภายใน 2 นาที');
      await page.waitForTimeout(2 * 60 * 1000);
    }
  } else {
    log.ok('Join สำเร็จ (หรือเข้าคิวรอ admin อนุมัติ)');
  }

  await humanDelay(3000, 6000);
  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
