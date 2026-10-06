# Grounded — run `redesign-2026-10-04`

Coordinator: Claude Code session. Date: 2026-10-04.

## Project instruction files
No `CLAUDE.md`, `AGENTS.md` or `wiki/` in the repo, so there are no recorded decisions to honour or reopen.

## README.md
- **Claim:** this is a static, fully Vietnamese web app (Vite + TypeScript + Three.js). It has two synced 3D views, four control panels, an info card, a live data table, 12 learning tasks and keyboard shortcuts.
- **Evidence:** the code matches this; the tests pass (33/33) and the build passes.
- **Implication:** the redesign has to keep every feature listed there, and keep the 7 acceptance criteria table passing.
- **Missing:** the ≥ 50 FPS claim was measured by hand ("≈ 3,3 ms/khung"); nothing automated checks it.

## brief_mo_phong_he_toa_do_thien_cau.md
- **Claim:** the product goal is three learning outcomes:
  1. why the sky rotates, and why the pole's altitude equals the latitude (φ);
  2. how equatorial coordinates (α, δ, H) relate to horizon coordinates (A, h);
  3. how circumpolar, rise/set and never-rise stars depend on latitude.
- **Implication:** these three outcomes are the natural backbone for the story.
- **Missing:** no target audience device, and no classroom or projector use case.

## Club brand — https://web-usac.vercel.app/ (fetched 2026-10-04)
- **Evidence from `style.css`:** one accent colour, `#F26522` orange (20 uses, plus the 76-alpha variant 6×). Neutrals are black/white. The font is `Arial, Helvetica, sans-serif`. Border radii are 5–25px.
- **Evidence from `img/logo-svg.svg`:** a white/greyscale wordmark.
- **Evidence from `img/slogan.png`:** a slogan image.
- **Copy:** "khoa học cho mọi người". The club is the astronomy club of the University of Science, Vietnam National University – Ho Chi Minh City (Trường ĐH KHTN – ĐHQG TP.HCM).
- **Context:** the site dates from 2022 and is jQuery-based. It provides brand tokens, not a component system.
- **Missing:** no brand guideline document, and no licence statement for its images. The repo already ships `src/assets/usac-logo.png`.

## Current UI and performance (from this session's code review)
- **Styles:** `src/styles.css` uses a blue accent `#4f9dff` (off-brand) and a system font stack.
- **Main JS:** 878 kB, 258 kB gzip. KaTeX is already lazy-loaded.
- **Star data:** the generated JSON is bundled into the main chunk.
- **Rendering:** line geometry is rebuilt every frame (see `TODO.md`).

## Lane check (2026-10-04, this container)
- `~/.config/agent-capabilities/subagent.env`, `subagent`, `codex`: absent.
- **Open lanes:** only the Claude Agent tool, sharing the session budget. Cap the run at 8 agents or fewer.

Grounded: README, brief, styles.css, TODO.md (review), club site HTML/CSS/logo → constraints are: keep every listed feature and the 7 acceptance criteria; brand = orange `#F26522` on black/white with Arial; story = the brief's 3 learning goals; Claude-only lanes, ≤ 8 agents.
