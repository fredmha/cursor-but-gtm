import { describe, expect, it } from 'vitest';
import {
  appendFreehandPoint,
  createFreehandDraft,
  finalizeFreehandElement,
  normalizeStrokeData,
  toSvgPolylinePoints
} from './canvas-freehand';

describe('canvas freehand helpers', () => {
  it('skips tiny move deltas while drafting', () => {
    const draft = createFreehandDraft({ x: 10, y: 10 });
    const updated = appendFreehandPoint(draft, { x: 10.5, y: 10.5 });
    expect(updated.points.length).toBe(1);
  });

  it('finalizes stroke into a pencil element with local points', () => {
    const draft = createFreehandDraft({ x: 100, y: 80 });
    const next = appendFreehandPoint(draft, { x: 140, y: 95 });
    const element = finalizeFreehandElement(next, 2, () => 'stroke-id');

    expect(element).not.toBeNull();
    expect(element?.id).toBe('stroke-id');
    expect(element?.kind).toBe('PENCIL');
    expect((element?.stroke?.points || []).length).toBe(2);
    expect(element?.width).toBeGreaterThan(10);
    expect(element?.height).toBeGreaterThan(10);
  });

  it('finalizes single-point draft into a visible dot-like stroke', () => {
    const draft = createFreehandDraft({ x: 24, y: 36 });
    const element = finalizeFreehandElement(draft, 3, () => 'dot-id');

    expect(element).not.toBeNull();
    expect(element?.id).toBe('dot-id');
    expect(element?.kind).toBe('PENCIL');
    expect((element?.stroke?.points || []).length).toBe(2);
  });

  it('normalizes stroke payloads and converts them into svg point strings', () => {
    const normalized = normalizeStrokeData({
      points: [{ x: 1, y: 2 }, { x: 3, y: 4 }]
    });

    expect(normalized).toEqual({ points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
    expect(toSvgPolylinePoints(normalized)).toBe('1,2 3,4');
  });
});
