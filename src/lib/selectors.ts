/**
 * Centralized Facebook DOM selectors.
 *
 * When FB updates their UI (which happens often), update selectors here only.
 * Each element has multiple fallback selectors — we try each in order until one
 * works. This gives us a single chokepoint for "FB selector versioning".
 */
export const FB_SELECTORS = {
  // Logged-in indicators — appear in the top banner once auth is complete
  loggedInIndicator: [
    'div[role="banner"] [aria-label*="Account"]',
    'div[role="banner"] [aria-label*="บัญชี"]',
    'div[aria-label="Create a post"]',
    'div[aria-label="สร้างโพสต์"]',
    'div[role="navigation"] a[aria-label="Home"]',
    'div[role="navigation"] a[aria-label="หน้าหลัก"]',
  ],

  // Group page elements
  groupName: ['h1', '[role="main"] h1'],

  // Each post in the feed
  groupPosts: [
    '[role="article"]',
    'div[data-pagelet*="GroupFeed"] [role="article"]',
  ],

  postAuthor: ['h3 a strong', 'h2 a strong', 'h3 strong'],

  postContent: [
    'div[data-ad-preview="message"]',
    'div[data-ad-comet-preview="message"]',
  ],

  postTimestamp: [
    'a[aria-label][role="link"][href*="/posts/"]',
    'a[aria-label][role="link"][href*="/permalink/"]',
  ],

  postLink: [
    'a[href*="/posts/"]',
    'a[href*="/permalink/"]',
    'a[href*="/groups/"][href*="/posts/"]',
  ],

  // Group search results page
  // (facebook.com/groups/search/groups_home/?q=...)
  searchResultCard: ['[role="article"]', 'div[role="feed"] > div'],

  // Join button on a group page
  joinButton: [
    'div[aria-label="Join group"]',
    'div[aria-label="เข้าร่วมกลุ่ม"]',
  ],

  // Membership question dialog
  membershipDialog: ['div[role="dialog"]'],
  membershipQuestion: [
    'div[role="dialog"] textarea',
    'div[role="dialog"] input[type="text"]',
  ],
  submitMembership: [
    'div[role="dialog"] div[aria-label="Submit"]',
    'div[role="dialog"] div[aria-label="ส่ง"]',
  ],
};
