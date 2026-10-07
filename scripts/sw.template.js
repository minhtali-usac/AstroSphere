/* AstroSphere — service worker (PWA, dùng offline).
 *
 * Tệp này là KHUÔN: lúc `vite build`, plugin `pwa` trong vite.config.ts thay __VERSION__ và __FILES__ rồi ghi
 * thành dist/sw.js. Đừng sửa dist/sw.js bằng tay.
 *
 * - Cài đặt: lưu sẵn MỌI tệp của bản build (cả các phần tải lười: three.js, KaTeX, Thử thách SGK, Usui-chan) vào
 *   một bộ nhớ đệm mang số phiên bản, nên sau lần mở đầu tiên ứng dụng chạy được hoàn toàn không cần mạng.
 * - Trang (điều hướng): luôn trả index.html của chính phiên bản này, để HTML và các tệp mã luôn cùng một bản.
 * - Tệp khác: lấy từ bộ nhớ đệm trước, thiếu thì tải mạng rồi lưu thêm. `ignoreVary`: script module gửi kèm header
 *   Origin, còn bản lưu lúc cài thì không — máy chủ trả `Vary: Origin` sẽ làm so khớp trượt nếu không bỏ qua Vary.
 * - Cập nhật: bản mới cài xong thì CHỜ; trang hiện thông báo "Tải lại" (src/pwa.ts) và gửi SKIP_WAITING. Kích hoạt
 *   xong mới xóa bộ nhớ đệm cũ, nên một thẻ đang mở không bao giờ mất tệp giữa chừng.
 */

const VERSION = '__VERSION__';
const CACHE = `astrosphere-${VERSION}`;
const FILES = __FILES__;
const INDEX = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('astrosphere-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(caches.match(INDEX, { cacheName: CACHE, ignoreVary: true }).then((hit) => hit || fetch(req)));
    return;
  }

  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
