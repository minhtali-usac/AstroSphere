// Tô sáng liên kết (ux-brief §6): một con số trong giao diện ↔ hình tương ứng trong hai khung nhìn 3D.
//
// Thuần dữ liệu, không DOM, không three.js: dùng chung cho giao diện (ui/emphasis.ts), khung nhìn
// (ui/viewInteraction.ts) và cảnh 3D (scene/*Layer.ts).

import { classify, type Visibility } from './astro';
import { catalogArrays } from './data/catalog';
import { sunEquatorial } from './selection';
import type { AppState } from './state';

/**
 * Các cặp "số ↔ hình":
 * - `pole`: độ cao thiên cực ↔ cung + hình quạt độ cao thiên cực, trục thiên cực;
 * - `incl`: góc xích đạo trời – chân trời ↔ hình quạt + cung của góc đó;
 * - `az` / `alt`: phương vị / độ cao của đối tượng chọn ↔ cung A / cung h (+ đường thẳng đứng);
 * - `altaz`: cả hai (ô "Đối tượng đang chọn" chứa cả A và h);
 * - `meridian`: LST / góc giờ H ↔ kinh tuyến + vòng giờ 0h;
 * - `zone`: trạng thái mọc – lặn ↔ vùng chứa đối tượng đang chọn.
 */
export type EmphasisKey = 'pole' | 'incl' | 'az' | 'alt' | 'altaz' | 'meridian' | 'zone';

export const EMPHASIS_KEYS: readonly EmphasisKey[] = ['pole', 'incl', 'az', 'alt', 'altaz', 'meridian', 'zone'];

/** `userData.tip` của đối tượng 3D → khóa tô sáng (chiều ngược: rê chuột lên hình làm sáng con số). */
export const TIP_EMPHASIS: Readonly<Record<string, EmphasisKey>> = {
  poleAltitude: 'pole',
  ncp: 'pole',
  scp: 'pole',
  axis: 'pole',
  angle: 'incl',
  altitudeArc: 'alt',
  azimuthArc: 'az',
  vertical: 'altaz',
  meridian: 'meridian',
  hourCircle: 'meridian',
  zone_circumpolar: 'zone',
  zone_riseSet: 'zone',
  zone_neverRise: 'zone',
};

/** Giá trị `data-emphasis` của ô số liệu / dòng thẻ thông tin → khóa tô sáng mà nó bật. */
export const UI_EMPHASIS: Readonly<Record<string, EmphasisKey>> = {
  pole: 'pole',
  incl: 'incl',
  lst: 'meridian',
  ha: 'meridian',
  selected: 'altaz',
  az: 'az',
  alt: 'alt',
  status: 'zone',
};

export function emphasisForTip(tip: string | undefined | null): EmphasisKey | null {
  return (tip && TIP_EMPHASIS[tip]) || null;
}

export function emphasisForUi(key: string | undefined | null): EmphasisKey | null {
  return (key && UI_EMPHASIS[key]) || null;
}

/** Phần tử giao diện có khóa `ui` có được đánh dấu "đang liên kết" khi khóa tô sáng là `e` không. */
export function uiLinked(ui: string, e: EmphasisKey | null): boolean {
  const own = emphasisForUi(ui);
  if (!e || !own) return false;
  if (own === e) return true;
  // Ô "Đối tượng đang chọn" chứa cả A và h; ngược lại cung A hoặc cung h làm sáng ô đó.
  if (own === 'altaz') return e === 'az' || e === 'alt';
  if (e === 'altaz') return own === 'az' || own === 'alt';
  return false;
}

/** Xích vĩ của đối tượng đang chọn (null nếu không có). Không cấp phát, trừ trường hợp Mặt Trời. */
export function selectedDec(s: AppState): number | null {
  const sel = s.selected;
  if (!sel) return null;
  if (sel.kind === 'user') {
    const stars = s.stars;
    for (let i = 0; i < stars.length; i++) if (stars[i].id === sel.id) return stars[i].dec;
    return null;
  }
  if (sel.kind === 'catalog') {
    const dec = catalogArrays().dec;
    return sel.index >= 0 && sel.index < dec.length ? dec[sel.index] : null;
  }
  return s.toggles.sun ? sunEquatorial(s).dec : null;
}

/**
 * Nhóm đối tượng 3D cần tô sáng cho trạng thái hiện tại. Với `zone`, đó là vùng chứa đối tượng đang chọn
 * (`zone_circumpolar` | `zone_riseSet` | `zone_neverRise`); null nếu không có đối tượng.
 */
export function emphasisGroup(s: AppState): string | null {
  const e = s.emphasis;
  if (e !== 'zone') return e;
  const dec = selectedDec(s);
  if (dec === null) return null;
  const v: Visibility = classify(dec, s.lat);
  return `zone_${v}`;
}
