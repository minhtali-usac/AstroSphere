// Lấy thị sai Hipparcos (VizieR, I/311) và hành tinh ngoài hệ Mặt Trời đã xác nhận (NASA Exoplanet Archive, pscomppars)
// cho các sao trong src/data/generated/stars.json, rồi ghi src/data/fetched/*.json.
// Chạy lúc build: `npm run fetch-sky`. Ứng dụng không bao giờ gọi mạng lúc chạy.
// Đầu ra tất định: hai lần chạy với dữ liệu nguồn không đổi cho ra cùng các byte (meta.retrieved chỉ đổi khi dữ liệu đổi).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STARS = join(ROOT, 'src/data/generated/stars.json');
const OUT_DIR = join(ROOT, 'src/data/fetched');
const OUT_PLX = join(OUT_DIR, 'hip-parallax.json');
const OUT_EXO = join(OUT_DIR, 'exoplanets.json');

const VIZIER = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync';
const NEA = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const BATCH = 400;

const PLX_QUERY_TEMPLATE = 'SELECT HIP,Plx,e_Plx FROM "I/311/hip2" WHERE HIP IN (<catalogue HIP numbers, 400 per request>)';
const EXO_COLUMNS = [
  'pl_name', 'hostname', 'hip_name', 'pl_orbsmax', 'pl_orbper', 'pl_orbeccen', 'pl_orbincl',
  'pl_rade', 'pl_rade_reflink', 'pl_bmasse', 'pl_bmassprov', 'discoverymethod', 'disc_year',
  'pl_eqt', 'st_teff', 'st_rad', 'sy_dist',
];
const EXO_QUERY = `select ${EXO_COLUMNS.join(',')} from pscomppars where hip_name is not null`;

/** RFC 4180 CSV → array of records keyed by the header row. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
}

async function fetchCsv(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AstroSphere build (USAC astronomy club)' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.slice(0, 120)}…\n${text.slice(0, 500)}`);
  if (text.trimStart().startsWith('<')) throw new Error(`Service returned XML/HTML instead of CSV:\n${text.slice(0, 800)}`);
  return parseCsv(text);
}

const num = (s) => {
  if (s === undefined || s === null || String(s).trim() === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};
const fixed = (v, d) => (v === null ? null : Number(v.toFixed(d)));
const sig = (v, n) => (v === null ? null : Number(v.toPrecision(n)));
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

async function fetchParallax(hips) {
  const sorted = [...hips].sort((a, b) => a - b);
  const rows = [];
  for (let i = 0; i < sorted.length; i += BATCH) {
    const ids = sorted.slice(i, i + BATCH).join(',');
    const query = `SELECT HIP,Plx,e_Plx FROM "I/311/hip2" WHERE HIP IN (${ids})`;
    const url = `${VIZIER}?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=${encodeURIComponent(query)}`;
    rows.push(...(await fetchCsv(url)));
  }
  const byHip = new Map();
  for (const r of rows) {
    const hip = num(r.HIP);
    const plx = num(r.Plx);
    if (hip === null || plx === null || !hips.has(hip)) continue;
    byHip.set(hip, { plx: fixed(plx, 2), ePlx: fixed(num(r.e_Plx), 2) });
  }
  const hip = [...byHip.keys()].sort((a, b) => a - b);
  return {
    meta: {
      retrieved: '',
      service: 'CDS VizieR TAP (https://tapvizier.cds.unistra.fr/TAPVizieR/tap)',
      catalogue: 'Hipparcos, the New Reduction (van Leeuwen 2007), I/311',
      query: PLX_QUERY_TEMPLATE,
      licence: 'VizieR data are free of use in a scientific context; the original authors and publication must be cited (https://cds.unistra.fr/vizier-org/licences_vizier.html).',
      citation: 'van Leeuwen F. 2007, A&A 474, 653, "Validation of the new Hipparcos reduction"; VizieR catalogue I/311; VizieR service DOI 10.26093/cds/vizier.',
    },
    hip,
    plx: hip.map((h) => byHip.get(h).plx),
    ePlx: hip.map((h) => byHip.get(h).ePlx),
  };
}

async function fetchExoplanets(hips) {
  const url = `${NEA}?query=${encodeURIComponent(EXO_QUERY)}&format=csv`;
  const rows = await fetchCsv(url);
  const planets = [];
  for (const r of rows) {
    const m = /^HIP\s+(\d+)/.exec(r.hip_name ?? '');
    if (!m) continue;
    const hip = Number(m[1]);
    if (!hips.has(hip)) continue;
    const method = r.discoverymethod || null;
    const rade = sig(num(r.pl_rade), 4);
    // pscomppars marks values it derived itself (Chen & Kipping 2017 mass-radius relation, see
    // https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) with refstr=CALCULATED_VALUE in the *_reflink column.
    const calculated = /CALCULATED_VALUE|Calculated Value/i.test(r.pl_rade_reflink ?? '');
    const radeEstimated = calculated || (method !== 'Transit' && rade === null);
    planets.push({
      name: r.pl_name,
      host: r.hostname,
      hip,
      a: sig(num(r.pl_orbsmax), 4),
      per: sig(num(r.pl_orbper), 6),
      ecc: fixed(num(r.pl_orbeccen), 4),
      incl: fixed(num(r.pl_orbincl), 2),
      rade,
      radeEstimated,
      masse: sig(num(r.pl_bmasse), 4),
      massIsMinimum: (r.pl_bmassprov ?? '').trim() === 'Msini',
      method,
      year: num(r.disc_year),
      eqt: fixed(num(r.pl_eqt), 0),
      hostTeff: fixed(num(r.st_teff), 0),
      hostRad: sig(num(r.st_rad), 4),
      hostDist: sig(num(r.sy_dist), 5),
    });
  }
  // An orbit cannot be drawn without both a and the period; such planets (e.g. directly imaged ones with no
  // published period) are left out and listed on the console.
  const dropped = planets.filter((p) => p.a === null || p.per === null);
  if (dropped.length) console.log(`exoplanets: left out (no semi-major axis or period): ${dropped.map((p) => p.name).join(', ')}`);
  const kept = planets.filter((p) => p.a !== null && p.per !== null);
  kept.sort((p, q) => p.hip - q.hip || cmp(p.name, q.name));
  return {
    meta: {
      retrieved: '',
      service: 'NASA Exoplanet Archive TAP (https://exoplanetarchive.ipac.caltech.edu/TAP)',
      catalogue: 'Planetary Systems Composite Parameters (pscomppars), DOI 10.26133/NEA13',
      query: EXO_QUERY,
      licence: 'Free to use; publications should include the archive acknowledgement (https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html).',
      citation: 'NASA Exoplanet Archive, Planetary Systems Composite Parameters table, DOI 10.26133/NEA13; archive service DOI 10.26133/NEA45.',
      acknowledgement: 'This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.',
    },
    planets: kept,
  };
}

function validate(plx, exo, hips) {
  const errors = [];
  if (plx.hip.length < 1000) errors.push(`only ${plx.hip.length} parallax rows (need ≥ 1000)`);
  if (plx.plx.length !== plx.hip.length || plx.ePlx.length !== plx.hip.length) errors.push('parallax arrays differ in length');
  plx.hip.forEach((h, i) => {
    if (!hips.has(h)) errors.push(`parallax HIP ${h} not in stars.json`);
    if (!Number.isFinite(plx.plx[i])) errors.push(`parallax HIP ${h}: plx not finite`);
  });
  const hosts = new Set(exo.planets.map((p) => p.hip));
  if (exo.planets.length < 40) errors.push(`only ${exo.planets.length} planets (need ≥ 40)`);
  if (hosts.size < 30) errors.push(`only ${hosts.size} host stars (need ≥ 30)`);
  for (const p of exo.planets) {
    if (!hips.has(p.hip)) errors.push(`${p.name}: HIP ${p.hip} not in stars.json`);
    if (!(p.a > 0)) errors.push(`${p.name}: a = ${p.a}`);
    if (!(p.per > 0)) errors.push(`${p.name}: per = ${p.per}`);
  }
  return errors;
}

const payloadKey = (obj) => JSON.stringify({ ...obj, meta: { ...obj.meta, retrieved: undefined } });

/** Keep the previous retrieval date when only the date would change, so an unchanged upstream gives zero diff. */
async function writeStable(path, obj, today) {
  let prev = null;
  try { prev = JSON.parse(await readFile(path, 'utf8')); } catch { /* first run */ }
  const unchanged = prev && payloadKey(prev) === payloadKey(obj);
  const out = { ...obj, meta: { ...obj.meta, retrieved: unchanged ? prev.meta.retrieved : today } };
  // Keep `retrieved` as the first meta key.
  out.meta = { retrieved: out.meta.retrieved, ...out.meta };
  await writeFile(path, JSON.stringify(out) + '\n');
  return unchanged;
}

async function main() {
  const stars = JSON.parse(await readFile(STARS, 'utf8'));
  const hips = new Set(stars.hip.filter((h) => Number.isInteger(h) && h > 0));
  const [plx, exo] = await Promise.all([fetchParallax(hips), fetchExoplanets(hips)]);
  const errors = validate(plx, exo, hips);
  if (errors.length) {
    console.error(`fetch-sky: validation failed, nothing written:\n  ${errors.slice(0, 30).join('\n  ')}`);
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  await mkdir(OUT_DIR, { recursive: true });
  const plxSame = await writeStable(OUT_PLX, plx, today);
  const exoSame = await writeStable(OUT_EXO, exo, today);
  const hosts = new Set(exo.planets.map((p) => p.hip)).size;
  const est = exo.planets.filter((p) => p.radeEstimated).length;
  console.log(`hip-parallax.json: ${plx.hip.length} stars${plxSame ? ' (unchanged)' : ''}`);
  console.log(`exoplanets.json: ${exo.planets.length} planets, ${hosts} hosts, ${est} with estimated radius${exoSame ? ' (unchanged)' : ''}`);
}

main().catch((err) => {
  console.error(`fetch-sky: ${err.stack ?? err}`);
  process.exit(1);
});
