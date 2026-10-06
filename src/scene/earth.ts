// Trái Đất ở tâm thiên cầu: họa tiết vẽ từ dữ liệu lục địa nội bộ (không cần mạng).
// Vẽ đại dương và lưới ngay; lục địa được vẽ lại khi dữ liệu (tải động) tới — gọi `onRepaint`.

import * as THREE from 'three';
import { drawLand, landRings, loadLand } from '../data/land';

export function createEarthTexture(onRepaint?: () => void): THREE.CanvasTexture {
  const w = 2048;
  const h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  paintEarth(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (!landRings()) {
    loadLand().then(
      () => {
        paintEarth(ctx, w, h);
        tex.needsUpdate = true;
        onRepaint?.();
      },
      (err) => console.error(err),
    );
  }
  return tex;
}

/**
 * Màu Trái Đất đã giảm độ bão hòa (fix-2 #3, review-2 E2): đại dương xanh lam đậm C ≈ 0,10 và lục địa lục tươi
 * C ≈ 0,11 từng "nói" cùng ngôn ngữ với trục thiên cực xanh lam (#4f9dff) và đường chân trời lục (#4caf50) ngay
 * cạnh. Nay là xám lam (C ≈ 0,04) và xám ô liu (C ≈ 0,04): vẫn đọc ra biển và đất, nhưng màu bão hòa chỉ còn ở các
 * đường mang nghĩa. Ánh sáng của khung (môi trường 1,4 + hướng 1,8) làm sáng thêm, nên giữ độ sáng gốc thấp.
 */
const OCEAN_EDGE = '#283b4b';
const OCEAN_MID = '#2c4457';
const LAND = '#4f5a45';
const COAST = '#87907a';

function paintEarth(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, OCEAN_EDGE);
  ocean.addColorStop(0.5, OCEAN_MID);
  ocean.addColorStop(1, OCEAN_EDGE);
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);
  drawLand(ctx, w, h, LAND, COAST);
  // Băng ở hai cực
  ctx.fillStyle = 'rgba(235,245,255,0.85)';
  ctx.fillRect(0, 0, w, h * 0.035);
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
  // Lưới kinh – vĩ tuyến
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Xích đạo Trái Đất
  ctx.strokeStyle = 'rgba(255,213,79,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}
