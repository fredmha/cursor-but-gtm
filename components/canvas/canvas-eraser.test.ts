import { describe, expect, it } from 'vitest';
import {
  areStrokePointsEqual,
  clampEraserSize,
  doesStrokeIntersectEraser,
  ERASER_MAX_SIZE,
  ERASER_MIN_SIZE,
  splitStrokePointsByEraser,
  toAbsoluteStrokePoints
} from './canvas-eraser';

describe('canvas eraser helpers', () => {
  it('detects segment intersections for whole-stroke erase', () => {
    const points = [{ x: 0, y: 0 }, { x: 20, y: 0 }];
    const intersects = doesStrokeIntersectEraser(points, { x: 10, y: 1 }, 2);
    expect(intersects).toBe(true);
  });

  it('splits strokes into surviving runs during partial erase', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 0 }
    ];

    const runs = splitStrokePointsByEraser(points, { x: 5, y: 0 }, 1.1);
    expect(runs).toEqual([
      [{ x: 0, y: 0 }, { x: 2, y: 0 }],
      [{ x: 8, y: 0 }, { x: 10, y: 0 }]
    ]);
  });

  it('returns one unchanged run when no points are erased', () => {
    const points = [{ x: 1, y: 1 }, { x: 4, y: 4 }, { x: 8, y: 8 }];
    const runs = splitStrokePointsByEraser(points, { x: 40, y: 40 }, 3);
    expect(runs.length).toBe(1);
    expect(areStrokePointsEqual(runs[0], points)).toBe(true);
  });

  it('converts local stroke points to absolute coordinates', () => {
    const absolute = toAbsoluteStrokePoints({ x: 10, y: 20 }, [{ x: 2, y: 3 }, { x: 4, y: 5 }]);
    expect(absolute).toEqual([{ x: 12, y: 23 }, { x: 14, y: 25 }]);
  });

  it('clamps eraser sizes into supported bounds', () => {
    expect(clampEraserSize(0)).toBe(ERASER_MIN_SIZE);
    expect(clampEraserSize(999)).toBe(ERASER_MAX_SIZE);
    expect(clampEraserSize(18)).toBe(18);
  });
});
