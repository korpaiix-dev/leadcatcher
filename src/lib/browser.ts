import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

const USER_DATA_DIR = path.resolve(__dirname, '../../data/session');

export async function openContext(headless = false): Promise<BrowserContext> {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const slowMo = parseInt(process.env.SLOWMO_MS || '0', 10);
  const effectiveHeadless = process.env.HEADLESS === 'true' ? true : headless;

  // Persistent context — keeps cookies + localStorage across runs
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: effectiveHeadless,
    slowMo,
    viewport: { width: 1280, height: 800 },
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
    ],
  });

  return context;
}

export function sessionPath(): string {
  return USER_DATA_DIR;
}

export function hasExistingSession(): boolean {
  // launchPersistentContext writes a Default directory after first run
  return fs.existsSync(path.join(USER_DATA_DIR, 'Default'));
}
