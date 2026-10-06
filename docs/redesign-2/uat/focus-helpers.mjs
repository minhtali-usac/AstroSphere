// Bố cục tập trung (chế độ Đầy đủ, màn hình ≥ 1101 px, docs/redesign-2/focus-layout.md): dải số liệu đầy đủ và bảng
// điều khiển bắt đầu thu gọn sau hai nút "Số liệu" và "Bảng điều khiển". Các bài kiểm tra dùng chúng thì mở ra
// trước bằng hai hàm dưới đây. Ở bề ngang khác (hai nút ẩn) hàm không làm gì, nên gọi được ở mọi khổ màn hình.

/** Mở dải số liệu và/hoặc bảng điều khiển nếu nút tương ứng đang hiện và đang đóng. */
export async function expandFocus(page, { data = false, panels = false } = {}) {
  for (const [area, want] of [
    ['data', data],
    ['panels', panels],
  ]) {
    if (!want) continue;
    const btn = page.locator(`.focus-toggle--${area}`);
    if (!(await btn.isVisible())) continue;
    if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
  }
  await page.waitForTimeout(50);
}

/** Hiện một bảng điều khiển (location | animation | display | stars): mở cột bảng, rồi chọn thẻ nếu thanh thẻ hiện. */
export async function showPanel(page, key) {
  await expandFocus(page, { panels: true });
  const tab = page.locator(`.paneltabs .tab[data-panel="${key}"]`);
  if ((await tab.isVisible()) && (await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await page.waitForTimeout(50);
}
