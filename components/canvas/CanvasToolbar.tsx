import React from 'react';
import { CanvasTool } from '../../types';
import { Icons } from '../../constants';

type CanvasToolbarProps = {
  tool: CanvasTool;
  canUndo: boolean;
  canRedo: boolean;
  onSetTool: (tool: CanvasTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDeleteSelection: () => void;
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
  onSetTool,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDeleteSelection
}) => (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white border border-zinc-200 rounded-2xl shadow-2xl px-3 py-2 flex items-center gap-1">
    <button onClick={() => onSetTool('SELECT')} className={`px-2 py-1.5 rounded ${tool === 'SELECT' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Select">
      <Icons.MousePointer className="w-4 h-4" />
    </button>
    <button onClick={() => onSetTool('HAND')} className={`px-2 py-1.5 rounded ${tool === 'HAND' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Hand">
      <Icons.Layers className="w-4 h-4" />
    </button>
    <button onClick={() => onSetTool('EMAIL_CARD')} className={`px-2 py-1.5 rounded ${tool === 'EMAIL_CARD' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Email Card">
      <Icons.FileText className="w-4 h-4" />
    </button>
    <button onClick={() => onSetTool('CONTAINER')} className={`px-2 py-1.5 rounded ${tool === 'CONTAINER' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`} title="Container">
      <Icons.Layout className="w-4 h-4" />
    </button>

    <div className="w-px h-6 bg-zinc-200 mx-1" />

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
