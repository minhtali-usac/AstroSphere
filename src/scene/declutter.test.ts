import { describe, expect, it } from 'vitest';
import { declutter, EDGE, GAP, hitsDisc, LabelBoxes, MAX_ALTS } from './declutter';

function boxes(list: [number, number, number, number, boolean?][]): LabelBoxes {
  const b = new LabelBoxes();
  b.ensure(list.length);
  for (const [x, y, w, h, nudge] of list) b.push(x, y, w, h, !!nudge);
  return b;
}

describe('declutter', () => {
  it('keeps the higher-priority (earlier) box when two overlap', () => {
    const b = boxes([
      [100, 100, 60, 16],
      [130, 105, 60, 16],
      [300, 100, 60, 16],
    ]);
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 3)]).toEqual([1, 0, 1]);
  });

  it('a hidden box does not block later boxes', () => {
    const b = boxes([
      [100, 100, 60, 16],
      [150, 100, 60, 16], // hidden by #0
      [205, 100, 60, 16], // overlaps only #1 (hidden) → kept
    ]);
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 3)]).toEqual([1, 0, 1]);
  });

  it('hides low-priority boxes in the edge band', () => {
    const b = boxes([
      [2, 100, 60, 16],
      [760, 100, 60, 16],
      [100, 590, 60, 16],
    ]);
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 3)]).toEqual([0, 0, 0]);
  });

  it('nudges high-priority boxes inside the edge band instead of hiding them', () => {
    const b = boxes([
      [-10, 100, 60, 16, true],
      [780, 590, 40, 16, true],
    ]);
    declutter(b, 800, 600);
    expect(b.keep[0]).toBe(1);
    expect(b.x[0]).toBe(EDGE);
    expect(b.dx[0]).toBe(EDGE + 10);
    expect(b.keep[1]).toBe(1);
    expect(b.x[1] + 40).toBe(800 - EDGE);
    expect(b.y[1] + 16).toBe(600 - EDGE);
  });

  it('a nudged box then takes part in collisions at its new place', () => {
    const b = boxes([
      [-20, 100, 60, 16, true], // nudged to x = EDGE
      [30, 100, 40, 16], // overlaps the nudged box
    ]);
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 2)]).toEqual([1, 0]);
  });

  it('reuses its buffers: ensure() does not shrink and reset() clears the count', () => {
    const b = new LabelBoxes();
    b.ensure(40);
    const x = b.x;
    b.ensure(10);
    expect(b.x).toBe(x);
    b.push(0, 0, 1, 1, false);
    b.reset();
    expect(b.n).toBe(0);
  });

  // review-3 D2: nhãn số đo đang tô sáng nhường chỗ cho chữ hướng (B/N/Đ/T) bằng cách dời dọc theo cung.
  it('a box whose place is taken moves to its first free alternate position instead of hiding', () => {
    const b = boxes([
      [100, 100, 20, 18, true], // chữ hướng "B", giữ chỗ trước
      [90, 95, 200, 18, true], // nhãn số đo chồng lên "B"
    ]);
    b.addAlt(1, 95, 105); // vẫn chồng
    b.addAlt(1, 80, 140); // trống
    b.addAlt(1, 80, 200); // trống nhưng đứng sau
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 2)]).toEqual([1, 1]);
    expect(b.x[0]).toBe(100); // chữ hướng không bị dời, không bị ẩn
    expect([b.x[1], b.y[1]]).toEqual([80, 140]);
    expect([b.dx[1], b.dy[1]]).toEqual([-10, 45]);
  });

  it('a must box with no free place stays at its own place; a plain box is hidden', () => {
    const b = boxes([
      [100, 100, 20, 18, true],
      [90, 95, 200, 18, true],
      [90, 95, 200, 18, true],
    ]);
    b.must[1] = 1;
    b.addAlt(1, 95, 105);
    declutter(b, 800, 600);
    expect(b.keep[1]).toBe(1);
    expect([b.dx[1], b.dy[1]]).toEqual([0, 0]);
    expect(b.keep[2]).toBe(0);
  });

  it('padding around a kept box clears lower-priority neighbours further away', () => {
    const near = GAP + 6; // ngoài khoảng GAP thường, trong vùng đệm 10 px
    const b = boxes([
      [100, 100, 60, 16, true],
      [160 + near, 100, 40, 16],
    ]);
    declutter(b, 800, 600);
    expect(b.keep[1]).toBe(1);
    b.reset();
    b.push(100, 100, 60, 16, true);
    b.pad[0] = 10;
    b.push(160 + near, 100, 40, 16, false);
    declutter(b, 800, 600);
    expect(b.keep[1]).toBe(0);
  });

  it('ignores alternates beyond MAX_ALTS', () => {
    const b = boxes([[0, 0, 1, 1]]);
    for (let k = 0; k < MAX_ALTS + 3; k++) b.addAlt(0, k, k);
    expect(b.altN[0]).toBe(MAX_ALTS);
  });

  it('an obstacle (solid) moves an ordinary label to its alternative, but a soft label ignores it', () => {
    const b = new LabelBoxes();
    b.ensure(3);
    const o = b.push(100, 100, 40, 40, false); // vòng chọn
    b.solid[o] = 1;
    b.must[o] = 1;
    const d = b.push(130, 110, 20, 20, true); // chữ hướng chồng lên vòng
    b.addAlt(d, 160, 110);
    const p = b.push(110, 90, 30, 16, true); // tên thiên cực (soft) chồng lên vòng
    b.soft[p] = 1;
    declutter(b, 800, 600);
    expect(b.keep[o]).toBe(1);
    expect(b.keep[d]).toBe(1);
    expect(b.dx[d]).toBe(30); // dời sang vị trí thay thế
    expect(b.keep[p]).toBe(1);
    expect(b.dx[p]).toBe(0); // bỏ qua vật cản, giữ chỗ gốc
  });

  it('a must box with no free place stays at its origin even when an obstacle covers it', () => {
    const b = new LabelBoxes();
    b.ensure(2);
    const o = b.push(100, 100, 40, 40, false);
    b.solid[o] = 1;
    b.must[o] = 1;
    const d = b.push(110, 110, 20, 20, true);
    b.must[d] = 1;
    declutter(b, 800, 600);
    expect(b.keep[d]).toBe(1);
    expect(b.dx[d]).toBe(0);
  });

  it('fix-2 #1: a hard obstacle blocks soft boxes too, a plain obstacle does not', () => {
    const b = boxes([
      [600, 10, 80, 34], // #0 lớp nổi (nút công cụ): vật cản cứng
      [100, 100, 40, 40], // #1 vòng chọn: vật cản thường
      [610, 20, 60, 16], // #2 nhãn soft trùng nút → thử vị trí thay thế
      [105, 110, 30, 16], // #3 nhãn soft trùng vòng chọn → giữ nguyên chỗ
    ]);
    for (const k of [0, 1]) {
      b.solid[k] = 1;
      b.must[k] = 1;
    }
    b.hard[0] = 1;
    b.soft[2] = 1;
    b.soft[3] = 1;
    b.addAlt(2, 610, 80);
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 4)]).toEqual([1, 1, 1, 1]);
    expect(b.y[2]).toBe(80);
    expect(b.dy[3]).toBe(0);
  });

  it('fix-2 #1: a soft box with no free place next to a hard obstacle is hidden', () => {
    const b = boxes([
      [600, 10, 80, 34],
      [610, 20, 60, 16],
    ]);
    b.solid[0] = 1;
    b.must[0] = 1;
    b.hard[0] = 1;
    b.soft[1] = 1;
    declutter(b, 800, 600);
    expect(b.keep[1]).toBe(0);
  });

  it('fix-2 #3: hitsDisc is a rectangle–circle test', () => {
    const b = new LabelBoxes();
    b.setDisc(100, 100, 50);
    expect(hitsDisc(b, 90, 90, 20, 20)).toBe(true); // tâm nằm trong hộp
    expect(hitsDisc(b, 140, 95, 40, 10)).toBe(true); // chạm mép phải của vòng
    expect(hitsDisc(b, 140, 140, 30, 30)).toBe(false); // góc hộp ngoài vòng (khoảng cách 56,6 > 50)
    expect(hitsDisc(b, 300, 300, 10, 10)).toBe(false);
    b.reset();
    expect(hitsDisc(b, 90, 90, 20, 20)).toBe(false); // reset() xóa vùng tròn
  });

  it('fix-2 #3: avoidDisc boxes leave the disc (alternative place or hidden); others ignore it', () => {
    const b = boxes([
      [90, 90, 40, 16], // #0 tên chòm trên quả địa cầu, không có chỗ khác → ẩn
      [95, 120, 40, 16], // #1 tên chòm trên quả địa cầu, có chỗ thay thế ngoài vòng → dời
      [100, 60, 40, 16], // #2 nhãn thường (vd. "Người quan sát") → giữ nguyên
    ]);
    b.ensure(3);
    b.setDisc(100, 100, 50);
    b.avoidDisc[0] = 1;
    b.avoidDisc[1] = 1;
    b.addAlt(1, 300, 120);
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 3)]).toEqual([0, 1, 1]);
    expect(b.x[1]).toBe(300);
    expect(b.dx[2]).toBe(0);
  });

  it('fix-2 #3: an avoidDisc box stays hidden even when it is `must`', () => {
    const b = boxes([[90, 90, 40, 16]]);
    b.setDisc(100, 100, 50);
    b.avoidDisc[0] = 1;
    b.must[0] = 1;
    declutter(b, 800, 600);
    expect(b.keep[0]).toBe(0);
  });

  // fix-3 #3: nhãn "Sirius đang ở dưới chân trời" (must, soft) cạnh dấu "bóng" sát mép phải: đẩy vào trong mép thì đè lên
  // chính vòng "bóng" (vật cản cứng) → không được giữ ở đó; thử vị trí thay thế bên trái vòng.
  const ghost = (b: LabelBoxes): number => {
    const o = b.push(480, 540, 30, 30, false); // vòng "bóng" đã vẽ (sau khi kẹp vào khung)
    b.solid[o] = 1;
    b.hard[o] = 1;
    b.must[o] = 1;
    return o;
  };
  const under = (b: LabelBoxes): number => {
    const k = b.push(518, 545, 250, 20, true); // bên phải vòng, cách 8 px; tràn mép phải (W = 712)
    b.must[k] = 1;
    b.soft[k] = 1;
    b.addAlt(k, 480 - 8 - 250, 545); // bên trái vòng
    b.addAlt(k, 370, 540 - 8 - 20); // phía trên vòng
    return k;
  };
  const overlaps = (b: LabelBoxes, i: number, j: number): boolean =>
    b.x[i] < b.x[j] + b.w[j] && b.x[j] < b.x[i] + b.w[i] && b.y[i] < b.y[j] + b.h[j] && b.y[j] < b.y[i] + b.h[i];

  it('fix-3 #3: a must box is never nudged into a hard obstacle when an alternative is free', () => {
    const b = new LabelBoxes();
    b.ensure(2);
    const o = ghost(b);
    const k = under(b);
    declutter(b, 712, 600);
    expect(b.keep[k]).toBe(1);
    expect(b.x[k]).toBe(222); // vị trí thay thế bên trái, không phải chỗ gốc bị đẩy vào trong mép
    expect(overlaps(b, k, o)).toBe(false);
  });

  it('fix-3 #3: with no free place, a must box falls back to a place that only overlaps labels, not the obstacle', () => {
    const b = new LabelBoxes();
    b.ensure(4);
    const o = ghost(b);
    b.push(200, 540, 60, 20, true); // nhãn đã giữ bên trái vòng
    b.push(380, 500, 60, 20, true); // nhãn đã giữ phía trên vòng
    const k = under(b);
    declutter(b, 712, 600);
    expect(b.keep[k]).toBe(1);
    expect(b.x[k]).toBe(222); // chỗ dự phòng: vị trí đầu tiên không chạm vật cản
    expect(overlaps(b, k, o)).toBe(false);
  });

  it('fix-3 #3: a must box that hits the obstacle everywhere still falls back to its first valid place', () => {
    const b = new LabelBoxes();
    b.ensure(2);
    const o = ghost(b);
    const k = b.push(490, 545, 60, 20, true);
    b.must[k] = 1;
    b.soft[k] = 1;
    b.addAlt(k, 470, 550);
    declutter(b, 712, 600);
    expect(o).toBe(0);
    expect(b.keep[k]).toBe(1);
    expect(b.dx[k]).toBe(0);
  });
});
