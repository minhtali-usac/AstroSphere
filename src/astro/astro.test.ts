import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import {
  angleDiff,
  classify,
  equatorialToHorizontal,
  equatorialToHorizontalInto,
  equatorialToHorizontalViaMatrix,
  equatorialToHorizonMatrix,
  equatorInclination,
  eclipticToEquatorial,
  equatorialToEcliptic,
  equatorialToGalactic,
  galacticToEquatorial,
  gmstDeg,
  horizontalToEquatorial,
  julianDate,
  localSiderealDeg,
  mat3Det,
  poleAltitude,
  riseSet,
  sunPosition,
  hourAngleToHorizontal,
  SIDEREAL_DAY_SECONDS,
  fmtHMS,
  fmtLat,
  fmtMag,
  fmtNum,
  parseNum,
  parseHours,
  parseDegrees,
  zoneLimits,
} from './index';

// Bộ sinh số giả ngẫu nhiên có hạt giống để test lặp lại được.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('Thời gian thiên văn', () => {
  it('GMST tại J2000.0 = 280,46061837°', () => {
    expect(gmstDeg(2451545.0)).toBeCloseTo(280.46061837, 8);
  });

  it('Ví dụ Meeus 12.a: 10/4/1987 0h UT → GMST = 13h10m46,3668s', () => {
    const jd = julianDate(new Date(Date.UTC(1987, 3, 10, 0, 0, 0)));
    const expected = (13 + 10 / 60 + 46.3668 / 3600) * 15;
    expect(gmstDeg(jd)).toBeCloseTo(expected, 4);
  });

  it('Ví dụ Meeus 12.b: 10/4/1987 19h21m UT → GMST = 8h34m57,0896s', () => {
    const jd = julianDate(new Date(Date.UTC(1987, 3, 10, 19, 21, 0)));
    const expected = (8 + 34 / 60 + 57.0896 / 3600) * 15;
    expect(gmstDeg(jd)).toBeCloseTo(expected, 4);
  });

  it('Ngày thiên văn = 23h 56m 04s (không phải 24h)', () => {
    expect(Math.floor(SIDEREAL_DAY_SECONDS)).toBe(23 * 3600 + 56 * 60 + 4);
    // Sau đúng một ngày thiên văn, GMST quay lại giá trị cũ.
    const jd0 = 2460000.3;
    const jd1 = jd0 + SIDEREAL_DAY_SECONDS / 86400;
    expect(angleDiff(gmstDeg(jd0), gmstDeg(jd1))).toBeLessThan(1e-3);
  });

  it('Khớp với astronomy-engine (sai khác chỉ do phương trình phân điểm, < 0,01°)', () => {
    const r = rng(7);
    for (let i = 0; i < 50; i++) {
      const date = new Date(Date.UTC(1980 + Math.floor(r() * 60), Math.floor(r() * 12), 1 + Math.floor(r() * 28), r() * 24));
      const gast = Astronomy.SiderealTime(date) * 15;
      expect(angleDiff(gmstDeg(julianDate(date)), gast)).toBeLessThan(0.01);
    }
  });

  it('LST = GST + λ', () => {
    expect(localSiderealDeg(100, 105.85)).toBeCloseTo(205.85, 10);
    expect(localSiderealDeg(10, -96.7)).toBeCloseTo(273.3, 10);
  });
});

describe('Hệ xích đạo ↔ hệ chân trời', () => {
  it('Ví dụ Meeus 13.b (Sao Kim nhìn từ Washington)', () => {
    const ra = (23 + 9 / 60 + 16.641 / 3600) * 15;
    const dec = -(6 + 43 / 60 + 11.61 / 3600);
    const lat = 38 + 55 / 60 + 17 / 3600;
    const lon = -(77 + 3 / 60 + 56 / 3600);
    const gast = (8 + 34 / 60 + 56.853 / 3600) * 15;
    const { alt, az, ha } = equatorialToHorizontal(ra, dec, lat, localSiderealDeg(gast, lon));
    // Meeus làm tròn trung gian nên chỉ so tới 0,001°.
    expect(ha).toBeCloseTo(64.352133, 3);
    expect(alt).toBeCloseTo(15.1249, 3);
    // Meeus đo phương vị từ Nam (68,0337°); quy ước ở đây đo từ Bắc → 248,0337°.
    expect(az).toBeCloseTo(248.0337, 3);
  });

  it('Biến đổi ngược trả về đúng (α, δ)', () => {
    const r = rng(11);
    for (let i = 0; i < 500; i++) {
      const ra = r() * 360;
      const dec = r() * 178 - 89;
      const lat = r() * 178 - 89;
      const lst = r() * 360;
      const h = equatorialToHorizontal(ra, dec, lat, lst);
      const e = horizontalToEquatorial(h.alt, h.az, lat, lst);
      expect(angleDiff(e.ra, ra) * Math.cos((dec * Math.PI) / 180)).toBeLessThan(1e-8);
      expect(Math.abs(e.dec - dec)).toBeLessThan(1e-8);
    }
  });

  it('Ma trận quay (dùng cho 3D) trùng với công thức lượng giác → hai khung nhìn luôn đồng bộ', () => {
    const r = rng(3);
    for (let i = 0; i < 500; i++) {
      const ra = r() * 360;
      const dec = r() * 180 - 90;
      const lat = r() * 180 - 90;
      const lst = r() * 360;
      const a = equatorialToHorizontal(ra, dec, lat, lst);
      const b = equatorialToHorizontalViaMatrix(ra, dec, lat, lst);
      expect(Math.abs(a.alt - b.alt)).toBeLessThan(1e-9);
      if (Math.abs(a.alt) < 89.999) expect(angleDiff(a.az, b.az)).toBeLessThan(1e-7);
    }
    // Hệ (Bắc, Đông, Thiên đỉnh) là hệ tay trái nên định thức = −1; phép ánh xạ sang 3D bù lại dấu này.
    expect(mat3Det(equatorialToHorizonMatrix(21.03, 123))).toBeCloseTo(-1, 12);
  });

  it('equatorialToHorizontalInto trùng equatorialToHorizontal và ghi vào cùng đối tượng', () => {
    const r = rng(11);
    const out = { alt: 0, az: 0 };
    for (let i = 0; i < 300; i++) {
      const ra = r() * 360;
      const dec = r() * 180 - 90;
      const lat = r() * 180 - 90;
      const lst = r() * 360;
      const a = equatorialToHorizontal(ra, dec, lat, lst);
      expect(equatorialToHorizontalInto(ra, dec, lat, lst, out)).toBe(out);
      expect(out.alt).toBe(a.alt);
      expect(out.az).toBe(a.az);
    }
  });

  it('Tiêu chí 5: sai số A, h so với astronomy-engine < 0,1°', () => {
    const r = rng(2026);
    let maxErr = 0;
    for (let i = 0; i < 300; i++) {
      const date = new Date(Date.UTC(2000 + Math.floor(r() * 40), Math.floor(r() * 12), 1 + Math.floor(r() * 28), r() * 24, r() * 60));
      const lat = r() * 170 - 85;
      const lon = r() * 360 - 180;
      const raH = r() * 24;
      const dec = r() * 170 - 85;
      const ref = Astronomy.Horizon(date, new Astronomy.Observer(lat, lon, 0), raH, dec);
      const lst = localSiderealDeg(gmstDeg(julianDate(date)), lon);
      const ours = equatorialToHorizontal(raH * 15, dec, lat, lst);
      const errAlt = Math.abs(ours.alt - ref.altitude);
      // Sai số phương vị quy về góc trên bầu trời (nhân cos h).
      const errAz = angleDiff(ours.az, ref.azimuth) * Math.cos((ours.alt * Math.PI) / 180);
      maxErr = Math.max(maxErr, errAlt, errAz);
    }
    expect(maxErr).toBeLessThan(0.1);
  });
});

describe('Tiêu chí nghiệm thu 1–3', () => {
  it('1. Ở φ = 21,03° B: thiên cực Bắc cao 21,03°, xích đạo trời nghiêng 68,97°', () => {
    const lat = 21.03;
    expect(poleAltitude(lat)).toBeCloseTo(21.03, 10);
    expect(equatorInclination(lat)).toBeCloseTo(68.97, 10);
    // Kiểm tra trực tiếp bằng phép biến đổi tọa độ: điểm δ = 90° có độ cao φ, phương vị Bắc.
    for (const lst of [0, 77, 200]) {
      const p = equatorialToHorizontal(0, 90, lat, lst);
      expect(p.alt).toBeCloseTo(21.03, 9);
      expect(angleDiff(p.az, 0)).toBeLessThan(1e-6);
    }
    // Điểm cao nhất của xích đạo trời (H = 0, δ = 0) có độ cao 90° − φ ở hướng Nam.
    const top = hourAngleToHorizontal(0, 0, lat);
    expect(top.alt).toBeCloseTo(68.97, 9);
    expect(top.az).toBeCloseTo(180, 9);
  });

  it('2. Ở φ = 90°: mọi sao δ > 0 đều cận cực; ở φ = 0: không có sao cận cực', () => {
    for (let dec = 0.5; dec < 90; dec += 0.5) expect(classify(dec, 90)).toBe('circumpolar');
    for (let dec = -89.5; dec < 0; dec += 0.5) expect(classify(dec, 90)).toBe('neverRise');
    for (let dec = -89.5; dec <= 89.5; dec += 0.5) expect(classify(dec, 0)).toBe('riseSet');
    // Đối xứng ở Nam bán cầu
    for (let dec = -89.5; dec < 0; dec += 0.5) expect(classify(dec, -90)).toBe('circumpolar');
  });

  it('3. Sao có δ = 0° mọc đúng hướng Đông, lặn đúng hướng Tây ở mọi vĩ độ (trừ hai cực)', () => {
    for (let lat = -89; lat <= 89; lat += 1) {
      const rs = riseSet(0, 0, lat);
      expect(rs.visibility).toBe('riseSet');
      expect(rs.h0).toBeCloseTo(90, 9);
      expect(rs.riseAz).toBeCloseTo(90, 9);
      expect(rs.setAz).toBeCloseTo(270, 9);
      // Kiểm tra bằng phép biến đổi tọa độ thực: tại H = ∓H₀ sao ở đúng chân trời.
      const rise = hourAngleToHorizontal(-rs.h0, 0, lat);
      const set = hourAngleToHorizontal(rs.h0, 0, lat);
      expect(Math.abs(rise.alt)).toBeLessThan(1e-9);
      expect(rise.az).toBeCloseTo(90, 9);
      expect(set.az).toBeCloseTo(270, 9);
    }
  });
});

describe('Mọc – lặn', () => {
  it('cos H₀ = −tan φ · tan δ; thời gian trên chân trời = 2H₀/15', () => {
    const rs = riseSet(0, 30, 21.03);
    const h0 = (Math.acos(-Math.tan((21.03 * Math.PI) / 180) * Math.tan(Math.PI / 6)) * 180) / Math.PI;
    expect(rs.h0).toBeCloseTo(h0, 10);
    expect(rs.hoursAbove).toBeCloseTo((2 * h0) / 15, 10);
    expect(rs.hoursAbove).toBeGreaterThan(13.5);
    expect(rs.hoursAbove).toBeLessThan(13.9);
  });

  it('Tại H = ±H₀ độ cao bằng 0 và phương vị khớp với công thức', () => {
    const r = rng(5);
    for (let i = 0; i < 300; i++) {
      const lat = r() * 170 - 85;
      const dec = r() * 170 - 85;
      const rs = riseSet(0, dec, lat);
      if (rs.visibility !== 'riseSet') continue;
      const rise = hourAngleToHorizontal(-rs.h0, dec, lat);
      const set = hourAngleToHorizontal(rs.h0, dec, lat);
      expect(Math.abs(rise.alt)).toBeLessThan(1e-7);
      expect(Math.abs(set.alt)).toBeLessThan(1e-7);
      expect(angleDiff(rise.az, rs.riseAz)).toBeLessThan(1e-6);
      expect(angleDiff(set.az, rs.setAz)).toBeLessThan(1e-6);
    }
  });

  it('Phân loại khớp với độ cao cực đại/cực tiểu thực tế', () => {
    const r = rng(9);
    for (let i = 0; i < 400; i++) {
      const lat = r() * 178 - 89;
      const dec = r() * 178 - 89;
      const upper = hourAngleToHorizontal(0, dec, lat).alt;
      const lower = hourAngleToHorizontal(180, dec, lat).alt;
      const v = classify(dec, lat);
      if (v === 'circumpolar') expect(lower).toBeGreaterThan(-1e-9);
      if (v === 'neverRise') expect(upper).toBeLessThan(1e-9);
      if (v === 'riseSet') {
        expect(upper).toBeGreaterThanOrEqual(-1e-9);
        expect(lower).toBeLessThanOrEqual(1e-9);
      }
      const rs = riseSet(0, dec, lat);
      expect(rs.upperAlt).toBeCloseTo(upper, 8);
      expect(rs.lowerAlt).toBeCloseTo(lower, 8);
    }
  });

  it('Giới hạn vùng đối xứng giữa hai bán cầu', () => {
    expect(zoneLimits(21.03).circumpolar[0]).toBeCloseTo(68.97, 10);
    expect(zoneLimits(-33.87).circumpolar[1]).toBeCloseTo(-56.13, 10);
    expect(zoneLimits(-33.87).neverRise[0]).toBeCloseTo(56.13, 10);
  });
});

describe('Mở rộng: hoàng đạo, Mặt Trời, thiên hà', () => {
  it('Hoàng đạo ↔ xích đạo khứ hồi; điểm hạ chí có δ = ε', () => {
    const p = eclipticToEquatorial(90, 0);
    expect(p.ra).toBeCloseTo(90, 9);
    expect(p.dec).toBeCloseTo(23.4393, 9);
    const r = rng(1);
    for (let i = 0; i < 200; i++) {
      const l = r() * 360;
      const b = r() * 160 - 80;
      const e = eclipticToEquatorial(l, b);
      const back = equatorialToEcliptic(e.ra, e.dec);
      expect(angleDiff(back.lambda, l)).toBeLessThan(1e-8);
      expect(back.beta).toBeCloseTo(b, 8);
    }
  });

  it('Vị trí Mặt Trời khớp astronomy-engine trong 0,05°', () => {
    const r = rng(42);
    for (let i = 0; i < 60; i++) {
      const date = new Date(Date.UTC(2000 + Math.floor(r() * 40), Math.floor(r() * 12), 1 + Math.floor(r() * 28), 12));
      const ours = sunPosition(julianDate(date));
      const ref = Astronomy.Equator(Astronomy.Body.Sun, date, new Astronomy.Observer(0, 0, 0), true, true);
      expect(angleDiff(ours.ra, ref.ra * 15) * Math.cos((ours.dec * Math.PI) / 180)).toBeLessThan(0.05);
      expect(Math.abs(ours.dec - ref.dec)).toBeLessThan(0.05);
    }
  });

  it('Tâm thiên hà (l = 0, b = 0) ở α ≈ 266,40°, δ ≈ −28,94°', () => {
    const c = galacticToEquatorial(0, 0);
    expect(c.ra).toBeCloseTo(266.405, 2);
    expect(c.dec).toBeCloseTo(-28.936, 2);
    const back = equatorialToGalactic(c.ra, c.dec);
    expect(angleDiff(back.l, 0)).toBeLessThan(1e-8);
    expect(back.b).toBeCloseTo(0, 8);
  });
});

describe('Định dạng tiếng Việt', () => {
  it('dùng dấu phẩy thập phân và ký hiệu B/N, Đ/T', () => {
    expect(fmtNum(21.03)).toBe('21,03');
    expect(fmtLat(-33.87)).toBe('33,87° N');
    expect(fmtHMS(101.2872)).toBe('06h 45m 09s');
    expect(parseNum('105,85')).toBeCloseTo(105.85, 10);
    expect(parseNum('abc')).toBeNaN();
  });

  it('cấp sao âm dùng dấu trừ thật (U+2212), không dùng gạch nối', () => {
    expect(fmtMag(-1.44)).toBe('−1,44');
    expect(fmtMag(-1.44)).not.toContain('-');
    expect(fmtMag(0.03)).toBe('0,03');
    expect(fmtMag(-0.001)).toBe('0,00');
    expect(fmtMag(-26.74, 1)).toBe('−26,7');
    expect(fmtMag(NaN)).toBe('—');
  });

  it('đọc được xích kinh và xích vĩ nhập theo nhiều cách', () => {
    expect(parseHours('6,75')).toBeCloseTo(6.75, 10);
    expect(parseHours('6h45m')).toBeCloseTo(6.75, 10);
    expect(parseHours('6h 45m 36s')).toBeCloseTo(6.76, 10);
    expect(parseHours('6:45')).toBeCloseTo(6.75, 10);
    expect(parseHours('6h75m')).toBeNaN();
    expect(parseDegrees('-16,7')).toBeCloseTo(-16.7, 10);
    expect(parseDegrees('−16°42′')).toBeCloseTo(-16.7, 10);
    expect(parseDegrees('+89 15 51')).toBeCloseTo(89 + 15 / 60 + 51 / 3600, 10);
    expect(parseDegrees('xyz')).toBeNaN();
  });
});
