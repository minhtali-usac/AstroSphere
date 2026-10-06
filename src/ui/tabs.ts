// Danh sách thẻ theo mẫu WAI-ARIA: tabindex "lưu động" và phím ←/→/Home/End (kích hoạt tự động).

export interface RovingTabs {
  /** Đặt tabindex="0" cho thẻ đang chọn và "-1" cho các thẻ còn lại. */
  sync(): void;
}

export function rovingTabs(list: HTMLElement, activate: (tab: HTMLElement) => void): RovingTabs {
  const tabs = () => [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  const sync = () => {
    for (const tab of tabs()) tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
  };
  list.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const all = tabs();
    const i = all.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    const n = all.length;
    let j: number;
    if (e.key === 'ArrowRight') j = (i + 1) % n;
    else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = n - 1;
    else return;
    e.preventDefault();
    all[j].focus();
    activate(all[j]);
    sync();
  });
  sync();
  return { sync };
}
