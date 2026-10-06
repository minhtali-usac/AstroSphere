# Stream P: review-4 polish (R5, with R6 and R8)

**Branch:** `redesign/polish`, 2026-10-05.
**Commits:** `fbe876f` (G2, D2), `02c52b6` (B4), `b664219` (H1), `2012371` (observer model), `973ebfa` (hover targets after the model loads), plus this record.
**Renders:** `shots/polish-{before,after}-{1440,pole-1440,375,present-1920}.png`, made with `polish-shots.mjs`.
- The scene shows the current sky, so the before and after renders are a few minutes apart. Compare structure in them, not star positions.
- The T1 numbers below come from a controlled pair: both builds rendered in the same minute, with reduced motion so nothing autoplays.

Skills applied:
- `color-theory`: functional colour, the value plan and focal value.
- `visual-design`: hierarchy, figure and ground, and the hardest real application.
- `frontend`: native controls, accessible names and state, and performance as a requirement.

How each check was done:
- **Measured:** `checks.py value`, `chroma`, `contrast` (color-theory) and `balance` (visual-design), plus OKLab ΔE computed with the skill's formulas.
- **Self-judged:** the vision checks, read from the renders by me, the author. They are **not** a fresh-context review. The coordinator's R8 review still has to judge them.

## G2: constellation colours imitated semantic colours

**What changed:**
- User-added figures now use one tone, `COLORS.figure #cfbb9a` (OKLCH L 0,80 · C 0,05 · H 80°, a desaturated sand). It covers lines, star dots, star labels, the figure name and the panel chip swatch.
- The 16 per-template colours are gone from `src/data/constellations.ts`.
- The 88-constellation background lines use the same family, darker and greyer: `COLORS.figureSky #8a7f6c` (L 0,60 · C 0,03).
  - They are drawn at opacity 0,30 in the horizon view and 0,18 in the sphere view.
- Their names use the token `--scene-allsky-name #9a9283` at opacity 1.
  - Element opacity had been making the label pill translucent as well.

**Why:**
- The scene colours are a code, a sign function (5642 · U3 · L39 · 02:36–03:20). A figure painted in a code colour reads as that code.
- Fewer colours give better decisions (1140 · U3 · L08 · 09:58–11:48). Figure and background lines are one family at two values, so they are bridged rather than competing (1140 · U3 · L09 · 05:00–06:14).
- The candidate was chosen by searching OKLCH for L ≥ 0,78 and C ≤ 0,05, maximising the minimum OKLab ΔE to every colour in `scene/colors.ts`.

Nearest semantic colour, as OKLab ΔE (0 means identical):

| Colour | Before | After |
|---|---|---|
| Ursa Major figure | `#7dd3fc` → azimuth 0,059 (and reads as the axis blue) | `#cfbb9a` → dsoOther 0,098 |
| Ursa Minor figure | `#f0abfc` → deep-sky pink 0,057 (and reads as the vertical-circle pink) | same tone |
| Worst of the 16 templates | **0,000**. Four were identical: Sco = ecliptic, Lyr = azimuth, Aql = DSO cluster, Cen = DSO nebula. 12 of 16 were below 0,08. | 0,098 (one tone) |
| 88-figure lines | `#6b8cc7` → axis 0,087 | `#8a7f6c` → grid 0,085 (grid is off by default and also thin); axis 0,215 |

WCAG contrast, from `checks.py contrast`:
- `#cfbb9a` on the night sky `#050913`: 10,64:1.
- `#cfbb9a` on the label pill `#0a0a0a`: 10,59:1.
- `#9a9283` (background names) on the pill: 6,42:1. That is AA. It is deliberately not AAA, because these names are background.

## D2: label/line crossings near the pole

**Labels (`labels.ts`, `skyLayer.ts`):**
- The 88 background names rank last (`ALLSKY_NAME_RANK = 50`, below every star name) and ask for 6 px of clearance (`LabelData.clear` → `LabelBoxes.pad`).
- When space is tight, a background name hides instead of sitting against a star or pole name. This gives one clear hierarchy (5642 · U4 · L55 · 00:08–01:27).

**Pill and halo (CSS):**
- Star, catalog and constellation labels sit on an 85 % pill instead of 65 %.
- A figure's own lines pass under its name without cutting the strokes. Figure and ground are designed together (5642 · U4 · L49 · 02:06–03:47).

**Placement order (`view.ts`):**
- The selection ring is a declutter obstacle for every label of rank ≥ 20. It is pushed after the direction, zenith and pole labels, so it never displaces them.
- Pole and zenith labels are placed before the selected object's name. "Thiên cực Bắc" stays, and "Polaris" moves to a free side of the ring.

**Selected object without a label:**
- Polaris (mag 1,98) is the default selection, but it is fainter than the catalog-label limit (1,6), so it had no name in the scene.
- One reusable label in `SkyLayer` now names a selected catalog star or a non-featured deep-sky object that has no label of its own. Its text and position change only when the selection changes.
- This also fixes two `declutter.mjs` checks and one `highlight.mjs` check that were already failing on the merge commit `8dc680c`.

**Budget:**
- No allocation in the per-frame path: one pass over the prebuilt list, typed arrays and a scratch vector.
- Unit tests in `src/scene/labels.test.ts` cover the rank order and that a name with clearance yields.

**Self-judged:** in `polish-after-pole-1440.png` no background name touches the ring. "Thiên cực Bắc" sits above the ring and "Polaris" below it, and the lines no longer cross any name. Before the change, "SERPENS" sat against the ring and Polaris had no name.

## B4: phone first view

**What changed:**
- The view tools are now overlay icon buttons in the top-right corner of each canvas.
  - Markup: `.view__stage` wraps the canvas and a `role=group` toolbar. The toolbar sits outside the canvas's `role=img`, so screen readers still reach the buttons.
- Each button has an `aria-label`, a `title` and native keyboard focus.
- The first-person button keeps a constant name and reports its state with `aria-pressed` and an orange border. Before, it renamed itself while also being a toggle.
- On desktop the label text shows next to the icon.
- At ≤ 900 px:
  - the buttons are 44 × 44 px icons stacked in the corner;
  - the view header is hidden, because the view tab already names the view.
- In the portrait horizon view the framing moves up by 6 % of the height (`viewShiftY`, a camera view offset). Labels and picking use the same projection, so they stay aligned.

**Measured at 375 × 812:**
- The full-width strip of two text buttons (about 225 px wide, y ≈ 130–175) became two 44 px icons at the right edge.
- The zenith label moved from y ≈ 193 to y ≈ 168, so the dome is about 25 px higher.
- The gap between the disc and the info row grew by the same amount.

The change applies the rule to build for the hardest application, the phone (5642 · U7 · L103 · 02:24–03:14), and the frontend principles of native controls and states.

## H1: projector legibility (`body.present`, 1920 × 1080)

- Scene labels scale ×2,35 (was ×1,8). Star names went from 21,6 px to **28,2 px**.
- Catalog and star names in presentation mode are `--text` white (`#f2f2f2`, 17,7:1 on the pill) at weight 600. They were `#d4d4d4`.
- View titles went from 20 / 18 px to **30 / 26 px**.
- Dashed lines were already ×2 thick. Now they also get 1,6× longer dashes and 0,5× gaps:
  - they are still dashed, so their meaning is kept, but read near-solid from the back of the room;
  - only uniforms change, with no recompile and no geometry.
- Background constellation names are 15 px, so they stay a background layer.

`declutter.mjs` 1920 present: no label overlaps and none leaves its canvas.

**Self-judged:** in `polish-after-present-1920.png`, star names (Arcturus, Vega, Spica, Polaris) are now as large as the circle names and white. Dashes on the vertical circle and the ecliptic read as lines.

## Observer model weight (R6)

- `usui-chan.glb` (2,3 MB) now loads after the first rendered frame, at an idle callback with a 4 s timeout. The callback is prebuilt, so `frame()` does not allocate.
- `GLTFLoader` is a dynamic import in its own chunk (13,35 kB gzip). It was removed from the three.js group in `vite.config.ts`.
- The simple figure shows until the model arrives. The loaded model is unchanged.
- When the model replaces the simple figure, the cached hover-target list rebuilds once (31 → 50 targets, `973ebfa`).

From `bundle-size.mjs`:

| | Before | After |
|---|---|---|
| (1) Entry JS | 73,44 kB | 73,48 kB |
| (2) JS before the first 3D frame | 256,45 kB | **244,81 kB** |
| three.js chunk | 165,90 kB | 153,31 kB |

## T1 focal value (optional)

The only change here is that the 88-figure lines are fainter in the sphere view (0,30 → 0,18). The rule is that colour contrast follows the value plan, and the secondary view gives way (1140 · U3 · L08 · 06:31–09:58).

| Check | Before | After |
|---|---|---|
| T1 horizon card (16, 73, 854, 746; 43,5 % of the frame) | 0,95× | **0,98×** (FAIL against the 2× default) |
| T1 pole region (470, 250, 620, 400) | 2,42× | 2,45× (PASS) |
| T5 chroma, horizon card | PASS (C 0,026 against 0,010 outside) | PASS (C 0,024 against 0,009) |
| visual-design balance (centroid distance / diagonal) | 0,0365 | 0,0362 (not judged; vision review) |

**Honest reading:**
- A box covering 43,5 % of the frame can hold at most 2,30× its area share. The 2× default would need 87 % of all value edges inside the horizon card.
- The top bar, data bar and sphere view all carry real content, so 2× is not reachable by quieting lines.
- The checklist's own override applies, because the focal element is large: judge by eye.
- One experiment hid every background name in the sphere view. It moved T1 only from 0,99× to 1,03×, and was not kept, because the names teach.

## UAT

All runs use preview `:4193` and dev `:5193`.

| UAT | Result |
|---|---|
| smoke | PASS |
| ui | 25/25 |
| ux | 37/37 |
| highlight | 25/25. On `8dc680c` it was 24/25: the Polaris label check failed, now fixed by the selection label. |
| declutter | 21/21. On `8dc680c` it was 19/21: the Polaris name checks failed. |
| perf | (a), (b) and (c) PASS. Run with ports 5193/4193 via a copy, because `perf.mjs` hard-codes 5190/4190. |
| bundle-size | PASS, entry 73,48 kB |

Known flake: `declutter.mjs` "375 sphere tab" waits a fixed 1 500 ms after the tab click.
- On SwiftShader, the time until sphere labels first appear measured:
  - 1,1–1,7 s on the base build;
  - 0,6–2,0 s on this build.
- So the check fails about one run in two or three on either build.
- I did not change that test.

No UAT assumption was changed.

## Left undone

- Random and manual stars still pick from `STAR_COLORS` in `state.ts`, which includes `#f472b6` (exactly the vertical-circle pink), `#60a5fa` and `#facc15`. That is outside G2's figure scope, so it is a follow-up.
- The vision checks still need a fresh-context reviewer (R8).
