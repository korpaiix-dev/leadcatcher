import 'dotenv/config';
import { Locator, Page } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { saveResults } from './lib/session';
import { SearchResult } from './types';

/**
 * Pull both the group URL and the most likely display name from a card.
 * FB renders avatar links and text links separately — first match by href,
 * then scan for the link that has actual text content.
 */
async function extractGroupCard(card: Locator): Promise<SearchResult | null> {
  const links = await card.locator('a[href*="/groups/"]').all();
  if (links.length === 0) return null;

  let groupUrl = '';
  let name = '';

  for (const link of links) {
    try {
      const href = await link.getAttribute('href', { timeout: 500 }).catch(() => null);
      const text = (await link.textContent({ timeout: 500 }).catch(() => null) || '').trim();
      if (href && !groupUrl) {
        groupUrl = (href.startsWith('http') ? href : 'https://www.facebook.com' + href).split('?')[0];
      }
      if (text && text.length > 1 && !name) {
        name = text;
      }
      if (groupUrl && name) break;
    } catch { /* skip */ }
  }

  if (!groupUrl) return null;

  // member count and privacy — read all text, parse out the bits
  const fullText = (await card.textContent().catch(() => '')) || '';

  // accept "1.2K members", "1,234 สมาชิก", "12K members" etc.
  let memberCountText = '';
  const m = fullText.match(/([\d][\d,\.]*\s*[KkMm]?)\s*(?:สมาชิก|members?)/);
  if (m) memberCountText = m[1].trim() + ' สมาชิก';

  let privacy: SearchResult['privacy'] = 'unknown';
  if (/public group|กลุ่มสาธารณะ|สาธารณะ/i.test(fullText)) privacy = 'public';
  else if (/private group|กลุ่มส่วนตัว|ส่วนตัว/i.test(fullText)) privacy = 'private';

  if (!name) {
    // last-ditch fallback: use the URL segment
    name = groupUrl.replace(/^https?:\/\/[^/]+\/groups\//, '').replace(/\/$/, '');
  }

  return { name, url: groupUrl, memberCountText, privacy };
}

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
  await humanDelay(3000, 6000);

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const maxResults = 30;
  const maxScrolls = 8;

  for (let scroll = 0; scroll < maxScrolls && results.length < maxResults; scroll++) {
    // Try a few container selectors — FB changes them often
    const containers = [
      '[role="feed"] > div',
      '[role="article"]',
    ];

    let cards: Locator | null = null;
    for (const sel of containers) {
      const loc = page.locator(sel);
      if ((await loc.count()) > 3) { cards = loc; break; }
    }

    if (!cards) {
      log.warn('ไม่พบ container ของผลค้นหา — อาจต้องอัปเดต selector');
      break;
    }

    const count = await cards.count();
    log.info(`Scroll ${scroll + 1}/${maxScrolls} — เจอ ${count} cards (รวมแล้ว ${results.length})`);

    for (let i = 0; i < count && results.length < maxResults; i++) {
      const extracted = await extractGroupCard(cards.nth(i));
      if (!extracted) continue;
      if (seen.has(extracted.url)) continue;
      seen.add(extracted.url);
      results.push(extracted);
      log.ok(`  ${results.length}. ${extracted.name} — ${extracted.memberCountText || '?'} (${extracted.privacy})`);
    }

    if (results.length >= maxResults) break;
    await humanScroll(page, 800);
    await humanDelay(2000, 4000);
  }

  const safeQuery = query.replace(/[^\w฀-๿]/g, '_');
  const filename = `search-${safeQuery}-${Date.now()}.json`;
  const filePath = saveResults(filename, results);
  log.ok(`บันทึก ${results.length} กลุ่ม ที่ ${filePath}`);

  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
