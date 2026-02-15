import React, { useCallback, useMemo, useState } from 'react';
import { Handle, Node, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CanvasElement, CanvasEmailBlock } from '../../types';
import { Icons } from '../../constants';
import { getCanvasKindLabel } from './canvas-element-catalog';
import {
  CANVAS_ELEMENT_MIN_HEIGHT,
  CANVAS_ELEMENT_MIN_WIDTH,
  CanvasNodeData,
  normalizeBlockMetrics,
  ResizeDimensions,
  toFiniteNumber
} from './canvas-core';
import { toSvgPolylinePoints } from './canvas-freehand';

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

type ShapeStyleColors = {
  fill: string;
  stroke: string;
  text: string;
};

/**
 * Returns the typographic weight class for email heading block types.
 * This keeps email text hierarchy readable while avoiding repeated class conditionals.
 * Tradeoff: heading semantics stay tied to this UI mapping and not the block schema.
 */
const getHeadingWeightClass = (type: CanvasEmailBlock['type']): string => {
  if (type === 'H1') return 'font-bold';
  if (type === 'H2') return 'font-semibold';
  if (type === 'H3') return 'font-medium';
  return 'font-normal';
};

/**
 * Returns resolved primitive colors from element style with stable fallbacks.
 * This centralizes color defaults so shape renderers stay consistent across kinds.
 * Tradeoff: shared defaults reduce per-shape palette flexibility unless extended later.
 */
const getShapeStyleColors = (element: CanvasElement): ShapeStyleColors => ({
  fill: element.style?.fill || '#f8fafc',
  stroke: element.style?.stroke || '#64748b',
  text: '#334155'
});

/**
 * Determines whether the kind should use card-shell chrome.
 * Email cards and containers keep structured chrome; whiteboard primitives do not.
 * Tradeoff: kind-specific shell policy must be updated if new structured card kinds are added.
 */
const isCardShellKind = (kind: CanvasElement['kind']): boolean =>
  kind === 'EMAIL_CARD' || kind === 'CONTAINER';

/**
 * Renders a first-class rectangle shape directly in node bounds.
 * The direct SVG avoids nested card visuals so rectangles behave like native whiteboard shapes.
 * Tradeoff: text is centered-only in this version to keep primitive editing simple.
 */
const renderRectangleShapeNode = (element: CanvasElement, frameWidth: number, frameHeight: number): React.ReactNode => {
  const colors = getShapeStyleColors(element);
  const label = (element.text || getCanvasKindLabel(element.kind)).trim();
  const safeWidth = Math.max(frameWidth, 1);
  const safeHeight = Math.max(frameHeight, 1);

  return (
    <div className="relative h-full w-full" data-testid="rectangle-shape">
      <svg className="h-full w-full" viewBox={`0 0 ${safeWidth} ${safeHeight}`}>
        <rect x={1} y={1} width={safeWidth - 2} height={safeHeight - 2} rx={8} fill={colors.fill} stroke={colors.stroke} />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3">
        <span className="text-sm font-semibold text-center break-words" style={{ color: colors.text }}>{label}</span>
      </div>
    </div>
  );
};

/**
 * Renders a first-class ellipse shape directly in node bounds.
 * A dedicated renderer keeps ellipse geometry true instead of relying on rounded div hacks.
 * Tradeoff: text remains center-aligned for predictable layout across aspect ratios.
 */
const renderEllipseShapeNode = (element: CanvasElement, frameWidth: number, frameHeight: number): React.ReactNode => {
  const colors = getShapeStyleColors(element);
  const label = (element.text || getCanvasKindLabel(element.kind)).trim();
  const safeWidth = Math.max(frameWidth, 1);
  const safeHeight = Math.max(frameHeight, 1);

  return (
    <div className="relative h-full w-full" data-testid="ellipse-shape">
      <svg className="h-full w-full" viewBox={`0 0 ${safeWidth} ${safeHeight}`}>
        <ellipse cx={safeWidth / 2} cy={safeHeight / 2} rx={(safeWidth - 2) / 2} ry={(safeHeight - 2) / 2} fill={colors.fill} stroke={colors.stroke} />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3">
        <span className="text-sm font-semibold text-center break-words" style={{ color: colors.text }}>{label}</span>
      </div>
    </div>
  );
};

/**
 * Renders a first-class diamond shape directly in node bounds.
 * Polygon-based geometry preserves sharp-corner semantics expected in decision nodes.
 * Tradeoff: text wrapping in narrow diamonds can still truncate on extreme aspect ratios.
 */
const renderDiamondShapeNode = (element: CanvasElement, frameWidth: number, frameHeight: number): React.ReactNode => {
  const colors = getShapeStyleColors(element);
  const label = (element.text || getCanvasKindLabel(element.kind)).trim();
  const safeWidth = Math.max(frameWidth, 1);
  const safeHeight = Math.max(frameHeight, 1);
  const points = `${safeWidth / 2},1 ${safeWidth - 1},${safeHeight / 2} ${safeWidth / 2},${safeHeight - 1} 1,${safeHeight / 2}`;

  return (
    <div className="relative h-full w-full" data-testid="diamond-shape">
      <svg className="h-full w-full" viewBox={`0 0 ${safeWidth} ${safeHeight}`}>
        <polygon points={points} fill={colors.fill} stroke={colors.stroke} />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <span className="text-sm font-semibold text-center break-words" style={{ color: colors.text }}>{label}</span>
      </div>
    </div>
  );
};

/**
 * Renders a first-class freehand stroke shape directly in node bounds.
 * Preserving direct stroke geometry avoids the prior framed-card artifact around pen paths.
 * Tradeoff: pressure-sensitive stroke styling is not modeled in this implementation.
 */
const renderPencilShapeNode = (
  element: CanvasElement,
  frameWidth: number,
  frameHeight: number,
  strokePoints: string
): React.ReactNode => (
  <div className="h-full w-full" data-testid="pencil-shape">
    <svg className="w-full h-full" viewBox={`0 0 ${Math.max(frameWidth, 1)} ${Math.max(frameHeight, 1)}`} preserveAspectRatio="none">
      <polyline
        points={strokePoints}
        fill="none"
        
        vectorEffect="non-scaling-stroke"
        stroke={element.style?.stroke || '#334155'}
        strokeWidth={element.style?.strokeWidth || 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

/**
 * Renders a text-only canvas node without card chrome.
 * Direct text rendering mirrors whiteboard text-box behavior for fast annotation workflows.
 * Tradeoff: rich-text features are intentionally deferred to keep surface-level complexity low.
 */
const renderTextShapeNode = (element: CanvasElement): React.ReactNode => (
  <div
    className="h-full w-full text-zinc-800 leading-snug whitespace-pre-wrap"
    data-testid="text-shape"
    style={{
      fontSize: element.style?.fontSize || 16,
      fontFamily: element.style?.fontFamily || 'Inter'
    }}
  >
    {element.text || 'Type here...'}
  </div>
);

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
  parentId,
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
  const isGroupedChild = !!parentId && !isContainer;
  const isCardShell = isCardShellKind(element.kind);
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

  const kindLabel = getCanvasKindLabel(element.kind);
  const strokePoints = toSvgPolylinePoints(element.stroke);

  /**
   * Renders primitive nodes directly as geometry without card wrappers.
   * This is the core fix for prior nested-shape rendering artifacts.
   * Tradeoff: primitive kinds share centered-label behavior for now.
   */
  const renderPrimitiveContent = (): React.ReactNode => {
    if (element.kind === 'RECTANGLE') return renderRectangleShapeNode(element, frameWidth, frameHeight);
    if (element.kind === 'ELLIPSE') return renderEllipseShapeNode(element, frameWidth, frameHeight);
    if (element.kind === 'DIAMOND') return renderDiamondShapeNode(element, frameWidth, frameHeight);
    if (element.kind === 'PENCIL') return renderPencilShapeNode(element, frameWidth, frameHeight, strokePoints);
    if (element.kind === 'TEXT') return renderTextShapeNode(element);

    return (
      <div
        className="text-zinc-800 leading-snug font-medium"
        style={{
          fontSize: element.style?.fontSize || 14,
          fontFamily: element.style?.fontFamily || 'Inter'
        }}
      >
        {element.text || (isContainer ? 'Component Group' : 'Email Card')}
      </div>
    );
  };

  return (
    <div
      className={`h-full w-full ${isCardShell ? 'rounded-lg border shadow-sm overflow-hidden flex' : 'relative'} ${selected ? 'ring-2 ring-indigo-400' : ''} ${isGroupedChild && !selected ? 'ring-1 ring-indigo-300' : ''}`}
      style={{
        width: frameWidth,
        height: frameHeight,
        background: isCardShell ? (element.style?.fill || '#ffffff') : 'transparent',
        borderColor: isCardShell
          ? (isGroupedChild ? '#6366f1' : (element.style?.stroke || '#d4d4d8'))
          : 'transparent',
        borderStyle: isCardShell ? (isContainer ? 'dashed' : 'solid') : 'none'
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

      {isCardShell ? (
        <div className="h-full w-full p-3 flex flex-col min-h-0 min-w-0" data-testid="card-shell">
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500 mb-2">
            {kindLabel}
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
            renderPrimitiveContent()
          )}
        </div>
      ) : (
        <div className="h-full w-full">{renderPrimitiveContent()}</div>
      )}
    </div>
  );
};
