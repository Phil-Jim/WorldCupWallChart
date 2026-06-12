# WorldCupWallChart

One-screen FIFA World Cup 2026 wall chart — group standings, fixtures, and the
full knockout bracket auto-filling as the tournament progresses.

**Design:** retro El Mundial '70 print (cream/marigold/ink, sunburst header).
**Stack:** static HTML/React (via the bundled DC runtime) served by the same
Express service that proxies football-data.org.

## Layout

```
.
├── index.html          # the wall chart (DC template + inline component)
├── support.js          # DC runtime — loads React from CDN and boots the chart
├── wc2026-data.js      # seed tournament data + CONFIG (feedUrl, favorite team)
├── server.js           # Express: serves the static front-end + /api/tournament
├── package.json
├── .env.example
└── BACKEND.md          # proxy details + Railway env reference
```

The whole thing is one service: front-end and feed share an origin.

## Run locally

```bash
npm install
FOOTBALL_DATA_KEY=your_key npm start
# open http://localhost:8080/
```

`FOOTBALL_DATA_KEY` is optional — without it the chart runs on seed data and
the header badge stays on **SEED**. Set it and `/api/tournament` returns live
results; the badge flips to **LIVE**.

## Deploy on Railway

Already deployed at:
- <https://worldcupwallchart-production.up.railway.app/>

To deploy fresh:

1. New Project → **Deploy from GitHub repo** → pick `Phil-Jim/WorldCupWallChart`.
2. **Settings → Source → Root Directory:** `.` (the repo root).
3. **Variables:** `FOOTBALL_DATA_KEY=<your-key>`.
4. **Settings → Networking → Generate Domain.**

The chart loads at `https://<domain>/`. `/api/tournament` is same-origin —
no CORS, no extra config in `wc2026-data.js`.

## Configuration

`wc2026-data.js`:

```js
export const CONFIG = {
  feedUrl: '/api/tournament',  // same-origin in the single-service deploy
  pollMs: 60000,
  favorite: 'ENG',             // highlighted team (3-letter code)
};
```

To follow a different nation, change `favorite` to that team's 3-letter code
(`BRA`, `ARG`, `FRA`, `GER`, etc.). The chart highlights its group card and
every bracket node on its path.

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

See **BACKEND.md** for the env knobs (`CACHE_TTL_SECONDS`, `COMPETITION_ID`,
`ALLOWED_ORIGINS`) and notes on the knockout overlay.
