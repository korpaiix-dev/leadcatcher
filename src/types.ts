export interface GroupConfig {
  url: string;
  name: string;
}

export interface ScanConfig {
  maxPostsPerGroup: number;
  maxScrollAttempts: number;
  delayBetweenActionsMs: [number, number];
}

export type JoinMode = 'safe' | 'normal' | 'aggressive';

export interface JoinConfig {
  mode: JoinMode;
  membershipAnswers: Record<string, string>;
}

export interface AppConfig {
  groups: GroupConfig[];
  keywords: string[];
  scan: ScanConfig;
  join: JoinConfig;
}

export interface PostMatch {
  postId: string;
  groupUrl: string;
  groupName: string;
  author: string;
  content: string;
  postedAt: string;       // raw text from FB UI
  url: string;            // direct post link
  matchedKeywords: string[];
  scrapedAt: string;      // ISO datetime
}

export interface SearchResult {
  name: string;
  url: string;
  memberCountText: string;
  privacy: 'public' | 'private' | 'unknown';
}
