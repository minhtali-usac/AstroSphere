// Codex › sơ đồ nhỏ (SVG nội tuyến) cho vài mục then chốt. Màu là màu ngữ nghĩa của cảnh 3D (scene/colors.ts):
// cùng một nét trong sơ đồ và trong mô phỏng mang cùng một nghĩa. Chữ giải thích đặt ngay cạnh nét (information-
// design: giải thích gần dấu), chú thích đầy đủ nằm trong <figcaption> và làm tên truy cập của hình.

import { fmtDeg, fmtNum, galacticToEquatorial, OBLIQUITY } from '../astro';
import { bvToRgb, catalogArrays, catalogIndexByHip } from '../data/catalog';
import { COLORS } from '../scene/colors';
import { DSO_COLORS } from '../selection';
import { starRadius } from './sky';

export interface DiagramLabels {
  observer: string;
  horizon: string;
  equator: string;
  ecliptic: string;
  zenith: string;
  pole: string;
  star: string;
  vernal: string;
  circumpolar: string;
  riseSet: string;
  neverRise: string;
  north: string;
  east: string;
  south: string;
  west: string;
  nadir: string;
  poleN: string;
  poleS: string;
  meridian: string;
  diurnalNote: string;
  rise: string;
  set: string;
  toStar: string;
  toSun: string;
  siderealDay: string;
  solarDay: string;
  galacticCenter: string;
  milkyWay: string;
  brighter: string;
  fainter: string;
  hotter: string;
  cooler: string;
  sun: string;
  galaxy: string;
  nebula: string;
  cluster: string;
  summer: string;
  equinox: string;
  winter: string;
}

/** Dữ liệu sống của mô phỏng mà vài sơ đồ dùng: vĩ độ đang chọn, vị trí Mặt Trời theo ngày đang chọn. */
export interface DiagramEnv {
  lat: number;
  sun: { ra: number; dec: number; lambda: number };
  sunDate: string;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const rad = (d: number) => (d * Math.PI) / 180;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x: number, y: number, s: string, cls = 'cdx-svg__t', anchor = 'middle', fill = '') =>
  `<text x="${r1(x)}" y="${r1(y)}" class="${cls}" text-anchor="${anchor}"${fill ? ` style="fill:${fill}"` : ''}>${esc(s)}</text>`;

/** Độ cao thiên cực = vĩ độ: chân trời, người quan sát, trục tới thiên cực và cung h_P. */
function latPole(L: DiagramLabels, lat: number): string {
  const phi = Math.min(Math.abs(lat), 89);
  const cx = 150;
  const cy = 130;
  const R = 105;
  const px = cx - R * Math.cos(rad(phi));
  const py = cy - R * Math.sin(rad(phi));
  const ar = 52;
  const ax = cx - ar * Math.cos(rad(phi));
  const ay = cy - ar * Math.sin(rad(phi));
  return `
    <path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}" class="cdx-svg__dome"/>
    <line x1="${cx - R - 20}" y1="${cy}" x2="${cx + R + 20}" y2="${cy}" stroke="${COLORS.horizon}" stroke-width="2.5"/>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R}" stroke="${COLORS.zenith}" stroke-width="1" stroke-dasharray="3 4"/>
    <line x1="${cx}" y1="${cy}" x2="${r1(px)}" y2="${r1(py)}" stroke="${COLORS.axis}" stroke-width="2.5"/>
    <path d="M ${cx - ar} ${cy} A ${ar} ${ar} 0 0 1 ${r1(ax)} ${r1(ay)}" fill="none" stroke="${COLORS.latitude}" stroke-width="3"/>
    <circle cx="${r1(px)}" cy="${r1(py)}" r="5" fill="${COLORS.axis}"/>
    <circle cx="${cx}" cy="${cy}" r="4" class="cdx-svg__me"/>
    ${text(cx - 10, cy + 20, `h = ${fmtDeg(phi)}`, 'cdx-svg__t cdx-svg__t--key', 'end', COLORS.latitude)}
    ${text(px + (phi > 60 ? 10 : 0), py - 10, L.pole, 'cdx-svg__t', phi > 60 ? 'start' : 'middle')}
    ${text(cx, cy - R - 8, L.zenith)}
    ${text(cx - R - 18, cy + 18, L.north, 'cdx-svg__t cdx-svg__t--dir')}
    ${text(cx + R + 18, cy + 18, L.south, 'cdx-svg__t cdx-svg__t--dir')}
    ${text(cx + R - 4, cy - 8, L.horizon, 'cdx-svg__t cdx-svg__t--muted', 'end')}
    ${text(cx + 8, cy + 20, L.observer, 'cdx-svg__t cdx-svg__t--muted', 'start')}`;
}

/** Hệ chân trời: vòm trời, ellipse chân trời (B ở xa, Đ bên phải), cung A từ B qua Đ, cung h lên sao. */
function altaz(L: DiagramLabels): string {
  const cx = 150;
  const cy = 120;
  const rx = 110;
  const ry = 34;
  const A = 125;
  const hAlt = 38;
  const footX = cx + rx * Math.sin(rad(A));
  const footY = cy - ry * Math.cos(rad(A));
  const sx = cx + rx * Math.cos(rad(hAlt)) * Math.sin(rad(A));
  const sy = cy - ry * Math.cos(rad(hAlt)) * Math.cos(rad(A)) - rx * Math.sin(rad(hAlt));
  const qx = footX + 14;
  const qy = (footY + sy) / 2;
  return `
    <path d="M ${cx - rx} ${cy} A ${rx} ${rx} 0 0 1 ${cx + rx} ${cy}" class="cdx-svg__dome"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${COLORS.horizon}" stroke-width="2.5"/>
    <path d="M ${cx} ${cy - ry} A ${rx} ${ry} 0 0 1 ${r1(footX)} ${r1(footY)}" fill="none" stroke="${COLORS.azimuth}" stroke-width="3.5"/>
    <line x1="${cx}" y1="${cy}" x2="${r1(footX)}" y2="${r1(footY)}" stroke="${COLORS.azimuth}" stroke-width="1" stroke-dasharray="3 3"/>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - ry}" stroke="${COLORS.azimuth}" stroke-width="1" stroke-dasharray="3 3"/>
    <path d="M ${r1(footX)} ${r1(footY)} Q ${r1(qx)} ${r1(qy)} ${r1(sx)} ${r1(sy)}" fill="none" stroke="${COLORS.vertical}" stroke-width="3.5"/>
    <circle cx="${r1(sx)}" cy="${r1(sy)}" r="5.5" class="cdx-svg__star"/>
    <circle cx="${cx}" cy="${cy}" r="4" class="cdx-svg__me"/>
    ${text(sx - 10, sy - 6, L.star, 'cdx-svg__t', 'end')}
    ${text(cx + 64, cy - ry - 2, 'A', 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.azimuth)}
    ${text(qx + 12, qy + 4, 'h', 'cdx-svg__t cdx-svg__t--key', 'start', COLORS.vertical)}
    ${text(cx, cy - ry - 8, L.north, 'cdx-svg__t cdx-svg__t--dir')}
    ${text(cx + rx + 12, cy + 5, L.east, 'cdx-svg__t cdx-svg__t--dir', 'start')}
    ${text(cx, cy + ry + 18, L.south, 'cdx-svg__t cdx-svg__t--dir')}
    ${text(cx - rx - 12, cy + 5, L.west, 'cdx-svg__t cdx-svg__t--dir', 'end')}
    ${text(cx - 6, cy + 16, L.observer, 'cdx-svg__t cdx-svg__t--muted', 'end')}`;
}

/** Hệ xích đạo: thiên cầu, trục, xích đạo trời, điểm γ, cung α dọc xích đạo, cung δ lên sao. */
function radec(L: DiagramLabels): string {
  const cx = 150;
  const cy = 92;
  const R = 70;
  const ry = 20;
  const eq = (tDeg: number, dec = 0): [number, number] => [
    cx + R * Math.cos(rad(dec)) * Math.sin(rad(tDeg)),
    cy + ry * Math.cos(rad(dec)) * Math.cos(rad(tDeg)) - R * Math.sin(rad(dec)),
  ];
  const [gx, gy] = eq(-55);
  const [fx, fy] = eq(35);
  const [sx, sy] = eq(35, 42);
  return `
    <circle cx="${cx}" cy="${cy}" r="${R}" class="cdx-svg__dome"/>
    <line x1="${cx}" y1="${cy - R - 14}" x2="${cx}" y2="${cy + R + 14}" stroke="${COLORS.axis}" stroke-width="2" stroke-dasharray="5 4"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${ry}" fill="none" stroke="${COLORS.equator}" stroke-width="2.5"/>
    <path d="M ${r1(gx)} ${r1(gy)} A ${R} ${ry} 0 0 0 ${r1(fx)} ${r1(fy)}" fill="none" stroke="${COLORS.equator}" stroke-width="5" stroke-opacity="0.55"/>
    <path d="M ${r1(fx)} ${r1(fy)} Q ${r1(fx + 16)} ${r1((fy + sy) / 2)} ${r1(sx)} ${r1(sy)}" fill="none" stroke="${COLORS.vertical}" stroke-width="3.5"/>
    <circle cx="${r1(gx)}" cy="${r1(gy)}" r="4" fill="${COLORS.equator}"/>
    <circle cx="${r1(sx)}" cy="${r1(sy)}" r="5.5" class="cdx-svg__star"/>
    <circle cx="${cx}" cy="${cy - R}" r="4" fill="${COLORS.axis}"/>
    ${text(gx - 8, gy + 16, L.vernal, 'cdx-svg__t cdx-svg__t--key', 'end')}
    ${text((gx + fx) / 2, cy + ry + 18, 'α', 'cdx-svg__t cdx-svg__t--key')}
    ${text(fx - 2, (fy + sy) / 2 + 6, 'δ', 'cdx-svg__t cdx-svg__t--key', 'end', COLORS.vertical)}
    ${text(sx + 10, sy - 6, L.star, 'cdx-svg__t', 'start')}
    ${text(cx + 8, cy - R - 6, L.pole, 'cdx-svg__t', 'start')}
    ${text(cx - R - 6, cy - 4, L.equator, 'cdx-svg__t cdx-svg__t--muted', 'end')}`;
}

/** Ba vùng mọc – lặn trên trục xích vĩ, tại vĩ độ đang chọn. */
function zones(L: DiagramLabels, lat: number): string {
  const top = 18;
  const bottom = 178;
  const x = 70;
  const w = 34;
  const y = (dec: number) => top + ((90 - dec) / 180) * (bottom - top);
  const lim = 90 - Math.abs(lat);
  // Bắc bán cầu: cận cực ở phía δ dương; Nam bán cầu đối xứng.
  const north = lat >= 0;
  const bands = [
    {
      from: 90,
      to: lim,
      color: north ? COLORS.circumpolar : COLORS.neverRise,
      label: north ? L.circumpolar : L.neverRise,
    },
    { from: lim, to: -lim, color: COLORS.riseSet, label: L.riseSet },
    {
      from: -lim,
      to: -90,
      color: north ? COLORS.neverRise : COLORS.circumpolar,
      label: north ? L.neverRise : L.circumpolar,
    },
  ];
  let out = '';
  for (const b of bands) {
    const y0 = y(b.from);
    const y1 = y(b.to);
    if (y1 - y0 < 0.5) continue;
    out += `<rect x="${x}" y="${r1(y0)}" width="${w}" height="${r1(y1 - y0)}" fill="${b.color}" fill-opacity="0.75"/>`;
    if (y1 - y0 >= 12) out += text(x + w + 12, (y0 + y1) / 2 + 4, b.label, 'cdx-svg__t', 'start');
  }
  for (const d of [90, 0, -90])
    out += text(x - 8, y(d) + 4, `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}°`, 'cdx-svg__t cdx-svg__t--muted', 'end');
  if (lim > 0 && lim < 90) {
    for (const d of [lim, -lim]) {
      out += `<line x1="${x - 4}" y1="${r1(y(d))}" x2="${x + w + 4}" y2="${r1(y(d))}" class="cdx-svg__rule"/>`;
    }
  }
  out += text(x + w / 2, 12, 'δ', 'cdx-svg__t cdx-svg__t--key');
  out += text(290, 14, `φ = ${fmtDeg(Math.abs(lat))} ${north ? L.north : L.south}`, 'cdx-svg__t cdx-svg__t--muted', 'end');
  return out;
}

/** Hoàng đạo trên bản đồ phẳng (α ngang, δ dọc): sóng nghiêng 23,44° quanh xích đạo trời. */
function ecliptic(L: DiagramLabels, sun?: DiagramEnv['sun'], sunLabel = ''): string {
  const x0 = 30;
  const x1 = 290;
  const y0 = 100;
  const k = 2.6; // px mỗi độ xích vĩ
  const eps = rad(23.44);
  let d = '';
  for (let a = 0; a <= 360; a += 10) {
    const dec = (Math.atan(Math.tan(eps) * Math.sin(rad(a))) * 180) / Math.PI;
    d += `${a === 0 ? 'M' : 'L'} ${r1(x0 + ((x1 - x0) * a) / 360)} ${r1(y0 - dec * k)} `;
  }
  const xPeak = x0 + (x1 - x0) / 4;
  return `
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="${COLORS.equator}" stroke-width="2.5"/>
    <path d="${d}" fill="none" stroke="${COLORS.ecliptic}" stroke-width="3" stroke-dasharray="8 4"/>
    <line x1="${r1(xPeak)}" y1="${y0}" x2="${r1(xPeak)}" y2="${r1(y0 - 23.44 * k)}" class="cdx-svg__rule"/>
    <circle cx="${x0}" cy="${y0}" r="4.5" fill="${COLORS.equator}"/>
    ${text(xPeak, y0 + 22, 'ε = 23,44°', 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.ecliptic)}
    ${text(x0 + 2, y0 + 20, L.vernal, 'cdx-svg__t cdx-svg__t--key', 'start')}
    ${text(x1, y0 - 8, L.equator, 'cdx-svg__t cdx-svg__t--muted', 'end')}
    ${text(x0 + ((x1 - x0) * 3) / 4, y0 + 23.44 * k + 20, L.ecliptic, 'cdx-svg__t cdx-svg__t--muted')}
    ${text(x0, 186, '0h', 'cdx-svg__t cdx-svg__t--muted')}
    ${text((x0 + x1) / 2, 186, 'α = 12h', 'cdx-svg__t cdx-svg__t--muted')}
    ${text(x1, 186, '24h', 'cdx-svg__t cdx-svg__t--muted')}${
      sun
        ? (() => {
            const sx = x0 + ((x1 - x0) * sun.ra) / 360;
            const sy = y0 - sun.dec * k;
            const below = sun.dec < 0;
            return `<circle cx="${r1(sx)}" cy="${r1(sy)}" r="8" fill="${COLORS.sun}"/>${text(sx, below ? sy + 26 : sy - 14, sunLabel, 'cdx-svg__t cdx-svg__t--key')}`;
          })()
        : ''
    }`;
}


// ---------------------------------------------------------------------------------------------------------------
// Thiên cầu nhìn nghiêng (phép chiếu vuông góc). Hệ chân trời của người quan sát: x = Đông, y = Bắc, z = thiên đỉnh.
// Người xem đứng phía Tây Nam, hơi cao: Bắc ở trái phía sau, Nam ở phải phía trước, Đông ở phía sau.
// Phần nằm sau quả cầu vẽ nét đứt, mờ hơn. Vĩ độ minh họa cố định 40° để hình rõ ràng.

type V = [number, number, number];
const PHI = 40;
const v3 = (x: number, y: number, z: number): V => [x, y, z];
const plus = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => times(a, 1 / (Math.hypot(...a) || 1));

const NORTH = v3(0, 1, 0);
const SOUTH = v3(0, -1, 0);
const EAST = v3(1, 0, 0);
const WEST = v3(-1, 0, 0);
const UP = v3(0, 0, 1);

/** Khung xích đạo tại vĩ độ φ: thiên cực P, điểm xích đạo trên kinh tuyến M, và E(H) theo góc giờ. */
function eqFrame(phi = PHI) {
  const P = v3(0, Math.cos(rad(phi)), Math.sin(rad(phi)));
  const M = v3(0, -Math.sin(rad(phi)), Math.cos(rad(phi)));
  const E = (H: number): V => plus(times(M, Math.cos(rad(H))), times(WEST, Math.sin(rad(H))));
  const star = (H: number, dec: number): V => plus(times(E(H), Math.cos(rad(dec))), times(P, Math.sin(rad(dec))));
  return { P, M, E, star };
}

interface Cam {
  cx: number;
  cy: number;
  R: number;
  right: V;
  up: V;
  toward: V;
}

function camera(cx: number, cy: number, R: number, beta = 32, elev = 18): Cam {
  const cb = Math.cos(rad(beta));
  const sb = Math.sin(rad(beta));
  // Quay quanh thiên đỉnh: phải = Nam, hướng về người xem = Tây khi beta = 0; beta dương đưa người xem về phía
  // Tây Nam để thấy rõ cả chân trời lẫn xích đạo trời (không bị nhìn cạnh).
  const right = v3(sb, -cb, 0);
  const toward0 = v3(-cb, -sb, 0);
  const ce = Math.cos(rad(elev));
  const se = Math.sin(rad(elev));
  return { cx, cy, R, right: unit(right), up: unit(plus(times(UP, ce), times(toward0, -se))), toward: unit(plus(times(toward0, ce), times(UP, se))) };
}

const scr = (c: Cam, v: V): [number, number, number] => [c.cx + c.R * dot(v, c.right), c.cy - c.R * dot(v, c.up), dot(v, c.toward)];

/** Điểm trên đường tròn tâm `center`, hai vectơ cơ sở u, v (đã nhân bán kính), từ t0 tới t1 (độ). */
function arc(center: V, u: V, v: V, t0 = 0, t1 = 360, step = 4): V[] {
  const out: V[] = [];
  const n = Math.max(2, Math.ceil(Math.abs(t1 - t0) / step));
  for (let i = 0; i <= n; i++) {
    const t = rad(t0 + ((t1 - t0) * i) / n);
    out.push(plus(center, plus(times(u, Math.cos(t)), times(v, Math.sin(t)))));
  }
  return out;
}

/** Vòng lớn có pháp tuyến n. */
function great(n: V): V[] {
  const a = Math.abs(n[2]) < 0.9 ? UP : EAST;
  const u = unit(cross(n, a));
  return arc(v3(0, 0, 0), u, unit(cross(n, u)));
}

/** Vòng nhỏ song song xích đạo ở xích vĩ δ (vòng nhật động). */
function parallel(f: ReturnType<typeof eqFrame>, dec: number): V[] {
  const c = Math.cos(rad(dec));
  return arc(times(f.P, Math.sin(rad(dec))), times(f.M, c), times(WEST, c));
}

interface Stroke {
  color: string;
  width?: number;
  /** Chỉ vẽ nửa trước (nửa sau bị che hoàn toàn). */
  frontOnly?: boolean;
  dash?: string;
  opacity?: number;
}

/** Đường cong qua các điểm, tách nửa trước (nét liền) và nửa sau (nét đứt, mờ). */
function curve(c: Cam, pts: V[], s: Stroke): string {
  let front = '';
  let back = '';
  let prev: 'f' | 'b' | '' = '';
  for (let i = 1; i < pts.length; i++) {
    const a = scr(c, pts[i - 1]);
    const b = scr(c, pts[i]);
    const side = a[2] + b[2] >= -1e-9 ? 'f' : 'b';
    const seg = `${prev === side ? '' : `M${r1(a[0])} ${r1(a[1])}`}L${r1(b[0])} ${r1(b[1])}`;
    if (side === 'f') front += seg;
    else back += seg;
    prev = side;
  }
  const w = s.width ?? 2;
  const op = s.opacity ?? 1;
  let out = '';
  if (back && !s.frontOnly)
    out += `<path d="${back}" fill="none" stroke="${s.color}" stroke-width="${Math.max(1, w * 0.6)}" stroke-dasharray="3 4" stroke-opacity="${r1(op * 0.55 * 10) / 10}"/>`;
  if (front) out += `<path d="${front}" fill="none" stroke="${s.color}" stroke-width="${w}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}${op < 1 ? ` stroke-opacity="${op}"` : ''} stroke-linecap="round"/>`;
  return out;
}

const dotAt = (c: Cam, v: V, r: number, fill: string, cls = '') => {
  const [x, y] = scr(c, v);
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}"${fill ? ` fill="${fill}"` : ''}${cls ? ` class="${cls}"` : ''}/>`;
};

const label = (c: Cam, v: V, s: string, dx = 0, dy = 0, cls = 'cdx-svg__t', anchor = 'middle', fill = '') => {
  const [x, y] = scr(c, v);
  return text(x + dx, y + dy, s, cls, anchor, fill);
};

/** Mũi tên nhỏ ở cuối đoạn a → b (màn hình). */
function arrowHead(c: Cam, a: V, b: V, color: string): string {
  const [ax, ay] = scr(c, a);
  const [bx, by] = scr(c, b);
  const ang = Math.atan2(by - ay, bx - ax);
  const s = 7;
  const p = (da: number) => `${r1(bx - s * Math.cos(ang + da))} ${r1(by - s * Math.sin(ang + da))}`;
  return `<path d="M${p(0.45)}L${r1(bx)} ${r1(by)}L${p(-0.45)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
}

const outline = (c: Cam) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.R}" class="cdx-svg__dome"/>`;
const me = (c: Cam) => `<circle cx="${c.cx}" cy="${c.cy}" r="3.5" class="cdx-svg__me"/>`;
const HORIZON = great(UP);
const cam0 = () => camera(150, 112, 82);

function sphere(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 2.5 })}
    ${curve(c, great(f.P), { color: COLORS.equator, width: 2.5 })}
    ${curve(c, [times(f.P, -1.2), times(f.P, 1.2)], { color: COLORS.axis, width: 2 })}
    ${dotAt(c, f.P, 4, COLORS.axis)}${me(c)}
    ${label(c, f.P, L.pole, 0, -10)}
    ${label(c, SOUTH, L.horizon, 6, 16, 'cdx-svg__t', 'start')}
    ${label(c, f.E(100), L.equator, -2, 18)}
    ${label(c, v3(0, 0, 0), L.observer, -8, 15, 'cdx-svg__t cdx-svg__t--muted', 'end')}`;
}

function horizon(L: DiagramLabels): string {
  const c = cam0();
  const disk = HORIZON.map((v) => scr(c, v))
    .map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`)
    .join('');
  return `${outline(c)}
    <path d="${disk}Z" fill="${COLORS.ground}" fill-opacity=".7"/>
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 2.5 })}
    ${curve(c, [v3(0, 0, 0), UP], { color: COLORS.zenith, width: 1, dash: '3 4' })}
    ${dotAt(c, UP, 4, COLORS.zenith)}${me(c)}
    ${label(c, UP, L.zenith, 0, -10)}
    ${label(c, NORTH, L.north, -12, 5, 'cdx-svg__t cdx-svg__t--dir', 'end')}
    ${label(c, SOUTH, L.south, 12, 5, 'cdx-svg__t cdx-svg__t--dir', 'start')}
    ${label(c, EAST, L.east, 0, -7, 'cdx-svg__t cdx-svg__t--dir')}
    ${label(c, WEST, L.west, 0, 18, 'cdx-svg__t cdx-svg__t--dir')}
    ${label(c, v3(0.15, 0.5, 0), 'h = 0°', 0, 0, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.horizon)}`;
}

function zenith(L: DiagramLabels): string {
  const c = cam0();
  const down = times(UP, -1);
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 2 })}
    ${curve(c, [down, UP], { color: COLORS.zenith, width: 1.5, dash: '4 4' })}
    ${dotAt(c, UP, 4.5, COLORS.zenith)}${dotAt(c, down, 4.5, COLORS.zenith)}${me(c)}
    ${label(c, UP, `${L.zenith} · h = +90°`, 0, -10)}
    ${label(c, down, `${L.nadir} · h = −90°`, 0, 20)}
    ${label(c, SOUTH, L.horizon, 6, 16, 'cdx-svg__t cdx-svg__t--muted', 'start')}
    ${label(c, v3(0, 0, 0), L.observer, 8, -6, 'cdx-svg__t cdx-svg__t--muted', 'start')}`;
}

function pole(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  const S = times(f.P, -1);
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 1.5, opacity: 0.6 })}
    ${curve(c, great(f.P), { color: COLORS.equator, width: 1.5, opacity: 0.6 })}
    ${curve(c, [times(f.P, -1.15), times(f.P, 1.15)], { color: COLORS.axis, width: 2.5 })}
    ${dotAt(c, f.P, 5, COLORS.axis)}${dotAt(c, S, 5, COLORS.axis)}${me(c)}
    ${label(c, f.P, L.poleN, 0, -12)}
    ${label(c, S, L.poleS, 0, 22)}
    ${label(c, v3(0, 0, 0), L.observer, 10, 4, 'cdx-svg__t cdx-svg__t--muted', 'start')}`;
}

function equator(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 1.5, opacity: 0.6 })}
    ${curve(c, [times(f.P, -1.15), times(f.P, 1.15)], { color: COLORS.axis, width: 1.5 })}
    ${curve(c, great(f.P), { color: COLORS.equator, width: 3 })}
    ${dotAt(c, f.P, 4, COLORS.axis)}${me(c)}
    ${label(c, f.P, L.pole, 0, -10)}
    ${label(c, f.E(110), `${L.equator} · δ = 0°`, 0, 20, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.equator)}
    ${label(c, SOUTH, L.horizon, 6, 16, 'cdx-svg__t cdx-svg__t--muted', 'start')}`;
}

function meridian(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 2 })}
    ${curve(c, great(EAST), { color: COLORS.meridian, width: 2.5 })}
    ${curve(c, [times(f.P, -1.15), times(f.P, 1.15)], { color: COLORS.axis, width: 1.5, opacity: 0.8 })}
    ${dotAt(c, UP, 4, COLORS.zenith)}${dotAt(c, f.P, 4, COLORS.axis)}${me(c)}
    ${label(c, UP, L.zenith, 0, -10)}
    ${label(c, f.P, L.pole, -10, -4, 'cdx-svg__t', 'end')}
    ${label(c, NORTH, L.north, -12, 5, 'cdx-svg__t cdx-svg__t--dir', 'end')}
    ${label(c, SOUTH, L.south, 12, 5, 'cdx-svg__t cdx-svg__t--dir', 'start')}
    ${label(c, f.star(0, -20), L.meridian, 10, 0, 'cdx-svg__t cdx-svg__t--key', 'start', COLORS.meridian)}`;
}

function diurnal(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  let rings = '';
  for (const dec of [65, 35, 0, -30]) {
    rings += curve(c, parallel(f, dec), { color: COLORS.meridian, width: dec === 0 ? 2 : 1.4, opacity: dec === 0 ? 1 : 0.75 });
    rings += arrowHead(c, f.star(78, dec), f.star(92, dec), COLORS.meridian);
  }
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 2.5 })}
    ${curve(c, [times(f.P, -1.15), times(f.P, 1.15)], { color: COLORS.axis, width: 2 })}
    ${rings}
    ${dotAt(c, f.P, 4, COLORS.axis)}${me(c)}
    ${label(c, f.P, L.pole, 0, -10)}
    ${label(c, EAST, L.east, 0, -6, 'cdx-svg__t cdx-svg__t--dir')}
    ${label(c, WEST, L.west, 0, 18, 'cdx-svg__t cdx-svg__t--dir')}
    ${text(150, 222, L.diurnalNote, 'cdx-svg__t cdx-svg__t--muted')}`;
}

/** Điểm γ ở góc giờ hGamma: trục α = 0h, α = 6h của hệ xích đạo, và đường hoàng đạo. */
function eclFrame(f: ReturnType<typeof eqFrame>, hGamma: number) {
  const X = f.E(hGamma);
  const Y = f.E(hGamma - 90);
  const eps = rad(OBLIQUITY);
  const Y2 = plus(times(Y, Math.cos(eps)), times(f.P, Math.sin(eps)));
  return { X, ecl: arc(v3(0, 0, 0), X, Y2) };
}

function vernal(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  const g = eclFrame(f, 75);
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 1.5, opacity: 0.55 })}
    ${curve(c, great(f.P), { color: COLORS.equator, width: 2.5 })}
    ${curve(c, g.ecl, { color: COLORS.ecliptic, width: 2.5, dash: '7 4' })}
    ${curve(c, great(cross(f.P, g.X)), { color: COLORS.hourCircle, width: 1.5 })}
    ${dotAt(c, g.X, 5, COLORS.equator)}${dotAt(c, f.P, 4, COLORS.axis)}
    ${label(c, g.X, 'γ · α = 0h', -10, 20, 'cdx-svg__t cdx-svg__t--key', 'end')}
    ${label(c, f.P, L.pole, 0, -10)}
    ${label(c, f.E(130), L.equator, 10, 16, 'cdx-svg__t cdx-svg__t--muted', 'start')}
    ${label(c, f.E(20), L.ecliptic, 6, -12, 'cdx-svg__t cdx-svg__t--muted', 'start', COLORS.ecliptic)}`;
}

function hourAngle(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  const H = 55;
  const dec = 30;
  const s = f.star(H, dec);
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 1.5, opacity: 0.55 })}
    ${curve(c, great(f.P), { color: COLORS.equator, width: 2 })}
    ${curve(c, great(EAST), { color: COLORS.meridian, width: 2 })}
    ${curve(c, great(cross(f.P, f.E(H))), { color: COLORS.hourCircle, width: 1.5 })}
    ${curve(c, arc(v3(0, 0, 0), f.M, WEST, 0, H), { color: COLORS.equator, width: 6, opacity: 0.6 })}
    ${dotAt(c, s, 5.5, '', 'cdx-svg__star')}${dotAt(c, f.P, 4, COLORS.axis)}
    ${label(c, f.E(H / 2), 'H', 0, 20, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.equator)}
    ${label(c, s, L.star, 10, -4, 'cdx-svg__t', 'start')}
    ${label(c, f.P, L.pole, -8, -8, 'cdx-svg__t', 'end')}
    ${label(c, UP, L.meridian, 8, -8, 'cdx-svg__t cdx-svg__t--muted', 'start', COLORS.meridian)}`;
}

function lst(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  const hg = 70;
  const g = f.E(hg);
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 1.5, opacity: 0.55 })}
    ${curve(c, great(f.P), { color: COLORS.equator, width: 2 })}
    ${curve(c, great(EAST), { color: COLORS.meridian, width: 2 })}
    ${curve(c, great(cross(f.P, g)), { color: COLORS.hourCircle, width: 1.5 })}
    ${curve(c, arc(v3(0, 0, 0), f.M, WEST, 0, hg), { color: COLORS.equator, width: 6, opacity: 0.6 })}
    ${dotAt(c, g, 5, COLORS.equator)}${dotAt(c, f.P, 4, COLORS.axis)}
    ${label(c, f.E(hg / 2), 'LST', 0, 20, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.equator)}
    ${label(c, g, 'γ', -10, 4, 'cdx-svg__t cdx-svg__t--key', 'end')}
    ${label(c, f.P, L.pole, -8, -8, 'cdx-svg__t', 'end')}
    ${label(c, UP, L.meridian, 8, -8, 'cdx-svg__t cdx-svg__t--muted', 'start', COLORS.meridian)}`;
}

function timeAbove(L: DiagramLabels): string {
  const c = cam0();
  const f = eqFrame();
  const dec = 22;
  const H0 = (Math.acos(-Math.tan(rad(PHI)) * Math.tan(rad(dec))) * 180) / Math.PI;
  const cd = Math.cos(rad(dec));
  const centre = times(f.P, Math.sin(rad(dec)));
  const above = arc(centre, times(f.M, cd), times(WEST, cd), -H0, H0);
  const below = arc(centre, times(f.M, cd), times(WEST, cd), H0, 360 - H0);
  return `${outline(c)}
    ${curve(c, HORIZON, { color: COLORS.horizon, width: 2.5 })}
    ${curve(c, [times(f.P, -1.15), times(f.P, 1.15)], { color: COLORS.axis, width: 1.5, opacity: 0.8 })}
    ${curve(c, below, { color: COLORS.hourCircle, width: 1.5, dash: '3 4', frontOnly: false })}
    ${curve(c, above, { color: COLORS.riseSet, width: 3.5 })}
    ${arrowHead(c, f.star(H0 - 22, dec), f.star(H0 - 8, dec), COLORS.riseSet)}
    ${dotAt(c, f.star(-H0, dec), 4.5, COLORS.riseSet)}${dotAt(c, f.star(H0, dec), 4.5, COLORS.riseSet)}${me(c)}
    ${label(c, f.star(-H0, dec), L.rise, 10, 4, 'cdx-svg__t', 'start')}
    ${label(c, f.star(H0, dec), L.set, -10, 16, 'cdx-svg__t', 'end')}
    ${label(c, f.star(0, dec), '2H₀', 0, -10, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.riseSet)}
    ${label(c, SOUTH, L.horizon, 6, 16, 'cdx-svg__t cdx-svg__t--muted', 'start')}`;
}

// --- Mặt phẳng kinh tuyến nhìn từ phía Đông (như sơ đồ độ cao thiên cực): Bắc trái, Nam phải, φ sống từ mô phỏng.

interface Side {
  cx: number;
  cy: number;
  R: number;
  /** (x, y) theo đơn vị bán kính: x dương về Nam, y dương lên trên → tọa độ màn hình. */
  at: (x: number, y: number, k?: number) => [number, number];
  /** Thiên cực nhìn thấy (theo bán cầu) và điểm xích đạo phía trên. */
  P: [number, number];
  Q: [number, number];
  phi: number;
}

function side(lat: number, cy = 130): Side {
  const cx = 150;
  const R = 100;
  const phi = Math.max(-89, Math.min(89, lat));
  const P: [number, number] = [-Math.cos(rad(phi)), Math.sin(rad(phi))];
  const Q: [number, number] = [Math.sin(rad(phi)), Math.cos(rad(phi))];
  return { cx, cy, R, phi, P, Q, at: (x, y, k = 1) => [cx + R * k * x, cy - R * k * y] };
}

function sideBase(L: DiagramLabels, g: Side, faintEquator = false): string {
  const { cx, cy, R } = g;
  const [e1x, e1y] = g.at(g.Q[0], g.Q[1]);
  const [e2x, e2y] = g.at(-g.Q[0], -g.Q[1]);
  return `
    <path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}" class="cdx-svg__dome"/>
    <path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 0 ${cx + R} ${cy}" class="cdx-svg__dome" stroke-dasharray="3 4" stroke-opacity=".5"/>
    <line x1="${r1(e2x)}" y1="${r1(e2y)}" x2="${r1(e1x)}" y2="${r1(e1y)}" stroke="${COLORS.equator}" stroke-width="${faintEquator ? 1.5 : 2.5}"${faintEquator ? ' stroke-opacity=".6"' : ''}/>
    <line x1="${cx - R - 20}" y1="${cy}" x2="${cx + R + 20}" y2="${cy}" stroke="${COLORS.horizon}" stroke-width="2.5"/>
    ${text(cx - R - 18, cy + 18, L.north, 'cdx-svg__t cdx-svg__t--dir')}
    ${text(cx + R + 18, cy + 18, L.south, 'cdx-svg__t cdx-svg__t--dir')}`;
}

/** Cung góc tại tâm, từ góc a0 tới a1 (độ, đo từ hướng Nam ngược chiều kim đồng hồ). */
function sideArc(g: Side, r: number, a0: number, a1: number, color: string): string {
  const p = (a: number) => [g.cx + r * Math.cos(rad(a)), g.cy - r * Math.sin(rad(a))];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `<path d="M ${r1(x0)} ${r1(y0)} A ${r} ${r} 0 0 ${a1 > a0 ? 0 : 1} ${r1(x1)} ${r1(y1)}" fill="none" stroke="${color}" stroke-width="3"/>`;
}

function eqAngle(L: DiagramLabels, env: DiagramEnv): string {
  const g = side(env.lat);
  const theta = 90 - Math.abs(g.phi);
  // Xích đạo phía trên nằm về phía Nam (Bắc bán cầu) hoặc phía Bắc (Nam bán cầu).
  const south = g.phi >= 0;
  const a0 = south ? 0 : 180;
  const a1 = south ? theta : 180 - theta;
  const [px, py] = g.at(g.P[0], g.P[1], 1.12);
  const [mx, my] = g.at(Math.cos(rad((a0 + a1) / 2)), Math.sin(rad((a0 + a1) / 2)), 0.62);
  return `${sideBase(L, g)}
    <line x1="${g.cx}" y1="${g.cy}" x2="${r1(px)}" y2="${r1(py)}" stroke="${COLORS.axis}" stroke-width="1.5" stroke-opacity=".8"/>
    ${sideArc(g, 48, a0, a1, COLORS.angle)}
    <circle cx="${g.cx}" cy="${g.cy}" r="4" class="cdx-svg__me"/>
    ${text(mx + (south ? 6 : -6), my + 4, `θ = ${fmtDeg(theta)}`, 'cdx-svg__t cdx-svg__t--key', south ? 'start' : 'end', COLORS.angle)}
    ${text(g.cx - 8, g.cy + 20, L.observer, 'cdx-svg__t cdx-svg__t--muted', 'end')}
    ${text(...g.at(g.Q[0], g.Q[1], 1.08), L.equator, 'cdx-svg__t cdx-svg__t--muted', south ? 'start' : 'end')}`;
}

/** Vòng nhật động của sao xích vĩ δ trong mặt phẳng kinh tuyến: đoạn thẳng giữa hai lần qua kinh tuyến. */
function sideParallel(g: Side, dec: number): { upper: [number, number]; lower: [number, number] } {
  const s = Math.sin(rad(dec));
  const c = Math.cos(rad(dec));
  return {
    upper: [g.Q[0] * c + g.P[0] * s, g.Q[1] * c + g.P[1] * s],
    lower: [-g.Q[0] * c + g.P[0] * s, -g.Q[1] * c + g.P[1] * s],
  };
}

function transit(L: DiagramLabels, env: DiagramEnv): string {
  const g = side(env.lat);
  // Một sao lên cao vừa phải ở mọi vĩ độ (độ cao lớn nhất ≈ 55°): δ = φ − 35°, giới hạn trong ±60°.
  const dec = Math.round(Math.max(-60, Math.min(60, g.phi - 35)));
  const { upper, lower } = sideParallel(g, dec);
  const [ux, uy] = g.at(...upper);
  const [lx, ly] = g.at(...lower);
  const hmax = (Math.asin(Math.max(-1, Math.min(1, upper[1]))) * 180) / Math.PI;
  const south = upper[0] >= 0;
  const a1 = south ? hmax : 180 - hmax;
  return `${sideBase(L, g, true)}
    <line x1="${r1(lx)}" y1="${r1(ly)}" x2="${r1(ux)}" y2="${r1(uy)}" stroke="${COLORS.meridian}" stroke-width="1.5" stroke-dasharray="4 4"/>
    <line x1="${g.cx}" y1="${g.cy}" x2="${r1(ux)}" y2="${r1(uy)}" stroke="${COLORS.vertical}" stroke-width="1.5"/>
    ${sideArc(g, 46, south ? 0 : 180, a1, COLORS.vertical)}
    <circle cx="${r1(ux)}" cy="${r1(uy)}" r="5.5" class="cdx-svg__star"/>
    <circle cx="${g.cx}" cy="${g.cy}" r="4" class="cdx-svg__me"/>
    ${text(ux + (south ? 8 : -8), uy - 8, `${L.star} · δ = ${dec < 0 ? '−' : '+'}${Math.abs(dec)}°`, 'cdx-svg__t', south ? 'start' : 'end')}
    ${text(...g.at(Math.cos(rad(a1 / 2 + (south ? 0 : 90))), Math.sin(rad(a1 / 2 + (south ? 0 : 90))), 0.62), `h = ${fmtDeg(hmax, 1)}`, 'cdx-svg__t cdx-svg__t--key', south ? 'start' : 'end', COLORS.vertical)}
    ${text(g.cx - 8, g.cy + 20, L.observer, 'cdx-svg__t cdx-svg__t--muted', 'end')}`;
}

function seasons(L: DiagramLabels, env: DiagramEnv): string {
  const g = side(env.lat, 128);
  let out = sideBase(L, g, true);
  const rows: [number, string][] = [
    [OBLIQUITY, L.summer],
    [0, L.equinox],
    [-OBLIQUITY, L.winter],
  ];
  rows.forEach(([dec, name], i) => {
    const { upper, lower } = sideParallel(g, dec);
    const [ux, uy] = g.at(...upper);
    const [lx, ly] = g.at(...lower);
    const south = upper[0] >= 0;
    out += `<line x1="${r1(lx)}" y1="${r1(ly)}" x2="${r1(ux)}" y2="${r1(uy)}" stroke="${COLORS.sun}" stroke-width="1.5" stroke-opacity="${i === 1 ? 0.9 : 0.6}" stroke-dasharray="${i === 1 ? '' : '4 3'}"/>`;
    out += `<circle cx="${r1(ux)}" cy="${r1(uy)}" r="6" fill="${COLORS.sun}"/>`;
    out += text(ux + (south ? 10 : -10), uy + 4, name, 'cdx-svg__t', south ? 'start' : 'end');
  });
  out += `<circle cx="${g.cx}" cy="${g.cy}" r="4" class="cdx-svg__me"/>`;
  out += text(g.cx, g.cy + 20, `φ = ${fmtDeg(Math.abs(g.phi))} ${g.phi >= 0 ? L.north : L.south}`, 'cdx-svg__t cdx-svg__t--muted');
  return out;
}

/** Ngày thiên văn: Trái Đất trên quỹ đạo ở hai ngày liên tiếp (góc phóng đại). Ở ngày 1, Mặt Trời và một sao rất xa
 *  cùng một hướng; ở ngày 2, hướng tới sao không đổi (sao quá xa) còn hướng tới Mặt Trời đã lệch: Trái Đất phải
 *  quay thêm góc đó mới lại thấy Mặt Trời ở cùng chỗ. */
function siderealDay(L: DiagramLabels): string {
  const sx = 44;
  const sy = 112;
  const R = 196;
  const a = 22;
  const e1: [number, number] = [sx + R, sy];
  const e2: [number, number] = [sx + R * Math.cos(rad(a)), sy - R * Math.sin(rad(a))];
  const len = 72;
  const arrow = (e: [number, number], ang: number, col: string, dash = '') => {
    const x = e[0] + len * Math.cos(ang);
    const y = e[1] + len * Math.sin(ang);
    const head = (d: number) => `${r1(x - 7 * Math.cos(ang + d))} ${r1(y - 7 * Math.sin(ang + d))}`;
    return `<line x1="${r1(e[0])}" y1="${r1(e[1])}" x2="${r1(x)}" y2="${r1(y)}" stroke="${col}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''}/><path d="M${head(0.45)}L${r1(x)} ${r1(y)}L${head(-0.45)}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/>`;
  };
  const toSun2 = Math.atan2(sy - e2[1], sx - e2[0]);
  const arcR = 40;
  const p = (ang: number) => `${r1(e2[0] + arcR * Math.cos(ang))} ${r1(e2[1] + arcR * Math.sin(ang))}`;
  return `
    <path d="M ${sx + R} ${sy} A ${R} ${R} 0 0 0 ${r1(sx + R * Math.cos(rad(34)))} ${r1(sy - R * Math.sin(rad(34)))}" class="cdx-svg__dome" stroke-dasharray="3 4"/>
    <circle cx="${sx}" cy="${sy}" r="13" fill="${COLORS.sun}"/>
    ${text(sx, sy + 30, L.sun, 'cdx-svg__t')}
    ${arrow(e1, Math.PI, COLORS.meridian)}
    ${arrow(e2, Math.PI, COLORS.meridian)}
    ${arrow(e2, toSun2, COLORS.sun, '5 3')}
    <path d="M${p(Math.PI)} A ${arcR} ${arcR} 0 0 1 ${p(toSun2)}" fill="none" stroke="${COLORS.angle}" stroke-width="2"/>
    <circle cx="${r1(e1[0])}" cy="${r1(e1[1])}" r="8" fill="${COLORS.axis}"/>
    <circle cx="${r1(e2[0])}" cy="${r1(e2[1])}" r="8" fill="${COLORS.axis}"/>
    ${text(e2[0] - len - 4, e2[1] - 8, L.toStar, 'cdx-svg__t cdx-svg__t--muted', 'start')}
    ${text(e2[0] - 44, e2[1] + 44, L.toSun, 'cdx-svg__t', 'end', COLORS.sun)}
    ${text(e2[0] - 14, e2[1] + 30, '≈ 1°', 'cdx-svg__t cdx-svg__t--key', 'start', COLORS.angle)}
    ${text(150, 168, L.siderealDay, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.meridian)}
    ${text(150, 188, L.solarDay, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.sun)}`;
}

/** Ngân Hà trên bản đồ phẳng α–δ: đường xích đạo thiên hà (dữ liệu IAU 1958) và tâm thiên hà. */
function milkyWay(L: DiagramLabels): string {
  const x0 = 30;
  const x1 = 290;
  const y0 = 100;
  const k = 0.95;
  const X = (ra: number) => x0 + ((x1 - x0) * ra) / 360;
  let d = '';
  let prev = -1;
  for (let l = 0; l <= 360; l += 3) {
    const p = galacticToEquatorial(l, 0);
    const jump = prev >= 0 && Math.abs(p.ra - prev) > 180;
    d += `${d === '' || jump ? 'M' : 'L'}${r1(X(p.ra))} ${r1(y0 - p.dec * k)}`;
    prev = p.ra;
  }
  const gc = galacticToEquatorial(0, 0);
  return `
    <rect x="${x0}" y="${y0 - 90 * k}" width="${x1 - x0}" height="${180 * k}" class="cdx-svg__frame"/>
    <path d="${d}" fill="none" stroke="${COLORS.galactic}" stroke-width="16" stroke-opacity=".22" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${COLORS.galactic}" stroke-width="2"/>
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="${COLORS.equator}" stroke-width="2"/>
    <circle cx="${r1(X(gc.ra))}" cy="${r1(y0 - gc.dec * k)}" r="5" fill="${COLORS.galactic}"/>
    ${text(X(gc.ra) - 8, y0 - gc.dec * k + 20, L.galacticCenter, 'cdx-svg__t', 'end')}
    ${text(X(100), y0 - 70, L.milkyWay, 'cdx-svg__t cdx-svg__t--key', 'middle', COLORS.galactic)}
    ${text(x1 - 2, y0 - 6, L.equator, 'cdx-svg__t cdx-svg__t--muted', 'end')}
    ${text(x0 - 4, y0 - 90 * k + 10, '+90°', 'cdx-svg__t cdx-svg__t--muted', 'end')}
    ${text(x0 - 4, y0 + 90 * k, '−90°', 'cdx-svg__t cdx-svg__t--muted', 'end')}
    ${text(x0, 204, '0h', 'cdx-svg__t cdx-svg__t--muted')}
    ${text((x0 + x1) / 2, 204, 'α = 12h', 'cdx-svg__t cdx-svg__t--muted')}
    ${text(x1, 204, '24h', 'cdx-svg__t cdx-svg__t--muted')}`;
}

/** Thang cấp sao: chấm theo cùng quy ước kích thước với ảnh bầu trời; ba sao thật đặt trên thang. */
function magnitude(L: DiagramLabels): string {
  const x0 = 40;
  const x1 = 270;
  const y = 62;
  const X = (m: number) => x0 + ((x1 - x0) * (m + 1.5)) / 6.5;
  const k = 2.2;
  let out = `<line x1="${x0 - 10}" y1="${y + 30}" x2="${x1 + 10}" y2="${y + 30}" class="cdx-svg__tick"/>`;
  for (let m = -1; m <= 5; m++) {
    out += `<circle cx="${r1(X(m))}" cy="${y}" r="${r1(starRadius(m) * k)}" class="cdx-svg__star"/>`;
    out += `<line x1="${r1(X(m))}" y1="${y + 26}" x2="${r1(X(m))}" y2="${y + 34}" class="cdx-svg__tick"/>`;
    out += text(X(m), y + 22 - 30 - starRadius(m) * k + 4, m < 0 ? `−${-m}` : String(m), 'cdx-svg__t cdx-svg__t--muted');
  }
  const data = catalogArrays();
  const named: [string, number][] = [
    ['Sirius', 32349],
    ['Vega', 91262],
    ['Polaris', 11767],
  ];
  named.forEach(([name, hip], i) => {
    const idx = catalogIndexByHip(hip);
    if (idx === undefined) return;
    const m = data.mag[idx];
    const x = X(m);
    const ty = y + 72 + (i % 2) * 16;
    out += `<line x1="${r1(x)}" y1="${y + 30}" x2="${r1(x)}" y2="${ty - 11}" stroke="currentColor" class="cdx-svg__tick"/>`;
    out += text(x, ty, `${name} ${m < 0 ? '−' : ''}${fmtNum(Math.abs(m), 2)}`, 'cdx-svg__t', 'middle');
  });
  out += text(x0 - 10, 16, `← ${L.brighter}`, 'cdx-svg__t cdx-svg__t--key', 'start');
  out += text(x1 + 10, 16, `${L.fainter} →`, 'cdx-svg__t cdx-svg__t--key', 'end');
  return out;
}

/** Thang màu B − V (cùng bảng màu với cảnh), các sao thật đặt theo chỉ số màu đo được. */
function starColor(L: DiagramLabels): string {
  const x0 = 24;
  const x1 = 276;
  const lo = -0.4;
  const hi = 2.0;
  const X = (bv: number) => x0 + ((x1 - x0) * (bv - lo)) / (hi - lo);
  const hex = (bv: number) => {
    const [r, g, b] = bvToRgb(bv);
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  };
  let stops = '';
  for (let bv = lo; bv <= hi + 1e-9; bv += 0.2) stops += `<stop offset="${r1(((bv - lo) / (hi - lo)) * 100)}%" stop-color="${hex(bv)}"/>`;
  const data = catalogArrays();
  const stars: [string, number][] = [
    ['Rigel', 24436],
    ['Sirius', 32349],
    ['Betelgeuse', 27989],
  ];
  const bar = 108;
  let out = `<defs><linearGradient id="cdx-bv" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient></defs>
    <rect x="${x0}" y="${bar}" width="${x1 - x0}" height="14" rx="3" fill="url(#cdx-bv)"/>`;
  for (const v of [0, 0.5, 1, 1.5, 2]) {
    out += `<line x1="${r1(X(v))}" y1="${bar + 14}" x2="${r1(X(v))}" y2="${bar + 20}" class="cdx-svg__tick"/>`;
    out += text(X(v), bar + 34, fmtNum(v, 1), 'cdx-svg__t cdx-svg__t--muted');
  }
  const pts: [string, number][] = stars.flatMap(([n, hip]) => {
    const i = catalogIndexByHip(hip);
    return i === undefined ? [] : [[n, data.bv[i]] as [string, number]];
  });
  pts.push([L.sun, 0.65]);
  pts.sort((a, b) => a[1] - b[1]);
  // Mỗi sao một hàng (tránh chồng nhãn khi hai sao có B − V gần nhau), vạch dóng xuống thang.
  pts.forEach(([n, bv], i) => {
    const x = X(bv);
    const y = 16 + i * 22;
    const left = x > 200;
    out += `<line x1="${r1(x)}" y1="${y + 7}" x2="${r1(x)}" y2="${bar - 2}" class="cdx-svg__tick"/>`;
    out += `<circle cx="${r1(x)}" cy="${y}" r="6.5" fill="${hex(bv)}"/>`;
    out += text(x + (left ? -11 : 11), y + 4, `${n} ${bv < 0 ? '−' : ''}${fmtNum(Math.abs(bv), 2)}`, 'cdx-svg__t', left ? 'end' : 'start');
  });
  out += text(x0, bar + 58, `← ${L.hotter}`, 'cdx-svg__t cdx-svg__t--key', 'start');
  out += text(x1, bar + 58, `${L.cooler} →`, 'cdx-svg__t cdx-svg__t--key', 'end');
  out += text((x0 + x1) / 2, bar + 58, 'B − V', 'cdx-svg__t cdx-svg__t--muted');
  return out;
}

/** Ba loại thiên thể sâu, đúng ký hiệu của cảnh: vòng tròn rỗng theo màu nhóm. */
function deepSky(L: DiagramLabels): string {
  const items: [string, string, string, number][] = [
    [L.galaxy, 'M31', DSO_COLORS.galaxy, 28],
    [L.nebula, 'M42', DSO_COLORS.nebula, 22],
    [L.cluster, 'M45', DSO_COLORS.cluster, 25],
  ];
  return items
    .map(([name, id, col, r], i) => {
      const x = 55 + i * 95;
      const shape =
        i === 0
          ? `<ellipse cx="${x}" cy="62" rx="${r + 8}" ry="${r - 12}" transform="rotate(-30 ${x} 62)" fill="none" stroke="${col}" stroke-width="2"/>`
          : `<circle cx="${x}" cy="62" r="${r}" fill="none" stroke="${col}" stroke-width="2"/>`;
      return `${shape}${text(x, 118, name, 'cdx-svg__t cdx-svg__t--key', 'middle', col)}${text(x, 136, id, 'cdx-svg__t cdx-svg__t--muted')}`;
    })
    .join('');
}

/** Chiều cao khung (viewBox 300 × h) của từng sơ đồ: vừa khít nội dung, không chừa khoảng trống thừa. */
const HEIGHT: Readonly<Record<string, number>> = {
  latPole: 160,
  altaz: 180,
  radec: 185,
  ecliptic: 195,
  sun: 195,
  eqAngle: 160,
  transit: 240,
  seasons: 240,
  diurnal: 230,
  siderealDay: 198,
  milkyWay: 210,
  magnitude: 162,
  starColor: 174,
  deepSky: 145,
  zenith: 222,
};

type Diagram = (L: DiagramLabels, env: DiagramEnv) => string;

const DIAGRAMS: Readonly<Record<string, Diagram>> = {
  sphere,
  horizon,
  zenith,
  pole,
  equator,
  meridian,
  diurnal,
  latPole: (L, env) => latPole(L, env.lat),
  altaz,
  radec,
  vernal,
  hourAngle,
  lst,
  eqAngle,
  circumpolar: (L, env) => zones(L, env.lat),
  riseSetZone: (L, env) => zones(L, env.lat),
  neverRise: (L, env) => zones(L, env.lat),
  transit,
  timeAbove,
  ecliptic: (L) => ecliptic(L),
  seasons,
  siderealDay,
  milkyWay,
  magnitude,
  starColor,
  sun: (L, env) => ecliptic(L, env.sun, `${L.sun} · ${env.sunDate.split('-').reverse().slice(0, 2).join('/')}`),
  deepSky,
};

export const hasDiagram = (id: string): boolean => id in DIAGRAMS;

/** Chuỗi SVG của sơ đồ cho mục `id` (null nếu mục không có sơ đồ). */
export function diagramSvg(id: string, L: DiagramLabels, env: DiagramEnv, caption: string): string | null {
  const f = DIAGRAMS[id];
  if (!f) return null;
  return `<svg class="cdx-svg" viewBox="0 0 300 ${HEIGHT[id] ?? 215}" role="img" aria-label="${esc(caption).replace(/"/g, '&quot;')}">${f(L, env)}</svg>`;
}
