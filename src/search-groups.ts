import 'dotenv/config';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { saveResults } from './lib/session';
import { extractGroupsFromPage, debugScreenshot } from './lib/fb-groups';
import { SearchResult } from './types';

async function main(): Promise<void> {
  const query = process.argv[2];
  if (!query) {
    log.err('ใส่ keyword: npm run search -- "งานแต่งงาน"');
    process.exit(1);
  }
  if (!hasExistingSession()) {
    log.err('ไม่พบ session — รัน `npm run login` ก่อน');
    process.exit(1);
  }

  log.info(`ค้นหากลุ่ม: "${query}"`);
  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  const url = `https://www.facebook.com/groups/search/groups_home/?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await humanDelay(3000, 5000);
  log.info(`  หน้าจริง: ${page.url()}`);

  const merged = new Map<string, SearchResult>();
  const maxResults = 30;

  for (let i = 0; i < 8 && merged.size < maxResults; i++) {
    const batch = await extractGroupsFromPage(page);
    for (const g of batch) if (!merged.has(g.url)) merged.set(g.url, g);
    log.info(`  scroll ${i + 1}/8 — มีในหน้านี้ ${batch.length} (รวม ${merged.size})`);
    if (merged.size >= maxResults) break;
    await humanScroll(page, 900);
    await humanDelay(2000, 3500);
  }

  await debugScreenshot(page, `search-${query.replace(/[^\w฀-๿]/g, '_')}`);

  const all = Array.from(merged.values()).slice(0, maxResults);
  const safeQuery = query.replace(/[^\w฀-๿]/g, '_');
  const filename = `search-${safeQuery}-${Date.now()}.json`;
  const filePath = saveResults(filename, all);
  if (all.length === 0) {
    log.warn('ไม่เจอกลุ่ม — เช็ค data/screenshots/search-*.png');
  } else {
    log.ok(`บันทึก ${all.length} กลุ่ม ที่ ${filePath}`);
    for (const r of all.slice(0, 10)) {
      log.ok(`  • ${r.name} — ${r.memberCountText || '?'} (${r.privacy})`);
    }
  }

  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
