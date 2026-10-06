// Biểu tượng nét đơn giản vẽ bằng SVG nội tuyến (không phụ thuộc phông: Arial không có ký hiệu cuốn sách).
// Màu theo `currentColor`, nên biểu tượng đổi màu cùng chữ của nút.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Mũi tên gập (chevron) chỉ XUỐNG, nét 1,8 px trên khung 16 × 16 (fix-2 #8): nút mở/thu gọn thẻ thông tin. "+" từng
 * đọc thành "thêm"; chevron là ký hiệu quen thuộc của "mở ra / gập lại". CSS xoay 180° khi thẻ đang mở.
 */
export function chevronIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'chevron');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M3.5 6l4.5 4.5L12.5 6');
  svg.append(path);
  return svg;
}

/** Cuốn sách mở (nút Codex, fix-1 #8): hai trang và gáy sách, nét 1,6 px trên khung 16 × 16. */
export function bookIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M8 4.2C6.6 3 4.5 2.6 1.8 2.8v9.6c2.7-.2 4.8.2 6.2 1.4 1.4-1.2 3.5-1.6 6.2-1.4V2.8C11.5 2.6 9.4 3 8 4.2zM8 4.2v9.6');
  svg.append(path);
  return svg;
}

/**
 * Bút chì (nút "Ôn tập", fix-3 #6): thân bút chéo và ngòi, nét 1,6 px trên khung 16 × 16. Trên điện thoại "Ôn tập" chỉ
 * còn biểu tượng như các nút cạnh nó; ký tự ✎ không có trong Arial nên vẽ bằng SVG cho chắc.
 */
export function pencilIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M11.2 2.3l2.5 2.5-8.4 8.4-3.3.8.8-3.3 8.4-8.4zM9.6 3.9l2.5 2.5');
  svg.append(path);
  return svg;
}
