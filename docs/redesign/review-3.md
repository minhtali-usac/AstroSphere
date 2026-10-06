# Design review round 3 (2026-10-05)

A new fresh-context reviewer looked at the renders in `review-3/` using the same questions as rounds 1 and 2.

## Measured

| Check | R1 | R2 | R3 |
|---|---|---|---|
| color-theory T1 value focal | 0.76× | 0.81× | **0.93× FAIL** (default ≥ 2×). The focal box is now 43.6 % of the frame, so 2× would need 87 % of all edges inside it |
| color-theory T5 chroma focal | PASS | PASS | PASS |
| Azimuth label contrast (cyan) | — | — | 13.73:1 on sky, 5.38:1 on ground |
| render-kit | skipped | skipped | skipped (not installed) |

## Vision-judged (R1 → R2 → R3)

| Question | R1 | R2 | R3 |
|---|---|---|---|
| A2 first idea understood | partly | partly | **yes**: "pole altitude = latitude" read from the formula line |
| B1/B3 path ends sensibly | no | no | **yes, mostly**: ends on the formula |
| B2 one clean focus | no | no | no: the left view dominates, but inside it the green disc outweighs the pole/axis/h |
| B4 phone first screen | no | yes* | partly: empty sky above the dome and an empty Polaris card |
| D2 collisions | no | no | no (less): labels cross lines and rings; the selected value breaks mid-expression; phone icon buttons are about 30 px |
| E3 pushy | no | yes (not pushy) | **not pushy** |
| F2 link obvious | no | partly | mostly yes: the underline colour does not match the wedge |
| G1 accent discipline | no | yes | **yes** |
| G2 colour confusion | no | minor | **no clash** |
| H1 projector | no | no | partly: thin lines and grey star names are marginal |

## Fix round 3

Scope: phone header buttons ≥ 44 px (an AGENTS.md requirement); labels clear of lines and rings; disc weight; the phone first screen; non-breaking selected value; underline colour matching the emphasised geometry; placeholders styled as placeholders. Results are recorded below once done.

## Fix round 3 results (2026-10-05)

Renders after the fixes are in `review-4/` (same six states, `review-shots.mjs`). They were checked only by the agent that made the fixes. That is a self-review, not the fresh-context vision check, so every vision question below stays **not judged** until a new reviewer looks at `review-4/`.

| Item | Status | Commit | What changed |
|---|---|---|---|
| D2 phone header buttons ≥ 44 px | fixed | `e9253a0` | The hit box already measured 44 × 44 px; the buttons now draw a hairline border at that size so it can be seen. `ui.mjs` measures every visible `.topbar` button at 375 × 812 and 768 × 1024 |
| D2 / I1.1 labels clear of lines and rings | fixed | `2d7632f` | Every scene label has the dark pill of the "A = …" label. The cardinal letters B/N/Đ/T keep their places first. The emphasis label slides along its own arc instead of covering a cardinal. "Polaris" starts outside the selection ring. An 8 px keep-out pad around the emphasis and selected labels clears nearby star names. `declutter.mjs` checks that the four cardinals, the emphasis label and Polaris stay visible while the pole is emphasised |
| B2 green disc outweighs the lesson | partly fixed: the fill is quieter, but T1 still fails and the disc shares the axis's value level | `0a8327e` | Ground `#1f5e2a` → `#37593b` (OKLCH C 0.105 → 0.063, same hue). Opacity 0.92 → 0.55. Tick marks 0.45 → 0.32. The rim line and legend swatch are unchanged. Axis width 2.4 → 3 px |
| B4 phone first screen | fixed | `aa58139` | The phone views are shorter (`clamp(360px, 100vw + 80px, 70svh)`). The view tools float over the empty top corner. The horizon view keeps a 46° horizontal field in portrait. The collapsed card is one 46 px row: name, A and h; tap to expand. The key line sits at y 535–554 (was 649–667). `ux.mjs` checks these three things |
| D2 selected value breaks mid-expression | fixed | `b869a97` | The value is two lines, "α …, δ …" and "A …, h …", with U+00A0 inside each pair. `ux.mjs` counts exactly two line boxes at 1440 and 375 |
| F2 underline colour ≠ wedge | fixed | `e01c212` | The underline takes the emphasised figure's scene colour from `COLORS` through `--link-color`; bold weight stays as the non-colour cue |
| G3 placeholders read as values | fixed | `080fd46` | `::placeholder` is italic and uses `--subtle` (5.89:1 on `--bg`) |
| D1 "Thiên cầu" title looks disabled | fixed | `07bb026` | The title uses `--text` and the same weight, one size step smaller (14 vs 15 px; 16 vs 17; 18 vs 20 when presenting) |

### Value check (color-theory `checks.py value`, 1440 first visit)

| Focal box | R3 (`review-3/01`) | R4 (`review-4/01`) |
|---|---|---|
| Horizon view card `16,73,854,747` (43.6 % of the frame) | 0.93× FAIL, focal mean L 0.237 | **0.93× FAIL**, focal mean L 0.215 |
| Pole, axis and h/A arcs `330,280,620,520` (5.4 %) | 1.42× FAIL | **1.37× FAIL** |
| T5 chroma, pole box | PASS (C 0.070, mostly the green disc) | PASS (C 0.037) |

The fill change did not move value-edge energy, because the disc was a flat fill and its edge is the unchanged bright rim. The ground got lighter in weight, but only partly. Mean L in the card fell from 0.237 to 0.215, and OKLCH chroma in the pole box fell from 0.070 to 0.037. In the 4-level image, though, the disc still lands on the same mid-grey level as the blue axis. So in value terms the axis does not yet outrank the disc; it stands out only through hue and line width. Star positions differ between renders taken at different times, so differences of a few hundredths of an × are noise. T1 at ≥ 2× still is not met. Meeting it would need fewer competing edges outside the focal box, such as quieter stars and sphere-view lines; that is a scope decision, not part of this round.

### Underline contrast (non-text, ≥ 3:1)

On `#101010` / `#141414`:

| Underline | Contrast |
|---|---|
| Axis | 6.89 / 6.67 |
| Angle | 14.43 / 13.97 |
| Azimuth | 13.13 / 12.71 |
| Vertical | 7.18 / 6.96 |
| Meridian | 15.44 / 14.94 |
| Circumpolar | 4.49 / 4.35 |
| Rise–set | 7.64 / 7.40 |
| Never-rise | 5.06 / 4.90 |

On the tinted status pills: 3.27 (purple), 5.86 (teal), 4.01 (red).

### Acceptance

| Check | Result |
|---|---|
| `npm test` | 97 passed |
| `npm run build` | passes |
| Bundle | entry 65.70 kB gzip, PASS |
| `perf.mjs` | PASS (`lineGeometriesDelta` 0, `createBufferDelta` 0) |
| `smoke.mjs` | PASS |
| `ui.mjs` | 25 checks, PASS |
| `ux.mjs` | 37 checks, PASS |
| `declutter.mjs` | 21 checks, PASS |
| `highlight.mjs` (dev) | 25 checks, PASS |

Changed assertion: `highlight.mjs` (4) used to require an orange underline. It now requires axis blue on the pole cell, and a new check requires angle yellow on the equator-angle cell. All other checks were added; none were removed or loosened.

### Deferred

- T1 ≥ 2× value-edge share on either focal box, and the disc sitting on the same 4-level value step as the axis (see above). A darker ground would fix the second, at the cost of reading less like "ground".
- A fresh-context vision review of `review-4/`.
