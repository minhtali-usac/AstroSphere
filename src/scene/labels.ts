// Nhãn chữ HTML (CSS2D) — hiển thị tiếng Việt sắc nét, bật/tắt theo từng nhóm.
// Mỗi nhãn mang hạng ưu tiên tĩnh (`rank`) và kích thước hộp đã đo (`w`, `h`) để khung nhìn gỡ chồng chéo
// trong không gian màn hình mà không gọi getBoundingClientRect mỗi khung hình (xem declutter.ts, view.ts).

import type { Vector3 } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { LabelToggles } from '../state';

export type LabelGroup = Exclude<keyof LabelToggles, 'all'>;

export interface LabelData {
  group: LabelGroup;
  hideBelowHorizon: boolean;
  /** Nhãn dày đặc (tên chòm sao) chỉ hiện ở nửa thiên cầu quay về phía người xem để đỡ rối. */
  hideFarSide: boolean;
  /**
   * Hạng ưu tiên tĩnh, nhỏ = quan trọng hơn: 0 số đo góc (tô sáng) · 10 hướng B/N/Đ/T · 11 thiên đỉnh, thiên cực ·
   * 20 tên vòng tròn · 25 nhãn phụ của vòng · 30 tên chòm sao người dùng thêm · 40 + cấp sao: tên sao (sáng hơn
   * trước) · 50 tên 88 chòm sao nền (nhường mọi nhãn khác, review-4 D2).
   * Nhãn của đối tượng đang chọn luôn được xét đầu tiên (động, xem view.ts).
   */
  rank: number;
  /** Hộp nhãn (px, CSS) đã đo; 0 = cần đo lại (chữ đổi độ dài, đổi cỡ chữ trình chiếu). */
  w: number;
  h: number;
  /** Điểm neo gốc (center) — khung nhìn có thể đẩy nhãn ưu tiên cao vào trong mép rồi trả về giá trị này. */
  cx0: number;
  cy0: number;
  /** Đối tượng mà nhãn này gọi tên (để nhãn của đối tượng đang chọn được ưu tiên). */
  selKind: '' | 'user' | 'catalog' | 'dso' | 'sun';
  selId: string;
  selIdx: number;
  /** Nhóm tô sáng liên kết mà nhãn này thuộc về ('' = không): khi nhóm đang tô sáng, nhãn được xét trước tiên. */
  emph: string;
  /**
   * Vị trí thay thế (tọa độ cục bộ như `position`), thử theo thứ tự khi vị trí gốc chồng lên nhãn ưu tiên hơn —
   * vd. các điểm dọc theo cung của nhãn số đo, để nhãn nhường chỗ cho chữ hướng B/N/Đ/T (review-3 D2). Mảng cố
   * định, chỉ ghi lại các vector khi vĩ độ đổi (không cấp phát mỗi khung hình).
   */
  alts: Vector3[] | null;
  /**
   * Khoảng trống thêm (px) mà nhãn đòi quanh mình khi gỡ chồng chéo (LabelBoxes.pad). Tên chòm sao nền dùng > 0:
   * không chen sát tên sao/thiên cực — chỗ chật thì tên chòm ẩn đi (review-4 D2).
   */
  clear: number;
  /**
   * Không có chỗ trống nào thì vẫn giữ ở vị trí gốc thay vì ẩn (LabelBoxes.must): nhãn cảnh báo "đang ở dưới chân
   * trời" là thông tin duy nhất về đối tượng đang chọn khi nó bị mặt đất che (fix-1 #2).
   */
  must: boolean;
  /**
   * Không in lên quả địa cầu ở khung thiên cầu (LabelBoxes.avoidDisc, fix-2 #3): tên chòm sao có điểm neo — hay hộp
   * chữ — rơi vào đĩa Trái Đất trên màn hình thì ẩn.
   */
  avoidDisc: boolean;
  /**
   * Vẫn hiện khi khung thiên cầu nhỏ (compactKeeps, review-4 #4): tên thiên cực và xích đạo trời. Chữ hướng, nhãn số
   * đo và tên đối tượng đang chọn luôn được giữ, không cần cờ này.
   */
  compactKeep: boolean;
}

export interface Label extends CSS2DObject {
  userData: LabelData;
}

const GROUP_RANK: Record<LabelGroup, number> = { angles: 0, directions: 10, poles: 11, circles: 20, stars: 40 };

export interface LabelOpts {
  color?: string;
  cls?: string;
  hideBelowHorizon?: boolean;
  hideFarSide?: boolean;
  anchor?: [number, number];
  /** Ghi đè hạng ưu tiên (mặc định theo nhóm, xem LabelData.rank). */
  rank?: number;
  /** Cấp sao (nhãn tên sao): sao sáng hơn được giữ khi chồng nhau. */
  mag?: number;
  /** Đối tượng mà nhãn gọi tên. */
  sel?: { kind: 'user'; id: string } | { kind: 'catalog'; index: number } | { kind: 'dso'; index: number } | { kind: 'sun' };
  /** Nhóm tô sáng liên kết của nhãn (vd. 'pole', 'incl'). */
  emph?: string;
  /** Khoảng trống thêm (px) quanh nhãn khi gỡ chồng chéo (xem LabelData.clear). */
  clear?: number;
  /** Luôn giữ (xem LabelData.must). */
  must?: boolean;
  /** Tránh đĩa quả địa cầu (xem LabelData.avoidDisc). */
  avoidDisc?: boolean;
  /** Giữ khi khung thiên cầu nhỏ (xem LabelData.compactKeep). */
  compactKeep?: boolean;
  /** Màu viền trái của nhãn dạng chip (lbl--key): giữ màu ngữ nghĩa, còn chữ là chữ sáng trên nền tối. */
  edge?: string;
}

/** Hạng ưu tiên của tên 88 chòm sao nền: sau mọi nhãn khác (tên sao là 40 + cấp sao ≤ 49). */
export const ALLSKY_NAME_RANK = 50;

/** Hạng ưu tiên mặc định (tách riêng để kiểm thử). */
export function labelRank(group: LabelGroup, opts: Pick<LabelOpts, 'rank' | 'mag' | 'cls'> = {}): number {
  if (opts.rank !== undefined) return opts.rank;
  if (group === 'stars' && opts.mag !== undefined) return GROUP_RANK.stars + Math.min(9, Math.max(-2, opts.mag));
  if (group === 'circles' && opts.cls?.includes('lbl--small')) return 25;
  return GROUP_RANK[group];
}

/**
 * Khung thiên cầu nhỏ (cạnh ngắn < COMPACT_SPHERE_PX px CSS: bố cục tập trung mở cả hai nút khi đang chọn một đối
 * tượng, khung thiên cầu cao 222 px ở 1101–1440 px, 238 px ở 1920 px; các bố cục đóng ≥ 241 px nên vẫn hiện tên): nhãn chen nhau và đè lên quả địa cầu (review-4 #4). Khi đó chỉ giữ những nhãn định hướng: chữ hướng
 * B/N/Đ/T, nhãn số đo đang bật, thiên cực, xích đạo trời và tên đối tượng đang chọn. Tên chòm sao, tên các sao khác,
 * thiên đỉnh, người quan sát, γ và các vòng phụ ẩn đi. Khung giản đồ chân trời không đổi.
 */
export const COMPACT_SPHERE_PX = 235;

/** Nhãn có được giữ ở khung thiên cầu nhỏ không (chưa xét đối tượng đang chọn: view.ts luôn giữ nhãn đó). */
export function compactKeeps(ud: Pick<LabelData, 'group' | 'compactKeep'>): boolean {
  return ud.compactKeep || ud.group === 'directions' || ud.group === 'angles';
}

export function makeLabel(text: string, group: LabelGroup, opts: LabelOpts = {}): Label {
  const el = document.createElement('div');
  el.className = `lbl lbl--${group}${opts.cls ? ` ${opts.cls}` : ''}`;
  el.textContent = text;
  if (opts.color) el.style.color = opts.color;
  if (opts.edge) el.style.borderLeftColor = opts.edge;
  const obj = new CSS2DObject(el) as Label;
  // Điểm neo của nhãn (0,5; 0,5 = chính giữa). Nhãn tên sao đặt lệch sang phải để không che sao; tên vòng tròn
  // (xích đạo, vòng giờ 0h, kinh tuyến, hoàng đạo, Ngân Hà) dùng [0,5; 1,2] để nằm ngay TRÊN đường của nó (review-2 D2).
  if (opts.anchor) obj.center.set(opts.anchor[0], opts.anchor[1]);
  const sel = opts.sel;
  obj.userData = {
    group,
    hideBelowHorizon: opts.hideBelowHorizon ?? true,
    hideFarSide: opts.hideFarSide ?? false,
    rank: labelRank(group, opts),
    w: 0,
    h: 0,
    cx0: obj.center.x,
    cy0: obj.center.y,
    selKind: sel ? sel.kind : '',
    selId: sel?.kind === 'user' ? sel.id : '',
    selIdx: sel?.kind === 'catalog' || sel?.kind === 'dso' ? sel.index : -1,
    emph: opts.emph ?? '',
    alts: null,
    clear: opts.clear ?? 0,
    must: opts.must ?? false,
    avoidDisc: opts.avoidDisc ?? false,
    compactKeep: opts.compactKeep ?? false,
  };
  return obj;
}

export function setLabelText(label: Label, text: string): void {
  const el = label.element;
  const old = el.textContent ?? '';
  if (old === text) return;
  el.textContent = text;
  // Chữ số Arial cùng bề rộng: chỉ đo lại khi độ dài đổi (tránh ép bố cục mỗi khung hình khi đang chạy).
  if (old.length !== text.length) label.userData.w = 0;
}
