# UX brief: storytelling through the interface (2026-10-04)

Owner decision 2026-10-04 withdrew the literal guided story ("too much in your face") and replaced it with storytelling carried by the UX itself.

- Scope: all five devices below, plus international English names for celestial objects.
- Each decision cites the design-skill lesson it applies.
- `derived` marks my own synthesis.

## 1. Brief (ux stage 1; visual-design stage 1; frontend stage 1)

- **Who and where.** Vietnamese high-school and university students, alone on a phone. Club presenters, on a laptop or projector. (Owner answers, 2026-10-04.)
- **The message to carry without narrating it.** Four ideas, in the order the brief introduces them:
  1. where I am;
  2. the sky turns about a pole that sits at altitude φ;
  3. two coordinate systems describe the same star;
  4. latitude decides which stars rise, set, never set or never rise.
- **Constraints.**
  - USAC brand tokens.
  - Every UI string is in `vi.json` and in Vietnamese.
  - Celestial **objects** use international English names. Reference circles and concepts stay Vietnamese.
  - Performance budgets as in `AGENTS.md`.
- **Hardest application.** A 375 px phone in portrait (visual-design principle 6: build for the hardest application). Also a washed-out 1920 px projector.

## 2. Concept order becomes reading order (visual-design: composition and movement; information-design: story and structure)

- **One dominant view.** The horizon diagram (what you see) becomes the visual "number one": left column, larger (about 3fr against 2fr). The celestial sphere (why it happens) is subordinate.
  - Source: "One dominant figure with subordinate elements reads more clearly than several competing focal claims" (5642 · U4 · L55 · 00:08–01:27).
  - Source: "Separate the main story from context" (2495 · U3 · L09 · 01:08–02:33).
- **Planned path.**
  - Sequence: horizon view → numbers bar (φ, then pole altitude, then equator angle, then LST) → panels (location → time → display → stars).
  - The φ and pole-altitude cells sit next to each other, so the equality is seen rather than stated.
  - Sources: "Plan where the path begins and ends" (5642 · U2 · L20 · 01:56–03:37); "decide the order the reader meets them" (4217 · U3 · L11 · 00:08–01:14).
- **Gestalt grouping.** As few clusters as possible: view area, numbers, controls. Spacing groups them, rather than borders everywhere.
  - Source: group into as few clusters as possible (5642 · U4 · L53 · 06:29–07:11).
  - Source: negative space groups and paces (5642 · U4 · L49 · 02:06–06:43).

## 3. Opening scene as the first sentence (motion; ux onboarding)

- On first load the Hà Nội sky turns slowly (one sidereal day in 60 s), with short trails and Polaris selected. The motion carries the meaning that the sky rotates about one point.
  - Source: "Make movement serve the message" (503 · U3 · L10 · 01:21–02:42).
  - Source: keep decorative motion subordinate to reading (derived from 503 · U3 · L10; 561 · U4 · L12).
- When `prefers-reduced-motion` is set, nothing autoplays; trails are drawn statically.
- **Onboarding is one timely next step, not a tour.** A single dismissible hint: "Kéo để xoay · bấm vào một ngôi sao". It is shown once (`astrosphere.hint.v1`).
  - Source: onboarding covers what the product does, its value, how to use it, and a timely next step (798 · U4 · L11 · 01:14–03:22).

## 4. Contextual text (ux: write for the whole task; information-design: explain marks near the marks)

- **Toggles.** A one-line meaning appears under a toggle only while it is on, explaining what just appeared.
  - Source: write for the whole task: what is happening, what is available, what comes next (798 · U2 · L05 · 09:05–11:31).
  - Source: put explanation near the marks (3069 · U3 · L11 · 14:33–16:28).
- **Numbers bar.** Each cell gets a sub-caption giving its plain meaning, e.g. "= |φ| — luôn bằng vĩ độ" under pole altitude.
  - Source: each encoding needs an explanation, and each explanation needs a matching value (derived, information-design T7).
- **Info card.**
  - Each row gets a one-line meaning (δ "≈ vĩ độ của sao", H "đã qua kinh tuyến bao lâu").
  - An empty state replaces the hidden card: where you are, why it is empty, and a relevant action.
  - Source: empty-state content (798 · U4 · L11 · 07:26–10:30).
- **Location panel.** A live line under the slider: "Thiên cực Bắc cao 21,03° — đúng bằng vĩ độ của bạn".
- **Tone.** Plain, friendly, never blaming; short sentences for a 16-year-old (ux T8).

## 5. Progressive disclosure (information-design: reveal in stages)

Display toggles are regrouped under concept names in narrative order:
1. Bầu trời quay
2. Chân trời của bạn
3. Hai hệ tọa độ
4. Mọc – lặn
5. Mở rộng
6. Nhãn

- Only the first group is open.
- Each closed group shows a one-line teaser.
- Source: "A view can reveal information in stages to invite exploration" (4217 · U2 · L06 · 01:08–02:00).
- First load starts with few overlays.

## 6. Linked highlights (show, don't tell)

Hovering or focusing a number lights up its geometry in both 3D views, and hovering the geometry lights up the number. About six pairs:

| Number | Geometry |
|---|---|
| pole altitude | pole-altitude arc + axis |
| equator angle | angle arc |
| selected A / h | azimuth / altitude arcs + vertical circle |
| LST / H | meridian + 0h hour circle |
| visibility status | its zone |

- **Motion (motion choreography).** The number is the trigger and the geometry follows within about 150 ms, with an ease-out on emphasis and no bounce. Instant under reduced motion. The cause and effect must read.
  - Source: trigger/follower (503 · U5 · L20 · 04:33–06:31).
  - Source: ease (503 · U2 · L08 · 06:22–09:12).
- **Colour (color-theory: functional colour).** Emphasis never relies on hue alone: the line gets thicker and fully opaque, and the cell value is bolded with an orange underline.
  - Source: hue must never be the only carrier of state (functional-color, signal policy).
  - The brand orange is reserved for UI accent and focus. Scene semantic colours are unchanged (sign/code function, 5642 · U3 · L26).
  - Watch the orange UI accent next to the orange ecliptic and yellow equator. Emphasis uses weight and opacity, not new hues.

## 7. Names of celestial objects (owner decision 2026-10-04)

- **English on 3D labels, lists and the numbers bar.** Stars, constellations, the Sun and the galactic centre use international/IAU names (Polaris, Sirius, Ursa Major, Orion, Sun).
- **Vietnamese secondary line in the info card only.** For example, "Sirius" with "Thiên Lang" beneath, so the folk name is not lost.
- **Stays Vietnamese.** Reference circles and concepts (xích đạo trời, kinh tuyến, thiên đỉnh) and all UI text.

## 8. Checks (each skill's review loop)

- **Code checks:** `npm test`, `npm run build`, the Playwright UATs (`smoke`, `ui`, `perf`, `ux`), the i18n test, and the colour-token greps.
- **Skill measures:**
  - `visual-design/scripts/checks.py` balance and focal on the rendered PNGs.
  - `color-theory/scripts/checks.py` contrast for the emphasis and accent pairs.
- **render-kit:** not installed in this container, so it is reported as **skipped**, never passed.
- **Fresh-context vision review.** A reviewer who did not build the work gets only the renders and the checklist questions:
  - ux review questions;
  - visual-design T1, T8 and T9 (message, focal element, reading path);
  - color-theory functional-colour redundancy.

  Results are reported as measured, judged, not judged or skipped.
