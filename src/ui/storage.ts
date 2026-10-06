// Đọc/ghi bộ nhớ trình duyệt an toàn: mọi truy cập đều có thể ném lỗi (chế độ riêng tư, bị chặn, dữ liệu hỏng).

type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Đọc JSON và kiểm tra kiểu; trả về `fallback` nếu thiếu, hỏng hoặc sai dạng. */
export function readJson<T>(key: string, guard: (v: unknown) => v is T, fallback: T, kind: Area = 'local'): T {
  try {
    const raw = area(kind)?.getItem(key);
    if (raw == null) return fallback;
    const v: unknown = JSON.parse(raw);
    return guard(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Ghi JSON; bỏ qua lỗi (bộ nhớ đầy hoặc không khả dụng). */
export function writeJson(key: string, value: unknown, kind: Area = 'local'): void {
  try {
    area(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    /* bộ nhớ trình duyệt không khả dụng: bỏ qua */
  }
}

/** Đối tượng thường (không phải null, mảng hay giá trị nguyên thủy). */
export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
