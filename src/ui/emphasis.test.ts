import { describe, expect, it } from 'vitest';
import { EMPHASIS_KEYS, emphasisForTip, emphasisForUi, emphasisGroup, TIP_EMPHASIS, UI_EMPHASIS, uiLinked } from '../emphasis';
import vi from '../i18n/vi.json';
import { Actions, createInitialState, Store } from '../state';
import { DATA_CELLS, INFO_NOTE_KEYS } from './infoCard';

const tipText = (k: string) => (vi as unknown as { tip: Record<string, string> }).tip[k];

describe('tô sáng liên kết: ánh xạ số ↔ hình', () => {
  it('mỗi khóa tô sáng có ít nhất một hình 3D (userData.tip) và ít nhất một ô giao diện', () => {
    for (const k of EMPHASIS_KEYS) {
      expect(Object.values(TIP_EMPHASIS), `tip → ${k}`).toContain(k);
      expect(Object.values(UI_EMPHASIS), `ui → ${k}`).toContain(k);
    }
  });

  it('mọi khóa hình đều là chú thích có thật (tip.<key> trong vi.json)', () => {
    for (const tip of Object.keys(TIP_EMPHASIS)) expect(tipText(tip), tip).toBeTruthy();
  });

  it('mọi khóa giao diện đều là một ô số liệu hoặc một dòng của thẻ thông tin', () => {
    const ui = new Set<string>([...DATA_CELLS.map((c) => c.key), ...INFO_NOTE_KEYS, 'status']);
    for (const key of Object.keys(UI_EMPHASIS)) expect(ui.has(key), key).toBe(true);
  });

  it('khóa không ánh xạ trả về null', () => {
    expect(emphasisForTip('horizon')).toBeNull();
    expect(emphasisForTip(undefined)).toBeNull();
    expect(emphasisForUi('lat')).toBeNull();
    expect(emphasisForUi('ra')).toBeNull();
  });

  it('ô "Đối tượng đang chọn" sáng cùng cung A và cung h, và ngược lại', () => {
    expect(uiLinked('selected', 'az')).toBe(true);
    expect(uiLinked('selected', 'alt')).toBe(true);
    expect(uiLinked('az', 'altaz')).toBe(true);
    expect(uiLinked('alt', 'altaz')).toBe(true);
    expect(uiLinked('az', 'alt')).toBe(false);
    expect(uiLinked('pole', 'pole')).toBe(true);
    expect(uiLinked('pole', null)).toBe(false);
    expect(uiLinked('lat', 'pole')).toBe(false);
    expect(uiLinked('lst', 'meridian') && uiLinked('ha', 'meridian')).toBe(true);
  });

  it('vùng được tô sáng là vùng chứa đối tượng đang chọn', () => {
    const s = createInitialState();
    // Mặc định: Polaris ở Hà Nội/TP.HCM là sao cận cực.
    expect(emphasisGroup({ ...s, emphasis: 'zone' })).toBe('zone_circumpolar');
    expect(emphasisGroup({ ...s, emphasis: 'zone', lat: -30 })).toBe('zone_neverRise');
    expect(emphasisGroup({ ...s, emphasis: 'zone', selected: null })).toBeNull();
    expect(emphasisGroup({ ...s, emphasis: 'pole' })).toBe('pole');
    expect(emphasisGroup({ ...s, emphasis: null })).toBeNull();
  });
});

describe('Actions.setEmphasis', () => {
  it('đổi trạng thái bất biến (đối tượng mới, phần còn lại giữ nguyên tham chiếu)', () => {
    const store = new Store(createInitialState());
    const actions = new Actions(store);
    const prev = store.state;
    expect(prev.emphasis).toBeNull();
    actions.setEmphasis('pole');
    const next = store.state;
    expect(next).not.toBe(prev);
    expect(prev.emphasis).toBeNull();
    expect(next.emphasis).toBe('pole');
    expect(next.toggles).toBe(prev.toggles);
    expect(next.stars).toBe(prev.stars);
    expect(next.selected).toBe(prev.selected);
  });

  it('không phát sự kiện khi giá trị không đổi', () => {
    const store = new Store(createInitialState());
    const actions = new Actions(store);
    let calls = 0;
    store.subscribe(() => calls++);
    actions.setEmphasis(null);
    expect(calls).toBe(0);
    actions.setEmphasis('meridian');
    const after = store.state;
    actions.setEmphasis('meridian');
    expect(calls).toBe(1);
    expect(store.state).toBe(after);
    actions.setEmphasis(null);
    expect(calls).toBe(2);
    expect(store.state.emphasis).toBeNull();
  });
});

describe('màu gạch chân của con số liên kết (review-3 F2)', () => {
  it('mọi nhóm tô sáng mà emphasisGroup có thể trả về đều có màu, lấy từ màu ngữ nghĩa của cảnh', async () => {
    const { linkColor } = await import('./emphasis');
    const { COLORS } = await import('../scene/colors');
    const groups = [...EMPHASIS_KEYS.filter((k) => k !== 'zone'), 'zone_circumpolar', 'zone_riseSet', 'zone_neverRise'];
    const scene = new Set<string>(Object.values(COLORS));
    for (const g of groups) {
      const c = linkColor(g);
      expect(c, g).toBeTruthy();
      expect(scene.has(c!), `${g} → ${c}`).toBe(true);
    }
    expect(linkColor('pole')).toBe(COLORS.axis);
    expect(linkColor(null)).toBeNull();
  });
});
