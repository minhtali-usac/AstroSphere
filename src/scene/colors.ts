// Màu ngữ nghĩa của cảnh 3D (không phụ thuộc three.js để giao diện dùng được mà không kéo three vào gói khởi động).
// Các màu này mang nghĩa (xích đạo vàng, trục xanh…) nên không đổi theo thương hiệu.

export const COLORS = {
  equator: '#ffd54f',
  axis: '#4f9dff',
  horizon: '#4caf50',
  // Mặt đất: xám lục tối (fix-1 #5). Vẽ ở độ đục 0,55 trên nền trời đêm, màu hiện trên màn hình là #1b241e —
  // OKLCH L 0,25 · C 0,017 (trước: #213529, L 0,31 · C 0,034; bản thân mẫu #37593b có C 0,063). Màu lục mạnh chỉ
  // còn ở viền chân trời (horizon): đĩa là nền, không phải tín hiệu. Mẫu tự thân: L 0,33 · C 0,039 (≤ 0,04, vẫn thấy
  // ở góc nhìn người quan sát, độ đục 1).
  ground: '#2d3b27',
  // Vạch trên mặt đất (trục B–N, Đ–T, vạch phương vị, vòng đồng tâm): xám trung tính hơi lục (C 0,018), không còn
  // lục nhạt #a7d7a9 (C 0,081) — lục chỉ có nghĩa "chân trời".
  groundMark: '#9aa59c',
  hourCircle: '#a3a3a3',
  meridian: '#e2e8f0',
  zenith: '#ffffff',
  vertical: '#f472b6',
  // Cung và nhãn phương vị A: xanh lơ, khác hẳn vàng xích đạo, cam hoàng đạo/thương hiệu, hồng vòng thẳng đứng và
  // màu các vùng (review-2 G2: hổ phách cũ đọc như cùng họ với xích đạo). 13,7:1 trên nền trời, 5,4:1 trên mặt đất.
  azimuth: '#67e8f9',
  circumpolar: '#8b5cf6',
  riseSet: '#14b8a6',
  neverRise: '#ef4444',
  ecliptic: '#fb923c',
  galactic: '#e879f9',
  sun: '#ffcc33',
  grid: '#64748b',
  angle: '#fde047',
  latitude: '#38bdf8',
  altAzGrid: '#7dd3a8',
  // Thiên thể sâu theo nhóm (vòng tròn rỗng): hồng thiên hà, xanh ngọc tinh vân, vàng nhạt cụm sao.
  deepSky: '#f9a8d4',
  dsoNebula: '#5eead4',
  dsoCluster: '#fde68a',
  dsoOther: '#cbd5e1',
  // Hình chòm sao người dùng thêm (đường nối, chấm sao, nhãn): MỘT tông cát trung tính, độ bão hòa thấp
  // (OKLCH L 0,80 · C 0,05 · H 80°), không bắt chước màu ngữ nghĩa nào — ΔE OKLab ≥ 0,098 với mọi màu ở trên
  // (gần nhất: dsoOther, hourCircle). Trước đây mỗi chòm một màu: Ursa Major xanh như trục, Ursa Minor hồng như
  // vòng thẳng đứng (review-4 G2). 10,6:1 trên nền trời. Xem docs/redesign-2/polish.md.
  figure: '#cfbb9a',
  // Đường nối 88 chòm sao (nền, mặc định bật): cùng họ cát nhưng tối và nhạt hơn (L 0,60 · C 0,03), vẽ mờ 0,3 —
  // lùi hẳn về sau các đường ngữ nghĩa và hình chòm sao người dùng thêm.
  figureSky: '#8a7f6c',
} as const;
