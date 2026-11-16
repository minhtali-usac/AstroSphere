#!/bin/sh
# Chạy kiểm tra nghiệm thu «Bay vào vũ trụ» với máy chủ phát triển riêng (cổng 5181), rồi tắt máy chủ.
# Dùng: sh docs/redesign/uat/flight-dev.sh   (PLAYWRIGHT=<đường dẫn index.mjs> nếu Playwright không ở /opt)
set -u
cd "$(dirname "$0")/../../.."
npx vite --port 5181 --strictPort --host 127.0.0.1 >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT INT TERM
until curl -s -o /dev/null http://127.0.0.1:5181/; do sleep 1; done
UAT_URL='http://127.0.0.1:5181/?quality=fixed' node docs/redesign/uat/flight.mjs
