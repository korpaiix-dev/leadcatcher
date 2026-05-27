import 'dotenv/config';
import { Page } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { log } from './lib/logger';
import { FB_SELECTORS } from './lib/selectors';

async function waitForAnySelector(
  page: Page,
  selectors: string[],
  totalTimeoutMs: number
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < totalTimeoutMs) {
    for (const sel of selectors) {
      try {
        const handle = await page.waitForSelector(sel, { timeout: 1000 });
        if (handle) return sel;
      } catch {
        // try next selector
      }
    }
  }
  return null;
}

async function main(): Promise<void> {
  log.info('เปิด Chromium (headed) เพื่อให้คุณ login Facebook ด้วยตัวเอง...');

  if (hasExistingSession()) {
    log.warn('พบ session เดิม — ถ้า login อยู่แล้ว ไม่ต้อง login ใหม่');
  }

  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });

  log.info('กรุณา login Facebook ในหน้าต่างที่เปิดขึ้นมา');
  log.info('หลัง login เสร็จ ระบบจะ detect ให้เอง (รอถึง 5 นาที)...');

  const matched = await waitForAnySelector(
    page,
    FB_SELECTORS.loggedInIndicator,
    5 * 60 * 1000
  );

  if (matched) {
    log.ok(`Login สำเร็จ! (detected via: ${matched})`);
    log.ok('Session ถูก save ไว้แล้วใน data/session/');
    log.ok('คุณสามารถปิดหน้าต่างนี้ แล้วรัน `npm run scan` ต่อได้');
  } else {
    log.err('Timeout — ไม่พบสัญญาณว่า login สำเร็จภายใน 5 นาที');
  }

  // give cookies a moment to flush to disk
  await page.waitForTimeout(5000);
  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
