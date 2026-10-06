// Tương tác chuột/cảm ứng trên khung nhìn: bấm chọn sao, chú thích tiếng Việt khi rê chuột, và chiều ngược của
// tô sáng liên kết: rê chuột lên một hình có con số tương ứng thì con số đó sáng lên (ux-brief §6).

import { classify, equatorialToHorizontal, fmtDeg, fmtDegSigned } from '../astro';
import { emphasisForTip, selectedDec, type EmphasisKey } from '../emphasis';
import { t } from '../i18n';
import type { View } from '../scene/view';
import { resolveSelection } from '../selection';
import { lstOf, type Actions, type Store } from '../state';
import { h } from './dom';
import { setEmphasisSource } from './emphasis';

let tooltip: HTMLDivElement | null = null;

function getTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = h('div', { class: 'tooltip', role: 'tooltip', hidden: true });
    document.body.append(tooltip);
  }
  return tooltip;
}

export function attachViewInteraction(view: View, store: Store, actions: Actions): void {
  const el = view.renderer.domElement;
  const tip = getTooltip();
  let down: { x: number; y: number } | null = null;
  let pending: PointerEvent | null = null;
  let raf = 0;
  let sceneKey: EmphasisKey | null = null;

  /** Khóa tô sáng do hình đang rê chuột đặt (null khi rời hình). */
  const setScene = (k: EmphasisKey | null) => {
    if (k === sceneKey) return;
    sceneKey = k;
    setEmphasisSource(actions, 'scene', k);
  };

  /** Khóa tô sáng của một hình có chú thích. Vùng chỉ liên kết khi nó chứa đối tượng đang chọn (dòng "Trạng thái"). */
  const keyForTip = (tipKey: string): EmphasisKey | null => {
    const k = emphasisForTip(tipKey);
    if (k !== 'zone') return k;
    const s = store.state;
    const dec = selectedDec(s);
    return dec !== null && `zone_${classify(dec, s.lat)}` === tipKey ? 'zone' : null;
  };

  const hide = () => {
    tip.hidden = true;
    el.style.cursor = '';
    setScene(null);
  };

  const showHover = () => {
    raf = 0;
    const e = pending;
    if (!e) return;
    const info = view.hoverAt(e.clientX, e.clientY);
    if (!info) return hide();
    let html = '';
    setScene(info.kind === 'tip' && info.tip ? keyForTip(info.tip) : null);
    if (info.kind === 'object' && info.sel) {
      const obj = resolveSelection(store.state, info.sel);
      if (!obj) return hide();
      const s = store.state;
      const { alt, az } = equatorialToHorizontal(obj.ra, obj.dec, s.lat, lstOf(s));
      html = `<strong></strong><span class="tooltip__sub"></span>`;
      tip.innerHTML = html;
      tip.querySelector('strong')!.textContent = obj.name;
      tip.querySelector('.tooltip__sub')!.textContent = `A = ${fmtDeg(az, 1)} · h = ${fmtDegSigned(alt, 1)} — ${t('tip.clickForInfo')}`;
      el.style.cursor = 'pointer';
    } else if (info.tip) {
      // Định dạng "Tiêu đề|Mô tả" — chỉ tách ở dấu | đầu tiên vì mô tả có thể chứa |φ|.
      const text = t(`tip.${info.tip}`);
      const cut = text.indexOf('|');
      tip.innerHTML = `<strong></strong><span class="tooltip__sub"></span>`;
      tip.querySelector('strong')!.textContent = cut >= 0 ? text.slice(0, cut) : text;
      tip.querySelector('.tooltip__sub')!.textContent = cut >= 0 ? text.slice(cut + 1) : '';
      el.style.cursor = '';
    }
    tip.hidden = false;
    const pad = 14;
    const w = tip.offsetWidth;
    const hgt = tip.offsetHeight;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + hgt > window.innerHeight - 8) y = e.clientY - hgt - pad;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  };

  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    hide();
  });
  el.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const sel = view.pickAt(e.clientX, e.clientY);
      if (sel) actions.select(sel);
    }
    down = null;
  });
  el.addEventListener('pointermove', (e) => {
    if (e.buttons !== 0 || e.pointerType === 'touch') return;
    pending = e;
    if (!raf) raf = requestAnimationFrame(showHover);
  });
  el.addEventListener('pointerleave', () => {
    pending = null;
    hide();
  });
}
