// Đường bờ lục địa (Natural Earth 1:110m, phạm vi công cộng) — dùng cho bản đồ và họa tiết Trái Đất.
// Dữ liệu (~65 KB) được tải động lần đầu cần đến, để không nằm trong gói khởi động: người dùng thấy
// đại dương và lưới trước, lục địa được vẽ bổ sung khi dữ liệu tới.

/** Mỗi vòng là mảng phẳng [lon0, lat0, lon1, lat1, ...]. */
export type LandRings = number[][];

let rings: LandRings | null = null;
let loading: Promise<LandRings> | null = null;

/** Tải dữ liệu lục địa (một lần, dùng chung cho mọi nơi gọi). */
export function loadLand(): Promise<LandRings> {
  loading ??= import('./generated/land.json').then((m) => {
    rings = m.default as unknown as LandRings;
    return rings;
  });
  return loading;
}

/** Dữ liệu lục địa nếu đã tải xong, ngược lại null. */
export function landRings(): LandRings | null {
  return rings;
}

/** Vẽ lục địa lên canvas theo phép chiếu trụ đều (equirectangular). Không làm gì nếu dữ liệu chưa tải. */
export function drawLand(ctx: CanvasRenderingContext2D, w: number, h: number, fill: string, stroke?: string, data: LandRings | null = rings): void {
  if (!data) return;
  ctx.beginPath();
  for (const ring of data) {
    for (let i = 0; i < ring.length; i += 2) {
      const x = ((ring[i] + 180) / 360) * w;
      const y = ((90 - ring[i + 1]) / 180) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
