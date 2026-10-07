# Usui-chan, the guide (redesign-2 stream G, goal row R4)

**Status:** built on branch `redesign/guide`. **UAT:** `docs/redesign-2/uat/guide.mjs` (dev server). **Unit tests:** `src/guide/guide.test.ts`. **Shots:** `docs/redesign-2/shots/guide-hello-1440.png`, `guide-explain-1440.png`, `guide-375.png`.

Skills loaded and applied: `ux`, `motion`, `visual-design`, `frontend`. Course anchors follow each skill's own references (`798 · U4 · L11 · 01:14–03:22` = UX-writing course 798, unit 4, lesson 11, time range; `5642` = visual-design course; `503`, `433`, `561` = motion courses; `[book:…]` = frontend sources). `derived` marks my own synthesis.

## 1. Owner decisions (2026-10-05) and the brief

- The guide is **Usui-chan**, USAC's mascot (the club's own model, `public/models/usui-chan.glb`, already the observer in the horizon view).
- **One hello, then on demand.** She greets once on the first visit, then sits in a corner. Clicking her enters **explain mode**: hovering, focusing or tapping any control makes her say what it does. She never pops up uninvited again.
- The owner rejected an in-your-face guided story earlier, so this must stay calm and dismissible.

**User and task (ux stage 1).** The same 16-year-old as `simple-mode.md`, alone with the app. The guide answers one question, at the moment it is asked: "what does this button do, and why would I use it?". **Assumption, not evidence:** no user research was run; "beginners want to ask about a control in place" is the owner's judgement (ux principle 3, 798 · U2 · L06 · 05:52–08:19).

**Hardest application** (visual-design principle 6, 5642 · U7 · L96 · 01:48–02:32): a 375 px phone with touch only, where there is no hover and every pixel under the sky is a control. The touch design below is built for it.

## 2. What was built

| Part | File | Loads |
|---|---|---|
| Avatar button, `hello()`, `escape()`, `close()` | `src/guide/boot.ts` | entry chunk |
| Storage key and type guard | `src/guide/state.ts` | entry |
| Pure tables: `tipKey`, `GUIDE_CODEX`, `PASSIVE` | `src/guide/tips.ts` | lazy |
| Hello, banner, bubble, explain-mode listeners, full pose image | `src/guide/guide.ts` | lazy: 2.9 kB gzip, on first hello or first avatar click |
| Portrait 192 px (6.6 kB), full pose 596×560 (38 kB) | `src/assets/guide/` | portrait with the page; pose only when the hello shows it |
| 51 explanation strings and the guide's UI strings | `src/i18n/vi.json` → `guide` | entry (i18n chunk) |
| Styles | last section of `src/styles.css`, `/* ===== Usui-chan guide (redesign-2 G) ===== */` | entry CSS |

Entry JS: **81.2 kB gzip** (was 78.3 kB; ≤ 90 kB). Almost all of the +2.9 kB is the 51 tip strings, which AGENTS.md requires in `vi.json`.

## 3. Flows (ux stage 5)

### First visit
1. The sky loads first. 700 ms after the 3D scene is ready, `guide.hello()` runs (`main.ts › greet()`). It does nothing if `astrosphere.guide.v1` says `{hello: true}`, and nothing in presentation mode.
2. The key is written **as soon as the hello shows**, so a reload never greets again, even if the visitor ignored it.
3. The avatar nods once; the bubble follows (section 6).
4. Exits: **Giải thích các nút** (enters explain mode), **Để sau**, **Esc**, or any pointer-down on the sky (the visitor is already doing what the app is for). Closing with a hello button returns focus to the avatar, never to `<body>`.
5. **One message at a time.** While the hello is open, the first-visit hint caption (`ui/firstHint.ts`, "Kéo để xoay · bấm vào một ngôi sao") is `visibility: hidden`. It reappears when the hello closes, so a newcomer reads one thing, then the next. On phones the caption keeps its space, so nothing jumps.

### Explain mode
- **Enter:** click/tap the avatar, or "Giải thích các nút". The avatar gets `aria-pressed="true"` and an orange ring; a banner reads "Chế độ giải thích — rê chuột hoặc chạm vào một nút · Esc để thoát", with a **Thoát** button.
- **Desktop (mouse, pen, keyboard):** hovering *or focusing* a `[data-guide]` element shows the bubble anchored next to it (below, else above, else inside the top edge of a large region such as a 3D view), with the explained control outlined in a muted dashed line. A mouse click still uses the control normally, and so do Enter/Space (their clicks have `detail = 0`). Where a concept exists in the Codex, the bubble ends with **Đọc thêm trong Codex** → `openCodex(id)`.
- **Touch:** see section 4.
- **Exit:** Esc, the avatar again, or **Thoát**. Listeners are removed, and focus inside the bubble or banner returns to the avatar.
- **Esc priority** is now dialog (including the Codex) → hello / explain mode → learning drawer → clear the selection. Esc while typing in an input still does nothing (the existing `typing` guard runs first). AGENTS.md is updated.
- **Presentation mode** hides every guide element (`body.present`) and switches explain mode off.

### Never uninvited
After the hello, nothing in `src/guide/` runs unless the avatar is clicked: there are no timers, no idle prompts and no listeners. The UAT waits 5 s, drags the sky and checks that no hello, bubble or banner appears.

## 4. Why touch uses "first tap explains, second tap acts"

Touch has no hover, so "show what it does" and "do it" would otherwise be the same gesture. The options were:

| Option | Problem |
|---|---|
| Long-press to explain | Undiscoverable, collides with text selection and the OS context menu, and slow to use for 50 controls. |
| Explain *and* act on the same tap | The visitor learns what the button did after it already did it (for example Đặt lại wipes their setup). That defeats "what will this do?". |
| A separate "?" target on every control | Doubles the number of targets on a phone that already has 44 px targets edge to edge. |
| **First tap explains, second tap acts** (chosen) | It is a mode the visitor chose and can see (banner, ring), so the changed meaning of a tap is announced. |

Implementation (`guide.ts`):
- A capture-phase `click` listener on `document` blocks only real touch clicks (`pointerType === 'touch'`, `detail > 0`). It calls `preventDefault()` and `stopImmediatePropagation()`, shows the tip, and *arms* that control.
- A second tap on the same control passes through. So does **Dùng nút này** in the bubble, which re-dispatches a click on the exact element that was blocked, or focuses it for sliders, text fields and selects.
- Sliders and selects change value on touch-start, before any click, so a non-passive `touchstart` capture listener blocks those two, and only while explain mode is on.
- The 3D views are **passive**: a tap there shows the view's tip but is never blocked, so dragging the sky and picking a star keep working. "Never block the sky" holds even in explain mode.
- Keyboard and mouse are never intercepted. Grounding: the label must let people predict what will happen (798 · U4 · L12 · 10:41–14:02); "Dùng nút này" names the action that will actually happen.

## 5. Words (ux stage 7)

**Hello** (`guide.helloTitle`, `guide.helloBody`):
> **Chào bạn!**
> Mình là Usui-chan, linh vật của CLB Thiên văn USAC. Khi nào thắc mắc, bấm vào ảnh của mình để bật chế độ giải thích: rê chuột hoặc chạm vào nút nào, mình sẽ nói nút đó dùng để làm gì.

It follows the onboarding pattern of what it is, its value, how to use it, and a timely next step (798 · U4 · L11 · 01:14–03:22). It says *who* (the club's mascot), *what* (explains controls), *how* (click me, then hover or tap) and gives two explicit next steps. The buttons are short active labels for the real action: "Giải thích các nút" and "Để sau" (798 · U4 · L12 · 10:41–14:02). "bấm vào ảnh của mình" is deliberately location-free, because the avatar sits bottom-right on desktop and top-left of the sky on phones.

**Voice, not cutesy** (798 · U3 · L10 · 00:00–02:03: the voice stays fixed and the tone fits the moment). Usui-chan speaks in the first person ("mình") to "bạn", warmly and plainly. Rules for every `guide.tip.*`:
- **At most two sentences.** Sentence one says what the control does; sentence two says why or when you would use it. Important information comes first (798 · U3 · L08 · 03:42–06:38). A unit test enforces the two-sentence limit.
- Plain words before terms. Terms appear only when the control itself shows them (φ, α, δ, LST), and the Codex link carries the depth.
- One personal touch at most ("Để ý nhé: nó luôn bằng đúng vĩ độ của bạn."). No emoji, no exclamation-mark stacking, and no "~" or "nè".
- "Clear, concise, useful, and human" (798 · U3 · L09 · 06:25–08:48). Example, `simpleZones`: "Tô ba màu: tím là sao không bao giờ lặn, xanh ngọc là sao mọc rồi lặn, đỏ là sao không bao giờ mọc ở nơi bạn đứng." The colour names repeat the scene's colour meanings in words, so the meaning does not rest on colour alone.

All strings are in `vi.json → guide` and pass the banned-English-word test. Object names stay English.

## 6. Motion (motion stages 1, 2, 5)

**Purpose.** Movement is used only to *inform* where the bubble came from and to *focus* attention once (503 · U3 · L10 · 01:21–02:42). There is no idle loop, no bounce on every tip, and no squash and stretch: the course warns that stretch and squash can make a serious subject cartoon-like (561 · U4 · L13 · 02:47–05:54), and this is a learning instrument.

**Choreography: trigger → follower** (503 · U4 · L17 · 04:15–04:55; 503 · U5 · L20 · 04:33–06:31):

| Beat | Element | Motion | Timing |
|---|---|---|---|
| Trigger | avatar | one nod: up 4 px, tilt −5° then +2°, settle | 420 ms ease-out, once, hello only |
| Follower | hello bubble | fade + 6 px/8 px slide from the avatar's corner, scale 0.96 → 1 | starts at 120 ms, 180 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out) |
| Phones | hello sheet | fade + rise 12 px from the bottom edge (a sheet's own direction) | same timing |
| Explain | bubble, banner | same pop, from the avatar's direction | 140 ms ease-out, only when a bubble *appears*, not when its text changes |

Only one element moves at a time (503 · U3 · L10 · 02:42–04:08: limit how many elements move at once). Moving from one control to the next swaps the text in place with no re-animation, because a transition without a narrative reason should be omitted (433 · U4 · L11 · 02:42–03:52). The character's movement language is the mascot's: a small, friendly nod, not a jump (503 · U3 · L11 · 00:00–01:21).

**Reduced motion.** Every keyframe is declared inside `@media (prefers-reduced-motion: no-preference)`, so under `reduce` everything appears instantly ([book:mdn-web-docs], "prefers-reduced-motion"). The UAT checks `animation-name: none` for the hello, avatar and bubble.

## 7. Visual (visual-design stages 3, 4, 6)

- **One number one stays the sky.** The guide is a subordinate element (5642 · U4 · L55 · 00:08–01:27). It is a 56 px portrait (48 px on phones) on `--surface-2` with a thin `--border-control` ring. Charm comes from the portrait and the voice, not from decoration: no badges, no sparkles, no speech-bubble clip art.
- **Placement, desktop:** a fixed bottom-right corner. At 1440 × 900 that corner is empty in both modes. In Simple it sits under the next-step note; in Full it sits under the right end of the data bar. It never touches the view tools (top right of each view), the info card or Polaris chip (bottom right of the sphere view), or the quality notice (bottom left). The placement is exact, not "almost in the corner" (5642 · U2 · L19 · 00:00–02:16).
- **Placement, ≤ 900 px:** the avatar moves *into* the top-left corner of the view area (`position: absolute` in `.views`). That corner is empty sky on every phone render: the view tools are top right and the info card is at the bottom. A fixed corner button on a scrolling phone page would pass over the Polaris chip, the latitude slider and the place chips at some scroll position, which the brief forbids. The UAT measures overlaps with view tools, the info card and the Simple controls at 1440 and 375.
- **The hello never blocks the sky:**
  - Desktop Simple: a 320 px column bubble above the avatar, over the empty foot of the control column. With ≥ 860 px of height it shows the full pose (flag and telescope) on a soft `--surface-3` spotlight, so the black flag and skirt separate from the dark surface (figure-ground, 5642 · U2 · L09 · 03:45–04:50).
  - Desktop Full: the right column is the celestial sphere, so the hello turns **horizontal** (`guide-hello--wide`), to the left of the avatar over the data bar. At 1440 × 900 the UAT checks that it covers neither sky canvas nor the Polaris chip.
  - ≤ 900 px: a bottom sheet (max 480 px wide), below the sky.
- **Bubble:** a dark surface (`--surface-2`), 1 px `--border-control` border and Arial at 14 px (16 px on phones), with a small portrait at the left so every explanation reads as hers. A 12 px rotated-square arrow points at the control. On phones ≤ 600 px it is a bottom sheet above the banner, so it always fits; the UAT checks the bounds at 375 px.
- **Colour:** orange (`--accent`) appears only on buttons ("Giải thích các nút", "Dùng nút này"), the Codex text link (interactive) and the explain-mode ring on the avatar. The outline on the explained control is a muted dashed line, so orange keeps meaning "you can press this". Text on orange is `--on-accent`. There are no raw colours outside `:root`.
- **Few clusters:** the avatar, banner and bubble form one group in one corner (5642 · U4 · L53 · 06:29–07:11).

## 8. Front end (frontend stages 2, 4, 5, 6, 7)

- **Native semantics:**
  - The avatar is a `<button>` with `aria-label="Usui-chan: giải thích các nút"` and `aria-pressed`, a toggle button ([book:wai-aria-apg], "Button Pattern").
  - The hello is an `<aside aria-labelledby>`, inserted right after the avatar in the DOM, so Tab goes avatar → hello buttons without moving focus there by itself.
  - The bubble and banner are `role="status"` live regions, so a focused control's explanation is announced.
- **Content on hover or focus** (WCAG 2.2 SC 1.4.13, applied beyond the skill's references): the bubble is *dismissible* (Esc, ×), *hoverable* (a 700 ms grace period lets the pointer travel onto it) and *persistent* (it stays until another control is hovered or focused, or it is dismissed).
- **Targets:** the avatar is 56 px (48 px on phones). The hello buttons, "Dùng nút này", the Codex link, × and Thoát are all ≥ 44 px on phones ([book:wcag-22], SC 2.5.8 is the floor; the project uses 44 px).
- **Focus:** closing the hello or bubble while focus is inside it returns focus to the avatar or the explained control (AGENTS.md: return focus to the opener).
- **Agent-ready:** every control's purpose is now machine-readable through `data-guide` and `guide.tip.*` ([src:agent-ready-web/report.md], "F4").
- **Performance:**
  - No per-frame work: no rAF loop. One rAF is used only to reposition the bubble after scroll or resize, while it is visible.
  - Explain-mode listeners (`pointerover`, `focusin`, `click`, `touchstart`, `scroll`, `resize`) are attached only while the mode is on.
  - `perf.mjs` and `bundle-size.mjs` pass ([book:web-performance-engineering], "Chapter 2").

### `data-guide` coverage (51 keys)

| Area | Keys |
|---|---|
| Top bar | `mode`, `learn`, `present`, `reset`, `codex`, `help`, `about` |
| Views | `horizonView`, `sphereView` (passive), `viewTabs`, `firstPerson`, `resetCamera` |
| Info card | `infoCard`, `infoCollapse`, `infoClose` |
| Codex "?" links | `term` (the Codex link opens the link's own entry) |
| Data bar | `dataLat`, `dataPole`, `dataIncl`, `dataLon`, `dataLst`, `dataGst`, `dataSolar`, `dataSelected` |
| Simple | `simplePlaces`, `simpleLat`, `simplePlay`, `simpleSpeed`, `simpleAxis`, `simpleEquator`, `simpleZones` |
| Panels | `panelTabs`; location: `latLonInput`, `latSlider`, `worldMap`, `places`; animation: `play`, `animMode`, `lstSlider`, `stepHour`, `rate`; display: `displayGroup`, `sunDate`, `catalog`; stars: `templates`, `addStars`, `realSky`, `trails` |
| Footer and notices | `fanpage`, `email`, `catalog`, `quality` |

Keys are literal strings (`'data-guide': 'k'`, `guide: 'k'` or `guide('k', el)`). `src/guide/guide.test.ts` collects them from `src/**/*.ts` and checks that:
- every key has `guide.tip.<key>`;
- no tip is an orphan;
- only the two known expression assignments exist (`opts.guide` and `c.guide`);
- every Codex target in `GUIDE_CODEX` is a real entry;
- every tip has at most two sentences.

The learning drawer's task controls are not tagged: they are task-specific, and the drawer is its own guided activity.

## 9. Checks

| Check | Kind | Result |
|---|---|---|
| `npm test` (152 tests, including 10 new guide tests: storage guard, blocked storage, `data-guide` coverage both ways, Codex targets, two-sentence limit) | measured | pass |
| `npm run build` | measured | pass |
| `bundle-size.mjs` | measured | entry 81.2 kB ≤ 90 kB |
| `uat/guide.mjs` (66 checks at 1440 and 375, touch, Simple and Full, reduced motion) | measured | 66/66 |
| Existing UATs (`modes`, `codex`, `smoke`, `ui`, `ux`, `highlight`, `declutter`, `perf`) with the guide key pre-set | measured | all pass |
| Screenshots inspected by the author at 1440 Simple/Full, 1280 × 720, 1024 × 768 Full, 768 and 375 | judged by the author | fixes applied (section 10) |
| Fresh-context vision review ("does it look good, and does a beginner know what to do?") | **not judged** | left for the coordinator's R8 review loop |
| Screen-reader announcement of the `role="status"` bubble | **not judged** | needs a manual NVDA/VoiceOver pass |

## 10. Fixes made after looking at the renders

- The hello title "Chào bạn, mình là Usui-chan!" broke at the hyphen ("Usui-/chan"). The title is now "Chào bạn!" and the introduction moved into the body.
- At 1280 × 720 the pose version covered the play button. The pose now needs ≥ 860 px of height; shorter screens get the compact portrait version.
- In Full at desktop width, the vertical hello covered the sphere and the Polaris chip. Full now uses the horizontal `--wide` hello over the data bar.
- On phones, "Dùng nút này" now comes before the Codex link, because it is the next action on touch.

## 11. Known limits

- At 1024 × 768 in Full, the horizontal hello still overlaps the lower half of the Polaris chip and the bottom 10 px of the sphere view until it is dismissed. Any sky interaction dismisses it.
- At 1280 × 720 in Simple, the compact hello covers the "3. Hiện trên bầu trời" checkboxes until it is dismissed. It does not cover the sky.
- On desktop the explain banner covers the right end of the horizon hint caption ("Kéo để xoay · bấm vào một ngôi sao") while explain mode is on. The horizon view's own tip says the same thing.
- Keyboard users reach the bubble's "Đọc thêm trong Codex" link at the end of the tab order, because the bubble is appended to `<body>`. The same entries are reachable through the "?" term links.
