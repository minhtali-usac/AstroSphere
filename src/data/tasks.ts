// Nhiệm vụ cho chế độ học tập (chấm điểm tự động, có gợi ý và lời giải thích).

import { classify, hourAngleDeg } from '../astro';
import type { Actions, AppState, Store } from '../state';
import { lstOf } from '../state';
import { ensureConstellation, PLACES, selectHip, zones } from '../scenario';

export interface TaskContext {
  store: Store;
  actions: Actions;
}

export type TaskAnswer =
  | { type: 'number'; unit: string; check: (v: number) => boolean }
  | { type: 'choice'; options: string[]; correct: number }
  | { type: 'state'; check: (s: AppState) => boolean };

export interface Task {
  id: string;
  title: string;
  question: string;
  setup?: (ctx: TaskContext) => void;
  answer: TaskAnswer;
  hint: string;
  explain: string;
}

const HANOI = PLACES.hanoi;
const HCM = PLACES.hcm;

const near = (target: number, tol: number) => (v: number) => Math.abs(v - target) <= tol;

export const TASKS: Task[] = [
  {
    id: 'polaris-hanoi',
    title: 'Polaris ở Hà Nội',
    question: 'Đặt vị trí ở Hà Nội. Polaris (sao Bắc Cực) cao khoảng bao nhiêu độ so với đường chân trời?',
    setup: (ctx) => {
      ctx.actions.setLocation(HANOI.lat, HANOI.lon);
      ensureConstellation(ctx, 'UMi');
      selectHip(ctx, 11767);
    },
    answer: { type: 'number', unit: '°', check: near(21.03, 1.5) },
    hint: 'Độ cao của thiên cực Bắc đúng bằng vĩ độ người quan sát. Polaris chỉ cách thiên cực Bắc chưa tới 1°.',
    explain:
      'Ở Hà Nội φ = 21,03° nên thiên cực Bắc cao 21,03°. Polaris (δ ≈ +89,3°) quay một vòng rất nhỏ quanh thiên cực, nên độ cao của nó chỉ dao động trong khoảng 20,3°–21,8°.',
  },
  {
    id: 'equator-circumpolar',
    title: 'Sao cận cực ở xích đạo',
    question: 'Người quan sát đứng ở xích đạo (φ = 0°). Sao nào không bao giờ lặn?',
    setup: (ctx) => {
      ctx.actions.setLocation(0, ctx.store.state.lon);
      zones(ctx, true);
    },
    answer: { type: 'choice', options: ['Polaris (sao Bắc Cực)', 'Các sao gần thiên cực Nam', 'Không có sao nào', 'Mọi sao'], correct: 2 },
    hint: 'Điều kiện cận cực (Bắc bán cầu): δ > 90° − φ. Thử thay φ = 0°.',
    explain:
      'Với φ = 0°, cần δ > 90° — không sao nào thỏa mãn. Ở xích đạo mọi sao đều mọc và lặn, và ở trên chân trời đúng 12 giờ thiên văn mỗi ngày.',
  },
  {
    id: 'crux-circumpolar',
    title: 'Crux không bao giờ lặn',
    question:
      'Tìm một vĩ độ mà tại đó MỌI sao của chòm Crux (Nam Thập Tự) đều là sao cận cực (không bao giờ lặn). Đặt vĩ độ đó trong mô phỏng rồi bấm "Kiểm tra".',
    setup: (ctx) => {
      ensureConstellation(ctx, 'Cru');
      zones(ctx, true);
      ctx.actions.setToggle('zoneRiseSet', false);
    },
    answer: {
      type: 'state',
      check: (s) => {
        const fig = s.figures.find((f) => f.templateId === 'Cru');
        if (!fig) return false;
        const ids = new Set(fig.starIds);
        return s.stars.filter((x) => ids.has(x.id)).every((x) => classify(x.dec, s.lat) === 'circumpolar');
      },
    },
    hint: 'Sao "cao" nhất của Crux là Gacrux (δ ≈ −57,1°). Ở Nam bán cầu, sao là cận cực khi δ < −(90° − |φ|).',
    explain:
      'Cần 90° − |φ| < 57,1° ⇒ |φ| > 32,9° và người quan sát ở Nam bán cầu. Ví dụ ở Sydney hay Cape Town (vĩ độ ≈ 33,9° Nam), Crux không bao giờ lặn. Ở Việt Nam, Crux mọc rồi lặn và chỉ thấy thấp ở chân trời phía Nam.',
  },
  {
    id: 'tilt-hanoi',
    title: 'Độ nghiêng của xích đạo trời',
    question: 'Ở Hà Nội, mặt phẳng xích đạo trời nghiêng một góc bao nhiêu độ so với mặt phẳng chân trời?',
    setup: (ctx) => {
      ctx.actions.setLocation(HANOI.lat, HANOI.lon);
      ctx.actions.setToggle('equator', true);
    },
    answer: { type: 'number', unit: '°', check: near(68.97, 1) },
    hint: 'Thiên cực cao |φ|; xích đạo trời vuông góc với trục thiên cực. Bật "Góc giữa xích đạo trời và chân trời" để kiểm chứng.',
    explain: 'Góc nghiêng = 90° − |φ| = 90° − 21,03° = 68,97°. Ở xích đạo góc này là 90° (sao mọc thẳng đứng), ở hai cực là 0°.',
  },
  {
    id: 'east-rise',
    title: 'Sao trên xích đạo trời mọc ở đâu?',
    question: 'Ở TP.HCM, một sao nằm trên xích đạo trời (δ = 0°) mọc ở hướng nào?',
    setup: (ctx) => ctx.actions.setLocation(HCM.lat, HCM.lon),
    answer: { type: 'choice', options: ['Đông Bắc', 'Chính Đông', 'Đông Nam', 'Tùy theo mùa'], correct: 1 },
    hint: 'Phương vị lúc mọc thỏa mãn cos A = sin δ / cos φ.',
    explain: 'Với δ = 0°: cos A = 0 ⇒ A = 90° (chính Đông), không phụ thuộc vĩ độ (trừ hai cực). Tương tự, sao lặn ở chính Tây (A = 270°).',
  },
  {
    id: 'pole-north',
    title: 'Bầu trời ở Bắc Cực',
    question: 'Ở Bắc Cực (φ = 90°), một sao có xích vĩ δ = −10° sẽ…',
    setup: (ctx) => {
      ctx.actions.setLocation(90, ctx.store.state.lon);
      zones(ctx, true);
    },
    answer: { type: 'choice', options: ['Luôn ở trên chân trời', 'Mọc và lặn mỗi ngày', 'Không bao giờ mọc', 'Mọc ở hướng Nam'], correct: 2 },
    hint: 'Ở Bắc Cực, xích đạo trời trùng với đường chân trời.',
    explain: 'Ở φ = 90°, sao có δ > 0 luôn ở trên chân trời (cận cực), sao có δ < 0 luôn ở dưới chân trời (không bao giờ mọc). Các sao chạy vòng song song với chân trời.',
  },
  {
    id: 'hours-above',
    title: 'Thời gian sao ở trên chân trời',
    question: 'Ở Hà Nội, một sao có δ = +30° ở trên chân trời bao nhiêu giờ (thiên văn) mỗi ngày?',
    setup: (ctx) => ctx.actions.setLocation(HANOI.lat, HANOI.lon),
    answer: { type: 'number', unit: 'giờ', check: near(13.71, 0.4) },
    hint: 'cos H₀ = −tan φ · tan δ, thời gian trên chân trời = 2H₀ / 15 (giờ).',
    explain: 'cos H₀ = −tan 21,03° · tan 30° ≈ −0,222 ⇒ H₀ ≈ 102,8° ⇒ 2H₀/15 ≈ 13,7 giờ. Sao ở phía Bắc xích đạo trời ở trên chân trời lâu hơn 12 giờ (với người ở Bắc bán cầu).',
  },
  {
    id: 'sidereal-day',
    title: 'Ngày thiên văn',
    question: 'Bầu trời sao quay đúng một vòng sau bao lâu?',
    answer: { type: 'choice', options: ['24h 00m 00s', '23h 56m 04s', '24h 03m 56s', '12h 00m 00s'], correct: 1 },
    hint: 'Đó không phải ngày Mặt Trời: Trái Đất còn quay quanh Mặt Trời khoảng 1° mỗi ngày.',
    explain:
      'Một ngày thiên văn dài 23h 56m 04s — ngắn hơn ngày Mặt Trời khoảng 3 phút 56 giây. Vì vậy mỗi đêm một ngôi sao mọc sớm hơn đêm trước gần 4 phút.',
  },
  {
    id: 'zenith-pole',
    title: 'Thiên cực ở thiên đỉnh',
    question: 'Ở vĩ độ nào (Bắc) thì thiên cực Bắc nằm đúng thiên đỉnh?',
    answer: { type: 'number', unit: '°', check: near(90, 0.5) },
    hint: 'Độ cao thiên cực = vĩ độ. Thiên đỉnh có độ cao 90°.',
    explain: 'Ở Bắc Cực (φ = 90°) thiên cực Bắc ở thiên đỉnh; các sao chạy vòng song song với chân trời và không bao giờ mọc hay lặn.',
  },
  {
    id: 'sirius-meridian',
    title: 'Sirius qua kinh tuyến',
    question:
      'Kéo thanh "Giờ thiên văn" sao cho sao Sirius (Thiên Lang) nằm đúng trên kinh tuyến trên (góc giờ H ≈ 0), rồi bấm "Kiểm tra".',
    setup: (ctx) => {
      ctx.actions.pause();
      ensureConstellation(ctx, 'CMa');
      selectHip(ctx, 32349);
      ctx.actions.setToggle('meridian', true);
    },
    answer: {
      type: 'state',
      check: (s) => {
        const sirius = s.stars.find((x) => x.hip === 32349);
        return !!sirius && Math.abs(hourAngleDeg(lstOf(s), sirius.ra)) <= 3.75;
      },
    },
    hint: 'Một sao qua kinh tuyến trên khi góc giờ H = LST − α = 0, tức là LST = α. Xem xích kinh của Sirius trong thẻ thông tin.',
    explain: 'Sirius có α ≈ 6h 45m, nên nó qua kinh tuyến (lên cao nhất, ở hướng Nam với người ở Việt Nam) khi LST ≈ 6h 45m.',
  },
  {
    id: 'max-alt',
    title: 'Độ cao cực đại',
    question: 'Ở TP.HCM (φ = 10,82°), sao Sirius (δ ≈ −16,72°) lên cao nhất bao nhiêu độ?',
    setup: (ctx) => ctx.actions.setLocation(HCM.lat, HCM.lon),
    answer: { type: 'number', unit: '°', check: near(62.46, 1) },
    hint: 'Độ cao lúc qua kinh tuyến trên: h_max = 90° − |φ − δ|.',
    explain: 'h_max = 90° − |10,82° − (−16,72°)| = 90° − 27,54° = 62,46°, ở hướng Nam.',
  },
  {
    id: 'circumpolar-hanoi',
    title: 'Giới hạn cận cực ở Hà Nội',
    question: 'Ở Hà Nội, một sao là sao cận cực (không bao giờ lặn) khi xích vĩ δ lớn hơn bao nhiêu độ?',
    setup: (ctx) => {
      ctx.actions.setLocation(HANOI.lat, HANOI.lon);
      ctx.actions.setToggle('zoneCircumpolar', true);
    },
    answer: { type: 'number', unit: '°', check: near(68.97, 0.5) },
    hint: 'Điều kiện cận cực: δ > 90° − φ.',
    explain: 'δ > 90° − 21,03° = 68,97°. Vùng tô màu tím trên thiên cầu là vùng cận cực; nó càng lớn khi đi càng xa xích đạo.',
  },
];
