import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasElement, CanvasEmailBlock } from '../../types';
import { CanvasElementNode, CanvasElementNodeProps } from './CanvasElementNode';

vi.mock('@xyflow/react', () => ({
  Handle: ({ position, type }: { position: string; type: string }) => (
    <div data-testid={`handle-${type}-${position}`} />
  ),
  NodeResizer: ({ isVisible }: { isVisible: boolean }) => (
    isVisible ? <div data-testid="node-resizer" /> : null
  ),
  Position: {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left'
  }
}));

/**
 * Returns a complete email body block fixture for node rendering tests.
 * The fixed payload keeps regression tests deterministic across UI refactors.
 * Tradeoff: fixture defaults intentionally skip uncommon block options.
 */
const createBodyBlock = (
  id: string,
  text: string,
  type: CanvasEmailBlock['type'] = 'BODY'
): CanvasEmailBlock => ({
  id,
  order: 0,
  type,
  align: 'left',
  text,
  imageUrl: '',
  heightPx: 84,
  fontSizePx: 16,
  paddingY: 8,
  paddingX: 10,
  marginBottomPx: 8
});

/**
 * Creates a canvas element fixture with stable defaults for rendering tests.
 * This avoids repeating boilerplate geometry/style fields across test cases.
 * Tradeoff: callers override fields explicitly when variant behavior is needed.
 */
const createElementFixture = (
  kind: CanvasElement['kind'],
  overrides: Partial<CanvasElement> = {}
): CanvasElement => ({
  id: 'node-1',
  kind,
  x: 0,
  y: 0,
  width: 260,
  height: 160,
  zIndex: 1,
  text: kind === 'TEXT' ? 'hello world' : 'Node Label',
  style: {
    fill: '#f8fafc',
    stroke: '#64748b',
    strokeWidth: 1,
    fontSize: 14,
    fontFamily: 'Inter'
  },
  ...overrides
});

/**
 * No-op resize callback shared by test node props.
 * Keeping callback shape explicit avoids type drift when controller props evolve.
 * Tradeoff: tests validate render behavior only, not resize callback effects.
 */
const handleResize = (_id: string, _dimensions: { width?: number; height?: number }): void => {};

/**
 * No-op email selection callback shared by test node props.
 * The callback is present so email-card branches can render without controller wiring.
 * Tradeoff: interaction side effects are intentionally out of scope for these tests.
 */
const handleEmailBlockSelect = (_cardId: string, _blockId: string): void => {};

/**
 * No-op email reorder callback shared by test node props.
 * This keeps drag-related prop contracts satisfied in non-interaction tests.
 * Tradeoff: reorder semantics are covered in dedicated controller/helper tests.
 */
const handleEmailBlockReorder = (_cardId: string, _sourceBlockId: string, _targetBlockId: string): void => {};

/**
 * No-op email resize-start callback shared by test node props.
 * The callback ensures resize affordances can mount for email rows without runtime errors.
 * Tradeoff: the test suite does not assert pointer-resize behavior here.
 */
const handleEmailBlockResizeStart = (_cardId: string, _blockId: string, _clientY: number): void => {};

/**
 * No-op email card surface callback shared by test node props.
 * This keeps card-surface click wiring available for branch rendering parity.
 * Tradeoff: click routing behavior is not asserted in this renderer-focused file.
 */
const handleEmailCardSurfaceSelect = (_cardId: string): void => {};

/**
 * No-op email text-change callback shared by test node props.
 * The callback satisfies prop contracts while keeping tests focused on shape output.
 * Tradeoff: block text mutation flow is validated elsewhere.
 */
const handleEmailBlockTextChange = (_cardId: string, _blockId: string, _value: string): void => {};

/**
 * No-op shape edit-start callback shared by test node props.
 * This keeps primitive edit wiring explicit without coupling tests to controller internals.
 * Tradeoff: callbacks are overridden with spies in interaction-focused cases.
 */
const handleShapeTextEditStart = (_shapeId: string): void => {};

/**
 * No-op shape commit callback shared by test node props.
 * This satisfies prop contracts while renderer tests focus on node behavior.
 * Tradeoff: persistence side effects are validated in focused interaction assertions.
 */
const handleShapeTextCommit = (_shapeId: string, _nextText: string): void => {};

/**
 * No-op shape cancel callback shared by test node props.
 * This allows keyboard escape pathways to be wired without extra test harness logic.
 * Tradeoff: cancel semantics are asserted in targeted editor interaction tests.
 */
const handleShapeTextCancel = (): void => {};

/**
 * Builds CanvasElementNode props with deterministic defaults for renderer tests.
 * This helper keeps each test focused on the element variant it intends to verify.
 * Tradeoff: NodeProps internals are intentionally abstracted behind a typed cast.
 */
const createNodeProps = (
  element: CanvasElement,
  overrides: Partial<CanvasElementNodeProps> = {}
): CanvasElementNodeProps => ({
  id: element.id,
  data: { element },
  selected: false,
  width: element.width,
  height: element.height,
  onResizeLive: handleResize,
  onResizeDone: handleResize,
  editingCardId: null,
  activeBlockId: null,
  resizingBlockId: null,
  onEmailBlockSelect: handleEmailBlockSelect,
  onEmailBlockReorder: handleEmailBlockReorder,
  onEmailBlockResizeStart: handleEmailBlockResizeStart,
  onEmailCardSurfaceSelect: handleEmailCardSurfaceSelect,
  onEmailBlockTextChange: handleEmailBlockTextChange,
  editingShapeId: null,
  onShapeTextEditStart: handleShapeTextEditStart,
  onShapeTextCommit: handleShapeTextCommit,
  onShapeTextCancel: handleShapeTextCancel,
  ...overrides
} as unknown as CanvasElementNodeProps);

/**
 * Asserts that all four connector handles are present for a rendered node.
 * Keeping this expectation centralized makes handle-regression tests easier to read.
 * Tradeoff: this helper assumes canonical top/right/bottom/left handle positions.
 */
const expectAllConnectorHandles = (): void => {
  expect(screen.getByTestId('handle-target-top')).toBeInTheDocument();
  expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
  expect(screen.getByTestId('handle-target-bottom')).toBeInTheDocument();
  expect(screen.getByTestId('handle-source-left')).toBeInTheDocument();
};

describe('CanvasElementNode primitive rendering', () => {
  it('renders rectangle as a direct shape without card shell chrome', () => {
    const rectangle = createElementFixture('RECTANGLE', { text: 'Opportunity' });
    render(<CanvasElementNode {...createNodeProps(rectangle, { selected: true })} />);

    expect(screen.getByTestId('rectangle-shape')).toBeInTheDocument();
    expect(screen.queryByTestId('card-shell')).not.toBeInTheDocument();
    expect(screen.queryByText('RECTANGLE')).not.toBeInTheDocument();
    expect(screen.getByTestId('node-resizer')).toBeInTheDocument();
    expectAllConnectorHandles();

    const rectangleInteractionLayer = screen.getByTestId('rectangle-shape').parentElement;
    expect(rectangleInteractionLayer).toHaveClass('pointer-events-none');
  });

  it('renders pencil as a direct stroke without card shell chrome', () => {
    const pencil = createElementFixture('PENCIL', {
      text: '',
      stroke: { points: [{ x: 2, y: 2 }, { x: 90, y: 40 }] }
    });
    render(<CanvasElementNode {...createNodeProps(pencil)} />);

    expect(screen.getByTestId('pencil-shape')).toBeInTheDocument();
    expect(screen.queryByTestId('card-shell')).not.toBeInTheDocument();
    expectAllConnectorHandles();
  });

  it('starts inline shape editing on double click', () => {
    const rectangle = createElementFixture('RECTANGLE', { text: 'Opportunity' });
    const startEditSpy = vi.fn();
    render(<CanvasElementNode {...createNodeProps(rectangle, { onShapeTextEditStart: startEditSpy })} />);

    fireEvent.doubleClick(screen.getByTestId('rectangle-shape'));
    expect(startEditSpy).toHaveBeenCalledWith(rectangle.id);
  });

  it('commits shape rich-text draft on blur while editing', () => {
    const textNode = createElementFixture('TEXT', { text: 'Old text' });
    const commitSpy = vi.fn();
    render(
      <CanvasElementNode
        {...createNodeProps(textNode, {
          selected: true,
          editingShapeId: textNode.id,
          onShapeTextCommit: commitSpy
        })}
      />
    );

    const editor = screen.getByTestId(`shape-editor-${textNode.id}`);
    editor.innerHTML = '<strong>Updated</strong> copy';
    fireEvent.input(editor);
    fireEvent.blur(editor);

    expect(commitSpy).toHaveBeenCalledWith(textNode.id, '<strong>Updated</strong> copy');
  });
});

describe('CanvasElementNode email-card regression', () => {
  it('keeps email card shell and block rendering behavior', () => {
    const emailCard = createElementFixture('EMAIL_CARD', {
      text: 'Email Card',
      emailTemplate: {
        version: 1,
        blocks: [createBodyBlock('block-1', 'Body block content')]
      }
    });

    render(
      <CanvasElementNode
        {...createNodeProps(emailCard, {
          selected: true,
          editingCardId: emailCard.id,
          activeBlockId: 'block-1'
        })}
      />
    );

    expect(screen.getByTestId('card-shell')).toBeInTheDocument();
    expect(screen.getByText('Email Card')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Body block content')).toBeInTheDocument();
  });

  it('uses local draft text for email block typing and commits on blur', () => {
    const emailCard = createElementFixture('EMAIL_CARD', {
      text: 'Email Card',
      emailTemplate: {
        version: 1,
        blocks: [createBodyBlock('block-1', 'H1 copy', 'H1')]
      }
    });
    const commitSpy = vi.fn();

    render(
      <CanvasElementNode
        {...createNodeProps(emailCard, {
          selected: true,
          editingCardId: emailCard.id,
          activeBlockId: 'block-1',
          onEmailBlockTextChange: commitSpy
        })}
      />
    );

    const headingInput = screen.getByDisplayValue('H1 copy');
    fireEvent.change(headingInput, { target: { value: 'Updated heading text' } });
    expect(screen.getByDisplayValue('Updated heading text')).toBeInTheDocument();

    fireEvent.blur(headingInput);
    expect(commitSpy).toHaveBeenCalledWith(emailCard.id, 'block-1', 'Updated heading text');
  });
});
