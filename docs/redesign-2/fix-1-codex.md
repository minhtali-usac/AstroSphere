# Fix 1: Codex (review-1 item #6 and question D1)

**Branch:** `redesign/fixcodex`. **Scope:** `src/codex/**`, `src/i18n/codex.vi.json`, the Codex section of `src/styles.css`, `docs/redesign-2/uat/codex.mjs`. **Original design:** [codex.md](codex.md). **Review:** [review-1.md](review-1.md), D1 and ranked item 6, render `review-1/06-codex-1440.png`.

## What the review found

| # | Finding | Fixed by |
|---|---|---|
| 1 | Undiscovered entries look the same as read ones: every row has a hollow circle | Three glyphs: a lock, a filled dot with "MỚI", and a check |
| 2 | The "MỚI" tag and the progress bar are orange, but orange is reserved for interactive things | Both are now neutral white/light grey. Orange stays on the selected entry and the actions |
| 3 | No imagery, so it reads as a glossary | A glyph for each of the 7 categories, and a header visual on all 44 entries |
| 4 | The right third of the entry pane is empty | On wide screens a facts column holds the visual, the key numbers or formula, the action and the related entries. At 375 px it becomes one column |

The owner constraints are unchanged:
- discovery is still "unlock as you discover";
- every entry stays readable;
- it is not pushy (no new popups, toasts or focus moves).

## What changed

### 1. Three entry states that do not depend on colour

| State | List marker | Text | Accessible text |
|---|---|---|---|
| Undiscovered | Lock glyph | Dimmed (`--subtle`, 5.7:1 on the list background) | "chưa khám phá" (visually hidden in the list; the entry page says it in full) |
| Discovered, unread | Filled white dot | Normal | A visible "MỚI" pill: white text with a grey outline, 17:1 |
| Read | Check, in grey | Normal | "đã đọc" (visually hidden) |

- Each `.cdx-item` carries `data-state="locked|new|read"`.
- The same glyph appears in the related-entry chips and on the entry page's status line, so a state looks the same wherever it appears.
- The entry page keeps the original sentence for undiscovered entries: "Chưa khám phá — bạn vẫn đọc được…".
- Code: `src/codex/glyphs.ts`, plus `entryState()` and `syncMarkers()` in `src/codex/ui.ts`. `syncMarkers` writes only when a state changes.

### 2. Orange only on interactive elements

- The progress fill is `--text-quiet` (#d9d9d9).
- The "MỚI" pill and its dot are `--text`, with a `--muted` outline.
- Orange remains on:
  - the selected entry (left bar and tint);
  - the "Xem trong mô phỏng" button;
  - hover and focus states.
- The UAT reads the computed colours of the tag, the dot and the `::before` of the progress bar, and fails if any of them is `rgb(242, 101, 34)`.
- I did not touch the top-bar Codex badge, because the chrome stream owns it.

### 3. Imagery

**Category glyphs.** Seven 16 px line glyphs in `currentColor`, used in the list and in the page kicker:

| Category | Glyph |
|---|---|
| Nền tảng | A sphere with a great circle |
| Hệ tọa độ | An angle measured up from a baseline |
| Mọc – lặn | A half-disc on a horizon with an up arrow |
| Mở rộng | A wave crossing a line (the ecliptic against the equator) |
| Sao sáng | A four-point star |
| Chòm sao | Four joined dots |
| Thiên thể sâu | A tilted galaxy |

**Header visual on every entry.** Every visual is an inline SVG built at runtime inside the lazy codex chunk.

| Kind | Entries | How it is drawn |
|---|---|---|
| Sphere view (orthographic, viewer in the south-west, back half dashed) | sphere, horizon, zenith, pole, equator, meridian, diurnal, vernal, hourAngle, lst, timeAbove | `diagrams.ts`: one small 3D helper (`eqFrame`, `camera`, `curve`) draws great and small circles from real geometry at an illustrative φ = 40° |
| Meridian-plane side view at the **live latitude** | latPole, eqAngle, transit, seasons | `side()`. The equator tilt, the culmination height and the Sun's solstice paths are computed for the simulator's φ |
| Flat α–δ map | ecliptic, sun, milkyWay | The Sun is placed at its position on the simulator's selected date (`sunEquatorial`). The Milky Way is the galactic equator from `galacticToEquatorial` |
| Scale | magnitude, starColor | Dot sizes use the same rule as the sky thumbnails. The B − V strip uses the scene's `bvToRgb`. Sirius, Vega, Polaris, Rigel and Betelgeuse are placed at their catalogue values |
| Concept | siderealDay, deepSky, zones (the existing three) | An Earth-orbit diagram with the angle exaggerated; the scene's three deep-sky ring symbols |
| Sky thumbnail from data | 7 stars, 6 constellations, M31/M42/M45, the "Chòm sao" overview (UMa, Ori, Cas) | `sky.ts`: catalogue stars with real magnitudes and B − V colours, the `TEMPLATE_FIGURES` lines, and the DSO ring drawn at its real apparent size, using a stereographic projection with north up and east left |

- Every visual has a full-sentence caption. The caption is also the SVG's accessible name (`role="img"`).
- Concept captions are written in `codex.vi.json`. Sky thumbnails generate theirs from templates in `ui.cap*`.
- Labels carry a background halo (`paint-order: stroke`), so lines never cut through the letters.

### 4. The facts column

- **Layout.** A container query on the reading pane (`@container (min-width: 760px)`) splits it into two columns: text about 65ch wide on the left, and a 260–300 px column on the right. The dialog grew from 1080 to 1200 px so that both columns fit at 1440.
- **Contents of the column, top to bottom:**
  - the header visual;
  - the facts, which vary by entry type:
    - stars: α, δ, m, B − V, the constellation (IAU and Vietnamese name) and the Vietnamese star name;
    - constellations: the IAU code, the Vietnamese name, the number of figure stars, the brightest star and the δ range;
    - deep-sky objects: α, δ, m, type, Vietnamese name, apparent size and distance;
    - the Sun: the date, α and δ;
    - concepts: a "Công thức" card instead;
  - a one-line source note, which says the numbers come from the simulator's HYG/Hipparcos catalogue;
  - "Xem trong mô phỏng", full width;
  - the related entries.
- **Narrow screens.** Below the breakpoint, including the 375 px phone, the aside uses `display: contents` and flex `order`, and becomes one column in this order: header → visual → lede and body → facts → action → related.
- **Formula card.** It is hidden on narrow screens, because the body already contains each formula where the text refers to it.
- **Content correction.** The Betelgeuse body said "B − V ≈ 1,85", but the catalogue the facts come from says 1,50. The body now gives the range and the reason (the star is variable).

## Lessons applied

### UX (`anthropic-skills:ux`)

- **Status states say where you are, why, and what comes next.**
  - The page sentence for undiscovered entries is kept.
  - The list now shows the state with a glyph and announces it as text.
  - Nothing blocks reading.
  - *798 · U4 · L11; ux principle 5 (798 · U3 · L09 · 02:40–08:48).*
- **Make access part of content design.**
  - States are not colour-only: glyph plus text.
  - Every visual has a sentence-long accessible name.
  - The "chưa khám phá" and "đã đọc" labels stay available to screen readers, without adding 41 repeated visible labels.
  - *ux principle 6 (798 · U4 · L13 · 04:28–16:09).*
- **Put important information first.** At 375 px the visual comes straight after the title and before the lede. The facts, a reference block, come after the explanation they support. *798 · U3 · L08 · 03:42–06:38.*
- **Domain conventions govern.** Star maps use the sky convention: north up, east left. The numbers use Vietnamese formatting: decimal comma, true minus sign, B/N and Đ/T. *ux principle 7.*

### Visual design (`anthropic-skills:visual-design`)

- **Design figure and ground together; negative space is active.** The empty third is now a deliberate column. The text column keeps its 65ch measure instead of stretching into the space. *5642 · U4 · L49 · 02:06–06:43.*
- **One dominant element, then subordinate ones.**
  - The title is still number one.
  - The visual in the column is number two, at the same height as the title, which balances the left text block.
  - The facts and the related entries are quieter: small uppercase labels and grey `dt` text.
  - Orange appears once per screen on an action.
  - *5642 · U4 · L55 · 00:08–01:27; 5642 · U5 · L75 · 00:06–00:58.*
- **Geometry is a vocabulary, not the concept.** The category glyphs are built from circles, lines and dots that repeat the marks of the diagrams themselves: the sphere, the angle arc, the ecliptic wave and the joined stars. The icon set and the diagrams therefore read as one family. *5642 · U6 · L81 · 01:44–02:38; unity through similarity, 5642 · U5 · L73 · 03:02–04:10.*
- **Build the system for its hardest application.** Each glyph was checked at 16 px. The 375 px phone was checked as a single column with no horizontal scroll, which the UAT measures on a star entry with facts. *5642 · U7 · L103 · 02:24–04:24.*

### Information design (`anthropic-skills:information-design`)

- **Give every mark an explicit data role.**
  - Sky thumbnails: dot area encodes magnitude, dot colour encodes B − V, sand lines are the IAU figure, and a ring is the subject, drawn at its true apparent size for deep-sky objects.
  - Diagrams: each line keeps its scene colour (axis blue, equator yellow, horizon green, ecliptic orange dashed, meridian white, zones purple, teal and red).
  - *information-design principle 4 (2495 · U4 · L11 · 01:31–04:21).*
- **Write the key for the reader, in the order marks are met.** Each caption first names the subject, then the orientation, then the encodings, then the figure lines. The source note sits under the numbers. *Principles 2 and 5 (2495 · U4 · L15 · 00:00–01:26; 4217 · U4 · L17 · 01:31–10:59).*
- **Selection is a design decision; keep it visible.**
  - The caption states that the field shows stars to the catalogue limit.
  - The note for the Sun's numbers says they are for the date selected in the simulator.
  - Where the rounded value in the body differs from the catalogue value (Sirius −1,46 against −1,44), the source note says why.
  - *Principle 2 (2495 · U2 · L05 · 02:55–04:17).*
- **Test the idea against the data.**
  - The first sphere camera (viewed from the west) showed the equator almost edge-on, so I moved the viewer to the south-west.
  - The first labels for magnitude and B − V collided where stars have similar values (Sirius and Rigel), so each star now has its own row.
  - Both problems were found by plotting the real data and reading the renders.
  - *Principle 3 (3601 · U3 · L09 · 17:37–18:45).*

## Verification (2026-10-05)

**Measured:**

| Check | Result |
|---|---|
| `npm test` | 155 tests pass. `src/codex/codex.test.ts` has 3 new tests: every entry and category has a visual or glyph; every visual renders at φ = 21, 10.8, 0, −33.9 and 89 with an accessible name and no NaN; the thumbnails and facts use catalogue data |
| `npm run build` | Passes |
| Bundle | Entry JS 81.25 kB gzip (base 81.23 kB; budget 90 kB). All the new code is in the lazy codex chunk |
| `docs/redesign-2/uat/codex.mjs` | 43/43. There are 11 new checks: `data-state` for all three states; three different glyphs; "chưa khám phá" and "mới" text; no orange on the tag, the dot or the progress bar; contrast ≥ 4.5:1 for the tag (17:1) and for dimmed entries (5.7:1); header visuals on 10 entries of every kind; real catalogue stars in the thumbnails; the facts column to the right of the text at 1440; the star facts list; one column at 375; no horizontal scroll at 375 on a star entry |
| Other UATs | See the commit message for this branch's run of smoke, ui, bundle-size, modes and guide |

**Judged:** I judged by eye the renders `shots/codex-1440.png`, `codex-1440-star.png`, `codex-375.png` and `codex-375-star.png`, and contact sheets of all 44 visuals.

**Not judged:** No fresh-context reviewer has looked at the new renders yet, so the vision checks VD-T1 to T12 and the ID T1 to T10 reader-comprehension checks are not judged. Screen-reader order was not tested with a real screen reader.
