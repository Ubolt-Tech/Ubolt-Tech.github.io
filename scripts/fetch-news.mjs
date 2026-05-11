// Pulls layoff-related headlines from Google News RSS and writes data/news.json.
// Runs in GitHub Actions on a daily schedule. Uses only the Node 20+ stdlib.

import { writeFile } from 'node:fs/promises';

const QUERIES = [
  'layoffs',
  '"job cuts"',
  'mass layoffs',
  'workforce reduction',
];

const ENDPOINT = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

async function fetchRSS(q) {
  const res = await fetch(ENDPOINT(q), {
    headers: { 'User-Agent': 'LayoffLens/1.0 (+https://github.com/Ubolt-Tech/Ubolt-Tech.github.io)' },
  });
  if (!res.ok) throw new Error(`Google News ${q}: HTTP ${res.status}`);
  return res.text();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseRSS(xml, query) {
  const items = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
  const tagRe = (t) => new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i');
  let m;
  while ((m = itemRe.exec(xml))) {
    const body = m[1];
    const get = (t) => (body.match(tagRe(t))?.[1] || '').trim();
    const stripCDATA = (s) => s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
    const decode = (s) => decodeEntities(stripCDATA(s));
    const title = decode(get('title'));
    const link = decode(get('link'));
    const source = decode(get('source'));
    const pubDate = stripCDATA(get('pubDate'));
    if (title && link) items.push({ title, link, source, pubDate, query });
  }
  return items;
}

function dedupe(items) {
  const seen = new Map();
  for (const it of items) {
    const key = it.link.replace(/[?#].*$/, '');
    if (!seen.has(key)) seen.set(key, it);
  }
  return [...seen.values()];
}

const all = [];
for (const q of QUERIES) {
  try {
    const xml = await fetchRSS(q);
    const parsed = parseRSS(xml, q);
    console.log(`query "${q}" → ${parsed.length} items`);
    all.push(...parsed);
  } catch (e) {
    console.error(`query "${q}" failed:`, e.message);
  }
}

const merged = dedupe(all)
  .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
  .slice(0, 60);

const out = {
  _meta: {
    description: 'Latest layoff-related headlines pulled from Google News RSS.',
    lastUpdated: new Date().toISOString(),
    queries: QUERIES,
  },
  items: merged,
};

await writeFile('data/news.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${merged.length} items to data/news.json`);
