# LayoffLens

A static dashboard for visualizing layoff trends **globally**, **by country**, and **by company**, powered by a curated dataset of public layoff disclosures and a live **Google News** feed.

Live site: https://ubolt-tech.github.io

## What you get

- **KPIs** — tracked events, people affected, companies, countries, largest single layoff.
- **Trend over time** — monthly people affected, line chart.
- **Industry breakdown** — donut chart of share by industry.
- **Top countries / Top companies** — ranked bar charts.
- **Geographic map** — circle-marker map (Leaflet + CARTO dark tiles), sized by people affected at each location.
- **Live news feed** — Google News headlines for `layoffs`, `"job cuts"`, `mass layoffs`, `workforce reduction`.
- **Searchable, sortable events table** with deep links to the original sources.
- **Filters** — time window, industry, country.

## How it works

This is a pure static site (HTML + CSS + vanilla JS, Chart.js, Leaflet) hosted on GitHub Pages. No backend.

### Data sources

1. **Curated dataset** — [`data/layoffs.json`](./data/layoffs.json). Each event has `date`, `company`, `industry`, `country`, `lat/lon`, `count`, and a `source` URL pointing to the original news article. Add or correct entries via PR.
2. **Google News RSS** — pulled two ways:
   - **Daily refresh** — [`.github/workflows/refresh-news.yml`](./.github/workflows/refresh-news.yml) runs [`scripts/fetch-news.mjs`](./scripts/fetch-news.mjs) on a cron and commits the latest headlines to [`data/news.json`](./data/news.json).
   - **Live fallback** — clicking **↻ Refresh news** in the UI fetches Google News RSS at runtime through a CORS proxy.

### Layout

```
index.html             Dashboard markup
styles.css             Dark-mode styling
js/app.js              All client-side logic (filters, charts, map, news)
data/layoffs.json      Curated layoff events
data/news.json         Cached Google News headlines (updated by workflow)
scripts/fetch-news.mjs Node script that pulls RSS and writes news.json
.github/workflows/     Daily refresh workflow
```

## Local development

It's a static site — just open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

To regenerate the news cache locally:

```bash
node scripts/fetch-news.mjs
```

## Adding new layoff events

Edit `data/layoffs.json`, append an object to the `events` array, and open a PR. Required fields:

```json
{
  "date": "2026-04-22",
  "company": "Acme Corp",
  "industry": "Tech",
  "country": "United States",
  "lat": 37.7749, "lon": -122.4194,
  "count": 500,
  "source": "Reuters",
  "url": "https://example.com/article"
}
```

## Notes

- The curated dataset is intended as a baseline — it captures major publicly disclosed events but is **not exhaustive**. Treat numbers as approximate.
- The news feed surfaces unfiltered headlines from Google News and may contain duplicates or unrelated stories.
- This is **not** investment advice or a verified data source.
