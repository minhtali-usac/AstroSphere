# Full-mode focus layout (owner decision 2026-10-05)

## Why

The color-theory T1 check ("the focal element holds at least 2× its area share of value edges") failed on the horizon view:
- 0,93× in Full mode, where the horizon card covered 43,6 % of a 1440 × 900 frame (polish.md recorded 0,95–0,98× for the same box; this record re-measured the baseline in a controlled pair, below);
- 0,87× in Simple mode.

The owner chose: "Try a focus layout. In Full mode, collapse the data bar and side panel behind toggles so the horizon view fills more of the screen, then re-measure."

The answer is below. **T1 still fails, and it has to fail by construction**: the horizon card now covers 54,8 % of the frame, so even if it held every value edge on the screen its ratio could only reach 1/0,548 = 1,82×.

## What changed

Branch `redesign/focus`. The commits are `445f645` (layout), `a168ae4` (hello placement), and `20a1539`, `751b172` and `73b5495` (acceptance checks).

The focus layout applies only to **Full mode at 1101 px and wider, outside presentation mode**. Everywhere else the two new toggles are hidden and the page is unchanged: phones (≤ 900 px), 901–1100 px, Simple mode, and `body.present`.

| Area | Before | Focus layout |
|---|---|---|
| Horizon view | Left column, 3fr (838 × 674 at 1440 × 900) | Left column, the full height of the first screen (974 × 729) |
| Sphere view | Right column, 2fr (558 × 674) | Right column, `clamp(260px, 30%, 460px)` wide (422 × 729): 2,3× smaller than the horizon card in width and in area |
| Info card (opened) | A third column at ≥ 1200 px | Under the sphere view in the same column, at most 44svh tall. Collapsed, it is still the one-line chip at the foot of the sphere view |
| Data bar | Full bar with captions under the legend, partly below the fold | **Compact strip** on one line: `Vĩ độ φ = 21,03° B · Độ cao thiên cực 21,03° · LST`. The "Số liệu" toggle expands it to the full bar with every caption |
| Control panels | Four panels in a masonry block below the fold | Hidden behind **"Bảng điều khiển"**. When open they form a right column, `clamp(330px, 25vw, 400px)` wide, with the four tabs already used on phones. The views narrow to make room: nothing covers the scene |
| Page | Scrolls to reach the panels | Views, legend and strip fit in the first screen (`height: calc(100svh - topbar)`). The footer stays below |
| Usui-chan's wide hello (first visit) | Bubble over the data bar | One band (head · message and star hint · buttons) over the legend and strip, from the left edge to the avatar. It no longer covers either sky or the Polaris chip at 1101–1440 px |

Both toggles (`src/ui/focusLayout.ts`):
- are native `<button>`s, 44 px tall, with visible text and a chevron;
- carry `aria-expanded` and `aria-controls` (`databar`, `panels`);
- have `data-guide` keys `focusData` and `focusPanels`, with a tip of at most two sentences each;
- show an orange border while open, the same "pressed" language as "Nhìn từ người quan sát".

Other details:
- **State:** kept in sessionStorage `astrosphere.focus.v1` = `{data, panels}`, through `ui/storage.ts`, with the guard `isFocusState`. It is registered in AGENTS.md, and both areas start closed.
- **Focus:** after a toggle, focus stays on the toggle (a non-modal disclosure, so it changes nothing in the Esc order). In the focus layout, clicking the active panel tab no longer collapses the panel, because the toggle does that. The `panelTabs` tip now says the tab-collapse is for phones.
- **Strings:** `focus.*` (4 strings), `guide.tip.focusData`, `guide.tip.focusPanels` and one help line.
- **Performance:**
  - The toggles only flip a body class and call `loop.markUiDirty()`, so there is no per-frame work.
  - The 3D views resize through their existing ResizeObserver.
  - The sphere view keeps drawing (focus UAT: draw calls > 0, and the frame count rises after a layout change).
  - Entry JS is 82,56 kB gzip, within the 90 kB budget.

## Skill lessons applied

- **visual-design, hierarchy:** "Establish a dominant element, then subordinate elements and detail; competing 'number ones' make a message unclear" (5642 · U4 · L55 · 00:08–01:27).
  - The horizon card goes from 1,5× to 2,3× the sphere card, in both width and area.
  - The data strip and panel column become detail you call up.
  - review-2 B1 had named exactly this weakness in Full mode: "two equal views, a long side panel and a data strip compete".
- **visual-design, figure and ground / grouping:**
  - Negative space and grouping set the reading pace (5642 · U4 · L49 · 02:06–06:43).
  - Three clusters remain: views, legend + strip, and the optional panel column. Spacing separates them, not borders.
- **visual-design, hardest application:**
  - Build for the most constrained real use (5642 · U7 · L96 · 01:48–02:32).
  - Checked at 1101 × 760, at 1280 × 800 with both areas open, and on the 1024 and 375 fallbacks.
  - The narrow sphere column was checked with its card open.
- **color-theory, value plan:**
  - Colour contrast follows the value plan, and the focal point carries the strongest value contrast (1140 · U3 · L08 · 06:31–09:58; T1: 1140 · U3 · L08 · 03:34–05:03).
  - The layout changes only area and grouping; no scene colour changed. T1 and T5 were re-run after the change, as the checklist asks.
  - The T1 override in `measurement.md` applies: "the focal element is large … judge by eye instead".
- **ux, write for the whole task:**
  - Say what is happening, what is available and what comes next (798 · U2 · L05 · 09:05–11:31).
  - The toggles name their content ("Số liệu", "Bảng điều khiển") rather than an icon, and the tips say what opens and what stays visible when closed.
  - The compact strip keeps φ next to the pole altitude, so the key equality is still seen, not stated (ux-brief §2).
- **ux, accessibility of words:**
  - Clear labels and order (798 · U4 · L13 · 04:28–08:09).
  - The DOM order is unchanged (views → legend → data → panels), so the reading order is still horizon → numbers → controls.
- **frontend, native semantics and synchronised state:**
  - Buttons for actions; ARIA only for state that HTML cannot express. Disclosure state must stay in sync with what is shown ([book:whatwg-html]; [book:wai-aria-apg], "WAI-ARIA Roles, States, and Properties").
  - The focus UAT asserts `aria-expanded` before and after each toggle, for both mouse and keyboard (Enter).
- **frontend, render and fix:**
  - Code validity cannot establish visual fit ([src:platform-apps/report.md], "Rule B").
  - The renders found the wide hello covering the Polaris chip and the sphere view. That was fixed in `a168ae4`.

## Measurements

The controlled pair (`pair.mjs` in the scratchpad) used these settings for every capture:
- both builds served and captured in the same run, at 1440 × 900 and DPR 1;
- `prefers-reduced-motion: reduce`, so nothing autoplays (paused);
- Hà Nội, Polaris selected (the default), the clock fixed at 2026-10-05T13:00Z, so the LST is 21h 00m 17s in every frame;
- Full mode, with the hello pre-dismissed.

The **focal box is the horizon card's bounding rect** in each build. Scripts used:
- color-theory `checks.py value` (T1) and `chroma` (T5);
- visual-design `checks.py balance`.

The "before" build is `22ee749` (current `main` of this stream).

| Check | Before (focus box 16, 73, 854, 747) | After, default (16, 73, 990, 802) | After, both areas open (16, 73, 729, 678) |
|---|---|---|---|
| Horizon card share of the frame | 43,6 % | **54,8 %** | 33,3 % |
| Share of all value edges inside the card | 40,4 % | **47,7 %** | 31,2 % |
| **T1** ratio (needs ≥ 2×) | 0,93× FAIL | **0,87× FAIL** | 0,94× FAIL |
| T1 ceiling (1 / area share) | 2,30× | 1,82× | 3,00× |
| T1, pole region (150 × 150 px around Thiên cực Bắc) | 2,40× PASS | 2,26× PASS | — |
| **T5** chroma, card mean C against the outermost ring | 0,021 vs 0,010, PASS | 0,021 vs 0,012, PASS | 0,021 vs 0,009, PASS |
| visual-design balance, centroid distance / diagonal | 0,0219 | **0,0072** | 0,0106 |

T1 does not separate "a dominant view" from "a quiet view". Where the value edges sit, by region:

| Region | Before: area / edges / density | After: area / edges / density |
|---|---|---|
| Horizon card | 43,6 % / 40,4 % / 0,93× | 54,8 % / 47,7 % / 0,87× |
| Sphere card | 29,0 % / 28,6 % / 0,98× | 23,7 % / 30,1 % / **1,27×** |
| Top bar | 6,9 % / 10,9 % / 1,58× | 6,9 % / 11,2 % / 1,63× |
| Below the views (legend, data bar, panels) | 17,0 % / 20,0 % / 1,18× | 10,9 % / 10,7 % / 0,99× |

**Honest reading:**

1. **The layout did what the owner asked.**
   - The horizon card grew from 43,6 % to 54,8 % of the frame.
   - Its share of the frame's value edges rose from 40,4 % to 47,7 %.
   - The clutter below the views halved: 20,0 % of the edges down to 10,7 %.
   - The visual-weight centroid moved three times closer to the frame centre (0,022 → 0,007 of the diagonal). This is measured, but not judged.
2. **T1 still fails, and the ratio went down (0,93× → 0,87×).**
   - Area grew faster than edges. The ratio is edge share divided by area share, and enlarging a box that is already near half the frame raises the denominator more than the numerator.
   - Once the box covers 50 % or more, 2× is mathematically impossible: at 54,8 % the ceiling is 1,82×.
   - At the old 43,6 %, 2× needed 87 % of all edges inside the card.
3. **The sphere view now carries the densest scene edges (1,27×).** The same star field and labels are drawn into a narrower column. The top bar (1,63×) is the densest region of all, from text and button outlines.
   - Making the horizon "win" T1 would need its own canvas to hold more value structure per pixel; the dark sky and ground disc are smooth by design.
   - Alternatively, the rest of the screen would have to go blank, which is the gaming the brief forbids. The sphere view, the numbers and the top bar carry real content.
4. **Inside the horizon card the focal point still passes.** The pole region holds 2,26× its area share (2,40× before). The box is the same 150 × 150 px, centred on the pole in each build. I did not isolate the cause of the small drop.
5. **Verdict:**
   - T1 for "the horizon card" should be judged by eye, as the checklist's own override says for a large focal element.
   - The measurable focal point, the pole and Polaris, passes.

**Not judged:**
- The vision checks were not judged by a fresh-context reviewer: dominance, path, whether the compact strip reads as "numbers live here", and whether the hello band reads as transient.
- The renders for that review are `shots/focus-1440.png`, `shots/focus-expanded-1440.png` and `shots/focus-1280.png`.

## Acceptance checks

Run against dev `:5203` (via a scratch config with `server.fs.allow`, for the KaTeX fonts) and preview `:4203`, both with `?quality=fixed`.

| UAT | Result |
|---|---|
| `redesign-2/uat/focus.mjs` (new) | 34/34 |
| `redesign-2/uat/modes.mjs` | 37/37 |
| `redesign-2/uat/guide.mjs` | 86/86 |
| `redesign-2/uat/codex.mjs` | 44/44 |
| `redesign-2/uat/below-horizon.mjs` | 30/30 |
| `redesign/uat/smoke.mjs` | PASS |
| `redesign/uat/ui.mjs` | 25/25 |
| `redesign/uat/ux.mjs` | 37/37 |
| `redesign/uat/highlight.mjs` | 25/25 |
| `redesign/uat/declutter.mjs` | 21/21 |
| `redesign/uat/perf.mjs` | PASS: (a) playback adds 0 line geometries and 0 buffers; (b) the hidden phone view makes 0 draws; (c) the hidden tab makes 0 draws; (d) adaptive quality is informational (SwiftShader drops a level after 37,8 s) |
| `redesign/uat/bundle-size.mjs` | PASS: entry 82,56 kB gzip |

`npm test`: 170 tests in 21 files. `npm run build`: passes.

### Assertions changed in existing UATs, and why

A shared helper, `docs/redesign-2/uat/focus-helpers.mjs` (`expandFocus`, `showPanel`), opens the data bar or a panel first. At widths where the toggles are hidden it does nothing.

| File | Change | Why |
|---|---|---|
| `ux.mjs` | "horizon view left and dominant (about 3:2)" (ratio 1,3–1,7) → "(focus layout: at least 2× the sphere width)" (ratio ≥ 2) | The focus layout is the owner's new decision: 2,3× at 1440 |
| `ux.mjs` | "(i) selecting another object opens the card as a third column" (3 grid columns) → "opens the card under the sphere view (still two columns)", which also checks that the card lies inside the sphere column, below the sphere | The card now stacks under the sphere instead of taking width from the horizon view |
| `ux.mjs` | Opens the data bar and panels before the caption, slider, display-group and star-input steps | Those controls start collapsed. Without the change the steps time out, or pass vacuously on hidden text |
| `highlight.mjs` | The pole hover still runs on the **compact** strip. The data bar is expanded before the equator-angle hover. `showPanel('stars')` replaces scrolling to the stars panel | The incl cell exists only in the expanded bar. The panels are now tabbed |
| `ui.mjs` | Opens Vị trí before "Esc in the latitude input keeps the selection", and Hiển thị before "Space on a focused `<summary>`" | Otherwise focus never reaches the hidden input or summary, and the checks fail or test nothing |
| `guide.mjs` | Opens Hiển thị before explain mode, switches to Vị trí before the Esc-while-typing step, and **adds** a hover check for the "Bảng điều khiển" toggle tip | Same reason. The new check covers the new control |
| `below-horizon.mjs` | "Full 1440: tool buttons icon-only" → "every tool keeps its accessible name and tooltip; the **sphere** column's tools are icon-only" | The wider horizon view (> 860 px container) shows text labels on its tools again. The zenith-overlap check that guarded fix-2 #1 still passes |

## Known limits and follow-ups

- **φ and the pole altitude appear twice in the default view:** in the horizon footer key line and in the compact strip, about 80 px apart.
  - The brief requires the strip to keep them.
  - The owner may prefer the strip to show only LST and the selected object, leaving the key line alone.
- **The narrow sphere column wraps its subtitle to two lines when the panels are open,** so its canvas starts about 17 px lower than the horizon canvas.
- **Both areas open at 1280 × 800 shrink the horizon view to 622 × 491.** It is still 2,2× the sphere card, but the expanded data bar (two rows of captions) is tall.
- **At 1440 with the Ôn tập drawer and the panels both open** (drawer margin 420 px), the views get narrow. Both are user choices; nothing overflows.
- **The data bar and panels are hidden by default in Full mode.** A first-time Full user has to find "Bảng điều khiển". The toggle has a tip in explain mode, and the help text mentions it. A usability test with club members would show whether that is enough.
