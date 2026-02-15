import React from 'react';
import { Icons } from '../../constants';
import { CanvasTool } from '../../types';
import { CanvasToolDefinition, getToolbarTools } from './canvas-element-catalog';
import { CanvasEraserMode, ERASER_MAX_SIZE, ERASER_MIN_SIZE } from './canvas-eraser';
import { getFloatingPanelClassName } from './canvas-theme';

type CanvasToolbarProps = {
  tool: CanvasTool;
  canUndo: boolean;
  canRedo: boolean;
  canGroupSelection: boolean;
  eraserMode: CanvasEraserMode;
  eraserSize: number;
  onSetTool: (tool: CanvasTool) => void;
  onSetEraserMode: (mode: CanvasEraserMode) => void;
  onSetEraserSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onGroupSelection: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDeleteSelection: () => void;
};

/**
 * Resolves icon components for toolbar tool definitions.
 * Icon lookup is centralized to keep render functions simple and deterministic.
 * Tradeoff: adding new icon ids requires updating this map explicitly.
 */
const getToolbarToolIcon = (icon: CanvasToolDefinition['icon']): React.FC<React.SVGProps<SVGSVGElement>> => {
  if (icon === 'MousePointer') return Icons.MousePointer;
  if (icon === 'Layers') return Icons.Layers;
  if (icon === 'FileText') return Icons.FileText;
  if (icon === 'Layout') return Icons.Layout;
  if (icon === 'Square') return Icons.Square;
  if (icon === 'Circle') return Icons.Circle;
  if (icon === 'Kanban') return Icons.Kanban;
  if (icon === 'Type') return Icons.Type;
  if (icon === 'Trash') return Icons.Trash;
  return Icons.Edit;
};

/**
 * Returns shared class names for the primary tool buttons.
 * This keeps active and resting states visually consistent across all tools.
 * Tradeoff: utility-heavy class composition can be harder to scan than extracted CSS.
 */
const getToolButtonClassName = (isActive: boolean): string => (
  `h-9 w-9 rounded-xl border transition-all duration-150 flex items-center justify-center ${isActive
    ? 'border-indigo-500 bg-indigo-600 text-white shadow-[0_8px_18px_-10px_rgba(79,70,229,0.75)]'
    : 'border-transparent bg-white text-zinc-600 hover:border-zinc-200 hover:bg-zinc-100'}`
);

/**
 * Returns class names for secondary action buttons in the toolbar.
 * This prevents duplicated class literals across grouped action controls.
 * Tradeoff: tiny style differences require optional parameters instead of local inline tweaks.
 */
const getActionButtonClassName = (isDanger = false): string => (
  `h-9 rounded-lg px-2.5 text-xs font-semibold transition-colors ${isDanger
    ? 'text-rose-600 hover:bg-rose-50'
    : 'text-zinc-600 hover:bg-zinc-100'}`
);

/**
 * Returns wrapper class names for the stacked toolbar layout.
 * This keeps the mini-toolbar anchored directly above the primary toolbar row.
 * Tradeoff: vertical stack consumes slightly more screen height near the canvas bottom edge.
 */
const getToolbarStackClassName = (): string =>
  'absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2';

/**
 * Returns class names for the eraser mini-toolbar shell.
 * This preserves visual continuity with the primary toolbar card styling.
 * Tradeoff: duplicated panel styling can drift if theme shell contracts change.
 */
const getEraserMiniToolbarClassName = (): string =>
  `rounded-2xl px-3 py-2 flex items-center gap-3 ${getFloatingPanelClassName()}`;

/**
 * Returns class names for eraser mode option buttons.
 * Mode buttons mirror active/inactive treatment from primary tool controls.
 * Tradeoff: compact labels keep width small but reduce explanatory copy.
 */
const getEraserModeButtonClassName = (isActive: boolean): string => (
  `h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors ${isActive
    ? 'bg-indigo-600 text-white'
    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`
);

/**
 * Renders one tool button with shared visual state behavior.
 * Keeping this helper named avoids anonymous inline logic in the toolbar body.
 * Tradeoff: helper requires explicit prop threading from the toolbar component.
 */
const ToolButton: React.FC<{
  definition: CanvasToolDefinition;
  activeTool: CanvasTool;
  onSetTool: (tool: CanvasTool) => void;
}> = ({ definition, activeTool, onSetTool }) => {
  const Icon = getToolbarToolIcon(definition.icon);
  const isActive = activeTool === definition.tool;

  return (
    <button
      onClick={() => onSetTool(definition.tool)}
      className={getToolButtonClassName(isActive)}
      title={definition.label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};

/**
 * Renders a single eraser mode button.
 * This helper keeps mode-specific button markup out of the mini-toolbar container.
 * Tradeoff: another small component introduces explicit prop threading.
 */
const EraserModeButton: React.FC<{
  mode: CanvasEraserMode;
  activeMode: CanvasEraserMode;
  label: string;
  onSetEraserMode: (mode: CanvasEraserMode) => void;
}> = ({ mode, activeMode, label, onSetEraserMode }) => {
  const isActive = activeMode === mode;
  const handleClick = (): void => onSetEraserMode(mode);

  return (
    <button
      onClick={handleClick}
      className={getEraserModeButtonClassName(isActive)}
      title={label}
      aria-pressed={isActive}
    >
      {label}
    </button>
  );
};

/**
 * Renders eraser mode and brush-size controls above the primary toolbar.
 * This keeps eraser configuration adjacent to tool selection like conventional canvas products.
 * Tradeoff: controls are visible only in eraser mode, which reduces persistent discoverability.
 */
const EraserMiniToolbar: React.FC<{
  eraserMode: CanvasEraserMode;
  eraserSize: number;
  onSetEraserMode: (mode: CanvasEraserMode) => void;
  onSetEraserSize: (size: number) => void;
}> = ({ eraserMode, eraserSize, onSetEraserMode, onSetEraserSize }) => {
  /**
   * Parses the slider value into a numeric brush size.
   * Explicit parsing keeps the controller API numeric and avoids string leakage.
   * Tradeoff: parse failures fallback to min size instead of preserving previous value.
   */
  const handleBrushSizeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const parsedSize = Number.parseFloat(event.target.value);
    onSetEraserSize(Number.isFinite(parsedSize) ? parsedSize : ERASER_MIN_SIZE);
  };

  return (
    <div className={getEraserMiniToolbarClassName()} data-testid="eraser-mini-toolbar">
      <div className="flex items-center gap-1">
        <EraserModeButton
          mode="WHOLE_STROKE"
          activeMode={eraserMode}
          label="Whole"
          onSetEraserMode={onSetEraserMode}
        />
        <EraserModeButton
          mode="PARTIAL"
          activeMode={eraserMode}
          label="Partial"
          onSetEraserMode={onSetEraserMode}
        />
      </div>
      <div className="flex items-center gap-2 min-w-[172px]">
        <label htmlFor="eraser-size" className="text-xs font-semibold text-zinc-600">Size</label>
        <input
          id="eraser-size"
          type="range"
          min={ERASER_MIN_SIZE}
          max={ERASER_MAX_SIZE}
          step={1}
          value={eraserSize}
          onChange={handleBrushSizeChange}
          className="w-24 accent-indigo-600"
        />
        <span className="w-8 text-right text-xs text-zinc-500 tabular-nums">
          {Math.round(eraserSize)}
        </span>
      </div>
    </div>
  );
};

/**
 * Bottom canvas toolbar.
 * Inputs: active tool state and action callbacks.
 * Output: toolbar UI.
 * Invariant: all actions proxy through controller callbacks only.
 */
export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  tool,
  canUndo,
  canRedo,
  canGroupSelection,
  eraserMode,
  eraserSize,
  onSetTool,
  onSetEraserMode,
  onSetEraserSize,
  onUndo,
  onRedo,
  onGroupSelection,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDeleteSelection
}) => (
  <div className={getToolbarStackClassName()}>
    {tool === 'ERASER' && (
      <EraserMiniToolbar
        eraserMode={eraserMode}
        eraserSize={eraserSize}
        onSetEraserMode={onSetEraserMode}
        onSetEraserSize={onSetEraserSize}
      />
    )}

    <div
      className={`rounded-2xl px-2 py-2 flex items-center gap-1 ${getFloatingPanelClassName()}`}
      data-testid="canvas-toolbar-shell"
    >
      {getToolbarTools().map(definition => (
        <ToolButton key={definition.tool} definition={definition} activeTool={tool} onSetTool={onSetTool} />
      ))}

      <div className="w-px h-8 bg-zinc-200/80 mx-1" />

      <button
        onClick={onGroupSelection}
        disabled={!canGroupSelection}
        className={`${getActionButtonClassName()} disabled:opacity-40`}
        title="Group Selection"
      >
        Group
      </button>
      <button onClick={onUndo} disabled={!canUndo} className={`${getActionButtonClassName()} disabled:opacity-40`} title="Undo">U</button>
      <button onClick={onRedo} disabled={!canRedo} className={`${getActionButtonClassName()} disabled:opacity-40`} title="Redo">R</button>
      <button onClick={onZoomIn} className={getActionButtonClassName()} title="Zoom In">
        <Icons.Plus className="w-4 h-4" />
      </button>
      <button onClick={onZoomOut} className={getActionButtonClassName()} title="Zoom Out">
        <Icons.Minus className="w-4 h-4" />
      </button>
      <button onClick={onResetView} className={getActionButtonClassName()} title="Reset View">
        100%
      </button>

      <div className="w-px h-8 bg-zinc-200/80 mx-1" />
      <button onClick={onDeleteSelection} className={getActionButtonClassName(true)} title="Delete">
        <Icons.Trash className="w-4 h-4" />
      </button>
    </div>
  </div>
);
