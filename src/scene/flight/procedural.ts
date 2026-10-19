// Thiên thể đa giác thấp cho «Bay vào vũ trụ»: khối hai mươi mặt chia nhỏ, đổ bóng phẳng, màu theo từng mặt.
//
// Hình dạng và màu là hình minh họa theo LOẠI thiên thể (đá, mây, khí khổng lồ, băng khổng lồ, sao), lấy hạt giống
// từ id nên cùng một thiên thể luôn trông như nhau. Trái Đất là ngoại lệ: lục địa vẽ từ dữ liệu Natural Earth thật.
// Hình cầu có cực quay theo trục +z và kinh độ 0 theo trục +x; thân thể được xoay đúng hướng ở flightView.ts.

import * as THREE from 'three';
import { mulberry32, seedOf } from '../../astro/stellar';

export type SurfaceLook = 'rocky' | 'cloudy' | 'earth' | 'gasGiant' | 'iceGiant' | 'moon' | 'subNeptune';

export interface SurfaceSpec {
  id: string;
  look: SurfaceLook;
  /** Màu nền và màu phụ (CSS). */
  palette: [string, string];
  /** Độ chia nhỏ của khối hai mươi mặt: 20 · (n + 1)² mặt (6 → 980 mặt, 12 → 3380 mặt). */
  detail: number;
  /** Bản đồ đất liền (Trái Đất): hàm trả về true nếu (kinh độ, vĩ độ) là đất. */
  land?: (lon: number, lat: number) => boolean;
}

/** Nhiễu giá trị 3D có hạt giống (lưới 0..255, nội suy mượt) — đủ cho bề mặt đa giác thấp. */
export function valueNoise3(seed: number): (x: number, y: number, z: number) => number {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rand();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const hash = (x: number, y: number, z: number) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = fade(x - xi);
    const v = fade(y - yi);
    const w = fade(z - zi);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const x00 = lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), u);
    const x10 = lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u);
    const x01 = lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u);
    const x11 = lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u);
    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
  };
}

/** Nhiễu nhiều tầng (fBm) trong [0, 1]. */
function fbm(noise: (x: number, y: number, z: number) => number, x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f, z * f);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

const _a = new THREE.Color();
const _b = new THREE.Color();
const _c = new THREE.Color();

/**
 * Dựng hình cầu đa giác thấp (bán kính 1) cho một thiên thể: dịch đỉnh theo nhiễu (thiên thể đá) và tô màu từng mặt.
 * Trả về BufferGeometry không chỉ mục (mỗi mặt ba đỉnh riêng, để đổ bóng phẳng và màu từng mặt).
 */
export function buildSurface(spec: SurfaceSpec): THREE.BufferGeometry {
  const seed = seedOf(spec.id);
  const noise = valueNoise3(seed);
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const geo = new THREE.IcosahedronGeometry(1, spec.detail);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const base = new THREE.Color(spec.palette[0]);
  const alt = new THREE.Color(spec.palette[1]);
  const bumpy = spec.look === 'rocky' || spec.look === 'moon' || spec.look === 'earth';
  // Độ gồ ghề phóng đại cho dễ nhìn (minh họa): 4 % bán kính với hành tinh đá và Mặt Trăng, 1 % với Trái Đất.
  const relief = spec.look === 'earth' ? 0.01 : bumpy ? 0.04 : 0;
  const bandPhase = rand() * Math.PI * 2;
  const bandCount = 7 + Math.floor(rand() * 5);

  // Dịch đỉnh: một đỉnh dùng chung bởi nhiều mặt có cùng vị trí, nên nhiễu tính theo vị trí giữ mặt cầu kín.
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = relief ? 1 + relief * (fbm(noise, x * 2.2 + 11, y * 2.2 + 7, z * 2.2 + 3, 4) - 0.5) * 2 : 1;
    pos.setXYZ(i, x * h, y * h, z * h);
  }

  // Màu theo mặt: lấy tâm mặt, rồi gán cho cả ba đỉnh của mặt đó.
  for (let f = 0; f < n; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const r = Math.hypot(cx, cy, cz);
    const lat = Math.asin(cz / r);
    const lon = Math.atan2(cy, cx);
    const nz = fbm(noise, cx * 3, cy * 3, cz * 3, 3);
    let k: number;
    switch (spec.look) {
      case 'gasGiant':
      case 'subNeptune':
      case 'iceGiant': {
        // Dải mây song song xích đạo, mép dải hơi uốn theo nhiễu.
        const strength = spec.look === 'gasGiant' ? 1 : 0.35;
        const band = Math.sin(lat * bandCount + bandPhase + (nz - 0.5) * 2.2);
        k = 0.5 + 0.5 * band * strength;
        break;
      }
      case 'cloudy':
        k = 0.35 + 0.5 * nz;
        break;
      case 'earth': {
        const isLand = spec.land?.(lon * (180 / Math.PI), lat * (180 / Math.PI)) ?? false;
        const polar = Math.abs(lat) > 1.22 + (nz - 0.5) * 0.15;
        if (polar) _c.set('#e9eef2');
        else if (isLand) _c.copy(alt).lerp(_a.set('#8a7a4a'), Math.max(0, nz - 0.45) * 1.6);
        else _c.copy(base).lerp(_a.set('#1d4479'), nz * 0.6);
        writeFace(colors, f, _c);
        continue;
      }
      default:
        k = nz;
    }
    _c.copy(base).lerp(_b.copy(alt), Math.min(1, Math.max(0, k)));
    writeFace(colors, f, _c);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function writeFace(colors: Float32Array, f: number, c: THREE.Color): void {
  for (let j = 0; j < 3; j++) {
    colors[(f + j) * 3] = c.r;
    colors[(f + j) * 3 + 1] = c.g;
    colors[(f + j) * 3 + 2] = c.b;
  }
}

/** Một vùng của vành đai: bán kính trong, ngoài (km) và độ đục. */
export type RingZone = readonly [inner: number, outer: number, opacity: number];

/**
 * Vành đai phẳng trong mặt phẳng xy (đơn vị km). Độ đục tính theo bán kính trong shader (không theo đỉnh), nên mép các
 * vùng mượt ở mọi khoảng cách nhìn.
 */
export function buildRings(zones: readonly RingZone[], color: string): THREE.Mesh {
  const inner = zones[0][0];
  const outer = zones[zones.length - 1][1];
  const geo = new THREE.RingGeometry(inner, outer, 160, 1);
  const n = Math.min(zones.length, 8);
  const z = new Float32Array(8 * 3);
  zones.slice(0, n).forEach((zone, i) => z.set(zone, i * 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, zones: { value: z }, count: { value: n } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying float vR;
      void main() {
        vR = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 color;
      uniform float zones[24];
      uniform int count;
      varying float vR;
      void main() {
        #include <logdepthbuf_fragment>
        float a = 0.0;
        for (int i = 0; i < 8; i++) {
          if (i >= count) break;
          float r0 = zones[i * 3];
          float r1 = zones[i * 3 + 1];
          float w = max(fwidth(vR), 1.0);
          a = max(a, zones[i * 3 + 2] * smoothstep(r0 - w, r0 + w, vR) * (1.0 - smoothstep(r1 - w, r1 + w, vR)));
        }
        if (a < 0.01) discard;
        gl_FragColor = vec4(color, a);
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

/** Băm nội dung hình (để kiểm thử: cùng hạt giống → cùng hình). */
export function geometryHash(geo: THREE.BufferGeometry): number {
  let h = 0x811c9dc5;
  for (const name of ['position', 'color']) {
    const arr = (geo.getAttribute(name) as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < arr.length; i += 7) {
      h ^= Math.round(arr[i] * 1e5);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}
