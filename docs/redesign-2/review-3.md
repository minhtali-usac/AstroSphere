# AstroSphere: independent design review (screenshot set `review-4/`)

**Reviewer:** an independent reviewer who did not build the product. I judged only the 12 screenshots in `docs/redesign-2/review-4/`. I did not read source code, other documents or earlier reviews.

**Method:** I used the review questions from the `ux`, `visual-design` and `color-theory` skills: task and next step, hierarchy and focal point, reading path, functional colour, contrast and legibility. Results are of three kinds:

- **Measured from pixels:**
  - Cap heights. The explanatory sub-lines have a 9 px cap height, about 12.5 to 13 px Arial. Constellation labels have an 8 px cap height, about 11 px.
  - WCAG contrast of muted text, 5.7:1 to 9.4:1.
  - Status dot colour `#14B8A6`, which equals the teal zone swatch. The azimuth arc is `#67E8F9`.
- **Judged by eye:** everything else.
- **Not judged:** anything that needs motion or keyboard focus, such as the pulse animation, the unlock animation and the dialog's initial focus. Still images cannot show these.

## Questions

| # | Question | Answer | Reason | Screens |
|---|---|---|---|---|
| A1 | Does it look good? Would a 16-year-old want to play with it? | **Yes** | It is polished and atmospheric: a starfield dome, clean geometry with colour coding, constellation art, and the Usui-chan mascot for charm. It looks like a real tool, not a homework sheet. | 01, 05, 07, 09 |
| A2 | Does a beginner know what to do first? | **Partly** | On desktop, Usui says "Thử bấm vào một ngôi sao…" and the hint repeats it, but the panel's numbered "1. Bạn đứng ở đâu?" offers a second starting point. On phone, the hello banner drops the "bấm vào một ngôi sao" cue and invites the user to tap Usui instead. | 01, 02 |
| B1 | Is there one dominant element per screen, with a sensible reading path? | **Yes** | The horizon dome dominates the app screens. The grid dominates the USACodex. The dialog dominates the reset screen. The Simple panel reads 1 → 2 → 3. The only real dilution is the expanded Full state (B2c). | 01, 03, 05, 08, 11 |
| B2a | Focus layout: is the horizon view clearly dominant? | **Yes** | It takes about 68 % of the width at 1440 px and about 68 % at 1280 px. The sphere and details sit clearly second. | 05, 07 |
| B2b | Are the hidden data and controls discoverable from "Số liệu" and "Bảng điều khiển"? | **Yes** | Both are labelled buttons with chevrons in a persistent bottom bar. "Số liệu" also previews LST and the selected object inline, which invites a click. | 05, 07 |
| B2c | Does the expanded state still read well? | **Partly** | The data bar and controls read cleanly. But the layout becomes four dense columns, and the sphere view shrinks to a thumbnail of about 90 px with overlapping labels ("Capella", "CAPRICORNUS", "Đ"), which is unreadable. | 06 |
| C1a | USACodex: does it feel like a collectible codex? | **Partly** | The collection mechanics are there: per-category counters and progress bars, "3/44 đã khám phá", lock icons, "MỚI" tags and line-art illustrations. The cards themselves are flat grey and look the same whatever their state, so collecting has little visual payoff. | 08, 09, 10 |
| C1b | Are the locked, new and read states clear without colour? | **Partly** | Locked is clear: a dashed border, a lock icon and "chưa khám phá". New is clear: a solid border, a "MỚI" pill and a dot. **The read state appears in none of the 12 screenshots**, so I cannot judge it. | 08, 09, 10 |
| C1c | Is the unlock moment rewarding but not pushy? | **Partly** | It is not pushy: a small "✓ Đã mở khóa" pill under the title, and the counter moves to 9/44. In the captured frame, though, it is about as loud as the subtitle and does not feel like a reward. The animation is not judged. | 09 |
| C2 | Is the selection pulse visible but calm? | **Yes** (still only) | It is one thin white ring with no colour or glow, and it is clearly visible on the dark sky. The full cyan azimuth ring around the observer is louder than the pulse at that moment. The motion itself is not judged. | 04, 01 |
| C3 | Is the reset confirmation clear about what happens? Is "Hủy" the safe default? | **Partly** | The copy is excellent: "Sẽ đặt lại:" and "Vẫn giữ:" lists. No focus ring is visible on "Hủy", so the screenshot does not show it as the default. The filled orange "Đặt lại" is the most salient element. The title "Đặt lại mọi thứ?" contradicts the "Vẫn giữ" list. | 11 |
| D1 | Is orange used only for interactive elements? | **Yes** | Orange appears only on: the active mode tab, the active location chip, slider fills, checkboxes, the speed segment, the active Codex category, the opened toggles, the "Xem trong mô phỏng" CTA and the confirm button. The data, labels and badges are neutral. The text on orange is dark. | 01, 05, 06, 08, 09, 11 |
| D2 | Does any colour confuse meaning? | **Partly** | The status pill is good: a neutral pill whose word carries the meaning, with a teal dot matching the zone swatch. But that zone key is hidden by default. The teal sits next to the cyan azimuth arc. Pink means "Đường thẳng đứng" and altitude in the scene, but means "địa điểm ở Việt Nam" on the controls map. The purple-haired observer and avatar cause no confusion. | 03, 04, 06 |
| D3 | Is any text too small or too dim? | **Partly** | Nothing is too dim: muted text measures 5.7:1 to 9.4:1. But the explanatory sub-lines sit at about 12.5 to 13 px, right on the floor. These include "hướng nhìn, đo từ Bắc qua Đông", "Kéo để xoay…", "chưa khám phá", "2/7 đã khám phá" and the diagram caption. The faded "MỌC – LẶN" at the bottom of the details panel is 3.1:1. | 03, 05, 08, 09 |
| E1 | Phone: any layout problems? | **Partly** | I saw no horizontal overflow, and the Simple phone screen and the USACodex on phone are clean. In Full mode on phone, the header grows to three rows (about 150 px), with "Cơ bản / Đầy đủ" alone on its own right-aligned row. The below-horizon label also covers its own marker. | 02, 10, 12 |

## Ranked remaining problems

1. **High: a wrong term in USACodex teaching content.** In 08 and 10, the Nền tảng grid, the third card, the title reads "Thiên đỉnh và thiên **đế**". The astronomical term for nadir is "thiên **để**"; "thiên đế" means the Emperor of Heaven.
   - **Fix:** change it to "Thiên đỉnh và thiên để" in the Codex content. Search all strings for "thiên đế" and replace every occurrence.
2. **Medium: the sphere view is crushed when both toggles are open.** In 06, the Thiên cầu card in the middle column shows the sphere at about 90 px, and the "Capella", "CAPRICORNUS", "B/T/Đ" labels collide.
   - **Fix:** give the sphere canvas a minimum height of about 220 px.
   - If that does not fit, collapse the card to its header with an "Mở thiên cầu" affordance while both drawers are open, instead of rendering a thumbnail.
3. **Medium: the below-horizon label covers its own marker.**
   - **Where:** in 06, at the bottom centre of the horizon view, the label box overlaps the dashed circle. In 12, on phone, the circle and the ▼ arrow are almost entirely hidden behind "Sirius đang ở dưới chân trời (h = −54°)".
   - **Fix:** offset the label to the side of the marker that has room, with an 8 px gap. Never draw the label box over the marker.
4. **Medium: the first action on phone is not "tap a star".**
   - **Where:** in 02, the hello banner under the dome reads "Bấm vào mình để mình giải thích các nút". On desktop (01), the hello says "Thử bấm vào một ngôi sao trên bầu trời nhé!"
   - **Fix:** lead the phone banner with the same first action, for example "Chào bạn! Thử chạm vào một ngôi sao nhé. Bấm vào mình nếu muốn hỏi về các nút."
5. **Medium: the reset dialog's safe default is not evidenced, and the title over-promises.** In 11, at the dialog footer, no focus ring shows on "Hủy", and "Đặt lại mọi thứ?" conflicts with the "Vẫn giữ:" list.
   - **Fix:** focus "Hủy" when the dialog opens, with the orange focus ring visible.
   - Retitle the dialog to "Đặt lại mô phỏng?".
6. **Low: the phone Full header takes three rows.** In 12, at the top, the logo, the action row and a lone "Cơ bản / Đầy đủ" row together take about 150 px. "Ôn tập" has a brighter border that reads as selected.
   - **Fix:** use the single-row pattern from Simple (02), with the mode switch in row 1 and "Ôn tập" as an icon button. Give "Ôn tập" the same border as its neighbours.
7. **Low: the unlock reward is faint.** In 09, under the entry title, the "✓ Đã mở khóa" pill has the same weight as the subtitle.
   - **Fix:** keep the calm tone, but make the moment land once. For example, the category progress bar fills with a short ease and the pill gets a one-time soft glow. Respect `prefers-reduced-motion`.
   - First confirm the read state has its own non-colour cue, because no screenshot shows it.
8. **Low: the status dot's colour key is hidden.** In 03 and 04, the details panel's "Trạng thái" pill shows a teal dot, but the zone legend that defines teal is off by default. The teal also sits next to the cyan azimuth arc.
   - **Fix:** in the "Trạng thái" `?` tip, show the three statuses with their dots. Or show the three zone swatches next to the pill.
9. **Low: pink is reused for map places.** In 06, the Vị trí tab map uses "Chấm hồng: các địa điểm ở Việt Nam", but pink already means the vertical circle and altitude in the scene and legend.
   - **Fix:** use white or neutral grey dots for the map places, and keep the red/orange pin for the current location.
10. **Low: explanatory text sits on the 13 px floor.** This affects the sub-lines in the details panel (03, 05), the "Kéo để xoay · bấm vào một ngôi sao" hint (01), "chưa khám phá" and "2/7 đã khám phá" (08), and the diagram caption (09).
    - **Fix:** set these to at least 13 px, or 14 px for the details-panel sub-lines, which beginners actually read.
11. **Low: the details panel cuts off with only a fade.** In 05, the bottom of the right column shows "MỌC – LẶN" at 3.1:1 with no scroll cue.
    - **Fix:** add a visible scrollbar or a small "↓ thêm" cue when the content overflows.
12. **Low: the cardinal label collides with the altitude segment.** In 07, in the horizon view, the "B" sits directly under the pink altitude tick below Polaris.
    - **Fix:** nudge cardinal labels outward, or draw them above the measurement overlays.

## Overall verdict

AstroSphere is visually confident and coherent:

- The brand orange is disciplined and confined to things you can press.
- The scene colours are consistent between the dome, the sphere, the legend and the USACodex diagrams.
- The Simple screens have one obvious focal point and a numbered path.
- The focus layout makes the horizon view the hero, and the "Số liệu" and "Bảng điều khiển" toggles are easy to find.
- The below-horizon explanation, the plain-language sub-lines and the reset copy show real care for beginners.

Three areas are weaker:

- **The expanded Full state:** the sphere view is crushed.
- **The USACodex:** the collection mechanics work but give little emotional payoff. The read state is not evidenced in these screenshots.
- **The phone first-run:** it loses the "tap a star" cue.

None of these blocks a demo. One should be fixed before a room of astronomy students sees it: the "thiên đế" term in the USACodex, a one-word change. **Verdict: ready to show the club once that term is corrected.** Items 2 to 5 should be fixed before a wider public launch.

---

## Coordinator note (2026-10-06): problem 1 does not reproduce in the content

- **Source is correct.** The USACodex entry title in `src/i18n/codex.vi.json` is "Thiên đỉnh và thiên để". The final letter is U+1EC3 (LATIN SMALL LETTER E WITH CIRCUMFLEX AND HOOK ABOVE), as `unicodedata` confirms. No string in `src/` or `docs/` contains "thiên đế".
- **Cause: the render font.** The test container substitutes a fallback for Arial, and at a 4× crop of `08-usacodex-grid-1440.png` that font draws the hook above "ê" so small it reads as an acute ("ế"). This is an artefact of the screenshot environment.
- **Still to do.** Check the accent on a real device with Arial, or a Vietnamese-capable system font, before the club demo. No content change is needed.

Problems 2–12 stand as written.
