# Close-out audit (2026-10-05)

- Audited against `goal.md` rows G1–G11 (G4 withdrawn, replaced by G4b).
- Run on the merged branch `claude/wonderful-lovelace-7sdyp0`.
- Preview server on :4190 and dev server on :5190, both served from this checkout.
- Raw output was captured during the run.

| ID | Criterion | Result | Evidence |
|---|---|---|---|
| G1 | Existing behaviour preserved | **PASS** | `npm test`: 14 files, 97 tests passed (the original 33 astronomy, frame and i18n tests are included) |
| G2 | Type-check and build | **PASS** | `npm run build`: tsc and vite build succeed |
| G3 | Club orange in; old blue accent out | **PASS** | `f26522` appears 4×, `4f9dff` 0×; 0 raw colours outside `:root` |
| G4 | Guided story | **WITHDRAWN** | Owner amendment 2026-10-04; removed in `3227a26` |
| G4b | Storytelling through the UX | **PASS** | `ux.mjs` 37/37 and `highlight.mjs` 25/25; `src/story/` absent. Vision reviews: first idea understood and path ends on the formula (R3–R4) |
| G5 | Initial JS ≥ 30% smaller | **PASS** | Entry JS 257.8 → 65.7 kB gzip (−75%). JS before the first 3D frame is 228.0 kB (−12%), mostly three.js (146 kB) |
| G6 | No per-frame geometry while playing | **PASS** | `perf.mjs`: `lineGeometriesDelta` 0, `createBufferDelta` 0. A hidden view draws 0 calls, and a background tab draws 0 calls |
| G7 | Usable at 375 px | **PASS** | `ui.mjs`/`ux.mjs` assert no horizontal scroll with every panel open and 44 px top-bar buttons. Caveat: the review-4 vision check (B4) says the dome sits low on phones; see TODO |
| G8 | In-scope TODO items `[x]` with real commits | **PASS** | All 10 cited hashes exist (`git cat-file -e`) |
| G9 | Every persona objection has a disposition | **PASS** | 20/20 rows (K1–K10, L1–L10) filled; withdrawn-story rows annotated |
| G10 | Celestial objects named in English | **PASS** | `highlight.mjs` name checks pass. "Sao Bắc Cực" appears only in `VI_STAR_NAMES` and a doc comment |
| G11 | Design-skill rules applied, with review loops | **PASS (with recorded fails inside)** | `review-1..4.md`: 4 fresh-context reviews and 3 fix rounds. Measured, judged and skipped results are reported separately. render-kit was **skipped** (not installed). color-theory T1 focal value is still a **FAIL** (0.93×), kept visible and listed in TODO |

**Overall:** all active goal rows pass. One embedded skill measurement fails: color-theory T1, focal value 0.93× against a 2× default. Four design follow-ups from review 4 are open in `TODO.md`.
