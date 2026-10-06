# AstroSphere: independent design review 2

This review is based only on the eight screenshots in `docs/redesign-2/review-2/`. I did not read the source code, the brief or the earlier review.

I used the review questions from three skills: `ux` (task comprehension, flow, microcopy), `visual-design` (dominant element, hierarchy, negative space, hardest application) and `color-theory` (functional colour, colour meaning, value and contrast).

Text sizes and contrast below are my estimates from the screenshots. I did not measure them.

## Answers

| # | Question | Answer | Reason | Screenshots |
|---|---|---|---|---|
| A1 | Does it look good? Would a 16-year-old want to play with it? | **Yes** | The dark dome with constellation lines, the glowing yellow equator, the small observer figure and the mascot look polished and "real-app". The interface is restrained and on-brand. What holds it back is that the ground is a flat olive disc and the observer is tiny, so the scene is more diagram than game. A teenager will click stars, but nothing celebrates them when they do. | 01, 03, 05, 08 |
| A2 | Within 5 seconds, does a beginner in Simple mode know what to do first? | **Partly** | The numbered panel ("1. Bạn đứng ở đâu?", "2. Bầu trời quay", "3. Hiện trên bầu trời") gives a clear path. On the first visit, though, the loudest element is the hello's orange "Giải thích các nút" button. The drag/click hint ("Kéo để xoay · bấm vào một ngôi sao") is missing in 01 but present in 03. | 01, 03 |
| B1 | Is there one dominant element on each screen, with a sensible reading path? | **Partly** | **Yes:** Simple mode (the dome dominates, then header, then numbered steps), the codex (title, then body, then the diagram and CTA) and the projector view. **Weaker:** Full mode, where two equal views, a long side panel and a data strip compete. The left-to-right order still reads sensibly there. | 01, 03, 05, 06, 08 |
| B2 | Is Simple mode uncluttered compared with Full? | **Yes** | **Simple:** one view, three named stars, three control groups and a lot of calm space. **Full:** adds a second view, constellation names, a legend, a data strip and a dense coordinate panel. Simple mode closes with a one-line pointer to Full, which is a good bridge. | 03 vs 05 |
| C1 | Is the mascot charming without being pushy? Does the hello cover anything important? | **Yes, with a caveat** | **Charming:** the hello is short, friendly and offers "Để sau". On the phone it shrinks to a one-line toast, and afterwards she sits in a small corner avatar. **Caveat 1:** on desktop the card fills the slot where the selection card appears (Polaris shows there in 07 but not in 01). **Caveat 2:** her orange CTA outweighs the sky as the first action. | 01, 02, 07 |
| C2 | Is explain mode clear? | **Yes** | **Clear state:** a dashed outline marks the target and an orange ring marks the mascot as active. **Clear content:** the popover is anchored to the control and says what it does and that the choice is remembered. **Clear exit:** a persistent bottom pill reads "rê chuột hoặc chạm vào một nút · Esc để thoát" and has a "Thoát" button. | 07 |
| D1 | Does the codex feel like a collectible codex: browsable, inviting, readable? | **Partly** | **Browsable and readable:** categories with counts (2/7, 0/7, 0/5), lock icons, a "MỚI" tag, dashed chips for locked related entries, a 3/44 counter, a good line length and a strong "Xem trong mô phỏng" CTA. **Not yet collectible:** the list looks like a settings menu, the progress bar is a 2 px line, and entries have no art or icon. Unlocking does not feel like a reward. | 06 |
| E1 | Is orange used only for interactive elements? | **Yes** | Orange appears only on interactive things: active tabs, the selected place chip, the slider, checkboxes, CTAs, the active "Trình chiếu" button, the selected codex row and the mascot's active ring. The only orange in the scene is a star's natural tint (Antares), which is not UI. | 01, 05, 06, 07, 08 |
| E2 | Does any colour confuse meaning? | **Partly** | **Consistent:** the scene colours are stable across views, and the legend matches them (yellow equator, blue axis, green horizon, grey 0h circle, pink vertical line, cyan azimuth). **Mild clashes:** the Earth globe in the sphere view uses ocean blue and land green right next to the blue axis and green horizon. The teal "Mọc và lặn" status pill uses a zone colour while the zone layer is off and its legend is hidden. | 03, 05, 08 |
| E3 | Is any text too small or too dim? | **Partly** | **Good:** the main labels, controls and formula bar are large and bright. **About 10–11 px and grey:** the secondary explanations in the selection card ("hướng nhìn, đo từ Bắc qua Đông"), the data-strip captions, the panel subtitles, the codex diagram labels and the Full-mode constellation names. | 03, 05, 06 |
| F1 | Phone: any layout problems? Is the first view good? | **Mostly yes** | **Good first view:** a compact header, the full dome, the hello as a toast, the Polaris card and the start of step 1. No horizontal overflow is visible, and the scrolled controls are roomy (04). **Small issues:** the header buttons are icon-only, including reset next to the mode switch, and look about 42 px tall. The formula line sits flush under the selection card. The "+" on the card reads as "add". | 02, 04 |
| G1 | Projector: is it legible from the back of a room? | **Yes, mostly** | **Legible:** primary labels (about 28–36 px), cardinal letters, the formula bar and the legend all scale up, and chrome is reduced. **Weak:** the constellation names stay small and grey, and in the sphere view several of them (VULPECULA, SAGITTA, DELPHINUS) sit on top of the Earth globe. The "B" label collides with the Polaris ring. | 08 |

## Ranked remaining problems

There are no high-severity problems.

### Medium

1. **The zenith label collides with the view buttons in Full mode.**
   - **Where:** 05, horizon view, top centre. "Thiên đỉnh" is cut off behind "Nhìn từ người quan sát".
   - **Fix:** Reserve a top inset for the overlay buttons when the view is half-width. Alternatively, collapse them to icon-only buttons with tooltips there, or lower the camera framing so the zenith label clears them.

2. **The first action on the first visit points at the mascot, not at the sky.**
   - **Where:** 01, sidebar. The hello's filled orange "Giải thích các nút" is the strongest element on the page, and the "Kéo để xoay · bấm vào một ngôi sao" hint is missing (it shows in 03).
   - **Fix:** Show the drag/click hint on the first visit too. Make "Giải thích các nút" a secondary (outlined) button, or add one line to the hello: "Thử bấm vào một ngôi sao".

3. **The sphere view is cluttered in presentation mode.**
   - **Where:** 08, right view. Constellation names are printed over the Earth globe. "B" overlaps the Polaris ring. "Thiên đỉnh" sits on the globe edge.
   - **Fix:** Hide constellation labels whose anchors fall inside the globe's screen disc, and push cardinal labels outward from the sphere rim.
   - **Also consider:** desaturating the globe slightly, so its blue and green do not echo the axis and horizon colours (E2).

4. **The codex does not yet feel collectible.**
   - **Where:** 06, left list and progress bar.
   - **Fix:**
     - Give each category a small icon tile, and show locked entries as dimmed tiles rather than plain text rows.
     - Thicken the progress bar to about 6 px, in a neutral or white fill, not orange.
     - When an entry is unlocked, show a brief "Đã mở khóa" moment.

### Low

5. **Secondary text is too small and dim.**
   - **Where:** 03 and 05, the selection-card explanations and the data-strip captions. 06, the codex diagram labels (about 10 px).
   - **Fix:** Set a floor of 12 px with at least 4.5:1 contrast for any text that teaches. Enlarge the SVG labels in the codex diagram.

6. **Phone header uses icon-only buttons, and reset sits next to the mode switch.**
   - **Where:** 02 and 04, header.
   - **Fix:** Make the buttons at least 44 px. Move "Đặt lại" into the control panel, or give it an undo toast, so a mis-tap is recoverable.

7. **The formula line is cramped under the selection card on the phone.**
   - **Where:** 02, "φ = 21,03° B · …".
   - **Fix:** Add about 10 px of top padding, or a divider, above the formula line.

8. **The "+" on the collapsed selection card is ambiguous.**
   - **Where:** 02 and 07, the Polaris card. "+" reads as "add", but it expands the card (the expanded card in 03 shows "—").
   - **Fix:** Use a chevron with a visible or accessible label, "Chi tiết".

9. **The desktop hello occupies the selection-card slot.**
   - **Where:** 01, sidebar. The Polaris card is hidden while the hello is open (compare 07).
   - **Fix:** Anchor the hello to the avatar so that it overlays only empty space, or place it below the selection card.

10. **The Codex badge number is unexplained.**
    - **Where:** header, all screenshots. The badge reads 3, 9, 2 and 3 across screenshots, while the codex says "3/44 đã khám phá".
    - **Fix:** Add a tooltip or accessible name such as "n mục mới". Alternatively, use a dot and keep numbers inside the codex.

11. **A below-horizon star's marker is clipped at the canvas edge.**
    - **Where:** 03, bottom of the horizon view. The marker for Sirius at h = −84° is half cut by the formula bar. The caption is good.
    - **Fix:** Clamp the marker inside the frame, with a downward edge arrow, when the projected point leaves the canvas.

12. **The teal status pill uses a zone colour out of context.**
    - **Where:** 03 and 05, "Mọc và lặn".
    - **Fix:** Use a neutral pill with a small teal dot, so the colour code appears only when the zone legend is visible.

## Overall verdict

AstroSphere looks like a finished, credible product.
- **Brand and colour:** the brand is applied with discipline (orange marks only things you can press), and the scene's colour language is consistent across views.
- **Modes:** Simple mode is genuinely simple, with a clear numbered path. Full mode is dense but orderly.
- **Mascot:** she adds warmth without nagging, and explain mode is easy to understand and easy to leave.
- **Weaknesses:** a label collision in Full mode, a first-visit call to action that points at the mascot instead of the sky, clutter in the projector sphere view, and a codex that reads more like a menu than a collection.

It is ready to show to the club. Fix item 1 first, because it is visible on the default Full layout. Items 2 and 3 should follow soon after, since they shape a beginner's first minute and the club's own projector demos.
