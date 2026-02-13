import { describe, expect, it } from 'vitest';
import { CanvasEmailBlock } from '../../types';
import {
  createEmailBlock,
  ensureEmailTemplate,
  moveBlockById,
  moveBlockByIndex,
  normalizeEmailBlockOrder
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
      { ...makeBlock('a', 0), order: undefined },
      { ...makeBlock('b', 0), order: undefined }
    ] as unknown as CanvasEmailBlock[];

    const template = ensureEmailTemplate({ version: 1, blocks: legacyBlocks });
    expect(template.blocks.map(block => block.id)).toEqual(['a', 'b']);
    expect(template.blocks.map(block => block.order)).toEqual([0, 1]);
  });

  it('creates H3 block with explicit order', () => {
    const block = createEmailBlock('H3', () => 'new-id', 4);
    expect(block.id).toBe('new-id');
    expect(block.type).toBe('H3');
    expect(block.order).toBe(4);
  });
});
