# wallchart-feed (Railway proxy)

Tiny Express server that calls football-data.org with your API key and returns
the normalized `tournament` JSON the wall chart expects. Serves `/api/tournament`.

## Deploy on Railway

1. `railway login && railway init` (or click "New project" → "Deploy from repo" on railway.app)
2. From the **backend/** directory: `railway up`
3. **Variables:** set `FOOTBALL_DATA_KEY` to your football-data.org key.
4. **Generate a domain** in the Railway service settings.
5. Open `../wc2026-data.js` and paste the domain into `CONFIG.feedUrl`:
   ```js
   feedUrl: 'https://your-service.up.railway.app/api/tournament'
   ```
6. Re-deploy the front-end (or refresh). The header badge flips **SEED → LIVE**.

## Env

| Variable             | Default | Notes                                              |
| -------------------- | ------- | -------------------------------------------------- |
| `FOOTBALL_DATA_KEY`  | —       | Required. https://www.football-data.org/           |
| `COMPETITION_ID`     | `2000`  | FIFA World Cup id on football-data.org             |
| `CACHE_TTL_SECONDS`  | `120`   | Upstream cache. Stays under 10 req/min free tier   |
| `PORT`               | `8080`  | Railway sets this automatically                    |
| `ALLOWED_ORIGINS`    | `*`     | CSV. Set to your front-end origin in production    |

## Notes

- Knockout fixtures are overlaid **chronologically per round**. Once the real
  draw publishes, you may want to match by team identity instead — see the
  `r32 = ...` line in `server.js`. Group-stage auto-fill into R32 needs no
  remap; the chart resolves it from group standings.
- Stale-while-error: if upstream is down, the last good response is served.
