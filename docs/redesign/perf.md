# Hiệu năng — trước và sau thiết kế lại

Every size is gzip at zlib's default level, the same as Vite's report. "Entry JS" means everything `dist/index.html` loads up front, through `<script>` and `modulepreload`.

## Trước (baseline, commit `3e5689e`, 2026-10-04)

| Chunk | Raw | Gzip |
|---|---|---|
| `index-*.js` (entry: app + three.js + data) | 878.15 kB | 257.81 kB |
| `katex-*.js` (lazy, help dialog only) | 259.28 kB | 77.76 kB |

| Metric | Value |
|---|---|
| (1) Entry JS | 257.81 kB |
| (2) JS before the first 3D frame | 257.81 kB |
| (3) Total JS, excluding KaTeX | 257.81 kB |

Runtime problems found in the review (see `TODO.md`):

- The hidden view on mobile keeps rendering every frame.
- During playback, each frame rebuilds 3 `LineGeometry` objects per view.
- Every render walks the whole scene to update labels.
- The DOM panels are written every frame.

## Sau wave 0 (khung tải động `scene/boot`)

| Chunk | Gzip |
|---|---|
| `index-*.js` (entry, without three.js) | 101.66 kB |
| `boot-*.js` (three.js + scene, loaded dynamically and in parallel) | 157.37 kB |

## Sau (luồng hiệu năng, wave 2)

Measured on branch `redesign/perf2` (2026-10-04) with these commands:

```sh
npm run build && node docs/redesign/uat/bundle-size.mjs
node docs/redesign/uat/perf.mjs          # starts vite dev on 5190 and vite preview on 4190 if they are not running
```

### Kích thước gói (gzip, zlib mặc định)

| Metric | Wave 0 | Sau |
|---|---|---|
| (1) Entry JS (`index` + modulepreloads) | 101.67 kB (`index` 52.94 + `state` 48.73) | **64.35 kB** (`index` 14.46 + `i18n` 10.88 + `state` 39.02) |
| (2) JS before the first 3D frame | 259.43 kB (+ `boot` 157.76) | **223.11 kB** (+ `boot` 12.66 + `three` 146.10) |
| (3) Total JS, excluding KaTeX | 265.33 kB | 266.21 kB |

The entry budget in `AGENTS.md` is ≤ 90 kB gzip, so (1) passes with about 25 kB to spare.
`bundle-size.mjs` exits with code 1 if it is exceeded.

What moved out of the entry chunk:

- `land.json`: 25.38 kB. It loads through a cached `import()` in `data/land.ts`. The Earth texture and the world map paint ocean and grid first, then repaint when land arrives.
- The 88 constellation figures: 11.77 kB. The entry keeps only the 16 template figures (`constellation-templates.json`, about 3 kB gzip). The full set loads the first time "Đường nối 88 chòm sao" is turned on.
- three.js now has its own chunk (`three-*.js`), so a deploy that changes only scene code does not invalidate it in the browser cache.

The star catalogue (`stars.json`, about 30 kB gzip) is still eager. UI code (`selection.ts`, `starPanel.ts`, `state.ts`) reads names and indices synchronously. Moving it behind `scene/boot` would need a separate eager name table plus lazy positions. That is not needed for the budget, so it is not done.

Total (3) is flat because the work moved bytes later rather than deleting code.

### Thời gian chạy (`perf.mjs`, Chromium + SwiftShader, headless)

| Check | Result |
|---|---|
| (a) Dev, 1280×800, `?quality=fixed`, playing, 120 frames after 30 warm-up | `lineGeometriesDelta: 0`, `createBufferDelta: 0`, 240 renders, LST advanced 66.8° |
| (b) Preview, 375×812, horizon tab active, 60 frames | hidden sphere canvas **0** draw calls; horizon canvas 1440 |
| (c) Preview, 1280×800, `document.hidden = true` + `visibilitychange`, 1 s | sphere **0**, horizon **0**; drawing resumes when visible again (506 calls in 10 frames) |
| (d) Dev, CPU throttle ×4, adaptive quality on | stepped down to level 1 after about 27 s; the quality notice was shown (informational only) |

SwiftShader renders at about 116 ms per frame, so the absolute frame times here say nothing about a real GPU. (d) depends on the machine. The check only reports it and does not fail on it.

### Cơ chế đã đưa vào

- **Frame loop** (`runtime/frameLoop.ts`):
  - It cancels `requestAnimationFrame` while the tab is hidden.
  - DOM ticks run at most every 80 ms while playing, and on every dirty frame while paused.
  - Quality samples come only from frames that actually rendered while the page was visible.
- **Fat lines** (`scene/geom.ts`):
  - `dynamicFatLine` preallocates the position and dash-distance buffers.
  - `writeFatLine` writes in place.
  - `geomStats.lineGeometries` counts every `LineGeometry` created.
  - These are used by the vertical circle, the h/A arcs, the angle/pole/latitude arcs and the Sun's path.
  - `updateVertical` skips work when the selection, the star list, h and A (rounded to 0.001°) are unchanged.
- **Labels and hover** (`scene/view.ts`):
  - Label and hover-target lists are cached by `structureVersion`.
  - Labels under hidden groups are skipped.
  - Label positions are read from `matrixWorld`.
  - Picking walks the stars without per-candidate objects.
- **Adaptive quality** (`runtime/quality.ts`):
  - It ignores a 4 s warm-up and averages over 90-frame windows.
  - Two windows in a row averaging over 28 ms step down one level, with a 5 s cooldown. It never steps up on its own.
  - Level 1 caps the pixel ratio at 1. Level 2 also limits the catalogue to magnitude 4.0 with `setDrawRange`; `catalog.test.ts` checks the sort order this relies on.
  - `?quality=fixed` or a restored session (`sessionStorage['astrosphere.quality.v1']`, written through `ui/storage.ts` as the JSON string `"manual"`) disables it.

### Còn lại / giới hạn đã biết

- `CSS2DRenderer.render` (three.js addon) still allocates on every rendered frame and writes `style.transform` for every visible label. It creates an `objectData` per label, and `zOrder` sorts a fresh array. A custom label renderer could cache screen positions and write only changed labels, but it would change label stacking, so it is not done here.
- `equatorialToHorizontal` (in `astro/`, outside this stream) returns a small `{alt, az}` object for each `updateVertical` call and each horizon-background update.
- Rebuilding sectors and zones when latitude changes still allocates. That happens on user input, not during playback.
