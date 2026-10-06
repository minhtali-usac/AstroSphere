import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { dynamicFatLine, geomStats, greatArc, greatArcInto, writeFatLine } from './geom';

describe('greatArcInto', () => {
  it('matches greatArc point for point', () => {
    const a = new THREE.Vector3(1, 0.2, -0.3);
    const b = new THREE.Vector3(-0.1, 1, 0.5);
    const ref = greatArc(a, b, 7, 24);
    const out = new Float32Array(30 * 3);
    const next = greatArcInto(a, b, 7, 24, out, 2);
    expect(next).toBe(2 + 25);
    for (let i = 0; i < ref.length; i++) {
      expect(out[(i + 2) * 3]).toBeCloseTo(ref[i].x, 5);
      expect(out[(i + 2) * 3 + 1]).toBeCloseTo(ref[i].y, 5);
      expect(out[(i + 2) * 3 + 2]).toBeCloseTo(ref[i].z, 5);
    }
  });

  it('writes n + 1 points for coincident directions', () => {
    const a = new THREE.Vector3(0, 0, 2);
    const out = new Float32Array(6 * 3);
    expect(greatArcInto(a, a, 3, 5, out)).toBe(6);
    expect(out[5 * 3 + 2]).toBeCloseTo(3, 6);
  });
});

describe('dynamicFatLine / writeFatLine', () => {
  it('writes in place without creating geometry or buffers', () => {
    const line = dynamicFatLine(10, '#ffffff', { dashed: true, boundsRadius: 5 });
    const geom = line.geometry;
    const start = geom.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
    const dist = geom.getAttribute('instanceDistanceStart') as THREE.InterleavedBufferAttribute;
    const buf = start.data;
    const before = geomStats.lineGeometries;
    const pts = new Float32Array([0, 0, 0, 1, 0, 0, 1, 2, 0, 1, 2, 2]);
    writeFatLine(line, pts, 4);
    expect(geomStats.lineGeometries).toBe(before);
    expect(line.geometry).toBe(geom);
    expect(geom.getAttribute('instanceStart')).toBe(start);
    expect(start.data).toBe(buf);
    expect(geom.instanceCount).toBe(3);
    // Đoạn thứ 3: (1,2,0) → (1,2,2)
    expect(Array.from(buf.array.slice(12, 18))).toEqual([1, 2, 0, 1, 2, 2]);
    // Khoảng cách cộng dồn cho nét đứt: 0–1, 1–3, 3–5
    expect(Array.from(dist.data.array.slice(0, 6))).toEqual([0, 1, 1, 3, 3, 5]);
    expect(geom.boundingSphere?.radius).toBe(5);
    // Nhiều điểm hơn sức chứa: cắt bớt
    writeFatLine(line, new Float32Array(20 * 3), 20);
    expect(geom.instanceCount).toBe(9);
  });
});
