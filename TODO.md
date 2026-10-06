# TODO

Kết quả rà soát mã nguồn ngày 2026-10-04. Mỗi mục ghi vị trí, lỗi và cách tái hiện.
Đánh dấu `[x]` khi đã sửa và ghi commit tương ứng.

Code review of 2026-10-04. Each item lists location, defect and how to reproduce it.

## Trung bình / Medium

- [x] **Per-frame line rebuild during playback** (22784f7) — `src/scene/horizonLayer.ts:196-208` (`updateVertical`) → `src/scene/geom.ts:57` (`setFatLinePoints`).
  Each call allocates a new `LineGeometry` and disposes the old one; with defaults (vertical circle on, Polaris selected) that is 6 rebuilds per frame across both views.
  Fix: update fixed-size buffers in place, or skip when alt/az changed less than an epsilon.
- [x] **Hint after solving lowers the score** (1203fa0) — `src/ui/learning.ts:129-135`, `points()` at `:33-35`.
  Solve a task on the first try (2 pts), then click "Gợi ý" → score drops to 1 and is persisted.
  Fix: don't set `hinted` when the task is already correct.
- [x] **Negative declination cannot be typed on iOS** (630e419) — `src/ui/starPanel.ts:54-55` (`inputmode: 'decimal'`).
  iOS decimal keypad has no minus sign, so southern stars (placeholder `−16,7`) can't be entered; `6h45m` RA form also impossible.
  Fix: `inputmode="text"` (or a ± toggle).

## Thấp / Low

- [x] **Corrupted saved progress blanks the app** (1203fa0) — `src/ui/learning.ts:18`.
  `localStorage['thien-cau.hoc-tap.v1'] = 'null'` → `progress[task.id]` throws during `learningDrawer()` at `src/main.ts:27`; nothing renders.
  Fix: validate the parsed value is a plain object.
- [x] **Esc handled before the "typing" check** (dcc6d77) — `src/main.ts:244-246`. Esc in the latitude/RA field deselects the star or closes the drawer.
- [x] **Space toggles play on `<summary>` / links** (dcc6d77) — `src/main.ts:251`. Only `BUTTON` is excluded; keyboard users can't open "Hiển thị" sections.
- [x] **Arrow keys on `role="tab"` step the clock** (dcc6d77) — `src/main.ts:254-259`. Tabs lack their own arrow-key handling.
- [x] **Focus lost when the learning drawer closes** (1203fa0, f4f0be7) — `src/ui/learning.ts:169-174`. Return focus to the "Học tập" button.
- [x] **Raw i18n key at the poles** (bb1bab2) — `src/ui/infoCard.ts:178,180` with `src/astro/visibility.ts:69`.
  At |φ| = 90 a δ = 0 star is "rise/set" but its rise azimuth is NaN → shows `A = —° (compass.undefined)`.
- [ ] **Hover tooltip ignores Earth occlusion** — `src/scene/view.ts:208-215`, `src/scene/celestialSphere.ts:116-118`. Hovering Earth names a sky line behind it.
- [ ] **Selection ring draws through Earth** — `src/scene/skyLayer.ts:188` (`depthTest: false`).
- [ ] **Horizon ring half-hidden by the ground disc** — `src/scene/horizonDiagram.ts:150-153` vs `src/scene/horizonLayer.ts:171`. Lift ring ~0.01 or disable depth test.
- [x] **devicePixelRatio read only once** (906399a) — `src/scene/view.ts:51,73`. Moving to a 2× screen leaves the canvas blurry and star sizes wrong.
- [x] **Per-frame allocations in label occlusion** (5fcc197) — `src/scene/celestialSphere.ts:109,112` (`clone()` / `new Vector3`); also `hoverAt` rebuilding targets, `src/scene/horizonDiagram.ts:203,216,219`.

## Phản biện thiết kế (deferred) / Design objections deferred

- [ ] **Offline use for club sessions** (spec K3). Add a service worker that precaches the hashed assets, star data and constellation data; test with the network off; plan cache invalidation for GitHub Pages deploys.
- [x] **Thicker lines in presentation mode** (spec K7). Add `View.setLineScale(k)` that scales `LineMaterial.linewidth` and label size when `body.present` is on. Done in a597273 (lines ×2, scene labels ×1,8, emphasis composes with the scale).

## Sau thiết kế lại (review-4) / Open after the redesign

- [x] **Constellation colours imitate semantic colours** (review-4 G2). (fbe876f: one neutral figure tone `COLORS.figure`, minimum ΔE to any semantic colour 0 → 0,098; see `docs/redesign-2/polish.md`) Ursa Major is light blue (like the axis) and Ursa Minor is pink (like the vertical circle). Draw constellation figures in one neutral desaturated tone (`src/data/constellations.ts` colours, `scene/skyLayer.ts`).
- [x] **Phone first view** (review-4 B4). (02c52b6: 44 px icon buttons inside the canvas, view header hidden on phones, dome framed 6 % higher) The "Nhìn từ người quan sát / Góc nhìn" strip pushes the dome down. Move these as icons inside the canvas.
- [x] **Projector legibility** (review-4 H1). (b664219: star labels 28 px and white, titles 30/26 px, denser dashes at ×2 width) Enlarge the header in presentation mode, make star labels at least 28 px and white, and thicken or drop the dashed lines.
- [x] **Label/line crossings near the pole** (review-4 D2). (fbe876f: background names rank last with clearance, 85 % pill, selection ring as an obstacle, the selected star always named) Constellation lines cross their own names. Consider leader lines or hiding constellation names that collide.
- [x] **colour-theory T1 focal value** is 0.93× against the 2× default. It needs fewer competing edges outside the horizon view (fainter background stars, quieter sphere lines). This is a scope decision. Measured after the review-4 polish: 0,98× (a box of 43,5 % of the frame can reach at most 2,30×, so the 2× default is out of reach without removing the data bar). See `docs/redesign-2/polish.md`. **Closed by owner decision 2026-10-05:** the Full-mode focus layout (445f645) was kept and the 2× target dropped as not applicable to a large focal element (the skill's own override; dominance is judged by eye). With the horizon card at 54,8 % of the frame the ceiling is 1,82×; measured 0,87×. See `docs/redesign-2/focus-layout.md`.
- [x] **Random and manual star colours reuse semantic colours.** (4380492: every user star takes `COLORS.figure`; nearest semantic colour ΔE 0 → 0,098; see `docs/redesign-2/decisions-2026-10-05.md`) `STAR_COLORS` in `src/state.ts` includes `#f472b6` (exactly the vertical-circle pink), `#60a5fa` (near the axis blue) and `#facc15` (near the equator yellow). Pick them from hues the scene does not use, or use the neutral figure tone.

## Sau thiết kế lại lần 2 (redesign-2 review-2) / Open after redesign-2

The medium items and three of the low items from `docs/redesign-2/review-2.md` are fixed in fix round 2. These are left open:

- [x] **The codex does not feel collectible yet** (review-2 #4). It needs: (26ed361: owner decision 2026-10-05 "full game feel": category tiles, card grid with locked/new/read cards, one-time unlock reveal, "USACodex · x/44", 6 px progress bar, badge glow.)
  - category icon tiles;
  - locked entries shown as dimmed tiles instead of text rows;
  - a thicker neutral progress bar;
  - a short, quiet "Đã mở khóa" moment when an entry unlocks. Check this against the owner's "not pushy" rule.
- [x] **Teaching text is below a 12 px floor** (review-2 #5). (d244f8b: a 13 px floor for explanatory text outside USACodex; the codex diagram labels belong to the codex stream) It listed selection-card explanations, data-strip captions and codex diagram labels.
- [x] **Phone header** (review-2 #6). (ad5a0ff, a7e0713: "Đặt lại" asks first in a native modal dialog, with "Hủy" as the default; the dialog buttons are 44 px) "Đặt lại" sits next to the mode switch, so it is easy to tap by mistake. Move it into the controls, or add an undo toast. Make sure the buttons measure at least 44 px.
- [x] **The status pill reuses a zone colour out of context** (review-2 #12). (fc88ae5: neutral pill, 9 px zone-colour dot) "Mọc và lặn" is teal while the zone layer is off. Use a neutral pill with a small coloured dot instead.
- [x] **Nothing celebrates clicking a star** (review-2 A1). (0eaba1c: owner decision 2026-10-05, the selection ring pulses once; no pulse under reduced motion) This is a product idea, not a defect; it needs an owner decision because of the "not pushy" constraint.
- [ ] **Beginners have not been tested.** "Beginners are overwhelmed" and the value of Simple mode and the guide are untested assumptions (ux skill). Run a quick 5-person hallway test at a club session.

## Sau review-3 (fix round 3) / From `docs/redesign-2/review-3.md`

Problem 1 ("thiên đế" in USACodex) did not reproduce: the source is "thiên để" (U+1EC3), and the screenshot font draws the hook like an acute. Each fix below is checked by `docs/redesign-2/uat/fix-3-ui.mjs` or `fix-3-scene.mjs`.

- [ ] **Check the ể accent on a real device** (review-3 #1) before the club demo: USACodex › Nền tảng › "Thiên đỉnh và thiên để".
- [x] **The sphere view is crushed when both focus toggles are open** (review-3 #2). (a43a5e3: the sphere row keeps ≥ 220 px of canvas; the info card shrinks and scrolls below it)
- [x] **The below-horizon label covers its own marker** (review-3 #3). (e1e1219: the drawn ghost ring and edge arrow are hard obstacles; the label keeps an 8 px gap and wraps to two lines on phones)
- [x] **The phone hello does not lead with "tap a star"** (review-3 #4). (8224a5d)
- [x] **Reset dialog: no visible default, over-promising title** (review-3 #5). (12a60ba: "Đặt lại mô phỏng?"; "Hủy" always ringed when focused)
- [x] **The phone Full header takes three rows** (review-3 #6). (62a5334: two rows, icon-only "Ôn tập" with the neighbours' border)
- [x] **The unlock reward is faint; the read state is not visible** (review-3 #7). (a534469: one-time glow on "Đã mở khóa", eased progress bars, visible "đã đọc"; nothing animates under reduced motion)
- [x] **The status dot's colour key is hidden** (review-3 #8). (71e2c34: the "Trạng thái" tip lists the three statuses with their dots)
- [x] **Pink map dots clash with the vertical-circle pink** (review-3 #9). (e45216b: white place dots)
- [x] **Explanatory text sits on the 13 px floor** (review-3 #10). (b680a41: info-card notes 14 px; hint, codex counters and caption 13.5–14 px)
- [x] **The details panel has no scroll cue** (review-3 #11). (1c86fe0: "↓ Còn nữa" when the card overflows)
- [x] **Cardinal "B" collides with the altitude tick** (review-3 #12). (e0d4c6d: the vertical-circle foot is an obstacle for the cardinal letters)
- [ ] **The status key tip needs hover or focus.** On touch, the "?" still opens the USACodex entry, so phone users do not see the key (found while fixing #8).

## Sau review-4 (fix round 4) / From `docs/redesign-2/review-4.md`

Medium #1 (status dot colour) was a false positive caused by the reviewer brief; #3 (labels "below the horizon") did not reproduce. See the coordinator note in the review. Each fix below is checked by `docs/redesign-2/uat/fix-4.mjs`.

- [ ] **Full mode hides the controls by default** (review-4 #2). This follows the owner's focus-layout decision (both drawers start closed). Owner to decide whether to open "Bảng điều khiển" on the first entry to Full, or to mark the toggle once.
- [x] **Crowding at 1280 with both toggles open** (review-4 #4). (8760840: the "Còn nữa" band fades the cut row out fully; 63aca0c, 959a93a, 27101d0: below 235 px the sphere view keeps only orienting labels — that is the expanded state with a selection, 222–238 px; closed layouts are ≥ 241 px and keep every name. The equator name shows at 11 of 12 sampled sidereal times)
- [x] **Icon-only phone header** (review-4 #5). (70be379: a 12 px caption under each icon, 11 px below 360 px; buttons ≥ 44 px; header 103 px in both modes)
- [x] **Map equator drawn yellow at some widths** (review-4 #10). (2f3278e: grey dashed `--map-equator` at every width)
- [x] **Magnitude uses a hyphen** (review-4 #11). (9104b4a: `fmtMag` with U+2212)
- [x] **Hello toast mixes "chạm" and "bấm"** (review-4 #14). (ff65786)
- [x] **Phone "?" hit area** (review-4 #15). (f90ed27: it was 42 px; now 44 px)
- [ ] **Still open from review-4 (low):** #6 the reset dialog's confirm button is heavier than "Hủy"; #7 the unlock chip in a still frame; #8 the selected star's name is hidden in the mid-pulse frame; #9 the azimuth arc is not in the legend; #12 USACodex diagram labels touch their strokes; #13 caption wraps in the Simple selection panel.

## Kho mã / Repository

- [x] Delete unused 624 KB `src/whiteUSAC (1).png` (not referenced, not shipped). (c18ce19)
- [x] Main bundle 878 kB (258 kB gzip); `vite.config.ts` raises `chunkSizeWarningLimit` to hide the warning. Split Three.js / lazy-load data. (5c51d6f; entry JS now 64 kB gzip, see `docs/redesign/perf.md`)
- [ ] Use descriptive commit messages (recent history: "f", "y", "d").
