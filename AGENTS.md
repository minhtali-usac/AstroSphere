# AGENTS.md: how to work in this repository

AstroSphere is the USAC astronomy club's celestial-coordinate simulator (CLB Thiên văn USAC, Trường ĐH KHTN – ĐHQG TP.HCM).

- It is a static web app. The interface is bilingual: Vietnamese and English, switched with the «EN»/«VI» button beside the mode switch (see «Interface text»).
- Stack: Vite 8, TypeScript, and Three.js 0.186.
- There is no UI framework, no web font, and no network access at runtime.
- It deploys to GitHub Pages (`astrosphere.clbtvusac.com`) on every push to `main`; see `.github/workflows/deploy.yml`.

Read this file before changing code. The product brief is `brief_mo_phong_he_toa_do_thien_cau.md`. Open review findings are in `TODO.md`. Redesign records are in `docs/redesign/`.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Install exact dependencies |
| `npm run dev` | Vite dev server. In dev, `window.__app` and `window.__perf` expose internals |
| `npm test` | Vitest unit tests. These must pass before every commit |
| `npm run build` | `tsc --noEmit` followed by `vite build` into `dist/`. Must pass before every commit |
| `npm run preview` | Serve `dist/` |
| `npm run data` | Regenerate `src/data/generated/*.json` from npm packages. **Never hand-edit the generated JSON.** |
| `npm run fetch-sky` | Network fetch of Hipparcos parallaxes (CDS VizieR, I/311) and confirmed exoplanets (NASA Exoplanet Archive, `pscomppars`) into `src/data/fetched/hip-parallax.json` and `exoplanets.json`, plus Hipparcos proper motions (same query, columns `pmRA`, `pmDE`, mas/yr) into `hip-motion.json`. Validates before writing; `meta.retrieved` changes only when the data changes. **Never hand-edit the fetched JSON.** `.github/workflows/refresh-sky-data.yml` runs it every Monday and opens a PR on change (the repo setting "Allow GitHub Actions to create and approve pull requests" must be on). The deploy workflow never fetches. |
| `node docs/redesign/uat/<name>.mjs` | Browser acceptance checks |

The browser acceptance checks:
- use the global Playwright at `/opt/node-tools/node_modules/playwright` with Chromium in `/opt/pw-browsers`;
- run against `npx vite preview --port 4173 --strictPort`;
- need the launch flags `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- start in Full mode: a fresh visitor lands in Simple, so the `docs/redesign/uat/` scripts store `astrosphere.mode.v1 = "full"` in an init script. `docs/redesign-2/uat/modes.mjs` covers Simple (it needs the dev server).
- run in Vietnamese: they pass `locale: 'vi-VN'` to the browser context (an English-language browser gets the English interface);
- skip Usui-chan's first-visit hello: every UAT except `docs/redesign-2/uat/guide.mjs` stores `astrosphere.guide.v1 = {"hello": true}` in its init script.

## Architecture rules

- **`src/astro/`** holds pure maths: no DOM, no three.js, unit tested against `astronomy-engine`. Do not change the maths without adding tests that prove it.
- **`src/scene/`** is the only code that imports three.js at runtime, and only through the lazy `scene/boot.ts` chunk.
  - UI code (`src/ui/`) may use `import type` from scene files, and gets colours from `scene/colors.ts`.
  - A runtime import of three from UI code puts three back into the entry chunk.
- **One `Store`** (`src/state.ts`).
  - Change state only through `Actions`.
  - State updates are immutable, because layers detect changes by reference.
  - Both 3D views render only from the store, which is what keeps them in sync.
- **Shared scripting helpers** live in `src/scenario.ts`: `ensureConstellation`, `selectHip`, `zones`, `PLACES`. The Ôn tập learning tasks use them.
- **Render loop:** `src/runtime/frameLoop.ts`. Adaptive quality: `src/runtime/quality.ts`.
- **Browser storage** goes only through `src/ui/storage.ts` (`readJson` with a type guard, and `writeJson`). Wrap every access in try/catch. Keys in use:

| Key | Storage | Content |
|---|---|---|
| `thien-cau.hoc-tap.v1` | localStorage | Learning-task progress |
| `astrosphere.quality.v1` | sessionStorage | The user restored full quality |
| `astrosphere.hint.v1` | localStorage | The user has dragged or clicked a 3D view once, or selected a star; the hint caption under the horizon view (always small and muted) is then hidden on phones, and Simple mode's first-action cue ("Bấm vào một ngôi sao…", `src/ui/simpleControls.ts`) is not shown on later visits |
| `astrosphere.lang.v1` | localStorage | The interface language the user chose, `"vi"` or `"en"` (`src/i18n/locale.ts`). Order: `?lang=` → this value → the browser's languages (any `vi*` gives Vietnamese, otherwise English) |
| `astrosphere.mode.v1` | localStorage | The interface mode the user last chose, `"simple"` or `"full"` (`src/ui/mode.ts`). With no value a visitor lands in Simple. `?mode=simple\|full` overrides it for one page load and is not stored |
| `astrosphere.focus.v1` | sessionStorage | `{data: boolean, panels: boolean}`: whether the Full-mode focus layout (≥ 1101 px) has the data bar and the control panels open (`src/ui/focusLayout.ts`, guard `isFocusState`). Both start closed |
| `astrosphere.codex.v1` | localStorage | Codex progress `{discovered: string[], read: string[]}` (entry ids); guard `isCodexProgress` in `src/codex/triggers.ts` |
| `astrosphere.guide.v1` | localStorage | `{hello: true}` once Usui-chan has said her one-time hello (written as soon as it shows); guard `isGuideState` in `src/guide/state.ts`. UATs that do not test the hello pre-set it in their init scripts |
| `astrosphere.history.v1` | localStorage | `{intro: true}` once «Bầu trời xưa» has shown its welcome card (written as soon as it shows); guard `isHistoryState` in `src/history/index.ts`. The «Giới thiệu» button reopens it. UATs that open the dialog and do not test the card should pre-set it |
| `astrosphere.sgk.v1` | localStorage | Thử thách SGK (`src/games/`): the teacher's picked activities, options (hints, shuffle, quiz count) and best score per activity; guard `isSgkState` in `src/games/progress.ts` |

## PWA (install and offline)

- `public/manifest.webmanifest` + icons in `public/icons/` (rendered from `src/assets/usac-logo.png`).
- `vite build` writes `dist/sw.js` from `scripts/sw.template.js` (the `pwa` plugin in `vite.config.ts`): it precaches every file in `dist` except `CNAME`, `.vite/` and the KaTeX `.ttf`/`.woff` fonts, under a cache named by a content hash. Never edit `dist/sw.js`.
- `src/pwa.ts` registers it (production only), shows the footer install button (only when the browser offers install, or on iOS with "Thêm vào MH chính" instructions) and the "Đã có phiên bản mới · Tải lại" notice. A new version waits until the user reloads, so an open tab never loses its lazy chunks.
- Any new runtime file must live in `dist` (bundled or in `public/`) so it is precached; the app must not fetch from other origins.

## Interface text (i18n)

- **Two languages.** Every Vietnamese string file has an English twin with the same keys and `{parameters}`: `vi.json`/`en.json`, `dialogs.*.json` (Help, About, object catalogue; merged into `t()` by the dialogs chunk), `codex.*.json`, `history.*.json`, `flight.*.json`. `src/i18n/en.test.ts` enforces parity, forbids leftover Vietnamese and compiles the formulas. Add a string to both.
  - `src/i18n/locale.ts` decides the language once per page load (`LANG`, `pick(vi, en)`); switching reloads the page. It is pure, so `astro/format.ts` uses it (decimal comma and B/N/Đ/T in Vietnamese, decimal point and N/S/E/W in English). Data modules with inline text (places, constellation notes, deep-sky types, comets, review tasks) use `pick`.
  - `src/boot.ts` is the page entry: it loads the one dictionary needed (`loadDictionary()`), then imports `main.ts`. **Do not use top-level await in `src/`**: it makes the bundler split the entry into many small chunks and breaks the size budget. Tests get the Vietnamese strings from `src/i18n/testSetup.ts`.
  - English constellation names and abbreviations are the official IAU ones (tested against the full list of 88). Vietnamese names of objects still appear in the detail panels.
  - **Thử thách SGK is hidden in English** (it follows a Vietnamese textbook) and is not translated.
  - `index.html` is Vietnamese; `main.ts` sets `lang`, title, description and `manifest.en.webmanifest` for English.
- Vietnamese strings live in `src/i18n/vi.json` (and the files above). Read them with `t('literal.key')` or `tList('literal.key')`.
- `src/i18n/i18n.test.ts` enforces three rules:
  - Every literal key exists.
  - No common English words appear in any string. The banned words are: the, and, reset, help, about, start, pause, stop, speed, show, hide, star(s), trail, north, south, east, west, settings, loading, error.
  - The formulas in `help.body` and `about.body` compile in KaTeX.
- Keys built at runtime (template strings) are invisible to that test. Any new dynamic key family needs its own unit test that checks every generated key exists.
- **Usui-chan's explanations** (`src/guide/`, see `docs/redesign-2/guide.md`): every interactive control carries `data-guide="<key>"`, and its text is `guide.tip.<key>` in `vi.json`. Write the key as a literal (`'data-guide': '<key>'`, `guide: '<key>'` or `guide('<key>', el)` from `ui/dom.ts`); `src/guide/guide.test.ts` collects them and fails on a missing string, an orphan string or a new non-literal assignment. A new control needs a key and a tip of at most two sentences.
- **Thử thách SGK** (`src/games/`) is a separate lazy chunk opened from its own tile in the USACodex nav: ten interactive activities for Bài 4 and Bài 5 of the textbook topic «Trái Đất và Bầu Trời». It only reads app data (stars, constellation figures) and never changes the simulation state. Its strings live in `src/i18n/games.vi.json` (same banned-word rule, enforced by `src/games/games.test.ts`) and its styles in `src/games/games.css` (tokens only; its colours are the `--sgk-*` tokens in `:root`).
- **«Bay vào vũ trụ»** (`src/scene/flight/`, lazy chunk `scene/flight/boot.ts`, opened by `openFlight()` in `src/ui/flight.ts`):
  - Strings needed before the chunk loads (button, dialog title, guide tips) live in `vi.json` (`top.flight*`, `info.fly*`, `flight.*`, `guide.tip.flight*`). Everything else lives in `src/i18n/flight.vi.json`, read with `ft()` from `src/scene/flight/text.ts`; `src/scene/flight/text.test.ts` applies the banned-word rule and checks every literal and dynamic key family.
  - Positions are 64-bit km in J2000 equatorial coordinates with the Sun at the origin; the camera stays at (0,0,0) (floating origin, `origin.ts`) and the renderer uses a logarithmic depth buffer. Planet positions: `src/astro/planets.ts` (JPL Keplerian elements, Meeus Moon), tested against astronomy-engine.
  - Every value that is not a measurement carries a tag in the info panel: «ước tính» (derived) or «ứng dụng tự chọn» (no data; chosen by the app, e.g. exoplanet orbit orientation, seeded from the name). Surfaces and colours are illustrations; only Earth's continents are data.
  - While it is open the two main views are suspended (`loop.suspend('flight', …)`); it runs its own rAF loop and quality controller and disposes its WebGL context on close.
  - Dev hook `window.__flight` (the `FlightView`). Browser check: `node docs/redesign/uat/flight.mjs` against the dev server (`UAT_URL`, `PLAYWRIGHT` env vars).
- **«Bầu trời xưa»** (`src/history/`, lazy chunk opened by `openHistory()` in `src/ui/history.ts`, top-bar button in both modes): the sky as people saw it at any place and date from 6001 BC to AD 3000, in a full-screen `<dialog>`. Two views fed by the same `Scene` data: the default 3D dome (`src/scene/history/dome.ts`, same look as the horizon diagram, three.js shared with the main views, drawn on demand, falls back to the flat map if WebGL fails) and a flat canvas-2D map (`src/history/view.ts`). The 3D observer is Usui-chan (`public/models/usui-chan.glb`, loaded when idle, same handling as the horizon diagram) with a first-person toggle. While the dialog is open the guide is docked into it (`Guide.dock`) so Usui-chan's explain mode works in the top layer. It never changes the simulation state.
  - Maths core (pure, tested against `astronomy-engine` and against events: Eddington 1919, Thales 585 BC, Thuban as pole star near 2800 BC): `src/astro/history.ts` (Julian/Gregorian calendar with astronomical year numbering, ΔT of Espenak & Meeus, IAU 2006 precession matrix, Laskar obliquity, linear proper motion). The three corrections (precession, proper motion, ΔT) each have an on/off switch in the UI so teachers can compare.
  - `src/history/model.ts` turns settings into a `Moment` (local mean solar time → UT → TT, GMST, precession matrix) and fills alt/az for a `StarSet` without allocating. `bodies.ts` is the only file that imports `astronomy-engine` at runtime (Sun, Moon, naked-eye planets); it replaces the engine's ΔT with ours via `SetDeltaTFunction`. `astronomy-engine` is therefore a **dependency**, not a devDependency, and lives only in the lazy chunk (≈ 40 kB gzip with the rest of the chunk). User-facing copy follows the app's voice (friendly, second person, no library or command names); never mention `npm` or package names in a UI string.
  - Proper motions: `src/data/motion.ts`. It prefers `fetched/hip-motion.json` (whole catalogue, written by `npm run fetch-sky`, picked up with `import.meta.glob` so a missing file is fine) and falls back to the curated table `CURATED` (about 65 bright and fast stars; `motion.test.ts` checks each HIP against the catalogue name). The UI says which source is active.
  - Strings needed before the chunk loads (button, dialog title, guide tips) live in `vi.json` (`top.history*`, `history.*`, `guide.tip.history*`). Everything else lives in `src/i18n/history.vi.json`, read with `H`/`fmt()` from `src/history/text.ts`; `text.test.ts` applies the banned-word rule. Dialog shell styles are in `src/styles.css` (`.hsky-dlg*`), the layout inside in `src/history/history.css`. Sky background colours are the `--hsky-*` tokens in `:root`.
  - The sky rotates by itself on open (not with reduced motion); Esc closes the native `<dialog>` directly. The global shortcuts are off while it is open (`isHistoryOpen()`). While it is open the two main views are suspended (`loop.suspend('history', …)`).
  - Accuracy limits (shown in the UI): Moon and planets are less certain than stars far from today, ΔT before AD 1600 is known only from ancient eclipse records, star brightness is kept as today.
- **USACodex** is the user-facing name of the codex (the code, file names and storage key keep `codex`). Its content lives in a second file, `src/i18n/codex.vi.json` (categories, entries, diagram labels). Only the lazy codex chunk (`src/codex/ui.ts`) imports it, so it never enters the entry chunk. The Codex interface strings stay in `vi.json` under `codexUi`.
  - `src/codex/codex.test.ts` applies the same banned-word rule and KaTeX check to it, and checks that every entry has a title, lede and body, that every `related` id, discovery-trigger id, `termLink` id and "Xem trong mô phỏng" action resolves to an entry.
  - Celestial object names (Polaris, Ursa Major, M31…) stay in English; give the Vietnamese name in the text.
- Number formatting follows the language; see `astro/format.ts`. Vietnamese uses a comma as the decimal separator, B/N for north/south and Đ/T for east/west.

## Brand

The brand comes from the club site https://web-usac.vercel.app/.

- **Accent:** `--accent #F26522` on near-black `--bg #0a0a0a`, with white text. Font: `Arial, Helvetica, sans-serif`.
- **Colours:**
  - Raw colour values are allowed only inside `:root` in `src/styles.css`. Everywhere else, use tokens.
  - Text on orange must be `--on-accent #0a0a0a`. White on orange has a 3.15:1 contrast ratio, which fails.
  - The focus ring is orange, not yellow, because yellow means the celestial equator in the scene.
- **3D scene colours** (`scene/colors.ts`) carry meaning and are never rebranded. Examples: equator yellow, axis blue `#4f9dff`, zones purple/teal/red.
- **App name:** AstroSphere. The page title and link-preview tags (`og:*` in `index.html`) read "AstroSphere - Hệ thống mô phỏng Hệ tọa độ"; the preview image is `public/og-logo.png`.
- **Club link:** exactly one link to the club Fanpage (https://www.facebook.com/clbusac), in the footer. The logo is `src/assets/usac-logo.png`; the project group's STELLAR logo (`src/assets/stellar-logo.png`) sits beside it in the top bar.

## Performance budgets

- Entry JS (boot, `main.ts` and one dictionary) must stay at or below 90 kB gzip (88.2 kB with the two languages). three.js loads only through `import('./scene/boot')`.
- The «Bầu trời xưa» chunk (with `astronomy-engine`) stays below about 45 kB gzip; the entry chunks stay at or below 90 kB gzip (87.3 kB after adding it).
- The flight-mode chunk stays at or below 35 kB gzip and its fetched data at or below 25 kB gzip (both excluding three.js). `docs/redesign/uat/bundle-size.mjs` enforces all three budgets.
- Nothing in `update()` or `frame()` may allocate: no `new`, `clone()`, or array literals there. Use scratch objects.
- Playback must create no new `LineGeometry` and call no `createBuffer`. Update dynamic lines in place with `writeFatLine`.
- DOM writes during playback are capped at about 15 Hz (the frame loop's `onUiTick`). Write a cell only when its value changed.
- No drawing when a view is hidden, scrolled off screen, or the tab is in the background.
- Target at least 50 FPS with about 1000 stars on a mid-range laptop. Adaptive quality steps down below about 36 FPS. `?quality=fixed` turns it off.

## Accessibility

- Respect `prefers-reduced-motion`: no autoplay, and draw trails statically.
- Return focus to the opener when a drawer or sheet closes.
- **Esc priority:** dialog (including the USACodex) → Usui-chan's hello / explain mode → learning drawer → clear the selection. Esc never fires while the user is typing.
- Global shortcuts must not hijack interactive elements:
  - Space is ignored on buttons, links, `summary`, and inputs.
  - Arrow keys are ignored inside `role=tablist`, `slider` and `radiogroup`.
- Touch targets are at least 44 px on phones. A 375 px wide viewport must have no horizontal scrolling.

## Git

- Work branches are named `claude/<topic>`; parallel stream branches are `redesign/<stream>`. Merge them with `--no-ff`.
- Commit subjects are descriptive and start with a scope: `ui:`, `scene:`, `perf:`, `data:`, `docs:`, `build:`, or `test:`. No one-letter messages.
- Each commit should pass `npm test` and `npm run build`.
- When fixing a `TODO.md` item, mark it `[x]` and cite the commit hash.
