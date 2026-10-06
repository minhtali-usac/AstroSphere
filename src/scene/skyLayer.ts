// Lớp "bầu trời": mọi đối tượng gắn với thiên cầu (xích đạo trời, vòng giờ, vùng, sao, Mặt Trời...).
// Dùng chung cho cả hai khung nhìn; mỗi khung chỉ khác ma trận đặt nhóm (xem frames.ts).

import * as THREE from 'three';
import type { Line2 } from 'three/addons/lines/Line2.js';
import { cosD, eclipticToEquatorial, galacticToEquatorial, sinD, zoneLimits } from '../astro';
import { bvToRgb, catalogArrays, catalogIndexByHip, getCatalogStar } from '../data/catalog';
import { constellationName, loadAllFigures, type FigureMap } from '../data/constellations';
import { DSOS, dsoGroup } from '../data/deepSky';
import { t } from '../i18n';
import { DSO_COLORS, sunEquatorial } from '../selection';
import type { AppState, Selection, UserStar } from '../state';
import { eqVec, equatorialMatrix, hourFrameMatrix, type ViewKind } from './frames';
import {
  COLORS,
  decBandGeometry,
  decCircle,
  disposeObject,
  dynamicFatLine,
  fatLine,
  greatArc,
  polylineToSegments,
  ringTexture,
  thinSegments,
  translucent,
  writeFatLine,
} from './geom';
import type { EmphasisFx } from './emphasis';
import { ALLSKY_NAME_RANK, makeLabel, setLabelText, type Label } from './labels';
import { SEL_PULSE_MS, SEL_PULSE_OPACITY, SEL_PULSE_SCALE, selPulseAmount } from './selPulse';
import { createStarMaterial, makeStarPoints, sizeForMagnitude } from './starMaterial';

/** Cỡ sprite vòng chọn (đơn vị cảnh ở khoảng cách 1, không co theo khoảng cách) và bán kính ngoài của vòng trong
 *  ảnh vòng (ringTexture: bán kính 24 + nửa nét 2,5 trên ảnh 64 px). View dùng để đặt tên ra ngoài vòng. */
export const SEL_RING_SCALE = 0.06;
export const SEL_RING_OUTER = 26.5 / 64;

type ZoneKey = 'circumpolar' | 'riseSet' | 'neverRise';

export class SkyLayer {
  /** Nhóm quay theo LST (hệ xích đạo gốc). */
  readonly rot = new THREE.Group();
  /** Nhóm cố định (hệ góc giờ) — chứa các đối tượng bất biến khi bầu trời quay. */
  readonly fixed = new THREE.Group();
  /**
   * Tăng mỗi khi thêm/bớt nhãn hoặc đối tượng có chú thích (tip) trong lớp này.
   * Khung nhìn dùng nó để giữ sẵn danh sách nhãn và đích rê chuột thay vì duyệt cả cảnh mỗi khung hình.
   */
  structureVersion = 0;

  private equator = new THREE.Group();
  private equatorPlane: THREE.Mesh;
  private equatorLine: Line2;
  private axis = new THREE.Group();
  private axisLine: Line2;
  private hourCircleLine: Line2;
  private hourCircle = new THREE.Group();
  private zones: Record<ZoneKey, THREE.Mesh>;
  private zoneKey = '';
  private eqGrid = new THREE.Group();
  private ecliptic = new THREE.Group();
  private galactic = new THREE.Group();
  private catalog: THREE.Points;
  private catalogLabels = new THREE.Group();
  /** Đường nối và tên 88 chòm sao — dựng khi bật lần đầu (dữ liệu tải động), nằm trong nhóm allSky. */
  private allSky = new THREE.Group();
  /** Nhãn tên 88 chòm sao (mỗi nhãn trong một nhóm riêng để ẩn khi chòm đó đã được thêm làm mẫu màu). */
  private allNames = new Map<string, THREE.Group>();
  private allLinesRequested = false;
  /** Gọi khi một phần cảnh thay đổi bất đồng bộ (dữ liệu tải động tới) để khung nhìn vẽ lại. */
  onAsyncChange: (() => void) | null = null;
  private deepSky = new THREE.Group();
  private dsoVecs: THREE.Vector3[] = [];
  private user = new THREE.Group();
  private sun = new THREE.Group();
  private sunPath: Line2;
  private sunPathPts = new Float32Array(181 * 3);
  private sunKey = '';
  private selRing: THREE.Sprite;
  /** Thời điểm bắt đầu nhịp "đã chọn" của vòng chọn (ms, performance.now()); −1 khi không chạy (selPulse.ts). */
  private pulseT0 = -1;
  /**
   * Tên của đối tượng đang chọn khi nó không có nhãn riêng (sao danh mục mờ hơn ngưỡng nhãn, vd. Polaris cấp 1,98;
   * thiên thể sâu không tiêu biểu). Một nhãn dùng lại, đổi chữ/vị trí khi đổi lựa chọn — đối tượng đang chọn luôn
   * được gọi tên cạnh vòng chọn (review-4 D2). Nằm trong nhóm riêng để bật/tắt mà không đụng cờ visible của nhãn.
   */
  private selLabelHolder = new THREE.Group();
  private selLabel: Label;
  private selLabelKey: Selection | undefined = undefined;
  private starMaterial = createStarMaterial();
  private dsoMaterial = createStarMaterial(true);
  private lastStars: UserStar[] | null = null;
  private lastFigures: AppState['figures'] | null = null;
  private userVecs: { id: string; v: THREE.Vector3; mag: number }[] = [];
  private catalogVecs: THREE.Vector3[] = [];
  private catalogHidden = new Set<number>();
  /** Số sao danh mục được vẽ/chọn (danh mục đã sắp theo cấp sao tăng dần). */
  private catalogDrawCount = 0;
  private sunVec = new THREE.Vector3();
  private readonly view: ViewKind;
  private readonly R: number;
  /**
   * Hệ số độ mờ của nền sao danh mục. Khung thiên cầu là khung phụ: nền sao mờ hơn để khung giản đồ chân trời
   * giữ tiêu điểm (bớt tương phản quanh tiêu điểm — 5642 · U4 · L55 · 01:27–02:33; color-theory T1).
   */
  private readonly catalogK: number;

  constructor(view: ViewKind, R: number) {
    this.view = view;
    this.R = R;
    this.catalogK = view === 'sphere' ? 0.55 : 1;
    this.rot.matrixAutoUpdate = false;
    this.fixed.matrixAutoUpdate = false;

    // --- Đối tượng cố định (bất biến khi quay quanh trục thiên cực) -------------
    const eqLine = fatLine(decCircle(0, R), COLORS.equator, { width: 2.6 });
    eqLine.userData.tip = 'equator';
    this.equatorLine = eqLine;
    this.equator.add(eqLine);
    const eqLabel = makeLabel(t('scene.equator'), 'circles', { color: COLORS.equator, anchor: [0.5, 1.2], compactKeep: true });
    // Đặt nhãn ở phía Đông của kinh tuyến (H = −25°) để luôn nhìn thấy.
    eqLabel.position.set(Math.cos(0.436) * R * 1.02, Math.sin(0.436) * R * 1.02, 0);
    // Vị trí thay thế (MAX_ALTS = 8): dọc xích đạo phía trước, và — chỉ ở khung thiên cầu — ngay dưới đường (lệch về
    // phía thiên cực Nam 0,24 R, đủ để cả nhãn nằm dưới nét vẽ). Ở khung thiên cầu nhỏ (review-4 #4) dải ngang quanh
    // đường xích đạo bị chữ T, Đ, tên đối tượng chọn và vòng chọn (quay theo giờ sao) chiếm hết; tên xích đạo vẫn phải
    // hiện. Khung chân trời không dùng chỗ "dưới đường" (có thể rơi xuống dưới mặt đất).
    const eqAt = (a: number, z = 0) => new THREE.Vector3(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02, z * R);
    eqLabel.userData.alts =
      view === 'sphere'
        ? [eqAt(0.2), eqAt(0.65), eqAt(-0.2), eqAt(0.9), eqAt(-0.436), eqAt(0.436, -0.24), eqAt(0.2, -0.24), eqAt(0.65, -0.24)]
        : [eqAt(0.2), eqAt(0.65), eqAt(-0.2), eqAt(0.9), eqAt(1.1), eqAt(-0.436), eqAt(-0.65), eqAt(-0.873)];
    this.equator.add(eqLabel);
    this.fixed.add(this.equator);

    this.equatorPlane = new THREE.Mesh(new THREE.CircleGeometry(R, 96), translucent(COLORS.equator, 0.09));
    this.equatorPlane.userData.tip = 'equatorPlane';
    this.equatorPlane.renderOrder = -1;
    this.fixed.add(this.equatorPlane);

    const axisLen = R * 1.15;
    const axisLine = fatLine([new THREE.Vector3(0, 0, -axisLen), new THREE.Vector3(0, 0, axisLen)], COLORS.axis, { width: 3 });
    axisLine.userData.tip = 'axis';
    this.axisLine = axisLine;
    this.axis.add(axisLine);
    for (const sign of [1, -1]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.022, 16, 12), new THREE.MeshBasicMaterial({ color: COLORS.axis }));
      dot.position.set(0, 0, sign * R);
      dot.userData.tip = sign > 0 ? 'ncp' : 'scp';
      this.axis.add(dot);
      const lbl = makeLabel(t(sign > 0 ? 'scene.ncp' : 'scene.scp'), 'poles', { color: '#93c5fd', compactKeep: true });
      lbl.position.set(0, 0, sign * axisLen * 1.04);
      // Vị trí thay thế xa hơn dọc trục (fix-2 #3): ở khung thiên cầu chữ hướng "B" nay đứng xa vành hơn và có thể
      // chiếm chỗ ngay trên thiên cực — tên thiên cực lùi ra ngoài thay vì bị ẩn.
      lbl.userData.alts = [new THREE.Vector3(0, 0, sign * axisLen * 1.12), new THREE.Vector3(0, 0, sign * axisLen * 1.2)];
      this.axis.add(lbl);
    }
    this.fixed.add(this.axis);

    this.zones = {
      circumpolar: new THREE.Mesh(new THREE.BufferGeometry(), translucent(COLORS.circumpolar, 0.2)),
      riseSet: new THREE.Mesh(new THREE.BufferGeometry(), translucent(COLORS.riseSet, 0.14)),
      neverRise: new THREE.Mesh(new THREE.BufferGeometry(), translucent(COLORS.neverRise, 0.2)),
    };
    for (const [k, m] of Object.entries(this.zones)) {
      m.userData.tip = `zone_${k}`;
      m.renderOrder = -2;
      this.fixed.add(m);
    }

    // --- Đối tượng quay theo bầu trời ------------------------------------------
    // Vòng giờ 0h: nửa vòng tròn lớn từ thiên cực Bắc qua điểm xuân phân tới thiên cực Nam.
    const hc: THREE.Vector3[] = [];
    for (let d = 90; d >= -90; d -= 2) hc.push(eqVec(0, d, R));
    const hcLine = fatLine(hc, COLORS.hourCircle, { width: 2 });
    hcLine.userData.tip = 'hourCircle';
    this.hourCircleLine = hcLine;
    this.hourCircle.add(hcLine);
    const hcLabel = makeLabel(t('scene.hourCircle0'), 'circles', { color: '#d4d4d4', anchor: [0.5, 1.2] });
    hcLabel.position.copy(eqVec(0, 38, R * 1.03));
    this.hourCircle.add(hcLabel);
    const gamma = new THREE.Mesh(new THREE.SphereGeometry(R * 0.018, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    gamma.position.copy(eqVec(0, 0, R));
    gamma.userData.tip = 'vernal';
    this.hourCircle.add(gamma);
    const gLabel = makeLabel(t('scene.vernal'), 'circles', { color: '#ffffff' });
    gLabel.position.copy(eqVec(0, -5, R * 1.04));
    this.hourCircle.add(gLabel);
    this.rot.add(this.hourCircle);

    this.buildEqGrid();
    this.buildEcliptic();
    this.buildGalactic();

    // Danh mục sao sáng
    const cat = catalogArrays();
    const n = cat.ra.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = eqVec(cat.ra[i], cat.dec[i], R);
      this.catalogVecs.push(v);
      pos.set([v.x, v.y, v.z], i * 3);
      col.set(bvToRgb(cat.bv[i]), i * 3);
      size[i] = sizeForMagnitude(cat.mag[i]);
      alpha[i] = catalogAlpha(cat.mag[i], this.catalogK);
    }
    this.catalogDrawCount = n;
    this.catalog = makeStarPoints({ positions: pos, colors: col, sizes: size, alphas: alpha }, this.starMaterial);
    this.catalog.renderOrder = 1;
    this.rot.add(this.catalog);
    this.rot.add(this.catalogLabels);
    this.buildDeepSky();

    this.allSky.visible = false;
    this.rot.add(this.allSky);

    this.rot.add(this.user);

    // Mặt Trời
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 0.045, 24, 16), new THREE.MeshBasicMaterial({ color: COLORS.sun }));
    sunMesh.userData.tip = 'sun';
    this.sun.add(sunMesh);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffdd66', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.scale.setScalar(R * 0.3);
    this.sun.add(glow);
    const sunLabel = makeLabel(t('scene.sun'), 'stars', { color: COLORS.sun, anchor: [-0.25, 0.5], rank: 38, sel: { kind: 'sun' } });
    this.sun.add(sunLabel);
    this.rot.add(this.sun);
    // Đường đi trong ngày của Mặt Trời: hình học cấp phát một lần, ghi lại khi đổi ngày.
    this.sunPath = dynamicFatLine(181, COLORS.sun, { width: 1.6, opacity: 0.7, dashed: true, dashSize: R * 0.03, gapSize: R * 0.03, boundsRadius: R });
    this.sunPath.userData.tip = 'sunPath';
    this.rot.add(this.sunPath);

    this.selRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture('#ffffff'), depthWrite: false, depthTest: false, sizeAttenuation: false }));
    this.selRing.scale.setScalar(SEL_RING_SCALE);
    this.selRing.renderOrder = 10;
    this.rot.add(this.selRing);

    this.selLabel = makeLabel('', 'stars', { cls: 'lbl--catalog', anchor: [-0.15, 0.5], mag: 2 });
    this.selLabelHolder.add(this.selLabel);
    this.selLabelHolder.visible = false;
    this.rot.add(this.selLabelHolder);
  }

  /** Đặt chữ/vị trí cho nhãn tên đối tượng đang chọn (chỉ khi lựa chọn đổi; xem selLabel). */
  private updateSelLabel(s: AppState): void {
    const sel = s.selected;
    const ud = this.selLabel.userData;
    let show = false;
    if (sel !== this.selLabelKey) {
      this.selLabelKey = sel;
      ud.selKind = '';
      ud.selIdx = -1;
      if (sel?.kind === 'catalog') {
        const st = getCatalogStar(sel.index);
        // Sao có nhãn riêng (rebuildCatalogLabels: cấp < 1,6 và có tên riêng) thì không cần nhãn này.
        if (!(st.mag < CATALOG_LABEL_MAG && st.shortName)) {
          setLabelText(this.selLabel, st.shortName || st.label);
          this.selLabel.position.copy(this.catalogVecs[sel.index]);
          ud.selKind = 'catalog';
          ud.selIdx = sel.index;
        }
      } else if (sel?.kind === 'dso' && !DSOS[sel.index].featured) {
        setLabelText(this.selLabel, DSOS[sel.index].id);
        this.selLabel.position.copy(this.dsoVecs[sel.index]);
        ud.selKind = 'dso';
        ud.selIdx = sel.index;
      }
    }
    if (ud.selKind === 'catalog') show = s.toggles.catalog;
    else if (ud.selKind === 'dso') show = s.toggles.deepSky;
    this.selLabelHolder.visible = show;
  }

  private buildAllLines(figs: FigureMap): void {
    const R = this.R;
    const seg: number[] = [];
    for (const fig of Object.values(figs)) {
      for (const [a, b] of fig.segs) {
        const sa = fig.stars[a];
        const sb = fig.stars[b];
        polylineToSegments(greatArc(eqVec(sa[0], sa[1]), eqVec(sb[0], sb[1]), R, 4), seg);
      }
    }
    // Khung thiên cầu là khung phụ: đường nối nền mờ hơn (0,3 → 0,18) như nền sao (catalogK) — bớt cạnh sáng cạnh
    // tranh với khung giản đồ chân trời (color-theory T1; 1140 · U3 · L08 · 06:31–09:58).
    const lines = thinSegments(seg, COLORS.figureSky, this.view === 'sphere' ? 0.18 : 0.3);
    lines.userData.tip = 'constellationLines';
    this.allSky.add(lines);
    const c = new THREE.Vector3();
    for (const [abbr, fig] of Object.entries(figs)) {
      c.set(0, 0, 0);
      for (const [ra, dec] of fig.stars) c.add(eqVec(ra, dec));
      const holder = new THREE.Group();
      // Hạng 50 (thấp nhất) và khoảng trống 6 px: tên chòm nền nhường tên sao, thiên cực, tên vòng; chỗ chật thì ẩn
      // thay vì nằm sát hay đè lên nhãn khác (review-4 D2, 5642 · U4 · L55 · 00:08–01:27: một thứ bậc rõ).
      const lbl = makeLabel(constellationName(abbr), 'stars', { cls: 'lbl--constellation lbl--allsky', rank: ALLSKY_NAME_RANK, clear: 6, hideFarSide: true, avoidDisc: true });
      lbl.position.copy(c.normalize().multiplyScalar(R * 1.01));
      holder.add(lbl);
      holder.visible = !(this.lastFigures ?? []).some((f) => f.templateId === abbr);
      this.allSky.add(holder);
      this.allNames.set(abbr, holder);
    }
    this.structureVersion++;
  }

  private buildEqGrid(): void {
    const R = this.R;
    const seg: number[] = [];
    for (const d of [-60, -30, 30, 60]) polylineToSegments(decCircle(d, R * 0.999, 120), seg);
    for (let h = 0; h < 24; h += 2) {
      const pts: THREE.Vector3[] = [];
      for (let d = -90; d <= 90; d += 3) pts.push(eqVec(h * 15, d, R * 0.999));
      polylineToSegments(pts, seg);
      const lbl = makeLabel(`${h}h`, 'circles', { cls: 'lbl--small', color: '#cbd5e1' });
      lbl.position.copy(eqVec(h * 15, 3, R * 1.02));
      this.eqGrid.add(lbl);
    }
    const grid = thinSegments(seg, COLORS.grid, 0.45);
    grid.userData.tip = 'eqGrid';
    this.eqGrid.add(grid);
    this.rot.add(this.eqGrid);
  }

  private buildEcliptic(): void {
    const R = this.R;
    const pts: THREE.Vector3[] = [];
    for (let l = 0; l <= 360; l += 2) {
      const e = eclipticToEquatorial(l, 0);
      pts.push(eqVec(e.ra, e.dec, R));
    }
    const line = fatLine(pts, COLORS.ecliptic, { width: 2, dashed: true, dashSize: R * 0.05, gapSize: R * 0.03 });
    line.userData.tip = 'ecliptic';
    this.ecliptic.add(line);
    const pos = eclipticToEquatorial(135, 0);
    const lbl = makeLabel(t('scene.ecliptic'), 'circles', { color: COLORS.ecliptic, anchor: [0.5, 1.2] });
    lbl.position.copy(eqVec(pos.ra, pos.dec, R * 1.03));
    this.ecliptic.add(lbl);
    // Các điểm hạ chí, thu phân, đông chí
    for (const [l, key] of [
      [90, 'scene.summerSolstice'],
      [180, 'scene.autumnEquinox'],
      [270, 'scene.winterSolstice'],
    ] as const) {
      const e = eclipticToEquatorial(l, 0);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.014, 10, 8), new THREE.MeshBasicMaterial({ color: COLORS.ecliptic }));
      dot.position.copy(eqVec(e.ra, e.dec, R));
      this.ecliptic.add(dot);
      const l2 = makeLabel(t(key), 'circles', { cls: 'lbl--small', color: COLORS.ecliptic });
      l2.position.copy(eqVec(e.ra, e.dec, R * 1.04));
      this.ecliptic.add(l2);
    }
    this.rot.add(this.ecliptic);
  }

  private buildGalactic(): void {
    const R = this.R;
    const pts: THREE.Vector3[] = [];
    for (let l = 0; l <= 360; l += 2) {
      const e = galacticToEquatorial(l, 0);
      pts.push(eqVec(e.ra, e.dec, R));
    }
    const line = fatLine(pts, COLORS.galactic, { width: 1.8, dashed: true, dashSize: R * 0.02, gapSize: R * 0.025 });
    line.userData.tip = 'galactic';
    this.galactic.add(line);
    const c = galacticToEquatorial(0, 0);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.016, 10, 8), new THREE.MeshBasicMaterial({ color: COLORS.galactic }));
    dot.position.copy(eqVec(c.ra, c.dec, R));
    dot.userData.tip = 'galacticCenter';
    this.galactic.add(dot);
    const lbl = makeLabel(t('scene.galacticCenter'), 'circles', { cls: 'lbl--small', color: COLORS.galactic });
    lbl.position.copy(eqVec(c.ra, c.dec, R * 1.04));
    this.galactic.add(lbl);
    const p = galacticToEquatorial(70, 0);
    const lbl2 = makeLabel(t('scene.galactic'), 'circles', { color: COLORS.galactic, anchor: [0.5, 1.2] });
    lbl2.position.copy(eqVec(p.ra, p.dec, R * 1.03));
    this.galactic.add(lbl2);
    this.rot.add(this.galactic);
  }

  /** Thiên thể sâu: vòng tròn rỗng theo màu loại (thiên hà / tinh vân / cụm sao); gắn nhãn định danh cho thiên thể tiêu biểu. */
  private buildDeepSky(): void {
    const n = DSOS.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n);
    const c = new THREE.Color();
    DSOS.forEach((o, i) => {
      const v = eqVec(o.ra, o.dec, this.R * 0.998);
      this.dsoVecs.push(v);
      pos.set([v.x, v.y, v.z], i * 3);
      c.set(DSO_COLORS[dsoGroup(o.type)]);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = o.featured ? 13 : 10;
      alpha[i] = o.featured ? 0.95 : 0.7;
      if (o.featured) {
        const lbl = makeLabel(o.id, 'stars', { cls: 'lbl--dso', color: DSO_COLORS[dsoGroup(o.type)], anchor: [-0.25, 0.5], mag: o.mag, sel: { kind: 'dso', index: i } });
        lbl.position.copy(v);
        this.deepSky.add(lbl);
      }
    });
    const pts = makeStarPoints({ positions: pos, colors: col, sizes: size, alphas: alpha }, this.dsoMaterial);
    pts.renderOrder = 1;
    this.deepSky.add(pts);
    this.deepSky.visible = false;
    this.rot.add(this.deepSky);
  }

  private rebuildZones(lat: number): void {
    const R = this.R * 0.997;
    const lim = zoneLimits(lat);
    const c = 90 - Math.abs(lat);
    const bands: Record<ZoneKey, [number, number]> = {
      circumpolar: lim.circumpolar,
      neverRise: lim.neverRise,
      riseSet: [-c, c],
    };
    for (const k of Object.keys(bands) as ZoneKey[]) {
      const [a, b] = bands[k];
      const mesh = this.zones[k];
      mesh.geometry.dispose();
      mesh.geometry = Math.abs(b - a) < 1e-6 ? new THREE.BufferGeometry() : decBandGeometry(a, b, R);
      mesh.userData.empty = Math.abs(b - a) < 1e-6;
    }
  }

  private rebuildUser(s: AppState): void {
    this.structureVersion++;
    for (const child of [...this.user.children]) {
      this.user.remove(child);
      if (!(child instanceof THREE.Points)) disposeObject(child);
      else child.geometry.dispose();
    }
    const R = this.R;
    const stars = s.stars;
    this.userVecs = [];
    this.catalogHidden.clear();
    if (stars.length) {
      const n = stars.length;
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const size = new Float32Array(n);
      const alpha = new Float32Array(n);
      const c = new THREE.Color();
      stars.forEach((st, i) => {
        const v = eqVec(st.ra, st.dec, R);
        this.userVecs.push({ id: st.id, v, mag: st.mag });
        pos.set([v.x, v.y, v.z], i * 3);
        c.set(st.color);
        col.set([c.r, c.g, c.b], i * 3);
        size[i] = st.kind === 'constellation' ? Math.max(4.5, sizeForMagnitude(st.mag) + 2.5) : 9;
        alpha[i] = 1;
        const idx = st.hip ? catalogIndexByHip(st.hip) : undefined;
        if (idx !== undefined) this.catalogHidden.add(idx);
        if (st.labelled) {
          const lbl = makeLabel(st.short || st.name.split(' (')[0], 'stars', {
            color: st.color,
            cls: 'lbl--star',
            anchor: [-0.12, 0.5],
            mag: st.mag,
            sel: { kind: 'user', id: st.id },
          });
          lbl.position.copy(v);
          this.user.add(lbl);
        }
      });
      const pts = makeStarPoints({ positions: pos, colors: col, sizes: size, alphas: alpha }, this.starMaterial);
      pts.renderOrder = 3;
      this.user.add(pts);
    }

    // Đường nối và tên chòm sao
    if (s.figures.length) {
      const seg: number[] = [];
      const colors: number[] = [];
      const c = new THREE.Color();
      const byId = new Map(stars.map((x) => [x.id, x]));
      for (const fig of s.figures) {
        c.set(fig.color);
        const centroid = new THREE.Vector3();
        let count = 0;
        for (const id of fig.starIds) {
          const st = byId.get(id);
          if (st) {
            centroid.add(eqVec(st.ra, st.dec));
            count++;
          }
        }
        for (const [a, b] of fig.segs) {
          const sa = byId.get(fig.starIds[a]);
          const sb = byId.get(fig.starIds[b]);
          if (!sa || !sb) continue;
          const before = seg.length;
          polylineToSegments(greatArc(eqVec(sa.ra, sa.dec), eqVec(sb.ra, sb.dec), R, 6), seg);
          for (let k = before; k < seg.length; k += 3) colors.push(c.r, c.g, c.b);
        }
        if (count) {
          const lbl = makeLabel(fig.name, 'stars', { color: fig.color, cls: 'lbl--constellation', rank: 30, avoidDisc: true });
          lbl.position.copy(centroid.normalize().multiplyScalar(R * 1.06));
          this.user.add(lbl);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
      lines.renderOrder = 2;
      lines.userData.tip = 'figure';
      this.user.add(lines);
    }
    for (const [abbr, holder] of this.allNames) holder.visible = !s.figures.some((f) => f.templateId === abbr);
    this.rebuildCatalogLabels();
  }

  private rebuildCatalogLabels(): void {
    this.structureVersion++;
    for (const child of [...this.catalogLabels.children]) this.catalogLabels.remove(child);
    const cat = catalogArrays();
    for (let i = 0; i < cat.ra.length && cat.mag[i] < CATALOG_LABEL_MAG; i++) {
      if (this.catalogHidden.has(i)) continue;
      const st = getCatalogStar(i);
      if (!st.shortName) continue;
      const lbl = makeLabel(st.shortName, 'stars', { cls: 'lbl--catalog', anchor: [-0.15, 0.5], mag: cat.mag[i], sel: { kind: 'catalog', index: i }, hideFarSide: true });
      lbl.position.copy(this.catalogVecs[i]);
      this.catalogLabels.add(lbl);
    }
    // Ẩn điểm danh mục trùng với sao của người dùng để không vẽ chồng.
    const alpha = this.catalog.geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    for (let i = 0; i < cat.ra.length; i++) {
      alpha.setX(i, this.catalogHidden.has(i) ? 0 : catalogAlpha(cat.mag[i], this.catalogK));
    }
    alpha.needsUpdate = true;
  }

  private updateSun(s: AppState): void {
    const key = s.sunDate;
    if (key === this.sunKey) return;
    this.sunKey = key;
    const p = sunEquatorial(s);
    eqVec(p.ra, p.dec, this.R, this.sunVec);
    this.sun.position.copy(this.sunVec);
    // Vòng xích vĩ δ☉ (181 điểm, như decCircle) ghi tại chỗ.
    const r = this.R * 0.998;
    const cd = cosD(p.dec) * r;
    const z = sinD(p.dec) * r;
    const a = this.sunPathPts;
    for (let i = 0; i <= 180; i++) {
      const ang = i * 2;
      a[i * 3] = cd * cosD(ang);
      a[i * 3 + 1] = cd * sinD(ang);
      a[i * 3 + 2] = z;
    }
    writeFatLine(this.sunPath, a, 181);
  }

  /** Đăng ký các đối tượng của lớp này cho tô sáng liên kết (xem emphasis.ts). */
  registerEmphasis(fx: EmphasisFx): void {
    fx.add('pole', this.axisLine);
    // Góc xích đạo trời – chân trời: xích đạo trời cũng đậm lên ở cả hai khung (khung thiên cầu không có hình quạt góc).
    fx.add('incl', this.equatorLine);
    fx.add('meridian', this.hourCircleLine);
    for (const k of Object.keys(this.zones) as ZoneKey[]) fx.add(`zone_${k}`, this.zones[k]);
  }

  /**
   * Cập nhật theo trạng thái (chỉ dựng lại phần thay đổi). `emphasis` là nhóm đang tô sáng: các đối tượng của
   * nhóm hiện ra kể cả khi hộp kiểm của chúng tắt (xem trước).
   */
  update(s: AppState, emphasis: string | null = null): void {
    const tg = s.toggles;
    const zk = `${s.lat}`;
    if (zk !== this.zoneKey) {
      this.zoneKey = zk;
      this.rebuildZones(s.lat);
    }
    if (s.stars !== this.lastStars || s.figures !== this.lastFigures) {
      this.lastStars = s.stars;
      this.lastFigures = s.figures;
      this.rebuildUser(s);
    }
    this.equator.visible = tg.equator;
    this.equatorPlane.visible = tg.equatorPlane;
    this.axis.visible = tg.poleAxis || emphasis === 'pole';
    this.hourCircle.visible = tg.hourCircle0 || emphasis === 'meridian';
    this.zones.circumpolar.visible = (tg.zoneCircumpolar || emphasis === 'zone_circumpolar') && !this.zones.circumpolar.userData.empty;
    this.zones.riseSet.visible = (tg.zoneRiseSet || emphasis === 'zone_riseSet') && !this.zones.riseSet.userData.empty;
    this.zones.neverRise.visible = (tg.zoneNeverRise || emphasis === 'zone_neverRise') && !this.zones.neverRise.userData.empty;
    this.eqGrid.visible = tg.eqGrid;
    this.ecliptic.visible = tg.ecliptic;
    this.galactic.visible = tg.galactic;
    this.catalog.visible = tg.catalog;
    this.catalogLabels.visible = tg.catalog;
    if (tg.constellationLines && !this.allLinesRequested) {
      this.allLinesRequested = true;
      loadAllFigures().then(
        (figs) => {
          this.buildAllLines(figs);
          this.onAsyncChange?.();
        },
        (err) => {
          console.error(err);
          this.allLinesRequested = false;
        },
      );
    }
    this.allSky.visible = tg.constellationLines;
    this.deepSky.visible = tg.deepSky;
    this.sun.visible = tg.sun;
    if (tg.sun) this.updateSun(s);
    this.sunPath.visible = tg.sun;

    // Vòng đánh dấu đối tượng đang chọn, và tên của nó nếu nó không có nhãn riêng
    this.updateSelLabel(s);
    const local = this.selectedLocal(s);
    this.selRing.visible = !!local;
    if (local) this.selRing.position.copy(local);
  }

  /** Nhịp "đã chọn" đang chạy: khung nhìn vẽ lại mỗi khung hình chỉ trong lúc này (≈ 300 ms). */
  get pulsing(): boolean {
    return this.pulseT0 >= 0;
  }

  /** Bắt đầu (hoặc bắt đầu lại) nhịp "đã chọn" của vòng chọn. Không làm gì khi vòng không hiện. */
  startSelPulse(now: number): void {
    if (this.selRing.visible) this.pulseT0 = now;
  }

  /** Tiến nhịp một bước (gọi trong frame() khi `pulsing`). Không cấp phát; bước cuối trả vòng về cỡ và độ đục nghỉ. */
  stepSelPulse(now: number): void {
    if (this.pulseT0 < 0) return;
    const u = (now - this.pulseT0) / SEL_PULSE_MS;
    if (u >= 1) this.pulseT0 = -1;
    const a = selPulseAmount(u);
    this.selRing.scale.setScalar(SEL_RING_SCALE * (1 + (SEL_PULSE_SCALE - 1) * a));
    this.selRing.material.opacity = 1 - (1 - SEL_PULSE_OPACITY) * a;
  }

  /**
   * Vị trí thế giới của vòng chọn (ghi vào `out`, không cấp phát); false nếu vòng không hiện. View dùng làm vật cản
   * khi gỡ chồng chéo nhãn (review-4 D2).
   */
  selRingWorld(out: THREE.Vector3): boolean {
    if (!this.selRing.visible) return false;
    out.setFromMatrixPosition(this.selRing.matrixWorld);
    return true;
  }

  /** Đặt ma trận theo vĩ độ và LST. */
  setTime(lat: number, lst: number): void {
    equatorialMatrix(this.view, lat, lst, this.rot.matrix);
    hourFrameMatrix(this.view, lat, this.fixed.matrix);
    this.rot.matrixWorldNeedsUpdate = true;
    this.fixed.matrixWorldNeedsUpdate = true;
  }

  private selectedLocal(s: AppState): THREE.Vector3 | null {
    const sel = s.selected;
    if (!sel) return null;
    if (sel.kind === 'user') return this.userVecs.find((u) => u.id === sel.id)?.v ?? null;
    if (sel.kind === 'dso') return s.toggles.deepSky ? (this.dsoVecs[sel.index] ?? null) : null;
    if (sel.kind === 'catalog') return s.toggles.catalog ? (this.catalogVecs[sel.index] ?? null) : null;
    return s.toggles.sun ? this.sunVec : null;
  }

  /**
   * Tìm đối tượng chọn được có điểm số nhỏ nhất. `score(local, tolerancePx, priority)` trả về điểm
   * (Infinity = loại). Chỉ tạo đối tượng Selection cho kết quả thắng — không cấp phát cho từng sao.
   * Sao danh mục bị giới hạn theo cấp sao của chất lượng thích ứng (catalogDrawCount).
   */
  pickBest(s: AppState, score: (local: THREE.Vector3, tolerancePx: number, priority: number) => number): NonNullable<Selection> | null {
    let best = Infinity;
    let kind: 'user' | 'sun' | 'catalog' | 'dso' | null = null;
    let which = -1;
    for (let i = 0; i < this.userVecs.length; i++) {
      const sc = score(this.userVecs[i].v, 12, 2);
      if (sc < best) {
        best = sc;
        kind = 'user';
        which = i;
      }
    }
    if (s.toggles.sun) {
      const sc = score(this.sunVec, 16, 3);
      if (sc < best) {
        best = sc;
        kind = 'sun';
      }
    }
    if (s.toggles.deepSky) {
      for (let i = 0; i < this.dsoVecs.length; i++) {
        const sc = score(this.dsoVecs[i], 9, 1.5);
        if (sc < best) {
          best = sc;
          kind = 'dso';
          which = i;
        }
      }
    }
    if (s.toggles.catalog) {
      const mag = catalogArrays().mag;
      for (let i = 0; i < this.catalogDrawCount; i++) {
        if (this.catalogHidden.has(i)) continue;
        const sc = score(this.catalogVecs[i], mag[i] < 2 ? 9 : 6, 1);
        if (sc < best) {
          best = sc;
          kind = 'catalog';
          which = i;
        }
      }
    }
    if (kind === 'user') return { kind: 'user', id: this.userVecs[which].id };
    if (kind === 'sun') return { kind: 'sun' };
    if (kind === 'catalog') return { kind: 'catalog', index: which };
    if (kind === 'dso') return { kind: 'dso', index: which };
    return null;
  }

  /**
   * Chỉ vẽ (và cho chọn) sao danh mục có cấp ≤ `limit`; null = tất cả.
   * Danh mục được sắp theo cấp sao tăng dần (xem catalog.test.ts) nên chỉ cần đặt drawRange.
   */
  setCatalogMagLimit(limit: number | null): void {
    const mag = catalogArrays().mag;
    let n = mag.length;
    if (limit !== null) {
      n = 0;
      while (n < mag.length && mag[n] <= limit) n++;
    }
    if (n === this.catalogDrawCount) return;
    this.catalogDrawCount = n;
    this.catalog.geometry.setDrawRange(0, n);
  }

  setPixelRatio(pr: number): void {
    this.starMaterial.uniforms.uPixelRatio.value = pr;
    this.dsoMaterial.uniforms.uPixelRatio.value = pr;
  }

  /** Làm mờ sao nằm dưới chân trời (chỉ dùng ở khung chân trời). */
  setBelowDim(f: number): void {
    this.starMaterial.uniforms.uBelowDim.value = f;
    this.dsoMaterial.uniforms.uBelowDim.value = f;
  }

  /** Các đối tượng hiển thị chú thích khi rê chuột. */
  hoverTargets(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const root of [this.rot, this.fixed]) {
      root.traverse((o) => {
        if (o.userData.tip && !(o instanceof THREE.Points)) out.push(o);
      });
    }
    return out;
  }
}

/** Sao danh mục sáng hơn cấp này (và có tên riêng) luôn có nhãn tên. */
const CATALOG_LABEL_MAG = 1.6;

/** Độ mờ của một sao danh mục theo cấp sao, nhân hệ số của khung nhìn. */
function catalogAlpha(mag: number, k: number): number {
  return Math.max(0.35, Math.min(1, 1.15 - mag * 0.15)) * k;
}

let _glow: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,180,0.9)');
  g.addColorStop(0.3, 'rgba(255,210,90,0.35)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
