// Nhiệm vụ cho chế độ học tập (chấm điểm tự động, có gợi ý và lời giải thích).

import { classify, hourAngleDeg } from '../astro';
import { pick } from '../i18n/locale';
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
    title: pick('Polaris ở Hà Nội', 'Polaris over Hanoi'),
    question: pick('Đặt vị trí ở Hà Nội. Polaris (sao Bắc Cực) cao khoảng bao nhiêu độ so với đường chân trời?', 'Set the location to Hanoi. Roughly how many degrees above the horizon is Polaris, the North Star?'),
    setup: (ctx) => {
      ctx.actions.setLocation(HANOI.lat, HANOI.lon);
      ensureConstellation(ctx, 'UMi');
      selectHip(ctx, 11767);
    },
    answer: { type: 'number', unit: '°', check: near(21.03, 1.5) },
    hint: pick('Độ cao của thiên cực Bắc đúng bằng vĩ độ người quan sát. Polaris chỉ cách thiên cực Bắc chưa tới 1°.', 'The altitude of the north celestial pole equals the observer\'s latitude. Polaris is less than 1° from that pole.'),
    explain:
      pick('Ở Hà Nội φ = 21,03° nên thiên cực Bắc cao 21,03°. Polaris (δ ≈ +89,3°) quay một vòng rất nhỏ quanh thiên cực, nên độ cao của nó chỉ dao động trong khoảng 20,3°–21,8°.', 'In Hanoi φ = 21.03°, so the north celestial pole is 21.03° high. Polaris (δ ≈ +89.3°) traces a very small circle around the pole, so its altitude only varies between about 20.3° and 21.8°.'),
  },
  {
    id: 'equator-circumpolar',
    title: pick('Sao cận cực ở xích đạo', 'Circumpolar stars at the equator'),
    question: pick('Người quan sát đứng ở xích đạo (φ = 0°). Sao nào không bao giờ lặn?', 'An observer stands on the equator (φ = 0°). Which stars never set?'),
    setup: (ctx) => {
      ctx.actions.setLocation(0, ctx.store.state.lon);
      zones(ctx, true);
    },
    answer: { type: 'choice', options: pick(['Polaris (sao Bắc Cực)', 'Các sao gần thiên cực Nam', 'Không có sao nào', 'Mọi sao'], ['Polaris, the North Star', 'Stars near the south celestial pole', 'No stars at all', 'Every star']), correct: 2 },
    hint: pick('Điều kiện cận cực (Bắc bán cầu): δ > 90° − φ. Thử thay φ = 0°.', 'Circumpolar condition (Northern Hemisphere): δ > 90° − φ. Try φ = 0°.'),
    explain:
      pick('Với φ = 0°, cần δ > 90° — không sao nào thỏa mãn. Ở xích đạo mọi sao đều mọc và lặn, và ở trên chân trời đúng 12 giờ thiên văn mỗi ngày.', 'With φ = 0° you would need δ > 90°, which no star satisfies. At the equator every star rises and sets, and is above the horizon for exactly 12 sidereal hours each day.'),
  },
  {
    id: 'crux-circumpolar',
    title: pick('Crux không bao giờ lặn', 'Crux that never sets'),
    question:
      pick('Tìm một vĩ độ mà tại đó MỌI sao của chòm Crux (Nam Thập Tự) đều là sao cận cực (không bao giờ lặn). Đặt vĩ độ đó trong mô phỏng rồi bấm "Kiểm tra".', 'Find a latitude at which EVERY star of Crux, the Southern Cross, is circumpolar (never sets). Set that latitude in the simulation, then press “Check”.'),
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
    hint: pick('Sao "cao" nhất của Crux là Gacrux (δ ≈ −57,1°). Ở Nam bán cầu, sao là cận cực khi δ < −(90° − |φ|).', 'The northernmost star of Crux is Gacrux (δ ≈ −57.1°). In the Southern Hemisphere a star is circumpolar when δ < −(90° − |φ|).'),
    explain:
      pick('Cần 90° − |φ| < 57,1° ⇒ |φ| > 32,9° và người quan sát ở Nam bán cầu. Ví dụ ở Sydney hay Cape Town (vĩ độ ≈ 33,9° Nam), Crux không bao giờ lặn. Ở Việt Nam, Crux mọc rồi lặn và chỉ thấy thấp ở chân trời phía Nam.', 'You need 90° − |φ| < 57.1° ⇒ |φ| > 32.9°, with the observer in the Southern Hemisphere. In Sydney or Cape Town (latitude ≈ 33.9° S), Crux never sets. In Vietnam it rises and sets, staying low in the south.'),
  },
  {
    id: 'tilt-hanoi',
    title: pick('Độ nghiêng của xích đạo trời', 'Tilt of the celestial equator'),
    question: pick('Ở Hà Nội, mặt phẳng xích đạo trời nghiêng một góc bao nhiêu độ so với mặt phẳng chân trời?', 'In Hanoi, at what angle in degrees is the plane of the celestial equator inclined to the horizon plane?'),
    setup: (ctx) => {
      ctx.actions.setLocation(HANOI.lat, HANOI.lon);
      ctx.actions.setToggle('equator', true);
    },
    answer: { type: 'number', unit: '°', check: near(68.97, 1) },
    hint: pick('Thiên cực cao |φ|; xích đạo trời vuông góc với trục thiên cực. Bật "Góc giữa xích đạo trời và chân trời" để kiểm chứng.', 'The celestial pole is |φ| high and the celestial equator is perpendicular to the polar axis. Turn on “Equator–horizon angle” to check.'),
    explain: pick('Góc nghiêng = 90° − |φ| = 90° − 21,03° = 68,97°. Ở xích đạo góc này là 90° (sao mọc thẳng đứng), ở hai cực là 0°.', 'Inclination = 90° − |φ| = 90° − 21.03° = 68.97°. At the equator the angle is 90° (stars rise vertically); at the poles it is 0°.'),
  },
  {
    id: 'east-rise',
    title: pick('Sao trên xích đạo trời mọc ở đâu?', 'Where does an equatorial star rise?'),
    question: pick('Ở TP.HCM, một sao nằm trên xích đạo trời (δ = 0°) mọc ở hướng nào?', 'In Ho Chi Minh City, in which direction does a star on the celestial equator (δ = 0°) rise?'),
    setup: (ctx) => ctx.actions.setLocation(HCM.lat, HCM.lon),
    answer: { type: 'choice', options: pick(['Đông Bắc', 'Chính Đông', 'Đông Nam', 'Tùy theo mùa'], ['North-east', 'Due east', 'South-east', 'It depends on the season']), correct: 1 },
    hint: pick('Phương vị lúc mọc thỏa mãn cos A = sin δ / cos φ.', 'The azimuth at rising satisfies cos A = sin δ / cos φ.'),
    explain: pick('Với δ = 0°: cos A = 0 ⇒ A = 90° (chính Đông), không phụ thuộc vĩ độ (trừ hai cực). Tương tự, sao lặn ở chính Tây (A = 270°).', 'With δ = 0°: cos A = 0 ⇒ A = 90° (due east), whatever the latitude (except at the poles). Likewise the star sets due west (A = 270°).'),
  },
  {
    id: 'pole-north',
    title: pick('Bầu trời ở Bắc Cực', 'The sky at the North Pole'),
    question: pick('Ở Bắc Cực (φ = 90°), một sao có xích vĩ δ = −10° sẽ…', 'At the North Pole (φ = 90°), a star with declination δ = −10° will…'),
    setup: (ctx) => {
      ctx.actions.setLocation(90, ctx.store.state.lon);
      zones(ctx, true);
    },
    answer: { type: 'choice', options: pick(['Luôn ở trên chân trời', 'Mọc và lặn mỗi ngày', 'Không bao giờ mọc', 'Mọc ở hướng Nam'], ['always be above the horizon', 'rise and set every day', 'never rise', 'rise in the south']), correct: 2 },
    hint: pick('Ở Bắc Cực, xích đạo trời trùng với đường chân trời.', 'At the North Pole the celestial equator coincides with the horizon.'),
    explain: pick('Ở φ = 90°, sao có δ > 0 luôn ở trên chân trời (cận cực), sao có δ < 0 luôn ở dưới chân trời (không bao giờ mọc). Các sao chạy vòng song song với chân trời.', 'At φ = 90°, stars with δ > 0 are always above the horizon (circumpolar) and stars with δ < 0 are always below it (never rise). Stars circle parallel to the horizon.'),
  },
  {
    id: 'hours-above',
    title: pick('Thời gian sao ở trên chân trời', 'Time above the horizon'),
    question: pick('Ở Hà Nội, một sao có δ = +30° ở trên chân trời bao nhiêu giờ (thiên văn) mỗi ngày?', 'In Hanoi, for how many sidereal hours a day is a star with δ = +30° above the horizon?'),
    setup: (ctx) => ctx.actions.setLocation(HANOI.lat, HANOI.lon),
    answer: { type: 'number', unit: pick('giờ', 'hours'), check: near(13.71, 0.4) },
    hint: pick('cos H₀ = −tan φ · tan δ, thời gian trên chân trời = 2H₀ / 15 (giờ).', 'cos H₀ = −tan φ · tan δ, and the time above the horizon = 2H₀ / 15 (hours).'),
    explain: pick('cos H₀ = −tan 21,03° · tan 30° ≈ −0,222 ⇒ H₀ ≈ 102,8° ⇒ 2H₀/15 ≈ 13,7 giờ. Sao ở phía Bắc xích đạo trời ở trên chân trời lâu hơn 12 giờ (với người ở Bắc bán cầu).', 'cos H₀ = −tan 21.03° · tan 30° ≈ −0.222 ⇒ H₀ ≈ 102.8° ⇒ 2H₀/15 ≈ 13.7 hours. For a northern observer, a star north of the celestial equator is up for more than 12 hours.'),
  },
  {
    id: 'sidereal-day',
    title: pick('Ngày thiên văn', 'The sidereal day'),
    question: pick('Bầu trời sao quay đúng một vòng sau bao lâu?', 'How long does the starry sky take to turn exactly once?'),
    answer: { type: 'choice', options: ['24h 00m 00s', '23h 56m 04s', '24h 03m 56s', '12h 00m 00s'], correct: 1 },
    hint: pick('Đó không phải ngày Mặt Trời: Trái Đất còn quay quanh Mặt Trời khoảng 1° mỗi ngày.', 'It is not the solar day: Earth also moves about 1° a day around the Sun.'),
    explain:
      pick('Một ngày thiên văn dài 23h 56m 04s — ngắn hơn ngày Mặt Trời khoảng 3 phút 56 giây. Vì vậy mỗi đêm một ngôi sao mọc sớm hơn đêm trước gần 4 phút.', 'A sidereal day lasts 23h 56m 04s, about 3 minutes 56 seconds less than a solar day. So each night a star rises almost 4 minutes earlier than the night before.'),
  },
  {
    id: 'zenith-pole',
    title: pick('Thiên cực ở thiên đỉnh', 'Celestial pole at the zenith'),
    question: pick('Ở vĩ độ nào (Bắc) thì thiên cực Bắc nằm đúng thiên đỉnh?', 'At what northern latitude is the north celestial pole exactly at the zenith?'),
    answer: { type: 'number', unit: '°', check: near(90, 0.5) },
    hint: pick('Độ cao thiên cực = vĩ độ. Thiên đỉnh có độ cao 90°.', 'The altitude of the celestial pole equals the latitude. The zenith has an altitude of 90°.'),
    explain: pick('Ở Bắc Cực (φ = 90°) thiên cực Bắc ở thiên đỉnh; các sao chạy vòng song song với chân trời và không bao giờ mọc hay lặn.', 'At the North Pole (φ = 90°) the north celestial pole is at the zenith; stars circle parallel to the horizon and never rise or set.'),
  },
  {
    id: 'sirius-meridian',
    title: pick('Sirius qua kinh tuyến', 'Sirius on the meridian'),
    question:
      pick('Kéo thanh "Giờ thiên văn" sao cho sao Sirius (Thiên Lang) nằm đúng trên kinh tuyến trên (góc giờ H ≈ 0), rồi bấm "Kiểm tra".', 'Drag the “Local sidereal time” slider so that Sirius is exactly on the upper meridian (hour angle H ≈ 0), then press “Check”.'),
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
    hint: pick('Một sao qua kinh tuyến trên khi góc giờ H = LST − α = 0, tức là LST = α. Xem xích kinh của Sirius trong thẻ thông tin.', 'A star makes its upper transit when its hour angle H = LST − α = 0, that is, LST = α. See Sirius\'s right ascension on the information card.'),
    explain: pick('Sirius có α ≈ 6h 45m, nên nó qua kinh tuyến (lên cao nhất, ở hướng Nam với người ở Việt Nam) khi LST ≈ 6h 45m.', 'Sirius has α ≈ 6h 45m, so it crosses the meridian (highest, and due south as seen from Vietnam) when LST ≈ 6h 45m.'),
  },
  {
    id: 'max-alt',
    title: pick('Độ cao cực đại', 'Greatest altitude'),
    question: pick('Ở TP.HCM (φ = 10,82°), sao Sirius (δ ≈ −16,72°) lên cao nhất bao nhiêu độ?', 'In Ho Chi Minh City (φ = 10.82°), how many degrees high does Sirius (δ ≈ −16.72°) climb at most?'),
    setup: (ctx) => ctx.actions.setLocation(HCM.lat, HCM.lon),
    answer: { type: 'number', unit: '°', check: near(62.46, 1) },
    hint: pick('Độ cao lúc qua kinh tuyến trên: h_max = 90° − |φ − δ|.', 'Altitude at upper transit: h_max = 90° − |φ − δ|.'),
    explain: pick('h_max = 90° − |10,82° − (−16,72°)| = 90° − 27,54° = 62,46°, ở hướng Nam.', 'h_max = 90° − |10.82° − (−16.72°)| = 90° − 27.54° = 62.46°, towards the south.'),
  },
  {
    id: 'circumpolar-hanoi',
    title: pick('Giới hạn cận cực ở Hà Nội', 'Circumpolar limit in Hanoi'),
    question: pick('Ở Hà Nội, một sao là sao cận cực (không bao giờ lặn) khi xích vĩ δ lớn hơn bao nhiêu độ?', 'In Hanoi, a star is circumpolar (never sets) when its declination δ is greater than how many degrees?'),
    setup: (ctx) => {
      ctx.actions.setLocation(HANOI.lat, HANOI.lon);
      ctx.actions.setToggle('zoneCircumpolar', true);
    },
    answer: { type: 'number', unit: '°', check: near(68.97, 0.5) },
    hint: pick('Điều kiện cận cực: δ > 90° − φ.', 'Circumpolar condition: δ > 90° − φ.'),
    explain: pick('δ > 90° − 21,03° = 68,97°. Vùng tô màu tím trên thiên cầu là vùng cận cực; nó càng lớn khi đi càng xa xích đạo.', 'δ > 90° − 21.03° = 68.97°. The purple area on the celestial sphere is the circumpolar zone; it grows the farther you travel from the equator.'),
  },
];
