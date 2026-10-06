// Trích xuất dữ liệu gọn cho ứng dụng từ các gói npm (chạy: npm run data).
//  - Sao: d3-celestial (BSD-3-Clause, dữ liệu gốc từ HYG Database)
//  - Đường nối chòm sao: d3-celestial
//  - Lục địa: Natural Earth 1:110m (public domain) qua world-atlas (ISC)
// Kết quả ghi vào src/data/generated/*.json để ứng dụng chạy hoàn toàn offline.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { feature } from 'topojson-client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const outDir = join(root, 'src/data/generated');
mkdirSync(outDir, { recursive: true });

const MAG_LIMIT = 4.8;
// Các mẫu chòm sao có thể thêm vào bầu trời (phải khớp TEMPLATES trong src/data/constellations.ts;
// src/data/constellations.test.ts kiểm tra điều này). Chỉ các hình này nằm trong gói khởi động;
// đủ 88 chòm sao được tải động khi bật "Đường nối 88 chòm sao".
const TEMPLATE_IDS = ['UMa', 'UMi', 'Cas', 'Ori', 'Cru', 'Sco', 'Cyg', 'Lyr', 'Aql', 'Leo', 'Gem', 'CMa', 'Tau', 'Sgr', 'Cen', 'Peg'];
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const toRa = (lon) => round(((lon % 360) + 360) % 360, 4);

const allStars = readJson('node_modules/d3-celestial/data/stars.6.json').features;
const starNames = readJson('node_modules/d3-celestial/data/starnames.json');
const lines = readJson('node_modules/d3-celestial/data/constellations.lines.json').features;

// --- Đường nối chòm sao: gộp đỉnh trùng, khớp với sao trong danh mục ---------
const findStar = (ra, dec) => {
  let best = null;
  let bestD = 0.05; // độ
  for (const f of allStars) {
    const [lon, lat] = f.geometry.coordinates;
    const dRa = Math.abs(((toRa(lon) - ra + 540) % 360) - 180) * Math.cos((dec * Math.PI) / 180);
    const d = Math.hypot(dRa, lat - dec);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
};

const figureHips = new Set();
const constellations = {};
for (const f of lines) {
  const verts = [];
  const key = new Map();
  const segs = [];
  const idx = ([lon, lat]) => {
    const k = `${lon},${lat}`;
    if (!key.has(k)) {
      const ra = toRa(lon);
      const dec = round(lat, 4);
      const s = findStar(ra, dec);
      if (s) figureHips.add(s.id);
      verts.push(s ? [ra, dec, round(s.properties.mag, 2), s.id] : [ra, dec, 4.5, 0]);
      key.set(k, verts.length - 1);
    }
    return key.get(k);
  };
  for (const poly of f.geometry.coordinates) {
    for (let i = 0; i + 1 < poly.length; i++) {
      const a = idx(poly[i]);
      const b = idx(poly[i + 1]);
      if (a !== b) segs.push([a, b]);
    }
  }
  constellations[f.id] = { stars: verts, segs };
}

// --- Danh mục sao sáng --------------------------------------------------------
const chosen = allStars
  .filter((f) => f.properties.mag <= MAG_LIMIT || figureHips.has(f.id))
  .sort((a, b) => a.properties.mag - b.properties.mag);

const stars = { ra: [], dec: [], mag: [], bv: [], hip: [] };
const names = {};
for (const f of chosen) {
  const [lon, lat] = f.geometry.coordinates;
  stars.ra.push(toRa(lon));
  stars.dec.push(round(lat, 4));
  stars.mag.push(round(f.properties.mag, 2));
  stars.bv.push(round(parseFloat(f.properties.bv) || 0.6, 2));
  stars.hip.push(f.id);
  const n = starNames[f.id];
  if (n) {
    const desig = [n.bayer || n.flam || '', n.c || ''].filter(Boolean).join(' ').trim();
    if (n.name || desig) names[f.id] = [n.name || '', desig];
  }
}

// --- Lục địa -----------------------------------------------------------------
const land = readJson('node_modules/world-atlas/land-110m.json');
const geo = feature(land, land.objects.land);
const rings = [];
for (const g of geo.features) {
  const polys = g.geometry.type === 'Polygon' ? [g.geometry.coordinates] : g.geometry.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      const flat = [];
      for (const [lon, lat] of ring) flat.push(round(lon, 2), round(lat, 2));
      rings.push(flat);
    }
  }
}

// --- Thiên thể sâu: 110 thiên thể Messier + vài thiên thể NGC/PGC sáng ở bầu trời phía Nam ---
// Mỗi phần tử: [định danh chính, định danh phụ, tên thường gọi (EN), loại, cấp sao V, kích thước biểu kiến (′), α, δ]
const messier = readJson('node_modules/d3-celestial/data/messier.json').features;
const bright = readJson('node_modules/d3-celestial/data/dsos.bright.json').features;
const EXTRA_DSO = {
  'NGC 5139': ['NGC 5139', 'ω Cen', 'Omega Centauri'],
  'NGC 104': ['NGC 104', '47 Tuc', '47 Tucanae'],
  'NGC 3372': ['NGC 3372', '', 'Carina Nebula'],
  'NGC 869': ['NGC 869', 'h Per', 'Double Cluster (h Persei)'],
  'NGC 884': ['NGC 884', 'χ Per', 'Double Cluster (χ Persei)'],
  'PGC 17223': ['LMC', 'PGC 17223', 'Large Magellanic Cloud'],
  'NGC 292': ['SMC', 'NGC 292', 'Small Magellanic Cloud'],
  'IC 2602': ['IC 2602', '', 'Southern Pleiades'],
};
const dimOf = (d) => {
  const parts = String(d || '').split('x').map(Number).filter((x) => x > 0);
  return parts.length ? round(Math.max(...parts), 1) : 0;
};
const dsos = [];
for (const f of messier) {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  dsos.push([f.id, p.desig || '', (p.alt || '').replace('´', "'"), p.type, p.mag, dimOf(p.dim), toRa(lon), round(lat, 4)]);
}
for (const f of bright) {
  const extra = EXTRA_DSO[f.id];
  if (!extra) continue;
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  dsos.push([extra[0], extra[1], extra[2], p.type, p.mag, dimOf(p.dim), toRa(lon), round(lat, 4)]);
}

const write = (name, data) => {
  const s = JSON.stringify(data);
  writeFileSync(join(outDir, name), s);
  console.log(`${name}: ${(s.length / 1024).toFixed(1)} KB`);
};
write('stars.json', { magLimit: MAG_LIMIT, ...stars, names });
write('constellations.json', constellations);
write('constellation-templates.json', Object.fromEntries(TEMPLATE_IDS.map((id) => [id, constellations[id]])));
write('land.json', rings);
write('dsos.json', dsos);
console.log(`Sao: ${stars.ra.length}, chòm sao: ${Object.keys(constellations).length}, vòng lục địa: ${rings.length}`);
