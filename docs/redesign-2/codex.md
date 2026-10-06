# Codex (redesign-2 stream C, goal row R3)

**Status:** built on branch `redesign/codex`. Revised after review 1 (entry states, imagery, facts column, neutral "mới" and progress): see [fix-1-codex.md](fix-1-codex.md). **UAT:** `docs/redesign-2/uat/codex.mjs`. **Unit tests:** `src/codex/codex.test.ts`.

## What the owner asked for (2026-10-05)

- A codex "like Mass Effect where all these get explained".
- Every entry is always readable. Entries you meet in the simulation are marked discovered. Discovered entries you have not read yet are marked new, with a progress count.
- Every term in the app links to its entry.
- Not pushy: no popups, no toasts that steal focus. A quiet count on the Codex button is fine.

## What was built

| Part | File | Loads |
|---|---|---|
| Discovery rules, progress storage, Codex button with badge, `openCodex(id?)`, `termLink()` | `src/codex/triggers.ts` | entry chunk (about 2.5 kB gzip, total entry 76.0 kB of 90 kB) |
| Dialog UI | `src/codex/ui.ts` | lazy, on first open |
| "Xem trong mô phỏng" actions | `src/codex/sim.ts` | lazy |
| SVG diagrams | `src/codex/diagrams.ts` | lazy |
| Content: 7 categories, 44 entries | `src/i18n/codex.vi.json` | lazy (inside the codex chunk, 17.4 kB gzip) |
| Interface strings | `src/i18n/vi.json` → `codexUi` | entry |
| Styles | `src/styles.css`, last section `/* ===== Codex (redesign-2 C) ===== */` | entry CSS |

### Entries per category

| Category | Entries |
|---|---|
| Nền tảng | 7: thiên cầu, chân trời, thiên đỉnh/thiên để, thiên cực, xích đạo trời, kinh tuyến, chuyển động nhật động |
| Hệ tọa độ | 7: hệ chân trời, hệ xích đạo, điểm xuân phân γ, góc giờ H, LST/GST, độ cao thiên cực = vĩ độ, góc xích đạo – chân trời |
| Mọc – lặn | 5: sao cận cực, mọc và lặn, không bao giờ mọc, qua kinh tuyến, thời gian trên chân trời |
| Mở rộng | 4: hoàng đạo, Mặt Trời và mùa, ngày thiên văn, Ngân Hà |
| Sao sáng | 10: cấp sao, màu sao (B − V), Polaris, Sirius, Canopus, Vega, Betelgeuse, Rigel, Antares, Sun |
| Chòm sao | 7: chòm sao (88 IAU), Ursa Major, Ursa Minor, Cassiopeia, Orion, Scorpius, Crux |
| Thiên thể sâu | 4: thiên thể sâu (Messier, NGC), M31, M42, M45 |

### Discovery rules (`discover(s, prev, add)`)

The rules run in `store.subscribe`, but only when a relevant slice changes reference. During playback only `gst` changes, so the function returns without allocating.

| Trigger | Discovers |
|---|---|
| First visit (nothing stored) | `sphere`, `horizon`, `polaris`: what a newcomer already sees (the sky dome, the horizon, the preselected Polaris) |
| Selecting any object | `radec`, `altaz`, `hourAngle`, and its zone at the current latitude (`circumpolar` / `riseSetZone` / `neverRise`) |
| Selecting a catalog star | `magnitude`; `starColor` if B − V < 0 or > 1,3; its own entry (7 named stars); its constellation's entry |
| Selecting a constellation star | `magnitude`; its own entry and constellation entry if any |
| Selecting a deep-sky object | `deepSky`; `m31` / `m42` / `m45` |
| Selecting the Sun | `sun` |
| A display toggle switched **on** | its concept: ecliptic → `ecliptic`, zones → zone entries, galactic → `milkyWay`, sun → `seasons`, deepSky → `deepSky`, … (`TOGGLE_ENTRY`) |
| Latitude changes | `latPole`, plus the selected object's zone |
| Longitude changes, or time moved while paused | `lst` |
| Playback starts, or trails switched on | `diurnal` |
| Mode "1 ngày thiên văn" | `siderealDay` |
| Sun date changes | `seasons` |
| A constellation template is added | its entry (or `constellations`) |
| Hovering or focusing a linked number (`emphasis`) | pole → `latPole`, incl → `eqAngle`, meridian → `lst` and `transit`, A/h → `altaz` |

Opening an entry marks it **read**. The badge counts discovered-but-unread entries. Reading an undiscovered entry does not discover it: discovery means meeting it in the simulation.

## Design decisions, with the lessons applied

### Information architecture (ux)

- **Categories follow the concept order the app already teaches.** The order is: the sky turns, your horizon, two coordinate systems, rising and setting, extensions. It is the same order as the display groups and `help.body`. Objects come last. *ux, Stage 5: organize and label content so people can find it, considering context, content and users together (1490 · U6 · L21).*
- **The 17 objects were split into three categories, each opened by its concept entry.** "Sao sáng" opens with cấp sao and màu sao, "Chòm sao" with chòm sao, and "Thiên thể sâu" with thiên thể sâu. A list of 17 mixed objects is hard to scan; concept-then-examples matches how a 16-year-old builds the idea. *Same lesson, plus check findability in the sitemap (1490 · U6 · L22).*
- **The whole route is covered, not one screen.** The design maps every entry point to the dialog and back:
  - the top-bar button;
  - a "?" next to a term;
  - a related link.
  - It also maps the exit back into the simulation: "Xem trong mô phỏng" closes the codex and applies the change.
  - *ux, Stage 5: consider where someone came from and where the product sends them next (798 · U2 · L05).*

### Writing (ux)

- **Each entry starts with a one-line lede.** It holds the important information in its opening words. The body then splits into 2–4 short paragraphs and a formula card. *ux, Stage 7: put important information in headings and opening words, and split dense copy (798 · U3 · L08).*
- **The action label says what will happen.** The button is "Xem trong mô phỏng". Under it is the concrete effect, for example "Bật hoàng đạo." or "Thêm chòm Orion và chọn Betelgeuse." *ux, Stage 7: a short active label that names the action that will actually happen (798 · U4 · L12).*
- **An undiscovered entry is not an error and not a lock.** Its page says: "Chưa khám phá — bạn vẫn đọc được. Mục này sẽ được đánh dấu khi bạn gặp nó trong mô phỏng." It explains the state, what will change, and that nothing is blocked. *ux, Stage 7: empty and status states say where you are, why, and what comes next (798 · U4 · L11).*
- **Terminology is reused, not reinvented.** The codex uses the words already in `vi.json`: `help.body`, `toggleTip`, `tip.*`, `info.*`. Examples are "xích kinh α", "độ cao thiên cực", "vùng cận cực", and B/Đ/N/T. Object names stay in English, with the Vietnamese name in the `aka` line. *ux principle 7: domain and project conventions govern.*

### Composition and typography (visual-design)

- **One dominant element per screen.** In the reading pane that element is the entry title (26 px bold). The lede (17 px) comes second. The body (15 px, line-height 1.6) and the muted meta lines are tertiary. The list is quieter than the page. *visual-design principle 4: a dominant element, then subordinate elements; competing "number ones" make a message unclear (5642 · U4 · L55).*
- **The codex feel comes from typography and structure, not ornament.** Category labels are small uppercase with 0,09 em tracking. A thin rule sits under each category label and between the lede and the body. The reading width is held at 65ch. There is no texture, glow or sci-fi chrome. *visual-design anti-pattern: filling space with decoration that does not support the concept; type-and-system: adjust size, tracking and leading at the actual output size (5642 · U2 · L14).*
- **The system has named constants.** Orange (`--accent`) appears only on:
  - the selected entry (left bar plus a tint);
  - the "new" dot and label;
  - the progress fill;
  - the primary action, with `--on-accent` text;
  - the badge.
  - Everything else uses the existing grey surface tokens. *type-and-system: name the fixed elements and the permitted variables (5642 · U6 · L86–L87).*
- **The hardest application is the 375 px phone.** There the dialog is full screen and works as list then entry, with a "‹ Danh mục" back button. Every row and link is 44 px tall. The UAT measures no horizontal scroll. *visual-design principle 6: build the system for its hardest application.*
- **Undiscovered entries use dimmer text and a hollow marker.** Discovered entries have a filled grey dot. New entries have an orange dot with a halo and the word "MỚI". So the state does not depend on colour alone.

### Diagrams (information-design)

- Five small SVG diagrams appear on seven entries:
  - pole altitude = φ;
  - horizon coordinates (A, h);
  - equatorial coordinates (α, δ);
  - the three rise/set zones (shared by three entries);
  - the ecliptic against the equator.
- **Every mark has one explicit role and the scene's colour.** The axis is blue, the equator yellow, A cyan, h pink, the zones purple/teal/red, and the ecliptic orange dashed. A student who learns a colour in the codex sees the same meaning in the 3D view. *information-design principle 4: give every mark an explicit data role.* The colour meanings come from `scene/colors.ts`, which owns them.
- **The explanation sits next to the mark.** Labels such as "h = 21,03°", "A", "δ", "ε = 23,44°" and the zone names sit on or beside their mark. The `<figcaption>` is a full sentence key, and it also serves as the SVG's accessible name. *information-design principle 5: write the key for the reader, in the order marks are met (2495 · U4 · L15; 4217 · U4 · L17).*
- **The diagrams use live data where it teaches.** The pole-altitude and zone diagrams are drawn at the latitude currently selected in the simulation, so the codex and the sim show the same numbers.

### Implementation (frontend)

- **Native semantics.**
  - The codex is a modal `<dialog>`. That gives a focus trap and lets Esc close the codex first: main's key handler skips while `isCodexOpen()`.
  - Focus returns to the opener when the dialog closes.
  - The list is a `nav` of `ul` lists of buttons, with `aria-current` on the open entry.
  - The page is an `article` labelled by its title.
  - Opening from a "?" link moves focus to the entry title.
  - *frontend principle 2: prefer native semantics and controls.*
- **Term links.**
  - Each term link is a real `<button>`. Its accessible name, "Giải thích trong Codex: …", comes from visually hidden text, not `aria-label`, so the checkbox label stays the only element labelled "Kinh tuyến thiên cầu".
  - The visible mark is a 16 px "?". On phones a pseudo-element widens the hit area to 44 px.
  - The last word of the label and the "?" are kept on one line.
  - The links sit inside the existing `data-emphasis` rows and cells without replacing them. The linked-highlight hover still works, and the UAT checks it.
- **Performance budget.**
  - The content, the UI, the diagrams and KaTeX load only on first open.
  - The eager part is the rules table plus about 20 lines of DOM.
  - Nothing runs per frame.
  - *frontend principle 4.*
- **Reduced motion.** The codex has no animation. The global `prefers-reduced-motion` rule covers any hover transitions.

## Changes to shared files (all minimal and commented "Codex (redesign-2 C)")

| File | Change |
|---|---|
| `src/main.ts` | One import; `codexButton(store, actions)` in the top bar before Trợ giúp; `isCodexOpen()` in the Esc guard |
| `src/ui/infoCard.ts` | "?" next to α, δ, H, A, h and Trạng thái (status points at the current zone's entry); "?" next to φ, pole altitude, equator angle, LST and GST in the data bar |
| `src/ui/locationPanel.ts` | The pole line is wrapped in `.pole-row` with a "?" to `latPole` |
| `src/ui/displayPanel.ts` | Every concept toggle row gets a trailing "?" (`.check-row`) |
| `src/ui/dialogs.ts` | `renderLines` and `renderMath` are exported for reuse |
| `src/scenario.ts` | New shared helpers `selectCatalogHip`, `selectDso` |
| `src/styles.css` | One section at the end. At ≤ 480 px it also hides the "Ôn tập" icon and tightens top-bar gaps, because one more 44 px button otherwise broke the short app name into four lines |
| `src/i18n/vi.json` | New `codexUi` block |
| `AGENTS.md` | i18n section (the second locale file) and the storage table (`astrosphere.codex.v1`) |
| `docs/redesign/uat/ui.mjs` | The expected top-bar order now includes "Codex" before "Trợ giúp". This is a legitimate change caused by the feature |

## Review state

- **Measured (2026-10-05):**
  - `npm test`: 129 tests pass, 23 of them new in `src/codex/codex.test.ts`.
  - `npm run build`: passes.
  - Bundle: entry JS is 76,0 kB gzip, up from 73,4 kB; the budget is 90 kB.
  - `uat/codex.mjs`: 32/32 checks pass.
  - The existing UATs pass: smoke, ui 25/25, ux 37/37, highlight 25/25, and perf (a)–(c).
  - Under machine load (load average about 8, with parallel agents), single runs of the ux check "(i) Esc folds the card" and the highlight check "reverse hover of the pole axis" failed once each. Both passed on rerun. Both use fixed waits or pointer hit-tests. The highlight check failed the same way on the unmodified base during the investigation.
  - In the dev server, KaTeX font requests 403 inside a git worktree, because `node_modules` is a symlink outside Vite's `fs.allow`. This is an environment issue, not a product issue. The UAT was run with a local config that allows that path.
- **Vision:** the author read and fixed the screenshots `shots/codex-1440.png` and `shots/codex-375.png` and per-diagram crops. Fixes made after reading them:
  - label collisions in four diagrams;
  - a "?" orphaned on its own line;
  - the phone top bar.
- **Not judged:** no fresh-context reviewer has looked at the codex yet. That belongs to the coordinator's R8 review loop.

## Game feel (owner decision 2026-10-05)

**Branch:** `redesign/gamecodex`. **Review input:** [review-2.md](review-2.md) D1 ("not yet collectible") and ranked item #4. The owner chose "Full game feel". **UAT:** `docs/redesign-2/uat/codex.mjs`, 68 checks. **Renders:** `shots/codex-grid-1440.png`, `shots/codex-unlock-1440.png`, `shots/codex-grid-375.png`.

The earlier rules still hold:
- every entry stays readable;
- nothing is pushy;
- there are no popups outside USACodex, so the reward happens only when the user opens USACodex.

### What changed

| Part | Before | Now |
|---|---|---|
| Left column | Category labels over text rows | Seven **category tiles**. Each tile has a glyph in a 40 px square, the name, an "x/y" count and a 3 px mini bar. A white dot on the glyph means the category has new entries, and screen readers hear "2 trên 7 mục đã khám phá, có mục mới". On phones the tiles form a horizontal strip that scrolls inside itself |
| Right pane | Always the reading page | Either the **card grid** of the selected category or the reading page |
| Entries | Text rows with a state glyph | **Cards**, 150–180 px wide (2 columns on phones). Each card has a 3:2 thumbnail, the title and a state row |
| Opening USACodex | Opened the first new entry and marked it read | Opens on the grid of the first category with a new entry, with focus on that card. Nothing is marked read until the user clicks a card |
| Entry page | A kicker line gave the category | A back control, "← {category}", returns to the grid and focuses the card just read |
| Progress | 3 px bar; title "USACodex" | **6 px** neutral bar; the title is "USACodex · x/44" (`codexUi.title` with placeholders) |
| First open of a new entry | "Mới khám phá" | The **unlock reveal**, then the line "Đã mở khóa" |
| Top-bar badge | Count only | One soft **glow pulse** (600 ms) when the unread count rises while the user is in the sim |
| Text size | 10.5–12 px labels and diagram text at about 11 px | **13 px floor** inside USACodex. The header visual renders at 300 px, 1:1 with its viewBox, so a 13-unit diagram label is 13 CSS px |

### Card states

States do not depend on colour. Each state shows a glyph and text, and each card carries `data-state`.

| State | Card | Thumbnail | State row |
|---|---|---|---|
| Locked | Dashed `--border-control` border, `--surface-quiet` background; title in `--muted` (9.1:1) | Grayscale, 40 % opacity | Padlock + "chưa khám phá" (`--subtle`, 5.7:1) |
| New | Bright `--text` border plus a soft neutral halo | Full colour | Filled dot + "MỚI" pill (white on grey outline, 16:1). Neutral, not orange |
| Read | Normal | Full colour | Check; "đã đọc" only for screen readers |

**Thumbnails:**
- They reuse `entryVisual()` from `visual.ts` and `sky.ts`.
- They are built lazily, when a category is first shown. They are rebuilt only when the latitude or the date changes, because some diagrams use the live values.
- They drop their labels and compass instead of shrinking the text below the floor.
- SVG ids are suffixed so that the B − V gradient never collides with the large figure.

### Unlock reveal (one time per entry)

The reveal is driven by the existing new → read transition: `wasNew` is read before `markRead()`. The page gets `data-unlocked="{id}"` for that view and `.is-unlocking` while the animation runs. Opening the entry again shows "Đã khám phá" and plays nothing.

| Time (ms) | Element | Role | Movement |
|---|---|---|---|
| 0 | Title, lede, body | Content | None: visible at once (the UAT checks opacity 1 on the first frame) |
| 0–220 | Header visual | Waiting | At scale 0.96, desaturated, with a closed padlock over it |
| 60–340 | Padlock shackle | **Trigger** | Rotates open 32° around its left leg |
| 220–840 | Header visual | **Follower** | Scale 0.96 → 1; colour returns; a neutral glow rises and fades |
| 300–640 | Padlock | Follower | Fades out with a 1.08 scale |
| 520–860 | "Đã mở khóa" line | Last follower | Fades in from 4 px below |

- Every curve is `cubic-bezier(0.22, 1, 0.36, 1)`: ease-out, with no overshoot and no bounce.
- Under `prefers-reduced-motion`, the global rule removes every animation. The resting styles are the end state: no padlock, and the line shown at full opacity.
- The badge pulse uses only `box-shadow`, not `transform`, and is absent under reduced motion.
- In `triggers.ts` the pulse costs one counter, one prebuilt remover and one timer. It runs only when the unread count changes, never per frame.

### Lessons applied

**UX (`anthropic-skills:ux`)**
- **Write for the whole task: where you are, what you can do, what comes next.**
  - The grid header names the category, its blurb and "x/y đã khám phá".
  - The back control carries the category name, so it both locates the reader and returns them.
  - The locked state still says "chưa khám phá", and the page keeps the sentence that nothing is blocked.
  - *ux principle 5 (798 · U3 · L09 · 02:40–08:48); status states (798 · U4 · L11).*
- **Access is part of the content.**
  - Every state has a glyph and words, not only a colour or border.
  - Tiles speak their full count and whether they hold new entries.
  - Thumbnails are `aria-hidden` because the card title names them; the large figure keeps its sentence-long name.
  - Cards and tiles are native buttons. Arrow keys and Home/End move between them, and plain Tab order still works.
  - *ux principle 6 (798 · U4 · L13 · 04:28–16:09).*
- **The reward is the user's own act.**
  - Opening USACodex no longer reads an entry for the user. The new card gets focus and the user opens it.
  - This keeps the owner's "not pushy" rule and makes the unlock a response to the user's click.
  - *ux, Stage 5: cover the entry point, the route and the next step (798 · U2 · L05).*

**Visual design (`anthropic-skills:visual-design`)**
- **A grid holds unlike things as one unity.** Concept diagrams, sky thumbnails and scale strips have very different content. A fixed 3:2 frame, the same card chrome and the same state row make them read as one collection. *5642 · U5 · L73 · 07:23–08:26; unity through similarity, 5642 · U5 · L73 · 03:02–04:10.*
- **One dominant element per screen.**
  - In the grid, the category title leads, then the new cards (the brightest borders), then the read cards, then the dimmed locked cards.
  - On the page, the title stays number one. The reveal's glow lives on the visual, which is number two, and lasts under a second.
  - *5642 · U4 · L55 · 00:08–01:27.*
- **Figure and ground.** Locked cards recede: darker ground, dashed edge and desaturated image. New cards come forward. The empty space below a short grid is left as space, not filled. *5642 · U4 · L49 · 02:06–06:43.*
- **Build for the hardest application.**
  - At 375 px the tiles become a scroll strip and the cards a 2-column grid.
  - At card size the thumbnails drop labels instead of shrinking them.
  - The figure column was widened to 326 px so that the 13 px floor holds for diagram labels at 1440.
  - *5642 · U7 · L103 · 02:24–04:24.*

**Motion (`anthropic-skills:motion`)**
- **Movement serves the message.** The reveal says exactly one thing: "this entry is now unlocked". Nothing else on the page moves. *503 · U3 · L10 · 01:21–02:42.*
- **Trigger and follower, in sequence.** The shackle opens first (trigger). The visual answers (follower). The words arrive last. No more than two elements change at once. *503 · U5 · L20 · 04:33–06:31; 503 · U4 · L17 · 04:15–04:55; motion language and order, 503 · U3 · L10 · 02:42–04:08.*
- **Ease-out, no bounce.** One deceleration curve for every movement. Stretch and bounce were rejected because they would make a science reference read as cartoonish. *Curves: 503 · U2 · L08 · 06:22–09:12; principles that change tone: 561 · U4 · L13 · 02:47–05:54.*
- **Reading time wins.** The text is never part of the animation. Only the status line fades in, and it stays. *561 · U4 · L11 · 00:02–01:56.*

### Verification (2026-10-06)

**Measured:**

| Check | Result |
|---|---|
| `npm test` | 165 / 165 |
| `npm run build` | Passes |
| Entry JS | 82.01 kB gzip (budget 90). All the new UI is in the lazy codex chunk |
| `docs/redesign-2/uat/codex.mjs` | 68/68 |
| `docs/redesign-2/uat/modes.mjs` | 37/37 |
| `docs/redesign-2/uat/guide.mjs` | 85/85 |
| `docs/redesign/uat/smoke.mjs`, `ui.mjs` (25), `bundle-size.mjs` | Pass |

**Changed UAT checks.** The reasons are also in the file header:
- "desktop opens on the first new entry" is now "opens on the grid of that entry's category, with focus on the new card, and nothing read".
- Badge 3 → 2 is now measured after the first card click.
- `.cdx-item` rows are now `.cdx-card` cards, so entries are opened through the tile and then the card.
- The phone opens on the grid, not a list.
- The locked contrast is now measured on the card background.

**13 px floor:**
- The UAT measures every visible text node, multiplying SVG text by its rendered scale. It runs on 13 desktop views and two phone views.
- KaTeX superscript glyphs (for example the degree sign in an exponent) are excluded, because script size is a typesetting convention.
- Sky labels now stay inside the frame vertically. "Shedar" was clipped at the top of the M31 thumbnail at 13 px.

**Judged by the author:**
- The author read the three renders, a contact sheet of all 44 header visuals at 13 px, and six paused frames of the reveal (0, 150, 300, 450, 600 and 860 ms).
- The frames read in the intended order: padlock closed, then open, then fading over a glowing visual, then the line.

**Not judged:** no fresh-context reviewer has seen the grid or the reveal yet. Screen-reader output was not tested with a real screen reader.
