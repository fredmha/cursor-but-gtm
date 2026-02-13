import React from 'react';
import { Handle, Node, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { Icons } from '../../constants';
import {
  BlockDragState,
  CANVAS_ELEMENT_MIN_HEIGHT,
  CANVAS_ELEMENT_MIN_WIDTH,
  CanvasNodeData,
  normalizeBlockMetrics,
  ResizeDimensions,
  toFiniteNumber
} from './canvas-core';

export type CanvasElementNodeProps = NodeProps<Node<CanvasNodeData>> & {
  onResizeLive: (id: string, dimensions: ResizeDimensions) => void;
  onResizeDone: (id: string, dimensions: ResizeDimensions) => void;
  editingCardId: string | null;
  activeBlockId: string | null;
  dragState: BlockDragState | null;
  resizingBlockId: string | null;
  onEmailBlockSelect: (cardId: string, blockId: string) => void;
  onEmailBlockDragStart: (cardId: string, blockId: string) => void;
  onEmailBlockDragOver: (cardId: string, blockId: string, position: 'before' | 'after') => void;
  onEmailBlockDrop: (cardId: string, blockId: string, position: 'before' | 'after') => void;
  onEmailBlockDropAt: (cardId: string, insertIndex: number) => void;
  onEmailBlockDragEnd: () => void;
  onEmailBlockResizeStart: (cardId: string, blockId: string, clientY: number) => void;
  onEmailCardSurfaceSelect: (cardId: string) => void;
  onEmailBlockTextChange: (cardId: string, blockId: string, value: string) => void;
};

/**
 * Render one canvas element node.
 * Inputs: React Flow node props and callbacks provided by workspace controller.
 * Output: JSX for a selectable/resizable card container.
 * Invariant: render branch preserves exact edit/read-only behavior for email blocks.
 */
export const CanvasElementNode: React.FC<CanvasElementNodeProps> = ({
  id,
  data,
  selected,
  width,
  height,
  onResizeLive,
  onResizeDone,
  editingCardId,
  activeBlockId,
  dragState,
  resizingBlockId,
  onEmailBlockSelect,
  onEmailBlockDragStart,
  onEmailBlockDragOver,
  onEmailBlockDrop,
  onEmailBlockDropAt,
  onEmailBlockDragEnd,
  onEmailBlockResizeStart,
  onEmailCardSurfaceSelect,
  onEmailBlockTextChange
}) => {
  const element = data.element;
  const isContainer = element.kind === 'CONTAINER';
  const frameWidth = toFiniteNumber(width) ?? element.width;
  const frameHeight = toFiniteNumber(height) ?? element.height;
  const emailBlocks = element.kind === 'EMAIL_CARD' ? (element.emailTemplate?.blocks || []) : [];
  const isEditingEmailCard = selected && element.kind === 'EMAIL_CARD' && editingCardId === id;

  return (
    <div
      className={`h-full w-full rounded-lg border shadow-sm overflow-hidden flex ${selected ? 'ring-2 ring-indigo-400' : ''}`}
      style={{
        width: frameWidth,
        height: frameHeight,
        background: element.style?.fill || '#ffffff',
        borderColor: element.style?.stroke || '#d4d4d8',
        borderStyle: isContainer ? 'dashed' : 'solid'
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={CANVAS_ELEMENT_MIN_WIDTH}
        minHeight={CANVAS_ELEMENT_MIN_HEIGHT}
        lineStyle={{ borderColor: '#6366f1' }}
        handleStyle={{ borderColor: '#6366f1' }}
        onResize={(_, params) => onResizeLive(id, params)}
        onResizeEnd={(_, params) => onResizeDone(id, params)}
      />
      <Handle type="target" position={Position.Top} style={{ width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ width: 8, height: 8 }} />
      <Handle type="target" position={Position.Bottom} style={{ width: 8, height: 8 }} />
      <Handle type="source" position={Position.Left} style={{ width: 8, height: 8 }} />

      <div className="h-full w-full p-3 flex flex-col min-h-0">
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500 mb-2">
          {element.kind.replace('_', ' ')}
        </span>
        {emailBlocks.length > 0 ? (
          <div
            className="flex-1 min-h-0 overflow-y-auto pr-1"
            onMouseDown={event => {
              const target = event.target as HTMLElement;
              if (target.closest('.email-row')) return;
              onEmailCardSurfaceSelect(id);
            }}
          >
            {emailBlocks.map((block, index) => {
              const metrics = normalizeBlockMetrics(block);
              const align = block.align;
              const alignClass = align === 'center' ? 'text-center items-center' : align === 'right' ? 'text-right items-end' : 'text-left items-start';
              const isActive = activeBlockId === block.id && isEditingEmailCard;
              const isDragSource = dragState?.sourceId === block.id && isEditingEmailCard;
              const isDragTargetBefore = dragState?.targetId === block.id && dragState.position === 'before' && isEditingEmailCard;
              const isDragTargetAfter = dragState?.targetId === block.id && dragState.position === 'after' && isEditingEmailCard;
              const isResizing = resizingBlockId === block.id && isEditingEmailCard;

              return (
                <React.Fragment key={block.id}>
                  {/* top gutter handles explicit "insert before" drop */}
                  <div
                    className={`h-3 rounded ${dragState && isEditingEmailCard && isDragTargetBefore ? 'bg-indigo-100/70' : 'bg-transparent'}`}
                    onDragOver={event => {
                      if (!isEditingEmailCard) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onEmailBlockDragOver(id, block.id, 'before');
                    }}
                    onDrop={event => {
                      if (!isEditingEmailCard) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onEmailBlockDropAt(id, index);
                    }}
                  />

                  <div
                    className={`email-row nodrag nopan relative rounded border transition-all duration-150 ${isActive ? 'is-active border-indigo-300 bg-indigo-50/40' : 'border-zinc-200 bg-white'} ${isDragSource ? 'is-drag-source opacity-60' : ''} ${isDragTargetBefore ? 'is-drag-target-before' : ''} ${isDragTargetAfter ? 'is-drag-target-after' : ''} ${isResizing ? 'is-resizing ring-1 ring-indigo-300' : ''}`}
                    style={{ minHeight: metrics.heightPx, marginBottom: metrics.marginBottomPx }}
                    onMouseDown={event => {
                      if (isEditingEmailCard) {
                        event.stopPropagation();
                      }
                      onEmailBlockSelect(id, block.id);
                    }}
                    onDragOver={event => {
                      if (!isEditingEmailCard) return;
                      event.preventDefault();
                      event.stopPropagation();
                      // Split the block by midpoint: above => before, below => after.
                      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                      onEmailBlockDragOver(id, block.id, position);
                    }}
                    onDrop={event => {
                      if (!isEditingEmailCard) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                      onEmailBlockDrop(id, block.id, position);
                    }}
                  >
                    {isDragTargetBefore && (
                      <div className="absolute -top-1 left-2 right-2 h-[2px] bg-indigo-500 rounded-full animate-pulse" />
                    )}
                    {isDragTargetAfter && (
                      <div className="absolute -bottom-1 left-2 right-2 h-[2px] bg-indigo-500 rounded-full animate-pulse" />
                    )}

                    <div className={`h-full flex flex-col ${alignClass}`} style={{ paddingTop: metrics.paddingY, paddingBottom: metrics.paddingY, paddingLeft: metrics.paddingX, paddingRight: metrics.paddingX }}>
                      {isEditingEmailCard && (
                        <div className="absolute top-1 right-1 flex items-center gap-1">
                          <span
                            draggable
                            onDragStart={event => {
                              event.stopPropagation();
                              event.dataTransfer.effectAllowed = 'move';
                              onEmailBlockDragStart(id, block.id);
                            }}
                            onDragEnd={event => {
                              event.stopPropagation();
                              onEmailBlockDragEnd();
                            }}
                            onMouseDown={event => event.stopPropagation()}
                            className="nodrag nopan cursor-grab text-zinc-400 hover:text-zinc-600"
                            title="Drag block"
                          >
                            <Icons.GripVertical className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      )}

                      {block.type === 'IMAGE' ? (
                        <div className={`flex flex-col w-full ${alignClass}`} style={{ minHeight: Math.max(64, metrics.heightPx - metrics.paddingY * 2) }}>
                          {block.imageUrl ? (
                            <img src={block.imageUrl} alt="Email block" className="max-w-full w-full h-full object-contain rounded border border-zinc-200 bg-white" />
                          ) : (
                            <div className="w-full h-full rounded border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 text-xs flex items-center justify-center">
                              Image placeholder
                            </div>
                          )}
                        </div>
                      ) : isActive ? (
                        block.type === 'BODY' ? (
                          <textarea
                            value={block.text || ''}
                            rows={3}
                            className={`nodrag nopan w-full rounded border border-indigo-200 bg-white px-2 py-1.5 text-zinc-800 leading-snug ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
                            style={{ fontSize: metrics.fontSizePx, minHeight: Math.max(36, metrics.heightPx - metrics.paddingY * 2) }}
                            onMouseDown={event => event.stopPropagation()}
                            onChange={event => onEmailBlockTextChange(id, block.id, event.target.value)}
                          />
                        ) : (
                          <input
                            value={block.text || ''}
                            className={`nodrag nopan w-full rounded border border-indigo-200 bg-white px-2 py-1 text-zinc-800 leading-snug ${block.type === 'H1' ? 'font-bold' : 'font-semibold'} ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
                            style={{ fontSize: metrics.fontSizePx, minHeight: Math.max(24, metrics.heightPx - metrics.paddingY * 2) }}
                            onMouseDown={event => event.stopPropagation()}
                            onChange={event => onEmailBlockTextChange(id, block.id, event.target.value)}
                          />
                        )
                      ) : (
                        <div
                          className={`${block.type === 'H1' ? 'font-bold' : block.type === 'H2' ? 'font-semibold' : 'font-normal'} text-zinc-800 leading-snug break-words w-full ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
                          style={{ fontSize: metrics.fontSizePx, minHeight: Math.max(24, metrics.heightPx - metrics.paddingY * 2) }}
                        >
                          {(block.text || '').trim() || `${block.type} text`}
                        </div>
                      )}

                      {isEditingEmailCard && (
                        <div
                          className="nodrag nopan absolute left-2 right-2 bottom-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity"
                          onMouseDown={event => {
                            event.stopPropagation();
                            onEmailBlockResizeStart(id, block.id, event.clientY);
                          }}
                          title="Resize block"
                        >
                          <div className="mx-auto mt-1 h-[2px] w-12 rounded-full bg-indigo-300" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* trailing gutter handles explicit "insert after" drop */}
                  {index === emailBlocks.length - 1 && (
                    <div
                      className={`h-3 rounded ${dragState && isEditingEmailCard && isDragTargetAfter ? 'bg-indigo-100/70' : 'bg-transparent'}`}
                      onDragOver={event => {
                        if (!isEditingEmailCard) return;
                        event.preventDefault();
                        event.stopPropagation();
                        onEmailBlockDragOver(id, block.id, 'after');
                      }}
                      onDrop={event => {
                        if (!isEditingEmailCard) return;
                        event.preventDefault();
                        event.stopPropagation();
                        onEmailBlockDropAt(id, emailBlocks.length);
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div
            className="text-zinc-800 leading-snug font-medium"
            style={{
              fontSize: element.style?.fontSize || 14,
              fontFamily: element.style?.fontFamily || 'Inter'
            }}
          >
            {element.text || (isContainer ? 'Email Collection' : 'Email Card')}
          </div>
        )}
      </div>
    </div>
  );
};
