import 'dotenv/config';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { saveResults } from './lib/session';
import { extractGroupsFromPage, debugScreenshot } from './lib/fb-groups';
import { SearchResult } from './types';

const CANDIDATE_URLS = [
  'https://www.facebook.com/groups/feed/',
  'https://www.facebook.com/groups/?category=membership',
  'https://www.facebook.com/groups/joins/',
];

async function main(): Promise<void> {
  if (!hasExistingSession()) {
    log.err('ไม่พบ session — รัน `npm run login` ก่อน');
    process.exit(1);
  }

  log.info('โหลดรายการกลุ่มที่คุณเข้าอยู่...');
  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  const merged = new Map<string, SearchResult>();

  for (const target of CANDIDATE_URLS) {
    log.info(`เปิด: ${target}`);
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      log.warn(`  เปิด URL ไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    await humanDelay(3000, 5000);
    log.info(`  หน้าจริง: ${page.url()}`);
    log.info(`  title: ${await page.title()}`);

    // Scroll a few times — joined-groups list lazy-loads
    for (let i = 0; i < 8; i++) {
      const batch = await extractGroupsFromPage(page);
      for (const g of batch) if (!merged.has(g.url)) merged.set(g.url, g);
      log.info(`  scroll ${i + 1}/8 — เจอ ${batch.length} กลุ่มในรอบนี้ (รวม ${merged.size})`);
      if (merged.size >= 100) break;
      await humanScroll(page, 1000);
      await humanDelay(1500, 3000);
    }

    if (merged.size > 0) break; // first URL that returns something wins
  }

  await debugScreenshot(page, 'mygroups');

  const all = Array.from(merged.values());
  const filename = `mygroups-${Date.now()}.json`;
  const filePath = saveResults(filename, all);

  if (all.length === 0) {
    log.warn('ไม่เจอกลุ่มเลย — เช็ค data/screenshots/mygroups-*.png ว่าหน้าจริงเป็นอะไร');
    log.warn('แล้วบอก Claude ให้ปรับ src/lib/fb-groups.ts ตามสิ่งที่เห็น');
  } else {
    log.ok(`บันทึก ${all.length} กลุ่มที่คุณเข้าอยู่ ที่ ${filePath}`);
  }

  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
