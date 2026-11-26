// Ngôn ngữ giao diện (vi | en), quyết định MỘT lần khi nạp trang; đổi ngôn ngữ thì tải lại trang.
//
// Thứ tự ưu tiên: `?lang=vi|en` → lựa chọn đã lưu (`astrosphere.lang.v1`) → ngôn ngữ của trình duyệt (có tiếng Việt
// trong danh sách thì tiếng Việt, còn lại tiếng Anh). Ngoài trình duyệt (Vitest, script Node) luôn là tiếng Việt.
// Tệp này thuần, không nhập gì, để mô-đun toán (astro/format.ts) dùng được.

export type Lang = 'vi' | 'en';

export const LANG_STORAGE_KEY = 'astrosphere.lang.v1';

export const isLang = (v: unknown): v is Lang => v === 'vi' || v === 'en';

export function resolveLang(search: string, stored: unknown, browserLangs: readonly string[]): Lang {
  let url: unknown = null;
  try {
    url = new URLSearchParams(search).get('lang');
  } catch {
    /* địa chỉ không đọc được: bỏ qua */
  }
  if (isLang(url)) return url;
  if (isLang(stored)) return stored;
  if (!browserLangs.length) return 'vi';
  return browserLangs.some((l) => /^vi\b/i.test(l)) ? 'vi' : 'en';
}

function detect(): Lang {
  if (typeof window === 'undefined') return 'vi';
  let stored: unknown = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(LANG_STORAGE_KEY) ?? 'null');
  } catch {
    /* bộ nhớ trình duyệt bị chặn hoặc hỏng */
  }
  return resolveLang(window.location?.search ?? '', stored, window.navigator?.languages ?? []);
}

export const LANG: Lang = detect();

/** Chọn một trong hai giá trị theo ngôn ngữ (cho chuỗi nằm ngay trong mô-đun dữ liệu). */
export const pick = <T>(vi: T, en: T): T => (LANG === 'en' ? en : vi);

/** Dấu thập phân: phẩy trong tiếng Việt, chấm trong tiếng Anh. */
export const DECIMAL: string = pick(',', '.');

/** Ghi nhớ lựa chọn rồi tải lại trang bằng ngôn ngữ mới. */
export function switchLang(lang: Lang): void {
  if (lang === LANG) return;
  let saved = false;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify(lang));
    saved = true;
  } catch {
    /* không lưu được: giữ lựa chọn trên địa chỉ trang */
  }
  const url = new URL(window.location.href);
  if (saved) url.searchParams.delete('lang');
  else url.searchParams.set('lang', lang);
  window.location.replace(url.href);
}
