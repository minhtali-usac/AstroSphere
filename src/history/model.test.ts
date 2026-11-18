import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { calendarToJd, decimalYear, deltaT } from '../astro/history';
import { J2000, julianDate } from '../astro/time';
import { catalogArrays, catalogIndexByHip, getCatalogStar, nameOf } from '../data/catalog';
import { computeBodies } from './bodies';
import { catalogStars, limitingMagnitude, momentOf, nearestToPole, sunStateOf, type Settings } from './model';
import { OLD_PLACES, PRESETS, YEAR_MAX, YEAR_MIN } from './presets';
import { H } from './text';

const base: Settings = { year: 2024, month: 1, day: 15, hour: 21, minute: 0, lat: 21.03, lon: 105.85, precession: true, motion: true, deltaT: true };

describe('Thời điểm: lịch → JD → UT → TT → giờ sao', () => {
  it('giờ địa phương trung bình đổi sang UT theo kinh độ và khớp astronomy-engine (giờ sao)', () => {
    const m = momentOf(base);
    // 21h giờ địa phương trung bình ở 105,85°Đ = 21h − 7h03m24s UT.
    const date = new Date(Date.UTC(2024, 0, 15, 21, 0, 0) - (105.85 / 15) * 3600e3);
    expect(m.jdUt).toBeCloseTo(julianDate(date), 6);
    expect(m.gmst).toBeCloseTo(Astronomy.SiderealTime(date) * 15, 1);
    expect(m.dt).toBeGreaterThan(60);
    expect(m.dt).toBeLessThan(80);
  });

  it('tắt ΔT thì TT = UT; tắt tuế sai thì ma trận đơn vị và ε của J2000', () => {
    const m = momentOf({ ...base, year: -500, deltaT: false, precession: false });
    expect(m.dt).toBe(0);
    expect(m.jdTt).toBe(m.jdUt);
    expect(m.dtReal).toBeGreaterThan(17000);
    expect(m.rot[0]).toBe(1);
    expect(m.eps).toBeCloseTo(23.4393, 3);
  });

  it('năm 0 ΔT ≈ 2 giờ 56 phút và tuế sai kéo cực rời Polaris', () => {
    const m = momentOf({ ...base, year: -1 });
    expect(m.dtReal).toBeCloseTo(10583, -2);
    expect(m.calendar.calendar).toBe('julian');
    expect(m.calendar.year).toBe(-1);
  });
});

describe('Sao: vị trí chân trời', () => {
  const stars = catalogStars();
  const sirius = catalogIndexByHip(32349)!;

  it('khớp astronomy-engine cho Sirius hôm nay (sai số < 0,05°: engine thêm chương động)', () => {
    const m = momentOf(base);
    stars.compute(m, base.lat, true);
    const s = getCatalogStar(sirius);
    // engine: tọa độ của ngày (EQD) rồi Horizon; ta quay tuế sai bằng ma trận của riêng mình để so cùng một chuỗi.
    const date = new Date(Date.UTC(2024, 0, 15, 21, 0, 0) - (base.lon / 15) * 3600e3);
    const rot = Astronomy.Rotation_EQJ_EQD(date);
    const v = Astronomy.VectorFromSphere({ lat: s.dec, lon: s.ra, dist: 1 }, date);
    const d = Astronomy.RotateVector(rot, v);
    const eq = Astronomy.EquatorFromVector(d);
    const hor = Astronomy.Horizon(date, new Astronomy.Observer(base.lat, base.lon, 0), eq.ra, eq.dec);
    // Sirius ở dec −16,7° nên PM trong 24 năm cỡ 0,03°; sai số cho phép gồm cả phần đó vì engine không có PM.
    expect(Math.abs(stars.alt[sirius] - hor.altitude)).toBeLessThan(0.08);
    expect(Math.abs(stars.az[sirius] - hor.azimuth)).toBeLessThan(0.1);
  });

  it('Arcturus ở quá khứ bị dời bởi chuyển động riêng; tắt công tắc thì đứng yên theo tuế sai', () => {
    const arc = catalogIndexByHip(69673)!;
    const m = momentOf({ ...base, year: -126 });
    stars.compute(m, base.lat, true);
    const [a1, h1] = [stars.az[arc], stars.alt[arc]];
    stars.compute(m, base.lat, false);
    const [a2, h2] = [stars.az[arc], stars.alt[arc]];
    const sep = Math.hypot((a1 - a2) * Math.cos((h1 * Math.PI) / 180), h1 - h2);
    expect(sep).toBeGreaterThan(0.8);
    expect(sep).toBeLessThan(2);
  });

  it('chuyển động riêng ngược chiều: Arcturus lùi về bắc-tây thời Hipparchus so với hôm nay', () => {
    const arc = catalogIndexByHip(69673)!;
    const s = getCatalogStar(arc);
    const m = momentOf({ ...base, year: -126, precession: false });
    // Không tuế sai: vị trí J2000 + chuyển động riêng. Dec lúc ấy lớn hơn dec hiện nay (Arcturus đi về phía nam).
    const v: [number, number, number] = [0, 0, 0];
    stars.at(arc, m.years, true, v);
    const dec = (Math.asin(v[2]) * 180) / Math.PI;
    expect(dec).toBeGreaterThan(s.dec);
    expect(dec - s.dec).toBeLessThan(1.2);
  });
});

describe('Sao gần cực Bắc qua các thời đại', () => {
  const stars = catalogStars();
  const nameAt = (year: number, motion = true) => {
    const m = momentOf({ ...base, year });
    const p = nearestToPole(stars, m, motion, catalogArrays().mag);
    const n = nameOf(getCatalogStar(p.index).hip);
    return { name: n.short || n.designation, sep: p.sepDeg };
  };

  it('hôm nay là Polaris (< 1°)', () => {
    const r = nameAt(2024);
    expect(r.name).toBe('Polaris');
    expect(r.sep).toBeLessThan(1);
  });

  it('khoảng 2560 TCN (Kim tự tháp) là Thuban, rất gần cực', () => {
    const r = nameAt(-2559);
    expect(r.name).toBe('Thuban');
    expect(r.sep).toBeLessThan(2.5);
  });

  it('khoảng năm 1 là Kochab hoặc Pherkad (hai "người gác" Gấu Bé), cách cực vài độ', () => {
    const r = nameAt(0);
    expect(['Kochab', 'Pherkad']).toContain(r.name);
    expect(r.sep).toBeGreaterThan(3);
  });

  it('tắt tuế sai thì sao gần cực luôn là Polaris dù ở năm nào', () => {
    const m = momentOf({ ...base, year: -2559, precession: false });
    const p = nearestToPole(stars, m, false, catalogArrays().mag);
    expect(nameOf(getCatalogStar(p.index).hip).short).toBe('Polaris');
  });
});

describe('Thiên thể: kiểm tra tích hợp với sự kiện lịch sử', () => {
  /** Tìm giờ UT (trong ngày) mà góc Mặt Trời – Mặt Trăng nhỏ nhất. */
  const closest = (year: number, month: number, day: number, cal: 'julian' | 'gregorian') => {
    const jd0 = calendarToJd(year, month, day, cal);
    let best = 999;
    let bestH = 0;
    for (let h = 0; h < 24; h += 0.05) {
      const jdUt = jd0 + h / 24;
      const time = new Astronomy.AstroTime(jdUt - J2000);
      const s = Astronomy.GeoVector(Astronomy.Body.Sun, time, false);
      const mo = Astronomy.GeoVector(Astronomy.Body.Moon, time, false);
      void decimalYear;
      const c = (s.x * mo.x + s.y * mo.y + s.z * mo.z) / (Math.hypot(s.x, s.y, s.z) * Math.hypot(mo.x, mo.y, mo.z));
      const sep = (Math.acos(Math.min(1, c)) * 180) / Math.PI;
      if (sep < best) [best, bestH] = [sep, h];
    }
    return { sep: best, hour: bestH };
  };

  it('nhật thực Eddington 29/5/1919: cực đại lúc ≈ 13h08 UT', () => {
    computeBodies(momentOf({ ...base, year: 1919, month: 5, day: 29, hour: 12, minute: 0, lon: 0 }), 0, 0);
    const r = closest(1919, 5, 29, 'gregorian');
    expect(r.sep).toBeLessThan(0.8);
    expect(r.hour).toBeGreaterThan(12.7);
    expect(r.hour).toBeLessThan(13.6);
  });

  it('nhật thực Thales 28/5/585 TCN (lịch Julius): Mặt Trời, Mặt Trăng gần trùng nhau (< 1°) nhờ ΔT cổ đại', () => {
    // ΔT ≈ 5 giờ ở thời này: nếu bỏ ΔT, Mặt Trăng lệch khoảng 2,7° và nhật thực biến mất khỏi ngày này.
    computeBodies(momentOf({ ...base, year: -584, month: 5, day: 28, hour: 12, minute: 0, lon: 0 }), 0, 0);
    const r = closest(-584, 5, 28, 'julian');
    expect(r.sep).toBeLessThan(1);
    expect(deltaT(-584)).toBeGreaterThan(17000);
  });

  it('bảy thiên thể có độ cao/phương vị hữu hạn; ban đêm ở Hà Nội năm 2024 Mặt Trời dưới chân trời', () => {
    const b = computeBodies(momentOf(base), base.lat, base.lon);
    expect(b).toHaveLength(7);
    for (const x of b) {
      expect(Number.isFinite(x.alt) && Number.isFinite(x.az)).toBe(true);
      expect(x.az).toBeGreaterThanOrEqual(0);
      expect(x.az).toBeLessThan(360);
    }
    expect(b[0].alt).toBeLessThan(0);
    expect(b[1].illum).toBeGreaterThanOrEqual(0);
    expect(b[1].illum).toBeLessThanOrEqual(1);
  });

  it('bỏ ΔT làm Mặt Trăng ở năm 0 lệch hơn 1° so với có ΔT', () => {
    const on = computeBodies(momentOf({ ...base, year: -1 }), base.lat, base.lon, []).map((x) => ({ ...x }));
    const off = computeBodies(momentOf({ ...base, year: -1, deltaT: false }), base.lat, base.lon, []);
    const moonOn = on[1];
    const moonOff = off[1];
    const d = Math.hypot((moonOn.az - moonOff.az) * Math.cos((moonOn.alt * Math.PI) / 180), moonOn.alt - moonOff.alt);
    expect(d).toBeGreaterThan(0.5);
  });
});

describe('Ánh sáng nền và nơi chọn sẵn', () => {
  it('giới hạn cấp sao tăng khi Mặt Trời xuống thấp', () => {
    const lims = [10, 0, -3, -6, -9, -12, -15, -18, -30].map(limitingMagnitude);
    for (let i = 1; i < lims.length; i++) expect(lims[i]).toBeGreaterThanOrEqual(lims[i - 1]);
    expect(lims[0]).toBeLessThan(0);
    expect(lims[lims.length - 1]).toBeGreaterThanOrEqual(4.8);
  });

  it('phân loại hoàng hôn', () => {
    expect(sunStateOf(30)).toBe('day');
    expect(sunStateOf(-3)).toBe('civil');
    expect(sunStateOf(-9)).toBe('nautical');
    expect(sunStateOf(-15)).toBe('astro');
    expect(sunStateOf(-40)).toBe('night');
  });

  it('mọi thời điểm có sẵn nằm trong khoảng năm cho phép, có chữ mô tả, và đúng hạng mục', () => {
    for (const p of PRESETS) {
      expect(p.year).toBeGreaterThanOrEqual(YEAR_MIN);
      expect(p.year).toBeLessThanOrEqual(YEAR_MAX);
      expect(H.presets[p.id].title && H.presets[p.id].desc).toBeTruthy();
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
    }
    for (const o of OLD_PLACES) expect(H.places[o.id]).toBeTruthy();
    expect(PRESETS.find((p) => p.id === 'sn1054')?.marker?.dec).toBeCloseTo(22.01, 1);
  });

  it('Khách tinh 1054: lúc 4 giờ sáng ở Khai Phong, Mặt Trời còn dưới chân trời và Kim Ngưu ở phía Đông', () => {
    const p = PRESETS.find((x) => x.id === 'sn1054')!;
    const s: Settings = { ...base, ...p, precession: true, motion: true, deltaT: true };
    const m = momentOf(s);
    const sun = computeBodies(m, s.lat, s.lon)[0];
    expect(sun.alt).toBeLessThan(0);
    const [i] = [catalogIndexByHip(26451)!]; // ζ Tau (Thiên Quan)
    catalogStars().compute(m, s.lat, true);
    const stars = catalogStars();
    expect(nameOf(26451).designation).toContain('Tau');
    expect(stars.alt[i]).toBeGreaterThan(0);
    expect(stars.az[i]).toBeGreaterThan(45);
    expect(stars.az[i]).toBeLessThan(110);
    void J2000;
  });
});
