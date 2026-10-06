# Goal — 2026-10-04 — redesign-2026-10-04

**Status:** APPROVED 2026-10-04 (owner "go" on the plan); amended 2026-10-04 (below).
**Decision owner:** requester (repo owner). **Audited by:** coordinator at Close.

## Deliverable — redesigned AstroSphere on branch `claude/wonderful-lovelace-7sdyp0`

| ID | Source | Success criterion | Evidence | UAT |
|---|---|---|---|---|
| G1 | README criteria 1–7 | Existing behaviour preserved | test run | `npm test` exits 0 |
| G2 | build | Type-check and build succeed | `dist/` | `npm run build` exits 0 |
| G3 | request: brand | UI accent is the club orange; the old blue accent is gone from the UI | `src/styles.css` | `grep -ci f26522 src/styles.css` ≥ 1 and `grep -c 4f9dff src/styles.css` = 0 |
| G4 | request: storytelling | A first-time visitor sees a guided story covering the brief's 3 learning goals in order; a returning visitor lands straight in exploration | Playwright script `docs/redesign/uat/story.spec` | the script passes on a fresh context and on a context with the "seen" flag set |
| G5 | request: efficiency | Initial-load JS (gzip) is ≥ 30% smaller than baseline 258 kB, **or** (fork D6 branch B) the shortfall is reported with its cause | `docs/redesign/perf.md` before/after table | the build output's gzip numbers match the table |
| G6 | request: efficiency | No geometry allocation per frame while playing | perf note plus code | Playwright counts `LineGeometry` constructions over 120 frames of playback = 0 after warm-up |
| G7 | UX | Usable at 375×812 with no horizontal scroll; both views reachable | screenshots `docs/redesign/shots/` | Playwright: `scrollWidth <= innerWidth` at 375 px; screenshot files exist |
| G8 | TODO | Review items in scope of the redesign are marked `[x]` with a commit reference | `TODO.md` | grep for `[x]` lines cites commits that exist (`git cat-file -e`) |
| G9 | persona contest | Every persona objection has a disposition (fixed / deferred with reason) | `docs/redesign/spec.md` §Objections | every row has a non-empty disposition |

## Working pattern
- Claude Agent tool only (no external lanes in this container).
- At most 8 agents.
- The coordinator runs every UAT itself.

## Amendments

**2026-10-04, owner:** "The storytelling is too much in your face, what I meant was that sublime storytelling through UX design and not an actual story."
- G4 above is **withdrawn**. The original row stays for the record; the guided story and hero were built, then removed in `3227a26`.
- G4b replaces it.

**2026-10-04, owner:** "All celestial objects should still be in English." This adds G10.

**2026-10-04, owner:** asked whether the lessons of all relevant design skills were applied. This adds G11.

| ID | Source | Success criterion | Evidence | UAT |
|---|---|---|---|---|
| G4b | owner amendment | The story is carried by the UX itself: concept-ordered layout, a calm opening scene, contextual one-line captions, progressive disclosure and linked highlights. There is no tour, hero screen or story player. | `docs/redesign/ux-brief.md`, `uat/ux.mjs`, `uat/highlight.mjs` | `ux.mjs` and `highlight.mjs` pass. No `.hero` or `[class*=story]` element exists. `src/story/` is absent. |
| G10 | owner amendment | Stars, constellations, the Sun and the galactic centre carry international English names; the Vietnamese name appears only as a secondary line in the info card. Reference circles stay Vietnamese. | `src/data/catalog.ts`, `constellations.ts`, `uat/highlight.mjs` | The `highlight.mjs` name checks pass, and `grep "Sao Bắc Cực"` matches only the `VI_STAR_NAMES` table and tests. |
| G11 | owner amendment | Relevant design-skill rules are applied, and each skill's review loop is run: measured checks, fresh-context vision review, then fixes. | `docs/redesign/review-{1,2,3}.md` | Each review file exists, with measured and vision-judged results reported separately; skipped checks (render-kit) are reported as skipped. |

## Branch resolutions (before dispatch)

Owner "go" on 2026-10-04. The owner accepted the defaults: D1 `TODO.md`; D2 fix overlapping review items; D3 brand direction; D4 system/Arial font; D5 report the shortfall honestly; D6 no board; D7 commit on the branch.
