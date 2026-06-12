// World Cup 2026 wall chart — single-service deploy.
// Serves the static front-end (index.html + support.js + wc2026-data.js) and
// proxies live results from football-data.org under /api/tournament.
// Normalized shape:
//   { meta:{updated,source}, groups:[{id,teams,matches}], bracket:{r32,r16,qf,sf,third,final} }
// The chart polls /api/tournament every 60s; we cache upstream responses to
// stay under football-data.org's 10 req/min free-tier limit.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const KEY = process.env.FOOTBALL_DATA_KEY;
const COMPETITION_ID = process.env.COMPETITION_ID || '2000';
const CACHE_TTL = (parseInt(process.env.CACHE_TTL_SECONDS, 10) || 120) * 1000;
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && ALLOWED.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

let cache = { at: 0, body: null };

app.get('/api/tournament', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30');
  if (!KEY) {
    return res.status(503).json({ error: 'FOOTBALL_DATA_KEY not configured' });
  }
  const now = Date.now();
  if (cache.body && now - cache.at < CACHE_TTL) {
    return res.json(cache.body);
  }
  try {
    const body = await buildTournament();
    cache = { at: now, body };
    res.json(body);
  } catch (e) {
    console.error('build failed', e);
    if (cache.body) return res.json(cache.body); // serve stale on failure
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Static front-end. Served from the repo root — index.html, support.js,
// wc2026-data.js, README.md, etc. The dotfile/backend filter keeps secrets
// out: .env, .git/, node_modules/ are never reached as long as the index
// is the only entry point.
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders(res, p) {
    if (p.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    // Short cache so a redeploy is visible within a minute.
    res.setHeader('Cache-Control', 'public, max-age=60');
  },
}));

app.listen(PORT, () => console.log('wallchart listening on :' + PORT));

// ────────────────────────────────────────────────────────────────────────────
// upstream → normalized

async function fdGet(path) {
  const res = await fetch('https://api.football-data.org/v4' + path, {
    headers: { 'X-Auth-Token': KEY },
  });
  if (!res.ok) throw new Error('football-data ' + res.status + ' on ' + path);
  return res.json();
}

// Three-letter codes for football-data team objects. We prefer the team's
// `tla` field (the canonical 3-letter code); fall back to a slug.
function teamCode(team) {
  if (team?.tla) return team.tla;
  if (team?.shortName) return team.shortName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  if (team?.name) return team.name.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  return '???';
}

// flagcdn slug from team object: country code is most reliable, otherwise null
// and the chart will fall back to its `team.flag` URL if set.
function flagCode(team) {
  // football-data sometimes includes "Country" in area; tla is e.g. "ENG"
  // We map tla → flagcdn slug for the common WC nations.
  const TLA_TO_FC = {
    ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls', NIR: 'gb-nir',
    USA: 'us', MEX: 'mx', CAN: 'ca', BRA: 'br', ARG: 'ar', URU: 'uy', PAR: 'py', COL: 'co', ECU: 'ec',
    GER: 'de', FRA: 'fr', ESP: 'es', NED: 'nl', BEL: 'be', POR: 'pt', ITA: 'it', SUI: 'ch', AUT: 'at', CZE: 'cz', CRO: 'hr', SWE: 'se', NOR: 'no', DEN: 'dk', POL: 'pl', SRB: 'rs',
    JPN: 'jp', KOR: 'kr', QAT: 'qa', KSA: 'sa', IRN: 'ir', IRQ: 'iq', UZB: 'uz', AUS: 'au', NZL: 'nz', JOR: 'jo',
    MAR: 'ma', TUN: 'tn', EGY: 'eg', ALG: 'dz', SEN: 'sn', GHA: 'gh', CIV: 'ci', RSA: 'za', COD: 'cd', CPV: 'cv',
    HAI: 'ht', PAN: 'pa', CUW: 'cw', BIH: 'ba', TUR: 'tr',
  };
  return TLA_TO_FC[teamCode(team)] || null;
}

function normalizeTeam(team) {
  if (!team) return null;
  return {
    code: teamCode(team),
    name: team.shortName || team.name || teamCode(team),
    fc: flagCode(team),
    flag: team.crest || null, // chart's flagSrc() falls back to flag if fc is missing
  };
}

// football-data status → chart status
// SCHEDULED/TIMED/POSTPONED/SUSPENDED → 'UP'
// IN_PLAY/PAUSED                       → 'LIVE'
// FINISHED/AWARDED                     → 'FT'
function normalizeStatus(s) {
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'LIVE';
  if (s === 'FINISHED' || s === 'AWARDED') return 'FT';
  return 'UP';
}

function minuteOf(m) {
  if (typeof m.minute === 'number') return m.minute;
  if (typeof m.minute === 'string') {
    const n = parseInt(m.minute, 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Group letter is given as "Group A" / "GROUP_A" / "A" by football-data.
function groupLetter(raw) {
  if (!raw) return null;
  const m = String(raw).toUpperCase().match(/([A-L])\b/);
  return m ? m[1] : null;
}

// Bracket helper labels — keep the same shape as the chart's seed (kind:g/W/L/t)
const gW = g => ({ kind: 'g', rank: 1, group: g, label: `Winner ${g}` });
const gR = g => ({ kind: 'g', rank: 2, group: g, label: `Runner-up ${g}` });
const t  = pool => ({ kind: 't', pool, label: `3rd · ${pool.join('/')}` });
const W  = m => ({ kind: 'W', match: m, label: `Winner ${m}` });
const L  = m => ({ kind: 'L', match: m, label: `Loser ${m}` });

// Official 2026 R32 slot map (matches wc2026-data.js seed)
const R32_SLOTS = [
  ['R32-1',  gW('I'), t(['C','D','F','G','H'])],
  ['R32-2',  gR('A'), gR('B')],
  ['R32-3',  gW('F'), gR('C')],
  ['R32-4',  gR('K'), gR('L')],
  ['R32-5',  gW('H'), gR('J')],
  ['R32-6',  gW('D'), t(['B','E','F','I','J'])],
  ['R32-7',  gW('G'), t(['A','E','H','I','J'])],
  ['R32-8',  gW('C'), gR('F')],
  ['R32-9',  gR('E'), gR('I')],
  ['R32-10', gW('A'), t(['C','E','F','H','I'])],
  ['R32-11', gW('L'), t(['E','H','I','J','K'])],
  ['R32-12', gW('J'), gR('H')],
  ['R32-13', gR('D'), gR('G')],
  ['R32-14', gW('B'), t(['E','F','G','I','J'])],
  ['R32-15', gW('K'), t(['D','E','I','J','L'])],
  ['R32-16', gW('E'), t(['A','B','C','D','F'])],
];

async function buildTournament() {
  const standings = await fdGet(`/competitions/${COMPETITION_ID}/standings`);
  const matchesResp = await fdGet(`/competitions/${COMPETITION_ID}/matches`);

  // ── groups + standings → teams list per group ────────────────────────────
  // football-data /standings includes 12 group tables for the WC group stage.
  const groupTables = (standings.standings || []).filter(s => s.type === 'TOTAL' && s.group);
  const groupsById = {};
  for (const t of groupTables) {
    const id = groupLetter(t.group);
    if (!id) continue;
    groupsById[id] = {
      id,
      teams: (t.table || []).map(row => normalizeTeam(row.team)),
      matches: [],
    };
  }

  // ── matches → bucketed by stage ──────────────────────────────────────────
  const matches = matchesResp.matches || [];

  // Group stage matches → into their group
  const groupMatches = matches.filter(m => m.stage === 'GROUP_STAGE');
  for (const m of groupMatches) {
    const id = groupLetter(m.group);
    if (!id || !groupsById[id]) continue;
    groupsById[id].matches.push({
      id: `G${id}-${m.id}`,
      group: id,
      stage: 'GROUP',
      matchday: m.matchday || 1,
      utc: m.utcDate,
      tz: 'UTC', // football-data exposes UTC only; chart converts to UK / Local
      venue: m.venue || '',
      home: normalizeTeam(m.homeTeam),
      away: normalizeTeam(m.awayTeam),
      status: normalizeStatus(m.status),
      hs: m.score?.fullTime?.home ?? null,
      as: m.score?.fullTime?.away ?? null,
      minute: minuteOf(m),
    });
  }

  // Order each group's matches by kickoff to match wallchart presentation
  for (const g of Object.values(groupsById)) {
    g.matches.sort((a, b) => new Date(a.utc) - new Date(b.utc));
  }

  const groups = 'ABCDEFGHIJKL'.split('').map(id => groupsById[id]).filter(Boolean);

  // ── knockout bracket ─────────────────────────────────────────────────────
  // We keep the seed's slot structure (so the chart's auto-fill works) and
  // overlay live results from the matching upstream fixtures.
  const ko = matches.filter(m => m.stage && m.stage !== 'GROUP_STAGE');
  const r32Up = ko.filter(m => /ROUND_OF_32|LAST_32/.test(m.stage));
  const r16Up = ko.filter(m => /ROUND_OF_16|LAST_16/.test(m.stage));
  const qfUp  = ko.filter(m => /QUARTER/.test(m.stage));
  const sfUp  = ko.filter(m => /SEMI/.test(m.stage));
  const thrUp = ko.filter(m => /THIRD/.test(m.stage))[0];
  const finUp = ko.filter(m => /FINAL/.test(m.stage) && !/SEMI|QUARTER/.test(m.stage))[0];

  const overlay = (id, stage, a, b, up) => ({
    id, stage, a, b,
    utc: up?.utcDate || null,
    venue: up?.venue || '',
    tz: 'UTC',
    home: up ? normalizeTeam(up.homeTeam) : null,
    away: up ? normalizeTeam(up.awayTeam) : null,
    status: up ? normalizeStatus(up.status) : 'UP',
    hs: up?.score?.fullTime?.home ?? null,
    as: up?.score?.fullTime?.away ?? null,
    minute: up ? minuteOf(up) : null,
  });

  // R32: positional overlay (chronological per round). When the real draw lands
  // and you want to match by team identity, replace `r32Up[i]` with a lookup.
  const r32 = R32_SLOTS.map(([id, a, b], i) => overlay(id, 'R32', a, b, sortedByDate(r32Up)[i]));
  const r16 = Array.from({ length: 8 }, (_, i) =>
    overlay(`R16-${i + 1}`, 'R16', W(`R32-${i * 2 + 1}`), W(`R32-${i * 2 + 2}`), sortedByDate(r16Up)[i])
  );
  const qf = Array.from({ length: 4 }, (_, i) =>
    overlay(`QF-${i + 1}`, 'QF', W(`R16-${i * 2 + 1}`), W(`R16-${i * 2 + 2}`), sortedByDate(qfUp)[i])
  );
  const sf = Array.from({ length: 2 }, (_, i) =>
    overlay(`SF-${i + 1}`, 'SF', W(`QF-${i * 2 + 1}`), W(`QF-${i * 2 + 2}`), sortedByDate(sfUp)[i])
  );
  const third = overlay('3RD', '3RD', L('SF-1'), L('SF-2'), thrUp);
  const final = overlay('FINAL', 'FINAL', W('SF-1'), W('SF-2'), finUp);

  return {
    meta: { updated: Date.now(), source: 'football-data.org' },
    groups,
    bracket: { r32, r16, qf, sf, third, final },
  };
}

function sortedByDate(arr) {
  return [...arr].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}
