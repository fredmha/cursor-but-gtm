import { describe, expect, it } from 'vitest';
import { Node } from '@xyflow/react';
import { CanvasEmailBlock, CanvasElement, CanvasScene } from '../../types';
import {
  CanvasNodeData,
  buildScene,
  createDefaultCanvasScene,
  createEmailBlock,
  DEFAULT_EMAIL_SUBJECT,
  ensureEmailTemplate,
  getRequiredEmailBodyBlockId,
  getNodeAbsoluteBounds,
  isPointInsideBounds,
  makeDefaultElement,
  mapSceneToState,
  pickDropContainerForNode,
  moveBlockById,
  moveBlockByIndex,
  normalizeEmailBlockOrder,
  shouldReconcileContainerMembershipAfterDrop,
  toAbsolutePosition,
  toParentRelativePosition
} from './canvas-core';

const makeBlock = (
  id: string,
  order: number,
  type: CanvasEmailBlock['type'] = 'BODY'
): CanvasEmailBlock => ({
  id,
  order,
  type,
  align: 'left',
  text: `${id} text`,
  imageUrl: '',
  heightPx: 84,
  fontSizePx: 16,
  paddingY: 8,
  paddingX: 10,
  marginBottomPx: 8
});

const makeNode = (
  id: string,
  kind: CanvasElement['kind'],
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number,
  parentId?: string
): Node<CanvasNodeData> => ({
  id,
  type: 'canvasElement',
  position: { x, y },
  parentId,
  data: {
    element: {
      id,
      kind,
      x,
      y,
      width,
      height,
      zIndex,
      text: id,
      style: { fill: '#fff', stroke: '#111', strokeWidth: 1 }
    }
  },
  style: { width, height, zIndex },
  selectable: true,
  draggable: true
});

describe('email block ordering helpers', () => {
  it('normalizes arbitrary order values to contiguous indexes', () => {
    const blocks = [
      makeBlock('b', 10),
      makeBlock('a', 3),
      makeBlock('c', 300)
    ];

    const normalized = normalizeEmailBlockOrder(blocks);
    expect(normalized.map(block => block.id)).toEqual(['a', 'b', 'c']);
    expect(normalized.map(block => block.order)).toEqual([0, 1, 2]);
  });

  it('moves blocks upward/downward by index and reindexes', () => {
    const blocks = normalizeEmailBlockOrder([
      makeBlock('a', 0),
      makeBlock('b', 1),
      makeBlock('c', 2),
      makeBlock('d', 3)
    ]);

    const down = moveBlockByIndex(blocks, 1, 3);
    expect(down.map(block => block.id)).toEqual(['a', 'c', 'd', 'b']);
    expect(down.map(block => block.order)).toEqual([0, 1, 2, 3]);

    const up = moveBlockByIndex(blocks, 3, 1);
    expect(up.map(block => block.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(up.map(block => block.order)).toEqual([0, 1, 2, 3]);
  });

  it('moves block by source/target ids', () => {
    const blocks = normalizeEmailBlockOrder([
      makeBlock('h1', 0, 'H1'),
      makeBlock('h2', 1, 'H2'),
      makeBlock('h3', 2, 'H3')
    ]);

    const moved = moveBlockById(blocks, 'h3', 'h1');
    expect(moved.map(block => block.id)).toEqual(['h3', 'h1', 'h2']);
    expect(moved.map(block => block.order)).toEqual([0, 1, 2]);
  });

  it('normalizes legacy blocks missing order inside ensureEmailTemplate', () => {
    const legacyBlocks = [
      { ...makeBlock('a', 0, 'BODY'), order: undefined, text: 'Body intro' },
      { ...makeBlock('b', 0, 'H1'), order: undefined, text: 'Heading' }
    ] as unknown as CanvasEmailBlock[];

    const template = ensureEmailTemplate({ version: 1, subject: '', blocks: legacyBlocks });
    expect(template.subject).toBe('Body intro');
    expect(template.blocks.map(block => block.id)).toEqual(['a', 'b']);
    expect(template.blocks.map(block => block.order)).toEqual([0, 1]);
  });

  it('preserves existing body position instead of forcing body-first', () => {
    const template = ensureEmailTemplate({
      version: 1,
      subject: 'My subject',
      blocks: [
        makeBlock('h1-top', 0, 'H1'),
        makeBlock('body-middle', 1, 'BODY'),
        makeBlock('h2-bottom', 2, 'H2')
      ]
    });

    expect(template.blocks.map(block => block.id)).toEqual(['h1-top', 'body-middle', 'h2-bottom']);
    expect(template.blocks.map(block => block.order)).toEqual([0, 1, 2]);
  });

  it('appends one body block when missing', () => {
    const template = ensureEmailTemplate({
      version: 1,
      subject: '',
      blocks: [makeBlock('h1-only', 0, 'H1')]
    });

    expect(template.blocks.map(block => block.type)).toEqual(['H1', 'BODY']);
    expect(getRequiredEmailBodyBlockId(template)).toBe(template.blocks[1].id);
  });

  it('returns null protected-body id when multiple body blocks exist', () => {
    const template = ensureEmailTemplate({
      version: 1,
      subject: '',
      blocks: [
        makeBlock('body-1', 0, 'BODY'),
        makeBlock('body-2', 1, 'BODY'),
        makeBlock('h1-1', 2, 'H1')
      ]
    });

    expect(getRequiredEmailBodyBlockId(template)).toBeNull();
  });

  it('falls back to default subject when template has no text content', () => {
    const template = ensureEmailTemplate({
      version: 1,
      subject: '',
      blocks: [{ ...makeBlock('image-only', 0, 'IMAGE'), text: '' }]
    });

    expect(template.subject).toBe(DEFAULT_EMAIL_SUBJECT);
  });

  it('creates H3 block with explicit order', () => {
    const block = createEmailBlock('H3', () => 'new-id', 4);
    expect(block.id).toBe('new-id');
    expect(block.type).toBe('H3');
    expect(block.order).toBe(4);
  });
});

describe('canvas element defaults', () => {
  it('creates rectangle defaults for whiteboard primitives', () => {
    const element = makeDefaultElement('RECTANGLE', 10, 20, 3, () => 'rect-id');

    expect(element.id).toBe('rect-id');
    expect(element.kind).toBe('RECTANGLE');
    expect(element.width).toBeGreaterThan(200);
    expect(element.height).toBeGreaterThan(100);
    expect(element.text).toBe('Rectangle');
  });

  it('creates an empty scene with stable version metadata', () => {
    const scene = createDefaultCanvasScene();

    expect(scene.version).toBe(2);
    expect(scene.elements).toEqual([]);
    expect(scene.relations).toEqual([]);
    expect(scene.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe('container grouping helpers', () => {
  it('resolves absolute bounds and absolute coordinates for parented nodes', () => {
    const container = makeNode('container-a', 'CONTAINER', 100, 200, 300, 220, 0);
    const child = makeNode('child-a', 'RECTANGLE', 20, 30, 80, 60, 1, container.id);
    const nodeById = new Map<string, Node<CanvasNodeData>>([
      [container.id, container],
      [child.id, child]
    ]);

    const absolute = toAbsolutePosition(child.id, nodeById);
    const bounds = getNodeAbsoluteBounds(child.id, nodeById);

    expect(absolute).toEqual({ x: 120, y: 230 });
    expect(bounds).toEqual({ x: 120, y: 230, width: 80, height: 60 });
  });

  it('converts absolute coordinates into parent-relative coordinates', () => {
    const container = makeNode('container-a', 'CONTAINER', 40, 50, 300, 220, 0);
    const nodeById = new Map<string, Node<CanvasNodeData>>([[container.id, container]]);

    const relative = toParentRelativePosition({ x: 185, y: 270 }, container.id, nodeById);
    expect(relative).toEqual({ x: 145, y: 220 });
  });

  it('detects points that lie on inclusive bounds edges', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 80 };

    expect(isPointInsideBounds({ x: 10, y: 20 }, bounds)).toBe(true);
    expect(isPointInsideBounds({ x: 110, y: 100 }, bounds)).toBe(true);
    expect(isPointInsideBounds({ x: 111, y: 100 }, bounds)).toBe(false);
  });

  it('picks the topmost overlapping container for dropped nodes', () => {
    const baseContainer = makeNode('container-base', 'CONTAINER', 0, 0, 320, 260, 1);
    const frontContainer = makeNode('container-front', 'CONTAINER', 40, 40, 260, 220, 3);
    const child = makeNode('child-a', 'RECTANGLE', 120, 100, 60, 50, 5);
    const nodes = [baseContainer, frontContainer, child];
    const nodeById = new Map(nodes.map(node => [node.id, node] as [string, Node<CanvasNodeData>]));

    const selectedContainer = pickDropContainerForNode(child, nodes, nodeById);
    expect(selectedContainer?.id).toBe(frontContainer.id);
  });

  it('never picks a container for container drops (single-level policy)', () => {
    const baseContainer = makeNode('container-base', 'CONTAINER', 0, 0, 320, 260, 1);
    const siblingContainer = makeNode('container-sibling', 'CONTAINER', 20, 20, 200, 200, 2);
    const nodes = [baseContainer, siblingContainer];
    const nodeById = new Map(nodes.map(node => [node.id, node] as [string, Node<CanvasNodeData>]));

    const selectedContainer = pickDropContainerForNode(baseContainer, nodes, nodeById);
    expect(selectedContainer).toBeUndefined();
  });

  it('reconciles drop membership only for single-node drops', () => {
    expect(shouldReconcileContainerMembershipAfterDrop(new Set(['node-a']))).toBe(true);
    expect(shouldReconcileContainerMembershipAfterDrop(new Set(['node-a', 'node-b']))).toBe(false);
  });

  it('maps and rebuilds parent relations without rigid parent extent', () => {
    const scene: CanvasScene = {
      version: 2,
      elements: [
        { id: 'container-a', kind: 'CONTAINER', x: 10, y: 20, width: 300, height: 200, zIndex: 0, text: 'container' },
        { id: 'child-a', kind: 'RECTANGLE', x: 50, y: 40, width: 100, height: 80, zIndex: 1, text: 'child' }
      ],
      relations: [
        { id: 'parent-child-a', type: 'PARENT', fromId: 'child-a', toId: 'container-a' }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    };

    const mapped = mapSceneToState(scene);
    const mappedChild = mapped.nodes.find(node => node.id === 'child-a');
    expect(mappedChild?.parentId).toBe('container-a');
    expect(mappedChild?.extent).toBeUndefined();

    const rebuilt = buildScene(mapped.nodes, mapped.ticketLinks, mapped.viewport);
    expect(rebuilt.relations.some(relation =>
      relation.type === 'PARENT' && relation.fromId === 'child-a' && relation.toId === 'container-a'
    )).toBe(true);
  });
});
