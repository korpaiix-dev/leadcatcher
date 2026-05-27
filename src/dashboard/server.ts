import 'dotenv/config';
import express from 'express';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { AppConfig, PostMatch, SearchResult } from '../types';

const PORT = 3737;
const ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.join(ROOT, 'data/results');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const LEADS_FILE = path.join(ROOT, 'data/leads.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DIR = path.resolve(__dirname, '../../data/session');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

let runningJob: ChildProcess | null = null;
let runningJobName: string | null = null;

// ---------- Config ----------
app.get('/api/config', (_req, res) => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return res.status(404).json({ error: 'config.json not found' });
  }
  const config: AppConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  res.json(config);
});

app.post('/api/config', (req, res) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2), 'utf-8');
  res.json({ ok: true });
});

// ---------- Lead status ----------
interface LeadRecord {
  status: 'new' | 'contacted' | 'won' | 'lost';
  notes?: string;
  updatedAt: string;
}

function loadLeads(): Record<string, LeadRecord> {
  if (!fs.existsSync(LEADS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveLeads(leads: Record<string, LeadRecord>) {
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
}

app.post('/api/lead', (req, res) => {
  const { url, status, notes } = req.body as {
    url: string;
    status: LeadRecord['status'];
    notes?: string;
  };
  if (!url || !status) return res.status(400).json({ error: 'url and status required' });
  const leads = loadLeads();
  leads[url] = { status, notes, updatedAt: new Date().toISOString() };
  saveLeads(leads);
  res.json({ ok: true });
});

// ---------- Results aggregator ----------
app.get('/api/results', (_req, res) => {
  const out = {
    posts: [] as Array<PostMatch & { status: string; notes?: string }>,
    searches: [] as Array<{ file: string; query: string; results: SearchResult[]; at: number }>,
    myGroups: [] as SearchResult[],
    myGroupsAt: 0,
    scanFiles: 0,
    sessionExists: fs.existsSync(path.join(SESSION_DIR, 'Default')),
  };

  if (!fs.existsSync(RESULTS_DIR)) return res.json(out);

  const files = fs.readdirSync(RESULTS_DIR);
  const leads = loadLeads();
  const seen = new Set<string>();
  let newestMyGroupsTime = 0;

  for (const file of files) {
    const filePath = path.join(RESULTS_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);

      if (file.startsWith('scan-') && Array.isArray(data)) {
        out.scanFiles++;
        for (const post of data as PostMatch[]) {
          if (seen.has(post.url)) continue;
          seen.add(post.url);
          const lead = leads[post.url];
          out.posts.push({
            ...post,
            status: lead?.status || 'new',
            notes: lead?.notes,
          });
        }
      } else if (file.startsWith('search-')) {
        const query = file.replace(/^search-/, '').replace(/-\d+\.json$/, '');
        out.searches.push({
          file, query,
          results: Array.isArray(data) ? data : [],
          at: stat.mtimeMs,
        });
      } else if (file.startsWith('mygroups-')) {
        // keep the most recent one only
        if (stat.mtimeMs > newestMyGroupsTime) {
          newestMyGroupsTime = stat.mtimeMs;
          out.myGroups = Array.isArray(data) ? data : [];
          out.myGroupsAt = stat.mtimeMs;
        }
      }
    } catch {
      // ignore malformed result files
    }
  }

  out.posts.sort(
    (a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime()
  );
  out.searches.sort((a, b) => b.at - a.at);

  res.json(out);
});

// ---------- Run a CLI command (Server-Sent Events) ----------
const ALLOWED = new Set(['login', 'scan', 'search', 'join', 'mygroups']);

app.get('/api/run', (req, res) => {
  const command = String(req.query.command || '');
  const arg = req.query.arg ? String(req.query.arg) : undefined;

  if (!ALLOWED.has(command)) {
    return res.status(400).end('unknown command');
  }
  if (runningJob) {
    return res.status(409).end('another job already running: ' + runningJobName);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type: string, payload: unknown) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  const args = ['run', command];
  if (arg) {
    args.push('--', arg);
  }

  send('start', { command, arg });
  runningJobName = command;

  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

  // Windows ships npm as npm.cmd, and Node's spawn with shell:true is
  // flaky on some Windows setups (EINVAL). Use the .cmd directly without
  // shell, which works in both regular Windows and sandboxed runners.
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npm.cmd' : 'npm';
  const child = spawn(cmd, args, { cwd: ROOT, shell: false });
  runningJob = child;

  child.stdout.on('data', (d) => send('stdout', stripAnsi(d.toString())));
  child.stderr.on('data', (d) => send('stderr', stripAnsi(d.toString())));

  child.on('close', (code) => {
    send('done', { code });
    runningJob = null;
    runningJobName = null;
    res.end();
  });

  child.on('error', (err) => {
    send('error', { message: err.message });
    runningJob = null;
    runningJobName = null;
    res.end();
  });

  req.on('close', () => {
    if (runningJob) {
      runningJob.kill();
      runningJob = null;
      runningJobName = null;
    }
  });
});

app.delete('/api/search/:file', (req, res) => {
  const file = req.params.file;
  // safety: only allow files that match our naming convention
  if (!/^search-[\w฀-๿_]+-\d+\.json$/.test(file) && !/^mygroups-\d+\.json$/.test(file)) {
    return res.status(400).json({ error: 'bad filename' });
  }
  const fp = path.join(RESULTS_DIR, file);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  res.json({ ok: true });
});

app.get('/api/status', (_req, res) => {
  res.json({ running: runningJobName });
});

// ---------- Boot ----------
app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Dashboard ready: ${url}\n`);
  try {
    const open = require('open');
    if (typeof open === 'function') {
      open(url).catch(() => {});
    } else if (open && typeof open.default === 'function') {
      open.default(url).catch(() => {});
    }
  } catch {
    // open may not be installed; the URL is logged above
  }
});
