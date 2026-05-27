import { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { SearchResult } from '../types';
import { log } from './logger';

// Path segments that look like /groups/X but are not actual groups
const NON_GROUP_SEGMENTS = new Set([
  'joins', 'search', 'feed', 'create', 'discover',
  'discover_recommendations', 'membership_requests',
  'manage', 'invites', 'browse', 'category',
]);

/**
 * Extract every Facebook group link visible on the current page.
 *
 * Strategy: query *all* anchors that look like a group permalink, group them
 * by canonical URL, and pick the best text label we can find for each.
 * This sidesteps the "card container" guessing game — whatever FB's layout
 * looks like today, the links are still in the DOM.
 */
export async function extractGroupsFromPage(page: Page): Promise<SearchResult[]> {
  const anchors = await page.locator('a[href*="/groups/"]').all();
  const map = new Map<string, { url: string; name: string; aroundText: string }>();

  for (const a of anchors) {
    try {
      const href = await a.getAttribute('href', { timeout: 500 }).catch(() => null);
      if (!href) continue;

      // normalise to canonical /groups/<id-or-slug>
      const urlObj = (() => {
        try {
          return new URL(href, 'https://www.facebook.com');
        } catch { return null; }
      })();
      if (!urlObj) continue;

      const segMatch = urlObj.pathname.match(/^\/groups\/([^/?#]+)\/?/);
      if (!segMatch) continue;

      const slug = segMatch[1];
      if (NON_GROUP_SEGMENTS.has(slug)) continue;

      const canonical = `https://www.facebook.com/groups/${slug}`;
      // Prefer the first <span>/heading inside the anchor — FB renders the
      // name in one node and the "ใช้งานล่าสุด X" timestamp in a sibling.
      let text = await a.evaluate((el) => {
        const heading = el.querySelector('span[dir="auto"], h2, h3, [role="heading"]');
        const raw = (heading && heading.textContent) || el.textContent || '';
        return raw.trim();
      }).catch(() => '');
      // Strip common trailing noise so the name stays clean
      text = text
        .replace(/ใช้งานล่าสุด.*$/u, '')
        .replace(/Last active.*$/iu, '')
        .replace(/\s+·\s+.*$/u, '')
        .trim();

      const existing = map.get(canonical);
      if (!existing) {
        // Walk up to the parent and grab some surrounding text — needed later
        // for member count / privacy parsing.
        let surround = '';
        try {
          const parentText = await a.evaluate((el) => {
            let n: HTMLElement | null = el as HTMLElement;
            for (let i = 0; i < 4 && n; i++) n = n.parentElement;
            return n ? (n.innerText || '') : '';
          });
          surround = (parentText || '').trim();
        } catch { /* ignore */ }

        map.set(canonical, { url: canonical, name: text, aroundText: surround });
      } else {
        // prefer the longest non-empty label
        if (text.length > existing.name.length) existing.name = text;
      }
    } catch { /* skip this anchor */ }
  }

  const results: SearchResult[] = [];
  for (const g of map.values()) {
    let memberCountText = '';
    const m = g.aroundText.match(/([\d][\d,\.]*\s*[KkMm]?)\s*(?:สมาชิก|members?)/);
    if (m) memberCountText = m[1].trim() + ' สมาชิก';

    let privacy: SearchResult['privacy'] = 'unknown';
    if (/public group|กลุ่มสาธารณะ|สาธารณะ/i.test(g.aroundText)) privacy = 'public';
    else if (/private group|กลุ่มส่วนตัว|ส่วนตัว/i.test(g.aroundText)) privacy = 'private';

    let name = g.name;
    if (!name) {
      // last-ditch fallback: pretty version of slug
      name = g.url.replace(/^https?:\/\/[^/]+\/groups\//, '').replace(/\/$/, '');
    }

    results.push({ name, url: g.url, memberCountText, privacy });
  }
  return results;
}

/**
 * Save a screenshot for debugging. Returns the path that was written.
 */
export async function debugScreenshot(page: Page, label: string): Promise<string> {
  const dir = path.resolve(__dirname, '../../data/screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}-${Date.now()}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
    log.info(`  screenshot: ${file}`);
  } catch (err) {
    log.warn(`  screenshot failed: ${err instanceof Error ? err.message : err}`);
  }
  return file;
}
