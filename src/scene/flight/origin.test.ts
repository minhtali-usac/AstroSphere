import { describe, expect, it } from 'vitest';
import { AU_KM } from '../../astro/planets';
import { PC_KM } from '../../astro/stellar';
import { f32, sub3, vec3d } from './origin';

describe('Gốc tọa độ trôi', () => {
  // Sai số của vị trí tương đối (vật cách máy ảnh khoảng 1000 km) khi đưa vào GPU 32 bit. Ở 30 AU sai số dưới 2 m.
  // Ở 500 pc (1,5·10¹⁶ km) bước nhỏ nhất của số 64 bit là 2 km, nên sai số dưới 4 km: bằng 1/17 000 bán kính
  // Sao Mộc, không thấy được khi nhìn hành tinh từ khoảng cách 3 bán kính.
  for (const [name, base, tol] of [
    ['30 AU', 30 * AU_KM, 0.002],
    ['500 pc', 500 * PC_KM, 4],
  ] as const) {
    it(`${name}: vị trí tương đối giữ độ chính xác (dưới ${tol} km)`, () => {
      const cam = vec3d(base, base * 0.3, -base * 0.2);
      const body = vec3d(base + 1000.123, base * 0.3 + 250.5, -base * 0.2 - 40.25);
      const rel = sub3(body, cam, vec3d());
      expect(Math.abs(f32(rel[0]) - 1000.123)).toBeLessThan(tol);
      expect(Math.abs(f32(rel[1]) - 250.5)).toBeLessThan(tol);
      // Đối chứng: trừ sau khi đã làm tròn 32 bit thì sai số lớn hơn nhiều (đây là lý do cần gốc trôi).
      expect(Math.abs(f32(body[0]) - f32(cam[0]) - 1000.123)).toBeGreaterThan(1);
    });
  }
});
