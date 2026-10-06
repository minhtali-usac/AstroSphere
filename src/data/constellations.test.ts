import { describe, expect, it } from 'vitest';
import { loadAllFigures, TEMPLATE_FIGURES, templateDescription, TEMPLATES } from './constellations';
import { VI_STAR_NAMES } from './catalog';

describe('constellation figures', () => {
  it('the eager template file holds exactly the TEMPLATES figures', () => {
    expect(Object.keys(TEMPLATE_FIGURES).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  it('template figures are identical to the full 88-figure set', async () => {
    const all = await loadAllFigures();
    expect(Object.keys(all).length).toBe(88);
    for (const t of TEMPLATES) expect(TEMPLATE_FIGURES[t.id]).toEqual(all[t.id]);
  });
});

describe('constellation names (ux-brief §7)', () => {
  it('templates are named by their IAU Latin name; the Vietnamese name comes second in the description', () => {
    const uma = TEMPLATES.find((t) => t.id === 'UMa')!;
    expect(uma.name).toBe('Ursa Major');
    expect(templateDescription(uma).startsWith('Ursa Major — Đại Hùng (Gấu Lớn). ')).toBe(true);
    expect(TEMPLATES.find((t) => t.id === 'Cru')!.name).toBe('Crux');
    for (const t of TEMPLATES) expect(t.name, t.id).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/);
  });

  it('notes name stars by their international name, not the Vietnamese folk name', () => {
    const folk = Object.values(VI_STAR_NAMES);
    for (const t of TEMPLATES) for (const f of folk) expect(t.note.includes(f), `${t.id}: ${f}`).toBe(false);
  });
});
