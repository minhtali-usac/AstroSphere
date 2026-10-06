// Gỡ chồng chéo nhãn trong không gian màn hình (review-1 D2, C2).
//
// Thuần số học, không DOM, không three.js: khung nhìn chiếu từng nhãn đang hiện ra hộp (x, y, w, h) theo thứ tự
// ưu tiên giảm dần, rồi gọi `declutter`. Nhãn ưu tiên cao giữ chỗ trước; nhãn sau chồng lên một nhãn đã giữ thì bị ẩn.
// Nhãn chạm dải mép (EDGE px) bị ẩn, trừ nhãn được phép đẩy vào trong (ưu tiên cao: đối tượng chọn, số đo góc,
// hướng, thiên cực). Mảng cấp phát sẵn và chỉ lớn thêm khi số nhãn tăng (dựng lại cảnh) — không cấp phát mỗi khung hình.

/** Dải mép (px) mà nhãn không được chạm vào. */
export const EDGE = 6;
/** Khoảng trống tối thiểu giữa hai nhãn (px). 4 px (trước là 2): "N" và "Achernar" không còn dính nhau (review-2 D2). */
export const GAP = 4;

/** Số vị trí thay thế tối đa cho mỗi nhãn (vd. các điểm dọc theo cung của nhãn số đo). */
export const MAX_ALTS = 8;

export class LabelBoxes {
  n = 0;
  x = new Float32Array(0);
  y = new Float32Array(0);
  w = new Float32Array(0);
  h = new Float32Array(0);
  /** 1 = được phép đẩy vào trong mép thay vì bị ẩn. */
  nudge = new Uint8Array(0);
  /**
   * Khoảng trống thêm (px) mà hộp này đòi hỏi quanh mình: nhãn đối tượng đang chọn và nhãn số đo đang tô sáng dọn
   * chỗ rộng hơn, để tên sao/chòm sao hạng thấp không chen sát vào (review-3 D2).
   */
  pad = new Float32Array(0);
  /** 1 = không có chỗ trống nào thì vẫn giữ ở vị trí gốc (nhãn số đo đang tô sáng: là nội dung chính lúc đó). */
  must = new Uint8Array(0);
  /**
   * 1 = vật cản (vùng giữ trống, không phải nhãn): vòng chọn, hình người quan sát (fix-1 G1). Hộp `soft` bỏ qua vật
   * cản — nhãn tự neo quanh vật cản đó (tên đối tượng chọn đặt ngoài vòng, tên thiên cực) không tự đẩy mình đi.
   */
  solid = new Uint8Array(0);
  /** 1 = hộp này không né vật cản (`solid`), chỉ né nhãn. */
  soft = new Uint8Array(0);
  /**
   * 1 = vật cản "cứng": cả hộp `soft` cũng phải né (fix-2 #1). Dùng cho lớp giao diện nổi trên khung nhìn — nút công
   * cụ của khung nhìn đè lên mọi nhãn bên dưới, kể cả "Thiên đỉnh" vốn là nhãn `soft`.
   */
  hard = new Uint8Array(0);
  /**
   * 1 = hộp này không được chạm vùng tròn giữ trống (`discX/discY/discR`): tên chòm sao không in lên quả địa cầu ở
   * khung thiên cầu (fix-2 #3). Vị trí chạm vùng tròn không dùng được; không còn vị trí nào thì nhãn ẩn.
   */
  avoidDisc = new Uint8Array(0);
  /** Vùng tròn giữ trống (px): tâm và bán kính; bán kính ≤ 0 = không có. Đặt lại mỗi lần reset(). */
  discX = 0;
  discY = 0;
  discR = 0;
  /** Độ lệch ngang đặt trước (px) đã cộng vào x khi đẩy hộp — khung nhìn cộng lại khi áp vào điểm neo. */
  ox = new Float32Array(0);
  /** Vị trí thay thế (góc trên trái, px) thử theo thứ tự khi vị trí gốc bị chiếm: altN[i] vị trí tại i*MAX_ALTS. */
  altN = new Uint8Array(0);
  altX = new Float32Array(0);
  altY = new Float32Array(0);
  /** Kết quả: 1 = giữ. */
  keep = new Uint8Array(0);
  /** Kết quả: độ dời (px) từ vị trí gốc tới vị trí đã chọn (đẩy vào trong mép và/hoặc vị trí thay thế). */
  dx = new Float32Array(0);
  dy = new Float32Array(0);

  /** Bảo đảm đủ chỗ cho `cap` hộp (chỉ cấp phát khi cần lớn hơn). */
  ensure(cap: number): void {
    if (this.x.length >= cap) return;
    const c = Math.max(cap, 16);
    this.x = new Float32Array(c);
    this.y = new Float32Array(c);
    this.w = new Float32Array(c);
    this.h = new Float32Array(c);
    this.nudge = new Uint8Array(c);
    this.pad = new Float32Array(c);
    this.must = new Uint8Array(c);
    this.solid = new Uint8Array(c);
    this.soft = new Uint8Array(c);
    this.hard = new Uint8Array(c);
    this.avoidDisc = new Uint8Array(c);
    this.ox = new Float32Array(c);
    this.altN = new Uint8Array(c);
    this.altX = new Float32Array(c * MAX_ALTS);
    this.altY = new Float32Array(c * MAX_ALTS);
    this.keep = new Uint8Array(c);
    this.dx = new Float32Array(c);
    this.dy = new Float32Array(c);
  }

  reset(): void {
    this.n = 0;
    this.discR = 0;
  }

  /** Đặt vùng tròn giữ trống (px) cho các hộp `avoidDisc`. */
  setDisc(x: number, y: number, r: number): void {
    this.discX = x;
    this.discY = y;
    this.discR = r;
  }

  /** Thêm một hộp (góc trên trái x, y; px). Trả về chỉ số. Gọi theo thứ tự ưu tiên giảm dần. */
  push(x: number, y: number, w: number, h: number, nudge: boolean): number {
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.w[i] = w;
    this.h[i] = h;
    this.nudge[i] = nudge ? 1 : 0;
    this.pad[i] = 0;
    this.must[i] = 0;
    this.solid[i] = 0;
    this.soft[i] = 0;
    this.hard[i] = 0;
    this.avoidDisc[i] = 0;
    this.ox[i] = 0;
    this.altN[i] = 0;
    this.keep[i] = 0;
    this.dx[i] = 0;
    this.dy[i] = 0;
    return i;
  }

  /** Thêm một vị trí thay thế (góc trên trái, px) cho hộp i; bỏ qua khi đã đủ MAX_ALTS. */
  addAlt(i: number, x: number, y: number): void {
    const k = this.altN[i];
    if (k >= MAX_ALTS) return;
    this.altX[i * MAX_ALTS + k] = x;
    this.altY[i * MAX_ALTS + k] = y;
    this.altN[i] = k + 1;
  }
}

/**
 * Hộp (x, y, w, h) có chạm hộp nào đã giữ trước i không (khoảng trống = gap + phần đệm lớn hơn của hai hộp). Hộp
 * `soft` bỏ qua vật cản (`solid`).
 */
function hits(b: LabelBoxes, i: number, x: number, y: number, w: number, h: number, gap: number): boolean {
  const pi = b.pad[i];
  const soft = b.soft[i];
  for (let j = 0; j < i; j++) {
    if (!b.keep[j]) continue;
    if (soft && b.solid[j] && !b.hard[j]) continue;
    const g = gap + (b.pad[j] > pi ? b.pad[j] : pi);
    if (x < b.x[j] + b.w[j] + g && b.x[j] < x + w + g && y < b.y[j] + b.h[j] + g && b.y[j] < y + h + g) return true;
  }
  return false;
}

/**
 * Hộp (x, y, w, h) có chạm VẬT CẢN nào đã giữ trước i không (chỉ các hộp `solid` mà hộp i phải né: hộp `soft` chỉ né
 * vật cản cứng). Dùng để chọn chỗ dự phòng của hộp `must` (fix-3 #3).
 */
function hitsObstacle(b: LabelBoxes, i: number, x: number, y: number, w: number, h: number, gap: number): boolean {
  const pi = b.pad[i];
  const soft = b.soft[i];
  for (let j = 0; j < i; j++) {
    if (!b.keep[j] || !b.solid[j]) continue;
    if (soft && !b.hard[j]) continue;
    const g = gap + (b.pad[j] > pi ? b.pad[j] : pi);
    if (x < b.x[j] + b.w[j] + g && b.x[j] < x + w + g && y < b.y[j] + b.h[j] + g && b.y[j] < y + h + g) return true;
  }
  return false;
}

/** Hộp (x, y, w, h) có chạm vùng tròn giữ trống của `b` không (điểm gần tâm nhất của hộp nằm trong vòng). */
export function hitsDisc(b: LabelBoxes, x: number, y: number, w: number, h: number): boolean {
  const r = b.discR;
  if (!(r > 0)) return false;
  const cx = b.discX;
  const cy = b.discY;
  const px = cx < x ? x : cx > x + w ? x + w : cx;
  const py = cy < y ? y : cy > y + h ? y + h : cy;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy < r * r;
}

/**
 * Quyết định giữ/ẩn từng hộp trong khung W×H (px). Mỗi hộp thử vị trí gốc rồi lần lượt các vị trí thay thế; vị trí
 * đầu tiên nằm trong khung (sau khi đẩy vào trong mép nếu được phép) và không chạm hộp đã giữ thì được chọn.
 * Không có vị trí nào: ẩn, trừ hộp `must` — giữ ở vị trí hợp lệ đầu tiên KHÔNG chạm vật cản (chỉ chồng lên nhãn), hoặc
 * nếu vị trí nào cũng chạm vật cản thì ở vị trí hợp lệ đầu tiên (fix-3 #3: nhãn "… dưới chân trời" bị đẩy vào trong mép
 * không được đè lên chính dấu "bóng" của nó khi còn chỗ khác). Độ phức tạp O(n · số vị trí · số hộp đã giữ).
 */
export function declutter(b: LabelBoxes, W: number, H: number, edge = EDGE, gap = GAP): void {
  const n = b.n;
  for (let i = 0; i < n; i++) {
    const x0 = b.x[i];
    const y0 = b.y[i];
    const w = b.w[i];
    const h = b.h[i];
    const tooBig = w > W - 2 * edge || h > H - 2 * edge;
    const na = b.altN[i];
    let placed = false;
    let fx = NaN;
    let fy = NaN;
    // Chỗ dự phòng không chạm vật cản (chỉ cho hộp `must`).
    let qx = NaN;
    let qy = NaN;
    for (let k = -1; k < na; k++) {
      let x = k < 0 ? x0 : b.altX[i * MAX_ALTS + k];
      let y = k < 0 ? y0 : b.altY[i * MAX_ALTS + k];
      let dx = 0;
      let dy = 0;
      if (x < edge) dx = edge - x;
      else if (x + w > W - edge) dx = W - edge - (x + w);
      if (y < edge) dy = edge - y;
      else if (y + h > H - edge) dy = H - edge - (y + h);
      if (dx !== 0 || dy !== 0) {
        // Nhãn quá lớn so với khung, hoặc không được phép dời: vị trí này không dùng được.
        if (!b.nudge[i] || tooBig) continue;
        x += dx;
        y += dy;
      }
      // Hộp tránh quả địa cầu: vị trí chạm vùng tròn không dùng được (kể cả làm chỗ dự phòng).
      if (b.avoidDisc[i] && hitsDisc(b, x, y, w, h)) continue;
      // Vị trí hợp lệ đầu tiên (kể cả khi bị chiếm) là chỗ dự phòng của hộp `must`.
      if (Number.isNaN(fx)) {
        fx = x;
        fy = y;
      }
      if (hits(b, i, x, y, w, h, gap)) {
        if (b.must[i] && Number.isNaN(qx) && !hitsObstacle(b, i, x, y, w, h, gap)) {
          qx = x;
          qy = y;
        }
        continue;
      }
      fx = x;
      fy = y;
      placed = true;
      break;
    }
    if (!placed && !(b.must[i] && !Number.isNaN(fx))) {
      b.keep[i] = 0;
      continue;
    }
    if (!placed && !Number.isNaN(qx)) {
      fx = qx;
      fy = qy;
    }
    b.keep[i] = 1;
    b.x[i] = fx;
    b.y[i] = fy;
    b.dx[i] = fx - x0;
    b.dy[i] = fy - y0;
  }
}
