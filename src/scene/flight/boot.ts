// Khởi động «Bay vào vũ trụ» (chunk tải lười): nạp dữ liệu, dựng FlightView và bảng điều khiển, chạy vòng lặp riêng.
// Hai khung nhìn chính được tạm dừng trong lúc bay (src/ui/flight.ts gọi loop.suspend).

import './flight.css';
import { gmstDeg, norm360 } from '../../astro';
import { BODIES, type BodyId } from '../../data/bodies';
import { loadAllFigures } from '../../data/constellations';
import { loadFlightData } from '../../data/flightData';
import { drawLand, loadLand } from '../../data/land';
import { createQuality } from '../../runtime/quality';
import { sunJd } from '../../selection';
import { ft } from './text';
import type { Store } from '../../state';
import type { FlightSession, FlightTarget } from '../../ui/flight';
import { flightPanel } from '../../ui/flightPanel';
import { FlightView } from './flightView';

export interface FlightStart {
  dialog: HTMLDialogElement;
  host: HTMLElement;
  store: Store;
  target: FlightTarget;
}

/** Bản đồ đất liền 720 × 360 (phép chiếu trụ đều) để tô lục địa lên Trái Đất đa giác thấp. */
function landSampler(): ((lon: number, lat: number) => boolean) | null {
  const w = 720;
  const h = 360;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  drawLand(g, w, h, '#fff');
  const px = g.getImageData(0, 0, w, h).data;
  return (lon, lat) => {
    const x = Math.min(w - 1, Math.max(0, Math.floor(((lon + 180) / 360) * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
    return px[(y * w + x) * 4 + 3] > 127;
  };
}

/** Ngày Julius của mô phỏng: ngày đã chọn cho Mặt Trời, giờ suy ra từ giờ thiên văn Greenwich hiện tại. */
function simulationJd(store: Store): number {
  const s = store.state;
  const jd0 = sunJd(s.sunDate) - 0.5;
  return jd0 + norm360(s.gst - gmstDeg(jd0)) / 360.98564736629;
}

const reducedMotion = (): boolean => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};

export async function startFlight(o: FlightStart): Promise<FlightSession> {
  const [data, figures, land] = await Promise.all([loadFlightData(), loadAllFigures().catch(() => null), loadLand().catch(() => null)]);
  const s = o.store.state;
  let panel: ReturnType<typeof flightPanel> | null = null;
  const view = new FlightView(o.host, {
    jd: simulationJd(o.store),
    gst: s.gst,
    lat: s.lat,
    lon: s.lon,
    data,
    figures,
    land: land ? landSampler() : null,
    reducedMotion: reducedMotion(),
    text: { observer: ft('observer'), axis: ft('axis') },
    names: Object.fromEntries(BODIES.map((b) => [b.id, ft(`name.${b.id}`)])) as Record<BodyId, string>,
    onChange: () => panel?.refresh(),
  });
  panel = flightPanel(view, data);
  o.dialog.append(panel.el);

  const fly = (target: FlightTarget) => {
    if (!target) return;
    const th = target.kind === 'sun' ? view.get('body:sun') : view.starThing(target.index);
    if (th) view.flyTo(th);
  };
  fly(o.target);

  // Phím trong chế độ bay: W A S D R F (Shift nhanh hơn), G bay tới thiên thể đang chọn. Không chiếm phím khi đang gõ.
  const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && !!e.target.closest('input,select,textarea');
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if (view.keyDown(e.code)) e.preventDefault();
    else if (e.code === 'KeyG' && view.selected) view.flyTo(view.selected);
  };
  const onKeyUp = (e: KeyboardEvent) => view.keyUp(e.code);
  o.dialog.addEventListener('keydown', onKeyDown);
  o.dialog.addEventListener('keyup', onKeyUp);
  const onBlur = () => {
    for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'ShiftLeft', 'ShiftRight']) view.keyUp(c);
  };
  window.addEventListener('blur', onBlur);

  // Vòng lặp riêng: vẽ khi có thay đổi, cập nhật bảng ≈ 6 lần/giây, dừng khi thẻ trình duyệt bị ẩn.
  const quality = createQuality();
  quality.attach([view]);
  let raf = 0;
  let last = performance.now();
  let lastUi = 0;
  const loop = (now: number) => {
    raf = 0;
    const ms = now - last;
    last = now;
    if (view.frame(Math.min(0.1, ms / 1000))) quality.sample(ms);
    if (now - lastUi > 160) {
      lastUi = now;
      panel?.tick();
    }
    if (!document.hidden) raf = requestAnimationFrame(loop);
  };
  const onVisibility = () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(loop);

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__flight = view;

  return {
    escape: () => view.cancelTravel(),
    flyTo: fly,
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      o.dialog.removeEventListener('keydown', onKeyDown);
      o.dialog.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      panel?.el.remove();
      view.dispose();
      if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__flight;
    },
  };
}
