// Codex › "Xem trong mô phỏng": mỗi mục có một thao tác dựng lại khái niệm trên mô phỏng, chỉ qua Actions và các
// tiện ích dùng chung của scenario.ts. Mô tả bằng lời của từng thao tác nằm ở `sim` trong codex.vi.json.

import type { EmphasisKey } from '../emphasis';
import { ensureConstellation, selectCatalogHip, selectDso, selectHip, type ScenarioContext } from '../scenario';
import type { Toggles } from '../state';

type Sim = (ctx: ScenarioContext) => void;

const VEGA = 91262;

const on =
  (...keys: (keyof Toggles)[]): Sim =>
  (ctx) => {
    for (const k of keys) ctx.actions.setToggle(k, true);
  };

let flashTimer: ReturnType<typeof setTimeout> | undefined;
/** Tô sáng liên kết trong 2,5 s rồi tự tắt (nếu không ai đổi nó trong lúc đó). */
function flash(ctx: ScenarioContext, key: EmphasisKey): void {
  ctx.actions.setEmphasis(key);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    if (ctx.store.state.emphasis === key) ctx.actions.setEmphasis(null);
  }, 2500);
}

/** Cần một đối tượng đang chọn (A, h, H…): giữ lựa chọn hiện có, nếu không thì chọn Vega. */
function ensureSelection(ctx: ScenarioContext): void {
  if (!ctx.store.state.selected) selectCatalogHip(ctx, VEGA);
}

const star =
  (hip: number): Sim =>
  (ctx) =>
    void selectCatalogHip(ctx, hip);

const constellation =
  (id: string, hip: number): Sim =>
  (ctx) => {
    ctx.actions.setToggle('constellationLines', true);
    ensureConstellation(ctx, id);
    selectHip(ctx, hip);
  };

const dso =
  (id: string): Sim =>
  (ctx) =>
    void selectDso(ctx, id);

export const SIM: Readonly<Record<string, Sim>> = {
  sphere: on('horizonOnSphere', 'equator', 'poleAxis'),
  horizon: on('horizonOnSphere', 'underside'),
  zenith: on('zenithNadir'),
  pole: (ctx) => {
    on('poleAxis')(ctx);
    flash(ctx, 'pole');
  },
  equator: on('equator', 'equatorPlane'),
  meridian: (ctx) => {
    on('meridian')(ctx);
    flash(ctx, 'meridian');
  },
  diurnal: (ctx) => {
    ctx.actions.setTrails('long');
    ctx.actions.resetTrails();
    if (ctx.store.state.mode !== 'continuous') ctx.actions.setMode('continuous');
    ctx.actions.play();
  },
  altaz: (ctx) => {
    ensureSelection(ctx);
    on('altAzGrid', 'verticalCircle')(ctx);
    flash(ctx, 'altaz');
  },
  radec: on('eqGrid', 'hourCircle0'),
  vernal: on('hourCircle0', 'ecliptic'),
  hourAngle: (ctx) => {
    ensureSelection(ctx);
    on('meridian')(ctx);
    flash(ctx, 'meridian');
  },
  lst: (ctx) => {
    on('meridian', 'hourCircle0')(ctx);
    flash(ctx, 'meridian');
  },
  latPole: (ctx) => {
    on('poleAltitude')(ctx);
    flash(ctx, 'pole');
  },
  eqAngle: (ctx) => {
    on('angle')(ctx);
    flash(ctx, 'incl');
  },
  circumpolar: (ctx) => {
    on('zoneCircumpolar')(ctx);
    selectCatalogHip(ctx, 11767);
  },
  riseSetZone: (ctx) => {
    on('zoneRiseSet')(ctx);
    selectCatalogHip(ctx, 32349);
  },
  neverRise: on('zoneNeverRise', 'underside'),
  transit: (ctx) => {
    ensureSelection(ctx);
    on('meridian')(ctx);
    flash(ctx, 'meridian');
  },
  timeAbove: (ctx) => {
    on('zoneRiseSet')(ctx);
    SIM.diurnal(ctx);
  },
  ecliptic: on('ecliptic'),
  seasons: (ctx) => {
    on('sun', 'ecliptic')(ctx);
    ctx.actions.select({ kind: 'sun' });
  },
  siderealDay: (ctx) => {
    ctx.actions.setMode('oneDay');
    ctx.actions.play();
  },
  milkyWay: on('galactic'),
  magnitude: on('catalog'),
  starColor: star(27989),
  polaris: star(11767),
  sirius: star(32349),
  canopus: star(30438),
  vega: star(VEGA),
  betelgeuse: star(27989),
  rigel: star(24436),
  antares: star(80763),
  sun: (ctx) => {
    on('sun')(ctx);
    ctx.actions.select({ kind: 'sun' });
  },
  constellations: on('constellationLines'),
  uma: constellation('UMa', 54061),
  umi: constellation('UMi', 11767),
  cas: constellation('Cas', 3179),
  ori: constellation('Ori', 27989),
  sco: constellation('Sco', 80763),
  cru: constellation('Cru', 60718),
  deepSky: on('deepSky'),
  m31: dso('M31'),
  m42: dso('M42'),
  m45: dso('M45'),
};
