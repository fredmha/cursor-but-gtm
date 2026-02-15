import React from 'react';
import { Icons } from '../../constants';
import { CanvasTool } from '../../types';
import { CanvasToolDefinition, getToolbarTools } from './canvas-element-catalog';

type CanvasToolbarProps = {
  tool: CanvasTool;
  canUndo: boolean;
  canRedo: boolean;
  canGroupSelection: boolean;
  onSetTool: (tool: CanvasTool) => void;
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
  return Icons.Edit;
};

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
      className={`px-2 py-1.5 rounded ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
      title={definition.label}
    >
      <Icon className="w-4 h-4" />
    </button>
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
  onSetTool,
  onUndo,
  onRedo,
  onGroupSelection,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDeleteSelection
}) => (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white border border-zinc-200 rounded-2xl shadow-2xl px-3 py-2 flex items-center gap-1">
    {getToolbarTools().map(definition => (
      <ToolButton key={definition.tool} definition={definition} activeTool={tool} onSetTool={onSetTool} />
    ))}

    <div className="w-px h-6 bg-zinc-200 mx-1" />

    <button
      onClick={onGroupSelection}
      disabled={!canGroupSelection}
      className="px-2 py-1.5 rounded text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
      title="Group Selection"
    >
      Group
    </button>
    <button onClick={onUndo} disabled={!canUndo} className="px-2 py-1.5 rounded text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40" title="Undo">U</button>
    <button onClick={onRedo} disabled={!canRedo} className="px-2 py-1.5 rounded text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-40" title="Redo">R</button>
    <button onClick={onZoomIn} className="px-2 py-1.5 rounded text-zinc-600 hover:bg-zinc-100" title="Zoom In">
      <Icons.Plus className="w-4 h-4" />
    </button>
    <button onClick={onZoomOut} className="px-2 py-1.5 rounded text-zinc-600 hover:bg-zinc-100" title="Zoom Out">
      <Icons.Minus className="w-4 h-4" />
    </button>
    <button onClick={onResetView} className="px-2 py-1.5 rounded text-xs font-semibold text-zinc-600 hover:bg-zinc-100" title="Reset View">
      100%
    </button>

    <div className="w-px h-6 bg-zinc-200 mx-1" />
    <button onClick={onDeleteSelection} className="px-2 py-1.5 rounded text-red-600 hover:bg-red-50" title="Delete">
      <Icons.Trash className="w-4 h-4" />
    </button>
  </div>
);
