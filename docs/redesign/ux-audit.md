# UX audit before "storytelling through the interface" (2026-10-04)

Audit-first redesign (frontend stage 9). Baseline build of `redesign/ux` at `3eef2b1`, served by `vite preview` on port 4186 with `?quality=fixed`.

- Screenshots: `docs/redesign/shots/ux-before-1440.png`, `ux-before-1440-full.png`, `ux-before-375.png`, `ux-before-375-full.png`.
- Routes and states inspected: first load (Hà Nội, Polaris selected, paused) at 1440×900 and 375×812; display panel groups; info card with and without a selection; location panel.
- The findings are ranked by user impact: broken reading path and missing explanation first, visual noise last.
- Each finding names the rule it applies and the stage that fixes it. The brief is `docs/redesign/ux-brief.md`.

| # | Finding (route, state, evidence) | Rule applied | Fix stage / brief section |
|---|---|---|---|
| 1 | **Two equal views compete for "number one".** The views use a 1fr/1fr grid at 1440. The celestial sphere (the *why*) sits on the left and is read first; the horizon diagram (the *what you see*) comes second. This reverses the concept order in the product brief. | One dominant figure with subordinate elements reads more clearly than several competing focal claims (visual-design, composition-and-movement, 5642 · U4 · L55 · 00:08–01:27). | Composition; brief §2 |
| 2 | **The φ = pole-altitude equality is not visible.** The numbers bar reads φ, λ, LST, GST, then pole altitude. Pole altitude sits four cells from φ, so the key relation of the subject is never seen side by side. | Plan where the path begins and ends (5642 · U2 · L20 · 01:56–03:37); introduce encodings in the order readers meet them (information-design, annotation-and-narrative, 4217 · U4 · L17 · 05:16–10:59). | Composition; brief §2 |
| 3 | **Numbers without meaning.** Every bar cell is a label plus a value. "Độ cao thiên cực 21,03°" never says why it equals φ, and "LST" never says what it means on the sky. The meaning lives only in `title` tooltips, which touch users cannot reach. | Each encoding needs a matching explanation near the mark (information-design T7, 3069 · U3 · L11 · 14:33–16:28); do not hide key instructions in hover-only interactions (frontend anti-pattern list). | Content; brief §4 |
| 4 | **A static first scene.** The app opens paused, so the central idea (the sky turns about one point at altitude φ) is not shown. The strongest orange element is the "Bắt đầu" button below the fold. On a phone there is no gesture hint at all, because `.view__hint` is `display: none` under 900 px. | Onboarding covers what the product does, how to use it, and a timely next step (ux 07, 798 · U4 · L11 · 01:14–03:22). | Onboarding; brief §3 |
| 5 | **The info card disappears when nothing is selected.** After Esc the card is `hidden`, so the space gives no sign that selecting a star is possible or what it would show. | Empty state: where you are, why it is empty, what will appear, and a relevant action (ux 07, 798 · U4 · L11 · 07:26–10:30). | Content; brief §4 |
| 6 | **Display toggles are grouped by geometry, not by idea.** "Cơ bản" mixes the hour circle, the equator, the underside, three zones and the angle, and opens seven boxes at once. "Đường và mặt phẳng" groups nine unrelated lines. The groups do not follow the story order of the brief. | Organize and label content so people can find it (ux 05, 1490 · U6 · L21 · 00:00–01:33); a view can reveal information in stages (4217 · U2 · L06 · 01:08–02:00). | Information architecture; brief §5 |
| 7 | **Toggling something gives no feedback about what appeared.** Turning on "Kinh tuyến thiên cầu" draws a line but says nothing about what to notice. The only explanation is a hover tooltip. | Write for the whole task: what is happening, what is available, what comes next (ux 05, 798 · U2 · L05 · 09:05–11:31). | Content; brief §4 |
| 8 | **The latitude slider shows no consequence.** "Kéo vĩ độ" moves the scene, but the outcome (pole altitude = φ) appears far away in the numbers bar. | Microcopy should explain what is happening and help with the next action (ux 07, 798 · U3 · L09 · 06:25–08:48). | Content; brief §4 |
| 9 | **Border noise splits the page into about 30 boxed clusters at 1440.** Each data cell, view header, fieldset, `<details>` and panel has its own 1 px border. Grouping comes from lines instead of space, so view, numbers and controls do not read as three clusters. | Group elements into as few clusters as possible (5642 · U4 · L53 · 06:29–07:11); negative space groups and paces (5642 · U4 · L49 · 02:06–06:43). | Composition; brief §2 |
| 10 | **Copy tied to layout position.** The toggle "Chân trời trên thiên cầu (khung trái)" and its tip, and the About text ("Thiên cầu ở bên trái"), name a screen position. They become false as soon as the layout changes, and they never applied on phones, where views are tabs. | A label should let the person predict what a choice does (ux 07, 798 · U4 · L12 · 10:41–14:02). | Content |

## Not judged

- **Screen-reader order and spoken output.** These were inspected in the DOM only, not with a screen reader.
- **Visual balance and focal point.** These need a fresh-context reviewer. They are not judged here.
