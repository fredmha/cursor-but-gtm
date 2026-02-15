import React, { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Node, NodeProps, NodeResizer } from '@xyflow/react';
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CanvasElement, CanvasEmailBlock } from '../../types';
import { Icons } from '../../constants';
import { getCanvasKindLabel, getCanvasKindStyleDefaults } from './canvas-element-catalog';
import {
  CANVAS_ELEMENT_MIN_HEIGHT,
  CANVAS_ELEMENT_MIN_WIDTH,
  CanvasNodeData,
  ensureEmailTemplate,
  normalizeBlockMetrics,
  ResizeDimensions,
  toFiniteNumber
} from './canvas-core';
import { toSvgPolylinePoints } from './canvas-freehand';
import {
  indentSelectionLines,
  insertSoftLineBreak,
  isShapeRichTextEditableKind,
  outdentSelectionLines,
  sanitizeShapeRichText,
  toRenderableShapeHtml,
  toggleInlineStyle
} from './canvas-rich-text';

export type CanvasElementNodeProps = NodeProps<Node<CanvasNodeData>> & {
  onResizeLive: (id: string, dimensions: ResizeDimensions) => void;
  onResizeDone: (id: string, dimensions: ResizeDimensions) => void;
  editingCardId: string | null;
  activeBlockId: string | null;
  resizingBlockId: string | null;
  onEmailSubjectChange: (cardId: string, value: string) => void;
  onEmailBlockSelect: (cardId: string, blockId: string) => void;
  onEmailBlockReorder: (cardId: string, sourceBlockId: string, targetBlockId: string) => void;
  onEmailBlockResizeStart: (cardId: string, blockId: string, clientY: number) => void;
  onEmailCardSurfaceSelect: (cardId: string) => void;
  onEmailBlockTextChange: (cardId: string, blockId: string, value: string) => void;
  editingShapeId: string | null;
  onShapeTextEditStart: (shapeId: string) => void;
  onShapeTextCommit: (shapeId: string, nextText: string) => void;
  onShapeTextCancel: () => void;
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
  strokeWidth: number;
};

type ShapeTextLayerProps = {
  elementId: string;
  elementText: string | undefined;
  fallbackText: string;
  isEditing: boolean;
  fontSize: number;
  fontFamily: string;
  textClassName: string;
  onCommit: (nextHtml: string) => void;
  onCancel: () => void;
};

/**
 * Places the caret at the end of a contentEditable container.
 * This provides predictable typing behavior when entering inline shape edit mode.
 * Tradeoff: caret always starts at the end instead of restoring prior selection.
 */
const placeCaretAtEnd = (element: HTMLDivElement): void => {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

/**
 * Renders static or editable rich text for primitive shape labels.
 * This isolates contentEditable behavior so shape geometry renderers stay focused on layout.
 * Tradeoff: HTML rendering requires strict sanitization before persistence and display.
 */
const ShapeTextLayer: React.FC<ShapeTextLayerProps> = ({
  elementId,
  elementText,
  fallbackText,
  isEditing,
  fontSize,
  fontFamily,
  textClassName,
  onCommit,
  onCancel
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const draftHtmlRef = useRef<string>('');
  const cancelEditRef = useRef(false);

  /**
   * Applies keyboard semantics for inline shape text editing.
   * This captures rich-text shortcuts and commit/cancel keys within the editor.
   * Tradeoff: browser command support varies slightly across environments.
   */
  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const isMetaModifier = event.metaKey || event.ctrlKey;
    const normalizedKey = event.key.toLowerCase();

    if (isMetaModifier && normalizedKey === 'b') {
      event.preventDefault();
      toggleInlineStyle('bold');
      return;
    }

    if (isMetaModifier && normalizedKey === 'i') {
      event.preventDefault();
      toggleInlineStyle('italic');
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) outdentSelectionLines(); else indentSelectionLines();
      const editorElement = editorRef.current;
      if (editorElement) draftHtmlRef.current = editorElement.innerHTML;
      return;
    }

    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      insertSoftLineBreak();
      const editorElement = editorRef.current;
      if (editorElement) draftHtmlRef.current = editorElement.innerHTML;
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onCommit(draftHtmlRef.current);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditRef.current = true;
      onCancel();
    }
  }, [onCancel, onCommit]);

  /**
   * Captures live HTML draft updates from contentEditable input events.
   * This keeps local editor state in sync before commit sanitization runs.
   * Tradeoff: browser-generated markup can include extra tags that are later sanitized.
   */
  const handleEditorInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
    draftHtmlRef.current = event.currentTarget.innerHTML;
  }, []);

  /**
   * Commits editor content when focus leaves the inline editor.
   * This ensures click-away saves edits while preserving Escape cancel semantics.
   * Tradeoff: blur-driven commit can feel eager for users expecting explicit save actions only.
   */
  const handleEditorBlur = useCallback(() => {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }
    onCommit(draftHtmlRef.current);
  }, [onCommit]);

  /**
   * Blocks ReactFlow drag/select pointer handling while editing text.
   * This keeps text selection interactions from being interpreted as node drags.
   * Tradeoff: node drag is temporarily unavailable until editing exits.
   */
  const handleEditorMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    const editorElement = editorRef.current;
    if (!editorElement) return;
    const initialHtml = sanitizeShapeRichText(elementText || '');
    draftHtmlRef.current = initialHtml;
    editorElement.innerHTML = initialHtml;
    editorElement.focus();
    placeCaretAtEnd(editorElement);
  }, [elementText, isEditing]);

  if (isEditing) {
    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        data-testid={`shape-editor-${elementId}`}
        className={`nodrag nopan h-full w-full rounded border border-indigo-300 bg-white/95 px-2 py-1 outline-none whitespace-pre-wrap ${textClassName}`}
        dir="ltr"
        style={{ fontSize, fontFamily, direction: 'ltr' }}
        onMouseDown={handleEditorMouseDown}
        onInput={handleEditorInput}
        onKeyDown={handleEditorKeyDown}
        onBlur={handleEditorBlur}
      />
    );
  }

  const renderableHtml = toRenderableShapeHtml(elementText, fallbackText);
  return (
    <div
      className={`pointer-events-none h-full w-full whitespace-pre-wrap ${textClassName}`}
      dir="ltr"
      style={{ fontSize, fontFamily, direction: 'ltr' }}
      dangerouslySetInnerHTML={{ __html: renderableHtml }}
    />
  );
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
const getShapeStyleColors = (element: CanvasElement): ShapeStyleColors => {
  const defaults = getCanvasKindStyleDefaults(element.kind);
  return {
    fill: element.style?.fill || defaults.fill,
    stroke: element.style?.stroke || defaults.stroke,
    strokeWidth: toFiniteNumber(element.style?.strokeWidth) ?? defaults.strokeWidth
  };
};

/**
 * Determines whether the kind should use card-shell chrome.
 * Email cards and containers keep structured chrome; whiteboard primitives do not.
 * Tradeoff: kind-specific shell policy must be updated if new structured card kinds are added.
 */
const isCardShellKind = (kind: CanvasElement['kind']): boolean =>
  kind === 'EMAIL_CARD' || kind === 'CONTAINER';

/**
 * Determines whether a kind is rendered as a direct primitive node.
 * Primitive nodes can safely disable inner pointer events because selection/dragging is owned by the outer node shell.
 * Tradeoff: future inline-edit primitives must opt out if they need direct pointer handling.
 */
const isPrimitiveKind = (kind: CanvasElement['kind']): boolean =>
  kind === 'RECTANGLE' || kind === 'ELLIPSE' || kind === 'DIAMOND' || kind === 'TEXT' || kind === 'PENCIL';

/**
 * Renders a first-class rectangle shape directly in node bounds.
 * The direct SVG avoids nested card visuals so rectangles behave like native whiteboard shapes.
 * Tradeoff: text is centered-only in this version to keep primitive editing simple.
 */
const renderRectangleShapeNode = (element: CanvasElement, frameWidth: number, frameHeight: number): React.ReactNode => {
  const colors = getShapeStyleColors(element);
  const safeWidth = Math.max(frameWidth, 1);
  const safeHeight = Math.max(frameHeight, 1);

  return (
    <div className="relative h-full w-full" data-testid="rectangle-shape">
      <svg className="h-full w-full" viewBox={`0 0 ${safeWidth} ${safeHeight}`}>
        <rect
          x={1}
          y={1}
          width={safeWidth - 2}
          height={safeHeight - 2}
          rx={10}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={colors.strokeWidth}
        />
      </svg>
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
  const safeWidth = Math.max(frameWidth, 1);
  const safeHeight = Math.max(frameHeight, 1);

  return (
    <div className="relative h-full w-full" data-testid="ellipse-shape">
      <svg className="h-full w-full" viewBox={`0 0 ${safeWidth} ${safeHeight}`}>
        <ellipse
          cx={safeWidth / 2}
          cy={safeHeight / 2}
          rx={(safeWidth - 2) / 2}
          ry={(safeHeight - 2) / 2}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={colors.strokeWidth}
        />
      </svg>
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
  const safeWidth = Math.max(frameWidth, 1);
  const safeHeight = Math.max(frameHeight, 1);
  const points = `${safeWidth / 2},1 ${safeWidth - 1},${safeHeight / 2} ${safeWidth / 2},${safeHeight - 1} 1,${safeHeight / 2}`;

  return (
    <div className="relative h-full w-full" data-testid="diamond-shape">
      <svg className="h-full w-full" viewBox={`0 0 ${safeWidth} ${safeHeight}`}>
        <polygon
          points={points}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={colors.strokeWidth}
        />
      </svg>
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
 * Renders the text-node base layer without card chrome.
 * The rich-text overlay is rendered separately so edit/view behavior stays consistent with other shapes.
 * Tradeoff: text node display now relies on the shared overlay pipeline instead of standalone markup.
 */
const renderTextShapeNode = (element: CanvasElement): React.ReactNode => (
  <div
    className="h-full w-full"
    data-testid="text-shape"
  />
);

/**
 * Returns the resize-handle class set for one email block row.
 * This keeps handle discoverability predictable while preserving stronger emphasis for active rows.
 * Tradeoff: non-active rows still show a subtle affordance which adds minor visual noise.
 */
const getEmailRowResizeHandleClassName = (isActive: boolean, isResizing: boolean): string => {
  const baseClassName = 'nodrag nopan absolute left-2 right-2 bottom-0 h-2 cursor-ns-resize transition-opacity';
  if (isResizing || isActive) return `${baseClassName} opacity-85`;
  return `${baseClassName} opacity-20 hover:opacity-100`;
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
  const [draftBlockText, setDraftBlockText] = useState(block.text || '');

  /**
   * Syncs local draft text from canonical block data when row identity changes.
   * This mirrors execution-table draft editing to avoid per-keystroke store churn.
   * Tradeoff: external updates overwrite local draft when block text changes upstream.
   */
  useEffect(() => {
    setDraftBlockText(block.text || '');
  }, [block.id, block.text]);

  /**
   * Persists the local email block text draft through controller callbacks.
   * This keeps typing responsive while committing changes at stable interaction boundaries.
   * Tradeoff: parent state is eventually consistent during active typing.
   */
  const commitBlockDraftText = useCallback(() => {
    onEmailBlockTextChange(cardId, block.id, draftBlockText);
  }, [block.id, cardId, draftBlockText, onEmailBlockTextChange]);

  /**
   * Updates local text draft on each keystroke without touching global canvas state.
   * This prevents the recurrent single-character input regression caused by rapid rerenders.
   * Tradeoff: draft state is local and must be explicitly committed on blur.
   */
  const handleDraftBlockTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setDraftBlockText(event.target.value);
  }, []);

  /**
   * Commits heading-row input on Enter to match table-style inline editor ergonomics.
   * Body rows keep multiline Enter behavior and rely on blur to commit.
   * Tradeoff: Enter-to-commit is limited to single-line heading inputs.
   */
  const handleHeadingInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitBlockDraftText();
    event.currentTarget.blur();
  }, [commitBlockDraftText]);

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
              value={draftBlockText}
              rows={3}
              className={`nodrag nopan min-w-0 w-full box-border rounded border border-indigo-200 bg-white px-2 py-1.5 text-zinc-800 leading-snug ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
              style={{ fontSize: metrics.fontSizePx, minHeight: Math.max(36, contentMinHeight) }}
              onMouseDown={event => event.stopPropagation()}
              onChange={handleDraftBlockTextChange}
              onBlur={commitBlockDraftText}
            />
          ) : (
            <input
              value={draftBlockText}
              className={`nodrag nopan min-w-0 w-full box-border rounded border border-indigo-200 bg-white px-2 py-1 text-zinc-800 leading-snug ${headingWeightClass} ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
              style={{ fontSize: metrics.fontSizePx, minHeight: contentMinHeight }}
              onMouseDown={event => event.stopPropagation()}
              onChange={handleDraftBlockTextChange}
              onBlur={commitBlockDraftText}
              onKeyDown={handleHeadingInputKeyDown}
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
            data-testid={`email-block-resize-handle-${block.id}`}
            className={getEmailRowResizeHandleClassName(isActive, isResizing)}
            onMouseDown={event => {
              event.preventDefault();
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
  onEmailSubjectChange,
  onEmailBlockSelect,
  onEmailBlockReorder,
  onEmailBlockResizeStart,
  onEmailCardSurfaceSelect,
  onEmailBlockTextChange,
  editingShapeId,
  onShapeTextEditStart,
  onShapeTextCommit,
  onShapeTextCancel
}) => {
  const element = data.element;
  const isContainer = element.kind === 'CONTAINER';
  const isCardShell = isCardShellKind(element.kind);
  const isPrimitiveNode = isPrimitiveKind(element.kind);
  const supportsShapeRichTextEditing = isShapeRichTextEditableKind(element.kind);
  const isEditingShape = selected && supportsShapeRichTextEditing && editingShapeId === id;
  const frameWidth = toFiniteNumber(width) ?? element.width;
  const frameHeight = toFiniteNumber(height) ?? element.height;
  const emailTemplate = element.kind === 'EMAIL_CARD' ? ensureEmailTemplate(element.emailTemplate) : undefined;
  const emailSubject = emailTemplate?.subject || '';
  const emailBlocks = emailTemplate?.blocks || [];
  const isEditingEmailCard = selected && element.kind === 'EMAIL_CARD' && editingCardId === id;
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [draftEmailSubject, setDraftEmailSubject] = useState(emailSubject);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const blockIds = useMemo(() => emailBlocks.map(block => block.id), [emailBlocks]);

  /**
   * Synchronizes inline subject draft text with canonical template subject updates.
   * This keeps node-local typing state aligned when selection or template source changes externally.
   * Tradeoff: external updates intentionally replace any stale local draft value.
   */
  useEffect(() => {
    setDraftEmailSubject(emailSubject);
  }, [emailSubject, id]);

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

  /**
   * Routes subject/divider clicks to card-surface selection behavior.
   * This keeps non-block email chrome interactions aligned with existing surface semantics.
   * Tradeoff: clicking structure rows exits active block editing context.
   */
  const handleEmailStructureMouseDown = useCallback(() => {
    onEmailCardSurfaceSelect(id);
  }, [id, onEmailCardSurfaceSelect]);

  /**
   * Updates local inline-subject draft text without committing global scene state per keystroke.
   * This matches block-row editing ergonomics to avoid frequent scene rerenders during typing.
   * Tradeoff: subject persistence is deferred until a commit boundary event.
   */
  const handleEmailSubjectInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDraftEmailSubject(event.target.value);
  }, []);

  /**
   * Commits the inline-subject draft to controller state on stable interaction boundaries.
   * This keeps history updates intentional and avoids duplicate commits when no text changed.
   * Tradeoff: subject preview is eventually consistent until blur/Enter commit occurs.
   */
  const commitEmailSubjectDraft = useCallback(() => {
    if (draftEmailSubject === emailSubject) return;
    onEmailSubjectChange(id, draftEmailSubject);
  }, [draftEmailSubject, emailSubject, id, onEmailSubjectChange]);

  /**
   * Applies keyboard commit behavior for the inline subject input.
   * Enter commits and blurs to mirror block heading edit ergonomics.
   * Tradeoff: multiline subject entry is intentionally unsupported.
   */
  const handleEmailSubjectInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitEmailSubjectDraft();
    event.currentTarget.blur();
  }, [commitEmailSubjectDraft]);

  /**
   * Routes subject-input pointer activation through card-surface selection semantics.
   * This keeps inspector mode consistent while preventing parent drag/select handlers from intercepting input focus.
   * Tradeoff: subject input mouse-down always clears active block selection context.
   */
  const handleEmailSubjectInputMouseDown = useCallback((event: ReactMouseEvent<HTMLInputElement>) => {
    event.stopPropagation();
    onEmailCardSurfaceSelect(id);
  }, [id, onEmailCardSurfaceSelect]);

  const kindLabel = getCanvasKindLabel(element.kind);
  const strokePoints = toSvgPolylinePoints(element.stroke);
  const shapeFallbackLabel = element.kind === 'TEXT' ? 'Type here...' : kindLabel;

  /**
   * Starts inline editing for supported shape nodes on double click.
   * This mirrors common whiteboard behavior where shape labels are edited in place.
   * Tradeoff: double click is an extra gesture compared with single-click edit activation.
   */
  const handleShapeDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!supportsShapeRichTextEditing) return;
    event.preventDefault();
    event.stopPropagation();
    onShapeTextEditStart(id);
  }, [id, onShapeTextEditStart, supportsShapeRichTextEditing]);

  /**
   * Commits local shape rich-text draft through controller persistence callbacks.
   * This keeps node-local edit buffering decoupled from scene update scheduling.
   * Tradeoff: commit path depends on shape id identity provided by parent controller.
   */
  const commitShapeDraft = useCallback((nextHtml: string) => {
    onShapeTextCommit(id, nextHtml);
  }, [id, onShapeTextCommit]);

  /**
   * Cancels active shape editing and clears local cancel-intent state.
   * This supports Escape behavior without persisting transient draft markup.
   * Tradeoff: cancel handling assumes controller owns canonical persisted value.
   */
  const cancelShapeDraft = useCallback(() => {
    onShapeTextCancel();
  }, [onShapeTextCancel]);

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
      className={`h-full w-full ${isCardShell ? 'rounded-xl border shadow-sm overflow-hidden flex' : 'relative'} ${selected ? 'ring-2 ring-indigo-400 shadow-[0_10px_30px_-20px_rgba(37,99,235,0.8)]' : ''}`}
      style={{
        width: frameWidth,
        height: frameHeight,
        background: isCardShell ? (element.style?.fill || '#ffffff') : 'transparent',
        borderColor: isCardShell
          ? (element.style?.stroke || '#d4d4d8')
          : 'transparent',
        borderStyle: isCardShell ? (isContainer ? 'dashed' : 'solid') : 'none'
      }}
      onDoubleClick={handleShapeDoubleClick}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={CANVAS_ELEMENT_MIN_WIDTH}
        minHeight={CANVAS_ELEMENT_MIN_HEIGHT}
        lineStyle={{ borderColor: '#6366f1', zIndex: 40, pointerEvents: 'none' }}
        handleStyle={{ borderColor: '#6366f1', zIndex: 40, pointerEvents: 'all' }}
        onResize={(_, params) => onResizeLive(id, params)}
        onResizeEnd={(_, params) => onResizeDone(id, params)}
      />

      {isCardShell ? (
        <div className="h-full w-full p-3 flex flex-col min-h-0 min-w-0" data-testid="card-shell">
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-zinc-500 mb-2">
            {kindLabel}
          </span>
          {element.kind === 'EMAIL_CARD' ? (
            <>
              {isEditingEmailCard ? (
                <input
                  data-testid="email-subject-input"
                  value={draftEmailSubject}
                  placeholder="Subject line..."
                  className="mb-2 nodrag nopan w-full rounded-md border border-transparent bg-zinc-50/70 px-2.5 py-1.5 text-sm font-semibold leading-snug text-zinc-800 outline-none transition focus:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-zinc-200/70"
                  onMouseDown={handleEmailSubjectInputMouseDown}
                  onChange={handleEmailSubjectInputChange}
                  onBlur={commitEmailSubjectDraft}
                  onKeyDown={handleEmailSubjectInputKeyDown}
                />
              ) : (
                <div
                  data-testid="email-subject-row"
                  className={`mb-2 rounded-md bg-zinc-50/60 px-2.5 py-1.5 text-sm font-semibold leading-snug ${emailSubject.trim().length > 0 ? 'text-zinc-800' : 'text-zinc-400'}`}
                  onMouseDown={handleEmailStructureMouseDown}
                >
                  {emailSubject || 'Subject line...'}
                </div>
              )}
              <div
                data-testid="email-line-break"
                className="mb-2 flex select-none items-center gap-2 px-0.5"
                onMouseDown={handleEmailStructureMouseDown}
              >
                <span className="h-px flex-1 bg-zinc-200" />
                <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-400">Line Break</span>
                <span className="h-px flex-1 bg-zinc-200" />
              </div>
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
            </>
          ) : (
            renderPrimitiveContent()
          )}
        </div>
      ) : (
        <div className={`h-full w-full relative ${isPrimitiveNode && !isEditingShape ? 'pointer-events-none' : ''}`}>
          {renderPrimitiveContent()}
          {supportsShapeRichTextEditing && (
            <div className="absolute inset-0 flex items-center justify-center px-3">
              <ShapeTextLayer
                elementId={id}
                elementText={element.text}
                fallbackText={shapeFallbackLabel}
                isEditing={isEditingShape}
                fontSize={element.style?.fontSize || (element.kind === 'TEXT' ? 16 : 14)}
                fontFamily={element.style?.fontFamily || 'Inter'}
                textClassName="text-zinc-800 leading-snug text-center break-words font-semibold"
                onCommit={commitShapeDraft}
                onCancel={cancelShapeDraft}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
