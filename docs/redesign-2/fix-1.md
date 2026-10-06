# Fix round 1 (after `review-1.md`)

## UI

**Scope:** review-1 items #1, #3, #4, #7 and #8, plus E1 and E3. Branch `redesign/fixui`.
**Skills loaded:** `ux`, `visual-design`, `frontend`. Course anchors follow each skill's references. `derived` marks my own synthesis.
**Renders:** `docs/redesign-2/review-2/*.png`, made with `review-shots.mjs` against the dev server.

### What changed, and the lesson behind it

| Item | Change | Lesson applied |
|---|---|---|
| #1 Selection card (high) | **Simple, ≥ 901 px:** `main.ts › placeCard()` moves the existing card element into `.simple__dock`, an empty slot under step 3 of the panel. The card is not duplicated, and it moves back into `.views` for Full and for phones. `infocard--docked` makes it a static block with an opaque `--surface`. **Wherever the card still floats** (Full, phones): its background is opaque `--surface` with no backdrop blur, so the view tools no longer show through it. **— and ×:** the close button has an extra 8 px margin, giving 16 px between the two hit areas; on phones both are 44 px (`.icon-btn`). | The result of "click a star" now sits next to the controls that produced it, in space that was already empty. The empty block becomes a purposeful grouping (proximity) rather than leftover space (visual-design: negative space is an active shape, 5642 · U4 · L49 · 02:06–06:43; few clusters, 5642 · U4 · L53 · 06:29–07:11). The sky stays the only number one (5642 · U4 · L55 · 00:08–01:27). Moving the one DOM node keeps a single source of truth (frontend: native structure first, [book:mdn-web-docs] "Before using ARIA"; AGENTS.md: one Store). |
| #3 Phone hello (high) | **≤ 900 px:** the bottom sheet is replaced by a one-line toast `.guide-hello--toast`. It holds the avatar, "Chào bạn! Bấm vào mình để mình giải thích các nút" (`guide.helloShort`) and × (`guide.helloClose`). It is positioned in `.views` at `bottom: --foot-h + --card-h + 16px`, so it always sits above the selection chip and the φ readout. Tapping the avatar or text enters explain mode, which is what the words promise. × dismisses it. It still greets once, writes `astrosphere.guide.v1` as soon as it shows, closes on Esc or a sky tap, and returns focus to the avatar. At 375 × 812 it measures 339 × 55 px. The same toast replaces the large bubble in Simple on desktops shorter than 860 px. Before, at 1280 × 720 that bubble covered the step 3 checkboxes, a known limit in `guide.md` §11. | Build for the hardest application, a 375 px phone (5642 · U7 · L96 · 01:48–02:32). The label must let people predict what happens: tapping "Bấm vào mình…" does exactly that (798 · U4 · L12 · 10:41–14:02). Important words come first (798 · U3 · L08 · 03:42–06:38). The longer self-introduction remains in the desktop pose bubble, where there is room. |
| #4 First-action cue (medium) | `simple.cue` reads "Bấm vào một ngôi sao trên bầu trời để xem nó ở đâu và có lặn không." It is the first item in the Simple panel, before step 1, at 15 px semibold in `--text` on a `--surface-2` box. **One message at a time:** while the hello is open the cue is `display: none`, so the hello replaces the cue rather than covering it, and the panel does not gain a gap. The cue hides after the first selection that differs from the default (`sameSelection`, unit tested; "Đặt lại" does not count). It reuses `astrosphere.hint.v1`: selecting a star writes the key, and a stored key keeps the cue away on later visits. A drag alone keeps the cue visible for this visit. **One cue, not three:** the panel footer drops its "Bấm vào một ngôi sao…" line (`simple.tryStar` is removed), keeping only the pointer to «Đầy đủ». | Onboarding gives a timely next step at the moment it is useful (798 · U4 · L11 · 01:14–03:22). Instructions are content, so their position and size are design decisions (798 · U2 · L05 · 00:07–01:55). Placing the cue at the start of the reading path, before the numbered steps, follows "plan where the path begins" (5642 · U2 · L20 · 01:56–03:37). |
| #7 Overlay collisions (medium) | **Desktop Simple:** the panel has a bottom padding of `56px + --space-4`, so its last line sits above the avatar and the explain banner. While the pose hello is open, the docked card and the footer are `visibility: hidden`, so the hello replaces them without moving them. In explain mode `.view__hint` is hidden: the banner occupies that strip, and the view's own tip says the same thing. | Exact placement, not "almost clear" (5642 · U2 · L19 · 00:00–02:16). Removing a competing message is better than layering two (derived from 5642 · U4 · L55). |
| #8 Header (low) | The "Chế độ" label is visually hidden at every width but remains the radiogroup's `aria-labelledby` name. The Codex icon is an inline SVG open book (`src/ui/icons.ts`, `currentColor`); the codex agent's file `codex/triggers.ts` changes by one line. The Codex badge is neutral (`--text` background, `--bg` text). **Phone captions:** not added. At 375 px the logo, the mode switch and four 44 px buttons already fill the row, and a caption at 10–11 px would break E3. Instead, every icon-only top-bar button keeps its accessible name, which `modes.mjs` checks, and the book glyph replaces "◈". | Orange marks only actions (brand rule; color-theory owns the palette, applied here). WCAG 2.5.8 target size, and 1.4.10 reflow at 375 px ([book:wcag-22]). |
| E1 Footer link colour | Footer links and the catalogue link-button are `--text` with a grey underline. They turn accent only on hover or focus. | The brand rule: orange for interaction state, not for long text runs. |
| E3 Small text | Raised to 13 px: `.brand__org` (desktop and phone), `.view__sub`, `.view__hint`, `.view-tool`, `.simple__more` (now `--muted`, was `--subtle`), `.simple__zonekey`, and the footer lines. 375 px still has no horizontal scroll. | Minimum legible size at the real support (5642 · U7 · L96). |

### Checks

| Check | Kind | Result |
|---|---|---|
| `npm test` (154 tests, 2 new: `sameSelection`, the new keys exist) | measured | pass |
| `npm run build`; entry JS (`bundle-size.mjs`) | measured | 81.64 kB gzip ≤ 90 kB |
| `docs/redesign-2/uat/modes.mjs` | measured | 34/34 (7 new) |
| `docs/redesign-2/uat/guide.mjs` | measured | 77/77 (3 bottom-sheet checks replaced; 14 new: toast size and placement, cue, overlays over text) |
| `docs/redesign-2/uat/codex.mjs` | measured | 32/32 (dev server with a scratch `server.fs.allow` for KaTeX fonts, not committed) |
| `smoke`, `ui`, `ux`, `highlight`, `declutter` | measured | all pass (1, 25, 37, 25, 21) |
| Renders in `review-2/` and extra renders at 1280 × 720, 768 and 375 px (explain mode) | judged by the author | Looked at and fixed. The first try left a hidden-cue gap and pushed step 3 under the hello; the cue now uses `display: none` while the hello is open. |
| Fresh-context vision review | **not judged** | Left for the next review round |

### Known limits

- At 1280 × 720 the docked card for a selected star is taller than the space under step 3, so the panel scrolls. The avatar overlaps the card's lower-right corner until the panel is scrolled.
- The Full-mode wide hello still sits over the data bar at desktop width until it is dismissed. Review-1 #7 concerned Simple.
- The cue appearing after "Để sau" moves the panel down by its own height. This is deliberate: the alternative was an empty gap while the hello is open.
