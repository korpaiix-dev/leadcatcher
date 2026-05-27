import 'dotenv/config';
import { Page, Locator } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { FB_SELECTORS } from './lib/selectors';
import { loadConfig, saveResults } from './lib/session';
import { debugScreenshot } from './lib/fb-groups';
import { GroupConfig, PostMatch } from './types';

async function tryText(article: Locator, selectors: string[]): Promise<string> {
  for (const sel of selectors) {
    const text = await article
      .locator(sel)
      .first()
      .textContent({ timeout: 800 })
      .catch(() => null);
    if (text && text.trim()) return text.trim();
  }
  return '';
}

async function tryAttr(article: Locator, selectors: string[], attr: string): Promise<string> {
  for (const sel of selectors) {
    const val = await article
      .locator(sel)
      .first()
      .getAttribute(attr, { timeout: 800 })
      .catch(() => null);
    if (val) return val;
  }
  return '';
}

/**
 * Last-ditch content extractor: grab the largest text block inside the article
 * that doesn't look like a button label or timestamp. Used when FB_SELECTORS
 * for postContent don't match.
 */
async function fallbackContent(article: Locator): Promise<string> {
  try {
    const text = await article.evaluate((el) => {
      const candidates: string[] = [];
      // Walk all divs and find ones with sizeable text
      const divs = el.querySelectorAll('div');
      for (const div of Array.from(divs)) {
        // Skip if it has too many child elements (probably a container)
        if (div.children.length > 6) continue;
        const t = (div as HTMLElement).innerText?.trim() || '';
        // Skip too-short or too-long content
        if (t.length < 20 || t.length > 3000) continue;
        // Skip if it's mostly numbers/symbols (timestamps, counters)
        const letters = (t.match(/[฀-๿a-zA-Z]/g) || []).length;
        if (letters / t.length < 0.4) continue;
        candidates.push(t);
      }
      // pick the longest unique candidate
      candidates.sort((a, b) => b.length - a.length);
      return candidates[0] || '';
    });
    return (text || '').trim();
  } catch {
    return '';
  }
}

interface ExtractedPost {
  author: string;
  content: string;
  postedAt: string;
  url: string;
  matchedKeywords: string[];
}

async function extractPost(
  article: Locator,
  keywords: string[]
): Promise<ExtractedPost | null> {
  // Try centralised selectors first, then fall back to a content sweep
  let content = await tryText(article, FB_SELECTORS.postContent);
  if (!content) content = await fallbackContent(article);
  if (!content) return null;

  const lower = content.toLowerCase();
  const matched = keywords.filter((k) => lower.includes(k.toLowerCase()));
  if (matched.length === 0) return null;

  const author = await tryText(article, FB_SELECTORS.postAuthor);
  const postedAt = await tryText(article, FB_SELECTORS.postTimestamp);
  let url = await tryAttr(article, FB_SELECTORS.postLink, 'href');
  if (url && !url.startsWith('http')) {
    url = `https://www.facebook.com${url}`;
  }

  return {
    author: author || 'unknown',
    content,
    postedAt,
    url,
    matchedKeywords: matched,
  };
}

async function scanGroup(
  page: Page,
  group: GroupConfig,
  keywords: string[],
  maxPosts: number,
  maxScrolls: number,
  delayRange: [number, number]
): Promise<PostMatch[]> {
  log.info(`เปิดกลุ่ม: ${group.name}`);
  await page.goto(group.url, { waitUntil: 'domcontentloaded' });
  await humanDelay(3000, 6000);
  log.info(`  URL จริง: ${page.url()}`);

  const seen = new Set<string>();
  const matches: PostMatch[] = [];
  let totalSeenArticles = 0;

  for (let scroll = 0; scroll < maxScrolls && matches.length < maxPosts; scroll++) {
    const articles = page.locator(FB_SELECTORS.groupPosts[0]);
    const count = await articles.count();
    log.info(
      `  Scroll ${scroll + 1}/${maxScrolls} — บนหน้านี้ ${count} articles (match แล้ว ${matches.length}, เคยเห็น ${totalSeenArticles})`
    );

    for (let i = 0; i < count && matches.length < maxPosts; i++) {
      const article = articles.nth(i);
      const extracted = await extractPost(article, keywords);
      totalSeenArticles++;
      if (!extracted) continue;
      // dedupe by URL when we have one, else by author+content prefix
      const dedupeKey = extracted.url || `${extracted.author}::${extracted.content.slice(0, 60)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const postId =
        (extracted.url && extracted.url.split('/').filter(Boolean).pop()) ||
        dedupeKey;

      matches.push({
        postId,
        groupUrl: group.url,
        groupName: group.name,
        author: extracted.author,
        content: extracted.content,
        postedAt: extracted.postedAt,
        url: extracted.url || group.url,
        matchedKeywords: extracted.matchedKeywords,
        scrapedAt: new Date().toISOString(),
      });

      log.ok(`  Match: "${extracted.matchedKeywords.join(', ')}" — ${extracted.author}`);
    }

    if (matches.length >= maxPosts) break;
    await humanScroll(page);
    await humanDelay(delayRange[0], delayRange[1]);
  }

  // Save a screenshot per group so we can diagnose 0-result runs
  const safeName = (group.name || group.url).replace(/[^\w฀-๿]/g, '_').slice(0, 40);
  await debugScreenshot(page, `scan-${safeName}`);

  log.info(`  สรุปกลุ่ม ${group.name}: เห็น ${totalSeenArticles} โพสต์ / match ${matches.length}`);
  return matches;
}

async function main(): Promise<void> {
  if (!hasExistingSession()) {
    log.err('ไม่พบ session — กรุณารัน `npm run login` ก่อน');
    process.exit(1);
  }

  const config = loadConfig();
  if (!config.groups || config.groups.length === 0) {
    log.err('config.json ยังไม่มีกลุ่ม — เพิ่ม URL กลุ่มก่อน');
    process.exit(1);
  }
  if (!config.keywords || config.keywords.length === 0) {
    log.err('config.json ยังไม่มี keyword — เพิ่มอย่างน้อย 1 คำ');
    process.exit(1);
  }

  log.info(
    `เริ่ม scan ${config.groups.length} กลุ่ม / keyword: ${config.keywords.join(', ')}`
  );

  const context = await openContext(false);
  const page = context.pages()[0] || (await context.newPage());

  const allMatches: PostMatch[] = [];
  for (const group of config.groups) {
    try {
      const matches = await scanGroup(
        page,
        group,
        config.keywords,
        config.scan.maxPostsPerGroup,
        config.scan.maxScrollAttempts,
        config.scan.delayBetweenActionsMs
      );
      allMatches.push(...matches);
      if (matches.length === 0) {
        log.warn(`กลุ่ม ${group.name}: เจอ 0 โพสต์ — ดู data/screenshots/scan-*.png เพื่อตรวจ DOM`);
      } else {
        log.ok(`กลุ่ม ${group.name}: เจอ ${matches.length} โพสต์`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.err(`กลุ่ม ${group.name}: error — ${msg}`);
    }
    await humanDelay(15000, 30000);
  }

  const filename = `scan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = saveResults(filename, allMatches);
  log.ok(`บันทึกผลที่ ${filePath}`);
  log.ok(`รวมทั้งหมด ${allMatches.length} match`);

  if (allMatches.length > 0) {
    log.info('ตัวอย่าง 5 โพสต์แรก:');
    for (const m of allMatches.slice(0, 5)) {
      log.ok(`  • [${m.matchedKeywords.join(',')}] ${m.author}: ${m.content.slice(0, 80)}...`);
    }
  }

  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
