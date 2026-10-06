# Design review round 1 (2026-10-04)

The reviewer was a fresh-context agent that saw only the six renders in `review-1/`, not the brief or the code. The questions came from the review checklists of the ux, visual-design and color-theory skills. Code checks were run separately.

## Measured (skill scripts)

| Check | Result |
|---|---|
| color-theory T1, value focal on `01` (focal box = horizon view) | **FAIL**. The focal area holds 0.76× its area share of value-edge energy; the default requires ≥ 2×. |
| color-theory T5, chroma focal | **PASS**. Focal mean C 0.034; outermost ring 0.008. |
| visual-design balance (01, 02, 06) | Measured. Centroid offset 0.014 / 0.017 / 0.031 of the diagonal. The verdict comes from the vision review. |
| render-kit | **Skipped**: not installed in this container. |

## Vision-judged (fresh reviewer)

| Question | Verdict | Finding |
|---|---|---|
| A1 message and audience | yes | Read as a celestial-coordinates teaching app for Vietnamese students. |
| A2 first idea | yes, partly | "Same sky two ways" comes across. "Pole altitude = latitude" is only implied; its callout is below the fold. |
| B1–B3 focal and path | **no** | No single dominant area. The eye path ends on the orange "Tạm dừng" button, not on the insight. |
| B4 phone first view | **no** | The toast covers the top third of the view, and there is no app title. |
| C1 grouping | yes | Cards and gaps group well. |
| C2 crowding | **no** | Label clusters at the pole, in Orion and at the sphere bottom. The LST label wraps. |
| D1 type levels | yes, compressed | Most text is 10–15 px; key values are about 14 px. |
| D2 collisions and clipping | **no** | Many label overlaps; labels clipped at view edges; the caption overlaps the scene; the info card is cut off with no sign it scrolls. |
| E1 next step | yes (gestures only) | The "Ôn tập" icon on the phone is nearly invisible. |
| E2 captions | mixed | Number captions help. The "Để ý: …" toggle hints read as lecturing. |
| E3 pushy | **no** (mildly) | The toast duplicates the view caption and persists into presentation mode. |
| E4 group teasers | yes | |
| F1 highlight visible | yes | |
| F2 link obvious | **no** | The label is far from the number. Blue on blue on green. No angle arc is drawn. The sphere view does not change. |
| F3 not colour-only | yes | |
| G1 accent discipline | **no** | Orange also appears on static headings, the LST value, the kicker and title bars. |
| G2 colour confusion | **no** | Orion's amber figure reads as the same family as the yellow equator and the brand orange. |
| G3 contrast | **no** | Grey star names and about 10 px captions are low contrast. |
| H1 projector, 10 m | **no** | Scene labels are unreadable; thin lines disappear; the numbers strip is hidden; the toast remains. |

## Fix round 1 (dispositions)

All of the above are fixed in round 1 except those marked deferred. Results go in `review-2.md` after a new fresh-context review and a re-measure.

| Finding | Commit | What changed |
|---|---|---|
| D2, C2 | 3b1a831 | Screen-space label declutter by priority; edge band hide/nudge (`docs/redesign/uat/declutter.mjs`, 6d3e0c5) |
| D2 caption, B1–B4, E1, E3, A2 | 5f3189f | Toast removed; one hint caption under the horizon canvas; key line φ = pole altitude in the view card; quiet "Tạm dừng"; info-card scroll fade; phone title, labelled "Ôn tập", taller view |
| G1, G2, G3, D1 | 9eff9da | Orange only on interactive things; Orion indigo; captions 12 px `--muted`; key values 17 px |
| E2, C2 (LST) | a5d71c0 | One-line toggle hints without "Để ý:"; "Giờ thiên văn (LST)" |
| H1 (K7) | a597273 | Presentation: lines ×2, scene labels ×1,8, large key strip, hint hidden |
| F2 | 66a4404 | Pole-altitude sector and arc larger and more opaque; chip labels next to the arc; sphere φ arc and equator join the highlight |
| T1 value focal | c40ee44 | Horizon view framed tighter; sphere starfield dimmed. Re-measure: 0.81x (was 0.76x), still below the 2x default |

Renders for the next review are in `review-2/` (made with `docs/redesign/uat/review-shots.mjs`). Vision checks: not judged, awaiting a fresh reviewer.
