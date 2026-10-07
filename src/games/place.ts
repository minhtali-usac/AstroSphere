// Bộ "xếp thẻ vào ô" dùng chung (xếp hành tinh, phân loại, gắn ngày lên quỹ đạo…).
//
// Hai cách thao tác cho mọi thiết bị: bấm thẻ rồi bấm ô (chuột, chạm, bàn phím), hoặc kéo thẻ thả vào ô. Thẻ đang
// nằm trong ô có thể chọn lại để chuyển sang ô khác hoặc trả về khay. Ô đơn (`multi` = false) chỉ chứa một thẻ:
// đặt thẻ mới vào thì thẻ cũ quay về chỗ của thẻ mới (đổi chỗ).

import { h } from '../ui/dom';
import type { Verdict } from './shell';
import { fmt, G } from './text';

export interface PlaceItem {
  id: string;
  label: string;
  /** Biến màu CSS cho chấm màu trên thẻ (vd. '--sgk-venus'). */
  color?: string;
}

export interface PlaceOpts {
  items: PlaceItem[];
  /** Thẻ → ô đúng. */
  answer: Record<string, string>;
  multi?: boolean;
  /** Gọi khi người chơi chọn một thẻ (để báo "Đã chọn …"). */
  onPick?: (label: string) => void;
}

export interface Placer {
  tray: HTMLElement;
  slot(id: string, label: string, cls?: string): HTMLElement;
  check(): Verdict;
  reveal(): void;
  lock(): void;
}

export function placer(o: PlaceOpts): Placer {
  const chips = new Map<string, HTMLButtonElement>();
  const slots = new Map<string, HTMLElement>();
  const where = new Map<string, string | null>();
  let selected: string | null = null;
  let locked = false;
  let suppressClick = false;

  const tray = h('div', { class: 'sgk-tray', 'data-tray': '', role: 'group', 'aria-label': G.place.tray, 'data-empty': G.place.trayEmpty });

  const select = (id: string | null) => {
    selected = id;
    for (const [k, c] of chips) c.setAttribute('aria-pressed', String(k === id));
    tray.classList.toggle('is-target', id !== null && where.get(id) !== null);
    for (const sl of slots.values()) sl.classList.toggle('is-target', id !== null);
    if (id) o.onPick?.(o.items.find((i) => i.id === id)!.label);
  };

  const listOf = (slotId: string | null): HTMLElement => (slotId ? slots.get(slotId)!.querySelector<HTMLElement>('.sgk-slot__items')! : tray);

  const moveTo = (id: string, slotId: string | null) => {
    const from = where.get(id) ?? null;
    if (slotId && !o.multi) {
      const occupant = [...where].find(([k, v]) => v === slotId && k !== id)?.[0];
      if (occupant) {
        where.set(occupant, from);
        listOf(from).append(chips.get(occupant)!);
        chips.get(occupant)!.classList.remove('is-ok', 'is-err');
      }
    }
    where.set(id, slotId);
    const chip = chips.get(id)!;
    listOf(slotId).append(chip);
    chip.classList.remove('is-ok', 'is-err');
    for (const [k, sl] of slots) sl.classList.toggle('is-filled', [...where.values()].includes(k));
    select(null);
  };

  for (const it of o.items) {
    const chip = h(
      'button',
      {
        type: 'button',
        class: 'sgk-chip',
        'data-item': it.id,
        'aria-pressed': 'false',
        onclick: (e: Event) => {
          e.stopPropagation();
          if (locked || suppressClick) return;
          select(selected === it.id ? null : it.id);
        },
      },
      it.color ? h('span', { class: 'sgk-chip__dot', style: { background: `var(${it.color})` }, 'aria-hidden': 'true' }) : null,
      h('span', { text: it.label }),
    );
    // Kéo thả bằng con trỏ: chỉ coi là kéo khi di quá 6 px (bấm thường vẫn là chọn).
    let start: { x: number; y: number; id: number } | null = null;
    let dragging = false;
    chip.addEventListener('pointerdown', (e) => {
      if (locked || (e.pointerType === 'mouse' && e.button !== 0)) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragging = false;
    });
    chip.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 6) return;
      if (!dragging) {
        dragging = true;
        try {
          chip.setPointerCapture(e.pointerId);
        } catch {
          /* không bắt được con trỏ: vẫn kéo trong phạm vi thẻ */
        }
        chip.classList.add('is-drag');
      }
      e.preventDefault();
      chip.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      if (!dragging) return;
      dragging = false;
      chip.classList.remove('is-drag');
      chip.style.transform = '';
      chip.style.visibility = 'hidden';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      chip.style.visibility = '';
      const sl = under?.closest<HTMLElement>('[data-slot]');
      if (sl && slots.get(sl.dataset.slot!) === sl) moveTo(it.id, sl.dataset.slot!);
      else if (under?.closest('[data-tray]') === tray) moveTo(it.id, null);
      // Trình duyệt phát "click" ngay sau khi thả: bỏ qua cú click đó.
      suppressClick = true;
      window.setTimeout(() => (suppressClick = false), 0);
    };
    chip.addEventListener('pointerup', end);
    chip.addEventListener('pointercancel', end);
    chips.set(it.id, chip);
    where.set(it.id, null);
    tray.append(chip);
  }

  tray.addEventListener('click', () => {
    if (!locked && selected && where.get(selected) !== null) moveTo(selected, null);
  });

  return {
    tray,
    slot(id, label, cls = '') {
      const target = h('button', {
        type: 'button',
        class: 'sgk-slot__target',
        'aria-label': fmt(G.place.slotAria, { name: label }),
        text: label,
      });
      const el = h('div', { class: `sgk-slot ${cls}`.trim(), 'data-slot': id }, target, h('div', { class: 'sgk-slot__items' }));
      el.addEventListener('click', (e) => {
        if (locked || (e.target as Element).closest('.sgk-chip')) return;
        if (selected) moveTo(selected, id);
      });
      slots.set(id, el);
      return el;
    },
    check() {
      const missing = o.items.filter((i) => where.get(i.id) === null).length;
      if (missing) return { ok: false, msg: fmt(G.place.missing, { n: missing }) };
      let wrong = 0;
      for (const it of o.items) {
        const ok = where.get(it.id) === o.answer[it.id];
        chips.get(it.id)!.classList.toggle('is-ok', ok);
        chips.get(it.id)!.classList.toggle('is-err', !ok);
        if (!ok) wrong++;
      }
      return wrong ? { ok: false, msg: fmt(G.place.wrong, { n: wrong }) } : { ok: true };
    },
    reveal() {
      for (const it of o.items) {
        where.set(it.id, null);
        tray.append(chips.get(it.id)!);
      }
      for (const it of o.items) moveTo(it.id, o.answer[it.id]);
      for (const c of chips.values()) c.classList.add('is-ok');
    },
    lock() {
      locked = true;
      select(null);
      tray.closest('.sgk-place')?.classList.add('is-locked');
      for (const c of chips.values()) c.setAttribute('aria-disabled', 'true');
    },
  };
}
