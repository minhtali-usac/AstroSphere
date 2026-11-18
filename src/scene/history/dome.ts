// «Bầu trời xưa» ở dạng 3D: cùng kiểu với giản đồ chân trời của giao diện chính — người quan sát đứng ở tâm đĩa chân trời,
// các sao nằm trên vòm trời, kéo để xoay quanh, cuộn để lại gần. Chỉ tải khi mở «Bầu trời xưa» (cùng gói three.js đã có).
//
// Dữ liệu vào là đúng `Scene` mà khung nhìn phẳng (src/history/view.ts) vẽ, nên hai kiểu luôn cho cùng một bầu trời.
// Vẽ theo yêu cầu (không có vòng lặp liên tục): chỉ vẽ lại khi dữ liệu hoặc góc nhìn đổi.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { bvToRgb, catalogArrays, nameOf } from '../../data/catalog';
import { BODY_IDS, type BodyId } from '../../history/bodies';
import { limitingMagnitude } from '../../history/model';
import { H } from '../../history/text';
import type { Pick, Scene as SkySceneData, ViewHandlers } from '../../history/view';
import { COLORS } from '../colors';
import { horVec } from '../frames';
import { createStarMaterial, makeStarPoints, sizeForMagnitude } from '../starMaterial';

const R = 10;
const DEG = Math.PI / 180;
const MAX_LABELS = 36;
const TARGET = new THREE.Vector3(0, R * 0.2, 0);
const HOME = new THREE.Vector3(R * 1.17, R * 1.0, R * 2.42).add(TARGET);

function put(arr: Float32Array, i: number, alt: number, az: number, r = R): void {
  const ch = Math.cos(alt * DEG);
  arr[3 * i] = ch * Math.sin(az * DEG) * r;
  arr[3 * i + 1] = Math.sin(alt * DEG) * r;
  arr[3 * i + 2] = -ch * Math.cos(az * DEG) * r;
}

interface PointSet {
  points: THREE.Points;
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
}

function pointSet(n: number, material: THREE.ShaderMaterial): PointSet {
  const pos = new Float32Array(3 * n);
  const col = new Float32Array(3 * n);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  return { points: makeStarPoints({ positions: pos, colors: col, sizes: size, alphas: alpha }, material), pos, col, size, alpha };
}

const touch = (p: PointSet): void => {
  const g = p.points.geometry;
  g.getAttribute('position').needsUpdate = true;
  g.getAttribute('aColor').needsUpdate = true;
  g.getAttribute('aSize').needsUpdate = true;
  g.getAttribute('aAlpha').needsUpdate = true;
};

function cssColor(name: string, fallback: string): THREE.Color {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

export class HistoryDome {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  private readonly controls: OrbitControls;
  private readonly clip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.02)];
  private readonly starMat = createStarMaterial();
  private readonly ringMat = createStarMaterial(true);
  private readonly stars: PointSet;
  private readonly bodies: PointSet;
  private readonly ring: PointSet; // cực thiên cầu, điểm đánh dấu, vòng chọn
  private readonly figLines: THREE.LineSegments;
  private readonly eclLine: THREE.Line;
  private readonly eqLine: THREE.Line;
  private readonly ground: THREE.Mesh;
  private readonly labels: CSS2DObject[] = [];
  private readonly mags: ArrayLike<number>;
  private readonly hips: ArrayLike<number>;
  private readonly bodyColors = new Map<BodyId, THREE.Color>();
  private readonly tmp = new THREE.Vector3();
  private bodyAlt: number[] = [];
  private last: SkySceneData | null = null;
  private bg = '#050913';
  private raf = 0;
  private disposed = false;
  private w = 0;
  private h = 0;
  private down: { x: number; y: number } | null = null;
  private figCap = 0;

  constructor(
    host: HTMLElement,
    handlers: ViewHandlers,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.className = 'hsky-gl';
    host.appendChild(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    host.appendChild(this.labelRenderer.domElement);

    this.camera.position.copy(HOME);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(TARGET);
    this.controls.enablePan = false;
    this.controls.minDistance = R * 1.25;
    this.controls.maxDistance = R * 7;
    this.controls.rotateSpeed = 0.7;
    this.controls.update();
    this.controls.addEventListener('change', () => this.schedule());

    this.starMat.clippingPlanes = this.clip;
    this.ringMat.clippingPlanes = this.clip;
    const cat = catalogArrays();
    this.mags = cat.mag;
    this.hips = cat.hip;
    this.stars = pointSet(cat.ra.length, this.starMat);
    for (let i = 0; i < cat.ra.length; i++) {
      const [r, g, b] = bvToRgb(cat.bv[i]);
      this.stars.col.set([r, g, b], 3 * i);
      this.stars.size[i] = sizeForMagnitude(cat.mag[i]);
    }
    this.bodies = pointSet(BODY_IDS.length, this.starMat);
    this.ring = pointSet(3, this.ringMat);
    this.scene.add(this.stars.points, this.bodies.points, this.ring.points);
    const bodyToken: Record<BodyId, string> = { sun: '--sgk-sun', moon: '--sgk-moon', mercury: '--sgk-mercury', venus: '--sgk-venus', mars: '--sgk-mars', jupiter: '--sgk-jupiter', saturn: '--sgk-saturn' };
    for (const id of BODY_IDS) this.bodyColors.set(id, cssColor(bodyToken[id], '#ffffff'));

    // Đĩa chân trời và vạch phương vị, giống giản đồ chân trời của giao diện chính.
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ color: COLORS.ground, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.renderOrder = -1;
    this.scene.add(this.ground);
    const marks: number[] = [0, 0.01, -R, 0, 0.01, R, -R, 0.01, 0, R, 0.01, 0];
    for (let az = 0; az < 360; az += 10) {
      const a = horVec(0, az, R * (az % 30 === 0 ? 0.92 : 0.96));
      const b = horVec(0, az, R);
      marks.push(a.x, 0.01, a.z, b.x, 0.01, b.z);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
    this.scene.add(new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ color: COLORS.groundMark, transparent: true, opacity: 0.32 })));
    const rim: number[] = [];
    for (let a = 0; a <= 360; a += 3) rim.push(...horVec(0, a, R).toArray());
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3));
    this.scene.add(new THREE.Line(rg, new THREE.LineBasicMaterial({ color: COLORS.horizon })));

    // Người quan sát: hình nhân đơn giản ở tâm.
    const mat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.012, R * 0.018, R * 0.06, 12), mat);
    body.position.y = R * 0.03;
    const head = new THREE.Mesh(new THREE.SphereGeometry(R * 0.016, 12, 10), mat);
    head.position.y = R * 0.075;
    this.scene.add(body, head);

    // Đường nối chòm sao, hoàng đạo, xích đạo trời.
    this.figLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COLORS.figureSky, transparent: true, opacity: 0.75, clippingPlanes: this.clip }));
    this.figLines.frustumCulled = false;
    this.eclLine = this.circleLine(COLORS.ecliptic, 0.9);
    this.eqLine = this.circleLine(COLORS.equator, 0.7);
    this.scene.add(this.figLines, this.eclLine, this.eqLine);

    // Nhãn: bốn phương luôn có; phần còn lại lấy từ một bể nhãn dùng lại.
    for (const [text, az] of [[H.cardinal.n, 0], [H.cardinal.e, 90], [H.cardinal.s, 180], [H.cardinal.w, 270]] as const) {
      const el = document.createElement('div');
      el.className = 'lbl lbl--dir';
      el.textContent = text;
      const o = new CSS2DObject(el);
      o.position.copy(horVec(0, az, R * 1.06));
      this.scene.add(o);
    }
    for (let i = 0; i < MAX_LABELS; i++) {
      const el = document.createElement('div');
      el.className = 'lbl lbl--catalog';
      const o = new CSS2DObject(el);
      o.visible = false;
      this.labels.push(o);
      this.scene.add(o);
    }

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY }));
    dom.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      const p = this.pickAt(e.clientX, e.clientY);
      const r = dom.getBoundingClientRect();
      handlers.onHover(p, e.clientX - r.left, e.clientY - r.top);
    });
    dom.addEventListener('pointerleave', () => handlers.onHover(null, 0, 0));
    dom.addEventListener('click', (e) => {
      const d = this.down;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return; // kéo để xoay, không phải bấm
      handlers.onPick(this.pickAt(e.clientX, e.clientY));
    });
  }

  private circleLine(color: string, opacity: number): THREE.Line {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 181), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, clippingPlanes: this.clip }));
    l.frustumCulled = false;
    return l;
  }

  /** Đặt nền trời (màu CSS) theo độ cao Mặt Trời — do giao diện tính để hai kiểu cùng một màu. */
  setBackground(css: string): void {
    this.bg = css;
  }

  resize(w: number, h: number): void {
    this.w = Math.max(120, Math.floor(w));
    this.h = Math.max(120, Math.floor(h));
    this.renderer.setSize(this.w, this.h);
    this.labelRenderer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
    // Khung dọc (điện thoại): mở rộng góc nhìn để đĩa chân trời không bị cắt hai bên.
    this.camera.fov = this.camera.aspect < 1 ? (2 * Math.atan(Math.tan(20 * DEG) / this.camera.aspect)) / DEG : 40;
    this.camera.updateProjectionMatrix();
    this.schedule();
  }

  resetCamera(): void {
    this.camera.position.copy(HOME);
    this.controls.target.copy(TARGET);
    this.controls.update();
    this.schedule();
  }

  draw(sc: SkySceneData): void {
    this.last = sc;
    const sun = sc.bodies[0];
    const sunAlt = sun ? sun.alt : -90;
    const limit = sc.layers.daylight ? 6 : limitingMagnitude(sunAlt);
    const st = sc.stars;

    // Sao.
    let labelN = 0;
    const showLabel = (text: string, x: number, y: number, z: number, cls: string): void => {
      if (labelN >= this.labels.length) return;
      const o = this.labels[labelN++];
      o.element.textContent = text;
      o.element.className = cls;
      o.position.set(x, y, z);
      o.visible = true;
    };
    const nameMag = this.w < 520 ? 1.3 : 2.0;
    for (let i = 0; i < st.n; i++) {
      put(this.stars.pos, i, st.alt[i], st.az[i], R * 0.995);
      const mag = this.mags[i];
      const alt = st.alt[i];
      const fade = Math.min(1, Math.max(0, (limit + 0.4 - mag) / 1.2));
      this.stars.alpha[i] = alt < -0.5 ? 0 : fade * Math.min(1, 0.45 + alt / 14);
      if (this.stars.alpha[i] > 0 && ((sc.layers.names && mag < nameMag && alt > 2) || i === sc.poleStar)) {
        const n = nameOf(this.hips[i]);
        const text = n.short || n.designation;
        if (text) showLabel(text, this.stars.pos[3 * i], this.stars.pos[3 * i + 1] + 0.22, this.stars.pos[3 * i + 2], i === sc.poleStar ? 'lbl lbl--star' : 'lbl lbl--catalog');
      }
    }
    touch(this.stars);

    // Đường nối chòm sao.
    const f = sc.figures;
    this.figLines.visible = sc.layers.lines && !!f;
    if (f && sc.layers.lines) {
      const nSeg = f.segs.length / 2;
      const attr = this.figLines.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!attr || this.figCap < nSeg) {
        this.figCap = nSeg;
        this.figLines.geometry.dispose();
        this.figLines.geometry = new THREE.BufferGeometry();
        this.figLines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * nSeg), 3));
      }
      const pos = (this.figLines.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      for (let k = 0; k < nSeg; k++) {
        const a = f.segs[2 * k];
        const b = f.segs[2 * k + 1];
        put(pos, 2 * k, f.set.alt[a], f.set.az[a], R * 0.99);
        put(pos, 2 * k + 1, f.set.alt[b], f.set.az[b], R * 0.99);
      }
      this.figLines.geometry.setDrawRange(0, 2 * nSeg);
      this.figLines.geometry.getAttribute('position').needsUpdate = true;
      (this.figLines.material as THREE.LineBasicMaterial).opacity = sunAlt > -6 && !sc.layers.daylight ? 0.2 : 0.75;
    }

    this.circle(this.eclLine, sc, sc.m.eps, sc.layers.ecliptic);
    this.circle(this.eqLine, sc, 0, sc.layers.equator);

    // Thiên thể.
    this.bodyAlt = [];
    const sunLimit = limitingMagnitude(sunAlt);
    BODY_IDS.forEach((id, i) => {
      const b = sc.bodies.find((x) => x.id === id);
      const shown = !!b && sc.layers.bodies && b.alt > -0.5 && (id === 'sun' || id === 'moon' || b.mag <= sunLimit + 0.4 || sc.layers.daylight);
      this.bodyAlt[i] = shown && b ? b.alt : -90;
      if (!shown || !b) {
        this.bodies.alpha[i] = 0;
        return;
      }
      put(this.bodies.pos, i, b.alt, b.az, R * 0.99);
      const c = this.bodyColors.get(id)!;
      this.bodies.col.set([c.r, c.g, c.b], 3 * i);
      this.bodies.size[i] = id === 'sun' ? 30 : id === 'moon' ? 22 : Math.max(6, Math.min(12, 9.5 - 1.2 * b.mag));
      this.bodies.alpha[i] = 1;
      showLabel(H.bodies[id], this.bodies.pos[3 * i], this.bodies.pos[3 * i + 1] + 0.4, this.bodies.pos[3 * i + 2], id === 'sun' || id === 'moon' ? 'lbl lbl--star' : 'lbl lbl--catalog');
    });
    touch(this.bodies);

    // Vòng: cực thiên cầu (xanh), điểm đánh dấu (cam), vòng chọn (trắng).
    const ar = this.ring.alpha;
    ar.fill(0);
    put(this.ring.pos, 0, Math.abs(sc.lat), sc.lat >= 0 ? 0 : 180, R * 0.99);
    this.ring.col.set([0.31, 0.62, 1], 0);
    this.ring.size[0] = 22;
    ar[0] = 1;
    showLabel(sc.lat >= 0 ? H.view.poleN : H.view.poleS, this.ring.pos[0], this.ring.pos[1] + 0.45, this.ring.pos[2], 'lbl lbl--catalog');
    if (sc.marker && sc.marker.alt > -0.5) {
      put(this.ring.pos, 1, sc.marker.alt, sc.marker.az, R * 0.99);
      this.ring.col.set([0.95, 0.4, 0.13], 3);
      this.ring.size[1] = 26;
      ar[1] = 1;
      showLabel(sc.marker.label, this.ring.pos[3], this.ring.pos[4] + 0.45, this.ring.pos[5], 'lbl lbl--star');
    }
    const sel = this.positionOf(sc.selected);
    if (sel) {
      this.ring.pos.set([sel.x, sel.y, sel.z], 6);
      this.ring.col.set([1, 1, 1], 6);
      this.ring.size[2] = 28;
      ar[2] = 1;
    }
    touch(this.ring);

    for (let i = labelN; i < this.labels.length; i++) this.labels[i].visible = false;
    this.schedule();
  }

  private circle(line: THREE.Line, sc: SkySceneData, eps: number, on: boolean): void {
    line.visible = on;
    if (!on) return;
    const pos = (line.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const ce = Math.cos(eps * DEG);
    const se = Math.sin(eps * DEG);
    const [sT, cT] = [Math.sin(sc.m.lst * DEG), Math.cos(sc.m.lst * DEG)];
    const [sP, cP] = [Math.sin(sc.lat * DEG), Math.cos(sc.lat * DEG)];
    for (let k = 0; k <= 180; k++) {
      const l = k * 2 * DEG;
      const x = Math.cos(l);
      const y = Math.sin(l) * ce;
      const z = Math.sin(l) * se;
      const X = x * cT + y * sT;
      const Y = x * sT - y * cT;
      const alt = Math.asin(Math.max(-1, Math.min(1, sP * z + cP * X))) / DEG;
      let az = Math.atan2(-Y, z * cP - X * sP) / DEG;
      if (az < 0) az += 360;
      put(pos, k, alt, az, R * 0.99);
    }
    line.geometry.getAttribute('position').needsUpdate = true;
  }

  private positionOf(p: Pick | null): THREE.Vector3 | null {
    if (!p || !this.last) return null;
    const sc = this.last;
    if (p.kind === 'star') {
      const a = sc.stars.alt[p.index];
      return a > -0.5 ? this.tmp.set(this.stars.pos[3 * p.index], this.stars.pos[3 * p.index + 1], this.stars.pos[3 * p.index + 2]).clone() : null;
    }
    if (p.kind === 'body') {
      const i = BODY_IDS.indexOf(p.id);
      return this.bodyAlt[i] > -0.5 ? new THREE.Vector3(this.bodies.pos[3 * i], this.bodies.pos[3 * i + 1], this.bodies.pos[3 * i + 2]) : null;
    }
    return sc.marker && sc.marker.alt > -0.5 ? new THREE.Vector3(this.ring.pos[3], this.ring.pos[4], this.ring.pos[5]) : null;
  }

  /** Đối tượng gần con trỏ nhất (≤ 16 px trên màn hình). */
  private pickAt(clientX: number, clientY: number): Pick | null {
    const sc = this.last;
    if (!sc) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best: Pick | null = null;
    let bestD = 16 * 16;
    const v = this.tmp;
    const test = (x: number, y: number, z: number, bias: number, pick: () => Pick): void => {
      v.set(x, y, z).project(this.camera);
      if (v.z > 1) return;
      const sx = ((v.x + 1) / 2) * rect.width;
      const sy = ((1 - v.y) / 2) * rect.height;
      const d = (sx - px) ** 2 + (sy - py) ** 2 + bias;
      if (d < bestD) [bestD, best] = [d, pick()];
    };
    BODY_IDS.forEach((id, i) => {
      if (this.bodyAlt[i] > -0.5) test(this.bodies.pos[3 * i], this.bodies.pos[3 * i + 1], this.bodies.pos[3 * i + 2], 0, () => ({ kind: 'body', id }));
    });
    if (sc.marker && sc.marker.alt > -0.5) test(this.ring.pos[3], this.ring.pos[4], this.ring.pos[5], 0, () => ({ kind: 'marker' }));
    for (let i = 0; i < sc.stars.n; i++) {
      if (this.stars.alpha[i] < 0.15) continue;
      test(this.stars.pos[3 * i], this.stars.pos[3 * i + 1], this.stars.pos[3 * i + 2], this.mags[i] * 0.5, () => ({ kind: 'star', index: i }));
    }
    return best;
  }

  private schedule(): void {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  private render(): void {
    if (this.disposed || !this.w) return;
    this.scene.background = new THREE.Color(this.bg);
    const pr = this.renderer.getPixelRatio();
    this.starMat.uniforms.uPixelRatio.value = pr;
    this.ringMat.uniforms.uPixelRatio.value = pr;
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
