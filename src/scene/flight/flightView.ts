// «Bay vào vũ trụ»: khung nhìn bay tự do giữa các thiên thể thật.
//
// - Gốc tọa độ trôi (origin.ts): vị trí tuyệt đối 64 bit theo km (hệ xích đạo J2000, Mặt Trời ở gốc); máy ảnh luôn ở
//   (0, 0, 0). Bộ đệm độ sâu logarit cho phép vẽ cùng lúc vật cách 1 km và 10¹⁶ km.
// - Sao: một lớp điểm riêng (vẽ trước, như vòm trời quanh máy ảnh). Mỗi khi máy ảnh di chuyển, hướng và cấp sao biểu
//   kiến của từng sao được tính lại từ vị trí 3D thật (thị sai Hipparcos), nên chòm sao méo đi khi bay ra xa.
// - Thiên thể gần: hình cầu đa giác thấp (procedural.ts), nhãn CSS2D.
// - Điều khiển: quay quanh thiên thể đang chọn (kéo, cuộn, chụm hai ngón), bay tự do (W A S D R F, nút giữ để tiến/lùi),
//   bay tới thiên thể (đường đi theo khoảng cách logarit). Không cấp phát trong frame().

import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { cosD, sinD } from '../../astro/math';
import { AU_KM, moonGeo, planetHelio, planetOrbit, planetOrbitPoint, PLANET_IDS } from '../../astro/planets';
import { orbitPoint } from '../../astro/planets';
import { J2000 } from '../../astro/time';
import {
  absoluteMagnitude,
  blackbodyRgb,
  bvToTeff,
  equilibriumTemp,
  mulberry32,
  PC_KM,
  planetClass,
  R_SUN_KM,
  seedOf,
  starPhysics,
  T_SUN,
  type PlanetClass,
} from '../../astro/stellar';
import { BODIES, BODY_BY_ID, type BodyId, type BodyInfo } from '../../data/bodies';
import { catalogArrays, nameOf } from '../../data/catalog';
import type { FigureMap } from '../../data/constellations';
import type { ExoPlanet, FlightData } from '../../data/flightData';
import type { QualitySettings, QualityTarget } from '../../runtime/quality';
import { COLORS } from '../colors';
import { len3, placeRelative, sub3, vec3d, type Vec3d } from './origin';
import { buildRings, buildSurface, type SurfaceLook } from './procedural';

export type ThingKind = 'body' | 'star' | 'exo';

export interface Thing {
  key: string;
  kind: ThingKind;
  name: string;
  viName?: string;
  pos: Vec3d;
  radiusKm: number;
  group: THREE.Group | null;
  label: CSS2DObject;
  labelEl: HTMLElement;
  bodyId?: BodyId;
  /** Chỉ số trong danh mục sao (kind = 'star'). */
  starIndex?: number;
  hip?: number;
  exo?: ExoPlanet;
  exoClass?: PlanetClass;
  /** Nhiệt độ cân bằng tự tính (khi kho lưu trữ không có). */
  eqtEstimate?: number;
  /** Ngoại hành tinh: độ nghiêng quỹ đạo do ứng dụng chọn (không có số đo). */
  inclChosen?: boolean;
  /** Sao: các ngoại hành tinh đã xác nhận. */
  planets?: Thing[];
}

export interface FlightOptions {
  /** Ngày Julius của mô phỏng (vị trí hành tinh, Mặt Trăng). */
  jd: number;
  /** Giờ thiên văn Greenwich (độ): hướng xoay của Trái Đất. */
  gst: number;
  lat: number;
  lon: number;
  data: FlightData;
  figures: FigureMap | null;
  /** Lục địa: true nếu (kinh độ, vĩ độ) là đất. */
  land: ((lon: number, lat: number) => boolean) | null;
  reducedMotion: boolean;
  /** Nhãn cho điểm đứng của người quan sát và trục Trái Đất. */
  text: { observer: string; axis: string };
  /** Tên quốc tế của Mặt Trời, các hành tinh và Mặt Trăng. */
  names: Record<BodyId, string>;
  /** Gọi khi thiên thể đang chọn hoặc trạng thái bay đổi. */
  onChange(): void;
}

const NEAR_STAR_AU = 20000;
const SOLAR_LABEL_AU = 300;
const EXO_LABEL_AU = 200;
const STAR_LABELS = 14;
const FOV = 50;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _zero = new THREE.Vector3();
const _zUp = new THREE.Vector3(0, 0, 1);
const _rel = vec3d();
const _tmp = vec3d();
const _rgb: [number, number, number] = [0, 0, 0];
const _ov: [number, number, number] = [0, 0, 0];

function makeLabel(text: string, cls: string): { obj: CSS2DObject; el: HTMLElement } {
  const el = document.createElement('div');
  el.className = `flight-label ${cls}`;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.center.set(0, 0.5);
  return { obj, el };
}

/** Bản thể gần Mặt Trời: tâm ở gốc, hướng cực từ (α, δ). */
function poleQuaternion(ra: number, dec: number, spinDeg: number, out: THREE.Quaternion): THREE.Quaternion {
  _v.set(cosD(dec) * cosD(ra), cosD(dec) * sinD(ra), sinD(dec));
  out.setFromUnitVectors(_zUp, _v);
  _q2.setFromAxisAngle(_zUp, (spinDeg * Math.PI) / 180);
  return out.multiply(_q2);
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Bảng màu minh họa cho ngoại hành tinh theo loại và nhiệt độ cân bằng. */
function exoPalette(cls: PlanetClass, eqt: number): [string, string] {
  const hot = eqt > 1000;
  const cold = eqt < 250;
  if (cls === 'gasGiant') return hot ? ['#b8643a', '#5a2a1c'] : cold ? ['#d9cfb4', '#a08f6c'] : ['#d8b98a', '#9a6e45'];
  if (cls === 'iceGiant' || cls === 'subNeptune') return hot ? ['#7a8fa8', '#4b5d75'] : ['#8fc3d6', '#5d93ad'];
  return hot ? ['#7a4a35', '#3e2a20'] : cold ? ['#c9cfd6', '#8f98a3'] : ['#8a8578', '#5f5a52'];
}

const LOOK_BY_CLASS: Record<PlanetClass, SurfaceLook> = { rocky: 'rocky', subNeptune: 'subNeptune', iceGiant: 'iceGiant', gasGiant: 'gasGiant' };

export class FlightView implements QualityTarget {
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.001, 1e19);
  private readonly starScene = new THREE.Scene();
  private readonly starCam = new THREE.PerspectiveCamera(FOV, 1, 0.01, 10);
  private readonly host: HTMLElement;
  private readonly opts: FlightOptions;
  private readonly ro: ResizeObserver;

  readonly things: Thing[] = [];
  private readonly byKey = new Map<string, Thing>();
  /** Thiên thể có hình 3D (Mặt Trời, hành tinh, Mặt Trăng, ngoại hành tinh) — để tính khoảng cách tới bề mặt gần nhất. */
  private readonly solid: Thing[] = [];
  private readonly orbitGroups: { group: THREE.Object3D; anchor: Vec3d }[] = [];
  /** Nhãn "Bạn ở đây" và trục Trái Đất: chỉ hiện khi máy ảnh ở gần Trái Đất. */
  private readonly earthLabels: CSS2DObject[] = [];

  // Sao
  private readonly nStars: number;
  private readonly starPos: Float64Array;
  private readonly starAbsMag: Float32Array;
  private readonly starGeo = new THREE.BufferGeometry();
  private readonly starDir: Float32Array;
  private readonly starSize: Float32Array;
  private readonly starBright: Float32Array;
  private readonly starApparent: Float32Array;
  private readonly starUncertain: Uint8Array;
  private figureGeo: THREE.BufferGeometry | null = null;
  private figurePairs: Uint16Array | null = null;
  private figureLines: THREE.LineSegments | null = null;
  private readonly starLabels: { obj: CSS2DObject; el: HTMLElement; index: number }[] = [];
  private readonly starUniforms = { uScale: { value: 1 } };

  // Sao gần nhất có hình cầu riêng (khi máy ảnh ở trong vòng NEAR_STAR_AU)
  private readonly nearStar: THREE.Mesh;
  private readonly nearGlow: THREE.Sprite;
  private nearIndex = -1;
  private readonly sunGlow: THREE.Sprite;
  private readonly light = new THREE.PointLight(0xffffff, 2.6, 0, 0);

  // Máy ảnh
  readonly camPos = vec3d();
  private readonly camQuat = new THREE.Quaternion();
  focus: Thing | null = null;
  /** Thiên thể đang được chọn (bảng thông tin); có thể khác focus khi chưa bay tới. */
  selected: Thing | null = null;
  mode: 'orbit' | 'free' = 'orbit';
  private yaw = 0;
  private pitch = 0;
  private dist = 1;
  private travel: {
    target: Thing;
    from: Vec3d;
    dir: Vec3d;
    r0: number;
    r1: number;
    t: number;
    dur: number;
    q0: THREE.Quaternion;
  } | null = null;
  private readonly keys = new Set<string>();
  private hold = 0;
  private dirty = true;
  private moved = true;
  private width = 0;
  private height = 0;
  private pixelRatioCap = 2;
  private labelTick = 0;
  /** Khoảng cách tới bề mặt gần nhất (km), cập nhật mỗi khung hình. */
  nearestSurfaceKm = 0;
  /** Tốc độ bay hiện tại (km/s) khi bay tự do. */
  speedKmS = 0;
  showOrbits = true;
  showFigures = true;

  constructor(host: HTMLElement, opts: FlightOptions) {
    this.host = host;
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'flight__labels';
    host.appendChild(this.labelRenderer.domElement);
    this.camera.up.set(0, 0, 1);
    this.starCam.up.set(0, 0, 1);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.16));
    this.scene.add(this.light);

    // ---------------------------------------------------------------- Sao trong danh mục
    const cat = catalogArrays();
    const n = cat.ra.length;
    this.nStars = n;
    this.starPos = new Float64Array(n * 3);
    this.starAbsMag = new Float32Array(n);
    this.starUncertain = new Uint8Array(n);
    this.starDir = new Float32Array((n + 1) * 3);
    this.starSize = new Float32Array(n + 1);
    this.starBright = new Float32Array(n + 1);
    this.starApparent = new Float32Array(n + 1);
    const colors = new Float32Array((n + 1) * 3);
    for (let i = 0; i < n; i++) {
      const hip = cat.hip[i];
      let pc = opts.data.distancePc(hip);
      if (opts.data.distanceUncertain(hip)) this.starUncertain[i] = 1;
      // Không có thị sai dương: đặt sao ở 500 pc (đánh dấu "khoảng cách chưa chắc chắn").
      if (pc === null) pc = 500;
      const ra = cat.ra[i];
      const dec = cat.dec[i];
      const d = pc * PC_KM;
      this.starPos[i * 3] = d * cosD(dec) * cosD(ra);
      this.starPos[i * 3 + 1] = d * cosD(dec) * sinD(ra);
      this.starPos[i * 3 + 2] = d * sinD(dec);
      this.starAbsMag[i] = absoluteMagnitude(cat.mag[i], 1000 / pc);
      blackbodyRgb(bvToTeff(cat.bv[i]), _rgb);
      colors.set(_rgb, i * 3);
    }
    // Mặt Trời cũng là một điểm sáng khi nhìn từ xa (chỉ số n).
    blackbodyRgb(T_SUN, _rgb);
    colors.set(_rgb, n * 3);
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(this.starDir, 3).setUsage(THREE.DynamicDrawUsage));
    this.starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.starGeo.setAttribute('size', new THREE.BufferAttribute(this.starSize, 1).setUsage(THREE.DynamicDrawUsage));
    this.starGeo.setAttribute('bright', new THREE.BufferAttribute(this.starBright, 1).setUsage(THREE.DynamicDrawUsage));
    this.starGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    const starMat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float bright;
        varying vec3 vColor;
        varying float vBright;
        uniform float uScale;
        void main() {
          vColor = color;
          vBright = bright;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vBright;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.0, r);
          a = a * a * vBright;
          gl_FragColor = vec4(vColor * a, a);
        }`,
      vertexColors: true,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(this.starGeo, starMat);
    points.frustumCulled = false;
    this.starScene.add(points);
    for (let i = 0; i < STAR_LABELS; i++) {
      const { obj, el } = makeLabel('', 'flight-label--star');
      obj.visible = false;
      this.scene.add(obj);
      this.starLabels.push({ obj, el, index: -1 });
    }
    if (opts.figures) this.buildFigures(opts.figures);

    // ---------------------------------------------------------------- Hệ Mặt Trời
    const glow = glowTexture();
    const sunInfo = BODY_BY_ID.sun;
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffd27a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    for (const info of BODIES) this.addBody(info);
    this.byKey.get('body:sun')!.group!.add(this.sunGlow);
    this.sunGlow.scale.setScalar(sunInfo.radiusKm * 8);
    this.addSolarOrbits();
    this.addObserver();

    // ---------------------------------------------------------------- Sao gần và ngoại hành tinh
    this.nearStar = new THREE.Mesh(
      buildSurface({ id: 'near-star', look: 'cloudy', palette: ['#ffffff', '#dddddd'], detail: 8 }),
      new THREE.MeshBasicMaterial({ vertexColors: true }),
    );
    this.nearGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.nearStar.visible = this.nearGlow.visible = false;
    this.scene.add(this.nearStar, this.nearGlow);
    this.addExoplanets();

    // ---------------------------------------------------------------- Bắt đầu: phía trên điểm đứng của người quan sát
    const earth = this.byKey.get('body:earth')!;
    this.focus = this.selected = earth;
    const lst = opts.gst + opts.lon;
    this.yaw = lst;
    this.pitch = opts.lat;
    this.dist = earth.radiusKm * 3.6;
    this.applyOrbit();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.bindInput();
  }

  // ================================================================ Dựng cảnh

  private addThing(t: Thing): Thing {
    this.things.push(t);
    this.byKey.set(t.key, t);
    return t;
  }

  private addBody(info: BodyInfo): void {
    const name = info.id;
    const pos = vec3d();
    if (info.id === 'moon') {
      const earthPos = this.byKey.get('body:earth')!.pos;
      moonGeo(this.opts.jd, _ov);
      pos.set([earthPos[0] + _ov[0] * AU_KM, earthPos[1] + _ov[1] * AU_KM, earthPos[2] + _ov[2] * AU_KM]);
    } else if (info.id !== 'sun') {
      planetHelio(info.id, this.opts.jd, _ov);
      pos.set([_ov[0] * AU_KM, _ov[1] * AU_KM, _ov[2] * AU_KM]);
    }
    const group = new THREE.Group();
    const look: SurfaceLook = info.look === 'star' ? 'cloudy' : info.look;
    const detail = info.look === 'gasGiant' || info.look === 'iceGiant' ? 14 : info.look === 'star' ? 10 : 9;
    const geo = buildSurface({ id: name, look, palette: info.palette, detail, land: info.id === 'earth' ? (this.opts.land ?? undefined) : undefined });
    const mat =
      info.look === 'star'
        ? new THREE.MeshBasicMaterial({ vertexColors: true })
        : new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.setScalar(info.radiusKm);
    // Trái Đất xoay theo giờ thiên văn Greenwich để điểm đứng của người quan sát ở đúng chỗ; các thân khác chọn góc
    // tự quay theo hạt giống (không có số liệu).
    const spin = info.id === 'earth' ? this.opts.gst : mulberry32(seedOf(name))() * 360;
    poleQuaternion(info.poleRa, info.poleDec, spin, mesh.quaternion);
    group.add(mesh);
    if (info.rings) {
      const rings = buildRings(info.rings, '#d8c79c');
      rings.quaternion.copy(mesh.quaternion);
      group.add(rings);
    }
    this.scene.add(group);
    const { obj, el } = makeLabel(this.opts.names[info.id], 'flight-label--body');
    group.add(obj);
    const thing = this.addThing({ key: `body:${name}`, kind: 'body', name: this.opts.names[info.id], pos, radiusKm: info.radiusKm, group, label: obj, labelEl: el, bodyId: info.id });
    this.solid.push(thing);
  }

  private orbitLine(points: Float32Array, color: string, opacity: number, closed: boolean): THREE.Line {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return closed ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat);
  }

  private addSolarOrbits(): void {
    const sunAnchor = this.byKey.get('body:sun')!.pos;
    const g = new THREE.Group();
    for (const id of PLANET_IDS) {
      const orbit = planetOrbit(id, this.opts.jd);
      const pts = new Float32Array(256 * 3);
      for (let i = 0; i < 256; i++) {
        planetOrbitPoint(orbit, (i / 256) * 360, _ov);
        pts[i * 3] = _ov[0] * AU_KM;
        pts[i * 3 + 1] = _ov[1] * AU_KM;
        pts[i * 3 + 2] = _ov[2] * AU_KM;
      }
      g.add(this.orbitLine(pts, COLORS.grid, 0.55, true));
    }
    this.scene.add(g);
    this.orbitGroups.push({ group: g, anchor: sunAnchor });
    // Quỹ đạo Mặt Trăng: đường đi thật trong 27,3 ngày trước thời điểm đang xem (so với Trái Đất).
    const earth = this.byKey.get('body:earth')!;
    const m = new THREE.Group();
    const pts = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      moonGeo(this.opts.jd - 27.32 + (i / 159) * 27.32, _ov);
      pts[i * 3] = _ov[0] * AU_KM;
      pts[i * 3 + 1] = _ov[1] * AU_KM;
      pts[i * 3 + 2] = _ov[2] * AU_KM;
    }
    m.add(this.orbitLine(pts, COLORS.grid, 0.5, false));
    this.scene.add(m);
    this.orbitGroups.push({ group: m, anchor: earth.pos });
  }

  /** Trục quay Trái Đất (hướng về Polaris) và điểm đứng của người quan sát. */
  private addObserver(): void {
    const earth = this.byKey.get('body:earth')!;
    const mesh = earth.group!.children[0] as THREE.Mesh;
    const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -1.5), new THREE.Vector3(0, 0, 2.6)]);
    const axis = new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: COLORS.axis }));
    mesh.add(axis);
    const tip = makeLabel(this.opts.text.axis, 'flight-label--axis');
    tip.obj.position.set(0, 0, 2.6);
    mesh.add(tip.obj);
    this.earthLabels.push(tip.obj);
    // Điểm đứng: kinh độ, vĩ độ trong khung riêng của Trái Đất (kinh độ 0 ở trục +x).
    const { lat, lon } = this.opts;
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: COLORS.zenith }));
    pin.position.set(cosD(lat) * cosD(lon) * 1.012, cosD(lat) * sinD(lon) * 1.012, sinD(lat) * 1.012);
    mesh.add(pin);
    const lbl = makeLabel(this.opts.text.observer, 'flight-label--observer');
    pin.add(lbl.obj);
    this.earthLabels.push(lbl.obj);
  }

  private buildFigures(figures: FigureMap): void {
    const cat = catalogArrays();
    const byHip = new Map<number, number>();
    cat.hip.forEach((h, i) => byHip.set(h, i));
    const pairs: number[] = [];
    for (const fig of Object.values(figures)) {
      for (const [a, b] of fig.segs) {
        const ia = byHip.get(fig.stars[a]?.[3] ?? 0);
        const ib = byHip.get(fig.stars[b]?.[3] ?? 0);
        if (ia !== undefined && ib !== undefined) pairs.push(ia, ib);
      }
    }
    this.figurePairs = Uint16Array.from(pairs);
    this.figureGeo = new THREE.BufferGeometry();
    this.figureGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs.length * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.figureGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this.figureLines = new THREE.LineSegments(
      this.figureGeo,
      new THREE.LineBasicMaterial({ color: COLORS.figureSky, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false }),
    );
    this.figureLines.frustumCulled = false;
    this.starScene.add(this.figureLines);
  }

  /** Tạo (một lần) Thing cho một sao trong danh mục. */
  starThing(index: number): Thing {
    const cat = catalogArrays();
    const hip = cat.hip[index];
    const key = `star:${hip}`;
    const existing = this.byKey.get(key);
    if (existing) return existing;
    const nm = nameOf(hip);
    const pos = vec3d(this.starPos[index * 3], this.starPos[index * 3 + 1], this.starPos[index * 3 + 2]);
    const plx = this.opts.data.distancePc(hip);
    const phys = starPhysics(cat.mag[index], cat.bv[index], plx ? 1000 / plx : 2);
    const { obj, el } = makeLabel(nm.label, 'flight-label--target');
    obj.visible = false;
    this.scene.add(obj);
    return this.addThing({ key, kind: 'star', name: nm.label, viName: nm.viName, pos, radiusKm: phys.radius * R_SUN_KM, group: null, label: obj, labelEl: el, starIndex: index, hip });
  }

  private addExoplanets(): void {
    const cat = catalogArrays();
    const byHip = new Map<number, number>();
    cat.hip.forEach((h, i) => byHip.set(h, i));
    const byHost = new Map<number, ExoPlanet[]>();
    for (const p of this.opts.data.exo.planets) {
      if (!byHip.has(p.hip)) continue;
      const list = byHost.get(p.hip) ?? [];
      list.push(p);
      byHost.set(p.hip, list);
    }
    for (const [hip, planets] of byHost) {
      const host = this.starThing(byHip.get(hip)!);
      host.planets = [];
      const index = host.starIndex!;
      // Hướng quỹ đạo: mặt phẳng bầu trời của sao chủ (vuông góc với hướng nhìn từ Trái Đất), góc nút và (khi không có
      // số đo) độ nghiêng do ứng dụng chọn theo hạt giống của tên sao chủ — các hành tinh cùng hệ chung một mặt phẳng.
      const rand = mulberry32(seedOf(planets[0].host));
      const node = rand() * 360;
      const inclShared = (Math.acos(1 - 2 * rand()) * 180) / Math.PI;
      const los = _v.set(host.pos[0], host.pos[1], host.pos[2]).normalize().clone();
      const e1 = _v2.set(-los.y, los.x, 0).normalize().clone();
      const e2 = new THREE.Vector3().crossVectors(los, e1);
      const cls0 = bvToTeff(cat.bv[index]);
      const anchor = host.pos;
      const og = new THREE.Group();
      for (const p of planets) {
        const prand = mulberry32(seedOf(p.name));
        const argPeri = prand() * 360;
        const M0 = prand() * 360;
        const incl = p.incl ?? inclShared;
        const ecc = p.ecc ?? 0;
        const M = M0 + (360 * (this.opts.jd - J2000)) / p.per;
        const toWorld = (v: [number, number, number], out: Float64Array | Float32Array, o: number, base: ArrayLike<number> | null) => {
          const x = (v[0] * e1.x + v[1] * e2.x + v[2] * los.x) * AU_KM;
          const y = (v[0] * e1.y + v[1] * e2.y + v[2] * los.y) * AU_KM;
          const z = (v[0] * e1.z + v[1] * e2.z + v[2] * los.z) * AU_KM;
          out[o] = x + (base ? base[0] : 0);
          out[o + 1] = y + (base ? base[1] : 0);
          out[o + 2] = z + (base ? base[2] : 0);
        };
        orbitPoint(p.a, ecc, incl, node, argPeri, M, _ov);
        const pos = vec3d();
        toWorld(_ov, pos, 0, anchor);
        const pts = new Float32Array(160 * 3);
        for (let i = 0; i < 160; i++) {
          orbitPoint(p.a, ecc, incl, node, argPeri, (i / 160) * 360, _ov);
          toWorld(_ov, pts, i * 3, null);
        }
        og.add(this.orbitLine(pts, COLORS.figure, 0.4, true));
        const cls = planetClass(p.rade, p.masse);
        const teff = p.hostTeff ?? cls0;
        const eqtEstimate = p.eqt ?? equilibriumTemp(teff, p.hostRad ?? 1, p.a);
        const radiusKm = (p.rade ?? (cls === 'gasGiant' ? 11 : 2)) * 6371;
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(
          buildSurface({ id: p.name, look: LOOK_BY_CLASS[cls], palette: exoPalette(cls, eqtEstimate), detail: cls === 'rocky' ? 9 : 14 }),
          new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }),
        );
        mesh.scale.setScalar(radiusKm);
        group.add(mesh);
        this.scene.add(group);
        const { obj, el } = makeLabel(p.name, 'flight-label--body');
        group.add(obj);
        const t = this.addThing({
          key: `exo:${p.name}`,
          kind: 'exo',
          name: p.name,
          pos,
          radiusKm,
          group,
          label: obj,
          labelEl: el,
          exo: p,
          exoClass: cls,
          eqtEstimate: p.eqt == null ? eqtEstimate : undefined,
          inclChosen: p.incl == null,
          hip,
        });
        this.solid.push(t);
        host.planets.push(t);
      }
      this.scene.add(og);
      this.orbitGroups.push({ group: og, anchor });
    }
  }

  // ================================================================ Truy vấn cho bảng điều khiển

  get(key: string): Thing | undefined {
    return this.byKey.get(key);
  }

  /** Sao có ngoại hành tinh, theo khoảng cách tăng dần. */
  hosts(): Thing[] {
    return this.things.filter((t) => t.kind === 'star' && t.planets?.length).sort((a, b) => len3(a.pos) - len3(b.pos));
  }

  isUncertain(t: Thing): boolean {
    return t.starIndex !== undefined && this.starUncertain[t.starIndex] === 1;
  }

  /** Khoảng cách từ máy ảnh tới tâm thiên thể (km). */
  distanceTo(t: Thing): number {
    return len3(sub3(t.pos, this.camPos, _tmp));
  }

  get traveling(): boolean {
    return this.travel !== null;
  }

  // ================================================================ Điều khiển

  select(t: Thing | null): void {
    this.selected = t;
    this.dirty = true;
    this.opts.onChange();
  }

  /** Khoảng cách dừng khi bay tới một thiên thể: đủ thấy cả thân (và cả hệ hành tinh với sao chủ). */
  private standoff(t: Thing): number {
    if (t.kind === 'star' && t.planets?.length) {
      let maxA = 0;
      for (const p of t.planets) maxA = Math.max(maxA, p.exo!.a);
      return Math.max(t.radiusKm * 6, maxA * AU_KM * 2.6);
    }
    if (t.bodyId === 'sun') return t.radiusKm * 6;
    if (t.bodyId === 'saturn') return t.radiusKm * 6.5;
    return t.radiusKm * (t.kind === 'star' ? 8 : 3.6);
  }

  flyTo(t: Thing): void {
    this.selected = t;
    const r1 = this.standoff(t);
    const rel = sub3(this.camPos, t.pos, vec3d());
    let r0 = len3(rel);
    if (r0 < 1e-6) {
      rel.set([0, -1, 0.3]);
      r0 = len3(rel);
    }
    const dir = Float64Array.of(rel[0] / r0, rel[1] / r0, rel[2] / r0);
    // Nhìn hơi chếch từ trên xuống mặt phẳng xích đạo để thấy rõ khối cầu và vành đai.
    if (Math.abs(dir[2]) < 0.25) {
      dir[2] += 0.3;
      const l = len3(dir);
      dir[0] /= l;
      dir[1] /= l;
      dir[2] /= l;
    }
    if (this.opts.reducedMotion) {
      this.arrive(t, dir, r1);
      return;
    }
    const decades = Math.abs(Math.log10(Math.max(r0, 1) / r1));
    this.travel = {
      target: t,
      from: Float64Array.from(this.camPos),
      dir,
      r0: Math.max(r0, r1),
      r1,
      t: 0,
      dur: Math.min(7, Math.max(1.6, 1.2 + decades * 0.45)),
      q0: this.camQuat.clone(),
    };
    this.mode = 'orbit';
    this.focus = t;
    this.dirty = true;
    this.opts.onChange();
  }

  /** Dừng chuyến bay đang diễn ra (Esc); trả về true nếu có chuyến bay để dừng. */
  cancelTravel(): boolean {
    if (!this.travel) return false;
    const t = this.travel.target;
    this.travel = null;
    this.focusOn(t);
    this.opts.onChange();
    return true;
  }

  private arrive(t: Thing, dir: ArrayLike<number>, r: number): void {
    this.travel = null;
    this.focus = t;
    this.selected = t;
    this.mode = 'orbit';
    this.dist = r;
    this.yaw = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
    this.pitch = (Math.asin(Math.max(-1, Math.min(1, dir[2]))) * 180) / Math.PI;
    this.applyOrbit();
    this.opts.onChange();
  }

  /** Quay quanh t từ vị trí máy ảnh hiện tại (không bay). */
  focusOn(t: Thing): void {
    const rel = sub3(this.camPos, t.pos, _tmp);
    const r = len3(rel);
    this.focus = t;
    this.mode = 'orbit';
    this.dist = Math.max(r, this.minDist(t));
    this.yaw = (Math.atan2(rel[1], rel[0]) * 180) / Math.PI;
    this.pitch = (Math.asin(Math.max(-1, Math.min(1, rel[2] / (r || 1)))) * 180) / Math.PI;
    this.applyOrbit();
  }

  private minDist(t: Thing): number {
    return t.radiusKm * 1.15 + 50;
  }

  private applyOrbit(): void {
    const f = this.focus;
    if (!f) return;
    const cp = cosD(this.pitch);
    this.camPos[0] = f.pos[0] + this.dist * cp * cosD(this.yaw);
    this.camPos[1] = f.pos[1] + this.dist * cp * sinD(this.yaw);
    this.camPos[2] = f.pos[2] + this.dist * sinD(this.pitch);
    this.lookAt(f.pos, this.camQuat);
    this.moved = this.dirty = true;
  }

  /** Hướng máy ảnh về một điểm tuyệt đối, trục +z (cực Bắc thiên cầu) hướng lên. */
  private lookAt(target: ArrayLike<number>, out: THREE.Quaternion): void {
    _v.set(target[0] - this.camPos[0], target[1] - this.camPos[1], target[2] - this.camPos[2]);
    const up = Math.abs(_v.z) > 0.999 * _v.length() ? _v2.set(0, 1, 0) : _zUp;
    _m.lookAt(_zero, _v, up);
    out.setFromRotationMatrix(_m);
  }

  setHold(dir: -1 | 0 | 1): void {
    this.hold = dir;
    if (dir !== 0) this.toFree();
  }

  private toFree(): void {
    if (this.travel) return;
    if (this.mode !== 'free') {
      this.mode = 'free';
      this.opts.onChange();
    }
  }

  private bindInput(): void {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    const pointers = new Map<number, { x: number; y: number }>();
    let downX = 0;
    let downY = 0;
    let pinch = 0;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      downX = e.clientX;
      downY = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.travel) return;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) this.zoom(Math.log(pinch / d) * 2.2);
        pinch = d;
        return;
      }
      if (this.mode === 'orbit' && this.focus) {
        this.yaw -= dx * 0.3;
        this.pitch = Math.max(-89, Math.min(89, this.pitch + dy * 0.3));
        this.applyOrbit();
      } else {
        // Bay tự do: kéo để nhìn quanh (quay quanh trục của chính máy ảnh).
        _q.setFromAxisAngle(_v.set(0, 1, 0), dx * 0.004);
        this.camQuat.multiply(_q);
        _q.setFromAxisAngle(_v.set(1, 0, 0), dy * 0.004);
        this.camQuat.multiply(_q).normalize();
        this.moved = this.dirty = true;
      }
    });
    const end = (e: PointerEvent) => {
      const wasTap = pointers.size === 1 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (wasTap && e.type === 'pointerup') {
        const t = this.pick(e.clientX, e.clientY);
        if (t) this.select(t);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', (e) => {
      const t = this.pick(e.clientX, e.clientY);
      if (t) this.flyTo(t);
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!this.travel) this.zoom(e.deltaY * 0.0015);
      },
      { passive: false },
    );
  }

  /** Cuộn/chụm: quay quanh → đổi khoảng cách theo hàm mũ; bay tự do → tiến/lùi một bước. */
  private zoom(amount: number): void {
    if (this.mode === 'orbit' && this.focus) {
      this.dist = Math.min(3e17, Math.max(this.minDist(this.focus), this.dist * Math.exp(amount)));
      this.applyOrbit();
    } else {
      const step = -Math.max(this.nearestSurfaceKm, 100) * amount * 2;
      this.moveLocal(0, 0, -step);
    }
  }

  keyDown(code: string): boolean {
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'ShiftLeft', 'ShiftRight'].includes(code)) return false;
    this.keys.add(code);
    if (!code.startsWith('Shift')) this.toFree();
    return true;
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  /** Dịch máy ảnh theo trục của chính nó (km). */
  private moveLocal(x: number, y: number, z: number): void {
    _v.set(x, y, z).applyQuaternion(this.camQuat);
    this.camPos[0] += _v.x;
    this.camPos[1] += _v.y;
    this.camPos[2] += _v.z;
    this.moved = this.dirty = true;
  }

  // ================================================================ Khung hình

  private resize(): void {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = this.starCam.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.starCam.updateProjectionMatrix();
    this.starUniforms.uScale.value = this.renderer.getPixelRatio();
    this.dirty = true;
  }

  setQuality(q: QualitySettings): void {
    this.pixelRatioCap = q.pixelRatioCap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap));
    this.width = 0;
    this.resize();
  }

  /** Tiến một bước thời gian dt (giây) và vẽ nếu cần; trả về true nếu đã vẽ. */
  frame(dt: number): boolean {
    this.step(dt);
    if (!this.dirty || this.width === 0) return false;
    this.dirty = false;
    if (this.moved) {
      this.moved = false;
      this.updateStars();
      this.updateNearStar();
    }
    this.placeAll();
    this.camera.quaternion.copy(this.camQuat);
    this.starCam.quaternion.copy(this.camQuat);
    this.camera.updateMatrixWorld();
    this.starCam.updateMatrixWorld();
    this.renderer.clear();
    this.renderer.render(this.starScene, this.starCam);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    return true;
  }

  private step(dt: number): void {
    const tr = this.travel;
    if (tr) {
      tr.t = Math.min(1, tr.t + dt / tr.dur);
      const s = tr.t * tr.t * (3 - 2 * tr.t);
      // Khoảng cách tới đích giảm theo cấp số nhân (đi nhanh khi còn xa, chậm lại khi gần), hướng đến từ điểm xuất phát.
      const r = tr.r0 * (tr.r1 / tr.r0) ** s;
      const fromRel = sub3(tr.from, tr.target.pos, _tmp);
      const fromLen = len3(fromRel) || 1;
      for (let i = 0; i < 3; i++) {
        const d = (1 - s) * (fromRel[i] / fromLen) + s * tr.dir[i];
        _ov[i] = d;
      }
      const l = Math.hypot(_ov[0], _ov[1], _ov[2]) || 1;
      for (let i = 0; i < 3; i++) this.camPos[i] = tr.target.pos[i] + (_ov[i] / l) * r;
      this.lookAt(tr.target.pos, _q);
      this.camQuat.slerpQuaternions(tr.q0, _q, Math.min(1, tr.t * 3));
      this.moved = this.dirty = true;
      if (tr.t >= 1) this.arrive(tr.target, tr.dir, tr.r1);
      return;
    }
    // Bay tự do: tốc độ tỉ lệ với khoảng cách tới bề mặt gần nhất (gần thì chậm, xa thì nhanh).
    let fwd = this.hold;
    if (this.keys.has('KeyW')) fwd += 1;
    if (this.keys.has('KeyS')) fwd -= 1;
    const side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const up = (this.keys.has('KeyR') ? 1 : 0) - (this.keys.has('KeyF') ? 1 : 0);
    if (fwd || side || up) {
      const boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 4 : 1;
      this.speedKmS = Math.max(this.nearestSurfaceKm, 100) * 0.9 * boost;
      const d = this.speedKmS * dt;
      this.moveLocal(side * d, up * d, -fwd * d);
    } else this.speedKmS = 0;
  }

  /** Đặt mọi vật theo vị trí tương đối với máy ảnh và cập nhật nhãn (nhãn sao 4 lần/giây). */
  private placeAll(): void {
    const cam = this.camPos;
    let nearest = Infinity;
    for (let i = 0; i < this.solid.length; i++) {
      const t = this.solid[i];
      placeRelative(t.group!, t.pos, cam);
      const d = len3(sub3(t.pos, cam, _rel)) - t.radiusKm;
      if (d < nearest) nearest = d;
    }
    if (this.nearIndex >= 0) {
      const d = this.nearStar.position.length() - this.nearStar.scale.x;
      if (d < nearest) nearest = d;
    }
    this.nearestSurfaceKm = Math.max(1, nearest);
    for (const o of this.orbitGroups) {
      placeRelative(o.group, o.anchor, cam);
      o.group.visible = this.showOrbits;
    }
    // Mặt Trời và sao gần nhất chiếu sáng; đèn đặt ở nguồn sáng gần hơn.
    const sunD = len3(cam);
    if (this.nearIndex >= 0 && this.nearStar.position.length() < sunD) this.light.position.copy(this.nearStar.position);
    else this.light.position.set(-cam[0], -cam[1], -cam[2]);

    // Nhãn: thân trong Hệ Mặt Trời khi ở gần, ngoại hành tinh khi ở gần sao chủ, luôn hiện thiên thể đang chọn.
    const inSolar = sunD < SOLAR_LABEL_AU * AU_KM;
    const nearEarth = this.distanceTo(this.byKey.get('body:earth')!) < 2e6;
    for (const l of this.earthLabels) l.visible = nearEarth;
    for (const t of this.things) {
      let show = t === this.selected || t === this.focus;
      if (!show && t.kind === 'body') show = inSolar && (t.bodyId !== 'moon' || this.distanceTo(t) < 3e6);
      else if (!show && t.kind === 'exo') show = this.distanceTo(t) < EXO_LABEL_AU * AU_KM;
      if (t.label.visible !== show) t.label.visible = show;
      if (!t.group) placeRelative(t.label, t.pos, cam);
      t.labelEl.classList.toggle('is-selected', t === this.selected);
    }
    if (++this.labelTick % 15 === 1 || this.travel === null) this.updateStarLabels();
  }

  private updateStars(): void {
    const cam = this.camPos;
    const n = this.nStars;
    for (let i = 0; i <= n; i++) {
      let x: number;
      let y: number;
      let z: number;
      let absMag: number;
      if (i < n) {
        x = this.starPos[i * 3] - cam[0];
        y = this.starPos[i * 3 + 1] - cam[1];
        z = this.starPos[i * 3 + 2] - cam[2];
        absMag = this.starAbsMag[i];
      } else {
        x = -cam[0];
        y = -cam[1];
        z = -cam[2];
        absMag = 4.83;
      }
      const d = Math.hypot(x, y, z) || 1;
      this.starDir[i * 3] = x / d;
      this.starDir[i * 3 + 1] = y / d;
      this.starDir[i * 3 + 2] = z / d;
      const m = absMag + 5 * Math.log10(d / PC_KM) - 5;
      this.starApparent[i] = m;
      // Sao rất gần đã có hình cầu và quầng sáng riêng: ẩn điểm sáng.
      const hidePoint = i === this.nearIndex || (i === n && d < NEAR_STAR_AU * AU_KM);
      this.starSize[i] = hidePoint ? 0 : Math.min(11, Math.max(0, 2 + (6.5 - m) * 0.9));
      this.starBright[i] = hidePoint ? 0 : Math.min(1, Math.max(0, (6.8 - m) / 3));
    }
    (this.starGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.starGeo.getAttribute('size') as THREE.BufferAttribute).needsUpdate = true;
    (this.starGeo.getAttribute('bright') as THREE.BufferAttribute).needsUpdate = true;
    if (this.figureGeo && this.figurePairs && this.figureLines) {
      this.figureLines.visible = this.showFigures;
      const arr = (this.figureGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const p = this.figurePairs;
      const d = this.starDir;
      for (let k = 0; k < p.length; k += 2) {
        const a = p[k] * 3;
        const b = p[k + 1] * 3;
        // Hai đầu cách nhau hơn 30° trên bầu trời (nhìn từ Trái Đất, đoạn dài nhất là 25,6°, ở Carina): khi bay ra xa,
        // đoạn đó chỉ còn là một vệt cắt ngang khung nhìn chứ không còn là hình chòm sao, nên bỏ đi.
        const keep = d[a] * d[b] + d[a + 1] * d[b + 1] + d[a + 2] * d[b + 2] > 0.866;
        arr[k * 3] = d[a];
        arr[k * 3 + 1] = d[a + 1];
        arr[k * 3 + 2] = d[a + 2];
        arr[k * 3 + 3] = keep ? d[b] : d[a];
        arr[k * 3 + 4] = keep ? d[b + 1] : d[a + 1];
        arr[k * 3 + 5] = keep ? d[b + 2] : d[a + 2];
      }
      (this.figureGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  /** Sao trong danh mục gần máy ảnh nhất: nếu trong vòng NEAR_STAR_AU thì vẽ thành khối cầu phát sáng. */
  private updateNearStar(): void {
    const cam = this.camPos;
    let best = -1;
    let bestD = NEAR_STAR_AU * AU_KM;
    for (let i = 0; i < this.nStars; i++) {
      const d = Math.hypot(this.starPos[i * 3] - cam[0], this.starPos[i * 3 + 1] - cam[1], this.starPos[i * 3 + 2] - cam[2]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best !== this.nearIndex) {
      this.nearIndex = best;
      if (best >= 0) {
        const t = this.starThing(best);
        const cat = catalogArrays();
        blackbodyRgb(bvToTeff(cat.bv[best]), _rgb);
        (this.nearStar.material as THREE.MeshBasicMaterial).color.setRGB(_rgb[0], _rgb[1], _rgb[2]);
        (this.nearGlow.material as THREE.SpriteMaterial).color.setRGB(_rgb[0], _rgb[1], _rgb[2]);
        this.nearStar.scale.setScalar(t.radiusKm);
        this.nearGlow.scale.setScalar(t.radiusKm * 8);
      }
      this.nearStar.visible = this.nearGlow.visible = best >= 0;
    }
    if (best >= 0) {
      const o = best * 3;
      this.nearStar.position.set(this.starPos[o] - cam[0], this.starPos[o + 1] - cam[1], this.starPos[o + 2] - cam[2]);
      this.nearGlow.position.copy(this.nearStar.position);
      // Quầng sáng giữ cỡ tối thiểu (khoảng 2° góc nhìn) để sao chủ vẫn thấy được khi đứng xa vài AU.
      this.nearGlow.scale.setScalar(Math.max(this.nearStar.scale.x * 8, this.nearStar.position.length() * 0.035));
    }
    // Quầng sáng Mặt Trời giữ kích thước tối thiểu khi nhìn từ xa.
    const sunD = len3(cam);
    this.sunGlow.scale.setScalar(Math.max(BODY_BY_ID.sun.radiusKm * 8, sunD * 0.02));
  }

  /** Nhãn cho các sao có tên sáng nhất (theo cấp sao biểu kiến từ vị trí máy ảnh). */
  private updateStarLabels(): void {
    const cat = catalogArrays();
    const used = this.starLabels;
    // Chọn STAR_LABELS sao có tên và sáng nhất (sắp xếp chèn trong mảng cố định, không cấp phát).
    let count = 0;
    for (let i = 0; i < this.nStars; i++) {
      if (this.starSize[i] === 0) continue;
      const hip = cat.hip[i];
      if (!cat.names[hip]?.[0]) continue;
      if (this.behindBody(i)) continue;
      const m = this.starApparent[i];
      if (m > 3.2) continue;
      if (count < used.length) {
        used[count++].index = i;
      } else if (m < this.starApparent[used[used.length - 1].index]) {
        used[used.length - 1].index = i;
      } else continue;
      for (let k = count - 1; k > 0 && this.starApparent[used[k].index] < this.starApparent[used[k - 1].index]; k--) {
        const tmp = used[k].index;
        used[k].index = used[k - 1].index;
        used[k - 1].index = tmp;
      }
    }
    for (let k = 0; k < used.length; k++) {
      const s = used[k];
      const on = k < count;
      s.obj.visible = on;
      if (!on) continue;
      const i = s.index;
      const text = cat.names[cat.hip[i]][0];
      if (s.el.textContent !== text) s.el.textContent = text;
      s.obj.position.set(this.starDir[i * 3] * 1e9, this.starDir[i * 3 + 1] * 1e9, this.starDir[i * 3 + 2] * 1e9);
    }
  }

  /** Hướng của sao i nằm sau đĩa của một thiên thể gần (nhãn sao không được vẽ đè lên hành tinh). */
  private behindBody(i: number): boolean {
    const dx = this.starDir[i * 3];
    const dy = this.starDir[i * 3 + 1];
    const dz = this.starDir[i * 3 + 2];
    for (let k = 0; k < this.solid.length; k++) {
      const t = this.solid[k];
      const p = t.group!.position;
      const d = p.length();
      if (d === 0 || t.radiusKm / d < 0.004) continue;
      const cos = (dx * p.x + dy * p.y + dz * p.z) / d;
      const sinR = Math.min(1, (t.radiusKm * 1.1) / d);
      if (cos > Math.sqrt(1 - sinR * sinR)) return true;
    }
    return false;
  }

  /** Thiên thể gần điểm bấm nhất (trong 18 px): thân 3D, ngoại hành tinh, rồi sao. */
  private pick(clientX: number, clientY: number): Thing | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    let best: Thing | null = null;
    let bestD = 18;
    this.camera.quaternion.copy(this.camQuat);
    this.camera.updateMatrixWorld();
    const project = (x: number, y: number, z: number): number => {
      _v.set(x, y, z).project(this.camera);
      if (_v.z > 1 || _v.z < -1) return Infinity;
      const sx = ((_v.x + 1) / 2) * rect.width;
      const sy = ((1 - _v.y) / 2) * rect.height;
      return Math.hypot(sx - px, sy - py);
    };
    for (const t of this.things) {
      if (!t.label.visible && t.kind !== 'body') continue;
      sub3(t.pos, this.camPos, _rel);
      const d = project(_rel[0], _rel[1], _rel[2]);
      // Thân lớn trên màn hình: bấm vào trong đĩa cũng chọn được.
      const r = len3(_rel);
      const discPx = ((t.radiusKm / r) * (rect.height / 2)) / Math.tan(((FOV / 2) * Math.PI) / 180);
      const dd = Math.max(0, d - discPx);
      if (dd < bestD) {
        bestD = dd;
        best = t;
      }
    }
    if (best) return best;
    let bestStar = -1;
    let bestScore = 18;
    for (let i = 0; i < this.nStars; i++) {
      if (this.starSize[i] < 2.2) continue;
      const d = project(this.starDir[i * 3] * 1e9, this.starDir[i * 3 + 1] * 1e9, this.starDir[i * 3 + 2] * 1e9);
      const score = d - this.starSize[i] * 0.5;
      if (score < bestScore) {
        bestScore = score;
        bestStar = i;
      }
    }
    return bestStar >= 0 ? this.starThing(bestStar) : null;
  }

  dispose(): void {
    this.ro.disconnect();
    for (const s of [this.scene, this.starScene]) {
      s.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
