import * as THREE from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { describe, expect, it } from 'vitest';
import { EMPHASIS_MESH_BOOST, EMPHASIS_MS, EMPHASIS_WIDTH, EmphasisFx } from './emphasis';
import { fatLine, geomStats, translucent } from './geom';

function fixture() {
  const line = fatLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], '#ffffff', { width: 2, opacity: 0.8 });
  const other = fatLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)], '#ffffff', { width: 3 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), translucent('#ffffff', 0.3));
  const fx = new EmphasisFx();
  fx.add('pole', line, mesh);
  fx.add('meridian', other);
  const lm = line.material as LineMaterial;
  const om = other.material as LineMaterial;
  const mm = mesh.material as THREE.MeshBasicMaterial;
  return { fx, lm, om, mm };
}

describe('EmphasisFx (tô sáng trong khung nhìn)', () => {
  it('đậm dần trong 150 ms bằng ease-out, không vượt đích', () => {
    const { fx, lm, mm } = fixture();
    fx.setTarget('pole', 0, false);
    expect(fx.running).toBe(true);
    let last = lm.linewidth;
    for (let t = 10; t <= EMPHASIS_MS; t += 10) {
      fx.step(t);
      expect(lm.linewidth).toBeGreaterThanOrEqual(last);
      expect(lm.linewidth).toBeLessThanOrEqual(2 * EMPHASIS_WIDTH + 1e-9);
      last = lm.linewidth;
    }
    expect(fx.running).toBe(false);
    expect(lm.linewidth).toBeCloseTo(2 * EMPHASIS_WIDTH);
    expect(lm.opacity).toBe(1);
    expect(mm.opacity).toBeCloseTo(0.3 + EMPHASIS_MESH_BOOST);
  });

  it('ease-out: nửa thời gian đầu đi được hơn nửa quãng', () => {
    const { fx, lm } = fixture();
    fx.setTarget('pole', 0, false);
    fx.step(EMPHASIS_MS / 2);
    expect(lm.linewidth).toBeGreaterThan(2 + (2 * EMPHASIS_WIDTH - 2) / 2);
  });

  it('giảm chuyển động: đổi ngay, không chạy chuyển', () => {
    const { fx, lm } = fixture();
    fx.setTarget('pole', 0, true);
    expect(fx.running).toBe(false);
    expect(lm.linewidth).toBeCloseTo(2 * EMPHASIS_WIDTH);
    fx.setTarget(null, 0, true);
    expect(lm.linewidth).toBe(2);
    expect(lm.opacity).toBeCloseTo(0.8);
  });

  it('đổi nhóm: nhóm cũ về gốc ngay, nhóm khác không bị chạm tới', () => {
    const { fx, lm, om, mm } = fixture();
    fx.setTarget('pole', 0, true);
    fx.setTarget('meridian', 0, true);
    expect(lm.linewidth).toBe(2);
    expect(mm.opacity).toBeCloseTo(0.3);
    expect(om.linewidth).toBeCloseTo(3 * EMPHASIS_WIDTH);
    fx.setTarget(null, 0, false);
    fx.step(EMPHASIS_MS);
    expect(om.linewidth).toBe(3);
    expect(fx.current).toBeNull();
  });

  it('không tạo LineGeometry khi tô sáng', () => {
    const { fx } = fixture();
    const before = geomStats.lineGeometries;
    fx.setTarget('pole', 0, false);
    for (let t = 0; t <= EMPHASIS_MS; t += 16) fx.step(t);
    fx.setTarget(null, 200, false);
    for (let t = 200; t <= 400; t += 16) fx.step(t);
    expect(geomStats.lineGeometries).toBe(before);
  });

  it('hệ số trình chiếu nhân với tô sáng (setScale) và được giữ khi tô sáng tắt', () => {
    const { fx, lm } = fixture();
    fx.setScale(2);
    fx.setTarget('pole', 0, true);
    expect(lm.linewidth).toBeCloseTo(2 * 2 * EMPHASIS_WIDTH);
    fx.setTarget(null, 0, true);
    expect(lm.linewidth).toBeCloseTo(2 * 2);
    fx.setScale(1);
    fx.setTarget('pole', 0, true);
    expect(lm.linewidth).toBeCloseTo(2 * EMPHASIS_WIDTH);
  });
});
