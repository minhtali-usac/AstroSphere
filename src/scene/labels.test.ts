import { describe, expect, it } from 'vitest';
import { declutter, GAP, LabelBoxes } from './declutter';
import { ALLSKY_NAME_RANK, compactKeeps, labelRank } from './labels';

describe('label ranks (review-4 D2)', () => {
  it('all-sky constellation names rank after every star name, pole and circle label', () => {
    for (let mag = -2; mag <= 12; mag++) expect(labelRank('stars', { mag })).toBeLessThan(ALLSKY_NAME_RANK);
    expect(labelRank('poles')).toBeLessThan(ALLSKY_NAME_RANK);
    expect(labelRank('circles')).toBeLessThan(ALLSKY_NAME_RANK);
    expect(labelRank('stars', { rank: 30 })).toBeLessThan(ALLSKY_NAME_RANK);
  });

  it('a constellation name with clearance yields when it would sit right next to a star name', () => {
    const b = new LabelBoxes();
    b.ensure(2);
    b.push(100, 100, 60, 16, false); // star name
    const k = b.push(100 + 60 + GAP + 2, 100, 80, 16, false); // all-sky name, 2 px beyond the normal gap
    b.pad[k] = 6;
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 2)]).toEqual([1, 0]);
    // Without the clearance it would have been kept.
    b.reset();
    b.push(100, 100, 60, 16, false);
    b.push(100 + 60 + GAP + 2, 100, 80, 16, false);
    declutter(b, 800, 600);
    expect([...b.keep.slice(0, 2)]).toEqual([1, 1]);
  });
});

describe('small sphere view keeps only orientation labels (review-4 #4)', () => {
  it('keeps cardinal letters, measurement labels and flagged labels (poles, celestial equator)', () => {
    expect(compactKeeps({ group: 'directions', compactKeep: false })).toBe(true);
    expect(compactKeeps({ group: 'angles', compactKeep: false })).toBe(true);
    expect(compactKeeps({ group: 'poles', compactKeep: true })).toBe(true);
    expect(compactKeeps({ group: 'circles', compactKeep: true })).toBe(true);
  });

  it('drops star and constellation names, zenith/observer and secondary circle labels', () => {
    expect(compactKeeps({ group: 'stars', compactKeep: false })).toBe(false);
    expect(compactKeeps({ group: 'poles', compactKeep: false })).toBe(false);
    expect(compactKeeps({ group: 'circles', compactKeep: false })).toBe(false);
  });
});
