# Fix round 1: scene (review-1 #2, #5, G1)

**Branch:** `redesign/fixscene`, 2026-10-05.
**Commits:** `c6bccc0` (#5 ground and letters), `8214dd9` (#2 below-horizon object, G1 label collisions), plus this record, the UAT and the renders.
**Renders:** `shots/fix1-scene-{before,after}-*.png`, made with `fix1-scene-shots.mjs` on the dev server. Both builds were rendered with the same fixed state (Hà Nội, paused, LST 264°, reduced motion), so the before and after frames are the same sky and can be compared pixel for pixel.

Skills applied: `color-theory` (functional colour, saturation layout, value plan, T1/T5 measurement), `visual-design` (figure and ground, hierarchy, proximity), `information-design` (direct labels next to the marks they explain).

How each check was done:
- **Measured:** `checks.py value` (T1), `chroma` (T5), `sample` and `contrast` from color-theory; OKLCH values computed with the skill's OKLab formulas.
- **Self-judged:** the renders, read by me, the author. This is **not** a fresh-context review; the next review round still has to judge them.

## #2 (high): a selected star below the horizon was invisible

**Before** (`fix1-scene-before-sirius-1440.png`): Sirius at h = −73°. The clip plane removes everything below the ground, so the selection ring, the star and the h arc are all gone. The only cue is the cyan azimuth ring around the observer.

**What changed:**
- `HorizonLayer.ghost` is a tiny scene drawn in a **second pass without the clip plane** (`View.renderGhost`), only while the selected object is below the horizon and the "underside" toggle is off. It holds:
  - the selection ring as a **dashed** sprite (`ringTexture(color, dashed)`), same size as the real ring;
  - a dot at the star's position;
  - the h arc as a **dashed** pink `Line2` from the foot on the rim down to the star (shown when the vertical-circle toggle is on, like the solid arc above the horizon).

  All three have `depthTest` off and opacity 0,8: they read *through* the ground, ghosted, never as solid objects.
- A label next to the ghost ring: **"Sirius đang ở dưới chân trời (h = −73°)"**.
  - New key `scene.belowHorizon` = `"{name} đang ở dưới chân trời (h = {h})"`. The name is the object's English name from `resolveSelection`; h uses `fmtDegSigned` (comma decimal, U+2212 minus).
  - Near the horizon (|h| < 0,95°) it shows one decimal ("h = −0,5°"), never "h = 0°".
  - Style `.lbl--under`: the dark chip of the angle labels, white text, a **dashed** pink left edge — the same dashed language as the ghost.
  - Placement reuses the selected-name machinery: right of the ring, then left, above, below the ring, then the foot of the arc inside and outside the rim, then mid-arc. It is `must` (never hidden). At 375 px the ghost ring falls below the canvas; the label then sits at the foot of the arc, inside the frame.
- Budget: everything is built once. Updates move the ghost and rewrite the arc in place with `writeFatLine` (0 `LineGeometry` created); they are skipped when h and A change by less than 0,001°. The label text is rebuilt only when the integer degree changes; the name is looked up only when the selection changes. The per-update h/A computation now uses the new allocation-free `equatorialToHorizontalInto` (unit-tested to equal `equatorialToHorizontal` on 300 random cases).

**Why:** a beginner who clicks Sirius must see *where* it is. Explanation belongs next to the mark, not in a distant panel (information-design, `3069 · U3 · L11 · 14:33–16:28`), and a new mark needs words to be decoded (`2495 · U4 · L15 · 00:00–01:26`). The dashed/ghosted style keeps the figure–ground order honest: the ground stays the ground, the hidden star reads as *behind* it (visual-design, `5642 · U4 · L49 · 02:06–03:47`). Pink is the existing code for the vertical circle and h; no new colour was introduced (color-theory, colour as a sign within a system, `5642 · U3 · L39 · 02:36–03:20`).

**Self-judged:** in `fix1-scene-after-sirius-1440.png` the dashed arc leaves the rim at A ≈ 282° and ends at a dashed ring below the disc with the label beside it; the eye now follows rim → arc → ring → words. In Full mode (`…-sirius-full-1440.png`) the same reading holds. The ghost is clearly weaker than the solid marks above the horizon, which is intended.

## #5 (medium): the green disc was the most saturated area and spread "green"

| | Before | After |
|---|---|---|
| Ground swatch (`COLORS.ground`) | `#37593b` OKLCH L 0,43 · C 0,063 | `#2d3b27` L 0,33 · **C 0,039** |
| Ground as rendered (opacity 0,55 on night sky, sampled) | `#213529` L 0,31 · C 0,034 · h 157 | `#1b251e` **L 0,25 · C 0,019** · h 154 |
| Ground marks | `#a7d7a9` C 0,081 | `#9aa59c` C 0,018 |
| B/N/Đ/T letters (`--scene-dir`) | `#bbf7d0` pale green, C 0,081 | `var(--text)` `#f2f2f2`, C 0 |
| Horizon rim `#4caf50` against the ground | 4,70:1 | **5,73:1** |
| Cyan "A = …" label on the ground | 9,02:1 | 10,99:1 |

The target from the review was the *on-screen* fill (C ≤ 0,04, L ≈ 0,25); the swatch itself also meets C ≤ 0,04, which matters in first-person view where the ground is opaque. The `--scene-dir` token is shared with the codex diagrams (`.cdx-svg__t--dir`), so the letters there turn neutral too; that is the intended single meaning.

**Why:** chroma should rise toward what the lesson is about, not sit in the floor (saturation layout, `1140 · U4 · L16 · 01:56–04:24`); fewer colours, better decisions — green now means one thing, the horizon line (`1140 · U3 · L08 · 09:58–11:48`); the colour plan follows the value plan, so the ground drops in value as well as chroma (`1140 · U3 · L08 · 06:31–09:58`).

**Measurements** (same frame before and after; Full mode 1440 × 900; focal box = horizon card 16, 73, 854, 746, 43,5 % of the frame):

| Check | Before | After |
|---|---|---|
| T1 focal value, Polaris selected (`full-1440`) | 0,99× (FAIL vs 2×) | 0,98× (FAIL) |
| T1 focal value, Sirius selected (`sirius-full-1440`) | 0,95× (FAIL) | 0,97× (FAIL) |
| T5 chroma, horizon card (Polaris) | PASS, C 0,024 vs 0,009 outermost | PASS, C 0,021 vs 0,009 |
| T5 chroma, horizon card (Sirius) | PASS, C 0,023 vs 0,004 | PASS, C 0,021 vs 0,004 |
| Disc box only (horizon crop, 0,25–0,75 × 0,62–0,90): mean C | **0,032** (the most chromatic region; T5 "PASS" = the floor was the chroma focus) | **0,020** (= outermost ring 0,020; no longer the focus) |
| Disc box only: mean L | 0,301 | 0,254 |
| T1 with the sky dome as focal, inside the horizon crop | 1,55× | 1,58× |

**Honest reading:**
- **T1 did not move.** Darkening a flat fill changes almost no value *edges*, and the card is 43,5 % of the frame, so 2× needs 87 % of all edges inside it (see `polish.md`). The checklist's override applies (focal element is large): judge by eye. By eye the dome now leads and the disc reads as a floor.
- What the change *did* move is chroma: the disc stops being the most chromatic region of the view (0,032 → 0,020), and the strongest green is now only the rim line. Inside the horizon view the dome's share of value edges rises slightly (1,55× → 1,58×).
- T5 for the whole card still passes; its focal chroma fell a little (0,024 → 0,021) because the disc was part of that mean.

## G1: label collisions in presentation mode

Seen in review-1 `08-present-1920.png`, reproduced in `fix1-scene-before-present-1920.png`:
1. sphere view: "B" sat on the Polaris selection ring;
2. sphere view: "Thiên đỉnh" sat ~24 px from "T" on the same baseline and read as "T Thiên đỉnh";
3. horizon view: "A = 0,6°" sat on the observer figure.

**What changed (declutter, `view.ts`, `declutter.ts`):**
- `LabelBoxes` gains **obstacles** (`solid`) and **soft** boxes. Ordinary labels avoid obstacles; labels anchored *around* an obstacle (selected name, pole/zenith names, emphasised measurements) are `soft` and ignore them, so their established placement (review-4 D2) is unchanged.
- Obstacles are placed **first**: the selection ring and, in the horizon view, a keep-out box around the observer figure (`HorizonDiagramView.keepOut`, projected foot-to-head, 1,2 × the figure's screen height wide to cover the telescope and sign; it follows the glTF model once loaded).
- The cardinal letters are still never hidden (`must`), but now carry alternative places **along the horizon** (±7°, ±14°, then further out) and avoid the obstacles. They also claim a pad of 0,4 × their own height (≈ 8 px normally, ≈ 23 px when presenting).
- The zenith/nadir labels get alternatives inward along their dashed line (0,90 R, 0,78 R), then outward.
- "A = …" gets alternatives either side of the arc's midpoint (±30°), further out, then opposite.

**Results** (measured from the DOM in `uat/below-horizon.mjs`, 1920 × 1080 presentation):
- "B" moved right of the ring (box at x = 1590 vs ring centre 1533, radius ≈ 26 px); "Thiên cực Bắc" still shows.
- "Thiên đỉnh" is **58 px** from "T" (was ≈ 24 px), sitting inside the sphere on its own dashed zenith line.
- "A = 0,6°" sits right of the observer and its sign (x 665–779 vs figure 562–596).

**Why:** grouping by proximity means two labels placed close together read as one unit (`5642 · U2 · L09 · 02:53–03:45`); the pad and the alternatives keep separate things apart. A clear hierarchy: the direction letters stay, lower-rank names yield (`5642 · U4 · L55 · 00:08–01:27`).

**Self-judged:** in `fix1-scene-after-present-1920.png` none of the three collisions remains. The cost: "A = 0,6°" now sits ~30° off its very short arc, linked to it by colour only; for larger A the label stays on the arc. Constellation names near the observer (e.g. CORONA AUSTRALIS at this time) now hide instead of touching the figure.

## UAT

Servers: dev `:5196`, preview `:4196`, from `/home/user/wt-fixscene`; `?quality=fixed`.

| UAT | Result |
|---|---|
| smoke | PASS |
| ui | 25/25 |
| ux | 37/37 |
| highlight | 25/25 |
| declutter | 21/21 |
| perf | (a), (b), (c) PASS; 0 `LineGeometry` during playback |
| bundle-size | PASS (entry ≤ 90 kB) |
| modes | 27/27 |
| guide | 66/66 |
| **below-horizon (new)** | **21/21** |

`uat/below-horizon.mjs` checks: Sirius at LST 264° is at h ≈ −73°; the label is visible inside the horizon canvas with exactly "Sirius đang ở dưới chân trời (h = −73°)" (U+2212); the ghost pass is on; 10 steps of 0,01° cause 0 text writes and 0 new `LineGeometry`; near the horizon it reads "h = −0,5°"; it disappears when Sirius rises (LST 101,3°, h = +52°), when "underside" is on, and when nothing is selected; at 375 px the label is inside the frame with no horizontal scroll; and the three G1 collisions at 1920 presentation.

## Left undone

- **T1 still fails** at 0,97–0,98× for the reason above; it is a layout property of a card that covers 43,5 % of the frame, not something the ground colour can fix.
- At 1440 in Full mode the horizon view's "Thiên đỉnh" label sits under the view tool buttons ("Nhìn từ người quan sát"). This was already so before this round (`fix1-scene-before-sirius-full-1440.png`); it belongs to the UI chrome stream (toolbar placement), not the scene.
- The 30°/60° alt-az grid labels (`#a7f3d0`) and `COLORS.altAzGrid` are still green. The grid is off by default and is its own code; changing it was out of scope.
- The vision checks still need a fresh-context reviewer.
