# Design review 1: AstroSphere redesign 2

**Reviewer:** an independent reviewer, working with fresh eyes. I judged the product only from the 8 screenshots in `docs/redesign-2/review-1/` and did not read the code or the docs.

**Method:** the review questions from the `ux`, `visual-design` and `color-theory` skills:
- UX T5, T7 and T10;
- VD-T1, T3, T6, T7, T8, T9 and T12;
- colour T1, T5 and T8, plus WCAG contrast.

**What was measured and what was judged:**
- **Measured:** text contrast, from pixels sampled in the screenshots.
  - Secondary grey text is about `#b3b3b3` on `#101010` to `#141414`, roughly 9:1.
  - The dimmest hint text is `#8c8c8c` on `#101010`, roughly 5.6:1.
  - Constellation labels are about `#9a9283` on `#090a0c`, roughly 6.4:1.
  - All of these pass WCAG AA, so where text is weak, the cause is its size, not its contrast.
- **Judged by eye:** everything else.
- **Not judged:** screen-reader order and keyboard behaviour, because a static image cannot show them. Motion, because the screenshots are still.

## Answers

| # | Question | Verdict | Reason | Screenshots |
|---|---|---|---|---|
| A1 | Does it look good? Would a 16-year-old want to play with it? | **Partly** | The star dome with constellation lines, the glowing arcs and the mascot look attractive and "game-like". But the flat, saturated green horizon disc looks dated and takes over the view. The right-hand control panel reads like a settings form, with a large empty block under step 3. Nothing in the first screen invites play: there is no "try this" and no visible target to click. | 01, 03, 05 |
| A2 | Within 5 seconds, does a beginner in Simple mode know what to do first? | **Partly** | The numbered steps 1–2–3 in the panel are a good scaffold. But the core action, "Bấm vào một ngôi sao…", is small grey text at the bottom of the panel, and on first visit the hello card covers it. The "Kéo để xoay · bấm vào một ngôi sao" caption is 12 px grey in the readout bar. The first thing a beginner sees is "click the mascot", not "click a star". | 01, 03 |
| B1 | Is there one dominant element per screen? Is the reading path sensible? | **Partly** | 01 and 03: the dome dominates, which is good, but in 01 the hello card is the second-strongest element and pulls the eye away. 05: the two views and the Sirius panel are three equal-weight columns, and the 4-row legend and data strip below compete too. The left-to-right path is still sensible. 06 and 08: yes, one clear dominant element each. | 01, 03, 05, 06, 08 |
| B2 | Does Simple feel uncluttered compared with Full? | **Yes** | Simple has one view, three numbered groups and no constellation-name labels. Full has two views, about 30 uppercase constellation labels, a 10-row info panel, a legend and a 7-column data strip. The difference is obvious and well judged. | 01 vs 05 |
| C1 | Is the mascot charming but not pushy? Does the hello cover anything important? | **Partly** | The art and the friendly first-person copy are charming, and "Để sau" is a fair, equal-weight way out. **Desktop:** the card is large (about 320 × 380 px). It overlaps the panel's footer hint ("Muốn xem thiên cầu…" is visibly cut through), and its accent button is the brightest thing on the page. **Phone:** the sheet covers about 35% of the screen and half of the φ readout line, which shows as clipped text peeking out above the sheet. | 01, 02 |
| C2 | Is explain mode clear (what is happening, and how to leave)? | **Yes** | The target has a dashed outline, the tooltip speaks in Usui's voice, the bottom bar states the mode and "Esc để thoát", there is an explicit "Thoát" button, and the avatar has an orange ring. Two minor faults: the bottom bar overlaps the panel hint text, and the tooltip's own × could be mistaken for "exit explain mode". | 07 |
| D1 | Does the codex feel like a codex: browsable, inviting, readable? | **Partly** | It is browsable and readable:<br>• categories with counts, a 3/44 progress bar and "MỚI" tags;<br>• a good line length, with a clear lead sentence and the English term under the Vietnamese title;<br>• "Xem trong mô phỏng" and the related-entry chips.<br>It does not feel Mass Effect: there is no imagery, icon or diagram per entry. Undiscovered entries look the same as read ones (all hollow circles, no lock or "?"). The right-hand third of the entry pane is empty. It reads as a well-made glossary rather than a collectible archive. | 06 |
| E1 | Is the orange accent used only for interactive elements? | **Partly** | Mostly yes: the selected mode, chips, slider, checkboxes, primary buttons, links and the explain ring. Non-interactive uses: the Codex count badge, the "MỚI" tag, the codex progress bar, and the long orange credits line in the phone footer. The Simple panel also has 7 or more orange marks on one screen (selected chip, slider, two checkboxes, two segment underlines, mode underline), so the one primary CTA, "Giải thích các nút", has to fight for attention. | 01, 04, 06 |
| E2 | Does any colour confuse meaning? | **Partly** | Green means three things: the horizon disc, the cardinal letters B/N/Đ/T (pale green), and the "Mọc và lặn" status pill (teal-green), plus Earth's land in the sphere view. The cyan azimuth ring "A = 282,1°" sits close to the blue polar axis. Pink is used consistently for the vertical circle and altitude, which is good. Yellow equator and orange accent stay distinguishable. | 03, 05, 08 |
| E3 | Is any text too small or too dim? | **Partly** | Contrast passes everywhere I sampled, but a lot of 11–12 px secondary text adds up: the "Chế độ" label, the view subtitles, the data-strip captions, the codex "Mới khám phá", the readout hint, the uppercase letter-spaced constellation labels and the phone footer. The "Chế độ" prefix in the header is about 11 px grey and adds nothing. | 01, 05, 06, 04 |
| F1 | Phone: are there layout problems, and is the first view good? | **Partly** | 04 is clean: no horizontal overflow, 44 px chips, good wrapping. 02 has three problems. The hello sheet clips the readout text behind it. The mascot avatar sits on top of the sky at top left. The four header buttons are icon-only (↺ ◆ ? i), and "◆" means nothing without a label. The dome takes only about 50% of the first screen. | 02, 04 |
| G1 | Projector: is it legible from the back of a room? | **Yes**, with exceptions | The labels, arcs, cardinal letters and φ readout scale up well. Some elements stay too small for a room: the header (the "Chế độ" label is about 11 px even at 1920), the about 15 px grey constellation labels, and the legend at about 20 px. In the sphere view, "B" collides with the Polaris ring and "Thiên đỉnh" crowds "T". "A = 0,6°" sits on the observer figure. | 08 |

## Ranked problems

| Rank | Severity | Screenshot | Location | Problem | Specific fix |
|---|---|---|---|---|---|
| 1 | **High** | 03 | The floating Sirius card over the top-right of the horizon view | The card is translucent and sits on top of the "Nhìn từ người quan sát" and "Góc nhìn mặc định" buttons, whose text shows through it as ghost text. The minimise (—) and close (×) controls are cramped together. Meanwhile the panel has about 300 px of empty space directly beside it. | In Simple mode, dock the selection card in the empty lower part of the right panel. Wherever the card floats, give it an opaque `--surface` background. Separate — and × by at least 8 px, each with a 44 px hit area. |
| 2 | **High** | 03, 05 | The horizon view after selecting a star below the horizon (Sirius, h = −73°) | The star cannot be seen anywhere: the opaque green disc hides it. The only cue is a cyan ring around the observer, which reads as decoration. A beginner clicks Sirius and "nothing" appears in the sky. | When the selected star is below the horizon, draw its marker and altitude arc through the disc with a dashed or ghosted style, and add an on-view label: "Sirius đang ở dưới chân trời (h = −73°)". As an alternative, make the disc semi-transparent while a below-horizon star is selected. |
| 3 | **High** | 02 | The phone hello sheet | The sheet covers about 35% of the first screen and cuts the φ readout in half (clipped text visible above the sheet). It also hides the Polaris chip's context. On a first visit, the phone user sees more mascot than sky. | On phones, show the hello as a compact one-line toast above the selection chip (avatar, "Chào bạn! Bấm vào mình để được giải thích", ×). Alternatively, show it only after the first interaction, and never let it overlap the readout bar. |
| 4 | **Medium** | 01, 03 | The first-action cue in Simple mode | "Bấm vào một ngôi sao…" is small grey text at the panel's bottom, and the hello hides it on first visit. Neither the panel nor the view gives a direct invitation to click a star. | Add a step 0 at the top of the panel, or an on-sky callout pointing at a bright named star (for example "Thử bấm vào Vega"). Set it at body size in white, not as a 12 px grey hint. Let the hello card replace this cue, not cover it. |
| 5 | **Medium** | 01, 05, 08 | The green horizon disc | It is the largest and most saturated area on the screen. It flattens the scene, out-shouts the sky the lesson is about, and spreads the "green" meaning (see E2). | Drop the fill's saturation and lightness, aiming for OKLCH C ≤ 0.04 and an L about 0.25 dark green-grey, and keep the strong green only on the rim line. Make the cardinal letters white or neutral so that green means the horizon only. |
| 6 | **Medium** | 06 | Codex list and entry pane | Undiscovered entries look identical to read ones. Entries have no imagery. The right-hand third of the entry pane is empty. The result feels like a glossary, not a codex. | Mark locked entries with a lock or "???" title in dim text, and keep the hollow circle for "seen, not opened". Add a small diagram or scene thumbnail to the top of each entry, using the empty right-hand column or a header strip. Optionally add a category glyph. |
| 7 | **Medium** | 01, 07 | Panel footer hint vs the hello card and the explain bar | Two overlays collide with the same "Muốn xem thiên cầu…" text: the hello card's edge cuts through it in 01, and the explain bar in 07. | Reserve space for overlays: anchor the hello card and the explain bar above the panel footer, or hide the footer hint while an overlay is open. |
| 8 | **Low** | 02, 01, 05, 08 | Header | On phones the buttons are icon-only, and "◆" for Codex is unreadable. The "Chế độ" label is about 11 px grey at every width, including the projector. The Codex badge (orange, non-interactive) adds one more orange mark. | On phones, add 10–11 px captions under each icon, or relabel "◆" with a book glyph. Remove the "Chế độ" prefix, since the segmented control is self-explanatory. Use a neutral-white badge with dark text, or a small dot, so that orange stays for actions. |

## Overall verdict

This is a solid, coherent redesign, and it already looks better than most educational astronomy tools.
- **Strengths:**
  - The dark brand, the readable Vietnamese copy and the numbered Simple-mode panel give it a calm, trustworthy structure.
  - The split between Simple and Full mode is clearly earned.
  - Explain mode is well built.
  - Presentation mode is genuinely usable on a projector.
- **What stops it from being something a 16-year-old wants to play with:**
  - Polish failures at the moment of interaction: a translucent card overlapping buttons, a selected star that is invisible because it is below the horizon, and overlays clipping text.
  - A first screen that does not tell the student to click a star.
  - A heavy green floor that drains the drama from the sky.
- **The codex** is readable and well organised but needs imagery and a visible locked/unlocked state to feel collectible.
- **What to fix first:** the three high items, which are the selection card, a below-horizon star and the phone hello. Fixing those, plus putting a direct "bấm vào một ngôi sao" invitation into the first view, would move A1 and A2 from "partly" to "yes".
