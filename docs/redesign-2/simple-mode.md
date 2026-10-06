# Simple mode (redesign-2 R2, stream S): design note

**Owner decision (2026-10-05).** A first-time visitor lands in **Cơ bản** (Simple). One switch reveals **Đầy đủ** (Full, the existing interface). The choice is remembered. The aim is to let beginners play without being overwhelmed.

Skills applied: `ux`, `visual-design`, `frontend`. Course anchors follow each skill's own references. `derived` marks my own synthesis.

## 1. Brief (ux stage 1; visual-design stage 1; frontend stage 1)

- **User and task.** A Vietnamese high-school student, alone on a phone or laptop, opening the site for the first time. They should see the sky turn and understand four ideas without reading a manual:
  1. where I am;
  2. the sky turns about a pole at altitude φ;
  3. a star's position (light touch);
  4. rise and set.
- **The problem.** Full mode shows everything to everyone at once: two 3D views, a legend, an 8-cell data bar, four panels with about 40 controls, Ôn tập and Trình chiếu. (`goal.md`: "it still reads like a lab instrument".)
- **Assumption, not evidence.** No user research was run for this stream. "Beginners are overwhelmed" is the owner's judgement and is treated as an assumption to test; ux principle 3 keeps findings and assumptions apart (derived from 798 · U2 · L06 · 05:52–08:19).
- **Hardest application.** A 375 × 812 phone in portrait. Build for it first (visual-design principle 6: 5642 · U7 · L96 · 01:48–02:32).

## 2. Scope: what Simple keeps, and why (ux stage 4)

The MVP is "the smallest version that tests whether a hypothesis is valid… minimum does not mean mediocre" (1490 · U5 · L17 · 02:00–02:48, 03:34–04:59). Priorities were set with a MoSCoW pass; the result is indicative, not arithmetic (1490 · U5 · L20 · 01:57–03:59). Each kept control is tied to one of the four ideas:

| Idea | Control in Simple | MoSCoW |
|---|---|---|
| 1. where I am | Five place chips: Hà Nội, TP.HCM, Xích đạo, Bắc Cực, Sydney (Úc), the one southern place. A latitude slider with its value ("21,03° B"). | Must |
| 2. the sky turns about a pole at altitude φ | Play/pause, and Chậm \| Nhanh (60 s or 15 s per sidereal day). The existing caption "φ = … · Độ cao thiên cực … = …" stays under the view. | Must |
| 2. the pole | Toggle **Trục quay của bầu trời** (`poleAxis`, on by default) | Must |
| 3. coordinates, light touch | Toggle **Xích đạo trời** (`equator`, on by default). The star card keeps only h and A. | Should |
| 4. rise/set | Toggle **Tô màu vùng mọc – lặn**: all three zones at once, through `scenario.zones()`. A three-item key appears when it is on. | Must |
| Next step | One line: "Bấm vào một ngôi sao…". One line pointing to «Đầy đủ» for the sphere, numbers and exercises. | Should |

**Why these three toggles.** Each one makes a concept visible that the caption or card only states. The axis shows the pole that φ measures. The equator is the one coordinate circle a beginner needs. The zones answer "does this star set?" in colour, which matches the status pill on the card. I left out:
- the hour circle, meridian and grids (they serve the coordinate-systems lesson, which belongs in Full);
- the pole-altitude arc (the caption already states the equality, and Full's linked highlight shows the arc);
- the ecliptic, galactic plane, Sun and deep-sky objects ("Could"; they add marks unrelated to the four ideas).

The zones toggle drives three store toggles in one action because a beginner thinks of "which stars set" as a single question (derived from 1490 · U5 · L19 · 00:00–02:55: a job story ties a feature to the person's goal).

**Hidden in Simple (CSS only, so Full's state stays intact):**
- the celestial sphere view;
- the view-tab strip;
- the legend (the toggle swatches and the zone key carry its meaning next to the controls);
- the 8-cell data bar;
- the four panels (location, animation, display, stars);
- Ôn tập, Trình chiếu and the learning drawer;
- the info card's α/δ/H rows, the LST rise/transit/set rows, the section headings and the details block.

The `F` and `L` shortcuts do nothing in Simple. Switching to Simple also leaves presentation mode and closes the drawer.

**Kept:** Đặt lại, Trợ giúp, Giới thiệu, both horizon-view tools, the hint caption, and the info card showing the name, the Vietnamese name, A, h and the status pill (cận cực / mọc và lặn / không bao giờ mọc).

**One store, no duplicated logic.** Every Simple control calls the same `Actions` as Full (`setLocation`, `togglePlay`, `setRate`, `setToggle`). Switching modes therefore never desynchronises anything; `modes.mjs` proves it by switching back and forth. Simple's place list, `QUICK_PLACES`, sits beside `PLACES` in `src/scenario.ts`, which gained one southern place.

## 3. Words (ux stage 7)

- The group titles are questions and statements a 16-year-old would use, numbered in concept order:
  1. "1. Bạn đứng ở đâu?"
  2. "2. Bầu trời quay"
  3. "3. Hiện trên bầu trời"

  Important information goes in headings and opening words (798 · U3 · L08 · 03:42–06:38).
- The toggles use plain words: "Trục quay của bầu trời" rather than the term "Trục thiên cực". The technical term is still in the tooltip, and in the info card and Full mode. Microcopy should be "clear, concise, useful, and human" (798 · U3 · L09 · 06:25–08:48).
- The switch labels are "Cơ bản | Đầy đủ". Each option has a tooltip saying what it adds. A visible "Chế độ" label appears at ≥ 1101 px; on phones the radiogroup keeps it as its accessible name. Labels must let the person predict what a choice does (798 · U4 · L12 · 10:41–14:02).
- The bottom of the panel offers a timely next step rather than a tour: click a star, or open Đầy đủ for more (onboarding content, 798 · U4 · L11 · 01:14–03:22).
- Every string is in `vi.json` (`mode.*` and `simple.*`) and passes the banned-word test. Object names stay English: "Sydney (Úc)" is a place name and keeps a Vietnamese gloss.

## 4. Composition (visual-design stages 3–4)

- **One number one.** The horizon diagram fills the left column. On desktop it is the full first-screen height, `clamp(420px, 100svh − 100px, 900px)`, against a 320 px control column. On a phone it is `clamp(380px, 100vw + 130px, 72svh)` with no tab strip above it. "One dominant figure with subordinate elements reads more clearly than several competing focal claims" (5642 · U4 · L55 · 00:08–01:27). Removing the sphere, legend and data bar is contrast made "by removing from its surroundings" (5642 · U4 · L56 · 00:00–02:00).
- **Few clusters.** There are three groups (view, controls, top bar), and the controls hold three numbered fieldsets. "Group elements into as few clusters as possible" (5642 · U4 · L53 · 06:29–07:11). Spacing separates them; the only rule is a single hairline above the next-step note.
- **Planned path.** Dome → φ caption under it → controls 1 → 2 → 3 → next step ("plan where the path begins and ends", 5642 · U2 · L20 · 01:56–03:37). On the phone the order is the same vertically.
- **Negative space is deliberate.** On a tall desktop the control column keeps its height, matching the dome, with the next-step note pinned to its foot. The space between reads as pacing, not leftover (5642 · U4 · L49 · 02:06–06:43).
- **Consistent vocabulary.** The mode switch and Chậm \| Nhanh reuse the existing tab language: `--surface-3` fill plus an orange underline. They look like the rest of the app and do not compete with the orange primary button. The orange `--accent` marks only interactive state:
  - the selected segment underline;
  - the pressed place chip border;
  - the slider;
  - the checkboxes;
  - the paused play button, filled orange with `--on-accent` text.

## 5. Implementation (frontend)

- **Native semantics first** ([book:mdn-web-docs], "Before using ARIA").
  - The switch uses native radios (`name=ui-mode`) inside a `role="radiogroup"` with an accessible name. The browser supplies arrow-key selection.
  - The global shortcut guard already skips `[role=radiogroup]`. `modes.mjs` verifies that ArrowRight on the switch changes the mode without stepping time.
  - Chậm \| Nhanh uses the same pattern. Each group of controls is a `fieldset` with a `legend` ([book:web-accessibility-cookbook], "9.5 Group Fields in a Form").
  - Place chips are buttons with `aria-pressed`, kept in sync with the store ([book:wai-aria-apg], "WAI-ARIA Roles, States, and Properties").
  - The zones checkbox becomes `indeterminate` when Full has turned on only some of the zones.
- **State.**
  - `AppState.uiMode: 'simple' | 'full'` and `Actions.setUiMode` are immutable updates that do nothing when the value is unchanged. `mode` and `setMode` already meant the animation mode, so the new names avoid a collision.
  - `resetAll` keeps the chosen mode.
  - `src/ui/mode.ts` resolves the start mode in this order: `?mode=` override (not stored) → stored value (type-guarded through `storage.ts`) → `simple`. It writes `astrosphere.mode.v1` only when the user changes mode. `body.mode-simple` and `body.mode-full` mirror the store.
- **No drawing when hidden.** The hidden sphere view has `display: none`, so its container measures 0 × 0 and `View.frame()` returns early; this is the same path as the phone tab. Switching to Simple also selects the horizon tab and fires `resize`. `modes.mjs` counts WebGL draw calls per canvas: sphere 0, horizon > 0 while playing.
- **Targets and reflow.**
  - Below 900 px every control in the top bar and the Simple strip is at least 44 px tall. WCAG 2.5.8's 24 px is a floor ([book:wcag-22], "SC 2.5.8").
  - At 375 px there is no horizontal scroll ([book:wcag-22], "SC 1.4.10 Reflow").
  - In Full on a narrow phone (≤ 640 px) the switch moves to a light second top-bar row, so the 44 px buttons still fit.
- **Reduced motion.** Simple autoplays exactly as Full does: it is paused when `prefers-reduced-motion` is set, by the existing check in `main.ts` ([book:mdn-web-docs], "prefers-reduced-motion").
- **Budgets.** Entry JS is 24.97 kB gzip (bundle-size UAT). The Simple strip writes DOM only from store subscriptions and only when a value changes; nothing is added to `update()` or `frame()`.

## 6. Checks

| Check | Kind | Result |
|---|---|---|
| `npm test` (mode resolution: stored, default, URL override, bad stored value, blocked storage; `setUiMode` immutability; reset keeps the mode; dynamic keys) | measured | pass |
| `npm run build` | measured | pass |
| `docs/redesign-2/uat/modes.mjs` | measured | 27/27 |
| smoke, ui, ux, highlight, perf, bundle-size (now pinned to Full by an init script) | measured | all pass (see the commit report) |
| Screenshots `shots/simple-1440.png`, `shots/simple-375.png`, `shots/full-1440.png` | self-reviewed by the builder | looked at and fixed: the collapsed card covered the hint line; the Full phone switch row was too heavy |
| Fresh-context vision review (ux T6/T9, visual-design T1/T8/T9) | **not judged** | It needs a reviewer who did not build this; it is left to the coordinator's R8 review loop |
| render-kit | **skipped** | not installed in this container |
| Usability with real beginners | **not judged** | No participants. The "overwhelmed" assumption is still untested |
