# AGENTS.md: how to work in this repository

AstroSphere is the USAC astronomy club's celestial-coordinate simulator (CLB Thiên văn USAC, Trường ĐH KHTN – ĐHQG TP.HCM).

- It is a static web app, and the whole interface is in Vietnamese.
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
| `node docs/redesign/uat/<name>.mjs` | Browser acceptance checks |

The browser acceptance checks:
- use the global Playwright at `/opt/node-tools/node_modules/playwright` with Chromium in `/opt/pw-browsers`;
- run against `npx vite preview --port 4173 --strictPort`;
- need the launch flags `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- start in Full mode: a fresh visitor lands in Simple, so the `docs/redesign/uat/` scripts store `astrosphere.mode.v1 = "full"` in an init script. `docs/redesign-2/uat/modes.mjs` covers Simple (it needs the dev server).
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
| `astrosphere.mode.v1` | localStorage | The interface mode the user last chose, `"simple"` or `"full"` (`src/ui/mode.ts`). With no value a visitor lands in Simple. `?mode=simple\|full` overrides it for one page load and is not stored |
| `astrosphere.focus.v1` | sessionStorage | `{data: boolean, panels: boolean}`: whether the Full-mode focus layout (≥ 1101 px) has the data bar and the control panels open (`src/ui/focusLayout.ts`, guard `isFocusState`). Both start closed |
| `astrosphere.codex.v1` | localStorage | Codex progress `{discovered: string[], read: string[]}` (entry ids); guard `isCodexProgress` in `src/codex/triggers.ts` |
| `astrosphere.guide.v1` | localStorage | `{hello: true}` once Usui-chan has said her one-time hello (written as soon as it shows); guard `isGuideState` in `src/guide/state.ts`. UATs that do not test the hello pre-set it in their init scripts |

## Interface text (i18n)

- Every user-visible string lives in `src/i18n/vi.json`. Read it with `t('literal.key')` or `tList('literal.key')`.
- `src/i18n/i18n.test.ts` enforces three rules:
  - Every literal key exists.
  - No common English words appear in any string. The banned words are: the, and, reset, help, about, start, pause, stop, speed, show, hide, star(s), trail, north, south, east, west, settings, loading, error.
  - The formulas in `help.body` and `about.body` compile in KaTeX.
- Keys built at runtime (template strings) are invisible to that test. Any new dynamic key family needs its own unit test that checks every generated key exists.
- **Usui-chan's explanations** (`src/guide/`, see `docs/redesign-2/guide.md`): every interactive control carries `data-guide="<key>"`, and its text is `guide.tip.<key>` in `vi.json`. Write the key as a literal (`'data-guide': '<key>'`, `guide: '<key>'` or `guide('<key>', el)` from `ui/dom.ts`); `src/guide/guide.test.ts` collects them and fails on a missing string, an orphan string or a new non-literal assignment. A new control needs a key and a tip of at most two sentences.
- **USACodex** is the user-facing name of the codex (the code, file names and storage key keep `codex`). Its content lives in a second file, `src/i18n/codex.vi.json` (categories, entries, diagram labels). Only the lazy codex chunk (`src/codex/ui.ts`) imports it, so it never enters the entry chunk. The Codex interface strings stay in `vi.json` under `codexUi`.
  - `src/codex/codex.test.ts` applies the same banned-word rule and KaTeX check to it, and checks that every entry has a title, lede and body, that every `related` id, discovery-trigger id, `termLink` id and "Xem trong mô phỏng" action resolves to an entry.
  - Celestial object names (Polaris, Ursa Major, M31…) stay in English; give the Vietnamese name in the text.
- Number formatting uses a comma as the decimal separator; see `astro/format.ts`. Use B/N for north/south and Đ/T for east/west.

## Brand

The brand comes from the club site https://web-usac.vercel.app/.

- **Accent:** `--accent #F26522` on near-black `--bg #0a0a0a`, with white text. Font: `Arial, Helvetica, sans-serif`.
- **Colours:**
  - Raw colour values are allowed only inside `:root` in `src/styles.css`. Everywhere else, use tokens.
  - Text on orange must be `--on-accent #0a0a0a`. White on orange has a 3.15:1 contrast ratio, which fails.
  - The focus ring is orange, not yellow, because yellow means the celestial equator in the scene.
- **3D scene colours** (`scene/colors.ts`) carry meaning and are never rebranded. Examples: equator yellow, axis blue `#4f9dff`, zones purple/teal/red.
- **App name:** AstroSphere. The page title and link-preview tags (`og:*` in `index.html`) read "AstroSphere - Hệ thống mô phỏng Hệ tọa độ"; the preview image is `public/og-logo.png`.
- **Club link:** exactly one link to the club Fanpage (https://www.facebook.com/clbusac), in the footer. The logo is `src/assets/usac-logo.png`.

## Performance budgets

- Entry JS must stay at or below 90 kB gzip. three.js loads only through `import('./scene/boot')`.
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
