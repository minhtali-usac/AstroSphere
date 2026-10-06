# Design review round 4 (2026-10-05), final

A fresh-context reviewer looked at `review-4/`, rendered after fix round 3.

| Question | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| A1/A2 message and first idea | yes / partly | yes / partly | yes / yes | **yes / yes** |
| B1–B3 one dominant area, sensible path | no | no | partly | **yes** (left view dominates; path ends on the formula, then the numbers) |
| B4 phone first view | no | yes* | partly | **no**: the view-button strip pushes the dome down to about a third of the screen |
| C1 grouping | yes | yes | yes | yes |
| D2 collisions | no | no | no | **no** (less): labels near the pole are crossed by constellation lines |
| E3 pushy | no | not pushy | not pushy | **not pushy** |
| F1/F2 linked highlight | no | partly | mostly | **yes** |
| G1 accent discipline | no | yes | yes | **yes** |
| G2 colour confusion | no | minor | no clash | **new finding**: constellation colours (light blue Ursa Major, pink Ursa Minor) imitate the axis blue and the vertical-circle pink |
| G3 dim text | no | no | some | some (small grey captions, placeholders); measured contrast is 8.13–8.79:1, so the issue is size, not ratio |
| H1 projector | no | no | partly | partly: header text, thin lines and grey star names remain marginal |

Measured: color-theory T1 value focal on the horizon card is 0.93× (**FAIL**, ≥ 2× default); on the pole/axis region it is 1.37× (FAIL). T5 chroma: PASS.

Left open, as follow-ups in `TODO.md`:
- neutral constellation colour (G2);
- phone view-button strip (B4);
- projector header and star-label sizing (H1);
- remaining label/line crossings near the pole (D2).
