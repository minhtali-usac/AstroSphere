import { defineConfig } from 'vitest/config';

export default defineConfig({
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
