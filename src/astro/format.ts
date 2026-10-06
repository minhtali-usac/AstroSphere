// Định dạng số liệu theo kiểu Việt Nam (dấu phẩy thập phân).

import { norm360 } from './math';

/** 21.03 → "21,03" */
export function fmtNum(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '—';
  const s = x.toFixed(digits);
  return (s === `-${(0).toFixed(digits)}` ? s.slice(1) : s).replace('.', ',');
}

/** Cấp sao (và số có thể âm khác): dấu trừ thật U+2212 như các số âm còn lại, không thêm "+": −1,44 · 0,03. */
export function fmtMag(x: number, digits = 2): string {
  const s = fmtNum(x, digits);
  return s.startsWith('-') ? `−${s.slice(1)}` : s;
}

export function fmtDeg(x: number, digits = 2): string {
  return `${fmtNum(x, digits)}°`;
}

/** Độ có dấu: "+21,03°" */
export function fmtDegSigned(x: number, digits = 2): string {
  const s = fmtDeg(Math.abs(x), digits);
  return (x < 0 && fmtNum(Math.abs(x), digits) !== fmtNum(0, digits) ? '−' : '+') + s;
}

/** Vĩ độ: "21,03° B" / "33,87° N" (B = Bắc, N = Nam). */
export function fmtLat(lat: number, digits = 2): string {
  return `${fmtDeg(Math.abs(lat), digits)} ${lat >= 0 ? 'B' : 'N'}`;
}

/** Kinh độ: "105,85° Đ" / "96,70° T" (Đ = Đông, T = Tây). */
export function fmtLon(lon: number, digits = 2): string {
  return `${fmtDeg(Math.abs(lon), digits)} ${lon >= 0 ? 'Đ' : 'T'}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Góc (độ) → giờ "06h 45m 09s" (giữ dấu nếu signed). */
export function fmtHMS(deg: number, opts: { signed?: boolean; seconds?: boolean } = {}): string {
  const { signed = false, seconds = true } = opts;
  const neg = signed && deg < 0;
  let totalSec = Math.round(((signed ? Math.abs(deg) : norm360(deg)) / 15) * 3600);
  if (!seconds) totalSec = Math.round(totalSec / 60) * 60;
  if (!signed) totalSec %= 86400;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const sign = signed ? (neg && totalSec > 0 ? '−' : '+') : '';
  return seconds ? `${sign}${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${sign}${pad(h)}h ${pad(m)}m`;
}

/** Số giờ thập phân → "13h 42m". */
export function fmtDuration(hours: number): string {
  let total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  total -= h * 60;
  return `${h}h ${pad(total)}m`;
}

/** Độ → "+16° 42′ 58″" */
export function fmtDMS(deg: number): string {
  const neg = deg < 0;
  let totalSec = Math.round(Math.abs(deg) * 3600);
  const d = Math.floor(totalSec / 3600);
  totalSec -= d * 3600;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${neg && (d || m || s) ? '−' : '+'}${d}° ${pad(m)}′ ${pad(s)}″`;
}

/** Đọc số kiểu Việt Nam hoặc quốc tế: "21,03" hoặc "21.03". */
export function parseNum(s: string): number {
  const t = s.trim().replace(/\s+/g, '').replace(',', '.').replace('−', '-');
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}

/**
 * Đọc xích kinh theo giờ: "6,75" · "6.75" · "6h45m" · "6h 45m 09s" · "6:45:09". Trả về giờ thập phân hoặc NaN.
 */
export function parseHours(s: string): number {
  const t = s.trim().toLowerCase().replace(/,/g, '.');
  if (t === '') return NaN;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(?:h|:|\s)\s*(?:(\d+(?:\.\d+)?)\s*(?:m|:|\s)?\s*(?:(\d+(?:\.\d+)?)\s*s?)?)?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = m[2] ? Number(m[2]) : 0;
    const ss = m[3] ? Number(m[3]) : 0;
    if (mm >= 60 || ss >= 60) return NaN;
    return hh + mm / 60 + ss / 3600;
  }
  return parseNum(s);
}

/** Đọc góc theo độ: "−16,7" · "-16°42′58″" · "-16 42 58" · "+16d42m". Trả về độ thập phân hoặc NaN. */
export function parseDegrees(s: string): number {
  const t = s.trim().replace(/,/g, '.').replace(/[−–]/g, '-');
  if (t === '') return NaN;
  const m = t.match(/^([-+]?)(\d+(?:\.\d+)?)\s*(?:°|d|\s)\s*(?:(\d+(?:\.\d+)?)\s*(?:′|'|m|\s)?\s*(?:(\d+(?:\.\d+)?)\s*(?:″|"|s)?)?)?$/i);
  if (m) {
    const d = Number(m[2]);
    const mm = m[3] ? Number(m[3]) : 0;
    const ss = m[4] ? Number(m[4]) : 0;
    if (mm >= 60 || ss >= 60) return NaN;
    const v = d + mm / 60 + ss / 3600;
    return m[1] === '-' ? -v : v;
  }
  return parseNum(t);
}
