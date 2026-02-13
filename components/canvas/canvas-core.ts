import { MutableRefObject } from 'react';
import { Edge, Node } from '@xyflow/react';
import {
  CanvasElement,
  CanvasEmailBlock,
  CanvasEmailTemplate,
  CanvasRelation,
  CanvasScene,
  EmailBlockAlign,
  EmailBlockType
} from '../../types';

// Types

export type CanvasNodeData = {
  element: CanvasElement;
};

export type ResizeDimensions = {
  width?: number;
  height?: number;
};

export type BlockResizeState = {
  blockId: string;
  startY: number;
  startHeight: number;
};

export type BlockDragState = {
  sourceId: string;
  targetId: string;
  position: 'before' | 'after';
};

export type TicketRef = {
  id: string;
  shortId: string;
  title: string;
  parentType: 'CHANNEL' | 'PROJECT';
  parentId: string;
};

export type EmailBlockMetrics = Required<Pick<
  CanvasEmailBlock,
  'heightPx' | 'fontSizePx' | 'paddingY' | 'paddingX' | 'marginBottomPx'
>>;

// Constants

export const VIEWPORT_COMMIT_MS = 200;

export const EMAIL_BLOCK_TYPES: EmailBlockType[] = ['H1', 'H2', 'BODY', 'IMAGE'];

export const EMAIL_BLOCK_ALIGNMENTS: EmailBlockAlign[] = ['left', 'center', 'right'];

export const CANVAS_ELEMENT_MIN_WIDTH = 120;
export const CANVAS_ELEMENT_MIN_HEIGHT = 80;

export const EMAIL_BLOCK_MIN_HEIGHT = 32;
export const EMAIL_BLOCK_MAX_HEIGHT = 420;
export const EMAIL_BLOCK_MIN_FONT_SIZE = 10;
export const EMAIL_BLOCK_MAX_FONT_SIZE = 48;
export const EMAIL_BLOCK_MAX_PADDING = 24;
export const EMAIL_BLOCK_MAX_MARGIN_BOTTOM = 48;

const DEFAULT_CONTAINER_WIDTH = 560;
const DEFAULT_CONTAINER_HEIGHT = 400;
const DEFAULT_EMAIL_CARD_WIDTH = 340;
const DEFAULT_EMAIL_CARD_HEIGHT = 200;

const DEFAULT_CANVAS_VIEWPORT = { x: 0, y: 0, zoom: 1 };

// Numeric helpers

/**
 * Convert loose input into a finite number.
 * Inputs: unknown scalar (number/string).
 * Output: finite number or undefined.
 * Invariant: never returns NaN/Infinity.
 */
export const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value);
    if (Number.isFinite(parsedValue)) return parsedValue;
  }

  return undefined;
};

/**
 * Clamp value into inclusive numeric bounds.
 * Inputs: value and [minimum, maximum].
 * Output: bounded value.
 * Invariant: return is always in range.
 */
export const clampNumber = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

// Email block helpers

/**
 * Return default visual metrics for an email block type.
 * Inputs: block type.
 * Output: complete metrics object.
 * Invariant: all metric fields are set.
 */
export const getDefaultBlockMetrics = (blockType: EmailBlockType): EmailBlockMetrics => {
  if (blockType === 'H1') return { heightPx: 56, fontSizePx: 30, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (blockType === 'H2') return { heightPx: 46, fontSizePx: 24, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (blockType === 'IMAGE') return { heightPx: 140, fontSizePx: 14, paddingY: 6, paddingX: 6, marginBottomPx: 10 };
  return { heightPx: 84, fontSizePx: 16, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
};

/**
 * Normalize optional block metrics into bounded defaults.
 * Inputs: block.
 * Output: safe, complete metrics.
 * Invariant: values stay within configured limits.
 */
export const normalizeBlockMetrics = (block: CanvasEmailBlock): EmailBlockMetrics => {
  const defaultMetrics = getDefaultBlockMetrics(block.type);
  return {
    heightPx: clampNumber(toFiniteNumber(block.heightPx) ?? defaultMetrics.heightPx, EMAIL_BLOCK_MIN_HEIGHT, EMAIL_BLOCK_MAX_HEIGHT),
    fontSizePx: clampNumber(toFiniteNumber(block.fontSizePx) ?? defaultMetrics.fontSizePx, EMAIL_BLOCK_MIN_FONT_SIZE, EMAIL_BLOCK_MAX_FONT_SIZE),
    paddingY: clampNumber(toFiniteNumber(block.paddingY) ?? defaultMetrics.paddingY, 0, EMAIL_BLOCK_MAX_PADDING),
    paddingX: clampNumber(toFiniteNumber(block.paddingX) ?? defaultMetrics.paddingX, 0, EMAIL_BLOCK_MAX_PADDING),
    marginBottomPx: clampNumber(toFiniteNumber(block.marginBottomPx) ?? defaultMetrics.marginBottomPx, 0, EMAIL_BLOCK_MAX_MARGIN_BOTTOM)
  };
};

/**
 * Ensure template has versioned, array-backed structure.
 * Inputs: optional template.
 * Output: template safe to mutate by copy.
 * Invariant: blocks is always an array.
 */
export const ensureEmailTemplate = (template?: CanvasEmailTemplate): CanvasEmailTemplate => ({
  version: 1,
  blocks: template?.blocks || []
});

/**
 * Create a new email block with default content and metrics.
 * Inputs: block type and id factory.
 * Output: new block.
 * Invariant: id comes from supplied factory.
 */
export const createEmailBlock = (blockType: EmailBlockType, createId: () => string): CanvasEmailBlock => ({
  id: createId(),
  type: blockType,
  align: 'left',
  text: blockType === 'IMAGE' ? '' : (blockType === 'BODY' ? 'Body copy...' : `${blockType} text`),
  imageUrl: '',
  ...getDefaultBlockMetrics(blockType)
});

/**
 * Derive card label from first meaningful template content.
 * Inputs: optional template.
 * Output: display label.
 * Invariant: non-empty fallback is always returned.
 */
export const deriveEmailCardLabel = (template?: CanvasEmailTemplate): string => {
  if (!template || template.blocks.length === 0) return 'Email Card';

  const firstTextBlock = template.blocks.find(block => block.type !== 'IMAGE' && (block.text || '').trim().length > 0);
  if (firstTextBlock) return (firstTextBlock.text || '').trim().slice(0, 80);

  const firstImageBlock = template.blocks.find(block => block.type === 'IMAGE');
  if (firstImageBlock) return 'Image Email';

  return 'Email Card';
};

/**
 * Move source block relative to target block.
 * Inputs: blocks, source id, target id, insert side.
 * Output: reordered blocks.
 * Invariant: invalid move returns original array.
 */
export const moveBlock = (
  blocks: CanvasEmailBlock[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after'
): CanvasEmailBlock[] => {
  const sourceIndex = blocks.findIndex(block => block.id === sourceId);
  const targetIndex = blocks.findIndex(block => block.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceId === targetId) return blocks;

  const reorderedBlocks = [...blocks];
  const [movedBlock] = reorderedBlocks.splice(sourceIndex, 1);
  const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  const insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
  reorderedBlocks.splice(insertIndex, 0, movedBlock);
  return reorderedBlocks;
};

/**
 * Move source block to explicit insertion index.
 * Inputs: blocks, source id, target index.
 * Output: reordered blocks.
 * Invariant: index is clamped into valid range.
 */
export const moveBlockToIndex = (blocks: CanvasEmailBlock[], sourceId: string, insertIndex: number): CanvasEmailBlock[] => {
  const sourceIndex = blocks.findIndex(block => block.id === sourceId);
  if (sourceIndex < 0) return blocks;

  const boundedIndex = clampNumber(insertIndex, 0, blocks.length);
  const reorderedBlocks = [...blocks];
  const [movedBlock] = reorderedBlocks.splice(sourceIndex, 1);
  const adjustedInsertIndex = sourceIndex < boundedIndex ? boundedIndex - 1 : boundedIndex;
  reorderedBlocks.splice(clampNumber(adjustedInsertIndex, 0, reorderedBlocks.length), 0, movedBlock);
  return reorderedBlocks;
};

// Scene mapping helpers

/**
 * Create an empty default scene document.
 * Inputs: none.
 * Output: v2 scene.
 * Invariant: scene schema is stable.
 */
export const createDefaultCanvasScene = (): CanvasScene => ({
  version: 2,
  elements: [],
  relations: [],
  viewport: DEFAULT_CANVAS_VIEWPORT
});

/**
 * Build a default element for creation tools.
 * Inputs: kind, coordinates, z-index, id factory.
 * Output: initialized canvas element.
 * Invariant: defaults match current UI semantics.
 */
export const makeDefaultElement = (
  kind: 'EMAIL_CARD' | 'CONTAINER',
  x: number,
  y: number,
  zIndex: number,
  createId: () => string
): CanvasElement => ({
  id: createId(),
  kind,
  x,
  y,
  width: kind === 'CONTAINER' ? DEFAULT_CONTAINER_WIDTH : DEFAULT_EMAIL_CARD_WIDTH,
  height: kind === 'CONTAINER' ? DEFAULT_CONTAINER_HEIGHT : DEFAULT_EMAIL_CARD_HEIGHT,
  zIndex,
  text: kind === 'CONTAINER' ? 'Email Collection' : 'Email Card',
  style: {
    fill: kind === 'CONTAINER' ? '#f8fafc' : '#ffffff',
    stroke: '#d4d4d8',
    fontSize: 14,
    fontFamily: 'Inter'
  }
});

const getParentMap = (relations: CanvasRelation[]): Map<string, string> => {
  const parentMap = new Map<string, string>();

  relations.forEach(relation => {
    if (relation.type === 'PARENT') parentMap.set(relation.fromId, relation.toId);
  });

  return parentMap;
};

/**
 * Map persisted scene into ReactFlow runtime state.
 * Inputs: scene.
 * Output: nodes, edges, ticket links, viewport.
 * Invariant: z-order and parenting are preserved.
 */
export const mapSceneToState = (scene: CanvasScene): {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  ticketLinks: CanvasRelation[];
  viewport: CanvasScene['viewport'];
} => {
  const parentMap = getParentMap(scene.relations);

  const nodes: Node<CanvasNodeData>[] = scene.elements
    .slice()
    .sort((leftElement, rightElement) => leftElement.zIndex - rightElement.zIndex)
    .map(element => ({
      id: element.id,
      type: 'canvasElement',
      position: { x: element.x, y: element.y },
      parentId: parentMap.get(element.id),
      extent: parentMap.has(element.id) ? 'parent' : undefined,
      data: { element },
      style: { width: element.width, height: element.height, zIndex: element.zIndex },
      selectable: true,
      draggable: true
    }));

  const edges: Edge[] = scene.relations
    .filter(relation => relation.type === 'EDGE')
    .map(relation => ({
      id: relation.id,
      source: relation.fromId,
      target: relation.toId,
      type: 'smoothstep',
      markerEnd: { type: 'arrowclosed' }
    }));

  return {
    nodes,
    edges,
    ticketLinks: scene.relations.filter(relation => relation.type === 'TICKET_LINK'),
    viewport: scene.viewport
  };
};

/**
 * Rebuild scene from runtime ReactFlow state.
 * Inputs: nodes, edges, ticket links, viewport.
 * Output: persisted scene.
 * Invariant: invalid relations are dropped and ticket links deduped.
 */
export const buildScene = (
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  ticketLinks: CanvasRelation[],
  viewport: CanvasScene['viewport']
): CanvasScene => {
  const elements = nodes.map(node => {
    const nodeStyle = node.style as { width?: unknown; height?: unknown; zIndex?: unknown } | undefined;
    const width = toFiniteNumber(node.width) ?? toFiniteNumber(node.measured?.width) ?? toFiniteNumber(nodeStyle?.width) ?? node.data.element.width;
    const height = toFiniteNumber(node.height) ?? toFiniteNumber(node.measured?.height) ?? toFiniteNumber(nodeStyle?.height) ?? node.data.element.height;
    const zIndex = toFiniteNumber(nodeStyle?.zIndex) ?? node.data.element.zIndex;
    return { ...node.data.element, id: node.id, x: node.position.x, y: node.position.y, width, height, zIndex };
  });

  const elementIds = new Set(elements.map(element => element.id));
  const relations: CanvasRelation[] = [];

  // Reconstruct parent relations from runtime parentId fields.
  nodes.forEach(node => {
    if (node.parentId && elementIds.has(node.parentId)) {
      relations.push({ id: `parent-${node.id}`, type: 'PARENT', fromId: node.id, toId: node.parentId });
    }
  });

  edges.forEach(edge => {
    if (elementIds.has(edge.source) && elementIds.has(edge.target)) {
      relations.push({ id: edge.id, type: 'EDGE', fromId: edge.source, toId: edge.target });
    }
  });

  const seenTicketLinkPairs = new Set<string>();

  ticketLinks.forEach(link => {
    if (!elementIds.has(link.fromId)) return;

    const linkKey = `${link.fromId}:${link.toId}`;
    if (seenTicketLinkPairs.has(linkKey)) return;

    seenTicketLinkPairs.add(linkKey);
    relations.push({ id: link.id, type: 'TICKET_LINK', fromId: link.fromId, toId: link.toId });
  });

  return { version: 2, elements, relations, viewport };
};

/**
 * Resolve absolute position by walking parent chain.
 * Inputs: node id and node map.
 * Output: root-space position.
 * Invariant: missing node returns origin.
 */
export const getAbsolutePosition = (
  nodeId: string,
  nodeById: Map<string, Node<CanvasNodeData>>
): { x: number; y: number } => {
  const node = nodeById.get(nodeId);
  if (!node) return { x: 0, y: 0 };
  if (!node.parentId) return { x: node.position.x, y: node.position.y };

  const parentPosition = getAbsolutePosition(node.parentId, nodeById);
  return { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y };
};

// History + timer helpers

/**
 * Push scene into history only when changed.
 * Inputs: scene, refs, version callback.
 * Output: none.
 * Invariant: history index points to latest frame after push.
 */
export const pushSceneHistory = (
  nextScene: CanvasScene,
  historyRef: MutableRefObject<CanvasScene[]>,
  historyIndexRef: MutableRefObject<number>,
  bumpVersion: () => void
): void => {
  const serializedScene = JSON.stringify(nextScene);
  const currentScene = historyRef.current[historyIndexRef.current];
  if (currentScene && JSON.stringify(currentScene) === serializedScene) return;

  const trimmedHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
  trimmedHistory.push(nextScene);
  historyRef.current = trimmedHistory;
  historyIndexRef.current = trimmedHistory.length - 1;
  bumpVersion();
};

/**
 * Reset history to a single scene snapshot.
 * Inputs: scene and refs.
 * Output: none.
 * Invariant: history index resets to zero.
 */
export const resetSceneHistory = (
  sourceScene: CanvasScene,
  historyRef: MutableRefObject<CanvasScene[]>,
  historyIndexRef: MutableRefObject<number>,
  bumpVersion: () => void
): void => {
  historyRef.current = [sourceScene];
  historyIndexRef.current = 0;
  bumpVersion();
};

/**
 * Cancel pending timer and clear ref.
 * Inputs: timer ref.
 * Output: none.
 * Invariant: ref is null after call.
 */
export const clearScheduledTimer = (timerRef: MutableRefObject<number | null>): void => {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
};
