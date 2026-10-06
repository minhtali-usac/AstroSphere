# Design review round 2 (2026-10-04)

Reviewed by a new fresh-context agent that saw neither round 1 nor the brief. It used the renders in `review-2/` and the same questions as round 1.

## Measured

| Check | Round 1 | Round 2 |
|---|---|---|
| color-theory T1 value focal (horizon card) | 0.76× (FAIL) | 0.81× (**FAIL**, default ≥ 2×) |
| color-theory T5 chroma focal | PASS | PASS (focal C 0.035 vs ring 0.007) |
| Contrast: captions / star labels / Orion | ~10 px grey, low | 8.13–8.79:1 / 13.43:1 on sky (5.26:1 on ground) / 9.99:1 |
| declutter.mjs (no label overlap > 2 px, none clipped) | n/a | PASS (17) |
| render-kit | skipped | skipped (not installed) |

## Vision-judged: change from round 1

| Question | Round 1 | Round 2 | Remaining issue |
|---|---|---|---|
| A2 first idea | partly | partly | The φ = pole-altitude sentence has the same weight as the gesture hint |
| B2/B3 one focal, path | no | **no** | The info card and the numbers strip compete; the path stalls in the info card |
| B4 phone first view | no | yes, with caveats | A collapsed info card takes space |
| C1 grouping | yes | yes | |
| C2 crowding | no | **no** (less) | The info card is dense; the "Kinh độ" caption wraps to 3 lines; card heights are uneven |
| D2 collisions | no | **no** (less) | Label-on-label overlaps are gone. Labels still sit on top of lines and textures with no halo. The info card is clipped. Spelling is inconsistent ("toạ" vs "tọa") |
| E2 captions | mixed | helpful, borderline cluttered | |
| E3 pushy | no | **yes (not pushy)** | |
| F2 link obvious | no | partly | The wedge is still thin, and the change is far from the cursor |
| G1 accent discipline | no | **yes** | |
| G2 colour confusion | no | minor | The amber "A =" label reads close to the equator yellow |
| H1 projector | no | **no** (better) | Desktop-size chrome remains (info card about 13 px, subtitles, legend); faint lines |

## Fix round 2 (dispositions)

| Finding | Commit | What changed |
|---|---|---|
| B2/B3, T1 value focal | 80dc4b7 | Info card starts collapsed to one line (desktop and phone); on desktop it opens when another object is selected or the header is clicked, and folds on clear/reset. Collapsed, the third column is given back to the views and the chip floats at the sphere view's bottom-right corner; open, it is the third column again. Data strip and panels on `--surface-quiet`; data values 16 px/600 `--text-quiet`; sphere title weight 500 `--muted`. First screen = views + legend + data strip (views `calc(100svh - 226px)`); horizon camera 37° on wide frames |
| A2, I1.3 | f06afef | φ = pole-altitude line is the headline: 20 px bold, top-left of the horizon footer. The gesture hint is always 12.5 px regular `--muted` |
| H1 | 2d1f278 | Presentation hides the info card, view subtitles and in-view buttons (C key still resets the camera); legend 20 px; thin lines ×1.6 opacity; sphere framed for its portrait canvas |
| D2 labels | c936633 | Solid dark label halo; circle names sit above their line; observer label on a dark chip; declutter gap 4 px |
| D2 clipping | 9db1dde | Status row stacked, pill nowrap; magnitude nowrap; the opened card fits at 1440×900 |
| D2 spelling | 20eedce | "tọa" everywhere (title, `<title>`, README); copy test guards it |
| G2 | a6dcbbf | Azimuth arc and label cyan `#67e8f9` (13.73:1 on sky, 5.38:1 on ground) |
| C2 | 9738fb1 | Control panels in a masonry-style multi-column (3 / 2 columns), natural heights; balanced data captions |
| (test) | f941350 | ux.mjs block (i): desktop info card collapsed → opens on selection → folds on header click and on Esc |

Re-measure (`checks.py value`, focal = horizon view card on `review-3/01-first-visit-1440.png`, box 16,73,854,747): **0.93×** (was 0.81×), still **FAIL** against the 2× default. The focal card now covers 43.6 % of the frame and holds 40.6 % of the value edges (was 27.8 % / 22.6 %); at that area a 2× ratio would need 87 % of all edges inside the card. T5 chroma focal: PASS (C 0.041 vs ring 0.010).

Renders for the next review are in `review-3/` (`OUT=docs/redesign/review-3 node docs/redesign/uat/review-shots.mjs`). The sky depends on the clock, so LST and star positions differ from `review-2/`. Vision checks: not judged, awaiting a fresh reviewer.
