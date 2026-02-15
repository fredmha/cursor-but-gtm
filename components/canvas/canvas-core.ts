import { MutableRefObject } from 'react';
import { Node } from '@xyflow/react';
import {
  CanvasElement,
  CanvasElementKind,
  CanvasEmailBlock,
  CanvasEmailTemplate,
  CanvasRelation,
  CanvasScene,
  EmailBlockAlign,
  EmailBlockType
} from '../../types';
import { createDefaultElementForKind } from './canvas-element-catalog';

// Types

export type CanvasNodeData = {
  element: CanvasElement;
};

export type ResizeDimensions = {
  width?: number;
  height?: number;
};

export type CanvasPoint = {
  x: number;
  y: number;
};

export type CanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BlockResizeState = {
  blockId: string;
  startY: number;
  startHeight: number;
};

export type TicketRef = {
  id: string;
  shortId: string;
  title: string;
  parentType: 'CHANNEL' | 'PROJECT' | 'STANDALONE';
  parentId: string;
};

export type EmailBlockMetrics = Required<Pick<
  CanvasEmailBlock,
  'heightPx' | 'fontSizePx' | 'paddingY' | 'paddingX' | 'marginBottomPx'
>>;

// Constants

export const VIEWPORT_COMMIT_MS = 200;

export const EMAIL_BLOCK_TYPES: EmailBlockType[] = ['H1', 'H2', 'H3', 'BODY', 'IMAGE'];

export const EMAIL_BLOCK_ALIGNMENTS: EmailBlockAlign[] = ['left', 'center', 'right'];

export const CANVAS_ELEMENT_MIN_WIDTH = 120;
export const CANVAS_ELEMENT_MIN_HEIGHT = 80;

export const EMAIL_BLOCK_MIN_HEIGHT = 32;
export const EMAIL_BLOCK_MAX_HEIGHT = 420;
export const EMAIL_BLOCK_MIN_FONT_SIZE = 10;
export const EMAIL_BLOCK_MAX_FONT_SIZE = 48;
export const EMAIL_BLOCK_MAX_PADDING = 24;
export const EMAIL_BLOCK_MAX_MARGIN_BOTTOM = 48;
export const DEFAULT_EMAIL_SUBJECT = 'Subject line...';

const DEFAULT_CANVAS_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const REQUIRED_EMAIL_BODY_BLOCK_ID_BASE = 'required-body';

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
 * Derives a fallback subject from the first non-image text block.
 * This preserves intent for legacy templates that predate dedicated subject storage.
 * Tradeoff: fallback quality depends on existing block ordering and text hygiene.
 */
const getSubjectFallbackFromBlocks = (blocks: CanvasEmailBlock[]): string => {
  const firstTextBlock = blocks.find(block => block.type !== 'IMAGE' && (block.text || '').trim().length > 0);
  return (firstTextBlock?.text || '').trim();
};

/**
 * Builds a deterministic id candidate for an injected required body block.
 * This avoids random ids so temporary UI-only templates remain stable across renders.
 * Tradeoff: generated ids are predictable and optimized for editor determinism over entropy.
 */
const getRequiredBodyBlockIdCandidate = (blocks: CanvasEmailBlock[]): string => {
  const existingBlockIds = new Set(blocks.map(block => block.id));
  let suffix = 1;
  let candidateId = REQUIRED_EMAIL_BODY_BLOCK_ID_BASE;

  while (existingBlockIds.has(candidateId)) {
    suffix += 1;
    candidateId = `${REQUIRED_EMAIL_BODY_BLOCK_ID_BASE}-${suffix}`;
  }

  return candidateId;
};

/**
 * Creates an injected body block payload when templates are missing BODY content.
 * This centralizes defaults so repair-path rows match user-added body rows.
 * Tradeoff: injected copy uses a generic placeholder until users customize content.
 */
const createRequiredBodyBlock = (blockId: string): CanvasEmailBlock => ({
  id: blockId,
  order: 0,
  type: 'BODY',
  align: 'left',
  text: 'Body copy...',
  imageUrl: '',
  ...getDefaultBlockMetrics('BODY')
});

/**
 * Reindexes blocks while preserving current array order.
 * This avoids accidental resorting when invariants intentionally reposition blocks.
 * Tradeoff: caller must provide already-ordered arrays.
 */
const reindexBlocksInCurrentOrder = (blocks: CanvasEmailBlock[]): CanvasEmailBlock[] =>
  blocks.map((block, index) => ({ ...block, order: index }));

/**
 * Ensures every template has at least one BODY block while preserving user order.
 * This keeps BODY presence invariant without forcing BODY rows to the top.
 * Tradeoff: legacy templates without BODY are repaired by appending a synthesized BODY row.
 */
const ensureAtLeastOneBodyBlock = (blocks: CanvasEmailBlock[]): CanvasEmailBlock[] => {
  const orderedBlocks = normalizeEmailBlockOrder(blocks);
  const hasBodyBlock = orderedBlocks.some(block => block.type === 'BODY');

  if (!hasBodyBlock) {
    const requiredBodyBlockId = getRequiredBodyBlockIdCandidate(orderedBlocks);
    const appendedBlocks = [...orderedBlocks, createRequiredBodyBlock(requiredBodyBlockId)];
    return reindexBlocksInCurrentOrder(appendedBlocks);
  }

  return orderedBlocks;
};

/**
 * Return default visual metrics for an email block type.
 * Inputs: block type.
 * Output: complete metrics object.
 * Invariant: all metric fields are set.
 */
export const getDefaultBlockMetrics = (blockType: EmailBlockType): EmailBlockMetrics => {
  if (blockType === 'H1') return { heightPx: 56, fontSizePx: 30, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (blockType === 'H2') return { heightPx: 46, fontSizePx: 24, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
  if (blockType === 'H3') return { heightPx: 40, fontSizePx: 20, paddingY: 8, paddingX: 10, marginBottomPx: 8 };
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
 * Invariant: subject is always populated and at least one BODY block exists.
 */
export const ensureEmailTemplate = (template?: CanvasEmailTemplate): CanvasEmailTemplate => {
  const normalizedInputBlocks = normalizeEmailBlockOrder(template?.blocks || []);
  return {
    version: 1,
    subject: typeof template?.subject === 'string' && template.subject.trim().length > 0
      ? template.subject
      : (getSubjectFallbackFromBlocks(normalizedInputBlocks) || DEFAULT_EMAIL_SUBJECT),
    blocks: ensureAtLeastOneBodyBlock(normalizedInputBlocks)
  };
};

/**
 * Create a new email block with default content and metrics.
 * Inputs: block type and id factory.
 * Output: new block.
 * Invariant: id comes from supplied factory.
 */
export const createEmailBlock = (blockType: EmailBlockType, createId: () => string, order: number): CanvasEmailBlock => ({
  id: createId(),
  order,
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
  if (!template) return 'Email Card';
  if ((template.subject || '').trim().length > 0) return (template.subject || '').trim().slice(0, 80);
  if (template.blocks.length === 0) return 'Email Card';

  const firstTextBlock = template.blocks.find(block => block.type !== 'IMAGE' && (block.text || '').trim().length > 0);
  if (firstTextBlock) return (firstTextBlock.text || '').trim().slice(0, 80);

  const firstImageBlock = template.blocks.find(block => block.type === 'IMAGE');
  if (firstImageBlock) return 'Image Email';

  return 'Email Card';
};

const getSafeBlockOrder = (block: CanvasEmailBlock, fallbackOrder: number): number =>
  toFiniteNumber((block as Partial<CanvasEmailBlock>).order) ?? fallbackOrder;

/**
 * Normalize block order into deterministic array order with contiguous indexes.
 * Inputs: blocks.
 * Output: sorted/reindexed blocks.
 * Invariant: output block.order always matches array index.
 */
export const normalizeEmailBlockOrder = (blocks: CanvasEmailBlock[]): CanvasEmailBlock[] => (
  [...blocks]
    .sort((leftBlock, rightBlock) => {
      const leftOrder = getSafeBlockOrder(leftBlock, Number.POSITIVE_INFINITY);
      const rightOrder = getSafeBlockOrder(rightBlock, Number.POSITIVE_INFINITY);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return leftBlock.id.localeCompare(rightBlock.id);
    })
    .map((block, index) => ({ ...block, order: index }))
);

/**
 * Returns the protected-body block id from a normalized template.
 * Inputs: template.
 * Output: only BODY block id or null.
 * Invariant: id is non-null only when deleting that BODY would violate BODY-exists invariant.
 */
export const getRequiredEmailBodyBlockId = (template: CanvasEmailTemplate): string | null => {
  const bodyBlocks = template.blocks.filter(block => block.type === 'BODY');
  if (bodyBlocks.length !== 1) return null;
  return bodyBlocks[0].id;
};

/**
 * Move a block from one index to another and reindex.
 * Inputs: blocks, source index, destination index.
 * Output: reordered/reindexed blocks.
 * Invariant: invalid index input returns normalized original ordering.
 */
export const moveBlockByIndex = (blocks: CanvasEmailBlock[], sourceIndex: number, destinationIndex: number): CanvasEmailBlock[] => {
  if (sourceIndex === destinationIndex) return normalizeEmailBlockOrder(blocks);
  if (sourceIndex < 0 || sourceIndex >= blocks.length) return normalizeEmailBlockOrder(blocks);
  if (destinationIndex < 0 || destinationIndex >= blocks.length) return normalizeEmailBlockOrder(blocks);

  const orderedBlocks = normalizeEmailBlockOrder(blocks);
  const reorderedBlocks = [...orderedBlocks];
  const [movedBlock] = reorderedBlocks.splice(sourceIndex, 1);
  reorderedBlocks.splice(destinationIndex, 0, movedBlock);
  return reorderedBlocks.map((block, index) => ({ ...block, order: index }));
};

/**
 * Move source block over target block id and reindex.
 * Inputs: blocks, source id, target id.
 * Output: reordered/reindexed blocks.
 * Invariant: unknown ids return normalized original ordering.
 */
export const moveBlockById = (blocks: CanvasEmailBlock[], sourceId: string, targetId: string): CanvasEmailBlock[] => {
  const orderedBlocks = normalizeEmailBlockOrder(blocks);
  const sourceIndex = orderedBlocks.findIndex(block => block.id === sourceId);
  const targetIndex = orderedBlocks.findIndex(block => block.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return orderedBlocks;
  return moveBlockByIndex(orderedBlocks, sourceIndex, targetIndex);
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
  kind: CanvasElementKind,
  x: number,
  y: number,
  zIndex: number,
  createId: () => string 
): CanvasElement => createDefaultElementForKind(kind, x, y, zIndex, createId);

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
 * Output: nodes, ticket links, viewport.
 * Invariant: z-order and parenting are preserved.
 */
export const mapSceneToState = (scene: CanvasScene): {
  nodes: Node<CanvasNodeData>[];
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
      data: { element },
      style: { width: element.width, height: element.height, zIndex: element.zIndex },
      selectable: true,
      draggable: true
    }));

  return {
    nodes,
    ticketLinks: scene.relations.filter(relation => relation.type === 'TICKET_LINK'),
    viewport: scene.viewport
  };
};

/**
 * Rebuild scene from runtime ReactFlow state.
 * Inputs: nodes, ticket links, viewport.
 * Output: persisted scene.
 * Invariant: invalid relations are dropped and ticket links deduped.
 */
export const buildScene = (
  nodes: Node<CanvasNodeData>[],
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

/**
 * Resolves runtime node dimensions with a deterministic fallback chain.
 * Inputs: runtime node payload.
 * Output: finite width and height values.
 * Invariant: dimensions are always non-negative finite numbers.
 */
export const getNodeDimensions = (node: Node<CanvasNodeData>): { width: number; height: number } => {
  const nodeStyle = node.style as { width?: unknown; height?: unknown } | undefined;
  const width = toFiniteNumber(node.width)
    ?? toFiniteNumber(node.measured?.width)
    ?? toFiniteNumber(nodeStyle?.width)
    ?? node.data.element.width;
  const height = toFiniteNumber(node.height)
    ?? toFiniteNumber(node.measured?.height)
    ?? toFiniteNumber(nodeStyle?.height)
    ?? node.data.element.height;

  return {
    width: Math.max(0, width),
    height: Math.max(0, height)
  };
};

/**
 * Resolves absolute node bounds by combining absolute origin and measured size.
 * Inputs: node id and runtime node map.
 * Output: absolute bounds in flow space.
 * Invariant: missing nodes return an empty zero-sized bounds object at origin.
 */
export const getNodeAbsoluteBounds = (
  nodeId: string,
  nodeById: Map<string, Node<CanvasNodeData>>
): CanvasBounds => {
  const node = nodeById.get(nodeId);
  if (!node) return { x: 0, y: 0, width: 0, height: 0 };

  const origin = getAbsolutePosition(nodeId, nodeById);
  const dimensions = getNodeDimensions(node);
  return {
    x: origin.x,
    y: origin.y,
    width: dimensions.width,
    height: dimensions.height
  };
};

/**
 * Tests whether a point is inside inclusive bounds.
 * Inputs: point and bounds.
 * Output: true when point lies on or inside the bounds edges.
 * Invariant: inclusive checks keep drop behavior stable on border pixels.
 */
export const isPointInsideBounds = (point: CanvasPoint, bounds: CanvasBounds): boolean =>
  point.x >= bounds.x
  && point.x <= bounds.x + bounds.width
  && point.y >= bounds.y
  && point.y <= bounds.y + bounds.height;

/**
 * Converts absolute coordinates into parent-relative coordinates.
 * Inputs: absolute point, parent node id, node map.
 * Output: coordinates local to the parent origin.
 * Invariant: when parent is missing, input absolute coordinates are returned unchanged.
 */
export const toParentRelativePosition = (
  absolutePosition: CanvasPoint,
  parentId: string,
  nodeById: Map<string, Node<CanvasNodeData>>
): CanvasPoint => {
  const parentNode = nodeById.get(parentId);
  if (!parentNode) return absolutePosition;
  const parentAbsolute = getAbsolutePosition(parentId, nodeById);
  return {
    x: absolutePosition.x - parentAbsolute.x,
    y: absolutePosition.y - parentAbsolute.y
  };
};

/**
 * Resolves a node's absolute flow-space coordinates.
 * Inputs: node id and runtime node map.
 * Output: absolute point.
 * Invariant: delegates to parent-walk resolution for consistent positioning semantics.
 */
export const toAbsolutePosition = (
  nodeId: string,
  nodeById: Map<string, Node<CanvasNodeData>>
): CanvasPoint => getAbsolutePosition(nodeId, nodeById);

/**
 * Determines whether dropped nodes should trigger container membership reconciliation.
 * Single-node drops preserve auto-parenting while multi-node drags keep existing group topology stable.
 * Tradeoff: multi-selection drops require explicit parent reassignment when users want reparenting.
 */
export const shouldReconcileContainerMembershipAfterDrop = (droppedNodeIds: Set<string>): boolean =>
  droppedNodeIds.size === 1;

const getNodeZIndex = (node: Node<CanvasNodeData>): number => {
  const nodeStyle = node.style as { zIndex?: unknown } | undefined;
  return toFiniteNumber(nodeStyle?.zIndex) ?? node.data.element.zIndex;
};

const isNodeAncestor = (
  ancestorId: string,
  childId: string,
  nodeById: Map<string, Node<CanvasNodeData>>
): boolean => {
  let currentId = nodeById.get(childId)?.parentId;

  while (currentId) {
    if (currentId === ancestorId) return true;
    currentId = nodeById.get(currentId)?.parentId;
  }

  return false;
};

/**
 * Picks the best-fit container for a dropped node using center-point hit testing.
 * Inputs: dropped node, all nodes, and node map.
 * Output: selected container node or undefined.
 * Invariant: only container nodes are considered, with highest z-index taking priority.
 */
export const pickDropContainerForNode = (
  droppedNode: Node<CanvasNodeData>,
  nodes: Node<CanvasNodeData>[],
  nodeById: Map<string, Node<CanvasNodeData>>
): Node<CanvasNodeData> | undefined => {
  if (droppedNode.data.element.kind === 'CONTAINER') return undefined;

  const droppedBounds = getNodeAbsoluteBounds(droppedNode.id, nodeById);
  const droppedCenter: CanvasPoint = {
    x: droppedBounds.x + droppedBounds.width / 2,
    y: droppedBounds.y + droppedBounds.height / 2
  };
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));

  return nodes
    .filter(node => node.data.element.kind === 'CONTAINER')
    .filter(node => node.id !== droppedNode.id)
    .filter(node => !isNodeAncestor(droppedNode.id, node.id, nodeById))
    .filter(node => isPointInsideBounds(droppedCenter, getNodeAbsoluteBounds(node.id, nodeById)))
    .sort((leftNode, rightNode) => {
      const zDiff = getNodeZIndex(rightNode) - getNodeZIndex(leftNode);
      if (zDiff !== 0) return zDiff;
      return (indexById.get(rightNode.id) ?? 0) - (indexById.get(leftNode.id) ?? 0);
    })[0];
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
