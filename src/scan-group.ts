import 'dotenv/config';
import { Page, Locator } from 'playwright';
import { openContext, hasExistingSession } from './lib/browser';
import { humanDelay, humanScroll } from './lib/human';
import { log } from './lib/logger';
import { FB_SELECTORS } from './lib/selectors';
import { loadConfig, saveResults } from './lib/session';
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
  const content = await tryText(article, FB_SELECTORS.postContent);
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

  const seen = new Set<string>();
  const matches: PostMatch[] = [];

  for (let scroll = 0; scroll < maxScrolls && matches.length < maxPosts; scroll++) {
    const articles = page.locator(FB_SELECTORS.groupPosts[0]);
    const count = await articles.count();
    log.info(
      `  Scroll ${scroll + 1}/${maxScrolls} — เจอ ${count} articles (matched ${matches.length})`
    );

    for (let i = 0; i < count && matches.length < maxPosts; i++) {
      const article = articles.nth(i);
      const extracted = await extractPost(article, keywords);
      if (!extracted || !extracted.url) continue;
      if (seen.has(extracted.url)) continue;
      seen.add(extracted.url);

      const postId =
        extracted.url.split('/').filter(Boolean).pop() || extracted.url;

      matches.push({
        postId,
        groupUrl: group.url,
        groupName: group.name,
        author: extracted.author,
        content: extracted.content,
        postedAt: extracted.postedAt,
        url: extracted.url,
        matchedKeywords: extracted.matchedKeywords,
        scrapedAt: new Date().toISOString(),
      });

      log.ok(`  Match: "${extracted.matchedKeywords.join(', ')}" — ${extracted.author}`);
    }

    if (matches.length >= maxPosts) break;
    await humanScroll(page);
    await humanDelay(delayRange[0], delayRange[1]);
  }

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
      log.ok(`กลุ่ม ${group.name}: เจอ ${matches.length} โพสต์`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.err(`กลุ่ม ${group.name}: error — ${msg}`);
    }
    // long break between groups to look human
    await humanDelay(15000, 30000);
  }

  const filename = `scan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = saveResults(filename, allMatches);
  log.ok(`บันทึกผลที่ ${filePath}`);
  log.ok(`รวมทั้งหมด ${allMatches.length} match`);

  await context.close();
}

main().catch((err: Error) => {
  log.err(err.message);
  process.exit(1);
});
