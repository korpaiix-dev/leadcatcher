import 'dotenv/config';
import { Page } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { saveResults } from './lib/session';
import { extractGroupsFromPage, debugScreenshot } from './lib/fb-groups';
import { SearchResult } from './types';

/**
 * On /groups/feed/ the sidebar lists "กลุ่มที่คุณเข้าร่วม" with a
 * "ดูทั้งหมด" link that expands the section to show all joined
 * groups. Click that if we can find it.
 */
async function expandJoinedGroupsSection(page: Page): Promise<boolean> {
  const linkTexts = ['ดูทั้งหมด', 'See all', 'See all your groups'];
  for (const text of linkTexts) {
    try {
      const els = await page.getByText(text, { exact: false }).all();
      for (const e of els) {
        const surround = await e.evaluate((el) => {
          let n: Element | null = el as Element;
          for (let i = 0; i < 6 && n; i++) n = n.parentElement;
          return n ? (n as HTMLElement).innerText || '' : '';
        }).catch(() => '');
        if (/เข้าร่วม|joined|membership/i.test(surround)) {
          await e.click({ timeout: 3000 }).catch(() => {});
          log.ok(`  คลิก "${text}" สำเร็จ`);
          await humanDelay(3000, 5000);
          return true;
        }
      }
    } catch { /* try next */ }
  }
  return false;
}

async function main(): Promise<void> {
  if (!hasExistingSession()) {
    log.err('ไม่พบ session — รัน `npm run login` ก่อน');
    process.exit(1);
  }

  log.info('โหลดรายการกลุ่มที่คุณเข้าอยู่...');
  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  const merged = new Map<string, SearchResult>();

  // Try the most direct URL first
  const urls = [
    'https://www.facebook.com/groups/?category=membership',
    'https://www.facebook.com/groups/feed/',
    'https://www.facebook.com/groups/joins/',
  ];

  for (const target of urls) {
    log.info(`เปิด: ${target}`);
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    } catch (err) {
      log.warn(`  เปิดไม่สำเร็จ: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    await humanDelay(3000, 5000);
    log.info(`  URL จริง: ${page.url()}`);

    // First extraction — picks up anything in the sidebar
    let batch = await extractGroupsFromPage(page);
    for (const g of batch) if (!merged.has(g.url)) merged.set(g.url, g);
    log.info(`  รอบแรก เจอ ${batch.length} (รวม ${merged.size})`);

    // Try to expand "joined groups" if visible
    await expandJoinedGroupsSection(page);

    // Scroll and re-extract
    for (let i = 0; i < 10 && merged.size < 100; i++) {
      batch = await extractGroupsFromPage(page);
      for (const g of batch) if (!merged.has(g.url)) merged.set(g.url, g);
      log.info(`  scroll ${i + 1}/10 — รวม ${merged.size}`);
      await humanScroll(page, 1200);
      await humanDelay(1500, 3000);
    }

    if (merged.size > 5) break; // got a useful batch, no need to try other URLs
  }

  await debugScreenshot(page, 'mygroups');

  const all = Array.from(merged.values());
  const filename = `mygroups-${Date.now()}.json`;
  const filePath = saveResults(filename, all);

  if (all.length === 0) {
    log.warn('ไม่เจอกลุ่มเลย — ดู screenshot ที่ data/screenshots/mygroups-*.png');
  } else {
    log.ok(`บันทึก ${all.length} กลุ่มที่คุณเข้าอยู่ ที่ ${filePath}`);
    log.info('ตัวอย่าง 10 กลุ่มแรก:');
    for (const r of all.slice(0, 10)) {
      log.ok(`  • ${r.name}`);
    }
  }

  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
