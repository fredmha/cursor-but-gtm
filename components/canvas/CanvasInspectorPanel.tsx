import React from 'react';
import { CanvasElement, CanvasEmailBlock, EmailBlockType } from '../../types';
import {
  clampNumber,
  EMAIL_BLOCK_ALIGNMENTS,
  EmailBlockMetrics,
  EMAIL_BLOCK_TYPES,
  TicketRef
} from './canvas-core';
import { ContainerOption } from './useCanvasController';

type CanvasInspectorPanelProps = {
  selectedElement: CanvasElement;
  selectedNodeParentId?: string;
  selectedIsEmailCard: boolean;
  panelIsBlockMode: boolean;
  panelEmailBlocks: CanvasEmailBlock[];
  activeBlockId: string | null;
  activeSelectedBlock: CanvasEmailBlock | undefined;
  activeSelectedBlockMetrics: EmailBlockMetrics | null;
  containerOptions: ContainerOption[];
  linkedTicketIdsForSelection: string[];
  ticketById: Map<string, TicketRef>;
  blockLimits: {
    minHeight: number;
    maxHeight: number;
    minFontSize: number;
    maxFontSize: number;
    maxPadding: number;
    maxMarginBottom: number;
  };
  onDeleteSelection: () => void;
  onSetActiveBlockId: (blockId: string | null) => void;
  onSelectPanelBlock: (blockId: string) => void;
  onAddEmailBlock: (type: EmailBlockType) => void;
  onUpdateEmailBlock: (blockId: string, updater: (block: CanvasEmailBlock) => CanvasEmailBlock) => void;
  onDeleteEmailBlock: (blockId: string) => void;
  onHandleEmailBlockUpload: (blockId: string, file: File) => void;
  onUpdateSelectedElement: (updater: (element: CanvasElement) => CanvasElement) => void;
  onAssignSelectedParent: (parentId?: string) => void;
  onOpenLinkPanel: () => void;
};

/**
 * Right-side inspector panel for selected canvas element.
 * Inputs: selected model data and callbacks.
 * Output: editor panel UI.
 * Invariant: no direct store mutation; all changes flow through controller callbacks.
 */
export const CanvasInspectorPanel: React.FC<CanvasInspectorPanelProps> = ({
  selectedElement,
  selectedNodeParentId,
  selectedIsEmailCard,
  panelIsBlockMode,
  panelEmailBlocks,
  activeBlockId,
  activeSelectedBlock,
  activeSelectedBlockMetrics,
  containerOptions,
  linkedTicketIdsForSelection,
  ticketById,
  blockLimits,
  onDeleteSelection,
  onSetActiveBlockId,
  onSelectPanelBlock,
  onAddEmailBlock,
  onUpdateEmailBlock,
  onDeleteEmailBlock,
  onHandleEmailBlockUpload,
  onUpdateSelectedElement,
  onAssignSelectedParent,
  onOpenLinkPanel
}) => (
  <div className="absolute top-4 right-4 z-20 w-[300px] bg-white border border-zinc-200 rounded-xl shadow-xl p-3 space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500">Selection</span>
      <button onClick={onDeleteSelection} className="text-xs text-red-600 hover:text-red-700">Delete</button>
    </div>

    {selectedIsEmailCard ? (
      panelIsBlockMode && activeSelectedBlock && activeSelectedBlockMetrics ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-zinc-500">Block Editor</label>
            <button
              onClick={() => onSetActiveBlockId(null)}
              className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700"
            >
              Back to card
            </button>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500">{activeSelectedBlock.type}</div>

          <div className="flex items-center rounded border border-zinc-200 overflow-hidden">
            {EMAIL_BLOCK_ALIGNMENTS.map(align => (
              <button
                key={align}
                onClick={() => onUpdateEmailBlock(activeSelectedBlock.id, current => ({ ...current, align }))}
                className={`flex-1 px-1.5 py-1 text-[10px] font-semibold ${activeSelectedBlock.align === align ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                title={`Align ${align}`}
              >
                {align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right'}
              </button>
            ))}
          </div>

          {activeSelectedBlock.type === 'IMAGE' ? (
            <div className="space-y-1.5">
              <input
                value={activeSelectedBlock.imageUrl || ''}
                placeholder="https://image-url..."
                className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                onChange={event => onUpdateEmailBlock(activeSelectedBlock.id, current => ({ ...current, imageUrl: event.target.value }))}
              />
              <label className="inline-flex items-center gap-2 rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 cursor-pointer">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    onHandleEmailBlockUpload(activeSelectedBlock.id, file);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          ) : activeSelectedBlock.type === 'BODY' ? (
            <textarea
              value={activeSelectedBlock.text || ''}
              rows={3}
              className="w-full rounded border border-zinc-200 px-2 py-1.5 text-xs text-zinc-800"
              onChange={event => onUpdateEmailBlock(activeSelectedBlock.id, current => ({ ...current, text: event.target.value }))}
            />
          ) : (
            <input
              value={activeSelectedBlock.text || ''}
              className="w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-800"
              onChange={event => onUpdateEmailBlock(activeSelectedBlock.id, current => ({ ...current, text: event.target.value }))}
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Height</label>
              <input
                type="number"
                value={activeSelectedBlockMetrics.heightPx}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                onChange={event => {
                  const value = clampNumber(Number(event.target.value) || blockLimits.minHeight, blockLimits.minHeight, blockLimits.maxHeight);
                  onUpdateEmailBlock(activeSelectedBlock.id, block => ({ ...block, heightPx: value }));
                }}
              />
            </div>
            {activeSelectedBlock.type !== 'IMAGE' && (
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Font Size</label>
                <input
                  type="number"
                  value={activeSelectedBlockMetrics.fontSizePx}
                  className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                  onChange={event => {
                    const value = clampNumber(Number(event.target.value) || blockLimits.minFontSize, blockLimits.minFontSize, blockLimits.maxFontSize);
                    onUpdateEmailBlock(activeSelectedBlock.id, block => ({ ...block, fontSizePx: value }));
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Pad X</label>
              <input
                type="number"
                value={activeSelectedBlockMetrics.paddingX}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                onChange={event => {
                  const value = clampNumber(Number(event.target.value) || 0, 0, blockLimits.maxPadding);
                  onUpdateEmailBlock(activeSelectedBlock.id, block => ({ ...block, paddingX: value }));
                }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Pad Y</label>
              <input
                type="number"
                value={activeSelectedBlockMetrics.paddingY}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                onChange={event => {
                  const value = clampNumber(Number(event.target.value) || 0, 0, blockLimits.maxPadding);
                  onUpdateEmailBlock(activeSelectedBlock.id, block => ({ ...block, paddingY: value }));
                }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 mb-1">Spacing</label>
              <input
                type="number"
                value={activeSelectedBlockMetrics.marginBottomPx}
                className="w-full rounded border border-zinc-200 px-2 py-1 text-xs"
                onChange={event => {
                  const value = clampNumber(Number(event.target.value) || 0, 0, blockLimits.maxMarginBottom);
                  onUpdateEmailBlock(activeSelectedBlock.id, block => ({ ...block, marginBottomPx: value }));
                }}
              />
            </div>
          </div>

          <button
            onClick={() => {
              onDeleteEmailBlock(activeSelectedBlock.id);
              onSetActiveBlockId(null);
            }}
            className="w-full rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100"
          >
            Delete Block
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-semibold text-zinc-500">Email Builder</label>
            <span className="text-[10px] text-zinc-400">{panelEmailBlocks.length} blocks</span>
          </div>
          <div className="text-[10px] text-zinc-400">Click a block in canvas to edit it.</div>

          <div className="grid grid-cols-2 gap-1">
            {EMAIL_BLOCK_TYPES.map(type => (
              <button
                key={type}
                onClick={() => onAddEmailBlock(type)}
                className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Add {type}
              </button>
            ))}
          </div>

          <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
            {panelEmailBlocks.length === 0 && (
              <div className="rounded border border-dashed border-zinc-200 p-3 text-xs text-zinc-400 text-center">
                Add blocks to build this email.
              </div>
            )}
            {panelEmailBlocks.map(block => (
              <button
                key={block.id}
                onClick={() => onSelectPanelBlock(block.id)}
                className={`w-full rounded border px-2 py-1.5 text-left text-xs ${activeBlockId === block.id ? 'border-indigo-300 bg-indigo-50/40' : 'border-zinc-200 hover:bg-zinc-50'}`}
              >
                <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500">{block.type}</span>
                <div className="truncate text-zinc-600 mt-1">
                  {block.type === 'IMAGE'
                    ? (block.imageUrl ? 'Image block' : 'Image placeholder')
                    : ((block.text || '').trim() || `${block.type} text`)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    ) : (
      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Text</label>
        <textarea
          value={selectedElement.text || ''}
          rows={3}
          className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-800"
          onChange={event => onUpdateSelectedElement(element => ({ ...element, text: event.target.value }))}
        />
      </div>
    )}

    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Width</label>
        <input
          type="number"
          value={selectedElement.width}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
          onChange={event => onUpdateSelectedElement(element => ({ ...element, width: Math.max(120, Number(event.target.value) || 120) }))}
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Height</label>
        <input
          type="number"
          value={selectedElement.height}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
          onChange={event => onUpdateSelectedElement(element => ({ ...element, height: Math.max(80, Number(event.target.value) || 80) }))}
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => onUpdateSelectedElement(element => ({ ...element, zIndex: Math.max(0, element.zIndex - 1) }))}
        className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
      >
        Back
      </button>
      <button
        onClick={() => onUpdateSelectedElement(element => ({ ...element, zIndex: element.zIndex + 1 }))}
        className="rounded border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
      >
        Front
      </button>
    </div>

    {selectedElement.kind !== 'CONTAINER' && (
      <div>
        <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Container</label>
        <select
          value={selectedNodeParentId || ''}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
          onChange={event => onAssignSelectedParent(event.target.value || undefined)}
        >
          <option value="">No container</option>
          {containerOptions.map(option => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>
    )}

    <div className="border-t border-zinc-100 pt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Ticket Links</span>
        <button onClick={onOpenLinkPanel} className="text-xs text-indigo-600 hover:text-indigo-700">Manage</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {linkedTicketIdsForSelection.length === 0 && <span className="text-xs text-zinc-400">No links</span>}
        {linkedTicketIdsForSelection.map(ticketId => {
          const ticket = ticketById.get(ticketId);
          return (
            <span key={ticketId} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px]">
              {ticket ? ticket.shortId : ticketId.slice(0, 8)}
            </span>
          );
        })}
      </div>
    </div>
  </div>
);
