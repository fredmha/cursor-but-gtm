import { CanvasStrokePoint } from '../../types';

export type CanvasEraserMode = 'WHOLE_STROKE' | 'PARTIAL';

export const ERASER_DEFAULT_MODE: CanvasEraserMode = 'WHOLE_STROKE';
export const ERASER_DEFAULT_SIZE = 16;
export const ERASER_MIN_SIZE = 6;
export const ERASER_MAX_SIZE = 48;

/**
 * Clamps eraser size into the supported brush range.
 * This keeps pointer hit-testing stable across UI input sources.
 * Tradeoff: callers cannot opt into oversize brushes without changing module constants.
 */
export const clampEraserSize = (size: number): number =>
  Math.min(ERASER_MAX_SIZE, Math.max(ERASER_MIN_SIZE, size));

/**
 * Computes Euclidean distance between two points.
 * This centralizes geometry math for eraser hit-testing.
 * Tradeoff: always uses sqrt-based distance rather than squared optimizations for readability.
 */
const getDistanceBetweenPoints = (a: CanvasStrokePoint, b: CanvasStrokePoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Computes distance from a point to a finite line segment.
 * This supports whole-stroke erasing when the cursor crosses between sampled stroke points.
 * Tradeoff: segment projection math is slightly heavier than endpoint-only checks.
 */
const getDistanceFromPointToSegment = (
  point: CanvasStrokePoint,
  start: CanvasStrokePoint,
  end: CanvasStrokePoint
): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return getDistanceBetweenPoints(point, start);

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const clampedT = Math.min(1, Math.max(0, t));
  const projectedPoint = {
    x: start.x + clampedT * dx,
    y: start.y + clampedT * dy
  };

  return getDistanceBetweenPoints(point, projectedPoint);
};

/**
 * Checks whether a point lies within an eraser brush radius.
 * This is the primitive used by partial erase segmentation.
 * Tradeoff: hard circle edges can feel less natural than feathered brushes.
 */
export const isPointInsideEraser = (
  point: CanvasStrokePoint,
  center: CanvasStrokePoint,
  radius: number
): boolean => getDistanceBetweenPoints(point, center) <= radius;

/**
 * Converts local stroke points into absolute flow-space points.
 * This keeps eraser geometry agnostic to parent-relative node positions.
 * Tradeoff: allocates a new array per conversion to preserve immutability.
 */
export const toAbsoluteStrokePoints = (
  origin: CanvasStrokePoint,
  points: CanvasStrokePoint[]
): CanvasStrokePoint[] => points.map(point => ({
  x: origin.x + point.x,
  y: origin.y + point.y
}));

/**
 * Determines whether any stroke segment intersects the eraser brush.
 * Whole-stroke erase relies on segment-level checks for reliable hit detection.
 * Tradeoff: high-point strokes incur linear segment scans per pointer event.
 */
export const doesStrokeIntersectEraser = (
  points: CanvasStrokePoint[],
  center: CanvasStrokePoint,
  radius: number
): boolean => {
  if (points.length < 2) return false;

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const point = points[index];
    if (isPointInsideEraser(previousPoint, center, radius)) return true;
    if (getDistanceFromPointToSegment(center, previousPoint, point) <= radius) return true;
  }

  return isPointInsideEraser(points[points.length - 1], center, radius);
};

/**
 * Splits a stroke into surviving contiguous runs after partial erase.
 * This powers segment-like erasing by dropping sampled points under the eraser.
 * Tradeoff: erase fidelity depends on stroke point density, not bezier path booleans.
 */
export const splitStrokePointsByEraser = (
  points: CanvasStrokePoint[],
  center: CanvasStrokePoint,
  radius: number
): CanvasStrokePoint[][] => {
  const runs: CanvasStrokePoint[][] = [];
  let currentRun: CanvasStrokePoint[] = [];

  points.forEach(point => {
    if (isPointInsideEraser(point, center, radius)) {
      if (currentRun.length >= 2) runs.push(currentRun);
      currentRun = [];
      return;
    }

    currentRun = [...currentRun, point];
  });

  if (currentRun.length >= 2) runs.push(currentRun);
  return runs;
};

/**
 * Compares two point lists for exact coordinate equality.
 * This avoids unnecessary node rewrites when eraser input does not change a stroke.
 * Tradeoff: strict float equality may miss semantically equivalent near-equal coordinates.
 */
export const areStrokePointsEqual = (
  left: CanvasStrokePoint[],
  right: CanvasStrokePoint[]
): boolean => {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    const leftPoint = left[index];
    const rightPoint = right[index];
    if (leftPoint.x !== rightPoint.x || leftPoint.y !== rightPoint.y) return false;
  }

  return true;
};
