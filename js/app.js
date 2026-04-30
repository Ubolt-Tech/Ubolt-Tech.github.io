// LayoffLens — dashboard logic
// Loads curated layoff dataset + Google News RSS, renders KPIs, charts, map, table.

const STATE = {
  raw: [],
  filtered: [],
  filters: { range: '365', industry: 'all', country: 'all', q: '' },
  charts: {},
  map: null,
  markers: null,
  sort: { key: 'date', dir: 'desc' },
};

const PALETTE = [
  '#ff5577', '#5b8cff', '#44d09a', '#f0b341', '#9d6bff',
  '#3dd1e7', '#ff8a3d', '#c2e34a', '#ff6bd6', '#7fa6ff',
];

// ----- bootstrap -----
init().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin',
    `<div style="padding:14px;background:#3a1020;color:#fff">Failed to load dashboard: ${err.message}</div>`);
});

async function init() {
  const data = await fetchJSON('data/layoffs.json');
  STATE.raw = (data.events || []).map(normalizeEvent).sort((a, b) => b.date.localeCompare(a.date));
  STATE.lastUpdated = data._meta?.lastUpdated || null;
  document.getElementById('lastRefresh').textContent = STATE.lastUpdated || 'unknown';

  populateFilterOptions();
  bindUI();
  initMap();
  applyFilters();
  loadNews();
}

function normalizeEvent(e) {
  return {
    date: e.date,
    company: e.company,
    industry: e.industry || 'Other',
    country: e.country || 'Unknown',
    lat: typeof e.lat === 'number' ? e.lat : null,
    lon: typeof e.lon === 'number' ? e.lon : null,
    count: Number(e.count) || 0,
    source: e.source || '',
    url: e.url || '',
  };
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// ----- filters / UI -----
function populateFilterOptions() {
  const industries = unique(STATE.raw.map(e => e.industry)).sort();
  const countries = unique(STATE.raw.map(e => e.country)).sort();
  const indSel = document.getElementById('industrySelect');
  const couSel = document.getElementById('countrySelect');
  for (const i of industries) indSel.insertAdjacentHTML('beforeend', `<option value="${escAttr(i)}">${escHTML(i)}</option>`);
  for (const c of countries) couSel.insertAdjacentHTML('beforeend', `<option value="${escAttr(c)}">${escHTML(c)}</option>`);
}

function bindUI() {
  document.getElementById('rangeSelect').addEventListener('change', (e) => {
    STATE.filters.range = e.target.value; applyFilters();
  });
  document.getElementById('industrySelect').addEventListener('change', (e) => {
    STATE.filters.industry = e.target.value; applyFilters();
  });
  document.getElementById('countrySelect').addEventListener('change', (e) => {
    STATE.filters.country = e.target.value; applyFilters();
  });
  document.getElementById('eventSearch').addEventListener('input', (e) => {
    STATE.filters.q = e.target.value.toLowerCase().trim(); renderTable();
  });
  document.getElementById('refreshBtn').addEventListener('click', () => loadNews(true));
  document.querySelectorAll('#eventsTable thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      STATE.sort.dir = STATE.sort.key === key && STATE.sort.dir === 'desc' ? 'asc' : 'desc';
      STATE.sort.key = key;
      renderTable();
    });
  });
}

function applyFilters() {
  const { range, industry, country } = STATE.filters;
  let cutoff = null;
  if (range !== 'all') {
    cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(range));
  }
  STATE.filtered = STATE.raw.filter(e => {
    if (cutoff && new Date(e.date) < cutoff) return false;
    if (industry !== 'all' && e.industry !== industry) return false;
    if (country !== 'all' && e.country !== country) return false;
    return true;
  });
  renderAll();
}

// ----- rendering -----
function renderAll() {
  renderKPIs();
  renderTrend();
  renderIndustry();
  renderCountry();
  renderCompany();
  renderMap();
  renderTable();
}

function renderKPIs() {
  const data = STATE.filtered;
  const totalPeople = data.reduce((s, e) => s + e.count, 0);
  const companies = unique(data.map(e => e.company)).length;
  const countries = unique(data.map(e => e.country)).length;
  const largest = data.reduce((max, e) => e.count > (max?.count || 0) ? e : max, null);
  set('kpiEvents', fmt(data.length));
  set('kpiPeople', fmt(totalPeople));
  set('kpiCompanies', fmt(companies));
  set('kpiCountries', fmt(countries));
  set('kpiLargest', largest ? `${largest.company} · ${fmt(largest.count)}` : '—');
}

function renderTrend() {
  const buckets = new Map();
  for (const e of STATE.filtered) {
    const k = e.date.slice(0, 7); // YYYY-MM
    buckets.set(k, (buckets.get(k) || 0) + e.count);
  }
  const labels = [...buckets.keys()].sort();
  const values = labels.map(k => buckets.get(k));
  upsertChart('trendChart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'People affected',
        data: values,
        borderColor: PALETTE[0],
        backgroundColor: 'rgba(255,85,119,0.15)',
        tension: 0.3, fill: true, pointRadius: 3,
      }],
    },
    options: chartBase({
      scales: { y: { beginAtZero: true, ticks: { callback: v => fmt(v) } } },
    }),
  });
}

function renderIndustry() {
  const map = aggregate(STATE.filtered, 'industry');
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  upsertChart('industryChart', {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: '#161c3f',
        borderWidth: 2,
      }],
    },
    options: chartBase({ cutout: '55%', plugins: { legend: { position: 'right', labels: { color: '#cfd5ff', font: { size: 11 } } } } }),
  });
}

function renderCountry() {
  const map = aggregate(STATE.filtered, 'country');
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  upsertChart('countryChart', {
    type: 'bar',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        label: 'People affected',
        data: entries.map(e => e[1]),
        backgroundColor: PALETTE[1],
      }],
    },
    options: chartBase({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: v => fmt(v) } } },
    }),
  });
}

function renderCompany() {
  const map = aggregate(STATE.filtered, 'company');
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  upsertChart('companyChart', {
    type: 'bar',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        label: 'People affected',
        data: entries.map(e => e[1]),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
      }],
    },
    options: chartBase({
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { callback: v => fmt(v) } } },
    }),
  });
}

function initMap() {
  STATE.map = L.map('map', { worldCopyJump: true, zoomControl: true }).setView([25, 10], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd', maxZoom: 19,
  }).addTo(STATE.map);
  STATE.markers = L.layerGroup().addTo(STATE.map);
}

function renderMap() {
  STATE.markers.clearLayers();
  // Aggregate by lat/lon to scale circles
  const byLoc = new Map();
  for (const e of STATE.filtered) {
    if (e.lat == null || e.lon == null) continue;
    const k = `${e.lat.toFixed(2)},${e.lon.toFixed(2)}`;
    if (!byLoc.has(k)) byLoc.set(k, { lat: e.lat, lon: e.lon, count: 0, events: [] });
    const b = byLoc.get(k); b.count += e.count; b.events.push(e);
  }
  for (const b of byLoc.values()) {
    const r = Math.min(40, 4 + Math.sqrt(b.count) / 6);
    const marker = L.circleMarker([b.lat, b.lon], {
      radius: r, color: '#ff5577', weight: 1, fillColor: '#ff5577', fillOpacity: 0.45,
    });
    const top = b.events.sort((a, c) => c.count - a.count).slice(0, 5);
    const list = top.map(e => `<li>${escHTML(e.company)} — ${fmt(e.count)} <span style="color:#8c95c4">(${e.date})</span></li>`).join('');
    marker.bindPopup(`<b>${fmt(b.count)} people</b> · ${b.events.length} event(s)<br><ul style="margin:6px 0 0 14px;padding:0">${list}</ul>`);
    marker.addTo(STATE.markers);
  }
}

function renderTable() {
  const tbody = document.querySelector('#eventsTable tbody');
  const q = STATE.filters.q;
  let rows = STATE.filtered;
  if (q) {
    rows = rows.filter(e =>
      e.company.toLowerCase().includes(q) ||
      e.country.toLowerCase().includes(q) ||
      e.industry.toLowerCase().includes(q) ||
      (e.source || '').toLowerCase().includes(q));
  }
  const { key, dir } = STATE.sort;
  const mul = dir === 'asc' ? 1 : -1;
  rows = [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === 'number') return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
  tbody.innerHTML = rows.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${escHTML(e.company)}</td>
      <td>${escHTML(e.industry)}</td>
      <td>${escHTML(e.country)}</td>
      <td class="num">${fmt(e.count)}</td>
      <td>${e.url ? `<a href="${escAttr(e.url)}" target="_blank" rel="noopener">${escHTML(e.source || 'link')}</a>` : escHTML(e.source || '')}</td>
    </tr>
  `).join('');
}

// ----- News (Google News RSS) -----
async function loadNews(forceLive = false) {
  const list = document.getElementById('newsList');
  const hint = document.getElementById('newsHint');
  const btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  list.innerHTML = '<li class="meta">Loading…</li>';

  try {
    let items = null;
    if (!forceLive) {
      try {
        const cached = await fetchJSON('data/news.json');
        if (cached.items?.length) {
          items = cached.items;
          hint.textContent = `Google News · cached ${cached._meta?.lastUpdated || ''}`.trim();
        }
      } catch { /* no cache yet */ }
    }
    if (!items) {
      items = await fetchGoogleNewsLive();
      hint.textContent = 'Google News · live';
    }
    renderNews(items);
  } catch (err) {
    console.warn('news failed', err);
    list.innerHTML = `<li class="meta">News feed unavailable: ${escHTML(err.message)}.<br>The dashboard still works on the curated dataset.</li>`;
  } finally {
    btn.disabled = false;
  }
}

async function fetchGoogleNewsLive() {
  // Try multiple CORS proxies because each one occasionally rate-limits.
  const rss = 'https://news.google.com/rss/search?q=layoffs+OR+%22job+cuts%22&hl=en-US&gl=US&ceid=US:en';
  const proxies = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://r.jina.ai/${u}`, // returns text, also handles RSS
  ];
  let lastErr;
  for (const make of proxies) {
    try {
      const res = await fetch(make(rss), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const items = parseRSS(text);
      if (items.length) return items;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all proxies failed');
}

function parseRSS(xml) {
  // Tolerant parser — accepts proper RSS XML and the plain-text fallback from r.jina.ai.
  const items = [];
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const nodes = doc.querySelectorAll('item');
    for (const n of nodes) {
      items.push({
        title: text(n, 'title'),
        link: text(n, 'link'),
        source: text(n, 'source') || (text(n, 'description').match(/<font[^>]*>([^<]+)<\/font>/)?.[1] || ''),
        pubDate: text(n, 'pubDate'),
      });
    }
  } catch { /* ignore */ }
  if (items.length) return items.slice(0, 30);
  // fallback: pull title/link pairs out of plain-text content
  const re = /Title:\s*(.+?)\nURL Source:\s*(\S+)/g;
  let m; while ((m = re.exec(xml))) items.push({ title: m[1], link: m[2], source: '', pubDate: '' });
  return items.slice(0, 30);
}

function text(el, tag) {
  const n = el.getElementsByTagName(tag)[0];
  return n ? n.textContent.trim() : '';
}

function renderNews(items) {
  const list = document.getElementById('newsList');
  if (!items.length) { list.innerHTML = '<li class="meta">No items found.</li>'; return; }
  list.innerHTML = items.slice(0, 25).map(i => {
    const when = i.pubDate ? new Date(i.pubDate) : null;
    const ago = when && !isNaN(when) ? relativeTime(when) : '';
    return `<li>
      <a href="${escAttr(i.link)}" target="_blank" rel="noopener">${escHTML(i.title)}</a>
      <div class="meta">${escHTML(i.source || '')}${i.source && ago ? ' · ' : ''}${ago}</div>
    </li>`;
  }).join('');
}

// ----- helpers -----
function aggregate(arr, key) {
  const m = new Map();
  for (const e of arr) m.set(e[key], (m.get(e[key]) || 0) + e.count);
  return m;
}
function unique(arr) { return [...new Set(arr)]; }
function set(id, val) { document.getElementById(id).textContent = val; }
function fmt(n) { return n == null || isNaN(n) ? '—' : Number(n).toLocaleString(); }
function escHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escAttr(s) { return escHTML(s); }

function relativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function chartBase(extra = {}) {
  const base = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#cfd5ff', font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label || ctx.label}: ${fmt(ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed)}` } },
    },
    scales: {
      x: { ticks: { color: '#9aa3d2', font: { size: 10 } }, grid: { color: 'rgba(140,149,196,0.08)' } },
      y: { ticks: { color: '#9aa3d2', font: { size: 10 } }, grid: { color: 'rgba(140,149,196,0.08)' } },
    },
  };
  return deepMerge(base, extra);
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deepMerge(a[k] || {}, b[k]) : b[k];
  }
  return out;
}

function upsertChart(canvasId, config) {
  if (STATE.charts[canvasId]) {
    STATE.charts[canvasId].data = config.data;
    STATE.charts[canvasId].options = config.options;
    STATE.charts[canvasId].update();
    return;
  }
  const ctx = document.getElementById(canvasId).getContext('2d');
  STATE.charts[canvasId] = new Chart(ctx, config);
}
