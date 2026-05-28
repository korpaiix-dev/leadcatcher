import 'dotenv/config';
import { Page, Locator } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanMouseJitter } from './lib/human';
import { log } from './lib/logger';
import { loadConfig } from './lib/session';
import { debugScreenshot } from './lib/fb-groups';
import { JoinMode } from './types';

// Inter-group delays per mode (in ms). Share is the highest-risk action,
// so even 'normal' is conservative.
const MODE_DELAYS: Record<JoinMode, [number, number]> = {
  safe: [5 * 60_000, 15 * 60_000],   // 5-15 min between groups
  normal: [60_000, 3 * 60_000],      // 1-3 min between groups
  aggressive: [15_000, 45_000],      // dangerous — only if user accepts
};

async function findFirstVisible(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    const exists = (await loc.count()) > 0;
    if (!exists) continue;
    const visible = await loc.isVisible().catch(() => false);
    if (visible) return loc;
  }
  return null;
}

async function findComposeTrigger(page: Page): Promise<Locator | null> {
  return findFirstVisible(page, [
    '[role="button"][aria-label*="Write something" i]',
    '[role="button"][aria-label*="เขียนอะไร" i]',
    '[role="button"][aria-label*="คุณกำลังคิดอะไร" i]',
    'div[role="main"] [role="button"]:has-text("Write something")',
    'div[role="main"] [role="button"]:has-text("เขียนอะไรบางอย่าง")',
  ]);
}

async function findTextbox(page: Page): Promise<Locator | null> {
  return findFirstVisible(page, [
    'div[role="dialog"] [role="textbox"][contenteditable="true"]',
    'div[role="dialog"] [contenteditable="true"][aria-label*="public" i]',
    'div[role="dialog"] [contenteditable="true"][aria-label*="สาธารณะ" i]',
    'div[role="dialog"] [contenteditable="true"]',
  ]);
}

async function findPostButton(page: Page): Promise<Locator | null> {
  return findFirstVisible(page, [
    'div[role="dialog"] [role="button"][aria-label="Post"]',
    'div[role="dialog"] [role="button"][aria-label="โพสต์"]',
    'div[role="dialog"] [aria-label*="Post" i][role="button"]',
  ]);
}

async function shareToGroup(
  page: Page,
  groupUrl: string,
  groupName: string,
  message: string,
  mode: JoinMode
): Promise<{ ok: boolean; reason?: string }> {
  log.info(`เปิดกลุ่ม: ${groupName}`);
  await page.goto(groupUrl, { waitUntil: 'domcontentloaded' });
  await humanDelay(4000, 7000);
  await humanMouseJitter(page);

  const trigger = await findComposeTrigger(page);
  if (!trigger) {
    log.warn('  ไม่พบช่อง compose — อาจ FB เปลี่ยน DOM หรือกลุ่มไม่ให้ post');
    await debugScreenshot(page, `share-no-trigger`);
    return { ok: false, reason: 'no compose trigger' };
  }

  log.info('  คลิกช่อง compose...');
  await trigger.click();
  await humanDelay(2500, 5000);

  const textbox = await findTextbox(page);
  if (!textbox) {
    log.warn('  ไม่พบ textbox dialog');
    await debugScreenshot(page, `share-no-textbox`);
    return { ok: false, reason: 'no textbox' };
  }

  log.info('  พิมพ์ข้อความ...');
  await textbox.click();
  await humanDelay(800, 1500);
  // Type with per-char random delay to look human
  await page.keyboard.type(message, { delay: 30 + Math.floor(Math.random() * 70) });
  await humanDelay(2000, 4000);

  if (mode === 'safe') {
    log.warn('  Safe mode: หยุดให้คุณตรวจ + กด Post เองในหน้าต่าง Chromium (รอสูงสุด 5 นาที)');
    // Poll for dialog close (indicates user posted) or timeout
    const start = Date.now();
    while (Date.now() - start < 5 * 60_000) {
      const dialogCount = await page.locator('div[role="dialog"]').count();
      if (dialogCount === 0) {
        log.ok('  Detect: dialog หาย → คุณ post แล้ว');
        return { ok: true };
      }
      await page.waitForTimeout(2500);
    }
    log.warn('  Timeout 5 นาที — ข้ามไปกลุ่มถัดไป');
    return { ok: false, reason: 'safe mode timeout' };
  }

  // normal / aggressive: auto-click Post
  const postBtn = await findPostButton(page);
  if (!postBtn) {
    log.warn('  ไม่พบปุ่ม Post');
    await debugScreenshot(page, `share-no-post-btn`);
    return { ok: false, reason: 'no post button' };
  }

  log.info('  กดปุ่ม Post...');
  await postBtn.click();
  await humanDelay(4000, 7000);
  return { ok: true };
}

async function main(): Promise<void> {
  if (!hasExistingSession()) {
    log.err('ไม่พบ session — รัน `npm run login` ก่อน');
    process.exit(1);
  }

  const msg = process.argv[2];
  if (!msg || msg.length < 5) {
    log.err('Usage: npm run share -- "ข้อความที่จะโพสต์ (อย่างน้อย 5 ตัวอักษร)"');
    process.exit(1);
  }

  const config = loadConfig();
  if (!config.groups || config.groups.length === 0) {
    log.err('config.json ไม่มีกลุ่ม');
    process.exit(1);
  }

  const mode = (config.join?.mode || 'safe') as JoinMode;
  const [minDelay, maxDelay] = MODE_DELAYS[mode];

  log.warn(`============================================`);
  log.warn(`SHARE POST — mode: ${mode}`);
  log.warn(`Message: "${msg.slice(0, 80)}${msg.length > 80 ? '…' : ''}"`);
  log.warn(`Groups: ${config.groups.length}`);
  log.warn(`Delay between groups: ${minDelay/60000}-${maxDelay/60000} min`);
  log.warn(`============================================`);
  log.warn(`⚠️ คำเตือน: โพสต์ข้อความเดียวกันหลายกลุ่ม = spam signal`);
  log.warn(`⚠️ ถ้า FB ขึ้น CAPTCHA / "posting too fast" — หยุดทันที`);

  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  let success = 0;
  for (let i = 0; i < config.groups.length; i++) {
    const g = config.groups[i];
    log.info(`=== Share ${i + 1}/${config.groups.length}: ${g.name} ===`);
    try {
      const r = await shareToGroup(page, g.url, g.name, msg, mode);
      if (r.ok) {
        success++;
        log.ok(`  ✓ ${g.name}: ${r.reason || 'success'}`);
      } else {
        log.warn(`  ✗ ${g.name}: ${r.reason}`);
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      log.err(`  error: ${m}`);
    }

    if (i < config.groups.length - 1) {
      const wait = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
      log.info(`  รอ ${Math.round(wait / 60000)} นาทีก่อนกลุ่มถัดไป...`);
      await page.waitForTimeout(wait);
    }
  }

  log.ok(`สำเร็จ ${success}/${config.groups.length} กลุ่ม`);
  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
