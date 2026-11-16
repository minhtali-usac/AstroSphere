import { describe, expect, it } from 'vitest';
import { blackbodyRgb, bolometricCorrection, bvToTeff, equilibriumTemp, mulberry32, planetClass, seedOf, starPhysics } from './stellar';

describe('Tính chất sao suy ra từ số liệu', () => {
  it('Mặt Trời (B−V = 0,65) có T ≈ 5800 K ± 3 %', () => {
    expect(Math.abs(bvToTeff(0.65) / 5800 - 1)).toBeLessThan(0.03);
  });

  it('BC_V của Mặt Trời ≈ −0,07', () => {
    expect(bolometricCorrection(5772)).toBeCloseTo(-0.07, 1);
  });

  // Giá trị đối chiếu (bán kính, lần Mặt Trời): Sirius A 1,71 (Liebert 2005), Vega 2,36–2,82 (Aufdenberg 2006,
  // dẹt do quay nhanh), Betelgeuse ≈ 764 (Joyce 2020). Cấp sao, B−V, thị sai theo danh mục của ứng dụng / Hipparcos 2007.
  // Betelgeuse lệch nhiều hơn (≈ 0,66×): công thức Ballesteros cho B−V = 1,5 ra 3790 K, trong khi đo được ≈ 3600 K;
  // sao siêu khổng lồ đỏ nằm ngoài vùng khớp tốt nhất của công thức. Ngưỡng ×1,6 cho trường hợp này là có chủ ý.
  const cases: [string, number, number, number, number, number][] = [
    ['Sirius', -1.44, 0.01, 379.21, 1.71, 1.5],
    ['Vega', 0.03, 0.0, 130.23, 2.6, 1.5],
    ['Betelgeuse', 0.45, 1.5, 6.55, 764, 1.6],
  ];
  for (const [name, mag, bv, plx, ref, tol] of cases) {
    it(`${name}: bán kính ước tính trong khoảng ×${tol} so với giá trị công bố`, () => {
      const r = starPhysics(mag, bv, plx).radius;
      expect(r / ref).toBeGreaterThan(1 / tol);
      expect(r / ref).toBeLessThan(tol);
    });
  }

  it('Trái Đất: T_eq ≈ 255 K với suất phản chiếu 0,3', () => {
    expect(equilibriumTemp(5772, 1, 1)).toBeGreaterThan(250);
    expect(equilibriumTemp(5772, 1, 1)).toBeLessThan(260);
  });

  it('Phân loại hành tinh theo bán kính, rồi theo khối lượng', () => {
    expect(planetClass(1, 1)).toBe('rocky');
    expect(planetClass(2.2, null)).toBe('subNeptune');
    expect(planetClass(3.9, 17)).toBe('subNeptune');
    expect(planetClass(11.2, 318)).toBe('gasGiant');
    expect(planetClass(null, 1.8)).toBe('rocky');
    expect(planetClass(null, 2000)).toBe('gasGiant');
  });

  it('Màu vật đen: sao lạnh đỏ hơn, sao nóng xanh hơn', () => {
    const cool = blackbodyRgb(3300);
    const hot = blackbodyRgb(10000);
    expect(cool[0]).toBeGreaterThan(cool[2]);
    expect(hot[2]).toBeGreaterThan(cool[2]);
  });

  it('Hạt giống ổn định: cùng chuỗi cho cùng dãy số', () => {
    expect(seedOf('mars')).toBe(seedOf('mars'));
    expect(seedOf('mars')).not.toBe(seedOf('venus'));
    const a = mulberry32(seedOf('eps Eri b'));
    const b = mulberry32(seedOf('eps Eri b'));
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
});
