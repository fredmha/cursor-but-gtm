import { CanvasElement, CanvasElementKind, CanvasTool } from '../../types';

export type CanvasToolDefinition = {
  tool: CanvasTool;
  label: string;
  icon: 'MousePointer' | 'Layers' | 'FileText' | 'Layout' | 'Square' | 'Circle' | 'Kanban' | 'Type' | 'Edit' | 'Trash';
};

const CANVAS_KIND_LABELS: Record<CanvasElementKind, string> = {
  EMAIL_CARD: 'Email Card',
  CONTAINER: 'Container',
  RECTANGLE: 'Rectangle',
  ELLIPSE: 'Ellipse',
  DIAMOND: 'Diamond',
  TEXT: 'Text',
  PENCIL: 'Pencil Stroke'
};

const CANVAS_TOOL_TO_KIND: Partial<Record<CanvasTool, CanvasElementKind>> = {
  EMAIL_CARD: 'EMAIL_CARD',
  CONTAINER: 'CONTAINER',
  RECTANGLE: 'RECTANGLE',
  ELLIPSE: 'ELLIPSE',
  DIAMOND: 'DIAMOND',
  TEXT: 'TEXT',
  PENCIL: 'PENCIL'
};

const TOOLBAR_TOOLS: CanvasToolDefinition[] = [
  { tool: 'SELECT', label: 'Select', icon: 'MousePointer' },
  { tool: 'HAND', label: 'Hand', icon: 'Layers' },
  { tool: 'EMAIL_CARD', label: 'Email Card', icon: 'FileText' },
  { tool: 'CONTAINER', label: 'Container', icon: 'Layout' },
  { tool: 'RECTANGLE', label: 'Rectangle', icon: 'Square' },
  { tool: 'ELLIPSE', label: 'Ellipse', icon: 'Circle' },
  { tool: 'DIAMOND', label: 'Diamond', icon: 'Kanban' },
  { tool: 'TEXT', label: 'Text', icon: 'Type' },
  { tool: 'PENCIL', label: 'Pencil', icon: 'Edit' },
  { tool: 'ERASER', label: 'Eraser', icon: 'Trash' }
];

type CanvasElementKindDefaults = {
  width: number;
  height: number;
  text: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
};

const CANVAS_KIND_DEFAULTS: Record<CanvasElementKind, CanvasElementKindDefaults> = {
  EMAIL_CARD: { width: 460, height: 320, text: 'Email Card', fill: '#ffffff', stroke: '#d4d4d8', strokeWidth: 1 },
  CONTAINER: { width: 560, height: 400, text: 'Component Group', fill: '#f8fafc', stroke: '#94a3b8', strokeWidth: 1 },
  RECTANGLE: { width: 260, height: 160, text: 'Rectangle', fill: '#fee2e2', stroke: '#e11d48', strokeWidth: 2 },
  ELLIPSE: { width: 240, height: 160, text: 'Ellipse', fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2 },
  DIAMOND: { width: 220, height: 170, text: 'Decision', fill: '#fef3c7', stroke: '#d97706', strokeWidth: 2 },
  TEXT: { width: 260, height: 90, text: 'Type here...', fill: 'transparent', stroke: 'transparent', strokeWidth: 0 },
  PENCIL: { width: 120, height: 80, text: '', fill: 'transparent', stroke: '#334155', strokeWidth: 2 }
};

/**
 * Maps a canvas tool to a persisted element kind when that tool creates nodes.
 * This isolates tool-kind coupling so controller code does not duplicate switch logic.
 * Tradeoff: one central map requires updates whenever new tools are introduced.
 */
export const getElementKindForTool = (tool: CanvasTool): CanvasElementKind | null =>
  CANVAS_TOOL_TO_KIND[tool] ?? null;

/**
 * Returns toolbar tool definitions in display order.
 * This keeps toolbar rendering declarative instead of duplicating button markup.
 * Tradeoff: icon names are stringly typed to avoid coupling catalog to icon components.
 */
export const getToolbarTools = (): CanvasToolDefinition[] => TOOLBAR_TOOLS;

/**
 * Returns style defaults for the provided canvas kind.
 * This helper prevents renderer-level fallback drift from creation defaults.
 * Tradeoff: callers depend on this module for visual baseline values.
 */
export const getCanvasKindStyleDefaults = (
  kind: CanvasElementKind
): Pick<CanvasElementKindDefaults, 'fill' | 'stroke' | 'strokeWidth'> => {
  const defaults = CANVAS_KIND_DEFAULTS[kind];
  return {
    fill: defaults.fill,
    stroke: defaults.stroke,
    strokeWidth: defaults.strokeWidth
  };
};

/**
 * Creates a default element payload for a specific kind.
 * The helper ensures defaults stay consistent across click-create and grouped element creation flows.
 * Tradeoff: shape defaults are opinionated and may need tuning for design-heavy workflows.
 */
export const createDefaultElementForKind = (
  kind: CanvasElementKind,
  x: number,
  y: number,
  zIndex: number,
  createId: () => string
): CanvasElement => {
  const defaults = CANVAS_KIND_DEFAULTS[kind];

  return {
    id: createId(),
    kind,
    x,
    y,
    width: defaults.width,
    height: defaults.height,
    zIndex,
    text: defaults.text,
    style: {
      fill: defaults.fill,
      stroke: defaults.stroke,
      strokeWidth: defaults.strokeWidth,
      fontSize: 14,
      fontFamily: 'Inter'
    }
  };
};

/**
 * Returns a user-friendly label for each canvas kind.
 * Execution and canvas surfaces share this so linked components read consistently.
 * Tradeoff: centralized labels mean per-surface phrasing customization is reduced.
 */
export const getCanvasKindLabel = (kind: CanvasElementKind): string => CANVAS_KIND_LABELS[kind];

/**
 * Determines whether an element kind can be assigned into a container parent.
 * Containers cannot be nested in V1 to keep grouping semantics predictable.
 * Tradeoff: this limits deep frame hierarchies but avoids layout edge cases.
 */
export const canAssignParentForKind = (kind: CanvasElementKind): boolean => kind !== 'CONTAINER';

/**
 * Determines whether a kind should render generic editable text in the inspector.
 * Pencil strokes are geometric-only in V1 to keep drawing interactions straightforward.
 * Tradeoff: users cannot annotate strokes directly without adding a separate text element.
 */
export const supportsPlainTextEditing = (kind: CanvasElementKind): boolean => kind !== 'PENCIL';
