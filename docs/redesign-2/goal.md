# Goal: redesign-2, 2026-10-05

**Status:** APPROVED 2026-10-05.
- The owner asked for a codex, a simple mode, a Clippy-style guide, and a merge with club `main`.
- The owner's answers on 2026-10-05 were: Simple by default; Usui-chan as the guide; the guide says one hello, then speaks only when clicked; the codex marks entries as you discover them.

**Decision owner:** the requester (repo owner). **Audited by:** the coordinator at close-out.

## Starting point

- Branch `claude/wonderful-lovelace-7sdyp0` after redesign-1 (see `docs/redesign/audit.md`). Club `main` (`09b487f`) was merged in first.
- Owner question: "does the interface look good?" The coordinator's honest answer: clean and readable, but it still reads like a lab instrument.
  - Everything is shown to everyone at once.
  - Club personality goes no further than the accent colour.
  - The four review-4 items are still open.

## Deliverable

| ID | Source | Success criterion | UAT |
|---|---|---|---|
| R1 | owner: check main | Club `main` is merged with no lost feature on either side: deep-sky objects, catalog dialog, 88 IAU names with Vietnamese in the details, the Usui-chan observer model; and our emphasis, declutter, lazy chunks and simple-mode work. | `npm test`; `npm run build`; smoke, ui, ux, highlight and perf UATs pass on the merge commit |
| R2 | owner: simple mode | A first-time visitor lands in **Simple** mode; one switch reveals **Full** mode; the choice is remembered. | `uat/modes.mjs` (details below) |
| R3 | owner: codex | A Mass Effect–style codex: categories → entries → an entry page. Entries are marked new or discovered as you meet them in the sim. Terms in the UI open their entry, and each entry can show itself in the sim. | `uat/codex.mjs`; unit tests for discovery triggers and that every link key resolves |
| R4 | owner: guide | Usui-chan says one hello on the first visit. Clicking her enters explain mode, where hovering, focusing or tapping any control shows what it does. She never pops up uninvited again. | `uat/guide.mjs`; a unit test that every `data-guide` key has a string |
| R5 | review-4 | The four open review-4 items are fixed: neutral constellation colour, phone dome height, projector legibility, label/line crossings near the pole. | the `TODO.md` items are `[x]` with commit hashes; review renders |
| R6 | AGENTS budgets | Entry JS stays ≤ 90 kB gzip (the codex content and the guide portrait load lazily); there are no per-frame allocations; 0 `LineGeometry` during playback. | `bundle-size.mjs`, `perf.mjs` |
| R7 | AGENTS a11y and i18n | Every new string is in Vietnamese and passes the banned-word test. Celestial objects stay in English. Esc order: dialog → codex → explain mode → learning drawer → selection. 44 px touch targets; no horizontal scroll at 375 px. | `npm test`; the modes, codex and guide UATs |
| R8 | design skills | Each skill's review loop is run on the result: ux, visual-design, color-theory, motion, frontend. That means measured checks, then a fresh-context vision review answering "does it look good, and does a beginner know what to do?", then fixes. | `docs/redesign-2/review-*.md` |

### `uat/modes.mjs` criteria (R2)

- A fresh context shows `body.mode-simple`.
- Simple shows:
  - the horizon view;
  - the latitude control with place chips;
  - play/pause;
  - a simplified star card;
  - the codex and guide buttons.
- Simple hides:
  - the display panel and the star panel;
  - the full data bar (only the φ = pole-altitude line stays);
  - Ôn tập and Trình chiếu.
- After switching to Full and reloading, the page is still in Full.

## Streams

| Stream | Owns | Depends on |
|---|---|---|
| M (merge) | done by the coordinator | none |
| S (simple mode) | `src/ui/mode.ts`; layout in `main.ts`; the `body.mode-*` CSS | M |
| C (codex) | `src/codex/**`, `src/i18n/codex.vi.json` (lazy), discovery hooks | M |
| P (polish, review-4) | `src/scene/**` colours and labels; presentation CSS; the phone view strip | M |
| G (guide) | `src/guide/**`, the portrait asset, `data-guide` attributes across the UI | S, C (it explains their controls) |

S, C and P run in parallel worktrees. G runs after they merge. The coordinator then runs every UAT, the design review loop and the audit.
