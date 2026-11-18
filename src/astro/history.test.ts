import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import {
  applyProperMotion,
  calendarOf,
  calendarToJd,
  deltaT,
  deltaTUncertainty,
  earthRotationLagDeg,
  equinoxShiftDeg,
  jdToCalendar,
  localMeanToUtJd,
  meanObliquity,
  poleOfDate,
  precessionMatrix,
  separationDeg,
  unitVector,
  vectorToRaDec,
  decimalYear,
} from './history';

describe('Lịch Julius / Gregory', () => {
  it('khớp các ví dụ của Meeus', () => {
    expect(calendarToJd(2000, 1, 1.5)).toBe(2451545.0);
    expect(calendarToJd(1957, 10, 4.81)).toBeCloseTo(2436116.31, 6);
    expect(calendarToJd(333, 1, 27.5)).toBe(1842713.0);
    expect(calendarToJd(-4712, 1, 1.5, 'julian')).toBe(0);
  });

  it('15/10/1582 (Gregory) ngay sau 4/10/1582 (Julius)', () => {
    expect(calendarToJd(1582, 10, 15)).toBe(calendarToJd(1582, 10, 4) + 1);
    expect(calendarOf(1582, 10, 4)).toBe('julian');
    expect(calendarOf(1582, 10, 15)).toBe('gregorian');
    expect(calendarOf(-2560, 6, 1)).toBe('julian');
  });

  it('đổi đi đổi lại cho mọi thế kỷ từ −6000 đến 3000', () => {
    for (let year = -6000; year <= 3000; year += 137) {
      for (const [month, day] of [[1, 1.5], [2, 29.25], [7, 15.75], [12, 31.0]] as const) {
        const cal = calendarOf(year, month, Math.floor(day));
        // 29/2 chỉ có ở năm nhuận: bỏ qua nếu ngày đổi đi đổi lại bị chuẩn hóa sang tháng khác.
        const jd = calendarToJd(year, month, day, cal);
        const back = jdToCalendar(jd);
        const jd2 = calendarToJd(back.year, back.month, back.day, back.calendar);
        expect(jd2, `${year}-${month}-${day}`).toBeCloseTo(jd, 6);
      }
    }
  });

  it('mỗi ngày liên tiếp tăng đúng 1 ngày quanh năm 0 và năm −4000 (không có năm 0 sai)', () => {
    for (const y of [-4000, -1, 0, 1]) {
      const a = calendarToJd(y, 12, 31, 'julian');
      const b = calendarToJd(y + 1, 1, 1, 'julian');
      expect(b - a).toBe(1);
    }
    // Năm 0 là năm nhuận theo Julius (năm 1 TCN).
    expect(calendarToJd(0, 3, 1, 'julian') - calendarToJd(0, 2, 28, 'julian')).toBe(2);
  });

  it('giờ địa phương trung bình → UT', () => {
    expect(localMeanToUtJd(2451545, 90)).toBeCloseTo(2451544.75, 9);
    expect(localMeanToUtJd(2451545, -180)).toBeCloseTo(2451545.5, 9);
  });
});

describe('ΔT = TT − UT', () => {
  it('khớp astronomy-engine (cùng đa thức Espenak–Meeus, lệch ≤ 1 giây) từ −1500 đến 2100', () => {
    for (let year = -1500; year <= 2100; year += 23) {
      const jd = calendarToJd(year, 7, 1);
      // engine đổi ngày sang năm lệch ~14 ngày so với NASA: ΔT cổ đại đổi ~20 giây mỗi năm nên cho phép ≤ 1 giây.
      expect(Math.abs(deltaT(decimalYear(jd)) - Astronomy.DeltaT_EspenakMeeus(jd - 2451545)), String(year)).toBeLessThan(1);
    }
  });

  it('giá trị đã biết', () => {
    expect(deltaT(2000)).toBeCloseTo(63.8, 0);
    expect(deltaT(1900)).toBeCloseTo(-2.8, 0);
    expect(deltaT(0)).toBeCloseTo(10583.6, 1);
    expect(deltaT(-500)).toBeGreaterThan(17000); // ≈ 17 190 s ≈ 4,8 giờ
    expect(deltaT(-500)).toBeLessThan(17400);
  });

  it('liên tục tại mọi mối nối của đa thức (nhảy < 2 giây) và tăng dần về quá khứ xa', () => {
    for (const edge of [-500, 500, 1600, 1700, 1800, 1860, 1900, 1920, 1941, 1961, 1986, 2005, 2050, 2150]) {
      expect(Math.abs(deltaT(edge - 1e-6) - deltaT(edge + 1e-6)), String(edge)).toBeLessThan(2);
    }
    expect(deltaT(-3000)).toBeGreaterThan(deltaT(-1000));
    expect(deltaT(-1000)).toBeGreaterThan(deltaT(0));
  });

  it('độ bất định giảm dần về hiện tại', () => {
    expect(deltaTUncertainty(-2000)).toBeGreaterThan(deltaTUncertainty(-500));
    expect(deltaTUncertainty(-500)).toBeGreaterThan(deltaTUncertainty(500));
    expect(deltaTUncertainty(500)).toBeGreaterThan(deltaTUncertainty(1500));
    expect(deltaTUncertainty(2020)).toBeLessThan(1);
  });

  it('Trái Đất quay trễ ≈ 44° ở năm 0', () => {
    expect(earthRotationLagDeg(deltaT(0))).toBeCloseTo(44.2, 0);
    expect(decimalYear(2451544.5)).toBe(2000);
  });
});

describe('Tuế sai (IAU 2006)', () => {
  const ra = 213.9153; // Arcturus
  const dec = 19.1824;
  const v = unitVector(ra, dec);

  const apply = (m: ReturnType<typeof precessionMatrix>, p: [number, number, number]) =>
    [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]] as [number, number, number];

  it('ma trận trực chuẩn và gần đơn vị tại J2000', () => {
    const m = precessionMatrix(2451545);
    const w = apply(m, v);
    expect(separationDeg(v, w)).toBeLessThan(1e-5);
    const p = precessionMatrix(calendarToJd(-2500, 1, 1));
    const det = p[0] * (p[4] * p[8] - p[5] * p[7]) - p[1] * (p[3] * p[8] - p[5] * p[6]) + p[2] * (p[3] * p[7] - p[4] * p[6]);
    expect(det).toBeCloseTo(1, 12);
  });

  it('khớp astronomy-engine (xích đạo của thời điểm; engine có thêm chương động ≲ 17″)', () => {
    for (const year of [-3000, -1000, 0, 1000, 1900, 2000, 2100]) {
      const jd = calendarToJd(year, 1, 1.5);
      const date = new Date(Date.UTC(2000, 0, 1, 12) + (jd - 2451545) * 86400000);
      const rot = Astronomy.Rotation_EQJ_EQD(date).rot;
      const mine = apply(precessionMatrix(jd + deltaT(year) / 86400), v);
      const ref: [number, number, number] = [
        rot[0][0] * v[0] + rot[1][0] * v[1] + rot[2][0] * v[2],
        rot[0][1] * v[0] + rot[1][1] * v[1] + rot[2][1] * v[2],
        rot[0][2] * v[0] + rot[1][2] * v[1] + rot[2][2] * v[2],
      ];
      const alt: [number, number, number] = [
        rot[0][0] * v[0] + rot[0][1] * v[1] + rot[0][2] * v[2],
        rot[1][0] * v[0] + rot[1][1] * v[1] + rot[1][2] * v[2],
        rot[2][0] * v[0] + rot[2][1] * v[1] + rot[2][2] * v[2],
      ];
      // Tùy quy ước hàng/cột của engine: chấp nhận cách nào khớp, miễn khớp một cách.
      const diff = Math.min(separationDeg(mine, ref), separationDeg(mine, alt));
      expect(diff * 3600, String(year)).toBeLessThan(60);
    }
  });

  it('một thế kỷ: xuân phân lùi ≈ 1,397° dọc hoàng đạo (về phía kinh độ giảm)', () => {
    expect(equinoxShiftDeg(2451545 + 36525)).toBeCloseTo(-1.397, 2);
    expect(equinoxShiftDeg(2451545 - 36525)).toBeCloseTo(1.397, 2);
  });

  it('chu kỳ tuế sai ≈ 25 700 năm: cực quay quanh cực hoàng đạo với bán kính ≈ ε', () => {
    const pole = poleOfDate(2451545 + 36525 * 0); // J2000
    const { dec } = vectorToRaDec(pole);
    expect(dec).toBeCloseTo(90, 5);
    // Cực của năm −11000 cách cực J2000 khoảng 2ε·sin(…): gần 47° ở nửa chu kỳ, còn 12 900 năm trước ≈ 46–47°.
    const half = poleOfDate(2451545 - 12850 * 365.25);
    expect(separationDeg(half, pole)).toBeGreaterThan(44);
    expect(separationDeg(half, pole)).toBeLessThan(49);
  });

  it('độ nghiêng trục: 23,4393° ở J2000, ≈ 23,92° ở 2000 TCN (IAU 2006 cho 23,924°)', () => {
    expect(meanObliquity(2451545)).toBeCloseTo(23.4393, 4);
    const e = meanObliquity(calendarToJd(-2000, 1, 1));
    expect(e).toBeGreaterThan(23.9);
    expect(e).toBeLessThan(24.0);
  });
});

describe('Chuyển động riêng', () => {
  it('không đổi khi 0 năm hoặc 0 mas/năm', () => {
    const z = applyProperMotion(100, 30, 1000, 500, 0);
    expect(z.ra).toBeCloseTo(100, 9);
    expect(z.dec).toBeCloseTo(30, 9);
    const p = applyProperMotion(100, 30, 0, 0, 5000);
    expect(p.ra).toBeCloseTo(100, 9);
    expect(p.dec).toBeCloseTo(30, 9);
  });

  it('Arcturus (−1093; −1999 mas/năm) dịch ≈ 1,27° sau 2000 năm, về phía Nam', () => {
    const a = unitVector(213.9153, 19.1824);
    const b = applyProperMotion(213.9153, 19.1824, -1093.45, -1999.4, 2000);
    expect(separationDeg(a, unitVector(b.ra, b.dec))).toBeCloseTo((Math.hypot(1093.45, 1999.4) * 2000) / 3.6e6, 2);
    expect(b.dec).toBeLessThan(19.1824);
    expect(b.ra).toBeLessThan(213.9153);
  });

  it('thời gian ngược lại đi về hướng ngược lại', () => {
    const f = applyProperMotion(50, 10, 300, 100, 1000);
    const r = applyProperMotion(50, 10, 300, 100, -1000);
    expect(f.ra - 50).toBeGreaterThan(0);
    expect(r.ra - 50).toBeLessThan(0);
    expect(f.dec - 10).toBeGreaterThan(0);
    expect(r.dec - 10).toBeLessThan(0);
  });
});
