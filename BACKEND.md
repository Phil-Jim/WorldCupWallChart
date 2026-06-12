# Backend reference

`server.js` is one Express service doing two jobs:

- **Static front-end** (`index.html`, `support.js`, `wc2026-data.js`, …) served
  from the repo root.
- **`/api/tournament`** — proxied + normalized football-data.org feed.

The chart polls `/api/tournament` every 60s. Upstream is cached for
`CACHE_TTL_SECONDS` to stay under football-data.org's 10 req/min free-tier
limit. `/health` returns `{ok:true}` for Railway's healthcheck.

## Env

| Variable             | Default | Notes                                              |
| -------------------- | ------- | -------------------------------------------------- |
| `FOOTBALL_DATA_KEY`  | —       | Required for live data. <https://www.football-data.org/> |
| `COMPETITION_ID`     | `2000`  | FIFA World Cup id on football-data.org             |
| `CACHE_TTL_SECONDS`  | `120`   | Upstream cache. Keeps us under 10 req/min free tier |
| `PORT`               | `8080`  | Railway sets this automatically                    |
| `ALLOWED_ORIGINS`    | `*`     | CSV. Only matters if the chart ever runs cross-origin |

## Notes

- **Knockout overlay:** R32/R16/QF/SF matches are overlaid **chronologically
  per round** onto the official slot map. Once the real draw publishes, you
  may want to match by team identity instead — see the `r32 = ...` line in
  `server.js`. Group-stage auto-fill into R32 needs no remap; the chart
  resolves it from group standings.
- **Stale-while-error:** if upstream is down, the last good response is served.
- **No FOOTBALL_DATA_KEY:** `/api/tournament` returns 503; the chart silently
  keeps showing the seed and the badge stays on **SEED**.
