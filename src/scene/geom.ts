// Hàm dựng hình học dùng chung cho cả hai khung nhìn.

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { cosD, sinD } from '../astro';

export { COLORS } from './colors';

export interface FatLineOpts {
  width?: number;
  opacity?: number;
  dashed?: boolean;
  dashSize?: number;
  gapSize?: number;
  depthTest?: boolean;
}

/**
 * Số `LineGeometry` đã được tạo từ đầu phiên (để kiểm tra: khi đang chạy hoạt ảnh con số này phải đứng yên).
 * Xem docs/redesign/uat/perf.mjs.
 */
export const geomStats = { lineGeometries: 0 };

function newLineGeometry(): LineGeometry {
  geomStats.lineGeometries++;
  return new LineGeometry();
}

function lineMaterial(color: string, opts: FatLineOpts): LineMaterial {
  return new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: opts.width ?? 2,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    dashed: !!opts.dashed,
    dashSize: opts.dashSize ?? 0.4,
    gapSize: opts.gapSize ?? 0.3,
    depthTest: opts.depthTest ?? true,
  });
}

/**
 * Đổi độ dày (px) và độ mờ của một đường Line2 mà không dựng lại hình học — chỉ đổi uniform.
 * Dùng cho các hiệu ứng nhấn mạnh; nhớ đánh dấu khung nhìn cần vẽ lại (`view.dirty = true`).
 */
export function setFatLineStyle(line: Line2, style: { width?: number; opacity?: number }): void {
  const m = line.material as LineMaterial;
  if (style.width !== undefined && m.linewidth !== style.width) m.linewidth = style.width;
  if (style.opacity !== undefined && m.opacity !== style.opacity) {
    const wasTransparent = m.transparent;
    m.opacity = style.opacity;
    m.transparent = style.opacity < 1;
    // Đổi transparent làm thay đổi chương trình/thứ tự vẽ → cần biên dịch lại một lần.
    if (wasTransparent !== m.transparent) m.needsUpdate = true;
  }
}

/** Đường có độ dày tính bằng pixel (Line2), hình học cố định. */
export function fatLine(points: THREE.Vector3[], color: string, opts: FatLineOpts = {}): Line2 {
  const geom = newLineGeometry();
  geom.setPositions(flatten(points));
  const line = new Line2(geom, lineMaterial(color, opts));
  if (opts.dashed) line.computeLineDistances();
  return line;
}

export interface DynamicFatLineOpts extends FatLineOpts {
  /** Bán kính hình cầu (tâm ở gốc tọa độ) luôn chứa đường — dùng cố định cho frustum culling và raycast. */
  boundsRadius: number;
}

interface DynamicLineData {
  maxPoints: number;
  pos: THREE.InstancedInterleavedBuffer;
  dist: THREE.InstancedInterleavedBuffer | null;
}

const dynData = new WeakMap<Line2, DynamicLineData>();

/**
 * Đường Line2 với bộ đệm cấp phát sẵn cho tối đa `maxPoints` điểm. Cập nhật bằng `writeFatLine`
 * (ghi tại chỗ, không tạo LineGeometry/InstancedInterleavedBuffer mới, không gọi createBuffer).
 */
export function dynamicFatLine(maxPoints: number, color: string, opts: DynamicFatLineOpts): Line2 {
  const segs = Math.max(1, maxPoints - 1);
  const geom = newLineGeometry();
  const pos = new THREE.InstancedInterleavedBuffer(new Float32Array(segs * 6), 6, 1);
  pos.setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('instanceStart', new THREE.InterleavedBufferAttribute(pos, 3, 0));
  geom.setAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(pos, 3, 3));
  let dist: THREE.InstancedInterleavedBuffer | null = null;
  if (opts.dashed) {
    dist = new THREE.InstancedInterleavedBuffer(new Float32Array(segs * 2), 2, 1);
    dist.setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('instanceDistanceStart', new THREE.InterleavedBufferAttribute(dist, 1, 0));
    geom.setAttribute('instanceDistanceEnd', new THREE.InterleavedBufferAttribute(dist, 1, 1));
  }
  geom.instanceCount = 0;
  const r = opts.boundsRadius;
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), r);
  geom.boundingBox = new THREE.Box3(new THREE.Vector3(-r, -r, -r), new THREE.Vector3(r, r, r));
  const line = new Line2(geom, lineMaterial(color, opts));
  dynData.set(line, { maxPoints: segs + 1, pos, dist });
  return line;
}

/**
 * Ghi `count` điểm (mảng phẳng xyz) vào đường tạo bởi `dynamicFatLine`. Không cấp phát.
 * Số điểm vượt quá `maxPoints` bị bỏ qua.
 */
export function writeFatLine(line: Line2, pts: Float32Array, count: number): void {
  const d = dynData.get(line);
  if (!d) throw new Error('writeFatLine: line was not created by dynamicFatLine');
  const n = Math.min(count, d.maxPoints);
  const segs = Math.max(0, n - 1);
  const a = d.pos.array as Float32Array;
  for (let i = 0; i < segs; i++) {
    const o = i * 6;
    const p = i * 3;
    a[o] = pts[p];
    a[o + 1] = pts[p + 1];
    a[o + 2] = pts[p + 2];
    a[o + 3] = pts[p + 3];
    a[o + 4] = pts[p + 4];
    a[o + 5] = pts[p + 5];
  }
  d.pos.needsUpdate = true;
  if (d.dist) {
    const da = d.dist.array as Float32Array;
    let acc = 0;
    for (let i = 0; i < segs; i++) {
      const p = i * 3;
      const dx = pts[p + 3] - pts[p];
      const dy = pts[p + 4] - pts[p + 1];
      const dz = pts[p + 5] - pts[p + 2];
      da[i * 2] = acc;
      acc += Math.sqrt(dx * dx + dy * dy + dz * dz);
      da[i * 2 + 1] = acc;
    }
    d.dist.needsUpdate = true;
  }
  (line.geometry as LineGeometry).instanceCount = segs;
}

/** Ghi các điểm Vector3 vào mảng phẳng `out` bắt đầu từ điểm thứ `offset`; trả về số điểm sau khi ghi. */
export function pointsInto(points: readonly THREE.Vector3[], out: Float32Array, offset = 0): number {
  for (let i = 0; i < points.length; i++) {
    const o = (offset + i) * 3;
    out[o] = points[i].x;
    out[o + 1] = points[i].y;
    out[o + 2] = points[i].z;
  }
  return offset + points.length;
}

/** Dựng lại toàn bộ hình học (cấp phát). Chỉ dùng cho thay đổi hiếm; khi chạy hoạt ảnh hãy dùng writeFatLine. */
export function setFatLinePoints(line: Line2, points: THREE.Vector3[]): void {
  const old = line.geometry;
  const geom = newLineGeometry();
  geom.setPositions(flatten(points));
  line.geometry = geom;
  old.dispose();
  if ((line.material as LineMaterial).dashed) line.computeLineDistances();
}

function flatten(points: THREE.Vector3[]): number[] {
  const arr: number[] = [];
  for (const p of points) arr.push(p.x, p.y, p.z);
  return arr;
}

/** Vòng xích vĩ δ trong hệ xích đạo gốc. */
export function decCircle(dec: number, r: number, n = 180): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const cd = cosD(dec);
  const z = sinD(dec) * r;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 360;
    pts.push(new THREE.Vector3(cd * cosD(a) * r, cd * sinD(a) * r, z));
  }
  return pts;
}

/** Cung tròn lớn đi từ a đến b (theo cung ngắn hoặc qua điểm trung gian nếu có). */
export function greatArc(a: THREE.Vector3, b: THREE.Vector3, r: number, n = 64): THREE.Vector3[] {
  const ua = a.clone().normalize();
  const ub = b.clone().normalize();
  const angle = ua.angleTo(ub);
  const pts: THREE.Vector3[] = [];
  if (angle < 1e-9) return [ua.multiplyScalar(r), ub.multiplyScalar(r)];
  const sinA = Math.sin(angle);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const wa = Math.sin((1 - t) * angle) / sinA;
    const wb = Math.sin(t * angle) / sinA;
    pts.push(ua.clone().multiplyScalar(wa).add(ub.clone().multiplyScalar(wb)).multiplyScalar(r));
  }
  return pts;
}

const _ua = new THREE.Vector3();
const _ub = new THREE.Vector3();

/**
 * Như `greatArc` nhưng không cấp phát: ghi n + 1 điểm vào `out` (mảng phẳng xyz) từ điểm thứ `offset`.
 * Trả về chỉ số điểm kế tiếp (offset + n + 1). Hai hướng trùng nhau → n + 1 điểm nội suy thẳng.
 */
export function greatArcInto(a: THREE.Vector3, b: THREE.Vector3, r: number, n: number, out: Float32Array, offset = 0): number {
  _ua.copy(a).normalize();
  _ub.copy(b).normalize();
  const angle = _ua.angleTo(_ub);
  const sinA = Math.sin(angle);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let wa: number;
    let wb: number;
    if (angle < 1e-9) {
      wa = 1 - t;
      wb = t;
    } else {
      wa = Math.sin((1 - t) * angle) / sinA;
      wb = Math.sin(t * angle) / sinA;
    }
    const o = (offset + i) * 3;
    out[o] = (_ua.x * wa + _ub.x * wb) * r;
    out[o + 1] = (_ua.y * wa + _ub.y * wb) * r;
    out[o + 2] = (_ua.z * wa + _ub.z * wb) * r;
  }
  return offset + n + 1;
}

/** Vòng tròn lớn vuông góc với trục `pole`. */
export function greatCircle(pole: THREE.Vector3, r: number, n = 180): THREE.Vector3[] {
  const p = pole.clone().normalize();
  const helper = Math.abs(p.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(p, helper).normalize();
  const v = new THREE.Vector3().crossVectors(p, u).normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(u.clone().multiplyScalar(Math.cos(t) * r).add(v.clone().multiplyScalar(Math.sin(t) * r)));
  }
  return pts;
}

/** Dải cầu giữa hai xích vĩ (độ), trong hệ xích đạo gốc. */
export function decBandGeometry(dec1: number, dec2: number, r: number, segs = 96): THREE.BufferGeometry {
  const lo = Math.min(dec1, dec2);
  const hi = Math.max(dec1, dec2);
  const stacks = Math.max(2, Math.ceil((hi - lo) / 3));
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= stacks; j++) {
    const d = lo + ((hi - lo) * j) / stacks;
    const cd = cosD(d);
    const z = sinD(d) * r;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * 360;
      pos.push(cd * cosD(a) * r, cd * sinD(a) * r, z);
    }
  }
  const row = segs + 1;
  for (let j = 0; j < stacks; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * row + i;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Hình quạt (góc) từ tâm `center`, quét từ hướng `from` tới hướng `to` theo cung ngắn. */
export function sectorGeometry(from: THREE.Vector3, to: THREE.Vector3, radius: number, n = 48): THREE.BufferGeometry {
  const arc = greatArc(from, to, radius, n);
  const pos: number[] = [0, 0, 0];
  for (const p of arc) pos.push(p.x, p.y, p.z);
  const idx: number[] = [];
  for (let i = 1; i < arc.length; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function translucent(color: string, opacity: number, side: THREE.Side = THREE.DoubleSide): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side, depthWrite: false });
}

/** Tập đoạn thẳng mảnh (LineSegments) từ mảng tọa độ phẳng. */
export function thinSegments(positions: number[], color: string, opacity = 1): THREE.LineSegments {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  return new THREE.LineSegments(g, m);
}

/** Nối các điểm liên tiếp thành mảng đoạn thẳng phẳng. */
export function polylineToSegments(points: THREE.Vector3[], out: number[] = []): number[] {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return out;
}

/** Họa tiết hình vành khuyên dùng để đánh dấu đối tượng đang chọn. */
/** Ảnh vòng chọn (64 px). `dashed`: vòng đứt nét — đối tượng đang chọn nằm khuất dưới chân trời (fix-1 #2). */
export function ringTexture(color = '#ffffff', dashed = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  // Chu vi 2π·24 ≈ 150,8 px: 12 nét 7,6 px + khe 5 px chia đều quanh vòng.
  if (dashed) ctx.setLineDash([7.57, 5]);
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Ảnh mũi tên tam giác chỉ XUỐNG (64 px) cho dấu "bóng" bị kẹp vào mép khung (fix-2 #11). Sprite xoay bằng
 * `SpriteMaterial.rotation` để chỉ về phía vị trí thật của đối tượng.
 */
export function arrowTexture(color = '#ffffff'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#04060d';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 16);
  ctx.lineTo(54, 16);
  ctx.lineTo(32, 52);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const anyO = o as THREE.Mesh;
    anyO.geometry?.dispose?.();
    const m = anyO.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose?.();
  });
}
