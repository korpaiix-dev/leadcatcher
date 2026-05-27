import 'dotenv/config';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { FB_SELECTORS } from './lib/selectors';
import { saveResults } from './lib/session';
import { SearchResult } from './types';

async function main(): Promise<void> {
  const query = process.argv[2];
  if (!query) {
    log.err('กรุณาใส่ keyword เช่น: npm run search -- "งานแต่งงาน"');
    process.exit(1);
  }

  if (!hasExistingSession()) {
    log.err('ไม่พบ session — กรุณารัน `npm run login` ก่อน');
    process.exit(1);
  }

  log.info(`ค้นหากลุ่มด้วย keyword: "${query}"`);
  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  const url = `https://www.facebook.com/groups/search/groups_home/?q=${encodeURIComponent(query)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await humanDelay(3000, 6000);

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const maxResults = 30;
  const maxScrolls = 5;

  for (let scroll = 0; scroll < maxScrolls && results.length < maxResults; scroll++) {
    const cards = page.locator(FB_SELECTORS.searchResultCard[0]);
    const count = await cards.count();
    log.info(`Scroll ${scroll + 1}/${maxScrolls} — เจอ ${count} cards`);

    for (let i = 0; i < count && results.length < maxResults; i++) {
      try {
        const card = cards.nth(i);
        const link = card.locator('a[href*="/groups/"]').first();
        const href = await link.getAttribute('href').catch(() => null);
        if (!href) continue;

        const groupUrl = (href.startsWith('http') ? href : `https://www.facebook.com${href}`)
          .split('?')[0];
        if (seen.has(groupUrl)) continue;
        seen.add(groupUrl);

        const name = ((await link.textContent().catch(() => null)) || 'unknown').trim();
        const text = (await card.textContent().catch(() => null)) || '';

        const memberMatch = text.match(/[\d,\.\s]+(?:สมาชิก|members|member|K|M)/i);
        const memberCountText = memberMatch ? memberMatch[0].trim() : '';

        let privacy: SearchResult['privacy'] = 'unknown';
        if (/public|สาธารณะ/i.test(text)) privacy = 'public';
        else if (/private|ส่วนตัว/i.test(text)) privacy = 'private';

        results.push({ name, url: groupUrl, memberCountText, privacy });
        log.ok(`  ${results.length}. ${name} — ${memberCountText} (${privacy})`);
      } catch {
        // skip malformed cards
      }
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
