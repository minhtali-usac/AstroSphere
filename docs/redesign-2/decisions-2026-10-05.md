# Owner decisions 2026-10-05: reward and polish

**Branch:** `redesign/reward`, 2026-10-05.
**Acceptance check:** `docs/redesign-2/uat/decisions.mjs` (dev server).
**Skills applied:** `ux` (task flow, interface words, recovery), `motion` (purpose, curve, choreography), `color-theory` (functional colour, OKLab ΔE, WCAG contrast) and `frontend` (native controls, accessibility, rendered verification).

How each check was done:
- **Measured:** browser checks in `decisions.mjs` and the existing UATs, unit tests, OKLab ΔE and WCAG ratios computed with the color-theory formulas.
- **Self-judged:** anything read from a render by me, the author. That is not a fresh-context review.

## 1. Quiet reward when a star is selected (review-2 A1)

**What changed:**
- When the selection changes to an object, the selection ring pulses once in both 3D views.
  - Scale 1 → 1,35 → 1 and opacity 1 → 0,5 → 1 over 300 ms.
  - The rise takes 90 ms and the settle takes 210 ms. Both are cubic ease-out, so the ring never overshoots its rest size and never bounces.
- The trigger is any change of `state.selected` to a non-null object: a click or tap, the search, a learning task, or a manual star being added. Selecting the same star again pulses again, which confirms the click.
- The first sync (the default Polaris selection when the page opens) does not pulse.
- Under `prefers-reduced-motion` the ring does not move.
- There are no popups and no sound.

**How:**
- `src/scene/selPulse.ts` is a pure amplitude function with unit tests (`selPulse.test.ts`): one peak, values stay in [0, 1], monotonic on each side, and the settle slows as it arrives.
- `SkyLayer.startSelPulse(now)` and `stepSelPulse(now)` write the sprite's scale and material opacity. There is no allocation and no new geometry.
- `View.update()` starts the pulse when the selection reference changes. `View.frame()` steps it and marks the view dirty only while it runs, just as the emphasis transition does.
- Label placement keeps using the ring's rest size, so names do not jitter during the pulse.
- **Measured:** with playback paused, the pulse rendered for about 300 ms. In the 500 ms after it, the loop rendered 0 frames, so a paused loop goes back to sleep.

**Lessons applied:**
- *Movement serves the message* (motion, 503 · U3 · L10 · 01:21–02:42). The pulse says "this one is selected" and nothing else. It is the ring that marks the selection, and nothing else in the scene moves.
- *A strong deformation or bounce makes a serious subject read as comic* (motion, 561 · U4 · L13 · 02:47–05:54). So the settle is ease-out with no overshoot, and the change is small (×1,35).
- *Ease to show acceleration and arrival* (motion, 503 · U2 · L08 · 06:22–09:12). The fast rise reads as a response to the click, and the slow settle reads as calm.
- *Honour user motion preferences* (frontend, accessibility). Under reduced motion there is no pulse, and the selection still shows through the ring and the info card.
- *Not pushy* (owner rule). The feedback is a quiet acknowledgement, not a celebration: there is no text, no counter and no sound.

**Left out:** below the horizon the horizon view draws the selection as the "ghost" marker (fix-1 #2), not the ring. The ghost does not pulse. The sphere view still pulses for such objects.

## 2. Confirm before reset (review-2 #6)

**What changed:**
- "Đặt lại" in the top bar now opens a small native modal `<dialog>` (`src/ui/resetConfirm.ts`). It is the only reset entry point: Simple mode uses the same top-bar button, and no other control calls `resetAll()`.
- **Title:** "Đặt lại mọi thứ?"
- **Body** (two lines, so the reader can scan what changes and what stays):
  - "**Sẽ đặt lại:** vị trí, thời gian, các lớp hiển thị, góc nhìn và ngôi sao đang chọn. Các sao và chòm sao bạn đã thêm sẽ bị xóa."
  - "**Vẫn giữ:** chế độ Cơ bản hay Đầy đủ, tiến độ USACodex và Ôn tập."
- **Buttons:** "Hủy" (secondary, first in reading order, focused by default) and "Đặt lại" (primary, orange, `--on-accent` text). Both are 44 px tall.
- **Closing:** "Hủy" and "Đặt lại" act synchronously in their click handlers instead of waiting for the `close` event. That event arrives in a later task, which took more than 200 ms on a busy main thread in the UAT. Esc and a click on the backdrop both cancel. Focus returns to the button that opened the dialog. The global Esc handler skips while the dialog is open, so Esc closes the dialog and does not also clear the selection.
- The strings are in `vi.json › resetConfirm`. The two buttons carry `data-guide` keys (`resetCancel`, `resetConfirm`) with tips. The `reset` tip and the button tooltip now say that the app asks first.

**The text is truthful.** I checked `Actions.resetAll()` and `resetAll()` in `main.ts`:
- **They reset:** `createInitialState()`, which covers location, time and playback, display toggles and labels, trails, user stars and figures, and the selection (back to Polaris). They also reset both cameras and first-person view.
- **They keep:** `uiMode`. The codex progress (`astrosphere.codex.v1`) and the learning progress (`thien-cau.hoc-tap.v1`) live in localStorage, and reset never touches them.

**UATs:** `docs/redesign/uat/ux.mjs` now confirms through the dialog. It also checks that "Hủy" keeps the state: playback is still running after Đặt lại → Hủy. `decisions.mjs` covers Hủy, Đặt lại, Esc and focus return.

**Lessons applied:**
- *Write for the whole task: what is happening, what action is available, what comes next* (ux, 798 · U2 · L05 · 09:05–11:31). The title asks the question, the body says exactly what will be lost and what will not, and the buttons are verbs that repeat the action rather than "OK".
- *A button label must not misstate its action* (ux anti-pattern). The primary button is "Đặt lại", the same word as the opener, so the confirmation does not introduce a second name for the action.
- *Recovery* (ux, 798 · U3 · L09). The safe choice is the default: focus starts on "Hủy", and Esc and the backdrop both cancel. A mis-tap next to the mode switch on the phone is now harmless, which was the review-2 #6 risk.
- *Prefer native semantics* (frontend). A native modal `<dialog>` gives the focus trap, the Esc cancel, `aria-modal` behaviour and an inert background for free.
- *Orange marks only what you press* (brand, review-2 E1). Only the primary action is orange.

## 3. Neutral status pill (review-2 #12)

**What changed:**
- The visibility pill in the info card ("Cận cực", "Mọc và lặn", "Không mọc") is now neutral:
  - background `--surface-3`;
  - normal text colour `--text`;
  - a 1 px `--border-control` outline.
- A 9 px dot before the word carries the zone colour (`--zone-*`, the same values as `COLORS.circumpolar`, `riseSet` and `neverRise` in `scene/colors.ts`).
- The pill text went from 12 to 13 px (item 4).
- The info card is the only place this pill appears. Simple mode's zone list already uses legend swatches.
- The three old filled `.status--*` rules were removed in place. The new rules are in the "Owner decisions 2026-10-05" section at the end of `styles.css`.

**Measured** (WCAG 2 relative luminance):

| Pair | Ratio |
|---|---|
| Text `#f2f2f2` on `#242424` | 13,9:1 |
| Circumpolar dot `#8b5cf6` on the pill | 3,7:1 |
| Rise-set dot `#14b8a6` on the pill | 6,2:1 |
| Never-rise dot `#ef4444` on the pill | 4,1:1 |

All three dots pass the 3:1 non-text minimum. The state is also named in words, so colour is never the only cue.

**Lessons applied:**
- *Colour as a sign/code* (color-theory, 5642 · U3 · L39 · 02:36–03:20). The zone colours are a code with a legend. A teal fill while the zone layer is off and its legend is hidden borrowed the code out of context. As a small dot, the colour only marks the link to the zone layer, and the word carries the meaning.
- *Fewer colours, better decisions* (color-theory, 1140 · U3 · L08 · 09:58–11:48). The info card now has no large coloured areas, so the scene's semantic colours stay the strongest colour in view.
- *Pair hue with a word and a value* (color-theory, functional colour, stateful signal policy). The word is primary, and the dot is redundant.

## 4. A 13 px floor for explanatory text outside USACodex (review-2 #5)

**What changed:** one rule in the new section of `styles.css` sets 13 px on:

| Text | Selectors | Before |
|---|---|---|
| Info-card rows | `.kv dt`, `.kv__x`, `.kv__note`, `.infocard h4`, `.infocard__kind`, `.infocard__mag`, `.infocard__vi` | 12 and 12,5 px |
| Data-bar captions | `.data__k`, `.data__n` | 12 px |
| View subtitles | `.view__sub` | already 13 px |
| Horizon readout hint | `.view__hint` | already 13 px |
| Toggle hints | `.check__hint` | 12 px |
| Panel hints | `.hint`, `.note`, `.sub__teaser`, `.field-msg`, `.field-error` | 12 and 12,5 px |
| Legend | `.legend`, `.legend-zones` | 12,5 px, and 12 px at ≤ 900 px |
| Hover tooltip | `.tooltip` | 12,5 px |
| Usui-chan's bubble | `.guide-tip__use` | 12,5 px. The bubble text itself was already 14 to 16 px. |
| Status pill | `.status` (item 3) | 12 px |

Scope and precedence:
- The rule has the same specificity as the originals and comes after them, so it also wins over their `@media` variants.
- The presentation-mode sizes (`body.present …`, 14 to 20 px) stay larger.
- Not changed: the 3D scene labels, which have their own declutter sizing, and everything inside USACodex.

**Measured** (`decisions.mjs`):
- The minimum computed font size over every text-bearing element in those containers is 13 px. That holds at 1440 × 900 and 375 × 812, in Full and in Simple, and covers 154 to 218 elements.
- Usui-chan's bubble was measured in a separate first-visit page.

**Wrapping** (line counts per element before and after, measured; there is no horizontal scroll at 375 px):
- The LST caption "dải trời đang qua kinh tuyến" now breaks into two lines, like the neighbouring "chỉ dời giờ, không đổi dáng trời" already did. The data bar grows 3 px at 1440 px and 28 px at 375 px.
- At 1440 px, two panel hints ("Bấm hoặc kéo trên bản đồ…" and the α/δ input format) gain one line each. These are paragraphs and break cleanly.
- No label, chip or button wraps.

**Lessons applied:**
- *Treat accessibility as a requirement, and render the actual artifact* (frontend, principles 4 and 6). The floor is enforced by a computed-style check across both modes and both widths, not by reading the CSS. The wrap side effects were measured and then looked at in renders.
- *Real words affect space and layout* (ux, 798 · U2 · L05 · 01:55–03:03). The longest Vietnamese captions set the cost. I checked them in place instead of assuming that 1 px is harmless.
- Contrast was not changed. These texts already use `--muted` or `--subtle` (≥ 4,6:1) or `--text`.

## 5. Neutral colour for user stars (TODO "Random and manual star colours")

**What changed:**
- Random and manually added stars now take `USER_STAR_COLOR = COLORS.figure` (`#cfbb9a`, OKLCH L 0,80 · C 0,05 · H 80°). That is the same sand tone as user-added constellation figures, so everything the user adds shares one tone.
- The nine-colour `STAR_COLORS` table is gone.
- I chose the owner's first option, one tone, over a set of several neutrals. In the neutral, light region the scene already uses `hourCircle`, `meridian`, `dsoOther`, `groundMark` and `zenith`. A second neutral that stays ≥ 0,08 from all of them and from the sand tone would need more chroma or a lower lightness, so it would no longer be neutral, or it would be dim on the night sky.

**Measured** (OKLab ΔE to the nearest semantic colour, from the color-theory skill's `checks.py oklab`):

| Old colour | Nearest semantic colour | ΔE |
|---|---|---|
| `#fb923c` | ecliptic | **0,000** |
| `#f472b6` | vertical circle | **0,000** |
| `#e2e8f0` | meridian | **0,000** |
| `#facc15` | Sun | 0,014 |
| `#60a5fa` | axis | 0,030 |
| `#22d3ee` | latitude | 0,067 |
| `#4ade80` | alt-az grid | 0,081 |
| `#f87171` | never-rise zone | 0,085 |
| `#a78bfa` | axis | 0,107 |
| **New `#cfbb9a`** | dsoOther | **0,098** |

- Contrast on the night sky: 10,6:1 (polish.md).
- Unit test `src/userStarColor.test.ts` checks ΔE ≥ 0,08 to every semantic colour in `scene/colors.ts`, and that random and manual stars both get the tone. `decisions.mjs` checks it in the browser.

**Lessons applied:**
- *Colour as a code* (color-theory, 5642 · U3 · L39 · 02:36–03:20). A pink user star read as "the vertical circle", and an orange one read as "the ecliptic". User content now stays out of the code.
- *Fewer colours, better decisions* (color-theory, 1140 · U3 · L08 · 09:58–11:48), and *a bridge by family* (1140 · U3 · L09 · 05:00–06:14). User stars and user figures are one family, so the user's own additions are recognisable as such.
- *Measure, don't eyeball* (color-theory science crosswalk). Distances are OKLab ΔE, not hue-wheel angles.

## Verification (2026-10-06)

**Commits:**

| Commit | Change |
|---|---|
| `0eaba1c` | Item 1: selection-ring pulse |
| `ad5a0ff`, `a7e0713` | Item 2: reset confirm dialog, which now acts in the click handler |
| `fc88ae5` | Item 3: neutral status pill |
| `d244f8b` | Item 4: 13 px floor |
| `4380492` | Item 5: neutral user stars |
| `51f60a6` | `decisions.mjs` hardening |

**Tests and build:**
- `npm test`: 22 files and 173 tests pass.
- `npm run build` passes.
- Entry JS is 82,38 kB gzip, within the 90 kB budget (`bundle-size.mjs`).

**UATs** (`?quality=fixed`; dev server on 5202, preview on 4202):

| UAT | Result |
|---|---|
| smoke | PASS |
| ui | 25/25 |
| ux | 38/38, including the new Hủy check |
| highlight | 25/25 |
| declutter | 21/21 |
| perf | PASS (a, b, c) |
| bundle-size | PASS |
| modes | 37/37 |
| guide | 85/85 |
| codex | 44/44 |
| below-horizon | 30/30 |
| decisions | 60/60 |

Notes on the runs:
- **codex:** this UAT was run on a dev server with a scratch config outside the repository (`server.fs.allow` including the symlinked `node_modules`). On the plain worktree server the KaTeX fonts return 403.
- **decisions:** the first run after a server restart once saw no frames for over a second while a lazy layer compiled its shaders. The check now waits for a steady loop and samples until the pulse ends.
- UAT side-effect screenshots were restored.

**Not judged:** there was no fresh-context vision review of the renders. The visual judgements in this record are mine, as the author.
