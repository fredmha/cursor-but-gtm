import type { CSSProperties } from 'react';
import { CanvasElementKind } from '../../types';

export type PrimitiveShapeKind = 'RECTANGLE' | 'ELLIPSE' | 'DIAMOND';

export const PRIMITIVE_FILL_PALETTE: readonly string[] = [
  '#fee2e2',
  '#fef3c7',
  '#dcfce7',
  '#dbeafe',
  '#e0f2fe',
  '#ede9fe',
  '#fce7f3',
  '#ffedd5',
  '#ffffff'
];

export const PRIMITIVE_STROKE_PALETTE: readonly string[] = [
  '#e11d48',
  '#d97706',
  '#16a34a',
  '#2563eb',
  '#0284c7',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#334155'
];

export const SHAPE_STROKE_WIDTH_OPTIONS: readonly number[] = [1, 2, 3, 4, 6];

/**
 * Determines whether a kind participates in primitive shape styling controls.
 * The dedicated gate keeps color UX focused on whiteboard primitives only.
 * Tradeoff: additional shape-like kinds must be explicitly added to this predicate.
 */
export const isPrimitiveShapeKind = (kind: CanvasElementKind): kind is PrimitiveShapeKind =>
  kind === 'RECTANGLE' || kind === 'ELLIPSE' || kind === 'DIAMOND';

/**
 * Returns board-surface style values used by the canvas workspace shell.
 * A centralized style object keeps the board look consistent across canvas views.
 * Tradeoff: inline style usage is less theme-token friendly than CSS variables.
 */
export const getCanvasBoardStyle = (): CSSProperties => ({
  backgroundColor: '#f8fafc',
  backgroundImage:
    'radial-gradient(circle at 20px 20px, rgba(148, 163, 184, 0.22) 1px, transparent 0)',
  backgroundSize: '28px 28px'
});

/**
 * Returns shared floating-panel classes for toolbar and inspector chrome.
 * Keeping shell classes centralized improves visual consistency with less duplication.
 * Tradeoff: utility-class composition still requires per-component layout classes.
 */
export const getFloatingPanelClassName = (): string =>
  'border border-zinc-200/80 bg-white/95 backdrop-blur-md shadow-[0_24px_48px_-20px_rgba(15,23,42,0.35)]';
