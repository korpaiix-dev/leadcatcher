import 'dotenv/config';
import { Locator } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { saveResults } from './lib/session';
import { SearchResult } from './types';

async function extractCard(card: Locator): Promise<SearchResult | null> {
  const links = await card.locator('a[href*="/groups/"]').all();
  if (links.length === 0) return null;

  let groupUrl = '';
  let name = '';
  for (const link of links) {
    const href = await link.getAttribute('href', { timeout: 500 }).catch(() => null);
    const text = (await link.textContent({ timeout: 500 }).catch(() => null) || '').trim();
    if (href && !groupUrl) {
      groupUrl = (href.startsWith('http') ? href : 'https://www.facebook.com' + href).split('?')[0];
    }
    if (text && text.length > 1 && !name) name = text;
    if (groupUrl && name) break;
  }
  if (!groupUrl) return null;

  const fullText = (await card.textContent().catch(() => '')) || '';
  let memberCountText = '';
  const m = fullText.match(/([\d][\d,\.]*\s*[KkMm]?)\s*(?:สมาชิก|members?)/);
  if (m) memberCountText = m[1].trim() + ' สมาชิก';

  return { name: name || groupUrl, url: groupUrl, memberCountText, privacy: 'unknown' };
}

async function main(): Promise<void> {
  if (!hasExistingSession()) {
    log.err('ไม่พบ session — รัน `npm run login` ก่อน');
    process.exit(1);
  }

  log.info('โหลดรายการกลุ่มที่คุณเข้าอยู่...');
  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  // The user's "Groups you've joined" page
  await page.goto('https://www.facebook.com/groups/joins/', { waitUntil: 'domcontentloaded' });
  await humanDelay(3000, 6000);

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const maxResults = 100;
  const maxScrolls = 15;

  for (let scroll = 0; scroll < maxScrolls && results.length < maxResults; scroll++) {
    const containers = ['[role="main"] [role="article"]', '[role="main"] div[role="feed"] > div'];
    let cards: Locator | null = null;
    for (const sel of containers) {
      const loc = page.locator(sel);
      if ((await loc.count()) > 1) { cards = loc; break; }
    }
    if (!cards) {
      log.warn('ไม่พบ container กลุ่ม — อาจต้องอัปเดต selector');
      break;
    }

    const count = await cards.count();
    log.info(`Scroll ${scroll + 1}/${maxScrolls} — เจอ ${count} cards (รวมแล้ว ${results.length})`);

    for (let i = 0; i < count && results.length < maxResults; i++) {
      const extracted = await extractCard(cards.nth(i));
      if (!extracted) continue;
      if (seen.has(extracted.url)) continue;
      seen.add(extracted.url);
      results.push(extracted);
      log.ok(`  ${results.length}. ${extracted.name}`);
    }

    if (results.length >= maxResults) break;
    await humanScroll(page, 1000);
    await humanDelay(2000, 4000);
  }

  const filename = `mygroups-${Date.now()}.json`;
  const filePath = saveResults(filename, results);
  log.ok(`บันทึก ${results.length} กลุ่มที่คุณเข้าอยู่ ที่ ${filePath}`);

  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
