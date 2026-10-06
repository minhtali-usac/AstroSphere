// Tiện ích dựng DOM gọn nhẹ (không dùng framework).

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'min', 'max', 'step', 'type', 'name', 'htmlFor', 'tabIndex']);

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (PROPS.has(k)) (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
}

/** Chỉ ghi chữ khi nội dung thay đổi (tránh ghi DOM thừa khi đang chạy hoạt ảnh). */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** Chỉ đổi thuộc tính `hidden` khi khác giá trị hiện tại. */
export function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

let uid = 0;
export const newId = (p = 'id') => `${p}-${++uid}`;

export interface CheckboxOpts {
  /** Chú thích khi rê chuột (title) */
  tip?: string;
  /** Màu ô mẫu (màu của đường/vùng trong cảnh 3D) */
  swatch?: string;
  /** Một dòng giải thích hiện ngay dưới hộp kiểm, CHỈ khi hộp đang được chọn (aria-describedby). */
  hint?: string;
  /** Móc ổn định cho giai đoạn "tô sáng liên kết": đặt vào `data-emphasis` của phần tử ngoài cùng. */
  emphasis?: string;
}

/** Hộp kiểm kèm nhãn, chú thích (title) và dòng giải thích theo ngữ cảnh. */
export function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void, opts: CheckboxOpts = {}) {
  const id = newId('cb');
  const hintEl = opts.hint ? h('p', { class: 'check__hint', id: `${id}-hint`, text: opts.hint }) : null;
  const syncHint = (v: boolean) => {
    if (!hintEl) return;
    setHidden(hintEl, !v);
    if (v) input.setAttribute('aria-describedby', hintEl.id);
    else input.removeAttribute('aria-describedby');
  };
  const input = h('input', {
    type: 'checkbox',
    id,
    checked,
    onchange: (e: Event) => {
      const v = (e.target as HTMLInputElement).checked;
      syncHint(v);
      onChange(v);
    },
  });
  const lbl = h(
    'label',
    { class: 'check', htmlFor: id, title: opts.tip },
    input,
    opts.swatch ? h('span', { class: 'swatch', style: { background: opts.swatch }, 'aria-hidden': 'true' }) : null,
    h('span', { text: label }),
  );
  // Dòng giải thích nằm NGOÀI nhãn: không bị gộp vào tên truy cập, bấm vào nó không đổi hộp kiểm.
  const el = hintEl ? h('div', { class: 'check-item' }, lbl, hintEl) : lbl;
  if (opts.emphasis) el.dataset.emphasis = opts.emphasis;
  syncHint(checked);
  /** Đặt trạng thái từ store (không phát sự kiện change) và cập nhật dòng giải thích. */
  const set = (v: boolean) => {
    if (input.checked !== v) input.checked = v;
    syncHint(v);
  };
  return { el, input, set };
}

export function button(label: string, onClick: () => void, opts: { cls?: string; title?: string; aria?: string; icon?: string; guide?: string } = {}) {
  return h(
    'button',
    {
      type: 'button',
      class: `btn ${opts.cls ?? ''}`.trim(),
      title: opts.title,
      'aria-label': opts.aria ?? (opts.icon ? label : undefined),
      'data-guide': opts.guide,
      onclick: onClick,
    },
    opts.icon ? h('span', { class: 'btn__icon', 'aria-hidden': 'true', text: opts.icon }) : null,
    h('span', { class: 'btn__text', text: label }),
  );
}

/** Nhóm có tiêu đề trong bảng điều khiển. */
export function fieldset(title: string, ...children: Child[]) {
  return h('fieldset', { class: 'group' }, h('legend', { text: title }), ...children);
}

/**
 * Gắn khóa giải thích của Usui-chan (redesign-2 R4): `data-guide="<khóa>"`, lời giải thích ở `guide.tip.<khóa>`.
 * Luôn viết khóa dạng chuỗi cố định (`guide('<khóa>', el)`, `'data-guide': '<khóa>'` hoặc `guide: '<khóa>'`) để
 * src/guide/guide.test.ts tìm được.
 */
export function guide<T extends HTMLElement>(key: string, el: T): T {
  el.dataset.guide = key;
  return el;
}
