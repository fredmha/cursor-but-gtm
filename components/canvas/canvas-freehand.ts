import { CanvasElement, CanvasStrokeData, CanvasStrokePoint } from '../../types';
import { createDefaultElementForKind } from './canvas-element-catalog';

const MIN_POINT_DISTANCE = 2;
const STROKE_PADDING = 6;
const MIN_STROKE_WIDTH = 12;
const MIN_STROKE_HEIGHT = 12;

export type FreehandDraft = {
  points: CanvasStrokePoint[];
};

type StrokeBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * Creates a new in-memory freehand draft from the first pointer point.
 * The draft is intentionally lightweight so pointer move handlers stay cheap.
 * Tradeoff: the draft holds raw points and postpones simplification to commit time.
 */
export const createFreehandDraft = (point: CanvasStrokePoint): FreehandDraft => ({
  points: [point]
});

/**
 * Appends a point when pointer movement is meaningful enough to keep.
 * Distance thresholding reduces noisy segments and avoids oversized scene payloads.
 * Tradeoff: very tiny hand jitter is discarded and cannot be recovered.
 */
export const appendFreehandPoint = (
  draft: FreehandDraft,
  point: CanvasStrokePoint
): FreehandDraft => {
  const lastPoint = draft.points[draft.points.length - 1];
  if (!lastPoint) return { points: [point] };

  const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
  if (distance < MIN_POINT_DISTANCE) return draft;

  return { points: [...draft.points, point] };
};

/**
 * Converts unknown stroke payloads into safe finite points.
 * This protects canvas migration from malformed historical data.
 * Tradeoff: invalid points are dropped rather than repaired heuristically.
 */
export const normalizeStrokeData = (value: unknown): CanvasStrokeData | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as { points?: unknown };
  if (!Array.isArray(candidate.points)) return undefined;

  const points = candidate.points
    .map(toStrokePoint)
    .filter((point): point is CanvasStrokePoint => point !== null);

  if (points.length < 2) return undefined;
  return { points };
};

/**
 * Finalizes a freehand draft into a persisted canvas element.
 * Points are normalized to element-local coordinates so resizing and moving remain predictable.
 * Tradeoff: this stores vector points only and does not preserve brush pressure metadata.
 */
export const finalizeFreehandElement = (
  draft: FreehandDraft,
  zIndex: number,
  createId: () => string
): CanvasElement | null => {
  if (draft.points.length < 2) return null;

  const bounds = getStrokeBounds(draft.points);
  const width = Math.max(MIN_STROKE_WIDTH, bounds.maxX - bounds.minX + STROKE_PADDING * 2);
  const height = Math.max(MIN_STROKE_HEIGHT, bounds.maxY - bounds.minY + STROKE_PADDING * 2);

  const baseElement = createDefaultElementForKind('PENCIL', bounds.minX - STROKE_PADDING, bounds.minY - STROKE_PADDING, zIndex, createId);
  const localPoints = draft.points.map(point => ({
    x: point.x - bounds.minX + STROKE_PADDING,
    y: point.y - bounds.minY + STROKE_PADDING
  }));

  return {
    ...baseElement,
    width,
    height,
    stroke: { points: localPoints }
  };
};

/**
 * Produces an SVG `points` attribute from stored stroke data.
 * Keeping this in one helper avoids inconsistent path formatting across renderers.
 * Tradeoff: whitespace-delimited format is compact but harder to diff manually.
 */
export const toSvgPolylinePoints = (stroke?: CanvasStrokeData): string => {
  if (!stroke || stroke.points.length === 0) return '';
  return stroke.points.map(point => `${point.x},${point.y}`).join(' ');
};

/**
 * Validates and normalizes a raw point candidate.
 * Shared parsing prevents duplicated finite-number guards in migration code.
 * Tradeoff: strict finite-number checks drop partially valid payloads.
 */
export const toStrokePoint = (value: unknown): CanvasStrokePoint | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { x?: unknown; y?: unknown };
  if (typeof candidate.x !== 'number' || !Number.isFinite(candidate.x)) return null;
  if (typeof candidate.y !== 'number' || !Number.isFinite(candidate.y)) return null;
  return { x: candidate.x, y: candidate.y };
};

/**
 * Computes absolute bounds for a point list.
 * Bounds are used to derive element frame dimensions for persisted strokes.
 * Tradeoff: this is linear per commit, which is acceptable for V1 stroke sizes.
 */
export const getStrokeBounds = (points: CanvasStrokePoint[]): StrokeBounds => {
  const seed = points[0];
  let minX = seed.x;
  let minY = seed.y;
  let maxX = seed.x;
  let maxY = seed.y;

  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return { minX, minY, maxX, maxY };
};
