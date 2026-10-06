// Lớp "chân trời": các đối tượng gắn với người quan sát (chân trời, kinh tuyến, thiên đỉnh/thiên để,
// lưới độ cao–phương vị, đường thẳng đứng qua sao đang chọn, các góc minh họa).
// Dựng trong khung chân trời 3D (X = Đông, Y = Thiên đỉnh, Z = Nam); ở khung thiên cầu được quay (90° − φ).

import * as THREE from 'three';
import type { Line2 } from 'three/addons/lines/Line2.js';
import { equatorialToHorizontalInto, equatorInclination, fmtDeg, fmtDegSigned, poleAltitude, sunPosition, type Horizontal } from '../astro';
import { t } from '../i18n';
import { catalogArrays } from '../data/catalog';
import { resolveSelection, sunJd } from '../selection';
import { lstOf, type AppState, type Selection } from '../state';
import { horizonFrameMatrix, horVec, type ViewKind } from './frames';
import {
  arrowTexture,
  COLORS,
  dynamicFatLine,
  fatLine,
  greatArcInto,
  polylineToSegments,
  ringTexture,
  sectorGeometry,
  thinSegments,
  translucent,
  writeFatLine,
} from './geom';
import type { EmphasisFx } from './emphasis';
import { makeLabel, setLabelText, type Label } from './labels';
import { SEL_RING_SCALE } from './skyLayer';

/** Số điểm tối đa của các cung động (cung phương vị: 0…360° mỗi 3° → 121 điểm). */
const MAX_ARC_POINTS = 121;
const _pts = new Float32Array(MAX_ARC_POINTS * 3);
const _star = new THREE.Vector3();
const _foot = new THREE.Vector3();
const _zen = new THREE.Vector3();
const _a = new THREE.Vector3();
const _radec = { ra: 0, dec: 0 };
const _hor: Horizontal = { alt: 0, az: 0 };
/** Độ mờ của dấu "bóng" (vòng đứt nét, chấm, cung h) khi đối tượng chọn khuất dưới mặt đất. */
const GHOST_OPACITY = 0.8;
/** Cỡ mũi tên mép khung so với vòng chọn (fix-2 #11). */
export const GHOST_ARROW_K = 0.42;
/**
 * Đoạn cung h tính từ chân đường thẳng đứng (độ) mà nhãn phải né (fix-3 #12): chữ hướng "B" từng nằm ngay trên vạch
 * hồng ở chân đường thẳng đứng qua Polaris.
 */
const FOOT_ARC_DEG = 6;
const _g = new THREE.Vector3();

export class HorizonLayer {
  readonly group = new THREE.Group();
  /** Nhãn và đích rê chuột của lớp này cố định sau khi dựng (xem SkyLayer.structureVersion). */
  readonly structureVersion = 0;
  private ring = new THREE.Group();
  private meridian = new THREE.Group();
  private meridianLine: Line2;
  private zenith = new THREE.Group();
  private grid = new THREE.Group();
  private vertical = new THREE.Group();
  private azGroup = new THREE.Group();
  private verticalLine: Line2;
  private altArc: Line2;
  private azArc: Line2;
  private altLabel: Label;
  private azLabel: Label;
  private angle = new THREE.Group();
  private angleSector: THREE.Mesh;
  private angleArc: Line2;
  private angleLabel: Label;
  private poleAlt = new THREE.Group();
  private poleSector: THREE.Mesh;
  private poleArc: Line2;
  private poleLabel: Label;
  private latKey = NaN;
  /** Khóa của lần dựng đường thẳng đứng gần nhất (đối tượng chọn, h, A làm tròn 0,001°, bật/tắt). */
  private vKeySel: Selection | undefined = undefined;
  private vKeyStars: AppState['stars'] | null = null;
  private vKeyAlt = NaN;
  private vKeyAz = NaN;
  private vKeyOn = false;
  /**
   * Đối tượng đang chọn nằm dưới chân trời mà mặt dưới bị cắt (giản đồ chân trời, fix-1 #2): dấu "bóng" vẽ xuyên qua
   * mặt đất trong một lượt vẽ riêng không có mặt phẳng cắt (View.frame) — vòng chọn đứt nét, chấm sao và cung độ cao
   * h đứt nét, mờ. Dựng một lần; mỗi lần cập nhật chỉ đổi vị trí và ghi lại cung tại chỗ (writeFatLine).
   */
  readonly ghost = new THREE.Scene();
  /** Lượt vẽ "bóng" cần chạy (View.frame đọc mỗi khung hình). */
  ghostOn = false;
  private ghostRing: THREE.Sprite | null = null;
  private ghostDot: THREE.Mesh | null = null;
  private ghostArc: Line2 | null = null;
  /** Mũi tên mép khung: chỉ hiện khi vị trí thật của dấu "bóng" ra ngoài khung (fix-2 #11). */
  private ghostArrow: THREE.Sprite | null = null;
  /** Vị trí thật (tọa độ cảnh) của đối tượng chọn khuất dưới mặt đất. */
  private readonly ghostStar = new THREE.Vector3();
  /** Dấu "bóng" đang bị kẹp vào trong mép khung (đọc bởi kiểm thử chấp nhận). */
  ghostClamped = false;
  /** Nhãn "Sirius đang ở dưới chân trời (h = −73°)" — trong cảnh chính (nhãn CSS không bị cắt). */
  private under = new THREE.Group();
  private underLabel: Label | null = null;
  private underSel: Selection | undefined = undefined;
  private underStars: AppState['stars'] | null = null;
  private underName = '';
  private underKey = NaN;
  private uKeyAlt = NaN;
  private uKeyAz = NaN;
  private uKeyV = false;
  /** h, A (độ) của đối tượng chọn ở lần dựng đường thẳng đứng gần nhất — để tính chân đường (verticalFoot). */
  private vAlt = 0;
  private vAz = 0;
  private sunKey = '';
  private sunRa = 0;
  private sunDec = 0;
  private readonly view: ViewKind;
  private readonly R: number;

  constructor(view: ViewKind, R: number) {
    this.view = view;
    this.R = R;
    this.group.matrixAutoUpdate = false;

    // Đường chân trời và các hướng
    const ringPts: THREE.Vector3[] = [];
    for (let a = 0; a <= 360; a += 2) ringPts.push(horVec(0, a, R));
    const ring = fatLine(ringPts, COLORS.horizon, { width: view === 'horizon' ? 2.6 : 2.2, opacity: view === 'horizon' ? 1 : 0.85 });
    ring.userData.tip = 'horizon';
    this.ring.add(ring);
    const dirs: [string, number][] = [
      ['scene.dirN', 0],
      ['scene.dirE', 90],
      ['scene.dirS', 180],
      ['scene.dirW', 270],
    ];
    for (const [key, az] of dirs) {
      const lbl = makeLabel(t(key), 'directions', { cls: 'lbl--dir', hideBelowHorizon: false });
      // Khung thiên cầu: chữ hướng xa vành hơn (1,07 → 1,16 R, fix-2 #3) — "B" không còn chạm vòng chọn quanh Polaris
      // (thiên cực nằm ngay trên vành, chỉ cách điểm Bắc φ độ).
      const rr = R * (view === 'horizon' ? 1.1 : 1.16);
      lbl.position.copy(horVec(0, az, rr));
      // Vị trí thay thế dọc theo đường chân trời (fix-1 G1): chữ B không đè lên vòng chọn quanh Polaris ở khung thiên
      // cầu — dời sang bên cạnh, vẫn sát điểm hướng của nó. Cố định trong khung chân trời, dựng một lần.
      lbl.userData.alts = [horVec(0, az + 7, rr), horVec(0, az - 7, rr), horVec(0, az + 14, rr), horVec(0, az - 14, rr), horVec(0, az, rr * 1.12)];
      this.ring.add(lbl);
    }
    this.group.add(this.ring);

    // Kinh tuyến thiên cầu: vòng tròn lớn qua Bắc – Thiên đỉnh – Nam – Thiên để
    const mer: THREE.Vector3[] = [];
    for (let a = 0; a <= 360; a += 2) mer.push(new THREE.Vector3(0, Math.sin((a * Math.PI) / 180) * R, Math.cos((a * Math.PI) / 180) * R));
    const merLine = fatLine(mer, COLORS.meridian, { width: 1.6, opacity: 0.8 });
    merLine.userData.tip = 'meridian';
    this.meridianLine = merLine;
    this.meridian.add(merLine);
    const merLbl = makeLabel(t('scene.meridian'), 'circles', { color: COLORS.meridian, anchor: [0.5, 1.2] });
    merLbl.position.copy(horVec(62, 180, R * 1.03));
    this.meridian.add(merLbl);
    this.group.add(this.meridian);

    // Thiên đỉnh / Thiên để
    for (const sign of [1, -1]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.02, 14, 10), new THREE.MeshBasicMaterial({ color: COLORS.zenith }));
      dot.position.set(0, sign * R, 0);
      dot.userData.tip = sign > 0 ? 'zenith' : 'nadir';
      this.zenith.add(dot);
      const lbl = makeLabel(t(sign > 0 ? 'scene.zenith' : 'scene.nadir'), 'poles', { color: '#f8fafc' });
      lbl.position.set(0, sign * R * 1.07, 0);
      // Vị trí thay thế dọc theo đường thiên đỉnh (fix-1 G1): khi quá sát chữ hướng (khung thiên cầu: "Thiên đỉnh"
      // ngay cạnh "T"), nhãn lùi vào trong theo đường đứt nét thay vì chen sát.
      lbl.userData.alts = [new THREE.Vector3(0, sign * R * 0.9, 0), new THREE.Vector3(0, sign * R * 0.78, 0), new THREE.Vector3(0, sign * R * 1.2, 0)];
      this.zenith.add(lbl);
    }
    const zLine = fatLine([new THREE.Vector3(0, view === 'horizon' ? 0 : 0.3 * R, 0), new THREE.Vector3(0, R, 0)], COLORS.zenith, {
      width: 1.2,
      opacity: 0.6,
      dashed: true,
      dashSize: R * 0.03,
      gapSize: R * 0.02,
    });
    zLine.userData.tip = 'zenithLine';
    this.zenith.add(zLine);
    this.group.add(this.zenith);

    // Lưới độ cao – phương vị
    const seg: number[] = [];
    for (const alt of [-60, -30, 30, 60]) {
      const pts: THREE.Vector3[] = [];
      for (let a = 0; a <= 360; a += 4) pts.push(horVec(alt, a, R * 0.999));
      polylineToSegments(pts, seg);
    }
    for (let az = 0; az < 360; az += 30) {
      const pts: THREE.Vector3[] = [];
      for (let alt = -90; alt <= 90; alt += 3) pts.push(horVec(alt, az, R * 0.999));
      polylineToSegments(pts, seg);
    }
    const grid = thinSegments(seg, COLORS.altAzGrid, 0.35);
    grid.userData.tip = 'altAzGrid';
    this.grid.add(grid);
    for (const alt of [30, 60]) {
      const l = makeLabel(`${alt}°`, 'circles', { cls: 'lbl--small', color: '#a7f3d0' });
      l.position.copy(horVec(alt, 135, R * 1.01));
      this.grid.add(l);
    }
    this.group.add(this.grid);

    // Đường thẳng đứng qua đối tượng đang chọn + cung độ cao, cung phương vị
    const bounds = R * 1.01;
    this.verticalLine = dynamicFatLine(49, COLORS.vertical, { width: 1.6, opacity: 0.85, dashed: true, dashSize: R * 0.03, gapSize: R * 0.02, boundsRadius: bounds });
    this.verticalLine.userData.tip = 'vertical';
    this.altArc = dynamicFatLine(46, COLORS.vertical, { width: 4, boundsRadius: bounds });
    this.altArc.userData.tip = 'altitudeArc';
    this.azArc = dynamicFatLine(MAX_ARC_POINTS, COLORS.azimuth, { width: 4, boundsRadius: bounds });
    this.azArc.userData.tip = 'azimuthArc';
    this.altLabel = makeLabel('', 'angles', { cls: 'lbl--angle', color: COLORS.vertical });
    this.azLabel = makeLabel('', 'angles', { cls: 'lbl--angle', color: COLORS.azimuth, hideBelowHorizon: false });
    // Vị trí thay thế (ghi lại khi A đổi): nhãn "A = …" né hình người quan sát (vật cản, fix-1 G1) — sang hai bên
    // cung, rồi xa hơn theo hướng giữa cung.
    this.azLabel.userData.alts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.azGroup.add(this.azArc, this.azLabel);
    this.azGroup.visible = view === 'horizon';
    this.vertical.add(this.verticalLine, this.altArc, this.altLabel, this.azGroup);
    this.group.add(this.vertical);

    if (view === 'horizon') {
      // Dấu "bóng" của đối tượng chọn khuất dưới mặt đất (fix-1 #2): không kiểm tra chiều sâu — vẽ xuyên qua đĩa.
      const ring = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: ringTexture('#ffffff', true),
          transparent: true,
          opacity: GHOST_OPACITY,
          depthTest: false,
          depthWrite: false,
          sizeAttenuation: false,
        }),
      );
      ring.scale.setScalar(SEL_RING_SCALE);
      ring.renderOrder = 2;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(R * 0.012, 10, 8),
        new THREE.MeshBasicMaterial({ color: COLORS.zenith, transparent: true, opacity: GHOST_OPACITY, depthTest: false, depthWrite: false }),
      );
      dot.renderOrder = 1;
      const arc = dynamicFatLine(46, COLORS.vertical, {
        width: 3,
        opacity: GHOST_OPACITY,
        dashed: true,
        dashSize: R * 0.025,
        gapSize: R * 0.025,
        depthTest: false,
        boundsRadius: bounds,
      });
      const arrow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: arrowTexture('#ffffff'), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, sizeAttenuation: false }),
      );
      arrow.scale.setScalar(SEL_RING_SCALE * GHOST_ARROW_K);
      arrow.renderOrder = 3;
      arrow.visible = false;
      this.ghost.add(arc, dot, ring, arrow);
      this.ghostArrow = arrow;
      this.ghostRing = ring;
      this.ghostDot = dot;
      this.ghostArc = arc;
      const lbl = makeLabel('', 'angles', { cls: 'lbl--under', edge: COLORS.vertical, anchor: [-0.1, 0.5], hideBelowHorizon: false, rank: 1, must: true });
      lbl.userData.alts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      this.underLabel = lbl;
      this.under.add(lbl);
      this.under.visible = false;
      this.group.add(this.under);
    }

    // Góc giữa xích đạo trời và chân trời (trong mặt phẳng kinh tuyến)
    this.angleSector = new THREE.Mesh(new THREE.BufferGeometry(), translucent(COLORS.angle, 0.28));
    this.angleSector.userData.tip = 'angle';
    this.angleArc = dynamicFatLine(41, COLORS.angle, { width: 2.4, boundsRadius: R * 0.6 });
    this.angleLabel = makeLabel('', 'angles', { cls: 'lbl--angle lbl--key', edge: COLORS.angle, anchor: [-0.04, 0.5], emph: 'incl' });
    this.angle.add(this.angleSector, this.angleArc, this.angleLabel);
    this.group.add(this.angle);

    // Độ cao thiên cực = vĩ độ
    this.poleSector = new THREE.Mesh(new THREE.BufferGeometry(), translucent(COLORS.axis, 0.35));
    this.poleSector.userData.tip = 'poleAltitude';
    this.poleArc = dynamicFatLine(41, COLORS.axis, { width: 3, boundsRadius: R * 0.6 });
    // Chip tối, chữ sáng, viền xanh của trục: không còn "xanh trên xanh trên xanh lá" (review-1 F2). Nhãn đặt ngay
    // ngoài trung điểm của cung, chữ chạy ra xa trục.
    this.poleLabel = makeLabel('', 'angles', { cls: 'lbl--angle lbl--key', edge: COLORS.axis, anchor: [-0.04, 0.5], emph: 'pole' });
    // Vị trí thay thế dọc theo cung (ghi lại khi vĩ độ đổi): nhãn nhường chỗ cho chữ hướng B/N thay vì che nó.
    this.poleLabel.userData.alts = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ];
    this.angleLabel.userData.alts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this.poleAlt.add(this.poleSector, this.poleArc, this.poleLabel);
    this.group.add(this.poleAlt);
  }

  private rebuildAngles(lat: number): void {
    const R = this.R;
    const r = R * 0.55;
    const rp = R * 0.5;
    const north = lat >= 0;
    // Góc xích đạo – chân trời: từ điểm Nam (Bắc bán cầu) lên tới điểm cao nhất của xích đạo trời.
    const incl = equatorInclination(lat);
    const baseAz = north ? 180 : 0;
    const from = horVec(0, baseAz, 1);
    const to = horVec(incl, baseAz, 1);
    this.angleSector.geometry.dispose();
    this.angleSector.geometry = sectorGeometry(from, to, r);
    writeFatLine(this.angleArc, _pts, greatArcInto(from, to, r, 40, _pts));
    this.angleLabel.position.copy(horVec(incl * 0.6, baseAz, r * 1.08));
    const aAlts = this.angleLabel.userData.alts!;
    horVec(incl * 0.35, baseAz, r * 1.08, aAlts[0]);
    horVec(incl * 0.85, baseAz, r * 1.08, aAlts[1]);
    horVec(incl * 0.15, baseAz, r * 1.08, aAlts[2]);
    horVec(Math.min(incl + 8, 89), baseAz, r * 1.08, aAlts[3]);
    setLabelText(this.angleLabel, `90° − |φ| = ${fmtDeg(incl)}`);

    // Độ cao thiên cực: từ điểm Bắc lên thiên cực Bắc (hoặc từ Nam lên thiên cực Nam).
    const pAlt = poleAltitude(lat);
    const pAz = north ? 0 : 180;
    const pf = horVec(0, pAz, 1);
    const pt = horVec(pAlt, pAz, 1);
    this.poleSector.geometry.dispose();
    this.poleSector.geometry = pAlt < 0.01 ? new THREE.BufferGeometry() : sectorGeometry(pf, pt, rp);
    if (pAlt < 0.01) writeFatLine(this.poleArc, _pts, greatArcInto(pf, pf, rp, 1, _pts));
    else writeFatLine(this.poleArc, _pts, greatArcInto(pf, pt, rp, 40, _pts));
    this.poleLabel.position.copy(horVec(Math.max(pAlt / 2, 4), pAz, rp * 1.06));
    // Thứ tự thử: gần chân trời hơn, gần thiên cực hơn, sát chân trời, rồi vượt quá thiên cực.
    const pAlts = this.poleLabel.userData.alts!;
    horVec(Math.max(pAlt * 0.25, 2), pAz, rp * 1.06, pAlts[0]);
    horVec(Math.max(pAlt * 0.75, 6), pAz, rp * 1.06, pAlts[1]);
    horVec(1, pAz, rp * 1.06, pAlts[2]);
    horVec(Math.min(pAlt + 8, 89), pAz, rp * 1.06, pAlts[3]);
    horVec(Math.min(pAlt + 16, 89), pAz, rp * 1.06, pAlts[4]);
    // Lệch sang hai bên đường kinh tuyến (quyết định 2026-10-05, bố cục tập trung): khi khung nhìn thấp lại, mọi vị trí
    // dọc kinh tuyến có thể trùng chữ B và vòng chọn quanh Polaris; nhãn dời ngang ra cạnh cung, vẫn gần cung.
    horVec(Math.max(pAlt / 2, 4), pAz + 45, rp * 1.06, pAlts[5]);
    horVec(Math.max(pAlt / 2, 4), pAz - 45, rp * 1.06, pAlts[6]);
    // Lệch sang bên và thấp hơn (fix-3 #12): chữ B né chân đường thẳng đứng qua Polaris bằng cách dời sang bên phải
    // kinh tuyến, đúng chỗ của vị trí lệch +45° ở trên — nhãn hạ xuống sát chân trời, ngay dưới chữ B.
    horVec(Math.max(pAlt / 6, 2), pAz + 45, rp * 1.06, pAlts[7]);
    setLabelText(this.poleLabel, `${t(north ? 'scene.ncpAltitude' : 'scene.scpAltitude')} = |φ| = ${fmtDeg(pAlt)}`);
  }

  /** Đăng ký các đối tượng của lớp này cho tô sáng liên kết (xem emphasis.ts). */
  registerEmphasis(fx: EmphasisFx): void {
    fx.add('pole', this.poleArc, this.poleSector);
    fx.add('incl', this.angleArc, this.angleSector);
    fx.add('az', this.azArc, this.verticalLine);
    fx.add('alt', this.altArc, this.verticalLine);
    fx.add('altaz', this.azArc, this.altArc, this.verticalLine);
    fx.add('meridian', this.meridianLine);
  }

  /** `emphasis`: nhóm đang tô sáng — các đối tượng của nhóm hiện ra kể cả khi hộp kiểm tắt (xem trước). */
  update(s: AppState, emphasis: string | null = null): void {
    const tg = s.toggles;
    const isHorizon = this.view === 'horizon';
    if (s.lat !== this.latKey) {
      this.latKey = s.lat;
      horizonFrameMatrix(this.view, s.lat, this.group.matrix);
      this.group.matrixWorldNeedsUpdate = true;
      this.rebuildAngles(s.lat);
    }
    this.ring.visible = isHorizon || tg.horizonOnSphere;
    this.meridian.visible = tg.meridian || emphasis === 'meridian';
    this.zenith.visible = tg.zenithNadir;
    this.grid.visible = tg.altAzGrid;
    this.angle.visible = isHorizon && (tg.angle || emphasis === 'incl');
    this.poleAlt.visible = isHorizon && (tg.poleAltitude || emphasis === 'pole');
    const obj = this.selectedRaDec(s);
    const hor = obj ? equatorialToHorizontalInto(obj.ra, obj.dec, s.lat, lstOf(s), _hor) : null;
    this.updateVertical(s, hor, emphasis === 'az' || emphasis === 'alt' || emphasis === 'altaz');
    this.updateUnder(s, hor);
  }

  /**
   * Đối tượng chọn dưới chân trời khi mặt dưới bị cắt (fix-1 #2): dấu "bóng" và nhãn cảnh báo. Không cấp phát mỗi
   * lần gọi: tên chỉ tra lại khi lựa chọn đổi; chữ nhãn chỉ dựng lại khi số độ nguyên của h đổi.
   */
  private updateUnder(s: AppState, hor: Horizontal | null): void {
    const lbl = this.underLabel;
    if (!lbl) return;
    const on = !!hor && hor.alt < 0 && !s.toggles.underside;
    this.ghostOn = on;
    this.under.visible = on;
    if (!on || !hor) {
      this.uKeyAlt = NaN;
      return;
    }
    const R = this.R;
    const { alt, az } = hor;
    // Bỏ qua khi không có gì đổi đáng kể (0,001°, như đường thẳng đứng): đối tượng chọn, h, A, hộp kiểm đường thẳng đứng.
    const altK = Math.round(alt * 1000);
    const azK = Math.round(az * 1000);
    const vOn = s.toggles.verticalCircle;
    if (altK === this.uKeyAlt && azK === this.uKeyAz && vOn === this.uKeyV && s.selected === this.underSel && s.stars === this.underStars) return;
    this.uKeyAlt = altK;
    this.uKeyAz = azK;
    this.uKeyV = vOn;
    const star = horVec(alt, az, R, _star);
    this.ghostStar.copy(star);
    this.ghostRing!.position.copy(star);
    this.ghostDot!.position.copy(star);
    // Cung h đứt nét: chỉ khi đường thẳng đứng đang bật (cùng hộp kiểm với cung h liền nét phía trên chân trời).
    const arc = this.ghostArc!;
    arc.visible = vOn;
    if (arc.visible) {
      const foot = horVec(0, az, 1, _foot);
      writeFatLine(arc, _pts, greatArcInto(foot, horVec(alt, az, 1, _a), R * 1.002, Math.max(4, Math.ceil(-alt / 2)), _pts));
    }
    // Nhãn: cạnh dấu bóng; thay thế ở chân cung trên đường chân trời (trong và ngoài vành), rồi giữa cung.
    lbl.position.copy(star);
    const alts = lbl.userData.alts!;
    horVec(0, az, R * 0.86, alts[0]);
    horVec(0, az, R * 1.14, alts[1]);
    horVec(alt / 2, az, R, alts[2]);
    if (s.selected !== this.underSel || s.stars !== this.underStars) {
      this.underSel = s.selected;
      this.underStars = s.stars;
      this.underName = resolveSelection(s)?.name ?? '';
      this.underKey = NaN;
    }
    // Khóa chữ: số độ nguyên của h; sát chân trời (|h| < 0,95°) dùng một chữ số thập phân để không ghi "h = 0°" (và
    // không nhỏ hơn 0,1° để dấu âm luôn hiện).
    const near = alt > -0.95;
    const key = near ? 1000 + Math.round(alt * 10) : Math.round(alt);
    if (key !== this.underKey) {
      this.underKey = key;
      setLabelText(lbl, t('scene.belowHorizon', { name: this.underName, h: near ? fmtDegSigned(Math.min(alt, -0.1), 1) : fmtDegSigned(key, 0) }));
    }
  }

  /**
   * Kẹp dấu "bóng" vào trong khung (fix-2 #11): khi hình chiếu của đối tượng khuất dưới mặt đất rơi ra ngoài canvas
   * (hay quá sát mép — vòng bị cắt nửa), vòng đứt nét và nhãn cảnh báo dời vào trong mép (cùng độ sâu), và một mũi
   * tên nhỏ ở phía mép chỉ về vị trí thật. Gọi mỗi lần vẽ khi `ghostOn`; chỉ dùng vectơ nháp, không cấp phát.
   * `ringPx`: bán kính ngoài của vòng chọn trên màn hình.
   */
  clampGhost(camera: THREE.Camera, W: number, H: number, ringPx: number): void {
    const ring = this.ghostRing;
    const arrow = this.ghostArrow;
    const lbl = this.underLabel;
    if (!ring || !arrow || !lbl) return;
    camera.updateMatrixWorld();
    _g.copy(this.ghostStar).project(camera);
    const sx = ((_g.x + 1) / 2) * W;
    const sy = ((1 - _g.y) / 2) * H;
    const arrowPx = ringPx * 2 * GHOST_ARROW_K;
    const m = ringPx + arrowPx + 6;
    const inside = _g.z <= 1 && sx >= m && sx <= W - m && sy >= m && sy <= H - m;
    const wasClamped = this.ghostClamped;
    this.ghostClamped = !inside && W > 2 * m && H > 2 * m;
    if (!this.ghostClamped) {
      if (wasClamped) {
        ring.position.copy(this.ghostStar);
        lbl.position.copy(this.ghostStar);
        this.ghostDot!.visible = true;
        arrow.visible = false;
      }
      return;
    }
    // Điểm sau camera (z > 1): lật hướng để mũi tên vẫn chỉ đúng phía.
    const behind = _g.z > 1;
    let tx = behind ? W - sx : sx;
    let ty = behind ? H - sy : sy;
    const cx = Math.min(W - m, Math.max(m, tx));
    const cy = Math.min(H - m, Math.max(m, ty));
    // Hướng (px, y xuống) từ điểm đã kẹp tới vị trí thật.
    tx -= cx;
    ty -= cy;
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len;
    const uy = ty / len;
    const z = behind ? 0.5 : _g.z;
    _g.set((cx / W) * 2 - 1, 1 - (cy / H) * 2, z).unproject(camera);
    ring.position.copy(_g);
    lbl.position.copy(_g);
    this.ghostDot!.visible = false;
    // Mũi tên nằm giữa vòng và mép, chỉ về vị trí thật (ảnh gốc chỉ xuống: góc xoay = atan2(ux, uy)).
    const d = ringPx + arrowPx / 2 + 2;
    _g.set(((cx + ux * d) / W) * 2 - 1, 1 - ((cy + uy * d) / H) * 2, z).unproject(camera);
    arrow.position.copy(_g);
    (arrow.material as THREE.SpriteMaterial).rotation = Math.atan2(ux, uy);
    arrow.visible = true;
  }

  /**
   * Chân đường thẳng đứng qua đối tượng chọn trên đường chân trời và điểm trên cung h cách chân FOOT_ARC_DEG độ (tọa độ
   * thế giới, ghi vào `foot` và `up`) — View đặt một vật cản nhỏ ở đó để chữ hướng không che vạch hồng (fix-3 #12).
   * Trả về false khi đường thẳng đứng đang ẩn. Không cấp phát.
   */
  verticalFoot(foot: THREE.Vector3, up: THREE.Vector3): boolean {
    if (!this.vertical.visible) return false;
    const R = this.R;
    const a = this.vAlt;
    const d = Math.min(Math.abs(a), FOOT_ARC_DEG);
    const m = this.group.matrixWorld;
    horVec(0, this.vAz, R, foot).applyMatrix4(m);
    horVec(a < 0 ? -d : d, this.vAz, R, up).applyMatrix4(m);
    return true;
  }

  /**
   * Vị trí ĐÃ VẼ (sau khi kẹp vào khung) của dấu "bóng": tâm vòng đứt nét vào `ring`, tâm mũi tên mép khung vào
   * `arrow` (tọa độ thế giới; cảnh "bóng" không có phép biến đổi). Trả về 0: không có dấu "bóng"; 1: chỉ có vòng;
   * 2: vòng và mũi tên. View dùng làm vật cản cứng cho nhãn (fix-3 #3). Không cấp phát.
   */
  ghostMarks(ring: THREE.Vector3, arrow: THREE.Vector3): number {
    if (!this.ghostOn || !this.ghostRing || !this.ghostArrow) return 0;
    ring.copy(this.ghostRing.position);
    if (!this.ghostArrow.visible) return 1;
    arrow.copy(this.ghostArrow.position);
    return 2;
  }

  /**
   * (α, δ) của đối tượng đang chọn, không cấp phát (khác resolveSelection: không dựng tên/mô tả).
   * Trả về null nếu không có đối tượng hợp lệ.
   */
  private selectedRaDec(s: AppState): { ra: number; dec: number } | null {
    const sel = s.selected;
    if (!sel) return null;
    if (sel.kind === 'user') {
      const stars = s.stars;
      for (let i = 0; i < stars.length; i++) {
        if (stars[i].id === sel.id) {
          _radec.ra = stars[i].ra;
          _radec.dec = stars[i].dec;
          return _radec;
        }
      }
      return null;
    }
    if (sel.kind === 'catalog') {
      const cat = catalogArrays();
      if (sel.index < 0 || sel.index >= cat.ra.length) return null;
      _radec.ra = cat.ra[sel.index];
      _radec.dec = cat.dec[sel.index];
      return _radec;
    }
    if (!s.toggles.sun) return null;
    if (s.sunDate !== this.sunKey) {
      this.sunKey = s.sunDate;
      const p = sunPosition(sunJd(s.sunDate));
      this.sunRa = p.ra;
      this.sunDec = p.dec;
    }
    _radec.ra = this.sunRa;
    _radec.dec = this.sunDec;
    return _radec;
  }

  /** Cập nhật đường thẳng đứng theo vị trí hiện tại của đối tượng đang chọn. */
  private updateVertical(s: AppState, hor: Horizontal | null, preview = false): void {
    const on = s.toggles.verticalCircle || preview;
    this.vertical.visible = on && !!hor;
    if (!on || !hor) {
      this.vKeyOn = false;
      return;
    }
    const { alt, az } = hor;
    // Bỏ qua khi không có gì đổi đáng kể (0,001°): selection, danh sách sao, h, A, bật/tắt.
    const altK = Math.round(alt * 1000);
    const azK = Math.round(az * 1000);
    if (this.vKeyOn && s.selected === this.vKeySel && s.stars === this.vKeyStars && altK === this.vKeyAlt && azK === this.vKeyAz) return;
    this.vKeyOn = true;
    this.vKeySel = s.selected;
    this.vKeyStars = s.stars;
    this.vKeyAlt = altK;
    this.vKeyAz = azK;

    this.vAlt = alt;
    this.vAz = az;
    const R = this.R;
    const star = horVec(alt, az, 1, _star);
    const foot = horVec(0, az, 1, _foot);
    const zen = _zen.set(0, alt >= 0 ? 1 : -1, 0);
    // Cung từ thiên đỉnh (hoặc thiên để) qua sao tới chân trời
    writeFatLine(this.verticalLine, _pts, greatArcInto(zen, foot, R * 1.001, 48, _pts));
    // Cung độ cao h (từ chân trời đến sao)
    writeFatLine(this.altArc, _pts, greatArcInto(foot, star, R * 1.002, Math.max(4, Math.ceil(Math.abs(alt) / 2)), _pts));
    horVec(alt / 2, az + 4, R * 1.04, this.altLabel.position);
    setLabelText(this.altLabel, `h = ${fmtDeg(alt, 1)}`);
    // Cung phương vị A (dọc chân trời, từ Bắc qua Đông)
    const rr = this.view === 'horizon' ? R * 0.35 : R * 1.003;
    const steps = Math.min(MAX_ARC_POINTS - 1, Math.max(2, Math.ceil(az / 3)));
    for (let i = 0; i <= steps; i++) {
      horVec(0, (az * i) / steps, rr, _a);
      _pts[i * 3] = _a.x;
      _pts[i * 3 + 1] = _a.y;
      _pts[i * 3 + 2] = _a.z;
    }
    writeFatLine(this.azArc, _pts, steps + 1);
    const rl = rr * (this.view === 'horizon' ? 1.25 : 1.05);
    horVec(0, az / 2, rl, this.azLabel.position);
    const aAlts = this.azLabel.userData.alts!;
    horVec(0, az / 2 + 30, rl, aAlts[0]);
    horVec(0, az / 2 - 30, rl, aAlts[1]);
    horVec(0, az / 2, rl * 1.6, aAlts[2]);
    horVec(0, az / 2 + 180, rl * 0.6, aAlts[3]);
    setLabelText(this.azLabel, `A = ${fmtDeg(az, 1)}`);
  }

  hoverTargets(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    this.group.traverse((o) => {
      if (o.userData.tip) out.push(o);
    });
    return out;
  }
}
