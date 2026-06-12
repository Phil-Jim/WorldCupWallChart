# WorldCupWallChart

One-screen FIFA World Cup 2026 wall chart — group standings, fixtures, and the
full knockout bracket auto-filling as the tournament progresses.

**Design:** retro El Mundial '70 print (cream/marigold/ink, sunburst header).
**Stack:** static HTML/React (via the bundled DC runtime) + a tiny Express
proxy to football-data.org.

## Layout

```
.
├── index.html          # the wall chart (DC template + inline component)
├── support.js          # DC runtime — loads React from CDN and boots the chart
├── wc2026-data.js      # seed tournament data + CONFIG (feedUrl, favorite team)
└── backend/            # Railway proxy for live football-data.org results
```

## Run locally

```bash
python3 -m http.server 8888
# open http://localhost:8888/
```

The chart works **offline** on its seed data. The header badge shows **SEED**
until you wire a feed URL.

## Go live

1. Get a free API key from <https://www.football-data.org/>.
2. Deploy the **backend/** folder to Railway and set `FOOTBALL_DATA_KEY`. See
   `backend/README.md`.
3. Paste the Railway URL into `wc2026-data.js`:
   ```js
   feedUrl: 'https://your-service.up.railway.app/api/tournament'
   ```
4. Reload. Badge flips **SEED → LIVE**; group tables, scores, and the bracket
   poll every 60s.

## Configuration

`wc2026-data.js` — top of file:

```js
export const CONFIG = {
  feedUrl: '',          // your Railway proxy URL
  pollMs: 60000,        // poll cadence
  favorite: 'ENG',      // highlighted team (3-letter code)
};
```

## Features

- 12 group cards (A–L) with auto-computed P / W / D / GD / Pts
- Qualify / Best-3rd markers
- All 6 fixtures per group with flags, scores, kickoff time, **LIVE** pulse
- Full Round of 32 → Final bracket with drawn connectors
- Official 2026 slot map (1A, 2B, best-3rds)
- Auto-fills from group standings as groups finish
- 3rd-place play-off node
- Favorite team starred and red-shadowed (group card + every bracket node on
  its path)
- Next-kickoff countdown
- UK (BST) ↔ host-city local time toggle
- Last-updated stamp + SEED → LIVE badge
