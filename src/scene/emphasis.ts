// Hiệu ứng tô sáng liên kết trong một khung nhìn (ux-brief §6).
//
// Con số là "trigger", hình là "follower" (motion › choreography, 503 · U5 · L20 · 04:33–06:31): khi khóa tô sáng
// đổi, hình đậm dần trong ~150 ms với đường cong ease-out, không nảy (503 · U2 · L08 · 06:22–09:12). Giảm chuyển
// động → đổi ngay. Tô sáng chỉ đổi độ dày và độ mờ, không đổi màu: màu cảnh mang nghĩa (color-theory ›
// functional-color: hue không bao giờ là kênh duy nhất của trạng thái; màu ký hiệu giữ nguyên).
//
// Chỉ đổi uniform (setFatLineStyle, material.opacity): không cấp phát, không dựng hình học, không createBuffer.

import type * as THREE from 'three';
import type { Line2 } from 'three/addons/lines/Line2.js';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { setFatLineStyle } from './geom';

/** Hệ số độ dày đường khi được tô sáng. */
export const EMPHASIS_WIDTH = 1.8;
/** Độ mờ cộng thêm cho mặt (hình quạt, vùng) khi được tô sáng. */
export const EMPHASIS_MESH_BOOST = 0.3;
/** Thời gian chuyển (ms). */
export const EMPHASIS_MS = 150;

interface Item {
  line: Line2 | null;
  mesh: THREE.Mesh | null;
  /** Độ dày và độ mờ gốc. */
  w0: number;
  o0: number;
}

/** ease-out bậc ba: nhanh lúc đầu, chậm dần khi tới đích, không vượt quá đích. */
const easeOut = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p);

export class EmphasisFx {
  private groups = new Map<string, Item[]>();
  private known = new Map<object, Item>();
  private active: Item[] | null = null;
  private activeId: string | null = null;
  private from = 0;
  private to = 0;
  private level = 0;
  private t0 = 0;
  /** Đang trong lúc chuyển: khung nhìn cần vẽ lại mỗi khung hình. */
  running = false;
  /** Hệ số độ dày chung của khung nhìn (chế độ trình chiếu); tô sáng nhân thêm trên hệ số này. */
  private scale = 1;

  /** Đổi hệ số độ dày chung và áp lại mức tô sáng hiện tại lên các đường đang được tô sáng. */
  setScale(k: number): void {
    this.scale = k;
    this.apply(this.level);
  }

  private item(obj: Line2 | THREE.Mesh): Item {
    let it = this.known.get(obj);
    if (!it) {
      const isLine = (obj as Line2).isLine2 === true;
      const m = obj.material as LineMaterial | THREE.MeshBasicMaterial;
      it = {
        line: isLine ? (obj as Line2) : null,
        mesh: isLine ? null : (obj as THREE.Mesh),
        w0: isLine ? (m as LineMaterial).linewidth : 0,
        o0: m.opacity,
      };
      this.known.set(obj, it);
    }
    return it;
  }

  /** Đăng ký một đường (Line2) hoặc mặt (Mesh trong suốt) vào nhóm `id` (một đối tượng có thể ở nhiều nhóm). */
  add(id: string, ...objs: (Line2 | THREE.Mesh)[]): void {
    let list = this.groups.get(id);
    if (!list) this.groups.set(id, (list = []));
    for (const o of objs) list.push(this.item(o));
  }

  has(id: string): boolean {
    return this.groups.has(id);
  }

  /** Nhóm đang (hoặc vừa) được tô sáng. */
  get current(): string | null {
    return this.to > 0 ? this.activeId : null;
  }

  /** Mức tô sáng hiện tại 0…1 (để kiểm thử). */
  get value(): number {
    return this.level;
  }

  /** Đổi nhóm đích. `instant` = giảm chuyển động: áp dụng ngay, không chuyển. */
  setTarget(id: string | null, now: number, instant: boolean): void {
    const list = id ? (this.groups.get(id) ?? null) : null;
    if (!list) id = null;
    if (id !== null && id !== this.activeId) {
      // Đổi sang nhóm khác: nhóm cũ về gốc ngay, nhóm mới đậm dần từ 0.
      this.apply(0);
      this.active = list;
      this.activeId = id;
      this.level = 0;
    }
    const target = id === null ? 0 : 1;
    if (target === this.to && (this.running || this.level === target)) return;
    this.to = target;
    if (instant || !this.active) {
      this.finish();
      return;
    }
    this.from = this.level;
    this.t0 = now;
    this.running = true;
  }

  /** Tiến một bước chuyển (gọi trong frame() của khung nhìn khi `running`). */
  step(now: number): void {
    if (!this.running) return;
    const p = Math.min(1, Math.max(0, (now - this.t0) / EMPHASIS_MS));
    if (p >= 1) {
      this.finish();
      return;
    }
    this.level = this.from + (this.to - this.from) * easeOut(p);
    this.apply(this.level);
  }

  private finish(): void {
    this.running = false;
    this.level = this.to;
    this.apply(this.level);
    if (this.to === 0) {
      this.active = null;
      this.activeId = null;
    }
  }

  private apply(e: number): void {
    const list = this.active;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.line) setFatLineStyle(it.line, { width: it.w0 * this.scale * (1 + (EMPHASIS_WIDTH - 1) * e), opacity: it.o0 + (1 - it.o0) * e });
      else if (it.mesh) (it.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, it.o0 + EMPHASIS_MESH_BOOST * e);
    }
  }
}
