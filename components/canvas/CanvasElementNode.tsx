import React, { useCallback, useMemo, useState } from 'react';
import { Handle, Node, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CanvasEmailBlock } from '../../types';
import { Icons } from '../../constants';
import {
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
  resizingBlockId: string | null;
  onEmailBlockSelect: (cardId: string, blockId: string) => void;
  onEmailBlockReorder: (cardId: string, sourceBlockId: string, targetBlockId: string) => void;
  onEmailBlockResizeStart: (cardId: string, blockId: string, clientY: number) => void;
  onEmailCardSurfaceSelect: (cardId: string) => void;
  onEmailBlockTextChange: (cardId: string, blockId: string, value: string) => void;
};

type SortableEmailRowProps = {
  cardId: string;
  block: CanvasEmailBlock;
  isEditingEmailCard: boolean;
  isActive: boolean;
  isResizing: boolean;
  onEmailBlockSelect: (cardId: string, blockId: string) => void;
  onEmailBlockResizeStart: (cardId: string, blockId: string, clientY: number) => void;
  onEmailBlockTextChange: (cardId: string, blockId: string, value: string) => void;
};

const getHeadingWeightClass = (type: CanvasEmailBlock['type']): string => {
  if (type === 'H1') return 'font-bold';
  if (type === 'H2') return 'font-semibold';
  if (type === 'H3') return 'font-medium';
  return 'font-normal';
};

const SortableEmailRow: React.FC<SortableEmailRowProps> = ({
  cardId,
  block,
  isEditingEmailCard,
  isActive,
  isResizing,
  onEmailBlockSelect,
  onEmailBlockResizeStart,
  onEmailBlockTextChange
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active
  } = useSortable({ id: block.id, disabled: !isEditingEmailCard });

  const metrics = normalizeBlockMetrics(block);
  const align = block.align;
  const alignClass = align === 'center' ? 'text-center items-center' : align === 'right' ? 'text-right items-end' : 'text-left items-start';
  const headingWeightClass = getHeadingWeightClass(block.type);
  const showDropTarget = isEditingEmailCard && isOver && active?.id !== block.id;
  const contentMinHeight = Math.max(24, metrics.heightPx - (metrics.paddingY * 2));

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        minHeight: metrics.heightPx,
        marginBottom: metrics.marginBottomPx
      }}
      className={`email-row nodrag nopan relative rounded border transition-all duration-150 ${isActive ? 'border-indigo-300 bg-indigo-50/40' : 'border-zinc-200 bg-white'} ${isDragging ? 'opacity-60' : ''} ${isResizing ? 'ring-1 ring-indigo-300' : ''} ${showDropTarget ? 'ring-2 ring-indigo-200' : ''}`}
      onMouseDown={event => {
        if (isEditingEmailCard) event.stopPropagation();
        onEmailBlockSelect(cardId, block.id);
      }}
    >
      {showDropTarget && (
        <div className="absolute inset-x-2 top-0 h-[2px] bg-indigo-500 rounded-full" />
      )}

      <div
        className={`relative h-full min-w-0 w-full box-border flex flex-col ${alignClass}`}
        style={{
          paddingTop: metrics.paddingY,
          paddingBottom: metrics.paddingY,
          paddingLeft: metrics.paddingX,
          paddingRight: metrics.paddingX
        }}
      >
        {isEditingEmailCard && (
          <div className="absolute top-1 right-1 flex items-center gap-1">
            <button
              type="button"
              {...attributes}
              {...listeners}
              onMouseDown={event => event.stopPropagation()}
              className="nodrag nopan touch-none cursor-grab text-zinc-400 hover:text-zinc-600"
              title="Drag block"
            >
              <Icons.GripVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {block.type === 'IMAGE' ? (
          <div className={`flex min-w-0 w-full flex-col ${alignClass}`} style={{ minHeight: Math.max(64, contentMinHeight) }}>
            {block.imageUrl ? (
              <img src={block.imageUrl} alt="Email block" className="w-full h-full max-w-full object-contain rounded border border-zinc-200 bg-white" />
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
              className={`nodrag nopan min-w-0 w-full box-border rounded border border-indigo-200 bg-white px-2 py-1.5 text-zinc-800 leading-snug ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
              style={{ fontSize: metrics.fontSizePx, minHeight: Math.max(36, contentMinHeight) }}
              onMouseDown={event => event.stopPropagation()}
              onChange={event => onEmailBlockTextChange(cardId, block.id, event.target.value)}
            />
          ) : (
            <input
              value={block.text || ''}
              className={`nodrag nopan min-w-0 w-full box-border rounded border border-indigo-200 bg-white px-2 py-1 text-zinc-800 leading-snug ${headingWeightClass} ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
              style={{ fontSize: metrics.fontSizePx, minHeight: contentMinHeight }}
              onMouseDown={event => event.stopPropagation()}
              onChange={event => onEmailBlockTextChange(cardId, block.id, event.target.value)}
            />
          )
        ) : (
          <div
            className={`${headingWeightClass} min-w-0 w-full text-zinc-800 leading-snug break-words ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
            style={{ fontSize: metrics.fontSizePx, minHeight: contentMinHeight }}
          >
            {(block.text || '').trim() || `${block.type} text`}
          </div>
        )}

        {isEditingEmailCard && (
          <div
            className="nodrag nopan absolute left-2 right-2 bottom-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={event => {
              event.stopPropagation();
              onEmailBlockResizeStart(cardId, block.id, event.clientY);
            }}
            title="Resize block"
          >
            <div className="mx-auto mt-1 h-[2px] w-12 rounded-full bg-indigo-300" />
          </div>
        )}
      </div>
    </div>
  );
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
  resizingBlockId,
  onEmailBlockSelect,
  onEmailBlockReorder,
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
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const blockIds = useMemo(() => emailBlocks.map(block => block.id), [emailBlocks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!isEditingEmailCard) return;
    const sourceId = String(event.active.id);
    setDraggingBlockId(sourceId);
    onEmailBlockSelect(id, sourceId);
  }, [id, isEditingEmailCard, onEmailBlockSelect]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingBlockId(null);
    if (!isEditingEmailCard) return;

    const sourceId = String(event.active.id);
    const targetId = event.over ? String(event.over.id) : null;
    if (!targetId || sourceId === targetId) return;
    onEmailBlockReorder(id, sourceId, targetId);
  }, [id, isEditingEmailCard, onEmailBlockReorder]);

  const handleDragCancel = useCallback(() => {
    setDraggingBlockId(null);
  }, []);

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

      <div className="h-full w-full p-3 flex flex-col min-h-0 min-w-0">
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500 mb-2">
          {element.kind.replace('_', ' ')}
        </span>
        {emailBlocks.length > 0 ? (
          <div
            className="flex-1 min-h-0 min-w-0 overflow-y-auto pr-1"
            onMouseDown={event => {
              const target = event.target as HTMLElement;
              if (target.closest('.email-row')) return;
              onEmailCardSurfaceSelect(id);
            }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                {emailBlocks.map(block => (
                  <SortableEmailRow
                    key={block.id}
                    cardId={id}
                    block={block}
                    isEditingEmailCard={isEditingEmailCard}
                    isActive={activeBlockId === block.id && isEditingEmailCard}
                    isResizing={resizingBlockId === block.id && isEditingEmailCard}
                    onEmailBlockSelect={onEmailBlockSelect}
                    onEmailBlockResizeStart={onEmailBlockResizeStart}
                    onEmailBlockTextChange={onEmailBlockTextChange}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {draggingBlockId && (
              <span className="sr-only">dragging-block:{draggingBlockId}</span>
            )}
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
