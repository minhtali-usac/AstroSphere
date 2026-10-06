# Đặc tả thiết kế lại — AstroSphere

Run `redesign-2026-10-04`. Sources: `grounded.md`, `goal.md`, and the approved plan.

## Ai dùng và dùng ở đâu (requester answers, 2026-10-04)

- **Two settings.**
  - Students alone on a phone: the story is designed phone-first, as a single column.
  - Club presenters projecting in a session: free exploration is designed desktop/projector-first, with large views and readable labels.
- **First visit.** A hero screen offers two choices, "Bắt đầu hành trình" (guided story) and "Khám phá tự do" (free exploration). Returning visitors skip straight to exploration.
- **Club identity.** This is a standalone tool with a club signature: the logo, the slogan "khoa học cho mọi người", and exactly one link back to https://web-usac.vercel.app/.
- **Low-end machines.** Quality drops automatically when frames are slow. A short notice appears, with a button to restore full quality.

## Hệ thống thị giác (tokens)

- **Brand.** Orange `#F26522` is the only UI accent, on near-black and white, with Arial (no web font).
- **Scene colours are unchanged.** The 3D scene keeps its meaning-carrying colours (equator yellow, axis blue, three zone colours).

| Token | Value | Use / contrast |
|---|---|---|
| `--accent` | `#F26522` | Primary buttons, tab underline, focus. 6.28:1 on `--bg` |
| `--accent-hi` | `#FF8A4C` | Hover, links on dark |
| `--on-accent` | `#0a0a0a` | Text on orange. White on orange is only 3.15:1, so it is forbidden |
| `--bg` / `--surface` / `-2` / `-3` | `#0a0a0a` / `#141414` / `#1c1c1c` / `#242424` | |
| `--border` / `--border-control` | `#2e2e2e` / `#707070` | Separators / control outlines (≥ 3:1) |
| `--text` / `--muted` / `--subtle` | `#f2f2f2` / `#b3b3b3` / `#8c8c8c` | Smallest allowed: 4.62:1 |
| `--focus` | 2px `--bg` ring inside a 4px `--accent-hi` ring | Not yellow, because yellow means the equator |
| radius / spacing / tap | 6·10·16·999 / 4–32 / 44px | |

## Bố cục

- **Phone (≤ 900 px)**
  - Top bar shows icons only.
  - Tabs switch between the two views, and panels are tabbed and collapsible.
  - In story mode (`body.story-open`) the panels, data bar and legend are hidden. The step card is a bottom sheet (≤ 46dvh, collapsible), and the view fills the remaining height (`--sheet-h`).
- **Desktop**
  - Two views side by side, four panels below.
  - The story opens as a right-side drawer, like "Ôn tập". Only one drawer can be open at a time.
- **Projector (≥ 1600 px):** base text 15 px and larger data figures.
- **Top bar:** Câu chuyện · Ôn tập · Đặt lại · Trợ giúp · Giới thiệu.
- **Footer:** club signature, slogan, email, and the single club link.

## Màn hình mở đầu (hero) — RÚT LẠI 2026-10-04

> Withdrawn by owner decision 2026-10-04 (removed in `3227a26`). Storytelling now lives in the UX itself; see `ux-brief.md`. Kept below for the record.

- **Content:**
  - Logo, the kicker "CLB Thiên văn USAC", a headline, and a one-line lead.
  - Primary button "Bắt đầu hành trình", with the subline "3 chương ngắn · khoảng 10 phút".
  - Secondary button "Khám phá tự do".
  - The slogan.
- **Behaviour:**
  - The background is a static CSS starfield.
  - It is a dialog: focus lands on the primary button, and Esc means "explore freely".
  - `?intro=1` forces the hero; `?explore=1` skips it.
  - Choosing either option sets `astrosphere.seen.v1`.

## Kịch bản câu chuyện — RÚT LẠI 2026-10-04

> Withdrawn with the hero (`3227a26`). Its plain-language explanations were reused as inline captions (`ux-brief.md` §4).

Each step sets up the simulator, says what to notice, and shows live readouts. Some steps add "Thử" chips that change the setup.

### Chương 1 — Vì sao bầu trời quay?

1. **A night in Hà Nội.** Horizon view. Polaris (HIP 11767) sits low in the North, about 21° up, while Orion is high in the South.
2. **The sky turns.** Long trails. Every star circles one point near Polaris, rising in the East and setting in the West. One turn takes 23h 56m 04s.
3. **It is really the Earth turning.** Sphere view with the pole axis, celestial equator and horizon. The Earth spins west to east, so the sky appears to turn east to west.
4. **Pole altitude equals latitude.** `poleAltitude` is on. The celestial north pole is 21.03° up, which is exactly φ.
5. **Try another latitude.** Chips: Hà Nội, TP.HCM, 0°, 90°, Sydney.
6. **Quiz.** At Huế (φ ≈ 16.5° N), how high is the pole? Answer: 16.5°.

### Chương 2 — Hai hệ tọa độ

1. **Azimuth A and altitude h.** Betelgeuse (HIP 27989) with the vertical circle and the alt-az grid.
2. **Right ascension α and declination δ.** The equatorial grid and the 0h hour circle.
3. **While the sky turns.** Both grids on with live readouts: α and δ stay fixed while A, h and H change.
4. **H = LST − α.** The meridian is on. Chips: −2h, +2h, "move to the meridian". When H = 0 the star is at its highest.
5. **Same star, different place.** α and δ stay the same; A and h change.
6. **Quiz.** Which value stays the same as the sky turns? Answer: δ.

### Chương 3 — Mọc – lặn và sao cận cực

1. **Three zones.** Purple: never sets (δ > 68.97° at Hà Nội). Teal: rises and sets. Red: never rises.
2. **Seen from the ground.** Underside view with trails.
3. **At the equator.** No circumpolar stars; every star is up for 12 sidereal hours.
4. **At the North Pole.** Every star with δ > 0 is always up.
5. **The Southern Cross from Việt Nam.** Gacrux (HIP 61084) with chips TP.HCM, Hà Nội, Sydney. From Sydney it never sets.
6. **Wrap-up and quiz.** At φ = 40°, a star with δ = +60° is circumpolar. Then three next steps: "Ôn tập 12 nhiệm vụ", "Tự khám phá tiếp", "Xem lại".

### Áp dụng một bước

- **Order:** pause → location → constellations → toggles (base + preset) → LST → selected star → trails (then reset them) → view → motion.
- **Reduced motion:** advance by a fixed angle and draw static trails instead of autoplaying.
- **Exit:** leaving the story restores the snapshot taken when it opened. "Tự khám phá tiếp" keeps the current scene.

## Hiệu năng (xem `perf.md`)

- **Code splitting:** three.js and the scene load through `import('./scene/boot')`.
- **Lazy data:** land outlines and the 88 constellation figures load on demand.
- **No wasted rendering:** a hidden, off-screen or background view does not render, and playback creates no new line geometry.
- **DOM updates:** throttled to about 12.5 Hz, and only cells whose value changed are written.
- **Adaptive quality:**
  - Level 1: pixel ratio 1.
  - Level 2: only stars brighter than magnitude 4.0.

## Phản biện (persona) — objections and how each is handled

> Note 2026-10-04: rows marked "Fixed (U2)" referred to the guided story, which was withdrawn. Their intent now maps to the UX pass:
> - K1 (clicker keys): withdrawn with the story.
> - K2 (projector layout): presentation mode.
> - K4 and K5 (deep link, resume): withdrawn.
> - K9 (speed): the opening sky turns at 60 s per sidereal day.
> - K10 (quiet notice): kept.
> - L1–L10: their explanations live on as inline captions; L10 is superseded by the owner's English-names decision (G10).
> - K3 (offline) stays deferred in `TODO.md`.
> - K7 (thicker projector lines) was done in `a597273`.

| # | Persona | Objection | Severity | Disposition |
|---|---|---|---|---|
| K1 | Presenter | The clicker's PageDown/PageUp keys and the arrow keys don't move between steps | blocker | **Fixed (U1/U2):** while the story is open, PageDown, →, Enter go to the next step and PageUp, ← go back. Space still plays/pauses |
| K2 | Presenter | The right-hand drawer halves the 3D view on the projector | blocker | **Fixed (U2):** on desktop the story becomes a compact card docked at the bottom of the views (collapsible). Views keep their full width; there is no side drawer |
| K3 | Presenter | Nothing works offline when the venue Wi-Fi is down | blocker | **Deferred → TODO:** a service worker with precaching is a separate feature, and stale caches are a real risk on GitHub Pages. Mitigation now: after one visit the browser's HTTP cache covers the hashed assets |
| K4 | Presenter | No deep link to a chapter or step | major | **Fixed (U2):** `?story=2.4` plus a chapter/step switcher in the card |
| K5 | Presenter | After leaving the story there is no way back to the same step | major | **Fixed (U2):** progress is saved; reopening resumes, and a "Tiếp tục…" chip appears (see L1) |
| K6 | Presenter | 15 px text and `--subtle` fade on a projector | major | **Fixed (U1):** presentation mode raises base text to 20 px and uses `--muted` instead of `--subtle` for text |
| K7 | Presenter | 1 px lines and grids disappear on the projector | major | **Deferred → TODO:** line widths live in `scene/` (P1's stream). Do it after the merge via `View.setLineScale` |
| K8 | Presenter | No fullscreen or presentation mode | major | **Fixed (U1):** "Trình chiếu" button plus the F key. `body.present` hides the panels, data bar and footer, and requests fullscreen |
| K9 | Presenter | Steps animate too fast to narrate | minor | **Fixed (U2):** the story's default speed is 40 s per sidereal day; Space pauses |
| K10 | Presenter | The hero is unreachable on a club laptop; the quality notice is intrusive | minor | **Fixed:** "Xem màn hình mở đầu" is added to the Giới thiệu dialog (U1 calls `story.showHero()`), and the quality notice is a quiet corner chip (U1) |
| L1 | Student | Coming back from the Zalo link loses her progress | blocker | **Fixed within the requester's decision (U2):** returning visitors still skip the hero (decided 2026-10-04), but if the story is unfinished a "Tiếp tục chương X · bước Y" chip appears in exploration |
| L2 | Student | `H = LST − α` arrives without explaining LST | blocker | **Fixed (U2):** a new step, "Giờ thiên văn LST", comes before the step about H |
| L3 | Student | The Chương 2 quiz expects δ when both α and δ are fixed | major | **Fixed (U2):** the options become [A, h, cả α và δ, H] and the correct answer is "cả α và δ" |
| L4 | Student | Too many symbols too fast; H appears before it is explained | major | **Fixed (U2):** each symbol gets a one-line everyday meaning, and H only appears in readouts from the H step onwards |
| L5 | Student | The bottom sheet hides Polaris, which sits low in the sky | major | **Fixed (U2):** on a phone the views take the remaining height above `--sheet-h` (no overlap), the sheet opens compact (≤ 38dvh) and collapses while the animation runs |
| L6 | Student | No sense of how heavy it is on 4G; a blank canvas while it loads | major | **Fixed:** three.js starts loading as soon as the page opens, during the hero (wave 0), and a loading message replaces the blank canvas. The hero shows no byte count (it would go stale) |
| L7 | Student | 18 steps with no progress shown | major | **Fixed (U2):** "Chương 2 · 3/6" with dots. Chương 2's "same star, different place" step folds into a chip on the "while the sky turns" step |
| L8 | Student | The rule 90° − φ is never stated | major | **Fixed (U2 copy):** step 3.1 states the limit 90° − φ, and steps 3.3 and 3.4 reuse it |
| L9 | Student | "23h 56m 04s" and "underside" have no explanation | minor | **Fixed (U2 copy):** a one-line reason for the shorter sidereal day; the underside view is called "nhìn xuyên xuống dưới chân trời" |
| L10 | Student | Foreign star names, HIP numbers, chips labelled "0°"/"90°" | minor | **Fixed (U2):** Vietnamese names first (Sao Bắc Cực, Tham Tú/Betelgeuse, Nam Thập Tự), no HIP numbers in the UI, chips "Xích đạo" / "Bắc Cực" |
