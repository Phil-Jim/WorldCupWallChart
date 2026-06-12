// ============================================================================
// World Cup 2026 — tournament data layer (seed + schema)
// ----------------------------------------------------------------------------
// The wall chart reads a single normalised "tournament" object. When CONFIG.feedUrl
// is set (your Railway proxy), the chart fetches + polls it and overlays live
// results onto this seed. With no feedUrl it runs entirely on the seed below so
// the file works offline / on first paint.
// Normalised match shape the chart expects from the feed:
//   { id, group?, stage, utc (ISO), tz (IANA), venue, status:'UP'|'LIVE'|'FT',
//     minute?, home:{code,name,fc}|null, away:{...}|null, hs?, as? }
// ============================================================================

export const CONFIG = {
  feedUrl: '',          // e.g. 'https://your-app.up.railway.app/api/tournament'
  pollMs: 60000,        // poll cadence when feedUrl is set
  favorite: 'ENG',      // highlighted team (3-letter code)
};

// ── 48 teams in 12 groups: [code, name, flagcdn-code] ───────────────────────
const GROUP_DEFS = {
  A: [['MEX','Mexico','mx'],       ['RSA','South Africa','za'],  ['KOR','South Korea','kr'],   ['CZE','Czech Republic','cz']],
  B: [['CAN','Canada','ca'],       ['BIH','Bosnia & Herz.','ba'],['QAT','Qatar','qa'],         ['SUI','Switzerland','ch']],
  C: [['BRA','Brazil','br'],       ['MAR','Morocco','ma'],       ['HAI','Haiti','ht'],         ['SCO','Scotland','gb-sct']],
  D: [['USA','United States','us'],['PAR','Paraguay','py'],      ['AUS','Australia','au'],     ['TUR','Türkiye','tr']],
  E: [['GER','Germany','de'],      ['CUW','Curaçao','cw'],       ['CIV','Ivory Coast','ci'],   ['ECU','Ecuador','ec']],
  F: [['NED','Netherlands','nl'],  ['JPN','Japan','jp'],         ['SWE','Sweden','se'],        ['TUN','Tunisia','tn']],
  G: [['BEL','Belgium','be'],      ['EGY','Egypt','eg'],         ['IRN','Iran','ir'],          ['NZL','New Zealand','nz']],
  H: [['ESP','Spain','es'],        ['CPV','Cape Verde','cv'],    ['KSA','Saudi Arabia','sa'],  ['URU','Uruguay','uy']],
  I: [['FRA','France','fr'],       ['SEN','Senegal','sn'],       ['IRQ','Iraq','iq'],          ['NOR','Norway','no']],
  J: [['ARG','Argentina','ar'],    ['ALG','Algeria','dz'],       ['AUT','Austria','at'],       ['JOR','Jordan','jo']],
  K: [['POR','Portugal','pt'],     ['COD','DR Congo','cd'],      ['UZB','Uzbekistan','uz'],    ['COL','Colombia','co']],
  L: [['ENG','England','gb-eng'],  ['CRO','Croatia','hr'],       ['GHA','Ghana','gh'],         ['PAN','Panama','pa']],
};

// Host-city pool (assigned round-robin to fixtures for venue/timezone display)
const VENUES = [
  ['Mexico City','America/Mexico_City'], ['New York/New Jersey','America/New_York'],
  ['Los Angeles','America/Los_Angeles'], ['Dallas','America/Chicago'],
  ['Toronto','America/Toronto'],         ['Atlanta','America/New_York'],
  ['Vancouver','America/Vancouver'],     ['Seattle','America/Los_Angeles'],
  ['Houston','America/Chicago'],         ['Miami','America/New_York'],
  ['Guadalajara','America/Mexico_City'], ['Monterrey','America/Monterrey'],
  ['Kansas City','America/Chicago'],     ['Philadelphia','America/New_York'],
  ['Boston','America/New_York'],         ['San Francisco Bay Area','America/Los_Angeles'],
];

// round-robin order for 4 teams → 6 fixtures across 3 matchdays
const RR = [[0,1],[2,3],[0,2],[3,1],[3,0],[1,2]];
// matchday index for each fixture above (for date spacing)
const RR_MD = [0,0,1,1,2,2];

function iso(y,m,d,h,min){ return new Date(Date.UTC(y,m-1,d,h,min)).toISOString(); }

// ── Seeded "just begun" state: a deterministic result for some MD1 games ─────
// (overwritten by the live feed once CONFIG.feedUrl is wired). Keyed by group+fixtureIndex.
const SEED_RESULTS = {
  // group: { fixtureIndex: [homeScore, awayScore, status, minute?] }
  A: { 0:[2,1,'FT'], 1:[0,0,'FT'] },
  B: { 0:[1,1,'FT'], 1:[3,1,'FT'] },
  C: { 0:[2,0,'FT'], 1:[1,2,'LIVE',58] },
  D: { 0:[1,0,'FT'], 1:[2,2,'FT'] },
  E: { 0:[3,1,'FT'], 1:[0,1,'FT'] },
  F: { 0:[2,1,'LIVE',71], 1:[1,1,'FT'] },
  G: { 0:[0,2,'FT'], 1:[1,0,'FT'] },
  H: { 0:[4,0,'FT'], 1:[1,1,'FT'] },
  I: { 0:[2,1,'FT'], 1:[0,3,'FT'] },
  J: { 0:[3,0,'FT'], 1:[1,1,'LIVE',34] },
  K: { 0:[1,2,'FT'], 1:[2,0,'FT'] },
  L: { 0:[2,0,'FT'], 1:[1,1,'FT'], 2:[1,0,'LIVE',67] }, // England's group
};

let venueCursor = 0;
function nextVenue(){ const v = VENUES[venueCursor % VENUES.length]; venueCursor++; return v; }

export function buildTournament(){
  venueCursor = 0;
  const groupIds = Object.keys(GROUP_DEFS);

  const groups = groupIds.map((id, gi) => {
    const teams = GROUP_DEFS[id].map(([code,name,fc]) => ({ code, name, fc }));
    const matches = RR.map((pair, fi) => {
      const [hi, ai] = pair;
      const md = RR_MD[fi];
      // MD1 ~ Jun 11–17, MD2 ~ Jun 18–23, MD3 ~ Jun 24–27, staggered by group
      const day = [11, 18, 24][md] + ((gi + fi) % 4);
      const hour = 18 + ((gi + fi) % 3) * 2; // 18,20,22 UTC
      const [venue, tz] = nextVenue();
      const seed = (SEED_RESULTS[id] || {})[fi];
      const m = {
        id: `G${id}-${fi+1}`,
        group: id,
        stage: 'GROUP',
        matchday: md + 1,
        utc: iso(2026, 6, Math.min(day, 27), hour, 0),
        tz, venue,
        home: { ...teams[hi] },
        away: { ...teams[ai] },
        status: 'UP', hs: null, as: null, minute: null,
      };
      if (seed) { m.hs = seed[0]; m.as = seed[1]; m.status = seed[2]; m.minute = seed[3] ?? null; }
      return m;
    });
    return { id, teams, matches };
  });

  return { meta: { updated: Date.now(), source: 'seed' }, groups, bracket: buildBracket() };
}

// ── Knockout bracket structure (official 2026 slot map) ─────────────────────
// slot kinds:  g = group rank (w=1st / r=2nd),  t = best third from a pool,
//              W/L = winner/loser of a prior match id
function gW(g){ return { kind:'g', rank:1, group:g, label:`Winner ${g}` }; }
function gR(g){ return { kind:'g', rank:2, group:g, label:`Runner-up ${g}` }; }
function t(pool){ return { kind:'t', pool, label:`3rd · ${pool.join('/')}` }; }
function W(m){ return { kind:'W', match:m, label:`Winner ${m}` }; }
function L(m){ return { kind:'L', match:m, label:`Loser ${m}` }; }

function buildBracket(){
  // Round of 32 — 16 ties (slot pairings per the 2026 wallchart)
  const r32defs = [
    ['R32-1', gW('I'), t(['C','D','F','G','H'])],
    ['R32-2', gR('A'), gR('B')],
    ['R32-3', gW('F'), gR('C')],
    ['R32-4', gR('K'), gR('L')],
    ['R32-5', gW('H'), gR('J')],
    ['R32-6', gW('D'), t(['B','E','F','I','J'])],
    ['R32-7', gW('G'), t(['A','E','H','I','J'])],
    ['R32-8', gW('C'), gR('F')],
    ['R32-9', gR('E'), gR('I')],
    ['R32-10', gW('A'), t(['C','E','F','H','I'])],
    ['R32-11', gW('L'), t(['E','H','I','J','K'])],
    ['R32-12', gW('J'), gR('H')],
    ['R32-13', gR('D'), gR('G')],
    ['R32-14', gW('B'), t(['E','F','G','I','J'])],
    ['R32-15', gW('K'), t(['D','E','I','J','L'])],
    ['R32-16', gW('E'), t(['A','B','C','D','F'])],
  ];
  const r32 = r32defs.map((d, i) => mkMatch(d[0], 'R32', d[1], d[2], iso(2026, 6, 28 + Math.floor(i/3), 18 + (i%3)*3, 0), VENUES[i % VENUES.length]));

  const r16 = [];
  for (let i = 0; i < 8; i++) {
    r16.push(mkMatch(`R16-${i+1}`, 'R16', W(`R32-${i*2+1}`), W(`R32-${i*2+2}`), iso(2026, 7, 4 + Math.floor(i/2), 18 + (i%2)*3, 0), VENUES[i % VENUES.length]));
  }
  const qf = [];
  for (let i = 0; i < 4; i++) {
    qf.push(mkMatch(`QF-${i+1}`, 'QF', W(`R16-${i*2+1}`), W(`R16-${i*2+2}`), iso(2026, 7, 9 + i, 19, 0), VENUES[i % VENUES.length]));
  }
  const sf = [
    mkMatch('SF-1', 'SF', W('QF-1'), W('QF-2'), iso(2026, 7, 14, 19, 0), ['Dallas','America/Chicago']),
    mkMatch('SF-2', 'SF', W('QF-3'), W('QF-4'), iso(2026, 7, 15, 19, 0), ['Atlanta','America/New_York']),
  ];
  const third = mkMatch('3RD', '3RD', L('SF-1'), L('SF-2'), iso(2026, 7, 18, 19, 0), ['Miami','America/New_York']);
  const final = mkMatch('FINAL', 'FINAL', W('SF-1'), W('SF-2'), iso(2026, 7, 19, 19, 0), ['New York/New Jersey','America/New_York']);

  return { r32, r16, qf, sf, third, final };
}

function mkMatch(id, stage, a, b, utc, venueArr){
  return {
    id, stage, a, b,
    utc, venue: venueArr[0], tz: venueArr[1],
    status: 'UP', hs: null, as: null, minute: null,
    home: null, away: null, // resolved teams once known (filled by feed or auto-fill)
  };
}
