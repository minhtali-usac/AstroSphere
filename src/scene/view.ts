// Khung nhìn 3D cơ sở: renderer WebGL + nhãn CSS2D + OrbitControls (chuột và cảm ứng), chọn sao, chú thích khi rê chuột.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Line2 } from 'three/addons/lines/Line2.js';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { emphasisGroup } from '../emphasis';
import type { QualitySettings, QualityTarget } from '../runtime/quality';
import { lstOf, type AppState, type Selection, type Store } from '../state';
import { EmphasisFx } from './emphasis';
import type { ViewKind } from './frames';
import { setFatLineStyle } from './geom';
import { GHOST_ARROW_K, HorizonLayer } from './horizonLayer';
import { declutter, EDGE, LabelBoxes } from './declutter';
import { COMPACT_SPHERE_PX, compactKeeps, type Label, type LabelData } from './labels';
import { SEL_RING_OUTER, SEL_RING_SCALE, SkyLayer } from './skyLayer';
import { TrailLayer } from './trails';

export const SKY_RADIUS = 10;

export interface HoverInfo {
  kind: 'object' | 'tip';
  sel?: NonNullable<Selection>;
  tip?: string;
}

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _local = { x: 0, y: 0 };

export abstract class View implements QualityTarget {
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly sky: SkyLayer;
  readonly horizon: HorizonLayer;
  readonly trails: TrailLayer;
  readonly R = SKY_RADIUS;
  /** Tô sáng liên kết (độ dày/độ mờ của các đường và mặt được đăng ký bởi hai lớp). */
  readonly emphasis = new EmphasisFx();
  dirty = true;
  /** Khung nhìn nằm trong vùng hiển thị của trang (IntersectionObserver). */
  onScreen = true;
  /** Tạm dừng vẽ riêng khung nhìn này. */
  suspended = false;
  /** Trần tỉ lệ điểm ảnh do chất lượng thích ứng đặt. */
  private pixelRatioCap = 2;
  private dprQuery: MediaQueryList | null = null;
  protected raycaster = new THREE.Raycaster();
  private defaultCamera: THREE.Vector3;
  private defaultTarget: THREE.Vector3;
  private width = 0;
  private height = 0;
  /** Danh sách nhãn CSS2D giữ sẵn; dựng lại khi structureVersion() đổi. */
  private labelList: Label[] = [];
  private labelKey = -1;
  /** Hộp màn hình của các nhãn đang hiện (gỡ chồng chéo) và nhãn tương ứng với từng hộp — cấp phát sẵn. */
  private boxes = new LabelBoxes();
  private boxLabel: (Label | null)[] = [];
  /** Hộp px của vòng "bóng" đã vẽ (0–3) và mũi tên mép khung (4–7) ở lần gỡ chồng chéo gần nhất; w = 0: không có. */
  private readonly ghostPx = new Float32Array(8);
  /** Hộp px của vật cản ở chân đường thẳng đứng ở lần gỡ chồng chéo gần nhất; w = 0: không có. */
  private readonly footPx = new Float32Array(4);
  private needMeasure = true;
  /** Khung thiên cầu nhỏ: chỉ giữ nhãn định hướng (labels.ts › compactKeeps, review-4 #4). Tính lại khi đổi cỡ. */
  private compactLabels = false;
  /**
   * Lớp giao diện nổi trên khung nhìn (nút "Nhìn từ người quan sát", "Góc nhìn mặc định" — fix-2 #1): hộp px tương
   * đối với canvas (x, y, w, h liên tiếp), đo khi khung hoặc nút đổi kích thước, KHÔNG đo mỗi khung hình. Nhãn né
   * các hộp này như vật cản cứng (kể cả "Thiên đỉnh").
   */
  private overlayEls: HTMLElement[] = [];
  private readonly overlayRects = new Float32Array(MAX_OVERLAYS * 4);
  private overlayN = 0;
  /** Hệ số độ dày đường hiện tại và độ dày gốc của từng đường (ghi lần đầu đổi hệ số). */
  private lineScale = 1;
  private baseWidths = new WeakMap<Line2, number>();
  /** Độ mờ gốc của các đường mảnh (LineBasicMaterial, luôn rộng 1 px) — để tăng độ đậm khi trình chiếu. */
  private baseOpacity = new WeakMap<THREE.LineBasicMaterial, number>();
  /** Nét/khe gốc của các đường đứt nét (để đổi khi trình chiếu rồi trả lại). */
  private baseDash = new WeakMap<LineMaterial, [number, number]>();
  /** Đang ở chế độ trình chiếu (máy chiếu): lớp con có thể đổi khung hình (xem preferredFov). */
  protected presenting = false;
  private hoverList: THREE.Object3D[] = [];
  private hoverKey = -1;
  /** Khóa của lần tính nhóm tô sáng gần nhất (chỉ tính lại khi khóa, đối tượng chọn, vĩ độ hoặc danh sách sao đổi). */
  private emKey: AppState['emphasis'] | undefined = undefined;
  private emSel: AppState['selected'] | undefined = undefined;
  private emLat = NaN;
  private emStars: AppState['stars'] | null = null;
  private emSun = false;
  private emSunDate = '';
  private emGroup: string | null = null;
  private reducedMotion: MediaQueryList | null = null;
  /** Lựa chọn đã thấy ở lần update() trước (undefined: chưa đồng bộ lần nào) — để biết khi nào chạy nhịp vòng chọn. */
  private pulseSel: Selection | undefined = undefined;
  readonly container: HTMLElement;
  readonly kind: ViewKind;
  protected store: Store;

  constructor(container: HTMLElement, kind: ViewKind, store: Store, defaultCamera: THREE.Vector3, defaultTarget = new THREE.Vector3()) {
    this.container = container;
    this.kind = kind;
    this.store = store;
    this.defaultCamera = defaultCamera.clone();
    this.defaultTarget = defaultTarget.clone();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.targetPixelRatio());
    this.renderer.localClippingEnabled = false;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    this.camera.position.copy(defaultCamera);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.defaultTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = this.R * 1.25;
    this.controls.maxDistance = this.R * 7;
    this.controls.rotateSpeed = 0.7;
    this.controls.addEventListener('change', () => (this.dirty = true));
    this.raycaster.params.Line = { threshold: this.R * 0.012 };
    (this.raycaster.params as unknown as Record<string, unknown>).Line2 = { threshold: 5 };

    this.sky = new SkyLayer(kind, this.R);
    this.sky.setPixelRatio(this.renderer.getPixelRatio());
    this.sky.onAsyncChange = () => (this.dirty = true);
    this.horizon = new HorizonLayer(kind, this.R);
    this.trails = new TrailLayer(this.R);
    this.sky.registerEmphasis(this.emphasis);
    this.horizon.registerEmphasis(this.emphasis);
    try {
      this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    } catch {
      this.reducedMotion = null;
    }
    // Vết sao nằm trong nhóm quay cùng bầu trời (xem trails.ts)
    this.sky.rot.add(this.trails.object);
    this.scene.add(this.sky.fixed, this.sky.rot, this.horizon.group);

    new ResizeObserver(() => this.resize()).observe(container);
    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        const on = e.isIntersecting;
        if (on && !this.onScreen) this.dirty = true;
        this.onScreen = on;
      }).observe(container);
    }
    this.watchDevicePixelRatio();
    this.resize();
  }

  private targetPixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
  }

  /** Theo dõi thay đổi devicePixelRatio (kéo cửa sổ sang màn hình khác, phóng to trang). */
  private watchDevicePixelRatio(): void {
    if (typeof window.matchMedia !== 'function') return;
    const onChange = () => {
      this.dprQuery?.removeEventListener('change', onChange);
      this.setPixelRatio(this.targetPixelRatio());
      this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      this.dprQuery.addEventListener('change', onChange);
    };
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprQuery.addEventListener('change', onChange);
  }

  /** Đặt tỉ lệ điểm ảnh cho renderer và kích thước điểm sao. */
  setPixelRatio(pr: number): void {
    if (pr === this.renderer.getPixelRatio()) return;
    this.renderer.setPixelRatio(pr);
    this.sky.setPixelRatio(pr);
    this.dirty = true;
  }

  /** QualityTarget: trần tỉ lệ điểm ảnh và giới hạn cấp sao của danh mục. */
  setQuality(q: QualitySettings): void {
    this.pixelRatioCap = q.pixelRatioCap;
    this.setPixelRatio(this.targetPixelRatio());
    this.sky.setCatalogMagLimit(q.catalogMagLimit);
    this.dirty = true;
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) {
      // Khung nhìn bị ẩn (vd. tab còn lại trên điện thoại): ghi nhận kích thước 0 để ngừng vẽ.
      this.width = 0;
      this.height = 0;
      return;
    }
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = this.preferredFov(w / h);
    this.applyViewOffset();
    this.camera.updateProjectionMatrix();
    this.measureOverlays();
    this.compactLabels = this.kind === 'sphere' && Math.min(w, h) < COMPACT_SPHERE_PX;
    this.dirty = true;
  }

  /**
   * Khai báo các phần tử giao diện nổi trên canvas (fix-2 #1). Hộp của chúng được đo ngay, khi khung nhìn đổi kích
   * thước, và khi chính chúng đổi kích thước (ResizeObserver: nút thu về chỉ còn biểu tượng, ẩn khi trình chiếu).
   */
  setOverlays(els: HTMLElement[]): void {
    this.overlayEls = els.slice(0, MAX_OVERLAYS);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.measureOverlays());
      for (const el of this.overlayEls) ro.observe(el);
    }
    this.measureOverlays();
  }

  private measureOverlays(): void {
    const els = this.overlayEls;
    if (els.length === 0 && this.overlayN === 0) return;
    const c = this.container.getBoundingClientRect();
    const r4 = this.overlayRects;
    let n = 0;
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue; // ẩn (trình chiếu, display: none)
      r4[n * 4] = r.left - c.left;
      r4[n * 4 + 1] = r.top - c.top;
      r4[n * 4 + 2] = r.width;
      r4[n * 4 + 3] = r.height;
      n++;
    }
    this.overlayN = n;
    this.dirty = true;
  }

  /** Màn hình dọc (điện thoại): mở rộng góc nhìn để vẫn thấy trọn thiên cầu. */
  protected preferredFov(aspect: number): number {
    return aspect < 0.9 ? 58 : 42;
  }

  /**
   * Dời khung hình theo chiều dọc (px, dương = cảnh lên trên) — lớp con dùng để đặt cảnh trong khung dọc. Mặc định 0.
   * Phép chiếu (nhãn, chọn sao) dùng chung projectionMatrix nên vẫn khớp.
   */
  protected viewShiftY(_aspect: number, _h: number): number {
    return 0;
  }

  protected applyViewOffset(): void {
    const dy = this.width > 0 ? this.viewShiftY(this.camera.aspect, this.height) : 0;
    if (dy === 0) this.camera.clearViewOffset();
    else this.camera.setViewOffset(this.width, this.height, 0, dy, this.width, this.height);
  }

  /** Đồng bộ toàn bộ khung nhìn với trạng thái. */
  update(s: AppState): void {
    const group = this.resolveEmphasis(s);
    this.sky.update(s, group);
    this.sky.setTime(s.lat, lstOf(s));
    this.horizon.update(s, group);
    this.trails.update(s);
    this.onUpdate(s, group);
    // Nhịp "đã chọn" (quyết định 2026-10-05): khi lựa chọn đổi sang một đối tượng — trừ lần đồng bộ đầu tiên (lựa
    // chọn mặc định lúc mở trang) và khi người dùng yêu cầu giảm chuyển động. So sánh tham chiếu, không cấp phát.
    if (s.selected !== this.pulseSel) {
      const first = this.pulseSel === undefined;
      this.pulseSel = s.selected;
      if (!first && s.selected && !(this.reducedMotion?.matches ?? false)) this.sky.startSelPulse(performance.now());
    }
    this.dirty = true;
  }

  protected abstract onUpdate(s: AppState, emphasis: string | null): void;

  /**
   * Nhóm đối tượng cần tô sáng. Chỉ tính lại khi khóa tô sáng, đối tượng chọn, vĩ độ, danh sách sao hoặc
   * Mặt Trời (bật/tắt, ngày) đổi — không làm gì mỗi khung hình khi bầu trời đang quay.
   */
  private resolveEmphasis(s: AppState): string | null {
    if (s.emphasis === this.emKey && s.selected === this.emSel && s.lat === this.emLat && s.stars === this.emStars && s.toggles.sun === this.emSun && s.sunDate === this.emSunDate) {
      return this.emGroup;
    }
    this.emKey = s.emphasis;
    this.emSel = s.selected;
    this.emLat = s.lat;
    this.emStars = s.stars;
    this.emSun = s.toggles.sun;
    this.emSunDate = s.sunDate;
    const group = emphasisGroup(s);
    if (group !== this.emGroup) {
      this.emGroup = group;
      this.emphasis.setTarget(group, performance.now(), this.reducedMotion?.matches ?? false);
      // Nhãn số đo của nhóm đang tô sáng: chip đậm hơn (lớp is-em; chỉ ghi khi đổi).
      const list = this.labelList;
      for (let i = 0; i < list.length; i++) {
        const ud = list[i].userData;
        if (ud.emph) list[i].element.classList.toggle('is-em', ud.emph === group);
      }
    }
    return group;
  }

  /** Có cắt bỏ phần dưới chân trời không. */
  protected clipBelow(_s: AppState): boolean {
    return false;
  }

  /** Điểm (tọa độ thế giới) có bị Trái Đất che không. */
  protected isOccluded(_world: THREE.Vector3): boolean {
    return false;
  }

  /** Gọi mỗi khung hình từ vòng lặp chính. Trả về true nếu đã vẽ. */
  frame(): boolean {
    this.controls.update();
    // Chuyển tô sáng: chỉ vẽ lại liên tục trong ~150 ms của lần chuyển.
    if (this.emphasis.running) {
      this.emphasis.step(performance.now());
      this.dirty = true;
    }
    // Nhịp vòng chọn: chỉ vẽ lại liên tục trong ~300 ms của nhịp, rồi để vòng lặp đang dừng ngủ lại.
    if (this.sky.pulsing) {
      this.sky.stepSelPulse(performance.now());
      this.dirty = true;
    }
    if (!this.dirty || this.width === 0 || this.height === 0 || !this.onScreen || this.suspended) return false;
    const s = this.store.state;
    // Dấu "bóng" ra ngoài khung → kẹp vào trong mép, kèm mũi tên chỉ hướng (fix-2 #11). Trước updateMatrixWorld để
    // nhãn cảnh báo đi theo vòng đã kẹp.
    if (this.horizon.ghostOn) this.horizon.clampGhost(this.camera, this.width, this.height, this.selRingPx());
    this.scene.updateMatrixWorld();
    this.updateLabels(s);
    this.renderer.render(this.scene, this.camera);
    if (this.horizon.ghostOn) this.renderGhost();
    this.labelRenderer.render(this.scene, this.camera);
    this.dirty = false;
    this.measureLabels();
    return true;
  }

  /**
   * Lượt vẽ thứ hai cho dấu "bóng" của đối tượng chọn khuất dưới chân trời (HorizonLayer.ghost, fix-1 #2): không
   * mặt phẳng cắt, không xóa khung. Cảnh "bóng" chỉ có ba đối tượng không kiểm tra chiều sâu; không cấp phát.
   */
  private renderGhost(): void {
    const r = this.renderer;
    const planes = r.clippingPlanes;
    r.clippingPlanes = NO_PLANES;
    r.autoClear = false;
    r.render(this.horizon.ghost, this.camera);
    r.autoClear = true;
    r.clippingPlanes = planes;
  }

  /**
   * Vùng giữ trống (px, góc trên trái) mà nhãn phải né — lớp con ghi vào `out` và trả về true (giản đồ chân trời:
   * hình người quan sát, fix-1 G1). Mặc định không có.
   */
  protected keepOut(_out: KeepOutBox, _W: number, _H: number): boolean {
    return false;
  }

  /**
   * Vùng tròn giữ trống (px) cho nhãn `avoidDisc` — khung thiên cầu: đĩa của quả địa cầu trên màn hình, để tên chòm
   * sao không in lên Trái Đất (fix-2 #3). Lớp con ghi vào `out` và trả về true. Mặc định không có.
   */
  protected keepOutDisc(_out: KeepOutDisc, _W: number, _H: number): boolean {
    return false;
  }

  /**
   * Phiên bản cấu trúc của cảnh (thêm/bớt nhãn hoặc đích rê chuột). Các lớp con thêm đối tượng
   * sau khi dựng phải cộng phần của mình vào đây.
   */
  protected structureVersion(): number {
    return this.sky.structureVersion + this.horizon.structureVersion;
  }

  /**
   * Hiện/ẩn nhãn theo hộp kiểm, chân trời và Trái Đất che khuất, rồi gỡ chồng chéo trong không gian màn hình
   * (review-1 D2): nhãn của đối tượng đang chọn trước, sau đó theo hạng ưu tiên tĩnh (labels.ts). Không cấp phát:
   * danh sách nhãn được sắp một lần khi cấu trúc cảnh đổi; hộp nằm trong mảng cấp phát sẵn (declutter.ts).
   */
  private updateLabels(s: AppState): void {
    const version = this.structureVersion();
    if (version !== this.labelKey) {
      this.labelKey = version;
      const list = this.labelList;
      list.length = 0;
      this.scene.traverse((o) => {
        if (o instanceof CSS2DObject) list.push(o as Label);
      });
      list.sort((a, b) => a.userData.rank - b.userData.rank);
      // + chỗ cho các vật cản (vòng chọn, vùng giữ trống keepOut, chân đường thẳng đứng, vòng và mũi tên "bóng") và
      // lớp giao diện nổi.
      this.boxLabel.length = list.length + MAX_OBSTACLES + MAX_OVERLAYS;
      this.boxes.ensure(list.length + MAX_OBSTACLES + MAX_OVERLAYS);
    }
    const lt = s.labels;
    const clip = this.clipBelow(s);
    const list = this.labelList;
    const W = this.width;
    const H = this.height;
    const cam = this.camera;
    cam.updateMatrixWorld();
    const boxes = this.boxes;
    boxes.reset();
    if (this.keepOutDisc(_kd, W, H)) boxes.setDisc(_kd.x, _kd.y, _kd.r);
    let sel: Label | null = null;
    for (let i = 0; i < list.length; i++) {
      const lbl = list[i];
      const ud = lbl.userData;
      lbl.center.set(ud.cx0, ud.cy0);
      // Nhóm cha bị ẩn: CSS2DRenderer tự ẩn cả nhánh, không cần tính vị trí/che khuất.
      if (!ancestorsVisible(lbl)) continue;
      let vis = lt.all && lt[ud.group];
      // Khung thiên cầu nhỏ: bỏ các nhãn không định hướng, trừ tên đối tượng đang chọn (review-4 #4).
      if (vis && this.compactLabels && !compactKeeps(ud) && !isSelectedLabel(ud, s.selected)) vis = false;
      if (vis) {
        // matrixWorld đã cập nhật trong frame() (scene.updateMatrixWorld) — không gọi getWorldPosition.
        _v.setFromMatrixPosition(lbl.matrixWorld);
        if (clip && ud.hideBelowHorizon && _v.y < -0.03 * this.R) vis = false;
        // Nhãn dày đặc (tên chòm sao) chỉ hiện ở nửa thiên cầu quay về phía người xem để đỡ rối.
        else if (ud.hideFarSide && _v.dot(cam.position) < 0) vis = false;
        else if (this.isOccluded(_v)) vis = false;
      }
      lbl.visible = vis;
      if (vis && sel === null && isSelectedLabel(ud, s.selected)) sel = lbl;
    }
    // Thứ tự giữ chỗ (review-3 D2, fix-1 G1): trước tiên là các vật cản — vòng chọn và hình người quan sát; rồi chữ
    // hướng B/N/Đ/T — không bao giờ bị ẩn, nhưng né vật cản bằng các vị trí thay thế dọc chân trời (chữ B không đè vòng
    // quanh Polaris) và đòi một vùng đệm để nhãn khác không chen sát ("Thiên đỉnh" cạnh "T"); rồi nhãn số đo của nhóm
    // đang tô sáng (dời dọc theo cung nếu chỗ gốc trùng chữ hướng, xem LabelData.alts); rồi thiên cực/thiên đỉnh
    // (review-4 D2); rồi đối tượng đang chọn (đặt ra ngoài vòng chọn); rồi các nhãn khác theo hạng. Nhãn tự neo quanh
    // vòng chọn (tô sáng, thiên cực, đối tượng chọn) là `soft`: không né vật cản.
    // Nút nổi trên canvas (fix-2 #1): vật cản CỨNG — nhãn `soft` ("Thiên đỉnh", tên đối tượng chọn) cũng né.
    const r4 = this.overlayRects;
    for (let o = 0; o < this.overlayN; o++) {
      const k = boxes.n;
      this.boxLabel[k] = null;
      boxes.push(r4[o * 4], r4[o * 4 + 1], r4[o * 4 + 2], r4[o * 4 + 3], false);
      boxes.must[k] = 1;
      boxes.solid[k] = 1;
      boxes.hard[k] = 1;
    }
    const ringPx = this.selRingPx();
    if (this.sky.selRingWorld(_v)) this.pushObstacle(_v, ringPx, W, H);
    // Dấu "bóng" của đối tượng chọn khuất dưới mặt đất, ở vị trí ĐÃ VẼ (sau khi kẹp vào khung), và mũi tên mép khung
    // (fix-3 #3): vật cản CỨNG — nhãn "… dưới chân trời" (soft, neo vào dấu bóng) cũng phải né, không còn đè lên chính
    // dấu của nó. Vòng chọn ở trên nằm ở vị trí thật (có thể ngoài khung) và nhãn soft bỏ qua nó.
    const gp = this.ghostPx;
    gp[2] = 0;
    gp[6] = 0;
    const gm = this.horizon.ghostMarks(_v, _q);
    if (gm > 0) {
      let k = this.pushObstacle(_v, ringPx, W, H);
      if (k >= 0) {
        boxes.hard[k] = 1;
        gp[0] = boxes.x[k];
        gp[1] = boxes.y[k];
        gp[2] = boxes.w[k];
        gp[3] = boxes.h[k];
      }
      if (gm > 1) {
        k = this.pushObstacle(_q, ringPx * GHOST_ARROW_K, W, H);
        if (k >= 0) {
          boxes.hard[k] = 1;
          gp[4] = boxes.x[k];
          gp[5] = boxes.y[k];
          gp[6] = boxes.w[k];
          gp[7] = boxes.h[k];
        }
      }
    }
    // Chân đường thẳng đứng và đoạn cung h sát chân (fix-3 #12): vật cản nhỏ, đặt trước chữ hướng — "B" dời sang vị trí
    // thay thế dọc chân trời thay vì nằm ngay dưới vạch hồng ở chân đường thẳng đứng qua Polaris.
    this.footPx[2] = 0;
    if (this.horizon.verticalFoot(_v, _q)) this.pushSegment(_v, _q, FOOT_PAD, W, H);
    if (this.keepOut(_ko, W, H)) {
      const k = boxes.n;
      this.boxLabel[k] = null;
      boxes.push(_ko.x, _ko.y, _ko.w, _ko.h, false);
      boxes.must[k] = 1;
      boxes.solid[k] = 1;
    }
    for (let i = 0; i < list.length; i++) {
      const lbl = list[i];
      if (lbl.userData.group !== 'directions' || !lbl.visible || !ancestorsVisible(lbl)) continue;
      const h = lbl.userData.h || EST_H * this.estK();
      const k = this.pushBox(lbl, W, H, true, 0, Math.round(h * DIR_PAD_K));
      if (k >= 0) boxes.must[k] = 1;
    }
    const em = this.emGroup;
    if (em !== null) {
      for (let i = 0; i < list.length; i++) {
        const lbl = list[i];
        if (lbl.userData.emph !== em || !lbl.visible || !ancestorsVisible(lbl)) continue;
        const k = this.pushBox(lbl, W, H, true, 0, FOCUS_PAD);
        if (k >= 0) {
          boxes.must[k] = 1;
          boxes.soft[k] = 1;
        }
      }
    }
    // Tên thiên cực / thiên đỉnh (nhóm poles) giữ chỗ trước tên đối tượng đang chọn: khi đối tượng chọn là Polaris,
    // "Thiên cực Bắc" vẫn hiện, còn "Polaris" thử bên phải, trái, trên, dưới vòng chọn (review-4 D2).
    for (let i = 0; i < list.length; i++) {
      const lbl = list[i];
      const ud = lbl.userData;
      if (ud.group !== 'poles' || lbl === sel || !lbl.visible || (em !== null && ud.emph === em) || !ancestorsVisible(lbl)) continue;
      const k = this.pushBox(lbl, W, H, true);
      if (k >= 0) boxes.soft[k] = 1;
    }
    if (sel && !(em !== null && sel.userData.emph === em)) {
      const k = this.pushBox(sel, W, H, true, ringPx, FOCUS_PAD);
      if (k >= 0) boxes.soft[k] = 1;
    }
    // Các nhãn còn lại theo hạng; vòng chọn (đã đặt ở trên) là vật cản cho chúng — không nhãn nào chen vào vòng quanh
    // đối tượng đang chọn, thường là thiên cực, nơi đường nối chòm sao và tên dày nhất (review-4 D2).
    for (let i = 0; i < list.length; i++) {
      const lbl = list[i];
      const ud = lbl.userData;
      if (lbl === sel || !lbl.visible || ud.group === 'directions' || ud.group === 'poles' || (em !== null && ud.emph === em) || !ancestorsVisible(lbl)) continue;
      // Nhãn `must` (cảnh báo "dưới chân trời", neo vào dấu bóng của đối tượng chọn): đặt ra ngoài vòng như tên đối
      // tượng chọn — bên phải, trái, trên, dưới vòng, rồi các vị trí thay thế của nó.
      // Khoảng hở UNDER_GAP px giữa vòng và nhãn (fix-3 #3, review-3 #3).
      const must = ud.must;
      const k = this.pushBox(lbl, W, H, ud.rank < 20, must ? ringPx + UNDER_GAP : 0, ud.clear);
      if (k >= 0 && ud.avoidDisc) boxes.avoidDisc[k] = 1;
      if (k >= 0 && must) {
        boxes.must[k] = 1;
        boxes.soft[k] = 1;
      }
    }
    declutter(boxes, W, H);
    for (let k = 0; k < boxes.n; k++) {
      const lbl = this.boxLabel[k];
      if (lbl === null) continue; // vật cản (vòng chọn), không phải nhãn
      if (!boxes.keep[k]) {
        lbl.visible = false;
        continue;
      }
      const ud = lbl.userData;
      const w = ud.w || estimateWidth(lbl) * this.estK();
      const h = ud.h || EST_H * this.estK();
      const sx = boxes.dx[k] + boxes.ox[k];
      if (sx !== 0) lbl.center.x = ud.cx0 - sx / w;
      if (boxes.dy[k] !== 0) lbl.center.y = ud.cy0 - boxes.dy[k] / h;
    }
  }

  /**
   * Bán kính ngoài (px) của vòng chọn quanh đối tượng đang chọn (sprite không co theo khoảng cách, SkyLayer):
   * nhãn tên đặt ra ngoài vòng này thay vì cắt qua nó (review-3 I1.1).
   */
  private selRingPx(): number {
    return SEL_RING_SCALE * this.camera.projectionMatrix.elements[5] * (this.height / 2) * SEL_RING_OUTER;
  }

  /**
   * Chiếu nhãn ra hộp màn hình và đưa vào danh sách gỡ chồng chéo (bỏ qua nhãn nằm sau camera). `gapPx` > 0: nhãn
   * neo bên phải điểm của nó bắt đầu cách điểm ít nhất chừng ấy px. `pad`: vùng đệm quanh nhãn (declutter.ts).
   * Trả về chỉ số hộp, −1 nếu bỏ qua.
   */
  private pushBox(lbl: Label, W: number, H: number, canNudge: boolean, gapPx = 0, pad = 0): number {
    _p.setFromMatrixPosition(lbl.matrixWorld).project(this.camera);
    if (_p.z < -1 || _p.z > 1) return -1;
    const ud = lbl.userData;
    if (ud.w === 0) this.needMeasure = true;
    const w = ud.w || estimateWidth(lbl) * this.estK();
    const h = ud.h || EST_H * this.estK();
    const sx = ((_p.x + 1) / 2) * W;
    const sy = ((1 - _p.y) / 2) * H;
    // Chỉ đẩy vào trong khi điểm neo còn nằm trong khung; điểm ở ngoài khung thì nhãn bị ẩn.
    const inside = sx >= 0 && sx <= W && sy >= 0 && sy <= H;
    // Nhãn neo bên phải (cx0 < 0,5): mép trái hiện cách điểm −cx0·w px; đẩy thêm cho đủ gapPx.
    const ox = gapPx > 0 && ud.cx0 < 0.5 ? Math.max(0, gapPx + ud.cx0 * w) : 0;
    const boxes = this.boxes;
    const k = boxes.n;
    this.boxLabel[k] = lbl;
    boxes.push(sx - ud.cx0 * w + ox, sy - ud.cy0 * h, w, h, canNudge && inside);
    boxes.ox[k] = ox;
    boxes.pad[k] = pad;
    if (gapPx > 0 && ud.cx0 < 0.5) {
      // Tên đối tượng đang chọn: bên phải vòng chọn là chỗ gốc; bị chiếm (vd. chữ hướng B ngay cạnh thiên cực) thì
      // thử bên trái vòng, rồi phía trên và phía dưới vòng — luôn ngoài vòng. Kể cả khi nhãn dài tự nằm xa hơn gapPx
      // (ox = 0): trước fix-3 #3, nhãn "… dưới chân trời" dài không có các vị trí này và bị đẩy ngược vào vòng "bóng".
      boxes.addAlt(k, sx - gapPx - w, sy - h / 2);
      boxes.addAlt(k, sx - w / 2, sy - gapPx - h);
      boxes.addAlt(k, sx - w / 2, sy + gapPx);
      // Chéo dưới phải / chéo trên phải (bố cục tập trung, 2026-10-05): khung nhìn thấp lại thì nhãn "Thiên cực Bắc"
      // ngay trên vòng và chữ B ngay dưới có thể chiếm cả bốn chỗ trên; tên đối tượng chọn vẫn phải hiện.
      boxes.addAlt(k, sx + gapPx * 0.7, sy + gapPx * 0.7);
      boxes.addAlt(k, sx + gapPx * 0.7, sy - gapPx * 0.7 - h);
    }
    if (this.compactLabels && ud.group === 'poles') {
      // Khung thiên cầu nhỏ (review-4 #4): trục chạm mép khung nên các vị trí thay thế xa hơn dọc trục rơi ra ngoài,
      // và chữ hướng B ngồi ngay trên thiên cực. Thử thêm bên phải rồi bên trái điểm neo, ngang tầm nó (kẹp vào trong
      // khung theo chiều dọc: điểm neo ở đầu trục có thể nằm ngay trên mép trên).
      const y = Math.min(Math.max(sy - ud.cy0 * h, COMPACT_EDGE), H - COMPACT_EDGE - h);
      boxes.addAlt(k, sx + COMPACT_POLE_DX, y);
      boxes.addAlt(k, sx - COMPACT_POLE_DX - w, y);
    }
    const alts = ud.alts;
    if (alts !== null && lbl.parent) {
      const m = lbl.parent.matrixWorld;
      for (let a = 0; a < alts.length; a++) {
        _p.copy(alts[a]).applyMatrix4(m).project(this.camera);
        if (_p.z < -1 || _p.z > 1) continue;
        boxes.addAlt(k, ((_p.x + 1) / 2) * W - ud.cx0 * w, ((1 - _p.y) / 2) * H - ud.cy0 * h);
      }
    }
    return k;
  }

  /**
   * Thêm vật cản hình vuông bán kính `r` px quanh điểm thế giới `world` (vòng chọn): luôn giữ (must), không dời.
   * Trả về chỉ số hộp, −1 nếu điểm nằm sau camera. Không cấp phát.
   */
  private pushObstacle(world: THREE.Vector3, r: number, W: number, H: number): number {
    _p.copy(world).project(this.camera);
    if (_p.z < -1 || _p.z > 1) return -1;
    const sx = ((_p.x + 1) / 2) * W;
    const sy = ((1 - _p.y) / 2) * H;
    const boxes = this.boxes;
    const k = boxes.n;
    this.boxLabel[k] = null;
    boxes.push(sx - r, sy - r, 2 * r, 2 * r, false);
    boxes.must[k] = 1;
    boxes.solid[k] = 1;
    return k;
  }

  /** Vật cản bao đoạn thẳng giữa hai điểm thế giới `a`, `b` trên màn hình, nới thêm `pad` px. Không cấp phát. */
  private pushSegment(a: THREE.Vector3, b: THREE.Vector3, pad: number, W: number, H: number): void {
    _p.copy(a).project(this.camera);
    if (_p.z < -1 || _p.z > 1) return;
    const ax = ((_p.x + 1) / 2) * W;
    const ay = ((1 - _p.y) / 2) * H;
    _p.copy(b).project(this.camera);
    if (_p.z < -1 || _p.z > 1) return;
    const bx = ((_p.x + 1) / 2) * W;
    const by = ((1 - _p.y) / 2) * H;
    const x0 = Math.min(ax, bx) - pad;
    const y0 = Math.min(ay, by) - pad;
    const boxes = this.boxes;
    const k = boxes.n;
    this.boxLabel[k] = null;
    boxes.push(x0, y0, Math.max(ax, bx) + pad - x0, Math.max(ay, by) + pad - y0, false);
    boxes.must[k] = 1;
    boxes.solid[k] = 1;
    const fp = this.footPx;
    fp[0] = boxes.x[k];
    fp[1] = boxes.y[k];
    fp[2] = boxes.w[k];
    fp[3] = boxes.h[k];
  }

  /**
   * Chỉ để kiểm thử chấp nhận (đọc qua window.__app ở chế độ phát triển, fix-3): hộp px (tương đối với canvas, góc
   * trên trái) của vòng "bóng" ĐÃ VẼ và của mũi tên mép khung — đúng các vật cản mà nhãn phải né; null khi không có.
   */
  get ghostRects(): { ring: Rect | null; arrow: Rect | null } {
    const g = this.ghostPx;
    return {
      ring: g[2] > 0 ? { x: g[0], y: g[1], w: g[2], h: g[3] } : null,
      arrow: g[6] > 0 ? { x: g[4], y: g[5], w: g[6], h: g[7] } : null,
    };
  }

  /** Chỉ để kiểm thử chấp nhận (fix-3 #12): hộp px của vật cản ở chân đường thẳng đứng; null khi không có. */
  get footRect(): Rect | null {
    const f = this.footPx;
    return f[2] > 0 ? { x: f[0], y: f[1], w: f[2], h: f[3] } : null;
  }

  /** Đo hộp của nhãn vừa hiện mà chưa có kích thước (một lần mỗi khi chữ đổi độ dài hoặc cỡ chữ đổi). */
  private measureLabels(): void {
    if (!this.needMeasure) return;
    this.needMeasure = false;
    const list = this.labelList;
    for (let i = 0; i < list.length; i++) {
      const lbl = list[i];
      const ud = lbl.userData;
      if (ud.w !== 0 || !lbl.visible || lbl.element.style.display === 'none' || !lbl.element.isConnected) continue;
      const w = lbl.element.offsetWidth;
      if (w > 0) {
        ud.w = w;
        ud.h = lbl.element.offsetHeight;
        // Gỡ chồng chéo lại ở khung hình sau với kích thước thật.
        this.dirty = true;
      }
    }
  }

  /**
   * Hệ số độ dày mọi đường Line2 (chế độ trình chiếu: ×2 để đọc được trên máy chiếu, review-1 H1). Chỉ đổi uniform
   * qua setFatLineStyle — không dựng hình học. Tô sáng liên kết nhân thêm trên hệ số này (EmphasisFx.setScale).
   */
  setLineScale(k: number): void {
    if (k === this.lineScale) return;
    this.lineScale = k;
    this.scene.traverse((o) => {
      // Đường mảnh (lưới, đường nối chòm sao, vạch mặt đất) không đổi được độ dày trong WebGL: tăng độ đậm thay vào
      // đó để không biến mất trên máy chiếu (review-2 H1). ×1,6 khi k = 2, tối đa 1.
      if ((o as THREE.LineSegments).isLineSegments && !(o as Line2).isLine2) {
        const m = (o as THREE.LineSegments).material as THREE.LineBasicMaterial;
        if (!m.isLineBasicMaterial || !m.transparent) return;
        let o0 = this.baseOpacity.get(m);
        if (o0 === undefined) {
          o0 = m.opacity;
          this.baseOpacity.set(m, o0);
        }
        m.opacity = Math.min(1, o0 * (1 + (k - 1) * 0.6));
        return;
      }
      if (!(o as Line2).isLine2) return;
      const line = o as Line2;
      const m = line.material as LineMaterial;
      let w0 = this.baseWidths.get(line);
      if (w0 === undefined) {
        w0 = m.linewidth;
        this.baseWidths.set(line, w0);
      }
      setFatLineStyle(line, { width: w0 * k });
      // Đường đứt nét trên máy chiếu (review-4 H1): nét dài hơn, khe hẹp hơn — vẫn là đường đứt (giữ nghĩa) nhưng
      // gần như liền khi nhìn từ xa. Chỉ đổi uniform dashSize/gapSize (không biên dịch lại, không dựng hình học).
      if (m.dashed) {
        let d0 = this.baseDash.get(m);
        if (d0 === undefined) {
          d0 = [m.dashSize, m.gapSize];
          this.baseDash.set(m, d0);
        }
        const on = k > 1;
        m.dashSize = on ? d0[0] * PRESENT_DASH_K : d0[0];
        m.gapSize = on ? d0[1] * PRESENT_GAP_K : d0[1];
      }
    });
    this.emphasis.setScale(k);
    this.invalidateLabelSizes();
  }

  /** Chế độ trình chiếu: đường dày hơn (hệ số `lineScale`), đường mảnh đậm hơn, khung hình theo preferredFov. */
  setPresentation(on: boolean, lineScale: number): void {
    this.presenting = on;
    this.setLineScale(on ? lineScale : 1);
    if (this.height > 0) {
      this.camera.fov = this.preferredFov(this.camera.aspect);
      this.applyViewOffset();
      this.camera.updateProjectionMatrix();
    }
    this.dirty = true;
  }

  /**
   * Hệ số cho kích thước ƯỚC LƯỢNG của nhãn chưa đo (fix-2): khi trình chiếu chữ nhãn to gấp --lbl-k = 2,35 lần
   * (styles.css). Ước lượng theo cỡ thường từng làm nhãn mới hiện trong lúc chạy thời gian thò ra ngoài mép khung
   * đúng một khung hình, trước khi được đo thật (γ Điểm xuân phân, declutter.mjs 1920).
   */
  private estK(): number {
    return this.presenting ? PRESENT_LBL_K : 1;
  }

  /** Cỡ chữ nhãn đổi (chế độ trình chiếu): đo lại mọi nhãn ở lần vẽ tới. */
  invalidateLabelSizes(): void {
    for (const lbl of this.labelList) lbl.userData.w = 0;
    this.needMeasure = true;
    this.dirty = true;
  }

  resetCamera(): void {
    this.camera.position.copy(this.defaultCamera);
    this.controls.target.copy(this.defaultTarget);
    this.controls.update();
    this.dirty = true;
  }

  private toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.renderer.domElement.getBoundingClientRect();
    _local.x = clientX - r.left;
    _local.y = clientY - r.top;
    return _local;
  }

  /** Tìm sao / Mặt Trời gần vị trí con trỏ nhất (theo pixel trên màn hình). */
  pickAt(clientX: number, clientY: number): NonNullable<Selection> | null {
    const s = this.store.state;
    const { x, y } = this.toLocal(clientX, clientY);
    this.scene.updateMatrixWorld();
    const m = this.sky.rot.matrixWorld;
    const clip = this.clipBelow(s);
    const w = this.width;
    const h = this.height;
    return this.sky.pickBest(s, (local, tolerancePx, priority) => {
      _v.copy(local).applyMatrix4(m);
      if (clip && _v.y < -0.02 * this.R) return Infinity;
      _p.copy(_v).project(this.camera);
      if (_p.z > 1) return Infinity;
      const sx = ((_p.x + 1) / 2) * w;
      const sy = ((1 - _p.y) / 2) * h;
      const d = Math.hypot(sx - x, sy - y);
      if (d > tolerancePx) return Infinity;
      // Kiểm tra che khuất sau cùng (tốn nhất) — chỉ cho điểm đã nằm gần con trỏ.
      if (this.isOccluded(_v)) return Infinity;
      return d - priority * 3;
    });
  }

  /** Đối tượng dưới con trỏ: ưu tiên sao, sau đó tới các đường/mặt có chú thích. */
  hoverAt(clientX: number, clientY: number): HoverInfo | null {
    const sel = this.pickAt(clientX, clientY);
    if (sel) return { kind: 'object', sel };
    const s = this.store.state;
    const { x, y } = this.toLocal(clientX, clientY);
    _ndc.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(_ndc, this.camera);
    const version = this.structureVersion();
    if (version !== this.hoverKey) {
      this.hoverKey = version;
      this.hoverList = this.hoverTargets();
    }
    const clip = this.clipBelow(s);
    const hits = this.raycaster.intersectObjects(this.hoverList, false).filter((h) => {
      if (!isShown(h.object)) return false;
      if (clip && h.point.y < -0.02 * this.R && h.object.userData.tip !== 'ground') return false;
      return true;
    });
    if (!hits.length) return null;
    // Đường (Line/Line2) được ưu tiên hơn mặt (Mesh) vì mảnh và khó trỏ trúng hơn.
    hits.sort((a, b) => rank(a.object) - rank(b.object) || a.distance - b.distance);
    return { kind: 'tip', tip: hits[0].object.userData.tip as string };
  }

  protected hoverTargets(): THREE.Object3D[] {
    return [...this.sky.hoverTargets(), ...this.horizon.hoverTargets()];
  }
}

/** Trình chiếu: hệ số độ dài nét và khe của đường đứt nét (nét 1,6×, khe 0,5× → tỉ lệ nét/khe tăng ~3 lần). */
const PRESENT_DASH_K = 1.6;
const PRESENT_GAP_K = 0.5;

/** Mặt phẳng cắt rỗng cho lượt vẽ "bóng" (gán lại cùng tham chiếu, không cấp phát). */
const NO_PLANES: THREE.Plane[] = [];

/** Hộp vùng giữ trống (px, góc trên trái). */
export interface KeepOutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
const _ko: KeepOutBox = { x: 0, y: 0, w: 0, h: 0 };

/** Vùng tròn giữ trống (px): tâm và bán kính. */
export interface KeepOutDisc {
  x: number;
  y: number;
  r: number;
}
const _kd: KeepOutDisc = { x: 0, y: 0, r: 0 };

/** Số phần tử giao diện nổi tối đa trên một khung nhìn (nhóm nút công cụ). */
const MAX_OVERLAYS = 4;
/** Số vật cản tối đa: vòng chọn, vùng giữ trống (keepOut), chân đường thẳng đứng, vòng và mũi tên "bóng". */
const MAX_OBSTACLES = 5;

/** Khoảng hở (px) giữa vòng "bóng" và nhãn "… dưới chân trời" (fix-3 #3, review-3 #3). */
const UNDER_GAP = 8;
/** Phần nới (px) quanh vật cản ở chân đường thẳng đứng (fix-3 #12). */
const FOOT_PAD = 3;

/** Hộp px (góc trên trái) — chỉ cho các getter kiểm thử. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Vùng đệm quanh chữ hướng B/N/Đ/T, theo chiều cao chữ (fix-1 G1): ở khung thiên cầu "Thiên đỉnh" từng nằm ngay
 * cạnh "T" và đọc thành một cụm "T Thiên đỉnh". Một nửa chiều cao chữ ≈ 10 px thường, ≈ 20 px khi trình chiếu.
 */
const DIR_PAD_K = 0.4;

/** Vùng đệm (px) quanh nhãn số đo đang tô sáng và nhãn đối tượng đang chọn: tên hạng thấp không chen sát. */
const FOCUS_PAD = 8;
/** Khoảng ngang (px) từ điểm neo thiên cực tới vị trí thay thế bên cạnh ở khung thiên cầu nhỏ (review-4 #4). */
const COMPACT_POLE_DX = 20;
/** Lề trong (px) khi kẹp vị trí thay thế đó vào khung: đúng lề của declutter.ts. */
const COMPACT_EDGE = EDGE;

/** Chiều cao ước lượng của nhãn chưa đo (px). */
const EST_H = 16;
/** --lbl-k của body.present trong styles.css. */
const PRESENT_LBL_K = 2.35;

/** Bề rộng ước lượng của nhãn chưa đo (px) — chỉ dùng cho khung hình đầu tiên trước khi đo. */
function estimateWidth(lbl: Label): number {
  return (lbl.element.textContent?.length ?? 0) * 7 + 6;
}

function isSelectedLabel(ud: LabelData, sel: Selection): boolean {
  if (!sel || ud.selKind !== sel.kind) return false;
  if (sel.kind === 'user') return ud.selId === sel.id;
  if (sel.kind === 'catalog' || sel.kind === 'dso') return ud.selIdx === sel.index;
  return true;
}

function ancestorsVisible(o: THREE.Object3D): boolean {
  let p = o.parent;
  while (p) {
    if (!p.visible) return false;
    p = p.parent;
  }
  return true;
}

function isShown(o: THREE.Object3D | null): boolean {
  while (o) {
    if (!o.visible) return false;
    o = o.parent;
  }
  return true;
}

function rank(o: THREE.Object3D): number {
  if ((o as Line2).isLine2 || (o as THREE.Line).isLine) return 0;
  const tip = o.userData.tip as string;
  if (tip?.startsWith('zone_')) return 3;
  if (tip === 'ground' || tip === 'equatorPlane' || tip === 'skyDome') return 2;
  return 1;
}
