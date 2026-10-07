import { describe, expect, it } from 'vitest';
import strings from '../i18n/games.vi.json';
import { MODEL_ANSWER, PTOLEMY } from './gModels';
import { litPath, MOON_TOLERANCE, phaseIndex } from './gMoon';
import { POLARIS_TOLERANCE, ruler, rulerRatio } from './gPolaris';
import { SPOTS } from './gSeasons';
import { PLANETS } from './gSolar';
import { LAT, riseHa, sunAltAz } from './gSunPath';
import { elongation, maxElongation, ORBIT } from './gVenus';
import { DEFAULT_SGK, GAME_IDS, isSgkState } from './progress';
import { CAS, DIPPER, POLARIS, UMI, project } from './sky';
import { num } from './text';

function all(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => all(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => all(x, out));
  return out;
}

describe('Thử thách SGK: nội dung (games.vi.json)', () => {
  it('không có từ tiếng Anh thông dụng trong chữ hiển thị', () => {
    const english = /\b(the|and|reset|help|about|start|pause|stop|speed|show|hide|stars?|trail|north|south|east|west|settings|loading|error)\b/i;
    expect(all(strings).filter((s) => english.test(s))).toEqual([]);
  });

  it('mọi hoạt động có tên, mô tả, mục SGK và thời lượng', () => {
    for (const id of GAME_IDS) {
      const g = strings.games[id];
      expect(g.title && g.desc && g.ref, id).toBeTruthy();
      expect(g.minutes, id).toBeGreaterThan(0);
    }
  });

  it('câu đố: bốn lựa chọn khác nhau và có lời giải thích', () => {
    for (const q of [...strings.quiz.b4, ...strings.quiz.b5]) {
      expect(q.a.length, q.q).toBe(4);
      expect(new Set(q.a).size, q.q).toBe(4);
      expect(q.why.trim(), q.q).not.toBe('');
    }
    expect(strings.quiz.b4.length).toBeGreaterThanOrEqual(8);
    expect(strings.quiz.b5.length).toBeGreaterThanOrEqual(8);
  });

  it('phân loại địa tâm / nhật tâm và mô hình Ptolemy khớp chữ', () => {
    expect(Object.keys(MODEL_ANSWER).sort()).toEqual(Object.keys(strings.games.models.cards).sort());
    for (const id of PTOLEMY) expect(strings.games.models.bodies[id]).toBeTruthy();
    for (const id of PLANETS) expect(strings.games.solar.planets[id]).toBeTruthy();
  });
});

describe('Truy tìm sao Bắc Cực: hình học thật so với SGK', () => {
  it('ba chòm có đủ sao, Polaris là α UMi', () => {
    expect(DIPPER.stars).toHaveLength(7);
    expect(CAS.stars).toHaveLength(5);
    expect(UMI.stars).toHaveLength(7);
    expect(POLARIS.dec).toBeGreaterThan(89);
  });

  it('Gấu Lớn: sao Bắc Cực cách α khoảng 5,3 lần αβ; điểm cuối 5 đoạn nằm trong vùng chấm đạt', () => {
    expect(rulerRatio('dipper')).toBeGreaterThan(5);
    expect(rulerRatio('dipper')).toBeLessThan(5.6);
    for (const rot of [0, 77, 200]) {
      const r = ruler('dipper', rot);
      const p = project(POLARIS.ra, POLARIS.dec, rot);
      const end = { x: r.base.x + r.dir.x * r.len * 5, y: r.base.y + r.dir.y * r.len * 5 };
      expect(Math.hypot(end.x - p.x, end.y - p.y)).toBeLessThan(POLARIS_TOLERANCE);
    }
  });

  it('Thiên Hậu: SGK nói ~7 lần γδ, thực tế ~7,6; điểm 7 và 8 đoạn đều trong vùng chấm đạt', () => {
    const k = rulerRatio('cas');
    expect(k).toBeGreaterThan(7);
    expect(k).toBeLessThan(8.2);
    const r = ruler('cas', 0);
    const p = project(POLARIS.ra, POLARIS.dec, 0);
    for (const n of [7, 8]) {
      const end = { x: r.base.x + r.dir.x * r.len * n, y: r.base.y + r.dir.y * r.len * n };
      expect(Math.hypot(end.x - p.x, end.y - p.y), `${n} đoạn`).toBeLessThan(POLARIS_TOLERANCE);
    }
    expect(num(rulerRatio('dipper'), 1)).toBe('5,3');
  });
});

describe('Đường đi của Mặt Trời', () => {
  it('ngày xuân phân: mọc lúc 6 giờ đúng hướng Đông, giữa trưa cao 90° − φ ở hướng Nam', () => {
    expect(riseHa(0, LAT)).toBeCloseTo(90, 6);
    const rise = sunAltAz(0, -90, LAT);
    expect(rise.alt).toBeCloseTo(0, 6);
    expect(rise.az).toBeCloseTo(90, 6);
    const noon = sunAltAz(0, 0, LAT);
    expect(noon.alt).toBeCloseTo(90 - LAT, 6);
    expect(noon.az).toBeCloseTo(180, 6);
  });

  it('hạ chí mọc lệch Bắc và ở trên trời lâu hơn; đông chí ngược lại', () => {
    const hs = riseHa(23.44, LAT);
    const hw = riseHa(-23.44, LAT);
    expect(hs).toBeGreaterThan(90);
    expect(hw).toBeLessThan(90);
    expect(sunAltAz(23.44, -hs, LAT).az).toBeLessThan(90);
    expect(sunAltAz(-23.44, -hw, LAT).az).toBeGreaterThan(90);
  });
});

describe('Pha Mặt Trăng', () => {
  it('tám vị trí của Hình 5.16', () => {
    expect(phaseIndex(0)).toBe(0);
    expect(phaseIndex(180)).toBe(4);
    expect(phaseIndex(359)).toBe(0);
    expect(phaseIndex(90 + MOON_TOLERANCE - 0.1)).toBe(2);
  });

  it('không Trăng thì không có phần sáng; Trăng đầu tháng sáng bên phải, cuối tháng sáng bên trái', () => {
    expect(litPath(0, 0, 10, 0)).toBe('');
    expect(litPath(0, 0, 10, 90)).toMatch(/^M0 -10A10 10 0 0 1 0 10/);
    expect(litPath(0, 0, 10, 270)).toMatch(/^M0 -10A10 10 0 0 0 0 10/);
  });
});

describe('Sao Hôm – Sao Mai', () => {
  it('ly giác lớn nhất trong mô hình quỹ đạo tròn: Kim tinh ≈ 46°, Thủy tinh ≈ 23°', () => {
    expect(maxElongation(ORBIT.venus)).toBeCloseTo(46.3, 0);
    expect(maxElongation(ORBIT.mercury)).toBeCloseTo(22.8, 0);
  });

  it('bên trái hình là phía Đông của Mặt Trời (Sao Hôm); phía trên là sau Mặt Trời', () => {
    expect(elongation(ORBIT.venus, 180).east).toBe(true);
    expect(elongation(ORBIT.venus, 0).east).toBe(false);
    const behind = elongation(ORBIT.venus, 270);
    expect(behind.behind).toBe(true);
    expect(behind.e).toBeCloseTo(0, 6);
  });
});

describe('Bốn mùa: hạ chí bên trái (trục nghiêng về phía Mặt Trời), đông chí bên phải', () => {
  it('vị trí khớp Hình 5.15', () => {
    const at = (d: string) => SPOTS.find((s) => s.date === d)!;
    expect(at('june').x).toBeLessThan(at('december').x);
    expect(at('march').y).toBeLessThan(at('september').y);
  });
});

describe('Lưu lựa chọn của giáo viên', () => {
  it('kiểm tra kiểu', () => {
    expect(isSgkState(DEFAULT_SGK)).toBe(true);
    expect(isSgkState({ picked: 'x' })).toBe(false);
    expect(isSgkState({ ...DEFAULT_SGK, best: { moon: 'a' } })).toBe(false);
  });
});
