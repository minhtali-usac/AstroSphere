import { describe, expect, it } from 'vitest';
import { riseSet } from '../astro';
import { azimuthText, compassName, selectedValueText } from './infoCard';

describe('Tên hướng trong thẻ thông tin', () => {
  it('đặt tên 8 hướng cho phương vị hữu hạn', () => {
    expect(compassName(0)).not.toMatch(/compass\./);
    expect(compassName(90)).not.toBe(compassName(270));
  });

  it('không lộ khóa i18n khi phương vị không xác định (|φ| = 90°)', () => {
    expect(compassName(Number.NaN)).toBe('');
    expect(azimuthText(Number.NaN)).toBe('A = —');
    const rs = riseSet(0, 0, 90);
    for (const az of [rs.riseAz, rs.setAz]) expect(azimuthText(az)).not.toMatch(/compass|undefined|NaN/);
  });
});

describe('Giá trị đối tượng đang chọn trên dải số liệu (review-3 D2)', () => {
  const text = selectedValueText('Polaris (α UMi)', 37.95, 89.26, 359.2, 20.9);
  it('có đúng hai dòng: α, δ rồi A, h', () => {
    const lines = text.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Polaris: α/);
    expect(lines[0]).toContain('δ');
    expect(lines[1]).toMatch(/^A/);
    expect(lines[1]).toContain('h');
  });
  it('không có khoảng trắng ngắt được bên trong một cặp ký hiệu–giá trị', () => {
    for (const line of text.split('\n')) {
      // Khoảng trắng thường chỉ được đứng ngay sau dấu phẩy hoặc dấu hai chấm.
      expect(line.replace(/[,:] /g, '')).not.toMatch(/ /);
    }
    expect(text).toMatch(/h\u00a0\+20,9°/);
  });
});
