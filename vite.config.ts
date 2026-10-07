import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * PWA: sau khi build, ghi dist/sw.js từ scripts/sw.template.js với danh sách MỌI tệp trong dist (để dùng offline)
 * và số phiên bản băm từ nội dung — bản build nào đổi một byte thì trình duyệt nhận service worker mới.
 * Bỏ qua: CNAME, dist/.vite (manifest cho đo dung lượng), phông KaTeX dạng .ttf/.woff (trình duyệt có service worker
 * đều dùng .woff2).
 */
function pwa(): Plugin {
  let outDir = 'dist';
  let root = '.';
  const skip = (rel: string) => rel === 'sw.js' || rel === 'CNAME' || rel.startsWith('.vite/') || /\.(ttf|woff)$/.test(rel);
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  return {
    name: 'astrosphere-pwa',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = walk(outDir)
        .map((p) => relative(outDir, p).split(sep).join('/'))
        .filter((rel) => !skip(rel))
        .sort();
      const template = readFileSync(resolve(root, 'scripts/sw.template.js'), 'utf8');
      const hash = createHash('sha256').update(template);
      for (const rel of files) hash.update(rel).update(readFileSync(join(outDir, rel)));
      const urls = ['./', ...files.map((rel) => `./${rel}`)];
      const sw = template
        .replace("const VERSION = '__VERSION__';", `const VERSION = '${hash.digest('hex').slice(0, 12)}';`)
        .replace('const FILES = __FILES__;', `const FILES = ${JSON.stringify(urls, null, 2)};`);
      if (/^const (VERSION|FILES) = .*__/m.test(sw)) throw new Error('pwa: scripts/sw.template.js thiếu dòng VERSION/FILES');
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  plugins: [pwa()],
  // Đường dẫn tương đối để có thể triển khai trên bất kỳ máy chủ tĩnh nào.
  base: './',
  build: {
    target: 'es2022',
    // dist/.vite/manifest.json: docs/redesign/uat/bundle-size.mjs đọc để đo gói khởi động.
    manifest: true,
    // Chunk lớn nhất là three.js (~540 kB thô, chỉ tải động qua scene/boot). Ngưỡng 700 kB đủ cho nó
    // nhưng vẫn cảnh báo nếu ai đó vô tình gộp thêm thư viện lớn vào cùng một chunk.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // three.js (lõi + addons) thành chunk riêng: cache được qua các lần triển khai khi chỉ mã cảnh đổi.
            // Trừ bộ nạp glTF (và tiện ích của nó): chỉ tải khi rảnh sau lần vẽ đầu (scene/horizonDiagram.ts).
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/](?!examples[\\/]jsm[\\/](loaders|utils)[\\/])/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
